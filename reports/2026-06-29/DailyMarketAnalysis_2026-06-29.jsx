import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Monday, June 29, 2026 (live-researched).
 * Window: last 3 days (Jun 26) → coming 2 weeks (Jul 13).
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

// 18-day axis: Jun 26 .. Jul 13 (last 3 days → coming 2 weeks). Today = index 3 (Jun 29).
const DAYS = [
  { idx: 0, date: "Jun 26", dow: "Fri" },
  { idx: 1, date: "Jun 27", dow: "Sat" },
  { idx: 2, date: "Jun 28", dow: "Sun" },
  { idx: 3, date: "Jun 29", dow: "Mon" }, // TODAY
  { idx: 4, date: "Jun 30", dow: "Tue" },
  { idx: 5, date: "Jul 1", dow: "Wed" },
  { idx: 6, date: "Jul 2", dow: "Thu" },
  { idx: 7, date: "Jul 3", dow: "Fri" },
  { idx: 8, date: "Jul 4", dow: "Sat" },
  { idx: 9, date: "Jul 5", dow: "Sun" },
  { idx: 10, date: "Jul 6", dow: "Mon" },
  { idx: 11, date: "Jul 7", dow: "Tue" },
  { idx: 12, date: "Jul 8", dow: "Wed" },
  { idx: 13, date: "Jul 9", dow: "Thu" },
  { idx: 14, date: "Jul 10", dow: "Fri" },
  { idx: 15, date: "Jul 11", dow: "Sat" },
  { idx: 16, date: "Jul 12", dow: "Sun" },
  { idx: 17, date: "Jul 13", dow: "Mon" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Micron's record FQ3 (+16%); market cap tops Meta on AI-memory supercycle", tickers: "MU · SK Hynix · WDC",
    rec: "Trend intact but extended after a +325% YTD run — add on pullbacks, don't chase the gap." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Mega-cap tech rout: NVDA & GOOGL −8%+ on AI cost/spend fears; Nasdaq −4.6% on week", tickers: "NVDA · GOOGL · META",
    rec: "Use the AI-sentiment reset to scale into quality (NVDA) on weakness; avoid chasing dead-cat bounces." },
  { id: "t3", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Chips rebound with futures (Nasdaq +1.2%) as US–Iran agree to halt attacks", tickers: "NVDA · AMD · MU",
    rec: "Trade the relief rally with stops; the macro all-clear isn't confirmed until Thursday's jobs data." },
  { id: "t4", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "June jobs report (8:30 ET, moved to Thu) — hot/cold tell for high-multiple tech", tickers: "NVDA · MSFT · GOOGL",
    rec: "De-risk slightly pre-print; a soft number is the bull catalyst, a hot one pressures megacap multiples." },
  { id: "t5", ind: "tech", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through builds into Q2 earnings season (starts mid-July)", tickers: "NVDA · AVGO · MU",
    rec: "Let positioning reset; re-add on confirmation of hyperscaler capex, not the first bounce." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Crude crashes to ~$69 (4-mo low) as OFAC 'General License X' unleashes Iranian barrels", tickers: "XOM · CVX · USO",
    rec: "War premium is unwinding fast — avoid catching the falling knife; wait for crude to base." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "XOM −23% / CVX −20% off highs as the geopolitical bid evaporates", tickers: "XOM · CVX · COP",
    rec: "Trim momentum length; majors get interesting nearer support if oil stabilizes around $65." },
  { id: "e3", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Crude ticks up to ~$70 as US–Iran agree to halt attacks ahead of talks", tickers: "XOM · CVX · OXY",
    rec: "Fade rips until a supply catalyst returns; the trend is lower with the license live." },
  { id: "e4", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status + ISM demand read", tickers: "XOM · CVX · USO",
    rec: "Watch builds vs. draws; ample Iranian supply caps rallies near-term." },
  { id: "e5", ind: "energy", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "OPEC+ jawboning vs. the Iranian-supply overhang", tickers: "XOM · CVX · OXY",
    rec: "Range-trade the majors; only add on a credible production-cut signal." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Lilly +7%: Medicare opens GLP-1 access + EU backs Jaypirca (oncology)", tickers: "LLY · NVO",
    rec: "Two catalysts lift the pricing bear case — buy dips; the US CLL decision is the next leg (H2'26)." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Biotech M&A momentum continues at BIO 2026 (Lilly/Chai partnership)", tickers: "XBI · LLY",
    rec: "Constructive for SMID-cap biotech; tilt to de-risked assets filling pharma's revenue gap." },
  { id: "h3", ind: "health", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "GLP-1 data digestion + Medicare-access follow-through", tickers: "LLY · NVO · VKTX",
    rec: "Volatility persists; favor LLY on the access tailwind, fade knee-jerk NVO moves." },
  { id: "h4", ind: "health", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Managed-care watch into 2027 Medicare Advantage rate clarity", tickers: "UNH · HUM · CVS",
    rec: "Stay cautious on MCOs until the 2027 rate + DOJ overhangs clear." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "All 32 banks clear Fed stress test ($708B loss buffer); JPM hits all-time high", tickers: "JPM · BAC · WFC · GS",
    rec: "Capital-return tailwind — favor large-cap banks; take partial profits into the ATH pop." },
  { id: "f2", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "JPM lifts dividend to $1.65 + authorizes $50B buyback (live Jul 1)", tickers: "JPM",
    rec: "The buyback is a structural bid — hold/add on dips; the yield + repurchase floor support the stock." },
  { id: "f3", ind: "finance", dayIdx: 5, future: true, impact: 2, dir: "BULLISH",
    headline: "JPM's $50B repurchase program goes effective", tickers: "JPM · BAC",
    rec: "Persistent buyback demand underpins shares; use any weakness pre-jobs to add." },
  { id: "f4", ind: "finance", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "June payrolls — first read for the Fed's late-July decision", tickers: "JPM · BAC · SPY",
    rec: "Biggest swing risk of the window; keep dry powder, avoid new size into the 8:30 ET print." },
  { id: "f5", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Big-bank Q2 earnings loom (week of Jul 13)", tickers: "JPM · GS · WFC · C",
    rec: "Position into NII / credit-quality prints; favor capital-return leaders, trim the laggards." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Nike sinks to a 52-week low ($40.75) into Q4 earnings", tickers: "NKE",
    rec: "Max-pessimism turnaround — size small ahead of the print; let China / inventory commentary lead." },
  { id: "c2", ind: "consumer", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Nike FQ4 earnings (Tue, after close) · BINARY", tickers: "NKE",
    rec: "Expect a big move on IV ~50%; structure defined-risk — a China-stabilization tell is the bull trigger." },
  { id: "c3", ind: "consumer", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Constellation Brands FQ1 '27 earnings (after close)", tickers: "STZ",
    rec: "Watch beer depletions + tariff tone; fade or buy weakness on the guide, don't pre-position big." },
  { id: "c4", ind: "consumer", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q2 deliveries (~Thu) · BINARY — consensus ~406K, GS ~420K", tickers: "TSLA",
    rec: "Binary on the number vs. ~406K; defined-risk only — a beat re-rates the bull case, a miss tests $360." },
  { id: "c5", ind: "consumer", dayIdx: 10, future: true, impact: 1, dir: "MIXED",
    headline: "Post-holiday retail / July 4 spend read", tickers: "WMT · AMZN · TGT",
    rec: "Use holiday-traffic color to gauge the consumer; favor share-gainers (WMT / AMZN)." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "NKE", name: "Nike", rank: 1, spot: "~$40.75", sentiment: "Bullish (contrarian)",
    catalyst: "FQ4 earnings — Tue Jun 30 (after close) · BINARY",
    iv: "~50–55% (±~10% implied) — rich on a cheap stock", liq: "Deep mega-cap chain; low $ premiums, penny-wide",
    thesis: "Max-pessimism turnaround pinned at a fresh 52-week low ($40) into a binary print with rich IV → favor defined-risk: get paid to accumulate via a put-credit spread, or use ITM calls / a tight call spread to cut crush.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$38 call · Jul 17 '26 · ~$4.00 debit · cost ~$400 · Δ≈0.62 (less crush)" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $40 / buy $36 · Jul 17 '26 · ~$1.30 credit · max loss/capital ~$270 · paid to accumulate at lows" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $41 / sell $46 · Jul 2 '26 · ~$1.50 net debit · cost/max loss ~$150 · pure earnings pop" },
    ] },
  { ticker: "JPM", name: "JPMorgan Chase", rank: 2, spot: "~$332", sentiment: "Bullish",
    catalyst: "$50B buyback live Jul 1 + dividend to $1.65; Q2 earnings ~Jul 14",
    iv: "~22% — moderate/low → long premium & spreads favored", liq: "Deep, liquid large-cap chain; tight spreads",
    thesis: "Cleared the stress test, hit an all-time high, and a $50B repurchase goes live Jul 1 — a structural bid into the print. Low IV favors a defined-cost call spread; sell a put spread to lean on the buyback floor.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $325 / sell $340 · Jul 17 '26 · ~$8 net debit · cost/max loss ~$800" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $325 / buy $315 · Jul 17 '26 · ~$3.20 credit · max loss/capital ~$680 · buyback as support" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$340 call · Jul 17 '26 · ~$3.50 debit · cost ~$350 · breakout continuation" },
    ] },
  { ticker: "MU", name: "Micron", rank: 3, spot: "~$1,133", sentiment: "Bullish",
    catalyst: "Record FQ3 (Jun 25) + $50B Q4 rev guide; AI-memory supercycle",
    iv: "~55–60% — still elevated post-print; extended after +325% YTD", liq: "Deep, very active AI-memory chain",
    thesis: "Best-in-class AI-memory momentum but stretched after a parabolic run → keep cost capped with a narrow debit spread, or get paid to wait at trend support via a put-credit spread rather than chasing outright.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1,120 / sell $1,140 · Jul 17 '26 · ~$11 net debit · cost/max loss ~$1,100" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1,080 / buy $1,065 · Jul 17 '26 · ~$5 credit · max loss/capital ~$1,000 · paid to wait at support" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1,140 / sell $1,160 · Jul 2 '26 · ~$7 net debit · cost/max loss ~$700 · momentum continuation" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 4, spot: "~$380", sentiment: "Neutral / Mixed",
    catalyst: "Q2 deliveries (~Thu Jul 2) · BINARY — consensus ~406K, GS ~420K",
    iv: "~55% — elevated into a range-bound binary", liq: "Deepest single-name options chain; penny-wide",
    thesis: "Down ~16% YTD and range-bound into a binary delivery number → sell elevated premium with defined-risk: an iron condor to harvest the post-event IV crush if it stays boxed, a put spread for a mild upside lean.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $360p/buy $350p + sell $400c/buy $410c · Jul 17 '26 · ~$3.20 credit · max loss/capital ~$680 · range-bound" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $360 / buy $350 · Jul 17 '26 · ~$3.00 credit · max loss/capital ~$700 · mild bullish, IV harvest" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$400 call · Jul 2 '26 · ~$4.00 debit · cost ~$400 · delivery-beat pop" },
    ] },
  { ticker: "LLY", name: "Eli Lilly", rank: 5, spot: "~$1,130 (ESTIMATE)", sentiment: "Bullish",
    catalyst: "Medicare GLP-1 access + EU Jaypirca approval; US CLL decision H2'26",
    iv: "~35% — moderate/elevated; no near-term binary", liq: "Deep large-cap pharma chain; tight spreads",
    thesis: "Two fresh catalysts (Medicare access + an oncology approval) lift the pricing bear case on a momentum leader. No imminent binary → express bullishly with a defined-cost call spread; sell a put spread to get paid on dips. (Spot conflicting across feeds — ESTIMATE; confirm live.)",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1,120 / sell $1,140 · Jul 17 '26 · ~$11 net debit · cost/max loss ~$1,100" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1,080 / buy $1,065 · Jul 17 '26 · ~$5.50 credit · max loss/capital ~$950 · paid to wait on dips" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$1,160 call · Jul 17 '26 · ~$13 debit · cost ~$1,300 · momentum continuation" },
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
// today line sits on the boundary between Jun 5 and Jun 6
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Monday, Jun 29 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jun 29)
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
