import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Monday, July 13, 2026 (live-researched).
 * Window: last 3 days (Jul 10) → coming 2 weeks (Jul 27).
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

// 18-day axis: Jul 10 .. Jul 27 (last 3 days → coming 2 weeks). Today = index 3 (Jul 13).
const DAYS = [
  { idx: 0, date: "Jul 10", dow: "Fri" },
  { idx: 1, date: "Jul 11", dow: "Sat" },
  { idx: 2, date: "Jul 12", dow: "Sun" },
  { idx: 3, date: "Jul 13", dow: "Mon" }, // TODAY
  { idx: 4, date: "Jul 14", dow: "Tue" },
  { idx: 5, date: "Jul 15", dow: "Wed" },
  { idx: 6, date: "Jul 16", dow: "Thu" },
  { idx: 7, date: "Jul 17", dow: "Fri" },
  { idx: 8, date: "Jul 18", dow: "Sat" },
  { idx: 9, date: "Jul 19", dow: "Sun" },
  { idx: 10, date: "Jul 20", dow: "Mon" },
  { idx: 11, date: "Jul 21", dow: "Tue" },
  { idx: 12, date: "Jul 22", dow: "Wed" },
  { idx: 13, date: "Jul 23", dow: "Thu" },
  { idx: 14, date: "Jul 24", dow: "Fri" },
  { idx: 15, date: "Jul 25", dow: "Sat" },
  { idx: 16, date: "Jul 26", dow: "Sun" },
  { idx: 17, date: "Jul 27", dow: "Mon" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "SK Hynix US debut pops +14%; largest-ever foreign US IPO ($26.5B raised)", tickers: "NVDA · AMD · MU",
    rec: "Bullish HBM/AI-memory tell; don't chase the IPO pop — trade the read-through to NVDA/AMD demand." },
  { id: "t2", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Meta +6% Fri caps best week since early 2024 (~+15% on the week)", tickers: "META",
    rec: "Momentum strong but stretched; trim into strength rather than chase a 15% weekly run." },
  { id: "t3", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "NVDA +~4% Fri; megacap tech leads S&P 500 to ~7,575 record close", tickers: "NVDA · MSFT · GOOGL",
    rec: "Hold quality AI leaders; add on dips, not into vertical up days." },
  { id: "t4", ind: "tech", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "ASML Q2 (Wed Jul 15) — EUV bookings are the AI-capex tell", tickers: "ASML · NVDA",
    rec: "Wait for the print; strong orders re-rate AI-infra, a soft booking guide hits the whole complex." },
  { id: "t5", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "BULLISH",
    headline: "TSMC Q2 (Thu Jul 16) — AI/HPC demand check for the chip complex", tickers: "TSM · NVDA · AVGO",
    rec: "Bullish AI read; a strong HPC guide lifts the group — size before the print, don't chase after." },
  { id: "t6", ind: "tech", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Netflix Q2 (Thu Jul 16) — subs & ad-tier momentum; rich IV binary", tickers: "NFLX · DIS",
    rec: "Use defined-risk if playing; don't buy naked premium into a likely post-print IV crush." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "Crude ~$71, +~3.5% on week as US-Iran tension re-flares at the Strait of Hormuz", tickers: "XOM · CVX · COP",
    rec: "Keep tactical E&P as geopolitical insurance; trailing stops — a de-escalation unwinds it fast." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "WTI rebounds off ~$68.50 low; EIA STEO sees Brent averaging ~$74 in 3Q26", tickers: "XOM · CVX · USO",
    rec: "Range-bound tape; trade the Hormuz risk premium tactically — fundamentals stay soft." },
  { id: "e3", ind: "energy", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "EIA Short-Term Energy Outlook read-through (Brent trimmed to ~$74 3Q)", tickers: "XOM · CVX · COP",
    rec: "Keep energy weight modest ex-geopolitics; supply returns as Middle East barrels come back." },
  { id: "e4", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (Wed) — crude inventories", tickers: "XOM · CVX · USO",
    rec: "Watch the draw vs. consensus; a big draw amid Hormuz risk reinforces the bull case." },
  { id: "e5", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "BULLISH",
    headline: "Hormuz shipping-disruption risk persists into next week", tickers: "XOM · CVX · OXY",
    rec: "Supply-shock optionality; keep a tactical overweight with stops — de-escalation reverses it sharply." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 6, future: true, impact: 3, dir: "BULLISH",
    headline: "UnitedHealth Q2 (Thu Jul 16) — margin-recovery test; MS calls it a 'top pick'", tickers: "UNH · HUM · CVS",
    rec: "Bullish contrarian; a clean MLR beat re-rates managed care — size ahead, respect the binary." },
  { id: "h2", ind: "health", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "J&J Q2 (Wed Jul 15) — diversification bet vs GLP-1 hype", tickers: "JNJ",
    rec: "Steady compounder at 29x P/E; hold for MedTech/oncology, not a pop — cheaper than LLY." },
  { id: "h3", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Lilly GLP-1 engine roars: Mounjaro +125%, Zepbound +80%; FY guide raised", tickers: "LLY · NVO · VKTX",
    rec: "Momentum leader but ~40x P/E; add on pullbacks, trim into strength." },
  { id: "h4", ind: "health", dayIdx: 3, future: false, impact: 1, dir: "BULLISH",
    headline: "Medicare GLP-1 'Bridge' program live (Jul 1) — Zepbound/Foundayo ~$50/mo", tickers: "LLY · NVO",
    rec: "Structural demand tailwind; constructive for LLY volumes into 2H26." },
  { id: "h5", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "GLP-1 biotech basket in focus alongside UNH/JNJ prints", tickers: "VKTX · LLY · NVO",
    rec: "Be selective — favor de-risked GLP-1 names; avoid broad biotech baskets." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "BULLISH",
    headline: "Big-bank Q2 blitz (Tue Jul 14, pre-mkt): JPM, GS, BAC, WFC, C", tickers: "JPM · GS · BAC · WFC · C",
    rec: "NIM is the key metric; favor asset-sensitive names (JPM/BAC). Options price ~4-6% moves — use defined risk." },
  { id: "f2", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "June CPI (8:30 ET Tue) — last big inflation print before FOMC blackout", tickers: "SPY · JPM · TLT",
    rec: "Biggest swing risk of the week; keep dry powder, avoid new size into the print." },
  { id: "f3", ind: "finance", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "June PPI (Wed) + Warsh semiannual testimony to Congress (Tue-Wed)", tickers: "SPY · JPM · BAC",
    rec: "Watch pipeline inflation & Warsh's hike/hold tone; a hot combo lifts Sept-hike odds." },
  { id: "f4", ind: "finance", dayIdx: 5, future: true, impact: 2, dir: "BULLISH",
    headline: "Morgan Stanley & BlackRock Q2 (Wed) — wealth / AUM fee tell", tickers: "MS · BLK",
    rec: "Strong markets aid fees; hold quality asset-gatherers, take partial profits on the pop." },
  { id: "f5", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Fed 'family fight' over a Sept hike; CME odds put ~25bp back in play", tickers: "JPM · BAC · SPY",
    rec: "Position higher-for-longer: asset-sensitive banks win; trim long-duration exposure." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Tesla Q2 deliveries 480K (+25% YoY) beat by ~74K, ending a 2-yr slide", tickers: "TSLA",
    rec: "Delivery turn is real but the stock fell ~7% on the print — wait for Q2 earnings before adding." },
  { id: "c2", ind: "consumer", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "United Airlines Q2 (~Jul 16) — travel demand & pricing after Delta's read", tickers: "UAL · DAL · AAL",
    rec: "Watch RASM/guide; Delta already set the tone — trade the guide, not the headline." },
  { id: "c3", ind: "consumer", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "Retail lags: sector flat vs S&P +9% over 6 months", tickers: "WMT · AMZN · TGT",
    rec: "Stay selective — favor scale winners (WMT/AMZN/COST) over broken-model retail." },
  { id: "c4", ind: "consumer", dayIdx: 10, future: true, impact: 1, dir: "MIXED",
    headline: "Amazon Prime Day pulled earlier this year — traffic / GMV watch", tickers: "AMZN · WMT · TGT",
    rec: "Constructive for AMZN GMV; hold into the promo window, don't chase." },
  { id: "c5", ind: "consumer", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "Consumer-staples Q2 prints roll in late July (KO, PEP watch)", tickers: "KO · PEP · WMT",
    rec: "Watch volume vs price; favor staples with pricing power into a choppy consumer." },

  // ---- FORWARD CATALYSTS (week 2: Jul 20–27) ------------------------------
  { id: "x1", ind: "tech", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "Mega-cap tech Q2 wave begins (week of Jul 20+) after chip prints", tickers: "MSFT · GOOGL · TSLA",
    rec: "Let the bank/chip prints set the tone; re-add on confirmed AI-capex strength, not the first bounce." },
  { id: "x2", ind: "finance", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Regional-bank & card-network Q2 follow-through", tickers: "V · MA · USB",
    rec: "Read NIM & credit trends; favor quality card networks, watch consumer-credit tone." },
  { id: "x3", ind: "energy", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories + persistent Hormuz headline risk", tickers: "XOM · CVX · USO",
    rec: "Trade the risk premium with trailing stops; a de-escalation unwinds it quickly." },
  { id: "x4", ind: "health", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Managed-care & pharma Q2 digestion post UNH / JNJ", tickers: "UNH · JNJ · LLY",
    rec: "Volatility persists; favor margin-recovery stories, fade knee-jerk moves." },
  { id: "x5", ind: "finance", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC (Jul 28-29) approaches — Fed blackout on; Sept-hike debate live", tickers: "SPY · JPM · TLT",
    rec: "Biggest macro swing just past the window; keep dry powder into month-end." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "JPM", name: "JPMorgan Chase", rank: 1, spot: "~$336", sentiment: "Bullish",
    catalyst: "Q2 earnings — Tue Jul 14 (pre-mkt) · BINARY (options price ~4.4%)",
    iv: "Elevated into the print (~±4-5% implied)", liq: "Deep, penny-wide mega-cap bank chain; huge OI",
    thesis: "Asset-sensitive NIM beneficiary leading a strong bank tape into a binary. Get paid to be bullish with a defined-risk put-credit spread, cut vega with a call debit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $325 / buy $315 · Jul 31 '26 · ~$3.20 credit · max loss/capital ~$680 · bullish, range-tolerant, harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $335 / sell $350 · Jul 31 '26 · ~$6.50 net debit · cost/max loss ~$650 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$345 call · Jul 17 '26 · ~$3.50 debit · cost ~$350 · pure earnings pop" },
    ] },
  { ticker: "TSM", name: "Taiwan Semiconductor", rank: 2, spot: "~$434", sentiment: "Bullish",
    catalyst: "Q2 earnings — Thu Jul 16 (pre-mkt) · BINARY (AI/HPC demand tell)",
    iv: "Elevated into the AI-demand binary", liq: "Deep, active large-cap ADR chain; tight spreads",
    thesis: "Bullish AI-capex read-through; a strong HPC guide lifts the whole chip complex. Spread up to cut vega into the binary, or get paid via a defined-risk put-credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $420 / sell $445 · Aug 21 '26 · ~$12 net debit · cost/max loss ~$1,200 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $420 / buy $405 · Jul 31 '26 · ~$5 credit · max loss/capital ~$1,000 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$445 call · Jul 24 '26 · ~$6 debit · cost ~$600 · AI-demand pop" },
    ] },
  { ticker: "UNH", name: "UnitedHealth", rank: 3, spot: "~$408", sentiment: "Bullish (contrarian)",
    catalyst: "Q2 earnings — Thu Jul 16 (pre-mkt) · BINARY (margin-recovery test)",
    iv: "Rich into a high-stakes binary (managed-care volatility)", liq: "Deep large-cap chain; tight spreads",
    thesis: "Beaten-down managed-care name, MS 'top pick' into a margin-recovery print. Rich IV → get paid via a defined-risk put-credit spread; spread up for defined-cost upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $390 / buy $375 · Aug 21 '26 · ~$4.50 credit · max loss/capital ~$1,050 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $405 / sell $425 · Jul 31 '26 · ~$8 net debit · cost/max loss ~$800 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$420 call · Jul 24 '26 · ~$4 debit · cost ~$400 · beat-and-rerate pop" },
    ] },
  { ticker: "GS", name: "Goldman Sachs", rank: 4, spot: "~$1,043", sentiment: "Bullish",
    catalyst: "Q2 earnings — Tue Jul 14 (pre-mkt) · BINARY (options price ~6%)",
    iv: "Elevated into the print (~±6% implied)", liq: "Deep, liquid chain; high-priced → spreads only",
    thesis: "IB/trading rebound leader into a binary; the ~$1,000 price rules out cheap long calls, so use tight defined-risk spreads to fit the capital cap. No naked shorts.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $1000 / buy $980 · Jul 31 '26 · ~$7 credit · max loss/capital ~$1,300 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $1040 / sell $1060 · Jul 17 '26 · ~$9 net debit · cost/max loss ~$900 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1060 / sell $1080 · Jul 17 '26 · ~$5 net debit · cost/max loss ~$500 · pure earnings pop" },
    ] },
  { ticker: "ASML", name: "ASML Holding", rank: 5, spot: "~$1,751", sentiment: "Bullish",
    catalyst: "Q2 earnings — Wed Jul 15 (pre-mkt) · BINARY (EUV bookings tell)",
    iv: "Rich into the AI-capex binary", liq: "Liquid but high-priced ADR chain → spreads only",
    thesis: "EUV monopoly and AI-capex orders the key tell; the ~$1,750 price forces tight defined-risk spreads to stay under the capital cap. Harvest IV via a credit spread or cut vega with a call debit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $1680 / buy $1660 · Jul 31 '26 · ~$7 credit · max loss/capital ~$1,300 · harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $1750 / sell $1770 · Jul 17 '26 · ~$9 net debit · cost/max loss ~$900 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1770 / sell $1790 · Jul 17 '26 · ~$5 net debit · cost/max loss ~$500 · pure orders/earnings pop" },
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Monday, Jul 13 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 13)
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
