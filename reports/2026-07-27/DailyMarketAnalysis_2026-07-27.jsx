import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Monday, July 27, 2026 (live-researched).
 * Window: last 3 days (Jul 24) → coming 2 weeks (Aug 10).
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

// 18-day axis: Jul 24 .. Aug 10 (last 3 days → coming 2 weeks). Today = index 3 (Jul 27).
const DAYS = [
  { idx: 0, date: "Jul 24", dow: "Fri" },
  { idx: 1, date: "Jul 25", dow: "Sat" },
  { idx: 2, date: "Jul 26", dow: "Sun" },
  { idx: 3, date: "Jul 27", dow: "Mon" }, // TODAY
  { idx: 4, date: "Jul 28", dow: "Tue" },
  { idx: 5, date: "Jul 29", dow: "Wed" },
  { idx: 6, date: "Jul 30", dow: "Thu" },
  { idx: 7, date: "Jul 31", dow: "Fri" },
  { idx: 8, date: "Aug 1", dow: "Sat" },
  { idx: 9, date: "Aug 2", dow: "Sun" },
  { idx: 10, date: "Aug 3", dow: "Mon" },
  { idx: 11, date: "Aug 4", dow: "Tue" },
  { idx: 12, date: "Aug 5", dow: "Wed" },
  { idx: 13, date: "Aug 6", dow: "Thu" },
  { idx: 14, date: "Aug 7", dow: "Fri" },
  { idx: 15, date: "Aug 8", dow: "Sat" },
  { idx: 16, date: "Aug 9", dow: "Sun" },
  { idx: 17, date: "Aug 10", dow: "Mon" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Nasdaq −2.1%: AI-capex fears bite; Alphabet −7%, Tesla −14% on earnings", tickers: "GOOGL · TSLA · QQQ",
    rec: "Don't chase the capex-scare selloff; hold quality and let this week's megacap prints reset sentiment." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Alphabet lifts 2026 capex to $195–205B — AI-spend-vs-returns scrutiny rises", tickers: "GOOGL · META · MSFT",
    rec: "Favor names showing AI monetization, not just spend; capex without revenue proof gets punished." },
  { id: "t3", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "Big Tech earnings week begins — MSFT/META (Wed), AAPL/AMZN (Thu)", tickers: "MSFT · META · AAPL · AMZN",
    rec: "Trim size before the prints; guidance and capex commentary — not the beats — will set direction." },
  { id: "t4", ind: "tech", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft & Meta report after close — Azure growth & AI capex the swing factor", tickers: "MSFT · META",
    rec: "Use defined-risk into the binary; strong Azure/ad pricing re-rates, heavy capex compresses margins." },
  { id: "t5", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Apple & Amazon report after close — AWS margin, iPhone & services in focus", tickers: "AAPL · AMZN",
    rec: "Wait for the print; AWS reacceleration and services strength are the bull tells to confirm." },
  { id: "t6", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "AMD earnings — AI GPU/datacenter read-through after megacap capex guides", tickers: "AMD · NVDA",
    rec: "Watch the datacenter guide; it confirms or fades the AI-capex trade for the semis." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Oil plunges as Hormuz reopens; WTI ~$68.5, Brent ~$72 back to pre-war levels", tickers: "XOM · CVX · USO",
    rec: "Supply-shock premium is unwinding — avoid chasing energy longs while geopolitics fades." },
  { id: "e2", ind: "energy", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude/product inventories)", tickers: "XOM · CVX · USO",
    rec: "Use draws/builds to time entries; the OPEC+ supply picture dominates near-term crude." },
  { id: "e3", ind: "energy", dayIdx: 9, future: true, impact: 3, dir: "BEARISH",
    headline: "OPEC+ meets — 8 producers expected to add another ~188K bpd for September", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut new energy longs into the decision; another supply hike into soft demand caps crude." },
  { id: "e4", ind: "energy", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Exxon & Chevron Q2 earnings — buybacks & cash flow with oil back near $68", tickers: "XOM · CVX",
    rec: "Lower crude pressures upstream; watch buyback pace and downstream/refining margins." },
  { id: "e5", ind: "energy", dayIdx: 12, future: true, impact: 1, dir: "MIXED",
    headline: "EIA inventories + post-OPEC digestion", tickers: "USO · XOM · CVX",
    rec: "Trade the range; a supply-heavy backdrop keeps a lid on crude and E&P upside." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Novo Nordisk sues Lilly over alleged misleading GLP-1 ad claims", tickers: "LLY · NVO",
    rec: "Legal noise, not fundamentals — LLY's pipeline/volume lead is intact; don't trade the headline." },
  { id: "h2", ind: "health", dayIdx: 4, future: true, impact: 1, dir: "BULLISH",
    headline: "Medicare GLP-1 access program ($50/mo Wegovy/Zepbound) ramps", tickers: "LLY · NVO",
    rec: "Structural volume tailwind for the GLP-1 leaders; favor LLY on execution and pipeline depth." },
  { id: "h3", ind: "health", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Capricor FDA AdCom for cardiac cell therapy (PDUFA Aug 22) · BINARY", tickers: "CAPR",
    rec: "Binary AdCom — size tiny; a favorable vote de-risks the late-August PDUFA decision." },
  { id: "h4", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "AbbVie & Merck report Q2 — immunology / oncology guides in focus", tickers: "ABBV · MRK",
    rec: "Steady defensives amid tech volatility; watch Skyrizi/Rinvoq and Keytruda LOE commentary." },
  { id: "h5", ind: "health", dayIdx: 12, future: true, impact: 3, dir: "BULLISH",
    headline: "Eli Lilly Q2 earnings — Mounjaro/Zepbound growth & oral GLP-1 update · BINARY", tickers: "LLY · NVO",
    rec: "High-conviction binary; a beat plus an orforglipron update extends LLY's lead over Novo." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "10Y yield near ~4.5% ahead of the Fed; bank NII in focus", tickers: "JPM · BAC · WFC",
    rec: "Favor asset-sensitive banks if the Fed stays higher-for-longer; avoid adding rate duration pre-FOMC." },
  { id: "f2", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision — Fed expected to hold 3.50–3.75% (Warsh presser, no SEP)", tickers: "JPM · BAC · SPY · TLT",
    rec: "The signal lives in the statement & presser; keep dry powder and fade the knee-jerk move." },
  { id: "f3", ind: "finance", dayIdx: 5, future: true, impact: 2, dir: "BULLISH",
    headline: "Visa FQ3 earnings — payments volume & cross-border tell", tickers: "V · MA",
    rec: "Hold V as a compounder; strong cross-border volume is the bull confirm for the network duopoly." },
  { id: "f4", ind: "finance", dayIdx: 6, future: true, impact: 2, dir: "BULLISH",
    headline: "Mastercard Q2 earnings — consumer-spend read-through", tickers: "MA · V",
    rec: "Steady swipe volumes support the payments duopoly; use weakness to add quality." },
  { id: "f5", ind: "finance", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing PMI (July) opens a data-heavy week", tickers: "SPY · XLI",
    rec: "A sub-50 print keeps the growth-scare narrative; watch prices-paid for tariff pass-through." },
  { id: "f6", ind: "finance", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "July jobs report (NFP) — first big labor read after the Fed", tickers: "SPY · JPM · TLT",
    rec: "The window's biggest macro swing; a hot print revives hike odds, a soft one helps duration/rate-cut bets." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 1, dir: "BULLISH",
    headline: "Blue chips rebound as oil plunges; Dow +0.46% on value rotation", tickers: "DIA · SPY",
    rec: "Cheaper energy costs help value/defensives; a constructive offset to megacap-tech volatility." },
  { id: "c2", ind: "consumer", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Coca-Cola & Boeing report Q2 — staples ballast vs. BA delivery cadence", tickers: "KO · BA",
    rec: "KO is defensive ballast; on BA watch 737/787 deliveries and free cash flow, not the headline EPS." },
  { id: "c3", ind: "consumer", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "PayPal & Mondelez report — fintech margins & staples demand check", tickers: "PYPL · MDLZ",
    rec: "Watch PYPL branded-checkout margins and MDLZ volume/pricing for the consumer-health read." },
  { id: "c4", ind: "consumer", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Ford Q2 earnings — affordability pressure & EV losses", tickers: "F · GM",
    rec: "Watch guidance and tariff tone; lean to hybrid-strong names over pure-EV volume risk." },
  { id: "c5", ind: "consumer", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Disney FQ3 earnings — parks & streaming profitability watch", tickers: "DIS",
    rec: "Wait for the print; DTC margin trajectory and parks demand are the swing factors." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "MSFT", name: "Microsoft", rank: 1, spot: "~$381", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Wed Jul 29 (after close) · BINARY (Azure/AI)",
    iv: "Elevated into print (~±6% implied) — rich", liq: "Deepest software chain; penny-wide spreads, huge OI",
    thesis: "Bullish into a binary with rich IV after a pullback to ~$381. Cut vega with a debit spread, or get paid via a defined-risk put credit spread to harvest the post-print crush.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $370 / buy $360 · Aug 21 '26 · ~$3.20 credit · max loss/capital ~$680 · bullish, range-tolerant, harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $385 / sell $400 · Aug 21 '26 · ~$6.00 net debit · cost/max loss ~$600 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$395 call · Jul 31 '26 · ~$3.50 debit · cost ~$350 · pure earnings-pop lottery" },
    ] },
  { ticker: "META", name: "Meta Platforms", rank: 2, spot: "~$600", sentiment: "Bullish",
    catalyst: "Q2 earnings — Wed Jul 29 (after close) · BINARY (ad growth vs. capex)",
    iv: "Very rich (~±7% implied) into the print", liq: "Deep, very active mega-cap chain",
    thesis: "Ad impressions +19% / pricing +12% support the bull case, but $125–145B capex guidance is the swing risk. Expensive IV → defined-risk only: debit spread up, or credit spread to get paid.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $595 / sell $615 · Aug 21 '26 · ~$9.00 net debit · cost/max loss ~$900 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $580 / buy $570 · Jul 31 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$620 call · Jul 31 '26 · ~$6.00 debit · cost ~$600 · earnings breakout" },
    ] },
  { ticker: "AMZN", name: "Amazon", rank: 3, spot: "~$244", sentiment: "Bullish",
    catalyst: "Q2 earnings — Thu Jul 30 (after close) · BINARY (AWS margin)",
    iv: "Elevated (~±6% implied) into the print", liq: "Deepest retail/cloud chain; tight spreads",
    thesis: "AWS reacceleration and retail-margin leverage are the bull tells. Rich IV into a binary → get paid below support with a put credit spread, or spread up for defined-cost upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $235 / buy $225 · Aug 21 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $245 / sell $260 · Aug 21 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$255 call · Jul 31 '26 · ~$2.50 debit · cost ~$250 · pure AWS-beat pop" },
    ] },
  { ticker: "LLY", name: "Eli Lilly", rank: 4, spot: "~$1,200", sentiment: "Bullish",
    catalyst: "Q2 earnings — Wed Aug 5 (before open) · BINARY (GLP-1 + oral)",
    iv: "Rich into the print (~±7% implied)", liq: "Liquid mega-cap chain; wide strikes, $ premiums high",
    thesis: "Mounjaro/Zepbound growth + an orforglipron update extend the lead over Novo. Stock is too pricey for long calls under the cap, so use defined-risk spreads only (net debit / max loss ≤ $1,500).",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1180 / sell $1200 · Aug 21 '26 · ~$10 net debit · cost/max loss ~$1,000 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1150 / buy $1135 · Aug 7 '26 · ~$5.00 credit · max loss/capital ~$1,000 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1220 / sell $1240 · Aug 7 '26 · ~$7.00 net debit · cost/max loss ~$700 · breakout" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 5, spot: "~$298", sentiment: "Neutral-to-Bullish",
    catalyst: "FQ3 earnings — Thu Jul 30 (after close) · BINARY (iPhone/services)",
    iv: "Moderate (~±5% implied) — cheaper than peers", liq: "Deepest equity chain in the market; huge OI",
    thesis: "Lower expectations and a cheaper IV regime than the other megacaps. Sell premium below support for a bullish, range-tolerant credit spread; spread up cheaply for the services-margin surprise.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $290 / buy $280 · Aug 21 '26 · ~$3.20 credit · max loss/capital ~$680 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $300 / sell $315 · Aug 21 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$310 call · Jul 31 '26 · ~$2.00 debit · cost ~$200 · earnings-pop lottery" },
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
// today line sits on the boundary between Jul 27 and Jul 28
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Monday, Jul 27 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 27)
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
