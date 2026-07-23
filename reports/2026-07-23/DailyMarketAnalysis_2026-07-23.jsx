import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Thursday, July 23, 2026 (live-researched).
 * Window: last 3 days (Jul 20) → coming 2 weeks (Aug 6).
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

// 18-day axis: Jul 20 .. Aug 6 (last 3 days → coming 2 weeks). Today = index 3 (Jul 23).
const DAYS = [
  { idx: 0, date: "Jul 20", dow: "Mon" },
  { idx: 1, date: "Jul 21", dow: "Tue" },
  { idx: 2, date: "Jul 22", dow: "Wed" },
  { idx: 3, date: "Jul 23", dow: "Thu" }, // TODAY
  { idx: 4, date: "Jul 24", dow: "Fri" },
  { idx: 5, date: "Jul 25", dow: "Sat" },
  { idx: 6, date: "Jul 26", dow: "Sun" },
  { idx: 7, date: "Jul 27", dow: "Mon" },
  { idx: 8, date: "Jul 28", dow: "Tue" },
  { idx: 9, date: "Jul 29", dow: "Wed" },
  { idx: 10, date: "Jul 30", dow: "Thu" },
  { idx: 11, date: "Jul 31", dow: "Fri" },
  { idx: 12, date: "Aug 1", dow: "Sat" },
  { idx: 13, date: "Aug 2", dow: "Sun" },
  { idx: 14, date: "Aug 3", dow: "Mon" },
  { idx: 15, date: "Aug 4", dow: "Tue" },
  { idx: 16, date: "Aug 5", dow: "Wed" },
  { idx: 17, date: "Aug 6", dow: "Thu" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Alphabet Q2 beats (cloud +82%) but 2026 capex hiked to $195–205B; GOOGL −5%", tickers: "GOOGL",
    rec: "Great quarter, but the market is punishing AI spend — wait for the capex-worry dip to add, don't chase strength." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tesla Q2: rev $28.2B beats but adj EPS $0.33 misses $0.50; TSLA −7%", tickers: "TSLA",
    rec: "Margin miss on soft profitability — avoid catching the knife; wait for delivery/robotaxi clarity before re-entering." },
  { id: "t3", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "Intel FQ2 after the close (today) — 18A foundry turnaround test; options price ~12–15% swing", tickers: "INTC",
    rec: "Binary into a 350%+ YoY run — don't hold naked size; a beat validates the foundry story, a miss unwinds the melt-up." },
  { id: "t4", ind: "tech", dayIdx: 7, future: true, impact: 2, dir: "BULLISH",
    headline: "AI-server momentum after Supermicro flags $60B+ Q4 orders; DELL/HPE ride the read-through", tickers: "SMCI · DELL · HPE",
    rec: "Constructive on the AI hardware chain; buy pullbacks in DELL/HPE rather than chasing the SMCI spike." },
  { id: "t5", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft FQ4 earnings (after close) — Azure AI growth vs. capex guide after the GOOGL scare", tickers: "MSFT",
    rec: "Wait for the print; accelerating Azure re-rates it, but a GOOGL-style capex jump gets punished — keep size defined." },
  { id: "t6", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Meta Q2 earnings (after close) — AI-capex scrutiny is the key risk after GOOGL fell 5%", tickers: "META",
    rec: "Most exposed to the 'capex punishment' theme; prefer defined-risk / range structures into the print, not naked longs." },
  { id: "t7", ind: "tech", dayIdx: 10, future: true, impact: 3, dir: "BULLISH",
    headline: "Apple FQ3 earnings (after close) — iPhone/Services trajectory + Siri-AI update", tickers: "AAPL",
    rec: "Lean bullish on Services strength; use a defined-risk structure — a Services beat is the catalyst, a soft guide caps it." },
  { id: "t8", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "AMD earnings on deck — data-center share vs. Intel read-through", tickers: "AMD · NVDA",
    rec: "Watch DC revenue vs. Intel's print; a strong AMD guide keeps the AI-chip leadership trade intact." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Brent +3.4% to ~$94 (1-month high) on 11th straight round of US strikes on Iran", tickers: "XOM · CVX · COP",
    rec: "Keep a tactical energy tilt as geopolitical insurance; trail stops — a de-escalation unwinds the premium fast." },
  { id: "e2", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Crude holds gains despite OFAC 'General License X' allowing Iranian barrels — crosscurrents", tickers: "XOM · CVX · USO",
    rec: "Two-sided tape: strike-risk premium vs. more supply on the market — size energy modestly, don't over-commit." },
  { id: "e3", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "XOM · CVX · USO",
    rec: "Use the draw/build vs. consensus to time entries — geopolitics still dominates fundamentals this week." },
  { id: "e4", ind: "energy", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "ExxonMobil Q2 earnings (~Jul 31) — EPS est ~$3.56 on ~$99B revenue", tickers: "XOM",
    rec: "Wait for the print; watch upstream volumes + buyback pace — the stock has already de-rated ~20% off its peak." },
  { id: "e5", ind: "energy", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Chevron / energy-major Q2 wrap; oil-premium volatility persists", tickers: "CVX · COP · OXY",
    rec: "Own quality majors for the yield + optionality on the risk premium; avoid chasing on spikes." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Eli Lilly extends record run — Foundayo oral GLP-1 + Medicare $50/mo 'Bridge' expand the moat", tickers: "LLY · NVO",
    rec: "Structural leader, but extended after a huge run — accumulate on pullbacks / defined-risk rather than chasing highs." },
  { id: "h2", ind: "health", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Managed-care & pharma Q2 earnings ramp — margins & 2026 guide in focus", tickers: "UNH · PFE · MRK",
    rec: "Stay selective; favor GLP-1/pipeline winners over managed care until cost-trend clarity improves." },
  { id: "h3", ind: "health", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Big-pharma earnings cluster (MRK, ABBV) — pipeline & GLP-1 competitive reads", tickers: "MRK · ABBV · PFE",
    rec: "Trade the reactions selectively; de-risked names with catalysts beat owning the whole basket." },
  { id: "h4", ind: "health", dayIdx: 16, future: true, impact: 2, dir: "BULLISH",
    headline: "Eli Lilly Q2 earnings window opens (early Aug) — obesity franchise volumes & FY guide", tickers: "LLY · VKTX",
    rec: "Expect GLP-1 volatility; size before the headline — a strong Mounjaro/Zepbound guide is the bull case." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Bank strength persists after record Q2 — JPM posted the largest quarterly profit in US history", tickers: "JPM · BAC · GS",
    rec: "Trend intact (trading + IB backlog at 5-yr highs); take partial profits into strength, add on pullbacks." },
  { id: "f2", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "Rates & the 10Y in focus as markets set up for next week's FOMC", tickers: "JPM · BAC · GS",
    rec: "Favor asset-sensitive banks; avoid adding rate-duration into the Jul 29 decision — keep dry powder." },
  { id: "f3", ind: "finance", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (2:00 ET) — Warsh presser; no Summary of Economic Projections at this meeting", tickers: "SPY · JPM · TLT",
    rec: "Biggest macro swing in the window; the presser tone drives it — keep powder dry into 2pm & the Q&A." },
  { id: "f4", ind: "finance", dayIdx: 8, future: true, impact: 2, dir: "BULLISH",
    headline: "Regional-bank momentum (FITB, CFG up 20%+ post-earnings on loan growth)", tickers: "FITB · CFG · RF",
    rec: "Constructive on regionals with clean credit + loan growth; use dips ahead of the Fed to build positions." },
  { id: "f5", ind: "finance", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Post-FOMC rates read into August; ISM services on the docket", tickers: "XLF · JPM · SPY",
    rec: "Let the post-Fed dust settle; position banks by the rate path the presser signals, not the knee-jerk." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "McDonald's comps +3.8% momentum; consumer-staples bid as defensives lead", tickers: "MCD · KO",
    rec: "Own quality staples for ballast into the Fed; McDonald's traffic recovery supports the name." },
  { id: "c2", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "BULLISH",
    headline: "Coca-Cola Q2 earnings (before open) — pricing power near a 52-week high; +19% YTD", tickers: "KO",
    rec: "Defensive compounder into the Fed; a pricing-driven beat extends it, but it's extended — prefer defined-risk entries." },
  { id: "c3", ind: "consumer", dayIdx: 10, future: true, impact: 3, dir: "BULLISH",
    headline: "Amazon Q2 earnings (after close) — AWS acceleration + Prime Day pull-forward; Street sees ~17% rev growth", tickers: "AMZN",
    rec: "Lean bullish (AWS + ads + Prime Day); use a defined-risk structure into the binary — a soft AWS guide is the risk." },
  { id: "c4", ind: "consumer", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "June PCE inflation (8:30 ET) — the Fed's preferred gauge, day after the decision", tickers: "SPY · XLP · WMT",
    rec: "Key inflation read; a cool print supports the soft-landing tape, a hot one revives higher-for-longer fears." },
  { id: "c5", ind: "consumer", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "Retail/consumer earnings ramp; back-to-school demand watch", tickers: "WMT · TGT · AMZN",
    rec: "Watch traffic & guidance tone; favor share-gainers (WMT/AMZN) over structurally-challenged retail." },

  // ---- FORWARD CATALYSTS (week 2: Jul 31 – Aug 6) -------------------------
  { id: "x1", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through continues post GOOGL / MSFT / META prints", tickers: "NVDA · MSFT · META",
    rec: "Let the capex narrative settle; re-add on confirmation that AI spend is converting to revenue, not the first bounce." },
  { id: "x2", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Q2 advance GDP (8:30 ET) — growth read the morning after the Fed", tickers: "SPY · JPM · IWM",
    rec: "A firm growth print supports cyclicals/banks; a soft one shifts the tape back toward duration & defensives." },
  { id: "x3", ind: "energy", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories + Iran-strike headline risk carry into August", tickers: "XOM · CVX · USO",
    rec: "Trade the risk premium with trailing stops; a diplomatic de-escalation unwinds it quickly." },
  { id: "x4", ind: "health", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "GLP-1 competitive data digestion into Lilly/Novo prints", tickers: "LLY · NVO · VKTX",
    rec: "Volatility persists; favor LLY on franchise strength, fade knee-jerk NVO moves." },
  { id: "x5", ind: "consumer", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Consumer-discretionary earnings breadth widens into early August", tickers: "XLY · AMZN · MCD",
    rec: "Use the breadth to separate share-gainers from laggards; avoid initiating broad-basket size." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "MSFT", name: "Microsoft", rank: 1, spot: "~$391", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Wed Jul 29 (after close) · BINARY",
    iv: "Elevated into earnings (~±5% implied)", liq: "Deepest mega-cap software chain; penny-wide spreads, huge OI",
    thesis: "Bullish on Azure/Copilot AI monetization, but GOOGL just fell 5% on a capex jump — so cut vega with a defined-risk debit spread and lean bullish with a put-credit spread rather than paying up for a naked call into the crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $390 / sell $400 · Aug 21 '26 · ~$4.50 net debit · cost/max loss ~$450 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $380 / buy $370 · Aug 21 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$400 call · Aug 7 '26 · ~$6.50 debit · cost ~$650 · pure post-earnings pop" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 2, spot: "~$326", sentiment: "Bullish",
    catalyst: "FQ3 earnings — Thu Jul 30 (after close) · BINARY",
    iv: "Elevated into earnings (~±4–5% implied)", liq: "Deepest equity chain in the market; penny-wide spreads",
    thesis: "Services strength + a possible Siri-AI update, but a binary print → prefer a bullish, range-tolerant put-credit spread and a defined-cost call spread over a naked long into IV crush.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $315 / buy $305 · Aug 21 '26 · ~$3.20 credit · max loss/capital ~$680 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $325 / sell $340 · Aug 21 '26 · ~$5.50 net debit · cost/max loss ~$550" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$340 call · Aug 7 '26 · ~$2.60 debit · cost ~$260 · pure earnings pop" },
    ] },
  { ticker: "AMZN", name: "Amazon", rank: 3, spot: "~$245", sentiment: "Bullish",
    catalyst: "Q2 earnings — Thu Jul 30 (after close) · BINARY",
    iv: "Elevated into earnings (~±6% implied)", liq: "Deep, very active mega-cap chain; tight spreads",
    thesis: "AWS acceleration + Prime Day pull-forward + record ads, with the Street at ~17% revenue growth and a Strong-Buy tilt. Lean bullish but defined-risk into the binary — a soft AWS guide is the downside.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $245 / sell $260 · Aug 21 '26 · ~$6 net debit · cost/max loss ~$600" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $235 / buy $225 · Aug 21 '26 · ~$3.20 credit · max loss/capital ~$680 · paid to lean long" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$260 call · Aug 7 '26 · ~$3 debit · cost ~$300 · AWS-beat pop" },
    ] },
  { ticker: "META", name: "Meta Platforms", rank: 4, spot: "~$628", sentiment: "Neutral",
    catalyst: "Q2 earnings — Wed Jul 29 (after close) · BINARY",
    iv: "Rich into earnings (~±7% implied)", liq: "Deep large-cap chain; tight spreads at $10 increments",
    thesis: "Most exposed to the 'capex-punishment' theme that hit GOOGL — huge AI spend into a binary. Stay market-neutral and get paid for the elevated IV with defined-risk, range-tolerant structures rather than picking a direction.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $600p/buy $590p + sell $660c/buy $670c · Aug 21 '26 · ~$3.50 credit · max loss/capital ~$650" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $600 / buy $585 · Aug 21 '26 · ~$5.50 credit · max loss/capital ~$950 · mild bullish tilt" },
      { profile: "Aggressive",   strategy: "Bear Call Credit Spread", text: "Sell $660 / buy $675 · Aug 7 '26 · ~$5 credit · max loss/capital ~$1,000 · fades a capex-spooked pop" },
    ] },
  { ticker: "KO", name: "Coca-Cola", rank: 5, spot: "~$95", sentiment: "Bullish (defensive)",
    catalyst: "Q2 earnings — Tue Jul 28 (before open) · BINARY",
    iv: "Low-to-moderate (defensive; ~±3% implied)", liq: "Deep mega-cap chain; low $ premiums, tight spreads",
    thesis: "Defensive compounder with pricing power near a 52-week high (+19% YTD) into the Fed. Low IV favors buying cheap premium; spread up or sell a put spread below support for a paid-to-wait entry.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$92 call · Sep 18 '26 · ~$4.50 debit · cost ~$450 · Δ≈0.65" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $92.5 / buy $87.5 · Aug 21 '26 · ~$1.50 credit · max loss/capital ~$350 · paid to accumulate" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $95 / sell $100 · Aug 21 '26 · ~$1.80 net debit · cost/max loss ~$180" },
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
// today line sits on the boundary between Jun 5 and Jun 6
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Thursday, Jul 23 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 23)
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
