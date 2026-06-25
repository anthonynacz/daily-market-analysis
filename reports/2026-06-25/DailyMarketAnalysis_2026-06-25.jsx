import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Thursday, June 25, 2026 (live-researched).
 * Window: last 3 days (Jun 22) → coming 2 weeks (Jul 9).
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

// 18-day axis: Jun 22 .. Jul 9 (last 3 days → coming 2 weeks). Today = index 3 (Jun 25).
const DAYS = [
  { idx: 0, date: "Jun 22", dow: "Mon" },
  { idx: 1, date: "Jun 23", dow: "Tue" },
  { idx: 2, date: "Jun 24", dow: "Wed" },
  { idx: 3, date: "Jun 25", dow: "Thu" }, // TODAY
  { idx: 4, date: "Jun 26", dow: "Fri" },
  { idx: 5, date: "Jun 27", dow: "Sat" },
  { idx: 6, date: "Jun 28", dow: "Sun" },
  { idx: 7, date: "Jun 29", dow: "Mon" },
  { idx: 8, date: "Jun 30", dow: "Tue" },
  { idx: 9, date: "Jul 1", dow: "Wed" },
  { idx: 10, date: "Jul 2", dow: "Thu" },
  { idx: 11, date: "Jul 3", dow: "Fri" },
  { idx: 12, date: "Jul 4", dow: "Sat" },
  { idx: 13, date: "Jul 5", dow: "Sun" },
  { idx: 14, date: "Jul 6", dow: "Mon" },
  { idx: 15, date: "Jul 7", dow: "Tue" },
  { idx: 16, date: "Jul 8", dow: "Wed" },
  { idx: 17, date: "Jul 9", dow: "Thu" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Global tech rout: KOSPI −10%, Samsung/SK Hynix dumped on 'overheated' semis", tickers: "NVDA · MU · TSM",
    rec: "Don't chase the falling knife; the reset is sentiment/regulatory, not fundamental — scale into quality (NVDA) gradually." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "BofA rate-hike note + Asia selloff hammer Mag-7; Nasdaq −0.4% to ~25,476", tickers: "NVDA · MSFT · AAPL",
    rec: "Trim crowded AI longs into strength; keep dry powder — July earnings face a high bar after this rotation." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "Micron FQ3 blowout (rev +268% y/y) into record ~$1,134; 17% implied move priced", tickers: "MU",
    rec: "Results are spectacular but the bar is extreme — wait for the post-print reaction to settle before committing." },
  { id: "t4", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "MU fades despite beat-and-raise as 'sell-the-news' grips memory names", tickers: "MU · WDC · STX",
    rec: "A flat-to-down reaction on a blowout signals exhaustion; let it base — don't pay up the day after." },
  { id: "t5", ind: "tech", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Chip-sector stabilization watch after the overheating reset", tickers: "NVDA · AVGO · TSM",
    rec: "Wait for two green days before re-adding; the snapback can be sharp but the first bounce often fails." },
  { id: "t6", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Jobs report + ISM set the tone for high-multiple tech post-rout", tickers: "NVDA · MSFT · QQQ",
    rec: "A cool labor print eases rate-hike fears and helps multiples; a hot one extends the de-rating — stay nimble." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "WTI dives below $70 (Brent ~$73.50) as US-Iran peace reopens the Strait of Hormuz", tickers: "XOM · CVX · COP",
    rec: "The war risk-premium is unwinding fast — fade rallies in E&P; lighten energy overweight into the de-escalation." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Energy sector slides >10% off June highs as crude risk premium evaporates", tickers: "XOM · CVX · OXY",
    rec: "Trend is down; avoid bottom-fishing the majors until crude stabilizes — a ceasefire breakdown is the only fast reversal." },
  { id: "e3", ind: "energy", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status — demand read amid Hormuz reopening", tickers: "XOM · USO",
    rec: "Watch builds vs. consensus; with supply fears gone, a soft demand print pressures crude further." },
  { id: "e4", ind: "energy", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "Ceasefire-durability watch — any breakdown snaps the risk premium back", tickers: "XOM · CVX · USO",
    rec: "Keep only a small tactical hedge; size it as insurance, not a core long, with tight trailing stops." },
  { id: "e5", ind: "energy", dayIdx: 14, future: true, impact: 2, dir: "BEARISH",
    headline: "OPEC+ supply + Hormuz-restart follow-through keep crude offered", tickers: "XOM · CVX · USO",
    rec: "Returning Iranian/OPEC barrels into soft demand favor the short side; rallies are sell opportunities near-term." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Lilly oral GLP-1 'Foundayo' ramp + $25B+ M&A spree dominate pharma flows", tickers: "LLY · NVO",
    rec: "LLY remains the GLP-1 franchise leader; buy weakness — the oral pill widens its access moat vs. NVO." },
  { id: "h2", ind: "health", dayIdx: 0, future: false, impact: 1, dir: "MIXED",
    headline: "Employer GLP-1 coverage survey flags 2027 reimbursement risk", tickers: "LLY · NVO · CVS",
    rec: "A 2027 issue, not a 2026 one — don't overreact, but watch formulary headlines for the bigger payers." },
  { id: "h3", ind: "health", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Managed-care / PBM headlines into quarter-end rebalancing", tickers: "UNH · CVS · HUM",
    rec: "Stay selective in managed care; use quarter-end volatility to add quality, avoid the weakest MA-exposed names." },
  { id: "h4", ind: "health", dayIdx: 15, future: true, impact: 1, dir: "BULLISH",
    headline: "Biotech M&A momentum continues — 2026 on track for a record deal year", tickers: "XBI · PFE · MRK",
    rec: "Tailwind for SMID biotech (XBI); tilt to de-risked assets that plug big-pharma revenue gaps." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Fed stress test: big banks pass; JPM unveils $50B buyback, GS hikes div to $5.00", tickers: "JPM · GS · BAC · WFC",
    rec: "Capital-return wave is a clear positive — favor JPM/GS on buybacks; buy dips into the July bank-earnings ramp." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Post-CCAR capital-return wave lifts financials; JPM ~$335, GS near record ~$1,099", tickers: "JPM · MS · GS",
    rec: "Well-capitalized banks raising payouts is a multi-month tailwind; accumulate quality on macro-driven pullbacks." },
  { id: "f3", ind: "finance", dayIdx: 9, future: true, impact: 2, dir: "BULLISH",
    headline: "GS dividend hike effective Jul 1; bank capital returns kick in", tickers: "GS · JPM · MS",
    rec: "Income + buyback support cushions downside; hold core bank exposure through the data-heavy first week of July." },
  { id: "f4", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "June jobs report (8:30 ET, pulled forward pre-holiday) — first big macro test", tickers: "JPM · BAC · SPY",
    rec: "Biggest swing risk of the window; a hot print revives the Fed-hike tilt (good for NII banks, bad for duration)." },
  { id: "f5", ind: "finance", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "June FOMC minutes — detail behind the dot-plot's flip toward a hike", tickers: "JPM · SPY · TLT",
    rec: "Parse for how many officials favor a 2026 hike; a hawkish read steepens the rate path — keep duration light." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Consumer confidence rebounds to 48.9 (off record low) on cheaper gas, still subdued", tickers: "WMT · TGT · AMZN",
    rec: "A bounce off the lows, not an all-clear — stay with defensive value-retail leaders (WMT) over discretionary." },
  { id: "c2", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Tesla −12% in 4 weeks as Q2 delivery optimism collides with an FSD safety probe", tickers: "TSLA",
    rec: "Two-sided into deliveries — don't pre-position directionally; let the print clear the FSD-probe overhang first." },
  { id: "c3", ind: "consumer", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Nike FQ4 earnings (after close) — US turnaround + one-time tariff-refund gain", tickers: "NKE",
    rec: "Contrarian setup near multi-year lows; size before the print, don't chase — guidance, not the refund, is the tell." },
  { id: "c4", ind: "consumer", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q2 deliveries (~400–420k est.) — robotaxi ramp vs FSD-probe overhang", tickers: "TSLA",
    rec: "A beat with robotaxi color re-rates the AI narrative; a miss into the probe deepens the slide — use defined risk." },
  { id: "c5", ind: "consumer", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Holiday-week retail / promo read into the July 4 weekend", tickers: "WMT · TGT · AMZN",
    rec: "Track traffic and discounting tone; share-gainers (WMT/AMZN) over margin-pressured department stores." },

  // ---- FORWARD MACRO CATALYSTS (week 2: Jul 1–9) --------------------------
  { id: "x1", ind: "finance", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing PMI + JOLTS — growth & labor pulse before payrolls", tickers: "SPY · XLI · JPM",
    rec: "Sets expectations into the jobs print; a weak ISM with soft JOLTS eases hike fears — watch the bond reaction." },
  { id: "x2", ind: "tech", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "US markets closed for Independence Day (observed Fri Jul 3) — thin liquidity", tickers: "SPY · QQQ",
    rec: "Expect light volume around the holiday; avoid initiating new size into illiquid, headline-sensitive sessions." },
  { id: "x3", ind: "energy", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "EIA inventories + crude stabilization watch post-Hormuz reopening", tickers: "XOM · CVX · USO",
    rec: "Look for crude to find a floor; only then consider re-entering energy — fade strength until it does." },
  { id: "x4", ind: "consumer", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Post-Nike read-through across athletic / discretionary retail", tickers: "NKE · LULU · DKS",
    rec: "Let Nike's guidance reset peer expectations; trade the relative winners, avoid the names it flags as soft." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "NKE", name: "Nike", rank: 1, spot: "~$42 (Jun 24 close)", sentiment: "Bullish (contrarian)",
    catalyst: "FQ4 earnings — Tue Jun 30 (after close) · BINARY",
    iv: "~52% (±~11% implied) — RICH on a cheap stock", liq: "Deep mega-cap chain; low-$ premiums, penny-wide spreads",
    thesis: "Max-pessimism turnaround near multi-year lows into a binary with rich IV → get paid to accumulate via a defined-risk put-credit spread; spread up for the asymmetric pop and cut vega. Guidance (not the one-time tariff refund) is the tell.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$40 call · Jul 17 '26 · ~$3.20 debit · cost ~$320 · Δ≈0.62" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $40 / buy $36 · Jul 17 '26 · ~$1.20 credit · max loss/capital ~$280 · paid to accumulate, harvests IV crush" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $42 / sell $48 · Jul 2 '26 · ~$1.60 net debit · cost/max loss ~$160 · pure earnings pop" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 2, spot: "~$376 (Jun 24 close)", sentiment: "Neutral",
    catalyst: "Q2 deliveries (~400–420k est.) — ~Thu Jul 2 · BINARY",
    iv: "Elevated into the print (±~9% implied)", liq: "Deepest single-name options chain; huge OI, tight spreads",
    thesis: "Two-sided binary — robotaxi-ramp optimism vs an FSD safety probe, after a −12% month → harvest the elevated IV with defined-risk, range-tolerant structures rather than betting direction. Cheap OTM call only as a lottery on a clean delivery beat.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $355 / buy $345 · Jul 17 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish-tilt, range-tolerant" },
      { profile: "Moderate",     strategy: "Iron Condor", text: "Sell $400c/buy $410c + sell $350p/buy $340p · Jul 10 '26 · ~$3.50 credit · max loss/capital ~$650 · harvests delivery IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$400 call · Jul 2 '26 · ~$6.00 debit · cost ~$600 · delivery-beat lottery" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 3, spot: "~$199 (Jun 24 close)", sentiment: "Bullish",
    catalyst: "Semis-rout dip-buy — sentiment/regulatory reset, no earnings in window",
    iv: "Elevated by the selloff → favor spreads / sell premium", liq: "Deepest mega-cap chain; penny-wide spreads, massive OI",
    thesis: "Strong fundamentals into a sentiment-driven chip rout (KOSPI −10%, 'overheated' reset) → buy the dip with defined risk while IV is rich. Reduce vega with a call debit spread, or get paid to buy lower via a put-credit spread. First bounce can fail, so define risk.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $195 / sell $210 · Jul 17 '26 · ~$6.50 net debit · cost/max loss ~$650 · vega-reduced rebound" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $185 / buy $175 · Jul 17 '26 · ~$3.00 credit · max loss/capital ~$700 · paid to buy the dip" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$210 call · Jul 10 '26 · ~$3.50 debit · cost ~$350 · snapback lottery" },
    ] },
  { ticker: "XOM", name: "Exxon Mobil", rank: 4, spot: "~$137 (Jun 24 close)", sentiment: "Bearish",
    catalyst: "Crude collapse — WTI <$70 as US-Iran peace reopens Strait of Hormuz",
    iv: "Elevated from the war/peace swings — favor debit spreads", liq: "Deep, liquid large-cap energy chain",
    thesis: "The geopolitical risk-premium that lifted energy is unwinding fast as Hormuz reopens and crude breaks $70 → favor the short side with defined risk. Bear put spread for downside, or a defined-risk bear-call spread to fade rallies. A ceasefire breakdown is the only fast reversal.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread", text: "Buy $135 / sell $125 · Jul 17 '26 · ~$3.80 net debit · cost/max loss ~$380 · risk-premium unwind" },
      { profile: "Moderate",     strategy: "Bear Call Credit Spread", text: "Sell $145 / buy $150 · Jul 17 '26 · ~$1.60 credit · max loss/capital ~$340 · defined-risk, fade rallies" },
      { profile: "Aggressive",   strategy: "Long Put (OTM)", text: "$130 put · Jul 2 '26 · ~$1.40 debit · cost ~$140 · fast downside continuation" },
    ] },
  { ticker: "JPM", name: "JPMorgan Chase", rank: 5, spot: "~$335 (Jun 24 close)", sentiment: "Bullish",
    catalyst: "Passed Fed stress test → $50B buyback + dividend hike; Q2 earnings mid-July",
    iv: "Moderate — quality compounder, defined-risk spreads fit", liq: "Deep, liquid money-center chain; tight spreads",
    thesis: "Best-in-class bank emerges from CCAR with a $50B buyback and a higher dividend — a multi-month capital-return tailwind into the mid-July earnings ramp. Bullish but disciplined: a call debit spread for upside, a put-credit spread to get paid on the capital-return floor.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $345 · Jul 17 '26 · ~$7.00 net debit · cost/max loss ~$700 · buyback re-rate" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $325 / buy $315 · Jul 17 '26 · ~$3.00 credit · max loss/capital ~$700 · capital-return floor" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$345 call · Jul 10 '26 · ~$2.80 debit · cost ~$280 · breakout into Q2 earnings" },
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
// today line sits on the boundary between Jun 25 and Jun 26
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Thursday, Jun 25 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jun 25)
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
