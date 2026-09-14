import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Monday, September 14, 2026 (live-researched).
 * Window: last 3 days (Sep 11) → coming 2 weeks (Sep 28).
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

// 18-day axis: Sep 11 .. Sep 28 (last 3 days → coming 2 weeks). Today = index 3 (Sep 14).
const DAYS = [
  { idx: 0, date: "Sep 11", dow: "Fri" },
  { idx: 1, date: "Sep 12", dow: "Sat" },
  { idx: 2, date: "Sep 13", dow: "Sun" },
  { idx: 3, date: "Sep 14", dow: "Mon" }, // TODAY
  { idx: 4, date: "Sep 15", dow: "Tue" },
  { idx: 5, date: "Sep 16", dow: "Wed" },
  { idx: 6, date: "Sep 17", dow: "Thu" },
  { idx: 7, date: "Sep 18", dow: "Fri" },
  { idx: 8, date: "Sep 19", dow: "Sat" },
  { idx: 9, date: "Sep 20", dow: "Sun" },
  { idx: 10, date: "Sep 21", dow: "Mon" },
  { idx: 11, date: "Sep 22", dow: "Tue" },
  { idx: 12, date: "Sep 23", dow: "Wed" },
  { idx: 13, date: "Sep 24", dow: "Thu" },
  { idx: 14, date: "Sep 25", dow: "Fri" },
  { idx: 15, date: "Sep 26", dow: "Sat" },
  { idx: 16, date: "Sep 27", dow: "Sun" },
  { idx: 17, date: "Sep 28", dow: "Mon" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Broadcom slides ~15% MoM despite AI rev +221% to $16.7B — AI-sentiment reset", tickers: "AVGO",
    rec: "WATCH — results were strong; the drawdown is de-rating, not a miss. Scale in on stabilization, don't chase." },
  { id: "t2", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "Nvidia ~$228, +22% YTD; Q3 guide $108B ±2%, Huang calls supply 'a bottleneck thru FY28'", tickers: "NVDA",
    rec: "HOLD/BUY dips — supply-constrained demand is the bull case; use AI-capex jitters to add, don't chase highs." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "AI-chip complex firms into September — analysts flag NVDA/MRVL/AVGO as top setups", tickers: "NVDA · MRVL · AVGO",
    rec: "BUY quality on weakness; keep position sizing disciplined given elevated single-name volatility." },
  { id: "t4", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Hyperscaler AI-capex watch — $770B 2026 build under scrutiny for 'circular' financing", tickers: "NVDA · MSFT · ORCL",
    rec: "WATCH capex commentary; any hyperscaler capex trim is the key early-warning risk for the whole AI trade." },
  { id: "t5", ind: "tech", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Into Micron FQ4 (Sep 30) — AI-memory / HBM pricing tell for the group", tickers: "MU · NVDA",
    rec: "WATCH — strong HBM guide re-rates memory; wait for the print rather than positioning into a binary." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "Crude stays elevated (Brent ~$91) — Mideast exports constrained, shut-ins ~5.7M b/d into Q4", tickers: "XOM · CVX · COP",
    rec: "HOLD core E&P for the supply premium; trim tactically if crude spikes into headline-driven strength." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "EIA Sept STEO: 2026 Brent avg ~$91 (+$22 YoY), but 2027 seen easing to ~$74 on stock builds", tickers: "XOM · CVX · USO",
    rec: "WATCH the 2027 fade — favor low-cost E&P over marginal producers; the tailwind is a 2026 story." },
  { id: "e3", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (Wed 10:30 ET)", tickers: "XOM · CVX · USO",
    rec: "WATCH the draw vs. consensus; a big draw amid constrained Mideast supply reinforces the bull case." },
  { id: "e4", ind: "energy", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (Wed 10:30 ET)", tickers: "XOM · CVX · USO",
    rec: "Use the inventory print to time entries; geopolitics still dominates weekly fundamentals." },
  { id: "e5", ind: "energy", dayIdx: 8, future: true, impact: 1, dir: "BULLISH",
    headline: "Mideast supply-premium persists — geopolitical risk keeps a bid under crude", tickers: "XOM · CVX · OXY",
    rec: "Keep a tactical energy overweight as insurance; use trailing stops — a de-escalation unwinds it fast." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "FDA PDUFA (Sep 18): zidesamtinib for ROS1+ NSCLC — binary decision", tickers: "NUVB",
    rec: "WATCH — small-cap binary; size as a lottery ticket. Approval re-rates NUVB, a CRL is a sharp drawdown." },
  { id: "h2", ind: "health", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "FDA PDUFA (Sep 26): zilurgisertib (ALK2) for fibrodysplasia ossificans progressiva", tickers: "INCY",
    rec: "WATCH — defined binary for INCY's rare-disease pipeline; a win adds a durable orphan franchise." },
  { id: "h3", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Biotech M&A / SMID-cap bid stays strong as pharma fills revenue gaps", tickers: "XBI · PFE · MRK",
    rec: "BUY de-risked SMID biotech (XBI) selectively; tilt to names that fit large-cap pipeline holes." },
  { id: "h4", ind: "health", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Managed-care margin watch — 2027 rate & utilization trends in focus", tickers: "UNH · HUM · CVS",
    rec: "WATCH — stay neutral/underweight managed care until utilization and 2027-rate clarity improve." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "August CPI (Sep 11) — last major inflation read before the FOMC decision", tickers: "SPY · JPM · TLT",
    rec: "WATCH — a cool print greenlights easing and lifts risk; a hot one revives higher-for-longer fears." },
  { id: "f2", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (Sep 16, 2pm ET) + dot plot — Warsh Fed, funds at 3.50–3.75%", tickers: "SPY · JPM · BAC · TLT",
    rec: "Biggest macro swing in the window — keep dry powder into the dots & presser; the path matters more than the move." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Goldman IB backlog at a 5-yr high; IB fees +55% to $3.4B on IPO/underwriting surge", tickers: "GS · MS",
    rec: "BUY/HOLD capital-markets leverage (GS/MS) — a reopening IPO pipeline is a durable revenue tailwind." },
  { id: "f4", ind: "finance", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Quarterly quad witching (Sep 18) — expirations + index positioning", tickers: "SPY · QQQ · IWM",
    rec: "Expect elevated volume & pin risk; avoid initiating new size into the Friday close." },
  { id: "f5", ind: "finance", dayIdx: 10, future: true, impact: 1, dir: "MIXED",
    headline: "S&P/Nasdaq index rebalance effective — flows around the reconstitution", tickers: "SPY · QQQ",
    rec: "WATCH — rebalance flows are mechanical; don't confuse index-driven volume with a fundamental signal." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 3, future: false, impact: 3, dir: "BEARISH",
    headline: "Tesla China retail −12.4% in Aug (4th straight drop); adds 10k-yuan Model Y incentive", tickers: "TSLA",
    rec: "HOLD/trim — demand softness + negative FCF offset the robotaxi narrative; wait for Q3 deliveries." },
  { id: "c2", ind: "consumer", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "FedEx FQ1 earnings (Sep 17, after close) — global freight bellwether · BINARY", tickers: "FDX",
    rec: "WATCH into the print; JPM keeps Buy (PT ~$400 vs ~$330 spot). Defined-risk only ahead of the move." },
  { id: "c3", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "AutoZone Q4 FY26 earnings (Sep 22, before open) · BINARY", tickers: "AZO",
    rec: "WATCH — defensive comp; a same-store-sales beat supports the trade, but IV is rich into the print." },
  { id: "c4", ind: "consumer", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Darden Q1 FY27 earnings (Sep 24, before open) — Olive Garden / traffic read · BINARY", tickers: "DRI",
    rec: "WATCH — consumer-spend tell; steady traffic + margin gains keep the bull case, but earnings gap risk is real." },
  { id: "c5", ind: "consumer", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "August retail sales (Sep 16, 8:30 ET) — consensus ~+0.7% m/m", tickers: "WMT · AMZN · TGT",
    rec: "WATCH — a strong print supports discretionary but complicates the easing case; pairs with the same-day FOMC." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "FDX", name: "FedEx", rank: 1, spot: "~$330", sentiment: "Bullish",
    catalyst: "FQ1 earnings — Thu Sep 17 (after close) · BINARY",
    iv: "Elevated into the print (~±8% implied)", liq: "Deep, liquid large-cap chain; tight spreads",
    thesis: "Freight bellwether into earnings with JPM Buy (PT ~$400) but elevated IV → cut vega with a debit spread and harvest crush with a defined-risk put credit spread; keep the OTM call tiny.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $325 / sell $345 · Oct 17 '26 · ~$8.00 net debit · cost/max loss ~$800 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $320 / buy $310 · Sep 18 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$350 call · Sep 18 '26 · ~$3.00 debit · cost ~$300 · pure earnings pop" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 2, spot: "~$228", sentiment: "Bullish",
    catalyst: "AI-capex momentum into the Sep 16 FOMC (no earnings until Nov)",
    iv: "Moderate (no earnings in window) → long premium viable", liq: "Deepest single-stock options in the market; penny-wide, huge OI",
    thesis: "Supply-constrained demand (Q3 guide $108B) with no near-term binary and only moderate IV → buying premium is reasonable; spread up for a cheaper defined-cost version.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$220 call · Oct 16 '26 · ~$14.00 debit · cost ~$1,400 · Δ≈0.63" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $230 / sell $245 · Oct 16 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$240 call · Sep 26 '26 · ~$3.00 debit · cost ~$300 · post-FOMC pop" },
    ] },
  { ticker: "GS", name: "Goldman Sachs", rank: 3, spot: "~$1,030", sentiment: "Bullish",
    catalyst: "IB backlog 5-yr high into the Sep 16 FOMC (earnings mid-Oct)",
    iv: "Moderate; no earnings binary in window", liq: "Deep large-cap chain — high $ premiums, so use spreads to fit the cap",
    thesis: "Record deal backlog + reopening IPO pipeline into a dovish-tilt FOMC. High share price means the net debit / max loss (not the strike) is what fits $1,500 — all structures are defined-risk spreads.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1,020 / sell $1,040 · Oct 16 '26 · ~$10 net debit · cost/max loss ~$1,000" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1,000 / buy $990 · Oct 16 '26 · ~$3.50 credit · max loss/capital ~$650 · range-tolerant bullish" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1,040 / sell $1,055 · Sep 26 '26 · ~$5.00 net debit · cost/max loss ~$500" },
    ] },
  { ticker: "DRI", name: "Darden Restaurants", rank: 4, spot: "~$209", sentiment: "Bullish",
    catalyst: "Q1 FY27 earnings — Thu Sep 24 (before open) · BINARY",
    iv: "Elevated into the print", liq: "Liquid large-cap restaurant chain",
    thesis: "Steady traffic + margin gains into a binary with rich IV → get paid to be bullish via a put credit spread; spread up for defined-cost upside and keep the OTM call small.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $200 / buy $190 · Oct 17 '26 · ~$3.00 credit · max loss/capital ~$700 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $210 / sell $220 · Sep 25 '26 · ~$4.00 net debit · cost/max loss ~$400" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$215 call · Sep 25 '26 · ~$2.00 debit · cost ~$200 · earnings pop" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 5, spot: "~$166 (ESTIMATE)", sentiment: "Bullish",
    catalyst: "Crude supply premium (Brent ~$91) — constrained Mideast exports",
    iv: "Low/moderate → long premium favored", liq: "Deep, liquid mega-cap energy chain",
    thesis: "Elevated crude with shut-ins ~5.7M b/d into Q4 supports E&P; low IV favors buying premium. Spot flagged ESTIMATE — confirm live and keep strikes consistent with the real recent price.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$160 call · Nov 20 '26 · ~$11.00 debit · cost ~$1,100 · Δ≈0.63" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $165 / sell $175 · Oct 16 '26 · ~$4.00 net debit · cost/max loss ~$400" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$175 call · Oct 16 '26 · ~$2.00 debit · cost ~$200" },
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
// today line sits on the boundary between Sep 14 and Sep 15
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Monday, Sep 14 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Sep 14)
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
