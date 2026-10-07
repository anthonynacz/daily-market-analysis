"""Publish pending deltas to the data branch: the writer contract of radar/SPEC.md section 7.

Each attempt fetches origin/data, hard-resets the worktree to it, re-applies every pending delta in
tick order, commits on the fetched head and pushes. It never merges, rebases or forces. After every
attempt, successful or not, the worktree holds the remote head plus all pending deltas, which is
exactly what the next tick reads. Commits carry a `Radar-Delta:` trailer so a delta that landed
just before a crash (push done, delta dir not yet removed) is recognised and not applied twice.
A publish holds an exclusive lock on <pending>/.publish.lock, so the loop and the workflow's flush
step never reset and re-apply the same worktree at the same time.

    python -m radar.gitsync --data-dir _data --pending-dir "$RUNNER_TEMP/radar-pending" --final

Stdlib only.
"""
from __future__ import annotations

import argparse
import random
import subprocess
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterator

from . import delta
from .config import DATA_BRANCH, RUNTIME

try:
    import fcntl
except ImportError:          # Windows (local runs only): no flock, publishing is not locked
    fcntl = None  # type: ignore[assignment]

REMOTE_REF = f"refs/remotes/origin/{DATA_BRANCH}"
BOT_NAME = "github-actions[bot]"
BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com"
TRAILER = "Radar-Delta:"
MAX_ATTEMPTS = 5
LANDED_SCAN_COMMITS = 50
LOCAL_TIMEOUT_S = 120
LOCK_FILE = ".publish.lock"  # in the pending dir; dot-files are never taken for deltas


class GitError(RuntimeError):
    pass


@dataclass
class PublishResult:
    status: str = "none"            # ok | resynced | failed | none
    attempts: int = 0
    stage_ms: int = 0
    commit_ms: int = 0
    push_ms: int = 0
    detail: str = ""
    pushed: list[str] = field(default_factory=list)

    def git_prev(self) -> dict:
        return {"stage": self.stage_ms, "commit": self.commit_ms, "push": self.push_ms,
                "attempts": self.attempts, "status": self.status}


def git(repo: str | Path, *args: str, timeout: float = LOCAL_TIMEOUT_S) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(args, 124, "", f"git {args[0]} timed out after {timeout:.0f} s")


def _check(repo: str | Path, *args: str) -> str:
    cp = git(repo, *args)
    if cp.returncode != 0:
        raise GitError(f"git {' '.join(args)}: {_last_line(cp)}")
    return cp.stdout


def _last_line(cp: subprocess.CompletedProcess) -> str:
    lines = (cp.stderr or cp.stdout or "").strip().splitlines()
    return lines[-1][:200] if lines else f"exit {cp.returncode}"


def configure(repo: str | Path) -> None:
    for key, value in (("user.name", BOT_NAME), ("user.email", BOT_EMAIL), ("core.autocrlf", "false")):
        _check(repo, "config", key, value)


def commit_message(metas: list[dict], names: list[str]) -> str:
    newest = metas[-1]
    summary = newest.get("summary") or {}
    entered = sum(len((m.get("summary") or {}).get("entered") or []) for m in metas)
    exited = sum(len((m.get("summary") or {}).get("exited") or []) for m in metas)
    hhmm = newest["tick_id"][11:16]
    head = (f"radar {hhmm}Z {summary.get('status', newest.get('kind', 'tick'))} · "
            f"{summary.get('members', 0)} on radar (+{entered}/-{exited})")
    return f"{head}\n\n{TRAILER} {' '.join(names)}\n"


def landed_ids(repo: str | Path) -> set[str]:
    cp = git(repo, "log", "-n", str(LANDED_SCAN_COMMITS), "--format=%B", REMOTE_REF)
    ids: set[str] = set()
    for line in cp.stdout.splitlines() if cp.returncode == 0 else ():
        if line.startswith(TRAILER):
            ids.update(line[len(TRAILER):].split())
    return ids


def _sync(repo: str | Path, fetch_timeout: float) -> tuple[bool, str]:
    """Steps 1-2 of the contract. A failed fetch still resets to the last known remote head."""
    fetch = git(repo, "fetch", "--no-tags", "origin", f"+refs/heads/{DATA_BRANCH}:{REMOTE_REF}", timeout=fetch_timeout)
    _check(repo, "checkout", "-q", "-f", "-B", DATA_BRANCH, REMOTE_REF)
    _check(repo, "reset", "-q", "--hard", REMOTE_REF)
    _check(repo, "clean", "-q", "-fdx")
    return fetch.returncode == 0, "" if fetch.returncode == 0 else f"fetch failed: {_last_line(fetch)}"


@contextmanager
def publish_lock(pending_root: str | Path) -> Iterator[None]:
    """Exclusive flock on <pending_root>/.publish.lock for the whole publish; a no-op without fcntl."""
    if fcntl is None:
        yield
        return
    root = Path(pending_root)
    root.mkdir(parents=True, exist_ok=True)
    with open(root / LOCK_FILE, "ab") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)


def publish(repo: str | Path, pending_root: str | Path, *, budget_s: float,
            sleep: Callable[[float], None] = time.sleep, clock: Callable[[], float] = time.monotonic,
            rand: Callable[[], float] = random.random) -> PublishResult:
    with publish_lock(pending_root):
        return _publish(repo, pending_root, budget_s=budget_s, sleep=sleep, clock=clock, rand=rand)


def _publish(repo: str | Path, pending_root: str | Path, *, budget_s: float, sleep: Callable[[float], None],
             clock: Callable[[], float], rand: Callable[[], float]) -> PublishResult:
    res = PublishResult()
    deadline = clock() + budget_s
    for attempt in range(1, MAX_ATTEMPTS + 1):
        pending = delta.list_pending(pending_root)
        if not pending:
            return res
        res.attempts = attempt
        fetched, res.detail = _sync(repo, max(5.0, deadline - clock()))
        landed = landed_ids(repo)
        for d in (d for d in pending if d.name in landed):
            delta.remove(d)
        todo = [d for d in pending if d.name not in landed]
        if not todo:
            res.detail = "pending deltas had already landed"
            return res
        for d in todo:
            delta.apply_delta(d, repo)
        t = clock()
        _check(repo, "add", "-A")
        res.stage_ms = int((clock() - t) * 1000)
        if git(repo, "diff", "--cached", "--quiet").returncode == 0:
            for d in todo:
                delta.remove(d)
            res.detail = "pending deltas changed nothing"
            return res
        t = clock()
        _check(repo, "commit", "-q", "-m", commit_message([delta.read_meta(d) for d in todo], [d.name for d in todo]))
        res.commit_ms = int((clock() - t) * 1000)
        if fetched:
            t = clock()
            push = git(repo, "push", "--porcelain", "origin", f"HEAD:refs/heads/{DATA_BRANCH}",
                       timeout=max(5.0, deadline - clock()))
            res.push_ms = int((clock() - t) * 1000)
            if push.returncode == 0:
                git(repo, "update-ref", REMOTE_REF, "HEAD")
                for d in todo:
                    delta.remove(d)
                res.status = "ok" if attempt == 1 else "resynced"
                res.pushed = [d.name for d in todo]
                res.detail = ""
                return res
            res.detail = f"push rejected or failed: {_last_line(push)}"
        wait = min(30.0, 2.0 ** attempt) * (0.5 + rand())
        if attempt == MAX_ATTEMPTS or clock() + wait >= deadline:
            break
        sleep(wait)
    res.status = "failed"
    return res


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Push pending radar deltas to the data branch.")
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--pending-dir", required=True)
    ap.add_argument("--final", action="store_true", help="use the longer end-of-job push budget")
    a = ap.parse_args(argv)
    configure(a.data_dir)
    budget = RUNTIME["final_push_budget_s"] if a.final else RUNTIME["push_budget_s"]
    res = publish(a.data_dir, a.pending_dir, budget_s=budget)
    print(f"gitsync: {res.status} after {res.attempts} attempt(s); pushed {len(res.pushed)} delta(s)"
          + (f"; {res.detail}" if res.detail else ""), flush=True)
    return 1 if res.status == "failed" else 0


if __name__ == "__main__":
    sys.exit(main())
