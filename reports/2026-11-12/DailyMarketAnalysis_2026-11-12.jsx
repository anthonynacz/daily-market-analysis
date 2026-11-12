import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Thursday, November 12, 2026 (trading day) — pre-market ~02:00 ET (no pre-market prints yet; extended-hours reference = Wed Nov 11 8:00 pm ET last); quotes = Wed Nov 11 close; option quotes, OI & volume = Cboe delayed chain after the Wed Nov 11 session.
 * Window: last 3 days (Nov 9) → coming 2 weeks (Nov 26).
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

// 18-day axis: Nov 9 .. Nov 26 (last 3 days → coming 2 weeks). Today = index 3 (Nov 12).
const DAYS = [
  { idx: 0, date: "Nov 9", dow: "Mon" },
  { idx: 1, date: "Nov 10", dow: "Tue" },
  { idx: 2, date: "Nov 11", dow: "Wed" },
  { idx: 3, date: "Nov 12", dow: "Thu" }, // TODAY
  { idx: 4, date: "Nov 13", dow: "Fri" },
  { idx: 5, date: "Nov 14", dow: "Sat" },
  { idx: 6, date: "Nov 15", dow: "Sun" },
  { idx: 7, date: "Nov 16", dow: "Mon" },
  { idx: 8, date: "Nov 17", dow: "Tue" },
  { idx: 9, date: "Nov 18", dow: "Wed" },
  { idx: 10, date: "Nov 19", dow: "Thu" },
  { idx: 11, date: "Nov 20", dow: "Fri" },
  { idx: 12, date: "Nov 21", dow: "Sat" },
  { idx: 13, date: "Nov 22", dow: "Sun" },
  { idx: 14, date: "Nov 23", dow: "Mon" },
  { idx: 15, date: "Nov 24", dow: "Tue" },
  { idx: 16, date: "Nov 25", dow: "Wed" },
  { idx: 17, date: "Nov 26", dow: "Thu" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS ----------------------------------------
  { id: "t1", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 10: NVIDIA −5.47% to $168.89 (intraday low near $166; market cap briefly < $4T) as reports tied ~$7.5B of chip shipments to China to a network linked to CEO Jensen Huang's associate; the board's independent probe opened Nov 8 (CNBC live, NVIDIA board statement)", tickers: "NVDA · SMH · QQQ",
    rec: "AVOID: open-ended governance risk — defined-risk only; no bottom-fishing before the board rules." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Wed Nov 11: AI-hardware rebound after CoreWeave's beat — Nasdaq-100 +2.28% to 28,374.25, tech sector +3.23%, SMH +4.8% to $506.96; Micron +11.9% ($811.30), Dell +11.75%, Arm +12.05%, AMD +7.3% to $552.90 (6th-gen EPYC availability) (Investing.com, CNBC, Yahoo chart data)", tickers: "SMH · MU · AMD · DELL · QQQ",
    rec: "HOLD: a one-day squeeze inside a downtrend — QQQ ($690.38) is still below its 50-day ($719.04)." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Wed Nov 11: CoreWeave +24.7% to $60.77 on Q3 revenue $3.66B, FY26 revenue guide raised to $13.0–13.3B (net loss $709M); then −6% after hours; DA Davidson cut its target to $45 (Neutral), Stifel to $60 (Hold), Citi raised to $149 (StockTitan, Stocktwits, analyst round-up)", tickers: "CRWV · NBIS · NVDA",
    rec: "WATCH: target cuts into a +25% day show how split the Street is — too volatile for a core position." },
  { id: "t4", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Wed Nov 11: Microsoft −2.26% to $521.13 on a +2.3% Nasdaq-100 day (−6.2% in 5d; 50-day $518.20) — the slide that began Nov 10 when Anthropic announced Claude workplace tools seen as competing with Office (CNBC live, Yahoo chart data)", tickers: "MSFT",
    rec: "SELL strength: relative weakness on an up day; a bear put spread fits below $518, invalid above $545." },
  { id: "t5", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Wed Nov 11: Apple +2.04% to a record close of $355.63 (market cap ~$5.1T); China Renaissance upgrades to Buy, target $280 → $425 (Yahoo Finance live, analyst round-up)", tickers: "AAPL",
    rec: "BUY dips / bull call spread: relative strength at new highs while the Nasdaq sits under its 50-day; invalid below $337." },
  { id: "t6", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Wed Nov 11 after hours: NVIDIA −8.6% to ~$158.8 (8:00 pm ET) — WSJ reports the board is preparing to remove CEO Jensen Huang; NYT reports a second relationship with a direct report; Bloomberg says an outside firm is working on successors. Baird cuts to Neutral (PT $500 → $200), Bernstein to Market-Perform (PT $200). No board decision announced as of this run (CBS, Yahoo Finance live)", tickers: "NVDA · SMH · QQQ · AMD · AVGO",
    rec: "AVOID new NVDA risk: a CEO binary on top of the Nov 17 print; hedge index exposure with QQQ puts instead. AMD +4% / AVGO +2% after hours as perceived beneficiaries." },
  { id: "t7", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "Thu Nov 12 (TODAY) AMC: Cisco Q1 FY27 (call 4:30 pm ET — CONFIRMED, Cisco IR; Zacks cons. EPS $1.15 vs company non-GAAP guide $1.32–1.34, revenue guide $18.0–18.2B) and Applied Materials Q4 (call 4:30 pm ET — CONFIRMED; cons. EPS $4.06); Nebius BMO (call 8:00 am ET — CONFIRMED; cons. −$0.61); Cerebras AMC [EST.]", tickers: "CSCO · AMAT · NBIS · CBRS",
    rec: "WATCH: AMAT's WFE outlook is the semicap read after SMH's +4.8% bounce; wait for the reaction." },
  { id: "t8", ind: "tech", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Sun Nov 15 – Fri Nov 20: SC26 supercomputing conference, Chicago (CONFIRMED, sc26.supercomputing.org); no NVIDIA special address found", tickers: "NVDA · AMD · HPE",
    rec: "WATCH: HPC roadmap headlines; low market impact this year given the NVIDIA overhang." },
  { id: "t9", ind: "tech", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "NVIDIA Q3 FY27 earnings — Tue Nov 17, results ~4:20 pm ET, call 5:00 pm ET (CONFIRMED, NVIDIA IR); cons. EPS $2.49 (Nasdaq / Earnings Whispers), revenue ~$108.8B (secondary source, unverified); who hosts the call is now an open question", tickers: "NVDA · SMH · AMD · AVGO · QQQ",
    rec: "WATCH: the AI-sentiment binary of the month, now stacked on a CEO-succession binary — size small, defined risk only." },
  { id: "t10", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Microsoft Ignite — Nov 17–20, San Francisco [EST. — trade-press listings; Microsoft page not fetched]: Copilot / agent roadmap has to answer Anthropic's Office-competing tools", tickers: "MSFT",
    rec: "WATCH: a strong agent roadmap is the main risk to a bearish MSFT view." },
  { id: "t11", ind: "tech", dayIdx: 9, future: true, impact: 2, dir: "BEARISH",
    headline: "Wed Nov 18: three House committee chairs have requested a closed-door briefing with NVIDIA's Jensen Huang (search summary of press reports) [EST.]; Palo Alto Networks reports AMC (CONFIRMED, company release Nov 3; Zacks cons. $0.52 vs non-GAAP guide $0.96–0.98)", tickers: "NVDA · PANW · CRWD",
    rec: "WATCH: export-control / subpoena headlines can hit NVDA the day after its print." },
  { id: "t12", ind: "tech", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Anthropic IPO (Nasdaq: ANT) — expected to price Wed Nov 18 evening and trade Thu Nov 19 (CNBC; WSJ says Thu or Fri) [EST.]: 825M Class A shares at $70–$78, up to ~$64.4B raised, ~$1.4T valuation; $26B concurrent private placement to AMD, Broadcom, Google, Micron, Microsoft, NVIDIA and TSMC", tickers: "AMZN · GOOGL · MSFT · NVDA · QQQ",
    rec: "WATCH: record AI supply competes for megacap dollars (a QQQ headwind) while marking up strategic stakes." },
  { id: "t13", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 19: Intuit (cons. EPS $2.47) and Keysight ($3.09) AMC; Alibaba ($1.56) and NetEase ($2.40) BMO (Nasdaq calendar) [EST.]", tickers: "INTU · KEYS · BABA · NTES",
    rec: "WATCH: software-multiple test with the 10-year at ~5%." },
  { id: "t14", ind: "tech", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 23 AMC: HPE (cons. EPS $1.17), Zoom ($1.00), Symbotic (Nasdaq calendar) [EST.]", tickers: "HPE · ZM · SYM",
    rec: "WATCH: AI-server read-through a week after NVIDIA." },
  { id: "t15", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24: Dell Q3 FY27 AMC, call 4:30 pm ET (CONFIRMED; cons. EPS $6.41); Analog Devices BMO ($3.89); Autodesk ($2.27), Workday ($1.28), HP ($0.75) AMC [EST.]", tickers: "DELL · ADI · ADSK · WDAY · HPQ",
    rec: "WATCH: Dell's AI-server backlog vs whatever NVIDIA guides." },
  // ---- ENERGY ----------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 9: Brent −5.8% after President Trump called fresh strikes on Iran 'highly unlikely' — the war premium deflates (The Edge / Bloomberg)", tickers: "XLE · XOM · CVX · USO",
    rec: "HOLD/AVOID: energy leadership fades when the geopolitical bid leaves." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 10: Brent settles $91.49 (−1.2%), the lowest settle since August after dipping below $90; US gasoline $3.978, under $4 for the first time since July (Rigzone, Bloomberg excerpts)", tickers: "XOM · XLE · USO · XLY",
    rec: "WATCH: cheaper fuel helps consumers and hurts upstream cash flow." },
  { id: "e3", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Wed Nov 11: oil rebounds — Brent $92.76 (+1.4%), WTI $86.53 (+0.6%) after Iran's Mohsen Rezaee denied any negotiation with the US and said Hormuz stays shut (transits ~4M b/d vs ~17M pre-war, Kpler); XLE +1.86% to $63.37, XOM +1.36% to $166.71; OPEC+ kept targets flat (Rigzone, Price Group, Yahoo chart data)", tickers: "XOM · XLE · CVX · COP",
    rec: "HOLD: the bearish crude trade lost its catalyst — yesterday's XOM put idea is dropped; XLE still below its 50-day ($64.99)." },
  { id: "e4", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Thu Nov 12 (TODAY), 12:00 pm ET: EIA Weekly Petroleum Status Report — shifted from Wednesday for Veterans Day (CONFIRMED, eia.gov schedule)", tickers: "XLE · USO · XOM",
    rec: "WATCH: a build would re-open the downside; a draw extends Wednesday's bounce." },
  { id: "e5", ind: "energy", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "Fri Nov 13, 4:00 am ET: IEA Oil Market Report (CONFIRMED, iea.org)", tickers: "XLE · USO",
    rec: "WATCH: demand revisions with Hormuz flows still a quarter of normal." },
  { id: "e6", ind: "energy", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Nov 25, 10:30 am ET: EIA weekly report (no holiday shift listed); Baker Hughes rig count likely pulled forward [EST.]; OPEC+ meets Sun Nov 29 on 2027 policy, just after the window (CONFIRMED, opec.org)", tickers: "XLE · USO · XOM",
    rec: "WATCH: thin pre-holiday liquidity into an OPEC+ weekend — avoid short-dated energy bets." },
  // ---- HEALTHCARE / PHARMA ----------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Mon Nov 9: Eli Lilly reports positive Phase 3 data for its obesity pill Foundayo in sleep apnea; Merck posts positive Phase 2b data for efinopegdutide in MASH (price reactions n/a) (press coverage via research sweep)", tickers: "LLY · MRK · XLV",
    rec: "HOLD: pipeline news keeps healthcare the leadership group." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 10: Hims & Hers −16.6% — Q3 EPS −$0.14 vs +$0.06 cons., revenue $890.4M vs $892.9M, Q4 revenue guide $875–895M vs $955M cons., FY adj. EBITDA cut to $257–277M; bounced +8.8% to $20.81 Wed (Investing.com, Yahoo chart data)", tickers: "HIMS",
    rec: "AVOID: guidance is still falling — a one-day bounce is not a base." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Healthcare leadership holds: XLV $188.95 (+11.4% in 21d, RSI 68, above 50-day $174.44); LLY $1,437.29 (+23% in 21d, RSI 70); Capricor +26.5% Wed with its deramiocel FDA date set for Nov 22 (Yahoo chart data, Investing.com)", tickers: "XLV · LLY · CAPR",
    rec: "HOLD winners; extended — add on pullbacks. XLV option quotes were too wide overnight to pass this report's liquidity gate." },
  { id: "h4", ind: "health", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Sat Nov 14 PDUFA dates: Cytokinetics aficamten and Summit ivonescimab (EGFR-mutant NSCLC) — decisions may land Fri Nov 13 or Mon Nov 16 (third-party PDUFA trackers) [EST.]", tickers: "CYTK · SMMT",
    rec: "WATCH: binary events — defined risk and small size only." },
  { id: "h5", ind: "health", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Sun Nov 22 PDUFA dates: Capricor deramiocel (Duchenne) and Savara Molbreevi (autoimmune PAP) — decisions may land Fri Nov 20 or Mon Nov 23 (third-party PDUFA trackers) [EST.]", tickers: "CAPR · SVRA",
    rec: "WATCH: CAPR already ran +26% into the date — binary risk is two-sided." },
  { id: "h6", ind: "health", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Medtronic reports (cons. EPS $1.34) (Nasdaq calendar) [EST.]", tickers: "MDT · XLV",
    rec: "WATCH: med-tech volumes; XLV is extended into it." },
  { id: "h7", ind: "health", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Wed Nov 25 PDUFA: Sanofi venglustat (type 3 Gaucher) [EST.]; BridgeBio BBP-418 (Nov 27) and Vertex povetacicept (Nov 30) fall just after the window (third-party PDUFA trackers)", tickers: "SNY · BBIO · VRTX",
    rec: "WATCH: holiday-week FDA decisions often arrive early." },
  // ---- FINANCIALS / MACRO ----------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Mon Nov 9: relief rally — S&P 500 +2.3% to 7,549.94 (best day since April), Dow +1,104 to 52,389.75, Nasdaq +2.7%, Russell 2000 +3.1% to 2,840.81 on falling oil and dip-buying after the post-midterm AI rout (AP via La Nación, The Edge)", tickers: "SPY · QQQ · IWM · DIA",
    rec: "HOLD: an oversold squeeze, not yet a trend change for the Nasdaq." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 10, OCTOBER CPI: +0.4% m/m vs +0.3% expected, core +0.3% vs +0.2%; 2-yr yield +18 bp to 4.736%, 10-yr 4.992% (touched 5.004%), soft $42B 10-yr auction; S&P −0.38% to 7,520.93 (CNBC)", tickers: "SPY · QQQ · TLT · GLD",
    rec: "DE-RISK duration: rates repriced higher; gold and long-duration tech are the direct casualties." },
  { id: "f3", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Fed: Waller leans to a 25 bp hike in December and says 50 bp 'should be considered' if inflation runs hotter; Logan sees two more hikes; Goolsbee calls CPI 'borderline disturbing'. CME FedWatch: hike fully priced (~90% 25 bp, ~10% 50 bp); Goldman now expects hikes in December and March (CNBC)", tickers: "SPY · TLT · GLD · KRE",
    rec: "SELL rate-sensitive rallies: a second hike in March is now the base case on the Street." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Wed Nov 11 (Veterans Day, bond market closed): S&P 500 +1.31% to 7,619.38, Dow +0.49% to 52,486.49, Nasdaq +1.60% to 25,466.19, Russell 2000 +0.88% to 2,846.26; VIX −10% to 17.49; 17 S&P new highs vs 0 new lows (Investing.com, CNBC)", tickers: "SPY · QQQ · IWM · DIA",
    rec: "HOLD: breadth improved and small caps sit above both moving averages — IWM bull call spread fits above $279." },
  { id: "f5", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Wed Nov 11: gold −0.7% to $4,000.50 and $3,982 in Thursday Asia trade as the dollar index rises to 102.92 (+0.67%) on hike bets; GLD −1.13% to $365.17, below its 50-day ($382.96) and 200-day ($409.82); Bitcoin ~$73.5k (FXStreet, Yahoo chart data)", tickers: "GLD · GDX · COIN",
    rec: "SELL/AVOID gold: real-rate and dollar headwinds — a GLD bear put spread fits; invalid above $383." },
  { id: "f6", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Thu Nov 12 (TODAY): jobless claims 8:30 am ET (est. 194K), existing-home sales 10:00 (CONFIRMED, NAR), Fed's Barr 10:00 (CONFIRMED), 30-yr bond auction (CONFIRMED, Treasury), NY Fed's Williams 6:30 pm [EST.]; futures at 12:28 am ET: Nasdaq-100 −0.97%, S&P −0.37%, Dow +0.15% (CNBC)", tickers: "SPY · QQQ · TLT",
    rec: "WATCH: the first cash-Treasury session since CPI plus a 30-yr auction — a weak auction pressures growth stocks." },
  { id: "f7", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "OCTOBER PPI — Fri Nov 13, 8:30 am ET (CONFIRMED, bls.gov); Fed's Bowman 10:50 am and Vice Chair Jefferson 7:00 pm (CONFIRMED, federalreserve.gov)", tickers: "SPY · TLT · QQQ · GLD",
    rec: "WATCH: a second hot print after CPI lifts 50 bp odds — bearish duration, gold and growth." },
  { id: "f8", ind: "finance", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "OCTOBER RETAIL SALES — Tue Nov 17, 8:30 am ET (CONFIRMED, census.gov); import prices 8:30 (BLS) and industrial production 9:15 (CONFIRMED, Fed G.17)", tickers: "XLY · WMT · HD · SPY",
    rec: "WATCH: a strong consumer seals the hike; a miss helps bonds but hurts retailers." },
  { id: "f9", ind: "finance", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC MINUTES (Oct 27–28) — Wed Nov 18, 2:00 pm ET (CONFIRMED, federalreserve.gov); housing starts 8:30 am (CONFIRMED, Census); 20-yr bond auction (CONFIRMED, Treasury)", tickers: "SPY · QQQ · TLT · KRE",
    rec: "WATCH: hawkish detail on the hike path extends pressure on long-duration assets." },
  { id: "f10", ind: "finance", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 20: monthly options expiration (third Friday — standard convention, no exchange page retrieved) right after NVIDIA's print and the Anthropic debut; UMich final November sentiment 10:00 am (CONFIRMED)", tickers: "SPY · QQQ · NVDA",
    rec: "WATCH: pin/unpin volatility — avoid opening short-dated size into the close." },
  { id: "f11", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 23: S&P Global flash US PMIs 9:45 am ET [EST. — one third-party listing]; 2-yr note auction (CONFIRMED, Treasury)", tickers: "SPY · TLT",
    rec: "WATCH: front-end supply right after a 19 bp 2-yr repricing." },
  { id: "f12", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24: Conference Board consumer confidence 10:00 am ET (CONFIRMED; prior 91.7); 5-yr note auction (CONFIRMED, Treasury)", tickers: "SPY · XLY · TLT",
    rec: "WATCH: sentiment into Black Friday with mortgage rates at ~7.3%." },
  { id: "f13", ind: "finance", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Nov 25, 8:30 am ET: Q3 GDP (second estimate) + October personal income / PCE (CONFIRMED, bea.gov); durable goods and new-home sales (CONFIRMED, Census); Beige Book 2:00 pm (CONFIRMED); 7-yr auction; Deere BMO, call 10:00 am ET (CONFIRMED, Deere IR; cons. $4.07)", tickers: "SPY · TLT · GLD · DE",
    rec: "WATCH: the Fed's preferred inflation gauge before the Dec 8–9 FOMC; a hot core PCE confirms the hike." },
  { id: "f14", ind: "finance", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Thu Nov 26: Thanksgiving — US markets closed; Fri Nov 27 early close 1:00 pm ET (CONFIRMED, NYSE). Just after the window: OPEC+ Nov 29, MSCI index review effective at the Nov 30 close, NVIDIA GTC DC Nov 30–Dec 3, jobs report Dec 4, FOMC Dec 8–9", tickers: "SPY · QQQ · IWM",
    rec: "WATCH: holiday-thinned liquidity; time decay accelerates on short-dated options." },
  // ---- CONSUMER / RETAIL ----------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Tue Nov 10: Take-Two +8.2% ahead of the GTA VI launch; On Holding −7.5% on a direct-to-consumer sales miss (CNBC live)", tickers: "TTWO · ONON",
    rec: "WATCH: TTWO is priced for a perfect launch; ONON shows no tolerance for misses in premium discretionary." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Wed Nov 11: consumer discretionary is the only S&P sector down (−0.05%) on a +1.3% day — Amazon −1.74% to $266.17, McDonald's −2.61%, Airbnb −3.09%, Lululemon −2.65% (Investing.com, Yahoo Finance live)", tickers: "AMZN · MCD · ABNB · LULU · XLY",
    rec: "HOLD: AMZN lagged a strong tape for the first time this week — yesterday's bullish idea is not renewed; support $254 (50-day)." },
  { id: "c3", ind: "consumer", dayIdx: 7, future: true, impact: 1, dir: "MIXED",
    headline: "Mon Nov 16 BMO: Tyson Foods (cons. EPS $0.65), Aramark, Baidu ($0.57), XPeng (Nasdaq calendar / Earnings Whispers) [EST.]", tickers: "TSN · ARMK · BIDU · XPEV",
    rec: "WATCH: food-cost pass-through after a hot CPI." },
  { id: "c4", ind: "consumer", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Tue Nov 17 BMO: Home Depot Q3 (call 9:00 am ET — CONFIRMED; cons. EPS $3.86–3.87, revenue $42.72B) and Disney fiscal Q4 (webcast 8:30 am ET — CONFIRMED, Disney IR; cons. $1.67), alongside October retail sales", tickers: "HD · DIS · XLY",
    rec: "WATCH: HD $351.31 is +19.5% in 21d into ~7.3% mortgage rates and DIS has RSI 71 — both priced for good news; HD/DIS option volume (14k / 17k contracts Wed) is below this report's gate." },
  { id: "c5", ind: "consumer", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Nov 18 BMO: Target (call 8:00 am ET — CONFIRMED; cons. EPS $2.03), Lowe's (call 9:00 am ET — CONFIRMED; cons. $2.86, revenue $22.38B), TJX ($1.33) [EST.]; Williams-Sonoma ($2.17, time n/a) [EST.]", tickers: "TGT · LOW · TJX · WSM",
    rec: "WATCH: holiday-guide commentary; LOW (RSI 72, +22.7% in 21d) is fragile into the print." },
  { id: "c6", ind: "consumer", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Thu Nov 19: Walmart Q3 FY27, call 8:00 am ET (CONFIRMED, Walmart IR; cons. EPS $0.64, company guide $0.62–0.64); Ross ($1.82) and Gap AMC, Bath & Body Works BMO [EST.]", tickers: "WMT · ROST · GAP · XLP",
    rec: "WATCH: WMT $125.67 is +11.9% in 21d (RSI 64) — a beat is priced; trim into strength rather than add." },
  { id: "c7", ind: "consumer", dayIdx: 10, future: true, impact: 2, dir: "BULLISH",
    headline: "Thu Nov 19: Grand Theft Auto VI launch on PS5 / Xbox Series [EST. — date repeatedly reaffirmed by Take-Two earlier in 2026; no November confirmation retrieved this run]", tickers: "TTWO · SONY · MSFT",
    rec: "WATCH: the biggest entertainment launch of the year — sell-the-news risk after an +8% pre-launch pop." },
  { id: "c8", ind: "consumer", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Best Buy (cons. EPS $1.48), Dollar Tree ($0.88), Dick's ($1.38), J.M. Smucker ($2.50); Burlington ($1.71, time n/a) (Nasdaq calendar) [EST.]", tickers: "BBY · DLTR · DKS · SJM · BURL",
    rec: "WATCH: the last retail read before Black Friday." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "MSFT", name: "Microsoft", rank: 1, spot: "$521.13 (Wed Nov 11 close, −2.26%; extended-hours last $520.15 at 8:00 pm ET, −0.2% — no pre-market prints yet at ~02:00 ET) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings before expiry (next ~late Jan, EST.) · Microsoft Ignite Nov 17–20 (EST., trade-press listings) — the roadmap answer to Anthropic's Office-competing tools · Anthropic IPO pricing ~Nov 18 / trading ~Nov 19 (EST.; Microsoft is in the $26B private placement) · PPI Nov 13, FOMC minutes Nov 18, PCE Nov 25, FOMC Dec 8–9 (all CONFIRMED) · ex-dividend ~Nov 19 (EST. from last year's Nov 20 date; $0.91 last paid — not verified; the short 570C is far OTM) · cons. EPS/rev n/a (no print in window)",
    iv: "IV ~27.5% (Dec 18, ATM 520P 27.5% / 520C 27.4%; Cboe iv30 27.3) · IVR n/a · realized HV20 37.3% / HV10 50.6% > implied · no earnings binary before expiry · 1σ to Dec 18 ≈ ±$45.0 (±8.6%) → $476 / $566",
    liq: "A — Wed Nov 11 full session ≈819k option contracts (20d avg n/a) & 29.0M shares (20d avg 26.4M); Dec 18 OI 7.5k / 33.3k on the 570C / 580C, 3.5k / 6.9k on the 520P / 490P, 11.2k / 4.2k on the 500P / 470P; spreads 3.8–6.5% of mid ($0.11–0.65 wide) [Cboe delayed chain, Nov 11 session / Yahoo]",
    thesis: "Relative weakness with a named cause: MSFT fell 2.26% to $521.13 on a day the Nasdaq-100 rose 2.3%, is −6.2% in 5d since Anthropic announced Claude workplace tools seen as competing with Office, and now sits on its 50-day ($518.20) with the $504.96 20-day low and then $490 as targets; RSI 48 is not oversold. This reverses the bullish MSFT calls in the Nov 9–10 reports ($530.61 / $545.18), which were wrong. Risk: Ignite (Nov 17–20) could reset the AI-agent narrative, the 200-day is far below ($440.76) so the long-term trend is intact, and a NVIDIA-driven rotation into 'safe' megacaps could lift it. Invalid on a close above $545. Conviction 4/5 (4/4/3/4/5).",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $570C / buy $580C · Dec 18 '26 · credit $1.12 (mids 3.175 − 2.055) · capital ~$888 · max profit ~$112 · BE $571.12 · R:R 1:0.13 · POP ~85% (1−|Δ short 0.15|) · exit: buy back at ~50% profit (≈$0.56), or if MSFT closes above $545 (invalidation) / through $570; close by Dec 11 (~7 DTE) — short strike beyond 1σ ($566) and above the $559 20-day high; OI 7.5k / 33.3k, spreads 5%" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $520P / sell $490P · Dec 18 '26 · debit $10.03 (mids 17.175 − 7.15 = 10.025) · capital ~$1,002 · max profit ~$1,998 · BE $509.98 · R:R 1:1.99 · POP ~42% (lognormal, IV 27.5%) · exit +75–100% (~$17.5–20.1 spread value) or stop −50% (~$5.01) / MSFT close above $545; close with ≥10 days left (by Dec 8) — at-the-money long leg (Δ −0.47), short leg below the $505 20-day low at ~0.7σ; OI 3.5k / 6.9k, spreads 4–6%" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $500P / sell $470P · Dec 18 '26 · debit $5.83 (mids 9.70 − 3.875 = 5.825) · capital ~$582 · max profit ~$2,418 · BE $494.18 · R:R 1:4.15 · POP ~29% (lognormal, IV 28.9%) · exit +100% (~$11.65 spread value) or stop −50% (~$2.91) / MSFT close above $545; close with ≥10 days left (by Dec 8) — OTM spread (long Δ −0.31) for a break of the 50-day toward the 1σ level ($476); a spread rather than a naked put because IVR is unknown; OI 11.2k / 4.2k, spreads 4–7%" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 2, spot: "$355.63 (Wed Nov 11 close, +2.04%, record close; extended-hours last $356.35 at 8:00 pm ET, +0.2% — no pre-market prints yet at ~02:00 ET) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bullish",
    catalyst: "No earnings before expiry (next ~late Jan, EST.) · China Renaissance upgrade to Buy, PT $280 → $425 (Nov 11) · holiday-quarter iPhone demand checks · PPI Nov 13, retail sales Nov 17, FOMC minutes Nov 18, PCE Nov 25, FOMC Dec 8–9 (all CONFIRMED) · ex-dividend n/a (November date not retrieved this run; the only short leg is an OTM put, so no early-assignment exposure from the dividend) · cons. EPS/rev n/a (no print in window)",
    iv: "IV ~22% (Dec 18, ATM 360C 22.1% / 350P 23.0%; Cboe iv30 21.8) · IVR n/a · realized HV20 27.6% / HV10 37.1% > implied (premium is cheap) · no binary before expiry · 1σ to Dec 18 ≈ ±$24.6 (±6.9%) → $331 / $380",
    liq: "A — Wed Nov 11 full session ≈1.33M option contracts (20d avg n/a) & 34.3M shares (20d avg 48.6M); Dec 18 OI 19.0k / 28.6k on the 330P / 320P, 28.3k / 21.7k on the 360C / 380C, 16.3k on the 370C; spreads 3.5–7.1% of mid ($0.09–0.30 wide) [Cboe delayed chain, Nov 11 session / Yahoo]",
    thesis: "The megacap that is making new highs while the Nasdaq-100 sits 4% under its 50-day: AAPL closed at a record $355.63 (+2.0%), +4.2% in 21d vs QQQ −7.2%, above its rising 50-day ($337.88) and 200-day ($300.27), RSI 60 — not overbought — and it carries no NVIDIA-governance or AI-capex exposure. Implied vol (~22%) is below realized (HV20 27.6%), so upside is cheap to own; 1σ reaches $380. Carried from the Nov 11 report (then-spot $348.51, +2.0%: working) with strikes re-set $10 higher. Risk: it is a top QQQ weight, so an NVIDIA-led index flush drags it; a 5% 10-year caps the multiple; a breakout at the $355.91 20-day high can fail. Invalid on a close below $337. Conviction 4/5 (3/5/4/3/5).",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $330P / buy $320P · Dec 18 '26 · credit $1.05 (mids 2.645 − 1.595) · capital ~$895 · max profit ~$105 · BE $328.95 · R:R 1:0.12 · POP ~83% (1−|Δ short 0.17|) · exit: buy back at ~50% profit (≈$0.53), or if AAPL closes below $337 (invalidation) / $330; close by Dec 11 (~7 DTE) — short strike just beyond 1σ ($331) and under the 50-day ($338); OI 19.0k / 28.6k, spreads 4–6%" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $360C / sell $380C · Dec 18 '26 · debit $6.29 (mids 8.55 − 2.26) · capital ~$629 · max profit ~$1,371 · BE $366.29 · R:R 1:2.18 · POP ~32% (lognormal, IV 22.1%) · exit +75–100% (~$11.0–12.6 spread value) or stop −50% (~$3.15) / AAPL close below $337; close with ≥10 days left (by Dec 8) — near-the-money long leg (Δ +0.46), short leg at the 1σ level ($380); OI 28.3k / 21.7k, spreads 4–7%" },
      { profile: "Aggressive", strategy: "Long Call (OTM)", text: "Buy $370C · Dec 18 '26 · debit $4.63 (mid 4.625; bid/ask 4.50/4.75) · capital ~$462 · max profit: uncapped · BE $374.62 · R:R n/a (uncapped) · POP ~21% (lognormal, IV 21.3%) · exit +100% (~$9.25) or stop −50% (~$2.31) / AAPL close below $337; close with ≥10 days left (by Dec 8) — Δ +0.31; buying premium is justified because implied (21%) sits below realized (HV20 28%); OI 16.3k, spread 5.4%" },
    ] },
  { ticker: "GLD", name: "SPDR Gold Shares", rank: 3, spot: "$365.17 (Wed Nov 11 close, −1.13%; extended-hours last $365.88 at 8:00 pm ET, +0.2% — no pre-market prints yet at ~02:00 ET; gold futures ~$3,980 Thu Asia) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF), no dividend · Oct PPI Fri Nov 13 8:30 ET (CONFIRMED, bls.gov) · Fed's Bowman / Jefferson Nov 13 (CONFIRMED) · retail sales Nov 17 · FOMC minutes Nov 18 2:00 ET (CONFIRMED) · GDP / PCE Nov 25 (CONFIRMED, bea.gov) · FOMC Dec 8–9 (hike fully priced: ~90% 25 bp, ~10% 50 bp per CME FedWatch via CNBC) · Dec 18 expiry is after the FOMC",
    iv: "IV ~22% (Dec 18, ATM 365P 22.3% / 365C 22.1%; Cboe iv30 22.3) · IVR n/a · realized HV20 27.4% / HV10 34.8% > implied · no single-name binary (macro-driven) · 1σ to Dec 18 ≈ ±$25.6 (±7.0%) → $340 / $391",
    liq: "A — Wed Nov 11 full session ≈513k option contracts (20d avg n/a) & 5.8M shares (20d avg 8.9M); Dec 18 OI 10.1k / 84.5k on the 395C / 400C, 4.2k / 3.1k on the 365P / 345P, 2.9k on the 355P; spreads 1.0–4.6% of mid ($0.03–0.25 wide) [Cboe delayed chain, Nov 11 session / Yahoo]",
    thesis: "Gold is losing its rate support: a hot October CPI pushed the 2-year up 18 bp to 4.74% and the 10-year to ~5.0%, a December hike is fully priced with Goldman adding March, and the dollar index is at 102.9–103.0 (20-day high). GLD closed $365.17 (−1.1% on a risk-on day), −4.3% in 21d, below its 50-day ($382.96) and 200-day ($409.82), with gold slipping under $4,000 overnight; the target is the $354.67 20-day low, then the 1σ level near $340. It is a bearish view that does not depend on the Nasdaq — a deliberate change after index/sector puts (IWM, BAC, QQQ, XOM) went against the last three reports. Risk: an NVIDIA-led equity shock or an Iran escalation (Hormuz still mostly shut) revives the haven bid; RSI 43 is not stretched but a soft PPI would squeeze shorts. Invalid on a close above $383. Conviction 4/5 (3/4/4/3/5).",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $395C / buy $400C · Dec 18 '26 · credit $0.54 (mids 2.03 − 1.495 = 0.535) · capital ~$446 · max profit ~$53 · BE $395.54 · R:R 1:0.12 · POP ~84% (1−|Δ short 0.16|) · exit: buy back at ~50% profit (≈$0.27), or if GLD closes above $383 (invalidation) / through $395; close by Dec 11 (~7 DTE, after the Dec 9 FOMC) — short strike beyond 1σ ($391) and above the 50-day ($383); OI 10.1k / 84.5k, spreads 2%" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $365P / sell $345P · Dec 18 '26 · debit $6.28 (mids 9.55 − 3.275 = 6.275) · capital ~$628 · max profit ~$1,372 · BE $358.73 · R:R 1:2.19 · POP ~41% (lognormal, IV 22.3%) · exit +75–100% (~$11.0–12.6 spread value) or stop −50% (~$3.14) / GLD close above $383; close with ≥10 days left (by Dec 8) — at-the-money long leg (Δ −0.47), short leg at ~0.8σ below the $355 20-day low; OI 4.2k / 3.1k, spreads 1–5%" },
      { profile: "Aggressive", strategy: "Long Put", text: "Buy $355P · Dec 18 '26 · debit $5.68 (mid 5.675; bid/ask 5.55/5.80) · capital ~$568 · max profit: uncapped to $0 (~$34,932 theoretical) · BE $349.32 · R:R n/a (uncapped) · POP ~28% (lognormal, IV 23.0%) · exit +100% (~$11.35) or stop −50% (~$2.84) / GLD close above $383; close with ≥10 days left (by Dec 8) — Δ −0.32; a naked long put is justified because implied (23%) sits below realized (HV20 27%); OI 2.9k, spread 4.4%" },
    ] },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", rank: 4, spot: "$283.09 (Wed Nov 11 close, +0.89%; extended-hours last $282.43 at 8:00 pm ET, −0.2% — no pre-market prints yet at ~02:00 ET) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bullish",
    catalyst: "No earnings (ETF) · PPI Nov 13, retail sales Nov 17, FOMC minutes Nov 18, GDP / PCE Nov 25, FOMC Dec 8–9 (all CONFIRMED) · quarterly ex-dividend ~Dec 15–16 (EST. from prior years; ~$0.75–0.84) falls before the Dec 18 expiry — the only short call (300C) is far OTM, short puts carry no dividend-assignment risk",
    iv: "IV ~17.8% (Dec 18, ATM 285C 17.4% / 280P 18.4%; Cboe iv30 17.5) · IVR n/a · realized HV20 25.5% / HV10 33.6% > implied (premium is cheap) · no single-name binary · 1σ to Dec 18 ≈ ±$15.8 (±5.6%) → $267 / $299",
    liq: "A — Wed Nov 11 full session ≈1.44M option contracts (20d avg n/a) & 17.6M shares (20d avg 24.7M); Dec 18 OI 64.4k / 43.2k on the 265P / 255P, 37.3k / 84.4k on the 285C / 300C, 59.7k on the 290C; spreads 1.1–2.1% of mid ($0.02–0.06 wide) [Cboe delayed chain, Nov 11 session / Yahoo]",
    thesis: "Breadth is better than the Nasdaq headline: the Russell 2000 is +2.3% in 21d while the Nasdaq-100 is −7.2%, IWM ($283.09) is above both its 50-day ($281.43) and 200-day ($279.26), RSI 54, and Wednesday showed 17 S&P new highs against zero new lows. Small caps carry almost no NVIDIA-governance or Anthropic-supply risk, so IWM is the long that pairs with the QQQ hedge (rank 5); resistance is the $286.17 20-day high, and 1σ reaches $299. The Nov 9 report was bearish IWM at $273.67 and was wrong (+3.4%) — the tape, not the rate narrative, has been right. Risk: small caps are the most rate-sensitive index and a December hike plus a 5% 10-year is a real headwind; a hot PPI could knock it back under both averages. Invalid on a close below $279. Conviction 3/5 (3/4/3/2/5).",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $265P / buy $255P · Dec 18 '26 · credit $0.86 (mids 1.795 − 0.94 = 0.855) · capital ~$914 · max profit ~$86 · BE $264.14 · R:R 1:0.09 · POP ~83% (1−|Δ short 0.17|) · exit: buy back at ~50% profit (≈$0.43), or if IWM closes below $279 (invalidation) / $265; close by Dec 11 (~7 DTE) — short strike beyond 1σ ($267) and under the $269.88 20-day low; OI 64.4k / 43.2k, spreads 2%" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $285C / sell $300C · Dec 18 '26 · debit $4.63 (mids 5.65 − 1.02) · capital ~$463 · max profit ~$1,037 · BE $289.63 · R:R 1:2.24 · POP ~33% (lognormal, IV 17.4%) · exit +75–100% (~$8.1–9.3 spread value) or stop −50% (~$2.32) / IWM close below $279; close with ≥10 days left (by Dec 8) — at-the-money long leg (Δ +0.49), short leg at the 1σ level ($299); OI 37.3k / 84.4k, spreads 1–2%" },
      { profile: "Aggressive", strategy: "Long Call (OTM)", text: "Buy $290C · Dec 18 '26 · debit $3.41 (mid 3.405; bid/ask 3.38/3.43) · capital ~$340 · max profit: uncapped · BE $293.40 · R:R n/a (uncapped) · POP ~24% (lognormal, IV 16.6%) · exit +100% (~$6.81) or stop −50% (~$1.70) / IWM close below $279; close with ≥10 days left (by Dec 8) — Δ +0.35; buying premium is justified because implied (17%) sits well below realized (HV20 26%); OI 59.7k, spread 1.5%" },
    ] },
  { ticker: "QQQ", name: "Invesco QQQ (Nasdaq-100)", rank: 5, spot: "$690.38 (Wed Nov 11 close, +2.31%; extended-hours last $684.02 at 8:00 pm ET, −0.92% on the NVIDIA CEO reports; Nasdaq-100 futures −0.97% at 12:28 am ET — no pre-market prints yet at ~02:00 ET; move < 1%, so premiums are Wed-close mids) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF) · NVIDIA board decision on CEO Jensen Huang (timing unknown; NVDA −8.6% after hours) · Oct PPI Fri Nov 13 8:30 ET (CONFIRMED) · NVDA Q3 Tue Nov 17 AMC (CONFIRMED) · FOMC minutes Nov 18 (CONFIRMED) · Anthropic IPO ~Nov 18–19 (~$64B supply, EST.) · opex Nov 20 · GDP / PCE Nov 25 (CONFIRMED) · FOMC Dec 8–9 · quarterly ex-dividend ~Dec 21 (EST. from prior years — after expiry)",
    iv: "IV ~23% (Dec 18, ATM 690P 23.3% / 690C 23.3%; Cboe iv30 23.1) · IVR n/a · realized HV20 36.7% / HV10 47.3% > implied · no single-name binary, but NVDA's print (Nov 17) sits inside the window · 1σ to Dec 18 ≈ ±$50.5 (±7.3%) → $640 / $741",
    liq: "A — Wed Nov 11 full session ≈9.49M option contracts (20d avg n/a) & 44.3M shares (20d avg 51.2M); Dec 18 OI 37.3k / 24.9k on the 750C / 760C, 48.4k / 39.9k on the 690P / 660P, 32.8k / 52.7k on the 670P / 640P; spreads 1.7–9.0% of mid ($0.09–0.35 wide) [Cboe delayed chain, Nov 11 session / Yahoo]",
    thesis: "INDEX HEDGE, not a forecast: Wednesday's +2.3% bounce to $690.38 left QQQ below its 50-day ($719.04) and only just back above its 200-day ($681.71), −7.2% in 21d, and after the close the largest AI name fell 8.6% on reports its board is preparing to remove its CEO — with NVIDIA's print (Nov 17), a ~$64B Anthropic IPO and a fully priced December hike all ahead. The hedge triggers on a close back below the 200-day ($681.71), targeting the $647.05 20-day low. Carried from the Nov 11 report (then-spot $674.76, +2.3%: against, still under the $720 invalidation) and re-struck $15 higher; because bearish index calls have been wrong for three reports, it is ranked last and sized as insurance. Risk: a swift, orderly NVIDIA succession or a strong guide squeezes shorts; AMD / Broadcom are absorbing NVDA flows; semis are still oversold. Invalid on a close above $720. Conviction 3/5 (4/2/3/3/5).",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $750C / buy $760C · Dec 18 '26 · credit $0.81 (mids 2.255 − 1.445) · capital ~$919 · max profit ~$81 · BE $750.81 · R:R 1:0.09 · POP ~89% (1−|Δ short 0.11|) · exit: buy back at ~50% profit (≈$0.41), or if QQQ closes above $720 (invalidation) / through $750; close by Dec 11 (~7 DTE) — short strike beyond 1σ ($741) and above the $729 20-day high; OI 37.3k / 24.9k, spreads 4–9%" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $690P / sell $660P · Dec 18 '26 · debit $9.24 (mids 19.175 − 9.935) · capital ~$924 · max profit ~$2,076 · BE $680.76 · R:R 1:2.25 · POP ~44% (lognormal, IV 23.3%) · exit +75–100% (~$16.2–18.5 spread value) or stop −50% (~$4.62) / QQQ close above $720; close with ≥10 days left (by Dec 8) — at-the-money long leg (Δ −0.47), short leg above the $647 20-day low at ~0.6σ; OI 48.4k / 39.9k, spreads 2%" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $670P / sell $640P · Dec 18 '26 · debit $5.88 (mids 12.38 − 6.50) · capital ~$588 · max profit ~$2,412 · BE $664.12 · R:R 1:4.10 · POP ~33% (lognormal, IV 25.3%) · exit +100% (~$11.76 spread value) or stop −50% (~$2.94) / QQQ close above $720; close with ≥10 days left (by Dec 8) — OTM spread (long Δ −0.33) that pays on a retest of the 20-day low and the 1σ level ($640); cheaper tail insurance than yesterday's long put; OI 32.8k / 52.7k, spreads 2%" },
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
// today line sits on the boundary between Nov 12 and Nov 13
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Thursday, Nov 12 2026 · pre-market ~02:00 ET (no pre-market prints yet; extended-hours = Wed 8:00 pm ET last) · quotes & option chains = Wed Nov 11 close</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Nov 12)
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
