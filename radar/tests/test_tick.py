"""radar.tick end to end with a fake fetcher, engine and baseline builder (radar/SPEC.md 4.8 and 6)."""
from __future__ import annotations

import dataclasses
import gzip
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

from radar import calendar_nyse as cal
from radar import delta, tick
from radar.config import PARAMS, PATHS
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
ENGINE_KEYS = {"schema", "session", "engine", "source_health", "dynamic_adds", "ops", "loop"}
RESULT_KEYS = {"status", "message", "members", "entered", "exited", "processed_slots", "source", "ms", "hot_bytes"}
STATUSES = {"ok", "degraded", "no_data", "closed", "error"}


# ---------------------------------------------------------------- fakes

@dataclass
class FakePack:
    asof: str
    params_version: str
    symbols: dict

    def to_json(self) -> dict:
        return {"asof": self.asof, "params_version": self.params_version, "symbols": self.symbols}

    @classmethod
    def from_json(cls, d: dict) -> FakePack:
        return cls(d["asof"], d["params_version"], dict(d["symbols"]))


def pack_for(day: str, symbols=SCAN) -> FakePack:
    return FakePack(day, PARAMS["params_version"], {s: {"name": s} for s in symbols})


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
    now: float = NOW                     # the fake fetcher's clock, for last_ok_at
    calls: list = field(default_factory=list)
    engines: list = field(default_factory=list)
    fetchers: list = field(default_factory=list)
    packs_built: list = field(default_factory=list)

    def deps(self) -> tick.Deps:
        world = self

        class Fetcher:
            """Keeps its health like fetch.Fetcher: the last call sets the status, failed calls count in a
            row, and the record round-trips through engine.json as `health`."""

            def __init__(self, *, health=None, workers=16, timeout_s=12.0):
                self.health = health
                self.h = {**HEALTHY, **(health or {})}
                world.fetchers.append(self)

            def _served(self, result, report: FetchReport):
                ok = report.status == "ok"
                self.h.update(name=report.source, status=report.status,
                              consecutive_failures=0 if ok else self.h["consecutive_failures"] + 1,
                              last_ok_at=tick.iso(world.now) if ok else self.h["last_ok_at"])
                return result, report

            def quotes(self, symbols):
                world.calls.append(("quotes", list(symbols)))
                if world.quotes_error:
                    raise world.quotes_error
                return self._served({s: Quote(s, price=10.0, prev_close=9.8, day_volume=10_000) for s in symbols},
                                    FetchReport(world.source, "ok", requested=len(symbols), ok=len(symbols)))

            def movers(self):
                world.calls.append(("movers",))
                return self._served(list(world.movers), FetchReport(world.source, "ok", requested=3, ok=3))

            def bars_5m(self, symbols, *, range_="1d", include_prepost=False):
                world.calls.append(("bars_5m", range_, list(symbols)))
                if range_ == "1mo" and not world.history or range_ == "1d" and world.no_bars:
                    return self._served({}, FetchReport(world.source, "down", requested=len(symbols), failed=list(symbols)))
                got = {s: bars(s, [10.0, 10.5], SESSION.slot_start(11)) for s in symbols}
                return self._served(got, FetchReport(world.source, world.bars_status, requested=len(symbols), ok=len(got)))

            def daily(self, symbols, *, range_="3mo"):
                world.calls.append(("daily", range_, list(symbols)))
                if not world.history:
                    return self._served({}, FetchReport(world.source, "down", requested=len(symbols), failed=list(symbols)))
                c = np.array([9.0, 9.8])
                return self._served({s: DailyBars(s, np.array(["2026-09-24", "2026-09-25"], dtype="datetime64[D]"),
                                                  c, c, c, c, np.array([1, 1])) for s in symbols},
                                    FetchReport(world.source, "ok", requested=len(symbols), ok=len(symbols)))

            def health_state(self):
                return dict(self.h)

        class Engine:
            def __init__(self, params, pack, session, state=None):
                self.pack, self.session = pack, session
                same = bool(state) and state.get("session") == session.day.isoformat()
                self.st = dict(state) if same else {"session": session.day.isoformat(), "last_slot": -1}
                world.engines.append(self)

            def stage_a(self, quotes, now_epoch):
                self.quotes = quotes
                return ["NVDA", "SPY"]

            def step(self, bars_, now_epoch, *, halted=frozenset()):
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
            return FakePack(session.day.isoformat(), params["params_version"], {s: {"name": s} for s in bars5})

        def extend_pack(pack, session, bars5, daily, meta, params):
            if world.extend_error:
                raise world.extend_error
            return dataclasses.replace(pack, symbols={**pack.symbols, **{s: {"name": meta[s]["name"]} for s in bars5}})

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
    world.now = now
    args = tick.TickArgs(data, pending, tick_id, **flags)
    res = tick.Tick(args, world.deps(), clock=lambda: now).run()
    new = [d for d in delta.list_pending(pending) if d not in before]
    assert len(new) == 1, "a tick writes exactly one delta"
    delta.apply_delta(new[0], data)
    return res, new[0]


def read(data: Path, key: str) -> dict:
    return json.loads((data / PATHS[key]).read_bytes())


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
                                    "push_backlog"}
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
        "ticks_skipped": 1, "last_tick": TICK, "push_backlog": 2,
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
                               "loop_run_id": "gha-99-1", "loop_started_at": "2026-09-28T12:33:20Z", "push_backlog": 2}

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
    prev = {"schema": 1, "session": {"date": DAY}, "members": [member()], "heating": [], "recent_exits": [EXIT],
            "counts": {"members": 1, "entered_today": 3}, "last_bar": "2026-09-28T14:30:00Z",
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


def test_a_pack_the_builder_rejects_means_no_data(tmp_path):
    world = World(build_error=ValueError("no SPY bars in the baseline window"))
    res, _ = run(tmp_path, world)
    assert res["status"] == "no_data" and world.engines == []
    assert jsonl(tmp_path / "data", "scan_log")[0]["errors"] == ["baselines: no SPY bars in the baseline window"]


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
    assert res["symbols"]["SPY"] == {"first_seen_s": 30, "stable_from_s": 45, "final_close": 2.0, "final_volume": 1000}


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
