import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Saturday, October 17, 2026 (live-researched).
 * Window: last 3 days (Oct 14) → coming 2 weeks (Oct 31).
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

// 18-day axis: Oct 14 .. Oct 31 (last 3 days → coming 2 weeks). Today = index 3 (Oct 17).
const DAYS = [
  { idx: 0, date: "Oct 14", dow: "Wed" },
  { idx: 1, date: "Oct 15", dow: "Thu" },
  { idx: 2, date: "Oct 16", dow: "Fri" },
  { idx: 3, date: "Oct 17", dow: "Sat" }, // TODAY
  { idx: 4, date: "Oct 18", dow: "Sun" },
  { idx: 5, date: "Oct 19", dow: "Mon" },
  { idx: 6, date: "Oct 20", dow: "Tue" },
  { idx: 7, date: "Oct 21", dow: "Wed" },
  { idx: 8, date: "Oct 22", dow: "Thu" },
  { idx: 9, date: "Oct 23", dow: "Fri" },
  { idx: 10, date: "Oct 24", dow: "Sat" },
  { idx: 11, date: "Oct 25", dow: "Sun" },
  { idx: 12, date: "Oct 26", dow: "Mon" },
  { idx: 13, date: "Oct 27", dow: "Tue" },
  { idx: 14, date: "Oct 28", dow: "Wed" },
  { idx: 15, date: "Oct 29", dow: "Thu" },
  { idx: 16, date: "Oct 30", dow: "Fri" },
  { idx: 17, date: "Oct 31", dow: "Sat" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "AI-bubble fears bite: Nasdaq −2.1%, SOX logs 8th straight down day (worst streak since 2008)", tickers: "NVDA · AMD · SOXX",
    rec: "WATCH — a valuation/positioning reset, not a fundamentals break; scale into quality (NVDA) on stabilization, don't chase the knife down." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "AMD −6% as China-competition and valuation worries hammer chips", tickers: "AMD · NVDA · MU",
    rec: "HOLD/avoid adding — AMD rich into early-Nov earnings; only nibble on a deeper washout with defined risk." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "CoreWeave bond stress reignites AI-financing / neocloud debt worries", tickers: "CRWV · NVDA · ORCL",
    rec: "AVOID levered AI-infra single names; prefer balance-sheet-strong megacaps as the debt angle gets scrutinized." },
  { id: "t4", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Netflix Q3 earnings (after close) — ad-tier growth is the new bar", tickers: "NFLX",
    rec: "Binary (~12% rev-growth guide); size BEFORE the print with defined risk — Zacks model flags no clear beat." },
  { id: "t5", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q3 earnings (after close) — margins + FSD/Cybercab/capex outlook", tickers: "TSLA",
    rec: "EPS seen DOWN YoY (~$0.45 vs $0.50); wide implied move — defined-risk structures only, account for IV crush." },
  { id: "t6", ind: "tech", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Meta, Microsoft & Alphabet Q3 earnings — the AI-capex payoff test", tickers: "META · MSFT · GOOGL",
    rec: "The window's AI verdict: capex must show revenue/cash return. Defined risk into prints; a weak guide deepens the selloff." },
  { id: "t7", ind: "tech", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "Amazon Q3 earnings (after close) — AWS reacceleration watch", tickers: "AMZN",
    rec: "Watch AWS growth + retail margins; use defined-risk structures into the binary, don't pre-position naked." },
  { id: "t8", ind: "tech", dayIdx: 12, future: true, impact: 1, dir: "MIXED",
    headline: "AI-capex read-through builds into megacap earnings week", tickers: "NVDA · AVGO · ORCL",
    rec: "Let the prints set the tone; add on confirmation of capex strength, not the first reflex bounce." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Brent holds ~$106 / WTI firm as Mideast (Hormuz) supply disruption persists", tickers: "XOM · CVX · COP",
    rec: "HOLD core E&P as a supply-shock + inflation hedge; trim strength into weekend headline risk." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 1, dir: "MIXED",
    headline: "EIA weekly petroleum inventories", tickers: "XOM · CVX · USO",
    rec: "Trade draws vs. consensus — geopolitics still dominates fundamentals; EIA Q4 Brent outlook ~$105." },
  { id: "e3", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly crude inventories", tickers: "XOM · CVX · USO",
    rec: "A draw amid constrained Mideast flows reinforces the bull case; a build caps the risk premium." },
  { id: "e4", ind: "energy", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "EIA inventories + positioning into Nov 1 OPEC+ ministerial", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut new directional bets into the Nov 1 OPEC+ decision; use trailing stops on the geopolitical premium." },
  { id: "e5", ind: "energy", dayIdx: 16, future: true, impact: 1, dir: "BULLISH",
    headline: "Energy majors Q3 earnings loom (XOM / CVX in early Nov)", tickers: "XOM · CVX",
    rec: "Position ahead with trailing stops — elevated crude supports cash flow, but a de-escalation unwinds the premium fast." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "UnitedHealth Q3 beats ($4.69 adj EPS vs ~$4.15 est), raises FY guide; UNH +4.7%", tickers: "UNH",
    rec: "BUY-on-dips — managed-care sentiment stabilizing; FY26 adj EPS now ≥$20.50 (RayJay trimmed PT to $450, kept Outperform)." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Roche Enspryng (satralizumab) thyroid-eye-disease PDUFA (priority review)", tickers: "RHHBY",
    rec: "WATCH — incremental Roche catalyst; no clean single-stock US trade, read-through to the TED space." },
  { id: "h3", ind: "health", dayIdx: 3, future: true, impact: 1, dir: "MIXED",
    headline: "MR-141 (phentolamine) presbyopia PDUFA — Opus Genetics / Viatris", tickers: "VTRS · IRD",
    rec: "Small-cap binary; size TINY — approval is largely expected, so the asymmetry is mostly to the downside on a surprise CRL." },
  { id: "h4", ind: "health", dayIdx: 12, future: true, impact: 2, dir: "BULLISH",
    headline: "Bepirovirsen (GSK / Ionis) chronic hep-B PDUFA — ~85% approval odds", tickers: "GSK · IONS",
    rec: "IONS is the higher-beta read; defined-risk only into the Oct 26 decision, breakthrough-therapy tailwind." },
  { id: "h5", ind: "health", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "INO-3107 (Inovio) RRP accelerated-approval PDUFA", tickers: "INO",
    rec: "Micro-cap lottery; avoid outsized size into a binary with thin fundamentals behind it." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "Big-bank Q3 wrap: JPMorgan posts a rare miss; GS / WFC / C mixed", tickers: "JPM · GS · WFC · C",
    rec: "Favor NII-beneficiary money-centers on dips; trade the dispersion, not the index — credit metrics still benign." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "BofA & Morgan Stanley Q3 — trading/markets revenue strong", tickers: "BAC · MS",
    rec: "HOLD quality; take partial profits into pops — capital-markets momentum is the bright spot of the season." },
  { id: "f3", ind: "finance", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Capital One Q3 earnings — consumer-credit read", tickers: "COF",
    rec: "Watch card charge-offs/reserves; a benign read is bullish consumer-finance, a build signals stress." },
  { id: "f4", ind: "finance", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (2pm ET) — NO SEP; cut-vs-hold debate (funds 3.75–4.00%)", tickers: "SPY · QQQ · JPM · TLT",
    rec: "Biggest macro swing in the window; keep dry powder into the presser — Sept minutes leaned toward another move by year-end." },
  { id: "f5", ind: "finance", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "Q3 GDP (advance) + Sept PCE inflation (8:30 ET)", tickers: "SPY · TLT · JPM",
    rec: "Growth/inflation combo the morning after the Fed; a hot PCE pressures rate-cut hopes and long duration." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Consumer names slip as the oil spike + hot CPI dent real spending power", tickers: "AMZN · WMT · TGT",
    rec: "Lean defensive staples over discretionary while real yields rise and gasoline bites household budgets." },
  { id: "c2", ind: "consumer", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Netflix Q3 — streaming/ad-spend as a consumer-ad-budget read", tickers: "NFLX · DIS",
    rec: "Ad-tier traction signals resilient consumer ad budgets; a miss flags belt-tightening." },
  { id: "c3", ind: "consumer", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q3 — EV demand/pricing, the discretionary bellwether", tickers: "TSLA · F · GM",
    rec: "Pricing & margin commentary sets the EV tone; defined risk into the print — stock already −21% YTD." },
  { id: "c4", ind: "consumer", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Holiday-quarter guidance tone into megacap week (e-commerce watch)", tickers: "AMZN · WMT · TGT",
    rec: "Watch holiday-season guide; add selectively on strong e-commerce signals, fade cautious consumer commentary." },
  { id: "c5", ind: "consumer", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Month-end positioning into the holiday season (consumer-sentiment wrap)", tickers: "WMT · TGT · AMZN",
    rec: "Avoid chasing month-end rebalance moves; set up for holiday-season names into November." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "NFLX", name: "Netflix", rank: 1, spot: "~$70 (post-split)", sentiment: "Bullish",
    catalyst: "Q3 earnings — Tue Oct 20 (after close) · BINARY",
    iv: "Elevated into the print (≈±8–9% implied)", liq: "B — mega-cap name on the deep-liquidity list; live chain data unavailable (data host blocked), strikes kept near the money on standard expiries",
    thesis: "Bullish into a binary (ad-tier growth, 33% op-margin guide, 48/65 buy ratings) but with rich IV → prefer defined-risk. Harvest premium below support with a put-credit spread, spread up for cheap upside, and account for IV crush.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $67.5 / buy $62.5 put · Nov 20 '26 · ~$1.50 credit · max loss/capital ~$350 · bullish, range-tolerant, harvests IV" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $70 / sell $75 call · Oct 23 '26 (earnings wk) · ~$2.00 net debit · cost/max loss ~$200" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$72.5 call · Oct 23 '26 · ~$1.00 debit · cost ~$100 · pure earnings-pop lottery (IV crush risk)" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 2, spot: "~$355", sentiment: "Bearish",
    catalyst: "Q3 earnings — Wed Oct 21 (after close) · BINARY",
    iv: "Rich into earnings (≈±8–10% implied)", liq: "B — on the deep-liquidity list (one of the most active single-stock chains); live chain data unavailable (host blocked), strikes kept within ~10% of spot on standard expiries",
    thesis: "Bearish into a binary with rich IV (EPS seen down YoY ~$0.45 vs $0.50, stock −21% YTD, Roadster reveal faded). Get paid via a defined-risk bear-call credit spread; spread down for directional downside while cutting vega.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $385 / buy $395 call · Nov 20 '26 · ~$3.00 credit · max loss/capital ~$700 · harvests IV, bearish-to-neutral" },
      { profile: "Moderate",     strategy: "Bear Put Debit Spread", text: "Buy $350 / sell $330 put · Oct 23 '26 (earnings wk) · ~$7.00 net debit · cost/max loss ~$700 · vega-reduced downside" },
      { profile: "Aggressive",   strategy: "Long Put", text: "$340 put · Oct 23 '26 · ~$5.50 debit · cost ~$550 · directional downside lottery (IV crush risk)" },
    ] },
  { ticker: "META", name: "Meta Platforms", rank: 3, spot: "~$709", sentiment: "Neutral",
    catalyst: "Q3 earnings — Wed Oct 28 (after close) · BINARY",
    iv: "Elevated into the print (≈±6–8% implied)", liq: "B — on the deep-liquidity list; live chain data unavailable (host blocked), high-priced underlying so defined-risk spreads only, strikes near the money on standard expiries",
    thesis: "Neutral/range into a binary dominated by AI-capex scrutiny (−3.7% on Oct 16) → defined-risk, range-tolerant structures. Harvest rich premium with a condor/credit spread; spread up only for a defined-cost upside shot.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $680 / buy $670 put · Nov 20 '26 · ~$3.50 credit · max loss/capital ~$650 · bullish-lean, harvests IV" },
      { profile: "Moderate",     strategy: "Iron Condor", text: "Sell $750c/buy $760c + sell $670p/buy $660p · Oct 30 '26 · ~$3.00 credit · max loss/capital ~$700 · range-bound, harvests crush" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $720 / sell $740 call · Oct 30 '26 · ~$7.00 net debit · cost/max loss ~$700 · defined-cost upside shot" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 4, spot: "~$214", sentiment: "Bullish (contrarian)",
    catalyst: "No in-window binary (earnings ~Nov 17); oversold AI-fear bounce",
    iv: "Moderately elevated on the selloff — no earnings crush risk in window", liq: "B — deepest single-stock chain on the deep-liquidity list; live chain data unavailable (host blocked), strikes within ~10% of spot on the Nov monthly",
    thesis: "Oversold into AI-bubble fear (only −1.4% Fri as the chip selloff eased) with no in-window binary → low crush risk, so buying premium is favored. ITM call for delta, a spread for cheaper defined cost, OTM call as the rebound lottery.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$210 call · Nov 20 '26 · ~$13.50 debit · cost ~$1,350 · Δ≈0.60" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $215 / sell $230 call · Nov 20 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$230 call · Nov 20 '26 · ~$3.50 debit · cost ~$350 · rebound lottery" },
    ] },
  { ticker: "QQQ", name: "Invesco QQQ (Nasdaq-100)", rank: 5, spot: "~$710", sentiment: "Neutral",
    catalyst: "FOMC decision Oct 28 + megacap-earnings week (broad tech macro)",
    iv: "Elevated on the AI-led selloff + event risk", liq: "B — one of the most liquid ETFs/option chains in the market (deep-liquidity list); live chain data unavailable (host blocked), $10-wide strikes near the money on standard expiries",
    thesis: "Range-bound/uncertain into a packed macro week (FOMC with no SEP, AI-valuation jitters, rising yields) → sell premium with defined risk and keep a defined-cost downside hedge in case the AI selloff resumes.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $690 / buy $680 put · Nov 20 '26 · ~$3.00 credit · max loss/capital ~$700 · mildly bullish, harvests premium" },
      { profile: "Moderate",     strategy: "Iron Condor", text: "Sell $730c/buy $740c + sell $685p/buy $675p · Oct 30 '26 · ~$3.50 credit · max loss/capital ~$650 · range-bound through FOMC" },
      { profile: "Aggressive",   strategy: "Bear Put Debit Spread", text: "Buy $705 / sell $685 put · Oct 30 '26 · ~$8.00 net debit · cost/max loss ~$800 · downside hedge if AI selloff resumes" },
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
// today line sits on the boundary between Oct 17 and Oct 18
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Saturday, Oct 17 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Oct 17)
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
