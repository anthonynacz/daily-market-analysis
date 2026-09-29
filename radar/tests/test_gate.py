from __future__ import annotations

from datetime import datetime, timezone

import pytest

from radar import gate


def at(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def run(value: str) -> str:
    return gate.gate(at(value))["run"]


@pytest.mark.parametrize("now, expected", [
    # EDT session (Mon 2026-09-28): warmup 09:10 EDT = 13:10Z, close 20:00Z, window end 20:05Z
    ("2026-09-28T11:09:59Z", "false"),     # more than 120 min before the warmup
    ("2026-09-28T11:10:00Z", "true"),      # exactly 120 min early
    ("2026-09-28T12:33:00Z", "true"),      # starter cron: 08:33 EDT
    ("2026-09-28T13:10:00Z", "true"),
    ("2026-09-28T20:04:59Z", "true"),
    ("2026-09-28T20:05:00Z", "false"),     # close + 5 min
    ("2026-09-29T00:37:00Z", "false"),     # 20:37 EDT Monday evening
    # EST session (Mon 2026-11-02, the day after DST ends): warmup 14:10Z, window end 21:05Z
    ("2026-11-02T12:09:00Z", "false"),
    ("2026-11-02T12:33:00Z", "true"),      # starter: 07:33 EST, 97 min early
    ("2026-11-02T20:37:00Z", "true"),
    ("2026-11-02T21:07:00Z", "false"),
    # DST starts Sun 2027-03-14: the Friday before is EST, the Monday after is EDT
    ("2027-03-12T12:09:00Z", "false"),
    ("2027-03-15T12:09:00Z", "true"),
    # half days close 13:00 ET
    ("2026-11-27T17:37:00Z", "true"),      # 12:37 EST
    ("2026-11-27T18:05:00Z", "false"),     # 13:05 EST
    ("2028-07-03T16:37:00Z", "true"),      # 12:37 EDT
    ("2028-07-03T17:07:00Z", "false"),     # 13:07 EDT
    # holidays and weekends
    ("2026-11-26T15:07:00Z", "false"),     # Thanksgiving
    ("2027-12-24T15:07:00Z", "false"),     # Christmas observed
    ("2027-06-18T15:07:00Z", "false"),     # Juneteenth observed
    ("2026-09-26T15:07:00Z", "false"),     # Saturday
    ("2027-12-31T15:07:00Z", "true"),      # New Year's Day 2028 falls on a Saturday: open
])
def test_gate_windows(now, expected):
    assert run(now) == expected


def test_outputs_and_reasons():
    early = gate.gate(at("2026-09-28T12:33:00Z"))
    assert early == {"run": "true", "reason": "early start; the loop sleeps until the warmup", "session_date": "2026-09-28",
                     "window_start": "2026-09-28T13:10:00Z", "window_end": "2026-09-28T20:05:00Z"}
    assert gate.gate(at("2026-09-28T14:00:00Z"))["reason"] == "inside the scan window"
    assert gate.gate(at("2026-09-28T21:00:00Z"))["reason"] == "today's scan window has ended"
    holiday = gate.gate(at("2026-11-26T15:07:00Z"))
    assert holiday["reason"].startswith("no NYSE session") and holiday["window_start"] == ""
    half = gate.gate(at("2026-11-27T12:33:00Z"))
    assert half["window_end"] == "2026-11-27T18:05:00Z"


def test_the_session_date_is_the_new_york_date():
    assert gate.gate(at("2026-09-29T00:37:00Z"))["session_date"] == "2026-09-28"


def test_ignore_calendar_always_runs():
    res = gate.gate(at("2026-09-26T15:07:00Z"), ignore_calendar=True)
    assert res["run"] == "true" and res["reason"] == "manual run: calendar ignored"


def test_cli_appends_to_github_output(tmp_path, monkeypatch, capsys):
    out = tmp_path / "github_output"
    out.write_text("earlier=1\n", encoding="utf-8")
    monkeypatch.setenv("GITHUB_OUTPUT", str(out))
    assert gate.main(["--now", "2026-09-28T12:33:00Z"]) == 0
    lines = out.read_text(encoding="utf-8").splitlines()
    assert lines[0] == "earlier=1" and "run=true" in lines and "window_end=2026-09-28T20:05:00Z" in lines
    assert "run=true" in capsys.readouterr().out
    with pytest.raises(SystemExit):
        gate.main(["--now", "2026-09-28T12:33:00"])          # a clock without offset is ambiguous
