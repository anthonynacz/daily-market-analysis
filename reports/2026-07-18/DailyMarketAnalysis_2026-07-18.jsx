import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Saturday, July 18, 2026 (live-researched).
 * Window: last 3 days (Jul 15) → coming 2 weeks (Aug 1).
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

// 18-day axis: Jul 15 .. Aug 1 (last 3 days → coming 2 weeks). Today = index 3 (Jul 18).
const DAYS = [
  { idx: 0, date: "Jul 15", dow: "Wed" },
  { idx: 1, date: "Jul 16", dow: "Thu" },
  { idx: 2, date: "Jul 17", dow: "Fri" },
  { idx: 3, date: "Jul 18", dow: "Sat" }, // TODAY
  { idx: 4, date: "Jul 19", dow: "Sun" },
  { idx: 5, date: "Jul 20", dow: "Mon" },
  { idx: 6, date: "Jul 21", dow: "Tue" },
  { idx: 7, date: "Jul 22", dow: "Wed" },
  { idx: 8, date: "Jul 23", dow: "Thu" },
  { idx: 9, date: "Jul 24", dow: "Fri" },
  { idx: 10, date: "Jul 25", dow: "Sat" },
  { idx: 11, date: "Jul 26", dow: "Sun" },
  { idx: 12, date: "Jul 27", dow: "Mon" },
  { idx: 13, date: "Jul 28", dow: "Tue" },
  { idx: 14, date: "Jul 29", dow: "Wed" },
  { idx: 15, date: "Jul 30", dow: "Thu" },
  { idx: 16, date: "Jul 31", dow: "Fri" },
  { idx: 17, date: "Aug 1", dow: "Sat" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Semiconductor rout deepens — SOX −13% in a month on AI-spend fears (AMAT/LRCX/INTC/ARM ~−4%)", tickers: "NVDA · AMD · MU · AMAT",
    rec: "Hold quality (NVDA); don't chase the knife — scale into AI-infra dips only on capex confirmation." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Alphabet −4.4% on report Gemini 3.5 Pro delayed months (~$200B erased)", tickers: "GOOGL · GOOG",
    rec: "Contrarian buy into 7/22 earnings — the delay is sentiment, not fundamentals; search & cloud intact." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "TSMC beats Q2 but lifts capex forecast; chips slide on the spend read", tickers: "TSM · NVDA",
    rec: "Watch — higher capex is bullish long-run AI-infra demand, bearish near-term for stretched multiples." },
  { id: "t4", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Alphabet Q2 earnings (after close) — cloud & AI-capex tell into the Gemini scare", tickers: "GOOGL",
    rec: "Defined-risk into the binary; strong Cloud/ads re-rates the name, a weak AI signal deepens the selloff." },
  { id: "t5", ind: "tech", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft & Meta Q2 earnings (after close) — Azure growth + AI-capex guide", tickers: "MSFT · META",
    rec: "Keep dry powder; cloud growth and capex commentary set the tone for the whole AI trade." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Oil spikes — WTI ~$80 / Brent ~$85 as US-Iran strikes stoke Hormuz & Red Sea fears; energy leads", tickers: "XOM · CVX · COP",
    rec: "Keep core E&P for the supply shock; use trailing stops — a de-escalation reverses the premium fast." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report", tickers: "XOM · CVX · USO",
    rec: "Use inventory prints to time entries — geopolitics dominates fundamentals right now." },
  { id: "e3", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "BULLISH",
    headline: "Hormuz / Red Sea escalation risk persists (CENTCOM strikes 7th consecutive night)", tickers: "XOM · CVX · OXY",
    rec: "Keep a tactical energy overweight as geopolitical insurance; trail stops — a ceasefire unwinds it sharply." },
  { id: "e4", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "EIA petroleum report (crude inventories)", tickers: "XOM · CVX · USO",
    rec: "Watch the draw vs. consensus; a big draw amid the Hormuz risk reinforces the bull case." },
  { id: "e5", ind: "energy", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "ExxonMobil Q2 earnings (~Jul 31) — oil windfall adds ~$3.5–3.9B to upstream", tickers: "XOM · CVX",
    rec: "Wait for the print; the windfall is largely known — watch guidance, buybacks and the crude outlook." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "FDA approves Lilly's Foundayo oral GLP-1; Medicare GLP-1 Bridge ($50/mo) now live", tickers: "LLY · NVO",
    rec: "Structural tailwind for LLY — hold the GLP-1 leader; oral-pill access widens the obesity TAM." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 1, dir: "BULLISH",
    headline: "Lilly EU nod for Jaypirca (CLL) + FDA PreCheck manufacturing pilot", tickers: "LLY",
    rec: "Incremental positives; add LLY on pullbacks rather than chase strength near record highs." },
  { id: "h3", ind: "health", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Big-pharma Q2 earnings wave begins (Merck, AbbVie, Pfizer cadence)", tickers: "MRK · ABBV · PFE",
    rec: "Focus on pipeline & guidance; be selective — favor de-risked names filling the patent-cliff gap." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Big banks smash Q2 — JPM record $21.2B profit; GS nearly doubles EPS on SpaceX IPO fees", tickers: "JPM · GS · BAC · C · WFC",
    rec: "Constructive; take partial profits into strength and favor capital-markets leaders (GS/MS)." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Travelers +9% on a big Q2 beat; insurers rally (PGR, ALL) as a defensive bright spot", tickers: "TRV · PGR · ALL",
    rec: "Insurance is a rare green pocket amid the tech selloff; hold quality underwriters." },
  { id: "f3", ind: "finance", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "FOMC meeting begins (Jul 28–29) — rate held 3.50–3.75% expected, no dot plot this meeting", tickers: "JPM · BAC · SPY",
    rec: "Position into the decision; higher-for-longer favors asset-sensitive banks — keep powder dry." },
  { id: "f4", ind: "finance", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC rate decision + Powell presser (2:00 / 2:30 ET) — no SEP", tickers: "SPY · TLT · JPM",
    rec: "Biggest macro swing in the window; a hawkish hold lifts banks and pressures long-duration & TLT." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Netflix −7% to a 52-wk low (~$69) on soft Q3 guide; ~$257B wiped from the 2025 high", tickers: "NFLX",
    rec: "Contrarian — oversold with ~56% analyst upside; accumulate defined-risk near the lows, not all at once." },
  { id: "c2", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "J.B. Hunt +7% on a Q2 beat ($1.73 EPS) — freight a logistics bright spot", tickers: "JBHT",
    rec: "Positive read-through for transports / goods demand; hold quality freight names." },
  { id: "c3", ind: "consumer", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q2 earnings (after close) — deliveries beat (+25% YoY) but margins & robotaxi in focus", tickers: "TSLA",
    rec: "Defined-risk into the binary; deliveries are strong, but watch auto margins and the guidance tone." },
  { id: "c4", ind: "consumer", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "Apple & Amazon Q2 earnings (after close) — iPhone/AI + AWS/retail guides", tickers: "AAPL · AMZN",
    rec: "Keep powder dry; AWS growth and Apple's AI roadmap are the tells for the megacap tape." },
  { id: "c5", ind: "consumer", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Ferrari & luxury/consumer names report (~Jul 31); month-end demand check", tickers: "RACE · AMZN",
    rec: "Watch luxury demand and tariff tone; fade knee-jerk moves, don't add size into month-end." },

  // ---- FORWARD CATALYSTS (week 2: Jul 25 – Aug 1) -------------------------
  { id: "x1", ind: "tech", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "AI-capex read-through continues post TSMC / Alphabet prints", tickers: "NVDA · AVGO · TSM",
    rec: "Let the dust settle; re-add on confirmed capex strength, not the first bounce." },
  { id: "x2", ind: "finance", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Month-end rebalancing into a mega-cap earnings cluster (MSFT/META, AAPL/AMZN, XOM)", tickers: "SPY · QQQ",
    rec: "Expect elevated volume and cross-currents; avoid initiating new size into month-end flows." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "TSLA", name: "Tesla", rank: 1, spot: "~$381", sentiment: "Bullish",
    catalyst: "Q2 earnings — Wed Jul 22 (after close) · BINARY (deliveries beat +25% YoY)",
    iv: "~65% / rich (±~11% implied)", liq: "One of the deepest, most liquid single-stock chains; penny-wide weeklies",
    thesis: "Bullish into a rich-IV binary → avoid naked long premium (max crush). Cut vega with a call debit spread, or get paid to be bullish via a defined-risk put credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $360 / buy $345 · Aug 21 '26 · ~$5.00 credit · max loss/capital ~$1,000 · harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $385 / sell $405 · Jul 24 '26 · ~$8.50 net debit · cost/max loss ~$850 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$420 call · Jul 24 '26 · ~$4.00 debit · cost ~$400 · pure earnings-pop lottery" },
    ] },
  { ticker: "GOOGL", name: "Alphabet", rank: 2, spot: "~$344", sentiment: "Bullish (contrarian)",
    catalyst: "Q2 earnings — Wed Jul 22 (after close) · BINARY (post ~$200B Gemini-delay drop)",
    iv: "Elevated into earnings (~±7% implied)", liq: "Deep mega-cap chain; tight spreads, huge OI",
    thesis: "Beaten down on a Gemini-timeline scare, not a fundamentals miss → bullish into the binary with defined risk. Spread up for cheap upside; sell a put spread to harvest the crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $340 / sell $360 · Aug 21 '26 · ~$8.50 net debit · cost/max loss ~$850" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $330 / buy $315 · Jul 24 '26 · ~$5.00 credit · max loss/capital ~$1,000 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$360 call · Jul 24 '26 · ~$4.00 debit · cost ~$400 · earnings breakout" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 3, spot: "~$148", sentiment: "Bullish",
    catalyst: "Oil spike (US-Iran / Hormuz) + Q2 earnings ~Jul 31 (oil windfall +$3.5–3.9B upstream)",
    iv: "Moderate (~28%) — reasonably priced → long premium OK", liq: "Deep, liquid mega-cap energy chain; tight spreads",
    thesis: "Bullish with only moderate IV → buying premium is favored. A geopolitical supply shock plus an earnings windfall gives two stacked catalysts; spread up for cheap defined-risk upside.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$145 call · Sep 18 '26 · ~$8.00 debit · cost ~$800 · Δ≈0.60" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $148 / sell $158 · Aug 21 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$155 call · Aug 21 '26 · ~$1.80 debit · cost ~$180 · oil-spike upside" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 4, spot: "~$203", sentiment: "Neutral-to-Bullish (contrarian)",
    catalyst: "Semiconductor rout (SOX −13%/mo) — oversold bounce; no earnings until late Aug",
    iv: "Elevated by the selloff (~45%)", liq: "The most liquid options chain in the market; penny-wide, enormous OI",
    thesis: "Oversold on AI-spend fears with no near-term binary → range-tolerant, defined-risk structures. Sell a put spread for a bounce/stabilization; spread up for cheap upside if the group turns.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $190 / buy $180 · Aug 21 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $200 / sell $215 · Aug 21 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$215 call · Aug 7 '26 · ~$3.50 debit · cost ~$350 · bounce play" },
    ] },
  { ticker: "NFLX", name: "Netflix", rank: 5, spot: "~$69", sentiment: "Bullish (contrarian)",
    catalyst: "Post-Q2 52-wk low (~$69); earnings already passed (IV crush done) · ~56% analyst upside",
    iv: "Deflated post-earnings (~40%) — long premium cheaper now", liq: "Deep large-cap chain; low $ premiums at this price",
    thesis: "Max-pessimism after the guide-down, but the binary is behind it → IV has already crushed, so long premium is cheap. Buy defined-risk upside; sell a put spread to get paid to accumulate near the lows.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$65 call · Sep 18 '26 · ~$7.00 debit · cost ~$700 · Δ≈0.62" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $70 / sell $80 · Aug 21 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Aggressive",   strategy: "Put Credit Spread", text: "Sell $65 / buy $60 · Aug 21 '26 · ~$1.50 credit · max loss/capital ~$350 · paid to accumulate" },
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
// today line sits on the boundary between Jul 18 and Jul 19
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Saturday, Jul 18 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 18)
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
