import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, September 11, 2026 (live-researched).
 * Window: last 3 days (Sep 8) → coming 2 weeks (Sep 25).
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

// 18-day axis: Sep 8 .. Sep 25 (last 3 days → coming 2 weeks). Today = index 3 (Sep 11).
const DAYS = [
  { idx: 0, date: "Sep 8", dow: "Tue" },
  { idx: 1, date: "Sep 9", dow: "Wed" },
  { idx: 2, date: "Sep 10", dow: "Thu" },
  { idx: 3, date: "Sep 11", dow: "Fri" }, // TODAY
  { idx: 4, date: "Sep 12", dow: "Sat" },
  { idx: 5, date: "Sep 13", dow: "Sun" },
  { idx: 6, date: "Sep 14", dow: "Mon" },
  { idx: 7, date: "Sep 15", dow: "Tue" },
  { idx: 8, date: "Sep 16", dow: "Wed" },
  { idx: 9, date: "Sep 17", dow: "Thu" },
  { idx: 10, date: "Sep 18", dow: "Fri" },
  { idx: 11, date: "Sep 19", dow: "Sat" },
  { idx: 12, date: "Sep 20", dow: "Sun" },
  { idx: 13, date: "Sep 21", dow: "Mon" },
  { idx: 14, date: "Sep 22", dow: "Tue" },
  { idx: 15, date: "Sep 23", dow: "Wed" },
  { idx: 16, date: "Sep 24", dow: "Thu" },
  { idx: 17, date: "Sep 25", dow: "Fri" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Oracle FQ1 blowout: cloud infra +121%, record RPO; ORCL +4%", tickers: "ORCL",
    rec: "HOLD/ADD on AI-cloud momentum — but don't chase the after-hours pop; IV has crushed." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Adobe beats but slips ~2% AH on freemium-monetization caution; CEO transition", tickers: "ADBE",
    rec: "WATCH — oversold with no urgent catalyst; let the guidance/handover dust settle before adding." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Apple unveils iPhone 18 + first foldable 'iPhone Duo' ($1,999); AAPL +2.8%", tickers: "AAPL",
    rec: "HOLD core — product cycle is a tailwind, but a hawkish Fed caps the multiple near-term." },
  { id: "t4", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "Aug CPI (8:30 ET) — last inflation read before FOMC; hot risk for high-multiple tech", tickers: "NVDA · MSFT · GOOGL",
    rec: "DE-RISK into the print; a hot core deepens the hike trade and hits megacap multiples." },
  { id: "t5", ind: "tech", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through continues post-ORCL; semis eye memory setup", tickers: "NVDA · AVGO · MU",
    rec: "WATCH — let capex signal confirm; add on strength, not the first bounce." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Brent tops $108 (highest since July) as Iran war clogs crude flows", tickers: "XOM · CVX · COP",
    rec: "HOLD core E&P for the supply shock; use trailing stops — a ceasefire reverses it fast." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Chevron hits all-time high ~$214; BMO lifts PT to $235", tickers: "CVX",
    rec: "TRIM into strength / buy pullbacks — rally intact but extended near ATH." },
  { id: "e3", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "OPEC+ keeps output unchanged for October amid Iran-war uncertainty", tickers: "XOM · CVX · OXY · USO",
    rec: "Supportive for crude — the cartel is banking the geopolitical premium rather than fighting it." },
  { id: "e4", ind: "energy", dayIdx: 7, future: true, impact: 3, dir: "BULLISH",
    headline: "Strait of Hormuz stays effectively shut (~20% of global supply)", tickers: "XOM · CVX · OXY",
    rec: "Keep a tactical energy overweight as geopolitical insurance; size for headline whips." },
  { id: "e5", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status — inventories vs the Hormuz-closure draw", tickers: "XOM · CVX · USO",
    rec: "A big draw amid the closure reinforces the bull case; watch the crude build vs consensus." },
  { id: "e6", ind: "energy", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Solar selectivity: FSLR / ENPH favored as rates stay high", tickers: "FSLR · ENPH",
    rec: "Be selective — higher-for-longer pressures renewables; favor domestic-manufacturing moats." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "FDA PDUFA — Nuvation zidesamtinib (ROS1+ NSCLC) decision", tickers: "NUVB",
    rec: "BINARY — size small pre-decision; an approval re-rates the commercial-launch story." },
  { id: "h2", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "GLP-1 obesity data flow continues; drug-pricing scrutiny persists", tickers: "LLY · NVO · VKTX",
    rec: "Favor LLY on breadth; fade knee-jerk NVO moves — don't chase headlines." },
  { id: "h3", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Biotech M&A momentum: large-cap pharma refilling pipelines", tickers: "PFE · MRK · ABBV · XBI",
    rec: "Tailwind for SMID biotech (XBI); tilt to de-risked assets that fit pharma's revenue gap." },
  { id: "h4", ind: "health", dayIdx: 8, future: true, impact: 2, dir: "BEARISH",
    headline: "Managed-care margin worries persist into the 2027 rate setup", tickers: "UNH · HUM · CVS",
    rec: "Stay cautious / underweight MCOs until utilization and 2027-rate clarity improve." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "10Y yield jumps to ~4.95% on hot PPI; 2026 rate-hike odds climb", tickers: "JPM · BAC · WFC",
    rec: "Favor asset-sensitive / NII-beneficiary banks; trim long-duration exposure." },
  { id: "f2", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "CPI sets up FOMC — a 25bp rate HIKE is back on the table", tickers: "JPM · BAC · V · MA",
    rec: "Position higher-for-longer; avoid adding rate-duration into the 9/16 FOMC." },
  { id: "f3", ind: "finance", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (2pm ET) + dot plot — hold at 3.50–3.75% vs 25bp hike", tickers: "JPM · BAC · SPY · TLT",
    rec: "Biggest macro swing in the window — keep dry powder into the dots & presser." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 1, dir: "MIXED",
    headline: "Weekly jobless claims steady ~206K — labor market still firm", tickers: "XLF · SPY",
    rec: "Firm labor backs the hawkish path; limited near-term relief for duration." },
  { id: "f5", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Post-FOMC repricing + Fed-speak digestion", tickers: "JPM · BAC · SPY",
    rec: "Let the curve settle; favor NII beneficiaries if higher-for-longer sticks." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Aug retail sales (8:30 ET) — consumer check, same day as the FOMC", tickers: "WMT · TGT · AMZN",
    rec: "A hot number complicates the Fed; watch the discretionary-vs-staples split." },
  { id: "c2", ind: "consumer", dayIdx: 9, future: true, impact: 3, dir: "BULLISH",
    headline: "FedEx FQ1 earnings (after close) — freight-cycle & guidance tell", tickers: "FDX",
    rec: "BINARY but bullish setup post guidance raise; use defined-risk structures into the print." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Oil >$100 squeezes consumer wallets; discretionary lags staples", tickers: "AMZN · NKE · SBUX",
    rec: "Tilt to staples — the energy tax on the consumer is real while crude stays elevated." },
  { id: "c4", ind: "consumer", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "Back-to-school read-through into the holiday setup", tickers: "WMT · TGT",
    rec: "Watch traffic / margin commentary; no need to pre-position on the calendar." },
  { id: "c5", ind: "consumer", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Costco FQ4 earnings — membership & big-ticket demand read", tickers: "COST",
    rec: "Watch membership renewal & traffic; a premium multiple leaves little room to miss." },

  // ---- FORWARD CATALYSTS (week 2: Sep 18–25) ------------------------------
  { id: "x1", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Quarterly triple witching + S&P rebalance — Sep 18", tickers: "SPY · QQQ · IWM",
    rec: "Expect elevated volume & pin risk; avoid initiating new size into the close." },
  { id: "x2", ind: "tech", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Post-FOMC AI-capex reassessment; rates-vs-growth tug-of-war", tickers: "NVDA · ORCL · AVGO",
    rec: "Re-add on confirmation of capex strength, not the first bounce." },
  { id: "x3", ind: "energy", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories + Hormuz follow-through", tickers: "XOM · CVX · USO",
    rec: "Trade the geopolitical risk premium with trailing stops; de-escalation unwinds it fast." },
  { id: "x4", ind: "energy", dayIdx: 15, future: true, impact: 2, dir: "BULLISH",
    headline: "Energy leadership persists if crude holds >$100", tickers: "XOM · CVX · XLE",
    rec: "Keep a tactical overweight; a ceasefire / Hormuz reopening is the key reversal risk." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "CVX", name: "Chevron", rank: 1, spot: "~$214", sentiment: "Bullish",
    catalyst: "Iran-war supply shock + Hormuz closure; ATH momentum (no earnings in window)",
    iv: "Elevated with oil vol (~30%) — favor spreads over naked longs",
    liq: "Deep large-cap energy chain; tight spreads, heavy OI",
    thesis: "Crude >$100 with Hormuz shut and OPEC+ banking the premium keeps the energy bid. Extended near an all-time high argues for defined-risk structures, not outright long calls.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $210 / sell $225 · Oct 16 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $205 / buy $195 · Oct 16 '26 · ~$3.00 credit · max loss/capital ~$700 · paid to buy the dip" },
      { profile: "Aggressive",   strategy: "Long Call", text: "$220 call · Oct 16 '26 · ~$6.00 debit · cost ~$600 · Δ≈0.45" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 2, spot: "~$165", sentiment: "Bullish",
    catalyst: "Brent >$108; +40% YTD with room vs CVX / XLE outperformance",
    iv: "~28% — moderate; long premium workable",
    liq: "Deepest integrated-oil chain; penny-wide spreads",
    thesis: "Cheapest major on the supply-shock trade with real earnings power at $100 crude — a laggard-catch-up setup that favors a directional call plus a paid dip-buy.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$160 call · Oct 16 '26 · ~$9.00 debit · cost ~$900 · Δ≈0.65" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $165 / sell $175 · Oct 16 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Aggressive",   strategy: "Put Credit Spread", text: "Sell $160 / buy $150 · Oct 16 '26 · ~$3.00 credit · max loss/capital ~$700" },
    ] },
  { ticker: "ORCL", name: "Oracle", rank: 3, spot: "~$163", sentiment: "Bullish",
    catalyst: "FQ1 blowout Sep 10 (cloud infra +121%, record RPO); IV crushed post-print",
    iv: "Collapsed post-earnings (~35%) — debit structures cheaper now",
    liq: "Deep, very active AI-infrastructure chain",
    thesis: "The binary is behind it and IV has crushed, so long premium is cheap again. Play the AI-cloud momentum continuation with defined risk and get paid on dips.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $150 / buy $140 · Oct 16 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $160 / sell $175 · Oct 16 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$175 call · Oct 2 '26 · ~$3.00 debit · cost ~$300 · momentum continuation" },
    ] },
  { ticker: "FDX", name: "FedEx", rank: 4, spot: "~$311", sentiment: "Bullish",
    catalyst: "FQ1 earnings — Thu Sep 17 (after close) · BINARY; guidance raised",
    iv: "Elevated into the print — cut vega / harvest crush",
    liq: "Deep, liquid large-cap transport chain",
    thesis: "Bullish into a binary with rich IV → avoid naked long calls (max crush). Reduce vega with a debit spread, or get paid via a defined-risk credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $300 / sell $320 · Oct 16 '26 · ~$9.00 net debit · cost/max loss ~$900 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $295 / buy $285 · Sep 18 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$320 call · Sep 18 '26 · ~$4.00 debit · cost ~$400 · pure earnings pop" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 5, spot: "~$315", sentiment: "Neutral-to-Bullish",
    catalyst: "iPhone 18 + foldable 'iPhone Duo' launch; but FOMC hike-risk on multiples (Sep 16)",
    iv: "~24% — cheap-ish; range-tolerant structures preferred",
    liq: "Deepest equity chain in the market; penny-wide spreads, huge OI",
    thesis: "Product-cycle tailwind vs a hawkish-Fed headwind on high-multiple tech → range-tolerant, defined-risk structures beat outright direction into the FOMC.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $300 / buy $290 · Oct 16 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Iron Condor", text: "Sell $300p/buy $290p + sell $330c/buy $340c · Oct 16 '26 · ~$3.50 credit · max loss/capital ~$650 · range through FOMC" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $315 / sell $330 · Oct 16 '26 · ~$5.00 net debit · cost/max loss ~$500" },
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
// today line sits on the boundary between Sep 11 and Sep 12
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Sep 11 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Sep 11)
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
