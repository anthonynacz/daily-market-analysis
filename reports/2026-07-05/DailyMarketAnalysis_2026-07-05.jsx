import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Sunday, July 5, 2026 (live-researched).
 * Window: last 3 days (Jul 2) → coming 2 weeks (Jul 19).
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

// 18-day axis: Jul 2 .. Jul 19 (last 3 days → coming 2 weeks). Today = index 3 (Jul 5).
const DAYS = [
  { idx: 0, date: "Jul 2", dow: "Thu" },
  { idx: 1, date: "Jul 3", dow: "Fri" }, // mkt closed (Independence Day observed)
  { idx: 2, date: "Jul 4", dow: "Sat" },
  { idx: 3, date: "Jul 5", dow: "Sun" }, // TODAY
  { idx: 4, date: "Jul 6", dow: "Mon" },
  { idx: 5, date: "Jul 7", dow: "Tue" },
  { idx: 6, date: "Jul 8", dow: "Wed" },
  { idx: 7, date: "Jul 9", dow: "Thu" },
  { idx: 8, date: "Jul 10", dow: "Fri" },
  { idx: 9, date: "Jul 11", dow: "Sat" },
  { idx: 10, date: "Jul 12", dow: "Sun" },
  { idx: 11, date: "Jul 13", dow: "Mon" },
  { idx: 12, date: "Jul 14", dow: "Tue" },
  { idx: 13, date: "Jul 15", dow: "Wed" },
  { idx: 14, date: "Jul 16", dow: "Thu" },
  { idx: 15, date: "Jul 17", dow: "Fri" },
  { idx: 16, date: "Jul 18", dow: "Sat" },
  { idx: 17, date: "Jul 19", dow: "Sun" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Semis wobble to start Q3 — profit-taking after a monster +80% H1 run", tickers: "NVDA · AMD · INTC",
    rec: "Trim extended semis into records; keep core NVDA — the AI-capex trend is intact but chase-risk is high here." },
  { id: "t2", ind: "tech", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "AI-infra names in focus pre-earnings (capex-cycle chatter)", tickers: "NVDA · AVGO · ORCL",
    rec: "Let the prints confirm capex strength; re-add on data, don't front-run the read-through." },
  { id: "t3", ind: "tech", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "TSMC Q2 earnings — the AI-capex tell for the whole chip chain", tickers: "TSM · NVDA · AVGO",
    rec: "Wait for the print; a strong AI/HPC guide re-rates semis, a capex-digestion warning hits NVDA/AVGO." },
  { id: "t4", ind: "tech", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Netflix Q2 earnings — first megacap-tech print of the season", tickers: "NFLX",
    rec: "Rich expectations; defined-risk only into the print — ad-tier & password monetization are the swing factors." },
  { id: "t5", ind: "tech", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "ASML Q2 — litho bookings gauge the semi upcycle", tickers: "ASML · NVDA · TSM",
    rec: "Order strength confirms the capex cycle; a booking air-pocket rattles equipment names — read alongside TSMC." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Crude slides back to ~$70 (pre-war levels) as Hormuz reopens; Q2 worst since 2008", tickers: "XOM · CVX · USO",
    rec: "Fade the geopolitical-premium unwind; energy is now a range trade — don't chase E&P lower, wait for a base." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 1, dir: "MIXED",
    headline: "Trump publicly demands lower retail gasoline prices", tickers: "XOM · CVX · VLO",
    rec: "Political noise; refiners (VLO) more exposed to crack-spread policy than integrateds — hold, don't react." },
  { id: "e3", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "XOM · CVX · USO",
    rec: "Trade the draw vs. consensus; with Hormuz open, a build pressures crude — keep energy exposure light." },
  { id: "e4", ind: "energy", dayIdx: 7, future: true, impact: 3, dir: "BULLISH",
    headline: "Iran ceasefire fragile — Tehran refuses US envoys (Hormuz tail risk)", tickers: "XOM · CVX · OXY",
    rec: "Keep a small energy hedge as geopolitical insurance; a Hormuz re-escalation spikes crude — trailing stops." },
  { id: "e5", ind: "energy", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "OPEC+ monthly output / compliance watch", tickers: "XOM · CVX · USO",
    rec: "A larger unwind of cuts is bearish crude; supply — not demand — is the driver, so wait before adding energy." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Lilly +3% (to ~$1,214) as Medicare 'Bridge' opens GLP-1 access ($50 copay)", tickers: "LLY · NVO",
    rec: "Momentum + policy tailwind; buy dips in LLY — Bridge widens the obesity TAM, a bearish read-through for NVO share." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Foundayo (oral GLP-1) scripts seen accelerating into H2; LLY the share-gainer", tickers: "LLY · HIMS",
    rec: "Hold LLY for the oral-pill ramp; watch the weekly Rx run-rate — the durable catalyst, not a one-day pop." },
  { id: "h3", ind: "health", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "UnitedHealth Q2 earnings — managed-care margin & MLR watch", tickers: "UNH · HUM · CVS",
    rec: "Stay cautious on managed care; a soft MLR guide re-rates the group lower — wait for the print before bottom-fishing." },
  { id: "h4", ind: "health", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "J&J Q2 earnings — pharma/medtech bellwether kicks off healthcare", tickers: "JNJ",
    rec: "Defensive quality; hold JNJ and use any tariff/litigation dip to add — a low-beta earnings anchor." },
  { id: "h5", ind: "health", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "GLP-1 data & Medicare-uptake commentary keep the group volatile", tickers: "LLY · NVO · VKTX",
    rec: "Favor LLY on execution; fade knee-jerk NVO moves — size before headlines." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "June jobs +57K badly miss ~115K est; unemployment 4.2% — Sept hike off the table", tickers: "JPM · BAC · WFC · GS",
    rec: "Weak labor quiets the hike scare — constructive for banks; favor NII-strong JPM/BAC into Q2 prints." },
  { id: "f2", ind: "finance", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "FOMC minutes (Warsh's June pause) — hike-timing clues", tickers: "JPM · BAC · SPY · TLT",
    rec: "Parse for Oct-hike signaling; asset-sensitive banks win if higher-for-longer holds — avoid duration." },
  { id: "f3", ind: "finance", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "June CPI (8:30 ET) — biggest macro print of the window (May ran 4.2%)", tickers: "SPY · TLT · JPM · V",
    rec: "Keep dry powder; a hot energy-driven CPI revives hike odds and hits duration — a cool print is the risk-on catalyst." },
  { id: "f4", ind: "finance", dayIdx: 12, future: true, impact: 3, dir: "BULLISH",
    headline: "Big banks kick off Q2 — JPM & BAC report (est. JPM $5.44 EPS)", tickers: "JPM · BAC · WFC · C",
    rec: "Lean bullish JPM into NII + capital-return strength; use defined-risk given the same-day CPI volatility." },
  { id: "f5", ind: "finance", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "GS, MS & Citi report — capital-markets & trading-rebound tell", tickers: "GS · MS · C",
    rec: "A trading/IB beat extends the financials leadership; take partial profits into strength, don't chase." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Tesla −7.5% despite record Q2 deliveries (480K, +25% YoY) — a 'sell the news'", tickers: "TSLA",
    rec: "Valuation now rests on robotaxi/FSD, not deliveries; don't catch the knife — wait for the late-July earnings tell." },
  { id: "c2", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Nike FQ4 beats but China −12%; shares −3% AH (tariff-refund margin help)", tickers: "NKE",
    rec: "Turnaround uneven — China is the swing factor; hold, and add only on stabilization, not the earnings dip." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 1, dir: "BULLISH",
    headline: "Consumer resilient into the holiday — hybrids surge, egg prices ease", tickers: "WMT · COST · TGT",
    rec: "Staples steady; keep WMT/COST as defensive anchors into a data-heavy stretch." },
  { id: "c4", ind: "consumer", dayIdx: 8, future: true, impact: 3, dir: "BULLISH",
    headline: "Delta Q2 earnings (10:00 ET) — kicks off the travel/airlines season", tickers: "DAL · UAL · AAL",
    rec: "Bullish setup — DAL has beaten 4 straight; a strong premium-travel guide lifts the group. Defined-risk into the binary." },
  { id: "c5", ind: "consumer", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "June retail sales + consumer-sentiment read", tickers: "WMT · AMZN · TGT",
    rec: "A firm print supports the soft-landing bull case; a miss revives demand-worry — watch discretionary vs staples." },

  // ---- MARKET-WIDE / FORWARD CATALYSTS ------------------------------------
  { id: "m1", ind: "finance", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "Markets closed for the July 4 weekend — S&P near record 7,483 after best H1 since 2021", tickers: "SPY · QQQ · DIA",
    rec: "Don't chase into records; keep dry powder for the Jul 14 CPI + bank-earnings cluster." },
  { id: "x1", ind: "consumer", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Week ahead: Tesla & Alphabet Q2 earnings (Jul 22–23)", tickers: "TSLA · GOOGL",
    rec: "Position defined-risk; mega-cap tech prints set the late-July tone — don't over-commit into the tape." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "JPM", name: "JPMorgan Chase", rank: 1, spot: "~$328", sentiment: "Bullish",
    catalyst: "Q2 earnings + June CPI — BOTH Tue Jul 14 (BM) · BINARY",
    iv: "Elevated into the double catalyst (~±4–5% implied)", liq: "Deepest bank chain; penny-wide spreads, huge OI",
    thesis: "Weak June jobs quiets the hike scare while NII + capital return stay strong. Bullish into a same-day CPI/earnings binary → cut vega with a debit spread or get paid via a defined-risk put credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $325 / sell $340 · Aug 21 '26 · ~$6.50 net debit · cost/max loss ~$650 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $320 / buy $310 · Jul 17 '26 · ~$3 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$335 call · Jul 17 '26 · ~$3 debit · cost ~$300 · pure earnings/CPI pop" },
    ] },
  { ticker: "DAL", name: "Delta Air Lines", rank: 2, spot: "~$93", sentiment: "Bullish",
    catalyst: "Q2 earnings — Fri Jul 10 (10:00 ET) · kicks off airlines · BINARY",
    iv: "Rich into earnings (~±7% implied)", liq: "Deep, liquid airline chain; tight spreads",
    thesis: "DAL has beaten 4 straight quarters and sits near an all-time high on premium-travel strength. Bullish into a binary with rich IV → get paid via a put credit spread, or a defined-cost call spread up.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $90 / sell $98 · Aug 21 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $88 / buy $83 · Jul 17 '26 · ~$1.50 credit · max loss/capital ~$350 · paid to wait" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$95 call · Jul 17 '26 · ~$2 debit · cost ~$200 · earnings breakout" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 3, spot: "~$194", sentiment: "Bullish",
    catalyst: "TSMC/ASML Jul 16 read-through; no own print until late Aug",
    iv: "Moderate (~40%) — long premium viable; no binary crush", liq: "Deepest semi chain in the market; penny-wide, massive OI",
    thesis: "Profit-taking after a +80% H1 offers a pullback entry with the AI-capex trend intact. No own earnings binary in-window → moderate IV makes owning some premium reasonable; spread up to define cost.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $185 / sell $205 · Aug 21 '26 · ~$8 net debit · cost/max loss ~$800" },
      { profile: "Moderate",     strategy: "Long Call (ITM)", text: "$185 call · Jul 31 '26 · ~$13 debit · cost ~$1,300 · Δ≈0.62" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$205 call · Jul 17 '26 · ~$2.20 debit · cost ~$220 · TSMC read-through pop" },
    ] },
  { ticker: "LLY", name: "Eli Lilly", rank: 4, spot: "~$1,214", sentiment: "Bullish",
    catalyst: "Medicare 'Bridge' GLP-1 access (Jul 1) + Foundayo oral ramp; earnings Aug 6 (out of window)",
    iv: "Moderate (no in-window binary)", liq: "Deep large-cap chain; wide strikes → use spreads (spot too high for single long calls under cap)",
    thesis: "Policy tailwind (Medicare $50-copay Bridge widens the obesity TAM) plus oral-pill share gains, near record highs. High share price → defined-risk SPREADS only to stay under the $1,500 cap.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1,200 / sell $1,220 · Aug 21 '26 · ~$10 net debit · cost/max loss ~$1,000" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1,180 / buy $1,170 · Jul 31 '26 · ~$3.50 credit · max loss/capital ~$650 · bullish, range-tolerant" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1,220 / sell $1,240 · Jul 17 '26 · ~$7 net debit · cost/max loss ~$700 · OTM momentum" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 5, spot: "~$137", sentiment: "Neutral",
    catalyst: "Crude range-bound ~$70 post-Hormuz; Q2 earnings ~Aug 1 (out of window)",
    iv: "Moderate; two-sided (Iran-ceasefire tail risk both ways)", liq: "Deep, liquid integrated-energy chain",
    thesis: "Oil has round-tripped to pre-war ~$70 with Hormuz open, but a fragile Iran ceasefire keeps fat tails both ways → range-bound. Sell premium with defined-risk credit structures; keep wings for the geopolitical tail.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $145c/buy $150c + sell $130p/buy $125p · Aug 21 '26 · ~$1.50 credit · max loss/capital ~$350" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $132 / buy $127 · Jul 31 '26 · ~$1.30 credit · max loss/capital ~$370 · bullish-neutral" },
      { profile: "Aggressive",   strategy: "Bear Call Credit Spread", text: "Sell $142 / buy $147 · Jul 17 '26 · ~$1.40 credit · max loss/capital ~$360 · fade a ceasefire-driven pop" },
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
// today line sits on the boundary between Jul 5 and Jul 6
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Sunday, Jul 5 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 5)
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
