import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Monday, October 19, 2026 (live-researched).
 * Window: last 3 days (Oct 16) → coming 2 weeks (Nov 2).
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

// 18-day axis: Oct 16 .. Nov 2 (last 3 days → coming 2 weeks). Today = index 3 (Oct 19).
const DAYS = [
  { idx: 0, date: "Oct 16", dow: "Fri" },
  { idx: 1, date: "Oct 17", dow: "Sat" },
  { idx: 2, date: "Oct 18", dow: "Sun" },
  { idx: 3, date: "Oct 19", dow: "Mon" }, // TODAY
  { idx: 4, date: "Oct 20", dow: "Tue" },
  { idx: 5, date: "Oct 21", dow: "Wed" },
  { idx: 6, date: "Oct 22", dow: "Thu" },
  { idx: 7, date: "Oct 23", dow: "Fri" },
  { idx: 8, date: "Oct 24", dow: "Sat" },
  { idx: 9, date: "Oct 25", dow: "Sun" },
  { idx: 10, date: "Oct 26", dow: "Mon" },
  { idx: 11, date: "Oct 27", dow: "Tue" },
  { idx: 12, date: "Oct 28", dow: "Wed" },
  { idx: 13, date: "Oct 29", dow: "Thu" },
  { idx: 14, date: "Oct 30", dow: "Fri" },
  { idx: 15, date: "Oct 31", dow: "Sat" },
  { idx: 16, date: "Nov 1", dow: "Sun" },
  { idx: 17, date: "Nov 2", dow: "Mon" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Nasdaq −2.1% as AI-'bubble' fears bite; worst week since June", tickers: "NVDA · PLTR · AMD",
    rec: "Don't chase the first bounce; use the AI-sentiment reset to scale into quality (NVDA/MSFT) on weakness." },
  { id: "t2", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "High-multiple unwind: Palantir −7.2%, AMD −6%, Nebius/CoreWeave slide", tickers: "PLTR · AMD · CRWV",
    rec: "Trim stretched momentum; AMD needs the Q4 AI-GPU ramp to justify its multiple — wait for its print." },
  { id: "t3", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Netflix Q3 earnings (after close) kicks off mega-cap tech season", tickers: "NFLX",
    rec: "~8% implied move; don't hold naked long premium into the IV crush — use defined-risk." },
  { id: "t4", ind: "tech", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q3 earnings (after close) — auto margins, deliveries, robotaxi", tickers: "TSLA",
    rec: "Defined-risk only into the binary; weak auto margins vs. the robotaxi narrative is the swing." },
  { id: "t5", ind: "tech", dayIdx: 5, future: true, impact: 3, dir: "BULLISH",
    headline: "Meta Q3 earnings (after close) — AI capex & ad-monetization tell", tickers: "META",
    rec: "Cut vega into the print (debit spread); strong ad growth re-rates, a capex blowout spooks." },
  { id: "t6", ind: "tech", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Texas Instruments, Lam Research & IBM report (after close)", tickers: "TXN · LRCX · IBM",
    rec: "Analog/equipment read-through for the chip cycle; watch TXN's auto/industrial guide." },
  { id: "t7", ind: "tech", dayIdx: 12, future: true, impact: 3, dir: "BULLISH",
    headline: "Microsoft FQ1 + Alphabet Q3 (after close) — cloud & AI capex", tickers: "MSFT · GOOGL",
    rec: "Core AI-infra longs; Azure/Cloud growth and capex discipline are the keys. StoneX lifted MSFT target to $600." },
  { id: "t8", ind: "tech", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "Amazon Q3 + Intel Q3 (after close)", tickers: "AMZN · INTC",
    rec: "AWS reacceleration is the AMZN bull case; INTC foundry progress still show-me." },
  { id: "t9", ind: "tech", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "Apple FQ4 earnings (after close) — iPhone 17 cycle & Services", tickers: "AAPL",
    rec: "Relative-strength name; holiday-quarter guide and China are the swing. Defined-risk into the print." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Oil extends rally: Brent ~$107, WTI ~$97 on supply tightness", tickers: "XOM · CVX · COP",
    rec: "Keep core E&P as an inflation/geopolitics hedge; trim into vertical spikes." },
  { id: "e2", ind: "energy", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "API crude inventory estimate (weekly)", tickers: "XOM · USO",
    rec: "Trade draws vs. consensus; a surprise build caps the rally." },
  { id: "e3", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report", tickers: "XOM · CVX · USO",
    rec: "Watch distillate draws into winter; tight inventories support the complex." },
  { id: "e4", ind: "energy", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Energy majors earnings loom (XOM/CVX ~Oct 31)", tickers: "XOM · CVX",
    rec: "Cash-return stories; buybacks/dividends matter more than the single-quarter print." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Managed-care & pharma Q3 season opens this week", tickers: "UNH · JNJ · LLY",
    rec: "Watch MA medical-cost ratios (UNH) and GLP-1 commentary (LLY/NVO); cost-trend guide drives the group." },
  { id: "h2", ind: "health", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Regeneron pozelimab PDUFA (VEXAS syndrome) target date", tickers: "REGN",
    rec: "Binary regulatory catalyst; keep single-name biotech positions small and defined into the date." },
  { id: "h3", ind: "health", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "GSK/Ionis bepirovirsen PDUFA — chronic hepatitis B", tickers: "GSK · IONS",
    rec: "Trackers peg ~85% approval odds; size the binary small — approval largely priced." },
  { id: "h4", ind: "health", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "Lilly & Novo GLP-1 updates in focus as pharma Q3 ramps", tickers: "LLY · NVO · VKTX",
    rec: "Size GLP-1 exposure before headlines; obesity-share shifts stay volatile — don't chase." },
  { id: "h5", ind: "health", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "Inovio INO-3107 PDUFA (RRP, accelerated path)", tickers: "INO",
    rec: "High-volatility micro-cap binary (~65–75% odds per trackers) — lottery-size only." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "Big banks wrap Q3: Goldman crushes (+30% beat), JPMorgan misses revenue & cuts buyback", tickers: "GS · JPM · MS · BAC",
    rec: "Favor capital-markets winners (GS/MS); JPM's revenue miss + buyback cut is a caution flag." },
  { id: "f2", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Equities-trading boom lifts broker-dealers; GS equities revenue +72% y/y", tickers: "GS · MS · SCHW",
    rec: "Ride the trading/IB rebound but take partial profits after the run — rates-sensitive FICC lagged." },
  { id: "f3", ind: "finance", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC meeting begins (Oct 27–28); blackout in effect", tickers: "JPM · BAC · SPY · TLT",
    rec: "Biggest macro swing in the window — hold-with-hawkish-risk; keep dry powder into the dots." },
  { id: "f4", ind: "finance", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC rate decision + presser — target range 3.50–3.75%", tickers: "SPY · QQQ · XLF · TLT",
    rec: "Market split (~15–25% cut odds, residual hike risk); asset-sensitive banks favored if higher-for-longer." },
  { id: "f5", ind: "finance", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "Regional-bank Q3 reports continue", tickers: "KRE · USB · PNC",
    rec: "Watch NII trajectory and CRE credit; stay selective on quality regionals." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "GM Q3 earnings (before open) — EV losses, tariffs, pricing", tickers: "GM · F",
    rec: "Watch EV-loss trajectory and buyback pace; affordability still pressures volumes (consensus ~$3.52 EPS)." },
  { id: "c2", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Coca-Cola Q3 earnings (before open) — staples pricing power", tickers: "KO · PEP · PG",
    rec: "Defensive bid in a jittery tape; volume-vs-price mix is the tell, not headline EPS." },
  { id: "c3", ind: "consumer", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Airlines & travel Q3 reports (demand/capacity)", tickers: "UAL · DAL · AAL",
    rec: "Watch unit-revenue guide into holiday travel; capacity discipline matters more than the quarter." },
  { id: "c4", ind: "consumer", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Consumer bellwethers cluster with FOMC (payments/restaurants)", tickers: "V · MA · MCD",
    rec: "Payments names (V/MA) read consumer spend; watch guidance tone into the holidays." },

  // ---- FORWARD CATALYSTS (week 2: Oct 27 – Nov 2) -------------------------
  { id: "x1", ind: "tech", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Post-FOMC + mega-cap digestion (MSFT/GOOGL/AMZN read-through)", tickers: "SPY · QQQ · NVDA",
    rec: "Let the Fed and the cloud prints settle before re-risking; confirm AI-capex strength, don't front-run it." },
  { id: "x2", ind: "finance", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Month-end rebalancing & window dressing", tickers: "SPY · QQQ · IWM",
    rec: "Expect month-end flows and pin risk; don't over-read end-of-month moves." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "TSLA", name: "Tesla", rank: 1, spot: "~$355 (Oct 16 close $354.72)", sentiment: "Neutral",
    catalyst: "Q3 earnings — Wed Oct 21 (after close) · BINARY",
    iv: "Very rich into the print (~±9–10% implied) — IV crush expected",
    liq: "B — deep-liquidity list (one of the most active single-stock chains, >1M contracts/day typical); live chain data unavailable, strikes kept near the money on the Oct 23 weekly",
    thesis: "Neutral into a binary with expensive IV → don't buy naked premium (max crush). Sell defined-risk premium outside the implied move and harvest the vol collapse; keep one small directional lotto.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $325P/$385C, buy $315P/$395C · Oct 23 '26 · ~$3.00 credit · max loss/capital ~$700 · profits if TSLA stays ±8%" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $335 / buy $325 · Oct 23 '26 · ~$3.30 credit · max loss/capital ~$670 · mildly bullish, harvests crush" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $370 / sell $385 · Oct 23 '26 · ~$4.50 net debit · cost/max loss ~$450 · upside-pop lotto" },
    ] },
  { ticker: "META", name: "Meta Platforms", rank: 2, spot: "~$709 (Oct 16 close $709.33)", sentiment: "Bullish",
    catalyst: "Q3 earnings — Wed Oct 21 (after close) · BINARY",
    iv: "Rich (~±7–8% implied) after −3.7% Friday — cut vega",
    liq: "B — deep-liquidity list (very active mega-cap chain); live chain data unavailable, strikes kept within ~10% of spot on monthlies/weeklies",
    thesis: "Bullish on AI ad-monetization but into a binary with pricey IV → avoid naked long calls. Cut vega with a wider-dated debit spread, get paid via a defined-risk credit spread, keep a cheap OTM lotto.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $700 / sell $720 · Nov 20 '26 · ~$10 net debit · cost/max loss ~$1,000 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $680 / buy $670 · Oct 23 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$730 call · Oct 23 '26 · ~$6 debit · cost ~$600 · pure earnings pop" },
    ] },
  { ticker: "MSFT", name: "Microsoft", rank: 3, spot: "~$529 (Oct 16 close $529.05)", sentiment: "Bullish",
    catalyst: "FQ1 earnings — Wed Oct 28 (after close) · BINARY",
    iv: "Elevated into the print (~±5–6% implied)",
    liq: "B — deep-liquidity list (deep large-cap chain); live chain data unavailable, strikes kept near the money on monthlies/weeklies",
    thesis: "Azure/AI-capex bellwether; StoneX just lifted its target to $600. Bullish into the cloud print → defined-cost debit spread for upside, defined-risk credit spread to get paid, cheap OTM for the pop.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $520 / sell $540 · Nov 20 '26 · ~$9 net debit · cost/max loss ~$900" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $510 / buy $500 · Oct 30 '26 · ~$3.30 credit · max loss/capital ~$670 · bullish, range-tolerant" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$550 call · Oct 30 '26 · ~$5 debit · cost ~$500 · earnings-pop lotto" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 4, spot: "~$343 (Oct 16 close $343.46)", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Mon Nov 2 (after close) · BINARY",
    iv: "Cheapest of the mega-caps (~±4–5% implied) → long premium more tolerable",
    liq: "B — deep-liquidity list (deepest equity option chain in the market); live chain data unavailable, strikes kept near the money on the Nov monthly",
    thesis: "Relative-strength name (up Friday against the tape) with the cheapest IV of the group → a moderate-delta long call is tolerable. Spread up for a cheaper defined-cost version; cheap OTM on the weekly for the print.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$335 call · Nov 20 '26 · ~$14 debit · cost ~$1,400 · Δ≈0.60" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $345 / sell $360 · Nov 20 '26 · ~$6 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$355 call · Nov 6 '26 · ~$3.50 debit · cost ~$350 · pure earnings pop" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 5, spot: "~$214 (Oct 16 close $214.13)", sentiment: "Bullish",
    catalyst: "No earnings in window (next ~mid-Nov) — AI-sentiment dip-buy; no binary crush",
    iv: "Elevated market-wide, but NO earnings event → long premium works",
    liq: "B — deep-liquidity list (the single most active option chain in the market); live chain data unavailable, strikes kept within ~10% of spot on the Nov monthly",
    thesis: "Epicenter of the AI-'bubble' reset but no earnings binary until mid-Nov → buy the dip with no IV-crush risk. Defined-cost debit spread or moderate-delta long call; a put-credit spread gets paid to accumulate.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $210 / sell $225 · Nov 20 '26 · ~$6.50 net debit · cost/max loss ~$650" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $200 / buy $190 · Nov 20 '26 · ~$3 credit · max loss/capital ~$700 · paid to accumulate" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$230 call · Nov 20 '26 · ~$5 debit · cost ~$500" },
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
// today line sits on the boundary between Oct 19 and Oct 20
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Monday, Oct 19 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Oct 19)
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
