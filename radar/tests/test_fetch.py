"""radar.fetch: parsing of saved live responses, retry/backoff, degraded mode, circuit breaker, health.

Fixtures in radar/tests/fixtures/ are trimmed live responses captured on 2026-09-27 (Friday 2026-09-25 data).
"""
from __future__ import annotations

import copy
import json
import random
import threading
from datetime import date
from pathlib import Path

import numpy as np
import pytest

from radar import fetch
from radar.calendar_nyse import session_for
from radar.config import PARAMS
from radar.fetch import Fetcher, from_nasdaq, to_nasdaq
from radar.universe import dynamic_candidates, scan_symbols

FIXTURES = Path(__file__).parent / "fixtures"
FRIDAY = session_for(date(2026, 9, 25))


def fx(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class FakeTransport:
    """Answers from handlers `(key, params) -> (status, body)`; a handler may raise to simulate a network error."""

    def __init__(self, chart=None, quote=None, screen=None, nasdaq=None):
        self.handlers = {"chart": chart, "quote": quote, "screen": screen, "nasdaq": nasdaq}
        self.calls: list[tuple[str, object]] = []
        self._lock = threading.Lock()

    def _answer(self, kind, key, params):
        with self._lock:
            self.calls.append((kind, key))
        handler = self.handlers[kind]
        if handler is None:
            raise AssertionError(f"unexpected {kind} call for {key}")
        return handler(key, params)

    def count(self, kind: str) -> int:
        return sum(1 for k, _ in self.calls if k == kind)

    def yahoo_chart(self, symbol, params, timeout):
        return self._answer("chart", symbol, params)

    def yahoo_quote(self, params, timeout):
        return self._answer("quote", params["symbols"], params)

    def yahoo_screen(self, name, count, timeout):
        return self._answer("screen", name, {"count": count})

    def nasdaq(self, url, params, timeout):
        return self._answer("nasdaq", url, params)


def scripted(*replies):
    """Handler returning the scripted replies in order, then repeating the last one; exceptions are raised."""
    queue, lock = list(replies), threading.Lock()

    def handler(key, params):
        with lock:
            reply = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(reply, Exception):
            raise reply
        return reply
    return handler


def chart_ok(key, params):
    return 200, fx("yahoo_chart_aapl_1d.json")


def chart_fail(key, params):
    return 500, None


def quote_ok(key, params):
    rows = [{"symbol": s, "regularMarketPrice": 10.0, "quoteType": "EQUITY", "exchange": "NMS"}
            for s in params["symbols"].split(",")]
    return 200, {"quoteResponse": {"result": rows, "error": None}}


def watchlist_ok(url, params):
    rows = [{"symbol": to_nasdaq(sym_class.split("|")[0].upper()), "lastSalePrice": "$10.00",
             "percentageChange": "+1.00%", "volume": "1,000", "assetClass": sym_class.split("|")[1].upper()}
            for _, sym_class in params]
    return 200, {"data": rows}


def nasdaq_ok(url, params):
    if url == fetch.NASDAQ_WATCHLIST:
        return watchlist_ok(url, params)
    if url == fetch.NASDAQ_SCREENER:
        return 200, fx("nasdaq_screener.json")
    return 200, fx("nasdaq_chart_rs_aapl.json")


def make(transport, health=None, workers=16):
    sleeps: list[float] = []
    f = Fetcher(health=health, workers=workers, transport=transport, sleep=sleeps.append,
                clock=lambda: 1790343000.0, rng=random.Random(7))
    return f, sleeps


def open_health(**breaker):
    return {"schema": 1, "name": "nasdaq", "status": "degraded", "consecutive_failures": 3, "last_ok_at": None,
            "workers": 4, "breaker": {"open": True, "opened_at": "2026-09-25T15:00:00Z", "calls": 0,
                                      "good_probes": 0, **breaker}}


# ---------------------------------------------------------------------- Yahoo chart parsing
def test_bars_regular_session_from_saved_chart():
    b = fetch._parse_bars("AAPL", fx("yahoo_chart_aapl_1d.json"))
    assert len(b) == 79                      # 78 session bars + Yahoo's 16:00 volume-0 row (slot_of says None)
    assert b.ts[0] == FRIDAY.open_epoch and FRIDAY.slot_of(int(b.ts[-1])) is None
    assert b.ts.dtype == np.int64 and b.v.dtype == np.int64 and b.c.dtype == np.float64
    assert np.all(b.ts % 300 == 0) and np.all(np.diff(b.ts) > 0)
    assert b.v[0] == 1133666 and b.c[77] == pytest.approx(341.04, abs=1e-4)
    assert b.last_trade_ts is None and b.last_trade_px is None


def test_bars_off_grid_last_trade_row_is_split_out():
    b = fetch._parse_bars("AAPL", fx("yahoo_chart_aapl_1d_prepost.json"))
    assert np.all(b.ts % 300 == 0)
    assert b.last_trade_ts == 1790380798 and b.last_trade_px == pytest.approx(341.4603)
    assert b.ts[-1] == 1790380500 and b.ts[0] == FRIDAY.pre_open.timestamp()


def test_bars_one_month_range_spans_sessions():
    b = fetch._parse_bars("AAPL", fx("yahoo_chart_aapl_1mo.json"))
    days = {int(t) // 86400 for t in b.ts}
    assert len(b) == 157 and len(days) == 2 and np.all(np.diff(b.ts) > 0)


def test_bars_nulls_duplicates_and_order_are_cleaned():
    body = fx("yahoo_chart_aapl_1d.json")
    res = body["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    q["close"][5] = None                        # dropped
    q["open"][6] = None                         # filled from close
    q["volume"][7] = None                       # 0 shares
    res["timestamp"][1], res["timestamp"][2] = res["timestamp"][2], res["timestamp"][1]
    res["timestamp"].append(res["timestamp"][10])   # duplicate slot: the later row wins
    for k in q:
        q[k].append(q[k][10] if k != "close" else 999.0)
    b = fetch._parse_bars("AAPL", body)
    assert len(b) == 78 and np.all(np.diff(b.ts) > 0)
    assert FRIDAY.slot_start(5) not in b.ts
    i6 = int(np.flatnonzero(b.ts == FRIDAY.slot_start(6))[0])
    assert b.o[i6] == b.c[i6]
    assert b.v[int(np.flatnonzero(b.ts == FRIDAY.slot_start(7))[0])] == 0
    assert b.c[int(np.flatnonzero(b.ts == FRIDAY.slot_start(10))[0])] == 999.0


def test_chart_error_or_empty_bodies():
    assert fetch._parse_bars("ZZZZ", fx("yahoo_chart_not_found.json")) is None
    body = fx("yahoo_chart_aapl_1d.json")
    del body["chart"]["result"][0]["timestamp"]
    empty = fetch._parse_bars("AAPL", body)
    assert empty is not None and len(empty) == 0


def test_malformed_body_fails_only_that_symbol():
    bad = fx("yahoo_chart_aapl_1d.json")
    bad["chart"]["result"][0]["indicators"]["quote"][0]["close"][3] = "n/a"
    t = FakeTransport(chart=lambda k, p: (200, bad) if k == "BAD" else chart_ok(k, p))
    f, _ = make(t)
    bars, report = f.bars_5m(["AAPL", "BAD", "MSFT", "NVDA", "AMD", "JPM"])
    assert set(bars) == {"AAPL", "MSFT", "NVDA", "AMD", "JPM"} and report.failed == ["BAD"]


def test_daily_bars_dated_in_new_york():
    d = fetch._parse_daily("AAPL", fx("yahoo_chart_aapl_daily_3mo.json"))
    assert d.day.dtype == np.dtype("datetime64[D]") and len(d.day) == 64
    assert d.day[-1] == np.datetime64("2026-09-25") and d.c[-1] == pytest.approx(341.07)
    assert np.all(np.diff(d.day.astype(np.int64)) > 0) and d.v.dtype == np.int64


def test_daily_live_row_after_utc_midnight_keeps_the_session_date():
    body = fx("yahoo_chart_aapl_daily_3mo.json")
    res = body["chart"]["result"][0]
    res["timestamp"].append(1790380799)          # 2026-09-25 19:59:59 ET = 2026-09-26 00:00 UTC (a live row)
    for k, v in res["indicators"]["quote"][0].items():
        v.append(342.0 if k == "close" else v[-1])
    d = fetch._parse_daily("AAPL", body)
    assert len(d.day) == 64 and d.day[-1] == np.datetime64("2026-09-25") and d.c[-1] == 342.0


# ---------------------------------------------------------------------- Yahoo quotes and movers
def test_quotes_parse_the_saved_v7_response():
    t = FakeTransport(quote=lambda k, p: (200, fx("yahoo_quote.json")))
    f, _ = make(t)
    quotes, report = f.quotes(["AAPL", "MSFT", "BRK-B", "SPY", "NVDA", "ZZZZNOTREAL"])
    aapl = quotes["AAPL"]
    assert (aapl.price, aapl.prev_close, aapl.day_volume) == (341.07, 335.92, 30002507)
    assert aapl.change_pct == pytest.approx(1.533, abs=1e-3) and aapl.market_time == 1790366401
    assert (aapl.exchange, aapl.quote_type, aapl.name, aapl.market_state) == ("NMS", "EQUITY", "Apple Inc.", "CLOSED")
    assert aapl.sector == "Information Technology" and quotes["BRK-B"].sector == "Financials"
    assert quotes["SPY"].quote_type == "ETF" and quotes["SPY"].sector is None
    assert quotes["AAPL"].market_cap > 4e12 and quotes["AAPL"].avg_volume_3m > 0
    assert report.failed == ["ZZZZNOTREAL"] and (report.ok, report.status, report.source) == (5, "ok", "yahoo")
    assert "sector" in fetch.QUOTE_FIELDS.split(",")


def test_quotes_batch_at_most_250_symbols():
    t = FakeTransport(quote=quote_ok)
    f, _ = make(t)
    symbols = [f"S{i:03d}" for i in range(600)]
    quotes, report = f.quotes(symbols + symbols[:10])       # duplicates are fetched once
    assert [len(k.split(",")) for _, k in t.calls] == [250, 250, 100]
    assert len(quotes) == 600 and report.status == "ok" and report.requested == 600


def test_movers_keep_us_exchanges_and_dedupe():
    screens = fx("yahoo_screens.json")
    t = FakeTransport(screen=lambda name, p: (200, screens[name]))
    f, _ = make(t)
    movers, report = f.movers()
    symbols = [q.symbol for q in movers]
    assert "SCGLY" not in symbols                           # OTC (OID) row dropped
    assert symbols.count("AAL") == 1 and symbols.count("CRWD") == 1
    assert len(symbols) == 11 and report.status == "ok" and report.requested == 3
    assert all(q.exchange in fetch.US_EXCHANGES for q in movers)
    assert [n for _, n in t.calls] == list(fetch.MOVER_SCREENS)


def test_real_movers_feed_dynamic_candidates():
    screens = fx("yahoo_screens.json")
    f, _ = make(FakeTransport(screen=lambda name, p: (200, screens[name])))
    movers, _ = f.movers()
    picked = [q.symbol for q in dynamic_candidates(movers, set(scan_symbols()), PARAMS)]
    # BKNG, CRWD, CRWV, INTC, NVDA and SPCX are universe names; SCGLY trades OTC; CRWD also moved < 3%.
    assert picked == ["PPLI", "ALM", "ZS", "TWLO", "AAL"]


# ---------------------------------------------------------------------- Nasdaq parsing
def test_symbol_mapping_both_ways():
    assert to_nasdaq("BRK-B") == "BRK.B" and to_nasdaq("BRK-B", "/") == "BRK/B" and to_nasdaq("AAPL") == "AAPL"
    assert from_nasdaq("BRK.B") == "BRK-B" and from_nasdaq("BRK/B") == "BRK-B" and from_nasdaq(" bf/b ") == "BF-B"
    assert from_nasdaq(to_nasdaq("BF-B")) == "BF-B"


def test_nasdaq_numbers():
    assert fetch._nq_float("$1,234.50") == 1234.5 and fetch._nq_float("+1.53%") == 1.53
    assert fetch._nq_float("-0.412%") == -0.412 and fetch._nq_float(767.18) == 767.18
    assert fetch._nq_float("N/A") is None and fetch._nq_float("") is None and fetch._nq_float("nan") is None
    assert fetch._nq_int("30,002,768") == 30002768


def test_nasdaq_chart_resamples_to_yahoo_like_5m_bars():
    body = fx("nasdaq_chart_rs_aapl.json")
    b = fetch._parse_nasdaq_bars("AAPL", body, include_prepost=False)
    assert b.ts[0] == FRIDAY.open_epoch and np.all(b.ts % 300 == 0)
    assert all(FRIDAY.slot_of(int(t)) is not None for t in b.ts)
    # bucket 0 by hand: points 09:30..09:34 ET (pseudo-UTC x = wall clock)
    pts = [p for p in body["data"]["chart"] if 1790328600000 <= p["x"] < 1790328900000]
    assert (b.o[0], b.c[0]) == (pts[0]["y"], pts[-1]["y"])
    assert (b.h[0], b.l[0]) == (max(p["y"] for p in pts), min(p["y"] for p in pts))
    assert b.v[0] == round(sum(p["w"] for p in pts))
    # cross-check against Yahoo's own 5m bars for the same Friday: closes match, volume within 1%
    y = fetch._parse_bars("AAPL", fx("yahoo_chart_aapl_1d.json"))
    for j in range(1, 7):
        yi, ni = np.flatnonzero(y.ts == FRIDAY.slot_start(j))[0], np.flatnonzero(b.ts == FRIDAY.slot_start(j))[0]
        assert b.c[ni] == pytest.approx(y.c[yi], abs=0.03)
        assert b.v[ni] == pytest.approx(y.v[yi], rel=0.01)


def test_nasdaq_chart_with_prepost_and_bad_bodies():
    b = fetch._parse_nasdaq_bars("AAPL", fx("nasdaq_chart_rs_aapl.json"), include_prepost=True)
    assert b.ts[0] == int(FRIDAY.pre_open.timestamp()) and b.ts[-1] > FRIDAY.close_epoch
    assert fetch._parse_nasdaq_bars("SPY", fx("nasdaq_chart_bad_asset.json"), False) is None
    empty = fetch._parse_nasdaq_bars("AAPL", {"data": {"chart": []}}, False)
    assert empty is not None and len(empty) == 0


def test_nasdaq_screener_movers_mirror_yahoo_thresholds():
    movers = fetch._nasdaq_movers(fetch._screener_rows(fx("nasdaq_screener.json")))
    symbols = [q.symbol for q in movers]
    assert symbols[:4] == ["ADPT", "A", "GME", "ALMR"]         # gainers > 3%, cap >= $2B, price >= $5
    assert {"ACAD", "ACN"} <= set(symbols) and {"AAL", "SPCX", "AAPL"} <= set(symbols)
    assert "ABR^D" not in symbols and "BRK-B" not in symbols and len(symbols) == len(set(symbols))
    gme = movers[symbols.index("GME")]
    assert gme.prev_close == pytest.approx(24.2) and gme.market_cap == pytest.approx(12622614770.0)
    assert gme.exchange is None and gme.sector == "Consumer Discretionary"
    assert dynamic_candidates(movers, set(), PARAMS) == []    # no exchange: never a dynamic add


# ---------------------------------------------------------------------- retry and backoff
def test_retry_429_then_ok_backs_off_with_jitter():
    t = FakeTransport(chart=scripted((429, None), (429, None), (200, fx("yahoo_chart_aapl_1d.json"))))
    f, sleeps = make(t)
    bars, report = f.bars_5m(["AAPL"])
    assert "AAPL" in bars and t.count("chart") == 3
    assert 1.0 <= sleeps[0] <= 1.5 and 2.0 <= sleeps[1] <= 2.5
    assert report.http_429 == 2 and report.status == "degraded"    # any 429 degrades the call


def test_retry_5xx_and_network_errors():
    t = FakeTransport(chart=scripted((503, None), ConnectionError("reset"), (200, fx("yahoo_chart_aapl_1d.json"))))
    f, sleeps = make(t)
    bars, report = f.bars_5m(["AAPL"])
    assert "AAPL" in bars and t.count("chart") == 3 and len(sleeps) == 2 and report.status == "ok"


def test_other_4xx_is_not_retried():
    t = FakeTransport(chart=lambda k, p: (404, fx("yahoo_chart_not_found.json")))
    f, sleeps = make(t)
    bars, report = f.bars_5m(["ZZZZ"])
    assert bars == {} and t.count("chart") == 1 and sleeps == []
    assert report.failed == ["ZZZZ"] and report.status == "down"


def test_gives_up_after_three_tries():
    t = FakeTransport(chart=chart_fail)
    f, sleeps = make(t)
    _, report = f.bars_5m(["AAPL"])
    assert t.count("chart") == 3 and len(sleeps) == 2 and report.status == "down"


# ---------------------------------------------------------------------- degraded mode
def test_degraded_calls_halve_workers_and_ok_calls_restore_them():
    symbols = [f"S{i}" for i in range(10)]
    failing = {"S0", "S1", "S2"}                                # 30% > 20%: degraded
    t = FakeTransport(chart=lambda k, p: (404, None) if k in failing else chart_ok(k, p))
    f, _ = make(t, workers=16)
    workers = []
    for _ in range(2):
        _, report = f.bars_5m(symbols)
        assert report.status == "degraded" and report.ok == 7
        workers.append(f.health_state()["workers"])
    failing.clear()
    for _ in range(2):
        f.bars_5m(symbols)
        workers.append(f.health_state()["workers"])
    assert workers == [8, 4, 8, 16]


def test_small_failure_share_stays_ok():
    t = FakeTransport(chart=lambda k, p: (404, None) if k == "S0" else chart_ok(k, p))
    f, _ = make(t)
    _, report = f.bars_5m([f"S{i}" for i in range(10)])
    assert report.status == "ok" and report.failed == ["S0"]


# ---------------------------------------------------------------------- circuit breaker
def test_breaker_opens_after_three_degraded_calls_and_serves_nasdaq():
    t = FakeTransport(quote=lambda k, p: (503, None), nasdaq=nasdaq_ok)
    f, _ = make(t)
    sources = []
    for _ in range(3):
        quotes, report = f.quotes(["AAPL", "SPY", "BRK-B"])
        sources.append(report.source)
    assert sources == ["yahoo", "yahoo", "nasdaq"]              # the tripping call is already served by Nasdaq
    assert set(quotes) == {"AAPL", "SPY", "BRK-B"} and report.status == "degraded"
    assert quotes["SPY"].quote_type == "ETF" and quotes["BRK-B"].price == 10.0
    h = f.health_state()
    assert h["breaker"]["open"] and h["name"] == "nasdaq" and h["consecutive_failures"] == 3
    assert [url for kind, url in t.calls if kind == "nasdaq"] == [fetch.NASDAQ_WATCHLIST]


def test_nasdaq_quotes_use_watchlist_batches_with_asset_classes():
    seen = []

    def nasdaq(url, params):
        seen.append(params)
        return watchlist_ok(url, params)
    f, _ = make(FakeTransport(nasdaq=nasdaq), health=open_health())
    symbols = ["SPY", "BRK-B"] + [f"S{i}" for i in range(43)]
    quotes, report = f.quotes(symbols)
    assert sorted(len(p) for p in seen) == [5, 20, 20] and len(quotes) == 45
    flat = {v for p in seen for _, v in p}
    assert "spy|etf" in flat and "brk/b|stocks" in flat          # the watchlist answers bf.b with an N/A row
    assert report.source == "nasdaq" and "nasdaq fallback" in report.notes


def test_nasdaq_watchlist_quotes_from_saved_response():
    f, _ = make(FakeTransport(nasdaq=lambda url, p: (200, fx("nasdaq_watchlist.json"))), health=open_health())
    quotes, report = f.quotes(["SPY", "QQQ", "IWM", "BRK-B", "BF-B", "ETN", "AAPL", "ZZZZ"])
    assert report.failed == ["ZZZZ"] and report.status == "degraded"
    assert quotes["BF-B"].price == 26.16 and quotes["BF-B"].change_pct == 0.62     # not the N/A "BF.B" row
    assert quotes["BRK-B"].prev_close == 505.18 and quotes["SPY"].quote_type == "ETF"
    assert quotes["ETN"].change_pct == pytest.approx(-0.0045, abs=1e-4)             # blank percent: computed
    aapl = quotes["AAPL"]
    assert (aapl.price, aapl.prev_close, aapl.change_pct, aapl.day_volume) == (341.07, 335.92, 1.53, 30002768)


def test_breaker_probes_every_third_call_and_closes_after_two_good_probes():
    t = FakeTransport(quote=quote_ok, nasdaq=nasdaq_ok)
    f, _ = make(t, health=open_health())
    sources = [f.quotes(["AAPL"])[1].source for _ in range(7)]
    assert sources == ["nasdaq", "nasdaq", "yahoo", "nasdaq", "nasdaq", "yahoo", "yahoo"]
    h = f.health_state()
    assert not h["breaker"]["open"] and h["name"] == "yahoo" and h["consecutive_failures"] == 0


def test_failed_probe_resets_good_probes_and_falls_back():
    t = FakeTransport(chart=chart_fail, nasdaq=nasdaq_ok)
    f, sleeps = make(t, health=open_health(good_probes=1, calls=2))
    bars, report = f.bars_5m(["AAPL", "MSFT"])
    assert t.count("chart") == 2 and sleeps == []              # a probe is one try per symbol
    assert report.source == "nasdaq" and set(bars) == {"AAPL", "MSFT"}
    assert report.notes == ["yahoo probe down: 0/2 ok", "nasdaq fallback"]
    h = f.health_state()
    assert h["breaker"]["open"] and h["breaker"]["good_probes"] == 0 and h["breaker"]["calls"] == 3


def test_baseline_ranges_and_daily_stay_on_yahoo_and_count_as_probes():
    t = FakeTransport(chart=lambda k, p: (200, fx("yahoo_chart_aapl_daily_3mo.json" if p["interval"] == "1d"
                                                  else "yahoo_chart_aapl_1mo.json")))
    f, _ = make(t, health=open_health())
    bars, report = f.bars_5m(["AAPL"], range_="1mo")
    assert report.source == "yahoo" and len(bars["AAPL"]) == 157
    assert f.health_state()["breaker"] == {"open": True, "opened_at": "2026-09-25T15:00:00Z", "calls": 0,
                                           "good_probes": 1}
    daily, report = f.daily(["AAPL"])
    assert report.source == "yahoo" and len(daily["AAPL"].day) == 64
    assert not f.health_state()["breaker"]["open"] and t.count("nasdaq") == 0


def test_nasdaq_bars_and_movers_while_open():
    t = FakeTransport(nasdaq=nasdaq_ok)
    f, _ = make(t, health=open_health())
    bars, report = f.bars_5m(["AAPL", "SPY"])
    assert report.source == "nasdaq" and bars["AAPL"].ts[0] == FRIDAY.open_epoch
    urls = {url for kind, url in t.calls if kind == "nasdaq"}
    assert urls == {fetch.NASDAQ_CHART.format("AAPL"), fetch.NASDAQ_CHART.format("SPY")}
    movers, report = f.movers()
    assert report.source == "nasdaq" and movers and all(q.exchange is None for q in movers)


# ---------------------------------------------------------------------- health state
def test_health_state_round_trip_and_defaults():
    t = FakeTransport(quote=lambda k, p: (503, None), nasdaq=nasdaq_ok)
    f, _ = make(t)
    for _ in range(4):
        f.quotes(["AAPL"])
    state = f.health_state()
    assert json.loads(json.dumps(state)) == state
    assert state["breaker"]["open"] and state["breaker"]["opened_at"] == "2026-09-25T13:30:00Z"
    restored, _ = make(FakeTransport(), health=copy.deepcopy(state))
    assert restored.health_state() == state
    default = {"schema": 1, "name": "yahoo", "status": "ok", "consecutive_failures": 0, "last_ok_at": None,
               "workers": 16, "breaker": {"open": False, "opened_at": None, "calls": 0, "good_probes": 0}}
    for junk in ({"workers": "x", "breaker": None, "status": "weird"},
                 {"breaker": ["open"], "last_ok_at": 5, "consecutive_failures": "3"},
                 {"breaker": {"open": "yes", "opened_at": 1, "calls": None}},
                 ["not", "a", "dict"]):
        fresh, _ = make(FakeTransport(), health=junk)
        assert fresh.health_state() == default, junk
    capped, _ = make(FakeTransport(), health={"workers": 64}, workers=8)
    assert capped.health_state()["workers"] == 8


def test_ok_call_records_last_ok_at():
    f, _ = make(FakeTransport(quote=quote_ok))
    f.quotes(["AAPL"])
    assert f.health_state()["last_ok_at"] == "2026-09-25T13:30:00Z"


def test_empty_requests_make_no_calls():
    t = FakeTransport()
    f, _ = make(t)
    for result, report in (f.quotes([]), f.bars_5m([]), f.daily([])):
        assert not result and report.status == "ok" and report.source == "none"
    assert t.calls == []


# ---------------------------------------------------------------------- HttpTransport glue (no network)
class FakeResponse:
    def __init__(self, status_code, body=None):
        self.status_code, self._body = status_code, body

    def json(self):
        return self._body


class FakeGetter:
    """Stands in for YfData() and for a curl_cffi session: `get` answers from a queue and records kwargs."""

    def __init__(self, *answers):
        self.answers, self.seen = list(answers), []

    def __call__(self):
        return self

    def get(self, url, params=None, timeout=None, headers=None):
        self.seen.append({"url": url, "params": params, "timeout": timeout, "headers": headers})
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


def test_http_transport_yahoo_glue(monkeypatch):
    screen = {"quotes": [{"symbol": "PPLI"}]}
    getter = FakeGetter(FakeResponse(200, {"finance": {"result": [screen]}}),
                        FakeResponse(200, {"finance": {"result": None, "error": "glitch"}}),
                        fetch.YFRateLimitError(),
                        FakeResponse(401, {"error": "Unauthorized"}),
                        FakeResponse(200, fx("yahoo_quote.json")))
    monkeypatch.setattr(fetch, "YfData", getter)
    t = fetch.HttpTransport()
    assert t.yahoo_screen("day_gainers", 250, 7.0) == (200, screen)
    assert getter.seen[0]["timeout"] == 7.0 and getter.seen[0]["params"]["scrIds"] == "day_gainers"
    assert t.yahoo_screen("day_gainers", 250, 7.0) == (fetch.NETWORK_ERROR, None)
    assert t.yahoo_quote({"symbols": "AAPL"}, 7.0) == (429, None)
    assert t.yahoo_quote({"symbols": "AAPL"}, 7.0) == (401, None)
    status, body = t.yahoo_quote({"symbols": "AAPL"}, 7.0)
    assert status == 200 and body["quoteResponse"]["result"][0]["symbol"] == "AAPL"


def test_http_transport_nasdaq_maps_rcode(monkeypatch):
    session = FakeGetter(FakeResponse(200, fx("nasdaq_chart_bad_asset.json")),
                         FakeResponse(200, fx("nasdaq_watchlist.json")),
                         FakeResponse(403))
    t = fetch.HttpTransport()
    monkeypatch.setattr(t, "_session", session)
    assert t.nasdaq(fetch.NASDAQ_CHART.format("SPY"), {"assetclass": "stocks"}, 5.0) == (400, None)
    assert t.nasdaq(fetch.NASDAQ_WATCHLIST, [("symbol", "spy|etf")], 5.0)[0] == 200
    assert t.nasdaq(fetch.NASDAQ_SCREENER, {}, 5.0) == (403, None)
    assert session.seen[0]["headers"]["Origin"] == "https://www.nasdaq.com"


# ---------------------------------------------------------------------- live smoke test
LIVE_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "BRK-B", "JPM", "V", "XOM", "UNH",
                "LLY", "AVGO", "COST", "BF-B", "AMD", "NFLX", "SPY", "QQQ"]


@pytest.mark.live      # skipped unless RADAR_LIVE=1 (radar/tests/conftest.py)
def test_live_quotes_and_bars_for_20_symbols():
    f = Fetcher()
    quotes, qr = f.quotes(LIVE_SYMBOLS)
    bars, br = f.bars_5m(LIVE_SYMBOLS)
    assert qr.source == "yahoo" and qr.ok >= 18 and br.ok >= 18
    assert quotes["BRK-B"].price and quotes["SPY"].quote_type == "ETF"
    for b in bars.values():
        assert np.all(b.ts % 300 == 0) and np.all(np.diff(b.ts) > 0) and len(b) > 0
    assert br.ms < 10_000 and qr.ms < 10_000
