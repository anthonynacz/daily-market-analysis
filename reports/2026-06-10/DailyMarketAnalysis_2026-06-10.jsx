import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Wednesday, June 10, 2026 (live-researched).
 * Window: last 3 days (Jun 7) → coming 2 weeks (Jun 24).
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

// 18-day axis: Jun 7 .. Jun 24 (last 3 days → coming 2 weeks). Today = index 3 (Jun 10).
const DAYS = [
  { idx: 0, date: "Jun 7", dow: "Sun" },
  { idx: 1, date: "Jun 8", dow: "Mon" },
  { idx: 2, date: "Jun 9", dow: "Tue" },
  { idx: 3, date: "Jun 10", dow: "Wed" }, // TODAY
  { idx: 4, date: "Jun 11", dow: "Thu" },
  { idx: 5, date: "Jun 12", dow: "Fri" },
  { idx: 6, date: "Jun 13", dow: "Sat" },
  { idx: 7, date: "Jun 14", dow: "Sun" },
  { idx: 8, date: "Jun 15", dow: "Mon" },
  { idx: 9, date: "Jun 16", dow: "Tue" },
  { idx: 10, date: "Jun 17", dow: "Wed" },
  { idx: 11, date: "Jun 18", dow: "Thu" },
  { idx: 12, date: "Jun 19", dow: "Fri" },
  { idx: 13, date: "Jun 20", dow: "Sat" },
  { idx: 14, date: "Jun 21", dow: "Sun" },
  { idx: 15, date: "Jun 22", dow: "Mon" },
  { idx: 16, date: "Jun 23", dow: "Tue" },
  { idx: 17, date: "Jun 24", dow: "Wed" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Chip selloff deepens on Iran risk-off; AVGO, MU tumble (NVDA −1.4%)", tickers: "NVDA · AVGO · MU",
    rec: "Hold quality (NVDA); use the AI-sentiment reset to scale into dips — don't chase." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Apple −4% as investors doubt its AI roadmap after WWDC keynote", tickers: "AAPL",
    rec: "WATCH — wait for stabilization; cheap IV makes defined-risk dip-buys reasonable below support." },
  { id: "t3", ind: "tech", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "Oracle FQ4 earnings (after close) — AI-capex bellwether · BINARY", tickers: "ORCL",
    rec: "Strong OCI / RPO bookings re-rate the AI-infra trade; a soft cloud guide deepens the selloff. Size before the print." },
  { id: "t4", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Adobe FQ2 earnings (after close) — Firefly AI monetization tell · BINARY", tickers: "ADBE",
    rec: "Low expectations; a clean AI-ARR beat is the bull trigger, a soft creative guide pressures it." },
  { id: "t5", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Microsoft expands KPMG AI partnership; MSFT outperforms megacap peers", tickers: "MSFT",
    rec: "HOLD — durable enterprise-AI demand; add on macro-driven weakness, not strength." },
  { id: "t6", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through continues post ORCL / ADBE prints", tickers: "NVDA · ORCL · AVGO",
    rec: "Let the dust settle; re-add on confirmed capex strength, not the first bounce." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Crude spikes (WTI ~$95) after weekend Israel–Iran strikes; Hormuz blockaded", tickers: "XOM · CVX · COP",
    rec: "Core E&P benefits from the supply shock; trim into spikes given ceasefire-reversal risk." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "Oil whips lower (~$88) on a fragile Israel–Iran ceasefire; energy gives back gains", tickers: "XOM · CVX · USO",
    rec: "Trade the Hormuz risk premium with trailing stops; a durable ceasefire unwinds it fast." },
  { id: "e3", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (10:30 ET)", tickers: "XOM · CVX · USO",
    rec: "Watch the draw vs. consensus; a big draw amid the Hormuz disruption reinforces the bull case." },
  { id: "e4", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Energy stays headline-driven into the weekend on ceasefire durability", tickers: "XOM · CVX · OXY",
    rec: "Cut new directional size into the weekend; geopolitics dominates fundamentals right now." },
  { id: "e5", ind: "energy", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "EIA petroleum report — crude inventories post-disruption", tickers: "XOM · CVX · USO",
    rec: "Inventory swings are amplified by Hormuz; use prints to time entries, not to chase." },
  { id: "e6", ind: "energy", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Hormuz reopening timeline in focus as the 'two-week' deadline nears", tickers: "XOM · CVX · OXY",
    rec: "A reopening deflates the risk premium; keep energy as tactical insurance with stops." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Novo Nordisk raises 2026 outlook on record Wegovy-pill volumes", tickers: "NVO · LLY",
    rec: "HOLD/ADD NVO on oral-GLP-1 momentum; expect continued GLP-1 share-war volatility." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Managed-care pressure lingers on 2027 Medicare Advantage rate worries", tickers: "UNH · HUM · CVS",
    rec: "Stay cautious / underweight managed care until 2027-rate and policy clarity improve." },
  { id: "h3", ind: "health", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "ADA 2026 Scientific Sessions open — GLP-1 / obesity data flow", tickers: "LLY · NVO · VKTX",
    rec: "Size before headlines; a clean Lilly readout is bullish LLY — fade knee-jerk NVO moves." },
  { id: "h4", ind: "health", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "ADA follow-through — GLP-1 data digestion across the group", tickers: "LLY · NVO · VKTX",
    rec: "Volatility persists; favor LLY on a clean profile, don't chase single-abstract pops." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "BEARISH",
    headline: "May CPI hot at 4.2% YoY (highest since '23) on +23.5% energy; 10Y jumps", tickers: "JPM · BAC · SPY · TLT",
    rec: "Higher-for-longer — favor asset-sensitive banks (JPM/BAC); avoid adding rate-duration into FOMC." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Rate-cut hopes fade; 2026 hold-or-hike repricing pressures rate-sensitives", tickers: "JPM · BAC · V · MA",
    rec: "Position higher-for-longer: banks win on NII; trim long-duration / asset-manager exposure." },
  { id: "f3", ind: "finance", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "May retail sales (8:30 ET) — consumer-resilience check pre-FOMC", tickers: "XLY · WMT · AMZN",
    rec: "A soft print eases hike fears (bullish duration); a hot one compounds CPI hawkishness." },
  { id: "f4", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (2 ET) — Warsh's first meeting; hold expected at 3.50–3.75%", tickers: "JPM · BAC · SPY · TLT",
    rec: "Biggest macro swing in the window; keep dry powder into the dots & presser — hot CPI raises hawkish-surprise risk." },
  { id: "f5", ind: "finance", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Quarterly triple witching — Jun 19", tickers: "SPY · QQQ · IWM",
    rec: "Expect elevated volume & pin risk; avoid initiating new size into the close." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Consumer discretionary lags on the inflation squeeze; staples bid", tickers: "XLY · XLP · WMT",
    rec: "Tilt defensive within consumer; favor staples / value-retail over big-ticket discretionary." },
  { id: "c2", ind: "consumer", dayIdx: 0, future: false, impact: 1, dir: "BULLISH",
    headline: "Walmart pulls its promo calendar forward to body-check Amazon", tickers: "WMT · AMZN · TGT",
    rec: "Constructive for WMT traffic / share gains; hold or add into the promo window." },
  { id: "c3", ind: "consumer", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "FedEx FQ4 earnings (after close) — freight demand & tariff read · BINARY", tickers: "FDX",
    rec: "A bellwether for global shipping; wait for the print — guidance, not the quarter, will move it." },
  { id: "c4", ind: "consumer", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Auto demand check: affordability pressures favor hybrids over EVs", tickers: "F · GM · TSLA",
    rec: "Lean to hybrid-strong names; trim Ford on volume erosion; hold TSLA pending deliveries." },
  { id: "c5", ind: "consumer", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Nike FQ4 earnings on deck (Jun 25) — turnaround-progress watch", tickers: "NKE",
    rec: "Contrarian near multi-year lows; size before headlines and prefer defined-risk into the binary." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (selected by IV regime, sentiment & binary risk)
// and a `profile` (risk appetite). Defined-risk + cash-secured only — no naked shorts.
const OPTION_PLAYS = [
  { ticker: "ORCL", name: "Oracle", rank: 1, spot: "~$235", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Wed Jun 10 (after close) · BINARY",
    iv: "~70% / IVR ~90 — VERY RICH (±~11% implied)", liq: "Deep, very active AI-infrastructure chain",
    thesis: "Bullish into a binary with expensive IV → avoid naked long calls (max crush). Cut vega with a debit spread, or get paid via defined-risk short premium that harvests the IV crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $230 / sell $250 · Jul 17 '26 · ~$9 net debit · max loss $9 · vega-reduced" },
      { profile: "Moderate",     strategy: "Cash-Secured Put", text: "Sell $220 put · Jun 19 '26 · ~$6 credit · net buy $214; collateral ~$22k" },
      { profile: "Aggressive",   strategy: "Put Credit Spread", text: "Sell $220 / buy $210 · Jun 12 '26 · ~$3 credit · max loss $7 · harvests IV crush" },
    ] },
  { ticker: "ADBE", name: "Adobe", rank: 2, spot: "~$255", sentiment: "Neutral-to-Bullish",
    catalyst: "FQ2 earnings — Thu Jun 11 (after close) · BINARY",
    iv: "Elevated (~±8% implied move)", liq: "Deep large-cap software chain; tight spreads",
    thesis: "Oversold, low expectations, but a binary print → defined-risk, range-tolerant structures. Sell elevated premium below support; spread up for cheap upside without paying full vega.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $245 / buy $235 · Jul 17 '26 · ~$3 credit · max loss $7 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $255 / sell $275 · Jun 19 '26 · ~$7 net debit · max loss $7" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$270 call · Jun 12 '26 · ~$2.50 debit · post-earnings pop" },
    ] },
  { ticker: "FDX", name: "FedEx", rank: 3, spot: "~$330", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Tue Jun 23 (after close) · BINARY",
    iv: "Elevated into earnings; unusual call activity flagged", liq: "Deep, liquid large-cap chain",
    thesis: "Beaten-down global-shipping bellwether into a binary; freight demand and tariff commentary are the swing factors. Pair a paid-to-wait short put with a defined-cost call spread.",
    ideas: [
      { profile: "Conservative", strategy: "Cash-Secured Put", text: "Sell $320 put · Jul 17 '26 · ~$9 credit · net buy $311; collateral ~$32k" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $350 · Jun 26 '26 · ~$8 net debit · max loss $8" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$350 call · Jun 26 '26 · ~$3 debit · upside breakout" },
    ] },
  { ticker: "NKE", name: "Nike", rank: 4, spot: "~$44", sentiment: "Bullish (contrarian)",
    catalyst: "FQ4 earnings — ~Jun 25 (after close) · BINARY",
    iv: "~54% (±~11% implied) — rich on a cheap stock", liq: "Deep mega-cap chain; low $ premiums",
    thesis: "Max-pessimism turnaround near multi-year lows with rich IV → get paid to accumulate via short puts; cheap call for the asymmetric pop, debit spread to cap cost.",
    ideas: [
      { profile: "Conservative", strategy: "Cash-Secured Put", text: "Sell $42 put · Jul 17 '26 · ~$2.10 credit · net buy $39.90; collateral ~$4.2k" },
      { profile: "Moderate",     strategy: "Long Call (ITM)", text: "$42 call · Jul 17 '26 · ~$3.50 debit · Δ≈0.65" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $44 / sell $50 · Jul 2 '26 · ~$1.60 net debit · max loss $1.60" },
    ] },
  { ticker: "XOM", name: "Exxon Mobil", rank: 5, spot: "~$126", sentiment: "Bullish (geopolitical)",
    catalyst: "Hormuz risk premium + EIA inventories; ceasefire-reversal risk",
    iv: "Elevated on the oil shock (~±7% implied)", liq: "Deep, liquid mega-cap energy chain",
    thesis: "Energy is the best 2026 S&P sector and carries a live Hormuz risk premium, but a durable Israel–Iran ceasefire would unwind it fast → defined-risk only, vega-light. Get paid to own quality on a pullback.",
    ideas: [
      { profile: "Conservative", strategy: "Cash-Secured Put", text: "Sell $118 put · Jul 17 '26 · ~$3 credit · net buy $115; collateral ~$11.8k" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $125 / sell $135 · Jul 17 '26 · ~$4 net debit · max loss $4 · vega-light" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$130 call · Jun 26 '26 · ~$2 debit · Hormuz-escalation spike play" },
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
// today line sits on the boundary between Jun 10 and Jun 11
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Wednesday, Jun 10 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jun 10)
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
              Strongest options plays for the coming month — strategy chosen per name by <b style={{ color: "#e2e8f0" }}>IV, sentiment &amp; upcoming binary events</b> (long calls/puts, debit &amp; credit spreads, cash-secured puts). Every idea is <b style={{ color: "#e2e8f0" }}>defined-risk</b> — net debit or max loss <b style={{ color: "#e2e8f0" }}>under $15/contract</b> on a liquid chain. No naked shorts.
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
