import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Wednesday, November 18, 2026 — trading-day edition, built pre-market (~2 am ET; no pre-market quotes yet: post-market prints and overnight futures used, ES +0.23% / NQ +0.56% at ~1:45 ET); stock quotes = Tue Nov 17 close (Yahoo Finance chart, cross-checked with Cboe delayed quotes); option quotes, OI & volume = Cboe delayed chain after the Tue Nov 17 session (full-session volume); GLD and IBIT premiums re-estimated (ESTIMATE) for >1% overnight moves.
 * Window: last 3 days (Nov 15) → coming 2 weeks (Dec 2).
 *
 * Self-contained: only depends on React. Inline styles + raw SVG, no libs.
 * Drop <MarketMatrix /> anywhere and it renders.
 *
 * ⚠ Educational analysis, NOT financial advice. Option premiums are ESTIMATES
 *   derived from spot + implied vol; confirm live on your broker before trading.
 */

// ------------------------------------------------------------------ palette
const INDUSTRIES = {
  tech:     { label: "Technology / Software / Semis", color: "#3b82f6" },
  energy:   { label: "Energy / Commodities",  color: "#f59e0b" },
  health:   { label: "Healthcare / Pharma",   color: "#10b981" },
  finance:  { label: "Financials / Rates / Crypto", color: "#a855f7" },
  consumer: { label: "Consumer / Retail",     color: "#ef4444" },
};

const DIR = {
  BULLISH: { glyph: "↑", label: "Bullish" },
  BEARISH: { glyph: "↓", label: "Bearish" },
  MIXED:   { glyph: "↔", label: "Mixed / uncertain" },
};

// 18-day axis: Nov 15 .. Dec 2 (last 3 days → coming 2 weeks). Today = index 3 (Nov 18).
const DAYS = [
  { idx: 0, date: "Nov 15", dow: "Sun" },
  { idx: 1, date: "Nov 16", dow: "Mon" },
  { idx: 2, date: "Nov 17", dow: "Tue" },
  { idx: 3, date: "Nov 18", dow: "Wed" }, // TODAY
  { idx: 4, date: "Nov 19", dow: "Thu" },
  { idx: 5, date: "Nov 20", dow: "Fri" },
  { idx: 6, date: "Nov 21", dow: "Sat" },
  { idx: 7, date: "Nov 22", dow: "Sun" },
  { idx: 8, date: "Nov 23", dow: "Mon" },
  { idx: 9, date: "Nov 24", dow: "Tue" },
  { idx: 10, date: "Nov 25", dow: "Wed" },
  { idx: 11, date: "Nov 26", dow: "Thu" },
  { idx: 12, date: "Nov 27", dow: "Fri" },
  { idx: 13, date: "Nov 28", dow: "Sat" },
  { idx: 14, date: "Nov 29", dow: "Sun" },
  { idx: 15, date: "Nov 30", dow: "Mon" },
  { idx: 16, date: "Dec 1", dow: "Tue" },
  { idx: 17, date: "Dec 2", dow: "Wed" },
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
  // ---- TECHNOLOGY / SOFTWARE / SEMIS -------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Sun Nov 15: Treasury Secretary Bessent gives NVIDIA's board and outside counsel 10 days (~Nov 25) to show export-control compliance and urges an outside CEO after Jensen Huang's Nov 12 resignation; NVDA fell 4.12% the next session to $156.14 [Al Jazeera; CryptoBriefing; Yahoo]", tickers: "NVDA · SMH",
    rec: "WATCH: a dated policy overhang (~Nov 25, EST.). Don't add semis on the earnings pop until the board responds." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 16: semis rout. SMH −5.11% to $461.90, Micron −7.62% to $719.02, Intel −7.02% to $55.47, AMD −5.58% to $504.28, Broadcom −3.92% to $333.40, NVIDIA −4.12% to $156.14 [Yahoo]", tickers: "SMH · MU · AMD",
    rec: "WATCH: SMH ($460.10 Tue) is 17.2% under its 50-day; it bounced ~2–4% after hours on NVIDIA. Wait for a close back above Friday's $486.75 before calling a bottom." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 16: megacaps sold. Alphabet −4.07% to $283.72, Amazon −3.34% to $257.75, Microsoft −1.12%, Apple −0.98%; Nasdaq-100 −2.67% to 27,197 [Yahoo]", tickers: "GOOGL · AMZN · MSFT",
    rec: "WATCH: Apple (3.4% above its 50-day) is the relative-strength holdout; Alphabet sits 14% under its 50-day." },
  { id: "t4", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Tue Nov 17 AMC: NVIDIA Q3 FY27 beats. Revenue $115.84B vs $109.10B expected (+103% y/y); Q4 guide $130B vs $125.1B; FY28 growth target raised to ~75% from 70%; supply commitments $390B; GM guide 71–72% vs 74.8% in Q3; board chair says Huang will not be reinstated. Shares ~+2–5% after hours (~$158.5–$163 vs $155.46 close) [CNBC; KuCoin; BigGo; Yahoo; Cboe]", tickers: "NVDA · SMH · QQQ",
    rec: "HOLD / WATCH: the beat eases AI-demand fears, but leadership is unresolved and Bessent's deadline (~Nov 25) is still ahead. No chasing the gap; defined-risk only." },
  { id: "t5", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 17: software sell-off on AI seat-disruption fears a day before Anthropic prices its IPO. Salesforce −9.45% to $194.52 (worst S&P 500 stock), Intuit −7.17%, ServiceNow −6.51%, Workday −5.80%, Adobe −4.25%; IGV −3.29% to $95.74, 1.6% above its 200-day [Yahoo; GuruFocus; mlq.ai]", tickers: "IGV · CRM · NOW",
    rec: "SELL rallies / WATCH: IGV is 9.6% under its 50-day and testing its 200-day ($94.25). IGV option quotes were too wide (10–80% of mid on most strikes) for a play." },
  { id: "t6", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17: Microsoft Ignite opened (Nov 17–20, San Francisco; Nadella / Althoff keynote): Azure, AI-agent and Copilot news. MSFT −2.27% to $506.24, under its 50-day ($519.61) [ecorpit; ElevenForum; Yahoo]", tickers: "MSFT",
    rec: "WATCH: MSFT lost its 50-day on keynote day; a close back above ~$520 would repair the chart." },
  { id: "t7", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Wed Nov 18 (evening): Anthropic prices its Nasdaq IPO (ANT): 825M shares at $70–78, up to ~$64.35B net; a separate ~$26B private placement is reported; first trade expected Thu Nov 19 [CNBC; Yahoo Finance; mlq.ai]", tickers: "QQQ · IGV · AMZN",
    rec: "WATCH: pricing at or above the top of the range signals strong AI appetite; the supply already weighed on software Tuesday." },
  { id: "t8", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Wed Nov 18 AMC: Palo Alto Networks FQ1 (cons. EPS $0.52; 16 est.; 0 up / 0 down). The Nov 20 straddle prices ±11.7%; PANW is 15.6% under its 50-day after a −10.9% month [Nasdaq; Cboe; Yahoo]", tickers: "PANW · IGV",
    rec: "WATCH (both ways): options price a double-digit move; avoid selling strikes inside ±12%. A beat could steady software after Tuesday's rout." },
  { id: "t9", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Thu Nov 19: Anthropic (ANT) expected to begin trading on the Nasdaq Global Select Market, subject to Wednesday-evening pricing [Yahoo Finance; CNBC; TradingKey]", tickers: "QQQ · IGV · AMZN",
    rec: "WATCH: a strong debut can ease AI-supply worries; a weak one adds to software and Nasdaq pressure. Avoid adding AI longs into the open." },
  { id: "t10", ind: "tech", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 19: Alibaba (cons. EPS $1.56) and PDD ($2.61) BMO; Intuit ($2.47; 9 est., 0 revisions) and Keysight ($3.09) AMC. BABA's Nov 20 straddle prices ±7.6% after a −15.6% week; INTU's ±9.4% after Tuesday's −7.2% [Nasdaq; Cboe; Yahoo]", tickers: "BABA · INTU · PDD",
    rec: "WATCH: both priced for big moves with no revision edge; BABA (RSI 26) is oversold into the print." },
  { id: "t12", ind: "tech", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24: Dell FQ3 AMC (cons. EPS $6.41; 8 est., 0 revisions; Dec IV 98%), Workday ($1.28), Autodesk ($2.27), HP ($0.74) AMC; Analog Devices BMO ($3.89; 1 up / 0 down) [Nasdaq; Cboe]", tickers: "DELL · WDAY · ADI",
    rec: "WATCH: Dell is the AI-server follow-through after NVIDIA's guide; Workday reports into the software sell-off (−5.8% Tue)." },
  { id: "t13", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "~Wed Nov 25 (EST.): end of Bessent's 10-day window for NVIDIA's board and outside counsel to show export-control compliance (set Sun Nov 15); a Justice Department probe of chip routing via Singapore's Megaspeed is ongoing [Al Jazeera; CryptoBriefing]", tickers: "NVDA · SMH",
    rec: "WATCH: a credible response removes an overhang; escalation (penalties, management changes) hits the chip group." },
  { id: "t14", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30: AWS re:Invent opens (Nov 30–Dec 4, Las Vegas); CEO Matt Garman's keynote Tue Dec 1, 8:30 am PT, with an agentic-AI focus [ecorpit; CX Today]", tickers: "AMZN",
    rec: "WATCH: AMZN ($257.89) is 1.2% above its 50-day; re:Invent is a sentiment catalyst, not an earnings one." },
  { id: "t15", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1 AMC: CrowdStrike (cons. EPS $0.00), Marvell ($0.79; 0 up / 1 down), NetApp ($2.13), Okta ($0.43), MongoDB ($0.08), Credo ($1.03). Commerce Secretary Lutnick's Dec 1 deadline on chip-export accountability [Nasdaq earnings calendar; CryptoBriefing]", tickers: "MRVL · CRWD",
    rec: "WATCH: Marvell is the first AI-silicon print after NVIDIA (−37% in a month, Dec IV 91%); defined-risk only." },
  { id: "t16", ind: "tech", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Dec 2 AMC: Salesforce FQ3 (cons. EPS $2.41; 13 est., 0 revisions), Snowflake (−$0.32), Zscaler ($0.12) [Nasdaq earnings calendar]", tickers: "CRM · SNOW · IGV",
    rec: "WATCH: Salesforce reports two weeks after its −9.4% day; AI-agent monetization commentary decides whether software stabilizes." },
  // ---- ENERGY / COMMODITIES ----------------------------------------
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 16: crude slides. WTI −3.21% to $85.72, Brent −3.55% to $92.44; XLE −1.96% to $63.69, Exxon −2.18%, Freeport −6.84% to $55.19 [Yahoo]", tickers: "XLE · XOM · FCX",
    rec: "WATCH: XLE ($63.36 Tue) is under its 50-day ($64.95), but its options are 34–159% wide, so no play." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17, 4:30 pm: API crude stocks +5.30M bbl vs −0.50M expected (prior +9.0M); WTI then fell 1.85% overnight to $84.42, a 20-day low and −17.1% in a month [Nasdaq economic calendar; Yahoo]", tickers: "USO · XLE",
    rec: "SELL rallies in crude-linked names: back-to-back large builds point to oversupply ahead of EIA and OPEC+." },
  { id: "e3", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 17 → overnight: gold breaks $3,800. GLD −0.13% to $352.48 (20-day low), then spot gold fell ~1.4% to ~$3,795, its lowest since Sep 2025, on near-certain December-hike pricing and a 19-month dollar high (DXY 103.71) [FXStreet; Kitco; Yahoo]", tickers: "GLD · SLV",
    rec: "SELL rallies with defined risk (see the GLD play); invalid on a close above $366." },
  { id: "e4", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Wed Nov 18, 10:30 am: EIA weekly petroleum status (cons. +0.40M bbl crude vs +4.66M prior; API showed +5.3M) [Nasdaq economic calendar]", tickers: "USO · XLE",
    rec: "WATCH: a third large build in a row would confirm the glut behind crude's −17% month." },
  { id: "e5", ind: "energy", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Sun Nov 29: OPEC+ (all 21 members) meets to set the 2027 production framework and capacity-based baselines; the capacity review has been delayed; ~2M bpd of cuts run through end-2026 [EngineeringNews / Reuters; GV Wire]", tickers: "XLE · XOM · USO",
    rec: "WATCH (both ways): higher 2027 baselines extend crude's slide; a disciplined framework could squeeze shorts. Stay defined-risk through the weekend gap." },
  // ---- HEALTHCARE / PHARMA -----------------------------------------
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 17: managed care reverses Monday's rally. UnitedHealth −5.42% to $389.68 (below its 50-day $391.50), Humana −3.88%, Centene −2.97%, Elevance −2.77% after Sen. Warren called for breaking up healthcare conglomerates and regulators proposed tougher fraud-prevention rules; sources differ on the main driver [Yahoo; Benzinga; TokenPost; Investing.com]", tickers: "UNH · HUM · CNC",
    rec: "WATCH: bearish below UNH's 200-day ($367.58); a bear put spread fits on a break. UNH Dec puts quote 4–8% wide." },
  { id: "h3", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 16: biotech slides. XBI −3.10% to $145.88 (now −6.3% in a week, 5.4% under its 50-day); Capricor −12.91% to $8.30 ahead of its PDUFA [Yahoo]", tickers: "XBI · CAPR",
    rec: "WATCH: avoid binary-event longs while risk appetite is falling." },
  { id: "h4", ind: "health", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Sun Nov 22 PDUFA: Capricor deramiocel (Duchenne) and Savara molgramostim (autoimmune PAP); weekend dates, so the FDA may act early or late [Newswire; BiopharmaWatch]", tickers: "CAPR · SVRA",
    rec: "AVOID binary sizing: single-outcome events; CAPR has swung 12–13% in a day this week." },
  { id: "h7", ind: "health", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27 PDUFA: BridgeBio BBP-418 in LGMD2I/R9 (priority review; company-confirmed date). BBIO $76.80, +13% in a month [Newswire; StockTitan; Yahoo]", tickers: "BBIO",
    rec: "WATCH: a binary on a holiday half-session after a strong run; defined-risk only." },
  { id: "h8", ind: "health", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 PDUFA: Vertex povetacicept in IgA nephropathy (priority review, accelerated approval; company-confirmed) [Newswire; BiopharmaWatch]", tickers: "VRTX",
    rec: "HOLD VRTX ($534.20): a new label is incremental for a mega-cap." },
  { id: "h9", ind: "health", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Medtronic FQ2 (cons. EPS $1.34; 8 est., 0 revisions); Wed Nov 25 PDUFA: Sanofi venglustat (type 3 Gaucher) [Nasdaq; BiopharmaWatch]", tickers: "MDT · SNY",
    rec: "LOW signal: no revision edge; MDT options are thin (~3k contracts Tue)." },
  // ---- FINANCIALS / RATES / CRYPTO ---------------------------------
  { id: "f1", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 16: S&P 500 −1.92% to 7,416.59, Nasdaq-100 −2.67%, Russell 2000 −1.70%; VIX +18.7% to 22.91. FedWatch-cited reports put December-hike odds at ~100% after the strong October jobs report [Yahoo; Motley Fool]", tickers: "SPY · QQQ · IWM",
    rec: "HEDGE: index bear put spreads fit while the S&P sits on its 200-day." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 17: S&P 500 −1.03% to 7,340.53 (4th straight loss, lowest close since July, right on its 200-day 7,344.53); Dow −848.75 (−1.64%) to 50,759.42; Russell 2000 −1.50% to 2,701.87; NYSE decliners ~4:1; VIX 25.46 above VIX3M 24.98 (inverted) [Investing.com; Yahoo; HNGN]", tickers: "IWM · SPY · DIA",
    rec: "HEDGE: IWM is 3.8% under its 50-day and 3.7% under its 200-day (see the IWM play). Invalid on a close above $280." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "Tue Nov 17: October retail sales +0.2% vs +0.1% cons., control group +0.6% vs +0.4%; industrial production −0.4% vs 0.0%; NAHB 25 vs 29 (Empire State Mon: 7.8 vs 17.6). Curve: 2-yr 4.80%, 10-yr 5.10%, 2s10s +30 bp; TLT +0.21% [Nasdaq economic calendar; US Treasury; Yahoo]", tickers: "TLT · XRT",
    rec: "WATCH: a resilient consumer next to weak factories and housing keeps the December hike on track." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 17: crypto slide extends. IBIT −1.77% to $36.14 (RSI 22.4, −21.9% in a month), Strategy −6.34% to $96.50, Coinbase −4.02%; spot Bitcoin ETFs −$239.9M, IBIT −$209.5M; Bitcoin ~$64.2–64.6k, below its ~$68k 200-week average [Yahoo; CoinOtag; crypto.news; Digital Today / Wintermute]", tickers: "IBIT · MSTR · COIN",
    rec: "SELL rallies with bear put spreads (see the IBIT play); oversold RSIs argue against naked short exposure." },
  { id: "f5", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Wed Nov 18: FOMC minutes (Oct meeting) 2:00 pm; housing starts 8:30 (cons. 1.25M) / permits (1.38M); 20-yr bond auction 1:00; Daly 12:15, Barr 1:35, Williams 2:30, Kashkari 4:15 pm [Nasdaq economic calendar]", tickers: "TLT · SPY",
    rec: "WATCH: markets price ~96–100% odds of a December hike; minutes that open the door to 50 bp hit TLT, gold and small caps." },
  { id: "f6", ind: "finance", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 19, 8:30 am: jobless claims (cons. 199K), Philly Fed (cons. 19.2); leading index 10:00; 10-yr TIPS auction 1:00; Jefferson, Goolsbee, Barkin and Barr speak [Nasdaq economic calendar]", tickers: "TLT · IWM",
    rec: "WATCH: another sub-200K claims print keeps a 50 bp hike in play." },
  { id: "f7", ind: "finance", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 20: monthly options expiration (Nov 20 monthlies listed on Cboe; SPY's Nov 20 series traded 1.17M contracts Tuesday) [Cboe delayed chains]", tickers: "SPY · QQQ",
    rec: "WATCH: expect pinning and heavy volume after a week of NVIDIA and IPO flows; avoid opening size into the close." },
  { id: "f8", ind: "finance", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 23: S&P Global flash PMIs 9:45 am (prior manufacturing 54.9, services 56.1); Chicago Fed national activity; 2-yr note auction 1:00 pm [Nasdaq economic calendar]", tickers: "SPY · TLT",
    rec: "WATCH: strong services data keeps the hiking path intact." },
  { id: "f9", ind: "finance", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24: Conference Board consumer confidence 10:00 (prior 91.7), Case-Shiller 9:00, Richmond Fed; 5-yr note auction 1:00 pm [Nasdaq economic calendar]", tickers: "XLY · TLT",
    rec: "WATCH: the last confidence read before Black Friday." },
  { id: "f10", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Nov 25, 8:30 am: Q3 GDP second estimate (prior 3.4%), October PCE (prior core +0.3% m/m, 3.1% y/y), income / spending, durable goods, jobless claims; new home sales 10:00; 7-yr auction 1:00; Beige Book 2:00 pm [Nasdaq economic calendar]", tickers: "TLT · GLD · IWM",
    rec: "WATCH (both ways): the last inflation read before the December FOMC. Hot → TLT, GLD and IWM down (supports the bear plays); soft → relief rally, so respect the invalidation levels." },
  { id: "f11", ind: "finance", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "Thu Nov 26: Thanksgiving, US markets closed; Fri Nov 27 early close at 1:00 pm [Nasdaq economic calendar]", tickers: "SPY",
    rec: "NOTE: holiday-thin liquidity; avoid opening short-dated positions Wednesday afternoon." },
  { id: "f12", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 close: MSCI deletes Strategy from the MSCI USA index (confirmed in its November review); ~$2.8B of index-tracking outflows estimated, more if other providers follow [crypto.news; CryptoBriefing]", tickers: "MSTR · IBIT",
    rec: "WATCH: forced selling is known and partly priced (MSTR −20% in a week); don't catch the knife before the close." },
  { id: "f13", ind: "finance", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1: ISM manufacturing 10:00 am (prior 55.5; prices 75.2), JOLTS (prior 7.52M), construction spending; Chicago PMI Mon Nov 30 9:45 (prior 55.3). The November jobs report follows Fri Dec 4 [Nasdaq economic calendar]", tickers: "SPY · TLT",
    rec: "WATCH: ISM prices near 75 keep inflation in focus before the December FOMC." },
  // ---- CONSUMER / RETAIL -------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Mon Nov 16: staples hold up. Tyson +8.72% to $63.95, XLP +0.27% to $92.60, Coca-Cola +0.23%, Walmart +0.25% to $128.41 [Yahoo]", tickers: "XLP · TSN · WMT",
    rec: "HOLD staples: the defensive rotation is intact, though XLP slipped 1.23% Tuesday." },
  { id: "c2", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 16: discretionary slips. XLY −1.53%, XRT −1.60% to $89.59, TJX −2.44% to $131.09; Take-Two −6.30% to $213.47 three days before GTA VI [Yahoo]", tickers: "XLY · XRT · TTWO",
    rec: "WATCH: off-price retail and gaming are weak into their catalysts." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 17 BMO: Home Depot Q3 adj. EPS $3.86 vs $3.84; comps +2.2% vs +1.8% est.; FY guide: comps ~1.4%, sales growth ~4.5%, adj. EPS growth ~2%; Richard McPhail named CEO. Shares −2.45% to $339.01 [Home Depot IR; CNBC; Yahoo]", tickers: "HD · LOW",
    rec: "WATCH: a beat that sold off; the read-through for Lowe's today is soft." },
  { id: "c4", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17 BMO: Disney FQ4 beat. Adj. EPS $1.77 vs $1.67, revenue $25.95B (+16%) vs $25.18B; record Experiences revenue $10.1B; dividend +33% to $2.00; $3B savings target. Shares −1.48% to $116.94 [CNBC; Deadline; Yahoo]", tickers: "DIS",
    rec: "HOLD: good news was sold in a risk-off tape; DIS is still 6.6% above its 50-day." },
  { id: "c5", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17: Nike investor day ('Full Stride Ahead'): FY27 guide reiterated, sales may fall two more years before market-level growth in FY29; 2031 EPS target $3.00–3.50. Shares −6.30% to $35.85 on ~61–67M shares, below its 50-day [Motley Fool; Yahoo]", tickers: "NKE · XLY",
    rec: "SELL rallies: the turnaround is longer than hoped. NKE options are liquid (269k contracts Tue); a bear put spread fits below $35." },
  { id: "c6", ind: "consumer", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Wed Nov 18 BMO: Target Q3 (cons. EPS $2.05; 3 up / 1 down; Nov 20 straddle ±8.0%), Lowe's ($2.86; 1 up / 3 down; ±4.5%), TJX ($1.33; 1 up / 1 down; ±5.6%) [Nasdaq; Cboe]", tickers: "TGT · LOW · TJX",
    rec: "WATCH (both ways): HD's beat-and-fade sets a high bar for Lowe's; Target's options price ~8%. Defined-risk only." },
  { id: "c7", ind: "consumer", dayIdx: 4, future: true, impact: 3, dir: "BULLISH", conf: 1, basis: "4-wk EPS revisions 2 up / 0 down (cons. $0.64) [Nasdaq estimate data]; Oct retail control +0.6% vs +0.4% cons. [Nasdaq economic calendar]",
    headline: "Thu Nov 19 BMO (EST.): Walmart Q3 FY27 (cons. EPS $0.64; company guide $0.62–0.64; 4-week revisions 2 up / 0 down); the Nov 20 straddle prices ±7.0% [Nasdaq; financecalendar; Cboe]", tickers: "WMT · XLP",
    rec: "BUY via defined risk (see the WMT play): a beat-and-raise targets the $135.16 52-week high; a miss or cautious holiday guide breaks $118." },
  { id: "c8", ind: "consumer", dayIdx: 4, future: true, impact: 1, dir: "BULLISH", conf: 1, basis: "4-wk EPS revisions 3 up / 0 down (cons. $1.85) [Nasdaq estimate data]",
    headline: "Thu Nov 19: Ross Stores FQ3 AMC (cons. EPS $1.85; 7 est.; 4-week revisions 3 up / 0 down); Williams-Sonoma ($2.17) BMO [Nasdaq]", tickers: "ROST · WSM",
    rec: "WATCH: estimates are rising into the print, but ROST is −7.7% in a week; options too thin for a play." },
  { id: "c9", ind: "consumer", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 19: Grand Theft Auto VI launches on PS5 / Xbox Series X|S; Take-Two's FY27 $8.0–8.2B net-bookings guide relies on it. TTWO −9.2% in a week; Dec 25Δ call IV 64.7% vs put 59.2% [Engadget; Notebookcheck; Cboe; Yahoo]", tickers: "TTWO · SONY",
    rec: "WATCH: call skew shows upside demand while the stock slides into launch; the signals disagree, so no lean." },
  { id: "c10", ind: "consumer", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Best Buy (cons. EPS $1.48; 1 up / 0 down), Dollar Tree ($0.88; 0 up / 1 down), Burlington ($1.67), Dick's ($1.38), J.M. Smucker ($2.50); Urban Outfitters AMC [Nasdaq earnings calendar]", tickers: "XRT · BBY · DLTR",
    rec: "WATCH: the last big retail read before Black Friday; BBY options are thin (~2k contracts)." },
  { id: "c12", ind: "consumer", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27: Black Friday session (1:00 pm early close) opens holiday shopping; Cyber Monday Nov 30 [Nasdaq economic calendar]", tickers: "XRT · AMZN · WMT",
    rec: "WATCH: early traffic and online-sales tallies set the tone for retail into December." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "GLD", name: "SPDR Gold Shares", rank: 1, spot: "$352.48 (Tue Nov 17 close, −0.13%; 20-day low; pre-mkt ~$347 ESTIMATE: post-market $346.40 [Yahoo] and spot gold −1.4% overnight to ~$3,795 [FXStreet]) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF), no dividend · FOMC minutes today Nov 18 2:00 pm (CONFIRMED) · jobless claims / Philly Fed Nov 19 · GDP 2nd est. / core PCE Nov 25 (CONFIRMED) · ISM / JOLTS Dec 1 (CONFIRMED) · December FOMC (Dec 9 per FedWatch-cited reports) with ~96–100% hike odds [FXStreet; Motley Fool]",
    iv: "IV 24.2% (Dec 18 ATM) vs 20-day realized 28.1% · IVR n/a · 25Δ put skew +1.2 pts (flat) · Dec 18 straddle ±5.7% · 1σ to expiry ±$24.07 (from ~$347)", liq: "A — 337k contracts traded Tue (full session), 20d avg 9.6M shares; OI 2,974 / 8,060 on 375C/385C, 3,394 / 1,861 on 345P/325P, 3,931 / 1,105 on 335P/315P; legs $0.09–0.20 wide (3.2–9.2% of mid) [Cboe delayed chain]",
    thesis: "Gold's downtrend accelerated overnight: spot broke $3,800 (−1.4% to ~$3,795, the lowest since Sep 2025) as markets price a near-certain December hike, the dollar index sits at a 19-month high (103.71) and the 10-year yields 5.10%. GLD closed at a 20-day low ($352.48), 7.0% under its 50-day ($378.88) and 13.5% under its 200-day ($407.58), −7.2% in a month, RSI 36.3; IV (24.2%) is below realized (28.1%) with flat skew, so puts are cheap. Risk: ~31% off its $509.70 52-week high and gold futures RSI ~31, so dovish minutes or a soft PCE (Nov 25) could trigger a sharp short-covering bounce. Invalid above $366 (a close back above the November breakdown zone). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $375C / buy $385C · Dec 18 '26 · credit $0.94 (ESTIMATE at ~$347; Tue-close mids 3.125 − 1.685 = $1.44) · capital ~$906 · max profit ~$94 · BE $375.94 · R:R 1:0.10 · POP ~85% · exit +50% (buy back ~$0.47) / stop on a close above $366; close by Dec 11 — short strike 1.16σ above ~$347 and below the 50-day ($378.88); pays if a bounce fails" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $345P / sell $325P · Dec 18 '26 · debit $5.70 (ESTIMATE at ~$347; Tue-close mids 6.200 − 1.815 = $4.39) · capital ~$570 · max profit ~$1,430 · BE $339.30 · R:R 1:2.51 · POP ~39% · exit +75–100% (~$9.97–$11.40) / stop −50% (~$2.85) or a close above $366 — near-the-money long (Δ ≈ −0.44 at ~$347), short near the 1σ low ($322.93)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $335P / sell $315P · Dec 18 '26 · debit $3.31 (ESTIMATE; Tue-close mids 3.400 − 0.975 = $2.43) · capital ~$331 · max profit ~$1,669 · BE $331.69 · R:R 1:5.04 · POP ~27% · exit +100% (~$6.62) / stop −50% (~$1.66) or a close above $366 — cheap OTM spread for a continuation through the 1σ low" },
    ] },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", rank: 2, spot: "$269.05 (Tue Nov 17 close, −1.43%; 20-day closing low; post-market ~$269.0–270.0, <1%, so Tue-close premiums kept; ES futures +0.23% at ~1:45 ET) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF); next distribution date n/a in retrieved sources (short calls are OTM) · FOMC minutes Nov 18 (CONFIRMED) · claims / Philly Fed Nov 19 · flash PMIs Nov 23 · GDP / core PCE Nov 25 (CONFIRMED) · ISM / JOLTS Dec 1 · December FOMC with ~96–100% hike odds [FXStreet; Motley Fool]",
    iv: "IV 23.2% (Dec 18 ATM) vs 20-day realized 25.7% · IVR n/a · 25Δ put skew +7.1 pts · Dec 18 straddle ±5.5% · 1σ to expiry ±$17.90", liq: "A — 2.39M contracts traded Tue (full session), 20d avg 23.8M shares; OI 9,523 / 6,467 on 287C/292C, 107,948 / 84,578 on 270P/250P, 135,378 / 75,805 on 260P/245P; legs $0.02–0.27 wide (2.0–5.0% of mid) [Cboe delayed chain]",
    thesis: "Small caps are the cleanest expression of the rate shock: the Russell 2000 fell 1.70% Monday and 1.50% Tuesday to 2,701.87 (−4.2% in a week), and IWM ($269.05) closed at a 20-day low, 3.8% under its 50-day ($279.79) and 3.7% under its 200-day ($279.51), RSI 39.2, with the 2-year at 4.80%, the 10-year at 5.10% and a December hike all but fully priced. VIX (25.46) sits above VIX3M (24.98), an inverted term structure, NYSE decliners ran ~4:1 Tuesday, and IV (23.2%) is below realized (25.7%). Risk: the NVIDIA beat (futures firmer overnight) or a soft PCE on Nov 25 could spark a broad relief rally back to the 50/200-day cluster near $280. Invalid above $280 (a close over both averages). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $287C / buy $292C (mids 0.995 − 0.470) · Dec 18 '26 · credit $0.53 · capital ~$447 · max profit ~$53 · BE $287.53 · R:R 1:0.12 · POP ~86% · exit +50% (~$0.27) / stop on a close above $280; close by Dec 11 — short strike at 1.0σ ($286.95), above the 50/200-day cluster" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $270P / sell $250P (mids 7.955 − 2.445) · Dec 18 '26 · debit $5.51 · capital ~$551 · max profit ~$1,449 · BE $264.49 · R:R 1:2.63 · POP ~41% · exit +75–100% (~$9.64–$11.02) / stop −50% (~$2.75) or a close above $280 — at-the-money long (Δ −0.52), short near the 1σ low ($251.15)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $260P / sell $245P (mids 4.365 − 1.840) · Dec 18 '26 · debit $2.53 · capital ~$253 · max profit ~$1,247 · BE $257.47 · R:R 1:4.93 · POP ~26% · exit +100% (~$5.06) / stop −50% (~$1.26) or a close above $280 — OTM long (Δ −0.32) for a continuation through the 1σ low" },
    ] },
  { ticker: "IBIT", name: "iShares Bitcoin Trust ETF", rank: 3, spot: "$36.14 (Tue Nov 17 close, −1.77%; pre-mkt ~$36.55 ESTIMATE: post-market $36.53 [Yahoo] / $36.64 [Cboe]; Bitcoin ~$64.2–64.6k) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF), no dividend · spot Bitcoin ETFs −$239.9M Tue (IBIT −$209.5M), −$1.0B over Nov 11–17 [CoinOtag] · MSCI deletes Strategy from MSCI USA at the Nov 30 close, est. ~$2.8B index outflow [crypto.news; CryptoBriefing] · FOMC minutes Nov 18 · PCE Nov 25",
    iv: "IV 45.1% (Dec 18 ATM), 43.9% (Jan 15) vs 20-day realized 42.1% · IVR n/a · 25Δ put skew +7.8 pts · Dec 18 straddle ±10.6% · 1σ ±$4.73 to Dec 18 / ±$6.40 to Jan 15 (from ~$36.55)", liq: "A — 699k contracts traded Tue (full session), 20d avg 45.7M shares; OI 16,410 / 22,558 on Jan 37P/31P, 18,308 / 20,072 on Dec 37P/32P, 8,496 / 7,029 on Dec 34P/31P; legs $0.03–0.07 wide (1.8–8.2% of mid) [Cboe delayed chain]",
    thesis: "Bitcoin's bear trend is intact: IBIT is 19.9% under its 50-day ($45.14) and 11.8% under its 200-day ($40.96), −21.9% in a month and −13.3% in a week, and Bitcoin's weekly close (~$65.4k) is below its ~$68k 200-week average (Wintermute). Flows keep leaking (IBIT −$209.5M Tuesday) and MSCI's Nov 30 deletion of Strategy forces an estimated ~$2.8B of index selling. Risk: RSI 22.4 is deeply oversold, IBIT firmed ~1% after hours, and a weekend flush already hit ~$62k, so a violent short-covering rally is likely along the way; IV ≈ realized, so these are spreads. Invalid above $41 (a close over the 200-day). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (wide, longer-dated)", text: "Buy $37P / sell $31P · Jan 15 '27 · debit $1.88 (ESTIMATE at ~$36.55; Tue-close mids 2.850 − 0.855 = $2.00) · capital ~$188 · max profit ~$412 · BE $35.12 · R:R 1:2.19 · POP ~44% · exit +75% (~$3.29) / stop −50% (~$0.94) or a close above $41 — 58 days of runway to survive a relief bounce; short strike near the Jan 1σ low ($30.15)" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $37P / sell $32P · Dec 18 '26 · debit $1.53 (ESTIMATE; Tue-close mids 2.270 − 0.610 = $1.66) · capital ~$153 · max profit ~$347 · BE $35.47 · R:R 1:2.27 · POP ~43% · exit +75–100% (~$2.68–$3.06) / stop −50% (~$0.77) or a close above $41 — near-the-money long (Δ ≈ −0.50), short near the 1σ low ($31.82)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $34P / sell $31P · Dec 18 '26 · debit $0.51 (ESTIMATE; Tue-close mids 1.045 − 0.475 = $0.57) · capital ~$51 · max profit ~$249 · BE $33.49 · R:R 1:4.88 · POP ~27% · exit +100% (~$1.02) / stop −50% (~$0.26) or a close above $41 — pays ~4.9:1 if Bitcoin loses the ~$62k weekend low" },
    ] },
  { ticker: "WMT", name: "Walmart", rank: 4, spot: "$127.52 (Tue Nov 17 close, −0.69%; post-market $126.75–127.00, <1%, so Tue-close premiums kept) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bullish",
    catalyst: "Q3 FY27 earnings Thu Nov 19 BMO (EST. — Nasdaq calendar; company confirmation not retrieved) · cons. EPS $0.64 (12 est.; 2 up / 0 down in 4 wks; company guide $0.62–0.64) / rev n/a · Oct retail control +0.6% vs +0.4% · TGT / LOW / TJX report today · ex-dividend Dec 11 ($0.2475, Nasdaq) — inside the expiry",
    iv: "IV 35.7% (Dec 18 ATM; event-inflated) vs 20-day realized 25.5% · IVR n/a · implied move ±7.0% (Nov 20 straddle $8.85) vs hist. n/a (not re-verified this run) · 1σ to expiry ±$13.05", liq: "A — 82k contracts traded Tue (full session), 20d avg 21.8M shares; OI 11,681 / 8,426 on 120C/130C, 8,313 / 9,737 on 125C/135C; legs $0.16–0.65 wide (5.0–9.7% of mid) [Cboe delayed chain]",
    thesis: "Defensive leadership into a dated catalyst: WMT ($127.52) is 10.5% above its 50-day ($115.39) and 7.2% above its 200-day ($119.00), +7.4% in a month while the S&P 500 fell 4.6%, and Q3 EPS estimates went 2 up / 0 down in four weeks; Tuesday's October control-group retail sales (+0.6% vs +0.4%) support the consumer read. Debit spreads cap vega, since IV (35.7%) is ~10 points over realized into the print. Risk: bullish picks have failed in this tape (UNH, AAPL, AMZN in the last 3 reports), staples slipped Tuesday (XLP −1.23%), HD's beat was sold, and RSI 65 sets a high bar. Invalid below $118 (the low end of the ±7% implied move). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread (ITM)", text: "Buy $120C / sell $130C (mids 10.000 − 4.225) · Dec 18 '26 · debit $5.78 · capital ~$578 · max profit ~$422 · BE $125.78 · R:R 1:0.73 · POP ~53% · exit at ~80% of max value (~$8.00) / stop −50% (~$2.89) or a close below $118; close before Dec 10 if the short $130C is ITM (Dec 11 ex-div) — breakeven below spot, so it pays on a flat-to-higher post-print close" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $125C / sell $135C (mids 6.725 − 2.420) · Dec 18 '26 · debit $4.30 · capital ~$430 · max profit ~$570 · BE $129.30 · R:R 1:1.33 · POP ~43% · exit +75% (~$7.52) / stop −50% (~$2.15) or a close below $118; close before Dec 10 if the short call is ITM — long Δ 0.60, short inside the 1σ high ($140.57)" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $130C / sell $135C (mids 4.225 − 2.420) · Dec 18 '26 · debit $1.80 · capital ~$180 · max profit ~$320 · BE $131.80 · R:R 1:1.78 · POP ~35% · exit +100% (~$3.60) / stop −50% (~$0.90) or a close below $118; close before Dec 10 if the short call is ITM — a cheap bet on a beat-and-raise breakout above the $129.17 20-day high" },
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Wednesday, Nov 18 2026 · pre-market (~2 am ET; no pre-market quotes yet — post-market prints and futures used: ES +0.23%, NQ +0.56%) · stock quotes = Tue Nov 17 close (Yahoo / Cboe) · option chains, OI &amp; volume = Cboe delayed chain after the Tue Nov 17 session · GLD &amp; IBIT premiums re-estimated (ESTIMATE) · today's events (TGT, LOW, TJX, FOMC minutes, PANW) not yet reported</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Nov 18)
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
