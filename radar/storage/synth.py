"""Synthetic rows in the SPEC section 6 shapes, volume profiles and a simulated scanner writer.

Used by the storage tests, the soak simulation and threshold calibration; never by production code.
"""
from __future__ import annotations

import json
import os
import random
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Iterator

from radar import calendar_nyse as cal
from radar.storage import gitops

UTC = timezone.utc
TICKERS = [
    "NVDA", "AMD", "TSLA", "AAPL", "MSFT", "META", "AMZN", "GOOGL", "SMCI", "PLTR", "COIN", "MSTR",
    "AVGO", "MU", "INTC", "NFLX", "CRWD", "SNOW", "SHOP", "UBER", "RIVN", "LCID", "SOFI", "HOOD",
    "ARM", "DELL", "ORCL", "CRM", "ADBE", "PYPL", "XOM", "CVX", "OXY", "LLY", "NVO", "MRNA",
]
POOL = TICKERS + [t + "X" for t in TICKERS] + [t + "Y" for t in TICKERS]   # 108 distinct names per slot
SIGNAL_KEYS = ("z3", "z6", "zday", "rvol3", "rvolc", "dvwap", "er6", "acc")


def iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def dumps(row: dict) -> str:
    return json.dumps(row, separators=(",", ":"), ensure_ascii=False)


def _signals(rng: random.Random) -> dict[str, float]:
    return {k: round(rng.uniform(-4, 6), 3) for k in SIGNAL_KEYS}


def member_tick_row(tick: datetime, ticker: str, rng: random.Random, *, session: str | None = None,
                    slot: int = 0, role: str = "member") -> dict:
    return {
        "v": 1, "tick": iso(tick), "session": session or tick.date().isoformat(), "slot": slot,
        "ticker": ticker, "role": role, "dir": rng.choice(["up", "down"]),
        "state": "heating" if role == "heating" else rng.choice(["racing", "racing", "cooling", "halted"]),
        "price": round(rng.uniform(5, 900), 4), "chg_day_pct": round(rng.uniform(-15, 15), 2),
        "chg_5m_pct": round(rng.uniform(-3, 3), 2),
        "move_since_entry_pct": None if role == "heating" else round(rng.uniform(-8, 8), 2),
        "vol_5m": rng.randint(10_000, 5_000_000), "intensity": round(rng.uniform(0, 100), 1),
        "signals": _signals(rng),
    }


def event_row(ts: datetime, ticker: str, etype: str, rng: random.Random, *, episode: int = 1, slot: int = 0) -> dict:
    enter = etype == "ENTER"
    return {
        "v": 1, "id": f"{ts:%Y%m%dT%H%MZ}-{ticker}-{etype}-{episode}", "ts": iso(ts),
        "session": ts.date().isoformat(), "slot": slot, "ticker": ticker, "type": etype,
        "dir": rng.choice(["up", "down"]), "price": round(rng.uniform(5, 900), 4),
        "intensity": round(rng.uniform(40, 100), 1), "reason": "ENTRY" if enter else "FADE",
        "detail": "+2.9 sigma vs market in 15 min, volume 3.4x normal for this time (synthetic)",
        "episode": episode, "held_min": None if enter else rng.randint(15, 300),
        "move_since_entry_pct": None if enter else round(rng.uniform(-6, 9), 2), "late": False,
        "signals": _signals(rng), "params_version": "radar-sm-1",
    }


def scan_row(tick: datetime, rng: random.Random, run_id: str = "gha-1-1", *,
             stage_commit_ms: int | None = None) -> dict:
    stage = stage_commit_ms // 2 if stage_commit_ms is not None else rng.randint(50, 400)
    commit = stage_commit_ms - stage if stage_commit_ms is not None else rng.randint(50, 400)
    return {
        "v": 1, "tick": iso(tick), "run_id": run_id, "written_at": iso(tick + timedelta(seconds=rng.randint(20, 90))),
        "session": tick.date().isoformat(), "phase": "regular", "status": "ok", "lag_s": rng.randint(20, 90),
        "universe": 542, "stage_b": rng.randint(20, 80), "quotes_ok": 542, "quotes_err": 0,
        "bars_ok": rng.randint(20, 80), "bars_err": 0, "members": rng.randint(0, 12), "heating": rng.randint(0, 20),
        "entered": rng.sample(TICKERS, rng.randint(0, 2)), "exited": rng.sample(TICKERS, rng.randint(0, 2)),
        "processed_slots": [rng.randint(0, 77)], "source": "yahoo",
        "ms": {"fetch_quotes": rng.randint(500, 3000), "fetch_movers": rng.randint(100, 900),
               "fetch_bars": rng.randint(500, 9000), "baselines": 0, "compute": rng.randint(50, 800),
               "write": rng.randint(5, 50), "total": rng.randint(2000, 15000)},
        "git_prev": {"stage": stage, "commit": commit, "push": rng.randint(400, 3000), "attempts": 1, "status": "ok"},
        "hot_bytes": {"member_ticks": rng.randint(1, 9_000_000), "events": rng.randint(1, 600_000),
                      "scan_log": rng.randint(1, 1_500_000), "state": rng.randint(5_000, 90_000)},
        "errors": [],
    }


def alert_row(ts: datetime, ticker: str, rng: random.Random) -> dict:
    return {"ts": iso(ts), "ticker": ticker, "move_pct": round(rng.uniform(-12, 12), 1), "action": "WATCH",
            "trigger": "synthetic", "headline": "Synthetic headline for storage tests", "url": "https://example.com"}


def session_ticks(day: datetime, n_ticks: int) -> Iterator[datetime]:
    """Bar-close times 13:35Z onwards: n_ticks 5-minute slots of a weekday session (test helper)."""
    start = day.replace(hour=13, minute=35, second=0, microsecond=0, tzinfo=UTC)
    for i in range(n_ticks):
        yield start + timedelta(minutes=5 * i)


def gen_member_ticks(start_day: datetime, days: int, names: int, ticks_per_day: int, seed: int = 7) -> list[dict]:
    """`days` weekdays from start_day, `names` distinct tickers per tick."""
    rng = random.Random(seed)
    rows, d, produced = [], start_day, 0
    while produced < days:
        if d.weekday() < 5:
            for j, t in enumerate(session_ticks(d, ticks_per_day)):
                rows += [member_tick_row(t, tk, rng, slot=j, role="member" if i < 12 else "heating")
                         for i, tk in enumerate(rng.sample(POOL, names))]
            produced += 1
        d += timedelta(days=1)
    return rows


# ---------------------------------------------------------------- volume profiles (storage.md section 1.5)

@dataclass(frozen=True)
class Profile:
    name: str
    names_per_slot: int      # member + heating rows per processed slot
    events_per_day: int
    alerts_per_day: int


PROFILES = {
    "low": Profile("low", 5, 10, 2),
    "typical": Profile("typical", 18, 40, 10),
    "high": Profile("high", 72, 120, 35),
}


@dataclass
class DayRows:
    member_ticks: list[dict]
    events: list[dict]
    scan_log: list[dict]
    alerts: list[dict]       # chronological


def session_day_rows(session: cal.Session, profile: Profile, rng: random.Random, *, mt_scale: int = 1,
                     scan_scale: int = 1) -> DayRows:
    """One trading session of scanner rows plus the routine's alerts.

    member_ticks rows are divided by mt_scale and scan_log rows (one per tick) by scan_scale; a test that
    divides the table limits by the same factor keeps the real days-to-DEGRADED.
    """
    n = session.n_slots
    close_of = lambda j: datetime.fromtimestamp(session.slot_start(j) + 300, UTC)  # noqa: E731
    count = max(1, round(profile.names_per_slot * n / mt_scale))
    mt = [member_tick_row(close_of(i * n // count), POOL[i % len(POOL)], rng, session=session.day.isoformat(),
                          slot=i * n // count, role="member" if i % 3 else "heating") for i in range(count)]
    ev = []
    for k in range(profile.events_per_day):
        j = k * n // profile.events_per_day
        ev.append(event_row(close_of(j), POOL[k % len(POOL)], "ENTER" if k % 2 == 0 else "EXIT", rng,
                            episode=1 + k // len(POOL), slot=j))
    run_id = f"gha-{session.day:%Y%m%d}-1"
    sc = [scan_row(close_of(j), rng, run_id) for j in range(0, n, scan_scale)]
    al = []
    for k in range(profile.alerts_per_day):
        ts = session.open + timedelta(minutes=15 + k * (n * 5 - 30) // max(1, profile.alerts_per_day))
        al.append(alert_row(ts, TICKERS[k % len(TICKERS)], rng))
    return DayRows(mt, ev, sc, al)


def trading_days(start: date, days: int) -> Iterator[tuple[date, cal.Session | None]]:
    for i in range(days):
        d = start + timedelta(days=i)
        yield d, cal.session_for(d)


# ---------------------------------------------------------------- simulated scanner writer (SPEC section 7)

def append_jsonl(root: str, rel: str, rows: list[dict]) -> None:
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "ab") as f:
        f.write("".join(dumps(r) + "\n" for r in rows).encode("utf-8"))


def scanner_write(repo: str, apply_fn: Callable[[str, int], str], *, attempts: int = gitops.MAX_ATTEMPTS,
                  sleep: Callable[[float], None] = time.sleep, rng: random.Random | None = None) -> dict:
    """Stand-in for the scanner's writer: apply_fn(repo, attempt) re-applies the change on the synced head
    and returns the commit message. Never forces; redoes everything on rejection."""
    rng = rng or random.Random(0)
    last: dict = {}
    for attempt in range(1, attempts + 1):
        base = gitops.sync(repo)
        last = {**gitops.publish(repo, base, apply_fn(repo, attempt), squash=False), "attempts": attempt}
        if last["status"] in ("pushed", "noop"):
            return last
        sleep(gitops.backoff_s(attempt, rng))
    return {**last, "status": "failed"}
