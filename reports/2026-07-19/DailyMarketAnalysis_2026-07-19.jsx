import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Sunday, July 19, 2026 (live-researched).
 * Window: last 3 days (Jul 16) → coming 2 weeks (Aug 2).
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

// 18-day axis: Jul 16 .. Aug 2 (last 3 days → coming 2 weeks). Today = index 3 (Jul 19).
const DAYS = [
  { idx: 0, date: "Jul 16", dow: "Thu" },
  { idx: 1, date: "Jul 17", dow: "Fri" },
  { idx: 2, date: "Jul 18", dow: "Sat" },
  { idx: 3, date: "Jul 19", dow: "Sun" }, // TODAY
  { idx: 4, date: "Jul 20", dow: "Mon" },
  { idx: 5, date: "Jul 21", dow: "Tue" },
  { idx: 6, date: "Jul 22", dow: "Wed" },
  { idx: 7, date: "Jul 23", dow: "Thu" },
  { idx: 8, date: "Jul 24", dow: "Fri" },
  { idx: 9, date: "Jul 25", dow: "Sat" },
  { idx: 10, date: "Jul 26", dow: "Sun" },
  { idx: 11, date: "Jul 27", dow: "Mon" },
  { idx: 12, date: "Jul 28", dow: "Tue" },
  { idx: 13, date: "Jul 29", dow: "Wed" },
  { idx: 14, date: "Jul 30", dow: "Thu" },
  { idx: 15, date: "Jul 31", dow: "Fri" },
  { idx: 16, date: "Aug 1", dow: "Sat" },
  { idx: 17, date: "Aug 2", dow: "Sun" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Semiconductor rout deepens — SOX −13% in a month, semi ETF −17% MTD (NVDA/AMD/AMAT/LRCX −2–4%)", tickers: "NVDA · AMD · AMAT · LRCX",
    rec: "Don't catch the knife; scale into quality (NVDA) only on stabilization — this is an AI-spend valuation reset, not an earnings miss." },
  { id: "t2", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "China's Moonshot unveils a frontier AI model at par with OpenAI/Anthropic — dents the US AI-capex premium", tickers: "NVDA · MSFT · GOOGL",
    rec: "Use the AI-sentiment reset to add megacap quality on weakness; avoid chasing single-name semis." },
  { id: "t3", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Alphabet Q2 earnings (Wed, after close) — cloud & AI-capex bellwether", tickers: "GOOGL · GOOG",
    rec: "Binary; a strong Cloud/AI-infra guide re-rates the whole AI trade, a soft one deepens the selloff — size before the print." },
  { id: "t4", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Intel Q2 earnings (Thu) — foundry / turnaround progress tell", tickers: "INTC",
    rec: "High-variance binary; keep size small — a credible foundry roadmap is the bull case, another delay is not." },
  { id: "t5", ind: "tech", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft & Meta Q2 earnings (Wed, after close) — same day as FOMC; AI-capex crescendo", tickers: "MSFT · META",
    rec: "Biggest AI-capex read of the season stacked on the Fed; keep dry powder into a volatile evening." },
  { id: "t6", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Apple & Amazon Q2 earnings (~Thu/Fri) — iPhone/Services & AWS re-accel watch", tickers: "AAPL · AMZN",
    rec: "Wait for the prints; AWS growth and Services margins are the tells, not headline EPS." },
  { id: "t7", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "BEARISH",
    headline: "AI-capex scrutiny persists post-Moonshot into the mega-cap prints", tickers: "NVDA · AVGO · MSFT",
    rec: "Let the tape settle; re-add on confirmed capex strength, not the first bounce." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Oil spikes — WTI ~$82 (+14% wk) on a 6th night of US strikes on Iran; Hormuz traffic throttled", tickers: "XOM · CVX · COP",
    rec: "Keep a tactical energy overweight as geopolitical insurance; use trailing stops — a ceasefire unwinds it fast." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Energy the lone green sector as funds rotate out of tech into cash-rich producers", tickers: "XOM · CVX · MPC · VLO",
    rec: "Constructive rotation; favor integrated majors & refiners with real FCF over high-beta E&P." },
  { id: "e3", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (Wed)", tickers: "XOM · CVX · USO",
    rec: "Watch the crude draw vs. consensus; a big draw amid the Hormuz risk premium reinforces the bull case." },
  { id: "e4", ind: "energy", dayIdx: 8, future: true, impact: 3, dir: "BULLISH",
    headline: "Strait of Hormuz / Iran escalation risk persists into the weekend", tickers: "XOM · CVX · OXY",
    rec: "Own energy as a hedge; size it as insurance, not a core overweight — headline reversals are violent." },
  { id: "e5", ind: "energy", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "Exxon & Chevron Q2 earnings (~Fri) — buybacks & cash returns in focus", tickers: "XOM · CVX",
    rec: "Elevated crude helps the print; watch capital-return pace and any downstream margin softness." },
  { id: "e6", ind: "energy", dayIdx: 12, future: true, impact: 1, dir: "MIXED",
    headline: "Solar selectivity — FSLR / ENPH favored over broad renewables", tickers: "FSLR · ENPH",
    rec: "Be selective; FSLR's domestic-manufacturing moat is the durable pick — avoid solar baskets." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Lilly wins FDA nod for Foundayo, an oral GLP-1 that beat oral semaglutide head-to-head; LLY mkt cap >$1T", tickers: "LLY · NVO",
    rec: "Structural GLP-1 leader; buy pullbacks rather than chase near all-time highs (~$1,235)." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "UnitedHealth Q2 — managed-care margin & Medicare-Advantage rate pressure back in focus", tickers: "UNH · HUM · CVS",
    rec: "Stay cautious/underweight managed care until 2027 MA rates and cost-trend clarity improve." },
  { id: "h3", ind: "health", dayIdx: 5, future: true, impact: 2, dir: "BULLISH",
    headline: "GLP-1 access expands — Medicare bridge caps Zepbound/Foundayo at $50/mo", tickers: "LLY · NVO · VKTX",
    rec: "Volume tailwind but a margin watch; favor LLY on the oral franchise, fade knee-jerk NVO moves." },
  { id: "h4", ind: "health", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Big-pharma Q2 earnings wave — AbbVie / Merck / Bristol (late Jul)", tickers: "ABBV · MRK · BMY",
    rec: "Own diversified, de-risked names into the gap left by patent cliffs; trade guidance, not headlines." },
  { id: "h5", ind: "health", dayIdx: 11, future: true, impact: 1, dir: "BULLISH",
    headline: "Healthcare catches a defensive bid as money rotates from high-beta tech", tickers: "XLV · JNJ · ABBV",
    rec: "Reasonable ballast in a semis-led drawdown; add quality dividend compounders on weakness." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Big-bank Q2 blowout — JPM net income $21.2B on record trading; H1 IB fees +24%", tickers: "JPM · BAC · GS · WFC · C",
    rec: "Volatility is paying the banks; favor trading/IB-levered names (JPM/GS) — take partial profits into strength." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Travelers +9% on a big Q2 beat; insurers (PGR/ALL) rally", tickers: "TRV · PGR · ALL",
    rec: "Quality underwriting + investment income; hold core insurers, don't chase the one-day pop." },
  { id: "f3", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Goldman & Morgan Stanley ride the capital-markets recovery — SpaceX IPO & Alphabet block fees", tickers: "GS · MS",
    rec: "Re-rating of the IB cycle; add on dips, but a market-vol spike can freeze the deal pipeline." },
  { id: "f4", ind: "finance", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "FOMC two-day meeting begins (Tue)", tickers: "SPY · TLT · JPM",
    rec: "Positioning event; avoid adding rate-duration until the decision & presser clear." },
  { id: "f5", ind: "finance", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC rate decision (Wed) — hold expected at 3.50–3.75%, no new projections", tickers: "SPY · TLT · JPM · BAC",
    rec: "Biggest macro swing in the window; the presser tone matters more than the (likely) hold — keep dry powder." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Netflix −7% (−12% intraday) despite a beat — soft summer revenue guide + fewer engagement updates", tickers: "NFLX",
    rec: "Expectations reset; wait for the dust to settle — a beat that sells off signals crowded positioning." },
  { id: "c2", ind: "consumer", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q2 earnings (Wed) — ~480K deliveries known; auto margins & Cybercab the swing", tickers: "TSLA",
    rec: "Binary with rich IV; deliveries are old news — gross margin and robotaxi timeline drive the move. Prefer defined risk." },
  { id: "c3", ind: "consumer", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Coca-Cola Q2 earnings (Tue) — record-high stock meets the fairlife cyber overhang", tickers: "KO",
    rec: "Defensive quality but priced for perfection near ATHs; fade froth, buy weakness on any guidance wobble." },
  { id: "c4", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Coca-Cola's fairlife hit by ransomware — US production temporarily suspended", tickers: "KO",
    rec: "Contained but a near-term drag; watch for restored production before the Jul 28 print." },
  { id: "c5", ind: "consumer", dayIdx: 11, future: true, impact: 1, dir: "BULLISH",
    headline: "Consumer-staples bid firms as investors seek lower-beta ballast", tickers: "KO · PEP · PG",
    rec: "Reasonable defense in a tech drawdown; prefer pricing-power names, mind stretched staples multiples." },
  { id: "c6", ind: "consumer", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "McDonald's & consumer bellwethers on deck (into early Aug)", tickers: "MCD · SBUX",
    rec: "Watch traffic & value-menu commentary for the low-end consumer read; wait for the print." },

  // ---- MACRO / FORWARD CATALYSTS (week 2: Jul 26 – Aug 2) ------------------
  { id: "x1", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Q2 GDP advance estimate (Thu)", tickers: "SPY · QQQ · TLT",
    rec: "Growth-vs-inflation tell right before PCE; a hot print revives higher-for-longer fears." },
  { id: "x2", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "June Core PCE — the Fed's preferred inflation gauge (Fri)", tickers: "SPY · TLT",
    rec: "The week's macro capstone; a cool print eases rate-cut angst, a sticky one caps multiples." },
  { id: "x3", ind: "finance", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "August seasonality & July jobs (Aug 7) loom", tickers: "SPY · VIX",
    rec: "Thin summer liquidity amplifies moves; keep position sizes modest into the data-heavy stretch." },
  { id: "x4", ind: "finance", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Week ahead — mega-cap earnings digestion + payrolls setup", tickers: "SPY · QQQ",
    rec: "Let the AI-capex prints and PCE settle before pressing new directional risk." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "GOOGL", name: "Alphabet", rank: 1, spot: "~$347", sentiment: "Bullish",
    catalyst: "Q2 earnings — Wed Jul 22 (after close) · BINARY (Cloud/AI-capex bellwether)",
    iv: "Elevated into the print (~±6–7% implied)", liq: "Deepest mega-cap chain; penny-wide spreads, huge OI",
    thesis: "Bullish into a binary with richened IV → cut vega with a debit spread rather than a naked call, and get paid on the downside via a defined-risk put-credit spread that harvests the post-print IV crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $345 / sell $360 · Aug 21 '26 · ~$6.00 net debit · cost/max loss ~$600 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $330 / buy $320 · Jul 31 '26 · ~$3.00 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$360 call · Jul 24 '26 · ~$3.00 debit · cost ~$300 · pure earnings pop" },
    ] },
  { ticker: "MSFT", name: "Microsoft", rank: 2, spot: "~$400", sentiment: "Bullish",
    catalyst: "Q2 earnings — Wed Jul 29 (after close) · BINARY, same day as FOMC",
    iv: "Elevated (earnings + Fed stacked; ~±5–6% implied)", liq: "Deep large-cap chain; tight spreads, massive OI",
    thesis: "Bullish Azure/AI-capex leader into a binary that's stacked on the Fed → defined-risk only. Spread up to cap vega/cost; sell a put spread below support to get paid for the IV crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $400 / sell $420 · Aug 21 '26 · ~$8.00 net debit · cost/max loss ~$800" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $385 / buy $375 · Jul 31 '26 · ~$3.00 credit · max loss/capital ~$700 · range-tolerant bull" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$410 call · Jul 31 '26 · ~$5.00 debit · cost ~$500 · earnings + Fed pop" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 3, spot: "~$381", sentiment: "Neutral",
    catalyst: "Q2 earnings — Wed Jul 22 (after close) · BINARY (~480K deliveries known)",
    iv: "Very rich (~±8–9% implied) — classic crush setup", liq: "One of the most liquid chains anywhere; deep weeklies",
    thesis: "Deliveries are pre-released, so the move hinges on margins & the Cybercab timeline — a coin-flip. With very rich IV, sell defined-risk premium on both sides (iron condor) and lean marginally bullish; only spend a small debit for a directional shot.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $360p/$400c, buy $345p/$415c · Jul 31 '26 · ~$5.00 credit · max loss/capital ~$1,000 · profits if TSLA stays in range" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $355 / buy $340 · Jul 31 '26 · ~$4.50 credit · max loss/capital ~$1,050 · bullish lean, harvests crush" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $390 / sell $410 · Jul 24 '26 · ~$5.50 net debit · cost/max loss ~$550 · directional shot" },
    ] },
  { ticker: "XOM", name: "Exxon Mobil", rank: 4, spot: "~$147", sentiment: "Bullish",
    catalyst: "Hormuz/Iran risk premium + Q2 earnings ~Fri Jul 31",
    iv: "Moderately elevated on the geopolitical bid", liq: "Deep, liquid mega-cap energy chain",
    thesis: "Crude's +14% weekly spike on the US-Iran escalation and a tech→energy rotation give XOM a real bid into its own earnings. Bullish with only moderate IV → own defined upside; get paid via a put-credit spread and add a cheap call for the tail.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $140 / buy $133 · Aug 21 '26 · ~$2.00 credit · max loss/capital ~$500 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $147 / sell $157 · Aug 21 '26 · ~$4.00 net debit · cost/max loss ~$400" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$155 call · Aug 7 '26 · ~$2.00 debit · cost ~$200 · geopolitical tail" },
    ] },
  { ticker: "INTC", name: "Intel", rank: 5, spot: "~$128", sentiment: "Neutral-to-Bullish (contrarian)",
    catalyst: "Q2 earnings — Thu Jul 23 (after close) · BINARY (foundry turnaround)",
    iv: "Rich into a high-variance print", liq: "Deep, very active chain; tight penny spreads",
    thesis: "A contrarian turnaround into a binary during a semis rout — high variance both ways. With rich IV, get paid to be patient via a put-credit spread below support, spread up for defined bullish upside, and risk only a small debit on the pop.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $120 / buy $113 · Aug 21 '26 · ~$2.00 credit · max loss/capital ~$500 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $128 / sell $138 · Aug 21 '26 · ~$4.00 net debit · cost/max loss ~$400" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$135 call · Jul 31 '26 · ~$2.00 debit · cost ~$200 · turnaround pop" },
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Sunday, Jul 19 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 19)
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
