import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, October 23, 2026 (live-researched).
 * Window: last 3 days (Oct 20) → coming 2 weeks (Nov 6).
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

// 18-day axis: Oct 20 .. Nov 6 (last 3 days → coming 2 weeks). Today = index 3 (Oct 23).
const DAYS = [
  { idx: 0, date: "Oct 20", dow: "Tue" },
  { idx: 1, date: "Oct 21", dow: "Wed" },
  { idx: 2, date: "Oct 22", dow: "Thu" },
  { idx: 3, date: "Oct 23", dow: "Fri" }, // TODAY
  { idx: 4, date: "Oct 24", dow: "Sat" },
  { idx: 5, date: "Oct 25", dow: "Sun" },
  { idx: 6, date: "Oct 26", dow: "Mon" },
  { idx: 7, date: "Oct 27", dow: "Tue" },
  { idx: 8, date: "Oct 28", dow: "Wed" },
  { idx: 9, date: "Oct 29", dow: "Thu" },
  { idx: 10, date: "Oct 30", dow: "Fri" },
  { idx: 11, date: "Oct 31", dow: "Sat" },
  { idx: 12, date: "Nov 1", dow: "Sun" },
  { idx: 13, date: "Nov 2", dow: "Mon" },
  { idx: 14, date: "Nov 3", dow: "Tue" },
  { idx: 15, date: "Nov 4", dow: "Wed" },
  { idx: 16, date: "Nov 5", dow: "Thu" },
  { idx: 17, date: "Nov 6", dow: "Fri" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "AI-capex rout: Nasdaq −2.6% to 26,009 (worst day since June); NVDA −4.4% to $212.21, AMD −8%; ~$200B wiped from chips on a Lam Research supply-chain warning", tickers: "NVDA · AMD · LRCX · MU",
    rec: "WATCH — don't catch the knife; hold core NVDA, add only after the MSFT/GOOGL/AMZN capex guides (Oct 28–29) show the spend is still paying off." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Meta Q3 (Oct 21, after close) — AI cost growth outpacing revenue; shares ~−7% next session and led the AI-trade selloff", tickers: "META",
    rec: "HOLD — the ad engine is intact but spend is the story; wait for the reaction to base before adding." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Mega-caps split: AMZN −4.6% ($250.38), GOOGL −3.1% ($324.22), MSFT −2.2% ($521.08) — while AAPL +1.2% to $348.22 bucked the tape", tickers: "AMZN · GOOGL · MSFT · AAPL",
    rec: "Pre-earnings reset — the dip lowers the bar into next week's prints; stagger entries rather than buying all before the binaries." },
  { id: "t4", ind: "tech", dayIdx: 3, future: false, impact: 1, dir: "BULLISH",
    headline: "SpaceX (SPCX) +1.6% to $147.04 as AI/space names bounce off Thursday's lows; Nasdaq futures still −0.4% pre-market", tickers: "SPCX · QQQ",
    rec: "WATCH — one-day bounces in a capex scare are unreliable; let the mega-cap prints confirm a bottom." },
  { id: "t5", ind: "tech", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft FQ1 FY27 after close (call 5:30 ET) — consensus EPS ~$4.72 / rev ~$90.6B; Azure guide ~45% cc", tickers: "MSFT",
    rec: "WATCH — Azure ≥45% with steady capex re-rates the group; a capex jump like Meta's gets punished. Defined-risk only." },
  { id: "t6", ind: "tech", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Alphabet Q3 after close (call 4:30 ET) — Search resilience, Cloud growth & 2027 capex", tickers: "GOOGL · GOOG",
    rec: "WATCH — same night as MSFT and the FOMC; Cloud acceleration is the bull trigger, capex creep the risk." },
  { id: "t7", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Amazon Q3 after close (call 5:00 ET) — AWS re-acceleration vs. capex; Morgan Stanley top pick, PT $350", tickers: "AMZN",
    rec: "WATCH — down ~21% from highs, so a clean AWS print has room to run; size for a ±6–7% binary." },
  { id: "t8", ind: "tech", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "Apple FQ4 after close — first call with John Ternus as CEO; rev guide ~$111.7–113.7B, first full quarter of June price hikes", tickers: "AAPL",
    rec: "WATCH — relative-strength leader into the print; a clean iPhone/Services guide extends it, a soft one unwinds the defensive bid." },
  { id: "t9", ind: "tech", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Palantir Q3 after close (date per most calendars; not all confirm)", tickers: "PLTR",
    rec: "High-beta AI software — expect a double-digit move either way; small, defined-risk size only." },
  { id: "t10", ind: "tech", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "AMD Q3 after close — data-center GPU ramp after the 8% drawdown", tickers: "AMD · NVDA",
    rec: "WATCH — a strong MI-series guide could make AMD the first chip name to recover; wait for the print." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Brent +4% to $113.17 (highest since May 4), WTI +2.4% to $99.47 after Houthi attacks on Saudi oilfields and Iran's tighter grip on Hormuz", tickers: "XOM · CVX · COP · USO",
    rec: "HOLD/ADD core majors as a geopolitical hedge; use trailing stops — a de-escalation headline reverses it fast." },
  { id: "e2", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "WTI breaks $100 (~$100.30), Brent ~$114; Aramco evacuates HQ; Trump says the US is not negotiating with Iran; Brent–WTI spread ~$13–14", tickers: "XOM · CVX · OXY",
    rec: "Don't chase spikes — buy energy on pullbacks; the wide Brent–WTI spread favours US-exposed producers/refiners." },
  { id: "e3", ind: "energy", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "USO · XOM · CVX",
    rec: "A bigger-than-expected draw adds to the supply squeeze; geopolitics is dominating fundamentals." },
  { id: "e4", ind: "energy", dayIdx: 10, future: true, impact: 2, dir: "BULLISH",
    headline: "ExxonMobil Q3 before open — EPS est ~$4.10 on ~$105B rev; stock $178.23 vs 52-wk high $180.31", tickers: "XOM",
    rec: "Lean bullish — $100 oil + buybacks; a breakout above $180 on the print is the trigger, but some is priced in." },
  { id: "e5", ind: "energy", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Post-midterm Iran risk: reports of US/Israeli strike plans after the Nov 3 election keep a war premium in crude", tickers: "XOM · CVX · USO",
    rec: "Keep energy as insurance, not a core bet; size so a ceasefire gap-down is tolerable." },
  { id: "e6", ind: "energy", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "EIA weekly petroleum status report", tickers: "USO · XOM",
    rec: "Watch draws vs. consensus; second data point on demand at $100 crude." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Defensive rotation into healthcare: Teva up on an FDA approval, Roivant up on late-stage data; Intuitive Surgical slips after results", tickers: "TEVA · ROIV · ISRG",
    rec: "Healthcare is the risk-off parking lot — HOLD quality pharma as ballast while tech is volatile." },
  { id: "h2", ind: "health", dayIdx: 0, future: false, impact: 1, dir: "BULLISH",
    headline: "Lilly: positive Phase 3 SHINE-2 Omvoh data in pediatric ulcerative colitis (Oct 19); stock +18% YTD", tickers: "LLY",
    rec: "Incremental positive — the real catalyst is next week's Q3 GLP-1 print." },
  { id: "h3", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "AbbVie Q3 before open — Skyrizi/Rinvoq immunology growth vs. Humira erosion", tickers: "ABBV",
    rec: "HOLD — defensive compounder; act on the guide, not the headline beat/miss." },
  { id: "h4", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "GSK/Ionis bepirovirsen (chronic hepatitis B) PDUFA — Priority Review + Breakthrough", tickers: "GSK · IONS",
    rec: "Binary for IONS — size small; approval is upside, a CRL hits the small-cap hard." },
  { id: "h5", ind: "health", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Eli Lilly Q3 — Zepbound/Mounjaro demand & orforglipron launch prep", tickers: "LLY · NVO",
    rec: "WATCH — GLP-1 volume beats keep LLY the sector leader; soft scripts pressure both LLY and NVO." },
  { id: "h6", ind: "health", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "Sun Pharma ILUMYA (tildrakizumab) BLA PDUFA", tickers: "SUNPHARMA",
    rec: "Low US-equity impact; incremental for the IL-23 class." },
  { id: "h7", ind: "health", dayIdx: 10, future: true, impact: 1, dir: "MIXED",
    headline: "INOVIO INO-3107 (recurrent respiratory papillomatosis) PDUFA — accelerated approval", tickers: "INO",
    rec: "Speculative binary — lottery-ticket sizing only." },
  { id: "h8", ind: "health", dayIdx: 12, future: true, impact: 1, dir: "MIXED",
    headline: "Agios mitapivat sickle-cell sNDA PDUFA (Sunday — action likely around Nov 2)", tickers: "AGIO",
    rec: "Binary for AGIO; avoid holding size through a weekend goal date." },

  // ---- FINANCIALS / MACRO -------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Risk-off bid: Treasury yields fall as money rotates to bonds, utilities, staples; S&P 500 −1.2% to ~7,664, Dow flat", tickers: "SPY · TLT · XLU",
    rec: "Don't de-risk wholesale — the Dow's flat close says this is an AI-trade unwind, not a broad recession scare." },
  { id: "f2", ind: "finance", dayIdx: 3, future: false, impact: 1, dir: "BEARISH",
    headline: "SLM Corp −4.6% after a Q3 loss", tickers: "SLM",
    rec: "AVOID — credit-quality noise in consumer lending; wait for clarity on provisions." },
  { id: "f3", ind: "finance", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision 2pm ET (meets Oct 27–28) — ~80% hold priced at 3.75–4.00%; markets eye a Dec 9 hike; Warsh presser is the swing", tickers: "SPY · JPM · BAC · TLT",
    rec: "Keep dry powder — a hawkish surprise (October hike) would hit long-duration tech hardest; banks benefit from higher-for-longer." },
  { id: "f4", ind: "finance", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Q3 GDP (advance) + September PCE inflation, 8:30 ET — morning after the Fed", tickers: "SPY · TLT · JPM",
    rec: "Biggest data cluster of the window; a hot PCE cements a December hike — trade after the print, not before." },
  { id: "f5", ind: "finance", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing PMI (October)", tickers: "SPY · CAT · XLI",
    rec: "Growth check; a rebound above 50 supports cyclicals, a slump revives slowdown fears." },
  { id: "f6", ind: "finance", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "US midterm elections — control of Congress; JOLTS (Sept) at 10:00 ET same day", tickers: "SPY · IWM · XLF · XLE",
    rec: "Expect elevated vol into the vote; historically equities rally after midterms resolve — avoid big directional bets the day before." },
  { id: "f7", ind: "finance", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "October jobs report (NFP), 8:30 ET", tickers: "SPY · JPM · TLT",
    rec: "Last big macro print of the window; a hot number firms December hike odds — keep size light into it." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Tesla Q3: EPS $0.48 beat ($0.45 est) on flat $28.05B rev; deliveries 486.5k beat, storage 13.7 GWh missed", tickers: "TSLA",
    rec: "HOLD — a better quarter than Q2 but the trend hasn't changed; stock −22% YTD needs robotaxi/AI proof, not a beat." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Chipotle slides toward its ~$28 52-wk low (−19% in a month) after Starbucks denies takeover talk", tickers: "CMG · SBUX",
    rec: "WATCH — the bid premium is gone; wait for the Oct 28 print before bottom-fishing." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 1, dir: "BULLISH",
    headline: "Staples rotation: Domino's beats; Coca-Cola +~33% YTD (~29× earnings) as investors hide in defensives", tickers: "DPZ · KO · PG · PEP",
    rec: "HOLD staples as ballast, but don't chase KO at ~29× — the defensive premium is already rich." },
  { id: "c4", ind: "consumer", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Coca-Cola Q3 before open — pricing vs. volume", tickers: "KO · PEP",
    rec: "A beat is expected at this valuation; any volume softness could trigger profit-taking." },
  { id: "c5", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Chipotle Q3 after close — traffic & margin after the takeover-denial slide", tickers: "CMG",
    rec: "Binary — comps stabilization would spark a relief bounce off the lows; keep size small." },
  { id: "c6", ind: "consumer", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Uber Q3 before open; Disney also expected this week (date unconfirmed)", tickers: "UBER · DIS",
    rec: "Read-through on discretionary demand and ads; trade the guide, not the print." },
  { id: "c7", ind: "consumer", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Holiday-season setup into the jobs report — retail promo calendars ramp", tickers: "AMZN · WMT · TGT",
    rec: "Favour share-gaining scale retailers (AMZN/WMT); a soft NFP hurts discretionary." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "AMZN", name: "Amazon", rank: 1, spot: "$250.38 (Oct 22 close)", sentiment: "Bullish",
    catalyst: "Q3 earnings — Thu Oct 29 (after close) · BINARY · AWS re-acceleration; day after FOMC",
    iv: "Elevated into the print (~±6–7% implied) — ESTIMATE; expect IV crush after",
    liq: "B — deep-liquidity list; live chain data unavailable (option-chain sites blocked by network policy), strikes kept within ~8% of spot on Nov 20 & Dec 18 monthlies",
    thesis: "Fell 4.6% in the AI-capex rout and sits ~21% below its highs, so the bar into earnings is lower; Morgan Stanley top pick. Bullish but into a binary with rich IV → defined-risk debit spread for upside, credit spread to harvest the crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $250 / sell $265 · Dec 18 '26 · ~$6.30 net debit (EST) · cost/max loss ~$630 · max gain ~$870" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $240 / buy $230 · Nov 20 '26 · ~$2.80 credit (EST) · max loss/capital ~$720 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$265 call · Nov 20 '26 · ~$4.70 debit (EST) · cost ~$470 · AWS-beat pop" },
    ] },
  { ticker: "MSFT", name: "Microsoft", rank: 2, spot: "$521.08 (Oct 22 close)", sentiment: "Neutral-to-Bullish",
    catalyst: "FQ1 FY27 earnings — Wed Oct 28 (after close) · BINARY · same day as FOMC",
    iv: "Rich into the print (~±5% implied) — ESTIMATE",
    liq: "B — deep-liquidity list; live chain data unavailable (option-chain sites blocked by network policy), strikes kept within ~8% of spot on Nov 20 monthly",
    thesis: "Azure guided ~45% cc and revenue $89.9–91.0B; the 2.2% dip resets expectations, but the market just punished Meta's spend → avoid naked long premium. Get paid below support; spread the upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $490 / buy $480 · Nov 20 '26 · ~$2.25 credit (EST) · max loss/capital ~$775 · ~6% OTM cushion" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $520 / sell $540 · Nov 20 '26 · ~$8.50 net debit (EST) · cost/max loss ~$850 · max gain ~$1,150" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$550 call · Nov 20 '26 · ~$7.40 debit (EST) · cost ~$740 · needs a beat-and-raise (IV-crush risk)" },
    ] },
  { ticker: "GOOGL", name: "Alphabet", rank: 3, spot: "$324.22 (Oct 22 close)", sentiment: "Bullish",
    catalyst: "Q3 earnings — Wed Oct 28 (after close) · BINARY · Search / Cloud / capex",
    iv: "Elevated into earnings (~±6% implied) — ESTIMATE",
    liq: "B — deep-liquidity list; live chain data unavailable (option-chain sites blocked by network policy), strikes kept within ~9% of spot on Nov 20 & Dec 18 monthlies",
    thesis: "−3.1% in the selloff with no company-specific news; Search resilient and Cloud reaccelerating. Debit spread to cut vega, credit spread below support to get paid for the crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $320 / sell $340 · Dec 18 '26 · ~$8.50 net debit (EST) · cost/max loss ~$850 · max gain ~$1,150" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $305 / buy $295 · Nov 20 '26 · ~$2.20 credit (EST) · max loss/capital ~$780 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$340 call · Nov 20 '26 · ~$6.10 debit (EST) · cost ~$610 · Cloud-beat pop" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 4, spot: "$348.22 (Oct 22 close)", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Mon Nov 2 (after close) · BINARY · Ternus's first call as CEO",
    iv: "Moderate (~±4–5% implied) — ESTIMATE",
    liq: "B — deep-liquidity list; live chain data unavailable (option-chain sites blocked by network policy), strikes kept within ~8% of spot on Nov 20 & Dec 18 monthlies",
    thesis: "+1.2% on a −2.6% Nasdaq day — relative-strength leader with little AI-capex exposure; first full quarter of price hikes. Bullish with tamer IV → debit spread for upside, credit spread below support.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $345 / sell $360 · Dec 18 '26 · ~$6.90 net debit (EST) · cost/max loss ~$690 · max gain ~$810" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $330 / buy $320 · Nov 20 '26 · ~$2.00 credit (EST) · max loss/capital ~$800 · range-tolerant" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$365 call · Nov 20 '26 · ~$4.40 debit (EST) · cost ~$440 · post-earnings breakout" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 5, spot: "$178.23 (Oct 22 close)", sentiment: "Bullish",
    catalyst: "Q3 earnings — Fri Oct 30 (before open); WTI >$100 on Hormuz / Saudi attacks",
    iv: "Moderately elevated (~30%) on the oil spike + earnings — ESTIMATE",
    liq: "B — deep-liquidity list; live chain data unavailable (option-chain sites blocked by network policy), strikes kept within ~9% of spot on Nov 20 & Dec 18 monthlies",
    thesis: "Stacked catalysts: $100 crude supply premium plus a Q3 print with the stock just under its $180.31 52-week high. Debit spread for the breakout; put-credit spread to get paid while accumulating. A ceasefire headline is the key risk.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $175 / sell $185 · Dec 18 '26 · ~$4.60 net debit (EST) · cost/max loss ~$460 · max gain ~$540" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $170 / buy $162.50 · Nov 20 '26 · ~$1.60 credit (EST) · max loss/capital ~$590" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$190 call · Nov 20 '26 · ~$1.80 debit (EST) · cost ~$180 · oil-spike breakout" },
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
// today line sits on the boundary between Oct 23 and Oct 24
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Oct 23 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Oct 23)
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
