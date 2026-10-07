"""radar.tick end to end with a fake fetcher, engine and baseline builder (radar/SPEC.md 4.8 and 6)."""
from __future__ import annotations

import dataclasses
import functools
import gzip
import json
import re
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

from radar import calendar_nyse as cal
from radar import delta, tick
from radar.config import PARAMS, PATHS, RUNTIME
from radar.types import Bars, DailyBars, FetchReport, Quote

TS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
DAY = "2026-09-28"
SESSION = cal.session_for(date(2026, 9, 28))
TICK = "2026-09-28T14:35:00Z"                     # 10:35 EDT: the bar of slot 12 closed at this boundary
NOW = tick.parse_tick_id(TICK) + 50
UNIVERSE = [{"symbol": "AAPL", "name": "Apple", "sector": "Technology"},
            {"symbol": "NVDA", "name": "NVIDIA", "sector": "Technology"},
            {"symbol": "XOM", "name": "Exxon Mobil", "sector": None}]
SCAN = ["AAPL", "NVDA", "XOM", "SPY", "QQQ", "IWM"]

STATE_KEYS = {"schema", "generated_at", "tick_id", "last_bar", "status", "message", "session", "next_tick_at",
              "params_version", "source", "market", "counts", "members", "heating", "recent_exits", "sector_banners",
              "health", "disclaimer"}
SCAN_KEYS = {"v", "tick", "run_id", "written_at", "session", "phase", "status", "lag_s", "universe", "stage_b",
             "quotes_ok", "quotes_err", "bars_ok", "bars_err", "members", "heating", "entered", "exited",
             "processed_slots", "source", "ms", "git_prev", "hot_bytes", "errors"}
ENGINE_KEYS = {"schema", "session", "engine", "source_health", "dynamic_adds", "pack_gaps", "ops", "loop"}
RESULT_KEYS = {"status", "message", "members", "entered", "exited", "processed_slots", "source", "ms", "hot_bytes"}
STATUSES = {"ok", "degraded", "no_data", "closed", "error"}


# ---------------------------------------------------------------- fakes

@dataclass
class FakeSym:
    """The SymbolBaseline fields the tick reads."""
    name: str | None = None
    sector: str | None = None
    eligible: bool = True
    ineligible_reason: str | None = None
    medbar_usd: float = 1e6


@dataclass
class FakePack:
    asof: str
    params_version: str
    symbols: dict

    def to_json(self) -> dict:
        return {"asof": self.asof, "params_version": self.params_version,
                "symbols": {s: dataclasses.asdict(b) for s, b in self.symbols.items()}}

    @classmethod
    def from_json(cls, d: dict) -> FakePack:
        return cls(d["asof"], d["params_version"], {s: FakeSym(**b) for s, b in d["symbols"].items()})


def pack_for(day: str, symbols=SCAN, **fields) -> FakePack:
    return FakePack(day, PARAMS["params_version"], {s: FakeSym(name=s, **fields) for s in symbols})


def baseline(symbol: str, daily: dict, meta: dict | None = None) -> FakeSym:
    """Like baselines._eligibility: a symbol without daily bars has no prior close."""
    m = (meta or {}).get(symbol) or {}
    have = symbol in daily
    return FakeSym(name=m.get("name", symbol), sector=m.get("sector"), eligible=have,
                   ineligible_reason=None if have else "no prior close")


def bars(symbol: str, closes: list[float], start: int) -> Bars:
    n = len(closes)
    c = np.asarray(closes, dtype=np.float64)
    return Bars(symbol, np.arange(start, start + 300 * n, 300, dtype=np.int64), c, c, c, c, np.full(n, 1000, dtype=np.int64))


def member(ticker: str = "NVDA", price: float = 12.5) -> dict:
    return {"ticker": ticker, "name": "NVIDIA", "sector": "Technology", "direction": "up", "state": "racing",
            "late": False, "entered_at": "2026-09-28T14:10:00Z", "entry_price": 12.0, "last_price": price,
            "last_bar_at": TICK, "minutes_on_radar": 25, "move_since_entry_pct": 4.17, "peak_since_entry_pct": 4.5,
            "chg_5m_pct": 0.4, "chg_15m_pct": 1.2, "chg_30m_pct": 2.5, "chg_day_pct": 6.1, "rvol": 3.4,
            "rvol_day": 2.2, "vwap_dist_pct": 1.9, "z15": 2.9, "z30": 3.3, "zday": 3.1, "intensity": 74,
            "reasons": ["+2.9σ vs market in 15 min"], "soft_fails": 0, "episode": 1,
            "spark": {"t0": "2026-09-28T13:40:00Z", "step_s": 300, "entry_i": 6, "p": [11.5, 12.0, price]}}


HEALTHY = {"name": "yahoo", "status": "ok", "consecutive_failures": 0, "last_ok_at": None, "breaker": {"open": False}}

EXIT = {"ticker": "AAPL", "name": "Apple", "direction": "down", "entered_at": "2026-09-28T13:50:00Z",
        "exited_at": "2026-09-28T14:20:00Z", "minutes_on_radar": 30, "move_since_entry_pct": -1.2,
        "exit_reason": "FADE", "exit_detail": "the move faded"}


@dataclass
class World:
    """Configures the fakes and records what the tick asked them for."""
    history: bool = True                 # 1mo bars exist, so the pack can be built
    quotes_error: Exception | None = None
    no_bars: bool = False
    source: str = "yahoo"
    bars_status: str = "ok"
    movers: list = field(default_factory=list)
    nan_price: bool = False
    build_error: Exception | None = None
    extend_error: Exception | None = None
    quotes_status: str = "ok"
    step_error: Exception | None = None
    sectors: dict = field(default_factory=dict)          # sector in the quote of these symbols
    no_daily: set = field(default_factory=set)           # symbols the daily call leaves out
    no_history: set = field(default_factory=set)         # symbols the 1mo 5m call leaves out
    now: float = NOW                     # the fake fetcher's clock, for last_ok_at
    pending: Path | None = None
    calls: list = field(default_factory=list)
    side_files: list = field(default_factory=list)       # <pending>/source_health.json seen before each call
    engines: list = field(default_factory=list)
    fetchers: list = field(default_factory=list)
    packs_built: list = field(default_factory=list)

    def deps(self) -> tick.Deps:
        world = self

        class Fetcher:
            """Keeps its health like fetch.Fetcher: the last call sets the status, failed calls count in a
            row, and the record round-trips through engine.json as `health`."""

            def __init__(self, *, health=None, workers=16, timeout_s=12.0, deadline=None, on_health=None):
                self.health = health
                self.h = {**HEALTHY, **(health or {})}
                self.deadline, self.on_health = deadline, on_health
                world.fetchers.append(self)

            def _served(self, result, report: FetchReport):
                ok = report.status == "ok"
                self.h.update(name=report.source, status=report.status,
                              consecutive_failures=0 if ok else self.h["consecutive_failures"] + 1,
                              last_ok_at=tick.iso(world.now) if ok else self.h["last_ok_at"])
                if self.on_health:                          # like fetch.Fetcher after every public call
                    self.on_health(self.health_state())
                return result, report

            def _seen(self):
                if world.pending is not None:
                    world.side_files.append(tick.read_json(world.pending / tick.SOURCE_HEALTH_FILE))

            def quotes(self, symbols):
                self._seen()
                world.calls.append(("quotes", list(symbols)))
                if world.quotes_error:
                    raise world.quotes_error
                ok = world.quotes_status != "down"
                got = {s: Quote(s, price=10.0, prev_close=9.8, day_volume=10_000, sector=world.sectors.get(s))
                       for s in symbols} if ok else {}
                return self._served(got, FetchReport(world.source, world.quotes_status, requested=len(symbols),
                                                     ok=len(got), failed=[] if ok else list(symbols)))

            def movers(self):
                self._seen()
                world.calls.append(("movers",))
                return self._served(list(world.movers), FetchReport(world.source, "ok", requested=3, ok=3))

            def bars_5m(self, symbols, *, range_="1d", include_prepost=False):
                self._seen()
                world.calls.append(("bars_5m", range_, list(symbols)))
                if range_ == "1mo" and not world.history or range_ == "1d" and world.no_bars:
                    return self._served({}, FetchReport(world.source, "down", requested=len(symbols), failed=list(symbols)))
                got = {s: bars(s, [10.0, 10.5], SESSION.slot_start(11)) for s in symbols
                       if not (range_ == "1mo" and s in world.no_history)}
                return self._served(got, FetchReport(world.source, world.bars_status, requested=len(symbols), ok=len(got),
                                                     failed=[s for s in symbols if s not in got]))

            def daily(self, symbols, *, range_="3mo"):
                self._seen()
                world.calls.append(("daily", range_, list(symbols)))
                if not world.history:
                    return self._served({}, FetchReport(world.source, "down", requested=len(symbols), failed=list(symbols)))
                c = np.array([9.0, 9.8])
                got = {s: DailyBars(s, np.array(["2026-09-24", "2026-09-25"], dtype="datetime64[D]"), c, c, c, c,
                                    np.array([1, 1])) for s in symbols if s not in world.no_daily}
                return self._served(got, FetchReport(world.source, "ok" if len(got) == len(symbols) else "degraded",
                                                     requested=len(symbols), ok=len(got),
                                                     failed=[s for s in symbols if s not in got]))

            def health_state(self):
                return dict(self.h)

        class Engine:
            def __init__(self, params, pack, session, state=None):
                self.pack, self.session = pack, session
                same = bool(state) and state.get("session") == session.day.isoformat()
                self.st = dict(state) if same else {"session": session.day.isoformat(), "last_slot": -1}
                world.engines.append(self)

            def stage_a(self, quotes, now_epoch, *, quotes_ok=True):
                self.quotes, self.quotes_ok = quotes, quotes_ok
                return ["NVDA", "SPY"]

            def step(self, bars_, now_epoch, *, halted=frozenset(), degraded_volume=False):
                self.degraded_volume = degraded_volume
                if world.step_error:
                    raise world.step_error
                k_now = min((now_epoch - self.session.open_epoch - 300 - 45) // 300, self.session.n_slots - 1)
                due = list(range(self.st["last_slot"] + 1, k_now + 1)) if "SPY" in bars_ else []
                if due:
                    self.st["last_slot"] = due[-1]
                price = float("nan") if world.nan_price else 12.5
                rows = [{"v": 1, "tick": tick.iso(self.session.slot_start(k) + 300), "session": DAY, "slot": k,
                         "ticker": "NVDA", "role": "member", "price": 12.5} for k in due]
                events = [{"v": 1, "id": "20260928T1435Z-NVDA-ENTER-1", "ts": TICK, "ticker": "NVDA", "type": "ENTER"},
                          {"v": 1, "id": "20260928T1435Z-AAPL-EXIT-1", "ts": TICK, "ticker": "AAPL", "type": "EXIT"}] if due else []
                snapshot = {"members": [member(price=price)], "heating": [], "recent_exits": [EXIT],
                            "market": {"mode": "normal", "dir": None, "spy_chg_day_pct": 0.3, "spy_z30": 0.4,
                                       "breadth30": 0.52},
                            "sector_banners": [],
                            "counts": {"universe": 5, "stage_b": 2, "members": 1, "heating": 0, "entered_today": 1,
                                       "exited_today": 1}}
                return SimpleNamespace(processed_slots=due, events=events, member_rows=rows, snapshot=snapshot)

            def state_dict(self):
                return dict(self.st)

        def build_pack(session, bars5, daily, meta, params):
            world.packs_built.append(sorted(bars5))
            if world.build_error:
                raise world.build_error
            return FakePack(session.day.isoformat(), params["params_version"],
                            {s: baseline(s, daily, meta) for s in bars5})

        def extend_pack(pack, session, bars5, daily, meta, params):
            """Like baselines.extend_pack: adds the symbols not yet in the pack, leaves the others."""
            world.calls.append(("extend_pack", sorted(bars5), sorted(daily), meta))
            if world.extend_error:
                raise world.extend_error
            new = {s: baseline(s, daily, meta) for s in bars5 if s not in pack.symbols}
            return dataclasses.replace(pack, symbols={**pack.symbols, **new})

        def dynamic_candidates(movers, known, params):
            return [q for q in movers if q.symbol not in known]

        return tick.Deps(Fetcher, Engine, build_pack, extend_pack, FakePack.from_json, lambda: list(UNIVERSE),
                         lambda: list(SCAN), dynamic_candidates)


# ---------------------------------------------------------------- helpers

def seed(data: Path, *, pack: FakePack | None = None, engine: dict | None = None, state: dict | None = None,
         files: dict[str, bytes] | None = None) -> None:
    (data / "radar").mkdir(parents=True, exist_ok=True)
    if pack is not None:
        (data / PATHS["baselines"]).write_bytes(tick.gz_json(pack.to_json()))
    if engine is not None:
        (data / PATHS["engine"]).write_bytes(delta.json_bytes(engine))
    if state is not None:
        (data / PATHS["state"]).write_bytes(delta.json_bytes(state))
    for rel, body in (files or {}).items():
        (data / rel).write_bytes(body)


def run(tmp_path: Path, world: World, tick_id: str = TICK, now: float = NOW, **flags) -> tuple[dict, Path]:
    data, pending = tmp_path / "data", tmp_path / "pending"
    before = set(delta.list_pending(pending))
    world.now, world.pending = now, pending
    args = tick.TickArgs(data, pending, tick_id, **flags)
    res = tick.Tick(args, world.deps(), clock=lambda: now).run()
    new = [d for d in delta.list_pending(pending) if d not in before]
    assert len(new) == 1, "a tick writes exactly one delta"
    delta.apply_delta(new[0], data)
    return res, new[0]


def read(data: Path, key: str) -> dict:
    return json.loads((data / PATHS[key]).read_bytes())


def read_gz(data: Path, key: str) -> dict:
    return json.loads(gzip.decompress((data / PATHS[key]).read_bytes()))


def later(minute: int) -> tuple[str, float]:
    """A later tick of the same session: (tick id, now)."""
    tick_id = f"2026-09-28T14:{minute:02d}:00Z"
    return tick_id, tick.parse_tick_id(tick_id) + 50


def jsonl(data: Path, key: str) -> list[dict]:
    path = data / PATHS[key]
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()] if path.exists() else []


def ts_or_none(v) -> bool:
    return v is None or bool(TS.match(v))


def check_state(state: dict) -> None:
    """radar/state.json exactly as SPEC section 6 lays it out."""
    assert set(state) == STATE_KEYS
    assert state["schema"] == 1 and state["params_version"] == PARAMS["params_version"]
    assert TS.match(state["generated_at"]) and TS.match(state["tick_id"])
    assert ts_or_none(state["last_bar"]) and ts_or_none(state["next_tick_at"])
    assert state["status"] in STATUSES and isinstance(state["message"], str)
    s = state["session"]
    assert set(s) == {"date", "phase", "open", "close", "half_day"}
    assert s["phase"] in {"pre", "regular", "post", "closed"} and TS.match(s["open"]) and TS.match(s["close"])
    assert set(state["source"]) == {"name", "status", "consecutive_failures", "last_ok_at"}
    assert state["source"]["name"] in {"yahoo", "nasdaq"} and state["source"]["status"] in {"ok", "degraded", "down"}
    assert ts_or_none(state["source"]["last_ok_at"])
    assert set(state["market"]) == {"mode", "dir", "spy_chg_day_pct", "spy_z30", "breadth30"}
    assert set(state["counts"]) == {"universe", "stage_b", "members", "heating", "entered_today", "exited_today"}
    assert set(state["health"]) == {"ticks_today", "ticks_skipped", "last_tick_ms", "loop_run_id", "loop_started_at",
                                    "published_late"}
    assert all(isinstance(state[k], list) for k in ("members", "heating", "recent_exits", "sector_banners"))
    assert "not financial advice" in state["disclaimer"]
    assert len(delta.json_bytes(state)) < 256 * 1024


def check_scan_row(row: dict) -> None:
    assert set(row) == SCAN_KEYS and row["v"] == 1
    assert TS.match(row["tick"]) and TS.match(row["written_at"]) and row["status"] in STATUSES
    assert set(row["ms"]) == set(tick.MS_KEYS) and all(isinstance(v, int) for v in row["ms"].values())
    assert set(row["git_prev"]) == {"stage", "commit", "push", "attempts", "status"}
    assert row["git_prev"]["status"] in {"ok", "resynced", "failed", "none"}
    assert set(row["hot_bytes"]) == {"member_ticks", "events", "scan_log", "state"}
    assert len(row["errors"]) <= 5 and all(len(e) <= 200 for e in row["errors"])


LOOP = {"run_id": "gha-99-1", "started_at": "2026-09-28T12:33:20Z", "session": DAY, "ticks_today": 13,
        "ticks_skipped": 1, "last_tick": TICK, "published_late": 2,
        "git_prev": {"stage": 40, "commit": 25, "push": 900, "attempts": 1, "status": "ok"},
        "write_ms": [65], "next_tick_at": "2026-09-28T14:40:50Z"}


# ---------------------------------------------------------------- regular ticks

def test_regular_tick_end_to_end(tmp_path):
    data = tmp_path / "data"
    seed(data, pack=pack_for(DAY),
         engine={"schema": 1, "session": DAY, "engine": {"session": DAY, "last_slot": 10}, "source_health": {"x": 1},
                 "dynamic_adds": [], "ops": {"hk_dispatched_at": "2026-09-28T09:00:00Z"}, "loop": LOOP},
         files={PATHS["events"]: b'{"id":"old"}\n'})
    world = World()
    res, d = run(tmp_path, world)

    assert set(res) == RESULT_KEYS and res["status"] == "ok" and res["message"] == ""
    assert res["processed_slots"] == [11, 12] and res["entered"] == ["NVDA"] and res["exited"] == ["AAPL"]
    assert delta.read_meta(d)["kind"] == "tick" and delta.read_meta(d)["summary"]["members"] == 1
    assert world.packs_built == []                                     # asof matched: loaded, not rebuilt
    assert world.fetchers[0].health == {"x": 1}                        # breaker state carried from engine.json
    assert world.engines[0].st["last_slot"] == 12                      # engine state carried from engine.json
    assert ("bars_5m", "1d", ["NVDA", "SPY"]) in world.calls

    state = read(data, "state")
    check_state(state)
    assert state["tick_id"] == TICK and state["status"] == "ok" and state["last_bar"] == "2026-09-28T14:35:00Z"
    assert state["session"] == {"date": DAY, "phase": "regular", "open": "2026-09-28T13:30:00Z",
                                "close": "2026-09-28T20:00:00Z", "half_day": False}
    assert state["next_tick_at"] == "2026-09-28T14:40:50Z" and state["generated_at"] == tick.iso(NOW)
    assert state["source"] == {"name": "yahoo", "status": "ok", "consecutive_failures": 0, "last_ok_at": tick.iso(NOW)}
    assert state["members"] == [member()] and state["recent_exits"] == [EXIT]
    assert state["counts"]["universe"] == 5 and state["counts"]["entered_today"] == 1   # the engine's counts win
    assert state["health"] == {"ticks_today": 13, "ticks_skipped": 1, "last_tick_ms": state["health"]["last_tick_ms"],
                               "loop_run_id": "gha-99-1", "loop_started_at": "2026-09-28T12:33:20Z", "published_late": 2}

    engine = read(data, "engine")
    assert set(engine) == ENGINE_KEYS and engine["schema"] == 1 and engine["session"] == DAY
    assert engine["engine"] == {"session": DAY, "last_slot": 12} and engine["loop"] == LOOP
    assert engine["source_health"] == {**HEALTHY, "x": 1, "last_ok_at": tick.iso(NOW)}
    assert engine["ops"] == {"hk_dispatched_at": "2026-09-28T09:00:00Z", "hk_request": None}

    assert [r["slot"] for r in jsonl(data, "member_ticks")] == [11, 12]
    assert [e["id"] for e in jsonl(data, "events")] == ["old", "20260928T1435Z-NVDA-ENTER-1", "20260928T1435Z-AAPL-EXIT-1"]
    (row,) = jsonl(data, "scan_log")
    check_scan_row(row)
    assert row["tick"] == TICK and row["session"] == DAY and row["phase"] == "regular" and row["run_id"] == "local"
    assert row["lag_s"] == 50 and row["universe"] == 6 and row["stage_b"] == 2
    assert (row["quotes_ok"], row["quotes_err"], row["bars_ok"], row["bars_err"]) == (6, 0, 2, 0)
    assert row["members"] == 1 and row["processed_slots"] == [11, 12] and row["source"] == "yahoo"
    assert row["git_prev"] == LOOP["git_prev"] and row["errors"] == []
    assert row["hot_bytes"]["events"] == (data / PATHS["events"]).stat().st_size
    assert row["hot_bytes"]["state"] == (data / PATHS["state"]).stat().st_size


def test_run_id_comes_from_the_actions_environment(tmp_path, monkeypatch):
    monkeypatch.setenv("GITHUB_RUN_ID", "123")
    monkeypatch.setenv("GITHUB_RUN_ATTEMPT", "2")
    seed(tmp_path / "data", pack=pack_for(DAY))
    run(tmp_path, World())
    assert jsonl(tmp_path / "data", "scan_log")[0]["run_id"] == "gha-123-2"


def test_first_tick_builds_the_pack_when_it_is_missing_or_stale(tmp_path):
    data = tmp_path / "data"
    seed(data, pack=pack_for("2026-09-25"))
    world = World()
    res, d = run(tmp_path, world)
    assert res["status"] == "ok" and world.packs_built == [sorted(SCAN)]
    assert ("bars_5m", "1mo", SCAN) in world.calls and ("daily", "3mo", SCAN) in world.calls
    doc = json.loads(gzip.decompress((data / PATHS["baselines"]).read_bytes()))
    assert doc["asof"] == DAY and (d / "replace" / PATHS["baselines"]).read_bytes()[:2] == b"\x1f\x8b"


def test_a_pack_from_other_params_is_rebuilt(tmp_path):
    seed(tmp_path / "data", pack=dataclasses.replace(pack_for(DAY), params_version="radar-sm-0"))
    world = World()
    run(tmp_path, world)
    assert len(world.packs_built) == 1


def test_no_history_means_no_data_and_members_are_held(tmp_path):
    data = tmp_path / "data"
    prev = {"schema": 1, "status": "ok", "session": {"date": DAY, "phase": "regular"}, "members": [member()],
            "heating": [], "recent_exits": [EXIT], "counts": {"members": 1, "entered_today": 3},
            "last_bar": "2026-09-28T14:30:00Z",
            "source": {"name": "yahoo", "status": "ok", "consecutive_failures": 0, "last_ok_at": "2026-09-28T14:30:50Z"}}
    seed(data, state=prev, engine={"schema": 1, "session": DAY, "engine": {"session": DAY, "last_slot": 11},
                                   "dynamic_adds": ["HOOD"], "ops": {"hk_dispatched_at": None}, "loop": {}})
    world = World(history=False)
    res, _ = run(tmp_path, world)
    assert res["status"] == "no_data" and "held, not dropped" in res["message"] and world.engines == []
    state = read(data, "state")
    check_state(state)
    assert state["members"] == [member()] and state["counts"]["entered_today"] == 3
    assert state["last_bar"] == "2026-09-28T14:30:00Z" and state["source"]["status"] == "down"
    engine = read(data, "engine")
    assert engine["engine"] == {"session": DAY, "last_slot": 11} and engine["dynamic_adds"] == ["HOOD"]
    row = jsonl(data, "scan_log")[0]
    check_scan_row(row)
    assert row["status"] == "no_data" and row["errors"][0].startswith("baselines:")


def test_fetch_failures_never_kill_the_tick(tmp_path):
    data = tmp_path / "data"
    seed(data, pack=pack_for(DAY))
    world = World(quotes_error=TimeoutError("read timed out"), no_bars=True)
    res, _ = run(tmp_path, world)
    assert res["status"] == "no_data" and res["processed_slots"] == []
    state = read(data, "state")
    check_state(state)
    assert state["members"] == [member()]                       # the engine still holds its members
    assert state["source"]["status"] == "down"
    row = jsonl(data, "scan_log")[0]
    check_scan_row(row)
    assert row["quotes_ok"] == 0 and row["quotes_err"] == 6 and row["bars_err"] == 2
    assert row["errors"][0] == "quotes: TimeoutError: read timed out"
    assert world.engines[0].quotes_ok is False                   # Stage B is not widened to the universe


def test_source_is_the_fetchers_own_health(tmp_path):
    data = tmp_path / "data"
    stored = {**HEALTHY, "status": "down", "consecutive_failures": 2, "last_ok_at": "2026-09-28T14:20:50Z"}
    seed(data, pack=pack_for(DAY), engine={"schema": 1, "session": DAY, "source_health": stored})
    world = World(no_bars=True)                                          # quotes answer, then the bars fail
    run(tmp_path, world)
    health = world.fetchers[0].health_state()
    assert world.fetchers[0].health == stored and read(data, "engine")["source_health"] == health
    assert read(data, "state")["source"] == {"name": "yahoo", "status": "down", "consecutive_failures": 1,
                                             "last_ok_at": tick.iso(NOW)}


def test_malformed_source_health_falls_back_to_a_valid_source(tmp_path):
    seed(tmp_path / "data", engine={"schema": 1, "source_health": {"name": "bing", "status": "?",
                                                                   "consecutive_failures": None, "last_ok_at": 5}})
    run(tmp_path, World(), "2026-10-03T15:00:00Z", tick.parse_tick_id("2026-10-03T15:00:00Z"))
    state = read(tmp_path / "data", "state")
    check_state(state)
    assert state["source"] == {"name": "yahoo", "status": "ok", "consecutive_failures": 0, "last_ok_at": None}


def test_backup_source_marks_the_scan_degraded(tmp_path):
    seed(tmp_path / "data", pack=pack_for(DAY))
    res, _ = run(tmp_path, World(source="nasdaq", bars_status="degraded"))
    state = read(tmp_path / "data", "state")
    assert res["status"] == "degraded" and state["source"]["name"] == "nasdaq"
    assert state["message"].startswith("Using the backup data source (Nasdaq).")


def test_dynamic_adds_get_baselines_and_persist_for_the_session(tmp_path, monkeypatch):
    data = tmp_path / "data"
    seed(data, pack=pack_for(DAY), engine={"schema": 1, "session": DAY, "engine": None, "dynamic_adds": ["HOOD"],
                                           "ops": {"hk_dispatched_at": None}, "loop": {}})
    extra = pack_for(DAY, ["HOOD"])
    (data / PATHS["baselines_extra"]).write_bytes(tick.gz_json(extra.to_json()))
    monkeypatch.setitem(PARAMS["dynamic"], "max_adds_per_day", 2)
    movers = [Quote("NVDA", price=12.0), Quote("CRWV", price=90.0, name="CoreWeave"), Quote("RKLB", price=40.0, name="Rocket Lab")]
    world = World(movers=movers)
    run(tmp_path, world)
    engine = read(data, "engine")
    assert engine["dynamic_adds"] == ["HOOD", "CRWV"]              # capped at max_adds_per_day
    assert ("quotes", SCAN + ["HOOD"]) in world.calls
    assert ("bars_5m", "1mo", ["CRWV"]) in world.calls
    assert {"HOOD", "CRWV"} <= set(world.engines[0].pack.symbols)
    assert "CRWV" in world.engines[0].quotes                        # the mover's quote joins stage A
    saved = json.loads(gzip.decompress((data / PATHS["baselines_extra"]).read_bytes()))
    assert sorted(saved["symbols"]) == ["CRWV", "HOOD"] and saved["asof"] == DAY
    assert jsonl(data, "scan_log")[0]["universe"] == 8


def test_a_failed_dynamic_add_leaves_the_scan_running(tmp_path):
    data = tmp_path / "data"
    seed(data, pack=pack_for(DAY))
    world = World(movers=[Quote("CRWV", price=90.0)], extend_error=ValueError("pack has no SPY base returns"))
    res, _ = run(tmp_path, world)
    assert res["status"] == "ok" and res["processed_slots"][-1] == 12
    assert read(data, "engine")["dynamic_adds"] == [] and not (data / PATHS["baselines_extra"]).exists()
    assert jsonl(data, "scan_log")[0]["errors"] == ["dynamic adds: pack has no SPY base returns"]


# ---------------------------------------------------------------- SPEC 12.3: deadline, health side file, outage flags

def test_the_fetcher_gets_a_deadline_and_saves_its_health_after_every_call(tmp_path):
    """RT-1/E2E-1: the fetcher stops 40 s before the loop's timeout, and its health reaches
    <pending>/source_health.json after every call, so a killed tick still advances the breaker."""
    seed(tmp_path / "data", pack=pack_for(DAY))
    world = World(no_bars=True)
    run(tmp_path, world)
    assert world.fetchers[0].deadline == NOW + RUNTIME["tick_timeout_s"] - tick.DEADLINE_MARGIN_S
    before_quotes, before_movers, before_bars = world.side_files
    assert before_quotes is None and before_movers["status"] == "ok" and before_bars["name"] == "yahoo"
    assert not (tmp_path / "pending" / tick.SOURCE_HEALTH_FILE).exists()      # the delta's engine.json carries it
    assert read(tmp_path / "data", "engine")["source_health"]["consecutive_failures"] == 1


def test_a_tick_that_dies_leaves_its_source_health_for_the_loop(tmp_path):
    seed(tmp_path / "data", pack=pack_for(DAY))
    world = World(no_bars=True, step_error=KeyError("DYN"))
    args = tick.TickArgs(tmp_path / "data", tmp_path / "pending", TICK)
    world.pending = tmp_path / "pending"
    with pytest.raises(KeyError):
        tick.Tick(args, world.deps(), clock=lambda: NOW).run()
    side = tick.read_json(tmp_path / "pending" / tick.SOURCE_HEALTH_FILE)
    assert side == world.fetchers[0].health_state() and side["consecutive_failures"] == 1   # after the bars call
    assert delta.list_pending(tmp_path / "pending") == []


class VirtualClock:
    def __init__(self, t: float):
        self.t, self.lock = t, threading.Lock()

    def __call__(self) -> float:
        return self.t

    def sleep(self, s: float) -> None:
        with self.lock:
            self.t += s


class BlockedTransport:
    """Yahoo answers 429 to everything (the cloud-IP throttle); Nasdaq is down as well."""

    def __init__(self):
        self.calls, self.lock = 0, threading.Lock()

    def _hit(self, status: int) -> tuple[int, None]:
        with self.lock:
            self.calls += 1
        return status, None

    def yahoo_chart(self, symbol, params, timeout):
        return self._hit(429)

    def yahoo_quote(self, params, timeout):
        return self._hit(429)

    def yahoo_screen(self, name, count, timeout):
        return self._hit(429)

    def nasdaq(self, url, params, timeout):
        return self._hit(503)


def test_a_yahoo_block_reaches_the_fallback_within_two_ticks(tmp_path):
    """RT-1/E2E-1 with the real Fetcher: a blocked tick ends well inside the loop's timeout and saves its
    failures, and the next tick, fed that health, opens the breaker and uses Nasdaq."""
    from radar import fetch
    data, pending = tmp_path / "data", tmp_path / "pending"
    seed(data, pack=pack_for(DAY))
    clock, transport = VirtualClock(float(NOW)), BlockedTransport()
    world = World()
    deps = dataclasses.replace(world.deps(), fetcher=functools.partial(fetch.Fetcher, transport=transport, clock=clock,
                                                                        sleep=clock.sleep))
    for tick_id in (TICK, "2026-09-28T14:40:00Z"):
        clock.t = max(clock.t, tick.parse_tick_id(tick_id) + 50.0)
        start = clock()
        before = set(delta.list_pending(pending))
        res = tick.Tick(tick.TickArgs(data, pending, tick_id), deps, clock=clock).run()
        assert clock() - start < RUNTIME["tick_timeout_s"] - tick.DEADLINE_MARGIN_S
        (new,) = [d for d in delta.list_pending(pending) if d not in before]
        delta.apply_delta(new, data)
        health = read(data, "engine")["source_health"]
        if tick_id == TICK:
            assert health["consecutive_failures"] >= 2 and health["name"] == "yahoo"
            assert world.engines[-1].quotes_ok is False                       # no full-universe sweep
    assert transport.calls < 500
    assert health["name"] == "nasdaq" and any(f["breaker"]["open"] for f in health["families"].values())
    assert res["source"]["name"] == "nasdaq" and read(data, "state")["source"]["name"] == "nasdaq"


def test_a_failed_quote_call_keeps_stage_b_narrow(tmp_path):
    seed(tmp_path / "data", pack=pack_for(DAY))
    world = World(quotes_status="down")
    run(tmp_path, world)
    assert world.engines[0].quotes_ok is False and world.engines[0].degraded_volume is False


def test_fallback_bars_flag_degraded_volume(tmp_path):
    """DATA-6: Nasdaq bar volume is not on the Yahoo basis of the baselines."""
    seed(tmp_path / "data", pack=pack_for(DAY))
    world = World(source="nasdaq", bars_status="degraded")
    run(tmp_path, world)
    assert world.engines[0].quotes_ok is True and world.engines[0].degraded_volume is True


# ---------------------------------------------------------------- SPEC 12.3: pack acceptance and gaps

def test_a_pack_without_spy_daily_bars_is_rejected_and_retried(tmp_path):
    """ENG-1: without SPY's prior close no stock could enter all day; nothing is written and the next tick
    builds the pack."""
    data = tmp_path / "data"
    seed(data)
    world = World(no_daily={"SPY"})
    res, d = run(tmp_path, world)
    assert res["status"] == "no_data" and world.packs_built == [] and world.engines == []
    assert not (d / "replace" / PATHS["baselines"]).exists() and not (data / PATHS["baselines"]).exists()
    assert jsonl(data, "scan_log")[0]["errors"][0].startswith("baselines: no SPY daily bars; ")
    world = World()
    res, d = run(tmp_path, world, *later(40))
    assert res["status"] == "ok" and world.packs_built == [sorted(SCAN)]
    assert read_gz(data, "baselines")["asof"] == DAY and (d / "replace" / PATHS["baselines"]).exists()


def test_a_pack_with_partial_daily_history_is_rejected(tmp_path):
    """DATA-5: daily bars for 2 of 6 symbols would leave most names ineligible for the whole day."""
    seed(tmp_path / "data")
    world = World(no_daily={"AAPL", "NVDA", "XOM", "QQQ"})
    res, _ = run(tmp_path, world)
    assert res["status"] == "no_data" and world.packs_built == []
    err = jsonl(tmp_path / "data", "scan_log")[0]["errors"][0]
    assert "5-minute history for 100% and daily history for 33% of symbols" in err


def test_pack_gaps_are_listed_then_retried_on_a_later_tick(tmp_path):
    """DATA-5: an accepted pack below 100% keeps its gaps visible and refetches them later, in
    baselines_extra, without using the dynamic budget."""
    data = tmp_path / "data"
    seed(data)
    world = World(no_daily={"XOM"}, no_history={"AAPL"})               # 5 of 6 for both: accepted
    res, _ = run(tmp_path, world)
    assert res["status"] == "ok" and world.packs_built == [sorted(set(SCAN) - {"AAPL"})]
    gap = "pack gaps: 2 universe name(s) without usable baselines: AAPL, XOM"
    assert gap in jsonl(data, "scan_log")[-1]["errors"]
    assert not any(c[0] == "extend_pack" for c in world.calls)          # not on the tick that built the pack

    world = World()
    run(tmp_path, world, *later(40))
    assert ("bars_5m", "1mo", ["AAPL", "XOM"]) in world.calls and ("daily", "3mo", ["AAPL", "XOM"]) in world.calls
    pack = world.engines[0].pack
    assert pack.symbols["XOM"].eligible and pack.symbols["AAPL"].eligible
    assert sorted(read_gz(data, "baselines_extra")["symbols"]) == ["AAPL", "XOM"]
    engine = read(data, "engine")
    assert engine["pack_gaps"] == {"session": DAY, "retries": 1} and engine["dynamic_adds"] == []
    assert not any(e.startswith("pack gaps") for e in jsonl(data, "scan_log")[-1]["errors"])

    world = World()
    run(tmp_path, world, *later(45))                                     # filled: nothing left to retry
    assert not any(c[0] == "extend_pack" for c in world.calls) and world.engines[0].pack.symbols["XOM"].eligible


def test_pack_gap_retries_need_a_healthy_source_and_stop_after_three_a_day(tmp_path):
    data = tmp_path / "data"
    pack = pack_for(DAY)
    pack.symbols["XOM"] = FakeSym(name="XOM", eligible=False, ineligible_reason="no prior close")
    seed(data, pack=pack)
    world = World(source="nasdaq", no_daily={"XOM"})                     # on the backup source: no retry
    run(tmp_path, world)
    assert not any(c[0] == "daily" for c in world.calls)
    assert read(data, "engine")["pack_gaps"] == {"session": DAY, "retries": 0}
    for i, minute in enumerate((40, 45, 50, 55)):
        world = World(no_daily={"XOM"})                                  # XOM's daily keeps failing
        run(tmp_path, world, *later(minute))
        assert (("daily", "3mo", ["XOM"]) in world.calls) == (i < tick.PACK_GAP_RETRIES)
        assert "pack gaps: 1 universe name(s) without usable baselines: XOM" in jsonl(data, "scan_log")[-1]["errors"]
    assert read(data, "engine")["pack_gaps"] == {"session": DAY, "retries": 3}


def test_a_pack_the_builder_rejects_means_no_data(tmp_path):
    world = World(build_error=ValueError("no SPY bars in the baseline window"))
    res, _ = run(tmp_path, world)
    assert res["status"] == "no_data" and world.engines == []
    assert jsonl(tmp_path / "data", "scan_log")[0]["errors"] == ["baselines: no SPY bars in the baseline window"]


def test_dynamic_adds_take_their_sector_from_one_batched_quote_call(tmp_path):
    """DATA-3: Yahoo's screens carry no sector, so a mover's sector comes from a v7 quote."""
    data = tmp_path / "data"
    seed(data, pack=pack_for(DAY))
    movers = [Quote("CRWV", price=90.0, name="CoreWeave"), Quote("TWST", price=40.0, name="Twist Bioscience")]
    world = World(movers=movers, sectors={"TWST": "Health Care", "CRWV": "Information Technology"})
    run(tmp_path, world)
    assert world.calls.count(("quotes", ["CRWV", "TWST"])) == 1
    saved = read_gz(data, "baselines_extra")["symbols"]
    assert {s: (b["name"], b["sector"]) for s, b in saved.items()} == {
        "CRWV": ("CoreWeave", "Information Technology"), "TWST": ("Twist Bioscience", "Health Care")}
    assert world.engines[0].quotes["TWST"].sector == "Health Care"


def test_a_dynamic_candidate_without_daily_bars_is_not_added(tmp_path):
    """DATA-5: it would be ineligible all day and use up the budget; it is retried next tick instead."""
    data = tmp_path / "data"
    seed(data, pack=pack_for(DAY))
    world = World(movers=[Quote("CRWV", price=90.0), Quote("RKLB", price=40.0)], no_daily={"RKLB"})
    run(tmp_path, world)
    assert read(data, "engine")["dynamic_adds"] == ["CRWV"]
    (ext,) = [c for c in world.calls if c[0] == "extend_pack"]
    assert ext[1] == ["CRWV"] and ext[2] == ["CRWV"] and ("quotes", ["CRWV"]) in world.calls
    world = World(movers=[Quote("RKLB", price=40.0)])
    run(tmp_path, world, *later(40))
    assert read(data, "engine")["dynamic_adds"] == ["CRWV", "RKLB"]


def test_dynamic_adds_are_re_extended_when_baselines_extra_is_rejected(tmp_path):
    """ENG-3: a params bump mid-session rebuilds the main pack and rejects baselines_extra; a member that
    is a dynamic add gets its baselines again before the engine is built."""
    data = tmp_path / "data"
    old = "radar-sm-0"
    seed(data, pack=dataclasses.replace(pack_for(DAY), params_version=old),
         engine={"schema": 1, "session": DAY, "engine": {"session": DAY, "last_slot": 20}, "dynamic_adds": ["DYN"],
                 "ops": {"hk_dispatched_at": None}, "loop": {}},
         files={PATHS["baselines_extra"]: tick.gz_json(dataclasses.replace(pack_for(DAY, ["DYN"]),
                                                                            params_version=old).to_json())})
    world = World(sectors={"DYN": "Energy"})
    res, d = run(tmp_path, world)
    assert res["status"] == "ok" and world.packs_built == [sorted(SCAN)]
    assert ("quotes", SCAN + ["DYN"]) in world.calls and ("bars_5m", "1mo", ["DYN"]) in world.calls
    assert "DYN" in world.engines[0].pack.symbols
    extra = read_gz(data, "baselines_extra")
    assert extra["params_version"] == PARAMS["params_version"] and list(extra["symbols"]) == ["DYN"]
    assert extra["symbols"]["DYN"]["sector"] == "Energy" and read(data, "engine")["dynamic_adds"] == ["DYN"]


def test_a_dynamic_add_that_cannot_be_re_extended_is_kept_and_reported(tmp_path):
    data = tmp_path / "data"
    seed(data, pack=pack_for(DAY), engine={"schema": 1, "session": DAY, "dynamic_adds": ["DYN"]})
    world = World(no_daily={"DYN"})
    res, _ = run(tmp_path, world)
    assert res["status"] == "ok" and "DYN" not in world.engines[0].pack.symbols
    assert read(data, "engine")["dynamic_adds"] == ["DYN"] and not (data / PATHS["baselines_extra"]).exists()
    assert "dynamic adds: no baselines yet for DYN; retrying next scan" in jsonl(data, "scan_log")[0]["errors"]


def test_an_unreadable_pack_is_rebuilt(tmp_path):
    data = tmp_path / "data"
    seed(data, files={PATHS["baselines"]: tick.gz_json({"asof": DAY, "params_version": PARAMS["params_version"]})})
    world = World()
    res, _ = run(tmp_path, world)
    assert res["status"] == "ok" and world.packs_built == [sorted(SCAN)]
    assert jsonl(data, "scan_log")[0]["errors"][0].startswith("baselines: unreadable, rebuilding (KeyError")


def test_dynamic_adds_from_another_session_are_dropped(tmp_path):
    data = tmp_path / "data"
    seed(data, pack=pack_for(DAY), engine={"schema": 1, "session": "2026-09-25", "dynamic_adds": ["HOOD"]})
    world = World()
    run(tmp_path, world)
    assert read(data, "engine")["dynamic_adds"] == [] and ("quotes", SCAN) in world.calls


def test_non_finite_numbers_become_null(tmp_path):
    seed(tmp_path / "data", pack=pack_for(DAY))
    run(tmp_path, World(nan_price=True))
    raw = (tmp_path / "data" / PATHS["state"]).read_text(encoding="utf-8")
    assert "NaN" not in raw and json.loads(raw)["members"][0]["last_price"] is None
    assert "non-finite" in jsonl(tmp_path / "data", "scan_log")[0]["errors"][0]


# ---------------------------------------------------------------- SPEC 12.6: integration-rehearsal amendments

FRIDAY_EXIT = {**EXIT, "entered_at": "2026-09-25T18:50:00Z", "exited_at": "2026-09-25T19:45:00Z"}
FRIDAY_FINAL = {"schema": 1, "tick_id": "2026-09-25T20:00:00Z", "status": "ok", "last_bar": "2026-09-25T20:00:00Z",
                "session": {"date": "2026-09-25", "phase": "post"}, "members": [], "heating": [],
                "recent_exits": [FRIDAY_EXIT], "counts": {"entered_today": 9, "exited_today": 9}}


@pytest.mark.parametrize("history", [False, True], ids=["no pack: carry", "no bars: nothing processed"])
def test_the_first_scan_carries_nothing_from_the_previous_session(tmp_path, history):
    """INT-1: the warmup heartbeat is dated today but keeps Friday's exits until the open. A first scan that
    cannot step (no pack, so _carry) or processes no bar must not republish them, Friday's day counts or
    Friday's last bar as today's."""
    data = tmp_path / "data"
    seed(data, state=FRIDAY_FINAL, pack=pack_for(DAY) if history else None)
    warm = "2026-09-28T13:10:00Z"
    run(tmp_path, World(history=history), warm, tick.parse_tick_id(warm) + 2, warmup=True)
    heartbeat = read(data, "state")
    assert heartbeat["status"] == "closed" and heartbeat["session"]["date"] == DAY
    assert heartbeat["recent_exits"] == [FRIDAY_EXIT] and heartbeat["counts"]["exited_today"] == 9   # until the open
    first = "2026-09-28T13:35:00Z"
    res, _ = run(tmp_path, World(history=history, no_bars=True), first, tick.parse_tick_id(first) + 50)
    state = read(data, "state")
    check_state(state)
    assert res["status"] == "no_data" and state["status"] == "no_data" and res["processed_slots"] == []
    assert state["session"]["date"] == DAY and state["session"]["phase"] == "regular"
    assert state["last_bar"] is None
    if not history:                                         # _carry: nothing of the heartbeat is today's
        assert state["recent_exits"] == [] and state["members"] == [] and state["heating"] == []
        assert state["counts"] == tick.EMPTY_COUNTS


@pytest.mark.parametrize("state, same", [
    ({"status": "ok", "session": {"date": DAY, "phase": "regular"}}, True),
    ({"status": "no_data", "session": {"date": DAY, "phase": "regular"}}, True),
    ({"status": "error", "session": {"date": DAY, "phase": "regular"}}, True),     # a failed scan the loop republished
    ({"status": "closed", "session": {"date": DAY, "phase": "pre"}}, False),       # the warmup heartbeat
    ({"status": "error", "session": {"date": DAY, "phase": "pre"}}, False),        # what the loop used to make of it
    ({"status": "closed", "session": {"date": DAY, "phase": "regular"}}, False),
    ({"status": "ok", "session": {"date": "2026-09-25", "phase": "regular"}}, False),
    ({"status": "ok", "session": {"date": DAY}}, False),
    ({"status": "ok", "session": None}, False), ({}, False), (None, False),
])
def test_same_session_scan(state, same):
    assert tick.same_session_scan(state, DAY) is same
    assert tick.same_session_scan(state, None) is False


def chart_health(chart_open: bool) -> dict:
    def fam(is_open: bool) -> dict:
        return {"status": "down" if is_open else "ok", "consecutive_failures": 3 if is_open else 0, "last_ok_at": None,
                "breaker": {"open": is_open, "opened_at": None, "calls": 1 if is_open else 0, "good_probes": 0}}
    return {**HEALTHY, "name": "nasdaq" if chart_open else "yahoo", "families": {"chart": fam(chart_open), "crumb": fam(False)}}


def test_no_baseline_downloads_while_the_chart_breaker_is_open(tmp_path):
    """INT-5: 1mo/3mo calls have no Nasdaq fallback, so with the chart breaker open they would go to Yahoo as
    unscheduled probes (and could close it in one tick). New and re-extended dynamic adds and pack-gap retries
    wait, without using a retry, and resume once the chart family is ok again."""
    data = tmp_path / "data"
    pack = pack_for(DAY)
    pack.symbols["XOM"] = FakeSym(name="XOM", eligible=False, ineligible_reason="no prior close")
    seed(data, pack=pack, engine={"schema": 1, "session": DAY, "engine": None, "dynamic_adds": ["DYN"],
                                  "source_health": chart_health(True), "ops": {"hk_dispatched_at": None}, "loop": {}})
    world = World(movers=[Quote("CRWV", price=90.0, name="CoreWeave")])
    res, _ = run(tmp_path, world)
    assert res["status"] == "ok"
    assert [c for c in world.calls if c[0] in ("bars_5m", "daily") and c[1] != "1d"] == []
    assert not any(c[0] == "extend_pack" for c in world.calls) and ("quotes", ["CRWV"]) not in world.calls
    engine = read(data, "engine")
    assert engine["dynamic_adds"] == ["DYN"] and engine["pack_gaps"] == {"session": DAY, "retries": 0}
    errors = jsonl(data, "scan_log")[-1]["errors"]
    assert "dynamic adds: DYN deferred while the chart breaker is open" in errors
    assert "dynamic adds: CRWV deferred while the chart breaker is open" in errors
    assert "pack gaps: 1 universe name(s) without usable baselines: XOM" in errors

    engine["source_health"] = chart_health(False)               # the chart family is back
    (data / PATHS["engine"]).write_bytes(delta.json_bytes(engine))
    world = World(movers=[Quote("CRWV", price=90.0, name="CoreWeave")])
    run(tmp_path, world, *later(40))
    assert ("bars_5m", "1mo", ["DYN"]) in world.calls and ("daily", "3mo", ["XOM"]) in world.calls
    assert ("bars_5m", "1mo", ["CRWV"]) in world.calls
    engine = read(data, "engine")
    assert engine["dynamic_adds"] == ["DYN", "CRWV"] and engine["pack_gaps"] == {"session": DAY, "retries": 1}
    assert sorted(read_gz(data, "baselines_extra")["symbols"]) == ["CRWV", "DYN", "XOM"]


DEADLINE_SAFETY_S = 10       # engine step, delta write and exit after the last request returns


def test_the_deadline_margin_covers_a_request_still_in_flight():
    """A request started just before the deadline can run 2 x fetch_timeout_s on the crumb path (cookie and
    crumb, then the v7 call). After it the tick still has to step the engine and write its delta before the
    loop's timeout kills it, so the margin must cover both."""
    assert tick.DEADLINE_MARGIN_S >= 2 * RUNTIME["fetch_timeout_s"] + DEADLINE_SAFETY_S


def test_the_cli_deadline_counts_from_the_start_of_the_process(tmp_path, monkeypatch):
    """The loop's timeout runs from Popen, and real_deps() imports numpy, curl_cffi and yfinance (seconds on a
    runner): the deadline must count from before those imports, not from Tick.__init__."""
    world, seen = World(), {}

    def slow_deps() -> tick.Deps:
        seen["imports_from"] = time.time()
        time.sleep(0.3)
        return world.deps()

    monkeypatch.setattr(tick, "real_deps", slow_deps)
    seed(tmp_path / "data", pack=pack_for(DAY))
    before = time.time()
    assert tick.main(["--data-dir", str(tmp_path / "data"), "--pending-dir", str(tmp_path / "p"), "--tick-id", TICK]) == 0
    started = world.fetchers[0].deadline - (RUNTIME["tick_timeout_s"] - tick.DEADLINE_MARGIN_S)
    assert before <= started <= seen["imports_from"]


def test_final_tick_has_no_next_tick(tmp_path):
    seed(tmp_path / "data", pack=pack_for(DAY), engine={"schema": 1, "loop": {**LOOP, "next_tick_at": "2026-09-28T20:05:50Z"}})
    res, _ = run(tmp_path, World(), "2026-09-28T20:00:00Z", tick.parse_tick_id("2026-09-28T20:00:00Z") + 50, final=True)
    state = read(tmp_path / "data", "state")
    assert res["processed_slots"][-1] == 77 and state["next_tick_at"] is None and state["session"]["phase"] == "post"


# ---------------------------------------------------------------- housekeeping request

def test_oversized_table_requests_housekeeping(tmp_path, monkeypatch):
    monkeypatch.setitem(tick.HOT_MAX_BYTES, "events", 100)
    seed(tmp_path / "data", pack=pack_for(DAY), engine={"schema": 1, "ops": {"hk_dispatched_at": None}},
         files={PATHS["events"]: b"x" * 200 + b"\n"})
    run(tmp_path, World())
    ops = read(tmp_path / "data", "engine")["ops"]
    assert ops["hk_request"]["reason"] == "events over 1.25x the size limit" and ops["hk_request"]["at"] == tick.iso(NOW)
    assert ops["hk_dispatched_at"] is None


def test_slow_git_writes_request_housekeeping():
    assert tick.hk_request({}, [2000.0] * 9) is None                           # too few samples
    assert tick.hk_request({}, [100.0] * 9 + [2000.0]) == "git stage+commit p95 2000 ms over 1500 ms"
    assert tick.hk_request({}, [100.0] * 19 + [2000.0]) is None                 # one outlier in 20 is below p95
    assert tick.hk_request({"member_ticks": 10 * 1024 * 1024}, []) is None     # exactly 1.25x is allowed
    assert tick.hk_request({"member_ticks": 10 * 1024 * 1024 + 1}, []).startswith("member_ticks over")


# ---------------------------------------------------------------- outside the regular session

def test_warmup_builds_the_pack_and_writes_a_pre_open_heartbeat(tmp_path):
    data = tmp_path / "data"
    prev = {"schema": 1, "session": {"date": "2026-09-25"}, "recent_exits": [EXIT], "last_bar": "2026-09-25T20:00:00Z",
            "counts": {"entered_today": 4, "exited_today": 5}}
    seed(data, state=prev)
    world = World()
    warm = "2026-09-28T13:10:00Z"
    res, d = run(tmp_path, world, warm, tick.parse_tick_id(warm) + 2, warmup=True)
    assert res["status"] == "ok" and res["message"] == "Baselines ready; the radar starts at 09:35 ET."
    assert delta.read_meta(d)["kind"] == "warmup" and world.packs_built and world.engines == []
    state = read(data, "state")
    check_state(state)
    assert state["status"] == "closed" and state["message"] == "The radar starts at 09:35 ET."
    assert state["session"]["date"] == DAY and state["session"]["phase"] == "pre"
    assert state["recent_exits"] == [EXIT] and state["counts"]["exited_today"] == 5   # Friday's, until the open
    assert json.loads(gzip.decompress((data / PATHS["baselines"]).read_bytes()))["asof"] == DAY
    row = jsonl(data, "scan_log")[0]
    check_scan_row(row)
    assert row["status"] == "ok" and row["phase"] == "pre"


def test_warmup_without_history_reports_no_data(tmp_path):
    seed(tmp_path / "data")
    warm = "2026-09-28T13:10:00Z"
    res, _ = run(tmp_path, World(history=False), warm, tick.parse_tick_id(warm), warmup=True)
    assert res["status"] == "no_data" and not (tmp_path / "data" / PATHS["baselines"]).exists()


@pytest.mark.parametrize("tick_id, prev_date, kept, shown, phase, message", [
    ("2026-09-28T20:30:00Z", DAY, True, DAY, "post", "Market closed. The radar starts again Tue at 09:35 ET."),
    ("2026-10-03T15:00:00Z", "2026-10-02", True, "2026-10-05", "closed", "Market closed. The radar starts again Mon at 09:35 ET."),
    ("2026-10-03T15:00:00Z", "2026-09-30", False, "2026-10-05", "closed", "Market closed. The radar starts again Mon at 09:35 ET."),
    ("2026-11-26T15:00:00Z", "2026-11-25", True, "2026-11-27", "closed", "Market closed. The radar starts again Fri at 09:35 ET."),
])
def test_closed_heartbeat(tmp_path, tick_id, prev_date, kept, shown, phase, message):
    data = tmp_path / "data"
    prev = {"schema": 1, "session": {"date": prev_date}, "members": [member()], "recent_exits": [EXIT],
            "last_bar": f"{prev_date}T20:00:00Z", "counts": {"entered_today": 2, "exited_today": 3}}
    health = {"name": "nasdaq", "status": "degraded", "consecutive_failures": 2, "last_ok_at": None, "breaker": {"open": True}}
    engine = {"schema": 1, "session": prev_date, "engine": {"session": prev_date, "last_slot": 77},
              "source_health": health, "dynamic_adds": ["HOOD"], "ops": {"hk_dispatched_at": None}, "loop": LOOP}
    seed(data, state=prev, engine=engine)
    world = World()
    res, _ = run(tmp_path, world, tick_id, tick.parse_tick_id(tick_id) + 50)
    assert res["status"] == "closed" and world.fetchers == [] and world.engines == []
    state = read(data, "state")
    check_state(state)
    assert state["status"] == "closed" and state["message"] == message and state["members"] == []
    assert state["session"]["date"] == shown and state["session"]["phase"] == phase
    assert state["recent_exits"] == ([EXIT] if kept else [])
    assert state["counts"]["exited_today"] == (3 if kept else 0) and state["counts"]["members"] == 0
    assert state["last_bar"] == (prev["last_bar"] if kept else None)
    assert state["source"] == {k: health[k] for k in ("name", "status", "consecutive_failures", "last_ok_at")}
    assert state["next_tick_at"] is None
    saved = read(data, "engine")
    assert {k: saved[k] for k in ("session", "engine", "source_health", "dynamic_adds")} == \
        {k: engine[k] for k in ("session", "engine", "source_health", "dynamic_adds")}
    assert jsonl(data, "scan_log")[0]["session"] is None


def test_half_day_session_in_the_heartbeat(tmp_path):
    seed(tmp_path / "data")
    run(tmp_path, World(), "2026-11-27T13:00:00Z", tick.parse_tick_id("2026-11-27T13:00:00Z"))
    s = read(tmp_path / "data", "state")["session"]
    assert s == {"date": "2026-11-27", "phase": "pre", "open": "2026-11-27T14:30:00Z", "close": "2026-11-27T18:00:00Z",
                 "half_day": True}


@pytest.mark.parametrize("tick_id, now, flags, expected", [
    ("2026-09-28T13:35:00Z", None, {}, (DAY, True)),
    ("2026-09-28T13:30:00Z", None, {}, (DAY, False)),        # the open itself: no bar has closed yet
    ("2026-09-28T20:00:00Z", None, {}, (DAY, True)),         # the final tick
    ("2026-09-28T20:05:00Z", None, {}, (DAY, False)),
    ("2026-10-03T15:00:00Z", None, {"ignore_calendar": True}, ("2026-10-02", True)),       # Saturday: replay Friday
    ("2026-09-28T12:00:00Z", None, {"ignore_calendar": True}, ("2026-09-25", True)),       # before today's open
    ("2026-09-28T21:00:00Z", None, {"ignore_calendar": True}, (DAY, True)),
])
def test_resolve_session(tick_id, now, flags, expected):
    epoch = tick.parse_tick_id(tick_id)
    s, run_engine = tick.resolve_session(epoch, now or epoch + 50, ignore_calendar=flags.get("ignore_calendar", False),
                                         final=False)
    assert (s.day.isoformat(), run_engine) == expected


def test_manual_run_on_a_weekend_replays_the_last_session(tmp_path):
    seed(tmp_path / "data", pack=pack_for("2026-10-02"))
    world = World()
    res, _ = run(tmp_path, world, "2026-10-03T15:00:00Z", tick.parse_tick_id("2026-10-03T15:00:00Z") + 5,
                 ignore_calendar=True)
    assert world.engines[0].session.day == date(2026, 10, 2) and world.packs_built == []
    assert res["processed_slots"] == list(range(78))


# ---------------------------------------------------------------- probe

def test_probe_outside_the_session_reports_without_writing(tmp_path):
    summary = tmp_path / "summary.md"
    world = World()
    res = tick.probe(world.deps(), clock=lambda: tick.parse_tick_id("2026-10-03T15:00:00Z"), sleep=lambda s: None,
                     summary_path=str(summary))
    assert res["status"] == "ok" and [c["call"] for c in res["calls"]][:2] == ["quotes (universe)", "movers"]
    assert res["finality"]["measured"] is False
    text = summary.read_text(encoding="utf-8")
    assert "nothing was written to the data branch" in text and "| movers | yahoo | ok |" in text
    assert "market closed" in text and not (tmp_path / "data").exists()


def test_bar_finality_reports_when_the_bar_stopped_changing():
    boundary = tick.parse_tick_id("2026-09-28T14:40:00Z")
    t = [boundary - 100.0]

    class Fetcher:
        def bars_5m(self, symbols, *, range_="1d"):
            age = t[0] - boundary
            if age < 20:
                return {}, None
            close = 1.0 if age < 30 else 1.5 if age < 45 else 2.0
            return {s: bars(s, [close], boundary - 300) for s in symbols}, None

    res = tick.bar_finality(Fetcher(), lambda: t[0], lambda s: t.__setitem__(0, t[0] + s), symbols=("SPY",))
    assert res["measured"] and res["bar_start"] == "2026-09-28T14:35:00Z"
    assert res["symbols"]["SPY"] == {"first_seen_s": 30, "stable_from_s": 45, "final_close": 2.0, "final_volume": 1000,
                                     "provisional_s": [], "changed_after_s": [30], "next_row_s": None}
    assert res["unstable_at_tick"] == []
    assert res["changed_unflagged"] == ["SPY"]              # it changed after +30 s without the provisional flag


def chart_body(rows: list[tuple[int, float, int]]) -> dict:
    """A Yahoo v8 chart body from (ts, close, volume) rows; an off-grid ts is Yahoo's last-trade row."""
    c, v = [r[1] for r in rows], [r[2] for r in rows]
    return {"chart": {"result": [{"timestamp": [r[0] for r in rows],
                                  "indicators": {"quote": [{"open": c, "high": c, "low": c, "close": c, "volume": v}]}}]}}


def test_bar_finality_uses_the_fetchers_provisional_rule():
    """INT-3 (SPEC 12.1, 12.6): the probe's provisional column is fetch._parse_bars' own flag. A thin name's bar
    is provisional while it is the newest row and the last trade is still inside it; the first trade after its
    end is folded in (and changes it) and closes it. A last trade past the end is a closed row, not a fold. A
    bar that changes after an offset where it was not provisional is reported as a miss of the rule."""
    from radar import fetch
    boundary = tick.parse_tick_id("2026-09-28T14:40:00Z")
    start = boundary - 300
    t = [boundary - 100.0]

    def body(sym: str, age: float) -> dict:
        if sym == "SPY":                                     # liquid: row k+1 is open from the first sample
            return chart_body([(start, 2.0, 9000), (boundary, 2.01, 300), (boundary + int(age) - 1, 2.01, 0)])
        if sym == "THIN":
            if age < 180:                                    # no trade since start + 290: open, provisional
                return chart_body([(start, 1.0, 500), (start + 290, 1.0, 0)])
            if age < 240:                                    # a trade at boundary + 170 was folded in: closed
                return chart_body([(start, 1.2, 600), (boundary + 170, 1.2, 0)])
            return chart_body([(start, 1.2, 600), (boundary, 1.25, 100), (boundary + 230, 1.25, 0)])
        # MISS: the last trade is past the row's end (closed), yet the source revises the bar at +90 s
        return chart_body([(start, 3.0 if age < 90 else 3.1, 700), (boundary + 5, 3.0, 0)])

    class Fetcher:
        def bars_5m(self, symbols, *, range_="1d"):
            return {s: fetch._parse_bars(s, body(s, t[0] - boundary)) for s in symbols}, None

    assert fetch._parse_bars("THIN", body("THIN", 15)).provisional_last is True
    assert fetch._parse_bars("THIN", body("THIN", 180)).provisional_last is False   # the old rule called this a fold
    res = tick.bar_finality(Fetcher(), lambda: t[0], lambda s: t.__setitem__(0, t[0] + s),
                            symbols=("SPY", "THIN", "MISS"))
    early = [15, 30, 45, 60, 90, 120]
    assert res["symbols"]["THIN"] == {"first_seen_s": 15, "stable_from_s": 180, "final_close": 1.2, "final_volume": 600,
                                      "provisional_s": early, "changed_after_s": early, "next_row_s": 240}
    assert res["symbols"]["SPY"] == {"first_seen_s": 15, "stable_from_s": 15, "final_close": 2.0, "final_volume": 9000,
                                     "provisional_s": [], "changed_after_s": [], "next_row_s": 15}
    assert res["symbols"]["MISS"]["provisional_s"] == [] and res["symbols"]["MISS"]["changed_after_s"] == [15, 30, 45, 60]
    assert res["unstable_at_tick"] == ["MISS", "THIN"] and res["changed_unflagged"] == ["MISS"]
    assert max(res["offsets_s"]) == 300


def test_probe_samples_thin_names_from_the_stored_pack(tmp_path, monkeypatch):
    """DATA-4: the finality check covers the 10 thinnest eligible names, not only SPY/QQQ/AAPL."""
    data = tmp_path / "data"
    pack = pack_for(DAY, [f"T{i:02d}" for i in range(15)])
    for i, b in enumerate(pack.symbols.values()):
        b.medbar_usd = 1000.0 * (15 - i)                     # T14 is the thinnest
    pack.symbols["ILLQ"] = FakeSym(eligible=False, ineligible_reason="thin 5-minute bars", medbar_usd=1.0)
    pack.symbols["AAPL"] = FakeSym(medbar_usd=0.5)           # already sampled as a liquid reference
    seed(data, pack=pack)
    seen = {}

    def finality(fetcher, clock, sleep, symbols=()):
        seen["symbols"] = symbols
        return {"measured": True, "bar_start": "2026-09-28T14:35:00Z", "offsets_s": [15, 300],
                "unstable_at_tick": ["T14"], "changed_unflagged": ["T13"],
                "symbols": {s: {"first_seen_s": 15, "stable_from_s": 15, "final_close": 1.0, "final_volume": 5,
                                "provisional_s": [15] if s == "T14" else [],
                                "changed_after_s": [15] if s == "T13" else [], "next_row_s": None} for s in symbols}}

    monkeypatch.setattr(tick, "bar_finality", finality)
    summary = tmp_path / "summary.md"
    res = tick.probe(World().deps(), clock=lambda: NOW, sleep=lambda s: None, summary_path=str(summary), data_dir=data)
    thin = [f"T{i:02d}" for i in range(14, 4, -1)]
    assert seen["symbols"] == ("SPY", "QQQ", "AAPL", *thin) and res["finality"]["thin"] == thin
    text = summary.read_text(encoding="utf-8")
    assert f"Thin names: {', '.join(thin)} (stored pack of {DAY}" in text
    assert "| T14 | thin | 15 | 15 | 15 | none | None | 1.0 | 5 |" in text and "| SPY | liquid |" in text
    assert "| T13 | thin | 15 | 15 | none | 15 | None | 1.0 | 5 |" in text
    assert "Not stable by the tick: T14." in text and "Changed while not provisional: T13." in text
    assert "the last trade was still inside it" in text and "Fold seen" not in text


def test_probe_falls_back_to_a_fixed_thin_list(tmp_path, monkeypatch):
    seen = {}
    monkeypatch.setattr(tick, "bar_finality", lambda f, c, s, symbols=(): seen.update(symbols=symbols) or
                        {"measured": False, "note": "market closed"})
    res = tick.probe(World().deps(), clock=lambda: NOW, sleep=lambda s: None, data_dir=tmp_path / "missing")
    assert seen["symbols"] == ("SPY", "QQQ", "AAPL", *tick.PROBE_THIN_FALLBACK)
    assert res["finality"]["thin_source"] == "fixed thin list (no stored pack)"


# ---------------------------------------------------------------- CLI

def test_cli_prints_the_result_line(tmp_path, monkeypatch, capsys):
    world = World()
    monkeypatch.setattr(tick, "real_deps", world.deps)
    seed(tmp_path / "data")
    code = tick.main(["--data-dir", str(tmp_path / "data"), "--pending-dir", str(tmp_path / "p"),
                      "--tick-id", "2026-10-03T15:00:00Z"])
    last = capsys.readouterr().out.strip().splitlines()[-1]
    assert code == 0 and set(json.loads(last)) == RESULT_KEYS and json.loads(last)["status"] == "closed"


def test_cli_reports_a_bug_on_the_result_line(tmp_path, monkeypatch, capsys):
    def broken():
        raise RuntimeError("engine import failed")
    monkeypatch.setattr(tick, "real_deps", broken)
    code = tick.main(["--data-dir", str(tmp_path), "--pending-dir", str(tmp_path / "p"), "--tick-id", TICK])
    out = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert code == 1 and out == {"status": "error", "message": "tick failed: RuntimeError: engine import failed"}


@pytest.mark.parametrize("argv", [["--tick-id", TICK], ["--data-dir", "d", "--pending-dir", "p", "--tick-id", "2026-09-28 14:35"]])
def test_cli_rejects_bad_arguments(argv):
    with pytest.raises(SystemExit):
        tick.main(argv)


def test_cli_probe_writes_the_job_summary(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(tick, "real_deps", World().deps)
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(tmp_path / "summary.md"))
    monkeypatch.setattr(tick, "bar_finality", lambda *a, **k: {"measured": False, "note": "market closed"})
    assert tick.main(["--probe"]) == 0
    assert json.loads(capsys.readouterr().out.strip().splitlines()[-1])["message"] == "probe finished; nothing written"
    assert "Momentum Radar probe" in (tmp_path / "summary.md").read_text(encoding="utf-8")


def test_runtime_modules_import_with_the_standard_library_only():
    """The gate and the always() flush run before pip install; the loop imports the tick helpers."""
    code = ("import sys, radar.tick, radar.loop, radar.gitsync, radar.gate, radar.delta; "
            "print(sorted(m for m in ('numpy', 'pandas', 'curl_cffi', 'yfinance') if m in sys.modules))")
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True,
                         cwd=Path(__file__).resolve().parents[2]).stdout.strip()
    assert out == "[]"
