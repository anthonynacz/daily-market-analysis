import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Tuesday, September 29, 2026 (live-researched).
 * Window: last 3 days (Sep 26) → coming 2 weeks (Oct 13).
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

// 18-day axis: Sep 26 .. Oct 13 (last 3 days → coming 2 weeks). Today = index 3 (Sep 29).
const DAYS = [
  { idx: 0, date: "Sep 26", dow: "Sat" },
  { idx: 1, date: "Sep 27", dow: "Sun" },
  { idx: 2, date: "Sep 28", dow: "Mon" },
  { idx: 3, date: "Sep 29", dow: "Tue" }, // TODAY
  { idx: 4, date: "Sep 30", dow: "Wed" },
  { idx: 5, date: "Oct 1", dow: "Thu" },
  { idx: 6, date: "Oct 2", dow: "Fri" },
  { idx: 7, date: "Oct 3", dow: "Sat" },
  { idx: 8, date: "Oct 4", dow: "Sun" },
  { idx: 9, date: "Oct 5", dow: "Mon" },
  { idx: 10, date: "Oct 6", dow: "Tue" },
  { idx: 11, date: "Oct 7", dow: "Wed" },
  { idx: 12, date: "Oct 8", dow: "Thu" },
  { idx: 13, date: "Oct 9", dow: "Fri" },
  { idx: 14, date: "Oct 10", dow: "Sat" },
  { idx: 15, date: "Oct 11", dow: "Sun" },
  { idx: 16, date: "Oct 12", dow: "Mon" },
  { idx: 17, date: "Oct 13", dow: "Tue" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Nasdaq/S&P fall as Trump rebuffs Iran peace deal; 10Y yield climbs, high-multiple tech hit", tickers: "NVDA · MSFT · AAPL",
    rec: "Trim froth, don't dump quality — generational-high yields compress megacap multiples; keep dry powder for the dip." },
  { id: "t2", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Megacaps rebound as oil eases — MSFT +3.7%, AAPL +1.5% lead the bounce", tickers: "MSFT · AAPL · NVDA",
    rec: "Hold the mega-cap complex; add on weakness, not into a one-day relief pop." },
  { id: "t3", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Nvidia board OKs record $150B buyback (largest ever) + new AI-safety tools", tickers: "NVDA",
    rec: "Constructive floor under NVDA; accumulate on pullbacks — buyback is a durable bid, not a chase signal." },
  { id: "t4", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Micron FQ4 earnings (after close) — AI/HBM read; ±8.5% implied · BINARY", tickers: "MU · NVDA · AVGO",
    rec: "Size before the print; rich IV means defined-risk only. A strong HBM4/DRAM guide re-rates the memory trade, a soft one crushes it." },
  { id: "t5", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through continues across memory/semis post-Micron", tickers: "NVDA · AVGO · MU",
    rec: "Let the dust settle; re-add on confirmation of capex/HBM strength, not the first bounce." },
  { id: "t6", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "AI/semis positioning into the Q3 tech-earnings season kickoff", tickers: "NVDA · MSFT · AVGO",
    rec: "Keep core AI exposure but hedge — the tape is jittery on yields; avoid initiating new size into earnings." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Brent jumps toward $107–110 after Trump rejects Iran peace deal; Hormuz risk", tickers: "XOM · CVX · COP",
    rec: "Keep a tactical energy overweight as geopolitical insurance; trailing stops — a ceasefire reverses it sharply." },
  { id: "e2", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Crude eases intraday (WTI ~$95); XOM holds ~$163 near highs", tickers: "XOM · CVX",
    rec: "Trim if up big into headline risk; core E&P stays as a supply-shock hedge while Hormuz is contested." },
  { id: "e3", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum inventories", tickers: "XOM · CVX · USO",
    rec: "Use inventory prints to time entries — geopolitics dominates fundamentals right now." },
  { id: "e4", ind: "energy", dayIdx: 6, future: true, impact: 3, dir: "BULLISH",
    headline: "Hormuz-closure risk persists as Iran conflict simmers", tickers: "XOM · CVX · OXY",
    rec: "Hold energy as insurance against a supply shock; keep it a tactical overweight with stops, not a core forever-bet." },
  { id: "e5", ind: "energy", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories + OPEC+ output-policy watch", tickers: "XOM · USO · OXY",
    rec: "Trade the Hormuz risk premium with trailing stops; a de-escalation or an OPEC+ hike unwinds it fast." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Defensive rotation — Healthcare among only 3 S&P sectors green in the selloff", tickers: "UNH · JNJ · LLY · XLV",
    rec: "Add defensive quality (XLV/large pharma) as ballast while yields spike; low-beta cash flows outperform in a risk-off tape." },
  { id: "h2", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "GLP-1 leaders in focus as weight-loss volume growth stays strong", tickers: "LLY · NVO",
    rec: "Favor LLY on the cleaner pipeline; fade knee-jerk NVO moves — position ahead of data, don't chase headlines." },
  { id: "h3", ind: "health", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Managed-care / Medicare Advantage utilization & rate watch", tickers: "UNH · HUM · CVS",
    rec: "Stay selective in managed care until utilization and 2027-rate clarity improve; UNH is the higher-quality hold." },
  { id: "h4", ind: "health", dayIdx: 12, future: true, impact: 1, dir: "MIXED",
    headline: "Pharma M&A / pipeline readouts keep SMID-cap biotech bid", tickers: "XBI · PFE · MRK",
    rec: "Tilt to de-risked SMID biotech (XBI) that fits big-pharma's revenue gap; size small — binary risk is high." },

  // ---- FINANCIALS / MACRO -------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "10Y yield climbs to ~5.18% (generational highs); rate-HIKE fears resurface", tickers: "TLT · JPM · BAC",
    rec: "Favor asset-sensitive banks (JPM/BAC) over long-duration; avoid adding rate-duration (TLT) into a rising-yield tape." },
  { id: "f2", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "August PCE (8:30 ET) — Fed's preferred gauge, tracking hot (~3.5% core)", tickers: "SPY · JPM · V",
    rec: "The week's key inflation swing; keep dry powder — a hot core PCE feeds the rate-hike narrative and hits multiples." },
  { id: "f3", ind: "finance", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "JOLTS job openings + Consumer Confidence", tickers: "SPY · XLF",
    rec: "Watch the labor-demand read; softening openings ease hike fears, a hot print pressures rate-sensitive sectors." },
  { id: "f4", ind: "finance", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing PMI (10:00 ET)", tickers: "SPY · XLI",
    rec: "A growth tell into the jobs report; use it to gauge whether the cycle is cooling faster than the Fed wants." },
  { id: "f5", ind: "finance", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "September jobs report / NFP (8:30 ET) — consensus ~85K", tickers: "JPM · BAC · SPY",
    rec: "Biggest macro swing in the window; a hot print revives hike bets and lifts yields, a weak one is a relief for risk." },
  { id: "f6", ind: "finance", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Services PMI (10:00 ET) — services-inflation read", tickers: "SPY · XLF",
    rec: "Services prices are the sticky part of inflation; a hot read keeps the higher-for-longer camp in control." },
  { id: "f7", ind: "finance", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "Q3 bank earnings kick off — JPM / WFC / C report Oct 13", tickers: "JPM · WFC · C · GS",
    rec: "NII and credit-cost commentary set the tone; favor NII beneficiaries, watch reserve builds for a consumer-stress signal." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 1, dir: "BEARISH",
    headline: "Consumer sentiment soft as generational-high yields bite discretionary spending", tickers: "XLY · AMZN · WMT",
    rec: "Tilt consumer exposure to staples/value (WMT) over discretionary; higher-for-longer rates pressure big-ticket demand." },
  { id: "c2", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Carnival Q3 print — stock slides as surging fuel costs pressure guidance", tickers: "CCL · RCL · NCLH",
    rec: "Bookings are strong but fuel is the swing factor; wait for stabilization rather than catching the post-print knife." },
  { id: "c3", ind: "consumer", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Nike FQ1 earnings (after close) — turnaround check; rich IV · BINARY", tickers: "NKE",
    rec: "Max-pessimism turnaround near multi-year lows; size before the print and use defined-risk — rich IV punishes naked longs." },
  { id: "c4", ind: "consumer", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "PepsiCo Q3 earnings — staples pricing power & volume trends", tickers: "PEP · KO",
    rec: "A read on pricing-vs-volume in staples; steady guide supports the defensive-consumer bid, a volume miss is a warning." },
  { id: "c5", ind: "consumer", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Early-October retail traffic reads into the holiday-season setup", tickers: "WMT · TGT · AMZN",
    rec: "Watch traffic/promo cadence; value retailers (WMT) are best positioned if the consumer keeps trading down." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "MU", name: "Micron", rank: 1, spot: "~$1,054", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Wed Sep 30 (after close) · BINARY",
    iv: "Very rich — ±~8.5% implied move; IV crush likely post-print",
    liq: "B — deep-liquidity list; among the most active semi chains (>300k contracts/day). Live exact-strike OI/spreads unverifiable this session, so strikes kept near the money on the Oct 16 monthly [MarketChameleon implied move]",
    thesis: "Bullish into a binary with expensive IV → avoid naked long calls (max crush). Cut vega with a debit spread, or get paid to be bullish via a defined-risk put-credit spread that harvests the crush. High share price, so spreads (not the strike) set the risk.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $1000 / buy $980 · Oct 16 '26 · ~$8.50 credit · max loss/capital ~$1,150 · harvests IV crush, bullish-to-neutral" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $1040 / sell $1060 · Oct 16 '26 · ~$10 net debit · cost/max loss ~$1,000 · vega-reduced upside" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1060 / sell $1080 · Oct 2 '26 (post-earnings wk) · ~$7 net debit · cost/max loss ~$700 · pure earnings pop" },
    ] },
  { ticker: "NKE", name: "Nike", rank: 2, spot: "~$36", sentiment: "Bullish (contrarian)",
    catalyst: "FQ1 earnings — Thu Oct 1 (after close) · BINARY",
    iv: "Rich into the print (double-digit implied move) on a cheap stock",
    liq: "B — deep-liquidity list; deep mega-cap chain with low-$ premiums and heavy share volume. Exact-strike quotes unverified this session; strikes kept on standard Oct monthlies near the money",
    thesis: "Max-pessimism turnaround near multi-year lows with rich IV. A cash-secured put would tie up >$1,500 collateral, so use spreads: get paid via a defined-risk put-credit spread, spread up for cheap upside, or a small post-earnings call for the asymmetric pop.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $35 / buy $32 · Oct 16 '26 · ~$0.95 credit · max loss/capital ~$205 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $36 / sell $40 · Oct 16 '26 · ~$1.60 net debit · cost/max loss ~$160" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$38 call · Oct 2 '26 (post-earnings wk) · ~$0.70 debit · cost ~$70 · lottery ticket on a beat" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 3, spot: "~$229", sentiment: "Bullish",
    catalyst: "Record $150B buyback + AI momentum (no earnings in window)",
    iv: "Moderate — no earnings binary until November, so no crush risk",
    liq: "B — deep-liquidity list; the market's most active single-stock chain (>1M contracts/day typical). Exact-strike OI unverified this session; strikes kept near the money on standard monthlies",
    thesis: "The largest buyback ever announced is a durable bid, and IV is not inflated by a near-term binary, so buying premium is reasonable. Spread up to cut cost; a cheap OTM call plays the AI-momentum breakout.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$220 call · Oct 16 '26 · ~$14 debit · cost ~$1,400 · Δ≈0.62" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $230 / sell $245 · Oct 16 '26 · ~$6.50 net debit · cost/max loss ~$650" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$245 call · Oct 16 '26 · ~$3 debit · cost ~$300 · momentum breakout" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 4, spot: "~$163", sentiment: "Bullish",
    catalyst: "Iran/Hormuz supply-shock premium; Brent ~$107–110",
    iv: "Elevated on geopolitical risk; no earnings until late Oct",
    liq: "B — deep-liquidity list; very liquid large-cap energy chain, high share + option volume. Exact-strike quotes unverified this session; strikes kept near the money on monthlies",
    thesis: "The Hormuz-closure risk premium keeps a bid under integrated majors, but a ceasefire unwinds it fast — so defined-risk only. A call debit spread and a put-credit spread both express bullish-with-a-floor; a cheap call plays a supply-shock spike.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $160 / sell $170 · Nov 20 '26 · ~$4.50 net debit · cost/max loss ~$450" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $155 / buy $150 · Oct 16 '26 · ~$1.40 credit · max loss/capital ~$360 · paid on a pullback" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$170 call · Oct 16 '26 · ~$2.20 debit · cost ~$220 · Hormuz-spike upside" },
    ] },
  { ticker: "SPY", name: "S&P 500 ETF", rank: 5, spot: "~$774", sentiment: "Neutral",
    catalyst: "Macro chop into PCE (Sep 30) + jobs report (Oct 2); VIX ~15",
    iv: "Low-to-moderate (VIX ~15) but two-sided event risk this week",
    liq: "B — deep-liquidity list; the single most liquid options market (penny-wide, huge OI, weeklies fine). Exact-strike quotes unverified this session; strikes kept near the money",
    thesis: "Generational-high yields cap upside while a $150B-buyback/AI bid caps downside → a range into the data. Defined-risk premium selling (iron condor, credit spreads) monetizes chop; lean slightly to fading rallies given the yield backdrop.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $760p/buy $750p + sell $788c/buy $798c · Oct 16 '26 · ~$2.80 credit · max loss/capital ~$720 · range-bound" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $765 / buy $758 · Oct 9 '26 · ~$1.90 credit · max loss/capital ~$510 · bullish-neutral" },
      { profile: "Aggressive",   strategy: "Bear Call Credit Spread", text: "Sell $785 / buy $792 · Oct 9 '26 · ~$1.80 credit · max loss/capital ~$520 · fade rallies into the data" },
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
// today line sits on the boundary between Sep 29 and Sep 30
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Tuesday, Sep 29 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Sep 29)
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
