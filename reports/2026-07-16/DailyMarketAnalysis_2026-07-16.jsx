import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Thursday, July 16, 2026 (live-researched).
 * Window: last 3 days (Jul 13) → coming 2 weeks (Jul 30).
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

// 18-day axis: Jul 13 .. Jul 30 (last 3 days → coming 2 weeks). Today = index 3 (Jul 16).
const DAYS = [
  { idx: 0, date: "Jul 13", dow: "Mon" },
  { idx: 1, date: "Jul 14", dow: "Tue" },
  { idx: 2, date: "Jul 15", dow: "Wed" },
  { idx: 3, date: "Jul 16", dow: "Thu" }, // TODAY
  { idx: 4, date: "Jul 17", dow: "Fri" },
  { idx: 5, date: "Jul 18", dow: "Sat" },
  { idx: 6, date: "Jul 19", dow: "Sun" },
  { idx: 7, date: "Jul 20", dow: "Mon" },
  { idx: 8, date: "Jul 21", dow: "Tue" },
  { idx: 9, date: "Jul 22", dow: "Wed" },
  { idx: 10, date: "Jul 23", dow: "Thu" },
  { idx: 11, date: "Jul 24", dow: "Fri" },
  { idx: 12, date: "Jul 25", dow: "Sat" },
  { idx: 13, date: "Jul 26", dow: "Sun" },
  { idx: 14, date: "Jul 27", dow: "Mon" },
  { idx: 15, date: "Jul 28", dow: "Tue" },
  { idx: 16, date: "Jul 29", dow: "Wed" },
  { idx: 17, date: "Jul 30", dow: "Thu" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Memory-chip selloff: Samsung read-through hits MU −8%, LRCX −3%, NVDA −2.2%", tickers: "MU · NVDA · AMD · LRCX",
    rec: "Buy the memory dip selectively — HBM is sold out for 2026; the pullback is sentiment, not a demand break." },
  { id: "t2", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Microsoft FQ4 (Jul 13 AMC) sets the AI-capex tone for the week", tickers: "MSFT · NVDA",
    rec: "Hold MSFT as a core AI-infra name; strong Azure/backlog is the bull read-through for the whole complex." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Apple hits fresh all-time high (+4%); megacaps bid as money rotates out of chips", tickers: "AAPL · MSFT · GOOGL",
    rec: "Don't chase AAPL at record highs; trim extended positions, keep core — cheap IV favors call spreads over stock." },
  { id: "t4", ind: "tech", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "Netflix Q2 earnings (Jul 16 AMC) — ad tier & FCF after a ~30% 3-month slide", tickers: "NFLX",
    rec: "Binary tonight — options imply ±~8%; use defined-risk structures, don't hold naked long premium into the crush." },
  { id: "t5", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Alphabet Q2 earnings (Jul 22 AMC) — Cloud growth & AI-capex guide", tickers: "GOOGL",
    rec: "Wait for the print; accelerating Cloud + disciplined capex re-rates GOOGL, a capex blowout pressures the tape." },
  { id: "t6", ind: "tech", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "Apple & Amazon Q2 earnings (Jul 30 AMC) — megacap capstone to the month", tickers: "AAPL · AMZN",
    rec: "Keep dry powder into the double header; two of the biggest weights report the same night — expect index vol." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Oil jumps ~3% (WTI ~$80) on renewed US-Iran tension & shipping-route threats", tickers: "XOM · CVX · COP",
    rec: "Keep a core E&P overweight for the geopolitical premium; add on dips, trail stops — a de-escalation reverses it fast." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "EIA weekly petroleum status — crude inventories vs. the Iran risk premium", tickers: "XOM · CVX · USO",
    rec: "Let inventories time entries; geopolitics is driving price more than the weekly draw right now." },
  { id: "e3", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "EIA weekly inventories (Jul 21 wk) — draw vs. consensus", tickers: "XOM · CVX · USO",
    rec: "A bigger-than-expected draw amid Middle-East risk reinforces the crude bull case; fade only on a de-escalation." },
  { id: "e4", ind: "energy", dayIdx: 10, future: true, impact: 3, dir: "BULLISH",
    headline: "US-Iran escalation risk keeps a standing geopolitical premium in crude", tickers: "XOM · CVX · OXY",
    rec: "Hold energy as portfolio insurance into the FOMC week; size it as a hedge, not a conviction long — headline-driven." },
  { id: "e5", ind: "energy", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "OPEC+ output-policy chatter ahead of August quotas", tickers: "XOM · CVX · USO",
    rec: "Watch for supply-add headlines; a larger-than-expected hike caps crude, a hold extends the tight-market thesis." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "UnitedHealth Q2 crushes it: EPS $6.38 vs $4.91; raises FY guide to $19.50–20", tickers: "UNH",
    rec: "The beat + raise resets the managed-care narrative — hold/accumulate UNH; IV crush favors selling premium over chasing stock." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Eli Lilly extends surge; oral GLP-1 'Foundayo' + Medicare bridge widen the moat", tickers: "LLY · NVO",
    rec: "Own LLY as the GLP-1 franchise leader; don't chase after a 7% week — add on pullbacks, fade knee-jerk NVO weakness." },
  { id: "h3", ind: "health", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Managed-care read-through after UNH — cost-trend visibility across peers", tickers: "HUM · CVS · ELV",
    rec: "UNH's clean cost trend is a positive tell; selectively add quality MCOs, but wait for each name's own print." },
  { id: "h4", ind: "health", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Big-pharma Q2 wave begins — GLP-1 & pipeline commentary in focus", tickers: "LLY · MRK · PFE",
    rec: "Position ahead via quality (LLY); use spreads not naked longs into binary prints, and watch obesity-drug guidance." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Big banks post record Q2: GS EPS $20.98 (+9% to $1,140), JPM +2.5% to a new ATH", tickers: "GS · JPM · BAC · WFC · C",
    rec: "Trading-driven beats — take partial profits into all-time highs rather than chase; keep GS/JPM as core quality." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "BlackRock beats; AUM a record $15.3T, shares +7% (best day in over a year)", tickers: "BLK",
    rec: "Structural asset-gatherer tailwind; hold BLK, but don't buy a +7% pop — wait for the fill." },
  { id: "f3", ind: "finance", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Brokers & regionals continue reporting — NII vs. trading-mix in focus", tickers: "MS · SCHW · PNC",
    rec: "Favor capital-markets-levered names after the money-center beats; be selective on rate-sensitive regionals." },
  { id: "f4", ind: "finance", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC meeting begins (Jul 28) — hold at 3.50–3.75% is >90% priced", tickers: "JPM · BAC · SPY",
    rec: "Little rate surprise expected; keep dry powder for the statement/presser tone, not the level itself." },
  { id: "f5", ind: "finance", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision + presser (Jul 29) — non-SEP; the guidance tone is the swing", tickers: "SPY · TLT · JPM",
    rec: "Cooling CPI/PPI gives cover for a dovish lean; avoid new duration bets until the presser clears." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "June CPI −0.4% (3.5% y/y) & PPI −0.3% cool — relief for rate-sensitive discretionary", tickers: "AMZN · HD · XLY",
    rec: "Cooling inflation supports the consumer-discretionary bid; add quality on the disinflation read, not junk rallies." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 1, dir: "BULLISH",
    headline: "Consumer megacaps ride the rotation as money leaves chips (AMZN +3%)", tickers: "AMZN · WMT",
    rec: "Constructive for mega-cap retail; hold AMZN into its Jul 30 print, but don't over-size ahead of the binary." },
  { id: "c3", ind: "consumer", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Tesla Q2 earnings (Jul 22 AMC) — deliveries beat known; margins & Cybercab in focus", tickers: "TSLA",
    rec: "Deliveries (480K, +18% beat) are old news — the print is about auto gross margin & robotaxi; use defined-risk into ±~8% IV." },
  { id: "c4", ind: "consumer", dayIdx: 12, future: true, impact: 1, dir: "MIXED",
    headline: "Back-to-school demand read builds into late-July retailer commentary", tickers: "WMT · TGT",
    rec: "Watch traffic/tone; a firm BTS read favors WMT share-gainers over pressured mid-tier retail — stay selective." },
  { id: "c5", ind: "consumer", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Amazon Q2 (Jul 30 AMC) — retail margins + AWS re-acceleration", tickers: "AMZN",
    rec: "Wait for the print; AWS growth is the swing factor — spread up for defined-cost upside rather than buying stock into it." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "NFLX", name: "Netflix", rank: 1, spot: "~$74", sentiment: "Bullish",
    catalyst: "Q2 earnings — Thu Jul 16 (after close) · BINARY tonight",
    iv: "Rich — options imply ±~8% into the print", liq: "Deep, very active mega-cap chain; penny-wide spreads",
    thesis: "Oversold ~30% over 3 months into a binary with rich IV and a Strong-Buy consensus → don't hold naked long premium (max crush). Cut vega with a debit spread, or get paid to be bullish via a defined-risk put-credit spread.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $70 / buy $65 · Aug 21 '26 · ~$1.60 credit · max loss/capital ~$340 · harvests the IV crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $74 / sell $82 · Jul 31 '26 · ~$3.20 net debit · cost/max loss ~$320 · vega-reduced" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$80 call · Jul 17 '26 · ~$1.30 debit · cost ~$130 · pure post-earnings pop (lottery)" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 2, spot: "~$396", sentiment: "Neutral-to-Bullish",
    catalyst: "Q2 earnings — Wed Jul 22 (after close) · BINARY",
    iv: "Elevated — options imply ±~7.6%", liq: "Deepest single-name options market; huge OI, tight spreads",
    thesis: "Deliveries (480K, +18% beat) are already known, so the print is a margin/Cybercab story with rich IV → prefer defined-risk, range-tolerant structures over naked longs. Sell premium below support; spread up for cheap upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $370 / buy $360 · Aug 21 '26 · ~$3.00 credit · max loss/capital ~$700 · bullish, range-tolerant" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $400 / sell $420 · Jul 31 '26 · ~$8.50 net debit · cost/max loss ~$850" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$420 call · Jul 24 '26 · ~$5.00 debit · cost ~$500 · robotaxi/margin pop" },
    ] },
  { ticker: "UNH", name: "UnitedHealth", rank: 3, spot: "~$424 (ESTIMATE, pre-print; gapped up on the beat)", sentiment: "Bullish",
    catalyst: "Q2 earnings — Thu Jul 16 (before open) · beat & raise, IV now crushing",
    iv: "Falling post-print — sell-premium regime favored", liq: "Deep large-cap chain; tight spreads",
    thesis: "A big beat ($6.38 vs $4.91) + FY raise resets the managed-care narrative and the binary is behind us, so IV is crushing → get paid via a defined-risk put-credit spread; spread up for continuation without paying rich vega.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $410 / buy $400 · Aug 21 '26 · ~$3.20 credit · max loss/capital ~$680 · paid on the beat, post-crush" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $425 / sell $445 · Aug 21 '26 · ~$8.00 net debit · cost/max loss ~$800" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$440 call · Aug 7 '26 · ~$4.00 debit · cost ~$400 · guidance-raise continuation" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 4, spot: "~$137", sentiment: "Bullish",
    catalyst: "Crude ~$80 & rising on US-Iran tension; Q2 report early Aug",
    iv: "Moderate — cheap enough that long premium is viable", liq: "Deep, liquid mega-cap energy chain",
    thesis: "Oil is bid on a standing geopolitical premium and there is no imminent binary, so moderate IV makes buying premium reasonable → own directional upside via an ITM call or a defined-cost call spread; a cheap OTM call for a supply-shock spike.",
    ideas: [
      { profile: "Conservative", strategy: "Long Call (ITM)", text: "$130 call · Sep 18 '26 · ~$9.50 debit · cost ~$950 · Δ≈0.70" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $137 / sell $150 · Aug 21 '26 · ~$4.50 net debit · cost/max loss ~$450" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$145 call · Aug 21 '26 · ~$1.80 debit · cost ~$180 · geopolitical-spike lottery" },
    ] },
  { ticker: "MU", name: "Micron", rank: 5, spot: "~$904 (ESTIMATE — memory supercycle re-rating; corroborated across sources)", sentiment: "Bullish (contrarian)",
    catalyst: "Oversold −8% on Samsung read-through; HBM sold out for 2026",
    iv: "Elevated after the memory-cycle scare", liq: "Deep, very active semi chain; tight spreads",
    thesis: "The selloff is sentiment (Samsung read-through + geopolitics), not a demand break — HBM is sold out for 2026 and inventories are below safety lines. Buy the dip with defined risk; keep spread widths narrow so a high-priced name still fits the capital cap.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $860 / buy $840 · Aug 21 '26 · ~$7.00 credit · max loss/capital ~$1,300 · paid to buy the memory dip" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $900 / sell $920 · Aug 21 '26 · ~$9.00 net debit · cost/max loss ~$900" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$960 call · Aug 7 '26 · ~$12.00 debit · cost ~$1,200 · HBM4 momentum" },
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
// today line sits on the boundary between Jul 16 and Jul 17
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Thursday, Jul 16 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jul 16)
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
