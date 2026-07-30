import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Thursday, July 30, 2026 (live-researched).
 * Window: last 3 days (Jul 27) → coming 2 weeks (Aug 13).
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

// 18-day axis: Jul 27 .. Aug 13 (last 3 days → coming 2 weeks). Today = index 3 (Jul 30).
const DAYS = [
  { idx: 0, date: "Jul 27", dow: "Mon" },
  { idx: 1, date: "Jul 28", dow: "Tue" },
  { idx: 2, date: "Jul 29", dow: "Wed" },
  { idx: 3, date: "Jul 30", dow: "Thu" }, // TODAY
  { idx: 4, date: "Jul 31", dow: "Fri" },
  { idx: 5, date: "Aug 1", dow: "Sat" },
  { idx: 6, date: "Aug 2", dow: "Sun" },
  { idx: 7, date: "Aug 3", dow: "Mon" },
  { idx: 8, date: "Aug 4", dow: "Tue" },
  { idx: 9, date: "Aug 5", dow: "Wed" },
  { idx: 10, date: "Aug 6", dow: "Thu" },
  { idx: 11, date: "Aug 7", dow: "Fri" },
  { idx: 12, date: "Aug 8", dow: "Sat" },
  { idx: 13, date: "Aug 9", dow: "Sun" },
  { idx: 14, date: "Aug 10", dow: "Mon" },
  { idx: 15, date: "Aug 11", dow: "Tue" },
  { idx: 16, date: "Aug 12", dow: "Wed" },
  { idx: 17, date: "Aug 13", dow: "Thu" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Chip rout: MU −9.9%, AMAT −8.4%, AMD −5.5%, NVDA −3.5%", tickers: "NVDA · AMD · MU · AMAT",
    rec: "Sentiment reset, not a fundamentals break — hold quality (NVDA), scale into memory/equipment weakness in tranches; don't chase the first bounce." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Microsoft +9% — Azure grows fastest in 4 yrs on AI demand", tickers: "MSFT",
    rec: "Cloud re-acceleration is the real AI tell; hold core, add on any macro-driven dips rather than an earnings gap-up." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Meta slides on soft Q3 revenue guide despite heavy AI capex", tickers: "META",
    rec: "Spending-ahead-of-return worry; wait for the capex-to-revenue payoff to show before adding — no need to catch the knife." },
  { id: "t4", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Apple briefly tops $5T, passes Nvidia as most valuable co.", tickers: "AAPL",
    rec: "Milestone, not a catalyst — don't chase into tonight's print; let earnings set the next leg." },
  { id: "t5", ind: "tech", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "Apple & Amazon report after close — megacap tape-setter", tickers: "AAPL · AMZN",
    rec: "Biggest single-day earnings risk in the window; keep dry powder into the double print, trade the reaction not the rumor." },
  { id: "t6", ind: "tech", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "AMD Q2 after close — AI-GPU guide is the tell post chip rout", tickers: "AMD",
    rec: "Defined-risk only into a binary with rich IV; a strong MI-series guide re-rates the AI trade, a soft one extends the semi selloff." },
  { id: "t7", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Super Micro FQ4 after close — AI-server demand & margins", tickers: "SMCI",
    rec: "High-beta, high-IV — size small and use defined-risk structures; margin trajectory matters more than the top-line beat." },
  { id: "t8", ind: "tech", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "July CPI (8:30 ET) — swing risk for high-multiple tech", tickers: "NVDA · MSFT · GOOGL",
    rec: "De-risk slightly pre-print; a cool number after the hawkish hold is the bull catalyst, a hot one pressures megacap multiples." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status; WTI hovers near ~$68", tickers: "XOM · CVX · USO",
    rec: "Range-bound crude — favor integrateds/refiners with buybacks over pure E&P beta until demand stabilizes." },
  { id: "e2", ind: "energy", dayIdx: 3, future: false, impact: 1, dir: "BULLISH",
    headline: "Middle East tensions add a modest risk premium to crude", tickers: "XOM · CVX · OXY",
    rec: "Tactical overweight as insurance only, with trailing stops — a de-escalation unwinds the premium fast." },
  { id: "e3", ind: "energy", dayIdx: 6, future: true, impact: 3, dir: "BEARISH",
    headline: "OPEC+ review (Sun Aug 2) — +188k bpd hike into soft demand", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut new directional bets into Sunday; more barrels into cracking consumption is bearish crude — a surprise pause would be the bullish tail." },
  { id: "e4", ind: "energy", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "EIA petroleum report — post-OPEC inventory test", tickers: "XOM · CVX · USO",
    rec: "Watch the draw vs. consensus; a big draw would cushion the OPEC-supply overhang, a build compounds it." },
  { id: "e5", ind: "energy", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "Refiners vs E&P divergence as crack spreads hold up", tickers: "VLO · MPC · XOM",
    rec: "Lean to refiners (VLO/MPC) over upstream beta while flat crude + firm cracks favor downstream margins." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Capricor Deramiocel AdCom (DMD cell therapy); PDUFA Aug 22", tickers: "CAPR",
    rec: "Pure binary — panel tone drives the swing; size as a lottery ticket only, the Aug 22 decision is the real event." },
  { id: "h2", ind: "health", dayIdx: 3, future: true, impact: 2, dir: "BULLISH",
    headline: "Bristol-Myers Q2 before open — pipeline & margin watch", tickers: "BMY",
    rec: "Defensive value into earnings; hold for the dividend/pipeline, don't stretch on a beat with LOE overhang ahead." },
  { id: "h3", ind: "health", dayIdx: 9, future: true, impact: 3, dir: "BULLISH",
    headline: "Eli Lilly Q2 before open — GLP-1 franchise, ~7% implied move", tickers: "LLY · NVO",
    rec: "Bullish into a binary with rich IV → defined-risk structures only; a clean orforglipron/obesity beat extends the run, a guide cut brings a sharp reset." },
  { id: "h5", ind: "health", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "GLP-1 data digestion continues post-Lilly print", tickers: "LLY · NVO · VKTX",
    rec: "Volatility persists; favor LLY on franchise depth, fade knee-jerk NVO/VKTX moves rather than chasing." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "FOMC holds rates (hawkish hold); Dow −1,100, 10Y yields jump", tickers: "JPM · BAC · SPY · TLT",
    rec: "Higher-for-longer favors asset-sensitive banks (JPM/BAC); trim long-duration/rate-sensitive exposure and keep dry powder." },
  { id: "f2", ind: "finance", dayIdx: 3, future: true, impact: 2, dir: "MIXED",
    headline: "Mastercard & Coinbase report — payments / crypto read", tickers: "MA · COIN",
    rec: "Hold MA as a quality compounder; treat COIN as a high-beta crypto proxy — size small and expect an outsized move." },
  { id: "f3", ind: "finance", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing PMI (Aug 3) — growth-pulse check", tickers: "SPY · XLI · JPM",
    rec: "A sub-50 print revives slowdown fears post-hold; use it to gauge cyclical/bank exposure, not to initiate size." },
  { id: "f4", ind: "finance", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "July jobs report (NFP, 8:30 ET) — first labor read post-hold", tickers: "JPM · BAC · SPY",
    rec: "Biggest macro swing after the Fed; a soft print revives cut hopes (bullish duration), a hot one cements higher-for-longer — wait for it." },
  { id: "f5", ind: "finance", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "July PPI (8:30 ET) — pipeline-inflation confirm after CPI", tickers: "SPY · XLF · TLT",
    rec: "Reads through from CPI the day prior; a hot PPI reinforces sticky-inflation positioning — keep rate-duration light." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "US 'reciprocal tariffs' take effect (Aug 1)", tickers: "WMT · TGT · NKE · CAT",
    rec: "Margin/cost overhang for import-heavy retail & machinery; favor domestic-sourcing and pricing-power names, watch guidance language on pass-through." },
  { id: "c2", ind: "consumer", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Caterpillar Q2 before open — cyclical & tariff bellwether", tickers: "CAT",
    rec: "Global-demand and tariff read-through; a firm backlog/guide supports the cyclical trade, tariff-cost caution would ding the whole complex." },
  { id: "c3", ind: "consumer", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "McDonald's / Yum earnings — value-consumer spend check", tickers: "MCD · YUM",
    rec: "Traffic vs. pricing is the tell on the low-end consumer; hold defensives, use weakness to add rather than chasing a beat." },
  { id: "c4", ind: "consumer", dayIdx: 9, future: true, impact: 3, dir: "BEARISH",
    headline: "Disney FQ3 before open — parks & streaming; stock −14% YTD", tickers: "DIS",
    rec: "Contrarian setup at depressed levels; streaming profitability + parks bookings must beat to break the downtrend — defined-risk only into the print." },
  { id: "c5", ind: "consumer", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "Retail read-through builds ahead of back-to-school season", tickers: "WMT · TGT · AMZN",
    rec: "Watch tariff pass-through in guidance; tilt to share-gainers (WMT/AMZN) over margin-pressured mid-tier retail." },

  // ---- FORWARD CATALYSTS (week 2: Aug 8–13) -------------------------------
  { id: "x1", ind: "tech", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through continues post megacap prints", tickers: "NVDA · AVGO · AMD",
    rec: "Let the dust settle; re-add on confirmation of hyperscaler capex strength, not the first relief bounce." },
  { id: "x2", ind: "health", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Managed-care & pharma digestion into CPI week", tickers: "UNH · LLY · PFE",
    rec: "Rotation-sensitive; keep defensive pharma as ballast, avoid adding managed-care until utilization trends clear." },
  { id: "x3", ind: "energy", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories + OPEC-supply follow-through", tickers: "XOM · CVX · USO",
    rec: "Trade the supply overhang with trailing stops; a demand surprise or geopolitical flare is the only near-term bullish catalyst." },
  { id: "x4", ind: "finance", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "July CPI (8:30 ET) — key inflation print for the rate path", tickers: "JPM · BAC · SPY · TLT",
    rec: "The window's biggest macro swing after NFP; a cool print reopens the cut debate, a hot one validates the hawkish hold — keep powder dry." },
  { id: "x5", ind: "consumer", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Consumer-tape read into mid-August; tariff-cost watch", tickers: "WMT · AMZN · TGT",
    rec: "Position for the retail earnings wave that follows; favor scale/logistics winners as tariff costs sort winners from losers." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 1, spot: "~$438", sentiment: "Bullish (into binary)",
    catalyst: "Q2 earnings — Tue Aug 4 (after close) · BINARY, post chip-rout",
    iv: "Rich (~±9% implied ≈ ±$40) — RICH into the print", liq: "Deepest semi chain after NVDA; penny-wide spreads, huge OI",
    thesis: "Bullish AI-GPU thesis but a binary with expensive IV right after a semi selloff → cut vega with a debit spread, or get paid to be bullish via a defined-risk put credit spread. No naked premium.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $430 / sell $450 · Aug 21 '26 · ~$8.50 net debit · cost/max loss ~$850 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $410 / buy $395 · Aug 7 '26 · ~$4.50 credit · max loss/capital ~$1,050 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$460 call · Aug 7 '26 · ~$5.50 debit · cost ~$550 · pure guide-beat pop" },
    ] },
  { ticker: "LLY", name: "Eli Lilly", rank: 2, spot: "~$1,220", sentiment: "Bullish (into binary)",
    catalyst: "Q2 earnings — Wed Aug 5 (before open) · BINARY (~7% implied move)",
    iv: "Elevated (~±7% implied ≈ ±$85)", liq: "Deep large-cap pharma chain; tight $-wide spreads",
    thesis: "Bullish GLP-1 franchise into a binary with rich IV on a triple-digit stock → keep dollar risk capped with tight spreads; get paid via a range-tolerant put credit spread, spread up for defined upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $1,180 / buy $1,170 · Aug 21 '26 · ~$3.50 credit · max loss/capital ~$650 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $1,220 / sell $1,240 · Aug 7 '26 · ~$9.50 net debit · cost/max loss ~$950" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$1,300 call · Aug 7 '26 · ~$6 debit · cost ~$600 · asymmetric beat pop" },
    ] },
  { ticker: "SMCI", name: "Super Micro Computer", rank: 3, spot: "~$28", sentiment: "Neutral-to-Bullish",
    catalyst: "FQ4 earnings — Tue Aug 4 (after close) · BINARY",
    iv: "Very rich (~±15% implied) — VERY RICH", liq: "Active, liquid AI-server chain; wide but tradable",
    thesis: "High-beta AI-server name with very expensive IV into a binary → don't buy naked premium (max crush). Get paid via a defined-risk put credit spread below support; spread up cheaply for the pop; small long call as the lottery ticket.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $26 / buy $23 · Aug 21 '26 · ~$0.90 credit · max loss/capital ~$210 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $28 / sell $33 · Aug 21 '26 · ~$2.00 net debit · cost/max loss ~$200" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$32 call · Aug 7 '26 · ~$1.20 debit · cost ~$120 · pure earnings pop" },
    ] },
  { ticker: "CAT", name: "Caterpillar", rank: 4, spot: "~$785", sentiment: "Bullish",
    catalyst: "Q2 earnings — Tue Aug 4 (before open); tariffs take effect Aug 1",
    iv: "Elevated into earnings + tariff headline", liq: "Deep, liquid large-cap industrial chain",
    thesis: "Cyclical bellwether pulling back from record highs into a binary with a tariff overhang → keep it defined-risk. Spread up for upside, get paid below support with a put credit spread if you want to accumulate.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $780 / sell $800 · Aug 21 '26 · ~$9 net debit · cost/max loss ~$900" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $760 / buy $745 · Aug 7 '26 · ~$5 credit · max loss/capital ~$1,000 · range-tolerant" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$800 call · Aug 7 '26 · ~$7 debit · cost ~$700 · breakout" },
    ] },
  { ticker: "DIS", name: "Walt Disney", rank: 5, spot: "~$98", sentiment: "Neutral (contrarian)",
    catalyst: "FQ3 earnings — Wed Aug 5 (before open) · BINARY",
    iv: "Elevated (~±7% implied) — rich on a beaten-down name", liq: "Deep mega-cap chain; low $ premiums",
    thesis: "Down ~14% YTD with low expectations into a binary → get paid via a defined-risk put credit spread below support, and pair a cheap defined-cost call spread for the turnaround pop. Low dollar risk throughout.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $95 / buy $90 · Aug 21 '26 · ~$1.50 credit · max loss/capital ~$350 · paid to wait" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $98 / sell $105 · Aug 21 '26 · ~$3 net debit · cost/max loss ~$300" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$105 call · Aug 7 '26 · ~$1.20 debit · cost ~$120 · cheap turnaround pop" },
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
// today line sits on the boundary between Jul 30 and Jul 31
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Thursday, Jul 30 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 30)
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
