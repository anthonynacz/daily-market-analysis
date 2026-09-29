"""The scan loop of one GitHub Actions job (radar/SPEC.md section 4.9).

    python -m radar.loop --data-dir _data --pending-dir "$RUNNER_TEMP/radar-pending" [--once] [--no-push]

Regular session only: a warmup tick at 09:10 ET builds the day's baselines, then one tick runs at
every 5-minute boundary + 50 s from 09:35 through the close, the last one (close + 50 s) flagged
--final. Each tick is a subprocess with a hard timeout and a scrubbed environment; the loop owns
git and publishes every delta per the writer contract. Before each tick it records its own
health and the previous push timings in the worktree's engine.json ("loop"), which the tick
carries into state.json and scan_log. The loop retires after loop_retire_min; the successor run
queued by the watchdog cron takes over.
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Mapping

from . import calendar_nyse as cal
from . import delta, gate, gitsync
from .config import PATHS, REPO, RUNTIME
from .tick import HELD, MS_KEYS, NO_GIT, iso, parse_tick_id, read_json, run_id, scan_log_row

NAP_S = 5.0
WRITE_MS_KEEP = 50
SECRET_ENV = ("GITHUB_TOKEN", "GH_TOKEN")
TICK_CMD = (sys.executable, "-m", "radar.tick")


@dataclass(frozen=True)
class Slot:
    tick_epoch: int          # the 5-minute boundary, passed as --tick-id
    run_at: int              # when the tick starts
    final: bool = False
    warmup: bool = False


def plan_session(s: cal.Session) -> tuple[Slot, list[Slot]]:
    warm = int(gate.scan_window(s)[0].timestamp())
    off = RUNTIME["tick_offset_s"]
    ticks = [Slot(b, b + off) for b in range(s.open_epoch + 300, s.close_epoch, 300)]
    ticks.append(Slot(s.close_epoch, s.close_epoch + RUNTIME["last_tick_after_close_s"], final=True))
    return Slot(warm, warm, warmup=True), ticks


def next_slot(ticks: list[Slot], now: float, last_tick: int | None) -> tuple[Slot | None, int]:
    """The next tick to run and how many boundaries were skipped since last_tick. After an overrun
    the next boundary is taken from now; the final tick always runs, late if it has to."""
    remaining = [t for t in ticks if last_tick is None or t.tick_epoch > last_tick]
    if not remaining:
        return None, 0
    upcoming = [t for t in remaining if t.run_at >= now]
    slot = upcoming[0] if upcoming else remaining[-1]
    skipped = 0 if last_tick is None else sum(1 for t in remaining if t.tick_epoch < slot.tick_epoch)
    return slot, skipped


def scrubbed_env(env: Mapping[str, str]) -> dict[str, str]:
    return {k: v for k, v in env.items() if k not in SECRET_ENV and not k.startswith("ACTIONS_")}


def run_tick_subprocess(cmd: list[str], timeout_s: float, env: dict[str, str]) -> dict:
    """Run one tick; its stderr streams to the job log, its last stdout line is the JSON result."""
    t0 = time.monotonic()
    try:
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=None, text=True, encoding="utf-8",
                           errors="replace", env=env, timeout=timeout_s)
    except subprocess.TimeoutExpired:
        return {"status": "timeout", "message": f"the scan took longer than {timeout_s:.0f} s and was stopped",
                "duration_ms": int((time.monotonic() - t0) * 1000)}
    res: dict = {}
    for line in reversed(p.stdout.strip().splitlines()):
        try:
            res = json.loads(line)
            break
        except ValueError:
            continue
    if p.returncode != 0:
        res = {**res, "status": "error", "message": res.get("message") or f"the scan exited with code {p.returncode}"}
    res.setdefault("status", "error")
    res.setdefault("message", "the scan printed no result")
    res["duration_ms"] = int((time.monotonic() - t0) * 1000)
    return res


def dispatch_housekeeping(repo: str, token: str, reason: str, *, timeout_s: float = 15.0) -> str:
    """Ask for an on-demand housekeeping run (archive only, no squash). Returns "ok" or a short error."""
    body = json.dumps({"ref": "main", "inputs": {"mode": "apply", "squash": "skip",
                                                 "reason": f"scanner: {reason}"[:200]}}).encode()
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/actions/workflows/radar-housekeeping.yml/dispatches",
        data=body, method="POST",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as r:
            return "ok" if r.status in (200, 204) else f"http {r.status}"
    except urllib.error.HTTPError as e:
        return f"http {e.code}"
    except (urllib.error.URLError, OSError) as e:
        return f"network: {e}"[:120]


def log(msg: str) -> None:
    print(f"loop: {msg}", file=sys.stderr, flush=True)


class Loop:
    def __init__(self, data_dir: Path, pending_dir: Path, *, push: bool = True, once: bool = False,
                 retire_min: float = RUNTIME["loop_retire_min"], clock: Callable[[], float] = time.time,
                 sleep: Callable[[float], None] = time.sleep,
                 run_tick: Callable[[list[str], float, dict[str, str]], dict] = run_tick_subprocess,
                 publish: Callable[..., gitsync.PublishResult] = gitsync.publish,
                 dispatch: Callable[[str, str, str], str] = dispatch_housekeeping,
                 env: Mapping[str, str] = os.environ, tick_cmd: tuple[str, ...] = TICK_CMD):
        self.data, self.pending = Path(data_dir), Path(pending_dir)
        self.push, self.once, self.retire_min = push, once, retire_min
        self.clock, self.sleep, self.run_tick, self.publish, self.dispatch = clock, sleep, run_tick, publish, dispatch
        self.env, self.tick_cmd = env, tick_cmd
        self.stop = False
        self.started = 0.0
        self.session_date: str | None = None
        self.ticks_today = self.ticks_skipped = 0
        self.last_tick: int | None = None
        self.git_prev = dict(NO_GIT)
        self.write_ms: list[int] = []

    def request_stop(self, signum: int, _frame: object) -> None:
        self.stop = True
        log(f"signal {signum}: stopping; the flush step pushes what is pending")

    def sleep_until(self, t: float) -> None:
        while not self.stop:
            left = t - self.clock()
            if left <= 0:
                return
            self.sleep(min(left, NAP_S))

    # -- main flow

    def run(self) -> int:
        self.started = self.clock()
        if self.push:
            gitsync.configure(self.data)
        now_dt = datetime.fromtimestamp(self.started, cal.UTC)
        if self.once:
            self._resume(now_dt.astimezone(cal.ET).date().isoformat())
            boundary = int(self.started) // 300 * 300
            self._run(Slot(boundary, int(self.started)), None, ignore_calendar=True)
            return 0
        session = cal.session_for(now_dt.astimezone(cal.ET).date())
        if session is None:
            log("no NYSE session today")
            return 0
        warmup, ticks = plan_session(session)
        self._resume(session.day.isoformat())
        retire_at = self.started + self.retire_min * 60
        log(f"session {session.day} ticks {iso(ticks[0].run_at)}..{iso(ticks[-1].run_at)}, retire {iso(retire_at)}")
        if self.clock() < ticks[0].run_at:
            self.sleep_until(warmup.run_at)
            if self.stop:
                return 0
            self._run(warmup, ticks[0].run_at)
        while not self.stop:
            slot, skipped = next_slot(ticks, self.clock(), self.last_tick)
            if slot is None:
                break
            if slot.run_at > retire_at:
                log("retiring; the queued successor run takes the next tick")
                break
            self.sleep_until(slot.run_at)
            if self.stop:
                break
            self.ticks_skipped += skipped
            following = ticks[ticks.index(slot) + 1].run_at if not slot.final else None
            self._run(slot, following)
            if slot.final:
                break
        return 0

    def _resume(self, session_date: str) -> None:
        """Carry today's counters over a handover from the previous run of the loop."""
        prev = (read_json(self.data / PATHS["engine"]) or {}).get("loop") or {}
        self.git_prev = {**NO_GIT, **(prev.get("git_prev") or {})}
        self.write_ms = [int(v) for v in prev.get("write_ms") or []][-WRITE_MS_KEEP:]
        self.session_date = session_date
        if prev.get("session") == session_date:
            self.ticks_today = int(prev.get("ticks_today", 0))
            self.ticks_skipped = int(prev.get("ticks_skipped", 0))
            if prev.get("last_tick"):
                self.last_tick = parse_tick_id(prev["last_tick"])

    def _run(self, slot: Slot, following: int | None, *, ignore_calendar: bool = False) -> None:
        if not slot.warmup:
            self.ticks_today += 1
            self.last_tick = slot.tick_epoch
        self._prepare(slot, following)
        before = {d.name for d in delta.list_pending(self.pending)}
        cmd = [*self.tick_cmd, "--data-dir", str(self.data), "--pending-dir", str(self.pending),
               "--tick-id", iso(slot.tick_epoch)]
        cmd += ["--warmup"] * slot.warmup + ["--final"] * slot.final + ["--ignore-calendar"] * ignore_calendar
        res = self.run_tick(cmd, RUNTIME["tick_timeout_s"], scrubbed_env(self.env))
        if self.stop:
            return
        wrote = any(d.name not in before for d in delta.list_pending(self.pending))
        if res["status"] in ("timeout", "error") and not wrote:
            self._write_failure(slot, following, res)
        self._publish(slot.final)
        log(f"{iso(slot.tick_epoch)[11:16]}Z {res['status']} · {res.get('members', '?')} on radar "
            f"(+{len(res.get('entered') or [])}/-{len(res.get('exited') or [])}) · tick {res.get('duration_ms', 0)} ms"
            f" · push {self.git_prev['status']} ({self.git_prev['attempts']} attempt(s))"
            + (f" · {res.get('message')}" if res["status"] not in ("ok", "closed") else ""))

    def _prepare(self, slot: Slot, following: int | None) -> None:
        """Record loop health and previous push timings in the worktree's engine.json for the tick,
        and forward a pending housekeeping request at most every hk_dispatch_min_interval_h."""
        path = self.data / PATHS["engine"]
        doc = read_json(path) or {"schema": 1}
        doc["ops"] = self._maybe_dispatch(dict(doc.get("ops") or {"hk_dispatched_at": None}))
        doc["loop"] = {"run_id": run_id(), "started_at": iso(self.started), "session": self.session_date,
                       "ticks_today": self.ticks_today, "ticks_skipped": self.ticks_skipped,
                       "last_tick": iso(self.last_tick) if self.last_tick else None,
                       "push_backlog": len(delta.list_pending(self.pending)), "git_prev": self.git_prev,
                       "write_ms": self.write_ms[-WRITE_MS_KEEP:],
                       "next_tick_at": iso(following) if following else None}
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp-loop")
        tmp.write_bytes(delta.json_bytes(doc))
        os.replace(tmp, path)

    def _maybe_dispatch(self, ops: dict) -> dict:
        request = ops.get("hk_request")
        token = self.env.get("GITHUB_TOKEN")
        if not (self.push and token and request):
            return ops
        try:
            last = parse_tick_id(ops["hk_dispatched_at"]) if ops.get("hk_dispatched_at") else None
        except ValueError:
            last = None
        if last is not None and self.clock() - last < RUNTIME["hk_dispatch_min_interval_h"] * 3600:
            return ops
        reason = request.get("reason", "") if isinstance(request, dict) else str(request)
        result = self.dispatch(self.env.get("GITHUB_REPOSITORY") or REPO, token, reason)
        log(f"housekeeping requested ({reason}): {result}")
        return {**ops, "hk_dispatched_at": iso(self.clock()), "hk_dispatch_result": result}

    def _write_failure(self, slot: Slot, following: int | None, res: dict) -> None:
        """The tick wrote nothing: log the run, keep this loop's engine.json bookkeeping and, during
        the session, republish the previous snapshot flagged as an error."""
        now = self.clock()
        replaces: dict = {PATHS["engine"]: read_json(self.data / PATHS["engine"]) or {"schema": 1}}
        state = read_json(self.data / PATHS["state"])
        if state is not None and not slot.warmup:
            what = "timed out" if res["status"] == "timeout" else "failed"
            state.update(generated_at=iso(now), status="error", message=f"The last scan {what}. {HELD}",
                         next_tick_at=iso(following) if following else None,
                         health={"ticks_today": self.ticks_today, "ticks_skipped": self.ticks_skipped,
                                 "last_tick_ms": int(res.get("duration_ms", 0)), "loop_run_id": run_id(),
                                 "loop_started_at": iso(self.started),
                                 "push_backlog": len(delta.list_pending(self.pending))})
            replaces[PATHS["state"]] = state
        phase, session = cal.phase_at(datetime.fromtimestamp(slot.tick_epoch, cal.UTC))
        row = scan_log_row(
            iso(slot.tick_epoch), iso(now), session=session.day.isoformat() if session else None, phase=phase,
            status="error", lag_s=max(0, int(slot.run_at - slot.tick_epoch)),
            members=len((state or {}).get("members") or []), heating=len((state or {}).get("heating") or []),
            source=((state or {}).get("source") or {}).get("name", "yahoo"),
            ms={**dict.fromkeys(MS_KEYS, 0), "total": int(res.get("duration_ms", 0))},
            git_prev=self.git_prev, hot_bytes=self._hot_bytes(), errors=[f"{res['status']}: {res.get('message', '')}"])
        delta.write_delta(self.pending, iso(slot.tick_epoch), {PATHS["scan_log"]: [row]}, replaces,
                          kind="warmup" if slot.warmup else "tick",
                          summary={"status": "error", "members": row["members"], "entered": [], "exited": []})

    def _hot_bytes(self) -> dict:
        def size(key: str) -> int:
            try:
                return (self.data / PATHS[key]).stat().st_size
            except OSError:
                return 0
        return {k: size(k) for k in ("member_ticks", "events", "scan_log", "state")}

    def _publish(self, final: bool) -> None:
        if not self.push:
            for d in delta.list_pending(self.pending):
                delta.apply_delta(d, self.data)
                delta.remove(d)
            return
        budget = RUNTIME["final_push_budget_s"] if final else RUNTIME["push_budget_s"]
        try:
            res = self.publish(self.data, self.pending, budget_s=budget)
        except (gitsync.GitError, OSError, ValueError) as e:
            log(f"publish failed: {e}")
            self.git_prev = {**NO_GIT, "status": "failed"}
            return
        if res.status == "none":
            return
        self.git_prev = res.git_prev()
        self.write_ms = (self.write_ms + [res.stage_ms + res.commit_ms])[-WRITE_MS_KEEP:]
        if res.status == "failed":
            log(f"push failed after {res.attempts} attempt(s): {res.detail}; the deltas stay pending")


def install_signal_handlers(loop: Loop) -> None:
    signal.signal(signal.SIGTERM, loop.request_stop)
    signal.signal(signal.SIGINT, loop.request_stop)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Run the Momentum Radar scan loop for today's session.")
    ap.add_argument("--data-dir", required=True, type=Path, help="worktree of the data branch")
    ap.add_argument("--pending-dir", required=True, type=Path, help="where ticks write deltas (outside the worktree)")
    ap.add_argument("--once", action="store_true", help="one tick now, even if the market is closed")
    ap.add_argument("--no-push", action="store_true", help="apply deltas locally, never push")
    ap.add_argument("--max-minutes", type=float, default=RUNTIME["loop_retire_min"])
    a = ap.parse_args(argv)
    loop = Loop(a.data_dir, a.pending_dir, push=not a.no_push, once=a.once, retire_min=a.max_minutes)
    install_signal_handlers(loop)
    return loop.run()


if __name__ == "__main__":
    sys.exit(main())
