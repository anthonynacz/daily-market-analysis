import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Wednesday, October 21, 2026 (live-researched).
 * Window: last 3 days (Oct 18) → coming 2 weeks (Nov 4).
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

// 18-day axis: Oct 18 .. Nov 4 (last 3 days → coming 2 weeks). Today = index 3 (Oct 21).
const DAYS = [
  { idx: 0, date: "Oct 18", dow: "Sun" },
  { idx: 1, date: "Oct 19", dow: "Mon" },
  { idx: 2, date: "Oct 20", dow: "Tue" },
  { idx: 3, date: "Oct 21", dow: "Wed" }, // TODAY
  { idx: 4, date: "Oct 22", dow: "Thu" },
  { idx: 5, date: "Oct 23", dow: "Fri" },
  { idx: 6, date: "Oct 24", dow: "Sat" },
  { idx: 7, date: "Oct 25", dow: "Sun" },
  { idx: 8, date: "Oct 26", dow: "Mon" },
  { idx: 9, date: "Oct 27", dow: "Tue" },
  { idx: 10, date: "Oct 28", dow: "Wed" },
  { idx: 11, date: "Oct 29", dow: "Thu" },
  { idx: 12, date: "Oct 30", dow: "Fri" },
  { idx: 13, date: "Oct 31", dow: "Sat" },
  { idx: 14, date: "Nov 1", dow: "Sun" },
  { idx: 15, date: "Nov 2", dow: "Mon" },
  { idx: 16, date: "Nov 3", dow: "Tue" },
  { idx: 17, date: "Nov 4", dow: "Wed" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Netflix −6% after hours despite an earnings beat; megacap tech wobbles", tickers: "NFLX",
    rec: "Don't chase the dip into a crowded tape — let the post-earnings gap base before adding." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Super Micro +10% after raising AI-server guidance", tickers: "SMCI",
    rec: "Momentum/meme-risk name — take partial profits into the pop, size small, use stops." },
  { id: "t3", ind: "tech", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "Meta & Tesla report tonight (after close) — ±6–7% implied, Nasdaq swing risk", tickers: "META · TSLA",
    rec: "Size before the print, not after; prefer defined-risk spreads — IV crush punishes naked long premium." },
  { id: "t4", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Apple cut to Hold at Loop Capital into FQ4", tickers: "AAPL",
    rec: "WATCH — let the Nov 2 print set direction; don't add ahead of a downgrade-flagged quarter." },
  { id: "t5", ind: "tech", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Semis pre-earnings positioning; Susquehanna sees modest upside", tickers: "NVDA · AMD · AVGO",
    rec: "Hold quality (NVDA); keep dry powder for AMD's Nov 3 print rather than chasing the group." },
  { id: "t6", ind: "tech", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft & Alphabet Q3 (after close) — AI-capex & cloud-growth tell", tickers: "MSFT · GOOGL",
    rec: "The week's AI read-through; use defined-risk structures, a strong Azure/Cloud guide re-rates the group." },
  { id: "t7", ind: "tech", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "Amazon Q3 (after close) — AWS re-acceleration & margin watch", tickers: "AMZN",
    rec: "Wait for the print; AWS growth + retail margin are the swing factors — spread up, don't buy naked calls." },
  { id: "t8", ind: "tech", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "Apple FQ4 (after close) — iPhone 17 demand & China read", tickers: "AAPL",
    rec: "Downgrade-flagged; stay defined-risk / range-tolerant into the binary rather than directional." },
  { id: "t9", ind: "tech", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "AMD Q3 (after close) — ±~12% implied; AI-GPU ramp in focus", tickers: "AMD",
    rec: "Big binary — a clean MI-series guide is bullish; size as a spread, the implied move is huge." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e0", ind: "energy", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Oil gaps up as Saudi Shaybah oilfield targeted; supply-shock fears", tickers: "XOM · OXY · CVX",
    rec: "Keep a tactical energy overweight as geopolitical insurance; trail stops — a ceasefire reverses it fast." },
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Brent tops $111 on Hormuz/Saudi strikes; energy sector leads the tape", tickers: "XOM · CVX · OXY",
    rec: "Hold core E&P for the supply premium; take partial profits if up big into weekend headline risk." },
  { id: "e2", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "WTI eases to ~$102 on US–Iran diplomacy headlines", tickers: "XOM · USO",
    rec: "Expect two-way volatility — the Hormuz premium unwinds fast on any de-escalation; don't over-size." },
  { id: "e3", ind: "energy", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly crude inventories", tickers: "XOM · CVX · USO",
    rec: "Use the print to time entries; a draw amid the Mideast risk reinforces the bull case." },
  { id: "e4", ind: "energy", dayIdx: 7, future: true, impact: 2, dir: "BULLISH",
    headline: "Strait of Hormuz risk premium persists over the weekend", tickers: "XOM · OXY · USO",
    rec: "Carry a small energy hedge through the weekend; a surprise ceasefire is the main downside risk." },
  { id: "e5", ind: "energy", dayIdx: 12, future: true, impact: 3, dir: "BULLISH",
    headline: "ExxonMobil Q3 earnings — ~$4.5B products/refining windfall expected", tickers: "XOM",
    rec: "BUY-the-strength candidate; refining margins + high crude underpin the quarter — defined-risk calls into it." },
  { id: "e6", ind: "energy", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Chevron Q3 earnings", tickers: "CVX",
    rec: "Trade alongside XOM; watch upstream realizations vs. the refining tailwind." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Healthcare rotation: XLV hits a record as money leaves high-multiple tech", tickers: "XLV · UNH · JNJ",
    rec: "Rotation tailwind for defensives; add quality managed-care / pharma on the leadership handoff, don't chase extended names." },
  { id: "h2", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "UnitedHealth & 3M lift the Dow; defensives bid as tech cools", tickers: "UNH · MMM",
    rec: "UNH's Q3 beat (EPS $4.69 vs $4.14) supports the turnaround thesis — hold / add on pullbacks." },
  { id: "h3", ind: "health", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Q3 pharma earnings wave begins (PFE / MRK window)", tickers: "PFE · MRK",
    rec: "Favor names with pipeline catalysts over patent-cliff exposure; size before, not after, each print." },
  { id: "h4", ind: "health", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Big-pharma prints — LLY / ABBV GLP-1 & immunology read", tickers: "LLY · ABBV",
    rec: "Expect GLP-1 volatility; favor LLY on volume/guide, fade knee-jerk moves — keep positions defined-risk." },
  { id: "h5", ind: "health", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Managed-care & pharma earnings digestion", tickers: "UNH · CVS",
    rec: "Let guidance settle; use any overreaction to trim or add rather than trading the first move." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f0", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Bank stocks firm as a strong Q3 earnings season wraps", tickers: "JPM · WFC · C",
    rec: "Hold NII-beneficiary money-center banks; take partial profits into strength ahead of the FOMC." },
  { id: "f1", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Dow jumps ~530 pts as UnitedHealth & 3M lead; blue chips bid", tickers: "JPM · BAC · GS",
    rec: "Breadth is improving off defensives — favor quality financials, don't chase a one-day index pop." },
  { id: "f2", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "10Y yield elevated near ~5% ahead of the FOMC", tickers: "JPM · BAC · TLT",
    rec: "Higher-for-longer favors asset-sensitive banks; avoid adding long-duration/TLT before the 10/28 decision." },
  { id: "f3", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision (2pm ET) — hold expected at 3.75–4.00% (Warsh)", tickers: "SPY · JPM · TLT",
    rec: "Biggest macro swing in the window; keep dry powder into the statement, dots & presser." },
  { id: "f4", ind: "finance", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Fed press conference (2:30pm) — December-cut guidance in focus", tickers: "SPY · QQQ",
    rec: "Trade the presser, not the headline; a dovish December tilt lifts duration & growth, hawkish hits both." },
  { id: "f5", ind: "finance", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Q3 GDP advance estimate", tickers: "SPY · DIA",
    rec: "Context for the Fed path; a hot print firms yields and the higher-for-longer trade." },
  { id: "f6", ind: "finance", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "Core PCE — the Fed's preferred inflation gauge", tickers: "SPY · TLT",
    rec: "The post-FOMC confirmation; a cool print validates a December cut, a hot one re-prices rates higher." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c0", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Consumer staples & defensives catch the rotation bid", tickers: "PG · KO · WMT",
    rec: "Defensive rotation supports staples; hold quality dividend compounders as a tech hedge." },
  { id: "c1", ind: "consumer", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Conference Board consumer confidence (October)", tickers: "XLY · WMT · AMZN",
    rec: "A soft read pressures discretionary; a firm read supports holiday-season retail optimism." },
  { id: "c2", ind: "consumer", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Holiday-season retail guidance in focus into earnings", tickers: "WMT · TGT · AMZN",
    rec: "Favor share-gainers (WMT/AMZN) over margin-pressured names; wait for guidance tone before adding." },
  { id: "c3", ind: "consumer", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "October auto sales trickle in", tickers: "F · GM · TSLA",
    rec: "Watch affordability & incentive trends; lean to hybrid/EV-strong mixes, trim volume-eroding names." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "MSFT", name: "Microsoft", rank: 1, spot: "~$532", sentiment: "Bullish",
    catalyst: "FQ1 earnings — Wed Oct 28 (after close) · BINARY (Azure / AI capex)",
    iv: "Elevated into earnings · ±~6% implied — RICH (crush risk)",
    liq: "B — deep-liquidity list (MSFT); live chain data unavailable, strikes kept <10% of spot on the Nov 20 monthly",
    thesis: "Bullish into a binary with rich IV → avoid naked long calls (max crush). Cut vega with a debit spread, or get paid to be long via a defined-risk put-credit spread. BMO PT lifted to $600.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $530 / sell $550 · Nov 20 '26 · ~$9.00 net debit · cost/max loss ~$900 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $520 / buy $510 · Nov 20 '26 · ~$4.00 credit · max loss/capital ~$600 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$550 call · Nov 20 '26 · ~$9.00 debit · cost ~$900 · earnings upside" },
    ] },
  { ticker: "GOOGL", name: "Alphabet", rank: 2, spot: "~$340", sentiment: "Bullish",
    catalyst: "Q3 earnings — Wed Oct 28 (after close) · BINARY (Cloud / AI)",
    iv: "Elevated into earnings · ±~7% implied — RICH",
    liq: "B — deep-liquidity list (GOOGL); live chain data unavailable, strikes kept <10% of spot on the Nov 20 monthly",
    thesis: "Cloud/Gemini momentum into a binary, but an antitrust overhang caps the tape. Defined-risk only: spread up to cut vega, or sell a put spread below support to harvest the crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $335 / sell $355 · Nov 20 '26 · ~$9.00 net debit · cost/max loss ~$900" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $330 / buy $320 · Nov 20 '26 · ~$4.00 credit · max loss/capital ~$600 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$355 call · Nov 20 '26 · ~$8.00 debit · cost ~$800" },
    ] },
  { ticker: "AMZN", name: "Amazon", rank: 3, spot: "~$263", sentiment: "Bullish",
    catalyst: "Q3 earnings — Thu Oct 29 (after close) · BINARY (AWS re-accel)",
    iv: "Elevated into earnings · ±~7% implied — RICH",
    liq: "B — deep-liquidity list (AMZN); live chain data unavailable, strikes kept <10% of spot on the Nov 20 monthly",
    thesis: "AWS growth + retail-margin leverage into a binary. Rich IV → spread up for defined, vega-light upside, and get paid via a put-credit spread below the gap.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $260 / sell $275 · Nov 20 '26 · ~$6.50 net debit · cost/max loss ~$650" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $255 / buy $245 · Nov 20 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$270 call · Nov 20 '26 · ~$6.00 debit · cost ~$600" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 4, spot: "~$178", sentiment: "Bullish",
    catalyst: "Q3 earnings — ~Fri Oct 30 + live oil supply-shock (Brent ~$111)",
    iv: "Moderately elevated · earnings + crude vol · ±~4–5% implied",
    liq: "B — deep-liquidity list (XOM); live chain data unavailable, strikes kept <10% of spot on the Nov 20 monthly",
    thesis: "Two stacked bullish drivers — a Hormuz/Saudi supply-shock crude premium and a refining windfall (~$4.5B products) into Q3. Up 49% YTD; pair a defined-cost call spread with a paid-to-own put-credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $175 / sell $185 · Nov 20 '26 · ~$4.50 net debit · cost/max loss ~$450" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $175 / buy $165 · Nov 20 '26 · ~$3.00 credit · max loss/capital ~$700 · paid to accumulate" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$185 call · Nov 20 '26 · ~$2.50 debit · cost ~$250 · supply-shock upside" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 5, spot: "~$339", sentiment: "Neutral",
    catalyst: "FQ4 earnings — Mon Nov 2 (after close) · BINARY (iPhone 17 / China)",
    iv: "Elevated into earnings · ±~5% implied",
    liq: "B — deep-liquidity list (AAPL); live chain data unavailable, strikes kept <10% of spot on the Nov 20 monthly",
    thesis: "Loop Capital cut to Hold and tech is rotating out → fade the binary with range-tolerant, defined-risk structures. Sell premium outside the expected move; keep directional size cheap.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $325 / buy $315 · Nov 20 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish-leaning, range-tolerant" },
      { profile: "Moderate",     strategy: "Iron Condor", text: "Sell $360c/buy $370c + sell $320p/buy $310p · Nov 20 '26 · ~$3.00 net credit · max loss/capital ~$700 · neutral/range" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $340 / sell $355 · Nov 20 '26 · ~$6.00 net debit · cost/max loss ~$600" },
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
// today line sits on the boundary between Oct 21 and Oct 22
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Wednesday, Oct 21 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Oct 21)
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
