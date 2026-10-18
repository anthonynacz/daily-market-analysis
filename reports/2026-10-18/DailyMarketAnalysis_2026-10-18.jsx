import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Sunday, October 18, 2026 (live-researched).
 * Window: last 3 days (Oct 15) → coming 2 weeks (Nov 1).
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

// 18-day axis: Oct 15 .. Nov 1 (last 3 days → coming 2 weeks). Today = index 3 (Oct 18).
const DAYS = [
  { idx: 0, date: "Oct 15", dow: "Thu" },
  { idx: 1, date: "Oct 16", dow: "Fri" },
  { idx: 2, date: "Oct 17", dow: "Sat" },
  { idx: 3, date: "Oct 18", dow: "Sun" }, // TODAY
  { idx: 4, date: "Oct 19", dow: "Mon" },
  { idx: 5, date: "Oct 20", dow: "Tue" },
  { idx: 6, date: "Oct 21", dow: "Wed" },
  { idx: 7, date: "Oct 22", dow: "Thu" },
  { idx: 8, date: "Oct 23", dow: "Fri" },
  { idx: 9, date: "Oct 24", dow: "Sat" },
  { idx: 10, date: "Oct 25", dow: "Sun" },
  { idx: 11, date: "Oct 26", dow: "Mon" },
  { idx: 12, date: "Oct 27", dow: "Tue" },
  { idx: 13, date: "Oct 28", dow: "Wed" },
  { idx: 14, date: "Oct 29", dow: "Thu" },
  { idx: 15, date: "Oct 30", dow: "Fri" },
  { idx: 16, date: "Oct 31", dow: "Sat" },
  { idx: 17, date: "Nov 1", dow: "Sun" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "AI-financing fears sink Nasdaq ~−2.4%; CoreWeave −11.8%, Nebius −11.2%", tickers: "CRWV · NBIS · NVDA · QQQ",
    rec: "Use the AI-capex 'bubble' reset to scale into quality (NVDA/MSFT) on dips; avoid levered AI-infra names until financing fears cool." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Twilio −8% on post-S&P-inclusion profit-taking", tickers: "TWLO",
    rec: "Don't chase the index-add unwind; wait for a base to form before re-engaging." },
  { id: "t3", ind: "tech", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Netflix Q3 (after close, Oct 20) — content-leadership shakeup overhang; ±~9% implied", tickers: "NFLX",
    rec: "Size before the print; subs + ad-tier commentary drive it — don't chase into ±9% IV." },
  { id: "t4", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q3 earnings (after close, Oct 21) — auto margins & robotaxi update; ±~6% implied", tickers: "TSLA",
    rec: "Defined-risk only into the binary; a clean auto-margin + robotaxi beat re-rates, a miss revisits the lows." },
  { id: "t5", ind: "tech", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "IBM & Texas Instruments Q3 (after close, Oct 21)", tickers: "IBM · TXN",
    rec: "TXN guide is the analog-cycle tell; IBM software/AI bookings in focus — watch, don't pre-position." },
  { id: "t6", ind: "tech", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft & Alphabet Q3 (after close, Oct 28) — Azure/Cloud growth + AI-capex guide", tickers: "MSFT · GOOGL",
    rec: "The AI-capex verdict for the tape; strong cloud + disciplined capex is the bull trigger, a capex blowout without revenue spooks it." },
  { id: "t7", ind: "tech", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Amazon Q3 (after close, Oct 29) — AWS reacceleration & holiday guide", tickers: "AMZN",
    rec: "AWS growth is the key tell; pair defined-risk upside with a crush-harvesting credit spread into the binary." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 1, dir: "MIXED",
    headline: "Energy lags as crude stays soft on 2026 oversupply outlook", tickers: "XOM · CVX · COP",
    rec: "Keep energy income-oriented/underweight; soft crude favors low-cost integrated majors over high-beta E&P." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (inventories)", tickers: "XOM · CVX · USO",
    rec: "Use builds/draws to time entries; the macro oversupply narrative dominates the near term." },
  { id: "e3", ind: "energy", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly inventories (Wed Oct 22)", tickers: "XOM · CVX · USO",
    rec: "A larger-than-expected crude draw would be the near-term bullish surprise against the oversupply call." },
  { id: "e4", ind: "energy", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "Energy majors Q3 preview — Exxon & Chevron report ~Oct 30", tickers: "XOM · CVX",
    rec: "Buybacks + downstream margins in focus; position via the stock and keep any options defined-risk." },
  { id: "e5", ind: "energy", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "Exxon & Chevron Q3 earnings (~Fri Oct 30, before open)", tickers: "XOM · CVX",
    rec: "Cash-return & capex discipline drive the reaction; a soft-crude quarter tests dividend-coverage narratives." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "FDA PDUFA — Roche/Genentech Enspryng (satralizumab) decision due (~Oct 15)", tickers: "RHHBY",
    rec: "Label-expansion catalyst; limited US-listed options read-through — watch for approval confirmation." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 1, dir: "MIXED",
    headline: "Viatris/Opus phentolamine (presbyopia) PDUFA (~Oct 17)", tickers: "VTRS · IRD",
    rec: "Small-cap binary; size tiny — approval odds look high (~83%) but the options are illiquid." },
  { id: "h3", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Eli Lilly & Newmont lead a defensive bid as money rotates out of AI", tickers: "LLY · NEM",
    rec: "Rotation beneficiary; LLY's GLP-1 franchise is a quality-growth hedge against AI-multiple risk." },
  { id: "h4", ind: "health", dayIdx: 5, future: true, impact: 2, dir: "BULLISH",
    headline: "Regeneron pozelimab VEXAS-syndrome PDUFA (~Oct 20)", tickers: "REGN",
    rec: "High approval odds (~93%); incremental for REGN — hold quality, don't chase a known date." },
  { id: "h5", ind: "health", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "GSK bepirovirsen chronic-hepatitis-B PDUFA (~Oct 26)", tickers: "GSK",
    rec: "Functional-cure HBV catalyst; binary for the GSK pipeline narrative — watch, defined-risk only." },
  { id: "h6", ind: "health", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Inovio INO-3107 (recurrent respiratory papillomatosis) PDUFA (~Oct 30)", tickers: "INO",
    rec: "Micro-cap binary; lottery-ticket sizing only — the options chain is thin." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Regional banks beat — Regions & Citizens post solid Q3; credit stays stable", tickers: "RF · CFG · MTB · KRE",
    rec: "Credit fears look overdone so far (NCOs ~37–50bps); own quality regionals (CFG/RF) on dips." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "BNY +3.2%, Marsh & McLennan +4.6%, Travelers beat on Q3", tickers: "BK · MMC · TRV",
    rec: "Trust-bank & insurance beats; take partial profits into strength — these aren't chase-higher names." },
  { id: "f3", ind: "finance", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Card & regional-bank Q3 stragglers report (consumer-credit read)", tickers: "COF · USB",
    rec: "Watch card charge-off trends for the consumer-credit tell; neutral until the data confirms." },
  { id: "f4", ind: "finance", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (2pm ET, Wed Oct 28) — no SEP; cut-vs-hold debate after the Sept hike", tickers: "JPM · BAC · SPY · TLT",
    rec: "Biggest macro swing in the window; keep dry powder — a hawkish hold pressures rate-sensitive sectors." },
  { id: "f5", ind: "finance", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Q3 advance GDP + September PCE (8:30 ET, Thu Oct 29)", tickers: "SPY · QQQ · TLT",
    rec: "Growth + the Fed's preferred inflation gauge in one print; a hot PCE revives hike fears, a soft one is risk-on." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "September retail sales — consumer-resilience check", tickers: "WMT · TGT · AMZN · XRT",
    rec: "A firm print supports staples/discounters; watch for trade-down signals that favor WMT." },
  { id: "c2", ind: "consumer", dayIdx: 0, future: false, impact: 1, dir: "BEARISH",
    headline: "Hot Sept CPI (Oct 14) keeps affordability pressure on discretionary", tickers: "AMZN · TGT · HD",
    rec: "Sticky inflation pressures low-end discretionary; favor value retail & trade-down winners." },
  { id: "c3", ind: "consumer", dayIdx: 6, future: true, impact: 1, dir: "BULLISH",
    headline: "Coca-Cola, GM & other consumer names report Q3 this week", tickers: "KO · GM · PG",
    rec: "Staples (KO/PG) offer defensive ballast vs. AI-trade volatility; hold for stability, not upside." },
  { id: "c4", ind: "consumer", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Visa & Mastercard Q3 (Oct 28) — payments / consumer-spend read", tickers: "V · MA",
    rec: "Spend trends are the consumer tell; quality compounders — hold, trade the reaction with defined risk." },
  { id: "c5", ind: "consumer", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Holiday-season guidance watch heading into November", tickers: "AMZN · WMT · TGT",
    rec: "Early holiday tone sets Q4 setups; favor WMT/AMZN share-gainers over mid-tier department stores." },

  // ---- FORWARD CATALYSTS (week 2: Oct 25 – Nov 1) -------------------------
  { id: "x1", ind: "tech", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Pre-FOMC / pre-megacap positioning — vol into the Oct 28–29 event cluster", tickers: "SPY · QQQ · VIX",
    rec: "Keep dry powder; the FOMC + GDP/PCE + MSFT/GOOGL cluster is the week's risk fulcrum." },
  { id: "x2", ind: "finance", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Month-end portfolio rebalancing & Halloween session", tickers: "SPY · QQQ · IWM",
    rec: "Expect flows-driven noise into month-end; avoid initiating size on rebalance volatility." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "TSLA", name: "Tesla", rank: 1, spot: "~$362 (Oct 16 close)", sentiment: "Bullish-to-Mixed",
    catalyst: "Q3 earnings — Wed Oct 21 (after close) · BINARY · ±~6–7.6% implied",
    iv: "Rich into earnings (±~6–7.6% implied; avg move ~7.8%)", liq: "A — deep-liquidity list; TSLA options are among the most active in the market (routinely >1M contracts/day); live chain unavailable (proxy block) so near-money monthly strikes used",
    thesis: "Bullish bias into a binary with expensive IV → avoid naked long calls (max crush). Harvest the crush with a defined-risk put-credit spread and cut vega with a near-money debit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $340 / buy $330 · Nov 20 '26 · ~$3.20 credit · max loss/capital ~$680 · bullish, range-tolerant, sells the crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $360 / sell $380 · Nov 20 '26 · ~$8.50 net debit · cost/max loss ~$850 · vega-reduced directional" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $370 / sell $390 · Oct 23 '26 (weekly) · ~$6.00 net debit · cost/max loss ~$600 · pure earnings pop" },
    ] },
  { ticker: "MSFT", name: "Microsoft", rank: 2, spot: "~$529 (Oct 16 close)", sentiment: "Bullish",
    catalyst: "FQ1'27 earnings — Wed Oct 28 (after close) · BINARY · Azure + AI-capex guide",
    iv: "Elevated into earnings (~±5% implied)", liq: "B — deep-liquidity list (SPY/QQQ-tier mega-cap chain); live chain unavailable (proxy block), strikes kept near the money on standard monthlies",
    thesis: "Bullish into the AI-capex verdict with a high nominal price → use spreads to fit the capital cap. Pair a crush-harvesting put-credit spread with a defined-cost call spread.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $510 / buy $500 · Nov 20 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $530 / sell $545 · Nov 20 '26 · ~$6.50 net debit · cost/max loss ~$650" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $535 / sell $550 · Oct 30 '26 (weekly) · ~$5.00 net debit · cost/max loss ~$500 · earnings pop" },
    ] },
  { ticker: "GOOGL", name: "Alphabet", rank: 3, spot: "~$341 (Oct 16 close)", sentiment: "Bullish",
    catalyst: "Q3 earnings — Wed Oct 28 (after close) · BINARY · Cloud + search/AI",
    iv: "Elevated into earnings (~±6% implied)", liq: "B — deep-liquidity list mega-cap chain; live chain unavailable (proxy block), strikes kept near the money on standard monthlies",
    thesis: "Strong cloud/AI momentum into a binary → bullish with defined risk. Get paid for the crush below support, spread up for defined-cost upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $330 / buy $320 · Nov 20 '26 · ~$3.20 credit · max loss/capital ~$680 · sells pre-earnings IV" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $340 / sell $355 · Nov 20 '26 · ~$6.50 net debit · cost/max loss ~$650" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$355 call · Oct 30 '26 (weekly) · ~$5.00 debit · cost ~$500 · post-earnings pop (crush risk)" },
    ] },
  { ticker: "AMZN", name: "Amazon", rank: 4, spot: "~$250 (Oct 16 close)", sentiment: "Bullish",
    catalyst: "Q3 earnings — Thu Oct 29 (after close) · BINARY · AWS growth + holiday guide",
    iv: "Elevated into earnings (~±6% implied)", liq: "B — deep-liquidity list mega-cap chain; live chain unavailable (proxy block), strikes kept near the money on standard monthlies",
    thesis: "Bullish on an AWS reacceleration into a binary → defined risk only. Harvest the crush with a put-credit spread; keep a cheap OTM call as the asymmetric pop.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $240 / buy $230 · Nov 20 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $250 / sell $265 · Nov 20 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$260 call · Oct 30 '26 (weekly) · ~$3.50 debit · cost ~$350 · earnings pop (crush risk)" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 5, spot: "~$214 (Oct 16 close)", sentiment: "Neutral-to-Bullish",
    catalyst: "No earnings in window (reports ~mid-Nov); AI-'bubble' sentiment reset is the driver",
    iv: "Moderate-to-elevated on the AI-sentiment chop (no binary in window)", liq: "A — deep-liquidity list; NVDA is the single most active single-name options chain (multi-million contracts/day); live chain unavailable (proxy block), near-money monthly strikes used",
    thesis: "No binary in the window, so time is on your side: get paid on the AI-sentiment reset with a put-credit spread, and keep defined-cost upside for a bounce in the most liquid chain in the market.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $200 / buy $190 · Nov 20 '26 · ~$2.80 credit · max loss/capital ~$720 · paid on the sentiment reset" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $215 / sell $230 · Nov 20 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$230 call · Nov 20 '26 · ~$4.00 debit · cost ~$400 · bounce lottery ticket" },
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
// today line sits on the boundary between Oct 18 and Oct 19
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Sunday, Oct 18 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Oct 18)
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
