"""The data-branch writer contract against a local bare remote (radar/SPEC.md section 7)."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from radar import delta, gitsync

BINARY = b"\x1f\x8b\x08\x00\r\n\x00binary\r\n"
NOSLEEP = lambda s: None  # noqa: E731


def sh(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", "-c", "core.autocrlf=false", *args], cwd=cwd, check=True,
                          capture_output=True, text=True, encoding="utf-8").stdout.strip()


def show(bare: Path, path: str) -> bytes:
    return subprocess.run(["git", "show", f"data:{path}"], cwd=bare, check=True, capture_output=True).stdout


def rows(bare: Path, path: str = "radar/scan_log.jsonl") -> list[dict]:
    return [json.loads(line) for line in show(bare, path).decode().splitlines()]


def identity(repo: Path) -> None:
    for k, v in (("user.name", "someone"), ("user.email", "someone@example.invalid"), ("core.autocrlf", "false")):
        sh(repo, "config", k, v)


@pytest.fixture
def remote(tmp_path: Path) -> Path:
    bare = tmp_path / "origin.git"
    sh(tmp_path, "init", "-q", "--bare", str(bare))
    seed = tmp_path / "seed"
    sh(tmp_path, "init", "-q", "-b", "data", str(seed))
    identity(seed)
    (seed / "radar").mkdir()
    (seed / ".gitattributes").write_bytes(b"* -text\n")
    (seed / "radar/state.json").write_bytes(b'{"schema":1}\n')
    (seed / "radar/scan_log.jsonl").write_bytes(b'{"tick":"seed"}\n')
    sh(seed, "add", "-A")
    sh(seed, "commit", "-qm", "seed")
    sh(seed, "push", "-q", str(bare), "data")
    return bare


def clone(bare: Path, dest: Path, *, bot: bool = True) -> Path:
    sh(dest.parent, "clone", "-q", "--depth", "1", "--branch", "data", bare.as_uri(), str(dest))
    gitsync.configure(dest) if bot else identity(dest)
    return dest


def tick_delta(pending: Path, tick: str, members: int = 1, entered: tuple[str, ...] = ()) -> Path:
    return delta.write_delta(pending, tick, {"radar/scan_log.jsonl": [{"tick": tick}]},
                             {"radar/state.json": {"tick_id": tick, "members": members},
                              "radar/baselines.json.gz": BINARY},
                             summary={"status": "ok", "members": members, "entered": list(entered), "exited": []})


def test_publish_pushes_pending_deltas_in_tick_order(remote, tmp_path):
    work, pending = clone(remote, tmp_path / "work"), tmp_path / "pending"
    second = tick_delta(pending, "2026-09-28T13:40:00Z", members=3, entered=("NVDA",))
    first = tick_delta(pending, "2026-09-28T13:35:00Z")
    res = gitsync.publish(work, pending, budget_s=60, sleep=NOSLEEP)
    assert (res.status, res.attempts, res.pushed) == ("ok", 1, [first.name, second.name])
    assert res.git_prev() == {"stage": res.stage_ms, "commit": res.commit_ms, "push": res.push_ms,
                              "attempts": 1, "status": "ok"}
    assert [r["tick"] for r in rows(remote)] == ["seed", "2026-09-28T13:35:00Z", "2026-09-28T13:40:00Z"]
    assert json.loads(show(remote, "radar/state.json")) == {"members": 3, "tick_id": "2026-09-28T13:40:00Z"}
    assert show(remote, "radar/baselines.json.gz") == BINARY
    message = sh(remote, "log", "-1", "--format=%B", "data")
    assert message.splitlines()[0] == "radar 13:40Z ok · 3 on radar (+1/-0)"
    assert f"{gitsync.TRAILER} {first.name} {second.name}" in message
    assert sh(remote, "log", "-1", "--format=%an <%ae>", "data") == f"{gitsync.BOT_NAME} <{gitsync.BOT_EMAIL}>"
    assert sh(remote, "rev-list", "--count", "data") == "2"
    assert delta.list_pending(pending) == []
    assert sh(work, "status", "--porcelain") == "" and sh(work, "rev-parse", "HEAD") == sh(remote, "rev-parse", "data")


def test_nothing_pending_is_a_noop(remote, tmp_path):
    work = clone(remote, tmp_path / "work")
    res = gitsync.publish(work, tmp_path / "pending", budget_s=60, sleep=NOSLEEP)
    assert (res.status, res.attempts) == ("none", 0)
    assert sh(remote, "rev-list", "--count", "data") == "1"


def test_concurrent_writer_between_fetch_and_push(remote, tmp_path, monkeypatch):
    work, pending = clone(remote, tmp_path / "work"), tmp_path / "pending"
    other = clone(remote, tmp_path / "other", bot=False)
    tick_delta(pending, "2026-09-28T13:35:00Z")
    real_git, raced = gitsync.git, []

    def racing_git(repo, *args, **kw):
        if args[0] == "push" and not raced:                   # housekeeping lands first
            raced.append(True)
            with open(other / "radar/scan_log.jsonl", "ab") as f:
                f.write(b'{"tick":"housekeeping"}\n')
            sh(other, "commit", "-qam", "housekeeping")
            sh(other, "push", "-q", "origin", "data")
        return real_git(repo, *args, **kw)

    monkeypatch.setattr(gitsync, "git", racing_git)
    res = gitsync.publish(work, pending, budget_s=60, sleep=NOSLEEP)
    assert (res.status, res.attempts) == ("resynced", 2)
    assert [r["tick"] for r in rows(remote)] == ["seed", "housekeeping", "2026-09-28T13:35:00Z"]
    assert sh(remote, "log", "--format=%s", "data").splitlines()[1] == "housekeeping"   # plain fast-forward
    assert sh(remote, "rev-list", "--count", "data") == "3"


def test_squashed_remote_is_followed_without_duplicates(remote, tmp_path):
    work, pending = clone(remote, tmp_path / "work"), tmp_path / "pending"
    tick_delta(pending, "2026-09-28T13:35:00Z")
    assert gitsync.publish(work, pending, budget_s=60, sleep=NOSLEEP).status == "ok"
    squasher = clone(remote, tmp_path / "hk", bot=False)       # housekeeping squashes with a lease
    head = sh(squasher, "rev-parse", "HEAD")
    sh(squasher, "checkout", "-q", "--orphan", "squashed")
    sh(squasher, "commit", "-qm", "squashed data branch")
    sh(squasher, "push", "-q", f"--force-with-lease=refs/heads/data:{head}", "origin", "squashed:data")
    tick_delta(pending, "2026-09-28T13:40:00Z")
    res = gitsync.publish(work, pending, budget_s=60, sleep=NOSLEEP)
    assert res.status == "ok"
    assert [r["tick"] for r in rows(remote)] == ["seed", "2026-09-28T13:35:00Z", "2026-09-28T13:40:00Z"]
    assert sh(remote, "rev-list", "--count", "data") == "2"


def test_unreachable_remote_keeps_deltas_and_the_worktree_holds_them(remote, tmp_path):
    work, pending = clone(remote, tmp_path / "work"), tmp_path / "pending"
    tick_delta(pending, "2026-09-28T13:35:00Z", members=7)
    sh(work, "remote", "set-url", "origin", (tmp_path / "gone.git").as_uri())
    res = gitsync.publish(work, pending, budget_s=60, sleep=NOSLEEP, rand=lambda: 0.5)
    assert (res.status, res.attempts) == ("failed", gitsync.MAX_ATTEMPTS)
    assert res.detail.startswith("fetch failed")
    assert len(delta.list_pending(pending)) == 1
    assert json.loads((work / "radar/state.json").read_bytes())["members"] == 7   # the next tick reads this
    assert (work / "radar/scan_log.jsonl").read_bytes().count(b"13:35") == 1
    sh(work, "remote", "set-url", "origin", remote.as_uri())
    assert gitsync.publish(work, pending, budget_s=60, sleep=NOSLEEP).status == "ok"
    assert [r["tick"] for r in rows(remote)] == ["seed", "2026-09-28T13:35:00Z"]


def test_push_budget_limits_the_attempts(remote, tmp_path):
    work, pending = clone(remote, tmp_path / "work"), tmp_path / "pending"
    tick_delta(pending, "2026-09-28T13:35:00Z")
    sh(work, "remote", "set-url", "origin", (tmp_path / "gone.git").as_uri())
    t = [0.0]
    res = gitsync.publish(work, pending, budget_s=3, clock=lambda: t[0],
                          sleep=lambda s: t.__setitem__(0, t[0] + s), rand=lambda: 0.5)
    assert (res.status, res.attempts) == ("failed", 2)          # waits 2 s, then 4 s would pass the budget


def test_a_delta_that_already_landed_is_not_applied_twice(remote, tmp_path):
    work, pending = clone(remote, tmp_path / "work"), tmp_path / "pending"
    d = tick_delta(pending, "2026-09-28T13:35:00Z")
    backup = tmp_path / "backup"
    shutil.copytree(d, backup)
    assert gitsync.publish(work, pending, budget_s=60, sleep=NOSLEEP).status == "ok"
    shutil.copytree(backup, d)                                  # crash between push and removal
    res = gitsync.publish(work, pending, budget_s=60, sleep=NOSLEEP)
    assert res.status == "none" and "already landed" in res.detail
    assert [r["tick"] for r in rows(remote)] == ["seed", "2026-09-28T13:35:00Z"]
    assert delta.list_pending(pending) == []


def test_flush_cli(remote, tmp_path, capsys):
    work, pending = clone(remote, tmp_path / "work"), tmp_path / "pending"
    tick_delta(pending, "2026-09-28T20:00:00Z")
    assert gitsync.main(["--data-dir", str(work), "--pending-dir", str(pending), "--final"]) == 0
    assert "gitsync: ok" in capsys.readouterr().out
    assert rows(remote)[-1]["tick"] == "2026-09-28T20:00:00Z"
    assert gitsync.main(["--data-dir", str(work), "--pending-dir", str(pending)]) == 0


def test_commit_message_sums_entries_over_deltas():
    metas = [{"tick_id": "2026-09-28T13:35:00Z", "kind": "tick", "summary": {"status": "ok", "members": 1, "entered": ["A"], "exited": []}},
             {"tick_id": "2026-09-28T13:40:00Z", "kind": "tick", "summary": {"status": "degraded", "members": 2, "entered": ["B"], "exited": ["A"]}}]
    msg = gitsync.commit_message(metas, ["d1", "d2"])
    assert msg == f"radar 13:40Z degraded · 2 on radar (+2/-1)\n\n{gitsync.TRAILER} d1 d2\n"
