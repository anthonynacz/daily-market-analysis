import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, November 20, 2026 — trading-day edition, built pre-market (~2 am ET; no pre-market session yet: post-market prints and overnight futures used, ES −0.48% / NQ −0.80% / gold −2.8% vs Thursday's 4 pm levels at 1:49 ET); stock quotes = Thu Nov 19 close (Yahoo Finance chart, cross-checked with close reports); option quotes, OI & volume = Nasdaq option chain after the Thu Nov 19 session (full-session volume); GLD and AMD premiums re-estimated (ESTIMATE) for >1% overnight moves.
 * Window: last 3 days (Nov 17) → coming 2 weeks (Dec 4).
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

// 18-day axis: Nov 17 .. Dec 4 (last 3 days → coming 2 weeks). Today = index 3 (Nov 20).
const DAYS = [
  { idx: 0, date: "Nov 17", dow: "Tue" },
  { idx: 1, date: "Nov 18", dow: "Wed" },
  { idx: 2, date: "Nov 19", dow: "Thu" },
  { idx: 3, date: "Nov 20", dow: "Fri" }, // TODAY
  { idx: 4, date: "Nov 21", dow: "Sat" },
  { idx: 5, date: "Nov 22", dow: "Sun" },
  { idx: 6, date: "Nov 23", dow: "Mon" },
  { idx: 7, date: "Nov 24", dow: "Tue" },
  { idx: 8, date: "Nov 25", dow: "Wed" },
  { idx: 9, date: "Nov 26", dow: "Thu" },
  { idx: 10, date: "Nov 27", dow: "Fri" },
  { idx: 11, date: "Nov 28", dow: "Sat" },
  { idx: 12, date: "Nov 29", dow: "Sun" },
  { idx: 13, date: "Nov 30", dow: "Mon" },
  { idx: 14, date: "Dec 1", dow: "Tue" },
  { idx: 15, date: "Dec 2", dow: "Wed" },
  { idx: 16, date: "Dec 3", dow: "Thu" },
  { idx: 17, date: "Dec 4", dow: "Fri" },
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
const LEAN_RECORD = { hits: 1, misses: 2, since: "2026-11-16" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SOFTWARE / SEMIS -------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 17 AMC: NVIDIA Q3 FY27 beat (rev. $115.8B, +103% y/y; adj. EPS $2.68 vs $2.48; Q4 guide ~$130B ±3% assuming zero China data-center compute), its first report without Jensen Huang as CEO. Shares closed −2.89% Wed at $150.96 [NVIDIA IR; Newsquawk; Yahoo]", tickers: "NVDA · SMH",
    rec: "AVOID catching it: a beat-and-raise that gets sold is a bearish tell; wait for the selling to exhaust before buying." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Wed Nov 18: Palo Alto Networks on the earnings slate; PANW +9.90% Wed and +6.42% Thu to $361.73 on the beat while the market fell; CrowdStrike +7.95% Wed, +2.71% Thu to $243.46 [Newsquawk; Strategitz; Yahoo]", tickers: "PANW · CRWD",
    rec: "HOLD / don't chase: a +17% two-day run; CRWD's Dec 1 print is the next test of cyber leadership." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Thu Nov 19: Anthropic (ANT) debuts. Priced $83, opened $111.50 (+34%), closed $97.17 (+17.1%). QQQ fell ~1% within minutes of the first trade and the Nasdaq-100 swung from ~+2% to −2.4%; GOOGL −3.46% to $272.66 (52-week low), AMZN −3.87% to $257.37 [Strategitz; Yahoo live blog; CNBC]", tickers: "QQQ · GOOGL · AMZN",
    rec: "WATCH: a record IPO that drained money from AI leaders instead of lifting them; don't buy dips in AI beta until QQQ reclaims $660." },
  { id: "t4", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Thu Nov 19: Hunterbrook alleges a blacklisted Chinese server maker (IEIT Systems) runs newer AMD firmware and discloses a short; AMD denies and says it complies with export law. AMD −7.72% to $489.19 (−13% intraday), −3.4% after hours [Benzinga; Investinglive; Financial News; Yahoo]", tickers: "AMD · SMH",
    rec: "SELL rallies with defined risk (see the AMD play); invalid on a close back above $531." },
  { id: "t5", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Thu Nov 19: chips extend the rout. NVIDIA −3.30% to $145.98 (6th straight loss, new 52-week low), SMH −2.62% to $447.48, Micron −2.10%. Asia Fri: Taiex −5.65% (−14.9% on the week), Kospi −5.46%, Nikkei −4.89%, SoftBank −16% [CNBC; Weekend Spread; Yahoo]", tickers: "SMH · NVDA · MU",
    rec: "AVOID longs: SMH is 18.8% under its 50-day; global semis positioning is still ~80th percentile (JPMorgan), so de-grossing may not be done." },
  { id: "t6", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Thu Nov 19 AMC: Intuit FQ1 beat (rev. $4.35B, +12%; adj. EPS $2.91 vs $2.64) but cut FY revenue guidance to $23.08–23.37B (from $23.28–23.51B); TurboTax Q2 revenue to decline y/y; Mailchimp sale planned. INTU −9.8% after hours to ~$279.7 [Investing.com; AskTraders; Yahoo]", tickers: "INTU · IGV",
    rec: "SELL / AVOID: the guide cut confirms the software de-rating; INTU options are too thin (~35k contracts) for a play." },
  { id: "t7", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Fri Nov 20: Anthropic's IPO closes, followed by a $26B private placement; Nasdaq-100 futures −0.80% vs Thursday's 4 pm level at 1:49 ET [Weekend Spread; Yahoo]", tickers: "QQQ · AMZN · GOOGL",
    rec: "WATCH: a second straight fade below $97 in ANT would keep pressure on AI-linked mega-caps." },
  { id: "t8", ind: "tech", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Mon Nov 23 AMC: Zoom FQ3 (CONFIRMED; guide non-GAAP EPS $1.46–1.48); ZM −9.56% Thursday to $83.82 [ifyouspent; Yahoo]", tickers: "ZM",
    rec: "WATCH: a low-impact software read; no edge." },
  { id: "t9", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "Tue Nov 24: Analog Devices (7:00 ET release, BMO EST.); Workday, Dell (Q3 rev. guide $49.0B) and HP AMC (CONFIRMED). Dell's Nov 27 straddle prices ~±14.5%; DELL −35.7% in a month [ifyouspent; Nasdaq option chain; Yahoo]", tickers: "DELL · WDAY · ADI",
    rec: "WATCH (both ways): Dell is the AI-server read after NVIDIA; a clean beat could squeeze a −36% month, a miss confirms the AI capex scare." },
  { id: "t10", ind: "tech", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 – Fri Dec 4: AWS re:Invent, Las Vegas (CONFIRMED); CEO Matt Garman keynote Tue Dec 1, 8:30–10:30 am PT [AWS events page; AWS APN blog]", tickers: "AMZN · SNOW",
    rec: "WATCH: agentic-AI launches are a sentiment catalyst for AMZN, now back near its 50-day ($255)." },
  { id: "t11", ind: "tech", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1 AMC: Marvell (call 1:30 pm PT, CONFIRMED by Marvell IR), CrowdStrike and Okta (5:00 pm, listed CONFIRMED); CRWD's Dec 4 straddle prices ~±15% [Marvell IR; guptadeepak calendar; Nasdaq option chain]", tickers: "CRWD · MRVL · OKTA",
    rec: "WATCH: CRWD reports after a cyber rally (high bar); MRVL is the first AI-silicon print after NVIDIA and the AMD report." },
  { id: "t12", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Dec 2 AMC: Salesforce and Snowflake FQ3 (5:00 pm, listed CONFIRMED); CRM −24.2% in a month, RSI 21.6, after INTU's guide cut [guptadeepak calendar; Yahoo]", tickers: "CRM · SNOW · IGV",
    rec: "WATCH: AI-agent monetization commentary decides whether software stabilizes; no pre-positioning into the binary." },
  // ---- ENERGY / COMMODITIES ----------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17: gold ~$3,842 after Monday's one-year low ($3,830.74) on higher yields and a firm dollar; WTI −3.20% to $83.26 [USAGold; Nation Thailand; Yahoo]", tickers: "GLD · USO",
    rec: "SELL rallies in metals; oil's slide pressures energy earnings estimates." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Wed Nov 18: GLD −3.20% to $341.19 on hawkish FOMC minutes; GDX −5.97%, SLV −4.55%; XLE −3.27% to $61.29, Exxon −3.97% to $160.58 [Yahoo; Strategitz]", tickers: "GLD · GDX · XLE",
    rec: "SELL rallies with defined risk (see the GLD play)." },
  { id: "e3", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Thu Nov 19: GLD −1.76% to $335.18 (52-week low); gold miners GDX −3.77%, silver −2.60%; Bespoke: fastest three-month gold decline since 2013. Brent ~$92, WTI ~$83 flat despite reports of Iranian tanker attacks; refining margins down to ~$25–40/bbl from $60–75 [Strategitz; Yahoo]", tickers: "GLD · GDX · XLE",
    rec: "SELL rallies in gold; WATCH crude: geopolitics is not lifting it, which says supply is ample." },
  { id: "e4", ind: "energy", dayIdx: 3, future: false, impact: 3, dir: "BEARISH",
    headline: "TODAY Fri Nov 20 (overnight): gold futures −2.8% since Thursday's 4 pm level to ~$3,557 at 1:49 ET (~−3.6% vs the prior settle), implying GLD near $326 at the open [Yahoo]", tickers: "GLD · GDX · NEM",
    rec: "HOLD existing bear spreads; don't add size into a capitulation-style gap (RSI already ~28 at the close)." },
  { id: "e5", ind: "energy", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Wed Nov 25: Deere FQ4 (call 9:00 am CT, CONFIRMED; release time n/a) — farm-economy and ag-commodity read [ifyouspent]", tickers: "DE",
    rec: "WATCH: a low-signal read for commodity demand." },
  { id: "e6", ind: "energy", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "Sun Nov 29: OPEC+ meeting (CONFIRMED by OPEC); December output was held on Nov 1 and analysts expect the 2027 production framework to be set here (Rystad) [OPEC press release; Engineering News; Star-Advertiser]", tickers: "USO · XLE · XOM",
    rec: "WATCH (both ways): higher 2027 baselines extend crude's −16.7% month; a cut-extension surprise squeezes it. Stay defined-risk through the weekend gap." },
  // ---- HEALTHCARE / PHARMA -----------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 17: CMS proposes extending Medicare Advantage RADV audit extrapolation back to payment year 2018 (~$9B recovered per payment year; comments close Jan 19, 2027). UNH −5.42% to $389.68, Humana −3.88%, CVS −3.14% [TIKR; Yahoo]", tickers: "UNH · HUM · CVS",
    rec: "SELL rallies: a dated regulatory overhang with a two-month comment period." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Wed Nov 18: managed-care rout deepens. UnitedHealth −10.21% to $349.91 (below its 200-day), Humana −12.98%, Elevance −7.63%, CVS −5.20% [Yahoo]", tickers: "UNH · HUM · ELV",
    rec: "SELL rallies with defined risk (see the UNH play)." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Thu Nov 19: UNH −5.55% to $330.48 (intraday low $324.67), −18.4% in five sessions; Elevance −2.66%, CVS −1.61%; XLV −2.05% [Yahoo; Strategitz]", tickers: "UNH · ELV · XLV",
    rec: "SELL rallies: invalid only on a close back above $350; RSI 24 argues for spreads, not naked shorts." },
  { id: "h4", ind: "health", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "Sun Nov 22 PDUFA: Savara molgramostim in autoimmune PAP (extended from Aug 22) — weekend date, FDA may act Friday [BiopharmaWatch; RTTNews]", tickers: "SVRA",
    rec: "AVOID binary sizing: a single-outcome event; react Monday." },
  { id: "h5", ind: "health", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Medtronic FQ2 (CONFIRMED; results 5:45 am CT, webcast 6:30 am CT) [ifyouspent]", tickers: "MDT · XLV",
    rec: "WATCH: a defensive med-tech read while managed care sells off." },
  { id: "h6", ind: "health", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27 PDUFA: BridgeBio BBP-418 (LGMD2I/R9, priority review) and Nuvalent neladalkib (ALK+ NSCLC) [BiopharmaWatch; 2 Minute Medicine]", tickers: "BBIO · NUVL",
    rec: "WATCH: binaries on a holiday-thinned session; defined-risk only." },
  { id: "h7", ind: "health", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 PDUFA: Vertex povetacicept in IgA nephropathy. Cogent's bezuclastinib, listed Nov 30 by some calendars, is Dec 30 per the company [BiopharmaWatch; Cogent release]", tickers: "VRTX · COGT",
    rec: "HOLD VRTX: an approval is expected and incremental." },
  { id: "h8", ind: "health", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "~Thu Dec 3 PDUFA (ESTIMATED; older calendar snapshot): Exelixis zanzalintinib in hepatocellular carcinoma [RTTNews FDA calendar]", tickers: "EXEL",
    rec: "WATCH: date unconfirmed; don't position on it." },
  // ---- FINANCIALS / RATES / CRYPTO ---------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17: S&P 500 −1.03% to 7,340.53; JPMorgan −2.44% to $329.96; Dow −1.64% [Yahoo]", tickers: "SPY · JPM · XLF",
    rec: "WATCH: banks lose leadership; JPM ($320.22 Thu) is now under its 200-day." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Wed Nov 18, 2:00 pm: October FOMC minutes — almost all participants see further tightening as likely appropriate (Nomura flags Waller's push for 50 bp in December). S&P 500 −0.23% to 7,323.63, below its 200-day [Strategitz; Yahoo]", tickers: "SPY · TLT · IWM",
    rec: "HEDGE: index exposure stays hedged while the S&P trades under its 200-day." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "Thu Nov 19, 8:30 am: jobless claims 203K vs 198K, continuing claims +70K to 1.763M; Philly Fed 6.3 vs 23.2 exp. (six-month low) but prices paid 58.2 (from 43.2); LEI −0.3%; Barr: inflation too high; 10-yr TIPS reopening at 2.903%, highest since 2002. 10-yr 5.05%, 2-yr 4.78%; TLT +0.16% [Weekend Spread; Strategitz; CNBC]", tickers: "TLT · IWM",
    rec: "WATCH: growth is cracking while prices stay hot — the stagflation mix that pins the Fed (see the TLT play for the growth side)." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Thu Nov 19: reversal day. S&P 500 −2.02% to 7,175.83 (6th straight loss; first close under 7,200 since May 5), Dow −2.19% to 49,097 (below 50,000 for the first time since June), Nasdaq-100 −2.21%, Russell 2000 −2.18%; all 11 sectors lower; VIX 28.44 vs VIX3M 27.03 (backwardation) [Strategitz; CNBC; Yahoo]", tickers: "SPY · QQQ · IWM",
    rec: "HEDGE: risk-off regime; Deutsche Bank calls it very oversold, so hedge with spreads rather than chase shorts." },
  { id: "f5", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Thu Nov 19: Bitcoin ~$61.9k (−1.7%); IBIT −0.79% to $35.08; Strategy −4.64% to $86.13 (−43.9% in a month); Coinbase −1.48%; crypto miners −4.81% [Yahoo; Strategitz]", tickers: "IBIT · MSTR · COIN",
    rec: "WATCH: the trend is down but RSI ~21 is extreme; the MSCI deletion (Nov 30) is the next dated pressure point." },
  { id: "f6", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Fri Nov 20: monthly options expiration; final UMich sentiment 10:00 (1-yr inflation expectations fcst 4.3%); Waller 8:25 (welcoming remarks, College Fed Challenge), Cook 12:15 ('The U.S. Economy in Global Context'). S&P futures −0.48% vs 4 pm at 1:49 ET [federalreserve.gov; Weekend Spread; Yahoo]", tickers: "SPY · QQQ",
    rec: "WATCH: expiration-day pinning after a −5% week; avoid opening size into the close." },
  { id: "f7", ind: "finance", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Nov 25, 8:30 am: October personal income & outlays (PCE) and Q3 GDP 2nd est. + corporate profits (CONFIRMED by BEA); Beige Book 2:00 pm (CONFIRMED by Fed). Cleveland Fed nowcast core PCE ~0.26% m/m (as of Nov 6, before the hot CPI) vs Oxford Economics flagging broadening pressures [bea.gov; federalreserve.gov; Cleveland Fed; Oxford Economics]", tickers: "TLT · SPY · GLD",
    rec: "WATCH (both ways): a soft core print lifts TLT and squeezes gold shorts — respect the GLD play's $342 stop; a hot one revives 50 bp talk and hits TLT and equities." },
  { id: "f8", ind: "finance", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "Thu Nov 26: Thanksgiving, US markets closed; Fed releases shift to Fri Nov 27, a holiday-thinned session [federalreserve.gov; BLS schedule]", tickers: "SPY",
    rec: "NOTE: thin liquidity; avoid opening short-dated positions Wednesday afternoon." },
  { id: "f9", ind: "finance", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 close: MSCI deletes Strategy from MSCI USA, World and ACWI (non-operating-company screen); trackers hold ~13M shares (3.1%) per Strategy; JPMorgan's ~$2.8B estimate was for the earlier proposal [Bitcoin Magazine; Cointelegraph; Stocktwits]", tickers: "MSTR · IBIT",
    rec: "WATCH: forced selling is known and partly priced (MSTR −43.9% in a month); don't catch the knife before the close." },
  { id: "f10", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1, 10:00 am: October JOLTS (CONFIRMED by BLS); ISM manufacturing the same day (EST., first business day) [BLS release schedule]", tickers: "TLT · SPY",
    rec: "WATCH: falling openings would confirm the growth scare in claims and the Philly Fed." },
  { id: "f11", ind: "finance", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "Fri Dec 4, 8:30 am: November jobs report (CONFIRMED by BLS); then CPI Dec 10 and the FOMC decision Dec 9, 2:00 pm (presser 2:30), with a December hike ~100% priced [BLS; federalreserve.gov; Weekend Spread]", tickers: "TLT · SPY · IWM",
    rec: "WATCH: the last major data before the Dec 9 decision; a weak print challenges the hike path and supports TLT." },
  // ---- CONSUMER / RETAIL -------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17 BMO: Home Depot adj. EPS $3.86 vs $3.84, sales $43.4B (+4.9%), FY sales growth ~4.5%; CFO Richard McPhail named CEO effective Nov 23. HD −2.45% to $339.01 [Newsquawk; Finviz; Yahoo]", tickers: "HD · LOW",
    rec: "WATCH: housing demand is soft; no edge into the holidays." },
  { id: "c2", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17: Nike investor day ('Full Stride Ahead': 12–14% operating margin and EPS $3.00–3.50 by 2030); faded >10% from ~$42 intraday highs, closed −6.30% at $35.85; −5.45% more Thu to $34.33 [XTB; Yahoo]", tickers: "NKE · XLY",
    rec: "SELL rallies: the turnaround is longer than hoped and NKE is 22% under its 200-day." },
  { id: "c3", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Wed Nov 18 BMO: Target, TJX and Lowe's report (Lowe's cons. EPS $2.89 / rev. $22.40B). TJX +8.05% to $140.30, Target +4.01% to $165.93, Lowe's +1.05%; JPMorgan's desk calls the strength mostly short-covering [Newsquawk; Yahoo; Strategitz]", tickers: "TJX · TGT · LOW",
    rec: "HOLD: off-price strength is real, but Thursday's Ross guide shows the bar is now high." },
  { id: "c4", ind: "consumer", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Thu Nov 19 BMO: Walmart Q3 adj. EPS $0.65 vs $0.64, revenue $188.8B vs ~$187.2–187.4B, US comps +2.9% ex-fuel, e-commerce +17%, FY EPS guide raised to $2.84–2.89 — yet WMT −1.04% to $126.04, selling the beat [Yahoo live blog; Weekend Spread]", tickers: "WMT · XLP",
    rec: "HOLD, don't add: a beat-and-raise that can't lift the stock means the good news is priced (WMT is +7% in a month)." },
  { id: "c5", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Thu Nov 19: Williams-Sonoma −15.16% to $220.66 on its BMO report (details n/a in retrieved sources); XLY −2.79%, the worst sector; Nike −5.45%, Gap −5.29% [Yahoo; Strategitz]", tickers: "WSM · XLY · NKE",
    rec: "AVOID discretionary longs into the holidays; WSM options are thin." },
  { id: "c6", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Thu Nov 19 AMC: Ross Q3 EPS $1.91 vs $1.88, revenue ~$6.3B (+12%), comps +8%, but Q4 comp guide 4–5% and EPS $2.16–2.25 vs $2.27 cons.; CEO cites weaker discretionary spending. ROST −5.2% after hours to ~$208.5; Gap +3.6% after hours [Reuters via Investing.com; BigGo; Yahoo]", tickers: "ROST · GAP · XRT",
    rec: "SELL / AVOID: a holiday slowdown warning from the strongest off-price operator; ROST options too thin for a play." },
  { id: "c7", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Thu Nov 19 BMO: PDD +11.04% to $86.00 on its quarterly report; Alibaba's operating income +443% to 29.12B yuan, but the ADR fell 1.26% to $83.31 (RSI 24) before rising 2.42% in Hong Kong Friday [CNBC; Yahoo]", tickers: "PDD · BABA",
    rec: "HOLD PDD; WATCH BABA: profits recovered but the ADR is 31% under its 200-day." },
  { id: "c8", ind: "consumer", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "TODAY Fri Nov 20 BMO: BJ's Wholesale Club reports [CNBC; Weekend Spread]", tickers: "BJ · COST",
    rec: "WATCH: a low-income and value-shopper read after Ross's caution." },
  { id: "c9", ind: "consumer", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24: Best Buy reports (timing n/a); Dollar Tree and Autodesk listed the same day but unconfirmed [ifyouspent; Digrin calendar]", tickers: "BBY · DLTR · XRT",
    rec: "WATCH: the last big retail read before Black Friday; options too thin for plays." },
  { id: "c10", ind: "consumer", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27: Black Friday (holiday-thinned session) into Cyber Monday Nov 30; Ross's CEO just flagged weaker discretionary spending and value competition [Reuters via Investing.com; federalreserve.gov holiday schedule]", tickers: "AMZN · XRT · XLY",
    rec: "WATCH: early holiday tallies set the retail tone into December." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "UNH", name: "UnitedHealth Group", rank: 1, spot: "$330.48 (Thu Nov 19 close, −5.55%; post-mkt ~$328.78, −0.5%, so Thu-close premiums kept; no pre-market session yet at ~2 am ET) [Yahoo Finance chart / Nasdaq option chain, 130C mid $200.55 ⇒ ~$330.5]", sentiment: "Bearish",
    catalyst: "No earnings before expiry (next ~mid-Jan, n/a) · CMS RADV proposal: comments close Jan 19, 2027 (CONFIRMED) [TIKR] · ex-dividend Dec 7 ($2.32; Benzinga lists Dec 8) before expiry · core PCE Nov 25 · FOMC Dec 9",
    iv: "IV ~48% puts / ~41% calls (Dec 18 ATM; the dividend skews single-leg BS IVs) vs 20-day realized 48.8% · IVR n/a · no binary, so implied move n/a · 1σ to Dec 18 ±$41.19 ($289–$372)", liq: "A — 238k contracts traded Thu (full session), 20d avg 6.4M shares; OI 3,044 / 1,620 on Dec 340P/320P, 2,734 / 1,788 on Dec 330P/310P, 13,145 / 2,921 on Jan 300P/290P; legs $0.60–1.15 wide (5.0–9.9% of mid) [Nasdaq option chain]",
    thesis: "The managed-care breakdown ran a third day: UNH fell 5.55% Thursday to $330.48 (intraday $324.67), −18.4% in five sessions, 15.1% under its 50-day ($389.48) and 10.2% under its 200-day ($368.18), with HUM, ELV and CVS also lower; CMS's RADV extrapolation proposal (~$9B per payment year) stays open for comment until Jan 19. Risk: RSI 24 after a −20.8% month invites a reflex bounce, and puts already carry ~48% IV, so these are spreads, not long puts. Invalid above $350 (a close back over Wednesday's $349.91). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (in-the-money)", text: "Buy $340P / sell $320P (mids 22.125 − 11.900) · Dec 18 '26 · debit $10.23 · capital ~$1,023 · max profit ~$977 · BE $329.77 · R:R 1:0.96 · POP ~51% · exit +75% (~$17.90) / stop −50% (~$5.12) or a close above $350 — in-the-money long (Δ −0.55) for the highest POP; UNH's 360–380 calls quote 12–14% wide, so there is no call-credit tier" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $330P / sell $310P (mids 16.650 − 8.425) · Dec 18 '26 · debit $8.22 · capital ~$822 · max profit ~$1,178 · BE $321.78 · R:R 1:1.43 · POP ~44% · exit +75–100% (~$14.39–$16.44) / stop −50% (~$4.11) or a close above $350 — at-the-money long (Δ −0.46), short below Thursday's $324.67 low" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM, longer-dated)", text: "Buy $300P / sell $290P (mids 9.325 − 7.050) · Jan 15 '27 · debit $2.27 · capital ~$227 · max profit ~$773 · BE $297.73 · R:R 1:3.41 · POP ~29% · exit +100% (~$4.54) / stop −50% (~$1.14) or a close above $350 — OTM long (Δ −0.25) with 56 days for a push toward the Jan 1σ low (~$274)" },
    ] },
  { ticker: "GLD", name: "SPDR Gold Shares", rank: 2, spot: "$335.18 (Thu Nov 19 close, −1.76%; gold futures −2.8% since the 4 pm close to ~$3,557 at 1:49 ET ⇒ GLD ~$326, ESTIMATE, so premiums re-estimated) [Yahoo Finance chart / Strategitz close report]", sentiment: "Bearish",
    catalyst: "No earnings (ETF), no dividend · core PCE + GDP Nov 25 8:30 (CONFIRMED, BEA) · JOLTS Dec 1, jobs Dec 4, CPI Dec 10 (CONFIRMED, BLS) · FOMC Dec 9 with a hike ~100% priced [Weekend Spread] · DXY ~103.9, a 19-month high",
    iv: "IV ~27–28% (Dec 18 ATM) vs 20-day realized 29.1% · IVR n/a · no binary · 1σ to Dec 18 ±$25.26 from ~$326 ($300–$351)", liq: "A — 419k contracts traded Thu (full session), 20d avg 9.6M shares; OI 3,624 / 1,388 on Dec 350C/360C, 1,985 / 1,089 on 325P/305P, 1,296 / 8,827 on 315P/300P; legs $0.06–0.25 wide (3.3–8.0% of mid) [Nasdaq option chain]",
    thesis: "Gold's unwind is accelerating: spot made a one-year low ($3,830) on Nov 16, GLD closed at a 52-week low of $335.18 Thursday (11.0% under its 50-day, 17.5% under its 200-day, −11.6% in a month), and futures fell another 2.8% overnight; Bespoke calls it the fastest three-month decline since 2013 as a hiking Fed and a 19-month dollar high bite. Implied vol (~28%) sits just under realized (29.1%), so put spreads are fairly priced. Risk: RSI 28 at the close (lower overnight) is deeply oversold, and a soft core PCE or a haven bid in the equity rout can spark a violent short-cover. Invalid above $342 (a close back over Wednesday's $341.19). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $350C / buy $360C · Dec 18 '26 · credit $1.20 (ESTIMATE at ~$326; Thu-close mids 4.575 − 2.425 = $2.15) · capital ~$880 · max profit ~$120 · BE $351.20 · R:R 1:0.14 · POP ~82% · exit +50% (~$0.60) / stop on a close above $342; close by Dec 11 — short strike at ~1σ ($351), above the breakdown zone" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $325P / sell $305P · Dec 18 '26 · debit $5.90 (ESTIMATE; Thu-close mids 5.475 − 1.735 = $3.74) · capital ~$590 · max profit ~$1,410 · BE $319.10 · R:R 1:2.39 · POP ~39% · exit +75–100% (~$10.33–$11.80) / stop −50% (~$2.95) or a close above $342 — near-the-money long (Δ ≈ −0.46), short near the 1σ low ($300)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $315P / sell $300P · Dec 18 '26 · debit $3.06 (ESTIMATE; Thu-close mids 3.125 − 1.300 = $1.83) · capital ~$306 · max profit ~$1,194 · BE $311.94 · R:R 1:3.90 · POP ~30% · exit +100% (~$6.12) / stop −50% (~$1.53) or a close above $342 — OTM long (Δ ≈ −0.31) for a run at the 1σ low" },
    ] },
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 3, spot: "$489.19 (Thu Nov 19 close, −7.72%; post-mkt ~$472.51, −3.4%, so premiums re-estimated, ESTIMATE) [Yahoo Finance chart / Financial News close report]", sentiment: "Bearish",
    catalyst: "Hunterbrook short report Nov 19 (IEIT Systems firmware links; AMD denies and says it complies with export law) — the Commerce response is the open variable · no earnings before expiry (next ~early Feb, n/a) · no dividend · Marvell Dec 1 AMC (CONFIRMED) · FOMC Dec 9",
    iv: "IV ~78–81% (Dec 18 ATM) vs 20-day realized 124.9% · IVR n/a · no scheduled binary · 1σ to Dec 18 ±$102 from ~$472.5 ($370–$575)", liq: "A — 1.21M contracts traded Thu (full session), 20d avg 39.6M shares; OI 2,521 / 2,426 on Dec 580C/590C, 2,432 / 3,165 on 470P/440P, 3,422 / 13,553 on 430P/400P; legs $0.80–1.50 wide (4.4–7.7% of mid) [Nasdaq option chain]",
    thesis: "A fresh, dated overhang on a name with room to fall: Hunterbrook's report tying AMD firmware to blacklisted IEIT Systems (with a disclosed short) sent AMD −7.72% to $489.19 (−13% intraday) and −3.4% after hours, below its 50-day ($554.93) but still 14% above its 200-day ($428.63); China and Hong Kong were 22.4% of 2025 revenue. IV (~80%) is below realized (125%), but the capital cap forces spreads. Risk: Hunterbrook concedes it cannot prove an export breach, AMD denies the claims, and short-report gaps often retrace; RSI 45 is not stretched. Invalid above $531 (a close back over Wednesday's $530.14). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $580C / buy $590C · Dec 18 '26 · credit $1.43 (ESTIMATE at ~$472.5; Thu-close mids 12.300 − 10.450 = $1.85) · capital ~$857 · max profit ~$143 · BE $581.43 · R:R 1:0.17 · POP ~82% · exit +50% (~$0.71) / stop on a close above $531; close by Dec 11 — short strike just beyond the 1σ high ($575)" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $470P / sell $440P · Dec 18 '26 · debit $12.47 (ESTIMATE; Thu-close mids 33.275 − 22.550 = $10.73) · capital ~$1,247 · max profit ~$1,753 · BE $457.53 · R:R 1:1.41 · POP ~48% · exit +75–100% (~$21.82–$24.94) / stop −50% (~$6.24) or a close above $531 — near-the-money long (Δ ≈ −0.44), short at the $433–440 ten-day-low shelf" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $430P / sell $400P · Dec 18 '26 · debit $8.26 (ESTIMATE; Thu-close mids 19.550 − 12.675 = $6.88) · capital ~$826 · max profit ~$2,174 · BE $421.74 · R:R 1:2.63 · POP ~36% · exit +100% (~$16.52) / stop −50% (~$4.13) or a close above $531 — OTM long (Δ ≈ −0.30) for a break of the $433 low toward the 200-day ($429)" },
    ] },
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", rank: 4, spot: "$80.35 (Thu Nov 19 close, +0.16%; post-mkt ~$80.40, <1%, so Thu-close premiums kept) [Yahoo Finance chart / Strategitz close report]", sentiment: "Bullish",
    catalyst: "Core PCE + GDP 2nd est. Nov 25 8:30 (CONFIRMED, BEA) · Beige Book Nov 25 · JOLTS Dec 1, jobs Dec 4, CPI Dec 10 (CONFIRMED, BLS) · FOMC Dec 9 (hike ~100% priced) · monthly distribution date n/a in retrieved sources (short calls OTM)",
    iv: "IV ~13% (Dec 18 ATM, call/put average; the distribution skews single-leg BS IVs) vs 20-day realized 10.1% · IVR n/a · 1σ ±$2.89 to Dec 18 ($77.5–$83.2), ±$4.09 to Jan 15", liq: "A — 919k contracts traded Thu (full session), 20d avg 35.0M shares; OI 12,976 / 40,444 on Jan 79C/82C, 146,569 / 123,387 on Dec 80C/83C; legs $0.02–0.06 wide (2.4–6.9% of mid) [Nasdaq option chain]",
    thesis: "A growth-scare hedge that pays if the equity rout spreads into the data: Thursday's Philly Fed collapsed to 6.3 (from 20.9, a six-month low), continuing claims jumped 70K to 1.763M and the LEI fell 0.3%, while the 10-year slipped from 5.12% to 5.05% in three sessions as stocks fell ~5% on the week; TLT ($80.35) is back above its 50-day ($80.06). IV (~13%) is cheap for a five-catalyst window. Risk: inflation is still the Fed's focus (Philly prices paid 58.2, 10-yr TIPS at 2.903%, the highest since 2002), a December hike is fully priced and Waller has argued for 50 bp. Invalid below $79 (a close under the ten-day low of $79.11). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread (in-the-money, longer-dated)", text: "Buy $79C / sell $82C (mids 2.200 − 0.850) · Jan 15 '27 · debit $1.35 · capital ~$135 · max profit ~$165 · BE $80.35 · R:R 1:1.22 · POP ~54% · exit +75% (~$2.36) / stop −50% (~$0.68) or a close below $79 — in-the-money long for the highest POP, with 56 days of runway through CPI and the FOMC" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $80C / sell $83C (mids 1.210 − 0.290) · Dec 18 '26 · debit $0.92 · capital ~$92 · max profit ~$208 · BE $80.92 · R:R 1:2.26 · POP ~45% · exit +75–100% (~$1.61–$1.84) / stop −50% (~$0.46) or a close below $79 — near-the-money long, short near the 1σ high ($83.2)" },
      { profile: "Aggressive", strategy: "Long Call", text: "Buy $82C · Jan 15 '27 · debit $0.85 · capital ~$85 · max profit uncapped · BE $82.85 · R:R n/a (uncapped) · POP ~31% · exit +100% (~$1.70) / stop −50% (~$0.42) or a close below $79; close by Jan 5 (≥10 days left) — |Δ| ≈ 0.38; IV ~13% is cheap against five macro catalysts (IVR n/a)" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 5, spot: "$349.21 (Thu Nov 19 close, −0.92%; post-mkt ~$351.56, +0.7%, so Thu-close premiums kept) [Yahoo Finance chart / Nasdaq option chain, 350C−350P parity ⇒ ~$349.3]", sentiment: "Bullish",
    catalyst: "No earnings before expiry (next ~late Jan, n/a) · ex-dividend date n/a in retrieved sources · holiday demand read via Black Friday Nov 27 / Cyber Monday Nov 30 · macro: core PCE Nov 25, jobs Dec 4, FOMC Dec 9",
    iv: "IV ~26% (Dec 18 ATM) vs 20-day realized 27.1% · IVR n/a · no binary · 1σ to Dec 18 ±$24.86 ($324–$374)", liq: "A — 869k contracts traded Thu (full session), 20d avg 47.7M shares; OI 37,822 / 11,835 on Dec 320P/315P, 27,614 / 20,781 on 350C/370C, 33,647 on 360C; legs $0.05–0.35 wide (2.9–8.0% of mid) [Nasdaq option chain]",
    thesis: "The tape's relative-strength refuge: AAPL is −1.6% over a week in which the S&P 500 fell 5.5% and the Nasdaq-100 6.3%, still above its 50-day ($341.60) and 15% above its 200-day ($302.91), RSI 53, $12 under its $360.83 52-week high, and it firmed 0.7% after hours while AI beta is being sold. Risk: bullish picks have failed in each of the last three reports (WMT twice, AMZN), de-grossing can reach leaders last, and there is no company catalyst in the window. Invalid below $338 (the ten-day low, under the 50-day). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Put Credit Spread", text: "Sell $320P / buy $315P (mids 2.230 − 1.725) · Dec 18 '26 · credit $0.50 · capital ~$450 · max profit ~$50 · BE $319.50 · R:R 1:0.11 · POP ~86% · exit +50% (~$0.25) / stop on a close below $338; close by Dec 11 — short strike beyond the 1σ low ($324)" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $350C / sell $370C (mids 10.125 − 2.385) · Dec 18 '26 · debit $7.74 · capital ~$774 · max profit ~$1,226 · BE $357.74 · R:R 1:1.58 · POP ~37% · exit +75–100% (~$13.54–$15.48) / stop −50% (~$3.87) or a close below $338 — at-the-money long (Δ 0.52), short just under the 1σ high ($374)" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $360C / sell $370C (mids 5.375 − 2.385) · Dec 18 '26 · debit $2.99 · capital ~$299 · max profit ~$701 · BE $362.99 · R:R 1:2.34 · POP ~29% · exit +100% (~$5.98) / stop −50% (~$1.50) or a close below $338 — a breakout bet through the $360.83 52-week high" },
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Nov 20 2026 · pre-market (~2 am ET; pre-market session not yet open — post-market prints and futures used: ES −0.48%, NQ −0.80%, gold −2.8% vs 4 pm) · stock quotes = Thu Nov 19 close (Yahoo, cross-checked) · option chains, OI &amp; volume = Nasdaq option chain after the Thu Nov 19 session · GLD &amp; AMD premiums re-estimated (ESTIMATE) · today's events (opex, UMich, BJ's) not yet reported</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Nov 20)
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
