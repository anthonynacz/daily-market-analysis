import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Monday, October 12, 2026 (live-researched).
 * Window: last 3 days (Oct 9) → coming 2 weeks (Oct 26).
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

// 18-day axis: Oct 9 .. Oct 26 (last 3 days → coming 2 weeks). Today = index 3 (Oct 12).
const DAYS = [
  { idx: 0, date: "Oct 9", dow: "Fri" },
  { idx: 1, date: "Oct 10", dow: "Sat" },
  { idx: 2, date: "Oct 11", dow: "Sun" },
  { idx: 3, date: "Oct 12", dow: "Mon" }, // TODAY (Columbus Day)
  { idx: 4, date: "Oct 13", dow: "Tue" },
  { idx: 5, date: "Oct 14", dow: "Wed" },
  { idx: 6, date: "Oct 15", dow: "Thu" },
  { idx: 7, date: "Oct 16", dow: "Fri" },
  { idx: 8, date: "Oct 17", dow: "Sat" },
  { idx: 9, date: "Oct 18", dow: "Sun" },
  { idx: 10, date: "Oct 19", dow: "Mon" },
  { idx: 11, date: "Oct 20", dow: "Tue" },
  { idx: 12, date: "Oct 21", dow: "Wed" },
  { idx: 13, date: "Oct 22", dow: "Thu" },
  { idx: 14, date: "Oct 23", dow: "Fri" },
  { idx: 15, date: "Oct 24", dow: "Sat" },
  { idx: 16, date: "Oct 25", dow: "Sun" },
  { idx: 17, date: "Oct 26", dow: "Mon" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "S&P 500 (7,811) back near record as AI rally resumes; Nvidia nears $6T", tickers: "NVDA · MSFT · AVGO",
    rec: "HOLD AI leaders; after Thu's OpenAI-revenue scare (NVDA −2.9%), add on dips not strength." },
  { id: "t2", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Columbus Day: bond market closed, Nasdaq flat as 5.2% yields press megacap multiples", tickers: "NVDA · MSFT · AAPL",
    rec: "WATCH — highest 10Y since 2002 caps high-multiple tech; keep core, let bank earnings set the tape." },
  { id: "t3", ind: "tech", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "ASML Q3 (BMO) — AI-capex & 2027 order tell; China / export-control risk", tickers: "ASML · NVDA · AMAT · LRCX",
    rec: "WATCH bookings; a strong 2027 guide re-rates the capex chain, soft orders hit the whole semi group." },
  { id: "t4", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "BULLISH",
    headline: "TSMC Q3 (BMO) — AI/HPC demand & Q4 gross-margin guide", tickers: "TSM · NVDA · AVGO",
    rec: "Core AI-infra tell; a strong HPC guide confirms the build-out — buy weakness, don't chase the pop." },
  { id: "t5", ind: "tech", dayIdx: 7, future: true, impact: 1, dir: "MIXED",
    headline: "October monthly options expiration (OpEx)", tickers: "SPY · QQQ · NVDA",
    rec: "Expect pin / gamma effects; avoid initiating new size into the Friday close." },
  { id: "t6", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through builds into late-Oct megacap earnings week", tickers: "NVDA · AVGO · MSFT",
    rec: "Position for the MSFT/GOOGL/META/AAPL prints (~Oct 28–30); let CPI & banks clear first." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "WTI ~$92 — crude −10%/mo despite a persistent Hormuz risk premium", tickers: "XOM · CVX · COP",
    rec: "Keep core E&P as geopolitical insurance; trim rallies — OPEC+ held output, spare capacity caps upside." },
  { id: "e2", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status + STEO (delayed by Monday holiday)", tickers: "XOM · CVX · USO",
    rec: "Watch draws vs. the $105 Brent Q4 call; a surprise build pressures crude near-term." },
  { id: "e3", ind: "energy", dayIdx: 12, future: true, impact: 2, dir: "BULLISH",
    headline: "Iran war keeps Strait of Hormuz flows constrained", tickers: "XOM · CVX · OXY",
    rec: "Tactical energy overweight with trailing stops — a ceasefire unwinds the premium fast." },
  { id: "e4", ind: "energy", dayIdx: 10, future: true, impact: 1, dir: "BULLISH",
    headline: "LNG & natgas strength into winter; selectivity over broad renewables", tickers: "LNG · CTRA · FSLR",
    rec: "Favor LNG exporters on winter demand; be selective in renewables — avoid broad solar baskets." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Biotech M&A tailwind persists; XBI firm as pharma hunts pipeline for patent cliffs", tickers: "PFE · MRK · ABBV · XBI",
    rec: "Tilt to de-risked SMID-cap biotech (XBI) that fills large-pharma revenue gaps." },
  { id: "h2", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Roche Enspryng PDUFA — thyroid eye disease decision", tickers: "RHHBY · AMGN",
    rec: "Binary for the TED franchise; watch label breadth before sizing competitors." },
  { id: "h3", ind: "health", dayIdx: 7, future: true, impact: 2, dir: "BEARISH",
    headline: "Managed-care Q3 season opens — medical-cost trend & 2027 MA rate watch", tickers: "UNH · HUM · ELV · CVS",
    rec: "Stay cautious / underweight MCOs until MLR trend and 2027 Medicare-Advantage rates clear." },
  { id: "h4", ind: "health", dayIdx: 11, future: true, impact: 2, dir: "BULLISH",
    headline: "Regeneron pozelimab PDUFA — VEXAS syndrome (Priority Review)", tickers: "REGN",
    rec: "First-in-indication optionality; keep a small position ahead of a binary decision." },
  { id: "h5", ind: "health", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Biogen litifilimab lupus (SCLE) readout window", tickers: "BIIB",
    rec: "Speculative; size small into binary data — a clean win reopens the pipeline narrative." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "Banks lag into earnings: KBW Bank Index −9.7%/mo as 10Y hits 5.2% (highest since 2002)", tickers: "JPM · BAC · WFC · GS",
    rec: "Rising long yields help NII but drag AFS marks/credit; favor trading-heavy names (JPM/GS) over pure lenders." },
  { id: "f2", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Big-bank kickoff: JPM, GS, WFC, C Q3 (BMO)", tickers: "JPM · GS · WFC · C",
    rec: "Low expectations after a record Q2; strong trading/IB can beat — go defined-risk into the print." },
  { id: "f3", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "BAC & MS Q3 (BMO) — same morning as the September CPI print", tickers: "BAC · MS",
    rec: "Twin catalyst: NII beats help BAC, wealth/trading flows help MS — mind the CPI cross-current." },
  { id: "f4", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "September CPI (8:30 ET) — first inflation print after the Fed's Sept rate HIKE", tickers: "SPY · JPM · TLT",
    rec: "Biggest macro swing in the window; a hot number cements higher-for-longer into the Oct 28 FOMC." },
  { id: "f5", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Pre-FOMC positioning builds (decision Oct 27–28)", tickers: "SPY · JPM · TLT",
    rec: "Keep dry powder; whether the Fed follows its Sept hike is the next macro pivot — avoid adding duration." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Netflix slides to ~$70 (post-split), near 52-wk low on HSBC downgrade", tickers: "NFLX",
    rec: "Contrarian setup into Oct 20 earnings; wait for the print — don't catch the knife early." },
  { id: "c2", ind: "consumer", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "September retail sales watch (schedule shifting around data gaps)", tickers: "WMT · TGT · AMZN",
    rec: "Gauge consumer resilience; favor value/traffic winners (WMT) over discretionary." },
  { id: "c3", ind: "consumer", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "Netflix Q3 (after close) — engagement, ad tier & Disney licensing", tickers: "NFLX",
    rec: "High-IV binary; use defined-risk and harvest the crush rather than buying naked premium." },
  { id: "c4", ind: "consumer", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q3 (after close) — deliveries, auto margins & robotaxi narrative", tickers: "TSLA",
    rec: "Violent two-way binary; stay defined-risk, size any OTM calls as lottery tickets." },
  { id: "c5", ind: "consumer", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Consumer-staples & broad Q3 earnings widen (KO, PG) alongside IBM week", tickers: "KO · PG · UAL",
    rec: "Watch pricing power vs. volume; defensive staples steady portfolios into the macro risk." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "JPM", name: "JPMorgan Chase", rank: 1, spot: "~$333", sentiment: "Bullish",
    catalyst: "Q3 earnings — Tue Oct 13 (BMO) · big-bank season kickoff · BINARY",
    iv: "Modestly elevated into the print (~3–4% implied move) — defined-risk favored",
    liq: "B — deep-liquidity list (mega-cap universal bank, typically >150k option contracts/day); live chain unavailable (data host unreachable via proxy), so strikes kept near the money on the Nov 20 monthly + Oct 16 weekly",
    thesis: "Record trading/IB fees + a steep curve (10Y ~5.2%) into a modest-IV binary with low expectations after a bumper Q2. Lean bullish but stay defined-risk: get paid with a put-credit spread, add a cheap debit spread for the pop.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $320 / buy $310 · Nov 20 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $345 · Nov 20 '26 · ~$6.50 net debit · cost/max loss ~$650" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $335 / sell $345 · Oct 16 '26 (weekly) · ~$4.00 net debit · cost/max loss ~$400 · earnings pop" },
    ] },
  { ticker: "BAC", name: "Bank of America", rank: 2, spot: "~$54", sentiment: "Bullish",
    catalyst: "Q3 earnings — Wed Oct 14 (BMO), alongside the Sept CPI print · BINARY",
    iv: "Low-to-moderate into earnings — long premium / debit spreads are cheap here",
    liq: "B — deep-liquidity list; live chain unavailable (data host unreachable via proxy), so strikes kept near the money on the Nov 20 monthly + Oct 16 weekly. Cheap stock, but strike×100 collateral on a CSP is >$1,500 so spreads are used instead",
    thesis: "The most rate-sensitive big bank into earnings with cheap IV — rising long yields lift NII. Low premiums let you buy defined upside directly; a tight put-credit spread gets paid if it just holds support.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $52 / buy $49 · Nov 20 '26 · ~$1.00 credit · max loss/capital ~$200 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $53 / sell $57 · Nov 20 '26 · ~$1.60 net debit · cost/max loss ~$160" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$55 call · Oct 16 '26 (weekly) · ~$0.70 debit · cost ~$70 · earnings pop" },
    ] },
  { ticker: "NFLX", name: "Netflix", rank: 3, spot: "~$70 (post-split)", sentiment: "Neutral-to-Bullish",
    catalyst: "Q3 earnings — Tue Oct 20 (after close) · BINARY",
    iv: "Rich into the print (~8% implied move) — harvest the crush",
    liq: "B — deep-liquidity list; live chain unavailable (data host unreachable via proxy), so strikes kept near the money on the Nov 20 monthly + Oct 23 weekly. Post-split ~$70 stock keeps every structure well inside the capital cap",
    thesis: "Beaten-down (near 52-wk lows on an HSBC downgrade) into a high-IV binary with an ads/engagement + Disney-licensing story. Avoid naked long premium (max crush); sell a defined-risk put-credit spread, add a cheap debit spread, keep OTM calls lottery-sized.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $67 / buy $62 · Nov 20 '26 · ~$1.50 credit · max loss/capital ~$350 · harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $70 / sell $77 · Nov 20 '26 · ~$3.00 net debit · cost/max loss ~$300" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$75 call · Oct 23 '26 (weekly) · ~$1.20 debit · cost ~$120 · pure earnings pop" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 4, spot: "~$383", sentiment: "Neutral (high-vol binary)",
    catalyst: "Q3 earnings — Wed Oct 21 (after close) · BINARY",
    iv: "Very rich into the print (~9–10% implied move) — defined-risk / crush play",
    liq: "B — deep-liquidity list (the highest single-name option volume, routinely >1M contracts/day); live chain unavailable (data host unreachable via proxy), so near-the-money strikes on the Nov 20 monthly + Oct 23 weekly",
    thesis: "A violent, two-way binary (deliveries/auto margins vs. robotaxi narrative) with very expensive IV → stay defined-risk and let the crush work for you; buy the OTM call only as a small lottery ticket.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $360 / buy $350 · Nov 20 '26 · ~$3.50 credit · max loss/capital ~$650 · bullish-neutral, IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $385 / sell $405 · Nov 20 '26 · ~$8.00 net debit · cost/max loss ~$800" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$400 call · Oct 23 '26 (weekly) · ~$6.00 debit · cost ~$600 · earnings pop" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 5, spot: "~$229", sentiment: "Bullish",
    catalyst: "AI-capex read-through (ASML Oct 14 / TSMC Oct 15) · nears $6T · no earnings in window",
    iv: "Moderately elevated on AI-summit & capex flows — long premium is reasonable (no binary crush)",
    liq: "B — deep-liquidity list (routinely the deepest single-name chain, ~160M shares & millions of contracts/day); live chain unavailable (data host unreachable via proxy), so near-the-money strikes on the Nov 20 monthly + Oct 23 weekly",
    thesis: "Bullish AI-infrastructure momentum with no earnings in the window (reports late Nov) → no crush to fight, though the Oct 8 OpenAI-revenue scare warns of two-way risk. Use debit spreads for defined cost; a cheap OTM call plays a capex-confirmation pop.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $220 / sell $235 · Nov 20 '26 · ~$8.50 net debit · cost/max loss ~$850 · Δ-positive, defined" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $230 / sell $245 · Nov 20 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$240 call · Oct 23 '26 (weekly) · ~$2.50 debit · cost ~$250 · capex-read / AI pop" },
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
// today line sits on the boundary between Oct 12 and Oct 13
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Monday, Oct 12 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Oct 12)
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
