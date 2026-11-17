import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Tuesday, November 17, 2026 — trading-day edition, built pre-market (~2 am ET; no pre-market quotes yet, overnight ES −0.25% / NQ −0.1%); stock quotes = Mon Nov 16 close (Yahoo Finance chart, cross-checked with Cboe delayed quotes); option quotes, OI & volume = Cboe delayed chain after the Mon Nov 16 session (full-session volume).
 * Window: last 3 days (Nov 14) → coming 2 weeks (Dec 1).
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

// 18-day axis: Nov 14 .. Dec 1 (last 3 days → coming 2 weeks). Today = index 3 (Nov 17).
const DAYS = [
  { idx: 0, date: "Nov 14", dow: "Sat" },
  { idx: 1, date: "Nov 15", dow: "Sun" },
  { idx: 2, date: "Nov 16", dow: "Mon" },
  { idx: 3, date: "Nov 17", dow: "Tue" }, // TODAY
  { idx: 4, date: "Nov 18", dow: "Wed" },
  { idx: 5, date: "Nov 19", dow: "Thu" },
  { idx: 6, date: "Nov 20", dow: "Fri" },
  { idx: 7, date: "Nov 21", dow: "Sat" },
  { idx: 8, date: "Nov 22", dow: "Sun" },
  { idx: 9, date: "Nov 23", dow: "Mon" },
  { idx: 10, date: "Nov 24", dow: "Tue" },
  { idx: 11, date: "Nov 25", dow: "Wed" },
  { idx: 12, date: "Nov 26", dow: "Thu" },
  { idx: 13, date: "Nov 27", dow: "Fri" },
  { idx: 14, date: "Nov 28", dow: "Sat" },
  { idx: 15, date: "Nov 29", dow: "Sun" },
  { idx: 16, date: "Nov 30", dow: "Mon" },
  { idx: 17, date: "Dec 1", dow: "Tue" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// Upcoming events cannot have a known outcome, so their `dir` is a LEAN, not a result:
//   dir BULLISH / BEARISH = the evidence leans that way; `conf` (1-3) says how strongly
//   and `basis` names the evidence. dir MIXED = pending, no measurable lean.
// `conf` and `basis` are optional and only used on upcoming events (see template/LEAN_RULES.md).
const CONF_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };
const PENDING_GLYPH = "?";
const isPending = (e) => e.future && e.dir === "MIXED";
const dirGlyph = (e) => (isPending(e) ? PENDING_GLYPH : DIR[e.dir].glyph);
const dirLabel = (e) => {
  if (!e.future) return DIR[e.dir].label;
  if (e.dir === "MIXED") return "Pending · no lean";
  return `Leans ${DIR[e.dir].label.toLowerCase()} · ${CONF_LABEL[e.conf] || "LOW"} confidence`;
};

// Running score of past leans vs what actually happened (updated by the daily run).
const LEAN_RECORD = { hits: 0, misses: 0, since: "" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS ------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Sun Nov 15: Treasury Secretary Bessent calls for tighter enforcement of chip export controls to China and gives NVIDIA's board 10 days to answer ('we need answers in the next 10 days from the board and from the outside counsel'); NVIDIA fell 4.1% the next session [Investing.com / Reuters; Yahoo]", tickers: "NVDA · AMD · SMH",
    rec: "WATCH: a policy overhang with a dated deadline (~Nov 25, EST.). Avoid adding semis until the board responds." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 16: semis rout. SMH −5.1% to $461.90 (−14.4% in a month, 17.2% under its 50-day); Micron −7.6% to $719.02, Intel −7.0% to $55.47, AMD −5.6% to $504.28, Broadcom −3.9% to $333.40, as traders unwound NVIDIA-rival bets before earnings [Yahoo; Investing.com / Reuters]", tickers: "SMH · MU · AMD · INTC",
    rec: "SELL strength / WATCH: SMH ($461.90) is 3% above its $447.73 20-day low; a bear put spread fits only on a close below it. Stand aside if NVIDIA's guide reverses the tape." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 16: NVIDIA −4.1% to $156.14 (−27% in a month, 26.8% under its 50-day, RSI 22.7) after reports the board is not discussing Huang's return; Bessent urged an outside CEO. New Commerce licensing rules for Singapore, Thailand, Malaysia and Indonesia close the remote-access loophole [BigGo Finance; Investing.com; Yahoo]", tickers: "NVDA",
    rec: "HOLD (no new size): deeply oversold into tonight's binary. Use defined-risk structures only (see the NVDA neutral play)." },
  { id: "t4", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 16: megacaps sold. Alphabet −4.1% to $283.72, Amazon −3.3% to $257.75, Microsoft −1.1% to $517.99, Apple −1.0% to $352.78; Nasdaq-100 −2.67% to 27,197, its lowest close since Nov 9 [Yahoo; Investing.com]", tickers: "GOOGL · AMZN · MSFT",
    rec: "WATCH: Apple (above its 50-day $339.69) is the relative-strength holdout; Microsoft sits on its 50-day ($519.36)." },
  { id: "t5", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Tue Nov 17 AMC: NVIDIA Q3 FY27, first report under interim CEO Colette Kress. Consensus EPS $2.49 (14 est.; 1 up / 0 down in 4 wks), revenue ~$108–109B, gross-margin guide ~74%. The Nov 20 straddle prices ±9.7% vs an average ±4.8% over the last 4 prints (±4.0% over 8; 3 up / 5 down) [Nasdaq; Cboe; Yahoo; Pepperstone; BigGo]", tickers: "NVDA · SMH · QQQ",
    rec: "WATCH (both ways): options price twice the usual reaction. A beat-and-raise can squeeze a washed-out group; a soft guide or governance surprise breaks $150. Defined-risk only." },
  { id: "t6", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Tue Nov 17: Microsoft Ignite opens (Nov 17–20, Moscone Center, San Francisco): Azure, AI-agent and Copilot announcements expected [ITDaily; ecorpit; Inven Global]", tickers: "MSFT",
    rec: "HOLD: product news rarely moves MSFT as much as tonight's NVIDIA print will; it sits on its 50-day." },
  { id: "t7", ind: "tech", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Nov 18 AMC: Palo Alto Networks FQ1 (consensus EPS $0.52; 0 up / 0 down). The stock fell after each of its last 4 reports (−9.3%, −5.6%, −6.8%, −7.4%); the Nov 20 straddle prices ±11.6% [Nasdaq; Yahoo; Cboe]", tickers: "PANW",
    rec: "WATCH: four straight post-earnings drops show a high bar, but 4 prints are too few to call a lean. Avoid selling strikes inside ±12%." },
  { id: "t8", ind: "tech", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Thu Nov 19: Anthropic's Nasdaq debut (ANT) expected after pricing Wed Nov 18, subject to regulatory clearance: ~825M Class A shares at $70–78 (up to ~$64.4B) plus a $26B private placement; valuation reported at $1.2–1.4T (EST.) [FourWeekMBA; Newsquawk; letsdatascience; Renaissance Capital]", tickers: "QQQ · AMZN · GOOGL",
    rec: "WATCH: the year's largest equity-supply event lands on a weak AI complex. Avoid adding AI longs into Thursday; a strong debut would ease the supply worry." },
  { id: "t9", ind: "tech", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 19: Alibaba (cons. EPS $1.56) and PDD ($2.61) before the open; Intuit ($2.47) and Keysight ($3.09) after the close. BABA's Nov 20 straddle prices ±7.7% vs ±4.7% average over 4 prints [Nasdaq; Cboe; Yahoo]", tickers: "BABA · PDD · INTU",
    rec: "WATCH: options price well above BABA's recent average move; no edge pre-print." },
  { id: "t10", ind: "tech", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "Mon Nov 23 AMC: Hewlett Packard Enterprise (cons. EPS $1.17; 1 up / 0 down), Agilent ($1.72), Zoom ($1.00) [Nasdaq earnings calendar]", tickers: "HPE · ZM",
    rec: "LOW signal: HPE is a read on AI-server demand after NVIDIA and before Dell." },
  { id: "t11", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24: Dell FQ3 AMC (cons. EPS $6.41; 0 revisions; it rose after each of its last 4 prints: +15.8%, +32.8%, +21.9%, +5.8%); Analog Devices BMO ($3.89; 1 up / 0 down); Workday ($1.28), Autodesk ($2.27), HP ($0.75) AMC [Nasdaq; Yahoo]", tickers: "DELL · ADI · WDAY",
    rec: "WATCH: Dell's history is one-sided but only 4 prints; keep any position small and defined-risk." },
  { id: "t12", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "~Wed Nov 25 (EST.): end of Bessent's 10-day window for NVIDIA's board to show export-control compliance (set Sun Nov 15) [Investing.com / Reuters]", tickers: "NVDA · SMH",
    rec: "WATCH: a credible board response removes an overhang; escalation (probe, penalties, leadership changes) hits the whole chip group." },
  { id: "t13", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30: AWS re:Invent opens (Nov 30–Dec 4, Las Vegas): AI-infrastructure and agent announcements [ecorpit; CX Today]", tickers: "AMZN",
    rec: "WATCH: AMZN ($257.75) is just above its 50-day ($254.80); re:Invent is a sentiment catalyst, not an earnings one." },
  { id: "t14", ind: "tech", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1 AMC: CrowdStrike (cons. EPS $0.00), Marvell ($0.79; 0 up / 1 down), NetApp ($2.13), Okta ($0.43), MongoDB ($0.08), Credo ($1.03) [Nasdaq earnings calendar]", tickers: "MRVL · CRWD",
    rec: "WATCH: Marvell is the first AI-silicon print after NVIDIA; MRVL fell 7.3% on Nov 16 with the group." },
  // ---- ENERGY ------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 16: crude breaks lower. WTI front-month ~$85.7 (−17.9% in a month, 10.5% under its 50-day; ~$85.1 overnight), Brent ~$92.4; XLE −1.96% to $63.69 (below its 50-day $64.98), Exxon −2.2% to $166.87; copper slipped under $6 and Freeport −6.8% to $55.19 [Yahoo]", tickers: "XLE · XOM · FCX",
    rec: "WATCH: bearish below XLE ~$61.62 (20-day low). XLE option quotes were too wide (17–43% of mid) to pass today's liquidity gate, so no play." },
  { id: "e2", ind: "energy", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "TODAY Tue Nov 17, 4:30 pm ET: API weekly crude stocks (prior +9.0M bbl) [Nasdaq economic calendar]", tickers: "USO · XLE",
    rec: "LOW signal: a second large build would add to the oversupply story ahead of EIA." },
  { id: "e3", ind: "energy", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Nov 18, 10:30 am ET: EIA weekly petroleum status report (prior week crude +4.66M bbl, gasoline +1.80M) [Nasdaq economic calendar]", tickers: "USO · XLE",
    rec: "WATCH: back-to-back builds would confirm the glut narrative behind crude's −18% month." },
  { id: "e4", ind: "energy", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "Sun Nov 29: 42nd OPEC+ ministerial meeting (all 21 members) is expected to set the 2027 production framework and capacity-based baselines; the IEA and others warn of 2027 excess supply if Gulf flows normalise; the capacity review is running late [OPEC 41st meeting statement via search; EngineeringNews / Reuters; GV Wire]", tickers: "XLE · XOM · CVX",
    rec: "WATCH (both ways): higher 2027 baselines extend crude's slide; a disciplined framework could squeeze shorts. Stay defined-risk through the weekend gap." },
  // ---- HEALTHCARE / BIOTECH ----------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Sat Nov 14 PDUFA: Summit's ivonescimab in EGFR-mutant NSCLC (overall survival HR 0.78–0.79, not statistically significant; FDA had said significant OS is needed). No decision found in retrieved sources; SMMT −16.5% to $11.82 Monday and −33.7% in 5 sessions; Cytokinetics −5.3% [Fierce Pharma; BioSpace; Yahoo]", tickers: "SMMT · CYTK",
    rec: "AVOID SMMT until the FDA outcome is public; the tape is pricing a negative or delayed decision." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Mon Nov 16: managed care rallies on a down tape. Centene +4.9% to $74.77, Elevance +3.9% to $446.28, Humana +2.5% to $461.25, UnitedHealth +1.1% to $412.02 (5.2% above its 50-day); no single catalyst found in retrieved sources [Yahoo]", tickers: "UNH · CNC · ELV",
    rec: "BUY dips with defined risk: insurers show relative strength. Invalid below UNH's 50-day (~$392)." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 16: biotech slides. XBI −3.1% to $145.88 (−7.0% in 5 sessions, 5.2% below its 50-day); Capricor −12.9% to $8.30 ahead of its Nov 22 PDUFA [Yahoo]", tickers: "XBI · CAPR",
    rec: "WATCH: XBI lost its 50-day. Avoid binary-event longs while risk appetite is falling." },
  { id: "h4", ind: "health", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Sun Nov 22 PDUFA: Capricor deramiocel in Duchenne (extended from Aug 22; July advisory committee voted 9–3 against effectiveness in DMD cardiomyopathy; sources differ on the refined indication) [NeurologyLive; BioPharm International; checkrare]", tickers: "CAPR",
    rec: "AVOID binary sizing: single-outcome event with a negative adcom on record." },
  { id: "h5", ind: "health", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Medtronic FQ2 FY27 (cons. EPS $1.34; 0 revisions); MDT +3.8% average move over its last 4 prints [Nasdaq; Yahoo]", tickers: "MDT",
    rec: "HOLD: no edge before the print." },
  { id: "h6", ind: "health", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27 PDUFA: BridgeBio BBP-418 in LGMD2I/R9 (priority review); BBIO $77.36, +16.5% in a month [2 Minute Medicine; checkrare; Yahoo]", tickers: "BBIO",
    rec: "WATCH: a binary on a holiday-thinned session after a strong run; defined-risk only." },
  { id: "h7", ind: "health", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 PDUFA: Vertex povetacicept in IgA nephropathy (priority review, accelerated approval) [checkrare; 2 Minute Medicine]", tickers: "VRTX",
    rec: "HOLD VRTX ($537.79): a new label is incremental for a mega-cap." },
  // ---- FINANCIALS / MACRO / RATES / CRYPTO -------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 16: S&P 500 −1.92% to 7,416.59, Nasdaq-100 −2.67%, Russell 2000 −1.70%, Dow −1.41% to 51,608; equal-weight S&P (RSP) only −1.0%; VIX +18.7% to 22.91 vs VIX3M 23.02 (flat term structure) [Yahoo; Investing.com]", tickers: "SPY · QQQ · IWM",
    rec: "HEDGE: QQQ is 7.7% under its 50-day and 3.0% under its 200-day; index bear put spreads fit (see the QQQ play)." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Mon Nov 16: Treasury curve 2-yr 4.83%, 10-yr 5.12% (2s10s +29 bp), 30-yr 5.46%; dollar index 103.48, 1.9% above its 50-day; TLT unchanged at $79.38 [US Treasury; Yahoo]", tickers: "TLT · UUP",
    rec: "WATCH: long-end yields above 5% plus a firm dollar keep pressure on long-duration assets and gold." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 16: crypto slides. IBIT −5.5% to $36.79 (RSI 23.6, −20% in a month), Strategy −7.7% to $103.03, Coinbase −6.1% to $119.84; Bitcoin ~$64.4k overnight. Spot Bitcoin ETF outflows near $3B in November, with IBIT's largest-ever daily outflow ($523M) [Yahoo; Cointelegraph; Decrypt]", tickers: "IBIT · MSTR · COIN",
    rec: "SELL rallies with bear put spreads, not naked puts, given oversold RSIs (see the IBIT play)." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 16: gold makes a new 20-day low. GLD −0.7% to $352.93 (−7.0% in 5 sessions, 7.1% under its 50-day, 13.5% under its 200-day); gold futures ~$3,853 settle, ~$3,877 overnight [Yahoo]", tickers: "GLD · GDX",
    rec: "SELL rallies toward $366 with defined risk (see the GLD play)." },
  { id: "f5", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Tue Nov 17: October retail sales 8:30 am (cons. +0.1% vs +0.8% prior; control +0.4%), industrial production 9:15 (cons. 0.0%), NAHB 10:00 (cons. 29); Waller 9:10, Williams 2:25 pm [Nasdaq economic calendar]", tickers: "XRT · SPY",
    rec: "WATCH (both ways): a hot print adds to December-hike odds (bad for TLT and growth); a weak control group hits retailers before TGT and WMT report." },
  { id: "f6", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Nov 18: FOMC minutes (Oct meeting) 2:00 pm; housing starts 8:30 (cons. 1.25M) / permits (1.38M); 20-yr bond auction 1:00 pm; Barr 1:35, Williams 2:30, Kashkari 4:15 [Nasdaq economic calendar]", tickers: "TLT · SPY",
    rec: "WATCH: the minutes show how many members already favored hiking; hawkish detail pressures TLT and QQQ into Anthropic's debut." },
  { id: "f7", ind: "finance", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 20: monthly options expiration (Nov 20 monthlies listed on Cboe), after a week of NVIDIA and IPO flows [Cboe delayed chains]", tickers: "SPY · QQQ",
    rec: "WATCH: expect pinning and heavy volume; avoid opening size into the close." },
  { id: "f8", ind: "finance", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 23: S&P Global flash PMIs 9:45 am (prior manufacturing 54.9, services 56.1); 2-yr note auction 1:00 pm [Nasdaq economic calendar]", tickers: "SPY · TLT",
    rec: "WATCH: a strong services print supports the hiking path." },
  { id: "f9", ind: "finance", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24: Conference Board consumer confidence 10:00 am (prior 91.7), Case-Shiller home prices 9:00, Richmond Fed index; 5-yr note auction 1:00 pm [Nasdaq economic calendar]", tickers: "XLY · TLT",
    rec: "WATCH: the last confidence read before Black Friday." },
  { id: "f10", ind: "finance", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Nov 25, 8:30 am: Q3 GDP second estimate (prior 3.4%), October personal income / PCE (prior core +0.3% m/m, 3.1% y/y), durable goods, jobless claims; new home sales 10:00; 7-yr auction 1:00; Beige Book 2:00 pm [Nasdaq economic calendar]. BofA and JPMorgan expect core PCE to rise to 3.2% y/y [TheStreet]", tickers: "TLT · SPY · GLD",
    rec: "WATCH (both ways): core PCE is the Fed's gauge before Dec 8–9. Hot → TLT and GLD down; soft → bonds and gold rally." },
  { id: "f11", ind: "finance", dayIdx: 12, future: true, impact: 1, dir: "MIXED",
    headline: "Thu Nov 26: Thanksgiving, US markets closed; Fri Nov 27 early close at 1:00 pm [Nasdaq economic calendar]", tickers: "SPY",
    rec: "NOTE: holiday-thin liquidity; avoid opening short-dated positions Wednesday afternoon." },
  { id: "f12", ind: "finance", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 close: MSCI removes Strategy from its USA, World and ACWI indexes under its new non-operating-company rule; MSCI-linked funds hold ~13M shares (3.1% of basic shares) [Cointelegraph; Bitcoin Magazine; investingLive]", tickers: "MSTR · IBIT",
    rec: "WATCH: forced selling is known and partly priced (MSTR −18% in 5 sessions); don't catch the knife before the close." },
  { id: "f13", ind: "finance", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1: ISM manufacturing PMI 10:00 am and JOLTS (both EST., not yet confirmed); Chicago PMI Mon Nov 30 9:45 (prior 55.3). November jobs report follows Fri Dec 4 [financecalendar; Nasdaq economic calendar; TheStreet]", tickers: "SPY · TLT",
    rec: "WATCH: the first December data sets the tone for the Dec 4 payrolls and the Dec 8–9 FOMC." },
  // ---- CONSUMER / RETAIL -------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Mon Nov 16: staples hold up. Tyson +8.7% to $63.95 after FQ4 results, XLP +0.3% to $92.60 (+5.7% in a month), Coca-Cola +0.2% to $99.48, Walmart +0.25% to $128.41 near its 20-day high [Yahoo]", tickers: "XLP · TSN · WMT",
    rec: "HOLD staples: defensive rotation is intact; wait for pullbacks rather than chasing." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 16: discretionary slips. XLY −1.5%, XRT −1.6% to $89.59; TJX −2.4% to $131.09 (12.8% under its 200-day) into Wednesday's print; Take-Two −6.3% to $213.47 three days before GTA VI [Yahoo]", tickers: "XLY · TJX · TTWO",
    rec: "WATCH: off-price retail is weak into earnings; TJX options (~18k contracts) are too thin for a play." },
  { id: "c3", ind: "consumer", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Tue Nov 17 BMO: Home Depot Q3 (cons. EPS $3.86; 2 up / 2 down). The Nov 20 straddle prices ±4.7% vs an average ±2.2% over the last 4 prints [Nasdaq; Cboe; Yahoo]", tickers: "HD",
    rec: "WATCH (both ways): options price twice HD's recent average move; a defined-risk range outside ±5% fits better than a directional bet." },
  { id: "c4", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Tue Nov 17 BMO: Disney FQ4 (CONFIRMED by Disney IR; webcast 8:30 am ET). Cons. EPS $1.67 (0 up / 2 down); the Nov 20 straddle prices ±6.6% vs an average ±6.5% over the last 4 prints [Disney IR; Nasdaq; Cboe; Yahoo]", tickers: "DIS",
    rec: "WATCH: a miss or soft parks outlook gives a bear put spread room below $113; a streaming beat can lift it 5–7%." },
  { id: "c5", ind: "consumer", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Nov 18 BMO: Target Q3 (cons. EPS $2.04; 2 up / 1 down; Nov 20 straddle ±9.1% vs ±4.4% average) and TJX ($1.33; 0 revisions; ±5.8% vs ±2.8%) [Nasdaq; Cboe; Yahoo]", tickers: "TGT · TJX",
    rec: "WATCH (both ways): implied moves are about double recent averages, so a defined-risk range beats a directional bet." },
  { id: "c6", ind: "consumer", dayIdx: 4, future: true, impact: 2, dir: "BEARISH", conf: 1, basis: "4-wk EPS revisions 1 up / 3 down for Q3 (cons. $2.86) [Nasdaq estimate data]",
    headline: "Wed Nov 18 BMO: Lowe's Q3 (cons. EPS $2.86; 4-week revisions 1 up / 3 down); the Nov 20 straddle prices ±5.1% vs an average ±3.2% over the last 4 prints [Nasdaq; Cboe; Yahoo]", tickers: "LOW",
    rec: "WATCH: estimates are drifting lower into the print. LOW options are too thin (~5k contracts) to trade; use it as a read for HD and housing." },
  { id: "c7", ind: "consumer", dayIdx: 5, future: true, impact: 3, dir: "BULLISH", conf: 1, basis: "4-wk EPS revisions 3 up / 0 down for Q3 (cons. $0.64) [Nasdaq estimate data]; note: fell after 3 of last 4 prints (only 4 obs, not counted)",
    headline: "Thu Nov 19 BMO: Walmart Q3 FY27 (cons. EPS $0.64; 4-week revisions 3 up / 0 down); the Nov 20 straddle prices ±6.3% vs ±6.1% average, and it fell after 3 of its last 4 prints. Ross ($1.82) and Gap ($0.77) after the close; Williams-Sonoma ($2.17) BMO [Nasdaq; Cboe; Yahoo]", tickers: "WMT · ROST",
    rec: "BUY via defined risk (see the WMT play): estimates are rising, but WMT has sold off on beats; a miss or cautious holiday guide can take it to $120." },
  { id: "c8", ind: "consumer", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 19: Grand Theft Auto VI launches on PS5 and Xbox Series X|S; Take-Two (CEO Zelnick) has repeatedly confirmed the date; FY27 net bookings guide $8.0–8.2B relies on it [TechRadar; heise; PCWorld]", tickers: "TTWO · SONY",
    rec: "WATCH: TTWO fell 6.3% on Nov 16; launch-week sales data decide sell-the-news vs re-rating." },
  { id: "c9", ind: "consumer", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Best Buy (cons. EPS $1.48; 1 up / 0 down), Dollar Tree ($0.88; 0 up / 1 down), Burlington ($1.69), Dick's ($1.38), J.M. Smucker ($2.50); Urban Outfitters AMC [Nasdaq earnings calendar]", tickers: "BBY · DLTR · XRT",
    rec: "WATCH: the last big retail read before Black Friday; BBY options are thin, so use XRT for any view." },
  { id: "c10", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Nov 25 BMO: Deere FQ4 (cons. EPS $4.07; 1 up / 0 down); average ±7.9% over its last 3 reported prints [Nasdaq; Yahoo]", tickers: "DE",
    rec: "WATCH: ag-cycle read into the holiday; DE options are thin (~3k contracts), so no play." },
  { id: "c11", ind: "consumer", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27: Black Friday (shortened session, 1:00 pm close) kicks off holiday shopping; Cyber Monday Nov 30 [Nasdaq economic calendar]", tickers: "XRT · AMZN · WMT",
    rec: "WATCH: early foot-traffic and online-sales tallies set the tone for retail into December." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "QQQ", name: "Invesco QQQ (Nasdaq-100)", rank: 1, spot: "$661.75 (Mon Nov 16 close, −2.67%; pre-mkt n/a at the ~2 am ET build — NQ futures −0.1% overnight) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF) · NVIDIA Q3 today Nov 17 AMC (CONFIRMED; cons. EPS $2.49 / rev ~$108–109B) · retail sales Nov 17 (CONFIRMED) · FOMC minutes Nov 18 2:00 pm (CONFIRMED) · Anthropic IPO first trade ~Nov 19 (EST.; ~$64.4B + $26B placement) · Bessent's NVIDIA deadline ~Nov 25 (EST.) · GDP / PCE Nov 25 (CONFIRMED) · ex-dividend before expiry: none sourced",
    iv: "IV 28.7% (Dec 18 ATM) vs 20-day realized 35.6% · IVR n/a · 25Δ put skew +8.7 pts · Dec 18 straddle ±6.8% · 1σ to expiry ±$55.33", liq: "A — 8.47M contracts traded Mon (full session), 20d avg 49.6M shares; OI 79.2k / 30.5k on 720C/730C, 41.7k / 32.2k on 660P/625P, 41.6k / 22.6k on 645P/605P; every leg ≤$0.16 wide (≤3.0%) [Cboe delayed chain]",
    thesis: "Nasdaq-100 breakdown: QQQ $661.75 is 7.7% under its 50-day ($716.72) and 3.0% under its 200-day ($682.44), −6.8% in a month, RSI 37.8, and the selling is concentrated in AI/semis (SMH −14.4% in a month vs equal-weight S&P −1.0% Monday) with VIX 22.91 flat to VIX3M 23.02. Implied vol (28.7%) is below 20-day realized (35.6%), so puts are not overpriced into NVIDIA tonight, FOMC minutes and ~$64B of Anthropic supply. Risk: positioning is already washed out (Deutsche Bank tech positioning at the 7th percentile as of Nov 9) and a clean NVIDIA beat could squeeze QQQ back through its 200-day. Invalid above $683 (a close over the 200-day). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $720C / buy $730C (mids 2.775 − 1.665) · Dec 18 '26 · credit $1.11 · capital ~$889 · max profit ~$111 · BE $721.11 · R:R 1:0.12 · POP ~87% · exit +50% / stop on a close above $683 invalidation or through $720; close by Dec 11 — short strike beyond 1σ ($717.08); profits if QQQ simply stays below its falling 50-day" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $660P / sell $625P (mids 20.290 − 10.260) · Dec 18 '26 · debit $10.03 · capital ~$1,003 · max profit ~$2,497 · BE $649.97 · R:R 1:2.49 · POP ~43% · exit +75–100% (~$17.55–$20.06) / stop −50% (~$5.01) or a close above $683 — near-the-money long put (Δ −0.46), short at ~0.66σ; the spread caps vega around NVIDIA" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $645P / sell $605P (mids 15.160 − 6.945) · Dec 18 '26 · debit $8.21 · capital ~$821 · max profit ~$3,179 · BE $636.79 · R:R 1:3.87 · POP ~34% · exit +100% (~$16.42) / stop −50% (~$4.11) or a close above $683 — targets the 1σ low (~$606); IV skew is steep, so selling the $605P beats a naked long put" },
    ] },
  { ticker: "GLD", name: "SPDR Gold Shares", rank: 2, spot: "$352.93 (Mon Nov 16 close, −0.71%; fresh 20-day low; gold futures +0.6% overnight to ~$3,877, pre-mkt GLD n/a) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF), no dividend · retail sales Nov 17 · FOMC minutes Nov 18 (CONFIRMED) · GDP / core PCE Nov 25 (CONFIRMED; BofA / JPM see core PCE rising to 3.2% y/y) · FOMC Dec 8–9 with a hike expected by all four banks surveyed (TheStreet)",
    iv: "IV 24.3% (Dec 18 ATM) vs 20-day realized 27.4% · IVR n/a · 25Δ put skew +1.9 pts (flat) · Dec 18 straddle ±5.8% · 1σ to expiry ±$24.99", liq: "A — 320k contracts traded Mon (full session), 20d avg 9.5M shares; OI 25.4k / 16.4k on 380C/390C, 3.4k / 4.4k on 355P/330P, 3.3k / 1.8k on 345P/325P; legs $0.06–0.25 wide (1.8–5.6%) [Cboe delayed chain]",
    thesis: "Clean downtrend: GLD $352.93 closed at a fresh 20-day low, 7.1% under its 50-day ($379.83) and 13.5% under its 200-day ($407.96), −7.0% in 5 sessions, RSI 36.5. The macro drivers point the same way: a 5.12% 10-year, 2-year 4.83%, the dollar index at 103.48 (1.9% above its 50-day) and a December hike in consensus forecasts. IV (24.3%) is below realized (27.4%) and skew is flat, so downside is cheap. Risk: ~31% off its $509.70 52-week high and oversold; gold futures bounced 0.6% overnight, and a soft PCE on Nov 25 or a safe-haven bid could spark a reflex rally. Invalid above $366 (the Nov 11 breakdown area). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $380C / buy $390C (mids 2.275 − 1.240) · Dec 18 '26 · credit $1.03 · capital ~$897 · max profit ~$103 · BE $381.03 · R:R 1:0.11 · POP ~82% · exit +50% / stop on a close above $366 invalidation; close by Dec 11 — short strike beyond 1σ ($377.92) and at the 50-day; collects premium on a failed bounce" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $355P / sell $330P (mids 10.625 − 2.675) · Dec 18 '26 · debit $7.95 · capital ~$795 · max profit ~$1,705 · BE $347.05 · R:R 1:2.14 · POP ~42% · exit +75–100% (~$13.91–$15.90) / stop −50% (~$3.98) or a close above $366 — slightly in-the-money long (Δ −0.50), short near the 1σ low ($327.94)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $345P / sell $325P (mids 6.375 − 1.965) · Dec 18 '26 · debit $4.41 · capital ~$441 · max profit ~$1,559 · BE $340.59 · R:R 1:3.54 · POP ~32% · exit +100% (~$8.82) / stop −50% (~$2.21) or a close above $366 — cheap OTM spread for a continuation to the 1σ zone" },
    ] },
  { ticker: "IBIT", name: "iShares Bitcoin Trust ETF", rank: 3, spot: "$36.79 (Mon Nov 16 close, −5.52%; Bitcoin ~$64.4k overnight, −0.7%; pre-mkt IBIT n/a) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF), no dividend · spot Bitcoin ETF outflows near $3B in November, IBIT's record $523M one-day outflow (Cointelegraph) · NVIDIA Nov 17 and FOMC minutes Nov 18 (risk appetite) · MSCI drops Strategy at the Nov 30 close (~13M MSTR shares held by MSCI-linked funds) · PCE Nov 25",
    iv: "IV 43.6% (Dec 18 ATM), 43.0% (Jan 15) vs 20-day realized 41.6% · IVR n/a · 25Δ put skew +6.8 pts · Dec 18 straddle ±10.4% · 1σ to Dec 18 ±$4.68", liq: "A — 888k contracts traded Mon (full session), 20d avg 45.0M shares; OI 21.1k / 22.6k on Jan 38P/31P, 14.0k / 18.5k on Dec 37P/33P, 30.8k / 19.1k on Dec 35P/32P; legs $0.01–0.10 wide (1.5–6.9%) [Cboe delayed chain]",
    thesis: "Bitcoin is in a liquidation-driven downtrend: IBIT is 18.8% under its 50-day ($45.30) and 10.3% under its 200-day ($41.00), −20.3% in a month and −13.1% in 5 sessions, with ETF outflows near $3B this month and forced MSTR index selling due Nov 30. Risk: RSI 23.6 is deeply oversold and $60–62k Bitcoin is a widely watched shelf, so a sharp short-covering bounce is likely along the way; IV ≈ realized, so these are spreads, not naked puts. Invalid above $41 (the 200-day). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (wide, longer-dated)", text: "Buy $38P / sell $31P (mids 3.050 − 0.725) · Jan 15 '27 · debit $2.32 · capital ~$232 · max profit ~$468 · BE $35.68 · R:R 1:2.02 · POP ~46% · exit +75% (~$4.06) or at $31–32 / stop −50% (~$1.16) or a close above $41 — in-the-money long put with 59 days of runway survives a relief bounce" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $37P / sell $33P (mids 1.935 − 0.665) · Dec 18 '26 · debit $1.27 · capital ~$127 · max profit ~$273 · BE $35.73 · R:R 1:2.15 · POP ~43% · exit +75–100% (~$2.22–$2.54) / stop −50% (~$0.64) or a close above $41 — at-the-money long (Δ −0.48), short near the 1σ low ($32.11)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $35P / sell $32P (mids 1.150 − 0.505) · Dec 18 '26 · debit $0.64 · capital ~$64 · max profit ~$236 · BE $34.36 · R:R 1:3.69 · POP ~32% · exit +100% (~$1.28) / stop −50% (~$0.32) or a close above $41 — pays ~3.7:1 if Bitcoin loses the $60–62k shelf" },
    ] },
  { ticker: "WMT", name: "Walmart", rank: 4, spot: "$128.41 (Mon Nov 16 close, +0.25%; 20-day high $129.17; pre-mkt n/a) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bullish",
    catalyst: "Q3 FY27 earnings Thu Nov 19 BMO (EST. — Nasdaq calendar; company confirmation not retrieved) · cons. EPS $0.64 (12 est.; 3 up / 0 down in 4 wks) / rev n/a · retail sales Nov 17; HD today, TGT / LOW / TJX Nov 18 read-through · ex-dividend Dec 11 ($0.2475, Nasdaq) — inside the expiry",
    iv: "IV 34.6% (Dec 18 ATM; event-inflated) vs 20-day realized 24.9% · IVR n/a · implied move ±6.3% (Nov 20 straddle) vs hist. ±6.1% (last 4) · 1σ to expiry ±$12.95", liq: "A — 75.9k contracts traded Mon (full session), 20d avg 21.9M shares; OI 11.5k / 8.3k on 120C/130C, 8.3k / 9.5k on 130C/140C, 9.7k / 9.5k on 135C/140C; legs $0.08–0.35 wide (3.3–5.5%) [Cboe delayed chain]",
    thesis: "Defensive leadership into a dated catalyst: staples were among the few groups up Monday, and WMT ($128.41, +8.1% in a month) is 11.7% above its 50-day ($114.96) and 7.9% above its 200-day ($118.98), within 1% of its 20-day high; Q3 EPS estimates went 3 up / 0 down in four weeks. Debit spreads cap vega, since IV is inflated by the print. Risk: WMT fell after 3 of its last 4 reports (−9.2%, −7.3%, −1.4%) even on beats, and RSI 68 means the bar is high. Invalid below $120 (the implied-move floor). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread (ITM)", text: "Buy $120C / sell $130C (mids 10.625 − 4.550) · Dec 18 '26 · debit $6.07 · capital ~$607 · max profit ~$393 · BE $126.07 · R:R 1:0.65 · POP ~55% · exit at ~80% of max value (~$8.00) / stop −50% (~$3.04) or a close below $120; close before Dec 10 if the short $130C is ITM (Dec 11 ex-div) — breakeven sits below spot, so it still pays if WMT holds most of a muted post-print reaction" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $130C / sell $140C (mids 4.550 − 1.460) · Dec 18 '26 · debit $3.09 · capital ~$309 · max profit ~$691 · BE $133.09 · R:R 1:2.24 · POP ~34% · exit +75–100% (~$5.41–$6.18) / stop −50% (~$1.54) or a close below $120; close before Dec 10 if the short call is ITM — near-the-money long (Δ 0.48), short just under the ~$141.36 1σ high" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $135C / sell $140C (mids 2.685 − 1.460) · Dec 18 '26 · debit $1.23 · capital ~$123 · max profit ~$377 · BE $136.23 · R:R 1:3.07 · POP ~26% · exit +100% (~$2.46) / stop −50% (~$0.61) or a close below $120 — a cheap bet on a break above the $135.16 52-week high after a beat-and-raise" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 5, spot: "$156.14 (Mon Nov 16 close, −4.12%; pre-mkt n/a at the ~2 am ET build) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Neutral",
    catalyst: "Q3 FY27 earnings TODAY Nov 17 AMC (CONFIRMED; first under interim CEO Kress) · cons. EPS $2.49 (14 est.; 1 up / 0 down) / rev ~$108–109B; GM guide ~74% · Bessent's 10-day board deadline ~Nov 25 (EST.) · Anthropic IPO Nov 19 · next ex-dividend not yet declared (last Sep 10, $0.25 — Nasdaq)",
    iv: "IV 62.6% (Dec 18 ATM; 115% Nov 20) vs 20-day realized 52.5% · IVR n/a · implied move ±9.7% (Nov 20 straddle) vs hist. ±4.8% (last 4) / ±4.0% (last 8) · 1σ to expiry ±$28.50", liq: "A — 4.97M contracts traded Mon (full session), 20d avg 220.5M shares; OI 24.0k / 58.6k on 125P/120P, 115.7k / 69.0k on 185C/190C, 11.6k / 18.7k on 135P/130P, 14.5k / 45.8k on 175C/180C, 30.7k on 140P, 2.7k / 3.3k on 172C/177C; every leg ≤$0.15 wide (≤4.2%) [Cboe delayed chain]",
    thesis: "A volatility trade, not a direction call: the Nov 20 straddle prices ±9.7% against an average ±4.8% reaction over the last 4 prints (±4.0% over 8, never more than 8.7%), and Dec IV (62.6%) sits 10 points over 20-day realized (52.5%), so iron condors sell rich premium that should deflate after tonight. At $156.14 the stock is already −27% in a month with RSI 22.7, so much bad news is priced. Risk: this is not a normal print — governance turmoil, Bessent's ~Nov 25 deadline and new export rules can produce a trend move well beyond history in either direction. Invalid if the post-print close lands outside $140–$172 (beyond the implied move): reassess every tier and exit any whose short strike is breached. Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor (~1σ)", text: "Sell $125P / buy $120P + sell $185C / buy $190C (mids 1.975 − 1.430 + 2.815 − 2.140) · Dec 18 '26 · credit $1.22 · capital ~$378 · max profit ~$122 · BE $123.78 / $186.22 · R:R 1:0.32 · POP ~68% · exit +50% / exit on a close through either short strike ($125 / $185); close by Dec 11 — both short strikes at or beyond 1σ ($127.64 / $184.64) and roughly twice the implied earnings move" },
      { profile: "Moderate", strategy: "Iron Condor (~0.7σ)", text: "Sell $135P / buy $130P + sell $175C / buy $180C (mids 3.675 − 2.685 + 4.850 − 3.725) · Dec 18 '26 · credit $2.11 · capital ~$289 · max profit ~$211 · BE $132.89 / $177.11 · R:R 1:0.73 · POP ~50% · exit +50% / exit on a close through $135 or $175; close by Dec 11 — short strikes at ~0.7σ, well outside the ±9.7% earnings move; harvests the post-print IV crush" },
      { profile: "Aggressive", strategy: "Iron Condor (at the implied move)", text: "Sell $140P / buy $135P + sell $172C / buy $177C (mids 4.925 − 3.675 + 5.625 − 4.325) · Dec 18 '26 · credit $2.55 · capital ~$245 · max profit ~$255 · BE $137.45 / $174.55 · R:R 1:1.04 · POP ~41% · exit +50% / exit on a close through $140 or $172; close by Dec 11 — short strikes just outside the ±9.7% straddle range ($141 / $171); pays ~1:1 if NVDA reacts in line with its history" },
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
// today line sits on the boundary between Nov 17 and Nov 18
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Tuesday, Nov 17 2026 · pre-market (~2 am ET) · stock quotes = Mon Nov 16 close (Yahoo / Cboe) · option chains, OI &amp; volume = Cboe delayed chain after the Mon Nov 16 session · today's events (NVIDIA, HD, DIS, retail sales) not yet reported</b> · window: last 3 days → next 2 weeks ·
            color = industry · dot = event · {DIR.BULLISH.glyph}/{DIR.BEARISH.glyph}/{DIR.MIXED.glyph} = bullish / bearish / mixed ·
            upcoming: {DIR.BULLISH.glyph}/{DIR.BEARISH.glyph} = lean, {PENDING_GLYPH} = pending, no lean
            {LEAN_RECORD.hits + LEAN_RECORD.misses > 0 && (
              <> · lean record {LEAN_RECORD.hits}/{LEAN_RECORD.hits + LEAN_RECORD.misses} correct
                ({Math.round((100 * LEAN_RECORD.hits) / (LEAN_RECORD.hits + LEAN_RECORD.misses))}%)
                {LEAN_RECORD.since ? ` since ${LEAN_RECORD.since}` : ""}</>
            )}
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
                ▸ TODAY (Nov 17)
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
                      {dirGlyph(e)}
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
                  <span style={badge(dirColor(detail.dir))}>{dirGlyph(detail)} {dirLabel(detail)}</span>
                </div>
                <div style={S.tickers}>{detail.tickers}</div>
                {detail.future && detail.basis && (
                  <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>
                    <b style={{ color: "#cbd5e1" }}>Lean basis:</b> {detail.basis}
                  </div>
                )}
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
                    <span style={{ color: dirColor(e.dir), width: 16, textAlign: "center" }}>{dirGlyph(e)}</span>
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
