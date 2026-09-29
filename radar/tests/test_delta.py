from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from radar import delta

BINARY = b"\x1f\x8b\x08\x00\x00\r\n\x00\xff\xfe\n\r"


def _write(root: Path, tick: str = "2026-09-28T13:35:00Z", **kw) -> Path:
    appends = kw.pop("appends", {"radar/events.jsonl": [{"id": "A", "ticker": "NVDA", "note": "café ↑"}]})
    replaces = kw.pop("replaces", {"radar/state.json": {"b": 1, "a": [1.5, None]},
                                   "radar/baselines.json.gz": BINARY})
    return delta.write_delta(root, tick, appends, replaces, **kw)


def _tree(root: Path) -> dict[str, bytes]:
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file()}


def test_layout_meta_and_serialisation(tmp_path):
    d = _write(tmp_path / "pending", kind="warmup", summary={"status": "ok", "members": 2})
    meta = delta.read_meta(d)
    assert meta["tick_id"] == "2026-09-28T13:35:00Z" and meta["kind"] == "warmup"
    assert meta["summary"] == {"status": "ok", "members": 2}
    assert meta["created_at"].endswith("Z") and len(meta["created_at"]) == 20
    assert ":" not in d.name and d.name.startswith("20260928T133500Z-")
    row = (d / "append/radar/events.jsonl").read_bytes()
    assert row == '{"id":"A","ticker":"NVDA","note":"café ↑"}\n'.encode("utf-8")
    assert (d / "replace/radar/state.json").read_bytes() == b'{"a":[1.5,null],"b":1}\n'
    assert (d / "replace/radar/baselines.json.gz").read_bytes() == BINARY


def test_empty_appends_write_no_file(tmp_path):
    d = _write(tmp_path, appends={"radar/member_ticks.jsonl": []})
    assert not (d / "append").exists()


def test_apply_on_fresh_checkouts_is_identical_and_binary_safe(tmp_path):
    d = _write(tmp_path / "pending")
    base = tmp_path / "base"
    (base / "radar").mkdir(parents=True)
    (base / "radar/events.jsonl").write_bytes(b'{"id":"old"}\n')
    (base / "radar/baselines.json.gz").write_bytes(b"old binary")
    results = []
    for n in range(2):
        work = tmp_path / f"work{n}"
        shutil.copytree(base, work)
        touched = delta.apply_delta(d, work)
        results.append(_tree(work))
    assert results[0] == results[1]
    assert sorted(touched) == ["radar/baselines.json.gz", "radar/events.jsonl", "radar/state.json"]
    assert results[0]["radar/baselines.json.gz"] == BINARY
    assert results[0]["radar/events.jsonl"].splitlines() == [b'{"id":"old"}', '{"id":"A","ticker":"NVDA","note":"café ↑"}'.encode()]


def test_appends_accumulate_and_repair_a_truncated_last_line(tmp_path):
    work = tmp_path / "work"
    (work / "radar").mkdir(parents=True)
    (work / "radar/scan_log.jsonl").write_bytes(b'{"tick":"x"}')           # no trailing newline
    for i in range(2):
        d = delta.write_delta(tmp_path / "p", f"2026-09-28T13:{35 + 5 * i}:00Z", {"radar/scan_log.jsonl": [{"i": i}]}, {})
        delta.apply_delta(d, work)
    assert (work / "radar/scan_log.jsonl").read_bytes() == b'{"tick":"x"}\n{"i":0}\n{"i":1}\n'


def test_list_pending_orders_by_tick_then_creation_and_skips_partials(tmp_path):
    root = tmp_path / "pending"
    later = _write(root, "2026-09-28T13:40:00Z")
    first = _write(root, "2026-09-28T13:35:00Z")
    second = _write(root, "2026-09-28T13:35:00Z")
    (root / ".20260928T134500Z-1.tmp").mkdir()                              # a tick killed mid-write
    (root / "no-meta").mkdir()
    assert delta.list_pending(root) == [first, second, later]
    assert delta.list_pending(tmp_path / "missing") == []


def test_remove(tmp_path):
    d = _write(tmp_path)
    delta.remove(d)
    assert not d.exists()


@pytest.mark.parametrize("bad", ["../escape.json", "/abs.json", "radar\\x.json", "C:/x.json", ".git/config", ""])
def test_unsafe_paths_are_rejected(tmp_path, bad):
    with pytest.raises(ValueError):
        delta.write_delta(tmp_path, "2026-09-28T13:35:00Z", {}, {bad: b"x"})


def test_unknown_kind_is_rejected(tmp_path):
    with pytest.raises(ValueError):
        delta.write_delta(tmp_path, "2026-09-28T13:35:00Z", {}, {}, kind="other")


def test_json_helpers():
    assert delta.jsonl_bytes([{"b": 1, "a": "é"}]) == '{"b":1,"a":"é"}\n'.encode()
    assert json.loads(delta.json_bytes({"z": 1, "a": 2})) == {"a": 2, "z": 1}
    assert delta.json_bytes({"z": 1, "a": 2}).startswith(b'{"a"')
