import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Tuesday, November 24, 2026 — trading-day edition (built ~2 am ET, before the pre-market session).
 * Data as of the Mon Nov 23 close: stock quotes = Yahoo Finance chart, cross-checked with Nasdaq option-chain put-call parity and news recaps; option quotes, OI & volume = Nasdaq option chain after the Mon Nov 23 session.
 * Overnight: index futures ~2 am ET +0.2–0.3%; after-hours prints within 1% of the close except CRWD (+1.5%, ESTIMATE re-prices noted); stock pre-market n/a at build time.
 * Window: last 3 days (Nov 21) → coming 2 weeks (Dec 8).
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

// 18-day axis: Nov 21 .. Dec 8 (last 3 days → coming 2 weeks). Today = index 3 (Nov 24).
const DAYS = [
  { idx: 0, date: "Nov 21", dow: "Sat" },
  { idx: 1, date: "Nov 22", dow: "Sun" },
  { idx: 2, date: "Nov 23", dow: "Mon" },
  { idx: 3, date: "Nov 24", dow: "Tue" }, // TODAY
  { idx: 4, date: "Nov 25", dow: "Wed" },
  { idx: 5, date: "Nov 26", dow: "Thu" },
  { idx: 6, date: "Nov 27", dow: "Fri" },
  { idx: 7, date: "Nov 28", dow: "Sat" },
  { idx: 8, date: "Nov 29", dow: "Sun" },
  { idx: 9, date: "Nov 30", dow: "Mon" },
  { idx: 10, date: "Dec 1", dow: "Tue" },
  { idx: 11, date: "Dec 2", dow: "Wed" },
  { idx: 12, date: "Dec 3", dow: "Thu" },
  { idx: 13, date: "Dec 4", dow: "Fri" },
  { idx: 14, date: "Dec 5", dow: "Sat" },
  { idx: 15, date: "Dec 6", dow: "Sun" },
  { idx: 16, date: "Dec 7", dow: "Mon" },
  { idx: 17, date: "Dec 8", dow: "Tue" },
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
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Mon Nov 23: NVIDIA's board unanimously reinstates Jensen Huang as CEO, citing 'input from senior levels of the US government'; Trump says 'I convinced them.' NVDA +31.5% to $165.05, its best day since 2003 (~$950B of value), +1.1% after hours [Investing.com; Reuters via Yahoo; Yahoo chart]", tickers: "NVDA · SMH",
    rec: "BUY on pullbacks, defined risk: the leadership overhang is gone (see the NVDA call spreads in Top Option Plays). A close back below $146 would reopen the bear case." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Mon Nov 23: chip and AI-infrastructure short squeeze. SMH +15.0% to $460.18, MU +19.0% (new multi-year supply deals), DELL +20.5%, INTC +16.3%, MRVL +18.4%, ADI +9.5%, CoreWeave +22.3%, Arm +16.1% [Motley Fool; Insider Monkey; Yahoo chart]", tickers: "SMH · MU · DELL",
    rec: "HOLD winners and trim into strength: SMH is still 16% below its 50-day ($545.88). One NVDA bet already covers the group, so do not stack semis longs." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 23: CrowdStrike agrees to buy Zscaler in an all-stock deal (~$43.9B; 1.135 CRWD per ZS, a 34% premium; ZS holders ~15.9%) and posts Q3 revenue $1.58B (+28%), ARR $6.26B, net-new ARR guide raised. CRWD −8.9% to $208.97 on a +6.9% Nasdaq-100 day; ZS +17.7% to $229.24 [TheStreet; Simply Wall St; CRWD 8-K; Yahoo chart]", tickers: "CRWD · ZS · PANW",
    rec: "SELL/AVOID CRWD while the deal overhang lasts; a bear put debit spread fits (see Top Option Plays). A close above $230 ends the bear case." },
  { id: "t4", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 23 AMC: HPE Q4 beat (rev $14.5B vs $14.3B, adj. EPS $1.43 vs $1.28) and raised FY27 to as much as $63.1B revenue, but the Q1 guide of $14.0–14.6B missed the $14.7B high-end estimate; −8% after hours after a +17.4% regular session to $48.02 [Stocktwits; Zacks; Barron's]", tickers: "HPE · DELL",
    rec: "HOLD/AVOID adds: a soft guide after a +17% day is a warning for tonight's Dell print." },
  { id: "t5", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Mon Nov 23 AMC: Zoom Q3 beat (EPS $1.59 vs $1.49, rev $1.29B vs $1.28B) and starts a $0.25 dividend, but the Q4 revenue guide midpoint was slightly short of $1.30B; flat to −1.1% after hours after +5.9% to $86.03 [Bloomberg; Investing.com]", tickers: "ZM",
    rec: "HOLD: an income story now, not a growth one; no edge either way." },
  { id: "t6", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 23: Anthropic (ANT) reverses from +5.4% at the open to close −1.4% at $87.64, ~20% below its first trade two sessions after its IPO; commentators cite the White House push for open-weight AI [Motley Fool; Yahoo]", tickers: "ANT",
    rec: "WATCH: no option history yet; wait for a base before buying the new issue." },
  { id: "t7", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "TODAY Tue Nov 24 (overnight): Asia chips extend the rally. Taiwan +9.1% (TSMC and Foxconn near limit-up), Kospi +7%, Nikkei +4.6–5%; China lags on export-curb fears. S&P and Nasdaq futures +0.25% at ~2 am ET [Reuters; Investing.com; Yahoo futures]", tickers: "SMH · TSM · NVDA",
    rec: "WATCH the open: follow-through above Monday's highs would confirm the squeeze; a fade below Monday's close would warn that it was short covering." },
  { id: "t8", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Tue Nov 24 BMO: Analog Devices FQ4 (EST. timing; cons. EPS $3.89, rev $4.32B; 10%-OTM put/call price ratio 1.53, straddle ~6.9%) after a +9.5% Monday to $378.75 [Nasdaq; Investing.com; Nasdaq option chain]", tickers: "ADI · TXN · NXPI",
    rec: "WATCH: an industrial-recovery read for analog chips; a firm guide holds the 200-day ($378.41)." },
  { id: "t9", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Tue Nov 24 AMC: Dell Q3 FY27 (CONFIRMED by press; cons. EPS $6.56, rev $49.24B; revisions 2 up / 0 down; straddle ~13%). HPE's light guide is a negative read-through, so the signals disagree [Investing.com; Nasdaq estimates & option chain; Barron's]", tickers: "DELL · HPE · NVDA",
    rec: "WATCH (both ways): AI-server margins are the swing factor after a +20% day; defined risk only." },
  { id: "t10", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Tue Nov 24 AMC: HP Inc FQ4 (CONFIRMED; cons. EPS $0.75, rev $15.43B; revisions 0 up / 2 down; memory-cost risk), Workday (CONFIRMED; $2.75), Autodesk (EST.; $3.07), Nutanix and Urban Outfitters (EST.) [Investing.com; Workday IR; Nasdaq; Trefis]", tickers: "HPQ · WDAY · ADSK",
    rec: "WATCH: HPQ's falling estimates make a cautious PC guide the likelier risk; WDAY (RSI 35) needs a stable guide to base." },
  { id: "t11", ind: "tech", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 – Fri Dec 4: AWS re:Invent, Las Vegas (CONFIRMED); CEO Matt Garman's keynote Tue Dec 1, 8:30–10:30 PT. Rubrik reports Nov 30 AMC (EST.; cons. EPS −$0.38) [AWS events page; AWS partner blog; Nasdaq]", tickers: "AMZN · NVDA · RBRK",
    rec: "WATCH: AI revenue disclosures help AMZN (back at its 50-day, $255.07); more capex without revenue would not." },
  { id: "t12", ind: "tech", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Tue Dec 1: Huang testifies before House committees (China, Intelligence, Foreign Affairs), with NVIDIA's general counsel on Dec 2 (EST.); the committees say the reinstatement does 'not erase the national security threats'; SEC and California inquiries remain open [Stocktwits]", tickers: "NVDA",
    rec: "WATCH: the main risk to the NVDA call spreads; a calm hearing removes another overhang, new export-control demands would hit the stock." },
  { id: "t13", ind: "tech", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "Tue Dec 1 AMC: Marvell FQ3 (CONFIRMED by IR; cons. EPS $0.79; revisions 0 up / 1 down; Dec 4 straddle ~15.9%, volume P/C 0.30, 10%-OTM skew flat at 1.04), plus Okta (CONFIRMED; $0.43), MongoDB (CONFIRMED; $0.08), Credo and NetApp (EST.) [Marvell, Okta, MongoDB releases; Nasdaq estimates & option chain]", tickers: "MRVL · OKTA · MDB",
    rec: "WATCH: last report's bearish lean is dropped: the put skew flattened after Monday's +18% and call volume dominates, so the signals now disagree." },
  { id: "t15", ind: "tech", dayIdx: 11, future: true, impact: 3, dir: "BEARISH", conf: 1, basis: "10%-OTM put/call price ratio 1.15 and volume P/C 1.56 into the Dec 4 expiry [Nasdaq option chain, Nov 23 close]; EPS revisions 0/0 (no offset)",
    headline: "Wed Dec 2 AMC: Salesforce FQ3 (CONFIRMED by IR; cons. EPS $2.41; Dec 4 straddle ~11.7%) and Snowflake (CONFIRMED; −$0.32 GAAP basis; straddle ~15.9%); Zscaler Q1 (EST.) [Salesforce & Snowflake releases; Nasdaq estimates & option chain]", tickers: "CRM · SNOW · ZS",
    rec: "WATCH: leans bearish on put-heavy positioning. CRM (RSI 26.5, −25% in a month) could squeeze on a stable FY guide; a cut extends the de-rating. A bear put spread only below $180." },
  // ---- ENERGY / COMMODITIES --------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 23: Brent −3.5% to $89.37 (lowest close since Aug 31), WTI ~$80 (lowest since Aug 26) as Gulf exports surge (Saudi +1.18 mb/d) and Libya's Sharara reopens; Deutsche Bank sees a 1.7 mb/d surplus. WTI ~$79.7 overnight [Reuters via Yahoo; Stocktwits; Yahoo futures]", tickers: "USO · XLE · XOM",
    rec: "AVOID energy longs until OPEC+ (Sun Nov 29); USO is −21% in a month. XLE chains were too wide (>10%) to use for a play." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 23: energy lags the rally. XLE −1.1% to $59.87 (now at its 200-day), XOM −1.9% to $156.90, CVX −1.1%, COP −2.9%, OXY −2.2% [Yahoo chart; CNW]", tickers: "XLE · XOM · CVX",
    rec: "HOLD core positions only: a 200-day test with weak crude; a close below ~$59.8 opens more downside." },
  { id: "e3", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Nov 23–24: Hormuz risk persists. Iran's IRGC says three 'violating' tankers hit mines and caught fire; the US is probing cyberattacks on up to 50 tankers (WSJ); crude did not rally on the news [Reuters; Stocktwits]", tickers: "USO · FRO",
    rec: "WATCH: the market is pricing supply over risk; a real closure would reverse crude fast, so avoid shorting energy outright." },
  { id: "e4", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Mon Nov 23: gold futures +3.9% to ~$3,651 after last week's ~9% slide to a 14-month low; GLD +3.1% to $333.02 (still 11% below its 50-day). Overnight gold eases to ~$3,619–3,625 on Fed hike bets [Investing.com; Yahoo chart]", tickers: "GLD · NEM · AEM",
    rec: "WATCH: a relief bounce inside a downtrend; no re-entry either way until GLD clears its $341 (Nov 19) level or loses $323." },
  { id: "e6", ind: "energy", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Nov 25 BMO: Deere FQ4 (CONFIRMED; call 9:00 CT; cons. EPS $4.03, rev $10.4B; FY27 outlook is the key). Put-rich 10%-OTM skew (2.00) vs revisions 1 up / 0 down, so the signals disagree [Deere notice via Finviz; Investing.com; Nasdaq]", tickers: "DE · CAT · AGCO",
    rec: "HOLD: a farm-demand read; straddle ~6.7%, so defined risk only." },
  { id: "e7", ind: "energy", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "Wed Nov 25, 10:30 ET: EIA weekly petroleum status report, moved up for Thanksgiving (prior crude build +3.38M bbl) (CONFIRMED) [Nasdaq econ calendar; eia.gov]", tickers: "USO · XLE",
    rec: "WATCH: another build confirms the surplus story; a holiday-thinned print, so avoid new size." },
  { id: "e8", ind: "energy", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Sun Nov 29: OPEC+ full ministerial sets the 2027 production framework (CONFIRMED); output was held flat for Oct–Dec and ~2M b/d of cuts run through end-2026 [OPEC release; World Oil; Reuters]", tickers: "USO · XLE · XOM",
    rec: "WATCH (both ways): deeper cuts lift USO/XLE on Mon Nov 30; higher 2027 baselines extend the slide toward $75 WTI." },
  // ---- HEALTHCARE / PHARMA ---------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 23: CMS proposes a Star Ratings overhaul that cuts ~$107B of Medicare Advantage bonus payments over 2031–37 (TD Cowen: ~$11.5B in 2031; Mizuho sees 4-star-plus enrollment falling to 28% from 51.5%). UNH −1.1% to $336.08 after −6.5% at the open; HUM −1.6%, ELV −3.8%, CVS −1.5% [Investing.com; Bloomberg via Yahoo; TIKR]", tickers: "UNH · HUM · ELV",
    rec: "SELL rallies in managed care; a bear put debit spread on UNH fits (see Top Option Plays). A close above $350 would end the bear case." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Mon Nov 23: Kymera's oral STAT6 degrader KT-621 meets its Ph2b eczema endpoint (EASI −72% vs −27% placebo); KYMR +30.4% to $150.37, then prices an upsized $1.75B offering; REGN +2.3% [GlobeNewswire; BeInCrypto; IBD]", tickers: "KYMR · REGN · SNY",
    rec: "TRIM into the pop: the offering caps it near term; REGN's Dupixent threat is years away." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Mon Nov 23 AMC: Agilent Q4 beat (adj. EPS $1.86 vs $1.73, incl. a $0.07 tariff refund; rev $2.04B vs $1.99B) and guides FY27 above consensus (rev $8.00–8.15B vs $7.99B); ~+7% after hours [Investing.com]", tickers: "A · TMO · WAT",
    rec: "HOLD/BUY dips: a positive read for life-science tools; note that part of the beat is a one-off tariff refund." },
  { id: "h5", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Tue Nov 24 BMO: Medtronic FQ2 (EST. timing; cons. EPS $1.33, rev $9.48B; straddle ~3.8%; no sourced lean) [Nasdaq; Investing.com; Nasdaq option chain]", tickers: "MDT · BSX · ABT",
    rec: "HOLD: a defensive large cap above its 50- and 200-day; an in-line print keeps it a relative-strength name." },
  { id: "h7", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27: GSK neladalkib PDUFA for ALK+ NSCLC (goal date per trackers; EST.) on a 1:00 pm half-day session [Finviz; BiopharmaWatch]", tickers: "GSK",
    rec: "WATCH: a binary on a thin holiday session; defined risk only." },
  { id: "h8", ind: "health", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 PDUFAs: Vertex povetacicept in IgA nephropathy (accelerated approval) and Cogent bezuclastinib + sunitinib in GIST (goal dates per trackers) [BiopharmaWatch; Finviz]", tickers: "VRTX · COGT",
    rec: "WATCH: approval is largely expected for VRTX, so label breadth matters more; COGT is the bigger binary." },
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Mon Nov 23: best day since April 2025 ends a 7-day losing streak. S&P 500 +4.73% to 7,237.17 (still below its 50-day 7,618 and 200-day 7,350), Nasdaq-100 +6.86% to 26,746, Russell 2000 +3.40% to 2,669.66, Dow +3.0% to 49,595. VIX −25.8% to 26.62, still above VIX3M 25.50 [Yahoo chart; Investing.com]", tickers: "SPY · QQQ · IWM",
    rec: "HOLD: a relief rally, not yet a trend change; risk-on needs SPY back above its 200-day (~$733) and VIX below VIX3M. Last report's IWM put hedge was invalidated above $265." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Nov 23–24: a December hike is now fully priced (89% Friday; ~5% odds of 50 bp); NY Fed's Williams sees 'work to do' on inflation. The 10-yr is flat at ~4.92% while the 2-yr rises a second day to ~4.68%; the $69B 2-yr auction stopped at 4.700%; DXY ~104.3, a 20-month high [Reuters via Yahoo; Nasdaq; Yahoo chart]", tickers: "TLT · UUP · SPY",
    rec: "HOLD TLT call spreads: the long end ignored the equity rally; a curve flattening is the risk, not the opportunity." },
  { id: "f3", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Sat Nov 21: Bitcoin hits ~$55,250, its lowest since Sep 2024 (≈−21% in November); spot-BTC ETFs see ~$570M of outflows Monday after >$4B this month. BTC ~$60.4K overnight [Investing.com; TheStreet; Yahoo]", tickers: "IBIT · MSTR · COIN",
    rec: "SELL rallies: IBIT is below its 50- and 200-day; a bear put debit spread fits (see Top Option Plays). A close above $37 ends it." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 1, dir: "BULLISH",
    headline: "Mon Nov 23: crypto equities bounce with the tape. MSTR +8.5% to $84.40, COIN +6.7% to $108.78, IBIT +4.9% to $34.62, all lagging the Nasdaq-100's +6.9% [Yahoo chart; TheStreet]", tickers: "MSTR · COIN · IBIT",
    rec: "AVOID: underperformance on a squeeze day is a warning, not a bottom." },
  { id: "f5", ind: "finance", dayIdx: 2, future: false, impact: 1, dir: "BULLISH",
    headline: "Mon Nov 23: Wells Fargo Investment Institute upgrades US large caps to 'most favorable', calling S&P 7,000 an entry point; banks rally (GS +4.2% to $823.62, JPM +2.0%, BAC +2.3%, XLF +2.0%) [Stocktwits; Yahoo chart]", tickers: "XLF · GS · JPM",
    rec: "HOLD: XLF is still below its 50-day ($55.84); wait for a close above it." },
  { id: "f6", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Tue Nov 24: Conference Board consumer confidence 10:00 ET (cons. 92.4, prior 91.7), Richmond Fed (cons. −2) and the $70B 5-yr note auction 1:00 pm (prior 4.708%) (CONFIRMED) [Nasdaq econ calendar; Treasury]", tickers: "TLT · XLY",
    rec: "WATCH: confidence was surveyed during the crash and could undershoot; a weak auction would cap TLT." },
  { id: "f7", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "BULLISH", conf: 1, basis: "Cleveland Fed nowcast core PCE +0.27% m/m (3.21% y/y) vs +0.3% consensus, a slightly soft surprise → TLT up [clevelandfed.org, Nov 23; Nasdaq econ calendar]",
    headline: "Wed Nov 25, 8:30 ET: October PCE (cons. core +0.3% m/m, 3.2% y/y; headline +0.3%), Q3 GDP 2nd est. (cons. 3.4%), personal income/spending (+0.4%/+0.4%), durable goods (cons. 0.0%), jobless claims (201K), then new home sales, the 7-yr auction and the Beige Book at 2:00 pm (all CONFIRMED) [bea.gov; Nasdaq econ calendar; federalreserve.gov]", tickers: "TLT · SPY · IWM",
    rec: "WATCH (both ways): a soft core print (≤0.25%) helps the TLT call spreads; a hot one (≥0.35%) revives 50 bp talk and hits TLT and IWM." },
  { id: "f8", ind: "finance", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "Thu Nov 26: Thanksgiving, NYSE closed. Fri Nov 27: equities close 1:00 pm ET, bonds 2:00 pm (CONFIRMED) [nyse.com]", tickers: "SPY",
    rec: "WATCH: thin holiday liquidity exaggerates moves; avoid opening size on Friday." },
  { id: "f10", ind: "finance", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1, 10:00 ET: ISM manufacturing (prior 55.5, prices 75.2) and October JOLTS (prior 7.523M) (CONFIRMED); no consensus posted yet [ISM calendar; bls.gov; Nasdaq]", tickers: "TLT · XLI · SPY",
    rec: "WATCH: a high prices-paid reading hurts TLT; a weak headline supports it." },
  { id: "f12", ind: "finance", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Dec 3: ISM services (CONFIRMED) and jobless claims; RY, TD and CM report BMO (EST.) [ISM calendar; Nasdaq]", tickers: "SPY · XLY",
    rec: "WATCH: services strength keeps the Fed hiking into 2027 (Deutsche Bank sees three straight 25 bp moves)." },
  { id: "f13", ind: "finance", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "Fri Dec 4, 8:30 ET: November jobs report (CONFIRMED; prior payrolls 165K, unemployment 4.1%, AHE +0.4% m/m); UMich prelim 10:00 (prior 51.5); S&P quarterly rebalance announcement likely after the close (EST.; SpaceX not eligible) [bls.gov; Nasdaq; Axios/Bloomberg]", tickers: "TLT · SPY · IWM",
    rec: "WATCH (both ways): a weak print supports TLT and could cap the hike path; a hot one hits IWM and TLT." },
  { id: "f14", ind: "finance", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "Tue Dec 8: FOMC meeting opens (CONFIRMED; decision and projections Wed Dec 9, 2:00 pm). Kalshi prices a 25 bp hike at 93¢, hold 5¢, >25 bp 4¢; CME FedWatch has 25 bp fully priced. Also: trade balance (prior −$105.0B), Synopsys and Casey's AMC, AutoZone BMO (EST.) [federalreserve.gov; Kalshi; Reuters via Yahoo; Nasdaq]", tickers: "TLT · SPY · KRE",
    rec: "WATCH: the hike is consensus, so the dot plot and the statement are the surprise risk; no lean." },
  // ---- CONSUMER / RETAIL -----------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Mon Nov 23: Tesla +11.5% to $385.46 on autonomy progress and Musk cheering Huang's return; overnight the FT reports Tesla and SpaceX formed special committees to negotiate a possible all-stock merger (~$3.5T), with no agreement yet [Investing.com/FT; Motley Fool; Yahoo chart]", tickers: "TSLA",
    rec: "WATCH: back above its 50- and 200-day; the merger is a two-way wild card, so defined risk only." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Mon Nov 23: defensives lag the squeeze. XLP −0.1%, COST −0.4% to $1,097.91 (special $30 dividend payable early December), BJ's −3.3% to $101.41 despite a beat-and-raise (adj. EPS $1.73 vs $1.24), while XLY rose +4.0% [Zacks; Simply Wall St; Yahoo chart]", tickers: "XLP · COST · BJ",
    rec: "HOLD defensives, but stop adding: WMT (last report's bull play, +9–14% on the spreads) is a take-profit candidate as money rotates to beta." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 1, dir: "BULLISH",
    headline: "Mon Nov 23: Piper Sandler upgrades Dollar General to Overweight (PT $170 from $123); DG +2.8% to $134.18. Ten more states join the FTC deceptive-pricing suit (30 in total) [Investing.com; Retail Dive]", tickers: "DG · DLTR",
    rec: "HOLD: trade-down winner into its Dec 3 print; the legal overhang is a headline risk." },
  { id: "c5", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Tue Nov 24 BMO: Best Buy (EST.; cons. EPS $1.49, rev $9.88B; revisions 2 up / 0 down; straddle ~8.6%), Dollar Tree ($0.91), Burlington ($1.67; revisions 0 up / 4 down), Dick's ($1.38), Abercrombie ($3.15), J.M. Smucker ($2.55) [Investing.com; Nasdaq estimates & option chain]", tickers: "BBY · DLTR · BURL",
    rec: "WATCH: holiday guides are the swing factor; BURL's falling estimates make it the weakest setup." },
  { id: "c6", ind: "consumer", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27: Black Friday on a half-day session; CivicScience finds 40% of consumers plan to shop in store, the most since 2014 [Proactive; nyse.com]", tickers: "XRT · AMZN · WMT",
    rec: "WATCH: strong tallies support AMZN and WMT; spending near forecast is already the base case." },
  { id: "c8", ind: "consumer", dayIdx: 12, future: true, impact: 2, dir: "BULLISH", conf: 1, basis: "FQ3 EPS revisions 2 up / 0 down over 4 weeks [Nasdaq estimate momentum]; Piper Sandler upgrade to Overweight Nov 23 is the same evidence family, so it is not counted twice",
    headline: "Thu Dec 3 BMO: Dollar General Q3 (CONFIRMED by company; call 9:00 ET; cons. EPS $1.40; straddle ~9.7%) [DG release Nov 5; Nasdaq estimates & option chain]", tickers: "DG · DLTR",
    rec: "WATCH: leans bullish on rising estimates; a beat confirms trade-down demand, a cautious guide plus the FTC suit is the downside branch." },
  { id: "c9", ind: "consumer", dayIdx: 12, future: true, impact: 1, dir: "BULLISH", conf: 2, basis: "EPS revisions 1 up / 0 down [Nasdaq estimate momentum]; call-rich 10%-OTM skew 0.71 [Nasdaq option chain, Nov 23]",
    headline: "Thu Dec 3 BMO: Kroger Q3 (EST.; Nasdaq shows Dec 3, another tracker lists the Nov 26 holiday; cons. EPS $1.17) [Nasdaq; TipRanks]", tickers: "KR",
    rec: "WATCH: leans bullish; a defensive grocer, so a miss would be modest. Confirm the date first." },
  { id: "c10", ind: "consumer", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Dec 3 AMC: Ulta Q3 (EST.; cons. EPS $5.61; revisions 1 up / 0 down vs OI P/C 2.58, so the signals disagree); PVH and Brown-Forman BMO (EST.) [Nasdaq estimates & option chain]", tickers: "ULTA · PVH",
    rec: "WATCH: a read on discretionary beauty spending into the holidays." },
  { id: "c11", ind: "consumer", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Around Dec 8–9: SpaceX's final 180-day IPO lockup expires (EST.; ~11.96B shares per one source; sources disagree on the date) as Tesla–SpaceX merger talks continue [Cohen Milstein; BriMindInvest; FT via Investing.com]", tickers: "TSLA · SPCX",
    rec: "WATCH: lockup supply can weigh on SPCX, and a merger ratio would tie TSLA to it; no lean." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "CRWD", name: "CrowdStrike", rank: 1, spot: "$208.97 (Mon Nov 23 close, −8.92%; after-hours ~$212.07, +1.5%; pre-mkt n/a at build time ~2 am ET) [Yahoo Finance chart / Nasdaq option chain put-call parity ~$208.94]", sentiment: "Bearish",
    catalyst: "All-stock Zscaler deal announced Nov 23 (CONFIRMED; 1.135 CRWD per ZS, ~$43.9B, 34% premium; ZS holders get ~15.9%; close 2H FY28) · Q3 already reported Nov 23 (rev $1.58B +28%, ARR $6.26B, net-new-ARR guide raised) · no earnings before expiry · macro: PCE Nov 25, ISM/JOLTS Dec 1, jobs Dec 4, FOMC Dec 9",
    iv: "IV ~72% (Dec 18 ATM), ~65% (Jan 15) · IVR n/a · no binary before expiry · 1σ to Dec 18 ±$39.0 (±18.7%), Jan 15 ±$51.5", liq: "A — Mon full session ~194k contracts (P/C 0.71), 20d avg ~10.9M shares/day; OI 4,853 / 4,318 on the Dec 210P/190P, 2,807 / 2,404 on the Dec 200P/185P, 3,912 / 1,473 on the Jan 200P/180P; legs 3.6–9.8% wide [Nasdaq option chain; Yahoo]",
    thesis: "NEW. CrowdStrike fell 8.9% on a day the Nasdaq-100 rose 6.9%, the worst relative move in the screen: buyers are paying a 34% premium in their own stock for Zscaler, holders are diluted ~16%, and a fixed exchange ratio means merger-arbitrage desks typically sell CRWD against long ZS until the deal closes (analysis, not sourced flow data). The stock closed 15% below its 50-day ($246.52) with RSI 37.8 and lower highs since $278.86. Risk: Q3 was strong (record FCF $474M, guide raised), the stock is still above its 200-day ($176.74), and after-hours bids (~$212) show dip buyers; a deal break or a quick antitrust clearance could squeeze it. Invalid above $230 (Friday's pre-deal close $229.44). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wider)", text: "Buy $200P / sell $180P (mids 15.325 − 8.375) · Jan 15 '27 · debit $6.95 · capital ~$695 · max profit ~$1,305 · BE $193.05 · R:R 1:1.88 · POP ~42% · exit +75–100% (~$12.16–13.90) / stop −50% (~$3.48) or a close above $230 — 7½ weeks for the deal overhang to work; long leg Δ −0.37, short at ~0.55σ near the $187.5–190 gap zone. Expect ~$0.5 less debit if CRWD opens near the ~$212 after-hours level (ESTIMATE)" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $210P / sell $190P (mids 15.650 − 7.475) · Dec 18 '26 · debit $8.18 · capital ~$818 · max profit ~$1,182 · BE $201.82 · R:R 1:1.45 · POP ~46% · exit +75–100% (~$14.31–16.35) / stop −50% (~$4.09) or a close above $230 — at-the-money long (Δ −0.47), short just above the $187.5–190 gap zone (~0.5σ); the short leg cuts the ~72% vega. ESTIMATE ~$7.76 if CRWD opens near $212" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $200P / sell $185P (mids 10.975 − 6.100) · Dec 18 '26 · debit $4.88 · capital ~$488 · max profit ~$1,012 · BE $195.12 · R:R 1:2.08 · POP ~39% · exit +75–100% (~$8.53–9.75) / stop −50% (~$2.44) or a close above $230 — OTM follow-through bet (short at ~0.6σ); a spread, not a long put, because IV is ~72%. Expect ~$0.4–0.5 less debit if CRWD opens near $212 (ESTIMATE)" },
    ] },
  { ticker: "UNH", name: "UnitedHealth Group", rank: 2, spot: "$336.08 (Mon Nov 23 close, −1.11%; after-hours ~$336.29; pre-mkt n/a at build time) [Yahoo Finance chart / Investing.com recap; Nasdaq chain parity ~$333.6 is depressed by the dividend]", sentiment: "Bearish",
    catalyst: "CMS Star Ratings overhaul proposed late Fri Nov 20 (CONFIRMED; ~$107B of Medicare Advantage bonus cuts over 2031–37, TD Cowen ~$11.5B in 2031; TD Cowen names UNH and HUM most exposed; comment period open) · Q4 earnings mid/late Jan (date n/a; EST.) · ex-dividend ~early Dec (date n/a; all short legs are puts)",
    iv: "IV ~43% (Dec 18 ATM puts), ~40% (Jan 15) · IVR n/a · no earnings before Dec 18 · 1σ to Dec 18 ±$37.4 (±11.1%), Jan 15 ±$51.0", liq: "A — Mon full session ~96k contracts (P/C 1.06), 20d avg ~7.2M shares/day; OI 3,393 / 2,927 on the Dec 340P/310P, 2,906 on the Dec 330P, 2,572 / 13,689 on the Jan 340P/300P; legs 4.5–8.6% wide [Nasdaq option chain; Yahoo]",
    thesis: "NEW (UNH was a bear play on Nov 19–20 at $349.91/$330.48). UnitedHealth fell 1.1% on a +4.7% S&P day after CMS proposed a Star Ratings overhaul that strips ~$107B of bonus payments from Medicare Advantage, its core profit pool; Mizuho sees 4-star-plus enrollment falling to 28% from 51.5%. The stock is −19.6% in a month, below its 50-day ($387.75) and 200-day ($368.84), with lower highs from $436. Put spreads keep the cost defined at ~43% IV. Risk: RSI 28.8 is oversold, it recovered from a −6.5% opening low on Monday, the rule is only a proposal (2031 effect), and TD Cowen upgraded managed care on Nov 20. Invalid above $350. Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wider)", text: "Buy $340P / sell $300P (mids 21.275 − 6.750) · Jan 15 '27 · debit $14.53 · capital ~$1,452 · max profit ~$2,548 · BE $325.48 · R:R 1:1.75 · POP ~45% · exit +75–100% (~$25.42–29.05) / stop −50% (~$7.26) or a close above $350 — near-the-money long (Δ −0.48), short at ~0.7σ; close before UNH's Q4 report if it is dated before Jan 15 (not yet announced)" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $340P / sell $310P (mids 16.425 − 5.100) · Dec 18 '26 · debit $11.33 · capital ~$1,132 · max profit ~$1,868 · BE $328.68 · R:R 1:1.65 · POP ~44% · exit +75–100% (~$19.82–22.65) / stop −50% (~$5.66) or a close above $350 — slightly ITM long (Δ −0.51), short at ~0.7σ near the Nov 20 low area; no earnings before expiry" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM, tight)", text: "Buy $330P / sell $310P (mids 11.650 − 5.100) · Dec 18 '26 · debit $6.55 · capital ~$655 · max profit ~$1,345 · BE $323.45 · R:R 1:2.05 · POP ~39% · exit +75–100% (~$11.46–13.10) / stop −50% (~$3.27) or a close above $350 — pays if the $330 area (Nov 20 close $330.48) breaks; a spread because put IV is ~43%" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 3, spot: "$165.05 (Mon Nov 23 close, +31.48%; after-hours ~$166.79; pre-mkt n/a at build time, Nasdaq-100 futures +0.26%) [Yahoo Finance chart / Nasdaq option chain put-call parity ~$164.85]", sentiment: "Bullish",
    catalyst: "Jensen Huang reinstated as CEO Nov 23 (CONFIRMED; board cites US-government input) · Huang testifies to House committees Dec 1, general counsel Dec 2 (per Stocktwits; EST.) · SEC and California AG inquiries still open · no earnings before expiry (next late Feb, EST.) · macro: PCE Nov 25, jobs Dec 4, FOMC Dec 9",
    iv: "IV ~65% (Dec 18 ATM), ~57% (Jan 15) · IVR n/a · no earnings before expiry · 1σ to Dec 18 ±$27.8 (±16.8%), Jan 15 ±$35.7", liq: "A — Mon full session ~6.72M contracts (P/C 0.60), 20d avg ~322M shares/day; OI 22,044 / 48,413 on the Dec 165C/185C, 175C 23,255 / 190C 80,473, Jan 160C/185C 102,105 / 28,667; legs 0–6% wide [Nasdaq option chain; Yahoo]",
    thesis: "FLIPPED from Bearish (last report's put spreads were invalidated above $146; marks −76% to −93%). Huang's reinstatement removes the leadership vacuum that drove a 40% slide; NVDA posted its best day since 2003 on heavy volume, Asia chip stocks followed overnight (TSMC near limit-up, Taiwan +9%) and the stock is still 20% below its 50-day ($206.08) with RSI only 42.9, so the gap back toward the pre-scandal $175–185 zone is open. Call debit spreads cut the ~65% vega. Risk: the SEC and California inquiries are unresolved, Huang testifies Dec 1, and buying after a +31% day risks a partial gap fill. Invalid below $146 (Thursday's close). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread (in-the-money, longer-dated)", text: "Buy $160C / sell $185C (mids 17.125 − 6.725) · Jan 15 '27 · debit $10.40 · capital ~$1,040 · max profit ~$1,460 · BE $170.40 · R:R 1:1.40 · POP ~40% · exit +75–100% (~$18.20–20.80) / stop −50% (~$5.20) or a close below $146 — ITM long (Δ 0.61) that survives the Dec 1 testimony; short at the pre-scandal $185 zone (~0.7σ)" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $165C / sell $185C (mids 11.350 − 4.025) · Dec 18 '26 · debit $7.33 · capital ~$732 · max profit ~$1,268 · BE $172.32 · R:R 1:1.73 · POP ~37% · exit +75–100% (~$12.82–14.65) / stop −50% (~$3.66) or a close below $146 — at-the-money long (Δ 0.54), short at ~0.7σ" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $175C / sell $190C (mids 7.000 − 2.975) · Dec 18 '26 · debit $4.03 · capital ~$402 · max profit ~$1,098 · BE $179.03 · R:R 1:2.73 · POP ~28% · exit +75–100% (~$7.04–8.05) / stop −50% (~$2.01) or a close below $146 — bets the gap-fill reaches the Nov 11 level (~$174) and beyond; 175C/190C OI 23k/80k" },
    ] },
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", rank: 4, spot: "$81.69 (Mon Nov 23 close, +0.29%; after-hours ~$81.61; under the 1% re-price threshold) [Yahoo Finance chart / Nasdaq option chain]", sentiment: "Bullish",
    catalyst: "Oct PCE + Q3 GDP 2nd est. Wed Nov 25 8:30 ET (CONFIRMED) · ISM mfg + JOLTS Dec 1 · jobs report Dec 4 (CONFIRMED) · FOMC Dec 8–9, a 25 bp hike fully priced (~5% odds of 50 bp) · monthly ex-dividend early Dec (date n/a; short calls are OTM)",
    iv: "IV ~16% (Dec 18 ATM puts), ~15% (Jan 15); call IVs read low because of the dividend · IVR n/a · no binary on the ETF itself · 1σ to Dec 18 ±$3.4, Jan 15 ±$4.7", liq: "A — Mon full session ~587k contracts (P/C 0.59), 20d avg ~38.0M shares/day; OI 77,564 / 41,693 on the Jan 80C/84C, 41,748 / 198,962 on the Dec 81C/84C, 48,781 / 31,130 on the Jan 82C/86C; legs 2.4–7.4% wide, ≤$0.07 [Nasdaq option chain; Yahoo]",
    thesis: "Carried and re-set (last report's spreads +5% to +7%, the long call −16%). The long bond held its gains on a +4.7% equity day: the 10-yr closed ~4.92% (5.12% a week ago), TLT sits above its 50-day ($80.09) with RSI 59.5, and a 25 bp hike is already fully priced, so a soft PCE or payrolls print has room to pull long yields lower. Low IV keeps call spreads cheap. Risk: the 2-yr rose a second day (~4.68%), the dollar is at a 20-month high, NY Fed's Williams sees 'work to do', and a hot PCE would revive 50 bp talk. Invalid below $80 (the 50-day). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread (in-the-money, longer-dated)", text: "Buy $80C / sell $84C (mids 2.270 − 0.590) · Jan 15 '27 · debit $1.68 · capital ~$168 · max profit ~$232 · BE $81.68 · R:R 1:1.38 · POP ~49% · exit +75–100% (~$2.94–3.36) / stop −50% (~$0.84) or a close below $80 — ITM long (Δ ~0.9) through the FOMC and CPI; short at $84 (~0.5σ)" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $81C / sell $84C (mids 1.225 − 0.270) · Dec 18 '26 · debit $0.96 · capital ~$96 · max profit ~$204 · BE $81.95 · R:R 1:2.14 · POP ~46% · exit +75–100% (~$1.67–1.91) / stop −50% (~$0.48) or a close below $80 — slightly ITM long, short at ~0.7σ ($84); spans PCE, payrolls and the FOMC" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $82C / sell $86C (mids 1.185 − 0.295) · Jan 15 '27 · debit $0.89 · capital ~$89 · max profit ~$311 · BE $82.89 · R:R 1:3.49 · POP ~39% · exit +75–100% (~$1.56–1.78) / stop −50% (~$0.45) or a close below $80 — replaces last report's long call with a spread; pays on a growth-scare move toward a ~4.6% 10-yr" },
    ] },
  { ticker: "IBIT", name: "iShares Bitcoin Trust ETF", rank: 5, spot: "$34.62 (Mon Nov 23 close, +4.85%; after-hours ~$34.64; Bitcoin ~$60.4K overnight, −1.3%) [Yahoo Finance chart / Nasdaq option chain put-call parity ~$34.69]", sentiment: "Bearish",
    catalyst: "Spot-BTC ETF outflows ~$570M Mon after >$4B in November (Investing.com/TheStreet) · Bitcoin hit ~$55.3K Sat, lowest since Sep 2024 · no binary before expiry · macro: PCE Nov 25, jobs Dec 4, FOMC Dec 9 (hike fully priced) with the dollar at a 20-month high",
    iv: "IV ~51% (Dec 18 ATM), ~48% (Jan 15) · IVR n/a · put skew steep (30P 62% vs 38C 49%) · 1σ to Dec 18 ±$4.6 (±13.2%), Jan 15 ±$6.6", liq: "A — Mon full session ~967k contracts (P/C 1.87), 20d avg ~54.1M shares/day; OI 30,027 / 8,353 on the Dec 35P/31P, 19,673 / 31,932 on the Dec 33P/30P, 48,298 / 47,796 on the Jan 35P/30P; legs 1.5–6.5% wide, ≤$0.04 [Nasdaq option chain; Yahoo]",
    thesis: "NEW. Bitcoin lagged the best equity day since April 2025: IBIT rose 4.9% against the Nasdaq-100's 6.9%, Bitcoin slipped back to ~$60.4K overnight while futures rose, and ETF outflows continued (~$570M Monday). IBIT is −24.7% in a month, 22% below its 50-day ($44.37) and below its 200-day ($40.85), making lower lows into a Fed hike and a strong dollar. Put debit spreads limit the cost of the steep skew. Risk: RSI 26.8 is oversold, P/C volume 1.87 shows crowded hedges, and a weekend washout to $55K may have marked capitulation. Invalid above $37 (the Nov 18 close was $36.79). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wider)", text: "Buy $35P / sell $30P (mids 2.620 − 0.980) · Jan 15 '27 · debit $1.64 · capital ~$164 · max profit ~$336 · BE $33.36 · R:R 1:2.05 · POP ~46% · exit +75–100% (~$2.87–3.28) / stop −50% (~$0.82) or a close above $37 — near-the-money long (Δ −0.47), short at ~0.7σ; 7½ weeks spans the FOMC" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $35P / sell $31P (mids 1.965 − 0.675) · Dec 18 '26 · debit $1.29 · capital ~$129 · max profit ~$271 · BE $33.71 · R:R 1:2.10 · POP ~45% · exit +75–100% (~$2.26–2.58) / stop −50% (~$0.65) or a close above $37 — at-the-money long (Δ −0.50), short at ~0.8σ" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM, tight)", text: "Buy $33P / sell $30P (mids 1.165 − 0.510) · Dec 18 '26 · debit $0.66 · capital ~$66 · max profit ~$234 · BE $32.34 · R:R 1:3.58 · POP ~33% · exit +75–100% (~$1.15–1.31) / stop −50% (~$0.33) or a close above $37 — pays on a break of Friday's $33.02 low; a spread, not a long put, because put skew is steep" },
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
// today line sits on the boundary between Nov 24 and Nov 25
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Tuesday, Nov 24 2026 · trading day, built pre-market ~2 am ET · stock quotes = Mon Nov 23 close (Yahoo chart, cross-checked with Nasdaq chain put-call parity / news recaps) · option quotes, OI &amp; volume = Nasdaq option chain after the Mon Nov 23 session · stock pre-market n/a at build time; futures ~2 am ET +0.25%; CRWD after-hours +1.5% (re-priced debits = ESTIMATE)</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Nov 24)
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
