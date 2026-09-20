import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Sunday, September 20, 2026 (live-researched).
 * Window: last 3 days (Sep 17) → coming 2 weeks (Oct 4).
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

// 18-day axis: Sep 17 .. Oct 4 (last 3 days → coming 2 weeks). Today = index 3 (Sep 20).
const DAYS = [
  { idx: 0, date: "Sep 17", dow: "Thu" },
  { idx: 1, date: "Sep 18", dow: "Fri" },
  { idx: 2, date: "Sep 19", dow: "Sat" },
  { idx: 3, date: "Sep 20", dow: "Sun" }, // TODAY
  { idx: 4, date: "Sep 21", dow: "Mon" },
  { idx: 5, date: "Sep 22", dow: "Tue" },
  { idx: 6, date: "Sep 23", dow: "Wed" },
  { idx: 7, date: "Sep 24", dow: "Thu" },
  { idx: 8, date: "Sep 25", dow: "Fri" },
  { idx: 9, date: "Sep 26", dow: "Sat" },
  { idx: 10, date: "Sep 27", dow: "Sun" },
  { idx: 11, date: "Sep 28", dow: "Mon" },
  { idx: 12, date: "Sep 29", dow: "Tue" },
  { idx: 13, date: "Sep 30", dow: "Wed" },
  { idx: 14, date: "Oct 1", dow: "Thu" },
  { idx: 15, date: "Oct 2", dow: "Fri" },
  { idx: 16, date: "Oct 3", dow: "Sat" },
  { idx: 17, date: "Oct 4", dow: "Sun" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Semis rip a 3rd session: AMD +7%, INTC +7.7%, AVGO +3%, NVDA +2%", tickers: "AMD · INTC · NVDA · AVGO",
    rec: "Leadership has narrowed to chips; don't chase +7% pops — use pullbacks to add quality (NVDA/AMD)." },
  { id: "t2", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "SOXX +3% outpaces QQQ +2% — money rotating into semiconductors", tickers: "SOXX · NVDA · AMD",
    rec: "Ride the rotation with core semis; trim the most extended names into strength." },
  { id: "t3", ind: "tech", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "S&P Global flash PMIs (Sep) — first read on the energy-shock drag", tickers: "NVDA · MSFT · SPY",
    rec: "A soft manufacturing print pressures high-multiple tech; a firm one supports the rotation." },
  { id: "t4", ind: "tech", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Accenture FQ4 earnings (after close) — enterprise AI-spend tell", tickers: "ACN",
    rec: "Bookings & AI backlog guide the IT-services read; wait for the number, don't pre-position." },
  { id: "t5", ind: "tech", dayIdx: 13, future: true, impact: 3, dir: "BULLISH",
    headline: "Micron FQ4 earnings (after close) — AI-memory bellwether · BINARY", tickers: "MU",
    rec: "Tight HBM supply + AI demand favor a beat; size before the print and respect the IV crush." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "WTI slips to ~$63 as Mideast risk premium fades; OPEC+ hike eyed", tickers: "XOM · CVX · USO",
    rec: "Trim E&P beta — softer crude caps upside into the Oct 5 OPEC+ decision." },
  { id: "e2", ind: "energy", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "EIA weekly petroleum status report", tickers: "XOM · CVX · USO",
    rec: "Watch the crude draw vs the ~423M-bbl 5-yr average; inventory-driven, not a trend." },
  { id: "e3", ind: "energy", dayIdx: 8, future: true, impact: 1, dir: "BULLISH",
    headline: "LNG export / heating-season demand tailwind builds", tickers: "LNG · EQT",
    rec: "Be selective — favor LNG exporters and low-cost gas over broad energy beta." },
  { id: "e4", ind: "energy", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "EIA weekly inventories (pre-OPEC+ positioning)", tickers: "XOM · CVX · USO",
    rec: "A positioning read into the Oct 5 meeting; keep size small until the quota is known." },
  { id: "e5", ind: "energy", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "OPEC+ Oct 5 ministerial looms — ~137kbd Nov hike expected", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut new directional crude bets into the decision; a bigger hike is bearish, a pause bullish." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "GLP-1 split widens: Lilly ~60% obesity share as Foundayo pill scales; Novo lags", tickers: "LLY · NVO",
    rec: "Stay long LLY on the oral-obesity lead; fade knee-jerk NVO bounces." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 1, dir: "BULLISH",
    headline: "Healthcare emerges as a defensive outperformer amid higher-for-longer", tickers: "XLV · UNH · JNJ",
    rec: "Add quality defensives as a rate hedge; favor durable cash-flow compounders." },
  { id: "h3", ind: "health", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "CagriSema digestion continues (Novo trial trailed tirzepatide)", tickers: "NVO · LLY",
    rec: "GLP-1 volatility persists; size around headlines, don't chase either leg." },
  { id: "h4", ind: "health", dayIdx: 11, future: true, impact: 1, dir: "BEARISH",
    headline: "Managed-care / drug-pricing headline watch", tickers: "UNH · CVS · HUM",
    rec: "Keep managed care underweight until 2027-rate and policy clarity improve." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "Fed hikes 25bp to 3.75–4.00% (Sep 16) — first hike in 3 yrs; dots see more", tickers: "JPM · BAC · WFC · GS",
    rec: "Favor asset-sensitive banks (NII beneficiaries); avoid adding long-duration / rate-sensitive names." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "MIXED",
    headline: "Yields jump post-hike (10Y ~5%); 'higher-for-longer' repriced", tickers: "JPM · BAC · TLT",
    rec: "Tilt to NII-beneficiary banks; keep portfolio duration light into the data run." },
  { id: "f3", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Quarterly triple witching — elevated volume & pin risk", tickers: "SPY · QQQ · IWM",
    rec: "Don't initiate size into the expiry close; expect mechanical, not fundamental, moves." },
  { id: "f4", ind: "finance", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Final Q2 GDP + weekly jobless claims", tickers: "SPY · XLF",
    rec: "Growth read into jobs week; a resilient print keeps another hike firmly on the table." },
  { id: "f5", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing + JOLTS open Q4", tickers: "SPY · XLF",
    rec: "Watch prices-paid for energy pass-through; set positioning into the jobs report." },
  { id: "f6", ind: "finance", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "September jobs report (NFP, 8:30 ET) — biggest macro swing in window", tickers: "SPY · JPM · TLT",
    rec: "A hot number cements another hike; keep dry powder and avoid new size into the print." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "FedEx FQ1 beats: EPS $3.83 vs $3.71 est, revenue $22.2B", tickers: "FDX",
    rec: "Constructive freight read; hold — cost actions are delivering, but watch the macro guide." },
  { id: "c2", ind: "consumer", dayIdx: 1, future: false, impact: 1, dir: "BEARISH",
    headline: "Nike slips 2.3% into next week's print; turnaround still unproven", tickers: "NKE",
    rec: "Wait for FQ1 (Oct 1) before adding; contrarian only on a clean guide." },
  { id: "c3", ind: "consumer", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Costco FQ4 earnings (after close) · BINARY", tickers: "COST",
    rec: "A premium multiple demands a beat + membership-fee color; don't chase into the print." },
  { id: "c4", ind: "consumer", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Carnival / Kroger earnings — discretionary vs staples cross-check", tickers: "CCL · KR",
    rec: "Read the consumer-health divergence; trade the tone, not the tape." },
  { id: "c5", ind: "consumer", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Final Michigan sentiment + Durable goods orders", tickers: "WMT · AMZN · TGT",
    rec: "Gauge consumer resilience under higher rates; watch big-ticket (durables) demand." },
  { id: "c6", ind: "consumer", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Nike FQ1 2027 earnings (after close) · BINARY", tickers: "NKE",
    rec: "Max-pessimism turnaround; use defined-risk structures only into the binary." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "MU", name: "Micron", rank: 1, spot: "~$1,015", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Wed Sep 30 (after close) · BINARY",
    iv: "Very rich into the print (double-digit implied move)", liq: "Deep, very active AI-memory chain; tight spreads",
    thesis: "AI-memory bellwether with tight HBM supply, record FCF and a Strong-Buy tape — but into a binary with expensive IV, so cut vega with a debit spread or get paid via a defined-risk credit spread rather than buying naked premium.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1000 / sell $1020 · Oct 16 '26 · ~$9 net debit · cost/max loss ~$900 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $960 / buy $940 · Oct 2 '26 · ~$7 credit · max loss/capital ~$1,300 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$1080 call · Oct 2 '26 · ~$9 debit · cost ~$900 · pure AI-memory pop" },
    ] },
  { ticker: "LLY", name: "Eli Lilly", rank: 2, spot: "~$1,153", sentiment: "Bullish",
    catalyst: "GLP-1 dominance — ~60% obesity share as Foundayo oral pill scales (no earnings in window)",
    iv: "Moderate — no binary in window, so long premium is viable", liq: "Deep large-cap pharma chain; penny-to-nickel spreads",
    thesis: "Structural GLP-1 leader pulling away from Novo on the oral-obesity pill; a clean directional trend without a binary event, so a defined-cost debit spread or a paid-to-be-long credit spread both fit.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1150 / sell $1175 · Oct 16 '26 · ~$12 net debit · cost/max loss ~$1,200" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1120 / buy $1100 · Oct 16 '26 · ~$7 credit · max loss/capital ~$1,300 · paid to be long the leader" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$1200 call · Oct 16 '26 · ~$11 debit · cost ~$1,100 · obesity-share breakout" },
    ] },
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 3, spot: "~$560", sentiment: "Bullish",
    catalyst: "Semiconductor leadership / AI-accelerator momentum (earnings not until late Oct)",
    iv: "Moderate-to-elevated; no binary in window", liq: "Very deep, liquid chain; penny-wide spreads, huge OI",
    thesis: "Chips are the market's leadership and AMD led a 3-session rip; a momentum-driven directional trade with no in-window binary, so a debit spread for the trend or a credit spread to get paid on dips both work.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $550 / sell $575 · Oct 16 '26 · ~$11 net debit · cost/max loss ~$1,100" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $540 / buy $520 · Oct 2 '26 · ~$7 credit · max loss/capital ~$1,300 · paid on the dip" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$590 call · Oct 2 '26 · ~$8 debit · cost ~$800 · breakout continuation" },
    ] },
  { ticker: "COST", name: "Costco", rank: 4, spot: "~$895", sentiment: "Neutral",
    catalyst: "FQ4 earnings — Thu Sep 24 (after close) · BINARY",
    iv: "Elevated into the print; historically muted post-earnings move", liq: "Deep large-cap chain; tight spreads",
    thesis: "Premium-multiple compounder that often sells the news on an in-line print, so favor range-tolerant, defined-risk structures — sell elevated premium and spread up only for a modest directional tilt.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $840p/buy $820p + sell $940c/buy $960c · Oct 2 '26 · ~$7 credit · max loss/capital ~$1,300 · range-bound" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $860 / buy $845 · Oct 2 '26 · ~$5 credit · max loss/capital ~$1,000 · bullish tilt" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $900 / sell $920 · Sep 25 '26 · ~$8 net debit · cost/max loss ~$800 · earnings pop" },
    ] },
  { ticker: "NKE", name: "Nike", rank: 5, spot: "~$35.50", sentiment: "Bullish (contrarian)",
    catalyst: "FQ1 2027 earnings — Thu Oct 1 (after close) · BINARY",
    iv: "Rich (double-digit implied move) on a low-priced stock", liq: "Deep mega-cap chain; low-$ premiums",
    thesis: "Max-pessimism turnaround into a binary with rich IV. At ~$35 a cash-secured put would tie up ~$3,400 of collateral (over the cap), so express it with defined-risk spreads instead — get paid via a put-credit spread, with a cheap call spread for the asymmetric pop.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$33 call · Oct 16 '26 · ~$3.20 debit · cost ~$320 · Δ≈0.65" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $34 / buy $31 · Oct 16 '26 · ~$1.00 credit · max loss/capital ~$200 · paid to accumulate" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $36 / sell $40 · Oct 2 '26 · ~$1.30 net debit · cost/max loss ~$130 · earnings breakout" },
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
// today line sits on the boundary between Sep 20 and Sep 21
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Sunday, Sep 20 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Sep 20)
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
