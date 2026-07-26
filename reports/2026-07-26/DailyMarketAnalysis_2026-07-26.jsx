import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Sunday, July 26, 2026 (live-researched).
 * Window: last 3 days (Jul 23) → coming 2 weeks (Aug 9).
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

// 18-day axis: Jul 23 .. Aug 9 (last 3 days → coming 2 weeks). Today = index 3 (Jul 26).
const DAYS = [
  { idx: 0, date: "Jul 23", dow: "Thu" },
  { idx: 1, date: "Jul 24", dow: "Fri" },
  { idx: 2, date: "Jul 25", dow: "Sat" },
  { idx: 3, date: "Jul 26", dow: "Sun" }, // TODAY
  { idx: 4, date: "Jul 27", dow: "Mon" },
  { idx: 5, date: "Jul 28", dow: "Tue" },
  { idx: 6, date: "Jul 29", dow: "Wed" },
  { idx: 7, date: "Jul 30", dow: "Thu" },
  { idx: 8, date: "Jul 31", dow: "Fri" },
  { idx: 9, date: "Aug 1", dow: "Sat" },
  { idx: 10, date: "Aug 2", dow: "Sun" },
  { idx: 11, date: "Aug 3", dow: "Mon" },
  { idx: 12, date: "Aug 4", dow: "Tue" },
  { idx: 13, date: "Aug 5", dow: "Wed" },
  { idx: 14, date: "Aug 6", dow: "Thu" },
  { idx: 15, date: "Aug 7", dow: "Fri" },
  { idx: 16, date: "Aug 8", dow: "Sat" },
  { idx: 17, date: "Aug 9", dow: "Sun" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Alphabet plunges −7.7% on $205B capex hike; Nasdaq −2.2% as AI-spend fear grips tape", tickers: "GOOGL · NVDA · QQQ",
    rec: "Capex angst is the tape's driver — don't buy the first bounce; wait for the megacap prints to reset expectations." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Intel −7.9% ($92.32) on foundry & AI doubts; chip complex slides (AMD −3.3%, MU −7%)", tickers: "INTC · AMD · MU",
    rec: "Avoid the INTC turnaround until foundry customers are named; hold quality (NVDA) and scale into dips, don't chase." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Amkor +11% on multiyear $1.5B Nvidia advanced-packaging & test deal", tickers: "AMKR · NVDA",
    rec: "Trim into the pop; the NVDA tie-up validates the AI back-end packaging supply chain." },
  { id: "t4", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft & Meta Q2 earnings (after close) — AI-capex vs. cash-flow test", tickers: "MSFT · META",
    rec: "Defined-risk only into the print; a strong cloud/ad beat re-rates, another capex hike gets punished (see GOOGL)." },
  { id: "t5", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Apple & Amazon Q2 earnings (after close)", tickers: "AAPL · AMZN",
    rec: "AAPL is the market's AI-capex haven; AMZN hinges on AWS growth vs. spend. Size before headlines, don't chase." },
  { id: "t6", ind: "tech", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Chip names steady into a catalyst-heavy megacap earnings + FOMC week", tickers: "NVDA · AMD · AVGO",
    rec: "Cut leverage into the week; keep core AI exposure but wait for confirmation before adding." },
  { id: "t7", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through continues after the megacap prints", tickers: "NVDA · AVGO · MSFT",
    rec: "Re-add on confirmed monetization of the spend, not the first relief rally." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Oil retreats from a brief $100 spike; WTI ~$92 as Mideast supply risk lingers", tickers: "XOM · CVX · USO",
    rec: "Trade the geopolitical premium with trailing stops; a de-escalation unwinds it fast." },
  { id: "e2", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum inventories", tickers: "XOM · CVX · USO",
    rec: "Watch the draw vs. consensus; a big draw amid Mideast risk reinforces the bull case." },
  { id: "e3", ind: "energy", dayIdx: 8, future: true, impact: 3, dir: "BULLISH",
    headline: "Chevron & Exxon Q2 earnings (before open) — CVX EPS seen ~$5.79 (+227% y/y)", tickers: "CVX · XOM",
    rec: "High oil + buybacks favor the majors; own quality E&P into and through the prints." },
  { id: "e4", ind: "energy", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "OPEC+ ministerial — expected +548k b/d September output hike", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut new directional bets into the meeting; a larger hike pressures crude, a pause/hold is bullish." },
  { id: "e5", ind: "energy", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Energy tracks the jobs-day macro tone", tickers: "XOM · CVX",
    rec: "Let the macro print set risk appetite; keep energy as an inflation hedge with stops." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Novo sues Lilly over Zepbound/Mounjaro ad claims; GLP-1 rivalry intensifies", tickers: "LLY · NVO",
    rec: "Legal noise, not fundamentals — favor LLY on volume leadership; fade knee-jerk moves in either name." },
  { id: "h2", ind: "health", dayIdx: 6, future: true, impact: 1, dir: "BULLISH",
    headline: "Biotech M&A momentum persists into H2", tickers: "XBI · PFE · MRK",
    rec: "Tailwind for SMID-cap biotech; tilt to de-risked names filling pharma's patent-cliff gap." },
  { id: "h3", ind: "health", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "Pfizer Q2 earnings (before open) — consensus ~$0.68 EPS", tickers: "PFE",
    rec: "Watch guidance & pipeline; a cheap value name but it needs revenue-gap answers before you commit." },
  { id: "h4", ind: "health", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Novo Nordisk Q2 earnings — obesity share defense vs. Lilly", tickers: "NVO · LLY",
    rec: "Track Wegovy scripts vs. Lilly; stay selective in GLP-1, don't own the whole basket." },
  { id: "h5", ind: "health", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Eli Lilly Q2 earnings — first full quarter of Foundayo obesity pill", tickers: "LLY · NVO · VKTX",
    rec: "Expect GLP-1 volatility; size before headlines. A strong obesity beat is bullish LLY / bearish NVO." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (2pm ET) + Powell presser — rate path in focus", tickers: "JPM · BAC · SPY · TLT",
    rec: "Biggest macro swing in the window; keep dry powder into the dots & the presser." },
  { id: "f2", ind: "finance", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "June JOLTS job openings", tickers: "SPY · XLF",
    rec: "A soft print supports rate-cut hopes; a hot one revives higher-for-longer." },
  { id: "f3", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Banks steady as yields drift; money-center tone firm amid the tech selloff", tickers: "JPM · BAC · WFC",
    rec: "Favor asset-sensitive money-centers; take partial profits after the run into the Fed." },
  { id: "f4", ind: "finance", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "ISM Services PMI (Jul)", tickers: "SPY · XLF",
    rec: "Services strength keeps the soft-landing narrative alive; watch the prices-paid subindex." },
  { id: "f5", ind: "finance", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "July jobs report (NFP, 8:30 ET)", tickers: "SPY · JPM · TLT",
    rec: "The week's biggest macro tell; a cool wage number is the risk-on catalyst, a hot one revives rate fears." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Tesla Q2 miss ($0.33 vs $0.50 EPS) adds to the megacap slide; FCF negative", tickers: "TSLA",
    rec: "Revenue +26% but profits thin and cash burn rising — don't chase; wait for a base to form." },
  { id: "c2", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Robert Half −7% on weak Q2 staffing results", tickers: "RHI",
    rec: "Labor-cyclical warning; underweight staffing until hiring reaccelerates." },
  { id: "c3", ind: "consumer", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Conference Board Consumer Confidence (Jul)", tickers: "XLY · WMT · AMZN",
    rec: "Gauge of the consumer into back-to-school; a firm read supports discretionary names." },
  { id: "c4", ind: "consumer", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Q2 GDP advance estimate (8:30 ET)", tickers: "SPY · XLY",
    rec: "The growth-vs-inflation mix sets the tone for cyclicals; watch the price deflator." },
  { id: "c5", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "June PCE — the Fed's preferred inflation gauge", tickers: "SPY · XLY · XLP",
    rec: "A tame core-PCE eases rate fears; a sticky print pressures rate-sensitive retail." },

  // ---- FORWARD / MACRO TAIL (week 2) --------------------------------------
  { id: "x1", ind: "consumer", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "ISM Manufacturing (Jul) + post-OPEC oil reaction", tickers: "SPY · XLY · XOM",
    rec: "Manufacturing tone plus the OPEC decision drive cyclicals; keep position sizes modest into thin summer tape." },
  { id: "x2", ind: "finance", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Positioning into mid-August seasonality", tickers: "SPY · QQQ",
    rec: "Thin summer liquidity amplifies moves; avoid initiating big size into low volume." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "MSFT", name: "Microsoft", rank: 1, spot: "~$381.70", sentiment: "Bullish",
    catalyst: "Q4 (FY26) earnings — Wed Jul 29 (after close) · BINARY",
    iv: "Elevated (~±6–7% implied) — rich into the print", liq: "Deepest mega-cap software chain; penny-wide spreads, huge OI",
    thesis: "Best-positioned AI monetizer (Azure + Copilot), but reporting into a market punishing capex (GOOGL −7.7%). Cut vega with a debit spread or get paid to be bullish via a credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $380 / sell $400 · Aug 21 '26 · ~$8 net debit · cost/max loss ~$800 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $370 / buy $360 · Aug 7 '26 · ~$3 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$400 call · Aug 7 '26 · ~$4 debit · cost ~$400 · pure earnings pop" },
    ] },
  { ticker: "META", name: "Meta Platforms", rank: 2, spot: "~$595.19", sentiment: "Neutral-to-Bullish",
    catalyst: "Q2 earnings — Wed Jul 29 (after close) · BINARY",
    iv: "Rich (~±8% implied) — high crush risk", liq: "Deep, very active mega-cap chain; tight spreads",
    thesis: "Ad engine is strong but the tape is hammering AI capex — a defined-risk, range-tolerant stance is safest. Sell premium below support; spread up for cheap upside. High price → spreads only to fit the cap.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $570 / buy $560 · Aug 21 '26 · ~$3 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $600 / sell $620 · Aug 7 '26 · ~$8 net debit · cost/max loss ~$800" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$620 call · Aug 7 '26 · ~$6 debit · cost ~$600" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 3, spot: "~$333.02", sentiment: "Bullish",
    catalyst: "Q3 (FY26) earnings — Thu Jul 30 (after close) · BINARY",
    iv: "Moderately elevated (~±5% implied)", liq: "Deepest equity chain in the market; penny-wide spreads",
    thesis: "The market's AI-capex 'haven' (low capex intensity) and +3.5% on Jul 24. Defined-risk into the binary: a cheap call spread for upside, a credit spread to get paid.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $345 · Aug 21 '26 · ~$7 net debit · cost/max loss ~$700" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $325 / buy $315 · Aug 7 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$345 call · Aug 7 '26 · ~$3 debit · cost ~$300" },
    ] },
  { ticker: "AMZN", name: "Amazon", rank: 4, spot: "~$232.11", sentiment: "Neutral-to-Bullish",
    catalyst: "Q2 earnings — Thu Jul 30 (after close) · BINARY",
    iv: "Rich (~±7% implied) into the print", liq: "Deep, highly liquid mega-cap chain",
    thesis: "AWS reacceleration is the bull case, but heavy capex is the tape's punching bag right now. Keep it defined-risk: a tight call spread plus a credit spread that pays if AMZN merely holds.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $230 / sell $245 · Aug 21 '26 · ~$6 net debit · cost/max loss ~$600" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $225 / buy $215 · Aug 7 '26 · ~$3 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$245 call · Aug 7 '26 · ~$2.50 debit · cost ~$250" },
    ] },
  { ticker: "CVX", name: "Chevron", rank: 5, spot: "~$194.79", sentiment: "Bullish",
    catalyst: "Q2 earnings — Fri Jul 31 (before open); WTI ~$92 + OPEC+ Aug 2",
    iv: "Moderate — cheaper premium than the megacaps", liq: "Deep, liquid large-cap energy chain",
    thesis: "Stacked bullish setup: elevated crude, EPS seen ~$5.79 (+227% y/y), and buybacks. Moderate IV favors owning premium; a debit spread and a credit spread round out the risk tiers.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$190 call · Aug 21 '26 · ~$9 debit · cost ~$900 · Δ≈0.62" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $195 / sell $205 · Aug 21 '26 · ~$4 net debit · cost/max loss ~$400" },
      { profile: "Aggressive",   strategy: "Put Credit Spread", text: "Sell $190 / buy $185 · Aug 7 '26 · ~$1.80 credit · max loss/capital ~$320 · paid to accumulate" },
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
// today line sits on the boundary between Jul 26 and Jul 27
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Sunday, Jul 26 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 26)
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
