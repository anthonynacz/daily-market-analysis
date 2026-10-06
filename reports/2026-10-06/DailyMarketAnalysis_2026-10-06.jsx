import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Tuesday, October 6, 2026 (live-researched).
 * Window: last 3 days (Oct 3) → coming 2 weeks (Oct 20).
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

// 18-day axis: Oct 3 .. Oct 20 (last 3 days → coming 2 weeks). Today = index 3 (Oct 6).
const DAYS = [
  { idx: 0, date: "Oct 3", dow: "Sat" },
  { idx: 1, date: "Oct 4", dow: "Sun" },
  { idx: 2, date: "Oct 5", dow: "Mon" },
  { idx: 3, date: "Oct 6", dow: "Tue" }, // TODAY
  { idx: 4, date: "Oct 7", dow: "Wed" },
  { idx: 5, date: "Oct 8", dow: "Thu" },
  { idx: 6, date: "Oct 9", dow: "Fri" },
  { idx: 7, date: "Oct 10", dow: "Sat" },
  { idx: 8, date: "Oct 11", dow: "Sun" },
  { idx: 9, date: "Oct 12", dow: "Mon" },
  { idx: 10, date: "Oct 13", dow: "Tue" },
  { idx: 11, date: "Oct 14", dow: "Wed" },
  { idx: 12, date: "Oct 15", dow: "Thu" },
  { idx: 13, date: "Oct 16", dow: "Fri" },
  { idx: 14, date: "Oct 17", dow: "Sat" },
  { idx: 15, date: "Oct 18", dow: "Sun" },
  { idx: 16, date: "Oct 19", dow: "Mon" },
  { idx: 17, date: "Oct 20", dow: "Tue" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Nasdaq & Nvidia hit fresh record highs as AI leadership broadens (NVDA $238.90)", tickers: "NVDA · AMD · QQQ",
    rec: "Hold core AI winners; don't chase record highs — add on pullbacks, trail stops on extended names." },
  { id: "t2", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Chips extend record run; NVDA +2%, AMD at all-time high ($631.75)", tickers: "NVDA · AMD · AVGO",
    rec: "Trend intact and S&P PEG at a 30-yr low; stay long quality, but size new entries into strength carefully." },
  { id: "t3", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "AMD's $8.2B World Labs (Fei-Fei Li) deal extends push into AI software", tickers: "AMD",
    rec: "Strategically positive; AMD is +271% YTD and extended — accumulate on dips, don't chase the news pop." },
  { id: "t4", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Apple rumored smart-home product launch (format unclear, no keynote confirmed)", tickers: "AAPL",
    rec: "Low-drama event; don't trade the rumor — watch for Siri / Apple-Intelligence follow-through." },
  { id: "t5", ind: "tech", dayIdx: 17, future: true, impact: 2, dir: "BULLISH",
    headline: "NVIDIA GTC Berlin opens (Oct 20–22) — European AI-infra showcase", tickers: "NVDA · AVGO",
    rec: "Momentum catalyst; a Huang keynote can re-energize the AI-infrastructure trade — let leaders lead." },
  { id: "t6", ind: "tech", dayIdx: 16, future: true, impact: 1, dir: "BULLISH",
    headline: "AI-capex read-through continues into GTC week (hyperscaler spend intact)", tickers: "NVDA · AVGO · MSFT",
    rec: "Add on confirmation of capex strength, not the first bounce; favor the infra leaders." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 3, dir: "MIXED",
    headline: "OPEC+ keeps November output policy unchanged (met Oct 4)", tickers: "XOM · CVX · USO",
    rec: "Removes a near-term supply overhang; neutral-to-supportive for crude — hold low-cost core E&P." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "WTI falls to ~$87 as Middle East exports rise & G7 taps strategic stocks", tickers: "XOM · CVX · COP",
    rec: "Near-term price headwind; favor low-cost producers with buybacks, avoid chasing weak crude." },
  { id: "e3", ind: "energy", dayIdx: 3, future: false, impact: 1, dir: "BEARISH",
    headline: "OPEC & IEA both cut 2026 oil-demand growth forecasts", tickers: "USO · XOM · CVX",
    rec: "Demand-side caution caps upside; keep energy exposure tactical rather than core." },
  { id: "e4", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "XOM · CVX · USO",
    rec: "Watch the draw/build vs. consensus; a large draw would help steady a sliding crude tape." },
  { id: "e5", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "BULLISH",
    headline: "Iran-war infrastructure risk keeps a geopolitical premium in crude", tickers: "XOM · CVX · OXY",
    rec: "Hold a tactical energy hedge as geopolitical insurance; trailing stops — a de-escalation unwinds it fast." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "FDA PDUFA: ifinatamab deruxtecan (I-DXd) for ES-SCLC — decision ~Oct 10", tickers: "MRK · DSNKY",
    rec: "Binary catalyst; size before the date — a clean approval is bullish Merck/Daiichi's ADC franchise." },
  { id: "h2", ind: "health", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "FDA PDUFA: Enspryng (satralizumab) for thyroid eye disease — ~Oct 15", tickers: "RHHBY",
    rec: "Label-expansion catalyst; watch for competitive read-through to other TED players." },
  { id: "h3", ind: "health", dayIdx: 3, future: false, impact: 1, dir: "BULLISH",
    headline: "FDA clears Welireg + Lenvima combo in advanced renal cell (Oct 4)", tickers: "MRK · EISAI",
    rec: "Incremental positive for Merck oncology; hold — not a single-date trade." },
  { id: "h4", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Biotech M&A + GLP-1 momentum keep XBI and large-cap pharma bid", tickers: "LLY · NVO · XBI",
    rec: "Constructive on de-risked large-cap pharma / GLP-1 leaders; favor quality over SMID speculation." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC Sept minutes (2pm ET) — how firm is the 'one more hike' guidance?", tickers: "JPM · BAC · SPY · TLT",
    rec: "Higher-for-longer tone helps NII banks; watch for dovish dissent that could pull yields lower." },
  { id: "f2", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "BULLISH",
    headline: "Big banks open Q3: JPM, WFC, Citi & Goldman report (Oct 13)", tickers: "JPM · WFC · C · GS",
    rec: "Strong NII + a capital-markets rebound; own quality money-centers into results, defined-risk if trading it." },
  { id: "f3", ind: "finance", dayIdx: 11, future: true, impact: 3, dir: "BULLISH",
    headline: "BofA & Morgan Stanley report Q3 (Oct 14)", tickers: "BAC · MS",
    rec: "Rate-sensitive BAC benefits most from higher-for-longer; constructive into the print." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Global bond sell-off lifts 10Y yields; banks firm on a steeper curve", tickers: "JPM · BAC · GS",
    rec: "Curve steepening aids net interest margins; trim long-duration asset managers / rate-proxies." },
  { id: "f5", ind: "finance", dayIdx: 3, future: false, impact: 1, dir: "BEARISH",
    headline: "JPMorgan trims BofA price target to $62 (from $68), keeps Overweight", tickers: "BAC",
    rec: "Minor estimate reset ahead of earnings; the bullish thesis is intact — use dips to accumulate." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "PepsiCo Q3 earnings (~3.5% implied move) — Frito-Lay volume watch", tickers: "PEP",
    rec: "Expectations trimmed so a low bar could clear, but US demand is soft — wait for the print, don't pre-position." },
  { id: "c2", ind: "consumer", dayIdx: 6, future: true, impact: 2, dir: "BEARISH",
    headline: "Delta Q3 earnings — fuel costs up ~68% pressure margins", tickers: "DAL · UAL · AAL",
    rec: "Fuel headwind vs. firm fares; airlines stay volatile — size small, favor the premium-mix carriers." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Costco FQ4 beat; defensive staples (COST, WMT, DG) lead", tickers: "COST · WMT · DG",
    rec: "Quality staples working as a hedge against the bond-yield spike; hold membership-model winners." },
  { id: "c4", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Nike cut to Underperform at BofA; PT to $30, turnaround slips to FY27", tickers: "NKE",
    rec: "Avoid catching the knife until the wholesale reset shows real traction; no rush to average down." },
  { id: "c5", ind: "consumer", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Early holiday-demand & consumer-sentiment reads into late October", tickers: "WMT · TGT · AMZN",
    rec: "Watch early holiday signals; favor value/traffic share-gainers over discretionary laggards." },

  // ---- MACRO / INDEX MECHANICS --------------------------------------------
  { id: "m1", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "US govt shutdown (since Oct 1) delays Sept jobs report; data blackout", tickers: "SPY · QQQ · TLT",
    rec: "Markets shrugging it off for now; a prolonged shutdown clouds the Fed's data-dependent path — stay nimble." },
  { id: "x1", ind: "finance", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "Sept CPI scheduled 8:30 ET (shutdown may delay the release)", tickers: "SPY · QQQ · TLT",
    rec: "Biggest macro swing risk in the window if it prints; keep dry powder, avoid new size into it." },
  { id: "x2", ind: "finance", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Monthly October options expiration (OpEx) — dealer positioning / pin risk", tickers: "SPY · QQQ",
    rec: "Expect pinning and elevated volume; avoid initiating new size into the Friday close." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "JPM", name: "JPMorgan Chase", rank: 1, spot: "~$332", sentiment: "Bullish",
    catalyst: "Q3 earnings — Tue Oct 13 (before open) · BINARY",
    iv: "Elevated into earnings (~±4–5% implied) — ESTIMATE",
    liq: "B — deep-liquidity list; live chain unavailable (options-data egress blocked), strikes kept near the money on the Oct 16 monthly that captures earnings",
    thesis: "Banks open Q3 with strong NII and a capital-markets rebound into a higher-for-longer curve. Bullish into a binary with elevated IV → get paid via a put-credit spread or cut vega with a debit spread rather than buy naked calls.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $320 / buy $310 · Oct 16 '26 · ~$3.00 credit · max loss/capital ~$700 · harvests IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $345 · Oct 16 '26 · ~$6.50 net debit · cost/max loss ~$650 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$340 call · Oct 16 '26 · ~$4.50 debit · cost ~$450 · pure earnings pop (accepts IV crush)" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 2, spot: "~$239", sentiment: "Bullish",
    catalyst: "GTC Berlin Oct 20–22 + record-high AI-capex momentum (no earnings in window)",
    iv: "Moderate (~40–45%, no earnings in window) — ESTIMATE",
    liq: "B — deep-liquidity list (~1M+ option contracts/day typical); live chain unavailable, strikes within ~5% of spot on Oct/Nov monthlies & liquid Oct 23/30 weeklies",
    thesis: "AI-infrastructure demand still accelerating with the stock at record highs and no earnings in the window — IV is moderate, so long premium / debit spreads are favored into the GTC Berlin catalyst. Spread up to cap cost.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $235 / sell $250 · Nov 20 '26 · ~$7.00 net debit · cost/max loss ~$700" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $240 / sell $255 · Oct 30 '26 · ~$6.00 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$250 call · Oct 23 '26 · ~$3.50 debit · cost ~$350 · GTC-momentum lotto" },
    ] },
  { ticker: "BAC", name: "Bank of America", rank: 3, spot: "~$54", sentiment: "Bullish",
    catalyst: "Q3 earnings — Wed Oct 14 (before open) · BINARY",
    iv: "Elevated into earnings (~±4% implied) — ESTIMATE",
    liq: "B — deep-liquidity list; live chain unavailable, near-the-money Oct 16 monthly, round-number strikes",
    thesis: "Most rate-sensitive of the money-centers; higher-for-longer and a steeper curve lift NII into the Oct 14 print. Defined-risk bullish structures on a cheap, deeply liquid chain — get paid below support.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $52 / buy $48 · Oct 16 '26 · ~$1.10 credit · max loss/capital ~$290 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $54 / sell $58 · Oct 16 '26 · ~$1.60 net debit · cost/max loss ~$160" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$56 call · Oct 16 '26 · ~$0.70 debit · cost ~$70 · pure earnings pop" },
    ] },
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 4, spot: "~$632", sentiment: "Bullish",
    catalyst: "AI-GPU momentum + World Labs (Fei-Fei Li) $8.2B AI-software push; +271% YTD",
    iv: "High (~55–60%, momentum name) — ESTIMATE",
    liq: "B — deep-liquidity list; live chain unavailable, strikes kept near the money on monthlies / liquid weeklies (no far-OTM reaching)",
    thesis: "Best-performing large-cap chip (+271% YTD) with the World Labs deal extending into AI software — a powerful trend but richly valued, so prefer defined-risk: a put-credit spread to get paid, debit spreads for capped-cost upside. No naked longs.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $600 / buy $585 · Nov 20 '26 · ~$5.50 credit · max loss/capital ~$950 · range-tolerant, paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $640 / sell $660 · Oct 30 '26 · ~$8.00 net debit · cost/max loss ~$800" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $650 / sell $670 · Oct 23 '26 · ~$6.00 net debit · cost/max loss ~$600" },
    ] },
  { ticker: "QQQ", name: "Invesco Nasdaq-100 ETF", rank: 5, spot: "~$756", sentiment: "Neutral-to-Bullish",
    catalyst: "Sept CPI ~Oct 14 (shutdown-delay risk) + FOMC minutes Oct 7; record-high tape",
    iv: "Low-to-moderate (~16–20%) — ESTIMATE; CPI / shutdown risk",
    liq: "B — deep-liquidity list (one of the deepest option chains in the market); live chain unavailable, index monthlies, $10-wide wings",
    thesis: "Record-high Nasdaq tape meets a data blackout (shutdown) and a CPI risk-event — a range-with-upward-drift setup. Collect premium with a condor or a bull put spread, and keep a small defined-cost call spread for melt-up continuation.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $735 / buy $725 · Oct 16 '26 · ~$2.50 credit · max loss/capital ~$750 · bullish-tilt, trend-following" },
      { profile: "Moderate",     strategy: "Iron Condor", text: "Sell $735p/buy $725p + sell $775c/buy $785c · Oct 16 '26 · ~$3.00 total credit · max loss/capital ~$700 · range income" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $760 / sell $775 · Oct 16 '26 · ~$6.00 net debit · cost/max loss ~$600 · melt-up continuation" },
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
// today line sits on the boundary between Oct 6 and Oct 7
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Tuesday, Oct 6 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Oct 6)
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
