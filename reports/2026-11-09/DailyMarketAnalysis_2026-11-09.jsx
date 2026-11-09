import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Monday, November 9, 2026 — pre-market ~01:50 ET (US pre-market not yet open); quotes = Fri Nov 6 close; option quotes, OI & volume = Cboe delayed chain at the Fri Nov 6 close.
 * Window: last 3 days (Nov 6) → coming 2 weeks (Nov 23).
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

// 18-day axis: Nov 6 .. Nov 23 (last 3 days → coming 2 weeks). Today = index 3 (Nov 9).
const DAYS = [
  { idx: 0, date: "Nov 6", dow: "Fri" },
  { idx: 1, date: "Nov 7", dow: "Sat" },
  { idx: 2, date: "Nov 8", dow: "Sun" },
  { idx: 3, date: "Nov 9", dow: "Mon" }, // TODAY
  { idx: 4, date: "Nov 10", dow: "Tue" },
  { idx: 5, date: "Nov 11", dow: "Wed" },
  { idx: 6, date: "Nov 12", dow: "Thu" },
  { idx: 7, date: "Nov 13", dow: "Fri" },
  { idx: 8, date: "Nov 14", dow: "Sat" },
  { idx: 9, date: "Nov 15", dow: "Sun" },
  { idx: 10, date: "Nov 16", dow: "Mon" },
  { idx: 11, date: "Nov 17", dow: "Tue" },
  { idx: 12, date: "Nov 18", dow: "Wed" },
  { idx: 13, date: "Nov 19", dow: "Thu" },
  { idx: 14, date: "Nov 20", dow: "Fri" },
  { idx: 15, date: "Nov 21", dow: "Sat" },
  { idx: 16, date: "Nov 22", dow: "Sun" },
  { idx: 17, date: "Nov 23", dow: "Mon" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS -------------------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "AI/chip wreck (Thu Nov 5, just before the window; aftermath Fri Nov 6): SOX −12.2%, Nasdaq-100 −6.4% (26,630), S&P 500 −4.4% (7,354), VIX +70% to 28.18 — worst S&P day since Apr 2025; Nasdaq enters correction on data-center-restriction fears after Democratic midterm gains (CBS)", tickers: "NVDA · AMD · MU · AVGO · SMH",
    rec: "AVOID chasing: after a −12% SOX day bounces are violent both ways. Use defined risk only (bear call spreads into rallies; bull spreads only after a higher low). Sources: Yahoo chart data, CBS News." },
  { id: "t2", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "MIXED",
    headline: "Single-stock carnage on the Nov 5 crash tape (carried into Fri): AMD −17.3% ($404), MU −17.5% ($656), AMAT −13.6%, ARM −13.1%, PLTR −9.7%, QCOM −9.5%, INTC −10.3% — while AppLovin +31% (to $356) after its print", tickers: "AMD · MU · AMAT · ARM · PLTR · APP",
    rec: "WATCH: 5-day losses of 10–22% in semis put RSI near 30. Wait for a base (higher low) rather than catching knives; APP's +31% gap is momentum, not an entry. (Yahoo chart data)" },
  { id: "t3", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Fri Nov 6 relief bounce: SOX +4.2%, Nasdaq +1.1% (24,579; 4th straight weekly loss, −3.4% wk), NVDA +2.8%, AMD +11%, INTC +7.7%, MU +5.1%; IREN +20% on results; Dow −0.5%, S&P +0.3% (7,377)", tickers: "NVDA · AMD · MU · INTC · IREN · QQQ",
    rec: "HOLD/WATCH: a bounce in a 4-week downtrend (QQQ −12% in 21 days, below 50d & 200d) is not a trend change. Reclaiming the Nov 5 gap is the bar. (Yahoo, Reuters via MLQ, CBS)" },
  { id: "t4", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Mon Nov 9 AMC: Take-Two (cons. EPS $0.49) and Rocket Lab (−$0.05) report [EST. per Nasdaq calendar]; Anthropic IPO roadshow reportedly starts this week (reports, unconfirmed)", tickers: "TTWO · RKLB · MSFT · AMZN · GOOGL",
    rec: "WATCH: IPO supply/valuation headlines can move AI-complex sentiment; no action on a single-day read. Treat IPO timing as unconfirmed (Reuters/Bloomberg-sourced reports conflict)." },
  { id: "t5", ind: "tech", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Tue Nov 10 AMC: CoreWeave reports (cons. EPS −$1.45) [EST.] — neocloud/AI-capex bellwether after CRWV −20% in 2 sessions", tickers: "CRWV · NVDA · NBIS · IREN",
    rec: "WATCH: backlog/financing commentary is the tell for AI-infrastructure credit; wait for the print, high-IV binary." },
  { id: "t6", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Thu Nov 12 AMC: Cisco (cons. EPS $1.15) and Applied Materials (cons. EPS $4.06) report [EST. per Nasdaq]; CSCO −18% and AMAT −35% in 21 days; Nebius reports BMO", tickers: "CSCO · AMAT · NBIS · SMH",
    rec: "WATCH: AMAT's WFE/China commentary reprices all of semicap; both are deeply oversold (RSI ~28–31) so a 'less bad' guide can squeeze — use defined risk if at all." },
  { id: "t7", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Mon Nov 16 BMO: Baidu (cons. EPS $0.57) reports [EST.] — China-AI demand read into the NVDA print the next day", tickers: "BIDU · NVDA · MSFT",
    rec: "WATCH: China-AI demand read-through into NVDA's print the next day." },
  { id: "t8", ind: "tech", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "NVIDIA FQ3 earnings — Tue Nov 17 after close, 5pm ET call (CONFIRMED, NVDA IR); cons. EPS ~$2.47–2.49, rev ~$108.8B (MarketBeat/Nasdaq); stock −19% in 21d, RSI 31; options imply ≈ ±10–11% [Cboe]", tickers: "NVDA · AMD · AVGO · SMH · MU",
    rec: "WATCH: the single biggest AI-sentiment catalyst of the window; guidance (data-center demand, supply) decides direction. Bull call spread or put credit spread fits; do not buy naked premium at ~53% IV." },
  { id: "t9", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Microsoft Ignite, San Francisco — Nov 17–20 (event listings; not confirmed on microsoft.com this run) [EST.]", tickers: "MSFT",
    rec: "HOLD: MSFT is the relative-strength megacap (above 50d/200d); agentic-AI/Copilot news is a modest tailwind, not a thesis driver." },
  { id: "t10", ind: "tech", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Nov 18 AMC: Palo Alto Networks (cons. EPS $0.52) reports [EST.] — security software read on enterprise budgets", tickers: "PANW · CRWD · MSFT",
    rec: "WATCH: guide vs a high bar; wait for the reaction." },
  { id: "t11", ind: "tech", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 19 AMC: Intuit (cons. EPS $2.47) reports [EST.]; NetEase BMO", tickers: "INTU · NTES",
    rec: "WATCH: software multiple test amid higher rates." },
  { id: "t12", ind: "tech", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 20 — monthly options expiration (third Friday); SPY/QQQ/NVDA gamma pins and post-NVDA positioning unwind", tickers: "SPY · QQQ · NVDA · AAPL",
    rec: "WATCH: expect pin/unpin volatility; avoid short-dated debit buys into the close." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Energy rolls over: XLE −12.0% and USO −12.1% over 5 sessions (XLE 61.62 = 20-day low; COP −11.5%, XOM −11.4%, OXY −11.9%); catalyst for the crude drop not verified this run", tickers: "XLE · XOM · COP · OXY · USO",
    rec: "AVOID new longs until crude stabilizes; XLE is oversold (RSI 34) so shorts are late — WATCH for a bounce to $65 (50d) to fade with a bear call spread." },
  { id: "e2", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Power/IPP stocks sold: Vistra −13.8% Nov 4 then +10.6% Fri after BMO print; Constellation −6.7% Nov 4, +4.3% Fri — data-center power-demand thesis whipsawed", tickers: "VST · CEG",
    rec: "WATCH: AI-power names trade as high-beta AI proxies; wait for stabilization." },
  { id: "e3", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Mon Nov 9: Constellation Energy (BMO, cons. EPS $3.90) and Occidental (AMC, cons. EPS $1.43) report [EST. per Nasdaq]", tickers: "CEG · OXY",
    rec: "WATCH: OXY into a −12% week; CEG guidance on data-center contracts is the swing factor." },
  { id: "e4", ind: "energy", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "Tue Nov 10 AMC: Petrobras reports (cons. EPS $1.38) [EST.]", tickers: "PBR",
    rec: "HOLD/WATCH: dividend and capex plan matter more than EPS." },
  { id: "e5", ind: "energy", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "Wed Nov 18: EIA weekly petroleum status (10:30 ET, normal Wednesday schedule) after a −12% crude-linked week [EST. timing]", tickers: "XLE · USO · XOM",
    rec: "WATCH: an inventory build would extend the slide; a draw could spark the first bounce." },
  { id: "e6", ind: "energy", dayIdx: 11, future: true, impact: 1, dir: "BEARISH",
    headline: "Energy tape check: XLE sits below its 50-day ($65.07) but above its 200-day ($59.13) — $59–60 is the next real support", tickers: "XLE · USO",
    rec: "WATCH: a close below $59 would confirm a larger trend break; until then rallies are fade candidates, not shorts at lows." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Healthcare is the market's leadership: XLV +9.9% in 21d (184.80, above 50d 173.38 and 200d 159.39), XBI +2.6% Fri; Humana +5.3% Fri after its Nov 6 print; Eli Lilly +15.8% in 21d to $1,354 (but bid-ask on LLY options is wide)", tickers: "XLV · XBI · LLY · HUM",
    rec: "HOLD winners / buy dips in XLV; avoid LLY options (illiquid spreads at most strikes — shares only)." },
  { id: "h2", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Moderna +29% in 21d to $254 (+5.3% Fri) after Nov 6 report; stock is 2.8× its 200-day ($91) heading into its Analyst Day", tickers: "MRNA",
    rec: "TRIM/AVOID chasing: extended and event-heavy; wait for the Nov 12 Analyst Day reaction." },
  { id: "h3", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 12: Moderna Analyst Day (per Wall Street Horizon calendar via search; not confirmed on company IR) [EST.]", tickers: "MRNA",
    rec: "WATCH: pipeline/cost-cut targets; implied moves are large, so only defined-risk structures." },
  { id: "h4", ind: "health", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "Tue Nov 10 AMC: Alcon reports (cons. EPS $0.89) [EST.]", tickers: "ALC",
    rec: "WATCH: eye-care demand read; low signal for the sector." },
  { id: "h6", ind: "health", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Sat Nov 14 PDUFA: ivonescimab + chemo (Summit) — goal date per one tracker (assyro/search snippet; company-announced dates not verified) [EST.]; Nov 30 giredestrant (Roche) is just outside the window", tickers: "SMMT",
    rec: "WATCH: binary biotech event; defined-risk and small size only — not a core idea. Date is aggregator-sourced." },
  { id: "h5", ind: "health", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Sun Nov 22 PDUFA: Savara molgramostim (aPAP), priority review, goal date moved from Aug 22 (search snippet; aggregator-sourced) [EST.]", tickers: "SVRA",
    rec: "WATCH: binary biotech event; only for those comfortable with defined-risk, small size — not a core idea." },

  // ---- FINANCIALS / MACRO -------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 3, dir: "BEARISH",
    headline: "Oct jobs report (BLS, Nov 6): payrolls +165k vs ~65k expected, UR 4.1% (4.2% exp.), AHE +0.4% m/m / +3.1% y/y; Aug+Sep revised +84k; CME FedWatch Dec 8–9 hike odds 76.8% (from 66.9% a week earlier)", tickers: "SPY · IWM · TLT · KRE",
    rec: "SELL rate-sensitive risk: a hike is now the base case; small caps and long-duration growth lag. A bear put spread on IWM fits if it loses $270." },
  { id: "f2", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Rates & dollar: 10-yr 4.86% (−7% in 21d, still above its 200d), DXY 102.30 (+0.7% Fri); VIX 25.64 vs VIX3M 24.60 — inverted term structure (fear still elevated)", tickers: "TLT · UUP · VIX",
    rec: "HOLD hedges: backwardated VIX says stress isn't over; do not sell volatility yet." },
  { id: "f3", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Financials split: BAC closes at a 20-day low ($49.42, −7.8% in 21d, below 50d & 200d) while XLF is +5.4% in 21d and JPM −0.8% — idiosyncratic weakness (Oct earnings hit by a reported $1.2B AML penalty, per 247WallSt snippet)", tickers: "BAC · JPM · XLF · KRE",
    rec: "AVOID BAC longs; WATCH $48 support — a close below it fits a bear put spread." },
  { id: "f4", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Mon Nov 9 BMO: KKR (cons. EPS $1.41) reports [EST.]; Nov 12 BMO Brookfield (cons. $0.72) — alt-manager/private-credit read", tickers: "KKR · BN · BX",
    rec: "WATCH: fundraising and credit marks; KKR is flat Fri (−1.9%)." },
  { id: "f5", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "OCTOBER CPI — Tue Nov 10, 8:30 ET (CONFIRMED, BLS); hot print cements a Dec 9 hike, cool print is the squeeze trigger", tickers: "SPY · QQQ · IWM · TLT",
    rec: "DE-RISK slightly into the print; hot = favors bear spreads on IWM/QQQ, cool = bounce risk — keep defined risk." },
  { id: "f6", ind: "finance", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "Wed Nov 11 — Veterans Day: NYSE/Nasdaq open, US bond market closed (SIFMA convention); thin rates liquidity after CPI", tickers: "TLT · SPY",
    rec: "WATCH: avoid rates-sensitive trades with gaps; equities trade normally." },
  { id: "f7", ind: "finance", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "OCTOBER PPI — Fri Nov 13, 8:30 ET (CONFIRMED, BLS); Japan megabanks MUFG/SMFG report", tickers: "SPY · TLT · IWM",
    rec: "WATCH: a second hot inflation print after CPI would push hike odds toward certainty." },
  { id: "f8", ind: "finance", dayIdx: 11, future: true, impact: 3, dir: "MIXED",
    headline: "OCTOBER RETAIL SALES — Tue Nov 17, 8:30 ET (Census schedule via search); lands the same day as Home Depot, Disney and NVDA", tickers: "WMT · HD · TGT · XLY · SPY",
    rec: "WATCH: strong consumer = hike confirmation; a miss helps duration but hurts retailers." },
  { id: "f9", ind: "finance", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC minutes (Oct 27–28 meeting) — ~Wed Nov 18, 2pm ET [EST.: Fed rule is three weeks after the decision; federalreserve.gov does not list the date yet]; Dec 8–9 SEP meeting is next", tickers: "SPY · TLT · IWM · KRE",
    rec: "WATCH: hawkish detail on hikes would extend the rate squeeze on small caps and long-duration tech." },
  { id: "f10", ind: "finance", dayIdx: 14, future: true, impact: 2, dir: "MIXED",
    headline: "Fri Nov 20 — monthly option expiration; Anthropic IPO targeted to price in the week of Nov 16 and list before Thanksgiving Nov 26 (press reports; not company-confirmed)", tickers: "SPY · QQQ · IWM · MSFT",
    rec: "WATCH: record-size IPO supply can drain liquidity from megacap tech; avoid assuming a date." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Airbnb +11.7% (to $190) the session after its Nov 5 AMC print; Cloudflare +9.9% likewise; Uber −0.3%, McDonald's −0.5% — consumer discretionary XLY +1.9% in 5d vs staples XLP −1.3% Fri", tickers: "ABNB · MCD · UBER · XLY · XLP",
    rec: "HOLD travel/consumer winners; staples have run (+8% in 21d) — don't add new money there into earnings." },
  { id: "c2", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Retail run-up before earnings: Walmart $125.52 (+13.5% in 21d, RSI 64; −1.7% Fri), Home Depot $343.47 (+16.3% in 21d, −1.9% Fri), Target $158.41 (+2.4%)", tickers: "WMT · HD · TGT",
    rec: "TRIM into strength before prints — bars are higher after the run; a hot jobs/hike backdrop is a headwind for HD (housing)." },
  { id: "c3", ind: "consumer", dayIdx: 11, future: true, impact: 3, dir: "BEARISH",
    headline: "Home Depot FQ3 — Tue Nov 17 BMO (cons. EPS $3.86) [EST. per Nasdaq]; Disney BMO (cons. $1.67) [EST.]; retail sales same morning", tickers: "HD · DIS · XLY",
    rec: "WATCH: HD up 16% in 21d with housing-rate headwinds — a bear put spread fits if it fails $355 (20d high). Options on HD are thin (~19k contracts/day)." },
  { id: "c4", ind: "consumer", dayIdx: 12, future: true, impact: 3, dir: "MIXED",
    headline: "Wed Nov 18 BMO: Target (cons. EPS $2.04), Lowe's ($2.86), TJX ($1.33) report [EST. per Nasdaq]", tickers: "TGT · LOW · TJX",
    rec: "WATCH: guide commentary into holiday; TGT +2.4% in 21d, LOW/TJX near highs — bars are not low." },
  { id: "c5", ind: "consumer", dayIdx: 13, future: true, impact: 3, dir: "BEARISH",
    headline: "WALMART FQ3 — Thu Nov 19 (TipRanks/days.to say BMO with 8am ET call; financecalendar.com lists ~4:05pm ET and 'not confirmed' — treat as EST.; cons. EPS $0.64; company Q3 guide $0.62–0.64); WMT +13.5% in 21d into a high bar; options imply ≈ ±7%", tickers: "WMT · COST · TGT · XLP",
    rec: "TRIM/WATCH: bearish skew into the print: bear put spread below $125 — beat-and-raise is already priced. Invalid above $131." },
  { id: "c6", ind: "consumer", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "Thu Nov 19: Ross Stores (cons. EPS $1.82) and Gap (AMC, cons. $0.73) report [EST.]", tickers: "ROST · GAP",
    rec: "WATCH: off-price traffic is the value-seeker barometer after a hot labor print." },
  { id: "c7", ind: "consumer", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "Fri Nov 20 BMO: BJ's Wholesale (cons. EPS $1.22) reports [EST.]; monthly opex", tickers: "BJ · COST · WMT",
    rec: "WATCH: closes the retail earnings week; membership-warehouse read-through." },
  { id: "c8", ind: "consumer", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "Mon Nov 9: Take-Two reports AMC (cons. $0.49) — holiday game-slate read [EST.]", tickers: "TTWO",
    rec: "WATCH: discretionary tech/entertainment read." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "IWM", name: "iShares Russell 2000 ETF", rank: 1, spot: "$273.67 (Fri Nov 6 close, +1.0%; no Mon pre-market yet (~01:50 ET); last extended-hours print $273.75) [Yahoo Finance chart / Cboe delayed quote $273.75]", sentiment: "Bearish",
    catalyst: "Oct CPI Tue Nov 10 8:30 ET (CONFIRMED, BLS) · PPI Fri Nov 13 (CONFIRMED) · Retail sales Tue Nov 17 · FOMC minutes ~Nov 18 (EST.) · Dec 8–9 FOMC hike odds 76.8% (CME FedWatch via Fox Business) · Dec 18 expiry is after every one of these · no earnings (ETF)",
    iv: "IV ~22.6% (Dec 18, ATM 273–275 ≈ 22.5%; Cboe iv30 22.6) · IVR n/a · cheap vs VIX 25.6 · 1σ to Dec 18 ≈ ±$21.7 (±7.9%) → $251.9 / $295.4",
    liq: "A — Fri Nov 6 full session ≈1.02M option contracts (20d avg n/a) & 25.5M shares (20d avg 25.4M); OI 42.4k / 57.1k on the 295C / 300C, 85.1k / 40.8k on the 275P / 255P, 66.7k on the 265P; spreads $0.02–0.09 (1–3% of mid) [Cboe delayed chain 11/6 close / Yahoo]",
    thesis: "Rate shock is not priced out: Oct payrolls +165k vs ~65k, AHE +3.1% y/y, and a Dec 9 hike is ~77% priced (CME FedWatch). IWM closed $273.67, below its 200-day ($279.00) and 50-day ($282.11), RSI 43, 20-day range $270.4–$284.0; a close under $270.4 opens $260. Carried over from the Nov 8 report (unchanged Fri close, 0.0% vs then-spot; re-checked against fresh Cboe chains): thesis still valid after the hot jobs/hike repricing. Risk: small caps held up better than the Nasdaq this week (21d −1.4%) and a cool CPI Tue is a squeeze trigger from oversold conditions. Invalid on a close above $284.0 (20-day high). Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $295C / buy $300C · Dec 18 '26 · credit $0.54 (mids 1.155 − 0.62 = 0.535) · capital ~$446 · max profit ~$53 · BE $295.54 · R:R 1:0.12 · POP ~86% (1−|Δ short 0.14|) · exit: buy back at ~50% profit (≈$0.27), or if IWM closes above $295, close by Dec 11 (~7 DTE) — short strike sits at ~1σ ($295.4), beyond the CPI/PPI moves; low R:R, a pure 'rally fails' income tier" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $275P / sell $255P · Dec 18 '26 · debit $5.62 (mids 8.885 − 3.265) · capital ~$562 · max profit ~$1,438 · BE $269.38 · R:R 1:2.56 · POP ~40% (lognormal, IV 22.4%) · exit +75–100% (~$10–11 spread value) or stop −50% (~$2.80) / IWM close above $284; close with ≥10 days left (by Dec 8, before the Dec 9 FOMC if not already at target) — near-the-money long leg (Δ −0.51), short leg at a technical/1σ-ish target" },
      { profile: "Aggressive", strategy: "Long Put (OTM)", text: "Buy $265P · Dec 18 '26 · debit $5.34 (bid/ask 5.31/5.37) · capital ~$534 · max profit uncapped (target +100% ≈ $534 → put ≈ $10.7 at IWM ~$256, ESTIMATE; R:R ~1:2 to target) · BE $259.66 · POP ~25% (lognormal, IV 24.9%) · exit +100% or stop −50% (~$2.67) / IWM close above $284; close with ≥10 days left — IV is low-moderate (22–25%, below VIX 25.6) so premium is not rich; Δ −0.34" },
    ] },
  { ticker: "NVDA", name: "NVIDIA", rank: 2, spot: "$186.64 (Fri Nov 6 close, +2.8%; extended-hours last $188.70 at 19:59 ET; no Mon pre-market yet (~01:50 ET); option marks reference ~$188.7) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bullish",
    catalyst: "FQ3 earnings Tue Nov 17 AFTER CLOSE, 5pm ET call (CONFIRMED, NVIDIA IR) · cons. EPS ~$2.47–2.49 / rev ~$108.8B (MarketBeat/Nasdaq) · estimate trend n/a · Oct CPI Nov 10, PPI Nov 13, FOMC minutes ~Nov 18 (EST.), opex Nov 20 · Dec 18 expiry is after earnings and straddles the Dec 9 FOMC",
    iv: "IV ~53–55% (Dec 18, ATM 190 = 53.2%; Cboe iv30 57.3) · IVR n/a · options imply ≈ ±10.9% to Nov 20 (190 straddle $20.65 vs ~$188.7; includes ~12 days) vs hist. avg earnings move n/a · 1σ to Dec 18 ≈ ±$33.1 (±17.7%) → $153.6 / $219.7",
    liq: "A — Fri Nov 6 full session ≈2.36M option contracts (20d avg n/a) & 179.7M shares (20d avg 117.7M); OI 14.7k / 9.8k on the 155P / 145P, 49.3k / 19.2k on the 190C / 215C, 51.9k / 74.1k on the 200C / 220C; spreads 1–5% of mid [Cboe delayed chain 11/6 close / Yahoo]",
    thesis: "Washed-out into a confirmed catalyst: NVDA −19.0% in 21 days (−8.8% in 5d), RSI(14) 30.8, $186.64 vs 50-day $219.81 / 200-day $204.67; SOX −12.2% Thu then +4.2% Fri. Support $181.6 (Nov 5 close) then $178; resistance $205 (200-day) and $220 (50-day). The bar is lower after a 19% drawdown and the print on Nov 17 is the AI-capex referendum. High IV (~53%) means debit spreads / put credit spreads rather than naked calls. Risk: data-center-restriction fears, Dec hike odds ~77% and a guide that disappoints — a −10% earnings move is already priced. Invalid on a close below $175. Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $155P / buy $145P · Dec 18 '26 · credit $1.34 (mids 3.75 − 2.41) · capital ~$866 · max profit ~$134 · BE $153.66 · R:R 1:0.15 · POP ~84% (1−|Δ short 0.16|) · exit: buy back at ~50% profit (≈$0.67) or close if NVDA closes below $155 / by Dec 11 (~7 DTE) — held THROUGH the Nov 17 print on purpose: short strike sits at ~1σ ($153.6) and 17% below spot, beyond the ±10.9% implied earnings move ($166), and IV crush works for the seller" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $190C / sell $215C · Dec 18 '26 · debit $8.58 (mids 12.275 − 3.70 = 8.575) · capital ~$857 · max profit ~$1,642 · BE $198.57 · R:R 1:1.92 · POP ~39% (lognormal, IV 53%) · exit +75–100% (~$15–17 spread value) or stop −50% (~$4.30) / NVDA close below $175; close with ≥10 days left (by Dec 8) — short leg offsets vega into the print, near-the-money long leg (Δ +0.51)" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $200C / sell $220C · Dec 18 '26 · debit $5.14 (mids 7.925 − 2.79 = 5.135) · capital ~$514 · max profit ~$1,486 · BE $205.13 · R:R 1:2.89 · POP ~31% (lognormal, IV 51%) · exit +100% (~$10 spread value) or stop −50% (~$2.57) / NVDA close below $175; close with ≥10 days left — tighter OTM spread chosen over a naked call because IV is ~53% into a binary (single long calls rejected: IVR not low)" },
    ] },
  { ticker: "MSFT", name: "Microsoft", rank: 3, spot: "$530.61 (Fri Nov 6 close, −1.0%; no Mon pre-market yet (~01:50 ET); last extended-hours print $531.40) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bullish",
    catalyst: "No earnings before expiry (next report ~late Jan, EST.) · Microsoft Ignite Nov 17–20, San Francisco (event listings; EST.) · Oct CPI Nov 10, PPI Nov 13, FOMC minutes ~Nov 18 (EST.) · Dec 9 FOMC · ex-dividend date before Dec 18 n/a (short puts are OTM, early-assignment risk low) · Dec 18 expiry",
    iv: "IV ~29.5% (Dec 18, ATM 530C/P 29.7/29.5; Cboe iv30 29.6) · IVR n/a · no binary before expiry · 1σ to Dec 18 ≈ ±$51.8 (±9.8%) → $478.8 / $582.4",
    liq: "A — Fri Nov 6 full session ≈260.7k option contracts (20d avg n/a) & 26.9M shares (20d avg 25.6M); OI 10.8k / 4.3k on the 480P / 470P, 6.3k / 11.2k on the 530C / 560C, 14.5k / 38.5k on the 550C / 580C; spreads 1.8–7.6% of mid [Cboe delayed chain 11/6 close / Yahoo]",
    thesis: "Relative strength in a broken tape: MSFT $530.61 is +1.5% in 21d versus QQQ −12.2% and SMH −23.6%, above its rising 50-day ($516.65) and 200-day ($439.85), RSI 52; support $507 (20-day low) / $516 (50-day), resistance $555.8 (20-day high). Capital rotates to quality software/cloud with visible earnings when semis are being de-grossed, and Ignite is a mild sentiment tailwind. Risk: it lagged the Friday chip rebound (−1.0%), high-multiple megacaps are the most exposed to a ~77%-priced Dec hike and a hot CPI, and AI/data-center restriction fears hit the group. Invalid on a close below $507. Conviction 4/5.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $480P / buy $470P · Dec 18 '26 · credit $1.33 (mids 6.25 − 4.925 = 1.325) · capital ~$868 · max profit ~$133 · BE $478.68 · R:R 1:0.15 · POP ~82% (1−|Δ short 0.18|) · exit: buy back at ~50% profit (≈$0.66) or if MSFT closes below $480 / by Dec 11 (~7 DTE) — short strike at ~1σ ($478.8), below the $507–516 support shelf; bullish income tier" },
      { profile: "Moderate", strategy: "Bull Call Debit Spread", text: "Buy $530C / sell $560C · Dec 18 '26 · debit $12.88 (mids 22.45 − 9.575 = 12.875) · capital ~$1,288 · max profit ~$1,712 · BE $542.88 · R:R 1:1.33 · POP ~43% (lognormal, IV 29.6%) · exit +75–100% (~$22–26 spread value) or stop −50% (~$6.40) / MSFT close below $507; close with ≥10 days left (by Dec 8) — near-the-money long leg (Δ +0.54), short leg at the ~+6% technical area just above the $555.8 20-day high" },
      { profile: "Aggressive", strategy: "Bull Call Debit Spread (OTM)", text: "Buy $550C / sell $580C · Dec 18 '26 · debit $8.53 (mids 13.15 − 4.625 = 8.525) · capital ~$852 · max profit ~$2,148 · BE $558.52 · R:R 1:2.52 · POP ~31% (lognormal, IV 28.5%) · exit +100% (~$17 spread value) or stop −50% (~$4.26) / MSFT close below $507; close with ≥10 days left — needs a break above the $555.8 20-day high; OTM spread preferred to a naked long call to cap cost under the $1,500 limit" },
    ] },
  { ticker: "WMT", name: "Walmart", rank: 4, spot: "$125.52 (Fri Nov 6 close, −1.7%; no Mon pre-market yet (~01:50 ET); last extended-hours print $125.26) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "FQ3 earnings Thu Nov 19 (days.to/TipRanks: BMO, 8am ET call; financecalendar.com says ~4:05pm ET and unconfirmed — treat as EST., not verified on WMT IR) · cons. EPS $0.64 (Nasdaq); company Q3 guide $0.62–0.64 (MarketBeat) · Oct retail sales Tue Nov 17 · CPI Nov 10 · HD Nov 17, TGT Nov 18 as read-throughs · Dec 18 / Jan 15 expiries are after earnings and the Dec 9 FOMC",
    iv: "IV ~33.4% (Dec 18, ATM 125 = 33.4%; Cboe iv30 35.4; Jan 15 ATM ~30.6%) · IVR n/a · options imply ≈ ±7.2% on the print (Nov 20 125 straddle $9.00 vs $125.52) vs hist. avg move n/a · 1σ to Dec 18 ≈ ±$14.1 (±11.3%) → $111.4 / $139.7",
    liq: "A — Fri Nov 6 full session ≈89.7k option contracts (20d avg n/a) & 24.8M shares (20d avg 22.5M); OI Dec 18: 10.9k on the 125P, 10.1k on the 115P, 4.6k on the 120P; Jan 15: 7.4k on the 125P, 16.3k on the 110P; spreads 3–9.5% of mid ($0.10–0.13 wide) [Cboe delayed chain 11/6 close / Yahoo]",
    thesis: "A defensive crowd into a high bar: WMT +13.5% in 21 days (5d +1.6%), $125.52 vs 50-day $112.48 / 200-day $118.71, RSI 63.6, 20-day high $129.17; staples XLP +8% in 21d and sold −1.3% Fri as the Dec hike became ~77% priced. The market already pays for a beat-and-raise; a merely in-line quarter or cautious holiday guide into a strong-jobs/higher-rate backdrop sets up a pullback toward $118.7 (200-day) / $112.5 (50-day). Debit spreads cut vega into the print. Risk: Walmart beats habitually, defensive bid in a risk-off tape, and a hot retail-sales print Nov 17 would extend the run. Invalid on a close above $131. Conviction 3/5.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Put Debit Spread (longer-dated, wide)", text: "Buy $125P / sell $110P · Jan 15 '27 · debit $4.69 (mids 6.05 − 1.365 = 4.685) · capital ~$469 · max profit ~$1,032 · BE $120.31 · R:R 1:2.20 · POP ~35% (lognormal, IV 30.3%, 67 DTE) · exit +75–100% (~$8–9 spread value) or stop −50% (~$2.34) / WMT close above $131; close with ≥10 days left (by Jan 5) — extra time beyond the Nov 19 print and the Dec 9 FOMC; wide spread keeps the 110P short leg at the 50-day area. (Credit-spread version rejected: the $145C hedge leg is 15.6% wide, failing the liquidity gate.)" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $125P / sell $115P · Dec 18 '26 · debit $3.50 (mids 5.25 − 1.755 = 3.495) · capital ~$350 · max profit ~$650 · BE $121.50 · R:R 1:1.86 · POP ~36% (lognormal, IV 33.4%) · exit +75–100% (~$6–7 spread value) or stop −50% (~$1.75) / WMT close above $131; close with ≥10 days left (by Dec 8) — held through the Nov 19 BMO print (IV crush reduces the long leg's value; the short leg offsets); near-the-money long leg (Δ −0.46)" },
      { profile: "Aggressive", strategy: "Bear Put Debit Spread (OTM)", text: "Buy $120P / sell $115P · Dec 18 '26 · debit $1.42 (mids 3.175 − 1.755 = 1.42) · capital ~$142 · max profit ~$358 · BE $118.58 · R:R 1:2.52 · POP ~29% (lognormal, IV 34%) · exit +100% (~$2.84 spread value) or stop −50% (~$0.71) / WMT close above $131; close with ≥10 days left — tight OTM spread targets the 200-day ($118.7); chosen over a naked long put because IV is ~33% into a binary" },
    ] },
  { ticker: "BAC", name: "Bank of America", rank: 5, spot: "$49.42 (Fri Nov 6 close, −0.7%; no Mon pre-market yet (~01:50 ET); last extended-hours print $49.54) [Yahoo Finance chart / Cboe delayed quote]", sentiment: "Bearish",
    catalyst: "No company catalyst before expiry (next earnings ~mid-Jan, EST.) · macro: CPI Nov 10, PPI Nov 13, FOMC minutes ~Nov 18 (EST.), Dec 8–9 FOMC · ex-dividend date before Dec 18 n/a (long-only/short-OTM structures; no short leg in the money) · relative-weakness / breakdown setup, not an event trade",
    iv: "IV ~26% (Dec 18, ATM 50 = 25.7%; Cboe iv30 26.5) · IVR n/a · no binary before expiry · 1σ to Dec 18 ≈ ±$4.25 (±8.6%) → $45.2 / $53.7",
    liq: "A — Fri Nov 6 full session ≈105.9k option contracts (20d avg n/a) & 36.2M shares (20d avg 44.3M); OI 17.6k / 33.4k on the 52.5C / 55C, 14.3k / 4.1k on the 50P / 47P; spreads 5–9% of mid ($0.02–0.08 wide) [Cboe delayed chain 11/6 close / Yahoo]",
    thesis: "Idiosyncratic weakness in a strong sector: BAC closed at its 20-day low ($49.42), −7.8% in 21 days and below both its 50-day ($55.24) and 200-day ($54.89), RSI 34.5, while XLF is +5.4% and KRE +3.8% over the same 21 days. October earnings were hit by a reported $1.2B AML penalty (247WallSt snippet, not fully retrieved). Support $49.0 / $48; lower highs through $52.5 and $55. Risk: higher rates are an NII tailwind for banks, XLF strength can pull it up, and it is already near oversold (RSI 34). Invalid on a close above $52.5. Conviction 3/5. Premiums are small — the structures below were limited to strikes that pass the 10% bid-ask gate.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $52.5C / buy $55C · Dec 18 '26 · credit $0.41 (mids 0.60 − 0.195 = 0.405) · capital ~$210 · max profit ~$40 · BE $52.91 · R:R 1:0.19 · POP ~75% (1−|Δ short 0.25|) · exit: buy back at ~50% profit (≈$0.20) or if BAC closes above $52.5 / by Dec 11 (~7 DTE) — short strike is ~0.75σ (1σ = $53.7); the 1σ strike ($55C/$57.5C) pays only ~$0.12 and the $57.5C leg is too wide to trade, so the nearer strike is used" },
      { profile: "Moderate", strategy: "Bear Put Debit Spread", text: "Buy $50P / sell $47P · Dec 18 '26 · debit $1.18 (mids 2.08 − 0.90) · capital ~$118 · max profit ~$182 · BE $48.82 · R:R 1:1.54 · POP ~43% (lognormal, IV 26%) · exit +75–100% (~$2.1–2.4 spread value) or stop −50% (~$0.59) / BAC close above $52.5; close with ≥10 days left (by Dec 8) — near-the-money long leg (Δ −0.55); $47P is the lowest strike that passes the 10% bid-ask gate (the $45P is 10.5% wide)" },
      { profile: "Aggressive", strategy: "Long Put (OTM)", text: "Buy $47P · Dec 18 '26 · debit $0.90 (bid/ask 0.86/0.94) · capital ~$90 · max profit uncapped (target +100% ≈ $90 → put ≈ $1.80 at BAC ~$46.5, ESTIMATE; R:R ~1:2 to target) · BE $46.10 · POP ~21% (lognormal, IV 28.2%) · exit +100% or stop −50% (~$0.45) / BAC close above $52.5; close with ≥10 days left (by Dec 8) — IV is low-moderate (~26%); Δ −0.29, 40 DTE; a breakdown through $48 support is needed" },
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
// today line sits on the boundary between Nov 8 and Nov 9
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Sunday, Nov 8 2026 · Week-ahead edition (quotes = Fri Nov 6 close)</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Nov 8)
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
