import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Saturday, August 1, 2026 (live-researched).
 * Window: last 3 days (Jul 29) → coming 2 weeks (Aug 15).
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

// 18-day axis: Jul 29 .. Aug 15 (last 3 days → coming 2 weeks). Today = index 3 (Aug 1).
const DAYS = [
  { idx: 0, date: "Jul 29", dow: "Wed" },
  { idx: 1, date: "Jul 30", dow: "Thu" },
  { idx: 2, date: "Jul 31", dow: "Fri" },
  { idx: 3, date: "Aug 1", dow: "Sat" }, // TODAY
  { idx: 4, date: "Aug 2", dow: "Sun" },
  { idx: 5, date: "Aug 3", dow: "Mon" },
  { idx: 6, date: "Aug 4", dow: "Tue" },
  { idx: 7, date: "Aug 5", dow: "Wed" },
  { idx: 8, date: "Aug 6", dow: "Thu" },
  { idx: 9, date: "Aug 7", dow: "Fri" },
  { idx: 10, date: "Aug 8", dow: "Sat" },
  { idx: 11, date: "Aug 9", dow: "Sun" },
  { idx: 12, date: "Aug 10", dow: "Mon" },
  { idx: 13, date: "Aug 11", dow: "Tue" },
  { idx: 14, date: "Aug 12", dow: "Wed" },
  { idx: 15, date: "Aug 13", dow: "Thu" },
  { idx: 16, date: "Aug 14", dow: "Fri" },
  { idx: 17, date: "Aug 15", dow: "Sat" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above (Jul 29 = 0 … Aug 15 = 17).
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Global AI-chip selloff wipes >$1T; SK Hynix −15%, drags NVDA/AMD/MU", tickers: "NVDA · AMD · MU · AVGO",
    rec: "WATCH — a valuation reset, not a confirmed demand break; wait for AMD (Aug 4) to confirm or deny the AI-capex-peak thesis before adding." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Chips snap back — AMD +13%, INTC +13%, TSM +7%, NVDA +2.9%; SOXX +3%", tickers: "AMD · INTC · TSM · NVDA",
    rec: "HOLD quality (NVDA/AVGO); the bounce is technical and oversold — the trend is unresolved, so don't chase it." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 1, dir: "BULLISH",
    headline: "Deutsche Bank lifts NVDA price target to $220 into the Aug 26 print", tickers: "NVDA",
    rec: "HOLD/WATCH — supportive, but the read-through from AMD (Aug 4) matters more near-term." },
  { id: "t4", ind: "tech", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Palantir Q2 earnings (after close) — rich multiple meets guidance", tickers: "PLTR",
    rec: "WATCH — extreme valuation and a beat-and-fade history; let the print clear before positioning." },
  { id: "t5", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "AMD Q2 earnings (after close) — the sector's AI-capex-peak referendum", tickers: "AMD · NVDA · AVGO · MU",
    rec: "WATCH — the key test of the AI-capex-peak fear; the read-through sets the tone for the whole complex." },
  { id: "t6", ind: "tech", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Cisco FQ4 earnings — AI-networking orders & backlog watch", tickers: "CSCO",
    rec: "HOLD — order commentary on AI networking is the tell; don't add ahead of the number." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "ExxonMobil Q2 EPS $3.52 slight miss; XOM −2.9% despite record cash", tickers: "XOM",
    rec: "HOLD — a 43-yr dividend streak and $20B buyback are intact; the drop was a headline EPS miss, not a franchise problem." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Chevron Q2 profit ~$12.1B (~4× YoY) beats; CVX barely moves", tickers: "CVX",
    rec: "HOLD — a strong print already largely priced; add only on weakness." },
  { id: "e3", ind: "energy", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "OPEC+ ministerial (Sun Aug 2) — sets September output policy", tickers: "XOM · CVX · COP · OXY · USO",
    rec: "WATCH — a surprise larger hike is bearish crude, a hold/cut is bullish; cut new directional bets into Sunday." },
  { id: "e4", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "EOG Resources Q2 earnings — Permian volumes & capital discipline", tickers: "EOG",
    rec: "WATCH — free cash flow and buyback pace matter more than the headline EPS." },
  { id: "e5", ind: "energy", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Occidental Q2 earnings — debt paydown & Permian focus", tickers: "OXY",
    rec: "HOLD — Buffett-backed; watch the debt-reduction trajectory." },
  { id: "e6", ind: "energy", dayIdx: 7, future: true, impact: 1, dir: "MIXED",
    headline: "EIA Weekly Petroleum Status Report (crude inventories)", tickers: "USO · XOM · CVX",
    rec: "WATCH — a big draw amid firm crude reinforces the bull case; time entries around it." },
  { id: "e7", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "ConocoPhillips Q2 earnings — shareholder-return cadence", tickers: "COP",
    rec: "WATCH — distributions and the capex guide are the swing factors." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "AbbVie Q2 beats (Skyrizi/Rinvoq +20%+) but trims FY EPS on deal", tickers: "ABBV",
    rec: "HOLD — franchise strong; the FY-EPS trim sets up a sell-the-news dip that's a better entry." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Alnylam +6% on Alzheimer's RNAi data + first >$1B product quarter", tickers: "ALNY",
    rec: "BUY/WATCH — pipeline optionality plus a revenue inflection; scale in on pullbacks." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Moderna Q2 loss narrows; shares run into the Aug 5 flu PDUFA", tickers: "MRNA",
    rec: "WATCH — binary Aug 5 catalyst ahead; don't chase the pre-decision run-up." },
  { id: "h4", ind: "health", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Pfizer Q2 earnings (before open) — cost cuts vs patent-cliff overhang", tickers: "PFE",
    rec: "HOLD — cheap (~9×) but growth is the question; watch cost-cut and deal commentary." },
  { id: "h5", ind: "health", dayIdx: 7, future: true, impact: 3, dir: "BULLISH",
    headline: "Eli Lilly Q2 (before open) — orforglipron & GLP-1 guidance the key", tickers: "LLY · NVO",
    rec: "BUY/HOLD — the sector leader; use any guidance-driven dip to add." },
  { id: "h6", ind: "health", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "CVS Health Q2 — Aetna medical-cost (MLR) trend is the swing factor", tickers: "CVS",
    rec: "WATCH — the MLR trend decides direction; fundamentally cheap but needs the cost trend to cooperate." },
  { id: "h7", ind: "health", dayIdx: 7, future: true, impact: 3, dir: "BULLISH",
    headline: "Moderna mRNA-1010 seasonal-flu PDUFA (VRBPAC voted unanimously yes)", tickers: "MRNA",
    rec: "WATCH→BUY on approval — it would be a 5th product; a CRL is the downside, so keep it defined-risk." },
  { id: "h8", ind: "health", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Novo Nordisk Q2 (est) — Wegovy/Ozempic scripts & US GLP-1 share vs Lilly", tickers: "NVO",
    rec: "HOLD/WATCH — beaten-down; needs a share-loss reversal to re-rate." },

  // ---- FINANCIALS / MACRO -------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "FOMC holds at 3.50–3.75% (5th straight) — hawkish 9–3, three dissents wanted a HIKE", tickers: "JPM · BAC · WFC · SPY · TLT",
    rec: "HOLD banks — higher-for-longer supports NII, but watch a long-yield spike hitting bond books; cuts are off the table near-term." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Q2 advance GDP +1.5% misses +2.1% est; growth cools, consumer holds", tickers: "SPY · QQQ",
    rec: "Soft-landing, not recession — a slowdown that keeps the consumer trade intact; don't reach for the recession hedge." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "June PCE cools — headline 3.7%, core 3.3%; disinflation resumes", tickers: "TLT · SPY",
    rec: "Constructive, but core 3.3% is still well above 2% — enough to keep the Fed frozen, not to force a cut." },
  { id: "f4", ind: "finance", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Berkshire Hathaway Q2 (est) — operating earnings, record cash & buyback pace", tickers: "BRK.B",
    rec: "HOLD — defensive ballast; the cash level signals management's read on market value." },
  { id: "f5", ind: "finance", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "July jobs report / nonfarm payrolls (8:30 ET) — first big test post-hold", tickers: "SPY · QQQ · TLT · JPM",
    rec: "WATCH — a hot print revives hike odds given the three dissenters; a soft one revives Sept-cut hopes. Keep dry powder." },
  { id: "f6", ind: "finance", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "July CPI (8:30 ET) — the window's make-or-break inflation print", tickers: "SPY · QQQ · TLT",
    rec: "WATCH — the biggest swing risk; a hot core re-prices hike risk, a cool one is the risk-on trigger. Avoid new size into it." },
  { id: "f7", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "July PPI — pipeline inflation & a PCE input, confirms or fades CPI", tickers: "SPY · TLT",
    rec: "WATCH — a hot PPI on top of a hot CPI is the bearish combination for rate-sensitives." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Amazon Q2 blowout — AWS +37% (fastest since '21); stock +11–15%", tickers: "AMZN",
    rec: "Core holding — AWS re-acceleration is the story; watch the raised ~$220B capex guide as an FCF drag." },
  { id: "c2", ind: "consumer", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Starbucks FQ3 beats big — NA comps +8.1%, guidance raised a 3rd time", tickers: "SBUX",
    rec: "Turnaround confirmed with margins +430bps — a buy-the-dip name from here." },
  { id: "c3", ind: "consumer", dayIdx: 0, future: false, impact: 1, dir: "BULLISH",
    headline: "Coca-Cola Q2 tops ests; staples bid (XLP +2%) shows defensive appetite", tickers: "KO · XLP",
    rec: "The staples bid confirms rotation appetite — a reasonable ballast, not a chase." },
  { id: "c4", ind: "consumer", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "McDonald's Q2 earnings — value-menu traffic vs a cooling low-end consumer", tickers: "MCD",
    rec: "WATCH — position ahead only if you're bullish on low-end spend; traffic is the tell." },
  { id: "c5", ind: "consumer", dayIdx: 6, future: true, impact: 1, dir: "BULLISH",
    headline: "July auto sales / SAAR ~16.7M — strongest month of 2026 (Cox est)", tickers: "F · GM · TSLA",
    rec: "Constructive for Detroit demand; watch incentives — rising discounts would undercut the volume read." },
  { id: "c6", ind: "consumer", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "July retail sales (advance) — the broad consumer-health read", tickers: "SPY · XRT · AMZN · WMT",
    rec: "WATCH — the biggest consumer catalyst in the window; it sets the tone into HD/WMT/TGT prints the following week." },
  { id: "c7", ind: "consumer", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "UMich consumer sentiment (prelim Aug) — inflation-expectations watch", tickers: "SPY · XRT",
    rec: "WATCH — a soft sentiment plus hot inflation-expectations combo would pressure discretionary." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 1, spot: "~$430", sentiment: "Bullish",
    catalyst: "Q2 earnings — Tue Aug 4 (after close) · BINARY",
    iv: "~8–12% implied move — VERY RICH (IVR elevated, EST)", liq: "One of the most liquid single-name chains; penny-wide spreads, huge weekly OI",
    thesis: "Bullish into a binary with very rich IV, and a ~22% pullback off the June peak offers a dip entry. Sell premium below support conservatively; take defined-risk upside up top — avoid naked long calls (max crush).",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $400 / buy $390 · Aug 15 '26 · ~$3.00 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $440 / sell $460 · Aug 15 '26 · ~$8.00 net debit · cost/max loss ~$800 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$460 call · Aug 8 '26 · ~$12 debit · cost ~$1,200 · pure earnings pop" },
    ] },
  { ticker: "PLTR", name: "Palantir", rank: 2, spot: "~$122", sentiment: "Neutral-to-Bullish",
    catalyst: "Q2 earnings — Mon Aug 3 (after close) · BINARY",
    iv: "~15% implied move — VERY RICH (≈2× the ~7% avg, EST)", liq: "Massive retail flow; deep weekly chains, penny-wide spreads",
    thesis: "Strong growth but a stretched multiple and a beat-and-fade history — with IV this rich, get paid to be neutral. Sell the crush conservatively; take defined-risk upside if you lean bullish.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $110/$105 put + $135/$140 call · Aug 15 '26 · ~$1.70 credit · max loss/capital ~$330 · sells the IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $125 / sell $135 · Aug 15 '26 · ~$4.00 net debit · cost/max loss ~$400" },
      { profile: "Aggressive",   strategy: "Long Call (ATM)", text: "$122 call · Aug 8 '26 · ~$8.50 debit · cost ~$850" },
    ] },
  { ticker: "DIS", name: "Walt Disney", rank: 3, spot: "~$96", sentiment: "Bullish",
    catalyst: "FQ3 earnings — Wed Aug 5 (before open) · BINARY",
    iv: "Elevated, not extreme (~5–7% implied, EST)", liq: "Large-cap Dow name; tight spreads, deep OI",
    thesis: "Parks resilience plus a streaming-profitability inflection and double-digit EPS growth expected — a lower-beta bullish setup. Sell a defined-risk put spread below support; spread up cheaply for the pop.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $92 / buy $87 · Aug 15 '26 · ~$1.30 credit · max loss/capital ~$370 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $97 / sell $102 · Aug 15 '26 · ~$1.80 net debit · cost/max loss ~$180" },
      { profile: "Aggressive",   strategy: "Long Call (ATM)", text: "$97 call · Aug 7 '26 · ~$2.80 debit · cost ~$280" },
    ] },
  { ticker: "SHOP", name: "Shopify", rank: 4, spot: "~$122", sentiment: "Bullish",
    catalyst: "Q2 earnings — Wed Aug 5 (before open) · BINARY",
    iv: "Rich (~10–12% implied, EST)", liq: "Very active weekly chain; tight spreads",
    thesis: "A wave of upgrades into the print (MS Overweight $192; Jefferies/Stifel to Buy) and an accelerating AI-commerce narrative. Sell premium below support; take defined-risk upside into the momentum.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $115 / buy $110 · Aug 15 '26 · ~$1.70 credit · max loss/capital ~$330" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $125 / sell $135 · Aug 15 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$125 call · Aug 8 '26 · ~$5.50 debit · cost ~$550" },
    ] },
  { ticker: "ABNB", name: "Airbnb", rank: 5, spot: "~$152", sentiment: "Neutral-to-Bearish",
    catalyst: "Q2 earnings — Thu Aug 6 (after close) · BINARY",
    iv: "Elevated (~7–9% implied, EST)", liq: "Liquid large cap; deep weekly OI, tight spreads",
    thesis: "Persistent underperformance and growth-deceleration / margin-spend concerns argue for a rich-IV, defined-risk downside-to-neutral tilt. Sell an upside call spread; take defined-risk downside below.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $160 / buy $165 · Aug 15 '26 · ~$1.60 credit · max loss/capital ~$340 · fades the bounce" },
      { profile: "Moderate",     strategy: "Bear Put Debit Spread", text: "Buy $150 / sell $140 · Aug 15 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Aggressive",   strategy: "Long Put (ATM)", text: "$150 put · Aug 8 '26 · ~$5.75 debit · cost ~$575" },
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
// today line sits on the boundary between Aug 1 and Aug 2
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Saturday, Aug 1 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Aug 1)
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
