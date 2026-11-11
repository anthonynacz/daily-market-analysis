import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Wednesday, November 11, 2026 (Veterans Day — equities open, bond market closed) — pre-market ~02:00 ET (no pre-market prints yet); quotes = Tue Nov 10 close; option quotes, OI & volume = Cboe delayed chain after the Tue Nov 10 session (after-hours last used as the premium reference).
 * Window: last 3 days (Nov 8) → coming 2 weeks (Nov 25).
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

// 18-day axis: Nov 8 .. Nov 25 (last 3 days → coming 2 weeks). Today = index 3 (Nov 11).
const DAYS = [
  { idx: 0, date: "Nov 8", dow: "Sun" },
  { idx: 1, date: "Nov 9", dow: "Mon" },
  { idx: 2, date: "Nov 10", dow: "Tue" },
  { idx: 3, date: "Nov 11", dow: "Wed" }, // TODAY
  { idx: 4, date: "Nov 12", dow: "Thu" },
  { idx: 5, date: "Nov 13", dow: "Fri" },
  { idx: 6, date: "Nov 14", dow: "Sat" },
  { idx: 7, date: "Nov 15", dow: "Sun" },
  { idx: 8, date: "Nov 16", dow: "Mon" },
  { idx: 9, date: "Nov 17", dow: "Tue" },
  { idx: 10, date: "Nov 18", dow: "Wed" },
  { idx: 11, date: "Nov 19", dow: "Thu" },
  { idx: 12, date: "Nov 20", dow: "Fri" },
  { idx: 13, date: "Nov 21", dow: "Sat" },
  { idx: 14, date: "Nov 22", dow: "Sun" },
  { idx: 15, date: "Nov 23", dow: "Mon" },
  { idx: 16, date: "Nov 24", dow: "Tue" },
  { idx: 17, date: "Nov 25", dow: "Wed" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS ----------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Sun Nov 8: NVIDIA's board opens an independent investigation (committee of independent directors + outside counsel) after reports that CEO Jensen Huang was targeted by a foreign-intelligence effort; board says it has no reason to believe secrets or US security were compromised and Huang keeps running the company (NVIDIA board statement; Al Jazeera)", tickers: "NVDA · SMH · AMD",
    rec: "WATCH: open-ended headline risk into the Nov 17 print; no naked longs — defined-risk only." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 10: NVIDIA −5.47% to $168.89 (−9.6% in two sessions, −18.3% in 5d, RSI 24; market cap briefly < $4T) after The Information reported ≥$7.5B of its chips reached Chinese firms via a network tied to the woman linked to Huang; FBI reportedly involved (Yahoo Finance live, Reuters via Yahoo, StockTitan)", tickers: "NVDA · SMH · QQQ",
    rec: "AVOID catching the knife before the print; premium is rich (Dec IV ~56%) — an iron condor outside the implied move fits better than a directional bet." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 10: tech is the worst S&P sector (−1.4%); Nasdaq −0.74% to 25,065.87, QQQ $674.76 — below its 50-day ($719.39) and 200-day ($681.42), −9.6% in 21d; Nasdaq new lows 238 vs 59 highs; decliners beat advancers 2.26:1 (Reuters via Yahoo)", tickers: "QQQ · XLK · SMH",
    rec: "SELL strength / hedge: the index sits under both moving averages into a hawkish Fed — a QQQ bear put spread fits; invalid above $720." },
  { id: "t4", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 10: Microsoft −2.2% to $533.16 (fell ~3% intraday) after Anthropic announced Claude workplace tools seen competing with Office (StockTitan); still above its 50-day $517.80", tickers: "MSFT",
    rec: "HOLD/WATCH: competitive overhang breaks the clean relative-strength story — wait for $517 (50-day) to hold before adding." },
  { id: "t5", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 10 AMC: CoreWeave Q3 revenue $3.66B (+168% y/y, above guidance), adj. op. income $379M vs $200–260M guide, backlog ~$132.5B (from $104B), FY26 revenue guide raised to $13.0–13.3B (LSEG cons. $12.86B); net loss $709M; stock +5.7% after hours to $51.51 (SEC 8-K, CNBC, Investing.com)", tickers: "CRWV · NVDA · NBIS",
    rec: "WATCH: a beat-and-raise for AI-infrastructure demand, but leverage (interest expense $846M) keeps it a high-IV trade, not a core long." },
  { id: "t6", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 10: Goldman Sachs' James Schneider calls semiconductors 'oversold' and names NVIDIA, Broadcom and AMD top buys; SMH $483.63 is −18.2% in 21d (Yahoo Finance live)", tickers: "SMH · NVDA · AVGO · AMD",
    rec: "WATCH: oversold calls often mark bounces, not bottoms — need SMH back above $522 (200-day) first." },
  { id: "t7", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Thu Nov 12 AMC: Cisco (cons. EPS $1.15) and Applied Materials (cons. $4.06) report; Cerebras (CBRS, cons. −$0.13) also AMC; Nebius BMO (cons. −$0.61) (Nasdaq earnings calendar) [EST. — not confirmed on company IR this run]", tickers: "CSCO · AMAT · CBRS · NBIS",
    rec: "WATCH: AMAT's WFE outlook is the semicap read; both are −15% to −25% in 21d, so 'less bad' can squeeze — defined risk only." },
  { id: "t8", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "NVIDIA Q3 FY27 earnings — Tue Nov 17, results ~4:20 pm ET, call 5:00 pm ET (CONFIRMED, NVIDIA IR release Oct 28); cons. EPS $2.49 (Nasdaq); Nov 20 170 straddle $18.45 implies ≈ ±10.8% vs ~$170.3", tickers: "NVDA · SMH · AMD · AVGO · QQQ",
    rec: "WATCH: the AI-sentiment binary of the month — sell premium outside the ±10.8% implied move rather than guess direction." },
  { id: "t9", ind: "tech", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Microsoft Ignite — Nov 17–20, Moscone Center, San Francisco (event listings via search) — Copilot / agent announcements now have to answer Anthropic's Office-competing tools", tickers: "MSFT",
    rec: "WATCH: a strong agent roadmap could repair sentiment; not a standalone trade." },
  { id: "t10", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Nov 18 AMC: Palo Alto Networks reports (cons. EPS $0.52; PANW −19.2% in 21d, below its 50-day) (Nasdaq calendar) [EST.]", tickers: "PANW · CRWD",
    rec: "WATCH: security budgets vs a broken chart — wait for the reaction." },
  { id: "t11", ind: "tech", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "Thu Nov 19 / Fri Nov 20: Anthropic Nasdaq IPO expected to start trading — range $70–$78 for 825M shares (~$64B raise, ~$1.3–1.45T valuation), Goldman Sachs / Morgan Stanley lead; $26B private placement includes Google, NVIDIA and Microsoft (Yahoo Finance live, Reuters via Yahoo) [date EST.]", tickers: "AMZN · GOOGL · MSFT · NVDA · QQQ",
    rec: "WATCH: record AI supply can drain megacap liquidity (bearish QQQ) while marking up Amazon's/Alphabet's stakes (bullish AMZN)." },
  { id: "t12", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 19 AMC: Intuit (cons. EPS $2.47) and Keysight ($3.09) report; Alibaba BMO ($1.31) (Nasdaq calendar) [EST.]", tickers: "INTU · KEYS · BABA",
    rec: "WATCH: software-multiple test with the 10-year near 5%." },
  { id: "t13", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 23 AMC: HPE (cons. EPS $1.17), Zoom ($1.00), Symbotic ($0.08) report (Nasdaq calendar) [EST.]", tickers: "HPE · ZM · SYM",
    rec: "WATCH: AI-server read-through for the NVIDIA complex." },
  { id: "t14", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24: Dell (cons. EPS $6.41, time n/a) and Analog Devices (BMO, $3.89); Workday ($1.28), Autodesk ($2.27), HP ($0.75) AMC (Nasdaq calendar) [EST.]", tickers: "DELL · ADI · WDAY · ADSK",
    rec: "WATCH: Dell AI-server backlog vs NVIDIA's guide a week earlier." },
  // ---- ENERGY ----------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Mon Nov 9: Constellation Energy +10.5% — adj. Q3 EPS $5.06 vs $3.90 cons., revenue $9.55B (Zacks via Yahoo); falling crude (WTI −1.1% to $85.93) helped the broad rally", tickers: "CEG · VST",
    rec: "HOLD: AI-power names trade as AI proxies — don't chase a +10% gap." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 10: Brent settles $91.49 (−1.2%) after dipping below $90 for the first time since August on US–Iran deal hopes and rising Hormuz flows; WTI −1%; XLE $62.21 is −6.7% in 5d, below its 50-day ($65.02); XOM $164.47 (−7.3% in 5d) (Manila Times/AFP, Yahoo)", tickers: "XOM · XLE · CVX · COP · USO",
    rec: "SELL/AVOID energy longs while the war premium leaks: XOM bear put spread below $165, invalid above $170." },
  { id: "e3", ind: "energy", dayIdx: 2, future: false, impact: 1, dir: "BEARISH",
    headline: "Tue Nov 10: AAA national gasoline average falls below $4/gal for the first time since July; October CPI energy +0.7% after +5.2% in September (StockTitan, BLS)", tickers: "XLE · USO · XLY",
    rec: "WATCH: cheaper gasoline is a consumer tailwind and a refiner-margin headwind." },
  { id: "e4", ind: "energy", dayIdx: 2, future: false, impact: 1, dir: "BULLISH",
    headline: "Tue Nov 10: energy-services/efficiency names rally on results — Ameresco +23% (record $7.2B backlog), Babcock & Wilcox +18% (Q3 revenue more than doubled) (StockTitan)", tickers: "AMRC · BW",
    rec: "WATCH: small-cap, single-name momentum; not a sector signal." },
  { id: "e5", ind: "energy", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 12, 12:00 pm ET: EIA Weekly Petroleum Status Report (week to Nov 6) — shifted from Wednesday for Veterans Day (CONFIRMED, eia.gov schedule)", tickers: "XLE · USO · XOM",
    rec: "WATCH: a crude build extends the slide; a draw could spark a relief bounce." },
  { id: "e6", ind: "energy", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Mon Nov 16: Exxon Mobil Q4 dividend $1.07 record date (payable Dec 10; ex-date inferred Nov 16 under T+1 — company release states record date only) (XOM Q3 release Oct 30)", tickers: "XOM",
    rec: "WATCH: puts gain the dividend drop; no short-call assignment risk in the XOM idea." },
  { id: "e7", ind: "energy", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Nov 25, 10:30 am ET [EST.]: next EIA weekly report (no Thanksgiving exception listed); OPEC+ ministerial falls just after the window (date not re-verified this run)", tickers: "XLE · USO",
    rec: "WATCH: pre-holiday thin liquidity can exaggerate inventory surprises." },
  // ---- HEALTHCARE / PHARMA ----------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 10: Hims & Hers −16.6% — Q3 revenue +49% to $890.4M but a surprise net loss ($0.14/sh vs ~$0.06 profit expected), gross margin 57% vs 74%, and a third straight cut to FY adj. EBITDA guidance ($257–277M) (company release, StockTitan, Yahoo)", tickers: "HIMS · NVO · LLY",
    rec: "AVOID: falling margins plus repeated guidance cuts — no bottom-fishing until estimates stabilize." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 10: PepGen +93% on PGN-EDODM1 data (46.5% mean splicing correction in DM1, no serious side effects) and +12% more after hours while proposing a $125M offering; Legend Biotech −15% (reason not given) (StockTitan, Yahoo)", tickers: "PEPG · LEGN · XBI",
    rec: "WATCH: binary biotech moves; XBI flat on the week ($155.06) — no sector read." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Healthcare leadership: XLV $188.88 (+9.8% in 21d, RSI 68, above 50d $174.09 / 200d $159.69); LLY $1,432.29 (+21% in 21d, near its $1,453 20-day high), JNJ $280.78 (+5.5% in 5d) (Yahoo chart data)", tickers: "XLV · LLY · JNJ · ABBV",
    rec: "HOLD winners; extended (RSI ~68–70) — add on pullbacks, not breakouts. XLV/LLY options are too thin/wide for this report." },
  { id: "h4", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Sat Nov 14 PDUFA: Summit Therapeutics' ivonescimab + chemo (EGFR-mutated NSCLC) (Pharmacy Times / Assyro calendars via search; company-sourced) [EST.]", tickers: "SMMT",
    rec: "WATCH: binary event — defined risk and small size only." },
  { id: "h5", ind: "health", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "Thu Nov 19: Veeva reports (cons. EPS $1.68, time n/a) (Nasdaq calendar) [EST.]", tickers: "VEEV",
    rec: "WATCH: life-sciences software read; low index signal." },
  { id: "h6", ind: "health", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Sun Nov 22 PDUFA: Savara molgramostim (MOLBREEVI, aPAP) — moved from Aug 22 after a major amendment, priority review; Nuvalent/BridgeBio (Nov 27) and Roche giredestrant (Nov 30) fall just after the window (PDUFA calendars via search) [EST.]", tickers: "SVRA · NUVL · BBIO",
    rec: "WATCH: binary biotech events; approvals and further delays both happen." },
  { id: "h7", ind: "health", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Mon Nov 23 AMC: Agilent reports (cons. EPS $1.72) (Nasdaq calendar) [EST.]", tickers: "A",
    rec: "WATCH: biopharma tools demand read." },
  { id: "h8", ind: "health", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Medtronic reports (cons. EPS $1.34) (Nasdaq calendar) [EST.]", tickers: "MDT · XLV",
    rec: "WATCH: med-tech volume trends; XLV is extended into it." },
  // ---- FINANCIALS / MACRO ----------------------------------------
  { id: "f1", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Mon Nov 9: broad relief rally — S&P 500 +2.4% to 7,549.94 (best day since Apr 8), Dow +1,104 to 52,389.75, Nasdaq +2.7%; all 11 sectors up (XLI +3.8%, XLY +3.1%); VIX −22% to 19.92 (Zacks via Yahoo, StockTitan)", tickers: "SPY · QQQ · IWM · DIA",
    rec: "HOLD: an oversold squeeze — Tuesday's CPI reversal shows it wasn't a regime change." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 10, OCTOBER CPI (BLS): headline +0.4% m/m vs +0.3% expected (Sept +0.6%), core +0.3% vs +0.2% expected (third straight 0.3%); no y/y published (Oct 2025 not collected). 2-yr yield +18.9 bp to 4.736% (biggest jump since Apr 2025), 10-yr ~4.98%; S&P −0.38% to 7,520.93 (BLS, Reuters via Yahoo)", tickers: "SPY · QQQ · TLT · IWM",
    rec: "DE-RISK long-duration growth: rates are repricing higher; hedge with index puts (QQQ) rather than selling quality." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Fed: CME FedWatch now fully prices a December hike (from 84% Monday) with 50 bp odds ~12–15%; Waller backs a hike and would consider 50 bp, Logan wants at least two more hikes, Schmid calls policy 'fairly accommodative' (Reuters via Yahoo, StockTitan)", tickers: "SPY · TLT · KRE · IWM",
    rec: "SELL rate-sensitive risk into strength; a 50 bp hike is the tail the market doesn't fully price." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 10: crypto complex slides — Coinbase and Strategy −4%, Robinhood −3%, Bitcoin briefly < $73,000; gold futures −2% to ~$4,000 as the dollar firms (DXY 102.36) (Yahoo Finance live)", tickers: "COIN · HOOD · MSTR · GLD",
    rec: "AVOID: real-rate spike pressures non-yielding assets; COIN −26.8% in 21d is already oversold (RSI 33)." },
  { id: "f5", ind: "finance", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "Wed Nov 11 (TODAY) — Veterans Day: NYSE/Nasdaq trade normal hours; SIFMA recommends a full bond-market close (StockTitan); MBA mortgage data 7:00 am ET (prior 30-yr rate 7.3%) (Zacks via Yahoo)", tickers: "TLT · SPY · XHB",
    rec: "WATCH: no Treasury cash trading today — equity moves may overshoot without a rates anchor." },
  { id: "f6", ind: "finance", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 12: Brookfield BMO (cons. EPS $0.72) and Nu Holdings AMC ($0.22) report (Nasdaq calendar) [EST.]", tickers: "BN · NU",
    rec: "WATCH: alt-asset and LatAm fintech reads; low index signal." },
  { id: "f7", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "OCTOBER PPI — Fri Nov 13, 8:30 am ET (BLS via StockTitan / FedRateCalc); Japan megabanks MUFG/SMFG/Mizuho also report (Nasdaq calendar)", tickers: "SPY · TLT · QQQ",
    rec: "WATCH: a second hot print after CPI pushes 50 bp odds higher — bearish duration and growth." },
  { id: "f8", ind: "finance", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "OCTOBER RETAIL SALES — Tue Nov 17, 8:30 am ET (Census advance report, per FedRateCalc calendar) [EST. — census.gov 2026 calendar not rendered]", tickers: "XLY · WMT · HD · SPY",
    rec: "WATCH: a strong consumer seals the hike; a miss helps bonds but hurts retailers." },
  { id: "f9", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC MINUTES (Oct 27–28 meeting) — Wed Nov 18, 2:00 pm ET (FedRateCalc / Federal Reserve calendar); next decision Dec 8–9", tickers: "SPY · QQQ · TLT · KRE",
    rec: "WATCH: hawkish detail on the hike path extends pressure on long-duration tech." },
  { id: "f10", ind: "finance", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 20 — monthly options expiration (third Friday) right after NVIDIA's print and the Anthropic debut; QQQ Nov 20 OI ~2.0M contracts (Cboe chain)", tickers: "SPY · QQQ · NVDA",
    rec: "WATCH: pin/unpin volatility — avoid initiating short-dated size into the close." },
  { id: "f11", ind: "finance", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Nov 25, 8:30 am ET: Q3 GDP (second estimate) + October Personal Income & Outlays / PCE (CONFIRMED, bea.gov schedule); Deere BMO (cons. $4.07) the same morning", tickers: "SPY · TLT · DE",
    rec: "WATCH: the Fed's preferred inflation gauge before the Dec 9 decision; a hot core PCE confirms the hike." },
  // ---- CONSUMER / RETAIL ----------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 10: Take-Two +8.3% to $224.64 — FQ2 net bookings ~$1.6B (at/below the $1.62–1.67B guide), but GTA VI pre-orders > 7M units / > $750M, far above plan; FY27 bookings guide kept at $8.0–8.2B (Seeking Alpha, Yahoo)", tickers: "TTWO · SONY · MSFT",
    rec: "HOLD: the stock is +15% in 5d into the launch — classic sell-the-news risk; options are too wide to trade here." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 10 AMC: Costco declares a $30/share special dividend (~$13.3B; record Nov 24, payable Dec 4) plus a $4B buyback through 2030; stock +1.9% after hours (Costco 8-K, StockTitan)", tickers: "COST · WMT · BJ",
    rec: "HOLD: capital return supports the premium multiple; COST options too thin for this report." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Amazon +1.5% to $270.87 on a down tape (+8.1% in 5d; above 50d $254.18 / 200d $244.24); Q3 (Oct 29) AWS +39% to $46.0B, Q4 sales guide $240–247B, but FCF −$42.4B TTM on ~$220B capex (Zacks, Constellation Research)", tickers: "AMZN · XLY",
    rec: "BUY dips / bull call spread: relative strength plus an Anthropic-IPO mark-up catalyst; invalid below $252." },
  { id: "c4", ind: "consumer", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Mon Nov 16 BMO: Tyson Foods (cons. EPS $0.65), Aramark ($0.75); Baidu and Trip.com also report (Nasdaq calendar) [EST.]", tickers: "TSN · ARMK · BIDU",
    rec: "WATCH: food-inflation pass-through after CPI food +0.5%." },
  { id: "c5", ind: "consumer", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Tue Nov 17 BMO: Home Depot (cons. EPS $3.86; call 9:00 am ET — CONFIRMED, HD release Nov 3) and Disney fiscal Q4 (cons. $1.67; webcast 8:30 am ET — CONFIRMED, Disney release Oct 12), alongside October retail sales", tickers: "HD · DIS · XLY",
    rec: "WATCH: HD +20.8% in 21d into 7%+ mortgage rates is a high bar; DIS RSI 71 — both priced for good news." },
  { id: "c6", ind: "consumer", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Nov 18 BMO: Target (cons. EPS $2.03), Lowe's ($2.85), TJX ($1.33); Williams-Sonoma (time n/a) (Nasdaq calendar) [EST.]", tickers: "TGT · LOW · TJX · WSM",
    rec: "WATCH: holiday-guide commentary; LOW RSI 72 after +25% in 21d — fragile into the print." },
  { id: "c7", ind: "consumer", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "Thu Nov 19 BMO: Walmart FQ3 (cons. EPS $0.64; company guide $0.62–0.64; call 8:00 am ET per days.to — confirmation status disputed) [EST.]; Ross Stores and Gap AMC (Nasdaq calendar)", tickers: "WMT · ROST · GAP · XLP",
    rec: "WATCH: WMT +11% in 21d (RSI 64) into the print — a beat is priced; trim into strength rather than add." },
  { id: "c8", ind: "consumer", dayIdx: 11, future: true, impact: 3, dir: "BULLISH",
    headline: "Thu Nov 19: Grand Theft Auto VI launch (date reiterated with Take-Two's Nov 9 results; pre-orders > 7M) (Yahoo, Seeking Alpha)", tickers: "TTWO · SONY · MSFT",
    rec: "WATCH: the biggest entertainment launch of the year; delay risk appears gone, sell-the-news risk is not." },
  { id: "c9", ind: "consumer", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Best Buy ($1.48), Dollar Tree ($0.88), Dick's ($1.38), Abercrombie ($3.01); Burlington time n/a; Costco special-dividend record date (Nasdaq calendar, Costco 8-K) [earnings EST.]", tickers: "BBY · DLTR · DKS · ANF · COST",
    rec: "WATCH: last retail read before Black Friday." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "QQQ", name: "Invesco QQQ (Nasdaq-100)", rank: 1, spot: "$674.76 (Tue Nov 10 close, −0.68%; Cboe delayed after-hours last $679.24 (+0.7% on CoreWeave) — chain premiums reference ~$679; no pre-market prints yet at ~02:00 ET) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF) · Oct PPI Fri Nov 13 8:30 ET (CONFIRMED) · NVDA Q3 Tue Nov 17 AMC (CONFIRMED; a top-3 index weight) · retail sales Nov 17 · FOMC minutes Nov 18 2:00 ET · Anthropic IPO ~Nov 19–20 (~$64B supply, EST.) · opex Nov 20 · GDP/PCE Nov 25 (CONFIRMED, bea.gov) · Dec 9 FOMC (hike fully priced, 50 bp ~12–15%) · ex-dividend before Dec 18: QQQ's quarterly ex-date is usually the Monday after the third Friday of Dec (Dec 21, after expiry — not verified)",
    iv: "IV ~25% (Dec 18, ATM 675P 24.8% / 680C 24.3%; Cboe iv30 24.7) · IVR n/a · realized vol HV20 35.9% / HV10 45.3% > implied (cheap premium) · no single-name binary · 1σ to Dec 18 ≈ ±$53.6 (±7.9%) → $625 / $733",
    liq: "A — Tue Nov 10 full session ≈8.50M option contracts (20d avg n/a) & 38.5M shares (20d avg 51.6M); Dec 18 OI 29.0k / 35.0k on the 675P / 645P, 12.2k / 13.7k on the 735C / 745C, 29.3k on the 655P; spreads 1.0–6.0% of mid [Cboe delayed chain, Nov 10 session / Yahoo]",
    thesis: "Index hedge with a trend: QQQ closed $674.76, below its 50-day ($719.39) and 200-day ($681.42), −9.6% in 21d with 238 Nasdaq new lows vs 59 highs, and October CPI (+0.4% / core +0.3%, both above consensus) lifted the 2-year 19 bp and made a December hike fully priced with 50 bp odds rising — the most direct hit is to long-duration tech. Into PPI, NVIDIA's print and a ~$64B Anthropic IPO that competes for megacap dollars, the path of least resistance is a retest of the $647 20-day low. Risk: the market is oversold (RSI 40, Goldman calls semis 'oversold'), the CoreWeave beat lifted QQQ +0.7% after hours, and a strong NVIDIA guide could squeeze shorts. Invalid on a close above $720 (50-day). Conviction 4/5 (4/4/4/3/5).",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $735C / buy $745C · Dec 18 '26 · credit $0.95 (mids 2.45 − 1.505 = 0.945) · capital ~$906 · max profit ~$95 · BE $735.95 · R:R 1:0.10 · POP ~88% (1−|Δ short 0.118|) · exit: buy back at ~50% profit (≈$0.47), or if QQQ closes above $720 (invalidation) / through $735; close by Dec 11 (~7 DTE) — short strike just beyond 1σ ($733) and above the $719 50-day; OI 12.2k / 13.7k, spreads 4–6%" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $675P / sell $645P · Dec 18 '26 · debit $9.20 (mids 20.125 − 10.93 = 9.195) · capital ~$920 · max profit ~$2,081 · BE $665.80 · R:R 1:2.26 · POP ~42% (lognormal, IV 25%) · exit +75–100% (~$16.1–18.4 spread value) or stop −50% (~$4.60) / QQQ close above $720; close with ≥10 days left (by Dec 8) — near-the-money long leg (Δ −0.47), short leg at the $647 20-day low; OI 29.0k / 35.0k, spreads 1–2%" },
      { profile: "Aggressive", strategy: "Long Put", text: "Buy $655P · Dec 18 '26 · debit $13.38 (mid; bid/ask 13.25/13.51) · capital ~$1,338 · max profit: uncapped to $0 (~$64,162 theoretical) · BE $641.62 · R:R n/a (uncapped) · POP ~27% (lognormal, IV 27%) · exit +100% (~$26.8) or stop −50% (~$6.69) / QQQ close above $720; close with ≥10 days left (by Dec 8) — Δ −0.33; a naked long put is justified because realized vol (HV20 36%) runs well above the 25% implied; OI 29.3k, spread 1.9%" },
    ] },
  { ticker: "AMZN", name: "Amazon", rank: 2, spot: "$270.87 (Tue Nov 10 close, +1.48%; Cboe delayed after-hours last $271.95 — chain premiums reference ~$272; no pre-market prints yet at ~02:00 ET) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bullish",
    catalyst: "No earnings before expiry (Q3 reported Oct 29; next ~late Jan, EST.) · Anthropic IPO ~Nov 19–20 at $70–78/sh (~$1.3–1.45T; Amazon's stake est. mid-to-high teens %, unconfirmed) · AWS re:Invent Nov 30–Dec 4 (after the window, before expiry) · retail sales Nov 17, FOMC minutes Nov 18, PCE Nov 25, Dec 9 FOMC · no dividend · cons. EPS/rev n/a (no print in window)",
    iv: "IV ~32.5% (Dec 18, ATM 270C 33.0%; Cboe iv30 32.6) · IVR n/a · HV20 42.4% · no binary before expiry · 1σ to Dec 18 ≈ ±$28.1 (±10.3%) → $244 / $300",
    liq: "A — Tue Nov 10 full session ≈593.4k option contracts (20d avg n/a) & 38.9M shares (20d avg 50.3M); Dec 18 OI 19.2k / 15.3k on the 240P / 230P, 16.3k / 14.4k on the 270C / 295C, 22.2k / 8.0k on the 285C / 310C; spreads 1.6–6.6% of mid [Cboe delayed chain, Nov 10 session / Yahoo]",
    thesis: "Relative strength that held through the hot-CPI selloff: AMZN rose 1.5% to $270.87 while QQQ fell 0.7%, +8.1% in 5d, above its rising 50-day ($254.18) and 200-day ($244.24), RSI 62, just under the $275.34 20-day high. Q3 AWS growth of 39% to $46.0B (fastest in ~5 years, op. income +55%) and a $240–247B Q4 sales guide underpin it, and the Anthropic IPO (Nov 19–20) is set to put a public mark on Amazon's large stake. Carried from the Nov 10 report (then-spot $266.93, +1.5%: working) and re-set to today's strikes. Risk: FCF is −$42.4B TTM on ~$220B capex, a 5%-10-year pressures high-multiple megacaps, and the IPO could be a sell-the-news event. Invalid on a close below $252. Conviction 4/5 (3/4/3/4/5).",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $240P / buy $230P · Dec 18 '26 · credit $0.98 (mids 2.50 − 1.52) · capital ~$902 · max profit ~$98 · BE $239.02 · R:R 1:0.11 · POP ~86% (1−|Δ short 0.14|) · exit: buy back at ~50% profit (≈$0.49), or if AMZN closes below $252 (invalidation) / $240; close by Dec 11 (~7 DTE) — short strike beyond 1σ ($244) and the 200-day ($244); OI 19.2k / 15.3k, spreads 3–7%" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $270C / sell $295C · Dec 18 '26 · debit $9.25 (mids 12.60 − 3.35) · capital ~$925 · max profit ~$1,575 · BE $279.25 · R:R 1:1.70 · POP ~38% (lognormal, IV 32.5%) · exit +75–100% (~$16.2–18.5 spread value) or stop −50% (~$4.63) / AMZN close below $252; close with ≥10 days left (by Dec 8) — near-the-money long leg (Δ +0.55), short leg near the ~0.8σ level above the $275 20-day high; OI 16.3k / 14.4k, spreads 2–3%" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $285C / sell $310C · Dec 18 '26 · debit $4.74 (mids 6.025 − 1.285) · capital ~$474 · max profit ~$2,026 · BE $289.74 · R:R 1:4.27 · POP ~25% (lognormal, IV 31.6%) · exit +100% (~$9.48 spread value) or stop −50% (~$2.37) / AMZN close below $252; close with ≥10 days left (by Dec 8) — OTM spread (long Δ +0.35) for a breakout through $275 into re:Invent; OI 22.2k / 8.0k, spreads 2.5–3.9%" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 3, spot: "$168.89 (Tue Nov 10 close, −5.47%; −18.3% in 5d; Cboe delayed after-hours last $170.28 — chain premiums reference ~$170.3; no pre-market prints yet at ~02:00 ET) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Neutral",
    catalyst: "Q3 FY27 earnings Tue Nov 17 AMC — results ~4:20 pm ET, call 5:00 pm ET (CONFIRMED, NVIDIA IR) · cons. EPS $2.49 (Nasdaq); revenue consensus n/a this run; revision trend n/a · board probe into the Huang foreign-intelligence reports (open-ended) · PPI Nov 13, FOMC minutes Nov 18, Anthropic IPO ~Nov 19–20, opex Nov 20 · Dec 18 expiry is after earnings · ex-dividend n/a (tiny dividend; all shorts OTM)",
    iv: "IV ~56% (Dec 18, ATM 170C/P 56.2/56.4%; Cboe iv30 58.9) · IVR n/a · options imply ≈ ±10.8% to Nov 20 (170 straddle $18.45 vs ~$170.3) vs hist. avg earnings move n/a (not retrieved this run) · HV20 51% · 1σ to Dec 18 ≈ ±$30.4 (±17.8%) → $140 / $201",
    liq: "A — Tue Nov 10 full session ≈7.26M option contracts (20d avg n/a; elevated on the probe) & 426.6M shares (20d avg 154.4M); Dec 18 OI 25.5k / 14.1k on the 140P / 130P, 11.3k / 7.9k on the 145P / 135P, 32.3k on the 150P, 57.6k / 47.5k on the 200C / 210C, 6.7k / 12.4k on the 195C / 205C, 53.0k on the 190C; spreads 1.6–5.1% of mid [Cboe delayed chain, Nov 10 session / Yahoo]",
    thesis: "Direction is a coin-flip into two binaries — the confirmed Nov 17 print and an open-ended board probe — so the edge is the premium: Dec 18 IV ~56% and the market already prices ±10.8% for earnings. NVDA is −25.4% in 21d to $168.89, RSI 24, far below its 50-day ($218) and 200-day ($204.5): washed out (Goldman calls semis oversold) but with no fundamental floor until the guide. Iron condors with short strikes outside the implied move harvest the post-earnings IV crush. Carried from the Nov 10 report (then-spot $178.67, −5.5%: against the put side, still inside the old $160–$200 range) with strikes re-centred on ~$170. Risk: a probe escalation (executive change, export-control action) or an AI-capex guide shock can gap through a wing. Exit if NVDA closes outside $150–$190 before the print. Invalid on a close below $145 or above $195. Conviction 4/5 (4/3/4/3/5).",
    ideas: [
      { profile: "Conservative", strategy: "Iron Condor (wide, ~1σ shorts)", text: "Iron condor: sell $140P / buy $130P + sell $200C / buy $210C · Dec 18 '26 · credit $2.44 (puts 3.00 − 1.73 + calls 2.705 − 1.54 = 2.435) · capital ~$757 · max profit ~$244 · BE $137.56 / $202.44 · R:R 1:0.32 · POP ~66% (1−Σ|Δ short| 0.151+0.190) · exit: buy back at ~50% profit (≈$1.22), or if NVDA closes through $140 / $200; close by Dec 11 (~7 DTE) — held THROUGH the Nov 17 print on purpose: shorts at ~1σ ($140 / $201), well outside the ±10.8% implied move ($152 / $189); OI 14k–58k, spreads 2–3%" },
      { profile: "Moderate", strategy: "Iron Condor (~0.8σ shorts)", text: "Iron condor: sell $145P / buy $135P + sell $195C / buy $205C · Dec 18 '26 · credit $3.15 (puts 3.90 − 2.29 + calls 3.575 − 2.035) · capital ~$685 · max profit ~$315 · BE $141.85 / $198.15 · R:R 1:0.46 · POP ~58% (1−Σ|Δ short| 0.190+0.234) · exit: buy back at ~50% profit (≈$1.58), or if NVDA closes through $145 / $195; close by Dec 11 (~7 DTE) — shorts at ~0.82σ, outside the implied earnings move; OI 6.7k–12.4k, spreads 3–5%" },
      { profile: "Aggressive", strategy: "Iron Condor (tight, at implied-move edge)", text: "Iron condor: sell $150P / buy $140P + sell $190C / buy $200C · Dec 18 '26 · credit $4.02 (puts 5.05 − 3.00 + calls 4.675 − 2.705) · capital ~$598 · max profit ~$402 · BE $145.98 / $194.02 · R:R 1:0.67 · POP ~48% (1−Σ|Δ short| 0.236+0.286) · exit: buy back at ~50% profit (≈$2.01), or if NVDA closes through $150 / $190; close by Dec 11 (~7 DTE) — shorts just outside the ±10.8% implied move (−11.9% / +11.6%): highest premium and highest gap risk, thesis is IV crush after the print; OI 25k–58k, spreads 2–3%" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 4, spot: "$348.51 (Tue Nov 10 close, −0.62%; Cboe delayed after-hours last $348.80 — chain premiums reference ~$349.5; no pre-market prints yet at ~02:00 ET) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bullish",
    catalyst: "No earnings before expiry (next ~late Jan, EST.) · holiday-quarter iPhone 18 demand checks (JPMorgan PT raised to $360 in Oct; KeyBanc Underweight $250 — dispersion is wide) · PPI Nov 13, retail sales Nov 17, FOMC minutes Nov 18, PCE Nov 25, Dec 9 FOMC · ex-dividend before Dec 18 n/a (not verified; no short calls, so no early-assignment exposure) · cons. EPS/rev n/a (no print in window)",
    iv: "IV ~23% (Dec 18, ATM 350C 23.2%; Cboe iv30 22.8) · IVR n/a · realized HV20 26.7% / HV10 36.3% > implied (premium cheap) · no binary before expiry · 1σ to Dec 18 ≈ ±$25.8 (±7.4%) → $324 / $375",
    liq: "A — Tue Nov 10 full session ≈694.0k option contracts (20d avg n/a) & 29.7M shares (20d avg 49.4M); Dec 18 OI 27.7k / 16.8k on the 320P / 310P, 26.6k / 16.1k on the 350C / 370C, 28.3k on the 360C; spreads 2.9–7.2% of mid [Cboe delayed chain, Nov 10 session / Yahoo]",
    thesis: "Quality megacap that is holding while the Nasdaq breaks: AAPL $348.51 is +5.0% in 5d and +2.2% in 21d vs QQQ −9.6%, above its 50-day ($337.27) and 200-day ($299.78), RSI 56, with resistance at the $355.38 20-day high and support at $337 / $325 (20-day low). Implied vol (~23%) is below realized (HV20 26.7%), so owning upside is cheap and a 1σ move reaches $375. It is the funded 'long quality' side of the QQQ hedge (rank 1), replacing MSFT, whose relative-strength case broke on Anthropic's Office-competing tools (Nov 10 report: then-spot $545.18 → $533.16, −2.2%: against). Risk: AAPL is a top QQQ weight, so a broad Nasdaq flush drags it; iPhone 18 build-cut reports and a ~5% 10-year cap the multiple. Invalid on a close below $335. Conviction 4/5 (2/4/4/3/5).",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $320P / buy $310P · Dec 18 '26 · credit $1.00 (mids 2.53 − 1.535 = 0.995) · capital ~$901 · max profit ~$100 · BE $319.01 · R:R 1:0.11 · POP ~85% (1−|Δ short 0.151|) · exit: buy back at ~50% profit (≈$0.50), or if AAPL closes below $335 (invalidation) / $320; close by Dec 11 (~7 DTE) — short strike beyond 1σ ($324) and the $325 20-day low; OI 27.7k / 16.8k, spreads 5–7%" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $350C / sell $370C · Dec 18 '26 · debit $7.47 (mids 10.35 − 2.88) · capital ~$747 · max profit ~$1,253 · BE $357.47 · R:R 1:1.68 · POP ~37% (lognormal, IV 23.2%) · exit +75–100% (~$13.1–14.9 spread value) or stop −50% (~$3.74) / AAPL close below $335; close with ≥10 days left (by Dec 8) — at-the-money long leg (Δ +0.51), short leg at ~0.8σ above the $355 20-day high; OI 26.6k / 16.1k, spreads 3–6%" },
      { profile: "Aggressive", strategy: "Long Call (OTM)", text: "Buy $360C · Dec 18 '26 · debit $5.80 (mid; bid/ask 5.65/5.95) · capital ~$580 · max profit: uncapped · BE $365.80 · R:R n/a (uncapped) · POP ~25% (lognormal, IV 22.1%) · exit +100% (~$11.60) or stop −50% (~$2.90) / AAPL close below $335; close with ≥10 days left (by Dec 8) — Δ +0.36; buying premium is justified because implied (22%) sits below realized (HV20 27%); OI 28.3k, spread 5.2%" },
    ] },
  { ticker: "XOM", name: "Exxon Mobil", rank: 5, spot: "$164.47 (Tue Nov 10 close, −0.16%; 20-day low $160.11; Cboe delayed after-hours last $164.50 — chain premiums reference ~$164.5; no pre-market prints yet at ~02:00 ET) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings before expiry (Q3 reported Oct 30; next ~late Jan, EST.) · US–Iran deal headlines / Hormuz flows (Brent $91.49, briefly < $90 Nov 10) · EIA weekly report Thu Nov 12 12:00 ET (CONFIRMED, eia.gov) and ~Nov 25 · Q4 dividend $1.07, record date Nov 16 (ex-date inferred Nov 16; puts gain the drop, no short calls) · OPEC+ ministerial just after the window (not re-verified) · Dec 18 expiry",
    iv: "IV ~29% (Dec 18, ATM 165P 28.4% / 165C 29.6%; Cboe iv30 29.4) · IVR n/a · HV20 32.0% · no scheduled binary before expiry (headline-driven) · 1σ to Dec 18 ≈ ±$15.2 (±9.2%) → $149 / $180",
    liq: "A — Tue Nov 10 full session ≈34.7k option contracts (20d avg n/a; passes the ≥20k gate on the prior full session) & 11.5M shares (20d avg 14.2M); Dec 18 put OI 2.0k / 4.5k / 3.0k / 4.5k / 5.9k on the 170P / 160P / 165P / 155P / 150P; spreads 7.0–9.6% of mid ($0.30–0.80 wide) [Cboe delayed chain, Nov 10 session / Yahoo]",
    thesis: "The war premium keeps leaking: Brent fell another 1.2% to $91.49 Tuesday (dipping under $90 for the first time since August) on US–Iran deal hopes and rising Hormuz flows, and US gasoline fell below $4. XOM is −7.3% in 5d to $164.47, below its 50-day ($169.06) and sitting on its 20-day low ($160.11), with XLE −6.7% in 5d; the target is the 200-day ($155.90) then $150. Carried from the Nov 10 report (then-spot $164.73, −0.2%: flat) after re-validation — crude made a new 2-month low — with strikes re-set. Risk: talks have stalled repeatedly and a failed-talks headline can spike crude; Q3 beat with a $20B buyback and a raised dividend; RSI 38 is close to oversold, so a short-covering bounce to the 50-day is plausible. Invalid on a close above $170. Conviction 3/5 (3/4/3/3/4).",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (ITM long leg)", text: "Buy $170P / sell $160P · Dec 18 '26 · debit $5.30 (mids 9.60 − 4.30) · capital ~$530 · max profit ~$470 · BE $164.70 · R:R 1:0.89 · POP ~52% (lognormal, IV 28.5%) · exit +75% (~$9.3 spread value) up to the $10.00 max, or stop −50% (~$2.65) / XOM close above $170; close with ≥10 days left (by Dec 8) — in-the-money long leg (Δ −0.64) = highest-probability tier; a 1σ bear call credit spread was rejected (the 185C is 12% wide); OI 2.0k / 4.5k, spreads 7–8%" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $165P / sell $155P · Dec 18 '26 · debit $3.80 (mids 6.525 − 2.73 = 3.795) · capital ~$380 · max profit ~$621 · BE $161.21 · R:R 1:1.64 · POP ~43% (lognormal, IV 29%) · exit +75–100% (~$6.6–7.6 spread value) or stop −50% (~$1.90) / XOM close above $170; close with ≥10 days left (by Dec 8) — at-the-money long leg (Δ −0.51), short leg at the 200-day ($155.90); OI 3.0k / 4.5k, spreads 8–10%" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $160P / sell $150P · Dec 18 '26 · debit $2.64 (mids 4.30 − 1.66) · capital ~$264 · max profit ~$736 · BE $157.36 · R:R 1:2.79 · POP ~34% (lognormal, IV 30%) · exit +100% (~$5.28 spread value) or stop −50% (~$1.32) / XOM close above $170; close with ≥10 days left (by Dec 8) — OTM spread (long Δ −0.38) for a break of the $160 20-day low toward $150; a spread rather than a naked put because ~30% IV is above XOM's norm; OI 4.5k / 5.9k, spreads 7–10%" },
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
// today line sits on the boundary between Nov 11 and Nov 12
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Wednesday, Nov 11 2026 · pre-market ~02:00 ET (quotes = Tue Nov 10 close; option quotes = Tue close)</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Nov 11)
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
