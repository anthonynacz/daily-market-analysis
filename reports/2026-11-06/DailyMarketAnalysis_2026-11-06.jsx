import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, November 6, 2026 (pre-market ~01:48 ET, overnight futures only; option quotes, OI & volume = Cboe delayed chain at the Thu Nov 5 close).
 * Window: last 3 days (Nov 3) → coming 2 weeks (Nov 20).
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
  finance:  { label: "Financials / Macro",         color: "#a855f7" },
  consumer: { label: "Consumer / Retail",  color: "#ef4444" },
};

const DIR = {
  BULLISH: { glyph: "↑", label: "Bullish" },
  BEARISH: { glyph: "↓", label: "Bearish" },
  MIXED:   { glyph: "↔", label: "Mixed / uncertain" },
};


// 18-day axis: Nov 3 .. Nov 20 (last 3 days → coming 2 weeks). Today = index 3 (Nov 6).
const DAYS = [
  { idx: 0, date: "Nov 3", dow: "Tue" },
  { idx: 1, date: "Nov 4", dow: "Wed" },
  { idx: 2, date: "Nov 5", dow: "Thu" },
  { idx: 3, date: "Nov 6", dow: "Fri" }, // TODAY
  { idx: 4, date: "Nov 7", dow: "Sat" },
  { idx: 5, date: "Nov 8", dow: "Sun" },
  { idx: 6, date: "Nov 9", dow: "Mon" },
  { idx: 7, date: "Nov 10", dow: "Tue" },
  { idx: 8, date: "Nov 11", dow: "Wed" },
  { idx: 9, date: "Nov 12", dow: "Thu" },
  { idx: 10, date: "Nov 13", dow: "Fri" },
  { idx: 11, date: "Nov 14", dow: "Sat" },
  { idx: 12, date: "Nov 15", dow: "Sun" },
  { idx: 13, date: "Nov 16", dow: "Mon" },
  { idx: 14, date: "Nov 17", dow: "Tue" },
  { idx: 15, date: "Nov 18", dow: "Wed" },
  { idx: 16, date: "Nov 19", dow: "Thu" },
  { idx: 17, date: "Nov 20", dow: "Fri" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above.
const EVENTS = [
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "AI/chip wreck on Thu Nov 5: Nasdaq-100 −6.36% (26,629.81), Nasdaq Composite −5.52% to 24,315.00 (correction, below its 200-day for the first time since April), S&P 500 −4.36% to 7,353.73, Dow −3.44% to 51,523.06 (−1,833 pts), Russell 2000 −4.45% — worst day since Apr 2025 on fears a Democratic Congress slows the data-center build-out. SOX ~−12%: NVDA −9.3% ($181.60), AMD −17.3% ($404.40), MU −17.5% ($656.39), AVGO −10.4% ($291.53); VIX +70% to 28.18", tickers: "NVDA · AMD · MU · AVGO · SMH · QQQ",
    rec: "SELL/AVOID new semis longs until a base forms; after a −6% day bounces are violent — if you must trade it, use defined risk (bear call spreads into rallies, bull spreads only after a higher low). Sources: CNBC, Yahoo Finance live blog, Yahoo chart data." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "MIXED",
    headline: "Earnings on a crash tape: AppLovin +31% to $356.10 (Q3 rev +55%, Q4 guide above the Street) while Qualcomm −9.5% to $156.75 (weak outlook despite a beat) and Arm −13% to $166.72 (despite beating); Oracle ~−7%, Palantir −9.7%, CoreWeave ~−10%, Nebius ~−15%, Iren ~−17%", tickers: "APP · QCOM · ARM · ORCL · PLTR · CRWV",
    rec: "WATCH: guidance, not beats, is setting prices. APP's +31% gap is a momentum trade, not an entry; QCOM/ARM — WAIT for a base after the gap." },
  { id: "t3", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "Election-aftermath rally on Wed Nov 4: Dow +3.03% to 53,356.12, S&P 500 +1.58% to 7,688.62, Nasdaq +1.44% to 25,736.51; VIX fell to 16.61; AAPL closed $349.51 and AMZN $266.03 — every point of it reversed within 24 hours on Nov 5", tickers: "AAPL · AMZN · SPY · QQQ",
    rec: "HOLD discipline: Nov 4 marked the high-water mark; the 'gridlock trade' lasted one session — do not extrapolate single-day moves in either direction. (Yahoo chart data)" },
  { id: "t4", ind: "tech", dayIdx: 0, future: false, impact: 1, dir: "MIXED",
    headline: "Pre-election positioning Tue Nov 3: S&P 500 +0.36% to 7,568.92, Nasdaq +0.83%, Dow −0.38%; VIX 20.83; Micron closed $855.10 and AMD $483.90 — Micron is −39.7% over the last 21 sessions in total", tickers: "MU · AMD · SPY",
    rec: "WATCH: memory had already slid from $934 (Oct 29) to $855 before Thursday's air-pocket — the unwind started before the headline. (Yahoo chart data)" },
  { id: "t5", ind: "tech", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 9 after close: Take-Two (cons. EPS $0.49) and Rocket Lab (cons. EPS −$0.05) report; date per Nasdaq earnings calendar (company confirmation not independently checked)", tickers: "TTWO · RKLB",
    rec: "WATCH: small-size only; both are high-beta into a fragile tape." },
  { id: "t6", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "CoreWeave Q3 results after close Tue Nov 10 (cons. EPS −$1.45; Nasdaq calendar) — first neocloud print after the Nov 5 data-center-moratorium scare (CRWV ~−10%, Nebius ~−15%)", tickers: "CRWV · NBIS · NVDA",
    rec: "AVOID levered neoclouds into the print; read-across to NVDA's Nov 17 demand commentary." },
  { id: "t7", ind: "tech", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Anthropic IPO: public S-1 filed Oct 26 with the price range blank; SEC's 15-day rule puts the roadshow at ~Nov 10 at the earliest, with a listing 'in the second half of November' still unconfirmed (Leverage Shares, Oct 30) — ESTIMATED timing", tickers: "AMZN · GOOGL",
    rec: "WATCH: read-across for AMZN/GOOGL stake marks; timing may slip if the AI-capex scare persists." },
  { id: "t8", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Cisco FQ1 (cons. EPS $1.15) and Applied Materials FQ4 (cons. EPS $4.06) after close Thu Nov 12 (Nasdaq calendar) — wafer-fab demand after Lam −36% / AMAT −30% in a month (Yahoo)", tickers: "CSCO · AMAT · LRCX · SMH",
    rec: "WATCH: AMAT's WFE guide is the cleanest read on whether chip capex is really being cut; avoid pre-positioning long." },
  { id: "t9", ind: "tech", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "Nvidia Q3 FY27 results Tue Nov 17 after close (CONFIRMED on NVIDIA IR: call 5pm ET; cons. EPS $2.49 per Nasdaq) — inside the Nov 20 monthly expiry; the single biggest test of the AI-capex narrative", tickers: "NVDA · AMD · AVGO · SMH · QQQ",
    rec: "WATCH: stock −23.5% in 21 sessions, IV ~62% (Cboe) — do not buy short-dated premium into the print; defined-risk spreads only." },
  { id: "t10", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Palo Alto Networks FQ1 after close Wed Nov 18 (cons. EPS $0.52; Nasdaq calendar)", tickers: "PANW · CRWD",
    rec: "WATCH: software was hit Nov 5 (CrowdStrike −10% at the lows); PANW's guide sets the tone." },
  { id: "t11", ind: "tech", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Intuit FQ1 (cons. EPS $2.47) and Keysight FQ4 (cons. EPS $3.09) after close Thu Nov 19 (Nasdaq calendar)", tickers: "INTU · KEYS",
    rec: "WATCH: low-signal; sized small." },
  { id: "t12", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Overnight (01:48 ET): S&P futures flat (ES 7,383), Nasdaq-100 futures +0.8% (NQ 26,964), Russell futures −0.2% — a muted bounce after the rout; Bitcoin −6% to ~$75.6k", tickers: "SPY · QQQ · IWM",
    rec: "WATCH: don't chase a futures bounce before the 8:30 jobs print; a failed bounce below the 200-day area is the bearish tell." },
  { id: "e1", ind: "energy", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Oil breaks lower Wed Nov 4: WTI −8.3% to $88.12 and Brent to $94.62 (from Brent $117.64 on Oct 30); XLE −4.7% that day as Middle East diplomacy hopes rose", tickers: "XLE · XOM · CVX · USO",
    rec: "SELL/avoid energy longs — the war-premium is deflating; XLE is −10.3% in five sessions." },
  { id: "e2", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Oil bounces while equities crash Thu Nov 5: WTI +2.7% to $90.52, Brent +3.9% to $98.29; XLE still −3.0% to $61.63, XOM −2.4% to $165.30, CVX −1.9% to $212.93", tickers: "XLE · XOM · CVX",
    rec: "HOLD/WATCH: energy fell with the market despite oil rising — no safe-haven bid; wait for XLE to reclaim $65 (50-day)." },
  { id: "e3", ind: "energy", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "Crude firm overnight: WTI ~$91.7 (+1.3%), Brent ~$100; Vistra and Enbridge report pre-market today", tickers: "CL · VST · ENB",
    rec: "WATCH: oil headline risk is two-way on diplomacy." },
  { id: "e4", ind: "energy", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 9: Constellation Energy (cons. EPS $3.90) and NRG (cons. EPS $3.44) before the open; Occidental (cons. EPS $1.43) after the close — AI-power demand vs data-center policy risk (Nasdaq calendar)", tickers: "CEG · NRG · OXY",
    rec: "WATCH: CEG/NRG trade as AI-capex proxies — expect high beta to the data-center debate." },
  { id: "h1", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Healthcare outperformed in the rout: XLV −2.5% to $184.91 (vs SPY −4.4%; +9.5% over 21 sessions, above 50/200-day), but XBI −6.7%, Lilly −3.7% to $1,364.73, UnitedHealth −3.3% to $395.72; Moderna +13% on Nov 4 to $258.38", tickers: "XLV · XBI · LLY · UNH · MRNA",
    rec: "HOLD defensives (XLV/XLP) but note XLV's option quotes are too wide to trade defined-risk; biotech (XBI) is still beta — AVOID adds." },
  { id: "h2", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Humana (cons. EPS −$1.03) and Moderna (cons. EPS −$1.10) report pre-market today (Nasdaq calendar); AHA Scientific Sessions open in Chicago (Nov 6–9)", tickers: "HUM · MRNA · XLV",
    rec: "WATCH: managed-care guide for 2027 is the swing factor for HUM; MRNA +13% into the print — a high bar." },
  { id: "h3", ind: "health", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "AHA Scientific Sessions: Braunwald late-breaking session opens Sat Nov 7, 8:35 ET (Lp(a) HORIZON pelacarsen analyses, OPTIMAL-Stroke, others) — official AHA/TCTMD", tickers: "NVS · AMGN · LLY",
    rec: "WATCH: cardiology read-across; HORIZON extended analyses are not the primary readout." },
  { id: "h4", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "AHA final-day cardiometabolic late-breaker Mon Nov 9, 8:00 ET: SYNCHRONIZE-CVOT (survodutide CV outcomes in obesity, BI/Zealand)", tickers: "LLY · NVO · ZEAL",
    rec: "WATCH: obesity-class read-across for LLY/NVO." },
  { id: "h5", ind: "health", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "FDA PDUFA Sat Nov 14: Summit Therapeutics ivonescimab + chemo (EGFR NSCLC BLA) and BioXcel IGALMI at-home use (per trackers — ESTIMATED); decisions can land Fri Nov 13. Savara (Nov 22) and Nuvalent (Nov 27) fall just past the window", tickers: "SMMT · BXCL",
    rec: "WATCH: binary events — defined-risk only, size small; confirm the date on company releases." },
  { id: "f1", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "TODAY 8:30 ET: October jobs report (BLS). Consensus not retrievable this run (the Nov 5 report cited ~65k; unverified). First hard data after the crash; CME FedWatch Dec 9 hike odds fell to ~70% from 82.7% (CNBC)", tickers: "SPY · TLT · IWM · KRE",
    rec: "WATCH: a hot print revives hike pricing (bad for small caps/tech); a very weak print can flip the narrative to growth-scare. Don't add risk before 8:30." },
  { id: "f2", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Volatility inverts: VIX 28.18 vs VIX3M 25.55; S&P 500 closed 7,353.73, just above its 200-day (~7,323); Russell 2000 in correction (−4.45%, below its 200-day); retail investors net sold $358M, their biggest day since 2020 (CNBC)", tickers: "SPY · IWM · VIX",
    rec: "Hedge, don't guess: keep puts/put spreads on small caps and momentum; a close below the ~7,323 200-day would confirm the break." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Financials sold with the market: JPM −4.2% to $337.34, BAC −3.6% ($49.76), XLF −2.9%, KRE −2.5%; Caterpillar −6% (industrials XLI −4.1%) — yet XLF is still +7% over 21 sessions and above its 50/200-day", tickers: "JPM · BAC · XLF · KRE · CAT",
    rec: "HOLD, don't add: banks fell on beta, not credit news; a bounce toward the 50-day (JPM $342) is where to reassess." },
  { id: "f4", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Macro on Thu: Bank of England hiked 25 bp to 4.0% (first hike since 2023); US 10-year 4.84% (−1.2%); weekly jobless claims 189k; Q3 productivity +3.6%; gold ~$4,114", tickers: "TLT · GLD · SPY",
    rec: "WATCH: yields fell, bonds up (TLT $81.93) — rare in a hike-risk regime; the Fed hike debate is still live for Dec 9." },
  { id: "f5", ind: "finance", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "KKR Q3 before the open Mon Nov 9 (cons. EPS $1.41; Nasdaq calendar) — private-credit marks", tickers: "KKR · BX · APO",
    rec: "WATCH." },
  { id: "f6", ind: "finance", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "October CPI, 8:30 ET Tue Nov 10 (BLS-confirmed) — first inflation print after the Oct 28 FOMC; Dec 9 hike odds ~70% hinge on it", tickers: "SPY · TLT · IWM · XLF",
    rec: "WATCH: hot CPI = bearish for small caps and long-duration tech (supports bear put spreads); benign = squeeze risk for shorts — hedge sizing matters." },
  { id: "f7", ind: "finance", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Veterans Day Wed Nov 11 — US bond market closed, stock market open (standard market calendar; not re-verified this run); thin liquidity the day after CPI", tickers: "SPY · TLT",
    rec: "WATCH: avoid late-day new risk." },
  { id: "f8", ind: "finance", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "October PPI, 8:30 ET Fri Nov 13 (BLS-confirmed)", tickers: "SPY · TLT · XLF",
    rec: "WATCH: pipeline inflation after the oil swings." },
  { id: "f9", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "October retail sales, 8:30 ET Tue Nov 17 (date per Finance Calendar aggregator — ESTIMATED; confirm with Census) — same morning as Home Depot, Disney", tickers: "XRT · XLY · SPY",
    rec: "WATCH: consumer-spending resilience into the holiday guides." },
  { id: "f10", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "FOMC minutes of the Oct 27–28 meeting, 2:00 ET Wed Nov 18 (listed on federalreserve.gov's Nov 2026 calendar; day per aggregators — ESTIMATED) — how many members leaned toward a December hike", tickers: "SPY · TLT · XLF",
    rec: "WATCH: hawkish minutes would hit small caps/tech; position through spreads, not outright." },
  { id: "f11", ind: "finance", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "Monthly options expiration Fri Nov 20 (third Friday) with NVDA's Nov 17 print and the Nov 18 minutes inside the week; elevated gamma after VIX 28 — S&P quarterly triple witching is Dec 18", tickers: "SPY · QQQ · IWM · NVDA",
    rec: "WATCH: close or roll Nov 20 short-dated options by Nov 13; pin/gamma risk is high." },
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Tesla −10.8% to $343.69 (below its 200-day ~$384 and 50-day ~$372; SpaceX shares also −9%) on regulatory worries after the Democratic sweep; annual meeting is Dec 3 and Barclays flagged a possible Tesla–SpaceX merger announcement before it (Electrek/Barclays) — XLY −3.8%", tickers: "TSLA · XLY",
    rec: "AVOID chasing TSLA lower after a −10.8% day; WATCH: bearish below $330; a bear call spread above $410 fits, but merger headlines can squeeze — keep size small." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Defensives held up: XLP −0.75% (21-day +11.7%), Costco +1.8% to $1,065.59, Walmart −1.1% to $127.72; McDonald's +6% on Wed after a beat then −1% Thursday; Wendy's rejected a ~$1.4B Trian offer", tickers: "XLP · COST · WMT · MCD · WEN",
    rec: "HOLD staples exposure; COST is the strongest relative-strength name but valuation-heavy — don't chase." },
  { id: "c3", ind: "consumer", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "Airbnb, Duke Energy and Lumentum reported after Thursday's close; University of Michigan prelim sentiment 10:00 ET today", tickers: "ABNB · UMICH",
    rec: "WATCH: low-signal vs the jobs print." },
  { id: "c4", ind: "consumer", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Singles' Day (Nov 11) — global e-commerce read ahead of US Black Friday (standard calendar; not re-verified this run)", tickers: "BABA · JD · PDD",
    rec: "WATCH." },
  { id: "c5", ind: "consumer", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Home Depot (cons. EPS $3.86) and Disney (cons. EPS $1.67) before the open Tue Nov 17 (Nasdaq calendar) — housing and parks/streaming reads", tickers: "HD · DIS",
    rec: "WATCH: HD guidance sets the housing tone; DIS +5.7% since Oct 30, a higher bar." },
  { id: "c6", ind: "consumer", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "TJX (cons. $1.33), Lowe's (cons. $2.86) and Target (cons. $2.04) before the open Wed Nov 18 (Nasdaq calendar) — first holiday guides", tickers: "TJX · LOW · TGT",
    rec: "WATCH: TGT is the weak-comp setup; TJX the resilient one." },
  { id: "c7", ind: "consumer", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "Walmart FQ3 before the open Thu Nov 19 (cons. EPS $0.64; ~$1.02T market cap; Nasdaq calendar) — the consumer bellwether for the holiday season", tickers: "WMT · COST · XLP",
    rec: "WATCH: WMT guide moves XLP/XLY; staples are the defensive trade — don't buy after a run into the print." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "IWM", name: "iShares Russell 2000 ETF", rank: 1, spot: "$270.98 (Thu Nov 5 close, −4.6%; ~$271.2 overnight, RTY futures −0.2%; pre-market not yet trading at 01:48 ET) [Yahoo Finance chart / Cboe delayed quote $271.24]", sentiment: "Bearish",
    catalyst: "Break of the 200-day & 50-day · Oct jobs report TODAY 8:30 ET (BLS) · Oct CPI Tue Nov 10 (BLS-confirmed) · PPI Nov 13 · FOMC minutes ~Nov 18 (EST.) · Dec 9 FOMC hike odds ~70% (CME via CNBC) · Dec 18 expiry is after every one of these",
    iv: "IV ~24–27% (Dec 18, Cboe; ATM ~24.5%) · IVR n/a · no earnings (ETF) · RV10 29% vs IV → options cheap · 1σ to Dec 18 ≈ ±$22.5 (±8.3%)",
    liq: "A — Nov 5 full session ~3.34M contracts (crash day; 20d avg n/a) & 50.8M shares [Cboe / Yahoo]; Dec 18 OI 98.0k on the 270P, 71.5k on the 250P, 134.7k on the 260P, 40.9k / 56.4k on the 295C / 300C; legs 1.5–5.7% wide ($0.04–0.10)",
    thesis: "Russell 2000 fell 4.45% to 2,729.89 and IWM closed $270.98 — below its 200-day ($278.98) and 50-day ($282.63), in correction, with the Dec 9 hike still ~70% priced and CPI/PPI/minutes ahead; small caps carry the most rate and financing sensitivity. IWM IV (~24–27%) is cheap vs 10-day realized vol (29%), so debit spreads are the efficient expression. Risk: after a −4.5% day a sharp short-covering bounce (Nasdaq futures +0.8%) can retake $279, and a soft jobs print would lower hike odds. Invalid on a close above $284 (Nov 4 close). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $295C / buy $300C · Dec 18 '26 · credit $0.45 (mids 0.97 − 0.53) · capital ~$455 · max profit ~$45 · BE $295.45 · R:R 1:0.10 · POP ~89% (1−|Δ short 0.11|) · exit: buy back at ~$0.23 (+50% of credit), stop if IWM closes above $284 (invalidation) or tags $293, close by Dec 11 — short strike ~+8.9% (~1.07σ) above spot; tiny credit and R:R but very high POP; OI 40.9k/56.4k" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $270P / sell $250P · Dec 18 '26 · debit $5.16 (mids 8.71 − 3.54) · capital ~$516 · max profit ~$1,484 · BE $264.84 · R:R 1:2.88 · POP ~39% (lognormal, IV 28%) · exit +75% (spread ≈$9.03) / stop −50% (≈$2.58) or IWM closes above $284; close with ≥10 days left (by Dec 8) — near-the-money long leg (|Δ| 0.47), short leg at the $250 round number (−7.7%); R:R ~2.9:1" },
      { profile: "Aggressive", strategy: "Long Put (OTM)", text: "Buy $260P · Dec 18 '26 · debit $5.49 (mid; bid/ask 5.44/5.54) · capital ~$549 · max profit uncapped (target +100% ≈ $549; R:R 1:2 to target) · BE $254.51 · POP ~24% (lognormal, IV 27%) · exit +100% / stop −50% (≈$2.75) or IWM closes above $284; close with ≥10 days left (by Dec 8) — low IV (cheap vs RV10 29%); 3 weeks+ to go; bet on follow-through to the $255 area" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 2, spot: "$344.17 (Thu Nov 5 close, −1.5%; ~$343.3 overnight; QQQ futures +0.8%) [Yahoo Finance chart / Cboe delayed quote $343.83]", sentiment: "Bullish",
    catalyst: "Relative-strength holder on a −6% Nasdaq-100 day · Oct jobs TODAY / CPI Nov 10 are the macro swing · no earnings before expiry (next ~late Jan, EST.) · Dec 18 is quad-witching · ex-dividend date not verified this run (short legs are OTM)",
    iv: "IV30 26.7% (Cboe) · Dec 18 strikes 23–31% (put skew) · IVR n/a · RV10 35% / RV20 26% · 1σ to Dec 18 ≈ ±$31.8 (±9.2%)",
    liq: "A — Nov 5 full session ~1.47M contracts (crash day; 20d avg n/a) & 75.5M shares [Cboe / Yahoo]; Dec 18 OI 9.2k / 9.0k on 315P / 305P, 7.4k / 5.3k on 345C / 365C, 28.7k on 360C; legs 4.5–8.7% wide ($0.20–0.40)",
    thesis: "AAPL lost only 1.5% on a day the S&P fell 4.4% and QQQ 6.5%, and it sits above its 50-day ($335.5) and 200-day ($298.3) ~3% below its $355.38 high — the cash-rich platform is the market's relative-strength refuge from AI-capex plumbing. Because the regime is RISK-OFF the lead idea is an income put spread well below the 50-day. Risk: mega-cap correlation — if QQQ breaks lower, AAPL follows; and Nov 4's +5.3% pop was given back in part. Invalid on a close below $330 (under the 50-day). Conviction 4/5 (bias re-examined: all 4 bullish plays from the last report lost money).",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $315P / buy $305P · Dec 18 '26 · credit $1.25 (mids 3.92 − 2.67) · capital ~$875 · max profit ~$125 · BE $313.75 · R:R 1:0.14 · POP ~82% (1−|Δ short 0.18|) · exit: buy back at ~$0.62 (+50% of credit), stop if AAPL closes below $325 or the invalidation $330 breaks, close by Dec 11 — short strike ~8.5% / ~0.93σ below spot and ~6% under the 50-day; no earnings before expiry" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $345C / sell $365C · Dec 18 '26 · debit $8.60 (mids 13.20 − 4.60) · capital ~$860 · max profit ~$1,140 · BE $353.60 · R:R 1:1.33 · POP ~39% (lognormal, IV 25%) · exit +75% (spread ≈$15.05) / stop −50% (≈$4.30) or AAPL closes below $330; close with ≥10 days left (by Dec 8) — at-the-money long leg (Δ 0.53), short at the ~+6% target; R:R >1:1" },
      { profile: "Aggressive", strategy: "Long Call (OTM)", text: "Buy $360C · Dec 18 '26 · debit $6.20 (mid; bid/ask 6.00/6.40) · capital ~$620 · max profit uncapped (target +100% ≈ $620; R:R 1:2 to target) · BE $366.20 · POP ~24% (lognormal, IV 24%) · exit +100% / stop −50% (≈$3.10) or AAPL closes below $330; close with ≥10 days left (by Dec 8) — IV ~24% is below RV10 35% — a stated vol edge; momentum retest of the $355 high" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 3, spot: "$343.69 (Thu Nov 5 close, −10.8%; ~$345.7 overnight) [Yahoo Finance chart / Cboe delayed quote $345.70]", sentiment: "Bearish",
    catalyst: "Lost 200-day ($384) & 50-day ($372) · regulatory overhang after the Democratic sweep (SpaceX −9% too) · annual meeting Dec 3 (before the Dec 18 expiry) with Barclays flagging a possible SpaceX merger announcement beforehand (two-way gap risk) · no earnings before expiry (next ~late Jan, EST.)",
    iv: "IV30 56.9% (Cboe) · Dec 18 ATM ~54–55% (Nov 20 strikes 63–78%) · IVR n/a · RV10 71% / RV20 56% · 1σ to Dec 18 ≈ ±$64 (±18.6%)",
    liq: "A — Nov 5 full session ~2.31M contracts (crash day; 20d avg n/a) & 79.1M shares [Cboe / Yahoo]; Dec 18 OI 5.2k / 8.2k on 410C / 420C, 7.9k / 14.7k on 340P / 300P, 3.3k on 325P; legs 2.1–5.1% wide ($0.10–0.35)",
    thesis: "TSLA broke below both its 200-day ($384.3) and 50-day ($372.1) with a −10.8% flush to $343.69, 31% under its $498.83 high, while the political/regulatory discount on the Musk complex and a messy SpaceX-merger narrative cap rallies. High IV (~55%) means selling a call spread above $410 (~1σ) is the primary expression, with put debit spreads for downside. Risk: an oversold bounce or a merger headline can squeeze it 10%+ quickly — realized vol is 71%. Invalid on a close above $385 (200-day). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $410C / buy $420C · Dec 18 '26 · credit $1.20 (mids 4.88 − 3.67) · capital ~$880 · max profit ~$120 · BE $411.20 · R:R 1:0.14 · POP ~83% (1−|Δ short 0.17|) · exit: buy back at ~$0.60 (+50% of credit), stop if TSLA closes above $385 or tags $410, close by Dec 11 — short strike +19% / ~1.04σ above spot and above the broken 200-day; harvests ~55% IV" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $340P / sell $300P · Dec 18 '26 · debit $13.22 (mids 23.12 − 9.90) · capital ~$1,322 · max profit ~$2,678 · BE $326.78 · R:R 1:2.03 · POP ~36% (lognormal, IV 58%) · exit +75% (spread ≈$23.14) / stop −50% (≈$6.61) or TSLA closes above $385; close with ≥10 days left (by Dec 8) — at-the-money long leg (Δ 0.43), short at the ~$300 round-number support; R:R ~2:1" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread", text: "Buy $325P / sell $300P · Dec 18 '26 · debit $7.12 (mids 17.02 − 9.90) · capital ~$712 · max profit ~$1,788 · BE $317.88 · R:R 1:2.51 · POP ~31% (lognormal, IV 59%) · exit +75% (spread ≈$12.46) / stop −50% (≈$3.56) or TSLA closes above $385; close with ≥10 days left (by Dec 8) — tighter OTM put spread (high IV → no outright long put); cheaper entry" },
    ] },
  { ticker: "AMZN", name: "Amazon", rank: 4, spot: "$260.21 (Thu Nov 5 close, −2.2%; ~$257.8 overnight) [Yahoo Finance chart / Cboe delayed quote $258.40]", sentiment: "Bullish",
    catalyst: "Anthropic IPO: S-1 filed Oct 26, roadshow earliest ~Nov 10, listing 'second half of Nov' unconfirmed (Leverage Shares; EST.) — Amazon holds a large stake (estimates 'mid-to-high teens', not disclosed) · Oct jobs TODAY / CPI Nov 10 · no earnings before expiry (next ~late Jan, EST.)",
    iv: "IV30 37.6% (Cboe) · Dec 18 ATM ~36–37% (put skew to 41%) · IVR n/a · RV10 45% / RV20 43% · 1σ to Dec 18 ≈ ±$32.7 (±12.6%)",
    liq: "A — Nov 5 full session ~0.94M contracts (crash day; 20d avg n/a) & 85.4M shares [Cboe / Yahoo]; Dec 18 OI 15.7k / 11.7k on 230P / 220P, 15.9k / 19.8k on 260C / 285C, 19.9k on 280C; legs 4.6–8.1% wide ($0.20–0.45)",
    thesis: "AMZN fell just 2.2% vs QQQ −6.5% and is +6.7% over five sessions, holding above its 50-day ($253.9) and 200-day ($243.8); a possible Anthropic listing inside the window is a live mark-to-market catalyst. With IV elevated (~37%) the lead idea is an income put spread below 1σ, then a call spread that spans the IPO window. Risk: AI-capex/regulation fears hit AWS sentiment, and the IPO may slip if risk appetite stays shut. Invalid on a close below $245 (50-day). Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $230P / buy $220P · Dec 18 '26 · credit $1.23 (mids 3.65 − 2.42) · capital ~$877 · max profit ~$123 · BE $228.77 · R:R 1:0.14 · POP ~83% (1−|Δ short 0.17|) · exit: buy back at ~$0.61 (+50% of credit), stop if AMZN closes below $245 or the $230 short strike, close by Dec 11 — short strike ~11.6% / ~0.9σ below spot and under the 200-day area; Δ −0.17" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $260C / sell $285C · Dec 18 '26 · debit $9.95 (mids 14.27 − 4.33) · capital ~$995 · max profit ~$1,505 · BE $269.95 · R:R 1:1.51 · POP ~40% (lognormal, IV 36%) · exit +75% (spread ≈$17.41) / stop −50% (≈$4.97) or AMZN closes below $245; close with ≥10 days left (by Dec 8) — at-the-money long leg (Δ 0.55), short at the ~+9.5% target spanning the IPO window; R:R >1:1" },
      { profile: "Aggressive", strategy: "Long Call (OTM)", text: "Buy $280C · Dec 18 '26 · debit $5.57 (mid; bid/ask 5.35/5.80) · capital ~$557 · max profit uncapped (target +100% ≈ $557; R:R 1:2 to target) · BE $285.57 · POP ~23% (lognormal, IV 34%) · exit +100% / stop −50% (≈$2.79) or AMZN closes below $245; close with ≥10 days left (by Dec 8) — OTM call (IV 36% ≈ RV10 45%, so premium is not rich vs realized) for an IPO-driven re-rating" },
    ] },
  { ticker: "META", name: "Meta Platforms", rank: 5, spot: "$605.08 (Thu Nov 5 close, −4.0%; ~$605.5 overnight) [Yahoo Finance chart / Cboe delayed quote $605.55]", sentiment: "Bearish",
    catalyst: "AI-capex unwind: capex guide raised twice in 2026 (Apr: $125–145B; Jul: ~$137.5B per Pluang — figures conflict) with weaker monetization visibility vs Alphabet/Amazon cloud · below 50-day ($674) & 200-day ($632) · no earnings before expiry (next ~late Jan, EST.) · ex-dividend date not verified this run (short legs OTM)",
    iv: "IV30 44.3% (Cboe) · Dec 18 ~41–47% · IVR n/a · RV10 32% / RV20 41% · 1σ to Dec 18 ≈ ±$90 (±14.9%)",
    liq: "A — Nov 5 full session ~0.67M contracts (crash day; 20d avg n/a) & 28.5M shares [Cboe / Yahoo]; Dec 18 OI 23.0k / 1.1k on 700C / 710C, 1.4k / 3.1k on 595P / 560P, 3.0k / 2.9k on 570P / 540P; legs 3.7–8.1% wide ($0.25–1.00)",
    thesis: "META is −16.1% over 21 sessions, −4.0% on Thursday, and below both its 50-day ($674.1) and 200-day ($632.1); investors are discounting a capex bill ($125–145B+) against less visible AI revenue than Alphabet or Amazon, and the data-center-policy scare adds an overhang. IV (~44%) is roughly fair vs RV (32–41%), so defined-risk debit spreads and a far-OTM call spread are used. Risk: a relief bounce with Nasdaq futures +0.8%, buyback support, and a hot-CPI-driven squeeze. Invalid on a close above $650. Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $700C / buy $710C · Dec 18 '26 · credit $1.27 (mids 7.42 − 6.15) · capital ~$873 · max profit ~$127 · BE $701.27 · R:R 1:0.15 · POP ~82% (1−|Δ short 0.18|) · exit: buy back at ~$0.64 (+50% of credit), stop if META closes above $650 or the $700 short strike, close by Dec 11 — short strike +15.7% / ~1.05σ above spot, 10 wide to fit the $1,500 cap" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $595P / sell $560P · Dec 18 '26 · debit $12.38 (mids 29.85 − 17.48) · capital ~$1,238 · max profit ~$2,262 · BE $582.62 · R:R 1:1.83 · POP ~37% (lognormal, IV 45%) · exit +75% (spread ≈$21.67) / stop −50% (≈$6.19) or META closes above $650; close with ≥10 days left (by Dec 8) — near-the-money long leg (Δ 0.41); short at the ~$560 target; R:R ~1.8:1" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread", text: "Buy $570P / sell $540P · Dec 18 '26 · debit $7.97 (mids 20.45 − 12.47) · capital ~$797 · max profit ~$2,203 · BE $562.03 · R:R 1:2.76 · POP ~29% (lognormal, IV 46%) · exit +75% (spread ≈$13.95) / stop −50% (≈$3.98) or META closes above $650; close with ≥10 days left (by Dec 8) — tighter OTM put spread (IV ~44% → no outright long put); R:R ~2.8:1" },
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Nov 6 2026 · pre-market (option data = Thu close)</b> · window: last 3 days → next 2 weeks ·
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
