import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Wednesday, July 29, 2026 (live-researched).
 * Window: last 3 days (Jul 26) → coming 2 weeks (Aug 12).
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

// 18-day axis: Jul 26 .. Aug 12 (last 3 days → coming 2 weeks). Today = index 3 (Jul 29).
const DAYS = [
  { idx: 0, date: "Jul 26", dow: "Sun" },
  { idx: 1, date: "Jul 27", dow: "Mon" },
  { idx: 2, date: "Jul 28", dow: "Tue" },
  { idx: 3, date: "Jul 29", dow: "Wed" }, // TODAY
  { idx: 4, date: "Jul 30", dow: "Thu" },
  { idx: 5, date: "Jul 31", dow: "Fri" },
  { idx: 6, date: "Aug 1", dow: "Sat" },
  { idx: 7, date: "Aug 2", dow: "Sun" },
  { idx: 8, date: "Aug 3", dow: "Mon" },
  { idx: 9, date: "Aug 4", dow: "Tue" },
  { idx: 10, date: "Aug 5", dow: "Wed" },
  { idx: 11, date: "Aug 6", dow: "Thu" },
  { idx: 12, date: "Aug 7", dow: "Fri" },
  { idx: 13, date: "Aug 8", dow: "Sat" },
  { idx: 14, date: "Aug 9", dow: "Sun" },
  { idx: 15, date: "Aug 10", dow: "Mon" },
  { idx: 16, date: "Aug 11", dow: "Tue" },
  { idx: 17, date: "Aug 12", dow: "Wed" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above (Jul 26 = 0 … Aug 12 = 17).
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "NVDA −5% on report it may backstop ~$250B of OpenAI data-center debt ('circular financing')", tickers: "NVDA",
    rec: "Wait for stabilization; the debt-guarantee optics — not fundamentals — drove it. Don't chase the dip until the story clears." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Chip selloff as 'AI trade narrows to NVDA': AMD −8%, MRVL −7%, INTC −6%, TSMC −3.5%", tickers: "AMD · MRVL · INTC · TSM",
    rec: "Use the AI-sentiment reset to scale into quality on weakness; avoid catching the fastest-falling knives." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Intel Q2 beat (rev $16.1B, +25% YoY; Data Center + AI +59%) but fell in the broad chip rout", tickers: "INTC",
    rec: "Fundamentals improving; wait for turnaround confirmation before adding — sentiment, not results, is the drag." },
  { id: "t4", ind: "tech", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft FQ4 & Meta Q2 after the close — Azure growth and AI-capex guides are the tell", tickers: "MSFT · META",
    rec: "Size before the print; the FY27 capex guide is the swing factor, not the EPS. Defined-risk into the binary." },
  { id: "t5", ind: "tech", dayIdx: 3, future: true, impact: 2, dir: "MIXED",
    headline: "Qualcomm FQ3 & Arm report after close — handset and AI-edge licensing read", tickers: "QCOM · ARM",
    rec: "Watch guidance on handset units and datacenter/AI-edge; don't add size ahead of two volatile prints." },
  { id: "t6", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Apple FQ3 after close — iPhone rev, memory-cost margin pressure, Apple Intelligence", tickers: "AAPL",
    rec: "At record highs and only ~3.8% implied move — priced for strength, so limited surprise room. Defined-risk only." },
  { id: "t7", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Palantir Q2 after close — high-multiple AI name known for huge post-earnings gaps", tickers: "PLTR",
    rec: "Expect a large two-way move; keep size small and use defined-risk structures into the print." },
  { id: "t8", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "AMD Q2 after close — AI GPU / data-center momentum; ~12% implied move (fattest premium)", tickers: "AMD",
    rec: "Rich IV into a binary — cut vega with spreads rather than buying naked premium; account for IV crush." },
  { id: "t9", ind: "tech", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Super Micro FQ4 after close — AI-server demand and margin read-through", tickers: "SMCI",
    rec: "Volatile, low-visibility name; a demand/margin read for the AI-server build-out — trade small." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Crude −6% intraday on Trump 'good talks with Iran'; oil & gas stocks −2%", tickers: "XOM · CVX · XLE",
    rec: "The Iran risk premium is unwinding — trim tactical energy overweight; a de-escalation caps crude fast." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "XLE −2.1%, among worst sectors, tracking softer crude (WTI ~$81)", tickers: "XLE · XOM · CVX",
    rec: "Geopolitics still dominates fundamentals; use trailing stops on the Iran-headline trade in both directions." },
  { id: "e3", ind: "energy", dayIdx: 3, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (10:30 ET) — inventories vs. consensus", tickers: "USO · XLE",
    rec: "Time entries off the print, but Iran-ceasefire headlines are the bigger driver of crude right now." },
  { id: "e4", ind: "energy", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "ExxonMobil & Chevron Q2 earnings (BMO) — big EPS rebound expected; cash-return focus", tickers: "XOM · CVX",
    rec: "Buybacks and dividend coverage are the tell into softer crude; strong FCF supports the names on any dip." },
  { id: "e5", ind: "energy", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "OPEC+ meeting (Sun) — sets September output after adding +188k bpd for August", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut new directional crude bets into Sunday; a further supply hike is bearish, a pause is bullish." },
  { id: "e6", ind: "energy", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Occidental Q2 (AMC) + EIA weekly petroleum report", tickers: "OXY · USO",
    rec: "Watch Permian volumes and breakevens; OXY is the higher-beta play on the crude-price path." },
  { id: "e7", ind: "energy", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "ConocoPhillips Q2 earnings — shareholder-return and low-cost supply focus", tickers: "COP",
    rec: "Watch capital-return framework and unit costs; COP's low breakevens cushion a softer-crude quarter." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 3, future: true, impact: 1, dir: "MIXED",
    headline: "Amgen's monthly MariTide (6 Phase 3 trials) flagged as emerging LLY/NVO GLP-1 threat", tickers: "AMGN · LLY · NVO",
    rec: "A medium-term competitive overhang, not a near-term mover; monitor Phase 3 reads for the obesity map." },
  { id: "h2", ind: "health", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "AbbVie Q2 (BMO) — Skyrizi/Rinvoq ramp vs. Humira erosion", tickers: "ABBV",
    rec: "Immunology growth engine vs. legacy decline is the tell; watch the FY guide for the offset pace." },
  { id: "h3", ind: "health", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Moderna Q2 (BMO) — into a stacked binary with an FDA flu-vaccine decision due ~Aug 5", tickers: "MRNA",
    rec: "Two discrete binaries in-window (earnings + FDA) → defined-risk only; expect sharp two-way moves." },
  { id: "h4", ind: "health", dayIdx: 9, future: true, impact: 3, dir: "BEARISH",
    headline: "Merck & Pfizer Q2 (BMO) — both facing YoY EPS declines", tickers: "MRK · PFE",
    rec: "Expectations are low; trade the pipeline/guidance and capital-return message, not the YoY drop itself." },
  { id: "h5", ind: "health", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Eli Lilly & Novo Nordisk Q2 — GLP-1 focal; LLY carries a high bar", tickers: "LLY · NVO",
    rec: "Size before headlines; the oral-GLP-1 (orforglipron) ramp is the tell — a clean beat re-rates LLY." },
  { id: "h6", ind: "health", dayIdx: 10, future: true, impact: 2, dir: "BULLISH",
    headline: "FDA decision on Moderna seasonal flu vaccine (~Aug 5) — potential 5th commercial product", tickers: "MRNA",
    rec: "A positive decision broadens the revenue base beyond COVID; a clear catalyst but binary — size for the risk." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (2:00 ET) — Warsh's first full cycle; ~36% live HIKE risk, 10Y ~4.61%", tickers: "JPM · BAC · SPY · TLT",
    rec: "The dominant swing in the window; a surprise hike is broadly bearish equities/bullish USD. Keep dry powder into the presser." },
  { id: "f2", ind: "finance", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "Visa fiscal-Q3 earnings (AMC) — cross-border and consumer-spend read", tickers: "V",
    rec: "Watch payments volume and cross-border growth as a real-time consumer gauge; guidance drives the move." },
  { id: "f3", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Mastercard Q2 earnings (BMO) — payments-volume read on the consumer", tickers: "MA",
    rec: "Pairs with Visa for the spend picture; a soft volume trend would confirm the cooling-consumer signal." },
  { id: "f4", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Big banks lead (JPM +1%, GS +2% Mon) after strong Q2; IB fees surged on SpaceX IPO + vol", tickers: "JPM · GS · MS",
    rec: "Earnings already delivered — take partial profits into strength rather than chase the post-print rally." },
  { id: "f5", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Consumer Confidence 90.8 misses (3rd straight decline); 10Y yield ~4.61%", tickers: "XLF · SPY",
    rec: "Softening consumer plus sticky yields — stay selective; favor asset-sensitive quality over duration-heavy names." },
  { id: "f6", ind: "finance", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Coinbase Q2 earnings (AMC) — soft crypto-trading quarter expected; high-beta proxy", tickers: "COIN",
    rec: "Revenue seen down ~10% YoY, but a high-beta name that rips on any BTC/macro move — defined-risk only." },
  { id: "f7", ind: "finance", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "July CPI (8:30 ET) — first key inflation print after the FOMC", tickers: "SPY · QQQ · TLT",
    rec: "The biggest late-window swing; a hot print revives hike odds. Avoid new size into the number." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Coca-Cola Q2 beat on volume; KO +4% — defensive bid amid a cooling consumer", tickers: "KO",
    rec: "Staples resilience is working; hold KO as ballast, but don't chase a defensive name up 4% on the print." },
  { id: "c2", ind: "consumer", dayIdx: 3, future: true, impact: 2, dir: "MIXED",
    headline: "Starbucks fiscal-Q3 earnings (AMC) — turnaround / US-comps watch", tickers: "SBUX",
    rec: "Watch US same-store traffic and the turnaround plan; a comps stabilization is the bull case, another miss isn't." },
  { id: "c3", ind: "consumer", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Amazon Q2 earnings (AMC) — AWS growth is the swing; ~6.9% implied move", tickers: "AMZN",
    rec: "AWS acceleration is the whole thesis; a re-accelerating cloud line re-rates the stock. Defined-risk into the print." },
  { id: "c4", ind: "consumer", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "McDonald's Q2 (BMO) — value push vs. a cooling consumer", tickers: "MCD",
    rec: "Traction on the value strategy and US traffic is the tell; a defensive quick-serve read on the low-end consumer." },
  { id: "c5", ind: "consumer", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "July US auto sales (monthly) — affordability and EV-demand read", tickers: "F · GM · TSLA",
    rec: "Watch incentives and hybrid/EV mix; affordability still bites — lean to the strongest franchises, avoid weak-volume names." },
  { id: "c6", ind: "consumer", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "Caterpillar Q2 (BMO) — global industrial and construction-demand bellwether", tickers: "CAT",
    rec: "A broad read on capex and construction; watch backlog and pricing for the industrial-cycle signal." },

  // ---- FORWARD MACRO CATALYSTS (week 2) -----------------------------------
  { id: "x1", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "PCE (June) — the Fed's preferred inflation gauge, day after the FOMC", tickers: "SPY · TLT · DXY",
    rec: "A cool print eases the hike narrative; a hot one compounds FOMC hawkishness. Keep powder dry." },
  { id: "x2", ind: "finance", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "July nonfarm payrolls / jobs report (8:30 ET) — labor read for the Fed path", tickers: "SPY · TLT · DXY",
    rec: "The week-2 macro swing; a hot number hardens higher-for-longer, a soft one revives cut hopes." },
  { id: "x3", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing PMI (July) — factory-activity read for cyclicals & semis", tickers: "SPY · SMH · XLI",
    rec: "A sub-50 print pressures cyclicals; watch new orders for the forward demand signal." },
  { id: "x4", ind: "consumer", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Services PMI (July) — the larger side of the economy", tickers: "SPY · XLY",
    rec: "Services is the bigger read on the consumer; a soft services print would confirm the cooling signal." },
  { id: "x5", ind: "energy", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum report + monthly STEO — crude/inventory path", tickers: "XOM · CVX · USO",
    rec: "Trade the OPEC+/Iran path with trailing stops; the STEO frames the H2 supply-demand balance." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "AMZN", name: "Amazon", rank: 1, spot: "~$233", sentiment: "Bullish",
    catalyst: "Q2 earnings — Thu Jul 30 (after close) · BINARY",
    iv: "Elevated — ~6.9% implied move (vs ~6% avg)", liq: "Very deep, liquid weeklies; penny-wide spreads",
    thesis: "Bullish into a binary with elevated IV → cut vega with a debit spread and get paid via a defined-risk put-credit spread that harvests the post-print crush. AWS growth is the whole thesis.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $230 / sell $245 · Aug 15 '26 · ~$6.50 net debit · cost/max loss ~$650 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $220 / buy $210 · Aug 15 '26 · ~$3.20 credit · max loss/capital ~$680 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$245 call · Aug 7 '26 · ~$3.00 debit · cost ~$300 · pure AWS-beat upside" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 2, spot: "~$339", sentiment: "Neutral-to-Bullish",
    catalyst: "Fiscal Q3 earnings — Thu Jul 30 (after close) · BINARY",
    iv: "LOW — ~3.8% implied move; long premium favored (low crush)", liq: "The single most liquid single-name chain in the market",
    thesis: "At record highs but with unusually cheap IV → low crush risk, so buying premium is favored despite the binary. Spread up for a cheaper, defined-cost version; the stock is already priced for strength.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$330 call · Sep 18 '26 · ~$14.00 debit · cost ~$1,400 · Δ≈0.65" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $340 / sell $355 · Aug 15 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$350 call · Aug 7 '26 · ~$2.20 debit · cost ~$220 · pure earnings pop" },
    ] },
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 3, spot: "~$495", sentiment: "Bullish",
    catalyst: "Q2 earnings — Tue Aug 4 (after close) · BINARY",
    iv: "VERY RICH — ~12.3% implied move (fattest in this list)", liq: "Deep, liquid weeklies; heavy AI-semis flow",
    thesis: "Bullish into a binary with expensive IV → avoid naked long calls (max crush). Cut vega with a debit spread, or get paid to be bullish via a defined-risk put-credit spread. Fresh off an ~8% chip-rout selloff.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $490 / sell $510 · Sep 18 '26 · ~$9.50 net debit · cost/max loss ~$950 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $470 / buy $455 · Aug 15 '26 · ~$5.50 credit · max loss/capital ~$950 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $510 / sell $530 · Aug 7 '26 · ~$7.50 net debit · cost/max loss ~$750 · defined-risk upside" },
    ] },
  { ticker: "MRNA", name: "Moderna", rank: 4, spot: "~$56", sentiment: "Bullish (contrarian)",
    catalyst: "Q2 earnings — ~Jul 31 (BMO) + FDA flu-vaccine decision ~Aug 5 · STACKED BINARY",
    iv: "HIGH — biotech + two stacked catalysts", liq: "Reasonably liquid; check spreads on further strikes",
    thesis: "A cheap, high-vol biotech into two discrete binaries (earnings + FDA) → defined-risk only, no cash-secured puts ($56 collateral is too big). Get paid to accumulate via a put-credit spread; small debit spread / OTM call for the asymmetric FDA pop.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $52 / buy $47 · Aug 21 '26 · ~$1.60 credit · max loss/capital ~$340 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $56 / sell $64 · Aug 21 '26 · ~$3.00 net debit · cost/max loss ~$300" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$62 call · Aug 7 '26 · ~$1.50 debit · cost ~$150 · stacked-binary lottery" },
    ] },
  { ticker: "PLTR", name: "Palantir", rank: 5, spot: "~$125", sentiment: "Neutral",
    catalyst: "Q2 earnings — Mon Aug 3 (after close) · BINARY",
    iv: "HIGH — retail-driven; historically huge two-way gaps", liq: "Very deep, heavy retail flow, liquid weeklies",
    thesis: "Bull/bear stalemate on an extreme valuation with rich IV → sell premium in a range with defined risk and harvest the crush. Spread up if you lean to momentum continuation.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $115p/buy $110p + sell $135c/buy $140c · Aug 7 '26 · ~$1.80 credit · max loss/capital ~$320 · range + IV crush" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $118 / buy $110 · Aug 15 '26 · ~$2.80 credit · max loss/capital ~$520 · bullish-neutral" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $128 / sell $140 · Aug 7 '26 · ~$4.50 net debit · cost/max loss ~$450 · momentum-continuation" },
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
// today line sits on the boundary between Jul 29 and Jul 30
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Wednesday, Jul 29 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 29)
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
