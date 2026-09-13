import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Sunday, September 13, 2026 (live-researched).
 * Window: last 3 days (Sep 10) → coming 2 weeks (Sep 27).
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

// 18-day axis: Sep 10 .. Sep 27 (last 3 days → coming 2 weeks). Today = index 3 (Sep 13).
const DAYS = [
  { idx: 0, date: "Sep 10", dow: "Thu" },
  { idx: 1, date: "Sep 11", dow: "Fri" },
  { idx: 2, date: "Sep 12", dow: "Sat" },
  { idx: 3, date: "Sep 13", dow: "Sun" }, // TODAY
  { idx: 4, date: "Sep 14", dow: "Mon" },
  { idx: 5, date: "Sep 15", dow: "Tue" },
  { idx: 6, date: "Sep 16", dow: "Wed" },
  { idx: 7, date: "Sep 17", dow: "Thu" },
  { idx: 8, date: "Sep 18", dow: "Fri" },
  { idx: 9, date: "Sep 19", dow: "Sat" },
  { idx: 10, date: "Sep 20", dow: "Sun" },
  { idx: 11, date: "Sep 21", dow: "Mon" },
  { idx: 12, date: "Sep 22", dow: "Tue" },
  { idx: 13, date: "Sep 23", dow: "Wed" },
  { idx: 14, date: "Sep 24", dow: "Thu" },
  { idx: 15, date: "Sep 25", dow: "Fri" },
  { idx: 16, date: "Sep 26", dow: "Sat" },
  { idx: 17, date: "Sep 27", dow: "Sun" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "Oracle FQ1 blowout: cloud infra +121% to $7.4B, but FCF −$5B on $28B capex", tickers: "ORCL",
    rec: "Hold — AI-infra demand is real, but the cash burn is the risk. Don't chase the earnings gap." },
  { id: "t2", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "Huang touts AI demand & pricing, but DOJ probes Nvidia–Groq licensing; NVDA slips", tickers: "NVDA",
    rec: "Quality hold at ~$218; use the AI-sentiment reset to scale into dips — don't chase strength." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "SOX confirms a bear market — chip index −20% from June peak as yields rise", tickers: "NVDA · AMD · AVGO · SOXX",
    rec: "Trim high-beta semis into bounces; wait for the FOMC before adding — rate risk caps multiples." },
  { id: "t4", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Adobe FQ3 beats & raises but stock −2% AH on CEO transition news", tickers: "ADBE",
    rec: "No binary left; wait for a base to form before adding — the AI-monetization debate lingers." },
  { id: "t5", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "August CPI (8:30 ET) lands with the FOMC — hot print hits high-multiple tech", tickers: "NVDA · MSFT · GOOGL",
    rec: "De-risk pre-print; a cool number is the bull catalyst, a hot one deepens the semi selloff." },
  { id: "t6", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "BULLISH",
    headline: "iPhone 18 line hits stores; foldable iPhone Duo ($1,999) preorders open Oct 16", tickers: "AAPL",
    rec: "Constructive demand signal + new CEO Ternus; own the cycle via defined-risk calls, not chase." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 3, dir: "MIXED",
    headline: "WTI slips below $100 as Iran–Gulf Hormuz talks raise de-escalation hopes", tickers: "XOM · CVX · USO",
    rec: "Trim tactical energy on de-escalation headlines; keep a core E&P for residual supply risk." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Crude opened elevated (~WTI $104 / Brent $109) on Strait of Hormuz shipping risk", tickers: "XOM · CVX · COP",
    rec: "Keep core E&P as geopolitical insurance; use trailing stops — a ceasefire reverses it fast." },
  { id: "e3", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "XOM · CVX · USO",
    rec: "Use inventory prints to time entries — geopolitics still dominates the fundamentals." },
  { id: "e4", ind: "energy", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "OPEC+ Q4 output-pause in focus after the Sep 6 ministerial", tickers: "XOM · OXY · USO",
    rec: "A confirmed pause is mildly supportive; stay selective on E&P quality (XOM/CVX over marginal names)." },
  { id: "e5", ind: "energy", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories + OPEC+ Q4 follow-through", tickers: "XOM · CVX · USO",
    rec: "Trade the Hormuz risk premium with trailing stops; a de-escalation unwinds it quickly." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "FDA PDUFA — Nuvectis/zidesamtinib decision for ROS1+ NSCLC", tickers: "NVCT",
    rec: "Pure binary — size small. Approval is the bull case; a CRL is the falling knife. Lottery-size only." },
  { id: "h2", ind: "health", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "FDA PDUFA — zlurgisertib (ALK2 inhibitor) for fibrodysplasia ossificans progressiva", tickers: "biotech binary",
    rec: "Speculative rare-disease binary; keep exposure to lottery-ticket size ahead of the decision." },
  { id: "h3", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Biotech M&A momentum continues; XBI firms as pharma hunts for its revenue gap", tickers: "XBI · PFE · MRK",
    rec: "Tailwind for SMID-cap biotech (XBI); tilt to de-risked names that fit large-cap pipelines." },
  { id: "h4", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "BEARISH",
    headline: "Managed-care margin worries persist into the rate decision", tickers: "UNH · HUM · CVS",
    rec: "Stay cautious / underweight managed care until utilization and policy clarity improve." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (2pm ET) — Warsh's hawkish tilt; ~25bp HIKE to 3.75–4.00% in play", tickers: "JPM · BAC · SPY · TLT",
    rec: "Biggest macro swing in the window; asset-sensitive banks win a hike — keep dry powder into the dots." },
  { id: "f2", ind: "finance", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "FOMC meeting day 1 begins; futures price hike odds above 50%", tickers: "JPM · BAC · GS",
    rec: "Avoid adding rate-duration pre-decision; position for higher-for-longer via asset-sensitive banks." },
  { id: "f3", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Money-center banks firm near highs (JPM ~$357) on a higher-for-longer NII outlook", tickers: "JPM · BAC · WFC",
    rec: "Take partial profits into 52-wk highs rather than chase; keep core NII-beneficiary exposure." },
  { id: "f4", ind: "finance", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "August retail sales (8:30 ET) — consumer-resilience tell alongside the FOMC", tickers: "XLF · JPM · V",
    rec: "A strong print reinforces the hike case; watch card-network names for spend momentum." },
  { id: "f5", ind: "finance", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Quarterly quad witching — Sep 18 (options & futures expiry)", tickers: "SPY · QQQ · IWM",
    rec: "Expect elevated volume & pin risk; avoid initiating new size into the close." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Darden (Olive Garden/LongHorn) FQ1 earnings (before open) — consumer-spend read", tickers: "DRI",
    rec: "Binary; analyst PT hikes set a high bar (spot ~$208). Defined-risk only into the print." },
  { id: "c2", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "BEARISH",
    headline: "Nike removed from the S&P 100 in index reconstitution — passive-outflow risk", tickers: "NKE",
    rec: "Expect forced index selling near ~$43; wait for the flush before any contrarian nibble." },
  { id: "c3", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "BULLISH",
    headline: "iPhone 18 launch weekend — Apple store traffic & first-weekend demand signal", tickers: "AAPL",
    rec: "Constructive for AAPL (~$316); hold or own the product cycle via defined-risk structures." },
  { id: "c4", ind: "consumer", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Costco FQ4 + Accenture FQ4 earnings — membership & enterprise-demand tells", tickers: "COST · ACN",
    rec: "Renewal rates (COST) and bookings (ACN) are the tells; wait for the guide before adding." },
  { id: "c5", ind: "consumer", dayIdx: 2, future: false, impact: 1, dir: "MIXED",
    headline: "Consumer sentiment soft as higher-for-longer rates bite affordability", tickers: "WMT · TGT · AMZN",
    rec: "Favor value/traffic winners (WMT); stay cautious on rate-sensitive discretionary." },

  // ---- FORWARD CATALYSTS (week 2: Sep 19–27) ------------------------------
  { id: "x1", ind: "tech", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through continues post ORCL print; semis digest the FOMC", tickers: "NVDA · AVGO · ORCL",
    rec: "Let the dust settle; re-add on confirmation of capex strength, not the first bounce." },
  { id: "x2", ind: "health", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "GLP-1 / obesity-drug data digestion continues", tickers: "LLY · NVO · VKTX",
    rec: "Volatility persists; favor category leaders on clean profiles, fade knee-jerk single-headline moves." },
  { id: "x3", ind: "finance", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "FOMC minutes read-through + post-decision Fed speak", tickers: "JPM · BAC · SPY · TLT",
    rec: "Parse the dots for the 2026 path; keep dry powder until the higher-for-longer message is clear." },
  { id: "x4", ind: "energy", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Energy tracks oil into quarter-end; Hormuz headline risk two-sided", tickers: "XOM · CVX · USO",
    rec: "Trade the risk premium with trailing stops; a de-escalation unwinds the geopolitical bid fast." },
  { id: "x5", ind: "finance", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Quarter-end rebalancing flows into the final week of Q3", tickers: "SPY · QQQ · IWM",
    rec: "Expect month/quarter-end flows; avoid reading too much into low-conviction rebalancing moves." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "AAPL", name: "Apple", rank: 1, spot: "~$316", sentiment: "Bullish",
    catalyst: "iPhone 18 line in stores (~Sep 18); foldable Duo ($1,999) preorders Oct 16; new CEO Ternus",
    iv: "~26% — moderate → owning premium is viable", liq: "Deepest equity chain in the market; penny-wide spreads, huge OI",
    thesis: "Product super-cycle (iPhone 18 + first foldable Duo) with only moderate IV → low crush risk favors owning premium. Spread up for a cheaper, defined-cost version.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$310 call · Oct 16 '26 · ~$12 debit · cost ~$1,200 · Δ≈0.60" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $315 / sell $330 · Oct 16 '26 · ~$6 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$330 call · Sep 25 '26 · ~$2 debit · cost ~$200 · launch-weekend pop" },
    ] },
  { ticker: "DRI", name: "Darden Restaurants", rank: 2, spot: "~$208", sentiment: "Neutral-to-Bullish",
    catalyst: "FQ1 earnings — Thu Sep 17 (before open) · BINARY",
    iv: "Elevated into the print (~±7% implied)", liq: "Liquid large-cap restaurant chain; reasonable spreads",
    thesis: "Analyst PT hikes set a high bar into a binary with rich IV → prefer defined-risk that sells premium below support; spread up for cheap upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $200 / buy $190 · Oct 16 '26 · ~$3 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $210 / sell $220 · Sep 18 '26 · ~$4 net debit · cost/max loss ~$400" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$215 call · Sep 18 '26 · ~$2 debit · cost ~$200 · earnings pop" },
    ] },
  { ticker: "JPM", name: "JPMorgan Chase", rank: 3, spot: "~$357", sentiment: "Bullish",
    catalyst: "FOMC Sep 16 — asset-sensitive NII beneficiary if Warsh hikes",
    iv: "Low-moderate (~22%) — cheap for a macro binary", liq: "Deep money-center bank chain; tight spreads",
    thesis: "A hawkish/hiking Fed lifts bank NII and JPM sits near highs with cheap IV → own defined upside, or get paid to buy a dip via a credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $350 / sell $370 · Oct 16 '26 · ~$9 net debit · cost/max loss ~$900" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $350 / buy $340 · Sep 25 '26 · ~$3 credit · max loss/capital ~$700 · paid to buy the dip" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$365 call · Sep 18 '26 · ~$2.50 debit · cost ~$250 · FOMC pop" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 4, spot: "~$166", sentiment: "Bullish (tactical)",
    catalyst: "Hormuz risk premium vs. Iran–Gulf de-escalation talks; weekly EIA prints",
    iv: "Elevated on geopolitics (~28%) — two-sided", liq: "Deep, liquid mega-cap energy chain",
    thesis: "Oil near $100 with a live Hormuz risk premium, but de-escalation headlines cut both ways → keep energy exposure defined-risk on both tails.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $165 / sell $175 · Oct 16 '26 · ~$4 net debit · cost/max loss ~$400" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $160 / buy $150 · Oct 16 '26 · ~$3 credit · max loss/capital ~$700 · paid to accumulate" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$172.50 call · Sep 25 '26 · ~$1.80 debit · cost ~$180 · supply-shock upside" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 5, spot: "~$218", sentiment: "Neutral",
    catalyst: "No earnings in window — macro-driven: FOMC Sep 16 + AI-sentiment reset (SOX bear market)",
    iv: "Elevated (bear-market vol, ~45%) → sell premium", liq: "Most liquid single-stock options in the market",
    thesis: "SOX in a bear market plus a binary FOMC → range-bound risk with rich IV favors selling defined-risk premium over picking a direction.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $200 / buy $190 · Oct 16 '26 · ~$3 credit · max loss/capital ~$700 · paid to buy the dip" },
      { profile: "Moderate",     strategy: "Iron Condor", text: "Sell $200p/$240c, buy $190p/$250c · Sep 25 '26 · ~$3 credit · max loss/capital ~$700" },
      { profile: "Aggressive",   strategy: "Bear Put Debit Spread", text: "Buy $210 / sell $195 · Sep 18 '26 · ~$5 net debit · cost/max loss ~$500 · FOMC-hike hedge" },
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
// today line sits on the boundary between Sep 13 and Sep 14
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Sunday, Sep 13 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Sep 13)
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
