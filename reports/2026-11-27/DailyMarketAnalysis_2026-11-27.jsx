import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, November 27, 2026 — trading day (half-day session, NYSE closes 1:00 pm ET; Thursday Nov 26 was Thanksgiving). Pre-market ~4:12 am ET.
 * Data as of the Wed Nov 25 close: stock quotes = Nasdaq last trade / historical data, cross-checked with the Yahoo Finance chart; option quotes, OI & volume = Nasdaq option chain (Nov 25 session); IV and delta computed from quote mids (Black-Scholes).
 * Pre-market (Nasdaq, ~4:12 am ET): QQQ +2.82%, NVDA +4.69%, AAPL +1.02%, UNH +1.03%, WMT −0.41%. Where spot moved more than 1%, premiums are re-priced at the pre-market spot with each strike's Wednesday IV and labelled ESTIMATE.
 * Window: last 3 days (Nov 24) → coming 2 weeks (Dec 11).
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
  energy:   { label: "Energy / Commodities / Machinery", color: "#f59e0b" },
  health:   { label: "Healthcare / Pharma / Biotech", color: "#10b981" },
  finance:  { label: "Financials / Rates / Crypto",   color: "#a855f7" },
  consumer: { label: "Consumer / Retail",             color: "#ef4444" },
};

const DIR = {
  BULLISH: { glyph: "↑", label: "Bullish" },
  BEARISH: { glyph: "↓", label: "Bearish" },
  MIXED:   { glyph: "↔", label: "Mixed / uncertain" },
};

// 18-day axis: Nov 24 .. Dec 11 (last 3 days → coming 2 weeks). Today = index 3 (Nov 27).
const DAYS = [
  { idx: 0, date: "Nov 24", dow: "Tue" },
  { idx: 1, date: "Nov 25", dow: "Wed" },
  { idx: 2, date: "Nov 26", dow: "Thu" },
  { idx: 3, date: "Nov 27", dow: "Fri" }, // TODAY
  { idx: 4, date: "Nov 28", dow: "Sat" },
  { idx: 5, date: "Nov 29", dow: "Sun" },
  { idx: 6, date: "Nov 30", dow: "Mon" },
  { idx: 7, date: "Dec 1", dow: "Tue" },
  { idx: 8, date: "Dec 2", dow: "Wed" },
  { idx: 9, date: "Dec 3", dow: "Thu" },
  { idx: 10, date: "Dec 4", dow: "Fri" },
  { idx: 11, date: "Dec 5", dow: "Sat" },
  { idx: 12, date: "Dec 6", dow: "Sun" },
  { idx: 13, date: "Dec 7", dow: "Mon" },
  { idx: 14, date: "Dec 8", dow: "Tue" },
  { idx: 15, date: "Dec 9", dow: "Wed" },
  { idx: 16, date: "Dec 10", dow: "Thu" },
  { idx: 17, date: "Dec 11", dow: "Fri" },
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
const LEAN_RECORD = { hits: 3, misses: 3, since: "2026-11-16" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SOFTWARE / SEMIS ----
  { id: "t1", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Wed Nov 25: AI rout and reversal. Nasdaq Composite as much as −4.6% intraday, closes −0.6% at 23,585.80; Nasdaq-100 briefly −20% from its October record, ends −0.64% at 26,046.90; QQQ low $607.74, close $633.93; SMH −1.0% to $422.46. Drivers: S&P's CreditWatch on Nvidia, record AI-debt CDS, a hot core PCE and the Section 301 tariff proposals [Saxo; Investing.com; Nasdaq historical data]", tickers: "QQQ · SMH · NVDA",
    rec: "HOLD hedges, do not add at the open: QQQ is still 10% below its 50-day ($707) at Wednesday's close, and it is retesting Monday's $651–658 zone pre-market. See the re-struck QQQ put spreads; a close above $660 ends the bear case." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Wed Nov 25: S&P Global puts Nvidia's AA rating on CreditWatch Negative (a one-notch cut is possible; the watch can run up to 90 days). NVDA −3.9% to $149.30 (low $141.17), −31.5% in a month; no Moody's or Fitch follow-up found [Mitrade/BeInCrypto; Concept Trader; Nasdaq historical data]", tickers: "NVDA",
    rec: "SELL rallies: governance now has a credit cost and Huang testifies Dec 1–3. The NVDA bear put spreads in Top Option Plays express it; a close above $166 (Monday's $165.05 squeeze close) ends the bear case." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Nov 24–25: AI-debt stress. Five-year CDS at records: CoreWeave 1,314 bp (another source: 1,145 bp), Oracle 356 bp, SoftBank 501 bp; CoreWeave's 9.75% 2031 bond yields above 17%. ORCL −5.1% to $103.88, MU −4.5% to $601.25, CRWV $42.57 on Wednesday [Esscher citing S&P Global/Bloomberg; Coinotag; Nasdaq historical data]", tickers: "ORCL · CRWV · MU",
    rec: "AVOID levered AI names: credit is leading equity. Oracle's report date is still unconfirmed (Nasdaq and Earnings Whispers now show Dec 14)." },
  { id: "t5", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 24: Monday's chip squeeze fails in one session. NVDA −5.9% to $155.38, AMD −8.9% to $413.27, MU −11.0%, Dell −11.8%, HPE −16.3%, ADI −17.4%; SMH −7.3% to $426.75 [Nasdaq historical data]", tickers: "SMH · AMD · HPE",
    rec: "AVOID new semis longs until SMH reclaims $460 (Monday's close); it is 22% below its 50-day ($541)." },
  { id: "t6", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Thu Nov 26 (US closed): global tech rebounds. Stoxx 600 +1.83% to 637.50, ASML +3.2%, Infineon +3.6%; Taiex +2.5%, Kospi +0.29% to 4,711.21, SK Hynix +2.2%. Reuters: the Section 301 proposals were 'less damaging than feared'. Bank of England's stability report calls AI funding 'complex, circular and opaque' (hyperscaler exposure just over $4T) [MLQ citing CNBC/Reuters; Korea Times]", tickers: "SMH · ASML · QQQ",
    rec: "WATCH: a relief bounce after a −12% month for European tech; it sets up Friday's US gap higher rather than confirming a trend change." },
  { id: "t7", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Thu Nov 26: CNBC (via Korea Daily) reports chip sellers now apply 'zero tolerance' to neo-cloud buyers that lease any compute to Chinese firms, replacing Nvidia's earlier 50%-of-capacity threshold; some GPUs meant for overseas data centers are unsold. No US reaction yet (market closed) [Korea Daily]", tickers: "NVDA · CRWV",
    rec: "WATCH: a demand headwind for NVDA's neo-cloud channel that the first US session has not priced; supports the bearish NVDA play." },
  { id: "t8", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "TODAY Fri Nov 27 (NYSE closes 1:00 pm ET): a gap higher. Pre-market at ~4:12 am ET: QQQ $651.83 (+2.8%), SPY $731.00 (+2.0%), SMH +5.0%, NVDA +4.7%, MRVL +8.5%, AMZN +3.2%; Nasdaq-100 futures 26,826.75 vs 26,100.25 Wednesday; Kospi +3.5% (Samsung +3.9%, SK Hynix +4.1%), Nikkei +1.2% intraday on Korean policy-support hopes [Nasdaq pre-market quotes; Yahoo Finance chart NQ=F; AJU Press; Edge Consultancy]", tickers: "QQQ · SPY · SMH",
    rec: "WATCH: do not chase a holiday half-day gap. QQQ at ~$652 meets Monday's close ($651.03) and high ($657.53); bearish structures get a better entry, and a close above $660 invalidates them." },
  { id: "t9", ind: "tech", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 – Fri Dec 4: AWS re:Invent, Las Vegas (CONFIRMED; CEO Matt Garman keynote Tue Dec 1, 8:30 am PT). Nvidia GTC Washington DC Nov 30 – Dec 3 (CONFIRMED on nvidia.com; Dec 1 keynote at 2 pm ET, with Ian Buck filling Huang's slot per CNBC). Rubrik FQ3 Mon Nov 30 AMC (EST.; cons. EPS −$0.38; Dec 4 straddle ±14.4%) [AWS; nvidia.com; CNBC; Nasdaq calendar & option chain]", tickers: "AMZN · NVDA · RBRK",
    rec: "WATCH: AMZN closed under its 200-day ($245.78); AI revenue disclosures are the upside branch, a keynote without Huang the downside one for NVDA." },
  { id: "t10", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Tue Dec 1 – Thu Dec 3: Jensen Huang's closed-door transcribed interview with three House committees (Dec 1; per CNBC/Engadget), Nvidia's general counsel before House panels (Dec 2; press), and the Senate Banking hearing 'Protecting America's AI Advantage: Oversight of U.S. Export Controls', Dec 3 10:00 am (CONFIRMED on banking.senate.gov; Huang as sole witness per The Hill/CNBC). NVDA also goes ex-dividend Dec 2 ($0.25) [banking.senate.gov; CNBC; The Hill; Nasdaq dividend history]", tickers: "NVDA",
    rec: "WATCH: three days of headline risk both ways while S&P's CreditWatch runs. No sourced lean; the put spreads in Top Option Plays are sized for it." },
  { id: "t11", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "BEARISH", conf: 1, basis: "Consensus revised down over the last 4 weeks: quarter 0 up / 1 down, fiscal year 0 up / 3 down [Nasdaq earnings-forecast, Nov 27]; 10%-OTM put/call price ratio 0.99, no offset [Nasdaq option chain, Nov 25 close]",
    headline: "Tue Dec 1 AMC: Marvell FQ3 (CONFIRMED by IR, call 1:30 pm PT; cons. EPS $0.79; Dec 4 straddle ±15.8%); also Okta ($0.43; ±16.2%), MongoDB ($0.08; ±17.5%), Credo ($1.03), NetApp ($2.14), GitLab (all EST., calendar-sourced). UBS Global Technology and AI Conference the same day (AMD, TI present) [Marvell IR; Nasdaq calendar, estimates & option chain; company IR listings]", tickers: "MRVL · OKTA · MDB",
    rec: "WATCH: leans bearish on falling estimates; MRVL was −46% in a month at Wednesday's close and is +8.5% pre-market today, so a merely stable guide could squeeze it. A bear put spread fits only below ~$118 (Wednesday's low)." },
  { id: "t12", ind: "tech", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Dec 2 AMC: Salesforce FQ3 (CONFIRMED by IR, call 5 pm ET; cons. EPS $2.41; Dec 4 straddle ±11.6%; revisions 0 up / 0 down; 10%-OTM put/call 1.00) and Snowflake (CONFIRMED, call 2 pm PT; −$0.32; ±15.3%; 0/0; 0.94) [Salesforce IR; Snowflake release; Nasdaq estimates & option chain]", tickers: "CRM · SNOW",
    rec: "WATCH: no signal either way. CRM closed at $197.21, on its 200-day ($197.75): a stable FY guide squeezes it, a cut extends the de-rating." },
  { id: "t13", ind: "tech", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 8: Synopsys FQ4 AMC (CONFIRMED, call 5 pm ET; cons. EPS $3.09; Dec 11 straddle ±11.4%); Microsoft annual shareholders meeting 8:30 am PT (CONFIRMED); SpaceX 180-day lockup expiry, up to ~797.6M shares (EST., third-party trackers) [Synopsys release; microsoft.com; Yahoo/Motley Fool; Nasdaq option chain]", tickers: "SNPS · MSFT · SPCX",
    rec: "WATCH: lockup supply is a known overhang for SPCX; Synopsys revisions are flat (0/0), so no lean." },
  { id: "t14", ind: "tech", dayIdx: 15, future: true, impact: 3, dir: "BEARISH", conf: 1, basis: "Fiscal-year EPS consensus revised 0 up / 1 down over 4 weeks, quarter 0/0 [Nasdaq earnings-forecast, Nov 27]; 10%-OTM put/call price ratio 0.94, near neutral, no offset [Nasdaq option chain, Nov 25 close]",
    headline: "Wed Dec 9 AMC: Broadcom FQ4 (CONFIRMED by IR, call 5 pm ET; cons. EPS $3.45; revenue guide ~$34.8B; Dec 11 straddle ±14.4%) and Adobe FQ4 (CONFIRMED on Adobe's IR page, 2:00 pm PT; $5.11; ±10.9%; revisions 0/0). Barclays Global Technology Conference the same day [Broadcom IR; adobe.com; Nasdaq estimates & option chain; AMD IR]", tickers: "AVGO · ADBE",
    rec: "WATCH: leans bearish on a trimmed full-year estimate only; AVGO is −15% in a week, so an AI guide above consensus is the squeeze branch." },
  { id: "t15", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Dec 10 BMO: Ciena FQ4 (EST., calendar-sourced; cons. EPS $1.77; Dec 11 straddle ±20.1%). Oracle FQ2 is now shown for Mon Dec 14 AMC by Nasdaq, Earnings Whispers, TipRanks and MarketBeat (EST.; no company release), outside this window [Nasdaq calendar & option chain; Earnings Whispers]", tickers: "CIEN · ORCL",
    rec: "WATCH: Ciena is the optical read on AI capex; confirm Oracle's date before trading it." },
  { id: "t16", ind: "tech", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Dec 11 after the close: Nasdaq-100 annual reconstitution announcement (EST. from a 24/7 Wall St preview: reference date Nov 30, effective Mon Dec 21; no Nasdaq notice found). December quad witching is Fri Dec 18 (EST., third Friday) [24/7 Wall St]", tickers: "QQQ",
    rec: "WATCH: index adds and deletes move single names, not QQQ itself; Dec 18 expiries will see pinning into the rebalance." },
  // ---- ENERGY / COMMODITIES / MACHINERY ----
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Wed Nov 25: crude rallies. Brent January settles $94.61 (+3.5%), WTI $83.68; USO +3.3% to $139.89, XLE +0.7% to $60.90. US crude inventories rose for a third week [Concept Trader; Saxo; Yahoo Finance chart CL=F; Nasdaq historical data]", tickers: "USO · XLE · XOM",
    rec: "HOLD: a risk-premium bounce inside a downtrend (Brent is still nearly −20% for November); no energy play until OPEC+ on Sunday." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Thu Nov 26: Brent settles $96.57 (+$1.96), its highest settlement since Nov 6. A Houthi strike on Aramco's ~400k b/d Jazan refinery killed one worker and halted some operations; Saudi Arabia intercepted four drones aimed at Ras Tanura; a drone attack in Kuwait killed two; UKMTO reported a tanker hit in Hormuz [Investing.com; Concept Trader; Esscher]", tickers: "USO · XLE · XOM",
    rec: "WATCH: supply-risk headlines are driving crude, with OPEC+ two days away; XOM ($158.08) is still 6% below its 50-day." },
  { id: "e3", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Wed Nov 25: gold breaks $3,500 intraday (low ~$3,427) on the hot core PCE, then closes near $3,588–3,600; GLD low $313.96, close $327.45 (+0.6%), SLV +0.7% to $37.10. Gold is down more than 7% in November; copper about −17% [Saxo; Concept Trader; Nasdaq historical data]", tickers: "GLD · SLV · GDX",
    rec: "HOLD: a second failed breakdown below $3,500. Yesterday's bearish GLD play is closed, not carried (see today's gold item)." },
  { id: "e4", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "TODAY Fri Nov 27: metals and crude extend. Gold futures $3,676.70 at ~1:40 am ET vs a $3,535.80 Wednesday settlement (spot quotes conflict: ~$3,565 to ~$3,650); GLD $337.38 pre-market (+3.0%); WTI $85.96 (+2.7% vs Wednesday; no Thursday settlement) [Yahoo Finance chart GC=F / CL=F; Nasdaq pre-market quotes; TraderFactor; Investing.com]", tickers: "GLD · USO",
    rec: "WATCH: GLD is above $336, the level that invalidates yesterday's bearish GLD play, so it is closed; no new gold position until the FOMC on Dec 9." },
  { id: "e6", ind: "energy", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Sun Nov 29: OPEC+ ministerial meeting (CONFIRMED date on opec.org; start time and format not announced, reports conflict between online and Vienna). 2027 baselines and quotas are due; the current framework and a ~2 mb/d cut layer lapse Dec 31 and the capacity audit is late. Two delegates say a one-month rollover into January is being weighed (unconfirmed) [opec.org; Admiral Markets; House of Saud; Rio Times]", tickers: "USO · XLE · XOM",
    rec: "WATCH (both ways): a short rollover defers the fight and keeps the Gulf risk premium in charge; higher quotas or a baseline dispute hit crude on Monday. Avoid new energy size into the weekend." },
  { id: "e8", ind: "energy", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "Tue Dec 8: EIA Short-Term Energy Outlook (CONFIRMED); IEA Oil Market Report Fri Dec 11 (CONFIRMED on iea.org; the IEA sees a 3.8 mb/d surplus in 2027) [eia.gov; iea.org; House of Saud]", tickers: "USO · XLE",
    rec: "WATCH: surplus estimates are the read-through for OPEC+'s 2027 path." },
  // ---- HEALTHCARE / PHARMA / BIOTECH ----
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Tue Nov 24: Sanofi to buy Insmed for $175/sh cash (~$41.0B, ~46% premium to the Nov 18 close; closing expected 1H27); INSM +14.1% to $170.15. Money rotates out of chips: XBI +6.6% to $156.82, XLV +3.0% to $184.72 [TradingView/PR Newswire; Nasdaq historical data]", tickers: "INSM · XBI · XLV",
    rec: "BUY dips in leaders: XLV is above its 50-day ($177) and +2.5% in a month vs SPY −6.9%. XLV's chain (~25k contracts on Wednesday, wide quotes) is too thin for a play." },
  { id: "h2", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Nov 23–24: three FDA approvals. Cogent's Ekitna (bezuclastinib) for GIST on Nov 24 (COGT +17.4% Tue, +9.3% Wed to $36.08); BridgeBio's Welgemda on Nov 23 with a priority review voucher (BBIO +8.5% Tue to $85.87); AbbVie's Rinvoq for vitiligo [STAT; TradingView/PR Newswire; Nasdaq historical data]", tickers: "COGT · BBIO · ABBV",
    rec: "HOLD winners: approvals plus M&A are why biotech leads; do not chase two-day moves of 25%+." },
  { id: "h3", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Wed Nov 25: health pauses, managed care bounces. XLV −0.6% to $183.68; UNH +1.3% to $346.19 (third up day) but still −15.6% in a month, 10% below its 50-day ($386.49) and 6% under its 200-day ($369.53). CMS posted 2028 negotiated prices for 13 drugs (est. $9.2B saving; date Nov 23–25) [Nasdaq historical data; TradingView/PR Newswire]", tickers: "UNH · XLV · HUM",
    rec: "SELL rallies in UNH: a three-day bounce into broken averages; see the UNH bear put spreads. A close above $356 ends the bear case." },
  { id: "h4", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30: FDA target date for Vertex's povetacicept in IgA nephropathy (date CONFIRMED by Vertex's June 1 release). A Nov 25 report of an extension of up to three months could not be confirmed this run; VRTX closed flat at $564.12 on Wednesday [Vertex IR; Nasdaq historical data]", tickers: "VRTX · VERA",
    rec: "WATCH: a single-outcome binary with an unresolved date; no lean. Wait for the company's statement." },
  { id: "h5", ind: "health", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Dec 7: Lilly Innovation Day, 9 am–1 pm ET (CONFIRMED on investor.lilly.com); ASH late-breaking abstracts post at 9:00 am ET (CONFIRMED). LLY closed $1,392.22, +8.6% in a month and above both averages [investor.lilly.com; hematology.org; Nasdaq historical data]", tickers: "LLY",
    rec: "WATCH: pipeline and capital-return detail is the upside branch; no sourced lean." },
  { id: "h6", ind: "health", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 8 – Fri Dec 11: San Antonio Breast Cancer Symposium (CONFIRMED; press conferences Dec 9–11). ASH's six late-breaking abstracts publish Dec 11 ahead of the Dec 12–15 meeting; Veeva reports Thu Dec 3 AMC (EST.; cons. EPS $1.68; revisions 0/0) [aacr.org; hematology.org; Nasdaq calendar & estimates]", tickers: "XBI · VEEV",
    rec: "WATCH: conference readouts are stock-specific; XBI ($156.60) is the liquid way to hold the theme, but its options are thin." },
  // ---- FINANCIALS / RATES / CRYPTO ----
  { id: "f1", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Wed Nov 25, 8:30 ET: October core PCE 3.3% y/y (cons. 3.2%), headline 3.8%; Q3 GDP revised to 4.3%; claims 189K; durable goods +0.2% (cons. +0.7%). Bonds rally anyway: 10-yr 4.85%, 2-yr 4.64%, 2s10s +21 bp, TLT +0.9% to $82.24; the $44B 7-yr stops at 4.708%, a ~1 bp tail (bid-to-cover 2.43) [Saxo; Concept Trader; Yahoo Finance chart ^TNX; Nasdaq historical data]", tickers: "TLT · SPY · IWM",
    rec: "TAKE PROFITS on TLT calls: Wednesday's rally was the high-water mark so far; TLT is −0.7% pre-market (see today's item)." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "MIXED",
    headline: "Wed Nov 25 close: S&P 500 −0.25% to 7,182.78 (−3.2% intraday), Dow +0.3% to 50,182.95, Russell 2000 +0.71% to 2,704.06; VIX 28.29 above VIX3M 26.29. USTR's Section 301 proposals: China 20% (alt. 40%), EU 15%, Japan 15%, Vietnam 35%, India 25%; comments due Jan 5, implementation expected Feb/March [Yahoo Finance chart; Saxo; Concept Trader]", tickers: "SPY · IWM · DIA",
    rec: "HOLD hedges: SPY ($716.70) is below its 50-day ($757.89) and 200-day ($733.17) with an inverted VIX curve. Regime: risk-off, improving." },
  { id: "f4", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Nov 25–27: Bitcoin low ~$57.3K on Wednesday, ~$60.5–61.7K since. Spot-BTC ETFs −$453.1M on Nov 25, a seventh straight outflow, and a record −$5.39B in November; Strategy +3.1% to $79.96, Coinbase +1.3% on Wednesday. About $7B of Deribit bitcoin options expire today [CoinDesk; The Block; BigGo; Nasdaq historical data]", tickers: "IBIT · MSTR · COIN",
    rec: "WATCH: outflows have not stopped; no crypto play. $53,250 is the level 21Shares flags." },
  { id: "f5", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "TODAY Fri Nov 27: half-day session. Advance goods trade balance and inventories 8:30 ET (CONFIRMED by census.gov; forecast −$135.9B). 30-yr Treasury futures 107.25 vs 108.625 Wednesday (−1.3%) at ~1:40 am ET and TLT $81.63 pre-market (−0.7%); dollar index 103.72, near its highest since March 2025; USD/JPY ~159. FOMC blackout starts Sat Nov 28 [census.gov; Yahoo Finance chart ZB=F / DX-Y.NYB; Nasdaq pre-market quotes; Concept Trader; Saxo]", tickers: "TLT · SPY",
    rec: "TRIM: the equity rebound is unwinding Wednesday's bond bid, so yesterday's bullish TLT play is closed rather than carried. Thin holiday liquidity exaggerates moves." },
  { id: "f6", ind: "finance", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1, 10:00 ET: October JOLTS (CONFIRMED by BLS; prior 7.523M), ISM manufacturing (EST.; cons. 55.2, prior 55.5) and construction spending (CONFIRMED); Fed Vice Chair Bowman testifies to House Financial Services at 10:00 (CONFIRMED) [bls.gov; Investing.com; census.gov; federalreserve.gov]", tickers: "TLT · XLI · SPY",
    rec: "WATCH: a high prices-paid reading hurts TLT; a weak headline supports it. No published signal either way." },
  { id: "f7", ind: "finance", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Dec 2: ADP November, 8:15 ET (EST.; prior 86K, no forecast yet); Scotiabank reports (CONFIRMED by company), Bank of Montreal (EST.) [Investing.com; company release; Earnings Whispers]", tickers: "TLT · BNS · BMO",
    rec: "WATCH: a weak ADP sets up a soft payrolls print on Friday." },
  { id: "f8", ind: "finance", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Dec 3: ISM services 10:00 (EST.; cons. 54.5, prior 54.5), jobless claims 8:30, factory orders 10:00 (CONFIRMED); Royal Bank and TD report (CONFIRMED by the companies), CIBC (EST.); Treasury announces 3-, 10- and 30-yr auction sizes [Investing.com; census.gov; company releases; Treasury tentative schedule]", tickers: "SPY · XLF · TD",
    rec: "WATCH: services prices keep the hike path open into 2027; no lean." },
  { id: "f9", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Fri Dec 4, 8:30 ET: November jobs report (CONFIRMED by BLS). Forecasts +90K (Investing.com) and +80K (Wells Fargo) vs +165K prior; unemployment 4.1%. UMich preliminary 10:00 (EST.; forecast 51.8, prior 51.5). S&P quarterly rebalance announcement after the close (EST. by pattern; effective Dec 21). President Trump at TSMC's Arizona groundbreaking (EST.; AP) [bls.gov; Investing.com; Wells Fargo; AP via PBS]", tickers: "TLT · SPY · IWM",
    rec: "WATCH (both ways): a miss supports bonds and eases January-hike odds; a beat above +165K does the opposite. Consensus already expects a sharp slowdown, so no lean." },
  { id: "f10", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Dec 7 – Tue Dec 8: 3-yr note auction Dec 7 and 10-yr reopening Dec 8 (CONFIRMED, Treasury tentative schedule); October trade balance and Q3 productivity Dec 8, 8:30 (CONFIRMED); FOMC day one. Broadridge Investor Day, 8:30 am ET (CONFIRMED), and Nu Holdings' first Investor Day (CONFIRMED by 6-K) [Treasury; bea.gov; bls.gov; PR Newswire; SEC]", tickers: "TLT · BR · NU",
    rec: "WATCH: supply the day before a hike is a test for the long end; a 10-yr tail would pressure TLT." },
  { id: "f11", ind: "finance", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Dec 9, 2:00 pm ET: FOMC decision and projections, press conference 2:30 (CONFIRMED). A +25 bp hike to 4.00–4.25% is ~98% priced on CME (Nov 25, secondary reports) and ~91% on Kalshi (undated snippet); a January hike is put near 60% (unattributed) [federalreserve.gov; political.org; marketintellabs; Kalshi]", tickers: "TLT · SPY · KRE",
    rec: "WATCH: the hike is consensus, so the dots and the January signal are the surprise; a hawkish SEP hits TLT and QQQ, a hold would rally everything. No lean." },
  { id: "f12", ind: "finance", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "Thu Dec 10, 8:30 ET: November CPI (CONFIRMED by BLS; no consensus published yet); jobless claims; 30-yr bond reopening (CONFIRMED); Commerce Secretary Lutnick at Senate Banking (EST.; CBS, no committee notice) [bls.gov; Treasury tentative schedule; CBS]", tickers: "TLT · SPY · QQQ",
    rec: "WATCH: no consensus and no verified nowcast, so no lean. A cool print the day after a hike helps TLT and QQQ; a hot one hurts both." },
  { id: "f13", ind: "finance", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Dec 11: federal funding lapses unless extended (the continuing resolution expires Dec 11; EST., no .gov page retrieved). PPI is not this week: BLS lists it for Tue Dec 15. First post-blackout Fed speakers possible [Akin; Harvard OFR; bls.gov]", tickers: "SPY · IWM",
    rec: "WATCH: shutdown headlines add volatility into the Dec 18 expiry; close short-dated credit spreads by Dec 11." },
  // ---- CONSUMER / RETAIL ----
  { id: "c2", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 24: retail earnings rally. ANF +19.7% (then +5.3% Wed to $176.96), KSS +19.5% (+5.4%), DKS +14.6% (+3.5%), DLTR +11.2% (−1.6%), BBY +2.7% (+3.0%) [Nasdaq historical data]", tickers: "ANF · DKS · DLTR",
    rec: "HOLD winners: do not chase third-day moves; new tariff proposals cut the other way for importers." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Thu Nov 26: Altria confirms it is considering a possible offer for Imperial Brands, likely all cash, and is in talks with a third party about part of the business; Bloomberg says Japan Tobacco is also weighing a bid. Imperial +13.3% in London; UK deadline Dec 24. MO closed $76.28 on Wednesday and is ~$75.51 pre-market (−1.0%) [MLQ; MarketScreener; Nasdaq historical data & pre-market quotes]", tickers: "MO",
    rec: "WATCH: acquirers usually trade down on large cash bids; MO options traded only ~11k contracts on Wednesday, too thin for a play." },
  { id: "c4", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Fri Nov 27: Black Friday on a half-day session. Adobe forecasts $12.9B online (+9.2%) after a $6.9B Thanksgiving forecast (+8.5%; no actual tally published yet); Nov 1–22 online spending was $82.5B (+9.1%), ahead of forecast pace. NRF expects 126M Black Friday shoppers [Digital Commerce 360/Adobe; NRF]", tickers: "WMT · AMZN · XRT",
    rec: "WATCH: tallies above forecast support the WMT call spreads; in-line spending is the base case." },
  { id: "c5", ind: "consumer", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30: Cyber Monday (Adobe forecast $15.1B; Cyber Week $47.5B, +7.4%; Salesforce sees $84B US, +6%); NRF forecasts holiday sales +4.2% to ~$1.013T [Adobe; Salesforce; NRF]", tickers: "AMZN · WMT · SHOP",
    rec: "WATCH: the bar is high after a +9.1% November to date." },
  { id: "c6", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "BULLISH", conf: 2, basis: "Quarter and full-year EPS consensus each revised 2 up / 0 down over 4 weeks [Nasdaq earnings-forecast, Nov 27]; 10%-OTM put/call price ratio 0.70 ($21.5P $0.27 vs $26.5C $0.38, Dec 4) [Nasdaq option chain, Nov 25 close]",
    headline: "Wed Dec 2 BMO: Macy's Q3 (EST., calendar-sourced; cons. EPS −$0.16; Dec 4 straddle ±9.8%) and Signet (EST.) [Nasdaq calendar, estimates & option chain; Earnings Whispers]", tickers: "M · SIG",
    rec: "WATCH: leans bullish on rising estimates and call-heavy pricing after KSS and DKS rallied; a miss in this tape costs ~10%." },
  { id: "c7", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "BULLISH", conf: 1, basis: "FIVE quarter EPS consensus revised 2 up / 0 down and full year 4 up / 0 down over 4 weeks [Nasdaq earnings-forecast, Nov 27]",
    headline: "Wed Dec 2 AMC: Five Below Q3 (EST., calendar-sourced; cons. EPS $1.17) and American Eagle (EST.; $0.49; Dec 4 straddle ±13.0%; its own revisions are 1 up / 2 down) [Nasdaq calendar, estimates & option chain; Earnings Whispers]", tickers: "FIVE · AEO",
    rec: "WATCH: leans bullish on Five Below's rising estimates; tariff proposals are the downside branch for an importer." },
  { id: "c8", ind: "consumer", dayIdx: 9, future: true, impact: 2, dir: "BULLISH", conf: 1, basis: "Quarter and full-year EPS consensus each revised 1 up / 0 down over 4 weeks [Nasdaq earnings-forecast, Nov 27]; skew quotes too wide to count",
    headline: "Thu Dec 3 BMO: Dollar General Q3 (EST., calendar-sourced; cons. EPS $1.40; Dec 4 straddle ±9.4%) after Dollar Tree's +11% earnings day; DG closed $139.27, +9.8% in a month [Nasdaq calendar, estimates & option chain; Nasdaq historical data]", tickers: "DG · DLTR",
    rec: "WATCH: leans bullish on a rising estimate; the one-month run raises the bar. DG options (~3k contracts on Wednesday) are too thin for a play." },
  { id: "c9", ind: "consumer", dayIdx: 9, future: true, impact: 2, dir: "BULLISH", conf: 1, basis: "Quarter and full-year EPS consensus each revised 3 up / 0 down over 4 weeks [Nasdaq earnings-forecast, Nov 27]; 10%-OTM put/call 0.97 on wide quotes, not counted",
    headline: "Thu Dec 3 AMC: Ulta Q3 (EST., calendar-sourced; cons. EPS $5.64; Dec 4 straddle ±8.9%) [Nasdaq calendar, estimates & option chain; Earnings Whispers]", tickers: "ULTA",
    rec: "WATCH: leans bullish on rising estimates; a raise is expected, so an in-line guide could disappoint." },
  { id: "c10", ind: "consumer", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Dec 3: Kroger Q3 BMO (EST.; cons. EPS $1.17; Dec 4 straddle ±6.2%; revisions 0/0), plus Hormel, Brown-Forman and PVH BMO (EST.); Tesla annual meeting 3:00 pm CT, Austin (CONFIRMED by proxy: three directors incl. Musk, say-on-pay, auditor) [Nasdaq calendar & estimates; Earnings Whispers; SEC DEF 14A]", tickers: "KR · TSLA · PVH",
    rec: "WATCH: no lean on Kroger; any SpaceX comment at the Tesla meeting is the wild card (TSLA $380.14 sits on its 50- and 200-day)." },
  { id: "c11", ind: "consumer", dayIdx: 14, future: true, impact: 2, dir: "BEARISH", conf: 1, basis: "AZO full-year EPS consensus revised 0 up / 1 down over 4 weeks, quarter 0/0 [Nasdaq earnings-forecast, Nov 27]",
    headline: "Tue Dec 8: AutoZone FQ1 BMO (EST., calendar-sourced; cons. EPS $35.98) and Lululemon Q3 AMC (CONFIRMED by company, call 4:30 pm ET; $0.98; Dec 11 straddle ±12.7%; revisions 1 up / 1 down); Toll Brothers Mon Dec 7 AMC (EST.; $4.89) [Nasdaq calendar, estimates & option chain; Lululemon release]", tickers: "AZO · LULU · TOL",
    rec: "WATCH: leans bearish on AutoZone's trimmed full-year estimate, a low-conviction call on a defensive name; Lululemon's revisions are split." },
  { id: "c12", ind: "consumer", dayIdx: 16, future: true, impact: 2, dir: "BULLISH", conf: 1, basis: "Quarter EPS consensus revised 1 up / 0 down and full year 4 up / 0 down over 4 weeks [Nasdaq earnings-forecast, Nov 27]; 10%-OTM put/call 0.97 on wide quotes, not counted",
    headline: "Thu Dec 10 AMC: Costco FQ1 (EST., calendar-sourced; cons. EPS $4.89; Dec 11 straddle ±4.9%); Campbell's and Chewy report Wed Dec 9 BMO (EST.). COST closed $1,086.81, 9% above its 50-day [Nasdaq calendar, estimates & option chain; Earnings Whispers]", tickers: "COST · WMT",
    rec: "WATCH: leans bullish on rising estimates; with the stock extended, the reaction to a beat may be small." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "NVDA", name: "NVIDIA", rank: 1, spot: "$149.30 (Wed Nov 25 close, −3.91%; day range $141.17–150.37; pre-mkt ~$156.30, +4.69% at 4:12 am ET, so premiums are re-estimated) [Nasdaq last trade / Yahoo Finance chart]", sentiment: "Bearish",
    catalyst: "Huang's closed-door House interview Dec 1 (press), general counsel Dec 2, Senate Banking export-controls hearing Dec 3 10:00 am (CONFIRMED on banking.senate.gov) · GTC DC keynote Dec 1 without Huang (CNBC) · S&P CreditWatch Negative, up to 90 days · MRVL Dec 1 and AVGO Dec 9 read-throughs · FOMC Dec 9 · ex-dividend Dec 2 ($0.25; all short calls are far OTM) · next earnings date n/a (none on Nasdaq's calendar before expiry)",
    iv: "IV ~77% (Dec 18 ATM; 180C 72%) · IVR n/a · no earnings before expiry; the testimony is the binary · 1σ to Dec 18 ±$28.9 (±18.5%) at the pre-market ~$156.30", liq: "A — Wed full session ~3.84M contracts (P/C 0.54), 20d avg ~351M shares/day; OI 77,987 / 88,038 on the Dec 190C/200C, 23,081 / 32,309 on the Dec 155P/135P, 24,423 on the Dec 145P; legs 1.7–6.0% wide at Wednesday's quotes, ≤$0.06 on the options under $2.50; the call strikes sit more than 15% above spot because 1σ is 18.5% [Nasdaq option chain, Nov 25 close; Nasdaq historical data]",
    thesis: "CARRIED (no US session since yesterday's edition; NVDA is +4.7% pre-market, so yesterday's put spreads are marked ~−25% and its call credit spread is losing; strikes move up $5–10 and premiums are ESTIMATES). The governance crisis has a credit cost: S&P put Nvidia's AA rating on CreditWatch Negative on Wednesday, Huang faces a closed House interview on Dec 1 and a public Senate Banking hearing on Dec 3, and CNBC reported on Thursday that sellers now apply 'zero tolerance' to neo-clouds leasing compute to Chinese firms, with some GPUs unsold. The stock gave back all of Monday's reinstatement squeeze ($165.05 → $149.30) and, even at ~$156 pre-market, sits 23% below its 50-day ($203.65) and 200-day ($202.87); it was −31.5% in a month with RSI 37 at Wednesday's close. Risk: estimates are still rising (quarter 9 up / 3 down), consensus target is $234, positioning is call-heavy (P/C 0.54), and the stock is already +4.7% pre-market with SMH +5%, so a quiet hearing could squeeze it as on Monday. Invalid above $166. Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $190C / buy $200C (ESTIMATE at ~$156.30: 2.06 − 1.23) · Dec 18 '26 · credit $0.83 · capital ~$917 · max profit ~$83 · BE $190.83 · R:R 1:0.09 · POP ~84% · exit +50% (buy back ~$0.41) / stop on a close above $166; close by Dec 11 (7 days to expiry) — income tier: short strike at ~1.17σ (Δ +0.16), above Monday's squeeze high; harvests ~73% IV. The strike is far from spot because 1σ is ~18%" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $155P / sell $135P (ESTIMATE at ~$156.30: 10.53 − 3.71) · Dec 18 '26 · debit $6.82 · capital ~$682 · max profit ~$1,318 · BE $148.18 · R:R 1:1.93 · POP ~42% · exit +75–100% (~$11.94–13.64) / stop −50% (~$3.41) or a close above $166 — near-the-money long (Δ −0.44), short leg at ~0.74σ below Wednesday's $141.17 low; spans the testimony and the FOMC" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $145P / sell $135P (ESTIMATE at ~$156.30: 6.42 − 3.71) · Dec 18 '26 · debit $2.71 · capital ~$271 · max profit ~$729 · BE $142.29 · R:R 1:2.69 · POP ~34% · exit +75–100% (~$4.74–5.42) / stop −50% (~$1.35) or a close above $166 — pays on a return to Wednesday's close and through its $141.17 low (long Δ −0.31, short leg at ~0.74σ); a spread, not a long put, because IV is ~77%" },
    ] },
  { ticker: "WMT", name: "Walmart", rank: 2, spot: "$131.94 (Wed Nov 25 close, −0.28%; pre-mkt ~$131.40, −0.41% at 4:12 am ET, under the 1% threshold, so Wednesday's quotes stand) [Nasdaq last trade / Yahoo Finance chart]", sentiment: "Bullish",
    catalyst: "Black Friday today (Adobe forecast $12.9B online, +9.2%) and Cyber Monday Nov 30 ($15.1B) · Dollar General Dec 3 and Costco Dec 10 read-throughs (EST. dates) · ex-dividend Dec 11 ($0.2475; Nasdaq) — short calls are OTM · next earnings date n/a (none on Nasdaq's calendar before expiry)",
    iv: "IV ~25% (Jan 15 ATM; 135C 24%) · IVR n/a · no earnings before expiry · 1σ to Jan 15 ±$12.1 (±9.2%)", liq: "A — Wed full session ~149k contracts (P/C 1.35), 20d avg ~25.0M shares/day; OI 14,379 / 22,985 on the Jan 125C/135C, 20,017 / 12,861 on the Jan 130C/140C; legs 3.6–7.6% wide, $0.14 on the one option under $2.50 [Nasdaq option chain, Nov 25 close; Nasdaq historical data]",
    thesis: "CARRIED (−0.4% pre-market, so yesterday's call spreads are near flat and the strikes are unchanged). Walmart is the defensive leader in a risk-off tape: +10.6% in a month against SPY's −6.9%, 12% above its 50-day ($118.03) and 200-day ($119.03), within 2.4% of its 52-week high ($135.16). Staples lead the one-month sector table (XLP +5.9%), retailers rallied on earnings this week, and Adobe has online spending +9.1% for Nov 1–22, ahead of its forecast pace, into Black Friday. Full-year estimates are rising (8 up / 3 down) and IV is only ~25%, so call debit spreads fit. Risk: RSI 70 is extended, the Section 301 proposals raise import costs, the consensus target ($140) is only 6% away, and a risk-on rotation back into tech would pull money out of defensives. Invalid below $126 (the Nov 19 close). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread (in-the-money)", text: "Buy $125C / sell $135C (mids 9.625 − 3.575) · Jan 15 '27 · debit $6.05 · capital ~$605 · max profit ~$395 · BE $131.05 · R:R 1:0.65 · POP ~49% · exit +75–100% (~$10.59–12.10) / stop −50% (~$3.02) or a close below $126 — ITM long (Δ +0.75) with the breakeven below Wednesday's close; pays in full if WMT holds $135 by mid-January. R:R under 1:1 is the price of the higher POP" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $130C / sell $140C (mids 6.150 − 1.840) · Jan 15 '27 · debit $4.31 · capital ~$431 · max profit ~$569 · BE $134.31 · R:R 1:1.32 · POP ~39% · exit +75–100% (~$7.54–8.62) / stop −50% (~$2.15) or a close below $126 — near-the-money long (Δ +0.61), short leg at ~0.71σ; spans the holiday tallies and both peer prints" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $135C / sell $140C (mids 3.575 − 1.840) · Jan 15 '27 · debit $1.74 · capital ~$174 · max profit ~$326 · BE $136.74 · R:R 1:1.87 · POP ~32% · exit +75–100% (~$3.04–3.48) / stop −50% (~$0.87) or a close below $126 — OTM continuation bet through the 52-week high (long Δ +0.44); a spread rather than a long call because IV rank could not be sourced" },
    ] },
  { ticker: "QQQ", name: "Invesco QQQ Trust (Nasdaq-100) — index hedge", rank: 3, spot: "$633.93 (Wed Nov 25 close, −0.65%; day range $607.74–634.89; pre-mkt ~$651.83, +2.82% at 4:11 am ET, so premiums are re-estimated) [Nasdaq last trade / Yahoo Finance chart]", sentiment: "Bearish",
    catalyst: "Index hedge, no earnings · Huang testimony Dec 1–3 · MRVL Dec 1 AMC, CRM/SNOW Dec 2 AMC (CONFIRMED) · jobs report Dec 4 (CONFIRMED) · FOMC Dec 9, +25 bp ~98% priced (CONFIRMED) · AVGO/ADBE Dec 9 AMC (CONFIRMED) · CPI Dec 10 (CONFIRMED) · funding deadline Dec 11 · ex-dividend date n/a (short calls are far OTM)",
    iv: "IV ~36% (Dec 18 ATM puts at Wednesday's close; 710C 29%) · IVR n/a · no single-name binary; jobs/FOMC/CPI are the macro binaries · 1σ to Dec 18 ±$56.3 (±8.6%) at the pre-market ~$651.83", liq: "A — Wed full session ~4.13M contracts (P/C 1.34), 20d avg ~63.7M shares/day; OI 58,444 / 52,074 on the Dec 710C/715C, 58,432 / 56,295 on the Dec 650P/610P, 37,757 / 68,681 on the Dec 630P/600P; legs 1.7–8.1% wide at Wednesday's quotes, ≤$0.09 on the options under $2.50 [Nasdaq option chain, Nov 25 close; Nasdaq historical data]",
    thesis: "CARRIED and re-struck (QQQ is +2.8% pre-market at ~$651.83, so yesterday's put spreads are marked ~−30% and its $655 line is under test; strikes move up $20 and premiums are ESTIMATES). The trigger for this hedge is the retest itself: a bounce into Monday's close ($651.03) and high ($657.53) that fails. Even at ~$652 QQQ is 8% below its 50-day ($707.05) and 5% under its 200-day ($683.50); at Wednesday's close it was −12.1% in a month, RSI 39, with VIX (28.3 Wed, 26.8 Thu) above VIX3M (26.3). Nothing fundamental changed overnight: Nvidia's CreditWatch, record AI-debt CDS, a ~98%-priced Fed hike on Dec 9 and tariff proposals all stand, and the rally came on a US holiday led by Korea and Europe. Risk: bearish plays have gone against this report for three editions; put/call 1.34 shows crowded hedges, Wednesday's 4% intraday reversal is a hammer, and a soft jobs report could extend the squeeze to the 200-day. Invalid on a close above $660 (clears Monday's high and ends the lower-high sequence). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $710C / buy $715C (ESTIMATE at ~$651.83: 2.72 − 2.19) · Dec 18 '26 · credit $0.52 · capital ~$448 · max profit ~$52 · BE $710.52 · R:R 1:0.12 · POP ~88% · exit +50% (buy back ~$0.26) / stop on a close above $660; close by Dec 11 (7 days to expiry) — income tier: short strike at ~1.03σ (Δ +0.12), above the 50-day ($707) and 200-day ($683.50); a narrow $5 spread because quotes on the $720+ calls are wider than 10%" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $650P / sell $610P (ESTIMATE at ~$651.83: 20.52 − 9.15) · Dec 18 '26 · debit $11.37 · capital ~$1,137 · max profit ~$2,863 · BE $638.63 · R:R 1:2.52 · POP ~42% · exit +75–100% (~$19.90–22.74) / stop −50% (~$5.68) or a close above $660 — at-the-money long (Δ −0.46) bought into the gap, short leg at ~0.74σ near Wednesday's $607.74 low; spans payrolls, the FOMC and CPI" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $630P / sell $600P (ESTIMATE at ~$651.83: 13.78 − 7.49) · Dec 18 '26 · debit $6.29 · capital ~$629 · max profit ~$2,371 · BE $623.71 · R:R 1:3.77 · POP ~32% · exit +75–100% (~$11.01–12.58) / stop −50% (~$3.15) or a close above $660 — pays on a return to Wednesday's close and below (long Δ −0.33, short at ~0.92σ); a spread, not a long put, because IV is ~36% with VIX near 27" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 4, spot: "$355.58 (Wed Nov 25 close, +0.43%; pre-mkt ~$359.20, +1.02% at 4:12 am ET, so premiums are re-estimated) [Nasdaq last trade / Yahoo Finance chart]", sentiment: "Bullish",
    catalyst: "No scheduled company event in the window · Black Friday / Cyber Monday device demand (Adobe expects peak electronics discounts of 30%) · jobs Dec 4, FOMC Dec 9, CPI Dec 10 (CONFIRMED) · Nasdaq-100 reconstitution announcement ~Dec 11 (EST.) · last ex-dividend Nov 12, none before expiry · next earnings date n/a (none on Nasdaq's calendar before expiry)",
    iv: "IV ~26% (Dec 18 ATM), ~25% (Jan 15 ATM), against ~36% on QQQ · IVR n/a · no earnings before expiry · 1σ to Dec 18 ±$22.8 (±6.4%), to Jan 15 ±$32.9, at the pre-market ~$359.20", liq: "A — Wed full session ~814k contracts (P/C 1.76), 20d avg ~51.5M shares/day; OI 11,231 / 19,029 on the Dec 335P/325P, 67,917 / 96,078 on the Jan 360C/380C, 21,196 on the Jan 370C; legs 4.9–9.4% wide at Wednesday's quotes, $0.11 on the one option under $2.50 [Nasdaq option chain, Nov 25 close; Nasdaq historical data]",
    thesis: "NEW. Apple is the relative-strength name inside a broken tech tape: +2.4% in a month while the Nasdaq-100 fell 12.2%, above its 50-day ($343.05) and 200-day ($304.40), RSI 58, and it closed 1.5% below its 52-week high ($360.83) on the day QQQ traded 4% lower intraday; pre-market it is ~$359.20. It carries none of the AI-debt or export-control overhangs driving NVDA, ORCL and the semis, and its options price only ~26% IV, so a put credit spread below the 50-day and call debit spreads through the high are both cheap to structure. Risk: there is no dated catalyst; the Section 301 proposal names China at 20% (alt. 40%); the consensus target ($343.69) is below the price with 6 sells; full-year estimates were revised 3 up / 8 down; and the heaviest put volume of the five plays (P/C 1.76) shows hedging demand. Invalid below $342 (the 50-day and the Nov 20 close). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $335P / buy $325P (ESTIMATE at ~$359.20: 2.43 − 1.53) · Dec 18 '26 · credit $0.90 · capital ~$910 · max profit ~$90 · BE $334.10 · R:R 1:0.10 · POP ~84% · exit +50% (buy back ~$0.45) / stop on a close below $342; close by Dec 11 (7 days to expiry) — income tier: short strike at ~1.06σ (Δ −0.16), below the 50-day ($343); profits if AAPL simply holds $335 for three weeks" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $360C / sell $380C (ESTIMATE at ~$359.20: 13.58 − 4.65) · Jan 15 '27 · debit $8.93 · capital ~$893 · max profit ~$1,107 · BE $368.93 · R:R 1:1.24 · POP ~37% · exit +75–100% (~$15.63–17.86) / stop −50% (~$4.46) or a close below $342 — near-the-money long (Δ +0.54) through the 52-week high ($360.83), short leg at ~0.63σ; January gives time past the FOMC and CPI" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $370C / sell $380C (ESTIMATE at ~$359.20: 8.33 − 4.65) · Jan 15 '27 · debit $3.69 · capital ~$369 · max profit ~$631 · BE $373.69 · R:R 1:1.71 · POP ~32% · exit +75–100% (~$6.46–7.38) / stop −50% (~$1.84) or a close below $342 — breakout bet (long Δ +0.41); a spread rather than a long call because IV rank could not be sourced and the $390+ calls quote wider than 10%" },
    ] },
  { ticker: "UNH", name: "UnitedHealth Group", rank: 5, spot: "$346.19 (Wed Nov 25 close, +1.26%; pre-mkt ~$349.75, +1.03% at 4:11 am ET on only ~5k shares, so premiums are re-estimated) [Nasdaq last trade / Yahoo Finance chart]", sentiment: "Bearish",
    catalyst: "No dated company event confirmed in the window (an investor-conference date could not be sourced) · Medicare Advantage: UnitedHealth's share of members in 4-star-plus plans for 2027 trails the industry average (TIKR, Oct 10) · jobs Dec 4, FOMC Dec 9 · next earnings date n/a (not on Nasdaq's calendar; the Jan 15 idea must be closed before the Q4 report) · ex-dividend date n/a (no short calls used)",
    iv: "IV ~42% (Dec 18 ATM puts; calls ~36%), ~39% (Jan 15 ATM puts) · IVR n/a · no earnings before Dec 18 · 1σ to Dec 18 ±$35.2 (±10.1%), to Jan 15 ±$50.0, at the pre-market ~$349.75", liq: "A — Wed full session ~49k contracts (P/C 0.71), 20d avg ~7.6M shares/day; OI 7,712 / 3,048 on the Jan 350P/320P, 2,149 / 3,656 on the Dec 350P/330P, 3,332 on the Dec 340P; legs 3.9–7.5% wide at Wednesday's quotes [Nasdaq option chain, Nov 25 close; Nasdaq historical data]",
    thesis: "NEW. UnitedHealth is the laggard inside the market's leading sector: XLV is +2.5% in a month and above both averages, while UNH is −15.6%, 10% below its 50-day ($386.49) and 6% under its 200-day ($369.53), RSI 35, with a three-day bounce from $336 to $346 (and ~$349.75 on thin pre-market volume) that is now testing the Nov 18 close ($349.91). Its 2027 Medicare Advantage star ratings slipped below the industry average, and the Q4 EPS estimate was revised down (0 up / 1 down in four weeks). Only put debit spreads are offered: Dec call quotes at $370–380 are wider than 10%, so a call credit tier fails the liquidity gate. Risk: sell-side is uniformly positive (15 buys, 2 holds, target $484.67), healthcare is where money is rotating, and the stock is 35% above its 52-week low ($255.97) with no dated catalyst to force the move. Invalid above $356. Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wider)", text: "Buy $350P / sell $320P (ESTIMATE at ~$349.75: 18.82 − 8.08) · Jan 15 '27 · debit $10.74 · capital ~$1,074 · max profit ~$1,926 · BE $339.26 · R:R 1:1.79 · POP ~44% · exit +75–100% (~$18.80–21.48) / stop −50% (~$5.37) or a close above $356; close before the Q4 earnings date (mid-January, n/a) — more time for the downtrend to resume: long Δ −0.46, short leg at ~0.60σ below the Nov 19 close ($330.48)" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $350P / sell $330P (ESTIMATE at ~$349.75: 13.85 − 6.32) · Dec 18 '26 · debit $7.53 · capital ~$753 · max profit ~$1,247 · BE $342.47 · R:R 1:1.66 · POP ~44% · exit +75–100% (~$13.18–15.06) / stop −50% (~$3.77) or a close above $356 — near-the-money long (Δ −0.47), short leg at the Nov 19 low-close area (~0.56σ); no earnings before expiry" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM, tight)", text: "Buy $340P / sell $330P (ESTIMATE at ~$349.75: 9.59 − 6.32) · Dec 18 '26 · debit $3.27 · capital ~$327 · max profit ~$673 · BE $336.73 · R:R 1:2.06 · POP ~37% · exit +75–100% (~$5.72–6.54) / stop −50% (~$1.64) or a close above $356 — tight $10 spread (long Δ −0.36) that pays if the bounce fails back to $330; a spread, not a long put, because IV is ~42%" },
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
// today line sits on the boundary between Nov 27 and Nov 28
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Nov 27 2026 (half day, NYSE closes 1:00 pm ET; pre-market ~4:12 am ET; option quotes = Wed Nov 25 close)</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Nov 27)
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
