"""Entry point of .github/workflows/radar-housekeeping.yml: housekeeping on a fresh data head, published per
the writer contract (SPEC section 7), optionally squashed, then the alerts log on main trimmed. Main is written
only by the scheduled run or outside weekdays 13:00-21:30 UTC; other runs report the main trim as deferred
(SPEC 12.4).

python -m radar.storage.housekeeping_job --data-dir _data --main-repo OWNER/REPO --mode apply|dry-run
    --squash auto|force|skip [--force-archive TABLE ...] [--reason TEXT] [--run-id ID] [--report PATH]

Exit codes: 0 ok (warnings allowed); 1 failed (data push, unreadable hot table, main trim, NYSE calendar
running out, crash); 2 partition errors (the affected tables were frozen, nothing of theirs was archived or
trimmed).
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import traceback
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from datetime import time as dtime
from typing import Callable

from radar import calendar_nyse as cal
from radar.config import REPO, RUNTIME
from radar.storage import gitops
from radar.storage import housekeeping as hk
from radar.storage.alerts_store import ContentsStore, GitHubApi
from radar.storage.tables import BY_NAME

SCAN_WORKFLOW = "radar-scan.yml"
SQUASH_GUARD_MARGIN = timedelta(minutes=70)
CALENDAR_WARN_DAYS = 45
SCANNER_REQUEST_PREFIX = "scanner"
MAIN_BUSY_UTC = (dtime(13, 0), dtime(21, 30))   # weekdays: the routines push main (SPEC 12.4)


@dataclass
class SquashDecision:
    squash: bool
    reason: str


@dataclass
class JobResult:
    mode: str
    squash: SquashDecision
    report: dict | None = None
    publish: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    error: str | None = None
    error_is_partition: bool = False


# ---------------------------------------------------------------- squash guards

def scan_window(session: cal.Session) -> tuple[datetime, datetime]:
    """The scanner's writing window for one session: [warmup ET, close + 5 min] (SPEC section 4.9)."""
    start = datetime.combine(session.day, cal.parse_hhmm(RUNTIME["warmup_et"]), tzinfo=cal.ET)
    return start.astimezone(timezone.utc), session.close + timedelta(minutes=5)


def calendar_guard(now: datetime) -> str | None:
    """Why the calendar forbids a squash now (a scan window within 70 minutes), or None."""
    today = now.astimezone(cal.ET).date()
    for day in (today - timedelta(days=1), today, today + timedelta(days=1)):
        session = cal.session_for(day)
        if session is None:
            continue
        w0, w1 = scan_window(session)
        if w0 - SQUASH_GUARD_MARGIN <= now < w1 + SQUASH_GUARD_MARGIN:
            return f"the {day} scan window ({hk.iso(w0)} to {hk.iso(w1)}) is within 70 minutes"
    return None


def scanner_busy_via_api(api: GitHubApi, repo: str) -> str | None:
    """Why the Actions API says the scanner may be writing, or None. Any failure counts as busy."""
    try:
        status, body = api.request("GET", f"/repos/{repo}/actions/workflows/{SCAN_WORKFLOW}/runs"
                                          "?status=in_progress&per_page=1")
    except hk.StoreError as e:
        return f"could not list {SCAN_WORKFLOW} runs ({e})"
    if status != 200 or not isinstance(body, dict):
        return f"could not list {SCAN_WORKFLOW} runs (HTTP {status})"
    n = int(body.get("total_count") or 0)
    return f"{n} {SCAN_WORKFLOW} run(s) in progress" if n else None


def main_writes_allowed(trigger: str, now: datetime) -> bool:
    """SPEC 12.4: main is written (phase B) only by the scheduled run, or by a run outside weekdays
    13:00-21:30 UTC, when the alerts and daily-report routines push main with plain git. Other runs only read
    main and defer its trim to the next nightly run (the rows are already in the backups)."""
    if trigger == "schedule":
        return True
    now = now.astimezone(timezone.utc)
    return now.weekday() >= 5 or not (MAIN_BUSY_UTC[0] <= now.time() < MAIN_BUSY_UTC[1])


def in_auto_window(now: datetime) -> bool:
    """02:00-07:00 UTC (22:00-03:00 EDT / 21:00-02:00 EST) or any time on a UTC weekend."""
    return 2 <= now.hour < 7 or now.weekday() >= 5


def decide_squash(policy: str, now: datetime, scanner_busy: Callable[[], str | None]) -> SquashDecision:
    if policy == "skip":
        return SquashDecision(False, "squash=skip")
    if policy == "auto" and not in_auto_window(now):
        return SquashDecision(False, "outside the auto window (02:00-07:00 UTC or weekend)")
    blocked = calendar_guard(now) or scanner_busy()
    if blocked:
        return SquashDecision(False, f"guard: {blocked}")
    return SquashDecision(True, "squash=force" if policy == "force" else "nightly auto window, scanner idle")


# ---------------------------------------------------------------- job

def commit_message(report: dict, squash: bool, base: str) -> str:
    tables = report["tables"].values()
    msg = (f"Housekeeping {report['run_id']}: archived {sum(t['archive_rows'] for t in tables)} rows, "
           f"purged {sum(t['purge_rows'] for t in tables)}")
    return msg + (f" (squashed data branch; previous head {base[:12]})" if squash else "")


def _publisher(data_dir: str, base: str, squash: bool, pub: dict,
               before_publish: Callable[[], None] | None) -> Callable[[dict], bool]:
    def publish_data(report: dict) -> bool:
        if before_publish:
            before_publish()
        pub.update(gitops.publish(data_dir, base, commit_message(report, squash, base), squash=squash))
        return pub["status"] in ("pushed", "noop")
    return publish_data


def run_job(data_dir: str, main_store: hk.Store | None, *, now: datetime, squash_policy: str,
            scanner_busy: Callable[[], str | None], force_tables: tuple[str, ...] = (), run_id: str | None = None,
            trigger: str = "manual", attempts: int = gitops.MAX_ATTEMPTS, repeats: int = 3,
            sleep: Callable[[float], None] = time.sleep, rng: random.Random | None = None,
            before_publish: Callable[[int], None] | None = None, main_writes: bool | None = None) -> JobResult:
    """Apply mode. Every attempt re-runs housekeeping on a freshly synced head, so a lost race loses nothing.

    `main_writes` None applies the SPEC 12.4 rule (main_writes_allowed); the data branch is always processed."""
    rng = rng or random.Random()
    result = JobResult("apply", decide_squash(squash_policy, now, scanner_busy))
    squash = result.squash.squash
    if main_writes is None:
        main_writes = main_writes_allowed(trigger, now)
    for attempt in range(1, attempts + 1):
        try:
            base = gitops.sync(data_dir)
        except gitops.GitError as e:
            result.publish = {"status": "error", "attempts": attempt, "detail": str(e)[-400:]}
            sleep(gitops.backoff_s(attempt, rng))
            continue
        gitops.ensure_layout(data_dir)
        pub: dict = {}
        hook = (lambda n=attempt: before_publish(n)) if before_publish else None
        result.report = hk.run(data_dir, main_store, now=now, mode="apply", force_tables=force_tables,
                               run_id=run_id, trigger=trigger, repeats=repeats, main_writes=main_writes,
                               publish_data=_publisher(data_dir, base, squash, pub, hook))
        result.publish = {**pub, "attempts": attempt, "previous_head": base}
        status = pub.get("status")
        if status in ("pushed", "noop"):
            break
        if status == "denied" and squash:
            squash = False
            result.squash = SquashDecision(False, "force push denied; fell back to a normal commit")
            result.warnings.append("The squash push was denied (ruleset or branch protection on data?): "
                                   "published a normal commit instead, so history keeps growing.")
            continue
        if status == "denied":
            break
        sleep(gitops.backoff_s(attempt, rng))
    return result


def dry_run_job(data_dir: str, main_store: hk.Store | None, *, now: datetime, squash_policy: str,
                scanner_busy: Callable[[], str | None], force_tables: tuple[str, ...] = (),
                run_id: str | None = None, trigger: str = "manual", repeats: int = 3) -> JobResult:
    """Measures and plans on the checkout as it is; runs no git command and writes nothing."""
    result = JobResult("dry-run", decide_squash(squash_policy, now, scanner_busy))
    result.report = hk.run(data_dir, main_store, now=now, mode="dry-run", force_tables=force_tables,
                           run_id=run_id, trigger=trigger, repeats=repeats)
    return result


def calendar_days_left(now: datetime) -> int:
    return (cal.COVERED_THROUGH - now.astimezone(cal.ET).date()).days


def exit_code(result: JobResult, now: datetime) -> int:
    rep = result.report or {}
    if result.error_is_partition or rep.get("partition_errors"):
        return 2
    if result.error:
        return 1
    if result.mode == "apply" and result.publish.get("status") not in ("pushed", "noop"):
        return 1
    if any(t.get("status") == "ERROR" for t in rep.get("tables", {}).values()):   # an unreadable hot table
        return 1
    if any(t.get("status") == "error" for t in rep.get("main_trim", {}).values()):
        return 1
    return 1 if calendar_days_left(now) < CALENDAR_WARN_DAYS else 0


def _publish_line(result: JobResult) -> str:
    if result.mode == "dry-run":
        return "not published (dry-run: nothing written, no git command run)"
    pub = result.publish
    status, n = pub.get("status", "not attempted"), pub.get("attempts", 0)
    if status == "pushed":
        how = (f"squashed into one commit (previous head {pub['previous_head'][:12]}, "
               f"{pub['commits_before']} commits)") if pub.get("squashed") else "normal commit"
        return f"pushed {pub['sha'][:12]} in {n} attempt(s), {how}"
    if status == "noop":
        return f"nothing to commit (attempt {n})"
    detail = pub.get("detail")
    return f"FAILED ({status}) after {n} attempt(s)" + (f": {detail}" if detail else "")


def render_summary(result: JobResult, now: datetime) -> str:
    rep = result.report
    lines = [hk.render_markdown(rep) if rep else f"### Housekeeping ({result.mode})\n", ""]
    lines.append(f"- **Squash:** {'yes' if result.squash.squash else 'no'} ({result.squash.reason})")
    lines.append(f"- **Data branch:** {_publish_line(result)}")
    if rep and rep.get("main_trim"):
        for name, t in rep["main_trim"].items():
            lines.append(f"- **Main ({BY_NAME[name].path}):** {t['status']}, {t['removed']} rows removed"
                         + (f" in {t['attempts']} attempt(s)" if "attempts" in t else "")
                         + (f": {t['detail']}" if t.get("detail") else ""))
    elif rep and rep.get("data_published") is False:
        lines.append("- **Main:** untouched (the data push was not confirmed; the next run heals)")
    days = calendar_days_left(now)
    lines.append(f"- **NYSE calendar:** covered through {cal.COVERED_THROUGH} ({days} days left)"
                 + (" - add next year's holidays to radar/calendar_nyse.py" if days < CALENDAR_WARN_DAYS else ""))
    lines += [f"- **Warning:** {w}" for w in result.warnings]
    if result.error:
        lines.append(f"- **Error:** {result.error}")
    lines.append(f"- **Exit code:** {exit_code(result, now)}")
    return "\n".join(lines) + "\n"


def trigger_of(event_name: str | None, reason: str) -> str:
    if event_name == "schedule":
        return "schedule"
    return "scanner_request" if reason.strip().lower().startswith(SCANNER_REQUEST_PREFIX) else "manual"


def _default_run_id() -> str | None:
    run, attempt = os.environ.get("GITHUB_RUN_ID"), os.environ.get("GITHUB_RUN_ATTEMPT", "1")
    return f"hk-{run}-{attempt}" if run else None


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        prog="python -m radar.storage.housekeeping_job",
        description="Momentum Radar housekeeping job: archive, retention and squash of the data branch, "
                    "then the alerts-log trim on main. Exit codes: 0 ok, 1 failed, 2 partition errors.")
    ap.add_argument("--data-dir", required=True, help="checkout of the data branch (full history)")
    main = ap.add_mutually_exclusive_group()
    main.add_argument("--main-repo", help=f"OWNER/REPO whose main:alerts/log.json is trimmed via the API ({REPO})")
    main.add_argument("--main-root", help="local main checkout instead of the contents API")
    ap.add_argument("--mode", choices=("apply", "dry-run"), default="apply")
    ap.add_argument("--squash", choices=("auto", "force", "skip"), default="auto")
    ap.add_argument("--force-archive", nargs="*", default=[], choices=sorted(BY_NAME), metavar="TABLE")
    ap.add_argument("--reason", default="")
    ap.add_argument("--trigger", choices=("schedule", "manual", "scanner_request"),
                    help="default: from GITHUB_EVENT_NAME and --reason")
    ap.add_argument("--run-id", default=_default_run_id())
    ap.add_argument("--report", help="write the JSON report here")
    ap.add_argument("--now", help="UTC ISO timestamp (tests and replays)")
    a = ap.parse_args(argv)
    if a.now and hk.parse_ts(a.now) is None:
        ap.error(f"--now {a.now!r} is not an ISO timestamp")
    return a


def main(argv: list[str] | None = None) -> int:
    a = _parse_args(argv)
    now = hk.parse_ts(a.now) if a.now else datetime.now(timezone.utc)
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    api = GitHubApi(token)
    main_store: hk.Store | None = None
    if a.main_repo:
        main_store = ContentsStore(api, a.main_repo, commit_message=f"Housekeeping {a.run_id or 'local'}: "
                                   "trim alerts log (rows backed up on the data branch)")
    elif a.main_root:
        main_store = hk.DirStore(a.main_root)
    kwargs = dict(now=now, squash_policy=a.squash, force_tables=tuple(a.force_archive), run_id=a.run_id,
                  trigger=a.trigger or trigger_of(os.environ.get("GITHUB_EVENT_NAME"), a.reason),
                  scanner_busy=lambda: scanner_busy_via_api(api, a.main_repo or REPO))
    try:
        job = run_job if a.mode == "apply" else dry_run_job
        result = job(a.data_dir, main_store, **kwargs)
    except Exception as e:  # noqa: BLE001 - report every crash in the job summary, then fail the job
        result = JobResult(a.mode, SquashDecision(False, "not reached"), error=f"{type(e).__name__}: {e}",
                           error_is_partition=isinstance(e, hk.PartitionCorrupt))
        traceback.print_exc()
    summary = render_summary(result, now)
    sys.stdout.write(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(summary)
    if a.report:
        with open(a.report, "w", encoding="utf-8") as f:
            json.dump(asdict(result), f, indent=2)
    return exit_code(result, now)


if __name__ == "__main__":
    sys.exit(main())
