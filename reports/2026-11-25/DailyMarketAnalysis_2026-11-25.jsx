import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Wednesday, November 25, 2026 — trading-day edition (built ~2 am ET, before the pre-market session; NYSE closed Thu Nov 26, half day Fri Nov 27).
 * Data as of the Tue Nov 24 close: stock quotes = Yahoo Finance chart, cross-checked with the Nasdaq last trade; option quotes, OI & volume = Nasdaq option chain after the Tue Nov 24 session.
 * Overnight (~1:45 ET): Nasdaq-100 futures −1.4%, S&P futures −0.7% vs Tue 4 pm; Bitcoin −1.2%; gold −0.9%. Stock pre-market n/a at build time; QQQ and IBIT debits re-estimated (ESTIMATE).
 * Window: last 3 days (Nov 22) → coming 2 weeks (Dec 9).
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
  energy:   { label: "Energy / Commodities / Ag",     color: "#f59e0b" },
  health:   { label: "Healthcare / Pharma / Biotech", color: "#10b981" },
  finance:  { label: "Financials / Rates / Crypto",   color: "#a855f7" },
  consumer: { label: "Consumer / Retail",             color: "#ef4444" },
};

const DIR = {
  BULLISH: { glyph: "↑", label: "Bullish" },
  BEARISH: { glyph: "↓", label: "Bearish" },
  MIXED:   { glyph: "↔", label: "Mixed / uncertain" },
};

// 18-day axis: Nov 22 .. Dec 9 (last 3 days → coming 2 weeks). Today = index 3 (Nov 25).
const DAYS = [
  { idx: 0, date: "Nov 22", dow: "Sun" },
  { idx: 1, date: "Nov 23", dow: "Mon" },
  { idx: 2, date: "Nov 24", dow: "Tue" },
  { idx: 3, date: "Nov 25", dow: "Wed" }, // TODAY
  { idx: 4, date: "Nov 26", dow: "Thu" },
  { idx: 5, date: "Nov 27", dow: "Fri" },
  { idx: 6, date: "Nov 28", dow: "Sat" },
  { idx: 7, date: "Nov 29", dow: "Sun" },
  { idx: 8, date: "Nov 30", dow: "Mon" },
  { idx: 9, date: "Dec 1", dow: "Tue" },
  { idx: 10, date: "Dec 2", dow: "Wed" },
  { idx: 11, date: "Dec 3", dow: "Thu" },
  { idx: 12, date: "Dec 4", dow: "Fri" },
  { idx: 13, date: "Dec 5", dow: "Sat" },
  { idx: 14, date: "Dec 6", dow: "Sun" },
  { idx: 15, date: "Dec 7", dow: "Mon" },
  { idx: 16, date: "Dec 8", dow: "Tue" },
  { idx: 17, date: "Dec 9", dow: "Wed" },
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
const LEAN_RECORD = { hits: 2, misses: 3, since: "2026-11-16" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SOFTWARE / SEMIS -----------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 24: Monday's chip squeeze fails in one session. SOX −7.9% to 8,832.5 with all 30 members down; SMH −7.3% to $426.75; NVDA −5.9% to $155.38 ($151.95 after hours); AMD −8.9% (filing registers 337M shares for resale), MU −10.6%, INTC −8.2%, MRVL −9.1%, CRDO −13.1% [Yahoo chart; Yahoo Finance; chipdispatch]", tickers: "SMH · NVDA · AMD",
    rec: "SELL rallies / AVOID new semis longs: the squeeze reversed within a day. The QQQ bear put spreads in Top Option Plays express it; an SMH close back above $460 (Monday's close) would end the bear case." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Mon Nov 23: NVIDIA's board reinstates Jensen Huang as CEO; NVDA +31.5% to $165.05, SMH +15.0% to $460.18 in a short squeeze [Reuters via Yahoo; Yahoo chart]", tickers: "NVDA · SMH",
    rec: "HOLD/TRIM: half of the gain went in two sessions; last report's NVDA bull call spreads are −25% to −43% and are dropped. The $146 (Nov 19 close) level is the line." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 24 BMO: Analog Devices beats (adj. EPS $4.06 vs $3.89; rev $4.37B, +42%, vs $4.32B) but guides FQ1 flat ($4.4B ±$150M; EPS $3.82 ±$0.20) and lifts FY27 capex to $1.6–1.9B from $0.7B; days of inventory 165. ADI −17.4% to $312.95 [ADI release; Investing.com transcript; Yahoo chart]", tickers: "ADI · TXN · NXPI",
    rec: "AVOID catching it: 21% below its 50-day ($395) and under its 200-day ($378). Wait for a base. (The Nov 23 report's bearish lean on this print scored a HIT.)" },
  { id: "t4", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "Tue Nov 24 AMC: Dell blows out FQ3 (rev $54.9B, +103%; EPS $9.45 vs $6.55; AI-server orders $60.2B, backlog $132.3B), raises FY27 revenue to $202B from $192B and adds a $25B buyback, after a −11.8% regular session to $295.28; after hours $297.98 (+0.9%; other reports say +3–6%) [Dell 8-K; CNBC; Reuters via Investing.com; Yahoo chart]", tickers: "DELL · SMCI · HPE",
    rec: "HOLD: record numbers, but the tape is selling AI hardware; wait for the first full session. HPE's margin warning is the counterweight." },
  { id: "t5", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 24: HPE −16.3% to $40.19 after +17.4% Monday: gross margin to moderate through FY27; CEO says memory/component constraints could last until late 2028 [Motley Fool; Benzinga; Yahoo chart]", tickers: "HPE · DELL",
    rec: "AVOID: supply-constrained margins are the risk for AI-server names into 2027." },
  { id: "t6", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 24 AMC: weak guides hit software and edge chips after hours. WDAY −7.2% ($166.29; FQ4 subscription guide +10%), ADSK −3.6% (implied FQ4 slowdown), NTNX −7.9% (FY guide below consensus; CEO to step down), AMBA −37.6% (FQ4 guide $70–75M vs ~$112M, memory crunch); HPQ beat ($0.83 vs $0.75) but closed −3.3% and rose 2.0% after hours [company releases/SEC; Yahoo chart]", tickers: "WDAY · ADSK · AMBA",
    rec: "AVOID dip-buying software on soft guides; the memory shortage is now hitting edge-AI and PC names." },
  { id: "t7", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 23: CrowdStrike to buy Zscaler in an all-stock deal (~$43.9B; 1.135 CRWD per ZS); CRWD −8.9% to $208.97, ZS +17.7%. Tue: CRWD +0.9% to $210.86 on a −2.0% Nasdaq-100 day; ZS withdrew guidance, Rosenblatt downgrades ZS [CRWD 8-K; CNBC; Benzinga; Yahoo chart]", tickers: "CRWD · ZS",
    rec: "HOLD/WATCH: CRWD outperformed Tuesday, so the merger-arbitrage selling thesis is not confirmed; last report's CRWD put spreads (−12% to +1%) are dropped." },
  { id: "t8", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "BEARISH",
    headline: "TODAY Wed Nov 25 (overnight): Asia chips crash. KOSPI −6.2% (Samsung, SK Hynix −8%+), Nikkei −2.8%; Nasdaq-100 futures −1.4%, S&P futures −0.7% vs Tuesday 4 pm at ~1:45 ET on AI-capex and financing doubts [Yahoo chart; investingLive]", tickers: "QQQ · SMH · NVDA",
    rec: "WATCH the open: do not buy the first dip. A QQQ close back above $651 (Monday's close) would negate the hedge." },
  { id: "t9", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 – Fri Dec 4: AWS re:Invent (CONFIRMED); developer keynote Nov 30 7:30 pm PT, CEO Matt Garman's keynote Tue Dec 1 8:30 am PT (one source says Dec 2). Rubrik reports Nov 30 AMC (EST.) [AWS APN blog; Nasdaq calendar]", tickers: "AMZN · RBRK",
    rec: "WATCH: AI revenue disclosures support the AMZN bull spreads; more capex without revenue would not." },
  { id: "t10", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Tue Dec 1: Huang's closed-door transcribed interview with the House Foreign Affairs, Intelligence and China committees; general counsel Dec 2; Senate Banking asks for a public hearing Dec 3 (not confirmed); DOJ/SEC probes still open [Axios; fourweekmba]", tickers: "NVDA",
    rec: "WATCH: new export-control demands would hit NVDA; a quiet session removes an overhang. No lean." },
  { id: "t11", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "BEARISH", conf: 1, basis: "FY EPS consensus revised down 3 times (0 up) and quarter 0 up / 1 down over 30 days [Nasdaq estimate-momentum]; 10%-OTM put/call skew flat at 1.00, no offset [Nasdaq option chain, Nov 24]",
    headline: "Tue Dec 1 AMC: Marvell FQ3 (CONFIRMED by IR; cons. EPS $0.79; revenue pre-announced in line; straddle ±16.3%), Credo (CONFIRMED; $1.03; ±19.5%), MongoDB (CONFIRMED; $0.08); NetApp, GitLab (EST.) [Marvell & Credo IR; Nasdaq calendar & option chain]", tickers: "MRVL · CRDO · MDB",
    rec: "WATCH: leans bearish on falling estimates; the guide matters most because revenue is known. A guide raise would squeeze it; a bear put spread fits only below ~$118." },
  { id: "t12", ind: "tech", dayIdx: 9, future: true, impact: 2, dir: "BULLISH", conf: 1, basis: "10%-OTM put/call mid ratio 0.82 ($177.5P $7.40 vs $217.5C $9.05, Dec 4 expiry), the most call-leaning in its group [Nasdaq option chain, Nov 24]; revisions flat (no offset)",
    headline: "Tue Dec 1 AMC: Okta FQ3 (CONFIRMED; cons. EPS $0.43; revenue guide $813–817M; Dec 4 straddle ±16.2%) [Okta IR via Finviz; Nasdaq calendar & option chain]", tickers: "OKTA",
    rec: "WATCH: leans bullish on call-heavy positioning; it rose after its last 4 prints, but +11% in 10 sessions raises the bar." },
  { id: "t13", ind: "tech", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Dec 2 AMC: Salesforce FQ3 (CONFIRMED; cons. EPS $2.41; skew 0.98; straddle ±11.7%) and Snowflake (CONFIRMED; −$0.32 on Nasdaq's basis; skew 0.91; ±15.3%); revisions flat for both [Salesforce & Snowflake IR; Nasdaq option chain & estimates]", tickers: "CRM · SNOW",
    rec: "WATCH: last report's bearish lean is dropped: CRM's put skew normalised to 0.98, so no signal remains. A stable FY guide could squeeze CRM; a cut extends the de-rating." },
  { id: "t14", ind: "tech", dayIdx: 17, future: true, impact: 3, dir: "BEARISH", conf: 1, basis: "FY EPS consensus trimmed to $10.20 from $10.37 over 30 days, quarter flat [Nasdaq estimate-momentum]; 10%-OTM skew neutral (P/C 1.00), no offset [Nasdaq option chain, Nov 24]",
    headline: "Wed Dec 9 AMC: Broadcom FQ4 (CONFIRMED by IR; cons. EPS $3.45; revenue guide ~$34.8B, AI semis $21.7B; Dec 11 straddle ±14.2%) and Adobe (CONFIRMED; $5.11; ±11.2%); Synopsys reports Dec 8 AMC (CONFIRMED; $3.09) [Broadcom, Adobe & Synopsys IR; Nasdaq option chain & estimates]", tickers: "AVGO · ADBE · SNPS",
    rec: "WATCH: leans bearish on trimmed estimates; AVGO beat its last 4 prints yet fell after 3. An AI guide above $21.7B is the upside branch." },
  // ---- ENERGY / COMMODITIES / AG ---------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 24: crude bounces: Jan WTI settles $82.05 (Mon $80.17), Jan Brent $91.40 (Mon $89.37), still near 3-month lows after October highs above $100; overnight WTI ~$80.70 (−1.6%) [Yahoo chart CLF27/BZF27; oilprice.com]", tickers: "USO · XLE · XOM",
    rec: "HOLD: XLE ($60.45) sits just above its 200-day ($59.80); no energy play until OPEC+ (Nov 29)." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Nov 23–24: Hormuz traffic falls >40% (226 ships Nov 1–7 → 125 Nov 17–23); >25 tankers hit in a week; US blockade of Iranian ports reinstated; traders shrug off IRGC mine claims [Al Jazeera; oilprice.com]", tickers: "USO · FRO",
    rec: "WATCH: the market is pricing a supply surplus over the risk (Deutsche Bank sees 1.7 mb/d oversupply); a real closure would reverse crude fast." },
  { id: "e3", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 24: gold slides again. GLD −2.3% to $325.45; spot ~$3,551 (−2.3%), silver −5.6% to $40.73; a December hike is priced and equity margin calls add to selling; Dec gold ~$3,518 overnight, near a 15-month low [FXStreet/investingLive; Investing.com; Yahoo chart]", tickers: "GLD · SLV · NEM",
    rec: "SELL rallies: GLD is 13% below its 50-day ($372); see the GLD bear put spreads in Top Option Plays. A close above $336 ends the bear case." },
  { id: "e4", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Wed Nov 25: Deere FQ4 BMO (CONFIRMED; cons. EPS $4.07; call 9:00 CT; FY27 outlook is the key) after −3.0% Tue to $613.76; EIA petroleum report 10:30 ET and gas storage at 12:00 (moved from Thu; prior +20 Bcf) (CONFIRMED). API showed crude +126k bbl, Cushing −666k [Deere release via Finviz; EIA schedules; oilprice.com]", tickers: "DE · USO · UNG",
    rec: "WATCH: DE is at its 200-day ($615); a weak FY27 farm outlook breaks it. Inventory prints are thin-holiday noise." },
  { id: "e5", ind: "energy", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Sun Nov 29: OPEC+ full ministerial (21 members) sets 2027 quotas from a capacity audit that Iraq rejects; the UAE left OPEC in May; Reuters/Bloomberg see no output change before next year; scenario range Brent $88 (higher quotas) to $97 (restraint) (CONFIRMED date) [Reuters via engineeringnews; financefeeds; Al-Monitor]", tickers: "USO · XLE · XOM",
    rec: "WATCH (both ways): restraint lifts USO/XLE on Mon Nov 30; higher 2027 baselines push Brent toward $88. Avoid new energy size into the weekend." },
  { id: "e6", ind: "energy", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Tue Dec 8: EIA Short-Term Energy Outlook (CONFIRMED); weekly petroleum reports Dec 2 and Dec 9, gas storage Dec 3 (CONFIRMED) [EIA STEO & WPSR schedules]", tickers: "USO · XLE",
    rec: "WATCH: the STEO surplus estimate is the read-through for OPEC+'s 2027 path." },
  // ---- HEALTHCARE / PHARMA / BIOTECH -----------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Tue Nov 24: Sanofi to buy Insmed for $175/sh cash (~$41.0B; 46% premium to the Nov 18 unaffected price; close 1H27). INSM +14.1% to $170.15; SNY +11.0% to $51.90, an unexplained acquirer rally [Insmed 8-K; Fierce Pharma; Yahoo chart]", tickers: "INSM · SNY",
    rec: "HOLD INSM only for the ~3% deal spread; do not chase SNY's pop without a sourced reason." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Tue Nov 24: money rotates from chips into healthcare. XLV +3.0% to $184.72, XBI +6.6% to $156.82, IBB +5.2%, LLY +3.2% to $1,407.59, MRK +4.5%, ABBV +4.1%, JNJ +2.4% [Yahoo chart; marketscholars; cappnotes]", tickers: "XLV · XBI · LLY",
    rec: "BUY dips in leaders: XLV is above its 50-day ($177) and 200-day ($161), +3% in a month vs SPY −6%. XLV, JNJ and ABBV chains were too wide (>10%) to use for a play." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 24 BMO: Medtronic FQ2 revenue $9.364B misses ~$9.48B (first miss in ~2 years per Reuters); EPS $1.34 vs $1.33; FY27 guide kept but 2H comps harder; MDT −4.6% to $96.13 [MDT 8-K; Benzinga; Yahoo chart]", tickers: "MDT · BSX",
    rec: "HOLD, no adds: ablation ($595M vs JPM's $640–650M) was the miss that mattered." },
  { id: "h4", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 24: managed care rebounds despite the CMS Star Ratings proposal (~$107B of MA bonus cuts): UNH +1.7% to $341.88, HUM +5.0% to $402.72, ELV +3.1%, CVS +1.3% [Yahoo chart; cappnotes; Yahoo Finance]", tickers: "UNH · HUM · ELV",
    rec: "WATCH: last report's UNH put spreads (−13% to −22%) are dropped as the sector rotates in; UNH is still below its 50-day ($387)." },
  { id: "h5", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Nov 23–24: biotech catalysts land early. FDA approves Cogent's Ekitna + sunitinib in GIST ahead of its Nov 30 PDUFA (COGT +17.4% to $33.01) and BridgeBio's Welgemda ahead of Nov 27; Kymera +30.4% then +15.7% to $173.92 on its STAT6 Ph2b win despite a $1.75B raise [rttnews; BioSpace; biopharmadive; Yahoo chart]", tickers: "XBI · COGT · KYMR",
    rec: "HOLD XBI: early approvals and M&A are fuelling the rotation; trim single-name spikes." },
  { id: "h6", ind: "health", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30: FDA decision on Vertex's povetacicept in IgA nephropathy (accelerated approval; CONFIRMED by Vertex IR; RAINIER interim −52% proteinuria vs placebo) [Vertex IR; Global Genes]", tickers: "VRTX",
    rec: "WATCH: approval is expected, so label breadth matters; binary, so no lean (and Q4 EPS estimates were cut 12% for unrelated reasons)." },
  { id: "h7", ind: "health", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Dec 3 AMC: Veeva FQ3 (CONFIRMED; cons. EPS $1.68; revisions 0/0; −14% in a month) and Cooper Cos FQ4 (CONFIRMED; $1.07; first FY27 guide) [Veeva PR via Finviz; GlobeNewswire; Nasdaq estimates]", tickers: "VEEV · COO",
    rec: "WATCH: no sourced lean; VEEV fell 9.8% after last year's FQ3 beat." },
  { id: "h8", ind: "health", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Dec 7: Lilly Innovation Day, 9 am–1 pm ET (R&D strategy, capital allocation) (CONFIRMED); ASH late-breaking abstracts post the same day (meeting Dec 12–15). SABCS runs Dec 8–11 with Novartis' NATALEE 6-year Kisqali data [BiopharmaWatch; hematology.org; aacr.org]", tickers: "LLY · NVS",
    rec: "WATCH: LLY is +10% in a month and above both averages; a capital-return update is the upside branch." },
  // ---- FINANCIALS / RATES / CRYPTO -------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 24 close: S&P 500 −0.5% to 7,201.09 (8th loss in 9 sessions), Nasdaq-100 −2.0% to 26,214, Russell 2000 +0.6% to 2,684.94, Dow +0.85% to 50,018.70 (first close above 50k). VIX 26.36 > VIX3M 25.47; 345 advancers / 154 decliners; 55% of the S&P above its 50-day [Yahoo chart; vistapglobal; chartrow]", tickers: "QQQ · SPY · IWM",
    rec: "HOLD hedges: a rotation, not a capitulation. QQQ is 10% below its 50-day ($708) and under its 200-day ($683); see the QQQ bear put spreads." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 24: Conference Board confidence jumps to 103.3 vs 92.4 consensus (highest since Jan 2025) but 12-month inflation expectations hit 5.7%; Richmond Fed mfg 3 vs −2; Case-Shiller +2.6% y/y [Nasdaq econ calendar; vistapglobal]", tickers: "XLY · XRT · TLT",
    rec: "WATCH: a strong consumer supports holiday retail, but 5.7% inflation expectations keep the Fed hiking." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Nov 24: 2-yr 4.63%, 10-yr 4.91% (2s10s +28 bp), 30-yr 5.30%; the $70B 5-yr stopped at 4.719% (bid-to-cover 2.37); NY Fed's Williams won't exclude back-to-back hikes and Waller floats 50 bp; DXY ~104.1 [home.treasury.gov; TreasuryDirect; CNBC; Yahoo chart]", tickers: "TLT · UUP",
    rec: "HOLD the TLT call spreads: the front end has rallied 17 bp since Nov 18 while the long end holds ~4.9%." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Nov 23–24: Bitcoin below $60K (~$59.1K overnight); spot-BTC ETF outflows −$570M Mon and −$231.6M Tue (IBIT −$175.3M), a 5th straight day and a record −$4.71B in November; IBIT −2.5% to $33.76 [CoinDesk; The Block; Yahoo chart]", tickers: "IBIT · MSTR · COIN",
    rec: "SELL rallies: IBIT put spreads are carried and re-set (Top Option Plays). A close above $37 ends the bear case." },
  { id: "f5", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Wed Nov 25, 8:30 ET: October PCE (cons. core +0.3% m/m, 3.2% y/y; Cleveland Fed nowcast 0.267% / 3.21%), Q3 GDP 2nd est. (cons. 3.5%), durable goods (+0.4%), jobless claims (~200K); new home sales 10:00, $44B 7-yr auction 1:00 pm, Beige Book 2:00 pm (CONFIRMED) [bea.gov; clevelandfed.org; TreasuryDirect; federalreserve.gov]", tickers: "TLT · SPY · QQQ",
    rec: "WATCH (both ways): a soft core print (≤0.25%) helps the TLT call spreads; ≥0.35% revives 50 bp talk and hits TLT and QQQ. The prior report's bullish TLT lean is scored next run." },
  { id: "f6", ind: "finance", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "Thu Nov 26: Thanksgiving, NYSE closed. Fri Nov 27: stocks close 1:00 pm ET (options 1:15); the FOMC blackout starts Sat Nov 28 (CONFIRMED) [nyse.com; federalreserve.gov]", tickers: "SPY",
    rec: "WATCH: thin holiday liquidity exaggerates moves; avoid opening size on Friday." },
  { id: "f7", ind: "finance", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1, 10:00 ET: ISM manufacturing (prior 55.5) and October JOLTS (prior 7.52M) (CONFIRMED); Chicago PMI Mon Nov 30 (prior 55.3) [ISM; bls.gov; Nasdaq econ calendar]", tickers: "TLT · XLI · SPY",
    rec: "WATCH: high prices-paid hurts TLT; a weak headline supports it." },
  { id: "f8", ind: "finance", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Dec 2: ADP November 8:15 ET (prior 86K); Bank of Montreal and Scotiabank report BMO (Nasdaq calendar; IR unverified) [Nasdaq]", tickers: "TLT · SPY",
    rec: "WATCH: a weak ADP sets up a soft payrolls print." },
  { id: "f9", ind: "finance", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Dec 3: ISM services 10:00 (prior 54.5) and jobless claims (CONFIRMED); RY, TD and CM report BMO (Nasdaq calendar; IR unverified) [ISM; Nasdaq]", tickers: "SPY · XLF",
    rec: "WATCH: services strength keeps the hike path open into 2027." },
  { id: "f10", ind: "finance", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "Fri Dec 4, 8:30 ET: November jobs report (CONFIRMED; prior +165K; no Street consensus found; Kalshi median ~+90–95K, P(>150K) 22%); UMich prelim (EST.); S&P quarterly rebalance announcement likely after the close (EST.; effective Dec 21 CONFIRMED) [bls.gov; Kalshi; S&P DJI]", tickers: "TLT · SPY · IWM",
    rec: "WATCH (both ways): a miss (<50K) supports TLT; a beat (>165K) adds January-hike odds and hits TLT. Without a consensus, no lean." },
  { id: "f11", ind: "finance", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Dec 9, 2:00 pm ET: FOMC decision + projections (meeting Dec 8–9, CONFIRMED). +25 bp: CME ~95–96%, Kalshi 92–93¢, Polymarket 93.5%; +50 bp 2–5%; hold ~5%; Polymarket prices Dec–Jan–Mar hikes at 23.5%. November CPI follows Dec 10 [federalreserve.gov; Kalshi; Polymarket; bls.gov]", tickers: "TLT · SPY · KRE",
    rec: "WATCH: the hike is consensus, so the dots are the surprise risk; a hawkish SEP hits TLT, a hold rallies everything. No lean." },
  // ---- CONSUMER / RETAIL -----------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 24 BMO: Dollar Tree beats (adj. EPS $1.16 vs $0.89; comps +4.6%, traffic +3.8%) and raises FY EPS to $8.05–8.25 (incl. ~$0.65 tariff refund); DLTR +11.2% to $154.65, DG +3.3% to $138.65 [Zacks/Yahoo; GuruFocus; Yahoo chart]", tickers: "DLTR · DG",
    rec: "HOLD: trade-down demand is real, but part of the raise is a one-off refund; DLTR's chain (~17k contracts/day) is too thin for a play." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tue Nov 24 BMO: retail beats lift the group. DKS +14.6% to $153.17 (EPS $1.94 vs $1.42; guide raised), ANF +19.7% to $168.10, KSS +19.5% to $25.33 (first sales growth in 4 years), BBY +2.7% to $99.62 (comps +6.1%, best in 5 years), BURL +3.9% despite a Q4 margin cut [Motley Fool; Moby; Barron's; Yahoo chart]", tickers: "DKS · ANF · BBY",
    rec: "HOLD winners: tariff refunds flatter several beats, so do not chase second-day moves." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 24: Urban Outfitters −12% after hours ($75.25 vs $85.58; comps +4.4% vs 5.7% est.); J.M. Smucker −1.5% (Uncrustables capacity slows growth) [Zacks; Barron's; GuruFocus; Yahoo chart]", tickers: "URBN · SJM",
    rec: "AVOID: comp misses are being punished even in a strong-consumer tape." },
  { id: "c4", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Nov 24: Tesla flat at $384.68 as the FT reports special committees and advisers modelling a ~$3.5T all-stock Tesla–SpaceX deal; SPCX −6% to ~$125.8, below its $135 IPO price [Stocktwits/Yahoo; TheStreet; Yahoo chart]", tickers: "TSLA · SPCX",
    rec: "WATCH: a two-way wild card; defined risk only." },
  { id: "c5", ind: "consumer", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27: Black Friday on a half-day session; Adobe forecasts Black Friday $12.9B (+9.2%), Cyber Monday (Nov 30) $15.1B (+6.2%), Cyber Week $47.5B (+7.4%); Salesforce sees $357B global Cyber Week. Adobe tallies usually land the next day [Adobe newsroom; Salesforce; Digital Commerce 360]", tickers: "AMZN · XRT · BBY",
    rec: "WATCH: tallies above forecast support the AMZN bull spreads; in-line spending is the base case." },
  { id: "c6", ind: "consumer", dayIdx: 10, future: true, impact: 2, dir: "BULLISH", conf: 1, basis: "Quarter EPS consensus up 4.5% to $1.17 from $1.12 (2 up / 0 down) and FY to $10.59 from $10.51 over 30 days [Nasdaq estimate-momentum]",
    headline: "Wed Dec 2 AMC: Five Below Q3 (EST. date per Nasdaq; cons. EPS $1.17, up from $1.12) and American Eagle ($0.50); Macy's and Signet BMO (EST.) [Nasdaq calendar & estimates]", tickers: "FIVE · AEO · M",
    rec: "WATCH: leans bullish on rising estimates; FIVE is −13% in 3 months, so a beat has room. Confirm the date first." },
  { id: "c7", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "BULLISH", conf: 1, basis: "Quarter EPS consensus $1.39 → $1.40, 2 up / 0 down over 30 days [Nasdaq estimate-momentum]; skew roughly neutral (wide quotes), not counted",
    headline: "Thu Dec 3 BMO: Dollar General Q3 (CONFIRMED by company; call 9:00 ET; cons. EPS $1.40; Dec 4 straddle ±9.6%) after DLTR's beat-and-raise [DG release via Finviz; Nasdaq estimates & option chain]", tickers: "DG · DLTR",
    rec: "WATCH: leans bullish on rising estimates; +8% in a month raises the bar, and the FTC pricing suit is the downside branch." },
  { id: "c8", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "BULLISH", conf: 1, basis: "Quarter EPS consensus $5.60 → $5.62, 2 up / 0 down over 30 days [Nasdaq estimate-momentum]; skew slightly call-leaning on wide quotes, not counted",
    headline: "Thu Dec 3 AMC: Ulta Q3 (CONFIRMED; call 4:30 pm ET; cons. EPS $5.62; straddle ±9.1%; Oppenheimer PT to $735) [Ulta release via Finviz; Nasdaq estimates & option chain]", tickers: "ULTA",
    rec: "WATCH: leans bullish on rising estimates; +19% in 3 months means a raise is expected." },
  { id: "c9", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Dec 3: Kroger Q3 BMO (EST.; cons. $1.17; revisions flat; straddle ±6.4%), PVH and Hormel BMO; Tesla annual meeting 3:00 pm CT (votes on Musk, Denholm, Straubel; CONFIRMED by DEF 14A) [Nasdaq; SEC DEF 14A]", tickers: "KR · TSLA · PVH",
    rec: "WATCH: last report's bullish KR lean is dropped: revisions are flat and the skew signal is gone." },
  { id: "c10", ind: "consumer", dayIdx: 16, future: true, impact: 1, dir: "BEARISH", conf: 1, basis: "Quarter EPS consensus cut to $35.98 from $36.29 over the month [Nasdaq calendar & estimate-momentum]",
    headline: "Tue Dec 8: AutoZone FQ1 BMO (EST.; cons. EPS $35.98) and Casey's AMC (EST.; $6.01); Campbell's and Chewy Dec 9 BMO (EST.) [Nasdaq calendar & estimates]", tickers: "AZO · CASY · CPB",
    rec: "WATCH: leans bearish on a trimmed estimate; a low-conviction call on a defensive name." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "QQQ", name: "Invesco QQQ Trust (Nasdaq-100) — index hedge", rank: 1, spot: "$638.10 (Tue Nov 24 close, −1.99%; after-hours $634.99; pre-mkt n/a at build ~2 am ET — Nasdaq-100 futures −1.4% vs 4 pm imply ~$629, ESTIMATE) [Yahoo Finance chart / Nasdaq last trade $635.05]", sentiment: "Bearish",
    catalyst: "Index hedge, no earnings · Oct PCE today Nov 25 8:30 ET (CONFIRMED; cons. core +0.3% m/m) · ISM mfg + JOLTS Dec 1 · MRVL/CRDO Dec 1 AMC, CRM/SNOW Dec 2 AMC · jobs report Dec 4 (CONFIRMED) · FOMC Dec 9, +25 bp ~93–96% priced · AVGO/ADBE Dec 9 AMC · ex-dividend date n/a (all short legs are puts)",
    iv: "IV ~34% (Dec 18 ATM puts), ~31% (Jan 15) · IVR n/a · no single-name binary; PCE/jobs/FOMC are the macro binaries · 1σ to Dec 18 ±$54.5 (±8.5%), Jan 15 ±$73.9", liq: "A — Tue full session ~2.50M contracts (P/C 1.24), 20d avg ~61.1M shares/day; OI 50,659 / 67,692 on the Dec 640P/600P, 51,651 / 62,908 on the Dec 620P/590P, 28,742 / 24,935 on the Jan 630P/590P; legs 1.4–2.2% wide [Nasdaq option chain; Yahoo]",
    thesis: "NEW (index hedge plus the tech view). Monday's AI squeeze reversed in one session: the Nasdaq-100 fell 2.0% Tuesday while the Dow closed at a record, the SOX dropped 7.9% with all 30 members down after HPE and ADI guided margins and capex the wrong way, and Asian chips crashed overnight (KOSPI −6.2%; Nasdaq futures −1.4%). QQQ is 10% below its 50-day ($708) and under its 200-day ($683), RSI 39, with VIX (26.4) above VIX3M (25.5). Risk: breadth is not broken (55% of the S&P is above its 50-day as money rotates to healthcare and value), Dell's blowout or a soft PCE could restart the squeeze, and this routine's recent bear calls were run over by the Nov 23 squeeze. Invalid above $655 (Monday closed $651.03, high $657.53). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wider)", text: "Buy $630P / sell $590P (mids 25.000 − 13.470) · Jan 15 '27 · debit $11.53 · capital ~$1,153 · max profit ~$2,847 · BE $618.47 · R:R 1:2.47 · POP ~42% · exit +75–100% (~$20.18–23.06) / stop −50% (~$5.77) or a close above $655 — 7 weeks spans payrolls, the FOMC and CPI; long Δ −0.42, short at ~0.65σ. ESTIMATE ~$13.14 debit if QQQ opens near $629 with futures" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $640P / sell $600P (mids 22.300 − 10.000) · Dec 18 '26 · debit $12.30 · capital ~$1,230 · max profit ~$2,770 · BE $627.70 · R:R 1:2.25 · POP ~44% · exit +75–100% (~$21.53–24.60) / stop −50% (~$6.15) or a close above $655 — at-the-money long (Δ −0.48), short at ~0.7σ just below the Nov 20 close ($608.45); spans PCE, payrolls and the FOMC. ESTIMATE ~$14.58 debit (capital ~$1,458, inside the cap) at a ~$629 open" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $620P / sell $590P (mids 14.935 − 8.150) · Dec 18 '26 · debit $6.79 · capital ~$679 · max profit ~$2,321 · BE $613.21 · R:R 1:3.42 · POP ~34% · exit +75–100% (~$11.88–13.58) / stop −50% (~$3.40) or a close above $655 — OTM follow-through bet (long Δ −0.35, short at ~0.9σ); a spread, not a long put, because IV is ~34% with VIX 26. ESTIMATE ~$8.17 at a ~$629 open" },
    ] },
  { ticker: "IBIT", name: "iShares Bitcoin Trust ETF", rank: 2, spot: "$33.76 (Tue Nov 24 close, −2.48%; after-hours $33.65; Bitcoin −1.2% since 4 pm to ~$59.1K implies ~$33.34 pre-mkt, ESTIMATE) [Yahoo Finance chart / Nasdaq last trade $33.69]", sentiment: "Bearish",
    catalyst: "Spot-BTC ETF outflows: −$570M Mon, −$231.6M Tue (IBIT −$175.3M), record −$4.71B in November (CoinDesk / The Block) · Bitcoin below $60K · no fund-specific binary before expiry · macro: PCE Nov 25, jobs Dec 4, FOMC Dec 9 (hike priced) with DXY ~104",
    iv: "IV ~53% (Dec 18 ATM), ~50% (Jan 15) · IVR n/a · put skew steep (30P 62% vs 38C 49% on Dec 18) · 1σ to Dec 18 ±$4.5 (±13.4%), Jan 15 ±$6.3", liq: "A — Tue full session ~537k contracts (P/C 1.26), 20d avg ~55.6M shares/day; OI 17,914 / 8,174 on the Dec 34P/31P, 20,268 / 32,697 on the Dec 33P/30P, 22,146 / 45,349 on the Jan 34P/30P; legs 1.1–3.1% wide, ≤$0.03 [Nasdaq option chain; Yahoo]",
    thesis: "CARRIED and re-set (last report's put spreads +17% to +23%). Bitcoin lost $60K again overnight (~$59.1K) as ETF outflows ran a 5th straight day to a record −$4.71B for November; IBIT fell 2.5% Tuesday and is −25% in a month, 24% below its 50-day ($44.18) and under its 200-day ($40.82), making lower lows into a priced Fed hike. Strikes move down $1 to the new spot. Risk: RSI 25 is deeply oversold, put/call 1.26 shows crowded hedges, and a relief squeeze like Monday's (+4.9%) can come fast. Invalid above $37 (the Nov 16 close was $36.79). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wider)", text: "Buy $34P / sell $30P (mids 2.550 − 1.155) · Jan 15 '27 · debit $1.39 · capital ~$139 · max profit ~$261 · BE $32.61 · R:R 1:1.88 · POP ~46% · exit +75–100% (~$2.43–2.78) / stop −50% (~$0.70) or a close above $37 — near-the-money long (Δ −0.47), short at ~0.6σ; 7 weeks spans the FOMC. ESTIMATE ~$1.49 debit at ~$33.34" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $34P / sell $31P (mids 1.900 − 0.850) · Dec 18 '26 · debit $1.05 · capital ~$105 · max profit ~$195 · BE $32.95 · R:R 1:1.86 · POP ~45% · exit +75–100% (~$1.84–2.10) / stop −50% (~$0.53) or a close above $37 — at-the-money long (Δ −0.49), short at ~0.6σ. ESTIMATE ~$1.15 debit at ~$33.34" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM, tight)", text: "Buy $33P / sell $30P (mids 1.465 − 0.650) · Dec 18 '26 · debit $0.82 · capital ~$82 · max profit ~$218 · BE $32.18 · R:R 1:2.66 · POP ~38% · exit +75–100% (~$1.43–1.64) / stop −50% (~$0.41) or a close above $37 — pays on a break below $33 (Nov 20 close $33.02, low $32.62); a spread, not a long put, because put skew is steep. ESTIMATE ~$0.90 at ~$33.34" },
    ] },
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", rank: 3, spot: "$81.49 (Tue Nov 24 close, −0.24%; after-hours $81.41; 10-yr futures +0.3% since 4 pm, under the 1% re-price threshold) [Yahoo Finance chart / Nasdaq last trade $81.41]", sentiment: "Bullish",
    catalyst: "Oct PCE + Q3 GDP 2nd est. TODAY Nov 25 8:30 ET (CONFIRMED; cons. core +0.3% m/m vs Cleveland Fed nowcast 0.267%) · ISM/JOLTS Dec 1 · jobs Dec 4 (CONFIRMED; Kalshi median ~+90–95K vs prior +165K) · FOMC Dec 9, +25 bp priced · monthly ex-dividend early Dec (date n/a; short legs are OTM calls)",
    iv: "IV ~15% (Dec 18 ATM puts), ~14% (Jan 15); call IVs read low because of the dividend · IVR n/a · no binary on the ETF itself · 1σ to Dec 18 ±$3.1, Jan 15 ±$4.3", liq: "A — Tue full session ~686k contracts (P/C 0.81), 20d avg ~38.5M shares/day; OI 42,231 / 199,358 on the Dec 81C/84C, 76,239 / 42,900 on the Jan 80C/84C, 49,448 / 30,402 on the Jan 82C/86C; legs 1.9–4.4% wide, ≤$0.05 [Nasdaq option chain; Yahoo]",
    thesis: "CARRIED and re-set (last report's call spreads −7% to −12%, the stock flat). The long bond held near its highs through the equity swings: the 10-yr is ~4.91% (5.12% a week ago), the 2-yr has rallied 17 bp since Nov 18 to 4.63%, TLT sits above its 50-day ($80.10) with RSI 57, and a 25 bp hike is fully priced, so the Cleveland Fed's soft core-PCE nowcast (0.267% vs 0.3%) and Kalshi's slower-payrolls median give room for long yields to ease. Risk: 12-month inflation expectations hit 5.7%, Williams won't rule out back-to-back hikes, Waller floats 50 bp, and a hot PCE today would hit it at the open. Invalid below $80 (the 50-day). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread (in-the-money, longer-dated)", text: "Buy $80C / sell $84C (mids 2.085 − 0.530) · Jan 15 '27 · debit $1.56 · capital ~$156 · max profit ~$244 · BE $81.56 · R:R 1:1.56 · POP ~48% · exit +75–100% (~$2.73–3.12) / stop −50% (~$0.78) or a close below $80 — ITM long (Δ ~0.85) through the FOMC and CPI; short at $84 (~0.6σ)" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $81C / sell $84C (mids 1.065 − 0.225) · Dec 18 '26 · debit $0.84 · capital ~$84 · max profit ~$216 · BE $81.84 · R:R 1:2.57 · POP ~45% · exit +75–100% (~$1.47–1.68) / stop −50% (~$0.42) or a close below $80 — slightly ITM long, short at $84 (~0.8σ); spans PCE, payrolls and the FOMC" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $82C / sell $86C (mids 1.070 − 0.275) · Jan 15 '27 · debit $0.80 · capital ~$80 · max profit ~$320 · BE $82.80 · R:R 1:4.00 · POP ~37% · exit +75–100% (~$1.40–1.60) / stop −50% (~$0.40) or a close below $80 — pays on a growth-scare move toward a ~4.6% 10-yr; a spread keeps the cost under $1" },
    ] },
  { ticker: "GLD", name: "SPDR Gold Shares", rank: 4, spot: "$325.45 (Tue Nov 24 close, −2.27%; after-hours $325.20; gold futures −0.9% since 4 pm imply ~$322.4, under the 1% re-price threshold) [Yahoo Finance chart / Nasdaq last trade $325.20]", sentiment: "Bearish",
    catalyst: "Fed-hike repricing: +25 bp Dec 9 ~93–96% priced, Polymarket 23.5% for Dec–Jan–Mar hikes · Oct PCE today Nov 25 (CONFIRMED) · jobs Dec 4 · FOMC Dec 9 (CONFIRMED) · CPI Dec 10 just after · no fund binary; no dividend",
    iv: "IV ~31% (Dec 18 ATM puts), ~29% (Jan 15) · IVR n/a (rich vs gold's usual high-teens) · 1σ to Dec 18 ±$25.7 (±7.9%), Jan 15 ±$35.8", liq: "A — Tue full session ~378k contracts (P/C 1.03), 20d avg ~10.8M shares/day; OI 4,797 / 1,698 on the Dec 325P/305P, 2,614 / 9,210 on the Dec 315P/300P, 1,565 / 11,019 on the Jan 325P/300P; legs 1.9–5.4% wide [Nasdaq option chain; Yahoo]",
    thesis: "RE-ADDED (bearish in the Nov 20 and Nov 22 reports at $335.18 / $322.87). Gold slid 2.3% Tuesday to near a 15-month low (~$3,551 spot, ~$3,518 overnight) as a December hike became fully priced and equity margin calls forced selling; silver fell 5.6%. GLD is −11.5% in a month, 13% below its 50-day ($372) and 20% under its 200-day ($405), with lower highs since Monday's failed bounce to $333. Risk: RSI 30 is oversold, Tuesday's dollar dip did not help gold (selling looks forced, which can exhaust), and a soft PCE or a dovish dot plot would trigger a sharp short-covering rally. Invalid above $336 (above Monday's $333 bounce high close). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wider)", text: "Buy $325P / sell $300P (mids 13.225 − 5.325) · Jan 15 '27 · debit $7.90 · capital ~$790 · max profit ~$1,710 · BE $317.10 · R:R 1:2.16 · POP ~43% · exit +75–100% (~$13.83–15.80) / stop −50% (~$3.95) or a close above $336 — at-the-money long (Δ −0.45), short at ~0.7σ; 7 weeks spans the FOMC and CPI" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $325P / sell $305P (mids 9.825 − 3.700) · Dec 18 '26 · debit $6.12 · capital ~$612 · max profit ~$1,388 · BE $318.88 · R:R 1:2.27 · POP ~41% · exit +75–100% (~$10.71–12.24) / stop −50% (~$3.06) or a close above $336 — at-the-money long (Δ −0.46), short at ~0.8σ near the $305 round number" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM, tight)", text: "Buy $315P / sell $300P (mids 6.100 − 2.915) · Dec 18 '26 · debit $3.18 · capital ~$318 · max profit ~$1,182 · BE $311.82 · R:R 1:3.72 · POP ~31% · exit +75–100% (~$5.57–6.36) / stop −50% (~$1.59) or a close above $336 — OTM follow-through (long Δ −0.32, short at ~1σ); a spread, not a long put, because IV is ~31%" },
    ] },
  { ticker: "AMZN", name: "Amazon.com", rank: 5, spot: "$252.29 (Tue Nov 24 close, −1.21%; after-hours $251.46; pre-mkt n/a at build ~2 am ET — Nasdaq futures −1.4% are the risk) [Yahoo Finance chart / Nasdaq last trade $251.50]", sentiment: "Bullish",
    catalyst: "Black Friday Nov 27 (Adobe: $12.9B, +9.2%) and Cyber Monday Nov 30 ($15.1B, +6.2%) · AWS re:Invent Nov 30–Dec 4, CEO keynote Dec 1 (CONFIRMED) · next earnings ~late Jan/early Feb (EST., after expiry) · no dividend",
    iv: "IV ~40% (Dec 18 ATM), ~37% (Jan 15) · IVR n/a · no earnings before expiry · 1σ to Dec 18 ±$25.3 (±10.0%)", liq: "A — Tue full session ~374k contracts (P/C 0.67), 20d avg ~54.0M shares/day; OI 12,067 / 11,965 on the Dec 220P/225P, 17,254 / 20,373 on the Dec 250C/270C, 25,533 / 32,196 on the Dec 260C/280C; legs 3.3–8.5% wide, ≤$0.13 on options under $2.50 [Nasdaq option chain; Yahoo]",
    thesis: "NEW. Amazon is the relative-strength name in a falling Nasdaq: +1.3% in a month vs the Nasdaq-100's −10.5%, back at its 50-day ($255.15) and above its 200-day ($245.59), RSI 47. Two in-window catalysts are its own: holiday e-commerce (Adobe sees Cyber Week +7.4% and Conference Board confidence just jumped to 103.3) and AWS re:Invent, where AI revenue disclosures are the bull case. Spreads keep vega low at ~40% IV, and the put credit tier sits beyond 1σ. Risk: AMZN still trades with mega-cap tech, which the QQQ hedge in this list is betting against, and more AI capex without revenue would hurt. Invalid below $244 (a close under the 200-day). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $225P / buy $220P (mids 2.445 − 1.840) · Dec 18 '26 · credit $0.60 · capital ~$440 · max profit ~$60 · BE $224.40 · R:R 1:0.14 · POP ~85% · exit +50% (buy back ~$0.30) / stop on a close below $244; close by Dec 11 (7 days to expiry) — income tier: short strike beyond 1σ (~$227) and below the 200-day; no earnings before expiry" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $250C / sell $270C (mids 11.950 − 3.500) · Dec 18 '26 · debit $8.45 · capital ~$845 · max profit ~$1,155 · BE $258.45 · R:R 1:1.37 · POP ~39% · exit +75–100% (~$14.79–16.90) / stop −50% (~$4.23) or a close below $244 — near-the-money long (Δ 0.57), short at ~0.7σ; spans Black Friday, Cyber Monday and re:Invent" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $260C / sell $280C (mids 6.925 − 1.535) · Dec 18 '26 · debit $5.39 · capital ~$539 · max profit ~$1,461 · BE $265.39 · R:R 1:2.71 · POP ~29% · exit +75–100% (~$9.43–10.78) / stop −50% (~$2.70) or a close below $244 — OTM breakout through the 50-day (long Δ 0.41, short at ~1.1σ); a spread because IV is ~40%" },
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Wednesday, Nov 25 2026 · trading day, built pre-market ~2 am ET · stock quotes = Tue Nov 24 close (Yahoo chart, cross-checked with Nasdaq last trade) · option quotes, OI &amp; volume = Nasdaq option chain after the Tue Nov 24 session · stock pre-market n/a at build time; futures ~1:45 am ET: Nasdaq-100 −1.4%, S&amp;P −0.7%; QQQ and IBIT debits re-estimated (ESTIMATE) · NYSE closed Thu Nov 26, 1 pm close Fri Nov 27</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Jun 5)
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
