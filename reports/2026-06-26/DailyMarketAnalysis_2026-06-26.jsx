import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, June 26, 2026 (live-researched).
 * Window: last 3 days (Jun 23) → coming 2 weeks (Jul 10).
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

// 18-day axis: Jun 23 .. Jul 10 (last 3 days → coming 2 weeks). Today = index 3 (Jun 26).
const DAYS = [
  { idx: 0, date: "Jun 23", dow: "Tue" },
  { idx: 1, date: "Jun 24", dow: "Wed" },
  { idx: 2, date: "Jun 25", dow: "Thu" },
  { idx: 3, date: "Jun 26", dow: "Fri" }, // TODAY
  { idx: 4, date: "Jun 27", dow: "Sat" },
  { idx: 5, date: "Jun 28", dow: "Sun" },
  { idx: 6, date: "Jun 29", dow: "Mon" },
  { idx: 7, date: "Jun 30", dow: "Tue" },
  { idx: 8, date: "Jul 1", dow: "Wed" },
  { idx: 9, date: "Jul 2", dow: "Thu" },
  { idx: 10, date: "Jul 3", dow: "Fri" },
  { idx: 11, date: "Jul 4", dow: "Sat" },
  { idx: 12, date: "Jul 5", dow: "Sun" },
  { idx: 13, date: "Jul 6", dow: "Mon" },
  { idx: 14, date: "Jul 7", dow: "Tue" },
  { idx: 15, date: "Jul 8", dow: "Wed" },
  { idx: 16, date: "Jul 9", dow: "Thu" },
  { idx: 17, date: "Jul 10", dow: "Fri" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Global tech rout — SOX −6.2%; INTC −7.6%, MU −8.5%, AMD −6.2%, NVDA −3%", tickers: "NVDA · AMD · MU · INTC",
    rec: "Don't panic-sell quality; this is a sentiment/positioning flush, not a demand break. Scale into NVDA on weakness." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Micron blowout FQ3: rev +346% y/y, EPS $25.11 vs $20.78; MU +19% intraday", tickers: "MU",
    rec: "Memory super-cycle confirmed; buy pullbacks (DB lifts PT to $1,550). Use spreads — IV is rich post-print." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Apple −6% & Microsoft −3% after hiking device prices on soaring memory costs", tickers: "AAPL · MSFT",
    rec: "Memory inflation is a margin headwind for hardware OEMs but a tailwind for MU/SK Hynix — own the supplier, not the buyer." },
  { id: "t4", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Chip futures slip on report of an OpenAI IPO delay", tickers: "NVDA · AVGO · ARM",
    rec: "Headline-driven; let the AI-sentiment reset run before re-adding — don't chase the first bounce." },
  { id: "t5", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing PMI (10:00 ET) — capex/new-orders read for semis", tickers: "NVDA · AMD · SOXX",
    rec: "A strong new-orders print supports the chip-equipment trade; a soft one feeds the demand-doubt narrative." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 3, future: false, impact: 3, dir: "BEARISH",
    headline: "WTI slides below $71 — 3rd straight weekly drop as US-Iran peace eases supply fears", tickers: "XOM · CVX · COP",
    rec: "Trim/underweight E&P; the war risk-premium is unwinding into a 2026 surplus. Fade strength rather than buy dips." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Hormuz shipping resumes; Saudi/Qatar exports restart — risk premium unwinds", tickers: "XOM · CVX · USO",
    rec: "Supply is coming back online; stay defensive on crude beta until inventories confirm a bottom." },
  { id: "e3", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "XOM · CVX · USO",
    rec: "Watch builds vs. draws — a surprise build amid surplus chatter would confirm the bearish tape." },
  { id: "e4", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "BEARISH",
    headline: "Iraq pushes OPEC+ for a higher quota as 2026 surplus talk builds", tickers: "XOM · OXY · USO",
    rec: "More barrels into a soft market = bearish; keep energy exposure light and hedged." },
  { id: "e5", ind: "energy", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "EIA Short-Term Energy Outlook refresh", tickers: "XOM · CVX",
    rec: "Look for revised 2026 balance/price path; a wider surplus forecast pressures the majors further." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 6, future: true, impact: 3, dir: "BULLISH",
    headline: "FDA 503B bulk-list comment period closes — 'no clinical need' signals tighter GLP-1 compounding", tickers: "LLY · NVO · HIMS",
    rec: "Bullish branded GLP-1 (LLY/NVO) if compounding is curbed; bearish telehealth compounders (HIMS). Tilt to LLY." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Novo Nordisk +6% on UK oral semaglutide (Wegovy pill) approval", tickers: "NVO",
    rec: "Constructive for NVO's oral defense; hold for execution but mind LLY's orforglipron competition." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Healthcare 2nd-best sector (+1.49%) as money rotates out of megacap tech", tickers: "UNH · JNJ · XLV",
    rec: "Defensive rotation tailwind; favor quality pharma/managed-care on the risk-off pivot." },
  { id: "h4", ind: "health", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "GLP-1 share-shift debate continues — LLY orforglipron ramp vs NVO defense", tickers: "LLY · NVO · VKTX",
    rec: "Volatility persists; own LLY on the manufacturing-scale lead, fade knee-jerk NVO moves." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "All 32 big banks pass Fed stress test; CET1 falls just 1.6pp ($708B modeled losses)", tickers: "JPM · BAC · GS · MS",
    rec: "Clean bill of health unlocks capital returns; own the money-center banks into the buyback wave." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "JPM dividend to $1.65 (from $1.50) + new $50B buyback (Jul 1); GS to $5, MS +15%", tickers: "JPM · GS · MS",
    rec: "Direct shareholder-return catalyst — JPM/GS the cleanest large-cap longs in the tape right now." },
  { id: "f3", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Bank stocks extend gains on the capital-return wave; KBW Banks outperform", tickers: "JPM · BAC · WFC · GS",
    rec: "Momentum + fundamentals aligned; add on pullbacks but don't chase a vertical move into Q2 earnings." },
  { id: "f4", ind: "finance", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "June jobs report (8:30 ET; 1pm early close) — rate-path swing factor", tickers: "JPM · BAC · SPY",
    rec: "Biggest macro print of the window; a hot number lifts NII-bank names, a weak one revives cut bets. Keep dry powder." },
  { id: "f5", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "June FOMC minutes (Warsh's first meeting) due ~Jul 8", tickers: "JPM · SPY · TLT",
    rec: "Parse the dots/dissent debate; hawkish minutes help asset-sensitive banks, dovish helps duration." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Consumer discretionary worst sector (−1.78%) as Apple's price hikes spook spending", tickers: "AMZN · HD · XLY",
    rec: "Higher hardware prices pressure the discretionary wallet; stay selective, favor staples/value over big-ticket." },
  { id: "c2", ind: "consumer", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Nike FQ4 earnings (after close) — turnaround test; EPS est $0.11 (−21% y/y) · BINARY", tickers: "NKE",
    rec: "Max-pessimism setup near multi-year lows; size before the print, use defined-risk. A guide beat re-rates it sharply." },
  { id: "c3", ind: "consumer", dayIdx: 0, future: false, impact: 1, dir: "MIXED",
    headline: "Nike names David Denton (ex-Lowe's) CFO eff Aug 17; Matt Friend steps down", tickers: "NKE",
    rec: "Credible CFO hire is a modest positive for the turnaround narrative — confirmation, not a catalyst to chase." },
  { id: "c4", ind: "consumer", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Pre-July 4 travel & consumer-demand read across airlines/leisure", tickers: "AAL · DAL · MAR",
    rec: "Use the holiday read as a real-time spending gauge; strong travel data supports leisure names into summer." },
  { id: "c5", ind: "consumer", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Retail back-half setup post-holiday promos (WMT share-gain watch)", tickers: "WMT · AMZN · TGT",
    rec: "Favor WMT/AMZN on traffic and share gains; stay cautious on weaker-traffic department/discretionary retail." },

  // ---- FORWARD CATALYSTS (week 2: Jul 4–10) -------------------------------
  { id: "x1", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex narrative reset continues after the memory super-cycle signal", tickers: "NVDA · MU · AVGO",
    rec: "Let the dust settle; re-add on confirmation of capex/memory strength, not the first relief bounce." },
  { id: "x2", ind: "finance", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Big-bank Q2 earnings season approaches (JPM ~Jul 14)", tickers: "JPM · BAC · WFC",
    rec: "Position ahead of NII/credit commentary; capital-return momentum favors the leaders but expectations are rising." },
  { id: "x3", ind: "consumer", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "Shortened holiday week — early close Jul 2, market closed Jul 3", tickers: "SPY · QQQ · IWM",
    rec: "Thin, low-volume tape can exaggerate moves; avoid initiating new size into the long weekend." },
  { id: "x4", ind: "energy", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Crude stabilization vs. surplus narrative into mid-July", tickers: "XOM · CVX · USO",
    rec: "Watch for a base near recent lows; only fade the bearish trend on a confirmed inventory/OPEC turn." },
  { id: "x5", ind: "health", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "Post-holiday volume returns; light-catalyst stretch for pharma", tickers: "LLY · NVO · XLV",
    rec: "Use the quiet window to position in defensive healthcare ahead of late-July pharma earnings." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "MU", name: "Micron", rank: 1, spot: "~$1,166", sentiment: "Bullish",
    catalyst: "Memory super-cycle confirmed by blowout FQ3 (rev +346% y/y); DB lifts PT to $1,550",
    iv: "Rich post-earnings (binary already passed → crush risk on naked longs)", liq: "Deep, very active mega-cap semi chain",
    thesis: "Earnings are out and the print was huge, but IV is still elevated and the stock is >$1,100 — so cut vega with tight debit spreads and harvest the post-print crush with a defined-risk credit spread instead of buying naked premium.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1,150 / sell $1,170 · Jul 17 '26 · ~$10 net debit · cost/max loss ~$1,000 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1,120 / buy $1,100 · Jul 17 '26 · ~$7 credit · max loss/capital ~$1,300 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $1,180 / sell $1,200 · Jul 2 '26 · ~$6 net debit · cost/max loss ~$600 · breakout continuation" },
    ] },
  { ticker: "JPM", name: "JPMorgan Chase", rank: 2, spot: "~$335", sentiment: "Bullish",
    catalyst: "Passed Fed stress test; dividend hiked to $1.65 + new $50B buyback (Jul 1); Q2 earnings ~Jul 14",
    iv: "Low/moderate — CHEAP → long premium / debit spreads favored", liq: "Deep, penny-wide large-cap bank chain",
    thesis: "Cleanest large-cap long in the tape: capital-return catalyst now, earnings tailwind just past the window. Cheap IV means buying defined upside is favored; a put-credit spread gets paid to buy any dip.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $345 · Jul 17 '26 · ~$7 net debit · cost/max loss ~$700" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $325 / buy $315 · Jul 17 '26 · ~$3 credit · max loss/capital ~$700 · paid to buy the dip" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$345 call · Jul 17 '26 · ~$3 debit · cost ~$300 · buyback/earnings run" },
    ] },
  { ticker: "NKE", name: "Nike", rank: 3, spot: "~$43", sentiment: "Bullish (contrarian)",
    catalyst: "FQ4 earnings — Tue Jun 30 (after close) · BINARY; EPS est $0.11 (−21% y/y), new CFO hire",
    iv: "Rich (~±10% implied) on a beaten-down name near multi-year lows", liq: "Deep mega-cap chain; low $ premiums",
    thesis: "Max-pessimism turnaround into a binary with rich IV → get paid to accumulate via a defined-risk put-credit spread (CSP would tie up too much collateral), spread up for cheap upside, and keep a lottery call for the asymmetric beat.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $40 / buy $36 · Jul 17 '26 · ~$1.10 credit · max loss/capital ~$290 · paid to accumulate" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $43 / sell $48 · Jul 17 '26 · ~$1.80 net debit · cost/max loss ~$180" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$46 call · Jul 2 '26 · ~$0.90 debit · cost ~$90 · pure earnings pop" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 4, spot: "~$275", sentiment: "Neutral-to-Bullish (contrarian)",
    catalyst: "−6% on device price hikes (memory costs); no binary until ~Jul 30 earnings",
    iv: "Moderate — sell elevated downside premium, spread up for cheap upside", liq: "Deepest equity chain in the market; penny-wide spreads",
    thesis: "Price hikes protect margin even as the tape punished the stock; with no near-term binary, fade the panic with a defined-risk put-credit spread below support and take cheap, capped upside via a call spread.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $265 / buy $255 · Jul 17 '26 · ~$3 credit · max loss/capital ~$700 · range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $275 / sell $290 · Jul 17 '26 · ~$6 net debit · cost/max loss ~$600" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$285 call · Jul 17 '26 · ~$2.50 debit · cost ~$250 · rebound" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 5, spot: "~$137.50", sentiment: "Bearish",
    catalyst: "WTI <$71, 3rd weekly drop; US-Iran peace + 2026 supply surplus unwinding the war premium",
    iv: "Moderating as the risk premium fades → debit spreads cleaner than credit", liq: "Deep, liquid large-cap energy chain",
    thesis: "The crude risk-premium is deflating into a forecast surplus, a structural headwind for the majors. Express it with defined-risk bear put spreads (cap cost, avoid open-ended short risk); a cheap OTM put for an inventory-driven flush.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread", text: "Buy $137 / sell $130 · Jul 17 '26 · ~$3 net debit · cost/max loss ~$300" },
      { profile: "Moderate",     strategy: "Bear Put Debit Spread", text: "Buy $135 / sell $125 · Jul 17 '26 · ~$3.50 net debit · cost/max loss ~$350" },
      { profile: "Aggressive",   strategy: "Long Put (OTM)", text: "$130 put · Jul 2 '26 · ~$1.20 debit · cost ~$120 · crude-breakdown play" },
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
// today line sits on the boundary between Jun 26 and Jun 27
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Jun 26 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jun 26)
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
