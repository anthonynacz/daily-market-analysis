import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Thursday, November 19, 2026 — trading-day edition, built pre-market (~2 am ET; no pre-market session yet: post-market prints and overnight futures used, ES +0.9% / NQ +1.6% at ~1:55 ET); stock quotes = Wed Nov 18 close (Yahoo Finance chart, cross-checked with Cboe delayed quotes); option quotes, OI & volume = Cboe delayed chain after the Wed Nov 18 session (full-session volume); AMZN and IBIT premiums re-estimated (ESTIMATE) for >1% post-market moves.
 * Window: last 3 days (Nov 16) → coming 2 weeks (Dec 3).
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

// 18-day axis: Nov 16 .. Dec 3 (last 3 days → coming 2 weeks). Today = index 3 (Nov 19).
const DAYS = [
  { idx: 0, date: "Nov 16", dow: "Mon" },
  { idx: 1, date: "Nov 17", dow: "Tue" },
  { idx: 2, date: "Nov 18", dow: "Wed" },
  { idx: 3, date: "Nov 19", dow: "Thu" }, // TODAY
  { idx: 4, date: "Nov 20", dow: "Fri" },
  { idx: 5, date: "Nov 21", dow: "Sat" },
  { idx: 6, date: "Nov 22", dow: "Sun" },
  { idx: 7, date: "Nov 23", dow: "Mon" },
  { idx: 8, date: "Nov 24", dow: "Tue" },
  { idx: 9, date: "Nov 25", dow: "Wed" },
  { idx: 10, date: "Nov 26", dow: "Thu" },
  { idx: 11, date: "Nov 27", dow: "Fri" },
  { idx: 12, date: "Nov 28", dow: "Sat" },
  { idx: 13, date: "Nov 29", dow: "Sun" },
  { idx: 14, date: "Nov 30", dow: "Mon" },
  { idx: 15, date: "Dec 1", dow: "Tue" },
  { idx: 16, date: "Dec 2", dow: "Wed" },
  { idx: 17, date: "Dec 3", dow: "Thu" },
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
const LEAN_RECORD = { hits: 1, misses: 1, since: "2026-11-16" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SOFTWARE / SEMIS -------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 16: semis rout. SMH −5.11% to $461.90, Micron −7.62% to $719.02, AMD −5.58%, NVIDIA −4.12% to $156.14, Broadcom −3.92%; Nasdaq-100 −2.67% to 27,197 [Yahoo]", tickers: "SMH · MU · NVDA",
    rec: "WATCH: SMH ($459.54 Wed) is 16.9% under its 50-day; wait for a close back above $486 before calling a bottom." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 17: software sell-off on AI-disruption fears into the Anthropic IPO. Salesforce −9.45% to $194.52, Intuit −7.17% to $320.79, ServiceNow −6.51%; IGV −3.29% to $95.74. TIKR argues funds sold software to raise cash for ANT (single source) [Yahoo; CNBC; TIKR]", tickers: "IGV · CRM · INTU",
    rec: "SELL rallies / WATCH: CRM (RSI 24) and INTU are oversold but have no repair signal; IGV chains are too wide to trade." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Tue Nov 17 AMC → Wed: NVIDIA Q3 beat (rev. $115.8B vs $109.1B; EPS $2.68 vs $2.47; Q4 guide ~$130B vs $125.1B) was sold. Up ~3–4% pre-market Wed, closed −2.89% at $150.96, 5th straight loss and ~−26% in November; interim CEO Kress, board won't reinstate Huang [CNBC; Yahoo]", tickers: "NVDA · SMH · CRWV",
    rec: "AVOID catching it: selling the beat is a bearish tell, but RSI 21 is deeply oversold. Wait for the Bessent deadline (~Nov 25) to pass." },
  { id: "t4", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Wed Nov 18 AMC: Palo Alto FQ1 beat and raise. Adj. EPS $1.05 vs $0.97, rev. $3.44B (+39%) vs $3.31B, FY27 rev. guide $14.52–14.57B vs $14.16B cons.; $4.5B all-stock Applied Compute deal. PANW +9.90% in the session on a cyber rally (CRWD +7.95%, FTNT +5.87%), then ~+7–9% after hours [CNBC; SiliconANGLE; Yahoo]", tickers: "PANW · CRWD · FTNT",
    rec: "HOLD / don't chase: two-day gains near +18% leave little room; CRWD (Dec 1) is the next test of cyber momentum." },
  { id: "t5", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Wed Nov 18 evening: Anthropic (ANT) prices its Nasdaq IPO at $83, above the $70–78 range, upsized to ~979.6M shares raising $81.3B (record), ~$1.5T valuation; books ~6–7x covered. Amazon +3.82% to $267.74 into the deal; NQ futures +1.0–1.6% overnight [CNBC; Yahoo; StockTitan; Fool]", tickers: "AMZN · QQQ · IGV",
    rec: "BUY strength selectively via defined risk (see the AMZN play); avoid chasing ANT itself in the opening cross." },
  { id: "t6", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Wed Nov 18: chip dispersion. AMD +5.31% to $530.14, Broadcom +3.64% to $354.05, while NVIDIA fell 2.89% and Micron −1.00%; SMH −0.12% [Yahoo; CNBC]", tickers: "AMD · AVGO · SMH",
    rec: "WATCH: rotation within semis, not a group bottom; SMH remains below both its 50- and 200-day." },
  { id: "t7", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Thu Nov 19: Anthropic (ANT) first trade on Nasdaq; timing set by the IPO cross (can be hours after 9:30, as SpaceX's 11:46 am debut was in June); closing Nov 20 [CNBC; Yahoo]", tickers: "QQQ · AMZN · IGV",
    rec: "WATCH: a strong debut supports AI sentiment and AMZN; a broken deal (below $83) would hit the Nasdaq bounce futures are pricing." },
  { id: "t8", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Thu Nov 19: Alibaba BMO (7:00 ET call) and PDD BMO (CONFIRMED); Intuit AMC (cons. EPS $2.47 Zacks, guide $2.44–2.48; fell ~9–11% after its Aug print) and Keysight AMC (EST.) [Alibaba / PDD / Intuit IR; Zacks]", tickers: "INTU · BABA · PDD",
    rec: "WATCH: INTU reports into AI-disruption fears; BABA (RSI 25) reports after a −17% week. No plays into these binaries." },
  { id: "t9", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24: Analog Devices BMO (guide EPS $3.86 ±$0.15); Workday (cons. EPS $2.75), Autodesk (guide $3.04–3.09), HP AMC (CONFIRMED); Dell AMC (EST.; cons. EPS $6.59 / rev. $49.24B) [ADI, WDAY, ADSK, HPQ IR; Benzinga]", tickers: "DELL · WDAY · ADI",
    rec: "WATCH: Dell is the AI-server read after NVIDIA; Workday tests whether the software sell-off was overdone." },
  { id: "t10", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "~Wed Nov 25 (EST., 10 days from Sun Nov 15): Treasury Sec. Bessent's window for NVIDIA's board and outside counsel to answer export-compliance questions; he urged an outside CEO [CNBC; Al Jazeera]", tickers: "NVDA · SMH",
    rec: "WATCH (both ways): a credible board answer or CEO hire can spark a squeeze in an oversold name; escalation hits the chip group." },
  { id: "t11", ind: "tech", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 – Fri Dec 4: AWS re:Invent, Las Vegas (CONFIRMED); CEO Matt Garman keynote Tue Dec 1, 8:30 am PT [AWS APN blog]", tickers: "AMZN · CRM · SNOW",
    rec: "WATCH: agentic-AI launches are a sentiment catalyst for AMZN into December (see the AMZN play)." },
  { id: "t12", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Dec 1 AMC: Marvell (guide EPS $1.05–1.15), CrowdStrike (cons. EPS $0.31 / rev. $1.53B), Okta, MongoDB, Credo (all CONFIRMED). Same day: Huang closed-door House committee interview [company IR; CNBC]", tickers: "CRWD · MRVL · OKTA",
    rec: "WATCH: CRWD reports after a +8% cyber rally, so the bar is high; MRVL is the first AI-silicon print after NVIDIA." },
  { id: "t13", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Dec 2 AMC: Salesforce FQ3 (CONFIRMED by Salesforce IR; cons. n/a in retrieved sources) and Snowflake; House Energy & Commerce asked NVIDIA interim CEO Kress for a briefing by Dec 2 [Salesforce IR; Snowflake; CNBC]", tickers: "CRM · SNOW · IGV",
    rec: "WATCH: CRM is −21.5% in a month (RSI 24); AI-agent monetization commentary decides whether software stabilizes." },
  // ---- ENERGY / COMMODITIES ----------------------------------------
  { id: "e1", ind: "energy", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Wed Nov 18: gold breaks $3,750. Spot −3.27% to $3,722.60 (lowest since Sep 2025), silver −4.95%; GLD −3.20% to $341.19, Newmont −6.05%, Freeport −6.96% on hawkish minutes and a 19-month dollar high [Kitco; TASS; Yahoo]", tickers: "GLD · NEM · SLV",
    rec: "SELL rallies with defined risk (see the GLD play); invalid on a close above $356." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Wed Nov 18, 10:30 am: EIA crude +3.4M bbl vs ~+0.06M (Reuters poll), gasoline +5.2M vs +1.6M; WTI settled −3.2% at $83.26, lowest since Aug 26; Chevron −4.74%, Exxon −3.97%, XLE −3.27% to $61.29 [Reuters; Invezz; Yahoo]", tickers: "XLE · XOM · CVX",
    rec: "SELL rallies in crude-linked names; XLE puts quote 31–86% wide, so no play." },
  { id: "e3", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17, 4:30 pm: API crude +5.28M bbl, gasoline +5.12M (prior week +9M crude) — a second straight large build ahead of EIA [Oil & Gas 360; Invezz]", tickers: "USO · XLE",
    rec: "WATCH: back-to-back builds point to oversupply into OPEC+." },
  { id: "e5", ind: "energy", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Nov 25: EIA weekly petroleum report (normal 10:30 slot presumed, unverified) and nat-gas storage moved to 12:00 pm for Thanksgiving [EIA schedule]", tickers: "USO · XLE",
    rec: "WATCH: a third big crude build would extend WTI's ~−16% month." },
  { id: "e6", ind: "energy", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "Sun Nov 29: OPEC+ meeting (CONFIRMED by OPEC): core-8 monthly output decision, JMMC, 2027 capacity review; Dec output was held on Nov 1 and sources expect no change before 2027 [OPEC press release]", tickers: "USO · XLE · XOM",
    rec: "WATCH (both ways): a hold is expected; any hint of higher 2027 baselines extends crude's slide. Stay defined-risk through the weekend gap." },
  // ---- HEALTHCARE / PHARMA -----------------------------------------
  { id: "h1", ind: "health", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 16 → Tue Nov 17: CMS proposes rule CMS-6098-P extending RADV audit extrapolation back to payment year 2018 with no FFS adjuster (~$9B/yr recoveries, ~$90B over 10 yrs; comments to Jan 19, 2027). UNH −5.42% to $389.68, Humana −3.88% [Heygotrade; Benzinga; Yahoo]", tickers: "UNH · HUM · CVS",
    rec: "SELL rallies: a dated regulatory overhang with a two-month comment period." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Wed Nov 18: managed-care rout deepens. UnitedHealth −10.21% to $349.91 on 17.4M shares (vs ~5.9M avg), now below its 200-day; Humana −12.98%, Elevance −7.63%, CVS −5.20%; Dow −1.11% on the weight [Heygotrade; Yahoo; Fool]", tickers: "UNH · HUM · ELV",
    rec: "SELL rallies with defined risk (see the UNH play); invalid on a close back above the 200-day ($368)." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Wed Nov 18: GLP-1 leaders slip. Lilly −2.32% to $1,382.75 despite a China approval for its oral GLP-1 and a $5.9B oncology licensing deal; Novo −3.12% on share loss to Lilly [Heygotrade; Yahoo; Bloomberg]", tickers: "LLY · NVO",
    rec: "HOLD LLY: still 9.9% above its 50-day; Novo's share loss is the structural story." },
  { id: "h4", ind: "health", dayIdx: 2, future: false, impact: 1, dir: "BULLISH",
    headline: "Wed Nov 18: FDA approves Sanofi's venglustat (Infilbray) for type 3 Gaucher neurological manifestations, a week ahead of its Nov 25 PDUFA [Sanofi via BioSpace; RTTNews]", tickers: "SNY",
    rec: "HOLD: incremental for a mega-cap." },
  { id: "h5", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Sun Nov 22 PDUFA: Capricor deramiocel (Duchenne; resubmission after a 2025 CRL; BioPharmaWatch approval odds 62%) and Savara molgramostim (autoimmune PAP; priority review; odds 85%) — weekend dates [BioPharm International; StockTitan; BioPharmaWatch]", tickers: "CAPR · SVRA",
    rec: "AVOID binary sizing: single-outcome events; react Monday, don't pre-position." },
  { id: "h6", ind: "health", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Medtronic FQ2 (CONFIRMED; cons. EPS $1.33–1.34 vs guide $1.32–1.34; beat 8 of the last 8) [MarketBeat; Zacks]", tickers: "MDT · XLV",
    rec: "WATCH: beat history is strong but consensus sits at the top of the guide." },
  { id: "h7", ind: "health", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27 PDUFA: BridgeBio BBP-418 (LGMD2I/R9, priority review) and GSK neladalkib (ALK+ NSCLC); PolyPid D-PLEX100 Sat Nov 28 [PR Newswire; BioPharmaWatch]", tickers: "BBIO · GSK",
    rec: "WATCH: a binary on a holiday half-session; defined-risk only." },
  { id: "h8", ind: "health", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 PDUFA: Vertex povetacicept in IgA nephropathy (accelerated approval, priority review; RAINIER −52% UPCR at wk 36) and Cogent bezuclastinib + sunitinib in GIST [Vertex IR; BioSpace; BioPharmaWatch]", tickers: "VRTX · COGT",
    rec: "HOLD VRTX: an approval is expected and incremental; COGT is the higher-beta binary." },
  // ---- FINANCIALS / RATES / CRYPTO ---------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Mon Nov 16: S&P 500 −1.92% to 7,416.59, Russell 2000 −1.70%, VIX +18.7% to 22.91; JPMorgan software-bug outage (not cyber); GS, MS, JPM each −2%+ [Yahoo; Seeking Alpha]", tickers: "SPY · IWM · JPM",
    rec: "HEDGE: index bear put spreads fit while the S&P sits on its 200-day." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17: KBW Bank Index −2%, nearing a death cross; JPM −2.44% to $329.96; S&P 500 −1.03% to 7,340.53, Russell 2000 −1.50% to 2,701.87, VIX 25.46 [Yahoo; Seeking Alpha; Kalkine]", tickers: "KRE · JPM · XLF",
    rec: "WATCH: banks lose leadership; JPM ($324.11) now sits on its 200-day." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Wed Nov 18, 2:00 pm: FOMC minutes — almost all see further hikes as likely appropriate; a couple open to >25 bp in December; AI-related debt flagged as a stability risk. S&P 500 −0.23% to 7,323.63 (5th straight loss), first close below its 200-day in 155 sessions; 10-yr ~5.07–5.10%; DXY ~103.8, 19-month high [CNBC; Fool; Kitco]", tickers: "SPY · TLT · IWM",
    rec: "HEDGE: an index break below the 200-day keeps bear spreads on IWM (see the play); invalid on a close above $280." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Wed Nov 18: housing starts 1.309M (+9.9% m/m) but permits 1.295M vs ~1.38M cons., lowest since May 2020; 20-yr auction stops through at 5.459% (no tail, b/c 2.63); TLT +0.84% [Census; Reuters; Yahoo]", tickers: "TLT · XHB",
    rec: "WATCH: weak permits plus a clean auction gave bonds a rare bid." },
  { id: "f5", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Wed Nov 18: crypto slide extends. Bitcoin ~$63.5k (−1.6%); spot BTC ETFs −$306.5M (IBIT −$148.7M), Nov-to-date −$2.58B; IBIT −2.16% to $35.36, Strategy −6.40% to $90.32, Coinbase −3.92% [Farside via KuCoin; bitcoin.com; Yahoo]", tickers: "IBIT · MSTR · COIN",
    rec: "SELL rallies with bear put spreads (see the IBIT play); RSI 21 argues against unhedged shorts." },
  { id: "f6", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "TODAY Thu Nov 19, 8:30 am: jobless claims (cons. ~196–200K), Philly Fed (cons. 20.6; prior 20.9); Jefferson 9:25, Barr 2:15; 10-yr TIPS auction 1:00 pm ($19B) [Investing.com; federalreserve.gov; Helious]", tickers: "TLT · IWM",
    rec: "WATCH: another sub-200K claims print keeps the December hike locked (FedWatch ~95% for 25 bp)." },
  { id: "f7", ind: "finance", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 20: monthly options expiration; UMich sentiment 10:00 (fcst 51.5); Waller 8:25 am, Cook 12:15 pm [Helious; federalreserve.gov]", tickers: "SPY · QQQ",
    rec: "WATCH: pinning and heavy volume after the NVIDIA / IPO week; avoid opening size into the close." },
  { id: "f8", ind: "finance", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 23: S&P Global flash PMIs 9:45 (prior mfg 54.9, services 56.1); $69B 2-yr auction; Tue Nov 24: Conference Board confidence (prior 91.7), $70B 5-yr auction [S&P Global; Treasury]", tickers: "SPY · TLT",
    rec: "WATCH: strong services data keeps the hiking path intact." },
  { id: "f9", ind: "finance", dayIdx: 9, future: true, impact: 3, dir: "BULLISH", conf: 1, basis: "Cleveland Fed nowcast core PCE +0.27% m/m vs ~0.30% Street cons. (soft surprise → TLT up) [Cleveland Fed; desk previews]",
    headline: "Wed Nov 25, 8:30 am: October PCE (core cons. ~0.3% m/m; Sep 3.1% y/y), Q3 GDP 2nd est. (prior 3.4%), durable goods; $44B 7-yr auction 1:00; Beige Book 2:00 pm (CONFIRMED by BEA / Fed) [bea.gov; federalreserve.gov; Helious]", tickers: "TLT · GLD · IWM",
    rec: "WATCH (both ways): a soft core print (≤0.27%) lifts TLT and squeezes the bear plays — respect their invalidation levels; a hot one (≥0.35%) revives 50 bp talk and hits TLT, GLD and IWM." },
  { id: "f10", ind: "finance", dayIdx: 10, future: true, impact: 1, dir: "MIXED",
    headline: "Thu Nov 26: Thanksgiving, US markets closed; Fri Nov 27 early close 1:00 pm [LiteFinance; federalreserve.gov]", tickers: "SPY",
    rec: "NOTE: holiday-thin liquidity; avoid opening short-dated positions Wednesday afternoon." },
  { id: "f11", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 30 close: MSCI deletes Strategy from MSCI USA (effective Dec 1); ~13M shares (3.1%) held by trackers, est. $1.5–3B forced selling. Strategy holds 850,364 BTC at a $75,456 average cost, above spot [CoinDesk; Yahoo; cryptonews]", tickers: "MSTR · IBIT",
    rec: "WATCH: forced selling is known and partly priced (MSTR −36.7% in a month); don't catch the knife before the close." },
  { id: "f12", ind: "finance", dayIdx: 15, future: true, impact: 3, dir: "MIXED",
    headline: "Tue Dec 1, 10:00 am: ISM manufacturing (Oct 55.5) and JOLTS; Chicago PMI Mon 9:45 (prior 55.3); ADP Wed Dec 2; ISM services Thu Dec 3 (EST.); Fed blackout ~Nov 28 – Dec 10 ahead of the Dec 8–9 FOMC; jobs report Fri Dec 4 [ISM; BLS; federalreserve.gov]", tickers: "SPY · TLT",
    rec: "WATCH: the last big data before the Dec 9 hike decision; strong ISM prices keep 50 bp in play." },
  // ---- CONSUMER / RETAIL -------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17: Nike investor day — FY27 EPS guide $1.15–1.35, sales may fall through FY28 before market-level growth in FY29; FY31 EPS target $3.00–3.50. Opened +6.3%, closed −6.30% at $35.85; Morgan Stanley UW $25, Truist Sell $29 [FXLeaders; Yahoo]", tickers: "NKE · XLY",
    rec: "SELL rallies: a longer turnaround than hoped; NKE ($36.31) is under its 50-day." },
  { id: "c2", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BEARISH",
    headline: "Tue Nov 17 BMO: Home Depot adj. EPS $3.86 vs $3.84, comps +2.2% vs +1.8%, but FY EPS growth trimmed to ~2%; Richard McPhail named CEO. HD −2.45% to $339.01 [CNBC; HD 8-K; Yahoo]", tickers: "HD · LOW",
    rec: "WATCH: housing demand is soft (permits at a 5-year low); no edge into the holidays." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Wed Nov 18 BMO: Target Q3 adj. EPS $2.65 vs $2.07 (incl. ~$0.50 tariff refund), comps +5.6% vs +3.8%, FY EPS guide raised to $10.65–11.40. TGT +4.01% to $165.93 [CNBC; Globe and Mail; Yahoo]", tickers: "TGT · XRT",
    rec: "HOLD: a clean comp beat, though tariff refunds flatter EPS." },
  { id: "c4", ind: "consumer", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Wed Nov 18 BMO: TJX adj. EPS $1.34 vs ~$1.33 (6th straight beat), sales $16.0B vs ~$15.85B, comps +4%, FY guide raised, buyback ~$3.0B. TJX +8.05% to $140.30 [TJX 8-K; CNBC; Yahoo]", tickers: "TJX · ROST",
    rec: "HOLD / read-through: off-price strength sets up Ross tonight; TJX options are 10–33% wide, so no play." },
  { id: "c5", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Wed Nov 18 BMO: Lowe's adj. EPS $3.10 vs $2.89 (incl. $0.34 tariff refund; ~$2.76 ex-refund), comps +1.8%, FY sales guide raised to ~$92.5B. Fell 2.5–4.7% pre-market, closed +1.05% at $222.78 [Lowe's release; Startup Fortune; Benzinga; Yahoo]", tickers: "LOW · HD",
    rec: "HOLD: the reversal off pre-market lows shows dip demand; ex-refund EPS missed, so upside is limited." },
  { id: "c6", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Wed Nov 18: Disney +4.63% to $122.36, a 52-week closing high, extending its FQ4 beat (adj. EPS $1.77 vs $1.68; FY27 double-digit EPS growth guide; dividend +33%) on target raises (Guggenheim $135, BofA) [TradingKey; 247wallst; Yahoo]", tickers: "DIS",
    rec: "HOLD: momentum is strong (RSI 70), but OTM DIS options quote 14–27% wide, so no play." },
  { id: "c7", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Wed Nov 18: Take-Two +6.22% to $216.61 as GTA VI scores 99 on Metacritic; Sensor Tower 15.9M pre-orders ($1.54B); +8.4% after hours [FinanceFeeds; KuCoin; Yahoo]", tickers: "TTWO · SONY",
    rec: "HOLD: the launch is priced for a blockbuster; first sales disclosure could come as early as Nov 20." },
  { id: "c8", ind: "consumer", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY Thu Nov 19, 7:00 am: Walmart Q3 FY27 (CONFIRMED; cons. EPS $0.64 at the top of the $0.62–0.64 guide; rev. ~$186.5–187.3B); options imply ~±6.4%; fell on report day in 3 of the last 4. Also Williams-Sonoma BMO; Ross, Gap AMC; GTA VI launches [Admiral Markets; Zacks; earnings-watcher]", tickers: "WMT · XLP",
    rec: "WATCH (both ways): a beat is likely, but the reaction has skewed negative; the previous report's WMT spreads resolve today." },
  { id: "c10", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 24 BMO: Best Buy (cons. EPS $1.48–1.49; EST.), Dollar Tree ($0.91), Dick's (CONFIRMED), J.M. Smucker ($2.56); Abercrombie, Burlington, Kohl's dates unconfirmed [TheStreet; MarketBeat; DKS release]", tickers: "XRT · BBY · DLTR",
    rec: "WATCH: the last big retail read before Black Friday; options too thin for plays." },
  { id: "c11", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 27: Black Friday (1:00 pm close); Adobe forecasts $12.9B online (+9.2%), Cyber Monday Nov 30 $15.1B, holiday online spend $275.1B (+6.7%) [Adobe via Digital Commerce 360]", tickers: "AMZN · XRT",
    rec: "WATCH: early Adobe tallies set the retail tone into December." },
  { id: "c12", ind: "consumer", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Dec 3: Dollar General, Kroger BMO (cons. EPS $1.41 / $1.16); Ulta AMC (EST.); Veeva, Cooper AMC [TheStreet; Earnings Whispers]", tickers: "DG · KR · ULTA",
    rec: "WATCH: the low-income consumer read after Black Friday." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "UNH", name: "UnitedHealth Group", rank: 1, spot: "$349.91 (Wed Nov 18 close, −10.21%; post-mkt ~$349.83, <1%, so Wed-close premiums kept) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings before expiry (next ~mid-Jan, n/a) · CMS RADV rule CMS-6098-P comment period to Jan 19, 2027 (CONFIRMED) · Warren 'Break Up Big Medicine Act' push · PCE Nov 25 · ex-dividend date n/a in retrieved sources (short calls are 11% OTM)",
    iv: "IV 41% (Dec 18 ATM) vs 20-day realized 47.0% · IVR n/a · Dec 18 straddle ±9.4% · 1σ to expiry ±$40.34", liq: "A — 188k contracts traded Wed (full session), 20d avg 5.6M shares; OI 1,500 / 3,642 on 390C/400C, 2,249 / 1,333 on 350P/310P, 2,407 / 2,961 on 330P/300P; legs $0.10–0.40 wide (1.3–9.1% of mid) [Cboe delayed chain]",
    thesis: "A fundamental break: CMS's Nov 16 proposal to extrapolate Medicare Advantage RADV audits back to 2018 (~$9B/yr industry recoveries) sent UNH −5.4% Tuesday and −10.2% Wednesday to $349.91 on 3x volume, below its 200-day ($367.91) and 10.4% under its 50-day, with HUM −13% confirming; the overhang runs until comments close Jan 19. Risk: RSI 28.5 after a −16.5% month invites a sharp reflex bounce, and a CMS walk-back would erase the move. Invalid above $368 (a close back over the 200-day). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $390C / buy $400C (mids 3.100 − 1.875) · Dec 18 '26 · credit $1.23 · capital ~$877 · max profit ~$123 · BE $391.23 · R:R 1:0.14 · POP ~83% · exit +50% (~$0.62) / stop on a close above $368; close by Dec 11 — short strike at ~1σ ($390.25), above the 200-day" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $350P / sell $310P (mids 16.850 − 4.450) · Dec 18 '26 · debit $12.40 · capital ~$1,240 · max profit ~$2,760 · BE $337.60 · R:R 1:2.23 · POP ~40% · exit +75–100% / stop −50% (~$21.70–$24.80 / ~$6.20) or a close above $368 — at-the-money long (Δ −0.49), short at the 1σ low ($309.57)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $330P / sell $300P (mids 9.000 − 3.100) · Dec 18 '26 · debit $5.90 · capital ~$590 · max profit ~$2,410 · BE $324.10 · R:R 1:4.08 · POP ~28% · exit +100% (~$11.80) / stop −50% (~$2.95) or a close above $368 — OTM long (Δ −0.31) for a continuation through Wednesday's $342.46 low" },
    ] },
  { ticker: "GLD", name: "SPDR Gold Shares", rank: 2, spot: "$341.19 (Wed Nov 18 close, −3.20%; post-mkt ~$341.88, gold futures −0.24% overnight, <1%, so Wed-close premiums kept) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF), no dividend · jobless claims Nov 19 · core PCE / GDP Nov 25 (CONFIRMED; Cleveland nowcast core +0.27% vs ~0.30% cons.) · ISM / JOLTS Dec 1 · jobs Dec 4 · FOMC Dec 9 with ~95% odds of +25 bp [FedWatch via Kitco]",
    iv: "IV 25.6% (Dec 18 ATM) vs 20-day realized 29.8% · IVR n/a · Dec 18 straddle ±5.9% · 1σ to expiry ±$24.62", liq: "A — 441k contracts traded Wed (full session), 20d avg 9.9M shares; OI 2,670 / 3,049 on 365C/375C, 16,008 / 1,651 on 340P/320P, 4,715 / 9,979 on 330P/310P; legs $0.06–0.20 wide (2.2–4.9% of mid) [Cboe delayed chain]",
    thesis: "The gold unwind accelerated: hawkish minutes and a 19-month dollar high (DXY ~103.8) pushed spot −3.27% to $3,722.60, the lowest since Sep 2025, and GLD −3.2% to $341.19, 9.7% under its 50-day and 16.2% under its 200-day, −9.7% in a month. Implied vol (25.6%) sits below realized (29.8%), so put spreads are cheap. Risk: RSI 30.6 at the $340.76 52-week low, and the Cleveland Fed's soft core-PCE nowcast (Nov 25) could spark a short-covering rally. Invalid above $356 (back above Tuesday's breakdown level). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $365C / buy $375C (mids 2.700 − 1.450) · Dec 18 '26 · credit $1.25 · capital ~$875 · max profit ~$125 · BE $366.25 · R:R 1:0.14 · POP ~80% · exit +50% (~$0.63) / stop on a close above $356; close by Dec 11 — short strike at ~1σ ($365.81), below the 50-day ($377.64)" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $340P / sell $320P (mids 8.900 − 2.950) · Dec 18 '26 · debit $5.95 · capital ~$595 · max profit ~$1,405 · BE $334.05 · R:R 1:2.36 · POP ~40% · exit +75–100% / stop −50% (~$10.41–$11.90 / ~$2.98) or a close above $356 — near-the-money long (Δ −0.45), short near the 1σ low ($316.57)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $330P / sell $310P (mids 5.250 − 1.630) · Dec 18 '26 · debit $3.62 · capital ~$362 · max profit ~$1,638 · BE $326.38 · R:R 1:4.52 · POP ~29% · exit +100% (~$7.24) / stop −50% (~$1.81) or a close above $356 — OTM long (Δ −0.30) for a continuation through the 1σ low" },
    ] },
  { ticker: "IBIT", name: "iShares Bitcoin Trust ETF", rank: 3, spot: "$35.36 (Wed Nov 18 close, −2.16%; post-mkt ~$35.92 (+1.6%) so premiums re-estimated (ESTIMATE); Bitcoin ~$63.6k) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF), no dividend · spot BTC ETFs −$306.5M Wed (IBIT −$148.7M), Nov-to-date −$2.58B [Farside via KuCoin; bitcoin.com] · MSCI deletes Strategy at the Nov 30 close (CONFIRMED; est. $1.5–3B forced selling) · PCE Nov 25 · FOMC Dec 9",
    iv: "IV 47% (Dec 18 ATM), 45.6% (Jan 15) vs 20-day realized 39.8% · IVR n/a · implied move n/a (no binary) · 1σ ±$4.76 to Dec 18 / ±$6.46 to Jan 15 (from ~$35.92)", liq: "A — 700k contracts traded Wed (full session), 20d avg 46.0M shares; OI 11,116 / 64,374 on Jan 36P/30P, 30,460 / 21,329 on Dec 36P/32P, 13,109 / 31,768 on Dec 34P/30P; legs $0.01–0.06 wide (1.3–4.7% of mid) [Cboe delayed chain]",
    thesis: "Bitcoin's bear trend keeps grinding: IBIT is 21.3% under its 50-day ($44.96) and 13.6% under its 200-day ($40.92), −24.3% in a month, with spot-ETF outflows of −$2.58B month-to-date (IBIT −$2.25B) and Strategy, whose 850k BTC cost basis ($75,456) is now underwater, facing MSCI deletion on Nov 30. IV (47%) is above realized (39.8%), so these are spreads, not long puts. Risk: RSI 21 is extreme and a post-market bounce (+1.6%) shows how violent short-covering can be; a soft PCE could lift all risk assets. Invalid above $41 (a close over the 200-day). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (wide, longer-dated)", text: "Buy $36P / sell $30P · Jan 15 '27 · debit $1.81 (ESTIMATE at ~$35.92; Wed-close mids 2.770 − 0.780 = $1.99) · capital ~$181 · max profit ~$419 · BE $34.19 · R:R 1:2.31 · POP ~43% · exit +75% (~$3.17) / stop −50% (~$0.91) or a close above $41 — 57 days of runway to survive a relief bounce; short near the Jan 1σ low ($29.46)" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $36P / sell $32P · Dec 18 '26 · debit $1.27 (ESTIMATE; Wed-close mids 2.185 − 0.745 = $1.44) · capital ~$127 · max profit ~$273 · BE $34.73 · R:R 1:2.15 · POP ~43% · exit +75–100% / stop −50% (~$2.22–$2.54 / ~$0.64) or a close above $41 — at-the-money long (Δ ≈ −0.50), short near the 1σ low ($31.16)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $34P / sell $30P · Dec 18 '26 · debit $0.75 (ESTIMATE; Wed-close mids 1.300 − 0.430 = $0.87) · capital ~$75 · max profit ~$325 · BE $33.25 · R:R 1:4.33 · POP ~31% · exit +100% (~$1.50) / stop −50% (~$0.38) or a close above $41 — pays ~4.3:1 if Bitcoin loses $60k into the MSCI deletion" },
    ] },
  { ticker: "AMZN", name: "Amazon", rank: 4, spot: "$267.74 (Wed Nov 18 close, +3.82%; post-mkt ~$271.63 (+1.45%) so premiums re-estimated by delta (ESTIMATE); NQ futures +1.0–1.6% overnight) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bullish",
    catalyst: "Anthropic (ANT) prices at $83, above range, first trade today Nov 19 (CONFIRMED) · AWS re:Invent Nov 30 – Dec 4, Garman keynote Dec 1 (CONFIRMED) · Black Friday / Cyber Monday (Adobe: online +9.2% BF) · no earnings before expiry (next ~late Jan, n/a) · no dividend",
    iv: "IV ~36% (Dec 18 ATM) vs 20-day realized 42.4% · IVR n/a · 1σ to expiry ±$27.56 (from ~$271.63)", liq: "A — 1.07M contracts traded Wed (full session), 20d avg 50.3M shares; OI 10,548 / 20,770 on 245P/240P, 18,464 / 17,488 on 270C/290C, 23,022 / 44,941 on 280C/300C; legs $0.04–0.25 wide (2.4–4.2% of mid) [Cboe delayed chain]",
    thesis: "Relative strength into two dated catalysts: AMZN rose 3.82% to $267.74 Wednesday while the S&P fell, a new 20-day closing high, 4.9% above its 50-day and 9.3% above its 200-day, as the record $81.3B Anthropic IPO priced above range; re:Invent (Dec 1 keynote) and Black Friday follow. Debit spreads cap cost with IV (36%) under realized (42%). Risk: bullish picks have failed in this tape (UNH, WMT, AAPL in recent reports), the S&P just lost its 200-day, and a sloppy ANT debut could reverse Wednesday's gain. Invalid below $255 (the 50-day). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Put Credit Spread", text: "Sell $245P / buy $240P · Dec 18 '26 · credit $0.67 (ESTIMATE at ~$271.63; Wed-close mids 3.575 − 2.755 = $0.82) · capital ~$433 · max profit ~$67 · BE $244.33 · R:R 1:0.15 · POP ~80% · exit +50% (~$0.33) / stop on a close below $255; close by Dec 11 — short strike ~1σ below spot and under the 50-day" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $270C / sell $290C · Dec 18 '26 · debit $8.24 (ESTIMATE; Wed-close mids 10.425 − 3.250 = $7.18) · capital ~$824 · max profit ~$1,176 · BE $278.24 · R:R 1:1.43 · POP ~39% · exit +75–100% / stop −50% (~$14.42–$16.48 / ~$4.12) or a close below $255 — near-the-money long (Δ ≈ 0.55), short near the 1σ high ($299)" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $280C / sell $300C · Dec 18 '26 · debit $5.41 (ESTIMATE; Wed-close mids 6.150 − 1.620 = $4.53) · capital ~$541 · max profit ~$1,459 · BE $285.41 · R:R 1:2.70 · POP ~29% · exit +100% (~$10.82) / stop −50% (~$2.71) or a close below $255 — a breakout bet through the $287.20 52-week high on re:Invent" },
    ] },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", rank: 5, spot: "$270.12 (Wed Nov 18 close, +0.40%; post-mkt ~$271.44 (+0.49%), RTY futures +0.48%, <1%, so Wed-close premiums kept) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No earnings (ETF); distribution date n/a in retrieved sources (short calls OTM) · claims / Philly Fed Nov 19 · flash PMIs Nov 23 · core PCE / GDP Nov 25 (CONFIRMED) · ISM / JOLTS Dec 1 · jobs Dec 4 · FOMC Dec 9, ~95% odds of +25 bp, ~5% of +50 bp",
    iv: "IV 22.6% (Dec 18 ATM) vs 20-day realized 25.7% · IVR n/a · Dec 18 straddle ±5.3% · 25Δ-area put IV 26.7% (255P) vs call IV 19.7% (285C) · 1σ to expiry ±$17.21", liq: "A — 1.89M contracts traded Wed (full session), 20d avg 24.2M shares; OI 9,911 / 6,571 on 287C/292C, 104,411 / 90,964 on 270P/250P, 131,419 / 78,228 on 260P/245P; legs $0.03–0.08 wide (1.1–5.7% of mid) [Cboe delayed chain]",
    thesis: "Small caps remain the purest index expression of the rate shock and serve as this list's index hedge: the S&P 500 just closed below its 200-day for the first time in 155 sessions, and IWM ($270.12) sits 3.3% under its 50-day ($279.38) and 3.4% under its 200-day ($279.55), −4.6% in a week, with the 10-year near 5.1%, a December hike ~95% priced and minutes open to more. VIX (24.56) still sits above VIX3M (24.29). Risk: IWM held its Tuesday low and futures are bouncing on the Anthropic debut; a soft core PCE (nowcast 0.27%) could squeeze it back to the $280 cluster. Invalid above $280 (a close over both averages). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $287C / buy $292C (mids 1.075 − 0.525) · Dec 18 '26 · credit $0.55 · capital ~$445 · max profit ~$55 · BE $287.55 · R:R 1:0.12 · POP ~85% · exit +50% (~$0.28) / stop on a close above $280; close by Dec 11 — short strike at ~1σ ($287.33), above the 50/200-day cluster" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $270P / sell $250P (mids 7.150 − 2.010) · Dec 18 '26 · debit $5.14 · capital ~$514 · max profit ~$1,486 · BE $264.86 · R:R 1:2.89 · POP ~39% · exit +75–100% / stop −50% (~$9.00–$10.28 / ~$2.57) or a close above $280 — at-the-money long (Δ −0.50), short near the 1σ low ($252.91)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $260P / sell $245P (mids 3.760 − 1.520) · Dec 18 '26 · debit $2.24 · capital ~$224 · max profit ~$1,276 · BE $257.76 · R:R 1:5.70 · POP ~27% · exit +100% (~$4.48) / stop −50% (~$1.12) or a close above $280 — OTM long (Δ −0.30) for a break toward the 1σ low" },
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Thursday, Nov 19 2026 · pre-market (~2 am ET; pre-market session not yet open — post-market prints and futures used: ES +0.9%, NQ +1.6%) · stock quotes = Wed Nov 18 close (Yahoo / Cboe) · option chains, OI &amp; volume = Cboe delayed chain after the Wed Nov 18 session · AMZN &amp; IBIT premiums re-estimated (ESTIMATE) · today's events (WMT, ANT debut, INTU, claims) not yet reported</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Nov 19)
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
