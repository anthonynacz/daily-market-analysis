"""radar.html against the Python side: its embedded NYSE tables, the SPEC section 6 fields it reads, the
sample radar/mock/state.json behind ?mock=1, and the plain-English texts of SPEC 12.5.

The page has no build step, so these tests read radar.html as text. The page's pure helpers also run in
Node when it is installed (GitHub's Ubuntu runners have it); without Node those tests are skipped."""
from __future__ import annotations

import json
import re
import shutil
import string
import subprocess
from datetime import date, timedelta
from pathlib import Path

import pytest

from radar import calendar_nyse as cal
from radar.engine import EXIT_TEXT

ROOT = Path(__file__).resolve().parents[2]
HTML = (ROOT / "radar.html").read_text(encoding="utf-8")
MOCK = json.loads((ROOT / "radar" / "mock" / "state.json").read_text(encoding="utf-8"))
SCRIPT = re.search(r"<script>\n(.*?)</script>", HTML, re.S).group(1)
NODE = shutil.which("node")
needs_node = pytest.mark.skipif(NODE is None, reason="Node.js is not installed")
Z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

# radar/state.json fields, SPEC section 6 with 12.3 (health.push_backlog replaced by published_late).
SPEC6 = {
    "state": {"schema", "generated_at", "tick_id", "last_bar", "status", "message", "session", "next_tick_at",
              "params_version", "source", "market", "counts", "members", "heating", "recent_exits",
              "sector_banners", "health", "disclaimer"},
    "session": {"date", "phase", "open", "close", "half_day"},
    "source": {"name", "status", "consecutive_failures", "last_ok_at"},
    "market": {"mode", "dir", "spy_chg_day_pct", "spy_z30", "breadth30"},
    "counts": {"universe", "stage_b", "members", "heating", "entered_today", "exited_today"},
    "member": {"ticker", "name", "sector", "direction", "state", "late", "entered_at", "entry_price", "last_price",
               "last_bar_at", "minutes_on_radar", "move_since_entry_pct", "peak_since_entry_pct", "chg_5m_pct",
               "chg_15m_pct", "chg_30m_pct", "chg_day_pct", "rvol", "rvol_day", "vwap_dist_pct", "z15", "z30",
               "zday", "intensity", "reasons", "soft_fails", "episode", "spark"},
    "spark": {"t0", "step_s", "entry_i", "p"},
    "heating": {"ticker", "name", "direction", "since", "price", "chg_day_pct", "intensity", "reasons"},
    "exit": {"ticker", "name", "direction", "entered_at", "exited_at", "minutes_on_radar", "move_since_entry_pct",
             "exit_reason", "exit_detail"},
    "banner": {"sector", "direction", "count", "tickers"},
    "health": {"ticks_today", "ticks_skipped", "last_tick_ms", "loop_run_id", "loop_started_at", "published_late"},
}
# The page's field specs (var NAME = {num: [...], ts: [...], txt: {...}}) and the object each one reads.
PAGE_SPECS = {"TOP": "state", "SOURCE": "source", "MARKET": "market", "COUNTS": "counts", "HEALTH": "health",
              "MEMBER": "member", "HEAT": "heating", "EXIT": "exit"}


def js_decl(name: str) -> str:
    """One top-level declaration of the page script: `var NAME = ...;` or `function NAME(...) {...}`."""
    m = re.search(rf"\n  (?:var|function) {re.escape(name)}\b.*?(?=\n  [^\s}}\])])", SCRIPT, re.S)
    assert m, f"radar.html has no top-level {name}"
    return m.group(0)


def run_js(names: list[str], expr: str):
    """Evaluate `expr` in Node after the page's own declarations `names`; returns the JSON result."""
    code = "\n".join(js_decl(n) for n in names) + f"\nprocess.stdout.write(JSON.stringify({expr}));\n"
    res = subprocess.run([NODE, "-"], input=code, capture_output=True, text=True, encoding="utf-8", timeout=60)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


def page_fields(name: str) -> dict[str, str]:
    """{field: kind} of a page field spec, kind in num | ts | txt."""
    body, out = js_decl(name), {}
    for kind, items in re.findall(r"\b(num|ts): \[(.*?)\]", body, re.S):
        out.update({f: kind for f in re.findall(r'"(\w+)"', items)})
    for items in re.findall(r"\btxt: \{(.*?)\}", body, re.S):
        out.update({f: "txt" for f in re.findall(r"(\w+): \d+", items)})
    return out


def js_dates(name: str) -> list[date]:
    return [date.fromisoformat(d) for d in re.findall(r'"(\d{4}-\d{2}-\d{2})"', js_decl(name))]


def text_pattern(fmt: str) -> re.Pattern:
    """A str.format template as a regex: the literal text must match, each field is any text."""
    return re.compile("".join(re.escape(lit) + (".+?" if field is not None else "")
                              for lit, field, _, _ in string.Formatter().parse(fmt)))


# ---------------------------------------------------------------- calendar mirror
def test_page_calendar_tables_match_calendar_nyse():
    holidays, early = js_dates("HOLIDAYS"), js_dates("EARLY_CLOSES")
    assert len(holidays) == len(set(holidays)) and len(early) == len(set(early))
    # The page has no separate list of unscheduled closures: they belong in its HOLIDAYS.
    assert set(holidays) == set(cal.HOLIDAYS) | set(cal.EXTRA_CLOSURES)
    assert set(early) == set(cal.EARLY_CLOSES)


@needs_node
def test_page_sessions_match_calendar_nyse():
    days = [date(2026, 1, 1) + timedelta(n) for n in range((cal.COVERED_THROUGH - date(2026, 1, 1)).days + 1)]
    got = run_js(["HOLIDAYS", "EARLY_CLOSES", "ET", "fmtParts", "etParts", "etAt", "weekday", "sessionFor"],
                 json.dumps([d.isoformat() for d in days]) +
                 ".map(function (d) { var s = sessionFor(d); return s && [s.open / 1000, s.close / 1000, s.half]; })")
    for d, js in zip(days, got, strict=True):
        py = cal.session_for(d)
        assert js == (py and [py.open_epoch, py.close_epoch, py.early_close]), d


# ---------------------------------------------------------------- state.json fields and the mock
def test_page_reads_only_spec6_fields():
    for name, obj in PAGE_SPECS.items():
        fields = page_fields(name)
        assert fields, name
        assert set(fields) <= SPEC6[obj], f"{name} reads fields outside SPEC 6: {set(fields) - SPEC6[obj]}"


def test_mock_state_matches_spec6():
    m = MOCK
    assert set(m) == SPEC6["state"] and m["schema"] == 1
    for key in ("session", "source", "market", "counts", "health"):
        assert set(m[key]) == SPEC6[key], key
    assert m["status"] in ("ok", "degraded", "no_data", "closed", "error")
    assert m["source"]["status"] in ("ok", "degraded", "down") and m["market"]["mode"] in ("normal", "market")
    assert all(set(x) == SPEC6["member"] and set(x["spark"]) == SPEC6["spark"] for x in m["members"])
    assert all(x["state"] in ("racing", "cooling", "halted") for x in m["members"])
    assert all(set(x) == SPEC6["heating"] for x in m["heating"])
    assert all(set(x) == SPEC6["exit"] for x in m["recent_exits"])
    assert all(set(x) == SPEC6["banner"] for x in m["sector_banners"])
    assert all(x["direction"] in ("up", "down") for k in ("members", "heating", "recent_exits", "sector_banners")
               for x in m[k])
    assert m["counts"]["members"] == len(m["members"]) and m["counts"]["heating"] == len(m["heating"])
    # Every field the page reads has the type it expects.
    rows = {"state": [m], "source": [m["source"]], "market": [m["market"]], "counts": [m["counts"]],
            "health": [m["health"]], "member": m["members"], "heating": m["heating"], "exit": m["recent_exits"]}
    for name, obj in PAGE_SPECS.items():
        for row in rows[obj]:
            for f, kind in page_fields(name).items():
                v = row[f]
                ok = {"num": isinstance(v, (int, float)) and not isinstance(v, bool),
                      "ts": isinstance(v, str) and bool(Z.match(v)), "txt": isinstance(v, str)}[kind]
                assert ok, f"{obj}.{f} = {v!r} is not {kind}"


def test_mock_exit_details_are_engine_sentences():
    """E2E-3: the mock shows what the engine really writes, so the page check sees real details."""
    assert {x["exit_reason"] for x in MOCK["recent_exits"]} <= set(EXIT_TEXT)
    for x in MOCK["recent_exits"]:
        assert text_pattern(EXIT_TEXT[x["exit_reason"]]).fullmatch(x["exit_detail"]), x


def test_mock_sector_banners_list_only_held_back_names():
    """E2E-2: a banner never names a stock that is on the radar, and count is the number held back."""
    members = {x["ticker"] for x in MOCK["members"]}
    assert MOCK["sector_banners"]
    for b in MOCK["sector_banners"]:
        assert b["tickers"] and not set(b["tickers"]) & members
        assert b["count"] == len(b["tickers"])


# ---------------------------------------------------------------- SPEC 12.5 texts
def test_page_renders_through_the_spec_12_5_helpers():
    # Wiring only; test_page_render.py runs the render functions and checks the text they put on the page.
    assert "exitText(x)" in js_decl("renderExits")
    assert "scanProblem(st)" in js_decl("renderBanner")
    assert "heldBack(s)" in js_decl("renderContext")
    assert "publishedLate(h.published_late)" in js_decl("renderHealth")


@needs_node
def test_exit_rows_show_the_engine_detail_once():
    """E2E-3: exit_detail already starts with the reason; the page must not put its own label in front."""
    sample = {"z30": -1.1, "z15": 2.7, "rvol": 0.5, "side": "high", "vside": "below", "mins": 30, "gb": 72.0,
              "n": 3, "by": "NOVX"}
    rows = [{"exit_reason": code, "exit_detail": fmt.format(**sample)} for code, fmt in sorted(EXIT_TEXT.items())]
    labels, shown, bare = run_js(["EXIT_TEXT", "exitText"], "[EXIT_TEXT, " + json.dumps(rows) + ".map(exitText), " +
                                 json.dumps([{"exit_reason": r["exit_reason"], "exit_detail": ""} for r in rows] +
                                            [{"exit_reason": "NEW_CODE", "exit_detail": ""}]) + ".map(exitText)]")
    assert set(labels) == set(EXIT_TEXT)                  # a plain-English fallback for every engine code
    for row, text in zip(rows, shown, strict=True):
        assert text == row["exit_detail"]                 # not "Momentum faded: Momentum faded: ..."
    assert bare == [labels[r["exit_reason"]] for r in rows] + ["Dropped off"]


@needs_node
def test_status_banner_shows_the_scanner_message_as_is():
    """E2E-3: the scanner's message already says that members are held; no second copy, no wrong lead."""
    held = "Stocks already on the radar are held, not dropped."
    msgs = [f"Using the backup data source (Nasdaq). {held}", f"No fresh market data in this scan. {held}",
            f"The last scan timed out. {held}"]
    sts = [{"status": s, "message": m} for s, m in zip(("degraded", "no_data", "error"), msgs)]
    sts += [{"status": s, "message": ""} for s in ("degraded", "no_data", "error")]
    got = run_js(["SCAN_PROBLEM", "scanProblem"], json.dumps(sts) + ".map(scanProblem)")
    assert got[:3] == msgs
    for text in got[3:]:                                    # empty message: the page's own short text
        assert text.count("held, not dropped") == 1 and "incomplete" not in text
    assert len(set(got[3:])) == 3


@needs_node
def test_sector_banner_counts_held_back_names():
    """E2E-2: '+N more held back (tickers)', singular for one name; never 'N stocks falling together'."""
    got = run_js(["heldBack"], "[" + ", ".join(f"heldBack({json.dumps(s)})" for s in [
        {"count": 1, "tickers": ["XYL"], "direction": "down"},
        {"count": 3, "tickers": ["HBNK", "MRGN", "TRST"], "direction": "up"},
        {"count": None, "tickers": ["AAA", "BBB"], "direction": "down"},
        {"count": 0, "tickers": [], "direction": "up"}]) + "]")
    assert got[0] == {"head": "+1 more held back", "tickers": "(XYL)",
                      "tail": "It is also falling, but the radar lists at most 3 stocks per sector and direction."}
    assert got[1]["head"] == "+3 more held back" and got[1]["tickers"] == "(HBNK, MRGN, TRST)"
    assert got[1]["tail"].startswith("They are also rising")
    assert got[2]["head"] == "+2 more held back"
    assert got[3] is None


def test_health_panel_drops_waiting_to_publish():
    """E2E-4: a published state.json can never know about deltas still pending."""
    assert "Waiting to publish" not in HTML and "push_backlog" not in HTML
    assert page_fields("HEALTH")["published_late"] == "num"


@needs_node
def test_health_panel_labels_published_late_scans():
    got = run_js(["publishedLate"], "[null, 0, 1, 3].map(publishedLate)")
    assert got == ["–", "none", "1 earlier scan", "3 earlier scans"]
