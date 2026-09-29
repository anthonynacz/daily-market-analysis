"""Momentum Radar table housekeeping: measure -> classify -> archive to monthly backups -> retention purge.

Crash-safety contract (storage.md section 3):
  * backup partitions are written to a temp file, fsynced, re-read and verified, then atomically renamed,
    BEFORE any hot table is trimmed;
  * partitions are canonical (sorted, de-duplicated by primary key, canonical JSON per line), so archiving
    the same rows again produces the same content: idempotent, no duplicates;
  * the manifest is an index that can always be rebuilt from the partition files;
  * main-branch tables (alerts/log.json) are trimmed only after the data-branch commit is published.

CLI: python -m radar.storage.housekeeping run|query|restore|verify ...
"""
from __future__ import annotations

import argparse
import calendar
import glob
import gzip
import hashlib
import io
import json
import os
import re
import statistics
import sys
import time
import zlib
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Iterable, Protocol

from radar.storage.tables import (BY_NAME, HEALTH_PATH, LATENCY_MIN_ROW_RATIO, MANIFEST_PATH, RETENTION_MONTHS,
                                  SNAPSHOT_GUARDS, TABLES, WARN_RATIO, IO_P95_MAX_MS, TableSpec, fmt_bytes,
                                  write_p95_ms)

SCHEMA_VERSION = 1
TMP_SUFFIX = ".tmp-hk"
PARTITION_NAME = re.compile(r"^(\d{4}-\d{2})\.jsonl\.gz$")


class SimulatedCrash(RuntimeError):
    pass


class PartitionCorrupt(RuntimeError):
    pass


class PostConditionError(RuntimeError):
    pass


class RestoreError(RuntimeError):
    pass


class HotTableUnreadable(RuntimeError):
    pass


class StoreError(RuntimeError):
    """A branch store could not be read or written (for example the contents API refused the request)."""


def checkpoint(step: str) -> None:
    """Crash-injection point; tests monkeypatch it."""


# ---------------------------------------------------------------- primitives

def canon(row: dict) -> str:
    return json.dumps(row, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def parse_ts(v: object) -> datetime | None:
    if not isinstance(v, str):
        return None
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def retention_cutoff(as_of: date, months: int = RETENTION_MONTHS) -> datetime:
    """00:00Z of the same calendar day `months` months earlier, day clamped to the month end.

    2026-09-27 -> 2026-06-27; 2026-05-31 -> 2026-02-28; 2024-05-31 -> 2024-02-29. A row is kept iff ts >= cutoff.
    """
    y, m = as_of.year, as_of.month - months
    while m <= 0:
        m += 12
        y -= 1
    d = min(as_of.day, calendar.monthrange(y, m)[1])
    return datetime(y, m, d, tzinfo=timezone.utc)


def month_of(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def month_bounds(month: str) -> tuple[datetime, datetime]:
    y, m = int(month[:4]), int(month[5:7])
    start = datetime(y, m, 1, tzinfo=timezone.utc)
    end = datetime(y + (m == 12), 1 if m == 12 else m + 1, 1, tzinfo=timezone.utc)
    return start, end


def atomic_write(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + TMP_SUFFIX
    with open(tmp, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def gz_deterministic(content: bytes) -> bytes:
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=6, mtime=0, filename="") as g:
        g.write(content)
    return buf.getvalue()


def read_file(path: str) -> bytes | None:
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return f.read()


# ---------------------------------------------------------------- stores (branch adapters)

class Store(Protocol):
    """A branch holding hot tables: read -> (bytes, version), compare-and-swap write on that version."""

    def read(self, rel: str) -> tuple[bytes | None, str | None]: ...

    def write_cas(self, rel: str, data: bytes, expected_version: str | None) -> bool: ...


class DirStore:
    """A local checkout. Production reaches main through radar.storage.alerts_store.ContentsStore."""

    def __init__(self, root: str):
        self.root = root

    def read(self, rel: str) -> tuple[bytes | None, str | None]:
        b = read_file(os.path.join(self.root, rel))
        return b, (sha256(b) if b is not None else None)

    def write_cas(self, rel: str, data: bytes, expected_version: str | None) -> bool:
        _, cur = self.read(rel)
        if cur != expected_version:
            return False
        atomic_write(os.path.join(self.root, rel), data)
        return True


# ---------------------------------------------------------------- hot tables

@dataclass
class HotRow:
    raw: str                 # exact line (jsonl) or canonical JSON (json_array)
    row: dict | None         # None = unparseable line, kept verbatim forever
    ts: datetime | None
    pk: str | None
    idx: int                 # position in file order


def pk_of(spec: TableSpec, row: dict) -> str | None:
    vals = [row.get(k) for k in spec.pk]
    return None if any(v is None for v in vals) else "|".join(str(v) for v in vals)


def sort_key(spec: TableSpec, row: dict) -> tuple[str, str]:
    return iso(parse_ts(row[spec.ts])), pk_of(spec, row)


@dataclass
class HotTable:
    spec: TableSpec
    rows: list[HotRow]
    nbytes: int
    doc: dict | None = None  # json_array: the whole document (other keys preserved)
    exists: bool = True


def read_hot_bytes(spec: TableSpec, data: bytes | None) -> HotTable:
    if data is None:
        return HotTable(spec, [], 0, {spec.array_key: []} if spec.fmt == "json_array" else None, exists=False)
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as e:
        raise HotTableUnreadable(f"{spec.path}: not UTF-8 ({e})") from e
    rows: list[HotRow] = []
    if spec.fmt == "jsonl":
        for i, line in enumerate(text.splitlines()):
            if not line.strip():
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                r = None
            r = r if isinstance(r, dict) else None
            rows.append(HotRow(line, r, parse_ts(r.get(spec.ts)) if r else None, pk_of(spec, r) if r else None, i))
        return HotTable(spec, rows, len(data))
    try:
        doc = json.loads(text)
    except json.JSONDecodeError as e:
        raise HotTableUnreadable(f"{spec.path}: invalid JSON ({e})") from e
    if not isinstance(doc, dict) or not isinstance(doc.get(spec.array_key) or [], list):
        raise HotTableUnreadable(f"{spec.path}: expected an object with a '{spec.array_key}' list")
    for i, r in enumerate(doc.get(spec.array_key) or []):
        ok = isinstance(r, dict)
        rows.append(HotRow(canon(r) if ok else json.dumps(r), r if ok else None,
                           parse_ts(r.get(spec.ts)) if ok else None, pk_of(spec, r) if ok else None, i))
    return HotTable(spec, rows, len(data), doc)


def render_hot(ht: HotTable, keep: list[HotRow]) -> bytes:
    if ht.spec.fmt == "jsonl":
        return "".join(r.raw + "\n" for r in keep).encode("utf-8")
    doc = dict(ht.doc or {})
    doc[ht.spec.array_key] = [r.row if r.row is not None else json.loads(r.raw) for r in keep]
    return (json.dumps(doc, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def chronological(spec: TableSpec, rows: list[HotRow]) -> list[HotRow]:
    return list(reversed(rows)) if spec.newest_first else list(rows)


# ---------------------------------------------------------------- lookups (the "standard queries")

def _parse_for_lookup(spec: TableSpec, data: bytes) -> list[dict]:
    if spec.fmt == "jsonl":
        out = []
        for line in data.decode("utf-8").splitlines():
            if line.strip():
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        return out
    return json.loads(data.decode("utf-8")).get(spec.array_key) or []


def _lookup(name: str, spec: TableSpec, rows: list, p: dict) -> object:
    rows = [r for r in rows if isinstance(r, dict)]
    ts = spec.ts
    if name == "latest_by_ticker":
        return next((r for r in reversed(rows) if r.get("ticker") == p["ticker"]), None)
    if name == "series_ticker_day":
        return [r for r in rows if r.get("ticker") == p["ticker"] and str(r.get(ts, "")).startswith(p["day"])]
    if name == "rows_on_day":
        return [r for r in rows if str(r.get(ts, "")).startswith(p["day"])]
    if name == "rows_last_24h":
        return [r for r in rows if str(r.get(ts, "")) >= p["since24h"]]
    if name == "open_membership":
        state = None
        for r in rows:
            if r.get("ticker") == p["ticker"] and r.get("type") in ("ENTER", "EXIT"):
                state = r
        return state if state and state.get("type") == "ENTER" else None
    if name == "last_row":
        return rows[-1] if rows else None
    if name == "newest_25":
        return rows[:25] if spec.newest_first else rows[-25:]
    raise KeyError(name)


def measure_lookups(ht: HotTable, data: bytes | None, repeats: int) -> dict[str, float]:
    """Cold lookups as consumers run them (parse + filter), median of `repeats`, in ms."""
    spec = ht.spec
    if not data or not ht.rows:
        return {n: 0.0 for n in spec.lookups}
    newest = max((r for r in ht.rows if r.ts), key=lambda r: r.ts, default=None)
    p = {"ticker": (newest.row or {}).get("ticker") if newest else None,
         "day": iso(newest.ts)[:10] if newest else "",
         "since24h": iso(newest.ts - timedelta(hours=24)) if newest else ""}
    if len(ht.rows) > 4 * spec.max_rows:
        repeats = 1
    out = {}
    for name in spec.lookups:
        samples = []
        for _ in range(max(1, repeats)):
            t0 = time.perf_counter()
            _lookup(name, spec, _parse_for_lookup(spec, data), p)
            samples.append((time.perf_counter() - t0) * 1000)
        out[name] = round(statistics.median(samples), 1)
    return out


# ---------------------------------------------------------------- partitions + manifest

def part_rel(table: str, month: str) -> str:
    return f"backups/{table}/{month}.jsonl.gz"


def read_partition(path: str, spec: TableSpec) -> list[dict]:
    """Decompress and validate: every line canonical JSON with pk and ts, strictly increasing (ts, pk)."""
    try:
        with open(path, "rb") as f:
            text = gzip.decompress(f.read()).decode("utf-8")
    except (OSError, EOFError, zlib.error, UnicodeDecodeError) as e:  # BadGzipFile is an OSError
        raise PartitionCorrupt(f"{path}: {e}") from e
    rows, prev = [], None
    for n, line in enumerate(text.splitlines(), 1):
        try:
            r = json.loads(line)
        except json.JSONDecodeError as e:
            raise PartitionCorrupt(f"{path}:{n}: bad JSON") from e
        if not isinstance(r, dict) or canon(r) != line or pk_of(spec, r) is None or parse_ts(r.get(spec.ts)) is None:
            raise PartitionCorrupt(f"{path}:{n}: not canonical / missing pk or ts")
        k = sort_key(spec, r)
        if prev is not None and k <= prev:
            raise PartitionCorrupt(f"{path}:{n}: not strictly sorted/unique")
        prev = k
        rows.append(r)
    return rows


def partition_entry(spec: TableSpec, month: str, rows: list[dict], blob: bytes, content: bytes,
                    now: datetime, run_id: str, prev: dict | None) -> dict:
    return {
        "table": spec.name, "month": month, "path": part_rel(spec.name, month),
        "rows": len(rows), "bytes": len(blob), "raw_bytes": len(content),
        "sha256": sha256(blob), "content_sha256": sha256(content),
        "min_ts": rows[0][spec.ts] if rows else None, "max_ts": rows[-1][spec.ts] if rows else None,
        "pk": list(spec.pk), "ts_field": spec.ts, "format": "jsonl+gzip, canonical JSON, sorted by (ts, pk)",
        "created_at": (prev or {}).get("created_at") or iso(now), "updated_at": iso(now),
        "writes": ((prev or {}).get("writes") or 0) + 1, "last_run_id": run_id,
    }


def write_partition_verified(root: str, spec: TableSpec, month: str, rows: list[dict],
                             must_contain: Iterable[dict], now: datetime, run_id: str,
                             prev: dict | None) -> tuple[dict, bool]:
    """Write a canonical partition via a temp file; re-read and verify from disk before the atomic rename.

    Returns (manifest entry, changed). Identical content is not rewritten (the idempotency point).
    """
    path = os.path.join(root, part_rel(spec.name, month))
    content = "".join(canon(r) + "\n" for r in rows).encode("utf-8")
    if prev and prev.get("content_sha256") == sha256(content):
        current = read_file(path)
        if current is not None and sha256(current) == prev.get("sha256"):
            return prev, False
    blob = gz_deterministic(content)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + TMP_SUFFIX
    with open(tmp, "wb") as f:
        f.write(blob)
        f.flush()
        os.fsync(f.fileno())
    back = read_partition(tmp, spec)
    if len(back) != len(rows):
        raise PartitionCorrupt(f"{tmp}: row count {len(back)} != {len(rows)}")
    index = {pk_of(spec, r): canon(r) for r in back}
    for r in must_contain:
        if index.get(pk_of(spec, r)) != canon(r):
            raise PartitionCorrupt(f"{tmp}: archived row {pk_of(spec, r)} missing or different after write")
    os.replace(tmp, path)
    return partition_entry(spec, month, rows, blob, content, now, run_id, prev), True


def load_manifest(root: str) -> tuple[dict, str | None]:
    """(manifest, problem). An unreadable manifest yields an empty one: reconcile rebuilds it from the files."""
    empty = {"schema_version": SCHEMA_VERSION, "partitions": {}}
    data = read_file(os.path.join(root, MANIFEST_PATH))
    if data is None:
        return empty, None
    try:
        m = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        return empty, f"{MANIFEST_PATH} unreadable ({e}); rebuilt from the partition files"
    if not isinstance(m, dict) or not isinstance(m.setdefault("partitions", {}), dict):
        return empty, f"{MANIFEST_PATH} malformed; rebuilt from the partition files"
    return m, None


def partitions_on_disk(root: str) -> tuple[dict[str, str], list[str]]:
    """({"table/YYYY-MM": path}, stray files under backups/<table>/ that are not month partitions)."""
    found, stray = {}, []
    for p in glob.glob(os.path.join(root, "backups", "*", "*.jsonl.gz")):
        table, name = os.path.basename(os.path.dirname(p)), os.path.basename(p)
        m = PARTITION_NAME.match(name)
        if m:
            found[f"{table}/{m.group(1)}"] = p
        else:
            stray.append(f"backups/{table}/{name}")
    return found, stray


def reconcile_manifest(root: str, manifest: dict, now: datetime, run_id: str,
                       cutoff: datetime) -> tuple[list[str], dict[str, str]]:
    """Make the manifest agree with the files (files are the source of truth). Returns (repairs, errors by table)."""
    repairs: list[str] = []
    errors: dict[str, str] = {}
    parts = manifest["partitions"]
    on_disk, stray = partitions_on_disk(root)
    for rel in stray:
        errors.setdefault(rel.split("/")[1], f"unexpected file {rel}")
    for key in sorted(set(parts) | set(on_disk)):
        table, month = key.split("/")
        spec = BY_NAME.get(table)
        if spec is None:
            errors.setdefault(table, f"unknown table directory backups/{table}")
            continue
        if key not in on_disk:
            if month_bounds(month)[1] <= cutoff:   # expired anyway: an interrupted purge already deleted it
                parts.pop(key)
                repairs.append(f"{key}: expired partition already deleted, entry dropped")
            else:
                errors[table] = f"partition {key} is in the manifest but the file is missing"
            continue
        blob = read_file(on_disk[key])
        entry = parts.get(key)
        if entry and entry.get("sha256") == sha256(blob):
            continue
        try:
            rows = read_partition(on_disk[key], spec)
        except PartitionCorrupt as e:
            errors[table] = str(e)
            continue
        parts[key] = partition_entry(spec, month, rows, blob, gzip.decompress(blob), now, run_id, entry)
        repairs.append(f"{key}: manifest entry {'rebuilt' if entry else 'added'} from file")
    return repairs, errors


# ---------------------------------------------------------------- measure / classify / plan

@dataclass
class TablePlan:
    spec: TableSpec
    ht: HotTable
    metrics: dict
    status: str
    reasons: list[str]
    warnings: list[str]
    purge: list[HotRow] = field(default_factory=list)
    archive: list[HotRow] = field(default_factory=list)
    heal: list[HotRow] = field(default_factory=list)
    keep: list[HotRow] = field(default_factory=list)
    error: str | None = None

    @property
    def changed(self) -> bool:
        return len(self.keep) != len(self.ht.rows)

    def freeze(self, error: str) -> None:
        """Never archive, trim or purge a table whose backups (or hot file) are unsafe."""
        self.error, self.status = error, "ERROR"
        self.archive, self.purge, self.heal, self.keep = [], [], [], list(self.ht.rows)


def classify(spec: TableSpec, m: dict, io_p95: float | None) -> tuple[str, list[str], list[str]]:
    reasons: list[str] = []
    warns: list[str] = []

    def chk(label: str, val: float | None, lim: float | None, fmt: Callable = str) -> None:
        if val is None or lim is None:
            return
        if val > lim:
            reasons.append(f"{label} {fmt(val)} > {fmt(lim)}")
        elif val >= WARN_RATIO * lim:
            warns.append(f"{label} {fmt(val)} >= {int(WARN_RATIO * 100)}% of {fmt(lim)}")

    chk("bytes", m["bytes"], spec.max_bytes, fmt_bytes)
    chk("rows", m["rows"], spec.max_rows)
    if m["rows"] >= LATENCY_MIN_ROW_RATIO * spec.max_rows:
        chk("lookup_ms", m["lookup_max_ms"], spec.max_lookup_ms)
    if spec.per_tick and io_p95 is not None and m["bytes"] >= 0.5 * spec.max_bytes:
        chk("write_p95_ms", io_p95, IO_P95_MAX_MS)
    if spec.external_max_bytes:
        chk("client_bytes", m["bytes"], spec.external_max_bytes, fmt_bytes)
    if m["bad_rows"]:
        warns.append(f"{m['bad_rows']} unparseable / no-ts rows kept verbatim")
    if m["dup_pk"]:
        warns.append(f"{m['dup_pk']} duplicate primary keys in hot table")
    return ("DEGRADED" if reasons else "WARN" if warns else "OK"), reasons, warns


def plan_table(ht: HotTable, data: bytes | None, now: datetime, cutoff: datetime, force: bool,
               io_p95: float | None, repeats: int) -> TablePlan:
    spec = ht.spec
    ts_rows = [r for r in ht.rows if r.ts]
    pks = [r.pk for r in ht.rows if r.pk]
    lk = measure_lookups(ht, data, repeats)
    m = {"bytes": ht.nbytes, "rows": len(ht.rows),
         "min_ts": iso(min(r.ts for r in ts_rows)) if ts_rows else None,
         "max_ts": iso(max(r.ts for r in ts_rows)) if ts_rows else None,
         "lookups_ms": lk, "lookup_max_ms": max(lk.values()) if lk else 0.0,
         "io_p95_ms": io_p95 if spec.per_tick else None,
         "bad_rows": sum(1 for r in ht.rows if r.row is None or r.ts is None or r.pk is None),
         "dup_pk": len(pks) - len(set(pks))}
    status, reasons, warns = classify(spec, m, io_p95)
    tp = TablePlan(spec, ht, m, status, reasons, warns)

    tp.purge = [r for r in ht.rows if r.ts and r.pk and r.ts < cutoff]
    gone = {r.idx for r in tp.purge}
    if status == "DEGRADED" or force:
        age_cut = now - timedelta(days=spec.hot_days)
        floor = now - timedelta(hours=spec.min_hot_hours)
        live = [r for r in ht.rows if r.idx not in gone]
        tp.archive = [r for r in live if r.ts and r.pk and r.ts < age_cut]
        taken = {r.idx for r in tp.archive}
        remaining = [r for r in live if r.idx not in taken]
        size = sum(len(r.raw.encode("utf-8")) + 1 for r in remaining)
        n = len(remaining)
        tb, tr = spec.target_ratio * spec.byte_limit, spec.target_ratio * spec.max_rows
        if size > tb or n > tr:  # squeeze: oldest first, never newer than the floor
            for r in sorted((r for r in remaining if r.ts and r.pk and r.ts < floor), key=lambda r: (r.ts, r.idx)):
                if size <= tb and n <= tr:
                    break
                tp.archive.append(r)
                size -= len(r.raw.encode("utf-8")) + 1
                n -= 1
        gone |= {r.idx for r in tp.archive}
    tp.keep = [r for r in ht.rows if r.idx not in gone]
    return tp


def plan_heal(tp: TablePlan, root: str, manifest: dict, now: datetime) -> None:
    """Rows older than hot_days that already sit, identical, in a partition (left by an interrupted run)
    leave the hot table. Never shrinks the hot window below policy."""
    spec = tp.spec
    age_cut = now - timedelta(days=spec.hot_days)
    by_month: dict[str, list[HotRow]] = {}
    for r in tp.keep:
        if r.ts and r.pk and r.ts < age_cut:
            by_month.setdefault(month_of(r.ts), []).append(r)
    healed = set()
    for month, rows in by_month.items():
        e = manifest["partitions"].get(f"{spec.name}/{month}")
        if not e or not e.get("min_ts"):
            continue
        lo, hi = parse_ts(e["min_ts"]), parse_ts(e["max_ts"])
        rows = [r for r in rows if lo <= r.ts <= hi]   # cheap range pre-check from the manifest
        if not rows:
            continue
        index = {pk_of(spec, x): canon(x) for x in read_partition(os.path.join(root, part_rel(spec.name, month)), spec)}
        healed |= {r.idx for r in rows if index.get(r.pk) == canon(r.row)}
    tp.heal = [r for r in tp.keep if r.idx in healed]
    tp.keep = [r for r in tp.keep if r.idx not in healed]


def trim_main_table(store: Store, spec: TableSpec, remove: dict[str, set[str]], attempts: int = 5) -> dict:
    """Re-read, drop rows whose pk and exact content were backed up or expired, compare-and-swap write.

    A conflict (the file changed since the read) re-reads and retries, so concurrent appends survive.
    """
    for attempt in range(1, attempts + 1):
        data, ver = store.read(spec.path)
        ht = read_hot_bytes(spec, data)
        keep = [r for r in ht.rows if not (r.row is not None and canon(r.row) in remove.get(r.pk, ()))]
        if len(keep) == len(ht.rows):
            return {"status": "noop", "removed": 0, "attempts": attempt}
        if store.write_cas(spec.path, render_hot(ht, keep), ver):
            return {"status": "trimmed", "removed": len(ht.rows) - len(keep), "attempts": attempt}
    return {"status": "conflict", "removed": 0, "attempts": attempts}


# ---------------------------------------------------------------- run

def _cleanup_tmp(root: str) -> None:
    for p in glob.glob(os.path.join(root, "**", "*" + TMP_SUFFIX), recursive=True):
        os.remove(p)


def _append_jsonl(root: str, rel: str, rows: list[dict]) -> None:
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "ab") as f:
        for r in rows:
            f.write((json.dumps(r, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8"))
        f.flush()
        os.fsync(f.fileno())


def snapshot_guards(root: str) -> dict[str, dict]:
    out = {}
    for rel, lim in SNAPSHOT_GUARDS.items():
        p = os.path.join(root, rel)
        size = os.path.getsize(p) if os.path.exists(p) else 0
        out[rel] = {"bytes": size, "limit": lim, "status": "DEGRADED" if size > lim else "OK"}
    return out


def _read_and_plan(stores: dict[str, Store], now: datetime, cutoff: datetime, force_tables: set[str],
                   part_errors: dict[str, str], repeats: int, data_root: str,
                   manifest: dict) -> dict[str, TablePlan]:
    hot: dict[str, tuple[HotTable, bytes | None, str | None]] = {}
    for spec in TABLES:
        store = stores.get(spec.branch)
        if store is None:
            continue
        try:
            data, _ = store.read(spec.path)
        except StoreError as e:        # main unreachable: freeze its table, still process the data branch
            hot[spec.name] = (HotTable(spec, [], 0, None), None, f"{spec.branch}:{spec.path} unreadable ({e})")
            continue
        try:
            hot[spec.name] = (read_hot_bytes(spec, data), data, None)
        except HotTableUnreadable as e:
            hot[spec.name] = (HotTable(spec, [], len(data or b""), None), None, str(e))
    io_p95 = write_p95_ms(r.row for r in hot["scan_log"][0].rows if r.row) if "scan_log" in hot else None
    plans = {}
    for name, (ht, data, unreadable) in hot.items():
        tp = plan_table(ht, data, now, cutoff, name in force_tables, io_p95, repeats)
        if unreadable or name in part_errors:
            tp.freeze(unreadable or part_errors[name])
        else:
            plan_heal(tp, data_root, manifest, now)
        plans[name] = tp
    return plans


def run(data_root: str, main_store: Store | None = None, *, now: datetime, mode: str = "apply",
        force_tables: Iterable[str] = (), run_id: str | None = None, trigger: str = "manual",
        publish_data: Callable[[dict], bool] | None = None, repeats: int = 3) -> dict:
    """One housekeeping pass over the data checkout at `data_root` (and main through `main_store`).

    Phase A edits the data checkout; `publish_data(report)` must push it and return True only once the
    push is confirmed. Phase B (main-branch trims) runs only after that. dry-run writes nothing anywhere.
    """
    if mode not in ("apply", "dry-run"):
        raise ValueError(f"mode must be apply or dry-run, not {mode!r}")
    t_start = time.perf_counter()
    now = now.astimezone(timezone.utc).replace(microsecond=0)
    run_id = run_id or f"hk-{now:%Y%m%dT%H%M%SZ}-local"
    cutoff = retention_cutoff(now.date())
    if mode == "apply":
        _cleanup_tmp(data_root)

    manifest, manifest_problem = load_manifest(data_root)
    repairs, part_errors = reconcile_manifest(data_root, manifest, now, run_id, cutoff)
    if manifest_problem:
        repairs.insert(0, manifest_problem)
    stores: dict[str, Store] = {"data": DirStore(data_root)}
    if main_store is not None:
        stores["main"] = main_store
    plans = _read_and_plan(stores, now, cutoff, set(force_tables), part_errors, repeats, data_root, manifest)

    # backup partitions: merge the archive rows per (table, month)
    part_actions = []  # (spec, month, merged_rows, must_contain, prev_entry)
    for tp in plans.values():
        if not tp.archive:
            continue
        by_month: dict[str, list[dict]] = {}
        for r in chronological(tp.spec, tp.archive):
            by_month.setdefault(month_of(r.ts), []).append(r.row)
        for month, new_rows in sorted(by_month.items()):
            prev = manifest["partitions"].get(f"{tp.spec.name}/{month}")
            existing = read_partition(os.path.join(data_root, part_rel(tp.spec.name, month)), tp.spec) if prev else []
            merged: dict[str, dict] = {pk_of(tp.spec, r): r for r in existing}
            winners: dict[str, dict] = {}
            for r in new_rows:                       # last write wins (chronological order)
                merged[pk_of(tp.spec, r)] = winners[pk_of(tp.spec, r)] = r
            rows = sorted(merged.values(), key=lambda r: sort_key(tp.spec, r))
            part_actions.append((tp.spec, month, rows, list(winners.values()), prev))

    # backup retention: months ending at or before the cutoff are deleted, the cutoff month filtered row by row
    ret_actions = []  # (key, "delete"|"filter", spec, month, kept_rows)
    planned_months = {(s.name, m): rows for s, m, rows, _, _ in part_actions}
    for key in sorted(manifest["partitions"]):
        table, month = key.split("/")
        if table in part_errors:
            continue
        spec = BY_NAME[table]
        start, end = month_bounds(month)
        if end <= cutoff:
            ret_actions.append((key, "delete", spec, month, []))
        elif start < cutoff:
            planned = planned_months.get((table, month))
            oldest = parse_ts(manifest["partitions"][key].get("min_ts"))
            if planned is None and oldest is not None and oldest >= cutoff:
                continue      # nothing in it has expired (the entry was reconciled with the file above)
            rows = planned or read_partition(os.path.join(data_root, part_rel(table, month)), spec)
            kept = [r for r in rows if parse_ts(r[spec.ts]) >= cutoff]
            if len(kept) != len(rows):
                ret_actions.append((key, "filter" if kept else "delete", spec, month, kept))

    report = _report_skeleton(run_id, trigger, mode, now, cutoff, plans, repairs, part_errors)
    report["snapshots"] = snapshot_guards(data_root)
    report["planned"] = {
        "partitions_write": [f"{s.name}/{m}" for s, m, _, _, _ in part_actions],
        "partitions_delete": [k for k, a, *_ in ret_actions if a == "delete"],
        "partitions_filter": [k for k, a, *_ in ret_actions if a == "filter"],
    }
    if mode == "dry-run":
        report["outcome"] = "dry-run"
        report["duration_ms"] = int((time.perf_counter() - t_start) * 1000)
        return report

    # ---- PHASE A (data checkout); the order is what makes a crash at any step recoverable
    written = []
    for spec, month, rows, must, prev in part_actions:
        entry, changed = write_partition_verified(data_root, spec, month, rows, must, now, run_id, prev)
        manifest["partitions"][f"{spec.name}/{month}"] = entry
        if changed:
            written.append(f"{spec.name}/{month}")
    checkpoint("partitions_written")

    deleted, filtered = [], []
    for key, action, spec, month, kept in ret_actions:
        if action == "delete":
            path = os.path.join(data_root, part_rel(spec.name, month))
            if os.path.exists(path):
                os.remove(path)
            manifest["partitions"].pop(key, None)
            deleted.append(key)
        else:
            entry, _ = write_partition_verified(data_root, spec, month, kept, kept, now, run_id,
                                                manifest["partitions"].get(key))
            manifest["partitions"][key] = entry
            filtered.append(key)
    checkpoint("backups_purged")

    manifest.update({"schema_version": SCHEMA_VERSION, "updated_at": iso(now), "last_run_id": run_id,
                     "retention": {"policy": f"{RETENTION_MONTHS} calendar months, row-level, UTC",
                                   "cutoff": iso(cutoff)}})
    manifest["partitions"] = dict(sorted(manifest["partitions"].items()))
    atomic_write(os.path.join(data_root, MANIFEST_PATH),
                 (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    checkpoint("manifest_written")

    for tp in plans.values():
        if tp.spec.branch == "data" and tp.changed:
            atomic_write(os.path.join(data_root, tp.spec.path), render_hot(tp.ht, tp.keep))
    checkpoint("hot_trimmed")

    _verify_post_conditions(plans, data_root, manifest)
    report.update({"partitions_written": written, "partitions_deleted": deleted, "partitions_filtered": filtered})
    _write_ops(data_root, report, manifest)
    checkpoint("ops_written")

    # ---- publish the data branch, then PHASE B (main) only once the push is confirmed
    ok = publish_data(report) if publish_data else True
    report["data_published"] = ok
    report["main_trim"] = {}
    if ok and main_store is not None:
        for tp in plans.values():
            if tp.spec.branch == "main" and tp.changed:
                remove: dict[str, set[str]] = {}
                for r in tp.archive + tp.purge + tp.heal:
                    remove.setdefault(r.pk, set()).add(canon(r.row))
                try:
                    report["main_trim"][tp.spec.name] = trim_main_table(main_store, tp.spec, remove)
                except (StoreError, HotTableUnreadable) as e:   # rows are already backed up; next run heals
                    report["main_trim"][tp.spec.name] = {"status": "error", "removed": 0, "detail": str(e)}
    report["outcome"] = "ok" if ok else "publish_failed"
    report["duration_ms"] = int((time.perf_counter() - t_start) * 1000)
    return report


def _verify_post_conditions(plans: dict[str, TablePlan], root: str, manifest: dict) -> None:
    for tp in plans.values():
        n = len(tp.keep) + len(tp.archive) + len(tp.purge) + len(tp.heal)
        if n != len(tp.ht.rows):
            raise PostConditionError(f"{tp.spec.name}: row accounting mismatch {n} != {len(tp.ht.rows)}")
        for r in tp.archive:
            key = f"{tp.spec.name}/{month_of(r.ts)}"
            if key not in manifest["partitions"]:
                raise PostConditionError(f"{key} missing from the manifest")
        if tp.spec.branch == "data" and tp.changed:
            back = read_hot_bytes(tp.spec, read_file(os.path.join(root, tp.spec.path)))
            if [r.raw for r in back.rows] != [r.raw for r in tp.keep]:
                raise PostConditionError(f"{tp.spec.name}: hot table rewrite mismatch")


def _report_skeleton(run_id: str, trigger: str, mode: str, now: datetime, cutoff: datetime,
                     plans: dict[str, TablePlan], repairs: list[str], part_errors: dict[str, str]) -> dict:
    tables = {}
    for name, tp in plans.items():
        kept_ts = [r.ts for r in tp.keep if r.ts]
        tables[name] = {
            "status": tp.status, "reasons": tp.reasons, "warnings": tp.warnings, "error": tp.error,
            "location": f"{tp.spec.branch}:{tp.spec.path}", **tp.metrics,
            "archive_rows": len(tp.archive), "purge_rows": len(tp.purge), "heal_rows": len(tp.heal),
            "rows_after": len(tp.keep),
            "bytes_after": len(render_hot(tp.ht, tp.keep)) if tp.changed else tp.ht.nbytes,
            "min_ts_after": iso(min(kept_ts)) if kept_ts else None,
        }
    return {"v": SCHEMA_VERSION, "run_id": run_id, "trigger": trigger, "mode": mode, "as_of": iso(now),
            "retention_cutoff": iso(cutoff), "tables": tables, "manifest_repairs": repairs,
            "partition_errors": part_errors}


def _write_ops(root: str, report: dict, manifest: dict) -> None:
    metric_rows = []
    for name, t in report["tables"].items():
        action = "+".join(a for a, n in (("archive", t["archive_rows"]), ("purge", t["purge_rows"]),
                                          ("heal", t["heal_rows"])) if n) or "none"
        metric_rows.append({"v": 1, "run_id": report["run_id"], "measured_at": report["as_of"], "table": name,
                            "location": t["location"], "status": t["status"], "reasons": t["reasons"],
                            "bytes": t["bytes"], "rows": t["rows"], "min_ts": t["min_ts"], "max_ts": t["max_ts"],
                            "lookups_ms": t["lookups_ms"], "lookup_max_ms": t["lookup_max_ms"],
                            "io_p95_ms": t["io_p95_ms"], "action": action, "archived_rows": t["archive_rows"],
                            "purged_rows": t["purge_rows"], "healed_rows": t["heal_rows"],
                            "rows_after": t["rows_after"], "bytes_after": t["bytes_after"]})
    _append_jsonl(root, BY_NAME["table_metrics"].path, metric_rows)
    run_row = {"v": 1, "run_id": report["run_id"], "started_at": report["as_of"], "trigger": report["trigger"],
               "mode": report["mode"], "retention_cutoff": report["retention_cutoff"],
               "status_by_table": {n: t["status"] for n, t in report["tables"].items()},
               "rows_archived": sum(t["archive_rows"] for t in report["tables"].values()),
               "rows_purged_hot": sum(t["purge_rows"] for t in report["tables"].values()),
               "partitions_written": report["partitions_written"], "partitions_deleted": report["partitions_deleted"],
               "partitions_filtered": report["partitions_filtered"], "manifest_repairs": report["manifest_repairs"],
               "partition_errors": report["partition_errors"]}
    _append_jsonl(root, BY_NAME["housekeeping_runs"].path, [run_row])
    parts = manifest["partitions"].values()
    health = {"schema_version": 1, "run_id": report["run_id"], "as_of": report["as_of"],
              "retention_cutoff": report["retention_cutoff"],
              "tables": {n: {"status": t["status"], "bytes": t["bytes_after"], "rows": t["rows_after"],
                             "min_ts": t["min_ts_after"], "lookup_max_ms": t["lookup_max_ms"],
                             "backup_months": sorted(e["month"] for e in parts if e["table"] == n),
                             "backup_rows": sum(e["rows"] for e in parts if e["table"] == n)}
                         for n, t in report["tables"].items()},
              "snapshots": report["snapshots"],
              "backups_total_bytes": sum(e["bytes"] for e in parts)}
    atomic_write(os.path.join(root, HEALTH_PATH), (json.dumps(health, indent=2) + "\n").encode("utf-8"))


# ---------------------------------------------------------------- query / restore / verify

def query(data_root: str, table: str, start: datetime, end: datetime, where: dict | None = None,
          main_store: Store | None = None) -> list[dict]:
    """Rows with start <= ts < end from backups + hot, de-duplicated by pk (hot wins), sorted by (ts, pk)."""
    spec = BY_NAME[table]
    manifest, _ = load_manifest(data_root)
    out: dict[str, dict] = {}
    for e in manifest["partitions"].values():
        if e["table"] != table:
            continue
        ms, me = month_bounds(e["month"])
        if me <= start or ms >= end:
            continue
        for r in read_partition(os.path.join(data_root, e["path"]), spec):
            out[pk_of(spec, r)] = r
    store = DirStore(data_root) if spec.branch == "data" else main_store
    if store is not None:
        data, _ = store.read(spec.path)
        for hr in chronological(spec, read_hot_bytes(spec, data).rows):
            if hr.row is not None and hr.pk:
                out[hr.pk] = hr.row
    rows = [r for r in out.values() if (t := parse_ts(r.get(spec.ts))) and start <= t < end
            and all(str(r.get(k)) == v for k, v in (where or {}).items())]
    return sorted(rows, key=lambda r: sort_key(spec, r))


def restore_month(data_root: str, table: str, month: str, out_path: str) -> dict:
    """Write one partition's rows (JSONL) to out_path after checking its sha256 and every row."""
    spec = BY_NAME[table]
    manifest, _ = load_manifest(data_root)
    e = manifest["partitions"].get(f"{table}/{month}")
    if not e:
        raise RestoreError(f"no backup partition {table}/{month}")
    path = os.path.join(data_root, e["path"])
    blob = read_file(path)
    if blob is None or sha256(blob) != e["sha256"]:
        raise RestoreError(f"{e['path']}: missing or sha256 differs from the manifest")
    try:
        rows = read_partition(path, spec)
    except PartitionCorrupt as x:
        raise RestoreError(str(x)) from x
    if len(rows) != e["rows"]:
        raise RestoreError(f"{e['path']}: {len(rows)} rows, manifest says {e['rows']}")
    with open(out_path, "wb") as f:
        f.write(gzip.decompress(blob))
    return {"rows": len(rows), "path": out_path, "min_ts": e["min_ts"], "max_ts": e["max_ts"]}


def verify(data_root: str) -> dict:
    """Re-hash and re-validate every partition against the manifest; files missing from it count too."""
    manifest, problem = load_manifest(data_root)
    problems = [problem] if problem else []
    on_disk, stray = partitions_on_disk(data_root)
    problems += [f"{rel}: unexpected file" for rel in stray]
    problems += [f"{key}: file not in the manifest" for key in sorted(set(on_disk) - set(manifest["partitions"]))]
    for key, e in manifest["partitions"].items():
        spec = BY_NAME.get(e.get("table"))
        blob = read_file(os.path.join(data_root, e["path"]))
        if spec is None or blob is None:
            problems.append(f"{key}: {'unknown table' if spec is None else 'file missing'}")
            continue
        if sha256(blob) != e["sha256"]:
            problems.append(f"{key}: sha256 mismatch")
        try:
            n = len(read_partition(os.path.join(data_root, e["path"]), spec))
            if n != e["rows"]:
                problems.append(f"{key}: rows {n} != manifest {e['rows']}")
        except PartitionCorrupt as x:
            problems.append(f"{key}: {x}")
    return {"partitions": len(manifest["partitions"]), "problems": problems}


def render_markdown(report: dict) -> str:
    lines = [f"### Housekeeping {report['run_id']} ({report['mode']}, trigger: {report['trigger']})",
             f"As of {report['as_of']}, retention cutoff {report['retention_cutoff']}", "",
             "| Table | Status | Rows | Size | Lookup max ms | Archive | Purge | Heal | Rows after | Reasons |",
             "|---|---|---:|---:|---:|---:|---:|---:|---:|---|"]
    for n, t in report["tables"].items():
        notes = t["reasons"] + t["warnings"] + ([t["error"]] if t["error"] else [])
        lines.append(f"| {n} | {t['status']} | {t['rows']} | {fmt_bytes(t['bytes'])} | {t['lookup_max_ms']} | "
                     f"{t['archive_rows']} | {t['purge_rows']} | {t['heal_rows']} | {t['rows_after']} | "
                     f"{'; '.join(notes) or '-'} |")
    breaches = [f"{rel} {fmt_bytes(g['bytes'])} > {fmt_bytes(g['limit'])}"
                for rel, g in report.get("snapshots", {}).items() if g["status"] != "OK"]
    lines += ["", f"Snapshot guards: {'; '.join(breaches) or 'all within limits'}"]
    planned = report.get("planned", {})
    lines += [f"Partitions to write: {', '.join(planned.get('partitions_write', [])) or 'none'}",
              f"Partitions to delete: {', '.join(planned.get('partitions_delete', [])) or 'none'}",
              f"Partitions to filter: {', '.join(planned.get('partitions_filter', [])) or 'none'}"]
    if report["manifest_repairs"]:
        lines.append(f"Manifest repairs: {'; '.join(report['manifest_repairs'])}")
    if report["partition_errors"]:
        lines.append("Partition errors (tables frozen): "
                     + "; ".join(f"{k}: {v}" for k, v in report["partition_errors"].items()))
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m radar.storage.housekeeping",
                                 description="Momentum Radar table housekeeping on local checkouts")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="one local pass (no git); the workflow uses radar.storage.housekeeping_job")
    r.add_argument("--data-root", required=True)
    r.add_argument("--main-root", help="main checkout holding alerts/log.json")
    r.add_argument("--as-of", help="UTC timestamp, default now")
    r.add_argument("--dry-run", action="store_true")
    r.add_argument("--force-archive", nargs="*", default=[], choices=sorted(BY_NAME))
    r.add_argument("--trigger", default="manual")
    r.add_argument("--report")
    q = sub.add_parser("query", help="rows from backups + hot, de-duplicated")
    q.add_argument("--data-root", required=True)
    q.add_argument("--main-root")
    q.add_argument("--table", required=True, choices=sorted(BY_NAME))
    q.add_argument("--from", dest="start", required=True)
    q.add_argument("--to", dest="end", required=True)
    q.add_argument("--where", nargs="*", default=[], help="field=value")
    s = sub.add_parser("restore", help="one month partition to a JSONL file, verified")
    s.add_argument("--data-root", required=True)
    s.add_argument("--table", required=True, choices=sorted(BY_NAME))
    s.add_argument("--month", required=True, help="YYYY-MM")
    s.add_argument("--out", required=True)
    v = sub.add_parser("verify", help="re-hash and re-validate every partition")
    v.add_argument("--data-root", required=True)
    a = ap.parse_args(argv)

    if a.cmd == "run":
        now = parse_ts(a.as_of) if a.as_of else datetime.now(timezone.utc)
        rep = run(a.data_root, DirStore(a.main_root) if a.main_root else None, now=now,
                  mode="dry-run" if a.dry_run else "apply", force_tables=a.force_archive, trigger=a.trigger)
        sys.stdout.write(render_markdown(rep))
        if a.report:
            with open(a.report, "w", encoding="utf-8") as f:
                json.dump(rep, f, indent=2)
        return 2 if rep["partition_errors"] else 0
    if a.cmd == "query":
        start, end = parse_ts(a.start), parse_ts(a.end)
        if start is None or end is None:
            ap.error("--from/--to must be ISO timestamps")
        rows = query(a.data_root, a.table, start, end, dict(w.split("=", 1) for w in a.where),
                     DirStore(a.main_root) if a.main_root else None)
        sys.stdout.write("".join(canon(row) + "\n" for row in rows))
        return 0
    if a.cmd == "restore":
        try:
            info = restore_month(a.data_root, a.table, a.month, a.out)
        except RestoreError as e:
            sys.stderr.write(f"restore failed: {e}\n")
            return 2
        sys.stdout.write(json.dumps(info) + "\n")
        return 0
    res = verify(a.data_root)
    sys.stdout.write(json.dumps(res, indent=2) + "\n")
    return 2 if res["problems"] else 0


if __name__ == "__main__":
    sys.exit(main())
