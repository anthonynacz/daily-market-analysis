import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Wednesday, November 4, 2026 (post-midterms, pre-market ~8:15 ET; option quotes & OI = Cboe delayed chain at the Tue Nov 3 close).
 * Window: last 3 days (Nov 1) → coming 2 weeks (Nov 18).
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

// 18-day axis: Nov 1 .. Nov 18 (last 3 days → coming 2 weeks). Today = index 3 (Nov 4).
const DAYS = [
  { idx: 0, date: "Nov 1", dow: "Sun" },
  { idx: 1, date: "Nov 2", dow: "Mon" },
  { idx: 2, date: "Nov 3", dow: "Tue" },
  { idx: 3, date: "Nov 4", dow: "Wed" }, // TODAY
  { idx: 4, date: "Nov 5", dow: "Thu" },
  { idx: 5, date: "Nov 6", dow: "Fri" },
  { idx: 6, date: "Nov 7", dow: "Sat" },
  { idx: 7, date: "Nov 8", dow: "Sun" },
  { idx: 8, date: "Nov 9", dow: "Mon" },
  { idx: 9, date: "Nov 10", dow: "Tue" },
  { idx: 10, date: "Nov 11", dow: "Wed" },
  { idx: 11, date: "Nov 12", dow: "Thu" },
  { idx: 12, date: "Nov 13", dow: "Fri" },
  { idx: 13, date: "Nov 14", dow: "Sat" },
  { idx: 14, date: "Nov 15", dow: "Sun" },
  { idx: 15, date: "Nov 16", dow: "Mon" },
  { idx: 16, date: "Nov 17", dow: "Tue" },
  { idx: 17, date: "Nov 18", dow: "Wed" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 9-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS / COMMS -----------------------------------------
  { id: "t1", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Chips lead an Election-Day rebound: Nasdaq +0.83% to 25,372.01, S&P 500 +0.36% to 7,568.92 (snaps a 3-day skid); Nasdaq-100 +0.7% to 28,180.26 but still ~10% off its high; AMD +3.7% to $483.90 into its print, NVDA +2.3% to $206.69", tickers: "QQQ · SMH · AMD · NVDA · MU",
    rec: "Relief rally inside a correction — HOLD core AI semis; add only on pullbacks and through defined-risk structures." },
  { id: "t2", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "AMD Q3 beat-and-raise: revenue $13.38B (est. $13.09B), adj. EPS $2.09 (est. $1.95); Q4 guide ~$17B ±3% vs $16.23B consensus; data-center revenue +27% q/q on the first MI450 shipments; gross-margin guide slips to 55% — stock ~+6% pre-market (~$513)", tickers: "AMD · NVDA · AVGO",
    rec: "The MI450 ramp is real — BUY dips toward $480 (Tuesday's pre-print close) rather than chasing the gap; IV is collapsing, so call spreads are cheap relative to yesterday." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "AI-hardware after-hours winners: Arista +~11% (~$188.5) on a Q4 EPS guide of $1.26–1.30 vs $1.15; Super Micro +~9% (~$34.1) on a FY27 sales outlook of $72–82B vs $69.2B", tickers: "ANET · SMCI · CRDO",
    rec: "Networking demand is the cleanest AI-capex read — HOLD ANET; SMCI remains a trade (margin and governance history), not a core holding." },
  { id: "t4", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "MIXED",
    headline: "Election-night AI wobble: Democratic wins in data-center hubs (Texas governor race) stoke moratorium fears — Nasdaq-100 futures hit 27,615.75 overnight, then rebound ~930 pts; Asia chips slide (SoftBank −8%, Tokyo Electron −7%, Disco −10%); CoreWeave −3.6%, Oracle & Nebius lower", tickers: "CRWV · ORCL · NBIS · NVDA · VRT",
    rec: "Policy headline risk now sits on data-center builders — favour chip/networking suppliers with global demand over levered US neoclouds (CRWV/NBIS): AVOID the neoclouds for now." },
  { id: "t5", ind: "tech", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Musk complex hit: Tesla −4% pre-market (~$382.5 vs $398.50) and SpaceX −4–6% after Musk-backed Republican candidates lose; Palantir −2.6% (~$170.9) extends its post-earnings slide", tickers: "TSLA · PLTR",
    rec: "Political-risk discount on Musk names — don't buy the first dip in TSLA; express bearish views only with defined-risk put spreads." },
  { id: "t6", ind: "tech", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "TONIGHT: Qualcomm FQ4 (EPS est. ~$2.16, rev ~$10.1B; ~±9.5% implied), Arm FQ2 (EPS ~$0.42, rev ~$1.38B) and AppLovin Q3 (EPS ~$4.04; ~±17% implied) after the close", tickers: "QCOM · ARM · APP",
    rec: "WATCH — QCOM/ARM guides are the read on handsets & AI PCs after Intel's cut; APP's ±17% implied move makes it a lottery ticket, not an investment." },
  { id: "t7", ind: "tech", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Cloudflare, Atlassian & Microchip after close — software punished on AI-disruption fears; first read on the chip-inventory cycle outside AI", tickers: "NET · TEAM · MCHP",
    rec: "WATCH TEAM's seat trends; MCHP's guide tells whether the analog/MCU recovery survives the PC slump." },
  { id: "t8", ind: "tech", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "KubeCon NA (Nov 8–11) under way; Take-Two Interactive FQ2 (date est.) — GTA VI launch-cadence commentary", tickers: "TTWO · EA",
    rec: "LOW impact for the market; TTWO trades on launch timing, not the quarter — WATCH." },
  { id: "t9", ind: "tech", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "Cohu Investor Day (NYC) with an AMD keynote; FactSet Investor Day; Adobe MAX (Nov 10–12) begins", tickers: "COHU · AMD · FDS · ADBE",
    rec: "LOW impact — colour on AI-chip test demand and Adobe's AI monetisation; not a standalone trade." },
  { id: "t10", ind: "tech", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Cisco FQ1 FY27 after close (date est. Nov 10–12 — not yet confirmed by Cisco; guided rev $18.0–18.2B, EPS $1.32–1.34) — AI networking orders vs. campus refresh", tickers: "CSCO · ANET",
    rec: "WATCH — a beat on AI-networking orders supports ANET's guide; trade the guide, not the print." },
  { id: "t11", ind: "tech", dayIdx: 11, future: true, impact: 2, dir: "MIXED",
    headline: "Applied Materials FQ4 after close (Nov 12) — wafer-fab demand after Asia's chip rout vs. the memory-capex upcycle", tickers: "AMAT · LRCX · KLAC · MU",
    rec: "WATCH — memory capex is the bull case, China mix the risk; don't pre-position." },
  { id: "t12", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "BULLISH",
    headline: "Anthropic IPO: targeted for the week of Nov 16, with pricing reported for Nov 19–20 (S-1 filed Oct 26, price range still blank; no official date) — read-across for AMZN & GOOGL stakes and AI-infrastructure sentiment", tickers: "AMZN · GOOGL · NVDA",
    rec: "WATCH the price-range filing — a strong book re-rates the AI complex; AMZN (largest strategic holder) is the cleanest listed proxy." },
  { id: "t13", ind: "tech", dayIdx: 16, future: true, impact: 3, dir: "MIXED",
    headline: "Nvidia Q3 FY27 earnings Tue Nov 17 (confirmed; call 5:00 ET, CFO commentary ~4:20 ET) + Microsoft Ignite (Nov 17–20) — the AI-sentiment test inside the Nov 20 option expiry", tickers: "NVDA · MSFT · AMD · AVGO",
    rec: "WATCH — positioning into NVDA's print usually firms the chip complex; keep exposure defined-risk rather than chasing." },

  // ---- ENERGY / POWER -----------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "OPEC+ 'seven' keep December production at September levels — third straight pause; next meeting Nov 29; 2027 capacity review delayed by the Iran war", tickers: "XOM · CVX · USO",
    rec: "As expected — no supply surprise; Iran diplomacy, not OPEC+, sets the price. HOLD." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 3, dir: "BEARISH",
    headline: "Crude collapses on US-Iran peace-talk hopes: Brent −7.6% to $104.77, WTI −7.4% to $96.46; XOM −4.0% to $179.67 off Friday's record", tickers: "USO · XOM · CVX · OXY",
    rec: "Peace-premium unwind — TRIM levered oil (OXY/FRO); HOLD majors for buybacks but don't add until crude stabilises." },
  { id: "e3", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Brent whipsaws: +0.6% intraday to ~$105.4 after a US strike on Iran's Qeshm Island, then settles ~$103.60 — lowest close since Oct 7 (≈8% weekly drop); physical market still tight (5.3M-bbl US crude draw reported)", tickers: "USO · XLE · VLO · MPC",
    rec: "Paper vs physical divergence — don't short crude here; refiners (VLO/MPC) are the steadier way to own the diesel squeeze." },
  { id: "e4", ind: "energy", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Clean energy rips on the Democratic sweep: Plug +10.6%, Sunrun +8.6%, First Solar +8% (~$201), FuelCell +6.2%, Bloom +5.8%, TAN +~5% pre-market; Orsted +7.3% in Europe; WTI −1% (~$96), XOM −1.6% (~$174.6)", tickers: "FSLR · RUN · PLUG · BE · TAN · XOM",
    rec: "Policy-relief pop — HOLD FSLR (US-made, profitable) and fade the unprofitable small caps (PLUG/RUN) into strength; gridlock limits new subsidies." },
  { id: "e5", ind: "energy", dayIdx: 3, future: true, impact: 3, dir: "MIXED",
    headline: "Post-midterm Iran decision window (renewed strikes vs. a Hormuz reopening deal) + EIA weekly petroleum status 10:30 ET", tickers: "USO · XOM · CVX · FRO",
    rec: "The binary for crude — size energy so another 5–10% de-escalation gap is tolerable." },
  { id: "e6", ind: "energy", dayIdx: 4, future: true, impact: 2, dir: "BULLISH",
    headline: "ConocoPhillips, Targa, Duke & Southern Q3; EOG after close (expected); Devon & Vistra follow Fri", tickers: "COP · TRGP · EOG · DVN · VST",
    rec: "WATCH — COP/EOG buyback guides at ~$96 WTI; VST is the AI-power read-through after the data-center policy scare." },
  { id: "e7", ind: "energy", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Constellation Energy & NRG Q3 (date est.), Occidental after close — nuclear/gas power for AI data centres and oil cash flows", tickers: "CEG · NRG · OXY · VST",
    rec: "WATCH — CEG's data-center contract commentary matters more now that state-level moratoriums are in play." },
  { id: "e8", ind: "energy", dayIdx: 11, future: true, impact: 1, dir: "MIXED",
    headline: "EIA weekly petroleum status (shifted by Veterans Day) + OPEC Monthly Oil Market Report (approx.)", tickers: "USO · XLE",
    rec: "LOW impact unless inventories surprise — HOLD energy hedges." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Healthcare & staples the lone gainers as tech sells; Vertex Q3 after close — mixed quarter, light guidance hike (closed $553.15)", tickers: "XLV · IBB · VRTX",
    rec: "Rotation haven keeps working — HOLD XLV/VRTX; add defensives on red tech days." },
  { id: "h2", ind: "health", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Pfizer Q3 beat (adj. EPS $0.87 vs $0.73, rev $16.58B vs $15.87B) — shares ~flat; Revvity +7% on a guide raise", tickers: "PFE · RVTY",
    rec: "PFE remains a yield/HOLD; RVTY shows tools demand stabilising." },
  { id: "h3", ind: "health", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "Managed care & hospitals rally on the Democratic sweep (ACA/Medicaid policy relief): Molina +6.4% (~$221), Centene +~5%, HCA up, UnitedHealth +1–2% in early indications", tickers: "MOH · CNC · HCA · UNH",
    rec: "Policy-relief rally favours Medicaid/ACA-heavy names (MOH/CNC) — HOLD; don't chase the gap since MA cost trends, not politics, drive 2027 EPS." },
  { id: "h4", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Novo Nordisk Q3: Wegovy pill sales blow past estimates; 2026 guide raised to −2%..+2% CER (from −6%..0) — ADR +~4% (~$41.7); CVS to split off its retail-pharmacy business (1H28), shares ~−1%", tickers: "NVO · LLY · CVS",
    rec: "Oral GLP-1 is working — NVO is a HOLD/accumulate on value, but US price cuts and Lilly competition cap upside; CVS split is a slow-burn value unlock (HOLD)." },
  { id: "h5", ind: "health", dayIdx: 3, future: true, impact: 1, dir: "MIXED",
    headline: "McKesson & Edwards Lifesciences after close — drug-distribution volumes and TAVR demand", tickers: "MCK · EW",
    rec: "LOW impact — MCK is a steady compounder; HOLD." },
  { id: "h6", ind: "health", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "Cigna, Becton Dickinson & Cardinal Health before open; Natera after close", tickers: "CI · BDX · CAH · NTRA",
    rec: "LOW impact — CI's pharmacy-benefit margins are the read; HOLD." },
  { id: "h7", ind: "health", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "Moderna & Humana Q3 before open — MRNA on cash runway; HUM on Medicare Advantage costs", tickers: "MRNA · HUM",
    rec: "AVOID MRNA until the cash-runway story stabilises; HUM is a high-vol binary on MA costs." },
  { id: "h8", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "AHA Scientific Sessions (Chicago, Nov 6–9): Sat Nov 7 opening late-breaker — Lp(a)HORIZON pelacarsen extended analyses", tickers: "NVS · IONS · AMGN",
    rec: "WATCH — Lp(a) data sets the bar for AMGN's olpasiran; IONS is the high-beta way to play it." },
  { id: "h9", ind: "health", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "AHA late-breaker Mon Nov 9: SYNCHRONIZE-CVOT — survodutide (BI/Zealand) cardiovascular outcomes in obesity", tickers: "ZEAL · LLY · NVO",
    rec: "Read-across for the GLP-1 class — a clean CV benefit supports LLY/NVO multiples; WATCH." },
  { id: "h10", ind: "health", dayIdx: 13, future: true, impact: 2, dir: "MIXED",
    headline: "PDUFA cluster Sat Nov 14: Summit ivonescimab (EGFR NSCLC), Cytokinetics aficamten (oHCM), BioXcel IGALMI — decisions may land Fri Nov 13", tickers: "SMMT · CYTK · BTAI",
    rec: "Binary small/mid-caps — only defined-risk, small size into a weekend goal date." },
  { id: "h11", ind: "health", dayIdx: 16, future: true, impact: 1, dir: "MIXED",
    headline: "Beren Therapeutics adrabetadex NDA PDUFA (Nov 17); Savara & Capricor follow Nov 22 — just past the window", tickers: "SVRA · CAPR",
    rec: "LOW market impact — specialist biotech binaries; WATCH only." },

  // ---- FINANCIALS / MACRO -------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 2, future: false, impact: 2, dir: "MIXED",
    headline: "Split close Tue: Dow −0.38% (−197 pts) to 51,786.72 on Apple's margin guide while S&P +0.36% and Nasdaq +0.83%; decliners beat advancers and equal-weight lagged; 10-yr ~4.95%", tickers: "SPY · DIA · RSP · TLT",
    rec: "Narrow, chip-led tape — keep 5–10% cash and favour equal-weight/value adds on red days." },
  { id: "f2", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "Democrats projected to win the House AND Senate; Trump 'absolutely willing' to accept results — Dow futures +~900 pts (+1.75%), S&P futures +~1% (SPY ~$762); 10-yr 4.91–4.93%, dollar index −0.4% to 101.3, gold +2.9% to ~$4,043, VIX futures ~20.9", tickers: "SPY · DIA · TLT · GLD · VIX",
    rec: "Gridlock rally — history (S&P up after each of the last 11 midterms) favours staying invested; BUY broad-index dips, but don't lever up with VIX still ~21." },
  { id: "f3", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "MIXED",
    headline: "Banks up, defense down: Bank of America +1.3–1.9% (~$50.3), JPM +0.6% (~$340); Lockheed −3.6% (~$616), RTX & Northrop among the biggest pre-market losers on budget-gridlock fears", tickers: "BAC · JPM · LMT · RTX · NOC",
    rec: "Lower yields + gridlock = steady for banks (HOLD BAC/JPM); TRIM defense on rallies until the FY27 appropriations path is clearer." },
  { id: "f4", ind: "finance", dayIdx: 3, future: true, impact: 2, dir: "MIXED",
    headline: "ADP employment & ISM Services today; Treasury quarterly refunding (date est.); AIG, MetLife & Allstate after close", tickers: "TLT · IEF · AIG · MET · ALL",
    rec: "Larger coupon sizes would push the 30-yr back above 5.3% — keep duration short until the refunding is out." },
  { id: "f5", ind: "finance", dayIdx: 4, future: true, impact: 1, dir: "MIXED",
    headline: "Q3 productivity & unit labor costs + weekly jobless claims, 8:30 ET", tickers: "SPY · TLT",
    rec: "Unit labor costs feed the wage-inflation story — low impact unless hot." },
  { id: "f6", ind: "finance", dayIdx: 5, future: true, impact: 3, dir: "MIXED",
    headline: "October jobs report (NFP), 8:30 ET — last payrolls before the Dec 9 FOMC; U. Michigan sentiment (prelim, approx.)", tickers: "SPY · JPM · TLT",
    rec: "A hot number firms December-hike odds — keep size light into it." },
  { id: "f7", ind: "finance", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Berkshire Hathaway Q3 (date est.) — Greg Abel's buyback pace and the cash pile after October's tech rout", tickers: "BRK.B",
    rec: "LOW impact — bigger buybacks would signal value; HOLD." },
  { id: "f8", ind: "finance", dayIdx: 9, future: true, impact: 3, dir: "MIXED",
    headline: "October CPI, 8:30 ET (BLS-confirmed Nov 10) — first inflation print after the Oct 28 FOMC, a month before the Dec 9 decision", tickers: "SPY · QQQ · TLT",
    rec: "Highest-impact print left in the window — with ~$100 oil in October, a hot CPI is the risk; reduce leverage into it." },
  { id: "f9", ind: "finance", dayIdx: 10, future: true, impact: 1, dir: "MIXED",
    headline: "Veterans Day — US bond market closed, stock market open; thin liquidity the day after CPI", tickers: "TLT · SPY",
    rec: "Expect lighter volume — avoid market orders on wide-spread options." },
  { id: "f10", ind: "finance", dayIdx: 12, future: true, impact: 2, dir: "MIXED",
    headline: "October PPI, 8:30 ET (Nov 13) — pipeline inflation", tickers: "SPY · TLT · XLF",
    rec: "Confirms or fades CPI — a hot PPI after a hot CPI locks in the December hike; keep duration short." },
  { id: "f11", ind: "finance", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Expiry week (Nov 16–20): Nov 20 monthly options expiration with NVDA's Nov 17 print inside; Anthropic IPO pricing possibly Nov 19–20", tickers: "SPY · QQQ · VIX",
    rec: "Manage Nov 20 positions by Fri Nov 13–Mon Nov 16 — close winners at 50–75% of max gain rather than holding into expiry week." },
  { id: "f12", ind: "finance", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "FOMC minutes (Oct 27–28 meeting), 2:00 ET Wed Nov 18 — how many members leaned toward a December hike", tickers: "SPY · TLT · XLF",
    rec: "Hawkish minutes after hot CPI/PPI would pressure long-duration tech — WATCH; keep bond duration short." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Home Depot +3.6% and Sherwin-Williams +~6% lead the Dow; Amazon extends its post-Q3 reversal +2.3%; oil's −7.6% plunge lifts airlines & cruise lines", tickers: "HD · SHW · AMZN · DAL · NCLH",
    rec: "Lower oil is a consumer tailwind — HOLD HD into its Nov 17 print; airlines remain a trade, not a hold." },
  { id: "c2", ind: "consumer", dayIdx: 2, future: false, impact: 1, dir: "MIXED",
    headline: "Yum! Brands beat (EPS $1.56 vs $1.49) but −0.5% on a Taco Bell cyclospora hit; Clorox +2% on a beat; Booking Holdings reported after close", tickers: "YUM · CLX · BKNG",
    rec: "Staples beats are being rewarded (CLX) — HOLD; YUM's hit looks transitory." },
  { id: "c3", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Consumer bid on the gridlock rally: Amazon +3.3% pre-market (~$258.9; Anthropic IPO stake), Walmart +~2%; Uber (EPS est. $0.96, rev ~$14.7B; ~±7.5% implied) & McDonald's (EPS est. $3.38, rev ~$7.28B) report before the open", tickers: "AMZN · WMT · UBER · MCD",
    rec: "AMZN is the relative-strength leader — HOLD/accumulate; MCD's US traffic is the low-income-consumer check, WATCH it before adding restaurants." },
  { id: "c4", ind: "consumer", dayIdx: 3, future: true, impact: 2, dir: "MIXED",
    headline: "DoorDash (first print since the Instacart deal) & MercadoLibre after close", tickers: "DASH · MELI",
    rec: "WATCH — DASH's integration costs vs. order growth is the swing; size small into the print." },
  { id: "c5", ind: "consumer", dayIdx: 4, future: true, impact: 2, dir: "MIXED",
    headline: "Airbnb, Monster Beverage & Live Nation after close", tickers: "ABNB · MNST · LYV",
    rec: "ABNB trades on its Q4 nights guide — WATCH; MNST is a defensive-growth HOLD." },
  { id: "c6", ind: "consumer", dayIdx: 10, future: true, impact: 1, dir: "MIXED",
    headline: "Singles' Day (Nov 11) — global e-commerce demand read ahead of US Black Friday", tickers: "BABA · PDD · AMZN",
    rec: "LOW impact for US names — don't trade AMZN on it." },
  { id: "c7", ind: "consumer", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Home Depot Q3 before open (confirmed Nov 17) + Disney FQ4 before open (webcast 8:30 ET) — housing & parks/streaming reads", tickers: "HD · DIS · LOW",
    rec: "WATCH — HD's housing commentary after its +3.6% run is the swing; DIS trades on its FY27 parks outlook." },
  { id: "c8", ind: "consumer", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "TJX FQ3 (confirmed Nov 18); Target & Lowe's (date est. Nov 16–18); Walmart follows Nov 19 — holiday guides", tickers: "TJX · TGT · LOW · WMT",
    rec: "WATCH — favour share gainers (WMT/TJX) over TGT into the holiday guides." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 1, spot: "$483.90 (Tue close; ~$513 pre-mkt, +6%)", sentiment: "Bullish",
    catalyst: "Q3 beat-and-raise last night (rev $13.38B, EPS $2.09, Q4 guide ~$17B vs $16.23B; MI450 ramp 'a very significant step up' into Q4) · earnings binary is OUT · Cohu Investor Day AMD keynote Nov 10 · NVDA print Nov 17 is the next sector catalyst",
    iv: "IV30 ~66% (Cboe, Tue close, pre-print) — HIGH; Nov 20 strikes were ~72–78% pre-print and should crush toward ~50–55% (ESTIMATE); Dec ~60%",
    liq: "A — ~583k contracts & 35.3M shares Tue Nov 3; OI 6.99k / 2.97k on Nov 470/460P, 4.53k / 6.10k on Dec 550/600C, 5.00k / 9.18k on Nov 550/600C; legs 3–8% wide ($0.25–0.80) [Cboe delayed chain]",
    thesis: "The MI450 ramp showed up in the numbers (data-center +27% q/q) and the Q4 guide was ~$0.8B above consensus — after a −22% month the bar was low. IV is still elevated but collapsing post-print, so sell a put spread below Tuesday's pre-print close and own upside through OTM call spreads (capped vega) rather than naked calls. Tue-close mids were struck at a $484 stock with pre-earnings IV — the ESTIMATES re-price to the ~$513 pre-market and crushed vol; confirm at the open.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $470 / buy $460 · Nov 20 '26 · ~$1.75 credit (ESTIMATE post-crush; the $4.13 Tue mid is stale pre-print) · max loss/capital ~$825 · ~8.4% OTM, below Tuesday's pre-earnings close" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $550 / sell $600 · Dec 18 '26 · ~$9.70 net debit (Tue mid 19.05 − 9.35); ~$11.50 ESTIMATE after the gap · cost/max loss ~$970–1,150 · max gain ~$3,850–4,030" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $550 / sell $600 · Nov 20 '26 · ~$6.35 net debit (Tue mid 9.62 − 3.27); ~$6.50 ESTIMATE · cost/max loss ~$635–650 · max gain ~$4,350 if AMD > $600 by expiry" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 2, spot: "$206.69 (Tue close; ~$209.8 pre-mkt)", sentiment: "Bullish",
    catalyst: "Q3 FY27 earnings Tue Nov 17 (confirmed; 5:00 ET call) — inside the Nov 20 expiry · AMD's MI450 beat validates AI-accelerator demand · overnight data-center moratorium scare faded with Nasdaq futures +930 pts off the low",
    iv: "IV30 ~46% (Cboe) — elevated; Nov 20 strikes ~50–64% (earnings inside), Dec ~40–45%",
    liq: "A — ~1.58M contracts & 91.9M shares Tue Nov 3; OI 14.8k / 28.6k on Nov 185/175P, 35.9k / 31.4k on Dec 210/230C, 53.9k on Nov 220C; legs 2–4% wide ($0.05–0.20) [Cboe delayed chain]",
    thesis: "Every hyperscaler capex dollar the market frets about is Nvidia revenue, and AMD's guide says the accelerator pie is still growing. Elevated IV → sell a ~12% OTM put spread to harvest it (closing before the Nov 17 print), own Dec upside through a call spread, and a small OTM Nov call into the run-up. Premiums are Tue-close mids; the stock is ~1.5% higher pre-market.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $185 / buy $175 · Nov 20 '26 · ~$1.27 credit (Tue mid 2.67 − 1.40; ~$1.05 ESTIMATE at the open) · max loss/capital ~$873–895 · ~12% OTM (earnings Nov 17 inside — close before the print to avoid the binary)" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $210 / sell $230 · Dec 18 '26 · ~$7.22 net debit (Tue mid 11.55 − 4.33; ~$7.80 ESTIMATE at the open) · cost/max loss ~$722–780 · max gain ~$1,220–1,280" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$220 call · Nov 20 '26 · ~$4.25 debit (Tue mid; ~$5.00 ESTIMATE at the open) · cost ~$425–500 · earnings run-up into Nov 17" },
    ] },
  { ticker: "AMZN", name: "Amazon", rank: 3, spot: "$250.69 (Tue close; ~$258.9 pre-mkt, +3.3%)", sentiment: "Bullish",
    catalyst: "Relative-strength leader since its Q3 reversal · Anthropic IPO targeted for the week of Nov 16 (pricing reported Nov 19–20; AMZN is the largest strategic holder) · gridlock rally lifts consumer names · no earnings binary before Jan",
    iv: "IV30 ~33% (Cboe) — moderate; Nov 20 ~33–39%, Dec ~31–33%",
    liq: "A — ~499k contracts & 37.9M shares Tue Nov 3; OI 11.6k / 9.8k on Nov 245/235P, 16.9k / 19.4k on Dec 260/280C, 37.4k on Nov 270C; legs 3–5% wide ($0.08–0.25) [Cboe delayed chain]",
    thesis: "A third straight up-day of buying after the Q3 miss shows the market is looking through FCF to AWS + the Anthropic mark-to-market. Moderate IV → a ~5% OTM put spread, a Dec call spread through the IPO window, and a cheap Nov OTM call. The +3.3% pre-market gap makes Tue mids stale — ESTIMATES re-price to ~$259.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $245 / buy $235 · Nov 20 '26 · ~$1.30 credit (ESTIMATE at ~$259; Tue mid 2.56 pre-gap) · max loss/capital ~$870 · ~5.4% OTM, below Tuesday's close" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $260 / sell $280 · Dec 18 '26 · ~$5.35 net debit (Tue mid 7.93 − 2.58); ~$7.00 ESTIMATE after the gap · cost/max loss ~$535–700 · max gain ~$1,300–1,465" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$270 call · Nov 20 '26 · ~$1.51 debit (Tue mid); ~$3.00 ESTIMATE at the open · cost ~$150–300 · Anthropic-IPO re-rating" },
    ] },
  { ticker: "MSFT", name: "Microsoft", rank: 4, spot: "$520.99 (Tue close; ~$529.3 pre-mkt)", sentiment: "Bullish",
    catalyst: "Rebounding with software after the late-Oct sell-off despite FQ1 Azure +48% · Ignite Nov 17–20 inside the Nov expiry · Anthropic IPO read-across for AI platforms · no earnings binary before Jan",
    iv: "IV30 ~28% (Cboe) — low; Nov 20 ~29–33%, Dec ~27–29%",
    liq: "A — ~416k contracts & 20.0M shares Tue Nov 3; OI 11.7k / 8.6k on Nov 500/490P, 6.2k / 14.5k on Dec 530/550C, 6.2k on Nov 545C; legs 5–9% wide ($0.25–0.85) [Cboe delayed chain]",
    thesis: "The AI spender with the clearest payback, still below its post-earnings range. Low IV keeps premium cheap → an at-the-money Dec call spread, a put credit spread under the $500 round number, and a Nov OTM call into Ignite. ($485P at 12% wide and $550/$565/$570 Nov calls at 11–15% wide failed the spread test, so neighbouring strikes are used.)",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $500 / buy $490 · Nov 20 '26 · ~$2.12 credit (Tue mid 6.15 − 4.03; ~$1.50 ESTIMATE at the open) · max loss/capital ~$788–850 · ~5.5% OTM below $500 support" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $530 / sell $550 · Dec 18 '26 · ~$7.73 net debit (Tue mid 17.43 − 9.70; ~$8.80 ESTIMATE at the open) · cost/max loss ~$773–880 · max gain ~$1,120–1,227" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$545 call · Nov 20 '26 · ~$4.67 debit (Tue mid; ~$6.50 ESTIMATE at the open) · cost ~$467–650 · Ignite + recovery to the post-earnings range" },
    ] },
  { ticker: "TSLA", name: "Tesla", rank: 5, spot: "$398.50 (Tue close; ~$382.5 pre-mkt, −4%)", sentiment: "Bearish",
    catalyst: "Musk-backed Republicans lose in the midterm sweep (SpaceX −4–6% overnight) · political-risk discount on Musk names · Nasdaq-100 still in correction · no Tesla earnings binary in the window",
    iv: "IV30 ~44% (Cboe) — elevated; Nov 20 ~46–52%, Dec ~45–47%; put skew bid",
    liq: "A — ~902k contracts & 26.6M shares Tue Nov 3; OI 9.8k / 5.4k on Nov 420/430C, 8.1k / 14.2k on Dec 380/350P, 4.8k / 6.3k on Nov 370/340P; legs 1–3% wide ($0.05–0.25) [Cboe delayed chain]",
    thesis: "The richest valuation in mega-cap now carries a fresh political overhang and a weaker SpaceX mark. Elevated IV → collect premium with a bear call credit spread ~10% above the market, and express downside through defined-risk put debit spreads (no long naked puts at 44%+ IV). Squeeze risk is real on any robotaxi headline — keep these small. Tue mids were struck at $398.50; ESTIMATES re-price to ~$382.",
    ideas: [
      { profile: "Conservative", strategy: "Bear Call Credit Spread", text: "Sell $420 / buy $430 · Nov 20 '26 · ~$2.58 credit (Tue mid 7.70 − 5.12); ~$1.50 ESTIMATE after the −4% gap · max loss/capital ~$742–850 · ~9.8% OTM" },
      { profile: "Moderate",     strategy: "Bear Put Debit Spread", text: "Buy $380 / sell $350 · Dec 18 '26 · ~$8.27 net debit (Tue mid 15.60 − 7.33); ~$10.50 ESTIMATE at the open · cost/max loss ~$827–1,050 · max gain ~$1,950–2,170" },
      { profile: "Aggressive",   strategy: "Bear Put Debit Spread", text: "Buy $370 / sell $340 · Nov 20 '26 · ~$4.15 net debit (Tue mid 6.05 − 1.90); ~$6.50 ESTIMATE at the open · cost/max loss ~$415–650 · max gain ~$2,350–2,585" },
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
// today line sits on the boundary between Nov 4 and Nov 5
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Wednesday, Nov 4 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Nov 4)
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
