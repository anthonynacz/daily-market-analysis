import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Sunday, June 7, 2026 (live-researched).
 * Window: last 3 days (Jun 4) → coming 2 weeks (Jun 21).
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

// 18-day axis: Jun 4 .. Jun 21 (last 3 days → coming 2 weeks). Today = index 3 (Jun 7).
const DAYS = [
  { idx: 0, date: "Jun 4", dow: "Thu" },
  { idx: 1, date: "Jun 5", dow: "Fri" },
  { idx: 2, date: "Jun 6", dow: "Sat" },
  { idx: 3, date: "Jun 7", dow: "Sun" }, // TODAY
  { idx: 4, date: "Jun 8", dow: "Mon" },
  { idx: 5, date: "Jun 9", dow: "Tue" },
  { idx: 6, date: "Jun 10", dow: "Wed" },
  { idx: 7, date: "Jun 11", dow: "Thu" },
  { idx: 8, date: "Jun 12", dow: "Fri" },
  { idx: 9, date: "Jun 13", dow: "Sat" },
  { idx: 10, date: "Jun 14", dow: "Sun" },
  { idx: 11, date: "Jun 15", dow: "Mon" },
  { idx: 12, date: "Jun 16", dow: "Tue" },
  { idx: 13, date: "Jun 17", dow: "Wed" },
  { idx: 14, date: "Jun 18", dow: "Thu" },
  { idx: 15, date: "Jun 19", dow: "Fri" },
  { idx: 16, date: "Jun 20", dow: "Sat" },
  { idx: 17, date: "Jun 21", dow: "Sun" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Broadcom FQ2: beat on rev/EPS but soft AI guide ($16B vs $17.2B est); AVGO −14%", tickers: "AVGO",
    rec: "Don't catch the knife — guidance, not results, was the miss; nibble only on an AI-capex reassurance." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Chip rout: Nasdaq −4.2%, worst day since Apr '25 (MU −6%, MRVL −8%, AMD −6%, ARM sink)", tickers: "NVDA · MU · MRVL · AMD",
    rec: "Hold quality (NVDA); use the AI-sentiment reset to scale into dips — don't chase the first bounce." },
  { id: "t3", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "May CPI (8:30 ET) — a hot print is a body blow to high-multiple tech", tickers: "NVDA · MSFT · GOOGL",
    rec: "De-risk into the print; a cool number reignites the AI trade, a hot one compresses megacap multiples." },
  { id: "t4", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Adobe FQ2 earnings (after close) — AI-monetization tell · BINARY", tickers: "ADBE",
    rec: "Wait for the print; Firefly/AI ARR traction re-rates software, a soft guide extends the derating." },
  { id: "t5", ind: "tech", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "Oracle FQ4 earnings (after close) — OCI bookings / AI-capex tell · BINARY", tickers: "ORCL",
    rec: "Strong RPO/OCI bookings re-rate the AI-infra trade; a weak guide deepens the chip-complex selloff." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Energy outperforms as Strait of Hormuz stays shut; APA / OXY / TPL lead", tickers: "XOM · CVX · OXY · APA",
    rec: "Keep core E&P for the supply shock; use trailing stops — a peace deal unwinds the trade fast." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 3, dir: "MIXED",
    headline: "Crude elevated (gas >$4/gal) but oil momentum cools on US-Iran peace talks", tickers: "XOM · CVX · USO",
    rec: "Trim if up big into the weekend; the risk premium is two-sided now that negotiations are live." },
  { id: "e3", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "XOM · CVX · USO",
    rec: "A big draw amid the Hormuz closure reinforces the bull case — geopolitics still trumps fundamentals." },
  { id: "e4", ind: "energy", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Hormuz / US-Iran peace-talk headline risk persists", tickers: "XOM · CVX · OXY",
    rec: "Trade the risk premium with trailing stops; a ceasefire headline reverses energy sharply." },
  { id: "e5", ind: "energy", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories + OPEC+ supply follow-through", tickers: "XOM · CVX · USO",
    rec: "Watch the draw vs. consensus; fading momentum funds are already trimming oil length." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "CVS Caremark adds Lilly's oral Foundayo to formulary (Jun 1); Zepbound back Oct 1", tickers: "LLY · CVS",
    rec: "Formulary win cements LLY's GLP-1 lead; hold LLY — the access story is a durable tailwind." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "FDA moves to bar 503B bulk compounding of semaglutide / tirzepatide", tickers: "LLY · NVO · HIMS",
    rec: "Bullish branded GLP-1 (LLY/NVO), bearish compounders (HIMS); favor the originators." },
  { id: "h3", ind: "health", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "GLP-1 pricing-war watch: Lilly oral ramp vs Novo's 2026 sales decline", tickers: "LLY · NVO · VKTX",
    rec: "Own the share-gainer (LLY); fade knee-jerk NVO bounces as exclusivity erodes abroad." },
  { id: "h4", ind: "health", dayIdx: 14, future: true, impact: 1, dir: "BULLISH",
    headline: "Biotech M&A momentum continues as pharma fills its patent-cliff revenue gap", tickers: "PFE · MRK · XBI",
    rec: "Tailwind for de-risked SMID biotech (XBI); tilt to names that fit big-pharma's pipeline holes." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "MIXED",
    headline: "May jobs +172K blow past ~80K est.; 10Y yield jumps, rate-hike bets surge", tickers: "JPM · BAC · WFC · GS",
    rec: "Favor asset-sensitive / NII banks (JPM/BAC); trim long-duration & rate-sensitive asset managers." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "MIXED",
    headline: "Rate-HIKE odds spike post-payrolls: >60% by Oct, ~98% by December", tickers: "JPM · BAC · V · MA",
    rec: "Position higher-for-longer; avoid adding rate-duration into the 6/17 FOMC." },
  { id: "f3", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Financials rally — KBW Nasdaq Bank Index +3.6%", tickers: "GS · MS · BAC · JPM",
    rec: "Take partial profits into a 3.6% one-day index pop rather than chase the move." },
  { id: "f4", ind: "finance", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "May CPI — first inflation read before the FOMC (core est ~+0.2% m/m)", tickers: "JPM · BAC · SPY",
    rec: "Biggest swing risk of the window; keep dry powder until after the print." },
  { id: "f5", ind: "finance", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (Jun 17) — hot data revives the hike debate", tickers: "JPM · BAC · SPY · TLT",
    rec: "Macro pivot of the window; asset-sensitive banks win on a hawkish hold/hike — watch the dots." },
  { id: "f6", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Quarterly triple witching — Jun 19", tickers: "SPY · QQQ · IWM",
    rec: "Expect elevated volume & pin risk; avoid initiating new size into the close." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Lululemon −10%+ after cutting Q2 & full-year outlook", tickers: "LULU",
    rec: "Avoid the knife; discretionary momentum is fading as inflation bites — wait for a base." },
  { id: "c2", ind: "consumer", dayIdx: 0, future: false, impact: 1, dir: "BEARISH",
    headline: "Spending caution flagged as April CPI hit 3.8% (highest since '23)", tickers: "XLY · AMZN · TGT",
    rec: "Underweight discretionary; favor staples / value as real incomes get squeezed." },
  { id: "c3", ind: "consumer", dayIdx: 7, future: true, impact: 2, dir: "BULLISH",
    headline: "FIFA World Cup kicks off in the US (Jun 11) — travel / leisure / ad tailwind", tickers: "DKNG · ABNB · DIS",
    rec: "Constructive for travel, leisure & ad names; play confirmed beneficiaries, not the whole basket." },
  { id: "c4", ind: "consumer", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "Retail-sales preview / consumer-health watch", tickers: "WMT · TGT · AMZN",
    rec: "Lean to value & traffic winners (WMT); use any soft print to fade discretionary." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (selected by IV regime, sentiment & binary risk)
// and a `profile` (risk appetite). Defined-risk + cash-secured only — no naked shorts.
const OPTION_PLAYS = [
  { ticker: "ORCL", name: "Oracle", rank: 1, spot: "~$240 (est)", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Tue Jun 16 (after close) · BINARY",
    iv: "~70% / IVR ~90 — VERY RICH (±~11% implied) · EST", liq: "Deep, very active AI-infrastructure chain",
    thesis: "Bullish into a binary with expensive IV → skip naked long calls (max crush). Cut vega with a debit spread, or get paid via defined-risk short premium.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $230 / sell $250 · Jul 17 '26 · ~$9 net debit · max loss $9 · vega-reduced" },
      { profile: "Moderate",     strategy: "Cash-Secured Put", text: "Sell $225 put · Jun 19 '26 · ~$6 credit · net buy $219; collateral ~$22.5k" },
      { profile: "Aggressive",   strategy: "Put Credit Spread", text: "Sell $230 / buy $220 · Jun 19 '26 · ~$3.20 credit · max loss $6.80 · harvests IV crush" },
    ] },
  { ticker: "AVGO", name: "Broadcom", rank: 2, spot: "~$215 (est)", sentiment: "Neutral-to-Bullish",
    catalyst: "Post-earnings oversold bounce; AI-capex read-through into ORCL Jun 16",
    iv: "Elevated post-print (~45%) · EST", liq: "Deep mega-cap semi chain; tight spreads, huge OI",
    thesis: "Sold off ~14% on guidance, not results — oversold with still-rich IV. Sell premium below support and spread up for a defined-cost rebound; no naked risk.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $190 / buy $180 · Jul 17 '26 · ~$3 credit · max loss $7 · range-tolerant bullish" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $210 / sell $230 · Jun 19 '26 · ~$8 net debit · max loss $8" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$230 call · Jun 19 '26 · ~$3 debit · pure bounce play" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 3, spot: "~$125 (est)", sentiment: "Bullish",
    catalyst: "Strait of Hormuz supply shock; EIA prints + peace-talk headline risk",
    iv: "Elevated on oil vol (~35%) · EST", liq: "Deep, liquid large-cap energy chain",
    thesis: "Geopolitical supply premium is real but two-sided (live US-Iran talks). Get paid to own lower via a short put; spread up for capped upside instead of naked calls.",
    ideas: [
      { profile: "Conservative", strategy: "Cash-Secured Put", text: "Sell $118 put · Jul 17 '26 · ~$3.50 credit · net buy $114.50; collateral ~$11.8k" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $125 / sell $135 · Jul 17 '26 · ~$4 net debit · max loss $4" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$130 call · Jun 19 '26 · ~$1.80 debit · Hormuz spike" },
    ] },
  { ticker: "BAC", name: "Bank of America", rank: 4, spot: "~$46 (est)", sentiment: "Bullish",
    catalyst: "Higher-for-longer NII; CPI Jun 10 + FOMC Jun 17 catalysts",
    iv: "Moderate (~28%) — CHEAP-ish · EST", liq: "Deep, penny-wide mega-bank chain",
    thesis: "Most asset-sensitive of the big banks — a hawkish hold/hike steepens the NII tailwind. Cheap IV favors defined-cost long premium; sell a put on a name you'd own.",
    ideas: [
      { profile: "Conservative", strategy: "Cash-Secured Put", text: "Sell $44 put · Jul 17 '26 · ~$1.10 credit · net buy $42.90; collateral ~$4.4k" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $46 / sell $50 · Jul 17 '26 · ~$1.50 net debit · max loss $1.50" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$48 call · Jun 19 '26 · ~$0.55 debit · post-CPI/FOMC steepener" },
    ] },
  { ticker: "LLY", name: "Eli Lilly", rank: 5, spot: "~$900 (est)", sentiment: "Bullish",
    catalyst: "GLP-1 leadership: oral Foundayo approval + CVS formulary win; FDA compounding curbs",
    iv: "Moderate-high (~40%) · EST", liq: "Deep mega-cap pharma chain; wide notional",
    thesis: "Pulling decisively ahead of Novo on oral + injectable GLP-1. High share price → use narrow debit spreads to keep net debit small; short put to accumulate the leader.",
    ideas: [
      { profile: "Conservative", strategy: "Cash-Secured Put", text: "Sell $850 put · Jul 17 '26 · ~$18 credit · net buy $832; collateral ~$85k" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $900 / sell $920 · Jun 19 '26 · ~$9 net debit · max loss $9" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$920 call · Jun 19 '26 · ~$13 debit · momentum continuation" },
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
// today line sits on the boundary between Jun 7 and Jun 8
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Sunday, Jun 7 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jun 7)
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
