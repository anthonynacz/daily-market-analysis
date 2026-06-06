import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Saturday, June 6, 2026 (live-researched).
 * Window: last 3 days (Jun 3) → coming 5 days (Jun 11).
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

// 9-day axis: Jun 3 .. Jun 11. Today = index 3 (Jun 6).
const DAYS = [
  { idx: 0, date: "Jun 3", dow: "Wed" },
  { idx: 1, date: "Jun 4", dow: "Thu" },
  { idx: 2, date: "Jun 5", dow: "Fri" },
  { idx: 3, date: "Jun 6", dow: "Sat" }, // TODAY
  { idx: 4, date: "Jun 7", dow: "Sun" },
  { idx: 5, date: "Jun 8", dow: "Mon" },
  { idx: 6, date: "Jun 9", dow: "Tue" },
  { idx: 7, date: "Jun 10", dow: "Wed" },
  { idx: 8, date: "Jun 11", dow: "Thu" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Semiconductor rout: Nasdaq −4%, ~$1T wiped (MRVL −16%, MU −13%, AMD/INTC −11%)", tickers: "MRVL · MU · AMD · INTC",
    rec: "WATCH — don't catch the knife; let the AI-sentiment reset settle, then scale into quality (NVDA) on stabilization." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Broadcom AI guide disappoints; AVGO −14% despite record $22B rev (AI chips +143% YoY)", tickers: "AVGO",
    rec: "HOLD — results beat, the guide didn't; wait for a base before nibbling. A high-bar reset, not a broken story." },
  { id: "t3", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Chip-led melt-up stalls after record highs as AI valuations get questioned", tickers: "NVDA · TSM · ORCL",
    rec: "Trim extended winners and lock gains; keep a core AI position for the secular trend — momentum is cooling." },
  { id: "t4", ind: "tech", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Apple WWDC 2026 keynote (1pm ET, Mon) — Siri / Apple Intelligence revamp", tickers: "AAPL",
    rec: "BUY-the-event but size first — a credible Siri+AI story re-rates AAPL; don't chase a keynote gap." },
  { id: "t5", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Oracle FQ4 earnings (after close, Wed) — AI-infra tell after the AVGO scare", tickers: "ORCL",
    rec: "Wait for the print; strong OCI bookings revive the AI-infra trade, a soft guide extends the selloff." },
  { id: "t6", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "May CPI print (8:30 ET, Wed) — hot risk for high-multiple tech", tickers: "NVDA · MSFT · GOOGL",
    rec: "De-risk into the print; a cool number is the bull catalyst after the chip rout, a hot one pressures megacap multiples." },
  { id: "t7", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Adobe FQ2 earnings (after close, Thu) — AI monetization vs. a low bar", tickers: "ADBE",
    rec: "Down ~25% YTD with low expectations + $25B buyback; a 'less-bad' AI-revenue read can squeeze it higher." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "WTI −3% to ~$90 as US–Iran talks bleed out the war premium", tickers: "XOM · CVX · COP",
    rec: "Trim tactical energy longs into the de-escalation; the geopolitical premium is fading — keep only core E&P." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Chevron CEO warns spare-capacity buffers are being 'steadily drawn down'", tickers: "CVX · XOM",
    rec: "Constructive medium-term supply setup; accumulate quality majors on weakness, don't chase headline spikes." },
  { id: "e3", ind: "energy", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "OPEC+ monthly meeting (Sun) — output-policy decision", tickers: "XOM · CVX · OXY · USO",
    rec: "Cut fresh directional bets into Sunday; a bigger-than-expected hike is bearish crude, a pause is bullish." },
  { id: "e4", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "US–Iran negotiation headlines remain the oil swing factor", tickers: "XOM · CVX · OXY",
    rec: "Stay nimble; a deal caps crude (bearish energy), a breakdown snaps the risk premium back on hard." },
  { id: "e5", ind: "energy", dayIdx: 7, future: true, impact: 1, dir: "MIXED",
    headline: "EIA weekly petroleum status report (crude inventories)", tickers: "XOM · USO",
    rec: "Use the inventory print to time entries — demand signals matter more now that the war premium is bleeding off." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "CVS Caremark drops Wegovy preference; Lilly Foundayo gains formulary parity", tickers: "LLY · NVO",
    rec: "Bullish LLY / bearish NVO — Lilly is now covered by all three big PBMs; favor LLY on GLP-1 share gains." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "FDA 503B proposal to exclude semaglutide / tirzepatide — public comment period", tickers: "LLY · NVO · HIMS",
    rec: "Tailwind for branded GLP-1 volume, headwind for compounders; favor LLY/NVO over HIMS on durability." },
  { id: "h3", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Lilly oral GLP-1 Foundayo ramps US retail / telehealth launch (no food/water limits)", tickers: "LLY",
    rec: "Hold LLY for launch execution; a convenient once-daily pill widens the obesity TAM materially." },
  { id: "h4", ind: "health", dayIdx: 2, future: false, impact: 1, dir: "MIXED",
    headline: "Pharma leadership rotates: Biogen +13.5% YTD as Novo −8%", tickers: "BIIB · NVO",
    rec: "Selectivity matters — lean to franchises with momentum and clear catalysts; avoid broad sector baskets." },
  { id: "h5", ind: "health", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Defensive bid for large-cap pharma as yields spike post-jobs", tickers: "UNH · JNJ · ABBV",
    rec: "WATCH — quality pharma can act defensively if the rate scare deepens; add quality on rate-driven dips." },

  // ---- FINANCIALS ---------------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "May jobs +172K crush ~85K est.; 10Y yield jumps to ~4.54%", tickers: "JPM · BAC · WFC · GS",
    rec: "Favor NII-beneficiary banks (JPM/BAC); trim long-duration and rate-sensitive asset managers." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "Rate-cut hopes fade; 2Y yield +11bp to ~4.16% as hike chatter returns", tickers: "JPM · BAC · V · MA",
    rec: "Position higher-for-longer: asset-sensitive banks win; avoid adding rate-duration before the 6/17 FOMC." },
  { id: "f3", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Banks firm as a steeper curve lifts the net-interest-margin outlook", tickers: "JPM · BAC · GS · MS",
    rec: "Constructive for money-center banks; take partial profits into sharp one-day pops, add on pullbacks." },
  { id: "f4", ind: "finance", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "May CPI (8:30 ET) — first big print before Warsh's 6/17 FOMC", tickers: "JPM · BAC · V · MA",
    rec: "The week's biggest swing risk; keep dry powder, avoid fresh positions until after the print." },
  { id: "f5", ind: "finance", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Warsh-era Fed uncertainty as new chair signals a smaller balance sheet", tickers: "JPM · GS · MS",
    rec: "Expect policy-headline volatility; favor quality balance sheets, fade knee-jerk rate-headline moves." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Defensive rotation: KO, MCD, SHW green as money exits tech", tickers: "KO · MCD · WMT",
    rec: "Tilt toward staples / quality dividends if the growth-to-value rotation persists past the chip rout." },
  { id: "c2", ind: "consumer", dayIdx: 1, future: false, impact: 1, dir: "MIXED",
    headline: "Walmart holds near highs ($117–121) as a defensive share-gainer", tickers: "WMT · AMZN · TGT",
    rec: "Hold WMT as a defensive compounder; add on dips into its summer promo calendar." },
  { id: "c3", ind: "consumer", dayIdx: 0, future: false, impact: 1, dir: "BEARISH",
    headline: "Target stays cautious — Q1 EPS $1.71 vs $2.27 a year ago", tickers: "TGT",
    rec: "Stay cautious on TGT; wait for traffic stabilization before buying the turnaround." },
  { id: "c4", ind: "consumer", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Consumer-spending watch into May CPI — affordability vs. resilient jobs", tickers: "WMT · TGT · AMZN",
    rec: "WATCH — a hot CPI squeezes discretionary budgets; favor value retailers (WMT) over discretionary." },
  { id: "c5", ind: "consumer", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Nike countdown — Q4 print (~Jun 25) is the turnaround test", tickers: "NKE",
    rec: "WATCH — depressed expectations near multi-year lows; a 'less-bad' Greater China read could re-rate NKE." },
];

// ------------------------------------------------------------------ options
const OPTION_PLAYS = [
  { ticker: "AAPL", name: "Apple", rank: 1, spot: "~$308 (est.)",
    catalyst: "WWDC 2026 keynote — Mon Jun 8, 1pm ET (Siri / Apple Intelligence re-rating)",
    iv: "~25% — cheap/moderate (est.)", liq: "Deepest equity chain in the market; penny-wide spreads, huge OI",
    thesis: "Rare combo of a hard 2-day catalyst + cheap IV = asymmetric upside if the AI story lands, with limited IV-crush risk. Also a relative haven from the chip rout.",
    ideas: [
      { profile: "Conservative", text: "$300 call · Jul 17 '26 · ~$14.00 (ITM, Δ≈0.65) — est." },
      { profile: "Moderate",     text: "$310 call · Jun 19 '26 · ~$6.00 (ATM) — est." },
      { profile: "Aggressive",   text: "$325 call · Jun 12 '26 · ~$1.50 (OTM, pure WWDC pop) — est." },
    ] },
  { ticker: "ORCL", name: "Oracle", rank: 2, spot: "~$232 (est.)",
    catalyst: "FQ4 FY26 earnings — Wed Jun 10 (after close)",
    iv: "~73% / IVR ~90 — very elevated, ±~12% implied (est.)", liq: "Deep, very active AI-infrastructure chain",
    thesis: "Cleanest AI-infra read of the week into the print after the AVGO scare; booming OCI bookings can re-rate the trade. Rich IV → favor ITM to survive the crush.",
    ideas: [
      { profile: "Conservative", text: "$225 call · Jul 17 '26 · ~$14.50 (ITM, Δ≈0.6) — est." },
      { profile: "Moderate",     text: "$232.50 call · Jun 19 '26 · ~$11.50 (ATM) — est." },
      { profile: "Aggressive",   text: "$255 call · Jun 12 '26 · ~$3.00 (OTM; needs the implied move — max crush risk) — est." },
    ] },
  { ticker: "ADBE", name: "Adobe", rank: 3, spot: "~$258 (est.)",
    catalyst: "FQ2 FY26 earnings — Thu Jun 11 (after close)",
    iv: "Elevated, ~±7–9% earnings move (est.)", liq: "Deep large-cap software chain; tight spreads",
    thesis: "Down ~25% YTD with low expectations and a $25B buyback into the print; a 'less-bad' AI-monetization read is an oversold-bounce catalyst.",
    ideas: [
      { profile: "Conservative", text: "$250 call · Jul 17 '26 · ~$14.00 (ITM, Δ≈0.6) — est." },
      { profile: "Moderate",     text: "$260 call · Jun 19 '26 · ~$8.00 (ATM) — est." },
      { profile: "Aggressive",   text: "$275 call · Jun 12 '26 · ~$2.50 (OTM) — est." },
    ] },
  { ticker: "FDX", name: "FedEx", rank: 4, spot: "~$331 (est.)",
    catalyst: "Q4 FY26 earnings — ~Jun 18 (after close); post FedEx Freight spinoff",
    iv: "Elevated into earnings; unusual call activity flagged (est.)", liq: "Deep, liquid large-cap chain",
    thesis: "Two stacked catalysts — the just-completed FedEx Freight spinoff re-rating + earnings — on a raised FY26 EPS guide; a cyclical that's insulated from the AI-sentiment unwind.",
    ideas: [
      { profile: "Conservative", text: "$320 call · Jul 17 '26 · ~$14.00 (ITM, Δ≈0.6) — est." },
      { profile: "Moderate",     text: "$332.50 call · Jun 19 '26 · ~$9.00 (ATM) — est." },
      { profile: "Aggressive",   text: "$350 call · Jul 17 '26 · ~$5.00 (OTM breakout) — est." },
    ] },
  { ticker: "NKE", name: "Nike", rank: 5, spot: "~$44 (est.)",
    catalyst: "Q4 FY26 earnings — ~Jun 25 (after close)",
    iv: "~54%, ±~11% implied (est.)", liq: "Deep mega-cap chain; low share price = cheap $ premiums",
    thesis: "Max-pessimism turnaround near multi-year lows; any 'less-bad' Greater-China print re-rates off a deeply depressed base. Cheap, asymmetric, and uncorrelated to the tech rout.",
    ideas: [
      { profile: "Conservative", text: "$42 call · Jul 17 '26 · ~$3.50 (ITM, Δ≈0.65) — est." },
      { profile: "Moderate",     text: "$44 call · Jul 2 '26 · ~$2.00 (ATM) — est." },
      { profile: "Aggressive",   text: "$48 call · Jul 2 '26 · ~$0.70 (OTM turnaround pop) — est." },
    ] },
];

const RISK_COLORS = {
  Conservative: "#22c55e",
  Moderate:     "#eab308",
  Aggressive:   "#ef4444",
};

// ------------------------------------------------------------------ geometry
const M = { left: 78, top: 28, right: 26, bottom: 58 };
const PLOT_W = 720;
const PLOT_H = 384;
const COL_W = PLOT_W / DAYS.length;
const SVG_W = M.left + PLOT_W + M.right;
const SVG_H = M.top + PLOT_H + M.bottom;
// today line sits on the boundary between Jun 5 and Jun 6
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Saturday, Jun 6 2026</b> · window: last 3 days → next 5 days ·
            color = industry · dot = event · {DIR.BULLISH.glyph}/{DIR.BEARISH.glyph}/{DIR.MIXED.glyph} = bullish / bearish / mixed
          </div>
        </div>
        <div style={S.tabs}>
          <button style={tabBtn(tab === "matrix")} onClick={() => setTab("matrix")}>News Matrix</button>
          <button style={tabBtn(tab === "options")} onClick={() => setTab("options")}>Top Call Plays</button>
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
                ▸ TODAY (Jun 6)
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
              Strongest BUY-call candidates for the coming month — every idea quotes a premium <b style={{ color: "#e2e8f0" }}>under $15/contract</b> on a deep, liquid chain.
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
                  <span style={{ marginLeft: "auto", color: "#cbd5e1", fontSize: 13 }}>{p.spot}</span>
                </div>
                <div style={S.optMeta}><span style={S.k}>Catalyst</span> {p.catalyst}</div>
                <div style={S.optMeta}><span style={S.k}>IV</span> {p.iv}</div>
                <div style={S.optMeta}><span style={S.k}>Liquidity</span> {p.liq}</div>
                <div style={S.optThesis}>{p.thesis}</div>
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  {p.ideas.filter((i) => risk === "All" || i.profile === risk).map((i) => (
                    <div key={i.profile} style={S.ideaRow}>
                      <span style={{ ...S.ideaTag, background: RISK_COLORS[i.profile] }}>{i.profile}</span>
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
        ⚠ Educational analysis, <b>not financial advice</b>. Headlines/dates were live-researched on Jun 6 2026; option premiums are
        <b> estimates</b> from spot + implied vol — confirm live bid/ask and current prices on your broker before trading. Options can
        expire worthless; size aggressive OTM ideas as lottery tickets.
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ helpers
function dirColor(d) {
  return d === "BULLISH" ? "#22c55e" : d === "BEARISH" ? "#f43f5e" : "#94a3b8";
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
  ideaRow: { display: "flex", alignItems: "center", gap: 8, background: "#0b1220", padding: "6px 8px", borderRadius: 7 },
  ideaTag: { fontSize: 10, fontWeight: 800, color: "#0b1220", padding: "2px 7px", borderRadius: 5, width: 88, textAlign: "center", flexShrink: 0 },
  disclaimer: {
    marginTop: 16, fontSize: 11.5, color: "#64748b", lineHeight: 1.5,
    borderTop: "1px solid #1f2a3a", paddingTop: 12,
  },
};
