"""Tick deltas: what one tick changes on the data branch, kept outside the git worktree.

Layout (radar/SPEC.md section 4.7):
    <delta>/meta.json            {"tick_id", "created_at", "kind", "summary"}
    <delta>/append/<relpath>     bytes appended to data:<relpath>
    <delta>/replace/<relpath>    full replacement of data:<relpath>

A delta is written to a hidden temp directory and renamed into place, so a tick killed mid-write
never leaves a partial delta. Applying it to a freshly reset checkout always gives the same bytes,
which is what lets the git writer re-apply pending deltas on every push attempt.
Stdlib only: the workflow's always() flush step may run before any dependency is installed.
"""
from __future__ import annotations

import json
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

META = "meta.json"
APPEND = "append"
REPLACE = "replace"
KINDS = ("tick", "warmup")


def utc_iso(epoch: float) -> str:
    return datetime.fromtimestamp(int(epoch), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def jsonl_bytes(rows: list[dict]) -> bytes:
    return "".join(json.dumps(r, separators=(",", ":"), ensure_ascii=False) + "\n" for r in rows).encode("utf-8")


def json_bytes(doc: dict) -> bytes:
    return (json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def _safe_relpath(relpath: str) -> PurePosixPath:
    p = PurePosixPath(relpath)
    if not relpath or p.is_absolute() or ".." in p.parts or "\\" in relpath or ":" in relpath or p.parts[0] == ".git":
        raise ValueError(f"unsafe data path: {relpath!r}")
    return p


def delta_id(tick_id: str) -> str:
    """Sortable, unique and file-system safe: compact tick id, then creation time in ns."""
    compact = tick_id.replace("-", "").replace(":", "")
    return f"{compact}-{time.time_ns()}"


def write_delta(root: str | Path, tick_id: str, appends: dict[str, list[dict]], replaces: dict[str, bytes | dict],
                *, kind: str = "tick", summary: dict | None = None) -> Path:
    if kind not in KINDS:
        raise ValueError(f"unknown delta kind {kind!r}")
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    name = delta_id(tick_id)
    tmp = root / f".{name}.tmp"
    for relpath, rows in appends.items():
        if rows:
            _write(tmp / APPEND / _safe_relpath(relpath), jsonl_bytes(rows))
    for relpath, body in replaces.items():
        _write(tmp / REPLACE / _safe_relpath(relpath), body if isinstance(body, bytes) else json_bytes(body))
    meta = {"tick_id": tick_id, "created_at": utc_iso(time.time()), "kind": kind, "summary": summary or {}}
    _write(tmp / META, json_bytes(meta))
    final = root / name
    os.replace(tmp, final)
    return final


def _write(path: Path, data: bytes) -> None:
    # No fsync: the rename is what protects against a killed tick, and a runner that loses its
    # page cache has lost RUNNER_TEMP, and with it every pending delta, anyway.
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def read_meta(delta_dir: str | Path) -> dict:
    return json.loads((Path(delta_dir) / META).read_text(encoding="utf-8"))


def _files(base: Path) -> list[tuple[str, Path]]:
    if not base.is_dir():
        return []
    return sorted((p.relative_to(base).as_posix(), p) for p in base.rglob("*") if p.is_file())


def apply_delta(delta_dir: str | Path, data_worktree: str | Path) -> list[str]:
    """Apply one delta; returns the data paths it touched. Replacements are atomic per file."""
    delta_dir, data = Path(delta_dir), Path(data_worktree)
    touched = []
    for relpath, src in _files(delta_dir / APPEND):
        dst = data / _safe_relpath(relpath)
        dst.parent.mkdir(parents=True, exist_ok=True)
        with open(dst, "ab+") as f:
            if f.tell():                                  # never glue a row onto a truncated last line
                f.seek(-1, os.SEEK_END)
                if f.read(1) != b"\n":
                    f.write(b"\n")
            f.write(src.read_bytes())
        touched.append(relpath)
    for relpath, src in _files(delta_dir / REPLACE):
        dst = data / _safe_relpath(relpath)
        dst.parent.mkdir(parents=True, exist_ok=True)
        tmp = dst.with_name(dst.name + ".tmp-delta")
        shutil.copyfile(src, tmp)
        os.replace(tmp, dst)
        touched.append(relpath)
    return touched


def list_pending(pending_root: str | Path) -> list[Path]:
    """Complete deltas under pending_root in tick order (tick id, then creation)."""
    root = Path(pending_root)
    if not root.is_dir():
        return []
    found = []
    for d in root.iterdir():
        if d.is_dir() and not d.name.startswith(".") and (d / META).is_file():
            found.append((read_meta(d)["tick_id"], d.name, d))
    return [d for _, _, d in sorted(found)]


def remove(delta_dir: str | Path) -> None:
    shutil.rmtree(delta_dir, ignore_errors=True)
