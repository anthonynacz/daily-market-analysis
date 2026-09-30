import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Wednesday, September 30, 2026 (live-researched).
 * Window: last 3 days (Sep 27) → coming 2 weeks (Oct 14).
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

// 18-day axis: Sep 27 .. Oct 14 (last 3 days → coming 2 weeks). Today = index 3 (Sep 30).
const DAYS = [
  { idx: 0, date: "Sep 27", dow: "Sun" },
  { idx: 1, date: "Sep 28", dow: "Mon" },
  { idx: 2, date: "Sep 29", dow: "Tue" },
  { idx: 3, date: "Sep 30", dow: "Wed" }, // TODAY
  { idx: 4, date: "Oct 1", dow: "Thu" },
  { idx: 5, date: "Oct 2", dow: "Fri" },
  { idx: 6, date: "Oct 3", dow: "Sat" },
  { idx: 7, date: "Oct 4", dow: "Sun" },
  { idx: 8, date: "Oct 5", dow: "Mon" },
  { idx: 9, date: "Oct 6", dow: "Tue" },
  { idx: 10, date: "Oct 7", dow: "Wed" },
  { idx: 11, date: "Oct 8", dow: "Thu" },
  { idx: 12, date: "Oct 9", dow: "Fri" },
  { idx: 13, date: "Oct 10", dow: "Sat" },
  { idx: 14, date: "Oct 11", dow: "Sun" },
  { idx: 15, date: "Oct 12", dow: "Mon" },
  { idx: 16, date: "Oct 13", dow: "Tue" },
  { idx: 17, date: "Oct 14", dow: "Wed" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Meta +13% on 'Muse' AI agent debut", tickers: "META",
    rec: "Don't chase a 13% pop; wait for a pullback or use a defined-risk spread — the AI-agent story is real but priced in fast." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Nvidia lifts buyback by $150B ($235B total authorized); NVDA +1.7%", tickers: "NVDA",
    rec: "Constructive — the buyback backstops dips; add on weakness rather than chase the headline." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "AI names lead indices lower — AMD −3.6%, MU −2.6%", tickers: "AMD · MU · NVDA",
    rec: "Hold quality (NVDA); use AI-sentiment wobbles to scale into leaders, don't buy the whole complex." },
  { id: "t4", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Apple −2.7% as product-overhaul / AI risks resurface; $330 in play", tickers: "AAPL",
    rec: "Watch the $330 line; a hold sets up the product-cycle trade, a break invites more downside." },
  { id: "t5", ind: "tech", dayIdx: 7, future: true, impact: 1, dir: "MIXED",
    headline: "AI-safety headlines — OpenAI halts a release; Anthropic files prospectus", tickers: "MSFT · GOOGL · NVDA",
    rec: "Noise, not a fundamentals shift; don't trade the headlines — watch for capex-guide read-through only." },
  { id: "t6", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Semi read-through builds pre ASML/TSMC prints (Oct 14–15)", tickers: "TSM · NVDA · AMAT",
    rec: "Let the reports set the tone; strong AI-capex commentary re-rates the group, a soft guide caps it." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Bloom Energy +10.8% on analyst target hikes & new Fremont plant", tickers: "BE",
    rec: "Momentum name — don't chase a double-digit pop; size small or wait for consolidation." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Alliant Energy +7.6% on AI-data-center power demand + capex plan", tickers: "LNT · VST · CEG",
    rec: "The power-for-AI theme has legs; favor regulated utilities & IPPs with data-center pipelines on dips." },
  { id: "e3", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status (Wed); WTI hovering low-$90s", tickers: "XOM · CVX · USO",
    rec: "Use the inventory print to time entries; keep core E&P exposure while crude stays elevated." },
  { id: "e4", ind: "energy", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "OPEC+ ministerial (Sun Oct 4) — October output decision; rollover expected", tickers: "XOM · CVX · OXY · USO",
    rec: "Trim new directional bets into Sunday; a surprise hike is bearish crude, a hold/rollover is bullish." },
  { id: "e5", ind: "energy", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories resume (Wed Oct 7) post-OPEC+", tickers: "XOM · CVX · USO",
    rec: "Watch the draw vs. consensus; a tight print alongside a rollover reinforces the bull case for E&P." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Moderna −6.9% after Citi cuts to 'Sell' (PT to $80)", tickers: "MRNA",
    rec: "Avoid the falling knife; no vaccine-pipeline catalyst until data — stay sidelined until it bases." },
  { id: "h2", ind: "health", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "GLP-1 complex churns on pricing & competition chatter", tickers: "LLY · NVO · VKTX",
    rec: "Favor LLY on execution; fade knee-jerk NVO moves — this is noise until the next trial/label update." },
  { id: "h3", ind: "health", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Biotech catalyst watch — FDA PDUFA / AdCom dates cluster in early Oct", tickers: "XBI · biotech",
    rec: "Size binaries small; a single approval can move a name 20–40% — trade with defined risk only." },
  { id: "h4", ind: "health", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "UnitedHealth Q3 earnings (Oct 13) — managed-care margin & 2027 rate tell", tickers: "UNH · HUM · CVS",
    rec: "Wait for the print; medical-cost trend and 2027 MA-rate commentary decide the managed-care tape." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "Sept PCE cools more than expected → Oct rate-hike bets fade; futures bounce", tickers: "JPM · BAC · SPY",
    rec: "Constructive for risk & rate-sensitive financials; a cooler Fed path helps — but wait for Fri jobs to confirm." },
  { id: "f2", ind: "finance", dayIdx: 4, future: true, impact: 2, dir: "BULLISH",
    headline: "Government shutdown averted — House passes CR to Dec 11 (370-48)", tickers: "SPY · QQQ · IWM",
    rec: "Removes a near-term tail risk; keeps the Oct 2 jobs report on schedule — mildly risk-positive." },
  { id: "f3", ind: "finance", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing PMI (Oct 1) — first hard October data", tickers: "SPY · industrials",
    rec: "A soft print supports the on-hold Fed narrative; a hot one revives rate-hike worry." },
  { id: "f4", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "September jobs report / NFP (Fri Oct 2, 8:30 ET)", tickers: "JPM · BAC · SPY · TLT",
    rec: "The week's biggest swing; a cool number cements Fed-on-hold, a hot one re-arms the hike trade — keep dry powder." },
  { id: "f5", ind: "finance", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "Big-bank Q3 kickoff — JPM & WFC report (Tue Oct 13)", tickers: "JPM · WFC · GS",
    rec: "Favor NII-beneficiary banks into the print; NIM guidance & credit-reserve commentary set the sector tone." },
  { id: "f6", ind: "finance", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "September CPI (Wed Oct 14, 8:30 ET) + BofA earnings", tickers: "BAC · JPM · SPY",
    rec: "Biggest macro print of the window; a benign CPI extends the relief rally, a hot one hits multiples." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Carnival +13.4% on Q3 beat + completed $1.2B buyback", tickers: "CCL · RCL · NCLH",
    rec: "Cruise demand strong; take partial profits into a 13% pop rather than chase — watch RCL/NCLH read-through." },
  { id: "c2", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Nike languishes near a 12-year low (~$36) into its Oct 1 print", tickers: "NKE",
    rec: "Don't catch the knife pre-earnings; wait for the report — turnaround skepticism is deep and warranted." },
  { id: "c3", ind: "consumer", dayIdx: 4, future: true, impact: 3, dir: "BEARISH",
    headline: "Nike Q1 FY27 earnings (Thu Oct 1, after close) · BINARY", tickers: "NKE",
    rec: "Defined risk only; weak demand & tariffs argue caution, but max-pessimism positioning can spark a relief bounce." },
  { id: "c4", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "PepsiCo Q3 earnings (Wed Oct 8) — staples volume & pricing check", tickers: "PEP · KO",
    rec: "Watch volume elasticity; a steady staples print is a defensive tell into a data-heavy stretch." },
  { id: "c5", ind: "consumer", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Delta Air Lines Q3 earnings (Thu Oct 9) — travel-demand kickoff", tickers: "DAL · UAL · AAL",
    rec: "Sets the airline tone; premium-travel strength & fuel commentary drive the group — trade the sector, not just DAL." },
  { id: "c6", ind: "consumer", dayIdx: 4, future: true, impact: 1, dir: "BULLISH",
    headline: "Boeing +2% on ~$20B F/A-XX Navy next-gen fighter award (Northrop −3.7%)", tickers: "BA · NOC",
    rec: "Defense-order win is a multi-year positive for BA; NOC loses the program — pair-trade risk, size modestly." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "NVDA", name: "NVIDIA", rank: 1, spot: "~$227", sentiment: "Bullish",
    catalyst: "Fresh $150B buyback lift ($235B total); AI-capex leadership (no earnings until late Nov)",
    iv: "~40% — MODERATE → long premium workable, spread to cut cost",
    liq: "B — deep-liquidity list (NVDA), the most active single-stock chain (>1M contracts/day typical); live chain unavailable via egress, strikes kept ≤6% from spot on standard monthlies",
    thesis: "Bullish momentum with a buyback backstop and no near-term binary → own directional premium; spread up to cheapen it and cap cost.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$220 call · Oct 16 '26 · ~$13.50 debit · cost ~$1,350 · Δ≈0.60" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $230 / sell $245 · Oct 16 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$240 call · Oct 16 '26 · ~$4.50 debit · cost ~$450" },
    ] },
  { ticker: "JPM", name: "JPMorgan Chase", rank: 2, spot: "~$335", sentiment: "Bullish",
    catalyst: "Q3 earnings — Tue Oct 13 (pre-market) · BINARY; leads big-bank season",
    iv: "Elevated into the print (~±4–5% implied)",
    liq: "B — deep-liquidity list (JPM), deep monthly chain; live chain unavailable via egress, strikes kept ≤4% from spot on standard monthlies",
    thesis: "Bullish into a binary with elevated IV → cut vega with a debit spread, or get paid to be bullish via a defined-risk put-credit spread that harvests the post-print IV crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $345 · Nov 20 '26 · ~$7.00 net debit · cost/max loss ~$700 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $325 / buy $315 · Oct 16 '26 · ~$3.00 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $335 / sell $350 · Oct 16 '26 · ~$5.50 net debit · cost/max loss ~$550 · earnings pop" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 3, spot: "~$163", sentiment: "Bullish",
    catalyst: "OPEC+ ministerial (Oct 4, rollover expected) + EIA inventories; WTI in the low-$90s",
    iv: "~28% — MODERATE",
    liq: "B — deep-liquidity list (XOM), liquid $2.50-wide chain; live chain unavailable via egress, strikes kept ≤8% from spot on standard monthlies",
    thesis: "Bullish on a firm-crude backdrop with an OPEC+ rollout catalyst → own defined-risk upside; sell a put spread below support to get paid to hold the supply bid.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$155 call · Nov 20 '26 · ~$10.00 debit · cost ~$1,000 · Δ≈0.65" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $160 / sell $170 · Nov 20 '26 · ~$4.50 net debit · cost/max loss ~$450" },
      { profile: "Aggressive",   strategy: "Put Credit Spread", text: "Sell $157.5 / buy $150 · Oct 16 '26 · ~$2.20 credit · max loss/capital ~$530 · paid to hold" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 4, spot: "~$329", sentiment: "Bullish",
    catalyst: "Product-overhaul / AI acceleration plans; $330 technical test (earnings late Oct, out of window)",
    iv: "~26% — MODERATE → long premium favored",
    liq: "B — deep-liquidity list (AAPL), the deepest equity chain in the market; live chain unavailable via egress, strikes kept ≤4% from spot on standard monthlies",
    thesis: "Bullish product-cycle setup with moderate IV and no near-term binary → buy directional premium; spread up for a cheaper defined-cost version.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$325 call · Oct 16 '26 · ~$11.00 debit · cost ~$1,100 · Δ≈0.55" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $345 · Nov 20 '26 · ~$6.50 net debit · cost/max loss ~$650" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$340 call · Oct 16 '26 · ~$3.50 debit · cost ~$350" },
    ] },
  { ticker: "QQQ", name: "Invesco QQQ (Nasdaq-100)", rank: 5, spot: "~$737", sentiment: "Neutral",
    catalyst: "Macro cluster — jobs (Oct 2) & CPI (Oct 14); range-bound into the data",
    iv: "Moderate; event premium in the front weeks",
    liq: "B — deep-liquidity list (QQQ), one of the most liquid options in the world (>1M contracts/day); live chain unavailable via egress, strikes kept within ~3% of spot on standard monthlies",
    thesis: "Two-sided macro risk with no clear directional edge → sell defined-risk premium and let theta work; a condor caps loss on either tail while the data resolves.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $770c/buy $780c & sell $705p/buy $695p · Oct 16 '26 · ~$3.00 credit · max loss/capital ~$700" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $715 / buy $705 · Oct 16 '26 · ~$3.20 credit · max loss/capital ~$680 · mild upward lean" },
      { profile: "Aggressive",   strategy: "Bear Call Credit Spread", text: "Sell $755 / buy $765 · Oct 16 '26 · ~$3.00 credit · max loss/capital ~$700 · fades a CPI-driven pullback" },
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
// today line sits on the boundary between Sep 30 and Oct 1
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Wednesday, Sep 30 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Sep 30)
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
