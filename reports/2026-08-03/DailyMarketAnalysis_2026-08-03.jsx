import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Monday, August 3, 2026 (live-researched).
 * Window: last 3 days (Jul 31) → coming 2 weeks (Aug 17).
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

// 18-day axis: Jul 31 .. Aug 17 (last 3 days → coming 2 weeks). Today = index 3 (Aug 3).
const DAYS = [
  { idx: 0, date: "Jul 31", dow: "Fri" },
  { idx: 1, date: "Aug 1", dow: "Sat" },
  { idx: 2, date: "Aug 2", dow: "Sun" },
  { idx: 3, date: "Aug 3", dow: "Mon" }, // TODAY
  { idx: 4, date: "Aug 4", dow: "Tue" },
  { idx: 5, date: "Aug 5", dow: "Wed" },
  { idx: 6, date: "Aug 6", dow: "Thu" },
  { idx: 7, date: "Aug 7", dow: "Fri" },
  { idx: 8, date: "Aug 8", dow: "Sat" },
  { idx: 9, date: "Aug 9", dow: "Sun" },
  { idx: 10, date: "Aug 10", dow: "Mon" },
  { idx: 11, date: "Aug 11", dow: "Tue" },
  { idx: 12, date: "Aug 12", dow: "Wed" },
  { idx: 13, date: "Aug 13", dow: "Thu" },
  { idx: 14, date: "Aug 14", dow: "Fri" },
  { idx: 15, date: "Aug 15", dow: "Sat" },
  { idx: 16, date: "Aug 16", dow: "Sun" },
  { idx: 17, date: "Aug 17", dow: "Mon" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "Palantir Q2 tonight (after close) — options imply ~10–12% move; rev ~$1.81B (+81%)", tickers: "PLTR",
    rec: "Don't chase into the print; a beat is nearly priced at ~200× fwd — only defined-risk/IV-crush structures, size small." },
  { id: "t2", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "AMD Q2 (after close) — MI450/Helios ramp & the 12GW Meta+OpenAI commitments in focus", tickers: "AMD · NVDA",
    rec: "Up 122% YTD into a binary; WATCH — a strong AI-GPU guide extends the run, a soft one unwinds fast. Defined-risk only." },
  { id: "t3", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Semis lag the tape Monday — Micron & SanDisk retreat as NAND jitters build", tickers: "MU · SNDK",
    rec: "Hold quality; don't add memory names ahead of SanDisk's print — let the NAND read-through land first." },
  { id: "t4", ind: "tech", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "SanDisk Q2 (after close) — first pure-play NAND read since the stock fell ~53% off highs", tickers: "SNDK · MU",
    rec: "WATCH the pricing/inventory commentary; it sets the tone for the whole memory complex — don't front-run it." },
  { id: "t5", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Mega-cap AI results digested — MSFT/META/AAPL/AMZN capex debate rolls on (~85% of S&P beat)", tickers: "MSFT · META · AAPL · AMZN",
    rec: "Own the capex beneficiaries, not the spenders' multiples; add on pullbacks, not strength." },
  { id: "t6", ind: "tech", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "July CPI (8:30 ET) — inflation surprise is the swing factor for high-multiple tech", tickers: "NVDA · MSFT · GOOGL",
    rec: "De-risk slightly pre-print; a cool number re-rates growth, a hot one compresses megacap multiples." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 3, future: false, impact: 3, dir: "BEARISH",
    headline: "WTI slides below $80 (from ~$92) as US–Iran talks resume; Trump calls off strikes", tickers: "XOM · CVX · COP · USO",
    rec: "Trim tactical E&P longs — the geopolitical risk premium is bleeding out; a deal caps crude near-term." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "OPEC+ agrees +188K bpd for September — completes the rollback of 2023 voluntary cuts", tickers: "XOM · CVX · OXY · USO",
    rec: "Supply headwind on top of easing geopolitics — stay underweight crude beta; favor integrateds over pure E&P." },
  { id: "e3", ind: "energy", dayIdx: 3, future: true, impact: 2, dir: "BEARISH",
    headline: "US–Iran negotiations resume (Mon) — de-escalation path is bearish crude", tickers: "XOM · CVX · OXY",
    rec: "WATCH headlines; a framework deal is another leg down for oil — don't buy the dip in E&P yet." },
  { id: "e4", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude & product inventories)", tickers: "XOM · CVX · USO",
    rec: "A large build confirms the softening; use bounces to lighten, not to chase." },
  { id: "e5", ind: "energy", dayIdx: 12, future: true, impact: 1, dir: "MIXED",
    headline: "EIA inventories + monthly STEO — demand/supply balance update", tickers: "XOM · CVX · USO",
    rec: "Let inventories confirm direction; geopolitics has flipped from tailwind to fading risk premium." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Eli Lilly Q2 (pre-open) — orforglipron (Foundayo) script stall vs. the guidance raise", tickers: "LLY · NVO",
    rec: "Goldman flags the guidance raise as THE variable; size before the print, don't chase — stalling scripts are the risk." },
  { id: "h2", ind: "health", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Pfizer Q2 (pre-open) — cost cuts & pipeline vs. post-COVID revenue cliff", tickers: "PFE",
    rec: "Value/yield name; HOLD for the dividend, but don't expect a growth re-rate on this print." },
  { id: "h3", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Goldman cuts 2026 Foundayo (oral GLP-1) estimate to $755M from $1.1B on stalled scripts", tickers: "LLY · NVO",
    rec: "Trim GLP-1 exposure into the Lilly print; the oral-pill ramp is the crowded long that's wobbling." },
  { id: "h4", ind: "health", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "Managed-care overhang persists — Medicare Advantage margin & policy watch", tickers: "UNH · HUM · CVS",
    rec: "Stay cautious/underweight managed care until MA rates and utilization trends stabilize." },
  { id: "h5", ind: "health", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "GLP-1 data digestion post-Lilly — obesity-franchise repricing continues", tickers: "LLY · NVO · VKTX",
    rec: "Volatility persists; favor LLY on execution, fade knee-jerk NVO/VKTX moves rather than chase." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "10Y yield climbs to ~4.73% (highest since Jan '25) on hawkish Fed higher-for-longer tone", tickers: "JPM · BAC · WFC · TLT",
    rec: "Favor asset-sensitive/NII-beneficiary banks (JPM/BAC); avoid adding long-duration bonds into rising yields." },
  { id: "f2", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Fed held 3.50–3.75% (9–3, three hike dissents); markets price ~two-thirds odds of a Sept hike", tickers: "JPM · BAC · V · MA",
    rec: "Position higher-for-longer: banks win on NII, but keep dry powder before the Sept dot plot." },
  { id: "f3", ind: "finance", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "July jobs report / NFP (8:30 ET) — consensus ~85K; the week's biggest macro swing", tickers: "JPM · BAC · SPY · TLT",
    rec: "Keep dry powder into 8:30; a hot number lifts yields & asset-sensitive banks, a weak one revives cut hopes." },
  { id: "f4", ind: "finance", dayIdx: 3, future: false, impact: 1, dir: "BULLISH",
    headline: "Small-caps lead Monday (IWM +0.6%); financials firm as yields grind higher", tickers: "IWM · XLF · GS",
    rec: "Constructive for rate-sensitive value; take partial profits into strength rather than chase the move." },
  { id: "f5", ind: "finance", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "July CPI (8:30 ET) — key input for the Sept hike path and bank rate exposure", tickers: "JPM · BAC · SPY · TLT",
    rec: "Biggest inflation print of the window; avoid initiating new size until after the number." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 5, future: true, impact: 3, dir: "BULLISH",
    headline: "Disney FQ3 (pre-open) — streaming margins + parks; ~88% market-implied odds of a beat", tickers: "DIS",
    rec: "Constructive setup: strongest top-line jump in 3+ years expected; defined-risk longs into the print favored." },
  { id: "c2", ind: "consumer", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "McDonald's Q2 (pre-open) — low-income consumer & traffic read via value menu", tickers: "MCD",
    rec: "Defensive compounder; HOLD — watch same-store traffic for the health of the value-seeking consumer." },
  { id: "c3", ind: "consumer", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Shopify Q2 (pre-open) — GMV growth & take-rate vs. a rich multiple", tickers: "SHOP",
    rec: "High-beta e-commerce read; WATCH — great GMV can still sell off on the valuation. Size small." },
  { id: "c4", ind: "consumer", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Airbnb Q2 (after close) — summer travel demand & nights-booked trend", tickers: "ABNB",
    rec: "Discretionary-travel gauge; WATCH the booking-growth guide for signs of consumer fatigue." },
  { id: "c5", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Amazon Q2 digested — retail margins solid, AWS growth the swing factor", tickers: "AMZN",
    rec: "Own for AWS/AI leverage; add on pullbacks, not into post-earnings strength." },
  { id: "c6", ind: "consumer", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Big-box retail earnings loom (WMT/TGT/HD ~Aug 19–21) — the consumer's health check", tickers: "WMT · TGT · HD",
    rec: "Position ahead of the read: favor WMT's traffic/share gains; stay cautious on lower-income-skewed retail." },

  // ---- FORWARD CATALYSTS (week 2: Aug 8–17) -------------------------------
  { id: "x1", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through continues post PLTR/AMD prints", tickers: "NVDA · AMD · PLTR",
    rec: "Let the dust settle; re-add on confirmation of durable AI demand, not the first bounce." },
  { id: "x2", ind: "health", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Obesity-franchise repricing — GLP-1 script trends after the Lilly print", tickers: "LLY · NVO · VKTX",
    rec: "Volatility persists; favor execution over hype, fade knee-jerk moves rather than chase them." },
  { id: "x3", ind: "finance", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "July CPI is the macro fulcrum for the Sept FOMC (no Fed meeting until mid-Sept)", tickers: "SPY · QQQ · TLT",
    rec: "Biggest swing in the window; a hot print revives hike odds — keep dry powder into the number." },
  { id: "x4", ind: "energy", dayIdx: 16, future: true, impact: 2, dir: "BEARISH",
    headline: "OPEC+ supply add + fading Iran premium keep crude on the back foot", tickers: "XOM · CVX · USO",
    rec: "Stay underweight crude beta; a de-escalation deal is another leg lower — use bounces to trim." },
  { id: "x5", ind: "finance", dayIdx: 10, future: true, impact: 1, dir: "MIXED",
    headline: "Q2 earnings season winds down (~85% beat, profits tracking +47% y/y)", tickers: "SPY · IWM",
    rec: "Strong breadth is a tailwind, but August/September are seasonally weak — don't over-extend into strength." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "PLTR", name: "Palantir", rank: 1, spot: "~$123", sentiment: "Bullish",
    catalyst: "Q2 earnings — TONIGHT Mon Aug 3 (after close) · BINARY",
    iv: "Very rich — options imply ~10–12% move", liq: "Deep, hyper-active mega-cap AI chain; penny-wide near ATM",
    thesis: "AI-software leader but priced for perfection (~$1.81B rev, +81%) into a same-day binary → NEVER buy naked premium here (max IV crush). Get paid below support, or cap vega with a tight debit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $115 / buy $110 · Aug 21 '26 · ~$1.60 credit · max loss/capital ~$340 · harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $125 / sell $135 · Aug 21 '26 · ~$3.50 net debit · cost/max loss ~$350 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$135 call · Aug 7 '26 · ~$1.80 debit · cost ~$180 · pure earnings-pop lottery" },
    ] },
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 2, spot: "~$472", sentiment: "Bullish",
    catalyst: "Q2 earnings — Tue Aug 4 (after close) · BINARY",
    iv: "Elevated into the print (±~9–10% implied)", liq: "Deep, very liquid semi chain; tight spreads, huge OI",
    thesis: "Up ~122% YTD into a binary on MI450/Helios ramp & the 12GW Meta+OpenAI commitments → rich IV means avoid naked calls. Cut vega with a debit spread or get paid via a defined-risk credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $440 / buy $430 · Aug 21 '26 · ~$3.00 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $470 / sell $490 · Aug 21 '26 · ~$8.50 net debit · cost/max loss ~$850 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$500 call · Aug 7 '26 · ~$5.00 debit · cost ~$500 · binary-pop lottery" },
    ] },
  { ticker: "DIS", name: "Walt Disney", rank: 3, spot: "~$96", sentiment: "Bullish",
    catalyst: "FQ3 earnings — Wed Aug 5 (pre-open) · BINARY",
    iv: "Moderately elevated into earnings (±~6% implied)", liq: "Deep, liquid large-cap chain; tight spreads",
    thesis: "Clean bullish setup: ~88% market-implied beat odds on streaming margins + resilient parks, strongest top-line jump in 3+ years expected. Get paid below support; spread up for defined-cost upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $92 / buy $87 · Aug 21 '26 · ~$1.50 credit · max loss/capital ~$350 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $96 / sell $102 · Aug 21 '26 · ~$2.40 net debit · cost/max loss ~$240" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$100 call · Aug 7 '26 · ~$1.20 debit · cost ~$120 · earnings-pop lottery" },
    ] },
  { ticker: "LLY", name: "Eli Lilly", rank: 4, spot: "~$1,149", sentiment: "Neutral",
    catalyst: "Q2 earnings — Wed Aug 5 (pre-open) · BINARY",
    iv: "Rich (±~7% implied ≈ $80 move)", liq: "Deep mega-cap pharma chain; wide $ premiums, use spreads",
    thesis: "Strong core franchise but the oral-GLP-1 (Foundayo/orforglipron) script stall is the crowded-long risk; Goldman calls the guidance raise THE variable. High price + rich IV → defined-risk spreads only, played both ways.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $1080 / buy $1070 · Aug 21 '26 · ~$3.00 credit · max loss/capital ~$700 · below support, IV harvest" },
      { profile: "Moderate",     strategy: "Bear Put Debit Spread", text: "Buy $1120 / sell $1100 · Aug 7 '26 · ~$8.00 net debit · cost/max loss ~$800 · hedges a script-stall miss" },
      { profile: "Aggressive",   strategy: "Long Put (OTM)", text: "$1080 put · Aug 7 '26 · ~$9.00 debit · cost ~$900 · disappointment lottery" },
    ] },
  { ticker: "JPM", name: "JPMorgan Chase", rank: 5, spot: "~$354", sentiment: "Bullish",
    catalyst: "Higher-for-longer tailwind — 10Y ~4.73%; July jobs report Fri Aug 7",
    iv: "Low-to-moderate (no earnings until mid-Oct) → long premium OK", liq: "Deep, liquid money-center chain; tight spreads",
    thesis: "NII beneficiary of a hawkish Fed hold and a 10Y at a 2026-plus high; already reported, so no binary — lower IV favors owning premium. Pair a defined-cost call spread with a get-paid credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $350 / sell $365 · Sep 18 '26 · ~$6.50 net debit · cost/max loss ~$650" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $345 / buy $335 · Aug 21 '26 · ~$3.00 credit · max loss/capital ~$700 · paid on higher-for-longer" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$365 call · Aug 21 '26 · ~$3.00 debit · cost ~$300 · yields/jobs breakout" },
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
// today line sits on the boundary between Aug 3 and Aug 4
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Monday, Aug 3 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Aug 3)
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
