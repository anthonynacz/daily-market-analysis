import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, July 3, 2026 (live-researched).
 * Window: last 3 days (Jun 30) → coming 2 weeks (Jul 17).
 *
 * Self-contained: only depends on React. Inline styles + raw SVG, no libs.
 * Drop <MarketMatrix /> anywhere and it renders.
 *
 * ⚠ Educational analysis, NOT financial advice. Option premiums are ESTIMATES
 *   derived from spot + implied vol; confirm live on your broker before trading.
 */

// ------------------------------------------------------------------ palette
const INDUSTRIES = {
  tech:     { label: "Technology / Semis", color: "#3b82f6" },
  energy:   { label: "Energy",             color: "#f59e0b" },
  health:   { label: "Healthcare / Pharma", color: "#10b981" },
  finance:  { label: "Financials",         color: "#a855f7" },
  consumer: { label: "Consumer / Retail",  color: "#ef4444" },
};

const DIR = {
  BULLISH: { glyph: "↑", label: "Bullish" },
  BEARISH: { glyph: "↓", label: "Bearish" },
  MIXED:   { glyph: "↔", label: "Mixed / uncertain" },
};

// 18-day axis: Jun 30 .. Jul 17 (last 3 days → coming 2 weeks). Today = index 3 (Jul 3).
const DAYS = [
  { idx: 0, date: "Jun 30", dow: "Tue" },
  { idx: 1, date: "Jul 1", dow: "Wed" },
  { idx: 2, date: "Jul 2", dow: "Thu" },
  { idx: 3, date: "Jul 3", dow: "Fri" }, // TODAY (market holiday — Independence Day observed)
  { idx: 4, date: "Jul 4", dow: "Sat" },
  { idx: 5, date: "Jul 5", dow: "Sun" },
  { idx: 6, date: "Jul 6", dow: "Mon" },
  { idx: 7, date: "Jul 7", dow: "Tue" },
  { idx: 8, date: "Jul 8", dow: "Wed" },
  { idx: 9, date: "Jul 9", dow: "Thu" },
  { idx: 10, date: "Jul 10", dow: "Fri" },
  { idx: 11, date: "Jul 11", dow: "Sat" },
  { idx: 12, date: "Jul 12", dow: "Sun" },
  { idx: 13, date: "Jul 13", dow: "Mon" },
  { idx: 14, date: "Jul 14", dow: "Tue" },
  { idx: 15, date: "Jul 15", dow: "Wed" },
  { idx: 16, date: "Jul 16", dow: "Thu" },
  { idx: 17, date: "Jul 17", dow: "Fri" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "AI chips add ~$2T market value in H1; SOX +47% YTD (AMD +150%)", tickers: "NVDA · AMD · AVGO",
    rec: "Ride the primary AI trend but trim outsized winners; add on pullbacks, don't chase after an 80%+ half." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Semis sell off on H1 profit-taking; MU −10%, NVDA slips from record", tickers: "MU · NVDA · AMD",
    rec: "Healthy digestion after a parabolic run — scale into quality (NVDA) on dips; don't buy the first red day whole." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Nasdaq closes best H1 since 2020, then wobbles as chips lead profit-taking", tickers: "QQQ · NVDA · AMD",
    rec: "Book some gains into strength; keep core AI exposure but raise a little cash into a data-heavy month." },
  { id: "t4", ind: "tech", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read continues — watch for a pause after the 80% H1 surge", tickers: "NVDA · MU · AMD",
    rec: "Let the tape settle; re-add on confirmation of hyperscaler capex, not on the first bounce." },
  { id: "t5", ind: "tech", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "June CPI (8:30 ET, Jul 14) — hot risk for high-multiple tech", tickers: "NVDA · MSFT · GOOGL",
    rec: "De-risk slightly pre-print; a cool number re-fuels the megacap bid, a hot one hits long-duration tech multiples." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "WTI slides to 4-month low (~$68) as Strait of Hormuz flows recover", tickers: "XOM · CVX · USO",
    rec: "Falling crude pressures E&P near-term; wait for a base rather than catching the knife on integrateds." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Iraq threatens OPEC exit over quota; UAE lifts exports past 3.9M bpd", tickers: "XOM · CVX · OXY",
    rec: "OPEC cohesion cracking = more barrels/lower prices; favor low-cost majors over high-beta shale here." },
  { id: "e3", ind: "energy", dayIdx: 1, future: false, impact: 1, dir: "MIXED",
    headline: "EIA weekly petroleum status report", tickers: "XOM · CVX · USO",
    rec: "Use inventory prints to time entries; a surprise draw would help stabilize the recent slide." },
  { id: "e4", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "BULLISH",
    headline: "Morgan Stanley lifts Brent to $90 (Q3), keeps XOM & CVX overweight", tickers: "XOM · CVX",
    rec: "Contrarian setup — quality majors near multi-month lows with cash returns; accumulate on weakness." },
  { id: "e5", ind: "energy", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "EIA weekly crude inventories", tickers: "XOM · CVX · USO",
    rec: "Watch the draw vs. consensus into peak summer demand; a big draw would confirm a floor." },
  { id: "e6", ind: "energy", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "EIA inventories + Hormuz normalization follow-through", tickers: "XOM · CVX · USO",
    rec: "Trade the fading geopolitical premium with trailing stops; a re-escalation would snap crude higher." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Medicare 'GLP-1 Bridge' opens senior access at $50/mo copay (thru 2027)", tickers: "LLY · NVO",
    rec: "Structural volume tailwind for GLP-1 leaders; own LLY as the pipeline leader, NVO as the value reset." },
  { id: "h2", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Eli Lilly +7% on Medicare access + oral-pill pipeline news", tickers: "LLY",
    rec: "Momentum plus policy — hold core LLY; use pullbacks to add rather than chasing a 7% single-day pop." },
  { id: "h3", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "GLP-1 competition heats up — LLY oral pill vs NVO semaglutide defense", tickers: "LLY · NVO · VKTX",
    rec: "Expect franchise-share volatility; favor LLY on pipeline breadth, fade knee-jerk NVO moves." },
  { id: "h4", ind: "health", dayIdx: 13, future: true, impact: 1, dir: "BULLISH",
    headline: "Biotech M&A momentum persists as pharma fills revenue gaps", tickers: "XBI · PFE · MRK",
    rec: "Tailwind for SMID-cap biotech (XBI); tilt to de-risked assets that plug large-cap patent cliffs." },
  { id: "h5", ind: "health", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Managed-care margin watch into 2027 Medicare Advantage rates", tickers: "UNH · HUM · CVS",
    rec: "Stay selective/underweight until rate + utilization clarity improves; avoid catching falling MCO knives." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "All 32 banks pass Fed stress test; JPM +10% div & new $50B buyback", tickers: "JPM · GS · MS",
    rec: "Capital-return tailwind confirmed; own the fortress balance sheets (JPM) into a strong buyback backdrop." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "June jobs +57K badly miss (est. ~115K); rate-HIKE odds fade, yields ease", tickers: "JPM · BAC · WFC",
    rec: "Softer labor = lower-for-longer bias; a steeper curve helps NII banks but watch credit if growth cools further." },
  { id: "f3", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "GS lifts dividend 11%, MS 15% after clearing the stress test", tickers: "GS · MS",
    rec: "Capital-markets names re-rating on payouts; take partial profits into strength, hold core positions." },
  { id: "f4", ind: "finance", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Big-bank Q2 earnings kick off — JPM, C, WFC, GS (Jul 14)", tickers: "JPM · C · WFC · GS",
    rec: "Watch NII guides, credit reserves & IB rebound; keep some dry powder as the sector's tone-setter prints." },
  { id: "f5", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Bank earnings day 2 — BAC & MS report; regional read-through", tickers: "BAC · MS",
    rec: "Trading/wealth strength is the tell for MS; let the reaction confirm before adding to the group." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Nike FQ4 beats (EPS $0.20 vs $0.13) but China −12% & soft guide", tickers: "NKE",
    rec: "Beat is real but turnaround is slow; treat as a contrarian hold — size small until China/DTC stabilize." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Nike +3% relief rally on ~$986M one-time tariff refund", tickers: "NKE",
    rec: "One-time margin boost, not underlying strength; don't chase — accumulate on dips toward support." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Tesla Q2 deliveries 480K, +25% YoY — a clear beat", tickers: "TSLA",
    rec: "Volume momentum is bullish; hold into Jul 22 earnings but expect margin/robotaxi headlines to swing it." },
  { id: "c4", ind: "consumer", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "Netflix Q2 earnings (Jul 16) — stock near 52-wk low, binary print", tickers: "NFLX",
    rec: "Expectations are washed out; size before the print — a clean quarter is the contrarian bull catalyst." },
  { id: "c5", ind: "consumer", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Consumer demand read into June CPI; retail traffic watch", tickers: "WMT · TGT · AMZN",
    rec: "A cool CPI supports the resilient-consumer thesis; favor share-gainers (WMT/AMZN) over weak-traffic retail." },

  // ---- FORWARD CATALYSTS (week 2: Jul 11–17) ------------------------------
  { id: "x1", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Megacap tech earnings loom (GOOGL/MSFT/AAPL late Jul) — positioning begins", tickers: "GOOGL · MSFT · AAPL",
    rec: "Start setting defined-risk pre-earnings positions; the setup, not the pre-run, is where the edge is." },
  { id: "x2", ind: "consumer", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Tesla Q2 earnings approach (Jul 22) after the delivery beat", tickers: "TSLA",
    rec: "Deliveries beat is known; the print is about margins & robotaxi — use defined-risk into a high-IV event." },
  { id: "x3", ind: "finance", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Rate-path repricing into June CPI (Jul 14) & July 28-29 FOMC", tickers: "JPM · BAC · SPY",
    rec: "Keep dry powder; a soft CPI cements the no-hike path and supports rate-sensitive financials." },
  { id: "x4", ind: "energy", dayIdx: 10, future: true, impact: 1, dir: "MIXED",
    headline: "Summer-demand & OPEC+ supply tug-of-war continues", tickers: "XOM · CVX · USO",
    rec: "Range-trade the majors; more OPEC barrels cap upside while peak demand cushions the downside." },
  { id: "x5", ind: "health", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "GLP-1 data-flow & pharma M&A digestion into late July", tickers: "LLY · NVO · XBI",
    rec: "Volatility persists; keep LLY as the core holding and treat NVO bounces as tactical, not structural." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "JPM", name: "JPMorgan Chase", rank: 1, spot: "~$334", sentiment: "Bullish",
    catalyst: "Q2 earnings — Tue Jul 14 (before open) · sector tone-setter",
    iv: "Moderate (~±4% earnings move) — not extreme", liq: "Deep, penny-wide mega-cap bank chain; huge OI",
    thesis: "Cleared the stress test with a 10% dividend hike and a fresh $50B buyback, trading near all-time highs into a well-telegraphed print. Moderate IV favors defined-risk debit structures with a paid-to-wait credit spread underneath.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $345 · Aug 21 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $325 / buy $315 · Jul 31 '26 · ~$3.00 credit · max loss/capital ~$700 · harvests earnings IV" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$340 call · Jul 17 '26 · ~$3.00 debit · cost ~$300 · pure earnings pop" },
    ] },
  { ticker: "NFLX", name: "Netflix", rank: 2, spot: "~$78", sentiment: "Bullish (contrarian)",
    catalyst: "Q2 earnings — Thu Jul 16 (after close) · BINARY",
    iv: "Rich into earnings; stock near 52-wk low (~$71–130 range)", liq: "Deep, active large-cap chain; tight spreads",
    thesis: "Washed-out expectations near the 52-week low with elevated IV into a binary → get paid to accumulate via a defined-risk put-credit spread, cut vega with a debit spread, and keep a cheap call for the asymmetric upside pop.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $72 / buy $67 · Aug 21 '26 · ~$1.60 credit · max loss/capital ~$340 · paid to accumulate, harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $78 / sell $88 · Jul 31 '26 · ~$3.80 net debit · cost/max loss ~$380 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$85 call · Jul 17 '26 · ~$1.80 debit · cost ~$180 · pure earnings pop" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 3, spot: "~$427", sentiment: "Neutral-to-Bullish",
    catalyst: "Q2 earnings — Wed Jul 22 (after close) · BINARY; deliveries already beat",
    iv: "High (~±8–10% implied) into a binary", liq: "Deepest single-name options chain; very tight spreads",
    thesis: "Q2 deliveries beat (480K, +25% YoY) but the print hinges on margins and robotaxi commentary → defined-risk only. Sell rich premium below support and cut vega with a debit spread; keep a small OTM call as the lottery ticket.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $400 / buy $390 · Aug 21 '26 · ~$3.00 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $430 / sell $445 · Jul 31 '26 · ~$6.00 net debit · cost/max loss ~$600 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$450 call · Jul 24 '26 · ~$4.00 debit · cost ~$400 · earnings/robotaxi pop" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 4, spot: "~$195", sentiment: "Bullish",
    catalyst: "AI-capex momentum; no earnings in window (next ~late Aug)",
    iv: "Moderate — cooled after the H1 run → long premium reasonable", liq: "Most liquid equity chain in the market; penny spreads",
    thesis: "The AI leader pulling back with the rest of semis on H1 profit-taking, with no binary earnings risk in the window and IV that has cooled off. Buy the dip with defined-cost debit structures rather than chasing.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$185 call · Aug 21 '26 · ~$14.00 debit · cost ~$1,400 · Δ≈0.65" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $195 / sell $210 · Aug 21 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$210 call · Jul 31 '26 · ~$3.00 debit · cost ~$300 · dip-buy bounce" },
    ] },
  { ticker: "NKE", name: "Nike", rank: 5, spot: "~$42", sentiment: "Bullish (contrarian)",
    catalyst: "Post-FQ4 relief rally (beat + ~$986M tariff refund); slow turnaround",
    iv: "Normalized post-earnings — moderate", liq: "Deep mega-cap chain; low-dollar premiums",
    thesis: "Contrarian turnaround: FQ4 beat and a tariff-refund margin boost sparked a relief rally, though China and DTC are still soft. Cheap absolute price, but a cash-secured put would post ~$4k collateral (over the cap) → use a put-credit spread to get paid to accumulate instead.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$40 call · Aug 21 '26 · ~$3.50 debit · cost ~$350 · Δ≈0.65" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $42 / buy $38 · Aug 21 '26 · ~$1.30 credit · max loss/capital ~$270 · paid to accumulate (CSP too rich at ~$4k)" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $43 / sell $48 · Jul 31 '26 · ~$1.60 net debit · cost/max loss ~$160" },
    ] },
];

const RISK_COLORS = {
  Conservative: "#22c55e",
  Moderate:     "#eab308",
  Aggressive:   "#ef4444",
};

// ------------------------------------------------------------------ geometry
const M = { left: 78, top: 28, right: 26, bottom: 58 };
const PLOT_W = 980;
const PLOT_H = 384;
const COL_W = PLOT_W / DAYS.length;
const SVG_W = M.left + PLOT_W + M.right;
const SVG_H = M.top + PLOT_H + M.bottom;
// today line sits on the boundary between Jul 3 and Jul 4
const TODAY_X = M.left + (TODAY_IDX + 1) * COL_W;

const xCenter = (dayIdx) => M.left + (dayIdx + 0.5) * COL_W;
const yCenter = (impact) => M.top + PLOT_H * ((3 - impact) / 3 + 1 / 6);

// deterministic mini-grid offset so co-located dots don't overlap
function cellOffset(i, n) {
  const perRow = Math.min(n, 3);
  const rows = Math.ceil(n / 3);
  const col = i % 3;
  const row = Math.floor(i / 3);
  const dx = (col - (perRow - 1) / 2) * 21;
  const dy = (row - (rows - 1) / 2) * 22;
  return { dx, dy };
}

// ------------------------------------------------------------------ component
export default function MarketMatrix() {
  const [tab, setTab] = useState("matrix");
  const [activeInds, setActiveInds] = useState(() => new Set(Object.keys(INDUSTRIES)));
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [risk, setRisk] = useState("All");

  const toggleInd = (key) =>
    setActiveInds((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // group visible events by (dayIdx, impact) so we can spread them
  const positioned = useMemo(() => {
    const visible = EVENTS.filter((e) => activeInds.has(e.ind));
    const groups = {};
    visible.forEach((e) => {
      const k = `${e.dayIdx}-${e.impact}`;
      (groups[k] = groups[k] || []).push(e);
    });
    const out = [];
    Object.values(groups).forEach((arr) => {
      arr.forEach((e, i) => {
        const { dx, dy } = cellOffset(i, arr.length);
        out.push({ ...e, cx: xCenter(e.dayIdx) + dx, cy: yCenter(e.impact) + dy });
      });
    });
    return out;
  }, [activeInds]);

  const detail = selected || hovered;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>US Market Pulse — Recency × Impact Matrix</h1>
          <div style={S.sub}>
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Jul 3 2026</b> · window: last 3 days → next 2 weeks ·
            color = industry · dot = event · {DIR.BULLISH.glyph}/{DIR.BEARISH.glyph}/{DIR.MIXED.glyph} = bullish / bearish / mixed
          </div>
        </div>
        <div style={S.tabs}>
          <button style={tabBtn(tab === "matrix")} onClick={() => setTab("matrix")}>News Matrix</button>
          <button style={tabBtn(tab === "options")} onClick={() => setTab("options")}>Top Option Plays</button>
        </div>
      </div>

      {tab === "matrix" ? (
        <>
          {/* legend */}
          <div style={S.legend}>
            {Object.entries(INDUSTRIES).map(([k, v]) => {
              const on = activeInds.has(k);
              return (
                <button key={k} onClick={() => toggleInd(k)}
                        style={{ ...S.chip, opacity: on ? 1 : 0.32, borderColor: v.color }}>
                  <span style={{ ...S.dot, background: v.color }} />
                  {v.label}
                </button>
              );
            })}
            <span style={S.legendNote}>click a chip to filter · click a dot to pin its recommendation</span>
          </div>

          <div style={S.matrixWrap}>
            <svg width={SVG_W} height={SVG_H} style={{ display: "block" }}
                 onClick={() => setSelected(null)}>
              {/* future background */}
              <rect x={TODAY_X} y={M.top} width={M.left + PLOT_W - TODAY_X} height={PLOT_H}
                    fill="#1e293b" opacity={0.55} />
              <text x={(TODAY_X + M.left + PLOT_W) / 2} y={M.top + 15} fill="#64748b"
                    fontSize={11} textAnchor="middle" letterSpacing={2}>
                FORECAST / UPCOMING
              </text>

              {/* impact bands + labels */}
              {[1, 2, 3].map((lvl) => {
                const yTop = M.top + PLOT_H * ((3 - lvl) / 3);
                return (
                  <g key={lvl}>
                    {lvl < 3 && (
                      <line x1={M.left} y1={yTop} x2={M.left + PLOT_W} y2={yTop}
                            stroke="#334155" strokeDasharray="3 4" />
                    )}
                    <text x={M.left - 12} y={yCenter(lvl)} fill="#94a3b8" fontSize={11}
                          textAnchor="end" dominantBaseline="middle" fontWeight={600}>
                      {IMPACT_LABEL[lvl]}
                    </text>
                  </g>
                );
              })}

              {/* plot border */}
              <rect x={M.left} y={M.top} width={PLOT_W} height={PLOT_H} fill="none" stroke="#334155" />

              {/* day columns + x labels */}
              {DAYS.map((d) => {
                const x = M.left + d.idx * COL_W;
                const weekend = d.dow === "Sat" || d.dow === "Sun";
                return (
                  <g key={d.idx}>
                    {d.idx > 0 && (
                      <line x1={x} y1={M.top} x2={x} y2={M.top + PLOT_H} stroke="#1f2a3a" />
                    )}
                    <text x={x + COL_W / 2} y={M.top + PLOT_H + 20} fill={d.idx === TODAY_IDX ? "#f8fafc" : "#94a3b8"}
                          fontSize={11} textAnchor="middle" fontWeight={d.idx === TODAY_IDX ? 700 : 500}>
                      {d.date}
                    </text>
                    <text x={x + COL_W / 2} y={M.top + PLOT_H + 34} fill={weekend ? "#475569" : "#64748b"}
                          fontSize={9} textAnchor="middle">
                      {d.dow}
                    </text>
                  </g>
                );
              })}

              {/* TODAY divider */}
              <line x1={TODAY_X} y1={M.top - 6} x2={TODAY_X} y2={M.top + PLOT_H + 6}
                    stroke="#f8fafc" strokeWidth={2} />
              <text x={TODAY_X} y={M.top - 12} fill="#f8fafc" fontSize={11} textAnchor="middle"
                    fontWeight={700} letterSpacing={1}>
                ▸ TODAY (Jul 3)
              </text>

              {/* axis titles */}
              <text x={M.left + PLOT_W / 2} y={SVG_H - 6} fill="#cbd5e1" fontSize={12}
                    textAnchor="middle" fontWeight={600} letterSpacing={1}>
                RECENCY  →  (past · today · upcoming)
              </text>
              <text x={16} y={M.top + PLOT_H / 2} fill="#cbd5e1" fontSize={12} fontWeight={600}
                    textAnchor="middle" letterSpacing={1}
                    transform={`rotate(-90 16 ${M.top + PLOT_H / 2})`}>
                IMPACT  ↑
              </text>

              {/* event dots */}
              {positioned.map((e) => {
                const c = INDUSTRIES[e.ind].color;
                const isOn = detail && detail.id === e.id;
                return (
                  <g key={e.id} style={{ cursor: "pointer" }}
                     onMouseEnter={() => setHovered(e)}
                     onMouseLeave={() => setHovered(null)}
                     onClick={(ev) => { ev.stopPropagation(); setSelected(e); }}>
                    <circle cx={e.cx} cy={e.cy} r={isOn ? 13 : 10}
                            fill={c} stroke={isOn ? "#f8fafc" : "rgba(255,255,255,0.55)"}
                            strokeWidth={isOn ? 2.5 : 1} />
                    <text x={e.cx} y={e.cy} fill="#fff" fontSize={10} fontWeight={700}
                          textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: "none" }}>
                      {DIR[e.dir].glyph}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* detail panel */}
          <div style={S.detail}>
            {detail ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ ...S.dot, background: INDUSTRIES[detail.ind].color, width: 14, height: 14 }} />
                  <b style={{ color: "#f1f5f9" }}>{detail.headline}</b>
                  <span style={badge(detail.future ? "#38bdf8" : "#64748b")}>
                    {detail.future ? "UPCOMING" : "PAST"}
                  </span>
                  <span style={badge("#475569")}>{IMPACT_LABEL[detail.impact]} IMPACT</span>
                  <span style={badge(dirColor(detail.dir))}>{DIR[detail.dir].glyph} {DIR[detail.dir].label}</span>
                </div>
                <div style={S.tickers}>{detail.tickers}</div>
                <div style={S.recBox}>
                  <span style={S.recLabel}>What to do</span> {detail.rec}
                </div>
              </>
            ) : (
              <span style={{ color: "#64748b" }}>Hover or click a dot to see the headline, affected tickers, and the recommended action.</span>
            )}
          </div>

          {/* full recommendation ledger */}
          <details style={S.ledger}>
            <summary style={S.ledgerSummary}>All {EVENTS.length} events &amp; recommendations (full ledger)</summary>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {EVENTS.filter((e) => activeInds.has(e.ind))
                .slice()
                .sort((a, b) => a.dayIdx - b.dayIdx || b.impact - a.impact)
                .map((e) => (
                  <div key={e.id} style={S.ledgerRow} onClick={() => setSelected(e)}>
                    <span style={{ ...S.dot, background: INDUSTRIES[e.ind].color }} />
                    <span style={{ color: "#64748b", width: 52, fontSize: 12 }}>
                      {DAYS[e.dayIdx].date}
                    </span>
                    <span style={{ color: dirColor(e.dir), width: 16, textAlign: "center" }}>{DIR[e.dir].glyph}</span>
                    <span style={{ flex: 1, color: "#cbd5e1", fontSize: 13 }}>
                      <b style={{ color: "#e2e8f0" }}>{e.tickers}</b> — {e.headline}
                      <span style={{ color: "#94a3b8" }}> → {e.rec}</span>
                    </span>
                  </div>
                ))}
            </div>
          </details>
        </>
      ) : (
        // ---------------------------------------------------------- options tab
        <div style={{ marginTop: 6 }}>
          <div style={S.optHead}>
            <div style={S.sub}>
              Strongest options plays for the coming month — strategy chosen per name by <b style={{ color: "#e2e8f0" }}>IV, sentiment &amp; upcoming binary events</b> (long calls/puts, debit &amp; credit spreads, cash-secured puts). Every idea is <b style={{ color: "#e2e8f0" }}>defined-risk</b> with total capital at risk <b style={{ color: "#e2e8f0" }}>under $1,500/trade</b> (debit × 100, or max loss / collateral) on a liquid chain. No naked shorts.
            </div>
            <div style={S.riskRow}>
              {["All", "Conservative", "Moderate", "Aggressive"].map((r) => (
                <button key={r} onClick={() => setRisk(r)}
                        style={{ ...S.riskBtn, ...(risk === r ? { background: r === "All" ? "#334155" : RISK_COLORS[r], color: "#0b1220", borderColor: "transparent" } : {}) }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div style={S.optGrid}>
            {OPTION_PLAYS.map((p) => (
              <div key={p.ticker} style={S.optCard}>
                <div style={S.optTop}>
                  <span style={S.optRank}>#{p.rank}</span>
                  <b style={{ color: "#f8fafc", fontSize: 18 }}>{p.ticker}</b>
                  <span style={{ color: "#94a3b8" }}>{p.name}</span>
                  <span style={{ ...badge(sentColor(p.sentiment)), marginLeft: "auto" }}>{p.sentiment}</span>
                  <span style={{ color: "#cbd5e1", fontSize: 13 }}>{p.spot}</span>
                </div>
                <div style={S.optMeta}><span style={S.k}>Catalyst</span> {p.catalyst}</div>
                <div style={S.optMeta}><span style={S.k}>IV</span> {p.iv}</div>
                <div style={S.optMeta}><span style={S.k}>Liquidity</span> {p.liq}</div>
                <div style={S.optThesis}>{p.thesis}</div>
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  {p.ideas.filter((i) => risk === "All" || i.profile === risk).map((i, ix) => (
                    <div key={ix} style={S.ideaRow}>
                      <span style={{ ...S.ideaTag, background: RISK_COLORS[i.profile] }}>{i.profile}</span>
                      <span style={S.stratTag}>{i.strategy}</span>
                      <span style={{ color: "#e2e8f0", fontSize: 13 }}>{i.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={S.disclaimer}>
        ⚠ Educational analysis, <b>not financial advice</b>. Strikes, premiums &amp; IV are
        <b> estimates</b> from spot + implied vol — confirm live bid/ask, expirations, and assignment/margin terms on your broker before trading. Long options can
        expire worthless; credit &amp; cash-secured strategies carry assignment and collateral obligations. Size aggressive OTM ideas as lottery tickets.
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ helpers
function dirColor(d) {
  return d === "BULLISH" ? "#22c55e" : d === "BEARISH" ? "#f43f5e" : "#94a3b8";
}
function sentColor(s) {
  if (!s) return "#94a3b8";
  if (s.indexOf("Bull") > -1) return "#22c55e";
  if (s.indexOf("Bear") > -1) return "#f43f5e";
  return "#fbbf24";
}
function tabBtn(active) {
  return {
    ...S.tabBtn,
    background: active ? "#334155" : "transparent",
    color: active ? "#f8fafc" : "#94a3b8",
  };
}
function badge(color) {
  return {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: "2px 8px",
    borderRadius: 999, color: "#0b1220", background: color, whiteSpace: "nowrap",
  };
}

// ------------------------------------------------------------------ styles
const S = {
  root: {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    background: "#0b1220", color: "#cbd5e1", padding: 20, borderRadius: 14,
    maxWidth: 920, margin: "0 auto",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  h1: { margin: 0, fontSize: 20, color: "#f8fafc", fontWeight: 700 },
  sub: { fontSize: 12.5, color: "#94a3b8", marginTop: 4, lineHeight: 1.5 },
  tabs: { display: "flex", gap: 4, background: "#0f1729", padding: 4, borderRadius: 10, border: "1px solid #1f2a3a" },
  tabBtn: { border: "none", padding: "7px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  legend: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "16px 0 10px" },
  chip: {
    display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px",
    background: "#0f1729", border: "1.5px solid", borderRadius: 999, color: "#e2e8f0",
    fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  },
  dot: { width: 11, height: 11, borderRadius: "50%", display: "inline-block", flexShrink: 0 },
  legendNote: { color: "#475569", fontSize: 11.5, marginLeft: 4 },
  matrixWrap: { background: "#0f1729", border: "1px solid #1f2a3a", borderRadius: 12, padding: 8, overflowX: "auto" },
  detail: {
    marginTop: 12, background: "#0f1729", border: "1px solid #1f2a3a", borderRadius: 10,
    padding: 14, minHeight: 58,
  },
  tickers: { color: "#7dd3fc", fontSize: 13, fontWeight: 600, marginTop: 8, fontFamily: "ui-monospace, monospace" },
  recBox: { marginTop: 8, fontSize: 13.5, color: "#e2e8f0", lineHeight: 1.5 },
  recLabel: {
    fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "#0b1220", background: "#fbbf24",
    padding: "2px 7px", borderRadius: 5, marginRight: 8,
  },
  ledger: { marginTop: 12, background: "#0f1729", border: "1px solid #1f2a3a", borderRadius: 10, padding: "10px 14px" },
  ledgerSummary: { cursor: "pointer", color: "#cbd5e1", fontSize: 13, fontWeight: 600 },
  ledgerRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 7, cursor: "pointer", background: "#0b1220" },
  optHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 },
  riskRow: { display: "flex", gap: 6 },
  riskBtn: {
    border: "1.5px solid #334155", background: "transparent", color: "#cbd5e1",
    padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  },
  optGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 },
  optCard: { background: "#0f1729", border: "1px solid #1f2a3a", borderRadius: 12, padding: 14 },
  optTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  optRank: { fontSize: 11, fontWeight: 800, color: "#0b1220", background: "#38bdf8", padding: "2px 7px", borderRadius: 6 },
  optMeta: { fontSize: 12.5, color: "#cbd5e1", marginTop: 4, lineHeight: 1.45 },
  k: { display: "inline-block", width: 72, color: "#64748b", fontWeight: 600, fontSize: 11 },
  optThesis: { fontSize: 12.5, color: "#94a3b8", marginTop: 10, lineHeight: 1.5, fontStyle: "italic" },
  ideaRow: { display: "flex", alignItems: "center", gap: 8, background: "#0b1220", padding: "6px 8px", borderRadius: 7, flexWrap: "wrap" },
  ideaTag: { fontSize: 10, fontWeight: 800, color: "#0b1220", padding: "2px 7px", borderRadius: 5, width: 88, textAlign: "center", flexShrink: 0 },
  stratTag: { fontSize: 10, fontWeight: 700, color: "#cbd5e1", border: "1px solid #334155", background: "#0f1729", padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap", flexShrink: 0 },
  disclaimer: {
    marginTop: 16, fontSize: 11.5, color: "#64748b", lineHeight: 1.5,
    borderTop: "1px solid #1f2a3a", paddingTop: 12,
  },
};
