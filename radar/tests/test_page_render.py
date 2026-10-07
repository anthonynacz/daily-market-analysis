"""radar.html rendered for real: the page's whole script runs in Node against a crafted state.json, and the
tests read the text it puts on the page (SPEC 12.5).

test_page_calendar.py checks the plain-English helpers on their own. These tests check what the render
functions do with them, so a render that bypasses or wraps a helper (a label in front of exit_detail, its own
'N stocks falling together' text, a prefix before the scanner's message) fails here.

The page runs as shipped with ?mock=1: a tiny DOM shim stands in for the browser and a stubbed fetch answers
only the mock URL with the crafted state, so nothing touches the network. The page pins its clock just after
the state's generated_at, so a state copied from the mock is a live scan. Without Node the tests are skipped."""
from __future__ import annotations

import copy
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from radar.engine import EXIT_TEXT

ROOT = Path(__file__).resolve().parents[2]
HTML = (ROOT / "radar.html").read_text(encoding="utf-8")
MOCK = json.loads((ROOT / "radar" / "mock" / "state.json").read_text(encoding="utf-8"))
SCRIPT = re.search(r"<script>\n(.*?)</script>", HTML, re.S).group(1)
BODY = HTML[HTML.index("<body>"):HTML.index("<script>")]
NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="Node.js is not installed")

# The page's own labels for exit codes (its fallback when exit_detail is empty).
PAGE_EXIT_TEXT = dict(re.findall(r'(\w+): "([^"]+)"', re.search(r"var EXIT_TEXT = \{(.*?)\};", SCRIPT, re.S).group(1)))
# [id, tag, hidden] of every element of the page's markup that has an id.
IDS = [[i.group(1), tag, bool(re.search(r"(?<![\w-])hidden(?![\w-])", attrs))]
       for tag, attrs in re.findall(r"<(\w+)\b([^>]*)>", BODY) if (i := re.search(r'\bid="([^"]+)"', attrs))]
SECTOR_TAIL = ", but the radar lists at most 3 stocks per sector and direction."
HELD = "Stocks already on the radar are held, not dropped."
SAMPLE = {"z30": -1.1, "z15": 2.7, "rvol": 0.5, "side": "high", "vside": "below", "mins": 30, "gb": 72.0, "n": 3,
          "by": "NOVX"}

# Just enough of a browser for radar.html: elements with text, classes and children; no layout, no events.
SHIM = r"""
class Text { constructor(v) { this.textContent = String(v); this.parentNode = null; } }
class Elem {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.className = ""; this.hidden = false;
                     this.title = ""; this.style = {}; this.parentNode = null; }
  get textContent() { return this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this.children = v == null || v === "" ? [] : [new Text(v)]; }
  get classList() {
    const e = this, list = () => e.className.split(/\s+/).filter(Boolean);
    const set = (c, on) => { const l = list().filter((x) => x !== c); if (on) l.push(c); e.className = l.join(" "); };
    return { contains: (c) => list().includes(c), add: (c) => set(c, true), remove: (c) => set(c, false),
             toggle: (c, on) => { on = on === undefined ? !list().includes(c) : !!on; set(c, on); return on; } };
  }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener() {}
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
}
const byId = {}, fetched = [];
for (const [id, tag, hidden] of IDS) { const e = new Elem(tag); e.id = id; e.hidden = hidden; byId[id] = e; }
const globals = {
  window: globalThis, location: { search: SEARCH }, addEventListener() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { hidden: false, title: "", addEventListener() {}, querySelectorAll: () => [],
              getElementById: (id) => byId[id] || null, createElement: (t) => new Elem(t),
              createElementNS: (ns, t) => new Elem(t), createTextNode: (v) => new Text(v) },
  fetch: (url) => {
    fetched.push(url);
    if (url !== "radar/mock/state.json") return Promise.reject(new Error("no network in tests: " + url));
    return Promise.resolve({ ok: true, status: 200, headers: { get: () => null },
                             json: () => Promise.resolve(JSON.parse(JSON.stringify(STATE))) });
  },
};
for (const k in globals) {
  Object.defineProperty(globalThis, k, { value: globals[k], configurable: true, writable: true });
}
"""
# The stubbed fetch answers at once, so the page's first poll() and render() finish in microtasks, before
# this timer; the page's own timers would keep Node alive, hence the exit.
DUMP = r"""
const ser = (n) => n instanceof Text ? n.textContent
  : { tag: n.tagName, cls: n.className, hidden: n.hidden, kids: n.children.map(ser) };
setTimeout(() => {
  const dom = {}; for (const k in byId) dom[k] = ser(byId[k]);
  process.stdout.write(JSON.stringify({ fetched, dom }), () => process.exit(0));
}, 0);
"""


def render_page(state: dict) -> dict:
    """Run radar.html?mock=1 in Node with `state` as the mock file; returns {id: element tree} after the
    first render. An element is {tag, cls, hidden, kids}, a text node is its string."""
    head = f"const IDS = {json.dumps(IDS)}, STATE = {json.dumps(state)}, SEARCH = {json.dumps('?mock=1')};\n"
    res = subprocess.run([NODE, "-"], input=head + SHIM + SCRIPT + DUMP, capture_output=True, text=True,
                         encoding="utf-8", timeout=60)
    assert res.returncode == 0, res.stderr
    out = json.loads(res.stdout)
    assert out["fetched"] == ["radar/mock/state.json"]
    dom = out["dom"]
    assert dom["status"]["kids"], "the page did not render"
    assert not text(dom["banner"]).startswith("Couldn't"), text(dom["banner"])   # the state loaded
    return dom


def text(n) -> str:
    return n if isinstance(n, str) else "".join(text(k) for k in n["kids"])


def find(n, *, tag: str | None = None, cls: str | None = None) -> list[dict]:
    """Descendant elements of `n` (document order) with that tag and/or class."""
    out = []
    for k in [] if isinstance(n, str) else n["kids"]:
        if not isinstance(k, str) and (tag is None or k["tag"] == tag) and (cls is None or cls in k["cls"].split()):
            out.append(k)
        out += find(k, tag=tag, cls=cls)
    return out


def live_state(**over) -> dict:
    """The shipped mock (a live scan) with some top-level fields replaced."""
    st = copy.deepcopy(MOCK)
    st.update(copy.deepcopy(over))
    return st


def exit_row(i: int, code: str, detail: str) -> dict:
    return {"ticker": f"X{i:02d}", "name": f"Sample {i}", "direction": "down" if i % 2 else "up",
            "entered_at": "2026-09-28T14:00:00Z", "exited_at": f"2026-09-28T15:{i:02d}:00Z", "minutes_on_radar": 30,
            "move_since_entry_pct": 1.5, "exit_reason": code, "exit_detail": detail}


def exit_rows(dom: dict) -> dict[str, tuple[str, str]]:
    """{ticker: (why line, whole row)} of the 'Recently dropped off' list."""
    rows = [k for k in dom["exits"]["kids"] if "x" in k["cls"].split()]
    out = {text(find(r, tag="b")[0]): (text(find(r, cls="why")[0]), text(r)) for r in rows}
    assert len(out) == len(rows)
    return out


# ---------------------------------------------------------------- exit rows (E2E-3)
def test_exit_rows_show_the_engine_detail_alone():
    """Every engine detail is shown once, as is: no page label in front of it or anywhere else in the row."""
    assert set(PAGE_EXIT_TEXT) == set(EXIT_TEXT)
    exits = [exit_row(i, code, fmt.format(**SAMPLE)) for i, (code, fmt) in enumerate(sorted(EXIT_TEXT.items()))]
    dom = render_page(live_state(recent_exits=exits))
    rows = exit_rows(dom)
    assert set(rows) == {x["ticker"] for x in exits}
    assert text(dom["exitcount"]) == str(len(exits))
    for x in exits:
        why, whole = rows[x["ticker"]]
        assert why == x["exit_detail"]                    # not "Momentum faded: Momentum faded: ..."
        rest = whole.replace(x["exit_detail"], "", 1)
        assert not [label for label in PAGE_EXIT_TEXT.values() if label in rest], whole


def test_exit_rows_without_a_detail_show_the_page_label():
    codes = sorted(EXIT_TEXT) + ["NEW_CODE"]
    rows = exit_rows(render_page(live_state(recent_exits=[exit_row(i, c, "") for i, c in enumerate(codes)])))
    for i, code in enumerate(codes):
        assert rows[f"X{i:02d}"][0] == PAGE_EXIT_TEXT.get(code, "Dropped off")


# ---------------------------------------------------------------- market and sector banners (E2E-2)
def test_sector_banners_say_how_many_names_are_held_back():
    banners = [{"sector": "Industrials", "direction": "down", "count": 1, "tickers": ["XYL"]},
               {"sector": "Financial Services", "direction": "up", "count": 3, "tickers": ["HBNK", "MRGN", "TRST"]},
               {"sector": "Energy", "direction": "down", "count": None, "tickers": ["AAA", "BBB"]},
               {"sector": "Utilities", "direction": "up", "count": 0, "tickers": []}]
    dom = render_page(live_state(market={**MOCK["market"], "mode": "normal"}, sector_banners=banners))
    shown = dom["context"]["kids"]
    assert [text(b) for b in shown] == [
        "▼ Industrials: +1 more held back (XYL). It is also falling" + SECTOR_TAIL,
        "▲ Financial Services: +3 more held back (HBNK, MRGN, TRST). They are also rising" + SECTOR_TAIL,
        "▼ Energy: +2 more held back (AAA, BBB). They are also falling" + SECTOR_TAIL]   # Utilities: none held back
    assert all(b["cls"] == "banner sector" for b in shown)
    assert [text(t) for b in shown for t in find(b, cls="tks")] == ["(XYL)", "(HBNK, MRGN, TRST)", "(AAA, BBB)"]


def test_market_wide_banner_comes_before_the_sector_banners():
    dom = render_page(MOCK)                               # market mode, falling; one sector banner
    shown = dom["context"]["kids"]
    assert [b["cls"] for b in shown] == ["banner mkt", "banner sector"]
    assert text(shown[0]).startswith(
        "🌐 Market-wide move: the whole market is falling (SPY −1.9% today, breadth 66% over 30 min). ")
    assert text(shown[1]) == "▼ Financial Services: +3 more held back (HBNK, MRGN, TRST). They are also falling" + \
        SECTOR_TAIL


def test_banners_describe_the_live_session_only():
    dom = render_page(live_state(status="closed"))
    assert dom["context"]["kids"] == []
    assert exit_rows(dom)                                 # the last session's exits are still listed


# ---------------------------------------------------------------- status banner (E2E-3)
@pytest.mark.parametrize("status, message", [
    ("degraded", f"Using the backup data source (Nasdaq). {HELD}"),
    ("no_data", f"No fresh market data in this scan. {HELD}"),
    ("error", f"The last scan timed out. {HELD}")], ids=["degraded", "no_data", "error"])
def test_status_banner_shows_the_scanner_message_alone(status, message):
    banner = render_page(live_state(status=status, message=message))["banner"]
    assert not banner["hidden"] and banner["cls"] == "banner warn"
    assert text(banner) == message


@pytest.mark.parametrize("status", ["degraded", "no_data", "error"])
def test_status_banner_without_a_message_says_held_once(status):
    banner = render_page(live_state(status=status, message=""))["banner"]
    shown = text(banner)
    assert not banner["hidden"] and shown.startswith("The last scan")
    assert shown.count("held, not dropped") == 1 and "incomplete" not in shown


def test_a_clean_scan_has_no_status_banner():
    banner = render_page(MOCK)["banner"]
    assert banner["hidden"] and text(banner) == ""


# ---------------------------------------------------------------- health panel (E2E-4)
@pytest.mark.parametrize("health, shown", [
    ({}, "2 earlier scans"), ({"published_late": 1}, "1 earlier scan"), ({"published_late": 0}, "none"),
    ({"published_late": None, "push_backlog": 4}, "–")], ids=["mock", "one", "zero", "old_state"])
def test_health_panel_shows_published_late(health, shown):
    dom = render_page(live_state(health={**MOCK["health"], **health}))
    rows = [text(r) for r in dom["health"]["kids"]]
    assert f"Published late: {shown}" in rows
    assert not [r for r in rows if "Waiting to publish" in r]


# ---------------------------------------------------------------- the shipped sample
def test_shipped_mock_renders_through_the_helpers():
    dom = render_page(MOCK)
    assert text(dom["mockpill"]) == "SAMPLE DATA" and not dom["mockpill"]["hidden"]
    assert text(dom["count"]) == str(len(MOCK["members"])) == str(len(find(dom["members"], cls="m")))
    rows = exit_rows(dom)
    assert {t: why for t, (why, _) in rows.items()} == {x["ticker"]: x["exit_detail"] for x in MOCK["recent_exits"]}
