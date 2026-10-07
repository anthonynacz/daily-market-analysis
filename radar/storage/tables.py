"""Table registry and per-table housekeeping policy (radar/SPEC.md section 6, storage.md section 2.3).

Every hot table is one file. `branch` says where it lives; backups always live on `data`.
Limits were calibrated from the design benchmarks (storage.md section 2.2).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from radar.config import PATHS

KiB = 1024
MiB = 1024 * 1024

WARN_RATIO = 0.8             # any metric >= 80% of its limit -> WARN (no action)
IO_P95_MAX_MS = 750          # p95 of the scanner's git stage+commit: volume-dependent part of the write path
IO_WINDOW_TICKS = 50         # newest scan_log rows used for the write p95
IO_MIN_SAMPLES = 10
LATENCY_MIN_ROW_RATIO = 0.2  # the latency rule counts only when rows >= 20% of max_rows (noise guard)
RETENTION_MONTHS = 3

MANIFEST_PATH = "backups/manifest.json"
HEALTH_PATH = "ops/health.json"
PENDING_MAIN_TRIM_PATH = "ops/pending_main_trim.json"   # main rows archived whose trim may not have landed (SPEC 12.6)
ALERTS_LOG_PATH = "alerts/log.json"


@dataclass(frozen=True)
class TableSpec:
    name: str
    path: str                       # path inside the branch checkout
    branch: str                     # "data" or "main"
    fmt: str                        # "jsonl" or "json_array" ({array_key: [...]})
    pk: tuple[str, ...]
    ts: str                         # UTC timestamp field used for windows, months and retention
    hot_days: float                 # rows older than this are archived when the table is DEGRADED
    min_hot_hours: float            # squeeze floor: rows newer than this always stay hot
    max_bytes: int
    max_rows: int
    max_lookup_ms: float
    target_ratio: float             # after archiving: bytes <= ratio*byte_limit and rows <= ratio*max_rows
    lookups: tuple[str, ...]
    per_tick: bool = False          # written on every scanner tick (the write-path rule applies)
    external_max_bytes: int | None = None  # browser / contents-API hard ceiling
    array_key: str | None = None
    newest_first: bool = False      # json_array order

    @property
    def byte_limit(self) -> int:
        """The binding size limit: the squeeze targets it so a trimmed table stays OK for days, not hours."""
        return min(self.max_bytes, self.external_max_bytes or self.max_bytes)


TABLES: tuple[TableSpec, ...] = (
    TableSpec("member_ticks", PATHS["member_ticks"], "data", "jsonl", ("tick", "ticker"), "tick",
              hot_days=5, min_hot_hours=20, max_bytes=8 * MiB, max_rows=25_000, max_lookup_ms=750,
              target_ratio=0.4, lookups=("latest_by_ticker", "series_ticker_day", "rows_on_day"), per_tick=True),
    TableSpec("events", PATHS["events"], "data", "jsonl", ("id",), "ts",
              hot_days=30, min_hot_hours=72, max_bytes=1 * MiB, max_rows=3_000, max_lookup_ms=250,
              target_ratio=0.5, lookups=("open_membership", "rows_last_24h", "latest_by_ticker"), per_tick=True,
              external_max_bytes=512 * KiB),
    TableSpec("scan_log", PATHS["scan_log"], "data", "jsonl", ("tick", "run_id"), "tick",
              hot_days=10, min_hot_hours=20, max_bytes=2 * MiB, max_rows=4_000, max_lookup_ms=250,
              target_ratio=0.5, lookups=("last_row", "rows_on_day"), per_tick=True),
    TableSpec("table_metrics", "ops/table_metrics.jsonl", "data", "jsonl", ("run_id", "table"), "measured_at",
              hot_days=90, min_hot_hours=24, max_bytes=1 * MiB, max_rows=5_000, max_lookup_ms=250,
              target_ratio=0.5, lookups=("last_row", "rows_last_24h")),
    TableSpec("housekeeping_runs", "ops/housekeeping_runs.jsonl", "data", "jsonl", ("run_id",), "started_at",
              hot_days=90, min_hot_hours=24, max_bytes=512 * KiB, max_rows=1_000, max_lookup_ms=250,
              target_ratio=0.5, lookups=("last_row",)),
    TableSpec("alerts_log", ALERTS_LOG_PATH, "main", "json_array", ("ts", "ticker"), "ts",
              hot_days=30, min_hot_hours=48, max_bytes=256 * KiB, max_rows=180, max_lookup_ms=100,
              target_ratio=0.55, lookups=("newest_25", "rows_last_24h"), external_max_bytes=900 * KiB,
              array_key="alerts", newest_first=True),
)

BY_NAME = {t.name: t for t in TABLES}

# Snapshots: never archived, only size-guarded and reported in ops/health.json (a breach is a writer bug).
SNAPSHOT_GUARDS: dict[str, int] = {
    PATHS["state"]: 256 * KiB,
    PATHS["engine"]: 256 * KiB,
    PATHS["baselines"]: 2 * MiB,
    PATHS["baselines_extra"]: 2 * MiB,
    HEALTH_PATH: 64 * KiB,
    MANIFEST_PATH: 256 * KiB,
}


def fmt_bytes(n: float) -> str:
    return f"{n / MiB:.2f} MiB" if n >= MiB else f"{n / KiB:.0f} KiB"


def write_p95_ms(scan_rows: Iterable[dict]) -> float | None:
    """p95 of git_prev.stage + git_prev.commit over the newest IO_WINDOW_TICKS scan_log rows.

    Rows whose git_prev has no timing (status "none", first tick of a loop) are skipped;
    fewer than IO_MIN_SAMPLES samples gives None.
    """
    vals = []
    for row in list(scan_rows)[-IO_WINDOW_TICKS:]:
        g = row.get("git_prev") if isinstance(row, dict) else None
        if not isinstance(g, dict) or g.get("status") == "none":
            continue
        stage, commit = g.get("stage"), g.get("commit")
        if isinstance(stage, (int, float)) and isinstance(commit, (int, float)):
            vals.append(float(stage + commit))
    if len(vals) < IO_MIN_SAMPLES:
        return None
    vals.sort()
    return vals[round(0.95 * (len(vals) - 1))]

