import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Thursday, September 10, 2026 (live-researched).
 * Window: last 3 days (Sep 7) → coming 2 weeks (Sep 24).
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

// 18-day axis: Sep 7 .. Sep 24 (last 3 days → coming 2 weeks). Today = index 3 (Sep 10).
const DAYS = [
  { idx: 0, date: "Sep 7", dow: "Mon" }, // Labor Day (mkt closed)
  { idx: 1, date: "Sep 8", dow: "Tue" },
  { idx: 2, date: "Sep 9", dow: "Wed" },
  { idx: 3, date: "Sep 10", dow: "Thu" }, // TODAY
  { idx: 4, date: "Sep 11", dow: "Fri" },
  { idx: 5, date: "Sep 12", dow: "Sat" },
  { idx: 6, date: "Sep 13", dow: "Sun" },
  { idx: 7, date: "Sep 14", dow: "Mon" },
  { idx: 8, date: "Sep 15", dow: "Tue" },
  { idx: 9, date: "Sep 16", dow: "Wed" },
  { idx: 10, date: "Sep 17", dow: "Thu" },
  { idx: 11, date: "Sep 18", dow: "Fri" },
  { idx: 12, date: "Sep 19", dow: "Sat" },
  { idx: 13, date: "Sep 20", dow: "Sun" },
  { idx: 14, date: "Sep 21", dow: "Mon" },
  { idx: 15, date: "Sep 22", dow: "Tue" },
  { idx: 16, date: "Sep 23", dow: "Wed" },
  { idx: 17, date: "Sep 24", dow: "Thu" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "Apple 'Surprise and shine' event: iPhone 18 Pro, foldable iPhone Ultra, new CEO", tickers: "AAPL",
    rec: "Classic sell-the-news setup — wait for pre-order/lead-time data before adding; foldable is the wildcard." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "AVGO down ~26% from highs despite +221% AI-chip growth; buy-the-selloff debate rages", tickers: "AVGO · NVDA · AMD",
    rec: "Use the AI-sentiment reset to scale into quality (AVGO/NVDA) on defined risk — the growth is real, the multiple reset isn't." },
  { id: "t3", ind: "tech", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "Oracle FQ1'27 earnings tonight (after close) — ~11.5% implied move; $638B backlog vs $40B capex raise", tickers: "ORCL",
    rec: "Binary — use DEFINED-RISK only. Strong OCI/RPO re-rates AI-infra; a capex/margin scare deepens the selloff." },
  { id: "t4", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through post-ORCL collides with triple-witching pin on mega-cap tech", tickers: "NVDA · AVGO · ORCL",
    rec: "Let the dust settle; re-add on confirmation of capex strength, not the first witching-day bounce." },
  { id: "t5", ind: "tech", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Pre-Micron (Sep 30) positioning — memory-cycle tell for the AI-hardware trade", tickers: "MU · NVDA",
    rec: "Watch HBM commentary; a strong MU pre-announcement tone supports the whole AI-hardware complex." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Oil surges as US–Iran strikes intensify; Strait of Hormuz trade near standstill", tickers: "XOM · CVX · COP",
    rec: "Keep core E&P as a supply-shock/geopolitical hedge; use trailing stops — a ceasefire unwinds it fast." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Brent tops $100 (first since 2022), WTI ~$96; energy the ONLY green S&P sector", tickers: "XOM · CVX · USO",
    rec: "Momentum + supply shock favor integrated majors; don't chase spikes — scale on pullbacks with stops." },
  { id: "e3", ind: "energy", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status (holiday-delayed) — inventories vs a Hormuz risk premium", tickers: "USO · XOM · CVX",
    rec: "Geopolitics dominates fundamentals now; use inventory prints only to time entries, not to fade the bid." },
  { id: "e4", ind: "energy", dayIdx: 9, future: true, impact: 2, dir: "BULLISH",
    headline: "Hormuz risk premium persists into FOMC; gasoline ~$4.15/gal stokes headline inflation", tickers: "XOM · CVX · OXY",
    rec: "Tactical energy overweight as inflation/geopolitical insurance; a de-escalation is the key reversal risk." },
  { id: "e5", ind: "energy", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "EIA inventories — watch for demand destruction as $4+ gas bites", tickers: "USO · XOM",
    rec: "A build + softening demand at $4+ gas would be the first crack in the bull case; keep stops tight." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 7, future: true, impact: 2, dir: "BULLISH",
    headline: "Morgan Stanley 24th Global Healthcare Conf opens; Lilly presents (GLP-1 momentum, raised '26 guide $85–87B)", tickers: "LLY · NVO",
    rec: "Constructive for LLY as a defensive-growth port in a risk-off tape; expect conference-driven volatility, size before headlines." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 1, dir: "BULLISH",
    headline: "Lilly M&A spree (Atai/Beckley, Centessa, Curevo) broadens pipeline beyond GLP-1", tickers: "LLY",
    rec: "Long-term positive diversification; hold LLY for the franchise, don't trade the deal headlines." },
  { id: "h3", ind: "health", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "FDA decision on zidesamtinib (ROS1+ NSCLC) — small-cap oncology binary", tickers: "NUVL",
    rec: "Pure regulatory binary — size SMALL or stay out; approval re-rates the franchise, a CRL is brutal." },
  { id: "h4", ind: "health", dayIdx: 8, future: true, impact: 1, dir: "BEARISH",
    headline: "Managed-care overhang: higher-for-longer rates + medical-cost trend weigh on MCOs", tickers: "UNH · HUM · CVS",
    rec: "Stay cautious / underweight managed care until cost-trend and rate clarity improve." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "10Y yield hits 4.83% (highest since Oct '23) on Treasury buyback-triple plan; banks & tape pressured", tickers: "JPM · BAC · TLT",
    rec: "Rising long yields + risk-off hit financials broadly; favor asset-sensitive JPM/BAC, avoid long-duration TLT." },
  { id: "f2", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "August CPI (8:30 ET) — the print that sets FOMC odds; market pricing ~58% HIKE", tickers: "SPY · JPM · BAC",
    rec: "The window's biggest swing risk alongside FOMC; keep dry powder, avoid new size until after the print." },
  { id: "f3", ind: "finance", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (2pm ET) — oil-driven inflation vs slowing growth; a HIKE is genuinely on the table", tickers: "JPM · BAC · SPY · TLT",
    rec: "Biggest macro swing in the window; a hawkish hike helps bank NII but hits the broad tape — keep powder dry into the dots & presser." },
  { id: "f4", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Rate-HIKE odds jump to ~58%; JPM's Kelly still sees no '26 hike — the two sides are badly split", tickers: "JPM · BAC · V",
    rec: "Position higher-for-longer: asset-sensitive banks win, but avoid adding rate-duration before the FOMC." },
  { id: "f5", ind: "finance", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Quarterly triple witching + S&P 500 rebalance (Sep 18) — elevated volume & pin risk", tickers: "SPY · QQQ · IWM",
    rec: "Expect 2–3x volume and pinning; avoid initiating new size into the close, watch rebalance flows." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "FedEx FQ1'27 earnings (after close) — global-shipping demand read + tariff/fuel-cost tell", tickers: "FDX",
    rec: "Freight bellwether & binary — defined risk only; watch B2B volumes and the DRIVE cost-out program." },
  { id: "c2", ind: "consumer", dayIdx: 4, future: true, impact: 2, dir: "BEARISH",
    headline: "Gasoline ~$4.15/gal + higher rates squeeze the consumer wallet into the holiday season", tickers: "AMZN · WMT · TGT",
    rec: "Headwind for discretionary; tilt to staples/value (WMT) over discretionary until energy prices cool." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 1, dir: "BEARISH",
    headline: "US–Canada trade dispute escalates — fresh tariff risk for retail & autos", tickers: "F · GM · WMT",
    rec: "Watch supply-chain/tariff exposure; avoid names most reliant on cross-border sourcing until it de-escalates." },
  { id: "c4", ind: "consumer", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Early holiday-promo positioning as squeezed consumers trade down", tickers: "WMT · AMZN · TGT",
    rec: "Constructive for value/scale retail (WMT/AMZN); use promo cadence to gauge margin vs traffic trade-offs." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "ORCL", name: "Oracle", rank: 1, spot: "~$162", sentiment: "Bullish",
    catalyst: "FQ1'27 earnings — TONIGHT Sep 10 (after close) · BINARY",
    iv: "IVR ~67 — RICH (~11.5% implied move)", liq: "Deep, very active AI-infrastructure chain; penny-wide spreads",
    thesis: "Bullish into a binary with expensive IV → avoid naked long calls (max crush). Cut vega with a debit spread, or get PAID via a defined-risk put-credit spread that harvests the post-print IV collapse.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $160 / sell $175 · Oct 16 '26 · ~$6.00 net debit · cost/max loss ~$600 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $150 / buy $140 · Sep 18 '26 · ~$3.00 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$175 call · Sep 18 '26 · ~$3.00 debit · cost ~$300 · pure post-print pop (crush risk)" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 2, spot: "~$157", sentiment: "Bullish",
    catalyst: "Oil supply shock — Brent >$100, Hormuz standstill; energy the only green sector",
    iv: "Elevated on geopolitics (~30%)", liq: "Deep, liquid mega-cap energy chain",
    thesis: "Momentum + a genuine supply shock, but headline-driven (a ceasefire reverses it). Cut vega with a debit spread; get paid to hold the bid via a put-credit spread; cheap OTM call for a further Hormuz spike.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $155 / sell $165 · Oct 16 '26 · ~$4.50 net debit · cost/max loss ~$450" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $150 / buy $142 · Oct 16 '26 · ~$2.20 credit · max loss/capital ~$580 · paid to hold the supply-shock bid" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$165 call · Oct 16 '26 · ~$3.00 debit · cost ~$300 · plays a further Hormuz spike" },
    ] },
  { ticker: "AVGO", name: "Broadcom", rank: 3, spot: "~$366", sentiment: "Bullish (contrarian)",
    catalyst: "Oversold ~26% off highs despite +221% AI-chip growth; ex-div Sep 21",
    iv: "Elevated post-earnings but normalizing (~40%)", liq: "Deep, very liquid mega-cap semi chain",
    thesis: "Post-earnings selloff overshot a strong AI print → contrarian bullish. Debit spread cuts vega; a put-credit spread gets paid to buy the reset; an OTM call plays an AI-capex re-rate.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $360 / sell $380 · Oct 16 '26 · ~$9.00 net debit · cost/max loss ~$900" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $350 / buy $340 · Oct 16 '26 · ~$3.80 credit · max loss/capital ~$620 · paid to buy the AI-selloff" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$385 call · Oct 16 '26 · ~$7.00 debit · cost ~$700 · AI-capex re-rate lottery" },
    ] },
  { ticker: "FDX", name: "FedEx", rank: 4, spot: "~$310", sentiment: "Bullish",
    catalyst: "FQ1'27 earnings — Thu Sep 17 (after close) · BINARY",
    iv: "Elevated into earnings (~35%)", liq: "Deep, liquid large-cap chain",
    thesis: "Freight bellwether into a binary print with a running cost-out program. Defined risk both ways: debit spread for upside, put-credit spread to harvest the post-earnings crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $300 / sell $320 · Oct 16 '26 · ~$8.00 net debit · cost/max loss ~$800" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $295 / buy $285 · Sep 18 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests post-earnings crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$320 call · Sep 18 '26 · ~$3.00 debit · cost ~$300 · earnings-pop lottery" },
    ] },
  { ticker: "JPM", name: "JPMorgan Chase", rank: 5, spot: "~$355", sentiment: "Neutral",
    catalyst: "FOMC decision — Wed Sep 16 (2pm ET); ~58% HIKE odds · BINARY",
    iv: "Elevated into FOMC (~28%)", liq: "Deepest bank chain; tight spreads, huge OI",
    thesis: "Two-sided macro binary: a hawkish hike helps NII but a yield spike + risk-off hits the tape. Range-tolerant, defined-risk structures fit best — sell elevated FOMC premium, keep a small directional tilt.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $340 / buy $330 · Oct 16 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish, range-tolerant (NII beneficiary)" },
      { profile: "Moderate",     strategy: "Iron Condor", text: "Sell $370c/$380c + $335p/$325p · Oct 16 '26 · ~$3.50 credit · max loss/capital ~$650 · range-bound through FOMC" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $355 / sell $370 · Sep 18 '26 · ~$5.00 net debit · cost/max loss ~$500 · plays a hawkish-hike, banks-win pop" },
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
// today line sits on the boundary between Sep 10 and Sep 11
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Thursday, Sep 10 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Sep 10)
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
