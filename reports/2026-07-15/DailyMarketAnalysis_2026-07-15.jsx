import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Wednesday, July 15, 2026 (live-researched).
 * Window: last 3 days (Jul 12) → coming 2 weeks (Jul 29).
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

// 18-day axis: Jul 12 .. Jul 29 (last 3 days → coming 2 weeks). Today = index 3 (Jul 15).
const DAYS = [
  { idx: 0, date: "Jul 12", dow: "Sun" },
  { idx: 1, date: "Jul 13", dow: "Mon" },
  { idx: 2, date: "Jul 14", dow: "Tue" },
  { idx: 3, date: "Jul 15", dow: "Wed" }, // TODAY
  { idx: 4, date: "Jul 16", dow: "Thu" },
  { idx: 5, date: "Jul 17", dow: "Fri" },
  { idx: 6, date: "Jul 18", dow: "Sat" },
  { idx: 7, date: "Jul 19", dow: "Sun" },
  { idx: 8, date: "Jul 20", dow: "Mon" },
  { idx: 9, date: "Jul 21", dow: "Tue" },
  { idx: 10, date: "Jul 22", dow: "Wed" },
  { idx: 11, date: "Jul 23", dow: "Thu" },
  { idx: 12, date: "Jul 24", dow: "Fri" },
  { idx: 13, date: "Jul 25", dow: "Sat" },
  { idx: 14, date: "Jul 26", dow: "Sun" },
  { idx: 15, date: "Jul 27", dow: "Mon" },
  { idx: 16, date: "Jul 28", dow: "Tue" },
  { idx: 17, date: "Jul 29", dow: "Wed" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Cooler June CPI ignites AI-chip rally: NVDA +4%, MU +4.9%, AMD +2.6%", tickers: "NVDA · MU · AMD",
    rec: "Disinflation lifts high-multiple semis; hold core AI leaders and add on dips — don't chase a one-day pop." },
  { id: "t2", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "June PPI −0.3% (vs flat est.); KeyBanc lifts NVDA/AMD targets on tight memory", tickers: "NVDA · AMD",
    rec: "Soft PPI reinforces the disinflation read; WATCH for follow-through — quality semis remain the leadership." },
  { id: "t3", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "BULLISH",
    headline: "TSMC (TSM) Q2 earnings — AI-foundry tell (~$40B rev / $3.87 EPS est.)", tickers: "TSM · NVDA · AMD",
    rec: "A strong AI-foundry guide re-rates the whole chain; size before the print, don't chase after." },
  { id: "t4", ind: "tech", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Alphabet (GOOGL) Q2 earnings — cloud growth & AI-capex read", tickers: "GOOGL",
    rec: "Capex commentary sets the AI-infra tone; wait for the print before adding megacap." },
  { id: "t5", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "ServiceNow (NOW) Q2 — cRPO >19.5% the tell after IBM budget warning", tickers: "NOW",
    rec: "Enterprise-software growth test; watch subscription/cRPO, avoid new size into the number." },
  { id: "t6", ind: "tech", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft (MSFT) FQ4 earnings — Azure growth vs. AI-capex burn", tickers: "MSFT",
    rec: "Azure re-acceleration vs. capex is the debate; keep dry powder into the report." },
  { id: "t7", ind: "tech", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "Meta (META) Q2 earnings — ad strength must fund the AI spend", tickers: "META",
    rec: "Ad revenue vs. capex guide is the swing; wait for guidance before chasing." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Crude rebounds: WTI +3% to ~$80, Brent ~$87 as ceasefire cracks", tickers: "XOM · CVX · COP",
    rec: "Tactical bounce on geopolitics; trade the range with stops — majors are still soft on the month." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 1, dir: "MIXED",
    headline: "Exxon (XOM) flags +$3.5–3.9B upstream Q2 boost from higher crude", tickers: "XOM",
    rec: "Constructive into early-Aug earnings; accumulate quality majors on weakness." },
  { id: "e3", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report", tickers: "XOM · CVX · USO",
    rec: "Use inventory prints to time entries; a draw supports the crude bounce." },
  { id: "e4", ind: "energy", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Energy majors lag: XOM/CVX/COP down ~6–9% on the month despite beats", tickers: "XOM · CVX · COP",
    rec: "Valuation reset offers entry; favor CVX's ~4% yield for income, XOM for buybacks." },
  { id: "e5", ind: "energy", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories + summer-driving demand check", tickers: "USO · XOM · CVX",
    rec: "Watch the draw vs. consensus; a big draw amid firmer crude reinforces the bull case." },
  { id: "e6", ind: "energy", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Energy majors' Q2 season kicks off next week (XOM/CVX early Aug)", tickers: "XOM · CVX",
    rec: "Position for the crude-boost quarter; accumulate on the month's weakness ahead of prints." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "J&J (JNJ) Q2 earnings — diversified model vs. the GLP-1 skip", tickers: "JNJ",
    rec: "Steady compounder; hold for the 64-yr dividend growth, not a pop — watch device/oncology growth." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Eli Lilly (LLY) hits record high; JPM lifts target to $1,400 on GLP-1 tsunami", tickers: "LLY",
    rec: "Momentum leader but rich (~33x fwd); trim into strength, add on pullbacks — not breakouts." },
  { id: "h3", ind: "health", dayIdx: 4, future: true, impact: 2, dir: "BULLISH",
    headline: "Intuitive Surgical (ISRG) Q2 — analysts see upside (~$2.50 EPS est.)", tickers: "ISRG",
    rec: "Procedure-volume growth intact; a beat confirms med-tech leadership — size before the print." },
  { id: "h4", ind: "health", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "Lilly's Zepbound/Foundayo GLP-1 Bridge opens to Medicare at ~$50/mo", tickers: "LLY · NVO",
    rec: "Volume tailwind for LLY; incrementally bearish pricing read for NVO — favor LLY on the pair." },
  { id: "h5", ind: "health", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Managed-care & pharma Q2 prints continue (UNH cohort in focus)", tickers: "UNH · CVS",
    rec: "Stay selective; medical-cost trend remains the swing factor — wait for guidance." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Big-bank blowout: JPM EPS $6.14 (+41% profit), GS posts best quarter ever", tickers: "JPM · GS · BAC · C",
    rec: "Trading/IB strength confirms the tape; take partial profits into the pop, hold core JPM/GS." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Morgan Stanley (MS) & BlackRock (BLK) round out strong Street results", tickers: "MS · BLK",
    rec: "The capital-markets recovery is real; favor asset-gatherers (BLK) and IB leaders on dips." },
  { id: "f3", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "PNC, BNY & regionals report — NII and deposit trends in focus", tickers: "PNC · BK",
    rec: "Mixed regional read; favor NII-beneficiaries, avoid adding rate-duration into the FOMC." },
  { id: "f4", ind: "finance", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Cooling CPI/PPI lifts Fed-hold odds to ~65% into the Jul 28–29 FOMC", tickers: "JPM · BAC · SPY",
    rec: "Higher-for-longer is easing; asset-sensitive banks still win — keep dry powder pre-Fed." },
  { id: "f5", ind: "finance", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC meeting begins (decision Jul 29) — a Fed hold is widely expected", tickers: "SPY · TLT · JPM",
    rec: "Biggest macro swing in the window; watch the dots/presser, avoid new size into it." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Tesla (TSLA) sets Q2 call for Jul 22; stock −3% despite best-ever deliveries", tickers: "TSLA",
    rec: "Margins/FSD matter more than the 480K deliveries; WATCH into the print, keep it defined-risk." },
  { id: "c2", ind: "consumer", dayIdx: 4, future: true, impact: 3, dir: "BULLISH",
    headline: "Netflix (NFLX) Q2 earnings after close — ad revenue on track to ~double", tickers: "NFLX",
    rec: "Bullish setup but binary; size before headlines — down 31% since the split leaves room to run." },
  { id: "c3", ind: "consumer", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla (TSLA) Q2 earnings after close — margins & FSD the swing factors", tickers: "TSLA",
    rec: "Expect an outsized move; use defined-risk structures and account for IV crush." },
  { id: "c4", ind: "consumer", dayIdx: 0, future: false, impact: 1, dir: "MIXED",
    headline: "Summer travel firm; United (UAL) guides into Q2 airline prints", tickers: "UAL · DAL",
    rec: "Selective on carriers; premium-cabin strength favors UAL/DAL over budget names." },
  { id: "c5", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Consumer-discretionary Q2 prints ramp; tariff/pricing tone watched", tickers: "AMZN · WMT",
    rec: "Watch pricing power; favor share-gainers, fade names leaning on promotions." },

  // ---- FORWARD CATALYSTS (week 2: Jul 25–29) ------------------------------
  { id: "x1", ind: "tech", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "AI-capex read-through builds ahead of MSFT/META prints", tickers: "NVDA · MSFT · META",
    rec: "Let guidance confirm capex durability; re-add on the trend, not the first reaction." },
  { id: "x2", ind: "consumer", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Apple/Amazon Q2 earnings loom (Jul 30) — set the consumer tone", tickers: "AAPL · AMZN",
    rec: "Position ahead of month-end megacap prints; keep new size modest into the cluster." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "TSM", name: "Taiwan Semiconductor", rank: 1, spot: "~$425", sentiment: "Bullish",
    catalyst: "Q2 earnings — Thu Jul 16 (before open) · BINARY (~$40B rev / $3.87 EPS est.)",
    iv: "Elevated into the print (±~7% implied) — RICH", liq: "Deep, very active AI-foundry chain; tight spreads",
    thesis: "Bullish into a binary with pumped-up IV → avoid naked long calls (max crush). Cut vega with a debit spread, or get paid via a defined-risk put credit spread that harvests the post-earnings crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $420 / sell $440 · Aug 21 '26 · ~$9 net debit · cost/max loss ~$900 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $410 / buy $400 · Jul 24 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$440 call · Jul 17 '26 · ~$3 debit · cost ~$300 · pure earnings pop" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 2, spot: "~$212", sentiment: "Bullish",
    catalyst: "AI-chip leadership + cooling CPI/PPI; KeyBanc target hikes (earnings late Aug)",
    iv: "~40% — MODERATE, no earnings in window → long premium OK", liq: "Deepest semis chain in the market; penny-wide spreads",
    thesis: "Bullish momentum with disinflation as a tailwind and no binary in the window → clean setup to own premium. Spread up for a cheaper, defined-cost version.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$205 call · Aug 21 '26 · ~$14 debit · cost ~$1,400 · Δ≈0.65" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $210 / sell $225 · Aug 21 '26 · ~$6 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$225 call · Jul 31 '26 · ~$2.50 debit · cost ~$250 · momentum pop" },
    ] },
  { ticker: "NFLX", name: "Netflix", rank: 3, spot: "~$74 (post 10:1 split)", sentiment: "Bullish",
    catalyst: "Q2 earnings — Thu Jul 16 (after close) · BINARY (ad revenue ~doubling)",
    iv: "Rich into the print (±~8% implied)", liq: "Deep large-cap chain; low-$ premiums post-split",
    thesis: "Down ~31% since the split with a bullish ad-tier ramp into a binary → defined-risk only. Cut vega with a call spread, get paid below support with a put credit spread, or a cheap OTM lotto for the pop.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $72 / sell $80 · Aug 21 '26 · ~$3.20 net debit · cost/max loss ~$320 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $70 / buy $65 · Jul 24 '26 · ~$1.60 credit · max loss/capital ~$340 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$78 call · Jul 17 '26 · ~$1.30 debit · cost ~$130 · pure earnings pop" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 4, spot: "~$395", sentiment: "Neutral (range-bound into earnings)",
    catalyst: "Q2 earnings — Wed Jul 22 (after close) · BINARY (margins & FSD the swing)",
    iv: "High into the print (±~9% implied) — RICH", liq: "One of the most liquid single-name chains; deep OI",
    thesis: "Best-ever deliveries already known, stock soft, margins/FSD the real tell → range-tolerant, defined-risk structures. Sell the rich premium with an iron condor, or lean mildly bullish/bearish with a defined-risk spread.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $370p/$420c, buy $360p/$430c · Jul 24 '26 · ~$3.50 credit · max loss/capital ~$650 · range play" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $370 / buy $360 · Jul 24 '26 · ~$3 credit · max loss/capital ~$700 · mildly bullish" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $400 / sell $420 · Jul 24 '26 · ~$7 net debit · cost/max loss ~$700 · upside breakout" },
    ] },
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 5, spot: "~$540", sentiment: "Bullish",
    catalyst: "AI-server demand + analyst target hikes; volatile (earnings early Aug, out of window)",
    iv: "~50% — MODERATE-to-HIGH; recent chop → favor spreads", liq: "Deep, very active large-cap chain",
    thesis: "Bullish AI-server thesis intact but the stock is choppy after a big run → keep it defined-risk. Debit-spread the upside, get paid below support with a put credit spread, or a cheaper OTM call for the breakout.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $520 / sell $540 · Aug 21 '26 · ~$11 net debit · cost/max loss ~$1,100" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $510 / buy $500 · Jul 31 '26 · ~$3.50 credit · max loss/capital ~$650 · paid to accumulate" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$570 call · Jul 24 '26 · ~$5 debit · cost ~$500 · breakout" },
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
// today line sits on the boundary between Jul 15 and Jul 16
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Wednesday, Jul 15 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 15)
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
