import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Tuesday, October 27, 2026 (live-researched; option quotes from the Cboe delayed chain ~20 min after the Oct 27 open).
 * Window: last 3 days (Oct 24) → coming 2 weeks (Nov 10).
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

// 18-day axis: Oct 24 .. Nov 10 (last 3 days → coming 2 weeks). Today = index 3 (Oct 27).
const DAYS = [
  { idx: 0, date: "Oct 24", dow: "Sat" },
  { idx: 1, date: "Oct 25", dow: "Sun" },
  { idx: 2, date: "Oct 26", dow: "Mon" },
  { idx: 3, date: "Oct 27", dow: "Tue" }, // TODAY
  { idx: 4, date: "Oct 28", dow: "Wed" },
  { idx: 5, date: "Oct 29", dow: "Thu" },
  { idx: 6, date: "Oct 30", dow: "Fri" },
  { idx: 7, date: "Oct 31", dow: "Sat" },
  { idx: 8, date: "Nov 1", dow: "Sun" },
  { idx: 9, date: "Nov 2", dow: "Mon" },
  { idx: 10, date: "Nov 3", dow: "Tue" },
  { idx: 11, date: "Nov 4", dow: "Wed" },
  { idx: 12, date: "Nov 5", dow: "Thu" },
  { idx: 13, date: "Nov 6", dow: "Fri" },
  { idx: 14, date: "Nov 7", dow: "Sat" },
  { idx: 15, date: "Nov 8", dow: "Sun" },
  { idx: 16, date: "Nov 9", dow: "Mon" },
  { idx: 17, date: "Nov 10", dow: "Tue" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS / COMMS -----------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "AI trade revives: Anthropic publicly files its IPO prospectus (H1-2026 revenue ~$16.3B) — 57 of 60 chip names rise, XLK +1.7%, Nasdaq +0.8% to 26,169; AMD +1.4%, NVDA/MRVL bid", tickers: "NVDA · AMD · AVGO · MRVL · SMH",
    rec: "HOLD core AI-semis exposure — the IPO filing validates AI demand, but the group is still volatile; add on dips, not on the gap." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Meta sets a ~$95–97.5B AI-infrastructure raise (incl. a $37.5B public offering) — META −0.7% to $630.56; Comm Services worst sector (−1.6%); Verizon −3.5% as its revenue miss outweighed the EPS beat", tickers: "META · VZ · XLC",
    rec: "AVOID chasing META — equity dilution caps upside near the $625 offer price for now; VZ: HOLD, don't add after the revenue miss." },
  { id: "t3", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Meta upsizes common stock to $25B at $625/sh; Nvidia invests $3B and widens its Muse-model partnership (AMD/AVGO also interested); Broadcom +3% on a DA Davidson Buy ($400 PT) + $63B financing tied to Anthropic chip purchases; Celestica +9–16% (rev +83%, 2027 target $40B)", tickers: "META · NVDA · AVGO · CLS",
    rec: "BUY-on-dips the AI hardware supply chain (AVGO/CLS) — orders are visible; META is a HOLD while the offering clears." },
  { id: "t4", ind: "tech", dayIdx: 3, future: false, impact: 1, dir: "MIXED",
    headline: "After Monday's close: Cadence beat & raised FY26; Rambus beat with an above-consensus guide; Amkor missed and guided Q4 below; Corning −4% premarket, Intel +3% (buying quantum-software firm Classiq)", tickers: "CDNS · RMBS · AMKR · GLW · INTC",
    rec: "Favour design/IP names (CDNS/RMBS) over OSAT packaging (AMKR) — the guide gap tells you where the AI dollars land." },
  { id: "t5", ind: "tech", dayIdx: 3, future: true, impact: 2, dir: "MIXED",
    headline: "Tonight after close: Seagate, NXP, Teradyne, Enphase, F5, Logitech — AI storage, auto/industrial chips and test-equipment demand", tickers: "STX · NXPI · TER · ENPH",
    rec: "WATCH — STX sizes AI storage demand; NXPI is the cyclical-chip tell. Trade the guide, not the beat." },
  { id: "t6", ind: "tech", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "Microsoft FQ1 + Alphabet Q3 after close (hours after the Fed) — capex vs. Azure/Cloud growth; also KLA, ServiceNow, Fortinet, T-Mobile", tickers: "MSFT · GOOGL · KLAC · NOW",
    rec: "WATCH — Azure ≥45% / Cloud acceleration with steady capex re-rates the group; a capex jump without revenue gets punished. Defined-risk only." },
  { id: "t7", ind: "tech", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Amazon Q3 after close — AWS re-acceleration vs. capex; Intel (near a 3-month low, ~$85 support), Sandisk, Coinbase also after close", tickers: "AMZN · INTC · SNDK · COIN",
    rec: "WATCH — AMZN ~20% off highs gives a clean AWS print room to run; size for a ±6–7% binary." },
  { id: "t8", ind: "tech", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "Apple FQ4 after close — first call under CEO John Ternus; Palantir also expected after close (date not confirmed by all calendars)", tickers: "AAPL · PLTR",
    rec: "WATCH — AAPL lagged Monday's AI bounce (−0.4%); a clean iPhone/Services guide is the catalyst to rejoin leadership." },
  { id: "t9", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "AMD Q3 after close — MI-series data-center GPU ramp; stock ~$531–539 after Monday's chip rebound, IV30 ~60%", tickers: "AMD · NVDA",
    rec: "WATCH — expect a ±10% move; a Meta-offering stake plus strong DC-GPU guide would extend the bounce. Size small." },
  { id: "t10", ind: "tech", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "Cohu Investor Day (NYC, 9:00 ET) with an AMD keynote; FactSet Investor Day the same morning", tickers: "COHU · AMD · FDS",
    rec: "LOW impact — useful colour on AI-chip test demand; not a reason to trade AMD on its own." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Houthis claim attacks on a Saudi airport and oil facilities, a day after Brent's $116.72 settle (highest since April); reports of US/Israeli strike plans after the Nov 3 midterms", tickers: "USO · XOM · CVX · COP",
    rec: "Keep energy as the portfolio hedge — supply risk is now two-sided (Hormuz + Saudi infrastructure); don't chase spikes." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 1, dir: "BULLISH",
    headline: "Saudi Arabia intercepts more missiles & drones; Kpler says Iran's floating storage is depleted as the US blockade passes 100 days", tickers: "USO · FRO · XOM",
    rec: "Tanker rates stay firm — HOLD tanker/major exposure, trail stops." },
  { id: "e3", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "EQT to buy Range Resources all-stock (0.987 EQT/sh, pro forma EV >$50B); crude eases on Saudi/Turkish/Pakistani/Iranian talks in Tehran — XOM −0.5% to $184.54 after a $184.59 high", tickers: "EQT · RRC · AR · XOM",
    rec: "Don't chase RRC (deal spread is the trade); oil's dip is diplomacy hope, not de-escalation — HOLD majors." },
  { id: "e4", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Oil choppy: Brent holds near six-month highs (~$110–116 depending on contract), WTI ~$101; Baker Hughes, ONEOK, NOV & EQT/RRC report after close; API inventories 4:30 ET", tickers: "USO · BKR · OKE · NOV",
    rec: "BKR's LNG/gas-tech orders are the cleaner read than crude-levered drillers — HOLD, trade the guide." },
  { id: "e5", ind: "energy", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "EIA weekly petroleum status report; Phillips 66 (PSX) Q3 before open", tickers: "USO · PSX",
    rec: "Refiner margins are the swing — a big crude draw adds to the squeeze." },
  { id: "e6", ind: "energy", dayIdx: 6, future: true, impact: 3, dir: "BULLISH",
    headline: "ExxonMobil (EPS est ~$3.96) & Chevron (~$4.78) Q3 before open — first prints with $100+ crude", tickers: "XOM · CVX · SHEL",
    rec: "Lean bullish — record sector and buybacks; XOM ~$183 is still below Friday's high. Buy dips, not gaps." },
  { id: "e7", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "OPEC+ (the 'seven') meets Nov 1 — base case a Q4 pause; Gulf members pumping below quota on Hormuz disruption", tickers: "XOM · CVX · USO",
    rec: "Low odds of a surprise hike — the Iran war, not OPEC+, sets the price; keep energy as insurance." },
  { id: "e8", ind: "energy", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Post-midterm Iran strike window + EIA weekly report — reported US/Israeli strike plans 'once the midterms occur' keep a war premium in crude", tickers: "USO · XOM · CVX",
    rec: "Size energy so a de-escalation gap-down is tolerable; this is where the premium is tested." },
  { id: "e9", ind: "energy", dayIdx: 16, future: true, impact: 2, dir: "BULLISH",
    headline: "Constellation Energy Q3 call (9:00 ET) — nuclear power for AI data centers", tickers: "CEG · VST",
    rec: "WATCH — power demand is the cleanest AI-capex beneficiary; add CEG on weakness if data-center contract commentary holds up." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "ESMO weekend: Xencor's XmAb819 shows a 45.5% confirmed ORR in advanced clear-cell RCC (Phase 1) — XNCR +27–32% Monday", tickers: "XNCR",
    rec: "Don't chase a +30% gap on Phase 1 data — WATCH for a pullback." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Moderna slides after Phase 3 results for intismeran autogene (with Merck), then William Blair cuts to Market Perform on valuation (still ~+545% YTD); SGRY +20–25% on a ~$6B Bon Secours takeover report", tickers: "MRNA · MRK · SGRY",
    rec: "AVOID MRNA knife-catching; SGRY deal isn't signed — don't pay up for the headline." },
  { id: "h3", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Centene smashes Q3 (adj. EPS $0.58 vs $0.10 est, revenue $50.65B vs $46.95B) and raises FY26; Novartis Q3 shows Entresto −38% on generics vs Leqvio +64%; HCA & IQVIA also before open", tickers: "CNC · NVS · HCA · IQV",
    rec: "CNC: BUY-on-dips — managed-care cost trends are stabilising; NVS: HOLD through the Entresto cliff." },
  { id: "h4", ind: "health", dayIdx: 3, future: true, impact: 1, dir: "MIXED",
    headline: "Universal Health Services & ICON report after close — hospital volumes and CRO bookings", tickers: "UHS · ICLR",
    rec: "UHS confirms (or not) HCA's utilisation read; ICLR is the biotech-funding barometer." },
  { id: "h5", ind: "health", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Eli Lilly Q3 (company-confirmed, call 10:00 ET) + Merck & Bristol Myers before open; Gilead & Stryker after close", tickers: "LLY · MRK · BMY · GILD",
    rec: "WATCH — LLY GLP-1 volumes lead the sector; MRK must address the cancer-vaccine data. Trade the guide." },
  { id: "h6", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "AbbVie, Regeneron, AstraZeneca & Sanofi Q3 before open; Inovio INO-3107 (RRP) PDUFA", tickers: "ABBV · REGN · AZN · INO",
    rec: "ABBV/REGN guides matter more than beats; INO is a lottery-ticket binary." },
  { id: "h7", ind: "health", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "Agios mitapivat sickle-cell sNDA PDUFA (Sunday — action likely around Nov 2)", tickers: "AGIO",
    rec: "Binary for AGIO; avoid holding size through a weekend goal date." },
  { id: "h8", ind: "health", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Pfizer, CVS, Amgen & Vertex Q3 window (dates per aggregator calendars — confirm with IR)", tickers: "PFE · CVS · AMGN · VRTX",
    rec: "CVS follows Centene's beat — managed care momentum; AMGN obesity (MariTide) commentary is the swing." },

  // ---- FINANCIALS / MACRO -------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "S&P +0.7% to 7,676.77, Dow +0.3% to 52,361.58, Nasdaq +0.8%; VIX −5.5% to 18.39; 9 of 11 sectors up — Brazil ADRs crater on Lula's re-election (XP ~−46%, STNE ~−34%)", tickers: "SPY · QQQ · VIX · EWZ · XP",
    rec: "Relief bid into the Fed — keep powder dry; AVOID catching Brazil while fiscal policy reprices." },
  { id: "f2", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "SoFi +10–11% on a beat and upbeat long-term outlook; PayPal ~−1% (revenue miss, profit guide raised); HSBC −6% on a miss; Ares Capital buys MidCap Financial ($2.6B EV, MFIC +23%); 10-yr ~4.99%, gold <$4,000, bitcoin <$80k", tickers: "SOFI · PYPL · HSBC · ARCC · MFIC",
    rec: "SOFI: HOLD, don't chase a double-digit gap; PYPL remains a show-me story — WATCH." },
  { id: "f3", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Fed two-day meeting begins; Sept durable goods (est +1.7%), Oct consumer confidence (est ~80.5–81), Case-Shiller; Visa & Robinhood after close", tickers: "SPY · TLT · V · HOOD",
    rec: "Visa's cross-border volume is the consumer health check; confidence < 80 would feed slowdown fears." },
  { id: "f4", ind: "finance", dayIdx: 4, future: true, impact: 3, dir: "MIXED",
    headline: "FOMC decision 2pm ET + Warsh presser — hold at 3.75–4.00% expected (~10% hike odds per CME); 'hawkish pause' the base case. ECB & BoJ decide Thu", tickers: "SPY · JPM · BAC · TLT",
    rec: "Keep dry powder — a December-hike signal hits long-duration tech; banks like higher-for-longer." },
  { id: "f5", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "Q3 GDP (advance, ~+3% est) + September PCE, 8:30 ET — core PCE ~+0.3% m/m; Mastercard & Caterpillar before open", tickers: "SPY · TLT · MA · CAT",
    rec: "Biggest data cluster of the window — a hot core PCE cements December-hike talk; trade after the print." },
  { id: "f6", ind: "finance", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Q3 Employment Cost Index, 8:30 ET — wage-inflation check the Fed watches", tickers: "SPY · TLT",
    rec: "A hot ECI adds to December-hike odds; low-impact unless it surprises." },
  { id: "f7", ind: "finance", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing PMI (October), 10:00 ET", tickers: "SPY · CAT · XLI",
    rec: "Growth check — above 50 supports cyclicals; a slump revives slowdown fears." },
  { id: "f8", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "US midterm elections — control of Congress; JOLTS (Sept) 10:00 ET same day", tickers: "SPY · IWM · XLF · XLE",
    rec: "Expect elevated vol into the vote; equities historically rally once midterms resolve — avoid big directional bets the day before." },
  { id: "f9", ind: "finance", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "ADP employment + ISM Services; weekly jobless claims follow Thu", tickers: "SPY · TLT",
    rec: "Previews for Friday's payrolls — services strength argues for a December hike." },
  { id: "f10", ind: "finance", dayIdx: 13, future: true, impact: 3, dir: "MIXED",
    headline: "October jobs report (NFP), 8:30 ET (BLS-confirmed)", tickers: "SPY · JPM · TLT",
    rec: "A hot number firms December-hike odds — keep size light into it." },
  { id: "f11", ind: "finance", dayIdx: 17, future: true, impact: 3, dir: "MIXED",
    headline: "October CPI, 8:30 ET (BLS-confirmed) — first inflation print after the FOMC, a month before the Dec 9 decision", tickers: "SPY · QQQ · TLT",
    rec: "Highest-impact print left in the window — with oil >$100, a hot headline CPI is the risk; reduce leverage into it." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Tesla +5% on a Barclays upgrade to Overweight; XLY +1%; Instacart jumps on a report DoorDash may buy it for ~$17B; Whirlpool misses badly and cuts FY sales guide by $500M after close", tickers: "TSLA · CART · DASH · WHR",
    rec: "TSLA: HOLD — an upgrade isn't a catalyst; AVOID WHR — housing-linked durables are still deteriorating." },
  { id: "c2", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Coca-Cola beats (adj. EPS $0.91 vs $0.88, rev $13.4B vs $12.9B, unit cases +5%) and raises, but slips ~−0.5% on slower North America; UPS beats & raises FY26; Royal Caribbean beats but guides Q4 below; JetBlue misses", tickers: "KO · UPS · RCL · JBLU",
    rec: "KO: HOLD — priced for perfection; UPS: BUY-on-dips after the raise; AVOID JBLU while jet fuel stays elevated." },
  { id: "c3", ind: "consumer", dayIdx: 3, future: true, impact: 1, dir: "MIXED",
    headline: "Boeing & Hilton before open (results digesting); Cheesecake Factory & Caesars after close", tickers: "BA · HLT · CAKE · CZR",
    rec: "HLT RevPAR at $100+ oil is the travel read; BA is about delivery cadence, not EPS." },
  { id: "c4", ind: "consumer", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Ford, eBay, Carvana & O'Reilly after close (Ford/eBay dates expected)", tickers: "F · EBAY · CVNA · ORLY",
    rec: "Ford's tariff/EV commentary (US–Canada steel & auto tariff talks) is the auto read-through; CVNA is a high-beta binary." },
  { id: "c5", ind: "consumer", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Starbucks & Mondelez after close; Altria before open", tickers: "SBUX · MDLZ · MO",
    rec: "SBUX turnaround comps are the swing — trade the traffic number, not EPS." },
  { id: "c6", ind: "consumer", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Uber Q3 before open (company-confirmed, call 8:00 ET); DoorDash/Airbnb/Booking also in the window per calendars", tickers: "UBER · DASH · ABNB · BKNG",
    rec: "DASH must address the Instacart report; trade the guide, not the print." },
  { id: "c7", ind: "consumer", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Holiday-season setup into the jobs report — $100+ oil squeezes gas-station budgets as promo calendars ramp", tickers: "AMZN · WMT · TGT",
    rec: "Favour share-gaining scale retailers (AMZN/WMT); a soft NFP hurts discretionary." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "AMZN", name: "Amazon", rank: 1, spot: "$251.14", sentiment: "Bullish",
    catalyst: "Q3 earnings — Thu Oct 29 (after close) · BINARY · AWS re-acceleration; day after FOMC, same morning as GDP/PCE",
    iv: "IV30 ~44% (Cboe) — elevated into the print; expect IV crush after",
    liq: "A — ~677k contracts & 32.7M shares on Oct 26; OI 6.0k / 19.2k on Dec 255/270C, 10.1k / 8.7k on Nov 235/225P, 43.4k on Nov 270C; legs 2.6–6.2% wide [Cboe delayed chain, Oct 27 ~9:53 ET]",
    thesis: "~20% below its highs after the AI-capex rout, bouncing with Monday's AI revival (+0.8% early Tue); AWS is the catalyst. Bullish but into a binary with rich IV → debit spread for upside, put credit spread to harvest the crush.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $255 / sell $270 · Dec 18 '26 · ~$5.83 net debit (mid 13.73 − 7.90) · cost/max loss ~$583 · max gain ~$917" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $235 / buy $225 · Nov 20 '26 · ~$2.42 credit (mid 5.62 − 3.20) · max loss/capital ~$758 · ~6.4% OTM, harvests IV crush" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$270 call · Nov 20 '26 · ~$5.35 debit (5.20/5.50) · cost ~$535 · AWS-beat pop" },
    ] },
  { ticker: "MSFT", name: "Microsoft", rank: 2, spot: "$532.90", sentiment: "Neutral-to-Bullish",
    catalyst: "FQ1 FY27 earnings — Wed Oct 28 (after close) · BINARY · same day as the FOMC decision",
    iv: "IV ~34–35% on Nov strikes (Cboe) — rich into the print (~±5% implied)",
    liq: "A — ~433k contracts & 19.0M shares on Oct 26; OI 11.4k / 6.5k on Nov 500/490P, 6.9k / 10.8k on Nov 530/550C, 8.3k on Nov 570C; legs 4.1–7.2% wide [Cboe delayed chain, Oct 27 ~9:53 ET]",
    thesis: "Recovered to ~$533 with the AI bounce but still capped below $550; capex is the swing after Meta's $95B raise reminded everyone what AI costs. Avoid naked long premium into the print — get paid below support, spread the upside.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $500 / buy $490 · Nov 20 '26 · ~$2.07 credit (mid 6.95 − 4.88) · max loss/capital ~$793 · ~6.2% OTM cushion" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $530 / sell $550 · Nov 20 '26 · ~$8.93 net debit (mid 20.98 − 12.05) · cost/max loss ~$893 · max gain ~$1,107" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$570 call · Nov 20 '26 · ~$6.15 debit (5.95/6.35) · cost ~$615 · needs a beat-and-raise through $550 (IV-crush risk)" },
    ] },
  { ticker: "GOOGL", name: "Alphabet", rank: 3, spot: "$318.74", sentiment: "Bullish",
    catalyst: "Q3 earnings — Wed Oct 28 (after close) · BINARY · Cloud growth + AI search monetisation, hours after the Fed",
    iv: "IV30 ~37% (Cboe); Nov strikes ~40% — elevated into the print",
    liq: "A — ~498k contracts & 24.0M shares on Oct 26; OI 10.3k / 16.5k on Nov 300/290P, 3.9k / 5.1k on Dec 320/340C, 4.2k / 11.0k on Nov 330/350C; legs 3.1–6.2% wide [Cboe delayed chain, Oct 27 ~9:53 ET]",
    thesis: "Cheapest of the AI mega-caps on earnings, with Cloud the second-biggest AI-capacity seller after Azure; the Anthropic IPO filing and AI-chip financing headlines put a spotlight on cloud demand. Into a binary → defined-risk debit spreads plus a put credit spread below $300.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $300 / buy $290 · Nov 20 '26 · ~$2.33 credit (mid 5.45 − 3.12) · max loss/capital ~$767 · ~5.9% OTM cushion" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $320 / sell $340 · Dec 18 '26 · ~$7.98 net debit (mid 16.93 − 8.95) · cost/max loss ~$798 · max gain ~$1,202" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $330 / sell $350 · Nov 20 '26 · ~$5.27 net debit (mid 8.77 − 3.50) · cost/max loss ~$527 · max gain ~$1,473 if GOOGL > $350" },
    ] },
  { ticker: "AAPL", name: "Apple", rank: 4, spot: "$344.10", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Mon Nov 2 (after close) · BINARY · Ternus's first call as CEO",
    iv: "IV30 ~27% (Cboe) — moderate (~±4–5% implied)",
    liq: "A — ~1.19M contracts & 42.7M shares on Oct 26; OI 7.4k / 26.1k on Dec 345/360C, 8.3k / 10.8k on Nov 325/315P, 23.2k on Nov 360C; legs 3.3–6.7% wide ($0.14 on the $2.09 leg) [Cboe delayed chain, Oct 27 ~9:53 ET]",
    thesis: "Lagged Monday's AI bounce (−0.4%) as money rotated into beaten-up chips — a calmer entry ahead of its own print with little AI-capex exposure. Tamer IV → debit spread for upside, credit spread below support.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $345 / sell $360 · Dec 18 '26 · ~$6.75 net debit (mid 13.72 − 6.97) · cost/max loss ~$675 · max gain ~$825" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $325 / buy $315 · Nov 20 '26 · ~$1.64 credit (mid 3.73 − 2.09) · max loss/capital ~$836 · ~5.5% OTM, range-tolerant" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$360 call · Nov 20 '26 · ~$3.85 debit (3.75/3.95) · cost ~$385 · post-earnings breakout" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 5, spot: "$183.95", sentiment: "Bullish",
    catalyst: "Q3 earnings — Fri Oct 30 (before open); Brent near six-month highs on Houthi attacks on Saudi assets; OPEC+ Nov 1; post-midterm Iran-strike window",
    iv: "IV30 ~29% (Cboe) — moderately elevated on the oil spike + earnings",
    liq: "A — ~55k contracts & 10.9M shares on Oct 26; OI 4.6k / 6.7k / 17.9k on Dec 175/180/190C; legs 7.3–9.7% wide [Cboe delayed chain, Oct 27 ~9:53 ET]. Rejected: Dec 185C (11% wide), Dec 195/200C (18% wide), all Nov calls (13–22% wide), all Nov/Dec puts (14–29% wide) — no liquid put-spread pair, so all tiers use Dec calls",
    thesis: "Stacked catalysts: a record energy sector, $100+ crude and a Q3 print, with the stock holding ~$184 even as crude eases on Tehran diplomacy. A ceasefire headline is the key risk, so every tier is defined-risk and sized small.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $180 / sell $190 · Dec 18 '26 · ~$4.69 net debit (mid 10.22 − 5.53) · cost/max loss ~$469 · max gain ~$531 (in-the-money long leg)" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $175 / sell $190 · Dec 18 '26 · ~$7.87 net debit (mid 13.40 − 5.53) · cost/max loss ~$787 · max gain ~$713 (deeper ITM, higher hit-rate)" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$190 call · Dec 18 '26 · ~$5.53 debit (5.30/5.75) · cost ~$553 · oil-spike breakout" },
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
// today line sits on the boundary between Oct 27 and Oct 28
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Tuesday, Oct 27 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Oct 27)
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
