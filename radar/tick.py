"""One radar scan (radar/SPEC.md section 4.8), run by radar.loop as a subprocess.

    python -m radar.tick --data-dir _data --pending-dir P --tick-id 2026-09-28T13:35:00Z
                         [--warmup] [--final] [--ignore-calendar]
    python -m radar.tick --probe [--data-dir _data]
                                      fetch-only diagnostics for the job summary; writes nothing (the
                                      stored pack, if any, picks the thin names for the finality check)

A tick reads only the data worktree, which already holds every applied-but-unpushed delta, and
writes exactly one delta. Its last stdout line is a JSON result, and the exit code is 0 unless
there is a bug. Importing this module needs only the standard library: the fetch, baseline and
engine modules load when a tick runs, so the loop can reuse the helpers below.
"""
from __future__ import annotations

import argparse
import dataclasses
import gzip
import json
import math
import os
import sys
import time
import traceback
import zlib
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable, Iterator

from . import calendar_nyse as cal
from . import delta
from .config import PARAMS, PATHS, REFERENCE_SYMBOLS, RUNTIME

if TYPE_CHECKING:
    from .types import FetchReport, Quote

MiB = 1024 * 1024
DISCLAIMER = "Educational analysis of what is moving now, not a forecast and not financial advice."
HELD = "Stocks already on the radar are held, not dropped."
# Per-tick table limits from storage.md section 2.3; the scanner asks for housekeeping above 1.25x.
HOT_MAX_BYTES = {"member_ticks": 8 * MiB, "events": 1 * MiB, "scan_log": 2 * MiB}
HK_TABLE_FACTOR = 1.25
HK_WRITE_P95_MS = 1500
HK_MIN_SAMPLES = 10
PACK_MIN_COVERAGE = 0.8          # below this share of symbols with 5m (or daily) history, retry the pack next tick
PACK_GAP_RETRIES = 3             # later ticks that may refetch universe names the accepted pack lacks, per day
PACK_GAP_REASONS = ("no prior close", "no daily history")   # ineligible only because the daily fetch failed
DEADLINE_MARGIN_S = 40           # the fetcher stops this long before the loop's tick timeout (SPEC 12.3)
SOURCE_HEALTH_FILE = "source_health.json"   # <pending>/..., the fetcher's health after every call (SPEC 12.3)
BARS_DEGRADED_SHARE = 0.2
MS_KEYS = ("fetch_quotes", "fetch_movers", "fetch_bars", "baselines", "compute", "write", "total")
SOURCE_STATUSES = ("ok", "degraded", "down")
DEFAULT_MARKET = {"mode": "normal", "dir": None, "spy_chg_day_pct": 0.0, "spy_z30": 0.0, "breadth30": 0.0}
NO_GIT = {"stage": 0, "commit": 0, "push": 0, "attempts": 0, "status": "none"}
EMPTY_COUNTS = {"universe": 0, "stage_b": 0, "members": 0, "heating": 0, "entered_today": 0, "exited_today": 0}


class PackUnavailable(RuntimeError):
    pass


# ---------------------------------------------------------------- helpers (also used by radar.loop)

def iso(epoch: float) -> str:
    return delta.utc_iso(epoch)


def parse_tick_id(value: str) -> int:
    return int(datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp())


def run_id() -> str:
    rid = os.environ.get("GITHUB_RUN_ID")
    return f"gha-{rid}-{os.environ.get('GITHUB_RUN_ATTEMPT', '1')}" if rid else "local"


def read_json(path: Path) -> dict | None:
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return doc if isinstance(doc, dict) else None


def read_gz_json(path: Path) -> dict | None:
    try:
        doc = json.loads(gzip.decompress(path.read_bytes()))
    except (OSError, EOFError, ValueError, zlib.error):
        return None
    return doc if isinstance(doc, dict) else None


def gz_json(doc: dict) -> bytes:
    raw = json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    return gzip.compress(raw.encode("utf-8"), compresslevel=6, mtime=0)


def jsonable(obj: Any, bad: list[int]) -> Any:
    """Plain JSON types; numpy values become Python values and non-finite floats become null."""
    if obj is None or isinstance(obj, (str, bool, int)):
        return obj
    if isinstance(obj, float):
        if math.isfinite(obj):
            return float(obj)
        bad[0] += 1
        return None
    if isinstance(obj, dict):
        return {str(k): jsonable(v, bad) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set, frozenset)):
        return [jsonable(v, bad) for v in obj]
    if hasattr(obj, "tolist"):
        return jsonable(obj.tolist(), bad)
    raise TypeError(f"not JSON-serialisable: {type(obj).__name__}")


def scan_log_row(tick_id: str, written_at: str, **fields: Any) -> dict:
    """One radar/scan_log.jsonl row (SPEC section 6) with zero defaults for what a run did not measure."""
    row = {"v": 1, "tick": tick_id, "run_id": run_id(), "written_at": written_at, "session": None, "phase": "",
           "status": "error", "lag_s": 0, "universe": 0, "stage_b": 0, "quotes_ok": 0, "quotes_err": 0,
           "bars_ok": 0, "bars_err": 0, "members": 0, "heating": 0, "entered": [], "exited": [],
           "processed_slots": [], "source": "yahoo", "ms": dict.fromkeys(MS_KEYS, 0), "git_prev": dict(NO_GIT),
           "hot_bytes": {"member_ticks": 0, "events": 0, "scan_log": 0, "state": 0}, "errors": []}
    unknown = fields.keys() - row.keys()
    if unknown:
        raise KeyError(f"not scan_log fields: {sorted(unknown)}")
    row.update(fields)
    row["errors"] = [str(e)[:200] for e in row["errors"][:5]]
    return row


def p95(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)]


def hk_request(hot: dict[str, int], write_ms: list[float]) -> str | None:
    over = [t for t, cap in HOT_MAX_BYTES.items() if hot.get(t, 0) > HK_TABLE_FACTOR * cap]
    if over:
        return f"{', '.join(over)} over {HK_TABLE_FACTOR}x the size limit"
    if len(write_ms) >= HK_MIN_SAMPLES and p95(write_ms) > HK_WRITE_P95_MS:
        return f"git stage+commit p95 {p95(write_ms):.0f} ms over {HK_WRITE_P95_MS} ms"
    return None


def source_block(h: Any) -> dict:
    """state.json "source" from the fetcher's health record (engine.json source_health)."""
    h = h if isinstance(h, dict) else {}
    last_ok = h.get("last_ok_at")
    try:
        failures = int(h.get("consecutive_failures") or 0)
    except (TypeError, ValueError):
        failures = 0
    return {"name": h["name"] if h.get("name") in ("yahoo", "nasdaq") else "yahoo",
            "status": h["status"] if h.get("status") in SOURCE_STATUSES else "ok",
            "consecutive_failures": failures, "last_ok_at": last_ok if isinstance(last_ok, str) else None}


def write_json_atomic(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_bytes(delta.json_bytes(doc))
    os.replace(tmp, path)


def session_json(s: cal.Session, phase: str) -> dict:
    return {"date": s.day.isoformat(), "phase": phase, "open": iso(s.open_epoch), "close": iso(s.close_epoch),
            "half_day": s.early_close}


def first_tick_et(s: cal.Session) -> str:
    return (s.open + timedelta(minutes=5)).astimezone(cal.ET).strftime("%H:%M")


def resolve_session(tick_epoch: int, now_epoch: float, *, ignore_calendar: bool, final: bool) -> tuple[cal.Session | None, bool]:
    """(session, run_engine). The engine runs for boundaries in (open, close]; manual runs replay the
    current session once it has opened, otherwise the previous one."""
    day = datetime.fromtimestamp(tick_epoch, cal.UTC).astimezone(cal.ET).date()
    s = cal.session_for(day)
    if s and s.open_epoch < tick_epoch <= s.close_epoch:
        return s, True
    if (ignore_calendar or final) and s and now_epoch >= s.open_epoch:
        return s, True
    if ignore_calendar:
        return cal.previous_sessions(day, 1)[0], True
    return s, False



# ---------------------------------------------------------------- dependencies (real ones are imported lazily)

@dataclass
class Deps:
    fetcher: Callable[..., Any]
    engine: Callable[..., Any]
    build_pack: Callable[..., Any]
    extend_pack: Callable[..., Any]
    pack_from_json: Callable[[dict], Any]
    load_universe: Callable[[], list[dict]]
    scan_symbols: Callable[[], list[str]]
    dynamic_candidates: Callable[..., list]


def real_deps() -> Deps:
    from . import baselines, engine, fetch, universe
    return Deps(fetch.Fetcher, engine.Engine, baselines.build_pack, baselines.extend_pack,
                baselines.BaselinePack.from_json, universe.load_universe, universe.scan_symbols,
                universe.dynamic_candidates)


@dataclass
class TickArgs:
    data_dir: Path
    pending_dir: Path
    tick_id: str
    warmup: bool = False
    final: bool = False
    ignore_calendar: bool = False


# ---------------------------------------------------------------- the tick

class Tick:
    def __init__(self, args: TickArgs, deps: Deps, *, clock: Callable[[], float] = time.time):
        self.a, self.deps, self.clock = args, deps, clock
        self.data = Path(args.data_dir)
        self.tick_epoch = parse_tick_id(args.tick_id)
        self.started = clock()
        # The fetcher stops starting requests here, so a slow or blocked source still lets the tick reach
        # _finish (and save the breaker progress) before the loop's timeout kills it.
        self.deadline = self.started + RUNTIME["tick_timeout_s"] - DEADLINE_MARGIN_S
        self.t0 = time.perf_counter()
        self.ms = dict.fromkeys(MS_KEYS, 0)
        self.errors: list[str] = []
        self.engine_doc = read_json(self.data / PATHS["engine"]) or {}
        self.prev_state = read_json(self.data / PATHS["state"]) or {}
        self.loop = self.engine_doc.get("loop") or {}
        self.pack_gaps = self.engine_doc.get("pack_gaps")
        self._fetcher: Any = None
        self._pack_built = False                  # the main pack was built by this tick
        self._extra: set[str] = set()             # symbols that live in baselines_extra (dynamic adds, gap fills)
        self._extra_dirty = False

    @contextmanager
    def timed(self, key: str) -> Iterator[None]:
        t = time.perf_counter()
        try:
            yield
        finally:
            self.ms[key] += int((time.perf_counter() - t) * 1000)

    def run(self) -> dict:
        session, run_engine = resolve_session(self.tick_epoch, self.clock(), ignore_calendar=self.a.ignore_calendar,
                                              final=self.a.final)
        if self.a.warmup and session is not None:
            return self._warmup(session)
        if run_engine:
            return self._scan(session)
        return self._heartbeat()

    # -- data access

    def fetcher(self) -> Any:
        if self._fetcher is None:
            self._fetcher = self.deps.fetcher(health=self.engine_doc.get("source_health"),
                                              workers=RUNTIME["fetch_workers"], timeout_s=RUNTIME["fetch_timeout_s"],
                                              deadline=self.deadline, on_health=self._save_health)
        return self._fetcher

    def _health_file(self) -> Path:
        return Path(self.a.pending_dir) / SOURCE_HEALTH_FILE

    def _save_health(self, health: dict) -> None:
        """Called by the fetcher after every call: if the loop kills this tick, it merges this file into
        engine.json, so the breaker still advances (SPEC 12.3)."""
        try:
            write_json_atomic(self._health_file(), health)
        except (OSError, TypeError, ValueError) as e:
            self.errors.append(f"source health: {type(e).__name__}: {e}")

    def _fetch(self, what: str, fn: Callable[..., tuple[Any, FetchReport]], symbols: list[str] | None,
               **kw: Any) -> tuple[Any, FetchReport]:
        """The data sources are unofficial and flaky: any failure becomes an empty result so the
        engine holds its members instead of the tick dying."""
        try:
            return fn(symbols, **kw) if symbols is not None else fn(**kw)
        except Exception as e:  # noqa: BLE001 - network boundary, reported in scan_log
            from .types import FetchReport
            self.errors.append(f"{what}: {type(e).__name__}: {e}")
            return ([] if symbols is None else {}), FetchReport(
                source="none", status="down", requested=len(symbols or ()), failed=list(symbols or ()),
                notes=[type(e).__name__])

    def _load_pack(self, key: str, session_date: str) -> Any:
        """Today's stored pack, or None when it is missing, stale or unreadable (it is then rebuilt)."""
        doc = read_gz_json(self.data / PATHS[key])
        if doc is None or doc.get("asof") != session_date or doc.get("params_version") != PARAMS["params_version"]:
            return None
        try:
            return self.deps.pack_from_json(doc)
        except (KeyError, TypeError, ValueError) as e:
            self.errors.append(f"{key}: unreadable, rebuilding ({type(e).__name__}: {e})")
            return None

    def _universe_meta(self) -> dict[str, dict]:
        return {r["symbol"]: {"name": r.get("name"), "sector": r.get("sector") or "Unknown"}
                for r in self.deps.load_universe()}

    def _build_pack(self, session: cal.Session) -> Any:
        """Today's pack, accepted only when SPY has 5m and daily bars and both cover PACK_MIN_COVERAGE of
        the symbols (SPEC 12.3). Otherwise nothing is written and the next tick retries."""
        symbols = self.deps.scan_symbols()
        bars5, r5 = self._fetch("baseline bars", self.fetcher().bars_5m, symbols, range_="1mo")
        daily, rd = self._fetch("baseline daily", self.fetcher().daily, symbols, range_="3mo")
        cov5 = sum(1 for s in symbols if s in bars5) / max(1, len(symbols))
        covd = sum(1 for s in symbols if s in daily) / max(1, len(symbols))
        missing_spy = [what for what, got in (("5-minute", bars5), ("daily", daily)) if "SPY" not in got]
        if missing_spy or cov5 < PACK_MIN_COVERAGE or covd < PACK_MIN_COVERAGE:
            spy = f"no SPY {' or '.join(missing_spy)} bars; " if missing_spy else ""
            raise PackUnavailable(f"{spy}5-minute history for {cov5:.0%} and daily history for {covd:.0%} of "
                                  f"symbols ({r5.status}/{rd.status})")
        try:
            return self.deps.build_pack(session, bars5, daily, self._universe_meta(), PARAMS)
        except ValueError as e:                     # e.g. no SPY bar of a base session, or no SPY prior close
            raise PackUnavailable(str(e)) from e

    def _pack_for(self, session: cal.Session, replaces: dict[str, Any]) -> Any:
        date = session.day.isoformat()
        with self.timed("baselines"):
            pack = self._load_pack("baselines", date)
            if pack is None:
                pack = self._build_pack(session)
                self._pack_built = True
                replaces[PATHS["baselines"]] = gz_json(pack.to_json())
            extra = self._load_pack("baselines_extra", date)
        if extra is not None:
            self._extra = set(extra.symbols)
            pack = dataclasses.replace(pack, symbols={**pack.symbols, **extra.symbols})
        return pack

    def _extend(self, what: str, pack: Any, session: cal.Session, syms: list[str],
                meta: Callable[[list[str]], dict[str, dict]], *, replace_existing: bool = False) -> tuple[Any, list[str]]:
        """Fetch 1mo 5m and 3mo daily bars for syms and add the ones that have both to the pack, as
        baselines_extra symbols. Returns (pack, symbols added)."""
        with self.timed("baselines"):
            bars5, _ = self._fetch(f"{what} bars", self.fetcher().bars_5m, syms, range_="1mo")
            daily, _ = self._fetch(f"{what} daily", self.fetcher().daily, syms, range_="3mo")
            ready = [s for s in syms if s in bars5 and s in daily]      # a name without daily would be ineligible
            if not ready:
                return pack, []
            base = dataclasses.replace(pack, symbols={s: b for s, b in pack.symbols.items() if s not in ready}) \
                if replace_existing else pack
            try:
                out = self.deps.extend_pack(base, session, {s: bars5[s] for s in ready}, {s: daily[s] for s in ready},
                                            meta(ready), PARAMS)
            except ValueError as e:                 # auxiliary: the scan goes on without them
                self.errors.append(f"{what}: {e}")
                return pack, []
        added = [s for s in ready if s in out.symbols]
        self._extra.update(added)
        self._extra_dirty |= bool(added)
        return out, added

    def _reextend_dynamic(self, pack: Any, session: cal.Session, dyn: list[str], quotes: dict[str, Quote]) -> Any:
        """Dynamic adds whose baselines_extra was missing or rejected (e.g. a params bump rebuilt the
        packs mid-session) get their baselines again before the engine is built (SPEC 12.3)."""
        missing = [s for s in dyn if s not in pack.symbols]
        if not missing:
            return pack

        def meta(syms: list[str]) -> dict[str, dict]:
            return {s: {"name": getattr(quotes.get(s), "name", None),
                        "sector": getattr(quotes.get(s), "sector", None) or "Unknown"} for s in syms}

        pack, added = self._extend("dynamic adds", pack, session, missing, meta)
        still = [s for s in missing if s not in added]
        if still:
            self.errors.append(f"dynamic adds: no baselines yet for {', '.join(still)}; retrying next scan")
        return pack

    def _pack_gaps(self, pack: Any) -> list[str]:
        """Universe names the pack lacks, or holds as ineligible only because their daily bars were missing."""
        return [s for s in self.deps.scan_symbols()
                if s not in pack.symbols or pack.symbols[s].ineligible_reason in PACK_GAP_REASONS]

    def _source_ok(self) -> bool:
        h = self._source_health()
        return isinstance(h, dict) and h.get("status") == "ok" and h.get("name", "yahoo") == "yahoo"

    def _fill_gaps(self, pack: Any, session: cal.Session) -> Any:
        """Retry the pack's gaps on later ticks, at most PACK_GAP_RETRIES times a day and only while the
        source is ok; the names go to baselines_extra without using the dynamic budget. Names still
        missing are listed in scan_log errors."""
        gaps = self._pack_gaps(pack)
        date = session.day.isoformat()
        pg = self.pack_gaps if isinstance(self.pack_gaps, dict) and self.pack_gaps.get("session") == date else {}
        retries = int(pg.get("retries") or 0)
        if gaps and not self._pack_built and retries < PACK_GAP_RETRIES and self._source_ok():
            retries += 1
            meta = self._universe_meta()
            pack, _ = self._extend("pack gaps", pack, session, gaps, lambda syms: {s: meta.get(s, {}) for s in syms},
                                   replace_existing=True)
            gaps = self._pack_gaps(pack)
        self.pack_gaps = {"session": date, "retries": retries}
        self._note_gaps(gaps)
        return pack

    def _note_gaps(self, gaps: list[str]) -> None:
        if gaps:
            self.errors.append(f"pack gaps: {len(gaps)} universe name(s) without usable baselines: {', '.join(gaps)}")

    def _write_extra(self, pack: Any, replaces: dict[str, Any]) -> None:
        if self._extra_dirty:
            extra = dataclasses.replace(pack, symbols={s: pack.symbols[s] for s in sorted(self._extra) if s in pack.symbols})
            replaces[PATHS["baselines_extra"]] = gz_json(extra.to_json())

    def _dynamic_adds(self, pack: Any, session: cal.Session, dyn: list[str], known: set[str],
                      quotes: dict[str, Quote], movers: list[Quote]) -> Any:
        """Movers outside the universe get baselines on first sight and stay for the session. They need
        5m and daily bars; their sector comes from one batched quote call (screens carry none)."""
        cfg = PARAMS["dynamic"]
        room = cfg["max_adds_per_day"] - len(dyn)
        if not cfg["enabled"] or room <= 0 or not movers:
            return pack
        cands = {q.symbol: q for q in self.deps.dynamic_candidates(movers, known, PARAMS)[:room]}
        if not cands:
            return pack
        profiles: dict[str, Quote] = {}

        def meta(syms: list[str]) -> dict[str, dict]:
            got, _ = self._fetch("dynamic profiles", self.fetcher().quotes, syms)
            profiles.update(got)
            return {s: {"name": getattr(got.get(s), "name", None) or cands[s].name,
                        "sector": getattr(got.get(s), "sector", None) or cands[s].sector or "Unknown"} for s in syms}

        pack, added = self._extend("dynamic adds", pack, session, list(cands), meta)
        dyn.extend(added)
        quotes.update({s: profiles.get(s) or cands[s] for s in added})
        return pack

    # -- the three kinds of run

    def _scan(self, session: cal.Session) -> dict:
        date = session.day.isoformat()
        replaces: dict[str, Any] = {}
        dyn = list(self.engine_doc.get("dynamic_adds") or []) if self.engine_doc.get("session") == date else []
        try:
            pack = self._pack_for(session, replaces)
        except PackUnavailable as e:
            self.errors.append(f"baselines: {e}")
            return self._carry(session, replaces, dyn, "no_data",
                               f"Today's baselines could not be built yet; retrying next scan. {HELD}")
        symbols = self.deps.scan_symbols()
        universe = list(dict.fromkeys(symbols + dyn))
        fetcher = self.fetcher()
        with self.timed("fetch_quotes"):
            quotes, qrep = self._fetch("quotes", fetcher.quotes, universe)
        with self.timed("fetch_movers"):
            movers, mrep = self._fetch("movers", fetcher.movers, None)
        if mrep.status != "ok":
            self.errors.append(f"movers: {mrep.status}")
        pack = self._reextend_dynamic(pack, session, dyn, quotes)
        pack = self._fill_gaps(pack, session)
        pack = self._dynamic_adds(pack, session, dyn, set(universe), quotes, movers)
        self._write_extra(pack, replaces)
        universe = list(dict.fromkeys(universe + dyn))

        now = int(self.clock())                       # before the bar fetch: bars are at least this fresh
        with self.timed("compute"):
            engine = self.deps.engine(PARAMS, pack, session, state=self.engine_doc.get("engine"))
            # A failed quote call must not widen Stage B to the whole universe (SPEC 12.3).
            stage_b = list(engine.stage_a(quotes, now, quotes_ok=qrep.status != "down"))
        with self.timed("fetch_bars"):
            bars, brep = self._fetch("bars", fetcher.bars_5m, stage_b, range_="1d")
        with self.timed("compute"):
            # Nasdaq fallback volume is not on the Yahoo basis of the baselines (SPEC 12.3, DATA-6).
            out = engine.step(bars, now, degraded_volume=brep.source == "nasdaq")
            engine_state = engine.state_dict()

        status, message = self._scan_status(qrep, brep, bars)
        snap = out.snapshot
        events, rows = list(out.events), list(out.member_rows)
        processed = [int(j) for j in out.processed_slots]
        members, heating = snap.get("members") or [], snap.get("heating") or []
        counts = {**EMPTY_COUNTS, "universe": len(universe), "stage_b": len(stage_b), "members": len(members),
                  "heating": len(heating), **(snap.get("counts") or {})}
        last_bar = iso(session.slot_start(max(processed)) + 300) if processed else self._prev_same(date, "last_bar")
        source = self._source()
        state = self._state(session_json(session, cal.phase_at(self._now_dt())[0]), status, message, source,
                            snap, counts, last_bar)
        engine_doc = self._engine_doc(date, engine_state, dyn)
        return self._finish(
            kind="tick", session_date=date, phase=state["session"]["phase"], status=status, message=message,
            state=state, engine_doc=engine_doc, replaces=replaces,
            appends={PATHS["member_ticks"]: rows, PATHS["events"]: events},
            scan={"universe": len(universe), "stage_b": len(stage_b), "quotes_ok": qrep.ok,
                  "quotes_err": len(qrep.failed), "bars_ok": brep.ok, "bars_err": len(brep.failed),
                  "entered": [e["ticker"] for e in events if e.get("type") == "ENTER"],
                  "exited": [e["ticker"] for e in events if e.get("type") == "EXIT"],
                  "processed_slots": processed})

    def _warmup(self, session: cal.Session) -> dict:
        date = session.day.isoformat()
        replaces: dict[str, Any] = {}
        status, message = "ok", f"Baselines ready; the radar starts at {first_tick_et(session)} ET."
        try:
            self._note_gaps(self._pack_gaps(self._pack_for(session, replaces)))
        except PackUnavailable as e:
            self.errors.append(f"baselines: {e}")
            status, message = "no_data", "Baselines could not be built; the first scan will retry."
        dyn = list(self.engine_doc.get("dynamic_adds") or []) if self.engine_doc.get("session") == date else []
        state = self._closed_state()
        engine_doc = self._engine_doc(date, self.engine_doc.get("engine"), dyn)
        return self._finish(kind="warmup", session_date=date, phase=state["session"]["phase"], status=status,
                            message=message, state=state, engine_doc=engine_doc, replaces=replaces)

    def _heartbeat(self) -> dict:
        state = self._closed_state()
        engine_doc = self._engine_doc(self.engine_doc.get("session"), self.engine_doc.get("engine"),
                                      list(self.engine_doc.get("dynamic_adds") or []))
        return self._finish(kind="tick", session_date=None, phase=state["session"]["phase"], status="closed",
                            message=state["message"], state=state, engine_doc=engine_doc, replaces={})

    def _carry(self, session: cal.Session, replaces: dict[str, Any], dyn: list[str], status: str, message: str) -> dict:
        """No engine step this tick: republish the previous snapshot of the same session."""
        date = session.day.isoformat()
        same = (self.prev_state.get("session") or {}).get("date") == date
        snap = {k: self.prev_state.get(k) for k in ("members", "heating", "recent_exits", "sector_banners", "market")} if same else {}
        counts = {**EMPTY_COUNTS, **(self.prev_state.get("counts") or {})} if same else dict(EMPTY_COUNTS)
        source = self._source()
        state = self._state(session_json(session, cal.phase_at(self._now_dt())[0]), status, message, source, snap,
                            counts, self._prev_same(date, "last_bar"))
        engine_doc = self._engine_doc(date, self.engine_doc.get("engine"), dyn)
        return self._finish(kind="tick", session_date=date, phase=state["session"]["phase"], status=status,
                            message=message, state=state, engine_doc=engine_doc, replaces=replaces)

    # -- composition

    def _now_dt(self) -> datetime:
        return datetime.fromtimestamp(self.clock(), cal.UTC)

    def _prev_same(self, date: str, key: str) -> Any:
        return self.prev_state.get(key) if (self.prev_state.get("session") or {}).get("date") == date else None

    def _scan_status(self, qrep: FetchReport, brep: FetchReport, bars: dict) -> tuple[str, str]:
        if not bars:
            return "no_data", f"No fresh market data in this scan. {HELD}"
        backup = "nasdaq" in (qrep.source, brep.source)
        thin = brep.requested and len(brep.failed) > BARS_DEGRADED_SHARE * brep.requested
        if backup or thin or qrep.status != "ok" or brep.status != "ok":
            lead = "Using the backup data source (Nasdaq)." if backup else \
                f"Data came back incomplete ({brep.ok} of {brep.requested} charts)."
            return "degraded", f"{lead} {HELD}"
        return "ok", ""

    def _source_health(self) -> Any:
        return self._fetcher.health_state() if self._fetcher is not None else self.engine_doc.get("source_health")

    def _source(self) -> dict:
        """state.json "source" is the fetcher's own health (breaker, failures in a row), carried
        between ticks in engine.json; a tick that fetched nothing repeats the stored value."""
        return source_block(self._source_health())

    def _next_tick_at(self) -> str | None:
        nxt = self.loop.get("next_tick_at")
        try:
            return nxt if nxt and not self.a.final and parse_tick_id(nxt) > self.clock() else None
        except ValueError:
            return None

    def _health(self) -> dict:
        # published_late: earlier scans whose pushes failed; the commit that carries this state delivers them.
        return {"ticks_today": int(self.loop.get("ticks_today", 0)), "ticks_skipped": int(self.loop.get("ticks_skipped", 0)),
                "last_tick_ms": 0, "loop_run_id": self.loop.get("run_id") or "",
                "loop_started_at": self.loop.get("started_at"), "published_late": int(self.loop.get("published_late", 0))}

    def _state(self, session: dict, status: str, message: str, source: dict, snap: dict, counts: dict,
               last_bar: str | None) -> dict:
        return {"schema": 1, "generated_at": iso(self.clock()), "tick_id": self.a.tick_id, "last_bar": last_bar,
                "status": status, "message": message, "session": session, "next_tick_at": self._next_tick_at(),
                "params_version": PARAMS["params_version"], "source": source,
                "market": snap.get("market") or dict(DEFAULT_MARKET), "counts": counts,
                "members": snap.get("members") or [], "heating": snap.get("heating") or [],
                "recent_exits": snap.get("recent_exits") or [], "sector_banners": snap.get("sector_banners") or [],
                "health": self._health(), "disclaimer": DISCLAIMER}

    def _closed_state(self) -> dict:
        """Heartbeat outside the regular session: no members, and the latest session's exits are kept
        until the next session starts."""
        dt = datetime.fromtimestamp(self.tick_epoch, cal.UTC)
        phase, today = cal.phase_at(dt)
        day = dt.astimezone(cal.ET).date()
        pre = today is not None and dt < today.open
        upcoming = cal.next_sessions(day + timedelta(days=1), 1)[0]
        show = today if today is not None and dt < today.post_close else upcoming
        latest = today if today is not None and dt >= today.open else cal.previous_sessions(day, 1)[0]
        keep = (self.prev_state.get("session") or {}).get("date") == latest.day.isoformat()
        prev_counts = self.prev_state.get("counts") or {}
        counts = {**EMPTY_COUNTS, **({k: prev_counts.get(k, 0) for k in ("entered_today", "exited_today")} if keep else {})}
        if pre:
            message = f"The radar starts at {first_tick_et(today)} ET."
        else:
            message = f"Market closed. The radar starts again {upcoming.open.astimezone(cal.ET):%a} at {first_tick_et(upcoming)} ET."
        snap = {"recent_exits": self.prev_state.get("recent_exits") if keep else []}
        return self._state(session_json(show, phase), "closed", message, self._source(), snap, counts,
                           self.prev_state.get("last_bar") if keep else None)

    def _engine_doc(self, session_date: str | None, engine_state: Any, dyn: list[str]) -> dict:
        return {"schema": 1, "session": session_date, "engine": engine_state, "source_health": self._source_health(),
                "dynamic_adds": dyn, "pack_gaps": self.pack_gaps,
                "ops": dict(self.engine_doc.get("ops") or {"hk_dispatched_at": None}), "loop": self.loop}

    def _size(self, key: str) -> int:
        try:
            return (self.data / PATHS[key]).stat().st_size
        except OSError:
            return 0

    def _finish(self, *, kind: str, session_date: str | None, phase: str, status: str, message: str, state: dict,
                engine_doc: dict, replaces: dict[str, Any], appends: dict[str, list[dict]] | None = None,
                scan: dict | None = None) -> dict:
        t_write = time.perf_counter()
        bad = [0]
        appends = {k: jsonable(v, bad) for k, v in (appends or {}).items()}
        engine_doc = jsonable(engine_doc, bad)
        state["health"]["last_tick_ms"] = int((time.perf_counter() - self.t0) * 1000)
        state = jsonable(state, bad)
        if bad[0]:
            self.errors.append(f"replaced {bad[0]} non-finite value(s) with null")
        state_bytes = delta.json_bytes(state)
        hot = {"member_ticks": self._size("member_ticks") + len(delta.jsonl_bytes(appends.get(PATHS["member_ticks"], []))),
               "events": self._size("events") + len(delta.jsonl_bytes(appends.get(PATHS["events"], []))),
               "scan_log": self._size("scan_log"), "state": len(state_bytes)}
        request = hk_request(hot, list(self.loop.get("write_ms") or []))
        engine_doc["ops"]["hk_request"] = {"reason": request, "at": iso(self.clock())} if request else None
        self.ms["write"] += int((time.perf_counter() - t_write) * 1000)
        self.ms["total"] = int((time.perf_counter() - self.t0) * 1000)
        row = scan_log_row(self.a.tick_id, iso(self.clock()), session=session_date, phase=phase, status=status,
                           lag_s=max(0, int(self.started - self.tick_epoch)), members=len(state["members"]),
                           heating=len(state["heating"]), source=state["source"]["name"], ms=dict(self.ms),
                           git_prev={**NO_GIT, **(self.loop.get("git_prev") or {})}, hot_bytes=hot,
                           errors=self.errors, **(scan or {}))
        delta.write_delta(self.a.pending_dir, self.a.tick_id,
                          {**appends, PATHS["scan_log"]: [row]},
                          {**replaces, PATHS["state"]: state_bytes, PATHS["engine"]: engine_doc}, kind=kind,
                          summary={"status": status, "members": row["members"],
                                   "entered": row["entered"], "exited": row["exited"]})
        self._health_file().unlink(missing_ok=True)     # the delta's engine.json now carries this health
        return {"status": status, "message": message, "members": row["members"], "entered": row["entered"],
                "exited": row["exited"], "processed_slots": row["processed_slots"], "source": state["source"],
                "ms": dict(self.ms), "hot_bytes": hot}


# ---------------------------------------------------------------- probe (fetch-only diagnostics)

PROBE_FINALITY_SYMBOLS = ("SPY", "QQQ", "AAPL")
# Thin but eligible S&P names whose newest bar was seen to change after +50 s (DATA-4); used when no
# stored pack ranks the universe by median 5-minute dollar volume.
PROBE_THIN_FALLBACK = ("AIZ", "ALLE", "PNW", "GL", "DVA", "HII", "TPL", "NI", "ERIE", "FRT")
PROBE_THIN_COUNT = 10
PROBE_FINALITY_OFFSETS = (15, 30, 45, 60, 90, 120, 180, 240, 300)


def thin_names(deps: Deps, data_dir: Path | None, n: int = PROBE_THIN_COUNT) -> tuple[list[str], str]:
    """(the n eligible names with the lowest medbar_usd in the stored pack, where they came from);
    the fixed thin list when there is no readable pack."""
    doc = read_gz_json(Path(data_dir) / PATHS["baselines"]) if data_dir else None
    if doc is not None:
        try:
            pack = deps.pack_from_json(doc)
            ranked = sorted((float(b.medbar_usd), s) for s, b in pack.symbols.items()
                            if b.eligible and s not in PROBE_FINALITY_SYMBOLS and math.isfinite(float(b.medbar_usd)))
        except (AttributeError, KeyError, TypeError, ValueError):
            ranked = []
        if ranked:
            return [s for _, s in ranked[:n]], f"stored pack of {doc.get('asof')}, lowest median 5-minute dollar volume"
    return list(PROBE_THIN_FALLBACK[:n]), "fixed thin list (no stored pack)"


def _bar_at(bars: Any, ts: int) -> tuple | None:
    if bars is None:
        return None
    stamps = bars.ts.tolist()
    if ts not in stamps:
        return None
    i = stamps.index(ts)
    return (float(bars.o[i]), float(bars.h[i]), float(bars.l[i]), float(bars.c[i]), int(bars.v[i]))


def _fold_at(bars: Any, ts: int) -> tuple[bool, bool]:
    """(fold in progress for the bar starting at ts, its next row exists). A fold: that bar is the
    newest row and the last trade is already past its end, so Yahoo is still folding trades into it."""
    if bars is None or not len(bars.ts):
        return False, False
    stamps = bars.ts.tolist()
    last = getattr(bars, "last_trade_ts", None)
    return stamps[-1] == ts and last is not None and last >= ts + 300, ts + 300 in stamps


def bar_finality(fetcher: Any, clock: Callable[[], float], sleep: Callable[[float], None],
                 symbols: tuple[str, ...] = PROBE_FINALITY_SYMBOLS,
                 offsets: tuple[int, ...] = PROBE_FINALITY_OFFSETS) -> dict:
    """Refetch the bar that closes at the next boundary at several offsets and report, per name, when it
    stopped changing, whether a fold was in progress (newest row, last trade past its end) and when the
    next row appeared. Only meaningful during the regular session."""
    now = clock()
    phase, s = cal.phase_at(datetime.fromtimestamp(now, cal.UTC))
    boundary = (int(now) // 300 + 1) * 300
    if phase != "regular" or s is None or boundary > s.close_epoch:
        return {"measured": False, "note": "market closed: bar finality needs a live regular session"}
    start = boundary - 300
    samples = []
    for off in offsets:
        sleep(max(0.0, boundary + off - clock()))
        bars, rep = fetcher.bars_5m(list(symbols), range_="1d")
        samples.append({sym: (_bar_at(bars.get(sym), start), *_fold_at(bars.get(sym), start)) for sym in symbols})
    result = {}
    for sym in symbols:
        final = samples[-1][sym][0]
        settled = None
        for off, snap in reversed(list(zip(offsets, samples))):
            if final is None or snap[sym][0] != final:
                break
            settled = off
        result[sym] = {"first_seen_s": next((o for o, sn in zip(offsets, samples) if sn[sym][0]), None),
                       "stable_from_s": settled, "final_close": final[3] if final else None,
                       "final_volume": final[4] if final else None,
                       "fold_seen": any(sn[sym][1] for sn in samples),
                       "next_row_s": next((o for o, sn in zip(offsets, samples) if sn[sym][2]), None)}
    late = sorted(sym for sym, v in result.items()
                  if v["stable_from_s"] is None or v["stable_from_s"] > RUNTIME["tick_offset_s"])
    return {"measured": True, "bar_start": iso(start), "offsets_s": list(offsets), "symbols": result,
            "unstable_at_tick": late}


def probe(deps: Deps, *, clock: Callable[[], float] = time.time, sleep: Callable[[float], None] = time.sleep,
          summary_path: str | None = None, data_dir: Path | None = None) -> dict:
    fetcher = deps.fetcher(workers=RUNTIME["fetch_workers"], timeout_s=RUNTIME["fetch_timeout_s"])
    symbols = deps.scan_symbols()
    sample = list(REFERENCE_SYMBOLS) + [s for s in symbols if s not in REFERENCE_SYMBOLS][:60]
    calls = [("quotes (universe)", fetcher.quotes, (symbols,), {}),
             ("movers", fetcher.movers, (), {}),
             ("5m bars 1d (63 symbols)", fetcher.bars_5m, (sample,), {"range_": "1d"}),
             ("5m bars 1mo (20 symbols)", fetcher.bars_5m, (sample[:20],), {"range_": "1mo"}),
             ("daily 3mo (20 symbols)", fetcher.daily, (sample[:20],), {"range_": "3mo"})]
    rows = []
    for label, fn, args, kw in calls:
        t = time.perf_counter()
        try:
            _, rep = fn(*args, **kw)
            rows.append((label, rep.source, rep.status, rep.requested, rep.ok, len(rep.failed), rep.http_429,
                         int((time.perf_counter() - t) * 1000)))
        except Exception as e:  # noqa: BLE001 - a diagnostic run reports every failure
            rows.append((label, "none", f"error: {type(e).__name__}", 0, 0, 0, 0, int((time.perf_counter() - t) * 1000)))
    thin, thin_source = thin_names(deps, data_dir)
    # Liquid names settle within seconds; thin ones are where a provisional (still folding) bar shows up.
    finality = bar_finality(fetcher, clock, sleep,
                            symbols=PROBE_FINALITY_SYMBOLS + tuple(s for s in thin if s not in PROBE_FINALITY_SYMBOLS))
    finality.update(thin=thin, thin_source=thin_source)
    md = [f"## Momentum Radar probe, {iso(clock())}", "", "Fetch only: nothing was written to the data branch.", "",
          "| Call | Source | Status | Requested | OK | Failed | HTTP 429 | Wall ms |", "|---|---|---|---|---|---|---|---|"]
    md += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    md += ["", "### Bar finality", "", f"Thin names: {', '.join(thin)} ({thin_source}).", ""]
    if finality["measured"]:
        md += [f"Bar starting {finality['bar_start']}, refetched at +{', +'.join(map(str, finality['offsets_s']))} s "
               f"after its close. Compare `stable_from_s` with the {PARAMS['session']['bar_final_grace_s']} s grace and "
               f"the +{RUNTIME['tick_offset_s']} s tick. A fold means the bar was the newest row while the last trade "
               "was already past its end, so the source was still adding trades to it.", "",
               f"Not stable by the tick: {', '.join(finality['unstable_at_tick']) or 'none'}.", "",
               "| Symbol | Kind | First seen (s) | Stable from (s) | Fold seen | Next row from (s) | Close | Volume |",
               "|---|---|---|---|---|---|---|---|"]
        md += [f"| {sym} | {'thin' if sym in thin else 'liquid'} | {v['first_seen_s']} | {v['stable_from_s']} | "
               f"{'yes' if v['fold_seen'] else 'no'} | {v['next_row_s']} | {v['final_close']} | {v['final_volume']} |"
               for sym, v in finality["symbols"].items()]
    else:
        md.append(finality["note"])
    md += ["", "### Source health", "", "```json", json.dumps(fetcher.health_state(), indent=1, sort_keys=True), "```", ""]
    text = "\n".join(md)
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write(text)
    print(text, flush=True)
    failed = any(r[2] != "ok" for r in rows)
    return {"status": "degraded" if failed else "ok", "message": "probe finished; nothing written",
            "calls": [dict(zip(("call", "source", "status", "requested", "ok", "failed", "http_429", "ms"), r)) for r in rows],
            "finality": finality}


# ---------------------------------------------------------------- CLI

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Run one Momentum Radar scan and write its delta.")
    ap.add_argument("--data-dir", type=Path)
    ap.add_argument("--pending-dir", type=Path)
    ap.add_argument("--tick-id", help="the 5-minute boundary, YYYY-MM-DDTHH:MM:SSZ")
    ap.add_argument("--warmup", action="store_true", help="build today's baseline pack and write a pre-open heartbeat")
    ap.add_argument("--final", action="store_true", help="last tick of the session (close + 50 s)")
    ap.add_argument("--ignore-calendar", action="store_true", help="run the engine even when the market is closed")
    ap.add_argument("--probe", action="store_true", help="fetch-only diagnostics; writes nothing")
    a = ap.parse_args(argv)
    if not a.probe and not (a.data_dir and a.pending_dir and a.tick_id):
        ap.error("--data-dir, --pending-dir and --tick-id are required")
    if a.tick_id:
        try:
            parse_tick_id(a.tick_id)
        except ValueError:
            ap.error(f"--tick-id must look like 2026-09-28T13:35:00Z, got {a.tick_id!r}")
    try:
        if a.probe:
            result = probe(real_deps(), summary_path=os.environ.get("GITHUB_STEP_SUMMARY"), data_dir=a.data_dir)
        else:
            result = Tick(TickArgs(a.data_dir, a.pending_dir, a.tick_id, a.warmup, a.final, a.ignore_calendar),
                          real_deps()).run()
    except Exception as e:  # noqa: BLE001 - a bug: report it on the result line, exit non-zero
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"status": "error", "message": f"tick failed: {type(e).__name__}: {e}"[:300]}), flush=True)
        return 1
    print(json.dumps(result, separators=(",", ":"), ensure_ascii=False, default=str), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
