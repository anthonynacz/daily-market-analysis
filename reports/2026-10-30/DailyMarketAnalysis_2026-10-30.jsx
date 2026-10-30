import React, { useState, useMemo } from "react";

/**
 * MarketMatrix — Recency × Impact news matrix for US equities, by industry.
 *
 * Snapshot date: Friday, October 30, 2026 (live-researched; option quotes from the Cboe delayed chain ~17 min after the Oct 30 open).
 * Window: last 3 days (Oct 27) → coming 2 weeks (Nov 13).
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

// 18-day axis: Oct 27 .. Nov 13 (last 3 days → coming 2 weeks). Today = index 3 (Oct 30).
const DAYS = [
  { idx: 0, date: "Oct 27", dow: "Tue" },
  { idx: 1, date: "Oct 28", dow: "Wed" },
  { idx: 2, date: "Oct 29", dow: "Thu" },
  { idx: 3, date: "Oct 30", dow: "Fri" }, // TODAY
  { idx: 4, date: "Oct 31", dow: "Sat" },
  { idx: 5, date: "Nov 1", dow: "Sun" },
  { idx: 6, date: "Nov 2", dow: "Mon" },
  { idx: 7, date: "Nov 3", dow: "Tue" },
  { idx: 8, date: "Nov 4", dow: "Wed" },
  { idx: 9, date: "Nov 5", dow: "Thu" },
  { idx: 10, date: "Nov 6", dow: "Fri" },
  { idx: 11, date: "Nov 7", dow: "Sat" },
  { idx: 12, date: "Nov 8", dow: "Sun" },
  { idx: 13, date: "Nov 9", dow: "Mon" },
  { idx: 14, date: "Nov 10", dow: "Tue" },
  { idx: 15, date: "Nov 11", dow: "Wed" },
  { idx: 16, date: "Nov 12", dow: "Thu" },
  { idx: 17, date: "Nov 13", dow: "Fri" },
];
const TODAY_IDX = 3;

// impact: 3 = HIGH (top), 2 = MEDIUM, 1 = LOW (bottom)
const IMPACT_LABEL = { 3: "HIGH", 2: "MEDIUM", 1: "LOW" };

// ------------------------------------------------------------------ events
// dayIdx maps the event date onto the 18-day axis above.
const EVENTS = [
  // ---- TECHNOLOGY / SEMIS / COMMS -----------------------------------------
  { id: "t1", ind: "tech", dayIdx: 0, future: false, impact: 3, dir: "BULLISH",
    headline: "Chip rally extends: Philly Semi +3%+, CoreWeave +~8% — Meta prices $25B of stock at $625 (with a $3B Nvidia stake) after a Q3 with $34.9B capex and a $135–145B FY capex guide", tickers: "SMH · NVDA · AVGO · CRWV · META",
    rec: "AVOID chasing META under the dilution overhang; BUY-on-dips the AI hardware chain (memory/power) where orders are visible." },
  { id: "t2", ind: "tech", dayIdx: 1, future: false, impact: 3, dir: "BULLISH",
    headline: "SK Hynix record Q3 lifts AI hardware: Vertiv +16.6% to $243 (orders >2×), Micron +5.9%, Flex +11.6%, Amphenol +3.5%; Oracle jumps on FY30 targets; Enphase −16%", tickers: "VRT · MU · FLEX · APH · ORCL",
    rec: "Memory & data-center power remain the cleanest AI-capex winners — HOLD/add VRT and MU on pullbacks; AVOID residential solar." },
  { id: "t3", ind: "tech", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Alphabet's worst day on record: GOOGL −12.64% to $283.82 (~$500B wiped) on slowing Search, $51.4B capex & negative FCF despite Cloud +103%; ServiceNow & Fortinet −23%; Nasdaq −1.38% to 26,184.72", tickers: "GOOGL · NOW · FTNT · IGV · QQQ",
    rec: "Market now punishes capex without free cash flow — DON'T knife-catch GOOGL; WATCH for a base above ~$275 before buying." },
  { id: "t4", ind: "tech", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "Microsoft beats (FQ1 revenue $92.3B, +19%; Azure +48% vs 44–45% guide) and holds up while the rest of mega-cap AI sells off; Meta +~2% to ~$625; Marvell slides on reported Lumentum talks", tickers: "MSFT · META · MRVL · LITE",
    rec: "MSFT is the AI capex spender with the clearest payback — HOLD/BUY-on-dips (~$522 today); AVOID MRVL until deal terms are known." },
  { id: "t5", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "BEARISH",
    headline: "Amazon Q3 misses (EPS $1.89 vs $1.96 est; revenue light), TTM free cash flow −$42.4B, 2026 capex kept at $220B — AMZN −5.5% to ~$230; Intel guides Q4 $15–16B vs $17.1B est (PC slowdown into mid-2027) — INTC −26% to −29% (~$65)", tickers: "AMZN · INTC · QQQ",
    rec: "Third mega-cap capex/FCF punishment in two days — AMZN: HOLD, add only in small defined-risk size; AVOID INTC until the PC trough is visible." },
  { id: "t6", ind: "tech", dayIdx: 3, future: false, impact: 3, dir: "BEARISH",
    headline: "AI-hardware rout: Nasdaq −2.3%, Nasdaq-100 futures −2.6%; AMD −10% (~$509), Arm −9%, Coherent −8%, Sandisk −8–9% despite revenue +23% & an 8-for-1 split, Micron −5%, NVDA −3% (~$207); Reddit −23% (US DAUs −2%), Twilio −20%, Roblox −15%", tickers: "AMD · NVDA · ARM · SNDK · MU · RDDT",
    rec: "Month-end de-risking on capex fears, not broken demand — DON'T sell quality semis into the hole; scale into NVDA/AMD with defined-risk structures." },
  { id: "t7", ind: "tech", dayIdx: 6, future: true, impact: 3, dir: "MIXED",
    headline: "Apple FQ4 after close (company-confirmed, call 5:00 ET; EPS est ~$1.99, revenue ~$113.2B) — first call under CEO John Ternus; Palantir (EPS est ~$0.41) also after close", tickers: "AAPL · PLTR",
    rec: "WATCH — AAPL (~$347) is the low-capex mega-cap the rotation favours; a clean iPhone/Services guide confirms the haven bid. PLTR: high IV, defined-risk only." },
  { id: "t8", ind: "tech", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "AMD Q3 after close (Election Day, call 5:00 ET) — MI-series GPU ramp; stock −10% today into it, IV ~61–67%; Arista, Astera Labs & Block after close; Shopify before open", tickers: "AMD · ANET · ALAB · SHOP",
    rec: "WATCH — today's −10% lowers the bar; expect a ±10% move. Size small, defined-risk only." },
  { id: "t9", ind: "tech", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Qualcomm (4:45 ET), Arm, AppLovin, Coherent & Datadog (before open) report — handset/AI-PC demand and optical networking after today's rout", tickers: "QCOM · ARM · APP · COHR · DDOG",
    rec: "WATCH — QCOM/ARM guides are the read on PC & handset weakness flagged by Intel; COHR on AI optics." },
  { id: "t10", ind: "tech", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Cloudflare, Atlassian, Lumentum & Microchip after close (all company-confirmed)", tickers: "NET · TEAM · LITE · MCHP",
    rec: "Software names were punished on AI-disruption fears (NOW −23%) — WATCH TEAM's seat trends; LITE trades on the Marvell talks." },
  { id: "t11", ind: "tech", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "Take-Two Interactive Q2 (date est.) — GTA VI launch-cadence commentary; KubeCon NA (Nov 8–11) under way", tickers: "TTWO · EA",
    rec: "LOW impact for the market; TTWO trades on launch timing, not the quarter — WATCH." },
  { id: "t12", ind: "tech", dayIdx: 14, future: true, impact: 1, dir: "MIXED",
    headline: "Cohu Investor Day (NYC) with an AMD keynote; FactSet Investor Day; Adobe MAX (Nov 10–12) begins", tickers: "COHU · AMD · FDS · ADBE",
    rec: "LOW impact — colour on AI-chip test demand and Adobe's AI monetisation; not a standalone trade." },
  { id: "t13", ind: "tech", dayIdx: 15, future: true, impact: 2, dir: "MIXED",
    headline: "Cisco FQ1 after close (date est. Nov 11 — confirm with IR) — AI networking orders vs. campus refresh", tickers: "CSCO · ANET",
    rec: "WATCH — a beat on AI-networking orders supports ANET; trade the guide, not the print." },
  { id: "t14", ind: "tech", dayIdx: 16, future: true, impact: 2, dir: "MIXED",
    headline: "Applied Materials FQ4 after close (IR-confirmed Nov 12) — wafer-fab equipment demand after SK Hynix's record quarter vs. China export curbs", tickers: "AMAT · LRCX · KLAC",
    rec: "WATCH — memory capex is the bull case; China revenue mix is the risk. Don't pre-position after this week's semis rout." },

  // ---- ENERGY -------------------------------------------------------------
  { id: "e1", ind: "energy", dayIdx: 0, future: false, impact: 2, dir: "BEARISH",
    headline: "Oil slides for a second session on Tehran diplomacy (WTI ~$100); Baker Hughes, ONEOK & NOV report after close", tickers: "USO · XOM · BKR · OKE",
    rec: "HOLD majors as a hedge — a diplomacy dip isn't a ceasefire; BKR's LNG/gas-tech orders are the cleaner read." },
  { id: "e2", ind: "energy", dayIdx: 1, future: false, impact: 2, dir: "BULLISH",
    headline: "Crude +~3% (Brent settles $115.32) on Houthi strikes on Saudi infrastructure and a US threat to restart the Iran campaign; GE Vernova −1.9% despite $29.3B orders & a $9B Trench buy", tickers: "USO · XOM · GEV",
    rec: "Keep oil exposure as the geopolitical hedge; GEV: BUY-on-dips — the backlog is the story, not the deal." },
  { id: "e3", ind: "energy", dayIdx: 2, future: false, impact: 2, dir: "BEARISH",
    headline: "Oil dips (WTI ~$100–101) after VP Vance writes to Iran to revive peace talks; WSJ: Gulf states told to prepare for renewed US strikes after the Nov 3 midterms. Shell, TotalEnergies & Cheniere report", tickers: "USO · SHEL · TTE · LNG",
    rec: "HOLD — the diplomacy dip and the post-midterm strike risk cancel out; don't chase either way." },
  { id: "e4", ind: "energy", dayIdx: 3, future: false, impact: 3, dir: "BULLISH",
    headline: "ExxonMobil beats (adj. EPS $4.23 vs $4.12; revenue +33% to $113.2B), lifts dividend to $1.07 and sets a $20B buyback — refining out-earns upstream for the first time in 6+ yrs; Chevron adj. EPS $5.28 vs $4.89 (revenue +36%); XOM +1.6% (~$186); WTI +1.8% to ~$104 on US strike-resumption reports", tickers: "XOM · CVX · USO",
    rec: "BUY-on-dips XOM/CVX — war-driven refining margins + buybacks make the majors the market's cleanest earnings hedge today." },
  { id: "e5", ind: "energy", dayIdx: 5, future: true, impact: 2, dir: "MIXED",
    headline: "OPEC+ (the 'seven') meets Nov 1 — base case a Q4 pause; Gulf members pumping below quota on Hormuz disruption", tickers: "XOM · CVX · USO",
    rec: "Low odds of a surprise hike — the Iran war, not OPEC+, sets the price; keep energy as insurance." },
  { id: "e6", ind: "energy", dayIdx: 7, future: true, impact: 1, dir: "BULLISH",
    headline: "Marathon Petroleum (11:00 ET), Diamondback (9:00 ET call) & Williams Q3 — refiners follow XOM/CVX's record downstream quarter", tickers: "MPC · FANG · WMB · VLO",
    rec: "Refiners are the direct play on the diesel squeeze — HOLD MPC/VLO; FANG trades on Permian capex discipline." },
  { id: "e7", ind: "energy", dayIdx: 8, future: true, impact: 3, dir: "MIXED",
    headline: "Post-midterm Iran strike window opens (Trump has signalled renewed airstrikes after the vote) + EIA weekly report; Tehran confirms receipt of Vance's letter", tickers: "USO · XOM · CVX · FRO",
    rec: "Size energy so a de-escalation gap-down is tolerable; this is where the war premium is tested." },
  { id: "e8", ind: "energy", dayIdx: 9, future: true, impact: 2, dir: "BULLISH",
    headline: "ConocoPhillips (12:00 ET call), Targa, Duke & Southern Q3; EOG after close (expected); Devon & Vistra follow Fri", tickers: "COP · TRGP · EOG · DVN · VST",
    rec: "WATCH — COP/EOG translate $100+ crude into buybacks; VST is the AI-power read-through." },
  { id: "e9", ind: "energy", dayIdx: 13, future: true, impact: 2, dir: "BULLISH",
    headline: "Constellation Energy & NRG Q3 (date est.), Occidental after close — nuclear/gas power for AI data centers and $100 oil cash flows", tickers: "CEG · NRG · OXY · VST",
    rec: "WATCH — add CEG on weakness if data-center contract commentary holds up; OXY is the levered crude play." },

  // ---- HEALTHCARE / PHARMA ------------------------------------------------
  { id: "h1", ind: "health", dayIdx: 0, future: false, impact: 2, dir: "BULLISH",
    headline: "Centene smashes Q3 (adj. EPS $0.58 vs $0.10 est) and raises FY26; Novartis Entresto −38% on generics vs Leqvio +64%; Kiniksa +23%", tickers: "CNC · NVS · KNSA",
    rec: "CNC: BUY-on-dips — managed-care cost trends are stabilising; NVS: HOLD through the Entresto cliff." },
  { id: "h2", ind: "health", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Genmab +28% (Phase 3 head-and-neck drug cuts risk of death 50%); GE HealthCare raises FY; Boston Scientific −11% (FY26 cut after a cyberattack)", tickers: "GMAB · GEHC · BSX",
    rec: "GMAB: HOLD — the data de-risks the asset; AVOID catching BSX until the cyberattack impact is sized." },
  { id: "h3", ind: "health", dayIdx: 2, future: false, impact: 3, dir: "BULLISH",
    headline: "Eli Lilly beats & raises (adj. EPS $7.48 vs $6.26; revenue $24.4B; FY26 $91–92B) — LLY +4%; healthcare leads a positive-breadth tape; BMY +3.6%; Alnylam −16%", tickers: "LLY · BMY · ALNY · XLV",
    rec: "LLY: BUY-on-dips — GLP-1 demand is still outrunning estimates; healthcare is the defensive rotation bid." },
  { id: "h4", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Europe pharma lifts: AstraZeneca +5.7% (9-mo revenue +7% cc, guide kept), Sanofi +4.1% (Q3 sales +14.3% cc, raises guide); AbbVie little changed after its Q3", tickers: "AZN · SNY · ABBV",
    rec: "Pharma is working as the rotation haven — HOLD AZN/SNY; ABBV: HOLD, the guide was priced in." },
  { id: "h5", ind: "health", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Medtech & tools hit: Stryker −10% (CEO: quarter fell short), Alphatec −31%, Illumina −14% despite a raise; Alignment Healthcare −11% on higher medical costs", tickers: "SYK · ATEC · ILMN · ALHC",
    rec: "AVOID catching SYK on day one — wait for procedure-volume colour; ALHC's cost spike is a caution flag for MA plans (CVS/HUM next week)." },
  { id: "h6", ind: "health", dayIdx: 5, future: true, impact: 1, dir: "MIXED",
    headline: "Agios mitapivat sickle-cell sNDA PDUFA (Sunday — action likely around Nov 2)", tickers: "AGIO",
    rec: "Binary for AGIO; avoid holding size through a weekend goal date." },
  { id: "h7", ind: "health", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "Vertex Q3 after close (4:30 ET) — CF franchise & Journavx pain launch; IDEXX before open", tickers: "VRTX · IDXX",
    rec: "WATCH — VRTX trades on the Journavx ramp; low beta to the AI rout makes it a rotation candidate." },
  { id: "h8", ind: "health", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Pfizer (10:00 ET call) & Teva before open; Amgen after close (4:30 ET) — MariTide obesity commentary after LLY's raise", tickers: "PFE · TEVA · AMGN · LLY",
    rec: "AMGN's obesity update is the swing — WATCH; PFE is a yield/HOLD." },
  { id: "h9", ind: "health", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "CVS (8:00 ET) & Cencora before open; Novo Nordisk (expected); McKesson & Edwards after close", tickers: "CVS · COR · NVO · MCK · EW",
    rec: "CVS: test of whether Centene's beat or Alignment's cost spike is the MA trend; NVO trades on GLP-1 pricing vs LLY." },
  { id: "h10", ind: "health", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "Cigna, Becton Dickinson & Cardinal Health before open; Natera after close", tickers: "CI · BDX · CAH · NTRA",
    rec: "LOW impact — CI's pharmacy-benefit margins are the read; HOLD." },
  { id: "h11", ind: "health", dayIdx: 10, future: true, impact: 2, dir: "MIXED",
    headline: "Moderna & Humana Q3 before open (8:00 ET) — MRNA after the intismeran data; HUM on Medicare Advantage costs", tickers: "MRNA · HUM",
    rec: "AVOID MRNA until the cash runway story stabilises; HUM is a high-vol binary on MA cost trends." },
  { id: "h12", ind: "health", dayIdx: 17, future: true, impact: 1, dir: "MIXED",
    headline: "PDUFA cluster into Sat Nov 14: Cytokinetics aficamten (HCM), Summit ivonescimab (EGFR NSCLC), BioXcel IGALMI — positioning into the weekend", tickers: "CYTK · SMMT · BTAI",
    rec: "Binary small/mid-caps — WATCH; only defined-risk, small size into a weekend goal date." },

  // ---- FINANCIALS / MACRO -------------------------------------------------
  { id: "f1", ind: "finance", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "S&P +0.60% to 7,722.60, Nasdaq +1.18%; after the close Visa beats (adj. EPS $3.48, revenue +13%) while Robinhood misses on profit", tickers: "SPY · V · HOOD · MA",
    rec: "V: HOLD — steady volumes confirm a resilient consumer; AVOID HOOD until retail activity re-accelerates." },
  { id: "f2", ind: "finance", dayIdx: 1, future: false, impact: 3, dir: "MIXED",
    headline: "FOMC holds at 3.75–4.00% in a 10–2 vote (two hawkish dissents); Warsh hints at a December move after the midterms and drops forward guidance — ~85% Dec-hike odds", tickers: "SPY · TLT · JPM · BAC",
    rec: "Hawkish hold — keep duration short and leverage light into December; banks benefit from higher-for-longer." },
  { id: "f3", ind: "finance", dayIdx: 2, future: false, impact: 3, dir: "BEARISH",
    headline: "Q3 GDP +3.4% but Sept PCE 3.6% y/y (core 3.1%) — S&P −0.30% to 7,720.39 (ends 3-day win streak), Dow −0.25% to 52,342.56; Caterpillar −9% despite a beat", tickers: "SPY · QQQ · TLT · CAT",
    rec: "Data seal the December-hike case — trim long-duration growth, HOLD quality cyclicals." },
  { id: "f4", ind: "finance", dayIdx: 3, future: false, impact: 3, dir: "BEARISH",
    headline: "Month-end risk-off: S&P −1.2% (~7,628), Nasdaq −2.3%, VIX +10% to ~19; flight to safety pulls the 10-yr to ~4.92%; Q3 ECI +0.8%; Nasdaq on pace for ~−2.5% in October vs Dow +2.8%", tickers: "SPY · QQQ · VIX · TLT",
    rec: "Rotation, not capitulation — don't panic-sell; keep 5–10% cash for post-election entries and favour defined-risk over outright longs." },
  { id: "f5", ind: "finance", dayIdx: 3, future: false, impact: 2, dir: "BEARISH",
    headline: "Crypto names −6%+ (Coinbase, Circle, Robinhood, Strategy) after a Binance hack Binance puts at ~$6.3B — bitcoin −4% to ~$76.8k; Arbor Realty −25% on a Q3 loss & suspended dividend", tickers: "COIN · CRCL · HOOD · MSTR · ABR",
    rec: "AVOID crypto-beta until the hack's contagion is sized; ABR is a warning on CRE-lending credit — AVOID high-yield mortgage REITs." },
  { id: "f6", ind: "finance", dayIdx: 6, future: true, impact: 2, dir: "MIXED",
    headline: "ISM Manufacturing PMI (October), 10:00 ET", tickers: "SPY · CAT · XLI",
    rec: "Growth check — above 50 supports cyclicals; a slump revives slowdown fears after Intel's PC warning." },
  { id: "f7", ind: "finance", dayIdx: 7, future: true, impact: 3, dir: "MIXED",
    headline: "US midterm elections — control of Congress; JOLTS (Sept) & factory orders 10:00 ET; Apollo before open", tickers: "SPY · IWM · XLF · XLE · APO",
    rec: "Expect elevated vol into the vote; equities historically rally once midterms resolve — avoid big directional bets the day before." },
  { id: "f8", ind: "finance", dayIdx: 8, future: true, impact: 1, dir: "MIXED",
    headline: "ADP employment (8:15 ET), trade balance & ISM Services; AIG, MetLife & Allstate after close", tickers: "SPY · TLT · AIG · MET",
    rec: "Previews for Friday's payrolls — services strength argues for a December hike." },
  { id: "f9", ind: "finance", dayIdx: 9, future: true, impact: 1, dir: "MIXED",
    headline: "Q3 productivity & unit labor costs + weekly jobless claims, 8:30 ET", tickers: "SPY · TLT",
    rec: "Unit labor costs feed the wage-inflation story after a +0.8% ECI — low impact unless hot." },
  { id: "f10", ind: "finance", dayIdx: 10, future: true, impact: 3, dir: "MIXED",
    headline: "October jobs report (NFP), 8:30 ET (BLS-confirmed); Brookfield Asset Mgmt before open; Berkshire Q3 expected over the weekend", tickers: "SPY · JPM · TLT · BRK.B",
    rec: "A hot number firms December-hike odds — keep size light into it." },
  { id: "f11", ind: "finance", dayIdx: 13, future: true, impact: 1, dir: "MIXED",
    headline: "KKR Q3 before open (date est.) — private-credit marks and fundraising", tickers: "KKR · BX · APO",
    rec: "WATCH — after ABR's dividend cut, private-credit commentary is the read-through for alt managers and BDCs." },
  { id: "f12", ind: "finance", dayIdx: 14, future: true, impact: 3, dir: "MIXED",
    headline: "October CPI, 8:30 ET (BLS-confirmed) — first inflation print after the FOMC, a month before the Dec 9 decision", tickers: "SPY · QQQ · TLT",
    rec: "Highest-impact print left in the window — after a 3.6% PCE and $100+ oil, a hot CPI is the risk; reduce leverage into it." },
  { id: "f13", ind: "finance", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Veterans Day — US bond market closed, stock market open; thin liquidity the day after CPI", tickers: "TLT · SPY",
    rec: "Expect lighter volume — avoid market orders on wide-spread options." },
  { id: "f14", ind: "finance", dayIdx: 17, future: true, impact: 2, dir: "MIXED",
    headline: "October PPI, 8:30 ET (per financecalendar.com — confirm on the BLS schedule) — pipeline inflation with $100+ oil", tickers: "SPY · TLT · XLF",
    rec: "Confirms or fades CPI — a hot PPI after a hot CPI locks in the December hike; keep duration short." },

  // ---- CONSUMER / RETAIL --------------------------------------------------
  { id: "c1", ind: "consumer", dayIdx: 0, future: false, impact: 2, dir: "MIXED",
    headline: "Coca-Cola beats and raises but slips on slower North America; UPS beats & raises FY26; Royal Caribbean guides Q4 below; JetBlue misses", tickers: "KO · UPS · RCL · JBLU",
    rec: "KO: HOLD — priced for perfection; UPS: BUY-on-dips after the raise; AVOID JBLU while jet fuel stays elevated." },
  { id: "c2", ind: "consumer", dayIdx: 1, future: false, impact: 2, dir: "MIXED",
    headline: "Wendy's +15% on Trian's non-binding $7.35 offer; after the close Chipotle +7%, Carvana +10%, eBay +5%, Ford raises FY EBIT guide; Sprouts −21% on a comps miss", tickers: "WEN · CMG · CVNA · EBAY · F · SFM",
    rec: "CMG/EBAY: HOLD — traffic is holding up; AVOID SFM — grocery comps are rolling over." },
  { id: "c3", ind: "consumer", dayIdx: 2, future: false, impact: 2, dir: "BULLISH",
    headline: "DoorDash agrees to buy Instacart for $17B ($65/sh, 75% cash) — DASH +5%; Crocs +25%, Norwegian Cruise +12% on Q3 beats; Starbucks reports after close", tickers: "DASH · CART · CROX · NCLH · SBUX",
    rec: "DASH: HOLD — the deal widens its grocery moat; CART is a deal-spread trade now. Don't chase CROX's gap." },
  { id: "c4", ind: "consumer", dayIdx: 3, future: false, impact: 2, dir: "BULLISH",
    headline: "Staples & brands catch the rotation bid: Capri +11.5% (beat & raise), Mondelez +7% (volumes up), Colgate +5% (EPS-growth guide raised to 5–7%), Rivian +4.5% (deliveries guide 67–70k)", tickers: "CPRI · MDLZ · CL · RIVN",
    rec: "Defensive staples are working while tech sells — HOLD MDLZ/CL; don't chase CPRI's gap." },
  { id: "c5", ind: "consumer", dayIdx: 6, future: true, impact: 1, dir: "MIXED",
    headline: "Marriott Q3 before open (8:00 ET) — travel demand and RevPAR into the holidays", tickers: "MAR · HLT · H",
    rec: "LOW impact — a RevPAR read for travel names; HOLD." },
  { id: "c6", ind: "consumer", dayIdx: 7, future: true, impact: 2, dir: "MIXED",
    headline: "Booking after close; Yum! Brands, Ferrari, Keurig Dr Pepper & Sysco before open", tickers: "BKNG · YUM · RACE · KDP · SYY",
    rec: "BKNG's room-night guide is the travel tell; SYY is the restaurant-traffic read — WATCH." },
  { id: "c7", ind: "consumer", dayIdx: 8, future: true, impact: 2, dir: "MIXED",
    headline: "Uber before open (8:00 ET, company-confirmed); DoorDash (first print since the Instacart deal) & MercadoLibre after close; McDonald's expected", tickers: "UBER · DASH · MELI · MCD",
    rec: "Uber's guide and robotaxi commentary are the swing; MCD's US traffic is the low-income consumer check." },
  { id: "c8", ind: "consumer", dayIdx: 9, future: true, impact: 2, dir: "MIXED",
    headline: "Airbnb, Monster Beverage & Live Nation after close (company-confirmed)", tickers: "ABNB · MNST · LYV",
    rec: "ABNB trades on Q4 nights guide — WATCH; MNST is a defensive-growth HOLD." },
  { id: "c9", ind: "consumer", dayIdx: 10, future: true, impact: 1, dir: "MIXED",
    headline: "Holiday-season setup into the jobs report — $100+ oil squeezes gas-station budgets as promo calendars ramp", tickers: "AMZN · WMT · TGT",
    rec: "Favour share-gaining scale retailers (WMT/AMZN); a soft NFP hurts discretionary." },
  { id: "c10", ind: "consumer", dayIdx: 15, future: true, impact: 1, dir: "MIXED",
    headline: "Singles' Day (Nov 11) — the world's largest online shopping event; global e-commerce demand read ahead of US Black Friday", tickers: "BABA · PDD · AMZN",
    rec: "LOW impact for US names — WATCH for a consumer-demand read; don't trade AMZN on it." },
];

// ------------------------------------------------------------------ options
// Each idea carries a `strategy` (chosen by IV regime, sentiment & binary risk),
// a `profile` (risk appetite), and a stated CAPITAL figure. Defined-risk + cash-
// secured only — no naked shorts; total capital at risk per idea is kept <= $1,500
// (so cash-secured puts only fit genuinely cheap stocks — otherwise use spreads).
const OPTION_PLAYS = [
  { ticker: "AAPL", name: "Apple", rank: 1, spot: "$347.18", sentiment: "Bullish",
    catalyst: "FQ4 earnings — Mon Nov 2 (after close, call 5:00 ET) · BINARY · Ternus's first call as CEO; EPS est ~$1.99, revenue ~$113.2B",
    iv: "IV30 ~27% (Cboe) — moderate; Nov strikes ~27–33% (~±5% implied), Dec ~24–26%",
    liq: "A — ~36k contracts & 1.6M shares in the first ~17 min today (~917k contracts Oct 27); OI 25.5k / 12.6k on Dec 350/370C, 23.8k / 17.1k on Nov 330/320P, 26.2k on Nov 360C; legs 3.2–9.0% wide ($0.15 on the $2.17 leg) [Cboe delayed chain, Oct 30 ~9:47 ET]",
    thesis: "Only −0.5% while the Nasdaq drops 2%+ — Apple is the mega-cap with the least AI-capex/FCF risk, and the market has just punished GOOGL, AMZN and INTC for exactly that. Moderate IV into Monday's print → debit spread for upside, put credit spread under $330, cheap OTM call for a breakout.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $350 / sell $370 · Dec 18 '26 · ~$7.80 net debit (mid 12.65 − 4.85) · cost/max loss ~$780 · max gain ~$1,220" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $330 / buy $320 · Nov 20 '26 · ~$1.71 credit (mid 3.88 − 2.17) · max loss/capital ~$829 · ~4.9% OTM, range-tolerant through the print" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$360 call · Nov 20 '26 · ~$4.65 debit (4.45/4.85) · cost ~$465 · post-earnings breakout" },
    ] },
  { ticker: "NVDA", name: "Nvidia", rank: 2, spot: "$207.22", sentiment: "Bullish",
    catalyst: "Hyperscaler capex intact (AMZN $220B, META $135–145B, GOOGL $51B/qtr) despite the FCF backlash · next earnings ~Nov 18 (date est.) falls before Nov 20 expiry",
    iv: "IV30 ~42% (Cboe); Nov strikes ~43–52% (earnings inside Nov expiry), Dec ~39–43%",
    liq: "A — ~56k contracts & 4.0M shares in the first ~17 min today; OI 91.2k / 33.9k on Nov 190/180P, 34.2k / 31.3k on Dec 210/230C, 49.4k on Nov 220C; legs 1.3–3.3% wide [Cboe delayed chain, Oct 30 ~9:47 ET]",
    thesis: "−3% to ~$207 in the AI-hardware rout — but the same capex the market is punishing at Amazon and Alphabet is Nvidia's revenue. Elevated-not-extreme IV → sell an ~8% OTM put spread, own upside through Dec debit spreads, small OTM call into its own print.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $190 / buy $180 · Nov 20 '26 · ~$1.52 credit (mid 3.05 − 1.53) · max loss/capital ~$848 · ~8.3% OTM cushion" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $210 / sell $230 · Dec 18 '26 · ~$7.08 net debit (mid 11.48 − 4.40) · cost/max loss ~$708 · max gain ~$1,292" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$220 call · Nov 20 '26 · ~$4.20 debit (4.15/4.25) · cost ~$420 · rebound + earnings run-up" },
    ] },
  { ticker: "XOM", name: "ExxonMobil", rank: 3, spot: "$186.17", sentiment: "Bullish",
    catalyst: "Q3 beat today (adj. EPS $4.23 vs $4.12), dividend raised to $1.07, $20B buyback · post-midterm Iran strike window (Nov 4+) · no earnings binary before Dec expiry",
    iv: "IV30 ~29% (Cboe) — moderate; Dec strikes ~28–30%",
    liq: "A — ~49k contracts & 10.9M shares in the first ~17 min today; OI 1.6k / 2.6k on Dec 175/165P, 6.7k / 18.0k on Dec 180/190C; legs 5.3–9.0% wide ($0.17 on the $1.89 leg) [Cboe delayed chain, Oct 30 ~9:40 ET]",
    thesis: "Up +1.6% on a down tape — refining now out-earns upstream, the buyback is $20B and WTI is back to ~$104 on strike-resumption reports. The market's cleanest earnings hedge; moderate IV → put credit spread ~6% below spot plus Dec call structures (Nov calls too wide early in the session).",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $175 / buy $165 · Dec 18 '26 · ~$2.46 credit (mid 4.35 − 1.89) · max loss/capital ~$754 · ~6.0% OTM" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $180 / sell $190 · Dec 18 '26 · ~$4.55 net debit (mid 9.40 − 4.85) · cost/max loss ~$455 · max gain ~$545" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$190 call · Dec 18 '26 · ~$4.85 debit (4.70/5.00) · cost ~$485 · oil-spike / strike-resumption upside" },
    ] },
  { ticker: "AMZN", name: "Amazon", rank: 4, spot: "$230.27", sentiment: "Neutral-to-Bullish",
    catalyst: "Post-earnings washout — Q3 miss, TTM FCF −$42.4B, 2026 capex kept at $220B · no binary before Dec expiry; holiday quarter ahead",
    iv: "IV30 ~32% (Cboe) — crushed post-print from ~45%; Nov ~33–34%, Dec ~31–33%",
    liq: "A — ~60k contracts & 4.2M shares in the first ~17 min today (~716k contracts Oct 27); OI 4.4k / 20.5k on Dec 230/250C, 13.8k / 11.5k on Dec 230/220P, 10.8k on Nov 240C; legs 4.3–7.7% wide [Cboe delayed chain, Oct 30 ~9:47 ET]",
    thesis: "−5.5% to ~$230 on the FCF scare — the third capex de-rating in two days. AWS demand isn't the problem; cash conversion is. Post-crush IV makes upside cheap → Dec call spread, an at-the-money put spread for a base near $225, small OTM call for a gap-fill.",
    ideas: [
      { profile: "Conservative", strategy: "Bull Call Debit Spread", text: "Buy $230 / sell $250 · Dec 18 '26 · ~$7.48 net debit (mid 11.65 − 4.17) · cost/max loss ~$748 · max gain ~$1,252" },
      { profile: "Moderate",     strategy: "Put Credit Spread", text: "Sell $230 / buy $220 · Dec 18 '26 · ~$4.20 credit (mid 10.03 − 5.83) · max loss/capital ~$580 · breakeven ~$225.80 — pays if the washout holds" },
      { profile: "Aggressive",   strategy: "Long Call (OTM)", text: "$240 call · Nov 20 '26 · ~$3.88 debit (3.75/4.00) · cost ~$388 · gap-fill toward $245" },
    ] },
  { ticker: "AMD", name: "Advanced Micro Devices", rank: 5, spot: "$508.99", sentiment: "Bullish",
    catalyst: "Q3 earnings — Tue Nov 3 (after close, Election Day) · BINARY · MI-series GPU ramp; −10% today resets the bar; Cohu Investor Day AMD keynote Nov 10",
    iv: "IV30 ~61% (Cboe); Nov strikes ~67–70% — HIGH, ~±10% implied move",
    liq: "A — ~16k contracts & 1.0M shares in the first ~17 min today (~500k contracts Oct 27); OI 19.2k / 11.4k on Nov 440/430P, 2.9k / 1.3k on Dec 550/570C, 3.8k / 1.35k on Nov 550/570C; legs 2.5–7.0% wide [Cboe delayed chain, Oct 30 ~9:47 ET]",
    thesis: "−10% to ~$509 into its own print on sector contagion (Intel's guide, AMZN's FCF), not AMD news. IV is high → no naked long premium: an ~14% OTM put credit spread harvests the vol and the post-earnings crush; OTM call spreads cap vega for a rebound.",
    ideas: [
      { profile: "Conservative", strategy: "Put Credit Spread", text: "Sell $440 / buy $430 · Nov 20 '26 · ~$1.77 credit (mid 7.82 − 6.05) · max loss/capital ~$823 · ~13.6% OTM, survives another post-earnings drop" },
      { profile: "Moderate",     strategy: "Bull Call Debit Spread", text: "Buy $550 / sell $570 · Dec 18 '26 · ~$6.02 net debit (mid 28.45 − 22.43) · cost/max loss ~$602 · max gain ~$1,398" },
      { profile: "Aggressive",   strategy: "Bull Call Debit Spread", text: "Buy $550 / sell $570 · Nov 20 '26 · ~$5.22 net debit (mid 17.90 − 12.68) · cost/max loss ~$522 · max gain ~$1,478 if AMD > $570 after earnings" },
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
// today line sits on the boundary between Oct 30 and Oct 31
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
            Snapshot <b style={{ color: "#e2e8f0" }}>Friday, Oct 30 2026</b> · window: last 3 days → next 2 weeks ·
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
                ▸ TODAY (Oct 30)
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
