import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, July 31, 2026 (live-researched).
 * Window: last 3 days (Jul 28) → coming 2 weeks (Aug 14).
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

// 18-day axis: Jul 28 .. Aug 14 (last 3 days → coming 2 weeks). Today = index 3 (Jul 31).
const DAYS = [
  { idx: 0, date: "Jul 28", dow: "Tue" },
  { idx: 1, date: "Jul 29", dow: "Wed" },
  { idx: 2, date: "Jul 30", dow: "Thu" },
  { idx: 3, date: "Jul 31", dow: "Fri" }, // TODAY
  { idx: 4, date: "Aug 1", dow: "Sat" },
  { idx: 5, date: "Aug 2", dow: "Sun" },
  { idx: 6, date: "Aug 3", dow: "Mon" },
  { idx: 7, date: "Aug 4", dow: "Tue" },
  { idx: 8, date: "Aug 5", dow: "Wed" },
  { idx: 9, date: "Aug 6", dow: "Thu" },
  { idx: 10, date: "Aug 7", dow: "Fri" },
  { idx: 11, date: "Aug 8", dow: "Sat" },
  { idx: 12, date: "Aug 9", dow: "Sun" },
  { idx: 13, date: "Aug 10", dow: "Mon" },
  { idx: 14, date: "Aug 11", dow: "Tue" },
  { idx: 15, date: "Aug 12", dow: "Wed" },
  { idx: 16, date: "Aug 13", dow: "Thu" },
  { idx: 17, date: "Aug 14", dow: "Fri" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Microsoft FQ4 blowout — Azure tops $100B; MSFT +15%, ~$450B added in a day", tickers: "MSFT",
    rec: "The AI-capex payoff is real; hold core and add on pullbacks — don't chase a 15% gap." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Meta Q2 revenue guide disappoints on ad-spend/CapEx worries; META −8.8%", tickers: "META",
    rec: "Let it base after the guide cut; wait for ad-monetization signals before re-entering." },
  { id: "t3", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "BEARISH",
    headline: "Apple FQ3 beats ($109.4B, +16%) but Services/China light & soft guide; AAPL −7%", tickers: "AAPL",
    rec: "Record iPhone quarter + 50% margins — use the guide-driven dip to accumulate quality." },
  { id: "t4", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "Amazon Q2 crushes — AWS +36.7% to $42.2B, rev $200.6B; AMZN +~13%", tickers: "AMZN",
    rec: "AI monetization confirmed; hold winners and add on any consolidation of the gap." },
  { id: "t5", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Palantir Q2 earnings (after close) — options price a ±15% move", tickers: "PLTR",
    rec: "Size small into a huge implied move; defined-risk only — 8 straight beats vs. rich valuation." },
  { id: "t6", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "AMD Q2 earnings (after close) — MI400 / Zen 6 data-center tell", tickers: "AMD",
    rec: "Bullish setup but pre-earnings IV high; use defined-risk. Street PTs $620–635 into the print." },
  { id: "t7", ind: "tech", dayIdx: 14, future: true, impact: 2, dir: "BULLISH",
    headline: "Super Micro FQ4 — company pre-announced better-than-feared margins", tickers: "SMCI",
    rec: "The prelim margin beat de-risks the print; a cheap AI-infra name — accumulate on weakness." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status; crude firm on Iran / Mideast tension", tickers: "XOM · CVX · USO",
    rec: "Keep core E&P as a geopolitical hedge; trim into spikes — headlines dominate fundamentals." },
  { id: "e2", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Oil elevated as US–Iran tensions flare (Trump warns of a strike)", tickers: "XOM · CVX · COP",
    rec: "Tactical energy overweight as insurance; trailing stops — a de-escalation reverses it fast." },
  { id: "e3", ind: "energy", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "OPEC+ ministerial (Sun) — 6th straight supply hike vs. a pause", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut new directional bets into Sunday; another supply add is bearish crude, a pause is bullish." },
  { id: "e4", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "EIA petroleum inventories (crude draw / build)", tickers: "XOM · CVX · USO",
    rec: "Trade the inventory surprise; geopolitics still overrides fundamentals right now." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "GLP-1 war escalates — Novo sues Lilly over 'deceptive' Zepbound/Mounjaro ads", tickers: "LLY · NVO",
    rec: "Volatility persists into Q2 prints; favor LLY on reta momentum, fade knee-jerk NVO moves." },
  { id: "h2", ind: "health", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Eli Lilly & Novo Nordisk Q2 earnings (before open) — GLP-1 scorecard", tickers: "LLY · NVO",
    rec: "Binary for the weight-loss leaders; size before headlines, defined-risk only." },
  { id: "h3", ind: "health", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Moderna mRNA-1010 flu vaccine — FDA PDUFA decision date", tickers: "MRNA",
    rec: "Binary regulatory event; a clean approval is a needed win — keep any position small." },
  { id: "h4", ind: "health", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Lantheus MK-6240 tau-PET imaging agent — FDA PDUFA date", tickers: "LNTH",
    rec: "Niche catalyst; a read-through for Alzheimer diagnostics — size small." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "FOMC holds 3.5–3.75% but 3 dissent for a HIKE; dots flip to year-end 3.8%", tickers: "JPM · BAC · SPY · TLT",
    rec: "Higher-for-longer confirmed — favor asset-sensitive banks (JPM/BAC), avoid adding TLT/long-duration." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "10Y yield jumps to ~4.66%, 30Y ~5.19% after the hawkish hold", tickers: "JPM · BAC · TLT",
    rec: "NII tailwind for banks; trim rate-duration and long-duration growth on the yield move." },
  { id: "f3", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "July jobs report (NFP, 8:30 ET) — hike-odds swing factor", tickers: "JPM · BAC · SPY",
    rec: "Biggest macro print of the week; keep dry powder — a hot number cements the hike narrative." },
  { id: "f4", ind: "finance", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "July CPI (8:30 ET) — inflation tell before the September FOMC", tickers: "SPY · QQQ · JPM",
    rec: "Highest swing risk in the window; avoid initiating new size into the print." },
  { id: "f5", ind: "finance", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "July PPI (8:30 ET) — pipeline-inflation confirmation", tickers: "SPY · XLF",
    rec: "Confirms or denies the CPI read; watch for margin-pressure signals in the details." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Coca-Cola Q2 beats & raises FY guide (World-Cup boost); KO +6%", tickers: "KO",
    rec: "Staples strength — hold KO as a defensive anchor; don't chase the 6% pop." },
  { id: "c2", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Disney FQ3 earnings (before open) — parks & streaming profitability", tickers: "DIS",
    rec: "Wait for the print; the streaming-margin trajectory is the swing factor." },
  { id: "c3", ind: "consumer", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Back-to-school spend read — retail traffic watch", tickers: "WMT · TGT · AMZN",
    rec: "Lean to share-gainers (WMT/AMZN); avoid weak-traffic mall names." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "AMZN", name: "Amazon", rank: 1, spot: "~$257", sentiment: "Bullish",
    catalyst: "Q2 blowout done (AWS +36.7%); post-earnings momentum / drift",
    iv: "Post-print IV crushed → cheaper long premium favored", liq: "Mega-cap chain; penny-wide spreads, enormous OI",
    thesis: "Earnings risk is behind it — AWS re-accelerated and AI capex is monetizing. With IV deflated, buy defined premium for the post-earnings drift; spread up to cap cost.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $250 / sell $270 · Sep 18 '26 · ~$9 net debit · cost/max loss ~$900" },
      { profile: "Moderate",     strategy: "Long Call (ITM)", text: "$250 call · Sep 18 '26 · ~$14 debit · cost ~$1,400 · Δ≈0.60" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$270 call · Aug 21 '26 · ~$4 debit · cost ~$400 · drift continuation" },
    ] },
  { ticker: "PLTR", name: "Palantir", rank: 2, spot: "~$122", sentiment: "Neutral-to-Bullish",
    catalyst: "Q2 earnings — Mon Aug 3 (after close) · BINARY",
    iv: "Very rich — options price a ±15% move", liq: "Deep, very active retail-favorite chain",
    thesis: "Bullish bias but the implied move is ~2x the historical average → do NOT buy naked premium into max IV crush. Get paid with a defined-risk put-credit spread; cut vega with a tight debit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $110 / buy $100 · Aug 21 '26 · ~$3 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $122 / sell $135 · Aug 21 '26 · ~$5 net debit · cost/max loss ~$500 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$135 call · Aug 7 '26 · ~$4 debit · cost ~$400 · pure pop, IV-crush risk" },
    ] },
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 3, spot: "~$479", sentiment: "Bullish",
    catalyst: "Q2 earnings — Tue Aug 4 (after close) · BINARY",
    iv: "Elevated into the print (Street PTs $620–635)", liq: "Deep, liquid mega-cap semi chain",
    thesis: "Bullish into a binary with rich IV → avoid naked long calls (max crush). Cut vega with a debit spread, or get paid via a defined-risk put-credit spread below support.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $470 / sell $490 · Sep 18 '26 · ~$9 net debit · cost/max loss ~$900 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $450 / buy $435 · Aug 21 '26 · ~$5.50 credit · max loss/capital ~$950 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$510 call · Aug 7 '26 · ~$9 debit · cost ~$900 · beat-and-raise pop" },
    ] },
  { ticker: "LLY", name: "Eli Lilly", rank: 4, spot: "~$1,196", sentiment: "Bullish",
    catalyst: "Q2 earnings — Wed Aug 5 (before open) · BINARY",
    iv: "Elevated into a GLP-1 scorecard print", liq: "Deep large-cap chain; wide strikes, use spreads",
    thesis: "High-priced name — trade the net debit / max loss, not the strike. Retatrutide momentum and GLP-1 leadership favor upside; keep it defined-risk into the binary.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1,180 / sell $1,210 · Sep 18 '26 · ~$14 net debit · cost/max loss ~$1,400" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1,150 / buy $1,135 · Aug 21 '26 · ~$5 credit · max loss/capital ~$1,000 · harvests IV" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1,200 / sell $1,240 · Aug 7 '26 · ~$13 net debit · cost/max loss ~$1,300 · earnings pop" },
    ] },
  { ticker: "SMCI", name: "Super Micro Computer", rank: 5, spot: "~$28", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Tue Aug 11 (after close) · BINARY",
    iv: "Rich on a low-priced, high-beta name", liq: "Very liquid, high-volume chain; low $ premiums",
    thesis: "Company pre-announced better-than-feared margins, de-risking the print. A cheap, high-beta AI-infra name → defined-risk spreads keep capital tiny while capturing upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $25 / buy $22 · Aug 21 '26 · ~$0.90 credit · max loss/capital ~$210 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $27 / sell $32 · Aug 21 '26 · ~$2 net debit · cost/max loss ~$200 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$30 call · Aug 14 '26 · ~$1.20 debit · cost ~$120 · pure earnings pop" },
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
// today line sits on the boundary between Jul 31 and Aug 1
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Jul 31 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 31)
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
