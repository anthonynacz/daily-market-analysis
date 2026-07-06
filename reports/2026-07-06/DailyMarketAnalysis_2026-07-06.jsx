import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Monday, July 6, 2026 (live-researched).
 * Window: last 3 days (Jul 3) → coming 2 weeks (Jul 20).
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

// 18-day axis: Jul 3 .. Jul 20 (last 3 days → coming 2 weeks). Today = index 3 (Jul 6).
const DAYS = [
  { idx: 0, date: "Jul 3", dow: "Fri" }, // mkt closed (Independence Day observed)
  { idx: 1, date: "Jul 4", dow: "Sat" },
  { idx: 2, date: "Jul 5", dow: "Sun" },
  { idx: 3, date: "Jul 6", dow: "Mon" }, // TODAY
  { idx: 4, date: "Jul 7", dow: "Tue" },
  { idx: 5, date: "Jul 8", dow: "Wed" },
  { idx: 6, date: "Jul 9", dow: "Thu" },
  { idx: 7, date: "Jul 10", dow: "Fri" },
  { idx: 8, date: "Jul 11", dow: "Sat" },
  { idx: 9, date: "Jul 12", dow: "Sun" },
  { idx: 10, date: "Jul 13", dow: "Mon" },
  { idx: 11, date: "Jul 14", dow: "Tue" },
  { idx: 12, date: "Jul 15", dow: "Wed" },
  { idx: 13, date: "Jul 16", dow: "Thu" },
  { idx: 14, date: "Jul 17", dow: "Fri" },
  { idx: 15, date: "Jul 18", dow: "Sat" },
  { idx: 16, date: "Jul 19", dow: "Sun" },
  { idx: 17, date: "Jul 20", dow: "Mon" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "SK Hynix debuts on Nasdaq in ~$28B listing; AI-memory supercycle in focus", tickers: "MU · NVDA",
    rec: "Ride the HBM/memory theme via MU on pullbacks — the mega-listing validates demand; don't chase the open, scale in." },
  { id: "t2", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Chips rebound at the reopen; Intel +3% premarket after last week's AI-semi dip", tickers: "INTC · NVDA · AMD",
    rec: "Add quality semis (NVDA) into weakness, not strength — the dip was sentiment, not fundamentals." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Nasdaq slid ~0.8% into the holiday on AI-chip profit-taking (NVDA −1.4%)", tickers: "NVDA · AVGO",
    rec: "Normal digestion after a ~47% SOX YTD run; hold core, keep dry powder for the next leg up." },
  { id: "t4", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "BULLISH",
    headline: "Memory supercycle persists — DRAM +44% QoQ, NAND +53%", tickers: "MU · WDC · STX",
    rec: "Structural tailwind; own MU as the liquid US proxy but size for the volatility (very high IV)." },
  { id: "t5", ind: "tech", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "TSMC Q2 earnings (~Jul 16, est.) — AI-foundry bellwether", tickers: "TSM · NVDA · AVGO",
    rec: "Wait for the print; a strong AI-capex guide re-rates the whole chain, a soft outlook cools sentiment." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "WTI slips near ~$69 as US-Iran peace reopens Hormuz; OPEC+ adds 188k bpd", tickers: "XOM · CVX · COP",
    rec: "Trim/underweight E&P into falling crude — supply overhang caps upside; favor only low-cost majors." },
  { id: "e2", ind: "energy", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "EIA weekly petroleum status report (Wed)", tickers: "XOM · USO",
    rec: "Watch builds vs draws, but macro (peace + OPEC+ supply) dominates — don't trade the weekly noise." },
  { id: "e3", ind: "energy", dayIdx: 9, future: true, impact: 1, dir: "BEARISH",
    headline: "Saudi exports back to ~90% of pre-war levels; supply normalizing", tickers: "XOM · CVX · SLB",
    rec: "Stay underweight energy — a stabilizing Middle East keeps a lid on the crude risk premium." },
  { id: "e4", ind: "energy", dayIdx: 3, future: false, impact: 1, dir: "BULLISH",
    headline: "Lower jet fuel = airline / consumer tailwind from soft crude", tickers: "DAL · UAL · LUV",
    rec: "Cheaper fuel flows straight to airline margins — a rare bright spot from the crude selloff (see DAL)." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Medicare GLP-1 Bridge live (Jul 1): obesity drugs at $50/mo co-pay; LLY +7% on the week", tickers: "LLY · NVO",
    rec: "Structural volume unlock for LLY; buy pullbacks — the co-pay bridge widens the addressable market." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "UnitedHealth: BofA lifts target to $475 into Q2, but DOJ fraud probe overhangs", tickers: "UNH",
    rec: "Two-sided — improving cost trends vs. legal risk; wait for the Q2 print before adding managed care." },
  { id: "h3", ind: "health", dayIdx: 8, future: true, impact: 1, dir: "BULLISH",
    headline: "Pharma/biotech M&A on record pace (~$65B in Q1)", tickers: "PFE · MRK · XBI",
    rec: "Tailwind for SMID-cap biotech (XBI); tilt to de-risked names filling big-pharma revenue gaps." },
  { id: "h4", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Eli Lilly near record ~$1,208 on Medicare access + oral GLP-1 momentum", tickers: "LLY",
    rec: "Momentum + fundamentals aligned; use defined-risk spreads given the high share price, don't chase highs." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "June jobs shock: +57K vs ~117K est; prior months revised down → rate-CUT odds jump, yields fall", tickers: "JPM · BAC · TLT",
    rec: "Softer labor = lower yields: good for duration/growth, a mild NII headwind for banks — favor diversified franchises (JPM)." },
  { id: "f2", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC June minutes (Wed) — Warsh's first meeting; markets hunt for a cut signal", tickers: "SPY · TLT · JPM",
    rec: "Biggest macro read of the week; keep dry powder — a dovish tone extends the rally, hawkish stalls it." },
  { id: "f3", ind: "finance", dayIdx: 11, future: true, impact: 3, dir: "BULLISH",
    headline: "Bank earnings kick off: JPM, Citi, WFC, GS, MS (Jul 14)", tickers: "JPM · GS · WFC · C",
    rec: "Sector sets the Q2 tone; JPM has beaten 14 of 16 quarters — favor money-center leaders over regionals." },
  { id: "f4", ind: "finance", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "June CPI (8:30 ET) — first inflation test after the soft jobs print", tickers: "SPY · QQQ · TLT",
    rec: "Swing risk of the fortnight; a cool number cements cut hopes, a hot one revives higher-for-longer." },
  { id: "f5", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "July monthly options expiration — elevated gamma / pin risk", tickers: "SPY · QQQ · IWM",
    rec: "Expect pinning and higher volume; avoid initiating fresh size into the Friday close." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Tesla Q2 deliveries 480,126 — a beat vs expectations", tickers: "TSLA",
    rec: "Delivery beat steadies the bull case; wait for Jul 22 earnings/margins before adding materially." },
  { id: "c2", ind: "consumer", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "PepsiCo Q2 earnings (before open) — est $2.21 EPS; stock near 52-wk lows", tickers: "PEP",
    rec: "Low bar + cheap valuation (fwd P/E ~16); prefer defined-risk bullish structures over chasing — see Option Plays." },
  { id: "c3", ind: "consumer", dayIdx: 7, future: true, impact: 3, dir: "BULLISH",
    headline: "Delta Q2 earnings (before open) — fuel windfall ~$300M; Strong Buy consensus", tickers: "DAL · UAL · AAL",
    rec: "Lower fuel + resilient premium travel; a top setup — use spreads into the binary, don't buy naked calls." },
  { id: "c4", ind: "consumer", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Amazon Prime Day window — mid-July discretionary read", tickers: "AMZN · WMT · TGT",
    rec: "Gauge consumer health; a strong event supports AMZN/retail, a soft one flags a cautious shopper." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "DAL", name: "Delta Air Lines", rank: 1, spot: "~$92", sentiment: "Bullish",
    catalyst: "Q2 earnings — Fri Jul 10 (before open) · BINARY",
    iv: "Elevated into earnings (~±7–8% implied)", liq: "Deep, liquid airline chain; tight penny-wide spreads",
    thesis: "Fuel windfall (~$300M from sub-$70 crude) + resilient premium travel + Strong-Buy consensus into a binary. Bullish with rich IV → prefer defined-risk debit spreads and get paid via a credit spread that harvests the post-print crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $90 / sell $100 · Aug 21 '26 · ~$3.80 net debit · cost/max loss ~$380" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $90 / buy $85 · Jul 17 '26 · ~$1.60 credit · max loss/capital ~$340 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$95 call · Jul 17 '26 · ~$1.60 debit · cost ~$160 · earnings pop" },
    ] },
  { ticker: "PEP", name: "PepsiCo", rank: 2, spot: "~$144", sentiment: "Neutral-to-Bullish",
    catalyst: "Q2 earnings — Thu Jul 9 (before open) · BINARY",
    iv: "Elevated into earnings (~±5–6% implied)", liq: "Deep large-cap staples chain; tight spreads",
    thesis: "Beaten down near 52-wk lows at a cheap fwd P/E (~16) with a low bar — beat in each of the last 4 quarters. Binary print → defined-risk, range-tolerant: sell premium below support, spread up for cheap upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $140 / buy $132 · Aug 21 '26 · ~$2.60 credit · max loss/capital ~$540 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $145 / sell $155 · Jul 17 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$150 call · Jul 17 '26 · ~$1.20 debit · cost ~$120" },
    ] },
  { ticker: "JPM", name: "JPMorgan Chase", rank: 3, spot: "~$335", sentiment: "Bullish",
    catalyst: "Q2 earnings — Tue Jul 14 (before open) · BINARY (bank kickoff)",
    iv: "Elevated into earnings; high share price → use spreads", liq: "Deep money-center chain; huge OI, tight spreads",
    thesis: "Sector bellwether that has beaten 14 of 16 quarters, trading near an all-time high into the bank kickoff. High-priced underlying → the net debit / max loss is what counts, so spreads fit $1,500 easily.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $345 · Aug 21 '26 · ~$7 net debit · cost/max loss ~$700" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $325 / buy $315 · Jul 17 '26 · ~$3.20 credit · max loss/capital ~$680 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$340 call · Jul 17 '26 · ~$3 debit · cost ~$300" },
    ] },
  { ticker: "MU", name: "Micron", rank: 4, spot: "~$977", sentiment: "Bullish",
    catalyst: "AI-memory supercycle (no near binary; reported late June)",
    iv: "Very high (post-$1T run) — figures are ESTIMATES", liq: "Deep, very active memory chain",
    thesis: "Memory supercycle leader — DRAM +44% QoQ, up ~242% YTD, into the $1T club alongside SK Hynix's listing. Momentum + very high IV/price → defined-risk spreads only; keep strikes tight so max loss fits the cap. Figures ESTIMATE (high vol).",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $950 / sell $975 · Aug 21 '26 · ~$13 net debit · cost/max loss ~$1,300 (ESTIMATE)" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $980 / sell $1010 · Jul 17 '26 · ~$11 net debit · cost/max loss ~$1,100 (ESTIMATE)" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$1020 call · Jul 17 '26 · ~$9 debit · cost ~$900 (ESTIMATE)" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 5, spot: "~$137", sentiment: "Bearish",
    catalyst: "Crude <$70 on US-Iran peace / Hormuz reopen; OPEC+ adding supply",
    iv: "Moderate (crude selloff, off ~22% from highs)", liq: "Deep, liquid mega-cap energy chain",
    thesis: "Supply overhang from the peace deal + OPEC+ output hikes caps oil near $69. Bearish with moderate IV → bear put debit spread for directional downside, or get paid via a defined-risk bear call credit spread above resistance.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread", text: "Buy $135 / sell $125 · Aug 21 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Moderate",     strategy: "Bear Call Credit Spread", text: "Sell $140 / buy $145 · Jul 17 '26 · ~$1.60 credit · max loss/capital ~$340" },
      { profile: "Aggressive",   strategy: "Long Put (OTM)", text: "$130 put · Jul 17 '26 · ~$1.30 debit · cost ~$130" },
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
// today line sits on the boundary between Jul 6 and Jul 7
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Monday, Jul 6 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 6)
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
