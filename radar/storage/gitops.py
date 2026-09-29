"""Git primitives for writers of the `data` branch (radar/SPEC.md section 7 = storage.md section 4.4).

On every attempt a writer:
  1. syncs: fetches origin/data and hard-resets the worktree to it (never merge, never rebase);
  2. re-applies its change on that exact head;
  3. publishes with compare-and-swap:
       - a normal commit has parent = the head read in (1); a plain push is refused unless it fast-forwards;
       - a squash (housekeeping only) is a parentless commit pushed with --force-with-lease pinned to (1);
  4. goes back to (1) on rejection, at most 5 attempts, backoff min(30, 2^n) * U(0.5, 1.5) s.
Because (2) is recomputed from the fresh head, a rejected push loses nothing and cannot duplicate rows.
"""
from __future__ import annotations

import os
import random
import subprocess

from radar.config import DATA_BRANCH

REF = f"refs/heads/{DATA_BRANCH}"
BOT_NAME = "github-actions[bot]"
BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com"
MAX_ATTEMPTS = 5
GITATTRIBUTES = b"* -text\n"   # no line-ending conversion on any clone of the data branch
BOOTSTRAP_LEFTOVERS = ("probe.json",)   # written when the data branch was created (storage.md 1.1)


class GitError(RuntimeError):
    pass


def git(repo: str, *args: str, check: bool = True, env: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    cp = subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True, encoding="utf-8",
                        env={**os.environ, **env} if env else None)
    if check and cp.returncode != 0:
        raise GitError(f"git {' '.join(args)} failed: {cp.stderr.strip()}")
    return cp


def out(repo: str, *args: str) -> str:
    return git(repo, *args).stdout.strip()


def sync(repo: str, remote: str = "origin") -> str:
    """Writer contract steps 1-2. Returns the head that was read."""
    git(repo, "fetch", "--no-tags", remote, f"+{REF}:refs/remotes/{remote}/{DATA_BRANCH}")
    # -f: a rejected attempt leaves edits behind; they are recomputed, so they are discarded.
    git(repo, "checkout", "-q", "-f", "-B", DATA_BRANCH, f"{remote}/{DATA_BRANCH}")
    git(repo, "reset", "-q", "--hard", f"{remote}/{DATA_BRANCH}")
    git(repo, "clean", "-q", "-fdx")
    return out(repo, "rev-parse", "HEAD")


def commit_count(repo: str, ref: str) -> int:
    return int(out(repo, "rev-list", "--count", ref))


def backoff_s(attempt: int, rng: random.Random) -> float:
    return min(30.0, 2.0 ** attempt) * (0.5 + rng.random())


def ensure_layout(repo: str) -> None:
    """The data branch's fixed files: `.gitattributes` present, bootstrap leftovers gone. Idempotent."""
    for rel in BOOTSTRAP_LEFTOVERS:
        path = os.path.join(repo, rel)
        if os.path.isfile(path):
            os.remove(path)
    path = os.path.join(repo, ".gitattributes")
    if os.path.exists(path):
        with open(path, "rb") as f:
            if f.read() == GITATTRIBUTES:
                return
    with open(path, "wb") as f:
        f.write(GITATTRIBUTES)


def _changed(repo: str, *args: str) -> list[str]:
    return [p for p in out(repo, "diff", "--no-renames", "--name-only", *args).splitlines() if p]


# "[remote rejected]" also reports server-side failures that a retry can clear.
TRANSIENT_REMOTE_REJECTS = ("unpacker error", "failed to lock", "failed to update ref", "failed to write")


def _push_failure(cp: subprocess.CompletedProcess) -> str:
    """'denied' when the server refused the update by policy (ruleset, protection), else 'conflict' (retryable)."""
    text = cp.stdout + cp.stderr
    if "[remote rejected]" in text and not any(t in text for t in TRANSIENT_REMOTE_REJECTS):
        return "denied"
    return "conflict"


def _landed(repo: str, remote: str, new: str) -> bool:
    """True when the remote branch is `new` or already fast-forwarded past it (the scanner may push on top of
    our commit between our push and this check)."""
    remote_sha = (out(repo, "ls-remote", remote, REF).split() or [""])[0]
    if remote_sha == new:
        return True
    if not remote_sha:
        return False
    git(repo, "fetch", "--no-tags", remote, f"+{REF}:refs/remotes/{remote}/{DATA_BRANCH}")
    return git(repo, "merge-base", "--is-ancestor", new, remote_sha, check=False).returncode == 0


def publish(repo: str, base: str, message: str, *, squash: bool, remote: str = "origin") -> dict:
    """Commit everything in the worktree on top of `base` (or as a new root when squashing) and push it.

    status: pushed | noop | conflict (head moved, lease lost or transient failure: sync and redo) |
    denied (the server refused the update).
    """
    git(repo, "add", "-A")
    staged = _changed(repo, "--cached", base)
    history = commit_count(repo, base)
    if not staged and not (squash and history > 1):
        return {"status": "noop", "sha": base, "squashed": False, "files": []}
    tree = out(repo, "write-tree")
    ident = {"GIT_AUTHOR_NAME": BOT_NAME, "GIT_AUTHOR_EMAIL": BOT_EMAIL,
             "GIT_COMMITTER_NAME": BOT_NAME, "GIT_COMMITTER_EMAIL": BOT_EMAIL}
    new = git(repo, "commit-tree", tree, "-m", message, *([] if squash else ["-p", base]), env=ident).stdout.strip()
    # Invariant: the new commit differs from the head that was read by exactly the staged changes.
    drift = set(_changed(repo, base, new)) ^ set(staged)
    if drift:
        raise GitError(f"refusing to push: tree drift {sorted(drift)}")
    lease = [f"--force-with-lease={REF}:{base}"] if squash else []
    cp = git(repo, "push", "--porcelain", *lease, remote, f"{new}:{REF}", check=False)
    if cp.returncode != 0:
        return {"status": _push_failure(cp), "sha": None, "squashed": squash, "files": staged,
                "detail": (cp.stderr.strip() or cp.stdout.strip())[-400:]}
    if not _landed(repo, remote, new):
        raise GitError(f"post-push verification failed: {new} is not on the remote {DATA_BRANCH} branch")
    git(repo, "reset", "-q", "--hard", new)
    return {"status": "pushed", "sha": new, "squashed": squash, "files": staged,
            "commits_before": history if squash else None}
