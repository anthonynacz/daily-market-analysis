import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Tuesday, September 15, 2026 (live-researched).
 * Window: last 3 days (Sep 12) → coming 2 weeks (Sep 29).
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

// 18-day axis: Sep 12 .. Sep 29 (last 3 days → coming 2 weeks). Today = index 3 (Sep 15).
const DAYS = [
  { idx: 0, date: "Sep 12", dow: "Sat" },
  { idx: 1, date: "Sep 13", dow: "Sun" },
  { idx: 2, date: "Sep 14", dow: "Mon" },
  { idx: 3, date: "Sep 15", dow: "Tue" }, // TODAY
  { idx: 4, date: "Sep 16", dow: "Wed" },
  { idx: 5, date: "Sep 17", dow: "Thu" },
  { idx: 6, date: "Sep 18", dow: "Fri" },
  { idx: 7, date: "Sep 19", dow: "Sat" },
  { idx: 8, date: "Sep 20", dow: "Sun" },
  { idx: 9, date: "Sep 21", dow: "Mon" },
  { idx: 10, date: "Sep 22", dow: "Tue" },
  { idx: 11, date: "Sep 23", dow: "Wed" },
  { idx: 12, date: "Sep 24", dow: "Thu" },
  { idx: 13, date: "Sep 25", dow: "Fri" },
  { idx: 14, date: "Sep 26", dow: "Sat" },
  { idx: 15, date: "Sep 27", dow: "Sun" },
  { idx: 16, date: "Sep 28", dow: "Mon" },
  { idx: 17, date: "Sep 29", dow: "Tue" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Nasdaq/S&P fall as 10Y tops 5% (highest since 2023) + AI-safety fears; NVDA −2%", tickers: "NVDA · MSFT · GOOGL",
    rec: "Trim high-multiple tech into the rising-yield + AI-safety reset; hold quality, don't chase rebounds." },
  { id: "t2", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Oracle FQ1 blowout — cloud infra +121% to $7.4B, EPS beat; ORCL +6%", tickers: "ORCL",
    rec: "Strong AI-infra print; take partial profits into the pop, add on a pullback rather than chase." },
  { id: "t3", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "AI-safety debate hits megacaps — lab CEOs endorse slowing frontier development", tickers: "NVDA · MSFT · META",
    rec: "Expect headline volatility; keep quality, size down, don't chase the knee-jerk moves either way." },
  { id: "t4", ind: "tech", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Chipmakers into the FOMC — rate-sensitive, high-multiple names most exposed", tickers: "NVDA · AMD · AVGO",
    rec: "De-risk slightly into the decision; a dovish hold is relief, a hike hits megacap multiples." },
  { id: "t5", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Micron FQ4 earnings approach (Sep 30) — HBM / AI-memory demand tell", tickers: "MU · NVDA",
    rec: "Wait for the print — a binary; strong HBM guide re-rates memory, a soft one hits AI-supply names." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "Crude near $107–110 as Saudi East-West pipeline stays shut (6–8wk repair) + Houthi attacks", tickers: "XOM · CVX · OXY",
    rec: "Keep an energy overweight for the supply shock; trailing stops — a repair or ceasefire reverses it fast." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Houthi gains in Yemen + Red Sea risk push gasoline higher", tickers: "XOM · CVX · COP · USO",
    rec: "Supply premium intact; favor integrated majors with big buybacks (XOM/CVX) over pure beta." },
  { id: "e3", ind: "energy", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "XOM · CVX · USO",
    rec: "Watch the draw vs. consensus; a draw amid the pipeline outage reinforces the bull case." },
  { id: "e4", ind: "energy", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Saudi pipeline repair-timeline updates (full pumping ~7M bpd offline)", tickers: "XOM · CVX · OXY",
    rec: "Repair headlines are the key swing; scale in, don't lump — a faster fix unwinds the premium." },
  { id: "e5", ind: "energy", dayIdx: 11, future: true, impact: 2, dir: "BULLISH",
    headline: "Permian / higher-beta E&P bid on sustained crude", tickers: "OXY · COP · FANG",
    rec: "Higher torque to oil than the majors; use pullbacks and keep stops given headline reversal risk." },
  { id: "e6", ind: "energy", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "EIA petroleum report + OPEC+ policy watch (post-Sep 6 meeting)", tickers: "XOM · CVX · USO",
    rec: "Geopolitics dominates fundamentals; trade the risk premium with discipline, not conviction size." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Nuvalent zidesamtinib PDUFA (Sep 18) — ROS1+ NSCLC decision · BINARY", tickers: "NUVL",
    rec: "Binary small-cap event; size as a lottery, defined-risk only — approval is the bull case." },
  { id: "h2", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Oral GLP-1 battle — Lilly Foundayo vs Novo Wegovy-pill scripts both climb", tickers: "LLY · NVO",
    rec: "Favor LLY on pipeline breadth; fade knee-jerk NVO moves — the oral share war is far from settled." },
  { id: "h3", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Eli Lilly M&A spree broadens pipeline beyond GLP-1", tickers: "LLY",
    rec: "Constructive long-term diversification; add on macro-driven weakness, not into strength." },
  { id: "h4", ind: "health", dayIdx: 12, future: true, impact: 2, dir: "BULLISH",
    headline: "Defensive bid into quarter-end as yields & AI churn rattle risk", tickers: "UNH · JNJ · ABBV",
    rec: "Rotate some risk to healthcare defensives in the FOMC aftermath; favor stable-cash-flow names." },
  { id: "h5", ind: "health", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "Elevated Q3 biotech catalyst density (multiple readouts / PDUFAs)", tickers: "XBI · IBB",
    rec: "Be selective in SMID biotech; a basket (XBI) diversifies single-name binary risk." },

  // ---- FINANCIALS / MACRO -------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision 2:00 ET (Sep 16) — genuinely uncertain; hike risk after a year of holds at 3.50–3.75%", tickers: "JPM · BAC · SPY · TLT",
    rec: "Biggest macro swing in the window — keep dry powder into the dots & presser; asset-sensitive banks win on a hawkish outcome." },
  { id: "f2", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Retail sales 8:30 ET (Sep 16) — consumer strength vs. rate risk", tickers: "XRT · AMZN · WMT",
    rec: "A hot print raises hike odds; fade rate-sensitive discretionary, favor staples ahead of the decision." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "10Y Treasury yield tops 5% — highest since 2023; pressures multiples & bank bond books", tickers: "TLT · JPM · XLF",
    rec: "Higher-for-longer — favor NII beneficiaries, avoid adding duration until the FOMC clears." },
  { id: "f4", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "JPM near a multi-week low as yields bite despite the NII tailwind", tickers: "JPM · BAC · WFC",
    rec: "Quality bank; add on rate-driven weakness into the FOMC, not into strength." },
  { id: "f5", ind: "finance", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Triple/quad witching + S&P 500 rebalance (Sep 18)", tickers: "SPY · QQQ · IWM",
    rec: "Expect elevated volume & pin risk; avoid initiating new size into the close." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Walmart adds delivery deals (Papa John's, Dunkin'); trade-down tailwind intact", tickers: "WMT · AMZN · TGT",
    rec: "Constructive for WMT share gains; hold/add as tariff-driven trade-down favors scale players." },
  { id: "c2", ind: "consumer", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Costco fiscal Q4 earnings (~Sep 25) — membership & traffic read", tickers: "COST",
    rec: "Premium valuation — wait for the print; membership renewal growth is the tell, not headline sales." },
  { id: "c3", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Accenture FQ4 earnings (Sep 24, before open) — enterprise / AI-services demand", tickers: "ACN",
    rec: "IT-services bellwether; a soft bookings guide reads across to consulting and broader tech spend." },
  { id: "c4", ind: "consumer", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Nike earnings preview (~Oct 1) — turnaround watch near multi-year lows (~$37)", tickers: "NKE",
    rec: "Contrarian setup; size before headlines — rich IV favors defined-risk structures over naked longs." },
  { id: "c5", ind: "consumer", dayIdx: 6, future: true, impact: 1, dir: "BEARISH",
    headline: "Autos / discretionary squeezed by higher rates + $100+ oil", tickers: "TSLA · F · GM",
    rec: "Affordability and fuel costs bite; be selective, avoid rate-sensitive discretionary into the FOMC." },

  // ---- FORWARD CATALYSTS (week 2: Sep 21–29) ------------------------------
  { id: "x1", ind: "tech", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through continues post-Oracle; safety debate lingers", tickers: "NVDA · ORCL · AVGO",
    rec: "Let the dust settle; re-add on confirmation of capex durability, not the first bounce." },
  { id: "x2", ind: "health", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "GLP-1 script-tracker follow-through (oral Wegovy vs Foundayo)", tickers: "LLY · NVO",
    rec: "Volatility persists; favor LLY on breadth, fade knee-jerk NVO moves on weekly script noise." },
  { id: "x3", ind: "finance", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "PCE inflation + final Q2 GDP (~Sep 25) — post-FOMC confirmation", tickers: "SPY · TLT · JPM",
    rec: "Confirms or challenges the FOMC message; a hot PCE cements higher-for-longer." },
  { id: "x4", ind: "energy", dayIdx: 15, future: true, impact: 2, dir: "BULLISH",
    headline: "Sustained supply premium as pipeline repairs drag", tickers: "XOM · CVX · OXY",
    rec: "Keep the tactical energy overweight with trailing stops; a repair headline unwinds it fast." },
  { id: "x5", ind: "consumer", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Quarter-end rotation / window-dressing into month close", tickers: "SPY · XLP · XLE",
    rec: "Expect defensive & energy tilt into quarter-end; don't over-read low-volume rotation." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "XOM", name: "ExxonMobil", rank: 1, spot: "~$165", sentiment: "Bullish",
    catalyst: "Oil supply shock — Saudi East-West pipeline shut (6–8wk repair) + Houthi attacks; crude ~$107–110",
    iv: "Moderate-elevated (oil vol) — long premium still viable", liq: "Deep mega-cap energy chain; penny-wide spreads, huge OI",
    thesis: "Cleanest way to play a genuine supply shock with a buyback-rich integrated major. Moderate IV means long premium isn't over-taxed; spread up to cut cost. A repair or ceasefire is the main risk.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$160 call · Oct 16 '26 · ~$9.00 debit · cost ~$900 · Δ≈0.62" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $165 / sell $175 · Oct 16 '26 · ~$4.20 net debit · cost/max loss ~$420" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$175 call · Sep 25 '26 · ~$1.50 debit · cost ~$150 · pure supply-shock upside" },
    ] },
  { ticker: "OXY", name: "Occidental", rank: 2, spot: "~$54", sentiment: "Bullish",
    catalyst: "Higher-beta oil torque on sustained $100+ crude (Buffett-backed Permian leverage)",
    iv: "Elevated — favors defined-risk spreads over naked longs", liq: "Very liquid chain; tight strikes",
    thesis: "More torque to crude than the majors. With IV rich, express bullishly through a debit spread or get paid via a put-credit spread below support rather than buying raw calls.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $52 / sell $58 · Oct 16 '26 · ~$2.80 net debit · cost/max loss ~$280" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $52 / buy $48 · Oct 16 '26 · ~$1.30 credit · max loss/capital ~$270 · paid to accumulate" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$57 call · Sep 25 '26 · ~$1.00 debit · cost ~$100" },
    ] },
  { ticker: "FDX", name: "FedEx", rank: 3, spot: "~$312", sentiment: "Bullish",
    catalyst: "FQ1 FY27 earnings — ~Sep 24 (after close) · BINARY; cheap valuation, raised FY guide",
    iv: "Elevated into the print (~±7% implied)", liq: "Deep, liquid large-cap chain",
    thesis: "Bullish into a binary with rich IV → avoid naked long calls (crush risk). Cut vega with a debit spread, or get paid via a defined-risk put-credit spread below support.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $310 / sell $325 · Oct 16 '26 · ~$6.50 net debit · cost/max loss ~$650 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $300 / buy $290 · Oct 16 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$325 call · Sep 25 '26 · ~$3.00 debit · cost ~$300 · earnings-pop lotto" },
    ] },
  { ticker: "NKE", name: "Nike", rank: 4, spot: "~$37", sentiment: "Bullish (contrarian)",
    catalyst: "FQ1 FY27 earnings — ~Oct 1 (after close) · BINARY; multi-year lows, turnaround watch",
    iv: "~50% (±~9% implied) — rich on a cheap stock", liq: "Deep mega-cap chain; low $ premiums",
    thesis: "Max-pessimism turnaround with rich IV → get paid via a defined-risk put-credit spread; cheap ITM call for delta, and a small debit spread for the asymmetric pop. Strike ×100 collateral rules out a cash-secured put here.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$35 call · Oct 16 '26 · ~$3.20 debit · cost ~$320 · Δ≈0.63" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $35 / buy $31 · Oct 16 '26 · ~$1.10 credit · max loss/capital ~$290 · paid to accumulate" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $37 / sell $42 · Oct 16 '26 · ~$1.70 net debit · cost/max loss ~$170" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 5, spot: "~$214", sentiment: "Neutral",
    catalyst: "AI-safety overhang (lab CEOs endorse slowing frontier dev) + FOMC — range-bound, no earnings until Nov",
    iv: "Elevated on macro + AI-debate churn — favors premium selling", liq: "Deepest single-stock options market",
    thesis: "No near-term earnings but caught between a rich valuation, the AI-safety debate, and FOMC headline risk. Sell elevated premium with defined risk rather than pick a direction; a condor profits if it just chops.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $195p/buy $185p + sell $235c/buy $245c · Oct 16 '26 · ~$3.00 credit · max loss/capital ~$700 · range-bound" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $200 / buy $190 · Oct 16 '26 · ~$3.20 credit · max loss/capital ~$680 · bullish tilt, sell the fear" },
      { profile: "Aggressive",   strategy: "Bear Call Credit Spread", text: "Sell $230 / buy $240 · Sep 25 '26 · ~$3.00 credit · max loss/capital ~$700 · fade the bounce into AI-safety headlines" },
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
// today line sits on the boundary between Sep 15 and Sep 16
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Tuesday, Sep 15 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Sep 15)
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
