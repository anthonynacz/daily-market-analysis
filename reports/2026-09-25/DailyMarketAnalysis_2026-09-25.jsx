import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, September 25, 2026 (live-researched).
 * Window: last 3 days (Sep 22) → coming 2 weeks (Oct 9).
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

// 18-day axis: Sep 22 .. Oct 9 (last 3 days → coming 2 weeks). Today = index 3 (Sep 25).
const DAYS = [
  { idx: 0, date: "Sep 22", dow: "Tue" },
  { idx: 1, date: "Sep 23", dow: "Wed" },
  { idx: 2, date: "Sep 24", dow: "Thu" },
  { idx: 3, date: "Sep 25", dow: "Fri" }, // TODAY
  { idx: 4, date: "Sep 26", dow: "Sat" },
  { idx: 5, date: "Sep 27", dow: "Sun" },
  { idx: 6, date: "Sep 28", dow: "Mon" },
  { idx: 7, date: "Sep 29", dow: "Tue" },
  { idx: 8, date: "Sep 30", dow: "Wed" },
  { idx: 9, date: "Oct 1", dow: "Thu" },
  { idx: 10, date: "Oct 2", dow: "Fri" },
  { idx: 11, date: "Oct 3", dow: "Sat" },
  { idx: 12, date: "Oct 4", dow: "Sun" },
  { idx: 13, date: "Oct 5", dow: "Mon" },
  { idx: 14, date: "Oct 6", dow: "Tue" },
  { idx: 15, date: "Oct 7", dow: "Wed" },
  { idx: 16, date: "Oct 8", dow: "Thu" },
  { idx: 17, date: "Oct 9", dow: "Fri" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Nasdaq closes at record high — MU +5%, AMD & NVDA lead AI-memory rally", tickers: "MU · AMD · NVDA",
    rec: "Don't chase record highs; trim into strength, add quality AI names on pullbacks not breakouts." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Chips slip premarket as Trump–Xi summit opens (NVDA/AMD/MU/INTC ~−1%)", tickers: "NVDA · AMD · MU · INTC",
    rec: "Watch summit AI-export/trade headlines; hold quality, wait for post-summit clarity before adding." },
  { id: "t3", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "High-multiple tech pressured as 10Y yield hits 5.11% (post-2007 high)", tickers: "NVDA · MSFT · GOOGL",
    rec: "Higher-for-longer compresses multiples; favor cash-flow leaders, trim speculative long-duration tech." },
  { id: "t4", ind: "tech", dayIdx: 8, future: true, impact: 3, dir: "BULLISH",
    headline: "Micron FQ4 earnings (after close) — AI/HBM memory supercycle tell · BINARY", tickers: "MU · NVDA · AMD",
    rec: "Very rich IV; use defined-risk spreads — don't buy naked premium into a guaranteed vol crush." },
  { id: "t5", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "FOMC Sept-meeting minutes — color behind the surprise 25bp HIKE", tickers: "SPY · QQQ · NVDA",
    rec: "Parse for the hike path; a hawkish tone extends the yield-driven multiple squeeze on tech." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Crude stays elevated (WTI ~$92–96, Brent ~$91) as Strait of Hormuz stays shut", tickers: "XOM · CVX · COP",
    rec: "Keep core E&P for the supply shock; trim if up big into weekend headline risk." },
  { id: "e2", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "US–Iran negotiators work toward Hormuz reopening; oil whipsaws", tickers: "XOM · CVX · USO",
    rec: "Trade the geopolitical risk premium with trailing stops — a reopening deal unwinds it fast." },
  { id: "e3", ind: "energy", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "XOM · CVX · USO",
    rec: "A big draw amid the Hormuz closure reinforces the bull case; watch the number vs. consensus." },
  { id: "e4", ind: "energy", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "OPEC+ ministerial — output policy amid the Hormuz disruption (early Oct)", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut new directional bets into the meeting; a larger hike is bearish crude, a hold/cut is bullish." },
  { id: "e5", ind: "energy", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories + OPEC+ follow-through", tickers: "XOM · CVX · USO",
    rec: "Trade the Hormuz premium with stops; a de-escalation reverses the move sharply." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Lilly wins full FDA approval for Inluriyo breast-cancer combo", tickers: "LLY",
    rec: "Strengthens the oncology franchise; hold LLY — mostly priced at a $1T+ market cap." },
  { id: "h2", ind: "health", dayIdx: 3, future: false, impact: 1, dir: "BULLISH",
    headline: "Lilly market cap tops $1T (~$1,155/sh) on obesity + oncology leadership", tickers: "LLY · NVO",
    rec: "Quality compounder but richly valued; accumulate on pullbacks, not at all-time highs." },
  { id: "h3", ind: "health", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Lilly presents eloraTZP obesity-combo mid-stage data at EASD (Sep 30)", tickers: "LLY · NVO · VKTX",
    rec: "Expect GLP-1 volatility; a clean profile is bullish LLY / pressures NVO — size before headlines." },
  { id: "h4", ind: "health", dayIdx: 6, future: true, impact: 1, dir: "BULLISH",
    headline: "SMID-cap biotech firms as XBI outperforms; M&A momentum continues", tickers: "XBI · PFE · MRK",
    rec: "Selective biotech tailwind; favor de-risked pipelines that fit pharma's revenue gap." },
  { id: "h5", ind: "health", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "Managed-care overhang persists ahead of 2027 Medicare Advantage rate watch", tickers: "UNH · HUM · CVS",
    rec: "Stay cautious / underweight managed care until 2027-rate and policy clarity improve." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "JPM −3% despite $20B QIA tie-up; BAC −2%, GS −1% on a flat curve", tickers: "JPM · BAC · GS",
    rec: "Flat curve pressures NIM; favor fee-driven names, don't add rate-duration into the print." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "10Y yield jumps to 5.11% (highest since 2007); 30Y at a post-2004 peak", tickers: "TLT · JPM · SPY",
    rec: "Higher-for-longer — avoid long-duration bonds; asset-sensitive banks relatively favored." },
  { id: "f3", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Markets digest the Fed's surprise Sept 25bp HIKE to 3.75–4.00%", tickers: "SPY · JPM · V",
    rec: "Position higher-for-longer; keep dry powder, avoid new rate-sensitive positions." },
  { id: "f4", ind: "finance", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "PCE deflator + GDP 3rd release (8:30 ET) — inflation tell after the hike", tickers: "SPY · JPM · TLT",
    rec: "Biggest inflation print of the window; a hot number fuels the yield surge and hits multiples." },
  { id: "f5", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "September jobs report / NFP (8:30 ET)", tickers: "JPM · BAC · SPY",
    rec: "Key swing risk; a hot print reinforces higher-for-longer, a soft one relieves the yield pressure." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 1, dir: "MIXED",
    headline: "Darden, MGM among premarket movers; consumer-spending signals mixed", tickers: "DRI · MGM",
    rec: "Be selective — favor value/traffic winners; affordability pressure on discretionary persists." },
  { id: "c2", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Nike near 52-wk low (~$36) into FQ1 print — consumer softness & tariffs", tickers: "NKE",
    rec: "Contrarian setup — size small and use defined-risk into the binary; don't buy the knife naked." },
  { id: "c3", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Conagra FQ1 earnings — packaged-food demand & margin read", tickers: "CAG · GIS · K",
    rec: "Staples are defensive but volume-challenged; watch pricing power vs. elasticity." },
  { id: "c4", ind: "consumer", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Nike FQ1 earnings (after close) · BINARY — turnaround check", tickers: "NKE",
    rec: "Max-pessimism name; defined-risk only and account for the IV crush after the print." },
  { id: "c5", ind: "consumer", dayIdx: 14, future: true, impact: 2, dir: "BEARISH",
    headline: "Constellation Brands FQ2 (after close) · BINARY — near a 52-wk low", tickers: "STZ",
    rec: "Withdrew FY28 outlook; sell elevated premium in a range or play weakness with defined risk." },

  // ---- FORWARD CATALYSTS (week 2: Oct 3–9) --------------------------------
  { id: "x1", ind: "energy", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "Weekend Hormuz / Middle East headline risk for oil & risk assets", tickers: "XOM · SPY · USO",
    rec: "Keep position sizing modest into weekend gap risk; a ceasefire or escalation gaps oil." },
  { id: "x2", ind: "finance", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Q3 earnings season ramps; big banks lead the Oct 13–15 week", tickers: "JPM · GS · SPY",
    rec: "Build a watchlist; let bank prints set the tone before adding cyclical exposure." },
  { id: "x3", ind: "consumer", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Constellation earnings call (8am ET) + STZ guidance digestion", tickers: "STZ",
    rec: "No new fundamentals beyond the print; fade the knee-jerk move, don't chase it." },
  { id: "x4", ind: "finance", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "10Y yield path & Treasury supply remain the tape's macro swing factor", tickers: "TLT · SPY · QQQ",
    rec: "Yields drive the tape; watch 5% as the pivot level for equity multiples." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "MU", name: "Micron", rank: 1, spot: "~$1,080 (ESTIMATE)", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Wed Sep 30 (after close) · BINARY",
    iv: "Very rich into the print (~±12% implied) — AI/HBM supercycle",
    liq: "Deep, hyperactive AI-memory chain; tight spreads, huge OI",
    thesis: "Bullish into a binary on a stock up ~275% YTD with extreme IV → avoid naked long calls (max crush). Cut vega with a debit spread, or get paid via a defined-risk credit spread. High-priced underlying, so spreads (net debit / max loss) keep capital ≤ $1,500 despite the four-digit share price.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $1000 / buy $980 · Oct 16 '26 · ~$7 credit · max loss/capital ~$1,300 · harvests the post-earnings IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $1080 / sell $1110 · Oct 2 '26 · ~$13 net debit · cost/max loss ~$1,300 · vega-reduced directional" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$1200 call · Oct 2 '26 · ~$8 debit · cost ~$800 · pure post-earnings breakout (lottery ticket)" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 2, spot: "~$150", sentiment: "Bullish",
    catalyst: "Strait of Hormuz supply shock; OPEC+ ministerial ~early Oct",
    iv: "Moderately elevated on the geopolitical premium (no near binary)",
    liq: "Deep, very liquid mega-cap energy chain; penny-wide spreads",
    thesis: "Hormuz stays shut with crude elevated (WTI ~$92–96) → keep a tactical energy overweight as geopolitical insurance. No imminent earnings binary, so IV is only moderate — long premium is viable, spread up for a cheaper defined-cost version.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$145 call · Dec 18 '26 · ~$9.50 debit · cost ~$950 · Δ≈0.65, rides the supply shock" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $150 / sell $160 · Nov 20 '26 · ~$3.80 net debit · cost/max loss ~$380" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$160 call · Oct 16 '26 · ~$1.40 debit · cost ~$140 · Hormuz-spike lottery ticket" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 3, spot: "~$222", sentiment: "Bullish",
    catalyst: "AI leadership + Trump–Xi AI-policy read-through; MU print halo",
    iv: "Moderate (no earnings until ~Nov) → long premium favored",
    liq: "Deepest single-name AI chain in the market; penny-wide spreads",
    thesis: "Bullish AI leader with NO binary in the window and only moderate IV → low crush risk, so buying premium / debit spreads is favored over selling it. Spread up to cap cost and define risk against the yield-driven multiple squeeze.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $215 / sell $235 · Dec 18 '26 · ~$9 net debit · cost/max loss ~$900" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $225 / sell $245 · Nov 20 '26 · ~$6.50 net debit · cost/max loss ~$650" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$240 call · Oct 16 '26 · ~$3 debit · cost ~$300 · breakout continuation" },
    ] },
  { ticker: "NKE", name: "Nike", rank: 4, spot: "~$36", sentiment: "Bullish (contrarian)",
    catalyst: "FQ1 earnings — Thu Oct 1 (after close) · BINARY",
    iv: "Rich (~±9% implied) on a beaten-down name near 52-wk lows",
    liq: "Deep mega-cap chain; low-dollar premiums",
    thesis: "Max-pessimism turnaround near 52-week lows with rich IV → get paid via a defined-risk put-credit spread; a cheap ITM call gives asymmetric upside if the print inflects. (A cash-secured put would tie up >$3k of collateral, so it's excluded by the $1,500 cap.)",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$34 call · Nov 20 '26 · ~$3.30 debit · cost ~$330 · Δ≈0.62" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $35 / buy $32 · Oct 16 '26 · ~$1.00 credit · max loss/capital ~$200 · paid to accumulate near lows" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $36 / sell $40 · Oct 16 '26 · ~$1.30 net debit · cost/max loss ~$130" },
    ] },
  { ticker: "STZ", name: "Constellation Brands", rank: 5, spot: "~$115", sentiment: "Neutral-to-Bearish",
    catalyst: "FQ2 earnings — Tue Oct 6 (after close) · BINARY",
    iv: "Elevated into the print; near 52-wk low after a withdrawn FY28 outlook",
    liq: "Liquid large-cap staples chain; reasonably tight spreads",
    thesis: "Deteriorating fundamentals (withdrawn outlook, tariff costs, soft demand) but priced for a lot of bad news near 52-wk lows → sell elevated premium in a range with defined risk, or press continued weakness with a defined-cost bear spread. No naked shorts.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $105P/buy $100P + sell $125C/buy $130C · Oct 16 '26 · ~$1.80 credit · max loss/capital ~$320 · range-bound harvest" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $105 / buy $100 · Oct 16 '26 · ~$1.50 credit · max loss/capital ~$350 · contrarian, defined risk" },
      { profile: "Aggressive",   strategy: "Bear Put Debit Spread", text: "Buy $115 / sell $105 · Oct 16 '26 · ~$3.50 net debit · cost/max loss ~$350 · plays continued weakness" },
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
// today line sits on the boundary between Sep 25 and Sep 26
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Sep 25 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Sep 25)
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
