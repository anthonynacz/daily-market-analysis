"""Session gate for the scanner workflow: system python3, stdlib only, runs before any pip install.

    python3 -m radar.gate [--ignore-calendar] [--now 2026-09-28T12:33:00Z]

Writes run, reason, window_start, window_end and session_date to $GITHUB_OUTPUT (and prints them).
The scan window is [warmup 09:10 ET, close + 5 min]. A run may start up to 120 minutes before the
window opens; the loop then sleeps until the warmup.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta

from . import calendar_nyse as cal
from .config import RUNTIME

PRESTART = timedelta(minutes=120)
CLOSE_GRACE = timedelta(minutes=5)


def iso(t: datetime) -> str:
    return t.astimezone(cal.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def scan_window(session: cal.Session) -> tuple[datetime, datetime]:
    warmup = datetime.combine(session.day, cal.parse_hhmm(RUNTIME["warmup_et"]), tzinfo=cal.ET).astimezone(cal.UTC)
    return warmup, session.close + CLOSE_GRACE


def gate(now: datetime, *, ignore_calendar: bool = False) -> dict[str, str]:
    today = now.astimezone(cal.ET).date()
    out = {"run": "false", "reason": "", "session_date": today.isoformat(), "window_start": "", "window_end": ""}
    if ignore_calendar:
        out.update(run="true", reason="manual run: calendar ignored")
        return out
    session = cal.session_for(today)
    if session is None:
        out["reason"] = "no NYSE session today (weekend or holiday)"
        return out
    start, end = scan_window(session)
    out.update(window_start=iso(start), window_end=iso(end))
    if now >= end:
        out["reason"] = "today's scan window has ended"
    elif now < start - PRESTART:
        out["reason"] = "too early; a later trigger starts the scanner"
    else:
        out.update(run="true", reason="inside the scan window" if now >= start
                   else "early start; the loop sleeps until the warmup")
    return out


def parse_utc(value: str) -> datetime:
    t = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if t.tzinfo is None:
        raise ValueError(f"time needs a UTC offset: {value!r}")
    return t.astimezone(cal.UTC)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Decide whether this scanner run should start.")
    ap.add_argument("--ignore-calendar", action="store_true")
    ap.add_argument("--now", type=parse_utc, help="override the clock (tests)")
    a = ap.parse_args(argv)
    res = gate(a.now or datetime.now(cal.UTC), ignore_calendar=a.ignore_calendar)
    lines = "".join(f"{k}={v}\n" for k, v in res.items())
    out_path = os.environ.get("GITHUB_OUTPUT")
    if out_path:
        with open(out_path, "a", encoding="utf-8") as f:
            f.write(lines)
    sys.stdout.write(lines)
    return 0


if __name__ == "__main__":
    sys.exit(main())
