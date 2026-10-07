"""Data-branch git (SPEC section 7) and the housekeeping job: squash with lease, races with the scanner, the
ruleset fallback, the squash guards, the CLI and the workflow contract. Git runs against a local bare remote."""
from __future__ import annotations

import dataclasses
import json
import os
import random
import re
import subprocess
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

import pytest

from radar import calendar_nyse as cal
from radar.config import PATHS
from radar.storage import gitops as G
from radar.storage import housekeeping as hk
from radar.storage import housekeeping_job as job
from radar.storage import tables as T
from radar.storage.alerts_store import GitHubApi
from radar.storage.synth import dumps, gen_member_ticks, member_tick_row, scanner_write

UTC = timezone.utc
NIGHT = datetime(2026, 9, 26, 3, 30, tzinfo=UTC)       # Sat 03:30Z = Fri 23:30 EDT
NOON = datetime(2026, 9, 25, 16, 0, tzinfo=UTC)        # Fri 12:00 EDT, mid-session
NOSLEEP = lambda s: None  # noqa: E731
IDLE = lambda: None  # noqa: E731
SEED_COMMITS = 4
WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/radar-housekeeping.yml"


def sh(cwd: str, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def configure(repo: str) -> None:
    for k, v in (("user.email", "bot@example.invalid"), ("user.name", "bot"), ("core.autocrlf", "false")):
        sh(repo, "config", k, v)


def clone(bare: str, path: str, *extra: str) -> str:
    sh(os.path.dirname(path), "clone", "-q", "-c", "core.autocrlf=false", *extra, "-b", "data",
       "file://" + bare.replace("\\", "/"), path)
    configure(path)
    return path


def tick_row(ticker: str, minute: int) -> dict:
    return member_tick_row(datetime(2026, 9, 25, 19, minute, tzinfo=UTC), ticker, random.Random(minute))


def append_row(repo: str, row: dict) -> None:
    with open(os.path.join(repo, PATHS["member_ticks"]), "ab") as f:
        f.write((dumps(row) + "\n").encode())


def scanner_append(repo: str, ticker: str, minute: int) -> dict:
    def apply(r: str, attempt: int) -> str:
        append_row(r, tick_row(ticker, minute))
        return f"radar tick {ticker}"
    return scanner_write(repo, apply, sleep=NOSLEEP)


def count_rows(repo: str, ticker: str) -> int:
    with open(os.path.join(repo, PATHS["member_ticks"]), "rb") as f:
        return sum(1 for line in hk.jsonl_lines(f.read().decode()) if json.loads(line)["ticker"] == ticker)


def run_hk(repo: str, now: datetime = NIGHT, **kw) -> job.JobResult:
    kw.setdefault("squash_policy", "auto")
    kw.setdefault("scanner_busy", IDLE)
    return job.run_job(repo, None, now=now, repeats=1, sleep=NOSLEEP, **kw)


@pytest.fixture
def remote(tmp_path, monkeypatch):
    """A bare `data` remote: 30 sessions of member_ticks (DEGRADED at the test limits) plus 3 scanner commits."""
    over = {"member_ticks": dict(max_rows=2000, max_bytes=1 * T.MiB)}
    specs = tuple(dataclasses.replace(s, **over.get(s.name, {})) for s in T.TABLES)
    monkeypatch.setattr(hk, "TABLES", specs)
    monkeypatch.setattr(hk, "BY_NAME", {s.name: s for s in specs})
    bare = str(tmp_path / "remote.git")
    sh(str(tmp_path), "init", "-q", "--bare", bare)
    seed = str(tmp_path / "seed")
    sh(str(tmp_path), "init", "-q", "-b", "data", seed)
    configure(seed)
    os.makedirs(os.path.join(seed, "radar"))
    rows = gen_member_ticks(datetime(2026, 8, 3, tzinfo=UTC), days=30, names=20, ticks_per_day=4)
    with open(os.path.join(seed, PATHS["member_ticks"]), "wb") as f:
        f.write("".join(dumps(r) + "\n" for r in rows).encode())
    with open(os.path.join(seed, "probe.json"), "w", encoding="utf-8") as f:   # left by the branch bootstrap
        f.write('{"probe":1}\n')
    sh(seed, "add", "-A")
    sh(seed, "commit", "-q", "-m", "seed")
    for i in range(SEED_COMMITS - 1):
        append_row(seed, tick_row("SEED", 40 + i))
        sh(seed, "commit", "-qam", f"tick {i}")
    sh(seed, "push", "-q", bare, "data")
    return bare, tmp_path


# ------------------------------------------------------------------ squash and races

def test_squash_is_a_single_root_with_the_expected_tree(remote):
    bare, tmp = remote
    hkrepo = clone(bare, str(tmp / "hk"))
    result = run_hk(hkrepo)
    pub = result.publish
    assert pub["status"] == "pushed" and pub["squashed"] and pub["commits_before"] == SEED_COMMITS
    assert result.report["tables"]["member_ticks"]["status"] == "DEGRADED"
    check = clone(bare, str(tmp / "check"))
    assert G.commit_count(check, "HEAD") == 1
    assert sh(check, "log", "-1", "--format=%an|%s") == (
        f"github-actions[bot]|Housekeeping {result.report['run_id']}: archived "
        f"{result.report['tables']['member_ticks']['archive_rows']} rows, purged 0 "
        f"(squashed data branch; previous head {pub['previous_head'][:12]})")
    assert hk.verify(check)["problems"] == []
    assert count_rows(check, "SEED") == SEED_COMMITS - 1          # the recent rows stay hot
    with open(os.path.join(check, ".gitattributes"), "rb") as f:
        assert f.read() == G.GITATTRIBUTES
    assert not os.path.exists(os.path.join(check, "probe.json"))
    assert job.exit_code(result, NIGHT) == 0


def test_lease_rejects_a_concurrent_scanner_push_and_the_retry_keeps_its_row(remote):
    bare, tmp = remote
    hkrepo, scan = clone(bare, str(tmp / "hk")), clone(bare, str(tmp / "scan"))

    def sneak(attempt: int) -> None:     # the scanner pushes after housekeeping read the head, before it publishes
        if attempt == 1:
            assert scanner_append(scan, "RACE", 50)["status"] == "pushed"
    result = run_hk(hkrepo, before_publish=sneak)
    assert result.publish["status"] == "pushed" and result.publish["attempts"] == 2 and result.publish["squashed"]
    check = clone(bare, str(tmp / "check"))
    assert count_rows(check, "RACE") == 1
    assert G.commit_count(check, "HEAD") == 1
    assert hk.verify(check)["problems"] == []


@pytest.mark.parametrize("depth", [(), ("--depth", "1")], ids=["full", "shallow"])
def test_scanner_reapplies_after_a_squash_without_duplicates(remote, depth):
    bare, tmp = remote
    hkrepo, scan = clone(bare, str(tmp / "hk")), clone(bare, str(tmp / "scan"), *depth)

    def apply(r: str, attempt: int) -> str:
        if attempt == 1:                 # housekeeping squashes between the scanner's sync and its push
            assert run_hk(hkrepo).publish["squashed"]
        append_row(r, tick_row("LATE", 55))
        return "radar tick LATE"
    res = scanner_write(scan, apply, sleep=NOSLEEP)
    assert res["status"] == "pushed" and res["attempts"] == 2
    check = clone(bare, str(tmp / "check"))
    assert count_rows(check, "LATE") == 1
    assert G.commit_count(check, "HEAD") == 2                     # the squashed root + the scanner's tick
    assert hk.verify(check)["problems"] == []


def test_a_daytime_run_adds_a_normal_commit(remote):
    bare, tmp = remote
    hkrepo = clone(bare, str(tmp / "hk"))
    result = run_hk(hkrepo, now=NOON)
    assert not result.squash.squash and "outside the auto window" in result.squash.reason
    assert result.publish["status"] == "pushed" and not result.publish["squashed"]
    check = clone(bare, str(tmp / "check"))
    assert G.commit_count(check, "HEAD") == SEED_COMMITS + 1
    assert sh(check, "rev-parse", "HEAD~1") == result.publish["previous_head"]   # parent = the head read


def test_a_denied_squash_falls_back_to_a_normal_commit(remote):
    bare, tmp = remote
    sh(bare, "config", "receive.denyNonFastForwards", "true")    # like a ruleset blocking force pushes
    hkrepo = clone(bare, str(tmp / "hk"))
    result = run_hk(hkrepo, squash_policy="force")
    assert result.publish["status"] == "pushed" and not result.publish["squashed"]
    assert result.publish["attempts"] == 2 and "fell back" in result.squash.reason
    assert any("denied" in w for w in result.warnings)
    check = clone(bare, str(tmp / "check"))
    assert G.commit_count(check, "HEAD") == SEED_COMMITS + 1
    assert hk.verify(check)["problems"] == []
    assert "**Warning:** The squash push was denied" in job.render_summary(result, NIGHT)


def test_lost_races_on_every_attempt_fail_the_job(remote):
    bare, tmp = remote
    hkrepo, scan = clone(bare, str(tmp / "hk")), clone(bare, str(tmp / "scan"))
    result = run_hk(hkrepo, attempts=2,
                    before_publish=lambda n: scanner_append(scan, f"R{n}", 50 + n))
    assert result.publish["status"] == "conflict" and result.publish["attempts"] == 2
    assert job.exit_code(result, NIGHT) == 1
    check = clone(bare, str(tmp / "check"))
    assert count_rows(check, "R1") == count_rows(check, "R2") == 1  # the scanner's rows are untouched


def test_a_denied_normal_push_is_not_retried(remote, monkeypatch):
    bare, tmp = remote
    hkrepo = clone(bare, str(tmp / "hk"))
    calls = []

    def denied(repo, base, message, *, squash):
        calls.append(squash)
        return {"status": "denied", "sha": None, "squashed": squash, "files": [], "detail": "protected"}
    monkeypatch.setattr(G, "publish", denied)
    result = run_hk(hkrepo, now=NOON)
    assert calls == [False] and result.publish["status"] == "denied"
    assert job.exit_code(result, NOON) == 1
    assert "FAILED (denied) after 1 attempt(s): protected" in job.render_summary(result, NOON)


@pytest.mark.parametrize("text,expected", [
    ("!\trefs/heads/data\t[remote rejected] (push declined due to repository rule violations)", "denied"),
    ("!\tabc:refs/heads/data\t[remote rejected] (non-fast-forward)", "denied"),
    ("!\tabc:refs/heads/data\t[rejected] (stale info)", "conflict"),
    ("!\tabc:refs/heads/data\t[rejected] (fetch first)", "conflict"),
    ("!\tabc:refs/heads/data\t[remote rejected] (failed to update ref)", "conflict"),
    ("fatal: unable to access 'https://github.com/': Could not resolve host", "conflict"),
])
def test_push_failures_are_classified(text, expected):
    assert G._push_failure(subprocess.CompletedProcess(["git"], 1, text, "")) == expected


# ------------------------------------------------------------------ squash guards

def et(d: date, hh: int, mm: int, ss: int = 0) -> datetime:
    return datetime.combine(d, time(hh, mm, ss), tzinfo=cal.ET).astimezone(UTC)


@pytest.mark.parametrize("now,blocked", [
    (et(date(2026, 9, 25), 7, 59, 59), False),    # 70 min before the 09:10 ET warmup ...
    (et(date(2026, 9, 25), 8, 0), True),          # ... starts the guard
    (et(date(2026, 9, 25), 12, 0), True),
    (et(date(2026, 9, 25), 17, 14, 59), True),    # close + 5 min + 70 min
    (et(date(2026, 9, 25), 17, 15), False),
    (et(date(2026, 11, 27), 14, 14, 59), True),   # half day: 13:00 close
    (et(date(2026, 11, 27), 14, 15), False),
    (et(date(2026, 11, 26), 12, 0), False),       # Thanksgiving
    (et(date(2026, 9, 26), 12, 0), False),        # Saturday
    (datetime(2026, 12, 14, 13, 5, tzinfo=UTC), True),    # EST: warmup 14:10Z, guard from 13:00Z
    (datetime(2026, 12, 14, 12, 55, tzinfo=UTC), False),
])
def test_calendar_guard(now, blocked):
    assert (job.calendar_guard(now) is not None) == blocked


def test_the_nightly_cron_is_never_blocked_by_the_calendar():
    d = date(2026, 1, 1)
    while d <= cal.COVERED_THROUGH:
        now = datetime.combine(d, time(3, 30), tzinfo=UTC)
        assert job.calendar_guard(now) is None and job.in_auto_window(now), d
        d += timedelta(days=1)


@pytest.mark.parametrize("policy,now,busy,squash,why", [
    ("skip", NIGHT, None, False, "squash=skip"),
    ("auto", NIGHT, None, True, "nightly auto window"),
    ("auto", NIGHT, "1 radar-scan.yml run(s) in progress", False, "guard: 1 radar-scan.yml"),
    ("auto", NOON, None, False, "outside the auto window"),
    ("force", NOON, None, False, "guard: the 2026-09-25 scan window"),
    ("force", datetime(2026, 9, 26, 16, 0, tzinfo=UTC), None, True, "squash=force"),   # Saturday noon
    ("auto", datetime(2026, 9, 27, 16, 0, tzinfo=UTC), None, True, "nightly auto window"),  # Sunday
])
def test_decide_squash(policy, now, busy, squash, why):
    d = job.decide_squash(policy, now, lambda: busy)
    assert d.squash == squash and why in d.reason


@pytest.mark.parametrize("trigger,now,allowed", [
    ("schedule", datetime(2026, 10, 6, 15, 10, tzinfo=UTC), True),          # the scheduled run always may
    ("scanner_request", datetime(2026, 10, 6, 15, 10, tzinfo=UTC), False),  # Tuesday, routines active
    ("manual", datetime(2026, 10, 6, 12, 59, 59, tzinfo=UTC), True),
    ("manual", datetime(2026, 10, 6, 13, 0, tzinfo=UTC), False),
    ("manual", datetime(2026, 10, 6, 21, 29, 59, tzinfo=UTC), False),
    ("scanner_request", datetime(2026, 10, 6, 21, 30, tzinfo=UTC), True),
    ("manual", datetime(2026, 10, 10, 15, 0, tzinfo=UTC), True),            # Saturday
    ("scanner_request", datetime(2026, 10, 5, 13, 30, tzinfo=UTC), False),  # Monday
])
def test_main_writes_allowed(trigger, now, allowed):
    assert job.main_writes_allowed(trigger, now) == allowed


class FakeActions:
    def __init__(self, *responses):
        self.responses, self.urls = list(responses), []

    def __call__(self, method, url, headers, body, timeout):
        self.urls.append((method, url))
        status, payload = self.responses.pop(0)
        return status, {}, json.dumps(payload).encode()


def test_scanner_busy_via_the_actions_api():
    fake = FakeActions((200, {"total_count": 1, "workflow_runs": [{"id": 1}]}), (200, {"total_count": 0}),
                       (404, {"message": "Not Found"}), (500, {}), (500, {}), (500, {}))
    api = GitHubApi("tok", transport=fake, sleep=NOSLEEP)
    assert job.scanner_busy_via_api(api, "o/r") == "1 radar-scan.yml run(s) in progress"
    assert fake.urls[0] == ("GET", "https://api.github.com/repos/o/r/actions/workflows/radar-scan.yml/runs"
                                   "?status=in_progress&per_page=1")
    assert job.scanner_busy_via_api(api, "o/r") is None
    assert "HTTP 404" in job.scanner_busy_via_api(api, "o/r")            # unknown counts as busy
    assert "could not list" in job.scanner_busy_via_api(api, "o/r")      # so does an outage


# ------------------------------------------------------------------ CLI entry point (the workflow step)

@pytest.fixture
def gha_env(tmp_path, monkeypatch):
    summary = tmp_path / "summary.md"
    for k in ("GITHUB_TOKEN", "GH_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    monkeypatch.setenv("GITHUB_EVENT_NAME", "schedule")
    monkeypatch.setenv("GITHUB_RUN_ID", "777")
    monkeypatch.setenv("GITHUB_RUN_ATTEMPT", "1")
    monkeypatch.setattr(job, "scanner_busy_via_api", lambda api, repo: None)   # no network
    main = tmp_path / "main"
    (main / "alerts").mkdir(parents=True)
    (main / T.ALERTS_LOG_PATH).write_text('{"alerts": []}\n', encoding="utf-8")
    return summary, str(main)


def test_cli_apply_publishes_and_writes_the_job_summary(remote, gha_env):
    bare, tmp = remote
    summary, main = gha_env
    data = clone(bare, str(tmp / "data"))
    report = tmp / "report.json"
    rc = job.main(["--data-dir", data, "--main-root", main, "--mode", "apply", "--squash", "auto",
                   "--now", "2026-09-26T03:30:00Z", "--report", str(report)])
    assert rc == 0
    text = summary.read_text(encoding="utf-8")
    assert "### Housekeeping hk-777-1 (apply, trigger: schedule)" in text
    assert "**Squash:** yes" in text and "squashed into one commit" in text and "**Exit code:** 0" in text
    rep = json.loads(report.read_text(encoding="utf-8"))
    assert rep["publish"]["status"] == "pushed" and rep["report"]["run_id"] == "hk-777-1"
    check = clone(bare, str(tmp / "check"))
    with open(os.path.join(check, "ops/housekeeping_runs.jsonl"), encoding="utf-8") as f:
        run_row = json.loads(hk.jsonl_lines(f.read())[-1])
    assert run_row["trigger"] == "schedule" and run_row["run_id"] == "hk-777-1"


def test_cli_dry_run_writes_nothing(remote, gha_env):
    bare, tmp = remote
    summary, main = gha_env
    data = clone(bare, str(tmp / "data"))
    head = sh(bare, "rev-parse", "refs/heads/data")
    rc = job.main(["--data-dir", data, "--main-root", main, "--mode", "dry-run", "--force-archive", "scan_log",
                   "--now", "2026-09-26T03:30:00Z"])
    assert rc == 0
    assert sh(data, "status", "--porcelain", "--ignored") == ""
    assert sh(bare, "rev-parse", "refs/heads/data") == head
    text = summary.read_text(encoding="utf-8")
    assert "(dry-run, trigger: schedule)" in text and "not published (dry-run" in text
    assert "Partitions to write: member_ticks/2026-08, member_ticks/2026-09" in text


def test_cli_exits_2_on_partition_errors_but_publishes_the_other_tables(remote, gha_env, monkeypatch):
    bare, tmp = remote
    summary, main = gha_env
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    seed = clone(bare, str(tmp / "seed2"))
    os.makedirs(os.path.join(seed, "backups/member_ticks"))
    with open(os.path.join(seed, "backups/member_ticks/2026-08.jsonl.gz"), "wb") as f:
        f.write(b"not a gzip file")
    sh(seed, "add", "-A")
    sh(seed, "commit", "-q", "-m", "corrupt partition")
    sh(seed, "push", "-q", "origin", "data")
    data = clone(bare, str(tmp / "data"))
    rc = job.main(["--data-dir", data, "--main-root", main, "--squash", "skip", "--reason", "scanner: test",
                   "--now", "2026-09-26T03:30:00Z"])
    assert rc == 2
    text = summary.read_text(encoding="utf-8")
    assert "(apply, trigger: scanner_request)" in text and "Partition errors (tables frozen): member_ticks" in text
    check = clone(bare, str(tmp / "check"))
    assert os.path.exists(os.path.join(check, T.HEALTH_PATH))            # the other tables were still processed
    assert count_rows(check, "SEED") == SEED_COMMITS - 1 and hk.verify(check)["problems"]


def test_cli_daytime_scanner_request_defers_the_main_trim_to_the_nightly_run(remote, gha_env):
    """STO-3 / SPEC 12.4: a scanner-requested run inside weekdays 13:00-21:30 UTC backs the alerts log up on the
    data branch but leaves main byte-identical; the next scheduled run trims main from rows already backed up."""
    bare, tmp = remote
    summary, main = gha_env
    rng = random.Random(12)
    t0 = datetime(2026, 10, 6, 15, 10, tzinfo=UTC)
    alerts = [{"ts": hk.iso(t0 - timedelta(hours=8 * (i + 1))), "ticker": rng.choice(["NVDA", "AMD"]),
               "headline": f"alert {i}"} for i in range(185)]                       # newest first, DEGRADED
    log = Path(main) / T.ALERTS_LOG_PATH
    log.write_text(json.dumps({"alerts": alerts}, indent=2) + "\n", encoding="utf-8")
    before = log.read_bytes()
    data, report = clone(bare, str(tmp / "data")), tmp / "report.json"
    rc = job.main(["--data-dir", data, "--main-root", main, "--squash", "skip", "--trigger", "scanner_request",
                   "--now", "2026-10-06T15:10:00Z", "--report", str(report)])
    assert rc == 0 and log.read_bytes() == before
    rep = json.loads(report.read_text(encoding="utf-8"))["report"]
    assert rep["tables"]["alerts_log"]["archive_rows"] > 0
    assert rep["main_trim"]["alerts_log"]["status"] == "deferred"
    assert "**Main (alerts/log.json):** deferred, 0 rows removed" in summary.read_text(encoding="utf-8")
    spec = T.BY_NAME["alerts_log"]
    window = (datetime(2026, 7, 1, tzinfo=UTC), datetime(2026, 11, 1, tzinfo=UTC))
    check = clone(bare, str(tmp / "check"))
    assert {hk.canon(r) for r in hk.query(check, "alerts_log", *window)} == {hk.canon(a) for a in alerts}

    rc = job.main(["--data-dir", data, "--main-root", main, "--squash", "skip", "--trigger", "schedule",
                   "--now", "2026-10-07T03:30:00Z", "--report", str(report)])
    assert rc == 0
    rep = json.loads(report.read_text(encoding="utf-8"))["report"]
    assert rep["main_trim"]["alerts_log"]["status"] == "trimmed"
    assert not [p for p in rep["partitions_written"] if p.startswith("alerts_log/")]   # all backed up by day
    left = json.loads(log.read_text(encoding="utf-8"))["alerts"]
    assert len(left) <= spec.target_ratio * spec.max_rows and left == alerts[:len(left)]
    check = clone(bare, str(tmp / "check2"))
    assert {hk.canon(r) for r in hk.query(check, "alerts_log", *window)} == {hk.canon(a) for a in alerts}


def test_exit_code_warns_before_the_calendar_runs_out():
    result = job.JobResult("apply", job.SquashDecision(False, "squash=skip"), publish={"status": "noop", "attempts": 1})
    assert job.exit_code(result, NIGHT) == 0
    late = datetime.combine(cal.COVERED_THROUGH - timedelta(days=job.CALENDAR_WARN_DAYS - 1), time(12, 0), UTC)
    assert job.exit_code(result, late) == 1
    assert "add next year's holidays" in job.render_summary(result, late)


@pytest.mark.parametrize("event,reason,trigger", [
    ("schedule", "schedule", "schedule"),
    ("workflow_dispatch", "scanner: member_ticks over 1.25x the size limit", "scanner_request"),
    ("workflow_dispatch", "manual", "manual"),
])
def test_trigger_of(event, reason, trigger):
    assert job.trigger_of(event, reason) == trigger


# ------------------------------------------------------------------ workflow contract (SPEC section 9)

def test_housekeeping_workflow_contract():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert re.findall(r"^\s*-\s*cron:\s*'([^']+)'", text, re.M) == ["30 3 * * *"]
    for opt in ("mode", "squash", "force_archive", "reason"):
        assert re.search(rf"^      {opt}:\n", text, re.M), opt
    assert "options: [apply, dry-run]" in text and "options: [auto, force, skip]" in text
    assert re.search(r"^permissions:\n  contents: write.*\n  actions: read", text, re.M)
    assert re.search(r"^concurrency:\n  group: radar-housekeeping.*\n  cancel-in-progress: false", text, re.M)
    assert "timeout-minutes: 20" in text
    uses = re.findall(r"uses:\s*(\S+)", text)
    assert uses and all(re.fullmatch(r"[\w.-]+/[\w.-]+@[0-9a-f]{40}", u) for u in uses), uses
    assert "fetch-depth: 0" in text and "sparse-checkout: radar" in text
    assert "--require-hashes -r radar/requirements.lock" in text
    assert "cache-dependency-path: radar/requirements.lock" in text
    assert "python -m radar.storage.housekeeping_job" in text and "--data-dir _data" in text
    run_blocks = re.findall(r"run: \|\n((?:          .*\n)+)", text)
    assert run_blocks and not any("${{" in b for b in run_blocks)     # inputs reach the shell only through env
