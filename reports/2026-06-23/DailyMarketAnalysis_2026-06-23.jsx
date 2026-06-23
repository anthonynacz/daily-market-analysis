import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Tuesday, June 23, 2026 (live-researched).
 * Window: last 3 days (Jun 20) → coming 2 weeks (Jul 7).
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

// 18-day axis: Jun 20 .. Jul 7 (last 3 days → coming 2 weeks). Today = index 3 (Jun 23).
const DAYS = [
  { idx: 0, date: "Jun 20", dow: "Sat" },
  { idx: 1, date: "Jun 21", dow: "Sun" },
  { idx: 2, date: "Jun 22", dow: "Mon" },
  { idx: 3, date: "Jun 23", dow: "Tue" }, // TODAY
  { idx: 4, date: "Jun 24", dow: "Wed" },
  { idx: 5, date: "Jun 25", dow: "Thu" },
  { idx: 6, date: "Jun 26", dow: "Fri" },
  { idx: 7, date: "Jun 27", dow: "Sat" },
  { idx: 8, date: "Jun 28", dow: "Sun" },
  { idx: 9, date: "Jun 29", dow: "Mon" },
  { idx: 10, date: "Jun 30", dow: "Tue" },
  { idx: 11, date: "Jul 1", dow: "Wed" },
  { idx: 12, date: "Jul 2", dow: "Thu" },
  { idx: 13, date: "Jul 3", dow: "Fri" },
  { idx: 14, date: "Jul 4", dow: "Sat" },
  { idx: 15, date: "Jul 5", dow: "Sun" },
  { idx: 16, date: "Jul 6", dow: "Mon" },
  { idx: 17, date: "Jul 7", dow: "Tue" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Micron–Anthropic strategic AI-memory deal; MU hits record high (+5–7%)", tickers: "MU · NVDA",
    rec: "Don't chase a +40%/2-week melt-up into the print; wait for Jun 24 to confirm the HBM supercycle." },
  { id: "t2", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Chip sector extends rebound off the early-June crash on AI refocus", tickers: "NVDA · SOXX · MU",
    rec: "Add quality (NVDA) on dips; positioning is stretched — scale in rather than chase." },
  { id: "t3", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Micron FQ3 earnings (AMC) — HBM-supercycle test; the bar is high", tickers: "MU · WDC · SNDK",
    rec: "Wait for the print; +300% YTD means good news may be priced in — a clean beat re-rates memory, a soft guide unwinds it." },
  { id: "t4", ind: "tech", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "NVIDIA annual shareholder meeting — Blackwell / Vera-Rubin ramp watch", tickers: "NVDA",
    rec: "Soft catalyst; hold core NVDA, don't trade the meeting headlines." },
  { id: "t5", ind: "tech", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "May core PCE (8:30 ET) — hot-inflation risk for high-multiple chips", tickers: "NVDA · AMD · AVGO",
    rec: "De-risk slightly pre-print; a hot number pressures richly-valued semis via the higher-for-longer Fed." },
  { id: "t6", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "BULLISH",
    headline: "TSMC June / Q2 monthly revenue — AI/HPC demand proxy", tickers: "TSM · NVDA · AVGO",
    rec: "Strong monthly sales support the AI-infra trade; use as confirmation to add, not a reason to chase." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "WTI falls to ~$74 (3-mo low) on US 60-day Iran sanctions waiver", tickers: "XOM · CVX · USO",
    rec: "Trim crude-levered E&P into the de-escalation; the war risk premium is unwinding." },
  { id: "e2", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Hormuz traffic normalizes; IEA warns of 2027 oversupply", tickers: "XLE · OXY · COP",
    rec: "Underweight broad energy; returning Iranian barrels cap rallies — keep a small upside hedge for a roadmap collapse." },
  { id: "e3", ind: "energy", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (10:30 ET)", tickers: "USO · XOM · CVX",
    rec: "Trade inventory prints with tight stops; a big build accelerates the downside." },
  { id: "e4", ind: "energy", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum report — crude/gasoline inventories", tickers: "USO · XLE",
    rec: "Watch builds vs. consensus as Iranian supply ramps back into the market." },
  { id: "e5", ind: "energy", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "OPEC+ output decision for August (early-July; date est.)", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut new directional bets into the meeting; another hike is bearish crude, a pause is a relief bounce." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "TrumpRx expansion (>800 drugs) pressures branded pharma", tickers: "PFE · LLY · NVO",
    rec: "Stay cautious on branded pharma; the pricing overhang persists — favor names with clean near-term catalysts." },
  { id: "h2", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Viking (VKTX) +6.5% on CMO hire; oral GLP-1 momentum builds", tickers: "VKTX · XBI",
    rec: "High-beta obesity name — size small; let Phase 3 data, not headlines, drive the position." },
  { id: "h3", ind: "health", dayIdx: 10, future: true, impact: 3, dir: "BULLISH",
    headline: "Ionis olezarsen (TRYNGOLZA) sHTG PDUFA decision", tickers: "IONS",
    rec: "Label-expansion binary; defined-risk only — approval extends the franchise, a delay stings." },
  { id: "h4", ind: "health", dayIdx: 17, future: true, impact: 3, dir: "BULLISH",
    headline: "Vera atacicept IgA-nephropathy PDUFA — headline binary of the window", tickers: "VERA",
    rec: "Date-certain catalyst; use defined-risk structures — approval re-rates VERA, a CRL is a sharp drawdown." },
  { id: "h5", ind: "health", dayIdx: 1, future: false, impact: 1, dir: "MIXED",
    headline: "Medicare Advantage denial-rate scrutiny vs. 2027 rate tailwind", tickers: "UNH · HUM · CVS",
    rec: "Balanced setup; the ~3% 2027 rate cushions margins but headline risk remains — hold, don't add aggressively." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "BofA sees 3 Fed hikes in 2026; 2Y >4.2%, 10Y ~4.5% post-hawkish Warsh", tickers: "JPM · BAC · WFC · GS",
    rec: "Favor asset-sensitive banks (JPM/BAC) for the NIM tailwind; avoid long-duration as yields climb." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Hawkish Fed repricing hits high-multiple growth (Nasdaq −1.3%)", tickers: "QQQ · NVDA · META",
    rec: "Rotate toward value / financials over long-duration tech until the rate path settles." },
  { id: "f3", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Deregulation seen freeing ~$140B bank capital; XLF outperforming", tickers: "XLF · JPM · GS · MS",
    rec: "Constructive for big banks; hold core financials into the stress-test capital-return updates." },
  { id: "f4", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "BULLISH",
    headline: "Fed 2026 bank stress-test results (4pm ET) — capital-return setups", tickers: "JPM · BAC · WFC · GS · MS",
    rec: "Expect passes + dividend/buyback updates within days; own quality banks into the announcements." },
  { id: "f5", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "May core PCE (8:30 ET) — first big inflation tell post-FOMC", tickers: "JPM · BAC · V · MA",
    rec: "Biggest macro swing of the week; a hot print cements the hike path — bullish bank NIM, bearish the broad tape." },
  { id: "f6", ind: "finance", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "June jobs report (pulled to Thu ahead of Jul 4)", tickers: "SPY · XLF · TLT",
    rec: "Keep dry powder; a strong number accelerates hikes and steepens the rate-sensitive trades." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Amazon Prime Day kicks off (Jun 23–26); WMT/TGT counter-sales", tickers: "AMZN · WMT · TGT",
    rec: "Constructive for AMZN/WMT traffic into July 4; hold and watch the discretionary read-through." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Nike at a 12-year low (~$43) into Jun 30 earnings; China/tariff drag", tickers: "NKE",
    rec: "Don't catch the knife pre-print; a 'better-than-feared' guide is the only near-term bull case." },
  { id: "c3", ind: "consumer", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Nike Q4 FY26 earnings (AMC) — FY27 guide is the swing factor", tickers: "NKE · FL · DKS",
    rec: "Binary with rich IV; use defined-risk — an oversold setup can pop on any guide stabilization." },
  { id: "c4", ind: "consumer", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Conference Board Consumer Confidence (June)", tickers: "XLY · AMZN · WMT",
    rec: "Gauge of discretionary health; a soft print pressures retail into the holiday week." },
  { id: "c5", ind: "consumer", dayIdx: 12, future: true, impact: 1, dir: "MIXED",
    headline: "Levi Strauss Q2 earnings + Tesla Q2 deliveries (early July)", tickers: "LEVI · TSLA · F · GM",
    rec: "Apparel read-through (LEVI) and auto demand (TSLA deliveries); trade the reactions, don't pre-position." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "JPM", name: "JPMorgan Chase", rank: 1, spot: "~$330", sentiment: "Bullish",
    catalyst: "Bank stress tests Wed Jun 24 (4pm ET) → capital-return updates; Q2 earnings ~Jul 14",
    iv: "Low-to-moderate now; builds into the Jul 14 print", liq: "Among the most liquid financial chains; tight spreads, deep weeklies + monthlies",
    thesis: "Hawkish Warsh Fed = higher-for-longer rates → NIM tailwind for the most rate-sensitive money-center bank; deregulation frees ~$140B capital; stock near 52-wk highs as Big Tech sells off. IV still cheap → spread up.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $325 / sell $345 · Jul 17 '26 · ~$8 net debit · cost/max loss ~$800" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $320 / buy $310 · Jul 17 '26 · ~$3 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$340 call · Jul 2 '26 · ~$2.50 debit · cost ~$250 · stress-test + jobs pop" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 2, spot: "~$208", sentiment: "Bullish",
    catalyst: "AGM Jun 24 + Micron read-through; no own earnings until late Aug (no binary in window)",
    iv: "Moderate — elevated realized vol, but no earnings premium", liq: "Deepest options chain in the market; penny-wide spreads, massive OI",
    thesis: "Rebounding off the early-June AVGO-driven crash with index-flow tailwinds and AI fundamentals refocus. No binary event → buy directional exposure without paying an earnings-IV premium; spread up to cut cost.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$200 call · Jul 17 '26 · ~$14 debit · cost ~$1,400 · Δ≈0.65" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $210 / sell $225 · Jul 17 '26 · ~$6 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$220 call · Jul 2 '26 · ~$2.50 debit · cost ~$250 · momentum continuation" },
    ] },
  { ticker: "NKE", name: "Nike", rank: 3, spot: "~$43", sentiment: "Bullish (contrarian)",
    catalyst: "Q4 FY26 earnings — Tue Jun 30 (after close) · BINARY",
    iv: "~54% (rich, ±~9–11% implied) on a beaten-down stock", liq: "Deep mega-cap chain; low-dollar premiums, tight spreads",
    thesis: "Max-pessimism turnaround at a 12-yr low, −30% YTD, with rich IV into a binary. Bullish + high IV → get paid via a defined-risk put-credit spread; cut vega with a debit spread; cheap call for the asymmetric pop.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $42 / buy $38 · Jul 17 '26 · ~$1.30 credit · max loss/capital ~$270 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $43 / sell $48 · Jul 17 '26 · ~$2 net debit · cost/max loss ~$200 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$46 call · Jul 2 '26 · ~$1.20 debit · cost ~$120 · pure earnings pop" },
    ] },
  { ticker: "VERA", name: "Vera Therapeutics", rank: 4, spot: "~$35", sentiment: "Bullish (binary)",
    catalyst: "Atacicept IgA-nephropathy PDUFA — Tue Jul 7 · HARD BINARY",
    iv: "Very high into the PDUFA; severe post-event crush expected", liq: "Moderate (small-cap biotech) — use limit orders, size small",
    thesis: "Breakthrough-designated, ORIGIN Phase 3 hit its primary endpoint, launch infra built; consensus 'Strong Buy.' A date-certain binary with rich IV → DEFINED-RISK ONLY; a CRL is a total-premium loss, so spreads cap the damage.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $35 / sell $45 · Jul 17 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $32.50 / buy $27.50 · Jul 17 '26 · ~$1.50 credit · max loss/capital ~$350 · harvests IV crush on approval" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$40 call · Jul 17 '26 · ~$2 debit · cost ~$200 · lottery on approval" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 5, spot: "~$138", sentiment: "Bearish-to-Neutral",
    catalyst: "EIA inventories (Jun 24, Jul 1) + early-July OPEC+ output decision",
    iv: "Elevated but falling as the war premium unwinds (post-event crush)", liq: "Deep, liquid mega-cap chain; tight spreads",
    thesis: "Iran de-escalation + 60-day sanctions waiver + IEA 2027-oversupply warning cap energy; XOM is resilient but downside risk grows as Iranian barrels ramp. Falling IV → defined-risk debit/credit spreads over naked premium; two-way risk if the roadmap collapses.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $145 / buy $150 · Jul 17 '26 · ~$1.50 credit · max loss/capital ~$350 · profits if XOM stays below $145" },
      { profile: "Moderate",     strategy: "Bear Put Debit Spread", text: "Buy $138 / sell $128 · Jul 17 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Aggressive",   strategy: "Long Put (OTM)", text: "$130 put · Jul 2 '26 · ~$1.20 debit · cost ~$120 · plays an EIA/OPEC+ downside break" },
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
// today line sits on the boundary between Jun 23 and Jun 24
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Tuesday, Jun 23 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jun 23)
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
