import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Sunday, June 28, 2026 (live-researched).
 * Window: last 3 days (Jun 25) → coming 2 weeks (Jul 12).
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

// 18-day axis: Jun 25 .. Jul 12 (last 3 days → coming 2 weeks). Today = index 3 (Jun 28).
const DAYS = [
  { idx: 0, date: "Jun 25", dow: "Thu" },
  { idx: 1, date: "Jun 26", dow: "Fri" },
  { idx: 2, date: "Jun 27", dow: "Sat" },
  { idx: 3, date: "Jun 28", dow: "Sun" }, // TODAY
  { idx: 4, date: "Jun 29", dow: "Mon" },
  { idx: 5, date: "Jun 30", dow: "Tue" },
  { idx: 6, date: "Jul 1", dow: "Wed" },
  { idx: 7, date: "Jul 2", dow: "Thu" },
  { idx: 8, date: "Jul 3", dow: "Fri" },
  { idx: 9, date: "Jul 4", dow: "Sat" },
  { idx: 10, date: "Jul 5", dow: "Sun" },
  { idx: 11, date: "Jul 6", dow: "Mon" },
  { idx: 12, date: "Jul 7", dow: "Tue" },
  { idx: 13, date: "Jul 8", dow: "Wed" },
  { idx: 14, date: "Jul 9", dow: "Thu" },
  { idx: 15, date: "Jul 10", dow: "Fri" },
  { idx: 16, date: "Jul 11", dow: "Sat" },
  { idx: 17, date: "Jul 12", dow: "Sun" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Micron FQ3 blowout on HBM/AI memory; MU +15.7%", tickers: "MU",
    rec: "Ride the memory up-cycle but it's extended — add on dips, don't chase a 16% pop." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Global tech sell-off on AI data-center cost fears; Nasdaq's 5th straight down day", tickers: "NVDA · MSFT · AAPL",
    rec: "Rotation underway — trim crowded megacap, keep quality (NVDA); let the AI-cost reset play out." },
  { id: "t3", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Apple & Microsoft hike hardware prices (MacBook/iPad, Xbox) — cost pass-through fear", tickers: "AAPL · MSFT",
    rec: "Watch demand elasticity; AAPL already bounced +3% — fade strength rather than chase the rebound." },
  { id: "t4", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "OpenAI reportedly delays IPO to 2027 — AI-sentiment overhang", tickers: "MSFT · NVDA",
    rec: "Sentiment, not fundamentals; use AI-funded names' weakness to build quality on a budget." },
  { id: "t5", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "June jobs report (8:30 ET) — rate read for high-multiple tech", tickers: "NVDA · MSFT · GOOGL",
    rec: "De-risk slightly pre-print; a soft number eases rate pressure on megacap multiples, a hot one bites." },
  { id: "t6", ind: "tech", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through into Q2 season (hyperscaler spend tells)", tickers: "NVDA · AVGO · MU",
    rec: "Wait for confirmation of capex durability; re-add semis on guidance, not the first bounce." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Crude collapses — Brent ~$72 / WTI ~$69, lowest since Feb, on US-Iran peace & Hormuz reopening", tickers: "XOM · CVX · COP",
    rec: "Supply-risk premium is unwinding fast — trim E&P / avoid chasing; favor downstream & integrateds over pure crude beta." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Saudi ramps Ras Tanura loadings; Gulf exports back to ~75% of prewar", tickers: "XOM · CVX · USO",
    rec: "More barrels = lower-for-longer crude; keep energy underweight until the supply wave is priced." },
  { id: "e3", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (inventories)", tickers: "XOM · CVX · USO",
    rec: "A big build confirms the bearish supply turn; only a sharp draw stabilizes crude near current lows." },
  { id: "e4", ind: "energy", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "OPEC+ monthly ministerial — output-policy decision after the price slide", tickers: "XOM · CVX · OXY · USO",
    rec: "Pivotal: another hike deepens the rout, a pause/cut is the only near-term bullish catalyst — cut directional size into it." },
  { id: "e5", ind: "energy", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "EIA Short-Term Energy Outlook — 2026 price-deck revision", tickers: "XOM · CVX · USO",
    rec: "Likely trims the crude forecast; treat lower guidance as confirmation, not a new shock." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "EMA CHMP positive opinion for Lilly's Jaypirca in CLL; LLY +6.7%", tickers: "LLY",
    rec: "Clean regulatory win + US CLL decision pending 2H — hold LLY; use spreads, the stock is richly priced." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Medicare opens GLP-1 access — durable demand tailwind", tickers: "LLY · NVO",
    rec: "Structural volume positive for incretins; favor LLY's pipeline breadth over NVO on competitive risk." },
  { id: "h3", ind: "health", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "GLP-1 pipeline watch — orforglipron / retatrutide data flow", tickers: "LLY · NVO · VKTX",
    rec: "Expect headline-driven swings; size before catalysts, fade knee-jerk moves in the smaller names." },
  { id: "h4", ind: "health", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Pharma Q2 pre-season — managed-care & drug-pricing headlines", tickers: "UNH · PFE · MRK",
    rec: "Stay selective; lean to GLP-1 / oncology winners, stay cautious on managed-care margins." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Fed stress test — all 32 banks pass; capital-return path cleared", tickers: "JPM · GS · MS · WFC",
    rec: "Bullish for big banks — buybacks & dividends unconstrained; favor capital-return leaders into Q2 prints." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Banks lift payouts: JPM $50B buyback +10% div, GS +11%, MS +15% +$20B, WFC +11%", tickers: "JPM · GS · MS · WFC",
    rec: "Strong shareholder-return signal; accumulate quality money-centers (JPM) on any market-wide dip." },
  { id: "f3", ind: "finance", dayIdx: 6, future: true, impact: 2, dir: "BULLISH",
    headline: "Capital-return programs take effect (JPM $50B buyback live Jul 1)", tickers: "JPM · GS · MS",
    rec: "Buyback bid is a tailwind into earnings; hold core bank exposure through the start of the program." },
  { id: "f4", ind: "finance", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "June jobs report (8:30 ET) — rate-path read for bank NII", tickers: "JPM · BAC · WFC",
    rec: "Biggest macro swing of the window; a firm print supports NII-sensitive banks, a weak one revives cut bets." },
  { id: "f5", ind: "finance", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "June FOMC minutes — color on the rate path after the Jun 17 hold", tickers: "JPM · BAC · SPY",
    rec: "Watch for the hawk/dove tilt; keep dry powder for the bank-earnings kickoff the following week." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Amazon Prime Day (Jun 23–26): $8.3B day-1 (+5.3%); spend shifts to staples", tickers: "AMZN · WMT · TGT",
    rec: "Record top-line but a cautious, value-seeking consumer — constructive for WMT/AMZN scale, wary on discretionary." },
  { id: "c2", ind: "consumer", dayIdx: 0, future: false, impact: 1, dir: "MIXED",
    headline: "Walmart & Target run counter-promotions vs Prime Day", tickers: "WMT · TGT",
    rec: "Traffic-positive but margin-pressuring; favor WMT's scale, stay selective on TGT's turnaround." },
  { id: "c3", ind: "consumer", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Nike FQ4 + FY26 earnings (Tue Jun 30) — turnaround test; tariff-refund gain flagged", tickers: "NKE",
    rec: "BINARY near multi-year lows; expectations are washed out — size before the print, defined-risk only." },
  { id: "c4", ind: "consumer", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "June jobs report — spending-power read for retail", tickers: "AMZN · WMT · TGT",
    rec: "A soft labor print pressures discretionary; lean to staples-heavy retailers if hiring cools." },
  { id: "c5", ind: "consumer", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Delta FQ2 earnings (Fri Jul 10) — travel-demand bellwether", tickers: "DAL · UAL · AAL",
    rec: "Sets the tone for airlines/leisure; strong premium-cabin demand is bullish, a soft guide hits the group." },

  // ---- FORWARD / CROSS-INDUSTRY (week 2: Jul 6–12) ------------------------
  { id: "x1", ind: "consumer", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "US markets CLOSED Fri Jul 3 (early close Jul 2) for Independence Day", tickers: "SPY · QQQ",
    rec: "Thin, headline-sensitive tape around the holiday; avoid initiating size into low liquidity." },
  { id: "x2", ind: "finance", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Pre-positioning into bank Q2 earnings (JPM/WFC/C kick off ~Jul 14)", tickers: "JPM · WFC · C",
    rec: "Set entries before the prints; capital-return + NII tone are the swing factors — keep powder dry." },
  { id: "x3", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Semis / AI-memory momentum check after Micron's beat", tickers: "MU · NVDA · AVGO",
    rec: "Trail stops on extended winners; let the next round of capex data confirm before adding." },
  { id: "x4", ind: "energy", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Crude stabilization watch after the supply-driven slide", tickers: "XOM · CVX · USO",
    rec: "Wait for a base to form; a failed bounce keeps the energy underweight intact." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "JPM", name: "JPMorgan Chase", rank: 1, spot: "~$329", sentiment: "Bullish",
    catalyst: "Stress test PASS → $50B buyback + 10% div hike live Jul 1; Q2 earnings ~Jul 14",
    iv: "Moderate (~24%) — no near binary until earnings", liq: "Deep, penny-wide money-center chain; huge OI",
    thesis: "All 32 banks cleared the stress test and JPM authorized a $50B buyback that goes live Jul 1 — a steady bid into earnings. Moderate IV favors defined-risk debit/credit structures.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $325 / sell $340 · Aug 21 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $320 / buy $310 · Jul 17 '26 · ~$3.00 credit · max loss/capital ~$700 · buyback bid as support" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$335 call · Jul 17 '26 · ~$4.50 debit · cost ~$450 · rides into earnings" },
    ] },
  { ticker: "NKE", name: "Nike", rank: 2, spot: "~$41", sentiment: "Bullish (contrarian)",
    catalyst: "FQ4 + FY26 earnings — Tue Jun 30 (after close) · BINARY",
    iv: "~55% (±~11% implied) — rich into the print", liq: "Deep mega-cap chain; low-$ premiums",
    thesis: "Washed-out turnaround near multi-year lows with a tariff-refund gain flagged and rich IV → get paid via a defined-risk put-credit spread; cheap call for the asymmetric pop. Cash-secured put NOT used — even the $35 strike posts ~$3,500 collateral, over the $1,500 cap.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $39 / buy $35 · Jul 17 '26 · ~$1.20 credit · max loss/capital ~$280 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $41 / sell $46 · Jul 17 '26 · ~$1.80 net debit · cost/max loss ~$180" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$44 call · Jul 2 '26 · ~$0.80 debit · cost ~$80 · pure earnings pop" },
    ] },
  { ticker: "MU", name: "Micron", rank: 3, spot: "~$1,132", sentiment: "Bullish",
    catalyst: "FQ3 blowout (+15.7%) on HBM/AI memory — momentum continuation",
    iv: "Crushed post-earnings (~50% from ~80%)", liq: "Very deep, active semi chain; tight $-wide strikes",
    thesis: "Earnings risk is behind it and IV has collapsed, so the binary is gone — play continuation of the AI-memory up-cycle. High share price means NARROW spreads keep capital inside the cap.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1120 / sell $1140 · Jul 17 '26 · ~$10 net debit · cost/max loss ~$1,000" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1100 / buy $1085 · Jul 17 '26 · ~$5 credit · max loss/capital ~$1,000 · buy-the-dip" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1140 / sell $1155 · Jul 10 '26 · ~$6 net debit · cost/max loss ~$600" },
    ] },
  { ticker: "LLY", name: "Eli Lilly", rank: 4, spot: "~$1,203", sentiment: "Bullish",
    catalyst: "EMA CHMP win for Jaypirca (+6.7%) + Medicare GLP-1 access; US CLL decision 2H",
    iv: "Moderate (~35%) — no earnings until early Aug", liq: "Deep large-cap pharma chain; tight $-wide strikes",
    thesis: "Stacked regulatory + reimbursement wins with no near-term binary. Bullish + moderate IV favors debit spreads; the very high share price forces NARROW widths to stay under the cap.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1190 / sell $1210 · Jul 17 '26 · ~$10 net debit · cost/max loss ~$1,000" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1170 / buy $1155 · Jul 17 '26 · ~$6 credit · max loss/capital ~$900 · paid to accumulate" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1210 / sell $1225 · Jul 10 '26 · ~$6 net debit · cost/max loss ~$600" },
    ] },
  { ticker: "XOM", name: "Exxon Mobil", rank: 5, spot: "~$137", sentiment: "Bearish",
    catalyst: "Crude collapse — Brent ~$72 / WTI ~$69 on US-Iran peace + Hormuz reopening; OPEC+ ahead",
    iv: "Moderate, firming on the crude move", liq: "Deep, liquid integrated-energy chain; tight spreads",
    thesis: "The geopolitical supply premium is unwinding as Gulf exports normalize and OPEC+ keeps adding barrels — a lower-for-longer crude tape pressures E&P. Defined-risk bearish structures only; no naked calls.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread", text: "Buy $135 / sell $125 · Aug 21 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Moderate",     strategy: "Bear Call Credit Spread", text: "Sell $140 / buy $145 · Jul 17 '26 · ~$1.60 credit · max loss/capital ~$340 · fade the bounce" },
      { profile: "Aggressive",   strategy: "Long Put (OTM)", text: "$133 put · Jul 17 '26 · ~$2.00 debit · cost ~$200 · into OPEC+" },
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
// today line sits on the boundary between Jun 28 and Jun 29
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Sunday, Jun 28 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jun 28)
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
