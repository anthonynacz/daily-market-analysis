import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, October 16, 2026 (live-researched).
 * Window: last 3 days (Oct 13) → coming 2 weeks (Oct 30).
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

// 18-day axis: Oct 13 .. Oct 30 (last 3 days → coming 2 weeks). Today = index 3 (Oct 16).
const DAYS = [
  { idx: 0, date: "Oct 13", dow: "Tue" },
  { idx: 1, date: "Oct 14", dow: "Wed" },
  { idx: 2, date: "Oct 15", dow: "Thu" },
  { idx: 3, date: "Oct 16", dow: "Fri" }, // TODAY
  { idx: 4, date: "Oct 17", dow: "Sat" },
  { idx: 5, date: "Oct 18", dow: "Sun" },
  { idx: 6, date: "Oct 19", dow: "Mon" },
  { idx: 7, date: "Oct 20", dow: "Tue" },
  { idx: 8, date: "Oct 21", dow: "Wed" },
  { idx: 9, date: "Oct 22", dow: "Thu" },
  { idx: 10, date: "Oct 23", dow: "Fri" },
  { idx: 11, date: "Oct 24", dow: "Sat" },
  { idx: 12, date: "Oct 25", dow: "Sun" },
  { idx: 13, date: "Oct 26", dow: "Mon" },
  { idx: 14, date: "Oct 27", dow: "Tue" },
  { idx: 15, date: "Oct 28", dow: "Wed" },
  { idx: 16, date: "Oct 29", dow: "Thu" },
  { idx: 17, date: "Oct 30", dow: "Fri" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "6th-session AI/chip selloff: NVDA −1.8% to $217, SMH −7.4% WTD on CoreWeave debt (15% yield)", tickers: "NVDA · AMD · SMH",
    rec: "Buy-the-dip quality (NVDA) in tranches; CoreWeave/data-center credit stress is the overhang to watch." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "TSMC beats Q3 but falls 4%+ on sequential gross-margin dip; Nikkei −5%, Kospi −8% on memory", tickers: "TSM · MU · WDC",
    rec: "Margin, not demand, drove the fade — use memory-name weakness to accumulate selectively." },
  { id: "t3", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Baird reiterates Buy on NVDA ($275 PT) & MU ($443 PT) as 2026 semi winners", tickers: "NVDA · MU",
    rec: "Constructive targets, but respect the tape — add on pullbacks into the selloff, not into strength." },
  { id: "t0", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Chips attempt to stabilize Friday after a six-session AI selloff", tickers: "NVDA · AMD · SMH",
    rec: "Watch relief-bounce vs. continuation; keep adds small until CoreWeave/credit fears ease." },
  { id: "t4", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Netflix Q3 earnings (after close) — first mega-cap tech print; ±~8% implied", tickers: "NFLX",
    rec: "Defined-risk only into the binary; strong-FCF story but rich IV crushes hard post-print." },
  { id: "t5", ind: "tech", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q3 earnings (after close) — delivery beat vs. margin test; defends $355", tickers: "TSLA",
    rec: "Size with defined risk; deliveries beat (486k) but autos −2.1% y/y — margins & robotaxi tone decide." },
  { id: "t6", ind: "tech", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "IBM & Lam Research (LRCX) kick off the semi-cap earnings readthrough", tickers: "IBM · LRCX",
    rec: "Watch AI-capex commentary for NVDA/AVGO readthrough; wait for the print, don't front-run." },
  { id: "t7", ind: "tech", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft & Alphabet Q3 earnings (after close) — Azure/Cloud & Gemini capex tell", tickers: "MSFT · GOOGL",
    rec: "Biggest AI-capex readthrough of the window; keep dry powder, prefer defined-risk into both prints." },
  { id: "t8", ind: "tech", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "Amazon Q3 earnings (after close) — AWS reaccel & retail margins", tickers: "AMZN",
    rec: "AWS growth rate is the swing factor; avoid naked premium into the post-print IV crush." },
  { id: "t9", ind: "tech", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "AI-infrastructure credit watch continues (CoreWeave, data-center debt)", tickers: "NVDA · AVGO · ORCL",
    rec: "Monitor HY spreads for AI-levered names; let credit stress settle before adding leverage." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "EIA crude draw ~8.6M bbl vs. small-build est.; Middle East flows still constrained", tickers: "XOM · CVX · USO",
    rec: "Supportive for crude; hold core E&P, trim into spikes given softening demand headlines." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "OPEC & IEA slash 2026 demand outlooks; EIA sees Q4 Brent ~$105 on tight ME supply", tickers: "XOM · CVX · COP",
    rec: "Crosscurrents — tight supply vs. soft demand; stay selective, favor low-cost producers." },
  { id: "e3", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report", tickers: "XOM · CVX · USO",
    rec: "Trade inventory surprises tactically; the Middle East risk premium still dominates fundamentals." },
  { id: "e4", ind: "energy", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly inventories land into the FOMC decision", tickers: "XOM · CVX · USO",
    rec: "A tight draw plus a dovish Fed is the bullish combo for crude; a build offsets it." },
  { id: "e5", ind: "energy", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "OPEC+ production-policy watch ahead of the November ministerial", tickers: "XOM · CVX · OXY",
    rec: "Position light into any supply-quota headlines; a larger-than-expected hike pressures crude." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "UnitedHealth Q3 beats, raises FY adj. EPS to ≥$20.50; turnaround momentum builds", tickers: "UNH",
    rec: "Cost pressures easing — constructive; managed-care sentiment inflecting, add on dips." },
  { id: "h2", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "J&J Q3 solid but MedTech sales +2.5% miss; pharma carries the quarter", tickers: "JNJ",
    rec: "Hold quality; MedTech softness is the watch-item, pharma momentum intact." },
  { id: "h3", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "FDA clears ImmunityBio's Anktiva label expansion", tickers: "IBRX",
    rec: "Binary resolved favorably — speculative name, take partial gains into strength." },
  { id: "h4", ind: "health", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Regeneron pozelimab PDUFA (VEXAS syndrome) decision date (~Oct 20)", tickers: "REGN",
    rec: "Binary catalyst; defined-risk only — approval is incremental, a CRL is the bigger surprise." },
  { id: "h5", ind: "health", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "Eli Lilly Q3 earnings (est.) — GLP-1 (orforglipron/Zepbound) scripts in focus", tickers: "LLY · NVO",
    rec: "Size before headlines; GLP-1 volume & oral-pill ramp drive the whole GLP-1 complex." },
  { id: "h6", ind: "health", dayIdx: 6, future: true, impact: 1, dir: "BEARISH",
    headline: "100% patented-pharma tariff overhang persists for branded makers", tickers: "PFE · MRK · LLY",
    rec: "Margin/headline risk — favor domestic-manufacturing names; avoid import-heavy exposure." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Hot September CPI accelerates MoM; 2026 Fed-HIKE vs. hold now a coin-flip", tickers: "JPM · BAC · SPY · TLT",
    rec: "Position higher-for-longer: asset-sensitive banks win; cut rate-duration into the 10/28 FOMC." },
  { id: "f2", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Big-bank Q3 kickoff: JPM, GS, WFC, C beat on trading/IB (BAC, MS followed 10/14)", tickers: "JPM · GS · BAC · MS",
    rec: "Quality banks delivered — take partial profits into strength, hold the NII beneficiaries." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Travelers Q3 blows past ($9.18 core EPS vs. $7.42 est.) but shares fade", tickers: "TRV",
    rec: "Underwriting strong; hold — but the beat sold off, so don't chase the headline." },
  { id: "f4", ind: "finance", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC two-day meeting begins (decision Oct 28)", tickers: "JPM · BAC · SPY · TLT",
    rec: "Biggest macro swing — hot CPI vs. slowing growth; keep dry powder into the dots & presser." },
  { id: "f5", ind: "finance", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC rate decision 2:00 ET + presser 2:30 — cut vs. hold on a coin-flip", tickers: "SPY · QQQ · TLT · JPM",
    rec: "Avoid new size into 2:00 ET; the presser & dot-plot set the tone for all rate-sensitives." },
  { id: "f6", ind: "finance", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "Q3 advance GDP + September PCE (both 8:30 ET)", tickers: "SPY · TLT · JPM",
    rec: "Post-FOMC data check; a hot PCE revives hike fears, a soft one relieves duration." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Tesla energy chief Mike Snyder departs (per WSJ) ahead of the print", tickers: "TSLA",
    rec: "Management churn adds noise into earnings; factor into position sizing, don't overreact." },
  { id: "c2", ind: "consumer", dayIdx: 6, future: true, impact: 2, dir: "BULLISH",
    headline: "Walmart to cover GLP-1s/insulin for employees at no cost — benefits & traffic angle", tickers: "WMT",
    rec: "Incremental positive for the WMT narrative; hold the defensive-retail leader into a softer consumer." },
  { id: "c3", ind: "consumer", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Consumer-discretionary earnings ramp; affordability & tariff pass-through watch", tickers: "AMZN · HD · TGT",
    rec: "Lean to share-gainers (WMT/AMZN); avoid margin-squeezed discretionary into holiday guides." },
  { id: "c4", ind: "consumer", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Holiday-season setup: early promotions & tariff-driven price watch", tickers: "WMT · TGT · AMZN",
    rec: "Watch promo cadence for margin signals; a heavy discount war pressures retail margins." },

  // ---- FORWARD CATALYSTS (month-end) --------------------------------------
  { id: "x1", ind: "finance", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Month-end & post-FOMC positioning; mega-cap earnings digestion", tickers: "SPY · QQQ",
    rec: "Expect rebalance flows; let the post-FOMC / mega-cap-earnings dust settle before new size." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "NFLX", name: "Netflix", rank: 1, spot: "~$72.61 (Oct 15 close)", sentiment: "Bullish",
    catalyst: "Q3 earnings — Tue Oct 20 (after close) · BINARY · ±~7.7% implied",
    iv: "Elevated into the print — rich → crush risk after; cheap $ premiums post 10:1 split",
    liq: "B — deep-liquidity list (NFLX); trades >100k option contracts/day so weeklies qualify. Live chain data unavailable via proxy; strikes kept near the money, $2.50-wide standard increments.",
    thesis: "Heavy pre-earnings call activity and a strong FCF story, but a binary print with rich IV → avoid naked long calls (max crush). Get paid with a defined-risk put-credit spread; spread up for cheap upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $70 / buy $65 · Nov 20 '26 · ~$1.40 credit · max loss/capital ~$360 · bullish, range-tolerant, harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $72.5 / sell $77.5 · Nov 20 '26 · ~$2.20 net debit · cost/max loss ~$220 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$75 call · Oct 23 '26 (weekly) · ~$1.70 debit · cost ~$170 · pure earnings pop" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 2, spot: "~$362.44 (Oct 15 close)", sentiment: "Bullish (contrarian)",
    catalyst: "Q3 earnings — Wed Oct 21 (after close) · BINARY",
    iv: "High into the binary (earnings + robotaxi narrative) → crush risk after",
    liq: "B — deep-liquidity list (TSLA); among the most active U.S. option chains (>100k contracts/day, weeklies qualify). Live chain data unavailable via proxy; strikes within ~5% of spot on standard monthlies/weeklies.",
    thesis: "Deliveries beat (486k) but autos −2.1% y/y and margins are the test; stock defends $355. Bullish into a high-IV binary → cut vega with a debit spread or get paid via a defined-risk put-credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $360 / sell $380 · Nov 20 '26 · ~$9 net debit · cost/max loss ~$900 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $350 / buy $340 · Oct 23 '26 · ~$3.50 credit · max loss/capital ~$650 · leans on $355 support, harvests crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$380 call · Oct 23 '26 · ~$7 debit · cost ~$700 · earnings breakout" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 3, spot: "~$217.23 (Oct 15 close)", sentiment: "Bullish",
    catalyst: "Buy-the-dip on the 6-session AI selloff (no earnings until ~late Nov)",
    iv: "Elevated by the selloff — richer than usual for NVDA, favoring spreads",
    liq: "A/B — deep-liquidity list (NVDA), the single most-active single-stock chain (~1M+ contracts/day). Live chain data unavailable via proxy; strikes within ~6% of spot on the Nov monthly, 52-wk range $164–243.",
    thesis: "Six down sessions on CoreWeave/data-center credit fears, not a demand miss; Huang reassuring and Baird reiterates a $275 target. Define risk and get paid to buy the dip rather than catch the knife naked.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $215 / sell $230 · Nov 20 '26 · ~$6.50 net debit · cost/max loss ~$650" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $205 / buy $195 · Nov 20 '26 · ~$3 credit · max loss/capital ~$700 · paid to buy the dip" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$230 call · Nov 20 '26 · ~$6 debit · cost ~$600 · rebound play" },
    ] },
  { ticker: "GOOGL", name: "Alphabet", rank: 4, spot: "~$349.22 (Oct 15 close)", sentiment: "Bullish",
    catalyst: "Q3 earnings — Wed Oct 28 (after close) · BINARY",
    iv: "Rising into the print → crush risk after; favor defined-cost structures",
    liq: "B — deep-liquidity list (GOOGL); deep large-cap chain. Live chain data unavailable via proxy; strikes within ~5% of spot on the Nov monthly.",
    thesis: "Cloud/Gemini momentum into a binary print. Bullish but want to cut vega → a defined-cost call spread, with a put-credit spread to get paid for range tolerance.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $345 / sell $365 · Nov 20 '26 · ~$9 net debit · cost/max loss ~$900 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $335 / buy $325 · Nov 20 '26 · ~$3.50 credit · max loss/capital ~$650 · bullish, range-tolerant" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$360 call · Oct 30 '26 · ~$5 debit · cost ~$500 · earnings pop" },
    ] },
  { ticker: "QQQ", name: "Invesco QQQ (Nasdaq-100)", rank: 5, spot: "~$728.00 (Oct 15 close)", sentiment: "Neutral",
    catalyst: "FOMC decision Oct 28 + mega-cap earnings cluster (MSFT/GOOGL 10/28, AMZN 10/29)",
    iv: "Elevated by the hot-CPI hike scare + event cluster → sell premium with defined risk",
    liq: "A/B — deep-liquidity list (QQQ), the deepest ETF option chain alongside SPY (penny-wide, massive OI). Live chain data unavailable via proxy; $5–10-wide standard strikes, 52-wk range $556–763.",
    thesis: "Two-sided risk — a coin-flip Fed and a wall of mega-cap prints against an AI-selloff backdrop. Harvest rich, event-driven premium with fully defined-risk, range-tolerant structures rather than picking a direction.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $700p/buy $690p + sell $755c/buy $765c · Nov 20 '26 · ~$3.00 credit · max loss/capital ~$700 · range-bound through FOMC" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $710 / buy $700 · Nov 20 '26 · ~$3.20 credit · max loss/capital ~$680 · bullish-neutral" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $730 / sell $745 · Oct 30 '26 · ~$6 net debit · cost/max loss ~$600 · post-FOMC/earnings bounce" },
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
// today line sits on the boundary between Oct 16 and Oct 17
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Oct 16 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Oct 16)
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
