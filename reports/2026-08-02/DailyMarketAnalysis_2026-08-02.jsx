import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Sunday, August 2, 2026 (live-researched).
 * Window: last 3 days (Jul 30) → coming 2 weeks (Aug 16).
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

// 18-day axis: Jul 30 .. Aug 16 (last 3 days → coming 2 weeks). Today = index 3 (Aug 2).
const DAYS = [
  { idx: 0, date: "Jul 30", dow: "Thu" },
  { idx: 1, date: "Jul 31", dow: "Fri" },
  { idx: 2, date: "Aug 1", dow: "Sat" },
  { idx: 3, date: "Aug 2", dow: "Sun" }, // TODAY
  { idx: 4, date: "Aug 3", dow: "Mon" },
  { idx: 5, date: "Aug 4", dow: "Tue" },
  { idx: 6, date: "Aug 5", dow: "Wed" },
  { idx: 7, date: "Aug 6", dow: "Thu" },
  { idx: 8, date: "Aug 7", dow: "Fri" },
  { idx: 9, date: "Aug 8", dow: "Sat" },
  { idx: 10, date: "Aug 9", dow: "Sun" },
  { idx: 11, date: "Aug 10", dow: "Mon" },
  { idx: 12, date: "Aug 11", dow: "Tue" },
  { idx: 13, date: "Aug 12", dow: "Wed" },
  { idx: 14, date: "Aug 13", dow: "Thu" },
  { idx: 15, date: "Aug 14", dow: "Fri" },
  { idx: 16, date: "Aug 15", dow: "Sat" },
  { idx: 17, date: "Aug 16", dow: "Sun" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Microsoft +15% — Azure tops $100B run-rate, +43% growth crushes est.", tickers: "MSFT",
    rec: "Hold core; the AI-cloud re-rate is real. Don't chase a 15% gap — add on a pullback toward the gap fill." },
  { id: "t2", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Amazon +12.6% on AWS + retail beat; cloud momentum confirmed", tickers: "AMZN",
    rec: "Hold; the print validates the capex-into-AI bull case. Trim only if you need to lock the pop." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Meta −9% — Q3 revenue guide ($61–64B) light; AI-spend intensity spooks", tickers: "META",
    rec: "The miss was the guide, not the quarter. Wait for stabilization; the capex overhang caps upside near-term." },
  { id: "t4", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Reddit −23% — no new data-licensing deals disappoints AI-monetization bulls", tickers: "RDDT",
    rec: "Avoid catching the knife; the licensing-flywheel thesis needs a fresh deal to re-rate. Watch, don't buy." },
  { id: "t5", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "AMD hits 52-wk high $182.50 into earnings; AI-GPU demand narrative strong", tickers: "AMD · NVDA",
    rec: "Don't chase into the print; a ~12% implied move cuts both ways — use defined-risk structures (see Options tab)." },
  { id: "t6", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Palantir Q2 earnings (after close) — 61x sales; ~81% rev growth expected · BINARY", tickers: "PLTR",
    rec: "Valuation leaves no room for error; size small. A beat-and-raise pops it, an in-line guide gets sold. Defined-risk only." },
  { id: "t7", ind: "tech", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "AMD Q2 earnings (~after close) — ~$11.3B rev, +47%; ~12% implied move · BINARY", tickers: "AMD",
    rec: "Bullish AI setup but rich IV into a binary — cut vega with a debit spread or harvest the crush (see Options tab)." },
  { id: "t8", ind: "tech", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Shopify Q2 earnings — fell 16% after last beat; GMV & take-rate in focus · BINARY", tickers: "SHOP",
    rec: "Great business, twitchy stock. Wait for the reaction; a 'sell-the-beat' dip is the better entry than chasing it in." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "WTI holds >$85, +20% on the month on US–Iran / Strait of Hormuz tensions", tickers: "XOM · CVX · COP",
    rec: "Keep core E&P as a geopolitical hedge; use trailing stops — a de-escalation unwinds the risk premium fast." },
  { id: "e2", ind: "energy", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "OPEC+ ministerial (today) — ~188K b/d Sept hike expected", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut new directional bets into the decision; a larger-than-expected hike is bearish crude, a pause/hold is bullish." },
  { id: "e3", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "XOM · CVX · USO",
    rec: "Watch the draw vs. consensus; a big draw amid the Hormuz premium reinforces the supply-tight bull case." },
  { id: "e4", ind: "energy", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "ConocoPhillips Q2 earnings (~this week) — cash returns & Permian volumes", tickers: "COP",
    rec: "Own it for the buyback + oil beta; a strong FCF print + shareholder-return bump is the bull case (see Options tab)." },
  { id: "e5", ind: "energy", dayIdx: 9, future: true, impact: 2, dir: "BULLISH",
    headline: "Hormuz / Middle-East escalation risk persists into mid-August", tickers: "XOM · CVX · OXY",
    rec: "Tactical energy overweight as insurance; trailing stops. A ceasefire headline reverses the trade sharply." },
  { id: "e6", ind: "energy", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "EIA inventories (week 2) — refinery runs & driving-season demand", tickers: "XOM · CVX · USO",
    rec: "Late-summer demand read; pair with the CPI energy component for the macro-inflation feedback loop." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 6, future: true, impact: 3, dir: "BULLISH",
    headline: "Eli Lilly Q2 earnings (Aug 5) — GLP-1 (Zepbound/Mounjaro) volumes & guide · BINARY", tickers: "LLY · NVO",
    rec: "Structural GLP-1 leader; a volume beat + raise re-rates it. Rich stock — use a defined-risk spread (see Options tab)." },
  { id: "h2", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Pfizer Q2 earnings (~this week) — pipeline & cost-cut execution vs. patent cliff", tickers: "PFE",
    rec: "Value/yield name; own for the dividend, not a pop. Watch oncology + obesity pipeline commentary for the re-rate." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Biotech M&A stays hot as large-cap pharma buys growth to fill patent gaps", tickers: "XBI · MRK · ABBV",
    rec: "Tailwind for SMID-cap biotech (XBI); tilt to de-risked, cash-flow-visible names that fit pharma's revenue hole." },
  { id: "h4", ind: "health", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "GLP-1 data digestion continues — LLY vs. NVO share-of-voice battle", tickers: "LLY · NVO · VKTX",
    rec: "Volatility persists post-earnings; favor LLY on execution, fade knee-jerk NVO moves without new trial data." },
  { id: "h5", ind: "health", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Managed-care margin watch into 2027 MA-rate & utilization prints", tickers: "UNH · HUM · CVS",
    rec: "Stay selective/underweight managed care until the 2027 rate + medical-cost-trend picture clears." },

  // ---- FINANCIALS / MACRO -------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "FOMC read-through: Fed held 3.50–3.75% (9–3); markets now price ~2 hikes in '26", tickers: "JPM · BAC · SPY · TLT",
    rec: "Position higher-for-longer: asset-sensitive banks (JPM/BAC) win; avoid adding long-duration/rate risk here." },
  { id: "f2", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Q2 GDP +1.5% (vs +2.1% Q1) — growth cooling but still positive", tickers: "SPY · XLF · JPM",
    rec: "Soft-landing intact but decelerating; keep quality tilt. A cooling economy + sticky inflation is the tricky combo." },
  { id: "f3", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Long-end yields surge; Apple & rate-sensitive megacaps slip on Jul 31", tickers: "AAPL · TLT · XLK",
    rec: "Trim long-duration equity exposure into the yield spike; higher discount rates pressure high-multiple names." },
  { id: "f4", ind: "finance", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "July jobs report / nonfarm payrolls (8:30 ET, Aug 7)", tickers: "JPM · BAC · SPY · TLT",
    rec: "First big macro print of the window; a hot number revives hike fears, a soft one eases yields. Keep dry powder." },
  { id: "f5", ind: "finance", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "July CPI (8:30 ET, Aug 12) — the window's biggest swing risk", tickers: "SPY · QQQ · JPM · TLT",
    rec: "Above-target inflation + 2-hike pricing makes this the key print; avoid initiating size into the release." },
  { id: "f6", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "July PPI (Aug 13) — pipeline-inflation & margin read after CPI", tickers: "SPY · XLF",
    rec: "Confirms or fades the CPI signal; a hot PPI keeps the higher-for-longer trade alive into month-end." },
  { id: "f7", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "July retail sales + prelim Michigan sentiment (Aug 14)", tickers: "XLY · WMT · SPY",
    rec: "Consumer-health check into back-to-school; a firm print supports the soft-landing / consumer-resilience thesis." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Disney FQ3 earnings (Aug 5) — Parks, streaming profitability & guide · BINARY", tickers: "DIS",
    rec: "Turnaround under new CEO; DTC profitability + Parks trends are the tells. ~6% implied move — defined-risk (Options tab)." },
  { id: "c2", ind: "consumer", dayIdx: 6, future: true, impact: 2, dir: "BULLISH",
    headline: "Uber Q2 earnings (Aug 5, pre-market) — bookings + AV partnerships in focus", tickers: "UBER",
    rec: "Bullish on mobility+delivery scale and the autonomous optionality; own it, but respect the earnings gap risk." },
  { id: "c3", ind: "consumer", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Airbnb Q2 earnings (Aug 6) — bookings growth & take-rate; ~16% EPS growth eyed", tickers: "ABNB",
    rec: "Travel-demand read; watch nights-booked and 2H guide. Wait for the reaction rather than chase into the print." },
  { id: "c4", ind: "consumer", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "Booking / DraftKings / CELH cluster report — travel, gaming & energy-drink demand", tickers: "BKNG · DKNG · CELH",
    rec: "Broad consumer-discretionary pulse; use the cluster to gauge whether the consumer is still spending on experiences." },
  { id: "c5", ind: "consumer", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Retail-sales read frames back-to-school demand for discretionary names", tickers: "WMT · TGT · AMZN",
    rec: "Pair the macro retail-sales print with earnings tone; favor share-gainers (WMT/AMZN) over margin-pressured retailers." },

  // ---- FORWARD CATALYSTS (week 2: Aug 10–16) ------------------------------
  { id: "x1", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "AI-capex read-through continues post MSFT/AMZN/AMD prints", tickers: "NVDA · MSFT · AMD",
    rec: "Let the dust settle; re-add on confirmation that hyperscaler capex is still accelerating, not the first bounce." },
  { id: "x2", ind: "tech", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "High-multiple tech re-prices around the Aug 12 CPI print", tickers: "NVDA · MSFT · GOOGL",
    rec: "A cool CPI is the megacap-growth catalyst; a hot one compresses multiples. De-risk slightly into the number." },
  { id: "x3", ind: "consumer", dayIdx: 12, future: true, impact: 1, dir: "MIXED",
    headline: "Post-earnings consumer digestion — DIS / UBER / ABNB follow-through", tickers: "DIS · UBER · ABNB",
    rec: "Trade the reaction, not the headline; winners that hold gap gains are the higher-quality adds." },
  { id: "x4", ind: "energy", dayIdx: 16, future: true, impact: 2, dir: "BULLISH",
    headline: "Hormuz risk premium + OPEC+ supply path into mid-August", tickers: "XOM · CVX · USO",
    rec: "Keep the tactical energy hedge with trailing stops; the geopolitical bid persists until a credible de-escalation." },
  { id: "x5", ind: "finance", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Yield & rate-path watch into late August (pre-Jackson Hole)", tickers: "SPY · TLT · JPM",
    rec: "Positioning ahead of the late-August Fed symposium; keep dry powder for the next macro leg." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 1, spot: "~$182", sentiment: "Bullish",
    catalyst: "Q2 earnings — ~Tue Aug 4 (after close) · BINARY",
    iv: "Rich — ~12% implied move into the print", liq: "Very deep, penny-wide semis chain; huge OI",
    thesis: "Bullish AI-GPU story at a 52-wk high, but expensive IV into a binary → avoid naked long calls (max crush). Cut vega with a debit spread, or get paid to be bullish via a put-credit spread that harvests the IV crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $180 / sell $195 · Aug 21 '26 · ~$6.50 net debit · cost/max loss ~$650 · vega-reduced" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $170 / buy $160 · Aug 7 '26 · ~$3.20 credit · max loss/capital ~$680 · harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$195 call · Aug 7 '26 · ~$4.50 debit · cost ~$450 · pure earnings-pop lottery" },
    ] },
  { ticker: "PLTR", name: "Palantir", rank: 2, spot: "~$122", sentiment: "Neutral",
    catalyst: "Q2 earnings — Mon Aug 3 (after close) · BINARY",
    iv: "Very high (61x sales; extreme earnings vol)", liq: "Deep, hyper-active retail-favorite chain",
    thesis: "Priced for perfection (61x sales, −39% from its ATH) into a binary with very rich IV → range-bound, sell-premium structures. Fade the extremes with a condor; lean mildly bullish with a credit spread; keep any directional bet defined-cost.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor", text: "Sell $110p/$135c, buy $100p/$145c · Aug 21 '26 · ~$3 net credit · max loss/capital ~$700 · range + crush" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $110 / buy $100 · Aug 7 '26 · ~$3.50 credit · max loss/capital ~$650 · paid to be mildly bullish" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $125 / sell $140 · Aug 7 '26 · ~$5.50 net debit · cost/max loss ~$550 · directional pop bet" },
    ] },
  { ticker: "LLY", name: "Eli Lilly", rank: 3, spot: "~$1,149", sentiment: "Bullish",
    catalyst: "Q2 earnings — Wed Aug 5 · BINARY (GLP-1 volumes)",
    iv: "Elevated into earnings; large $-move on a $1,100+ stock", liq: "Deep large-cap pharma chain; wider $ strikes",
    thesis: "Structural GLP-1 leader; a volume beat + raise re-rates it. The stock is too pricey for cash-secured puts, so express it ONLY through tight, defined-risk spreads to stay inside the $1,500 cap.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $1,140 / sell $1,160 · Sep 18 '26 · ~$9 net debit · cost/max loss ~$900" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $1,120 / buy $1,100 · Aug 21 '26 · ~$7 credit · max loss/capital ~$1,300 · bullish, range-tolerant" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread (OTM)", text: "Buy $1,160 / sell $1,180 · Aug 7 '26 · ~$6 net debit · cost/max loss ~$600 · earnings breakout" },
    ] },
  { ticker: "DIS", name: "Walt Disney", rank: 4, spot: "~$118 (EST)", sentiment: "Bullish",
    catalyst: "FQ3 earnings — Wed Aug 5 · BINARY (~6% implied)",
    iv: "Moderate-elevated (~6% implied earnings move)", liq: "Deep, liquid mega-cap chain; tight spreads",
    thesis: "Turnaround under a new CEO with DTC streaming turning profitable and Parks stabilizing. A modest implied move favors a defined-cost debit spread up, or getting paid via a put-credit spread below support.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $115 / sell $125 · Sep 18 '26 · ~$4.50 net debit · cost/max loss ~$450" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $112 / buy $105 · Aug 21 '26 · ~$2.20 credit · max loss/capital ~$480" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$125 call · Aug 7 '26 · ~$1.80 debit · cost ~$180 · earnings-pop lottery" },
    ] },
  { ticker: "COP", name: "ConocoPhillips", rank: 5, spot: "~$118", sentiment: "Bullish",
    catalyst: "Q2 earnings (~this wk) + oil / Hormuz risk premium",
    iv: "Moderate; elevated with the geopolitical crude bid", liq: "Deep, liquid large-cap energy chain",
    thesis: "Two-pronged bull case: an earnings/cash-return catalyst stacked on a WTI risk premium (>$85, +20% MTD on Hormuz tensions). Defined-risk spreads capture the upside; a cheap call rides a crude breakout.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $115 / sell $125 · Sep 18 '26 · ~$4 net debit · cost/max loss ~$400" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $112 / buy $105 · Aug 21 '26 · ~$2.30 credit · max loss/capital ~$470 · paid on any oil dip" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$125 call · Aug 21 '26 · ~$1.50 debit · cost ~$150 · crude-breakout lottery" },
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
// today line sits on the boundary between Aug 2 and Aug 3
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Sunday, Aug 2 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Aug 2)
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
