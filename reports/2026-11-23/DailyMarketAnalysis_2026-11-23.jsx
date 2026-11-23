import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Monday, November 23, 2026 — trading-day edition (built ~2 am ET, before the pre-market session).
 * Data as of the Fri Nov 20 close: stock quotes = Yahoo Finance chart, cross-checked with the Nasdaq quote; option quotes, OI & volume = Nasdaq option chain after the Fri Nov 20 session.
 * Overnight: index futures ~2 am ET (S&P +2.0%, Nasdaq-100 +2.8%, Russell +1.8%); IWM premiums re-priced at the futures-implied level (ESTIMATE); stock pre-market n/a at build time.
 * Window: last 3 days (Nov 20) → coming 2 weeks (Dec 7).
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
  health:   { label: "Healthcare / Pharma", color: "#10b981" },
  finance:  { label: "Financials / Rates / Indexes / Crypto", color: "#a855f7" },
  consumer: { label: "Consumer / Retail",  color: "#ef4444" },
};

const DIR = {
  BULLISH: { glyph: "↑", label: "Bullish" },
  BEARISH: { glyph: "↓", label: "Bearish" },
  MIXED:   { glyph: "↔", label: "Mixed / uncertain" },
};

// 18-day axis: Nov 20 .. Dec 7 (last 3 days → coming 2 weeks). Today = index 3 (Nov 23).
const DAYS = [
  { idx: 0, date: "Nov 20", dow: "Fri" },
  { idx: 1, date: "Nov 21", dow: "Sat" },
  { idx: 2, date: "Nov 22", dow: "Sun" },
  { idx: 3, date: "Nov 23", dow: "Mon" }, // TODAY
  { idx: 4, date: "Nov 24", dow: "Tue" },
  { idx: 5, date: "Nov 25", dow: "Wed" },
  { idx: 6, date: "Nov 26", dow: "Thu" },
  { idx: 7, date: "Nov 27", dow: "Fri" },
  { idx: 8, date: "Nov 28", dow: "Sat" },
  { idx: 9, date: "Nov 29", dow: "Sun" },
  { idx: 10, date: "Nov 30", dow: "Mon" },
  { idx: 11, date: "Dec 1", dow: "Tue" },
  { idx: 12, date: "Dec 2", dow: "Wed" },
  { idx: 13, date: "Dec 3", dow: "Thu" },
  { idx: 14, date: "Dec 4", dow: "Fri" },
  { idx: 15, date: "Dec 5", dow: "Sat" },
  { idx: 16, date: "Dec 6", dow: "Sun" },
  { idx: 17, date: "Dec 7", dow: "Mon" },
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
const LEAN_RECORD = { hits: 1, misses: 3, since: "2026-11-16" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SOFTWARE / SEMIS -----------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Fri Nov 20: NVIDIA −14.01% to $125.53 on 633M shares after Reuters reported SEC enforcement staff are examining potential accounting issues (no wrongdoing established; SEC declined comment, NVIDIA did not respond); California's AG also subpoenaed NVIDIA over chips reaching China. Interim CEO Colette Kress has run the company since Jensen Huang resigned Nov 12 [Reuters via Yahoo; TechCrunch; CNBC; Yahoo chart; Nasdaq]", tickers: "NVDA · SMH",
    rec: "SELL/AVOID new longs while the probe is open; a bear put debit spread fits (see Top Option Plays). A close back above $146 (Thursday) would end the bear case." },
  { id: "t2", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Fri Nov 20: chip and AI-infrastructure rout. SMH −10.6% to $400.06 (−23.6% in a month); MU −13.9%, AMD −13.3% (now just below its 200-day), AVGO −12.2%, ARM −14.1%, SNDK and NBIS −16.1%, TSM −9.5%; KEYS −7.1% despite guiding ~20% FY27 growth [Cappnotes; Stocktitan; Yahoo chart]", tickers: "SMH · MU · AMD",
    rec: "WATCH: capitulation-like volume, but nothing has turned yet. One NVDA bet already covers the group, so do not stack semis shorts." },
  { id: "t3", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Fri Nov 20: AI-funding and dilution worries. Oracle −8.5% to $101.19 (a 52-week closing low, −19.3% on the week), Marvell −11.7% to $122.28 (Lumentum all-stock deal), Dell −11.0% to $278.02 into earnings, HPE −10.1% [Yahoo chart; Nasdaq quote]", tickers: "ORCL · MRVL · DELL",
    rec: "AVOID: no support until the funding questions are answered; see the ORCL bear put spreads in Top Option Plays." },
  { id: "t4", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Fri Nov 20: Intuit −12.8% to $270.44 after FQ1; it is also selling Mailchimp. Software stayed weak: CRM −1.5% (RSI 20.7, −27.8% in a month), SNOW −5.1% [Stocktitan; Yahoo chart]", tickers: "INTU · CRM · IGV",
    rec: "HOLD/AVOID adds: guidance drove the drop; wait for a base before buying software." },
  { id: "t5", ind: "tech", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Fri Nov 20: Bloomberg/Reuters report that CrowdStrike is in talks to buy Zscaler; no deal or price has been confirmed and nothing new came over the weekend. CRWD −5.8% to $229.44, ZS −5.3% at the close after an intraday jump [Bloomberg/Reuters via search; Yahoo chart]", tickers: "CRWD · ZS",
    rec: "WATCH: deal-dilution risk for CRWD before its Dec 1 print; ZS is event-driven, so no edge here." },
  { id: "t7", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Sat Nov 21: Summit Insights cuts NVIDIA to Hold from Buy, citing the leadership change and new Commerce Department rules on chip sales to Southeast Asian cloud providers [Investing.com]", tickers: "NVDA",
    rec: "WATCH: the first downgrade after the SEC report; more may follow if NVIDIA stays silent." },
  { id: "t9", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Mon Nov 23: Asian chips slide again. Kospi fell almost 6% at its low (a sidecar was triggered) before closing about −3.2%; Samsung and SK Hynix about −3.6%; Taiwan +2% after tightening short-selling rules. Nasdaq-100 futures +2.8% at ~2 am ET [investingLive; Reuters/MarketScreener; Yahoo futures]", tickers: "NVDA · SMH · QQQ",
    rec: "WATCH the open: a futures bounce after a −10% SOX day is normal; the bear plays need it to fail below Thursday's closes." },
  { id: "t10", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Mon Nov 23 AMC: HPE FQ4 (CONFIRMED; Nasdaq cons. EPS $1.18, 3 up / 0 down revisions; one tracker shows $1.28), Zoom (CONFIRMED; webinar 5:00 ET), Agilent and Jacobs (EST.). HPE's Nov 27 straddle prices ~±14.1% [HPE IR; Zoom notice; Nasdaq estimates & option chain; TheStreet]", tickers: "HPE · ZM",
    rec: "WATCH: rising estimates vs a 19-vol-point put skew (signals disagree, so no lean)." },
  { id: "t11", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Tue Nov 24 AMC: Dell Q3 FY27 (CONFIRMED; cons. EPS $6.55, 2 up / 0 down revisions; revenue est. ~$50.3B), HP Inc (~$0.75), Workday (~$2.75), Autodesk (guide $3.04–3.09), Nutanix (EST.). Dell's Nov 27 straddle prices ~±16.4%; 250P IV 158% vs 305C 142% [company notices; Nasdaq estimates & option chain; digrin]", tickers: "DELL · HPQ · WDAY",
    rec: "WATCH (both ways): rising estimates vs steep put skew, so no lean. A beat with steady AI-server margins could squeeze a stock −38.6% in a month; a margin miss breaks it again. Defined risk only." },
  { id: "t12", ind: "tech", dayIdx: 4, future: true, impact: 2, dir: "BEARISH", conf: 1, basis: "Nov 27 put skew +15.5 vol pts (312.5P 95.1% vs 380C 79.5%) [Nasdaq option chain]; the single FY revision down is too thin to count",
    headline: "Tue Nov 24, 7:00 ET: Analog Devices FQ4 (CONFIRMED; cons. EPS $3.89; FY revisions 0 up / 1 down). ADI −8.35% Friday to $345.92; Nov 27 straddle ~±9.8% [ADI notice; Nasdaq estimates & option chain]", tickers: "ADI · SMH",
    rec: "WATCH: leans bearish on the steep put skew; a firm guide would show the chip rout is indiscriminate. A bear put spread fits only below $330." },
  { id: "t13", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 – Fri Dec 4: AWS re:Invent, Las Vegas (CONFIRMED); Rubrik reports Nov 30 AMC [AWS; company release via Finviz]", tickers: "AMZN · RBRK",
    rec: "WATCH: AI-capex payback is exactly what the market now doubts; AMZN −4.1% Friday to $246.82." },
  { id: "t14", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1, 8:30–10:30 am PT: AWS CEO Matt Garman's re:Invent keynote (CONFIRMED); the UBS Global Tech & AI conference opens (AMD presents Dec 1, HPE Dec 2; CONFIRMED on IR pages) [AWS APN blog; AMD and HPE IR]", tickers: "AMZN · AMD",
    rec: "WATCH: concrete AI revenue would help the group; another capex step-up without revenue would not." },
  { id: "t15", ind: "tech", dayIdx: 11, future: true, impact: 3, dir: "BEARISH", conf: 2, basis: "Dec 4 put skew +21.5 vol pts (110P 139.7% vs 135C 118.2%) [Nasdaq option chain]; FQ3 EPS revisions 0 up / 1 down, FY 1 up / 2 down [Nasdaq estimate momentum]",
    headline: "Tue Dec 1 AMC: Marvell FQ3 (CONFIRMED; call 1:30 PT; company guide EPS ~$1.10, Nasdaq consensus $0.79), CrowdStrike (~$0.31), Okta (~$0.93), MongoDB (guide $756–761M) (all CONFIRMED). MRVL's Dec 4 straddle prices ~±20.4% [company releases; Nasdaq estimates & option chain; TheStreet]", tickers: "MRVL · CRWD · OKTA",
    rec: "WATCH: bearish lean on MRVL (Lumentum dilution plus the steepest put skew in the screen). Avoid long premium at ~130% IV; a bear call spread well above $150 is the vega-short way to express it." },
  { id: "t16", ind: "tech", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Dec 2 AMC: Salesforce FQ3 (CONFIRMED; call 5:00 ET) and Snowflake (CONFIRMED; 2:00 PT). CRM Dec 4 straddle ~±13.1% (put skew only +4.4 pts); SNOW ~±18.0% [company notices; Nasdaq option chain]", tickers: "CRM · SNOW",
    rec: "WATCH: deeply oversold software (CRM RSI 20.7). A stable FY guide could spark a relief rally; a cut extends the Intuit-style de-rating. No sourced lean." },
  // ---- ENERGY / COMMODITIES --------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Fri Nov 20: gold futures −4.6% to $3,515 (a 14.5-month low); GLD −3.67% to $322.87 (RSI 23.7, 14% below its 50-day), silver ~−7%. Metals fell even as yields dropped, a sign of liquidation [Yahoo chart; Cappnotes]", tickers: "GLD · SLV · GDX",
    rec: "HOLD shorts with care: the trend is down but the selling looks forced; see today's rebound." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Fri Nov 20: WTI +0.9% to $83.98 on Iran worries and pre-holiday buying, a third straight weekly loss; XOM +0.7% to $159.99 and CVX +0.9% while the S&P fell 3.7% [Yahoo chart; Cappnotes]", tickers: "USO · XOM · XLE",
    rec: "HOLD energy as a relative-strength hedge; XLE (−10.5% in a month, below its 50-day) is not a buy on trend. XOM chains are too wide (>10%) for a play." },
  { id: "e3", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "TODAY Mon Nov 23: gold futures +3.0% overnight to ~$3,620 and silver +2–2.6% as the liquidation pauses; WTI ~$83.3 (−0.8%) [Yahoo futures; investingLive]", tickers: "GLD · SLV",
    rec: "WATCH: this rebound puts GLD near last report's $335 invalidation level, so the GLD bear play is dropped; re-short only on a failed rally below $335." },
  { id: "e4", ind: "energy", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "Wed Nov 25, 10:30 ET: EIA weekly petroleum status report; EIA lists no Thanksgiving change (EST. timing) [eia.gov schedule]", tickers: "USO · UNG",
    rec: "WATCH: a holiday-thinned print; avoid new size into it." },
  { id: "e5", ind: "energy", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "Wed Nov 25 BMO: Deere FQ4 (CONFIRMED; call 9:00 CT; cons. EPS ~$4.03–4.07). DE −9.55% on the week; Nov 27 straddle ~±7.6% [Deere notice; Nasdaq option chain]", tickers: "DE",
    rec: "HOLD: a read on farm demand; put skew is moderate (+7.5 pts), so no lean." },
  { id: "e6", ind: "energy", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Sun Nov 29: OPEC+ online meeting of the 8-country core group plus the full ministerial meeting on 2027 quotas (CONFIRMED by OPEC's Nov 1 release) [opec.org; Reuters via WorldOil]", tickers: "USO · XLE · XOM",
    rec: "WATCH (both ways): deeper cuts lift USO and XLE on Monday Nov 30; a quota fight or higher baselines hits crude (USO already −14% in a month)." },
  // ---- HEALTHCARE / PHARMA ---------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Fri Nov 20: managed care bounces on TD Cowen upgrades (reported Nov 20); UNH +2.84% to $339.85 and HUM +2.63% to $390.00 while the S&P fell 3.7%. UNH is still −20% in a month and below its 50-day ($388.70) and 200-day ($368.54) [Yahoo chart; Nasdaq quote; Nov 22 report]", tickers: "UNH · HUM",
    rec: "HOLD: CMS's RADV audit proposal is still open; wait for a close above the 200-day before buying." },
  { id: "h3", ind: "health", dayIdx: 0, future: false, impact: 1, dir: "BULLISH",
    headline: "Fri Nov 20: defensive health care holds up. XLV −0.12% (above its 50-day $176.50); LLY −0.3%; MDT −0.7% to $99.94, still above its 50- and 200-day [Cappnotes; Yahoo chart]", tickers: "XLV · LLY · MDT",
    rec: "HOLD: health care is the second-best sector in the rout; a relative-strength hiding place, not a buy signal on its own." },
  { id: "h5", ind: "health", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Medtronic FQ2 (CONFIRMED; results 5:45 CT; cons. EPS ~$1.33). MDT Nov 27 straddle ~±4.4%; put skew +10.6 pts, in line with the market's [Medtronic notice; Nasdaq option chain]", tickers: "MDT · XLV",
    rec: "HOLD: a defensive large cap; an in-line print keeps it a relative-strength name." },
  { id: "h7", ind: "health", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27 PDUFA dates (ESTIMATED): BridgeBio BBP-418 for LGMD2I/R9 (on two trackers) and GSK neladalkib for ALK+ NSCLC (one tracker) [BiopharmaWatch; Finviz]", tickers: "BBIO · GSK",
    rec: "WATCH: binary outcomes on a holiday-thinned session; defined risk only." },
  { id: "h8", ind: "health", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 PDUFA dates (ESTIMATED): Vertex povetacicept in IgA nephropathy (two trackers) and Cogent bezuclastinib + sunitinib in GIST [BiopharmaWatch; second tracker]", tickers: "VRTX · COGT",
    rec: "WATCH: approval is largely expected for VRTX; the label breadth matters more." },
  // ---- FINANCIALS / RATES / INDEXES / CRYPTO ---------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Fri Nov 20: S&P 500 −3.70% to 6,910.39 (−8.6% on the week, a 7-day losing streak), Nasdaq Composite −5.28%, Russell 2000 −2.76%, Dow −1.93% to 48,147. Only 26% of S&P stocks are above their 50-day; CNN Fear & Greed 10. VIX 35.89 vs VIX3M 30.94, in backwardation [Cappnotes; PalmaFutures; Yahoo chart]", tickers: "SPY · QQQ · IWM",
    rec: "HOLD hedges; do not buy the dip until VIX falls back below VIX3M. The IWM bear put spread (see Top Option Plays) is the index hedge." },
  { id: "f2", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Fri Nov 20: Treasuries rally on the growth scare. 10-yr 4.91–4.95% (sources differ), 2-yr ~4.63–4.65%, 2s10s ~+29 bp; TLT +1.37% to $81.45, back above its 50-day ($80.07) [Yahoo chart; Cappnotes; PalmaFutures]", tickers: "TLT · IEF",
    rec: "BUY dips in TLT while it holds $80; see the TLT call spreads in Top Option Plays." },
  { id: "f3", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Fri Nov 20: Bitcoin falls under $60K (~$58.8K); IBIT −5.9% to $33.02, MSTR −9.7% to $77.80, COIN −6.3% to $101.97 (all at 52-week closing lows) [Yahoo chart]", tickers: "IBIT · MSTR · COIN",
    rec: "AVOID: oversold (IBIT RSI 17.5), but no base yet." },
  { id: "f5", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Sat–Sun Nov 21–22: Bitcoin hits a 2-year low of $55,640, then rebounds to ~$61,000 by Sunday night [Bitcoin.com; CoinDesk; Yahoo]", tickers: "IBIT · COIN",
    rec: "WATCH: a weekend washout and reversal; it needs to hold $60K Monday to count as a bottom." },
  { id: "f6", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Sun Nov 22: Treasury Secretary Bessent (CBS Face the Nation) says the Fed 'may be making a policy mistake if they over-tighten'; Governor Waller still backs a 50 bp hike. CME FedWatch ~93% for +25 bp on Dec 9 (read via secondary sources) [investingLive; CNBC; KuCoin/PalmaFutures]", tickers: "TLT · SPY",
    rec: "WATCH: political pressure for a smaller hike supports TLT; a hawkish Fed into a crash is the equity risk." },
  { id: "f8", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Mon Nov 23, ~2 am ET: US futures rebound. S&P 500 futures ~7,074 (+2.0%), Nasdaq-100 +2.8%, Russell 2000 +1.8%, Dow +1.4%; the 10-yr yield is up 3–4 bp to ~4.94% [Yahoo futures; investingLive]", tickers: "SPY · QQQ · IWM",
    rec: "WATCH: an oversold reflex rally is likely; it only matters if SPY gets back above Thursday's close (~$716) and holds." },
  { id: "f9", ind: "finance", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "TODAY Mon Nov 23: 2-yr note auction ($69B; CONFIRMED by Treasury), S&P flash PMIs 9:45 ET (cons. mfg 54.5, services 55.6), NY Fed President Williams speaks 4:00 ET (EST.) [Treasury schedule; FXEmpire; TheStreet]", tickers: "TLT · SPY",
    rec: "WATCH: a weak auction would cap the Treasury rally; Williams is the last big Fed voice before Wednesday's data." },
  { id: "f10", ind: "finance", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24: 5-yr note auction ($70B; CONFIRMED), Conference Board consumer confidence 10:00 ET (cons. ~92.1–92.5, prior 91.7), Case-Shiller, Richmond Fed [Treasury; financecalendar; AskTraders; FXEmpire]", tickers: "TLT · XLY",
    rec: "WATCH: confidence taken after the crash could drop more than consensus expects." },
  { id: "f11", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "BULLISH", conf: 1, basis: "Cleveland Fed nowcast core PCE +0.27% m/m vs ~0.3% consensus (a slightly soft surprise → TLT up) [Cleveland Fed, updated Nov 20; TheStreet/FXEmpire]",
    headline: "Wed Nov 25, 8:30 ET: October PCE (cons. core +0.3% m/m, 3.2% y/y), Q3 GDP 2nd estimate (cons. ~3.4–3.6%), personal income and spending, durable goods and jobless claims (all CONFIRMED by BEA/Census/BLS); 7-yr auction; Beige Book 2:00 pm [bea.gov; census.gov; federalreserve.gov; TheStreet; FXEmpire]", tickers: "TLT · SPY · IWM",
    rec: "WATCH (both ways): a soft core print (≤0.25%) helps the TLT call spreads; a hot one (≥0.35%) revives 50 bp hike talk and hits TLT and IWM." },
  { id: "f12", ind: "finance", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Thu Nov 26: Thanksgiving, NYSE closed. Fri Nov 27: equities close 1:00 pm ET (eligible options 1:15), bonds 2:00 pm; 8:30 ET advance goods trade and inventories (Census) (CONFIRMED) [nyse.com; census.gov]", tickers: "SPY",
    rec: "WATCH: thin holiday liquidity can exaggerate moves; avoid opening size on Friday." },
  { id: "f13", ind: "finance", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Sat Nov 28: Fed blackout begins (EST., second-Saturday rule) ahead of the Dec 8–9 FOMC (CONFIRMED; decision Dec 9, 2:00 pm), with ~93% priced for a 25 bp hike; no Chair testimony is on the Fed calendar [federalreserve.gov; FedWatch via secondary sources]", tickers: "TLT · SPY",
    rec: "WATCH: with Fed speakers silent, the data (PCE, ISM, jobs) sets the size of the December hike." },
  { id: "f15", ind: "finance", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1, 10:00 ET: October JOLTS (CONFIRMED by BLS), construction spending (CONFIRMED by Census), ISM manufacturing (EST. timing; ISM page login-walled) [bls.gov; census.gov]", tickers: "TLT · SPY",
    rec: "WATCH: weak data supports TLT; strong data plus firm prices-paid hits bonds again." },
  { id: "f18", ind: "finance", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Fri Dec 4, 8:30 ET: November jobs report (CONFIRMED by BLS), the last major input before the Dec 9 FOMC; UMich preliminary sentiment 10:00 ET (EST.); S&P quarterly rebalance announcement likely after the close (EST.) [bls.gov; financecalendar]", tickers: "TLT · SPY · IWM",
    rec: "WATCH (both ways): a weak print supports TLT and could trim hike odds; a hot print pushes 50 bp talk and hits IWM." },
  { id: "f19", ind: "finance", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Mon Dec 7: 3-yr note auction (CONFIRMED; 10-yr Dec 8, 30-yr Dec 10) and Fed consumer credit 3:00 pm (CONFIRMED) [Treasury schedule; federalreserve.gov]", tickers: "TLT",
    rec: "WATCH: auction demand into FOMC week." },
  // ---- CONSUMER / RETAIL -----------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Fri Nov 20: defensive rotation. Staples the only green sector (+0.67%); XLP $90.46, WMT +1.52% to $127.95, COST +0.76% to $1,102.15 (near its high), while discretionary fell 2.95% [Cappnotes; Yahoo chart]", tickers: "WMT · XLP · COST",
    rec: "BUY defensives on dips; XLP options are thin, so WMT is the liquid way to express it (see Top Option Plays)." },
  { id: "c3", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Fri Nov 20: Tesla −7.6% to $345.82 (below its 50- and 200-day) despite ongoing SpaceX merger talks (a deal could come 'as soon as December'; nothing signed) [Yahoo chart; Investing.com/Reuters]", tickers: "TSLA",
    rec: "WATCH: high-beta selling; the merger is the wild card both ways." },
  { id: "c5", ind: "consumer", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Best Buy (~$1.49; EST.), Dollar Tree (~$0.91; EST.), Burlington (~$1.73; call 8:30 ET; CONFIRMED), Dick's (~$1.42; CONFIRMED), Abercrombie (~$3.08; EST.), J.M. Smucker, Kohl's (EST.). BBY Nov 27 straddle ~±9.6% with a mild +5.2 pt put skew [company releases; TheStreet; FXEmpire; Nasdaq option chain]", tickers: "BBY · DLTR · BURL",
    rec: "WATCH: holiday-guide season; cautious guides would confirm Ross's weaker-discretionary warning." },
  { id: "c6", ind: "consumer", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27: Black Friday on a half-day session (NYSE closes 1:00 pm ET); online-spend tallies follow over the weekend [nyse.com]", tickers: "WMT · AMZN · XRT",
    rec: "WATCH: strong tallies support WMT and AMZN; spending near the forecast is already the base case." },
  { id: "c7", ind: "consumer", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30: Cyber Monday; no scheduled data release (Adobe tallies follow) [search: no release found]", tickers: "AMZN · XRT",
    rec: "WATCH: AMZN's re:Invent keynote follows Tuesday; a strong Cyber Monday plus AI news is the bull case." },
  { id: "c9", ind: "consumer", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Dec 3: Dollar General BMO (~$1.41; CONFIRMED date), PVH BMO (CONFIRMED; call 8:00 ET), Kroger BMO (~$1.16; EST.), Ulta AMC (~$5.64; CONFIRMED; call 4:30 ET); Lululemon is listed Dec 3 or Dec 9 (EST., conflicting) [company notices; TheStreet; Earnings Whispers]", tickers: "DG · KR · ULTA",
    rec: "WATCH: trade-down winners (DG, KR) vs discretionary beauty (ULTA); no sourced lean." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "NVDA", name: "NVIDIA", rank: 1, spot: "$125.53 (Fri Nov 20 close, −14.01%; post-mkt ~$128.37; pre-mkt n/a at build time ~2 am ET, Nasdaq-100 futures +2.8%) [Yahoo Finance chart / Nasdaq quote & option chain]", sentiment: "Bearish",
    catalyst: "SEC accounting inquiry reported Nov 20 (open-ended; no company statement through Mon ~2 am) · California AG subpoena on China chip flows · Summit Insights cut to Hold Nov 21 · interim CEO since Huang resigned Nov 12 · no earnings before expiry · macro: PCE Nov 25, ISM/JOLTS Dec 1, jobs Dec 4, FOMC Dec 9 (~93% priced for +25 bp)",
    iv: "IV ~80% (Dec 18 ATM), ~67% (Jan 15) · IVR n/a · no earnings before expiry · 1σ to Dec 18 ±$26.3 (±20.9%), Jan 15 ±$32.1", liq: "A — Fri full session ~5.16M contracts across post-Nov-20 expiries (P/C 0.72), 20d avg ~287M shares/day; OI 33.0k / 23.5k on the Jan 130P/110P, 27.3k / 18.8k on the Dec 125P/110P, 3.0k / 3.0k on the Dec 118P/108P; legs 0–4.6% wide [Nasdaq option chain; Yahoo]",
    thesis: "Carried and re-set: last report's three NVDA put spreads are unchanged at Friday's marks (no session since). Seven straight losses (−40.9% in a month, −22.9% on the week) on 633M shares, a close 39% below the 50-day ($207.00), an SEC accounting inquiry and a state subpoena, plus a leadership vacuum and a first downgrade (Summit, Nov 21): overhangs that will not clear inside a month. Put debit spreads cut the ~80% vega. Risk: RSI 15.0 is extreme and Nasdaq futures are +2.8% overnight; a reflex rally can be violent, and the probe 'doesn't establish any wrongdoing'. If NVDA opens more than 3% above $125.53, re-price before entering. Invalid above $146 (Thursday's close). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wider)", text: "Buy $130P / sell $110P (mids 15.025 − 6.900) · Jan 15 '27 · debit $8.12 · capital ~$812 · max profit ~$1,188 · BE $121.88 · R:R 1:1.46 · POP ~50% · exit +75–100% (~$14.21–16.24) / stop −50% (~$4.06) or a close above $146 — slightly in the money (Δ −0.49) with 7½ weeks to ride out a reflex bounce; short leg ~0.5σ lower" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $125P / sell $110P (mids 10.600 − 5.175) · Dec 18 '26 · debit $5.42 · capital ~$542 · max profit ~$958 · BE $119.58 · R:R 1:1.77 · POP ~45% · exit +75–100% (~$9.48–10.84) / stop −50% (~$2.71) or a close above $146 — at-the-money long (Δ −0.44), short at $110 (−12%, inside the 1σ low of ~$99)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM, tight)", text: "Buy $118P / sell $108P (mids 7.800 − 4.800) · Dec 18 '26 · debit $3.00 · capital ~$300 · max profit ~$700 · BE $115.00 · R:R 1:2.33 · POP ~38% · exit +75–100% (~$5.25–6.00) / stop −50% (~$1.50) or a close above $146 — cheap follow-through bet below the 52-week low; a spread, not a long put, at ~80% IV" },
    ] },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", rank: 2, spot: "$256.61 (Fri Nov 20 close, −2.88%; post-mkt ~$256.68; Russell 2000 futures +1.79% at ~2 am ET imply ~$261.19, so premiums below are ESTIMATES re-priced at that level) [Yahoo Finance chart / Nasdaq option chain; Yahoo futures]", sentiment: "Bearish",
    catalyst: "INDEX HEDGE · PCE Wed Nov 25 8:30 (CONFIRMED; cons. core +0.3% m/m) · ISM + JOLTS Tue Dec 1 · jobs report Fri Dec 4 (CONFIRMED) · FOMC Dec 8–9 with ~93% priced for +25 bp · CPI Dec 10 (CONFIRMED)",
    iv: "IV ~32% (Dec 18 ATM), ~29% (Jan 15) · IVR n/a · put skew steep (240P 39% vs 270C 28%) · 1σ to Dec 18 ±$21.9 (±8.4%), Jan 15 ±$28.9", liq: "A — Fri full session ~1.60M contracts (P/C 3.32), 20d avg ~26.3M shares/day; OI 37.1k / 53.7k on the Jan 265P/240P, 126.6k / 71.8k on the Dec 260P/245P, 85.8k / 54.7k on the 250P/235P; legs 1.7–3% wide [Nasdaq option chain; Yahoo]",
    thesis: "Portfolio hedge for a RISK-OFF tape, carried and re-set at the futures-implied price. The Russell is −7.5% on the week and below its 50-day ($278.26) and 200-day ($279.57) with lower highs since Nov 11; breadth is broken (26% of S&P stocks above their 50-day), and the Fed is still set to hike into slowing data. Small caps are the most rate-sensitive index, so a hot PCE or payrolls print should hit them hardest. Risk: P/C volume of 3.32 shows hedges are crowded, Fear & Greed is 10, and Bessent's 'over-tighten' warning hints at a softer Fed; a squeeze is the main threat. Invalid above $265 (Thursday's close $264.22). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wider)", text: "Buy $265P / sell $240P (ESTIMATE mids 12.201 − 4.625) · Jan 15 '27 · debit $7.58 · capital ~$758 · max profit ~$1,742 · BE $257.42 · R:R 1:2.30 · POP ~47% · exit +75–100% (~$13.27–15.16) / stop −50% (~$3.79) or a close above $265 — spans the FOMC (Dec 9) and CPI (Dec 10); short leg just above the $235.60 52-week low" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $260P / sell $245P (ESTIMATE mids 7.698 − 3.569) · Dec 18 '26 · debit $4.13 · capital ~$413 · max profit ~$1,087 · BE $255.87 · R:R 1:2.63 · POP ~42% · exit +75–100% (~$7.23–8.26) / stop −50% (~$2.06) or a close above $265 — near-the-money long (Δ ≈ −0.49 at the futures-implied spot), short at ~0.75σ" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $250P / sell $235P (ESTIMATE mids 4.598 − 2.190) · Dec 18 '26 · debit $2.41 · capital ~$241 · max profit ~$1,259 · BE $247.59 · R:R 1:5.22 · POP ~28% · exit +75–100% (~$4.22–4.82) / stop −50% (~$1.21) or a close above $265 — pays if the crash extends to the 52-week low; a spread, not a long put, because put skew is steep" },
    ] },
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", rank: 3, spot: "$81.45 (Fri Nov 20 close, +1.37%; post-mkt flat; 10-yr futures −0.2% overnight, under the 1% re-price threshold) [Yahoo Finance chart / Nasdaq option chain & quote]", sentiment: "Bullish",
    catalyst: "PCE + Q3 GDP Wed Nov 25 8:30 (CONFIRMED; Cleveland Fed core-PCE nowcast +0.27% m/m vs ~0.3% cons.) · 2/5/7-yr auctions Nov 23–25 · ISM + JOLTS Dec 1 · jobs Dec 4 · FOMC Dec 9 · CPI Dec 10 · monthly ex-dividend in early Dec (date n/a; short calls are OTM)",
    iv: "IV ~15–16% (Dec 18 and Jan 15 ATM, from puts; call IVs read low because of the dividend) · IVR n/a · no binary on the ETF itself · 1σ to Dec 18 ±$3.4, Jan 15 ±$4.8", liq: "A — Fri full session ~1.75M contracts (P/C 0.67), 20d avg ~36.6M shares/day; OI 82.4k / 30.2k on the Jan 80C/84C, 45.2k / 197.4k on the Dec 81C/84C; legs 2.6–9% wide, ≤$0.03 [Nasdaq option chain; Yahoo]",
    thesis: "Carried and re-set: last report's TLT spreads are unchanged at Friday's marks. The crash brought a flight-to-quality bid (10-yr ~4.91–4.95%, down from 5.15% a week ago), TLT reclaimed its 50-day ($80.07), the core-PCE nowcast runs slightly under consensus, and Treasury Secretary Bessent is now warning the Fed against over-tightening. Low IV keeps call spreads cheap. Risk: the Fed is ~93% priced to hike Dec 9, yields are up 3–4 bp overnight as equities bounce, and a hot PCE, payrolls or weak auctions would push the 10-yr back toward 5%. Invalid below $80 (the 50-day). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread (in-the-money, longer-dated)", text: "Buy $80C / sell $84C (mids 2.270 − 0.700) · Jan 15 '27 · debit $1.57 · capital ~$157 · max profit ~$243 · BE $81.57 · R:R 1:1.55 · POP ~48% · exit +75–100% (~$2.75–3.14) / stop −50% (~$0.79) or a close below $80 — in-the-money long (Δ 0.80) through the FOMC and CPI; short at $84 (~0.5σ)" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $81C / sell $84C (mids 1.240 − 0.335) · Dec 18 '26 · debit $0.91 · capital ~$91 · max profit ~$209 · BE $81.91 · R:R 1:2.30 · POP ~44% · exit +75–100% (~$1.59–1.82) / stop −50% (~$0.46) or a close below $80 — slightly ITM long, short at ~0.75σ ($84); spans PCE, payrolls and the FOMC" },
      { profile: "Aggressive", strategy: "Long Call", text: "Buy $84C (mids 0.700) · Jan 15 '27 · debit $0.70 · capital ~$70 · max profit uncapped · BE $84.70 · POP ~24% · exit +75–100% (~$1.22–1.40) / stop −50% (~$0.35) or a close below $80; close with ≥10 days left (by Jan 5) — Δ 0.31 at ~11–15% IV, cheap in absolute terms; a growth-scare move toward a 4.6% 10-yr would beat the implied move" },
    ] },
  { ticker: "ORCL", name: "Oracle", rank: 4, spot: "$101.19 (Fri Nov 20 close, −8.48%; Nasdaq last $101.17; pre-mkt n/a at build time) [Yahoo Finance chart / Nasdaq quote & option chain]", sentiment: "Bearish",
    catalyst: "FQ2 FY27 earnings ~Thu Dec 10 AMC (EST.; not yet confirmed; last year Dec 10) · cons. EPS $1.56 (qtr revisions 0 up / 1 down) · AI data-center funding and lease-commitment worries · macro: PCE Nov 25, jobs Dec 4, FOMC Dec 9",
    iv: "IV ~93% (Dec 18 ATM, includes earnings), ~81% (Jan 15) · IVR n/a · implied earnings move n/a (no expiry isolates it) vs hist. n/a · 1σ to Dec 18 ±$24.6 (±24.3%), Jan 15 ±$31.2", liq: "A — Fri full session ~385k contracts (P/C 1.28), 20d avg ~42.1M shares/day; OI 6.1k / 4.2k on the Jan 105P/85P, 24.9k / 32.5k on the Dec 105P/90P, 13.1k / 5.1k on the Dec 95P/85P; legs 2–5.5% wide [Nasdaq option chain; Yahoo]",
    thesis: "NEW, replacing GLD (gold +3% overnight puts it near last report's $335 invalidation). Oracle has closed lower for 7 straight sessions (−19.3% on the week, −59% from its $248 high) to a 52-week closing low 24% below its 50-day ($132.14), as the market questions the funding of its AI data-center build-out; the earnings bar is set by a falling estimate (0 up / 1 down). Bear put debit spreads keep vega short-ish into a ~93% IV print. Risk: RSI 31.8 and a −19% week argue for a bounce, and a strong RPO or capex-funding update at earnings could squeeze it hard. Invalid above $111 (Thursday's close $110.57). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wider)", text: "Buy $105P / sell $85P (mids 14.300 − 6.175) · Jan 15 '27 · debit $8.12 · capital ~$812 · max profit ~$1,188 · BE $96.88 · R:R 1:1.46 · POP ~51% · exit +75–100% (~$14.21–16.24) / stop −50% (~$4.06) or a close above $111 — in-the-money long (Δ −0.48) spanning the ~Dec 10 (EST.) print; short at $85 (~0.5σ)" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $105P / sell $90P (mids 12.175 − 5.925) · Dec 18 '26 · debit $6.25 · capital ~$625 · max profit ~$875 · BE $98.75 · R:R 1:1.40 · POP ~51% · exit +75–100% (~$10.94–12.50) / stop −50% (~$3.12) or a close above $111 — near-the-money long (Δ −0.50) through earnings; the short $90 leg cuts vega at ~92% IV" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $95P / sell $85P (mids 7.675 − 4.525) · Dec 18 '26 · debit $3.15 · capital ~$315 · max profit ~$685 · BE $91.85 · R:R 1:2.17 · POP ~39% · exit +75–100% (~$5.51–6.30) / stop −50% (~$1.57) or a close above $111 — OTM bet that earnings break the stock below $95; a tight spread keeps IV-crush risk small" },
    ] },
  { ticker: "WMT", name: "Walmart", rank: 5, spot: "$127.95 (Fri Nov 20 close, +1.52%; post-mkt flat; pre-mkt n/a at build time) [Yahoo Finance chart / Nasdaq quote & option chain]", sentiment: "Bullish",
    catalyst: "Black Friday Nov 27 (half-day session) and Cyber Monday Nov 30 · Q3 FY27 beat-and-raise Nov 19 · no earnings before expiry · ex-dividend before expiry n/a (not verified; all short calls are OTM)",
    iv: "IV ~28% (Dec 18 ATM), ~27% (Jan 15) · IVR n/a · no binary before expiry · 1σ to Dec 18 ±$9.4 (±7.3%), Jan 15 ±$13.2", liq: "A — Fri full session ~153k contracts (P/C 1.11), 20d avg ~23.7M shares/day; OI 12.3k / 19.7k on the Jan 120C/130C, 11.7k / 10.8k on the Dec 125C/135C, 8.9k on the 130C; legs 2.7–9.5% wide [Nasdaq option chain; Yahoo]",
    thesis: "Carried and re-set (spot is unchanged, so are the strikes): the cleanest defensive leader. WMT rose 1.52% on the S&P's −3.7% day, sits above its 50-day ($116.65) and 200-day ($118.99), is +5.6% in a month and 5% below its $134.20 closing high, and staples were the only green sector Friday. Call spreads keep the cost defined; WMT's put spreads are too wide to use. Risk: the bullish plays of the last three reports mostly failed, a risk-on bounce (futures +2%) could rotate money out of defensives, and RSI 64 is a high bar. Invalid below $125. Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread (in-the-money, longer-dated)", text: "Buy $120C / sell $130C (mids 10.950 − 4.650) · Jan 15 '27 · debit $6.30 · capital ~$630 · max profit ~$370 · BE $126.30 · R:R 1:0.59 · POP ~53% · exit +75–100% (~$11.03–12.60) / stop −50% (~$3.15) or a close below $125 — ITM long (Δ 0.76) with a breakeven below spot" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $125C / sell $135C (mids 5.850 − 1.445) · Dec 18 '26 · debit $4.40 · capital ~$440 · max profit ~$560 · BE $129.40 · R:R 1:1.27 · POP ~42% · exit +75–100% (~$7.70–8.80) / stop −50% (~$2.20) or a close below $125 — slightly ITM long (Δ 0.65), short at the $135 high zone (~0.75σ)" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM, tight)", text: "Buy $130C / sell $135C (mids 3.150 − 1.445) · Dec 18 '26 · debit $1.70 · capital ~$170 · max profit ~$330 · BE $131.70 · R:R 1:1.94 · POP ~33% · exit +75–100% (~$2.98–3.40) / stop −50% (~$0.85) or a close below $125 — a breakout bet toward the $134.20 closing high on holiday data" },
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
// today line sits on the boundary between Nov 23 and Nov 24
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Monday, Nov 23 2026 · trading day, built pre-market ~2 am ET · stock quotes = Fri Nov 20 close (Yahoo chart, cross-checked with Nasdaq) · option quotes, OI &amp; volume = Nasdaq option chain after the Fri Nov 20 session · stock pre-market n/a at build time; futures ~2 am ET: S&amp;P +2.0%, Nasdaq-100 +2.8%, Russell +1.8% (IWM premiums re-priced = ESTIMATE)</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Nov 23)
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
