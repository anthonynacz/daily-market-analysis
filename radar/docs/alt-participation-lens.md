# SUMMARY
Volume/participation/structure lens for the Momentum Radar, calibrated by replaying 221 liquid US stocks over 40 sessions (2026-07-31 to 2026-09-25) of Yahoo 5-minute bars. Baselines come only from prior sessions, so there is no look-ahead.
- A stock enters when a fast move in its SPY-residual price (15m z >= 2.5 or 30m z >= 3.0, and at least 1% in 30 minutes) comes with a volume surge adjusted for time of day (RVOL15 >= 2 and RVOLcum >= 1.2), sits on the right side of VWAP, prints a fresh HOD/LOD or breaks the opening range, and scores >= 70 on a 0-100 composite. The composite weights momentum 35, volume 30, structure 25 and persistence 10. A second lane (price-led, thin volume) needs z >= 4.0/4.5, a 1.5% move and RVOL15 >= 1.2.
- Members are refreshed on every closed bar. While a member, a stock is held by a hold score that tracks participation and how much of the move it keeps, not by the entry score. In replay the entry score falls from 76 to 43 within 4 ticks while RVOL stays around 2.5-3.7x.
- Hysteresis: entry at 70, RACING display at 55, soft fail below 45 for 3 ticks. Hard exits are 60% giveback, a counter bar with z <= -4 on RVOL >= 3, or 2 closes on the wrong side of VWAP. Stale exit: 8 bars without a new extreme while RVOL15 < 2. Other rules: minimum dwell 3 ticks, same-direction cooldown 30 minutes, at most 3 entries per symbol per day, cap of 20 members, all members out at 16:00.
- Measured on 221 names: 18.6 entries/day (p90 33), 3.2 members at a time on average (p95 9), median dwell 50 minutes (IQR 30-85), 10% flaps, exit drift about 0 (exits are not premature). Estimated for 600 names: 30-45 entries/day, 6-7 members at a time.
- Honest caveats: continuation after entry is a coin flip (48% hit). It catches 27% of fast races, about 4 bars after they start, because moves without volume are excluded by design. On the 2026-09-16 FOMC-type afternoon, sector beta leaked through (39 entries, 74% down).
- Key data facts: Yahoo's extended-hours 5-minute bars have zero volume. Intraday bar volume is 70-96% of consolidated volume. One tick costs about 25 s for 232 symbols (one HTTP request per symbol).

# RISKS
- Yahoo request volume: ~600 per-symbol chart calls every 5 min (~7,200/h) from shared GitHub Actions IPs may get rate-limited or blocked. The batched-quote two-tier fallback is designed but untested, and its volume source needs rescaling.
- The sector-relative gate and 4-per-sector cluster cap were never replayed (no sector map in the test). On the 2026-09-16 market-event day, SPY-only residuals let 39 same-direction entries through.
- Calibration used 221 liquid names. Production rates for ~600 symbols (30-45 entries/day, concurrent p95 ~18-20) are extrapolated. score_in may need re-bisection after the first live replay on the real universe.
- Continuation after entry is about 50% (members median -22 bp from entry to exit). If the UI implies trade signals, users could be misled, so strong educational wording is needed.
- Detection is structurally late (median 4 bars into a race), and recall of fast races is only 27% by design (moves without volume excluded). The user may expect the Radar to flag more of the day's big movers.
- Live-only behaviour could not be tested on a Sunday: how late and how partial Yahoo's forming 5m bar is, how often recent volumes get revised, and whether the 90 s closed-bar grace is enough.
- Halt detection from missing bars is heuristic. There is no keyless, verified halt feed in the design except the optional Nasdaq Trader RSS, which was not tested.
- Beta at 5-minute horizons clips at 0.3 for 26% of names and at 2.5 for 10%. High-beta names are under-hedged on crypto or market days, and a 15-minute-return beta is untested.

# Momentum Radar: signal model from the volume, participation and price-structure lens

This is the design phase only, so neither the repo nor the data branch was touched. The reference code (feature engine, replay and sweep harness) and the tuned parameters are scratch files under
`C:/Users/antho/AppData/Local/Temp/claude/C--Users-antho-Documents-Docs-Personal-claudemisc-misc-financial-marketanalysis/56584ef7-bc4e-44cf-adb0-c08f86caa6db/scratchpad/radar_design/vol_lens/`
(`fetch.py`, `features.py`, `build.py`, `replay.py`, `sweep.py`, `final_params.json`, `final_report.json`). Downloaded data is cached in `data/`.

Everything here is educational analysis, not financial advice. The Radar describes what is racing now. It does not forecast.

---

## 0. Evidence base (measured, not assumed)

**Replay setup.**
- **Universe:** 221 liquid US stocks (list in `fetch.py`). The 9 ETFs are used only as benchmarks.
- **Bars:** 60 sessions of Yahoo 5-minute regular-session bars (2026-07-02 to 2026-09-25) and 1 year of daily bars.
- **Baselines:** the first 20 sessions are used only for baselines and profiles.
- **Replayed:** the last 40 sessions (2026-07-31 to 2026-09-25), which is 3,120 ticks.
- **No look-ahead:** each feature uses only bars closed at the tick. Each baseline uses only prior sessions.

**Facts that shaped the design:**

| Measured fact | Consequence |
|---|---|
| Yahoo 5m **extended-hours bars have Volume = 0**. On 2026-09-25, AAPL, TSLA and SMCI each had 66 pre-market and 48 post-market bars, all with zero volume. | Pre/post RVOL cannot be computed. Extended hours are used for price only, as a display-only gap watch. Membership is regular session only. |
| The sum of regular 5m bar volume is **70-96% of the daily consolidated volume** (AAPL ~0.73, TSLA ~0.90, SMCI ~0.92, SPY 0.68-0.86). | RVOL must compare 5m bars with 5m-bar baselines from the same source. Dollar-volume floors on liquidity use daily bars. |
| Volume profile across the universe (median share of the day per slot): 09:30 bar 4.95%, 12:45 0.78%, 15:55 bar 10.6%. | Relative volume must be by time of day (per slot). |
| Volatility profile (median \|5m ret\| relative to the all-day mean): slot 0 4.27x, slot 1 2.56x, slot 2 2.26x, midday 0.72x, last three 0.84 / 1.06 / 1.34x. | z-scores must be normalized by time of day, otherwise the open floods the list and midday is starved. |
| Normalized residual z is well behaved: median \|zR15\| 0.64 (Gaussian 0.67), p99 3.5, p99.9 7.9. | Thresholds in sigma units carry over across symbols. |
| After entry, the median entry score goes 76, 69, 60, 52, 43, 37, 34 at +0 to +6 ticks. RVOL15 over the same ticks goes 3.5, 3.7, 3.7, 3.2, 2.8, 2.6, 2.5. | Price momentum decays within about 20 minutes but participation persists. Members are held by a hold score that tracks participation and retained move, not by the entry score. With the entry score as the hold rule, median dwell was only 30 minutes and drops were driven by window roll-off. |
| 30-minute forward residual return after entry: hit rate 48%, median -2 bp. No slice reached 53% (RVOLcum >= 3, gap-and-go, gap-fade, score >= 80, before 10:30, VWAP extension > 0.75 ATR). | The Radar is descriptive. No gap-and-go or news bonus is added to the score; those become tags. |
| Fetching one tick: `yf.download(232 syms, period=1d, interval=5m)` takes 22-25 s (one HTTP request per symbol). | About 60 s per tick for 600 symbols fits in 5 minutes, but it is about 7,200 requests an hour (see failure modes). |

---

## 1. Inputs per symbol

| ID | When | Call | Used for |
|---|---|---|---|
| T1 | Every tick (09:35 to 16:00 ET, 5-minute cadence) | `yf.download(tickers, period="1d", interval="5m", prepost=False, auto_adjust=False, group_by="ticker", threads=True)`, fetching the **full day each time** so Yahoo's volume revisions of recent bars are picked up | All intraday features |
| T1b | Every tick | Same call for the benchmarks SPY, QQQ, the 11 sector SPDRs (XLK XLF XLE XLV XLY XLP XLI XLB XLU XLRE XLC) and SMH | Residual returns, sector check, market regime |
| B1 | Once pre-open (08:45-09:25) | 5m regular bars for the **20 prior complete sessions** (`period="1mo"`, take the last 20) | vbar[slot], sigma_e, sigma_raw, beta |
| B2 | Once pre-open | Daily bars, 60 sessions | PC = previous official close, ATR14, ADDV20, PDH/PDL, split detection |
| B3 | 09:20 | 5m with `prepost=True`, **price only** | Pre-market gap watch (display only, never membership) |
| W1 | Weekly | Universe profiles U[slot] (volatility) and Vp[slot] (volume), from the prior 20 sessions | Time-of-day normalization |
| W2 | Weekly | Sector map (symbol to sector ETF), e.g. from yfinance `info["sector"]`, cached | Cluster cap, sector-relative check |

**Eligibility of history:** a symbol needs at least 15 of the 20 baseline sessions and a median of at least 70 bars per session. Otherwise it is ineligible for the day (new listings, IPOs, ticker changes; in the test SQ became XYZ and DFS merged).

---

## 2. Bar hygiene and session handling

- **Slots.** Slot k = 0..77, where bar k covers 09:30+5k to 09:35+5k ET. A "tick at k" means the decision made once bar k has closed.
- **Closed-bar rule.** A run at wall time `now` processes only bars with `start <= floor5(now - 90 s) - 5 min`. Yahoo returns the forming bar with partial volume, and that bar is always dropped. Schedule runs at about hh:m0:90 s / hh:m5:90 s.
- **Bar-driven, catch-up processing (determinism).** The state machine advances once per **closed bar**, not once per run. If a cron or runner delay skips ticks, the next run processes every missed slot in order (`for k in last_k+1 .. last_closed_k`). N-consecutive rules therefore count bars, and a late run gives the same result as on-time runs. Persist `{last_k, members, cooldowns, per-symbol entry counts}` after each run. If the persisted state is missing or corrupt, rebuild it by replaying bars 0..last_k (cheap: 600 x 78). Already published events are never retracted.
- **Missing bars.**
  - A missing bar between two present bars is filled flat: O=H=L=C = previous close, V=0. This matches the replay; in the test some less liquid names had 73-77 of 78 bars.
  - If a symbol's *latest* bar is missing while at least 90% of the universe has it:
    - If vbar[k] < 2,000 shares, treat it as a no-trade flat bar.
    - Otherwise treat it as data lag and **freeze** the symbol for that slot: no entry and no exit evaluation, counter `lag+=1`.
    - At lag >= 3, a member exits with reason `data_stale` and a non-member is skipped.
- **Halts (LULD or news).**
  - Detection: 2 or more consecutive missing bars at slots where vbar >= 20,000 shares while SPY has those bars. A missing tail that follows a bar with \|zR5\| >= 4 is flagged the same way.
  - The member's state becomes `HALTED`, and exit rules and dwell counters pause.
  - Windows are computed on the **compressed series of traded bars**, so halted slots contribute neither return nor variance. The resumption bar counts normally.
  - Optional confirmation: the Nasdaq Trader halts RSS (keyless).
- **Open.**
  - Slot 0 has its own unsmoothed baselines (vbar[0], U[0] = 4.3x). Return windows longer than the bars available anchor at today's open O_0, so the overnight gap is never inside a z-score.
  - The opening range is bars 0-2 (09:30-09:45), and OR-break features are valid from k=3.
  - The earliest entry is tick k=2 (09:45), with a stricter score (75). Standard rules apply from k=5 (10:00).
- **Close.** No entries after tick k=74 (15:45). At k=77 (the 15:55 bar closed, about 16:01:30) every member exits with `session_end`. There is no overnight carry, and each day starts empty.
- **Extended hours.** Not used for membership (volume is zero). B3 pre-market price feeds a display-only "pre-market gappers" block: \|premkt/PC - 1\| >= max(2%, 0.5*ATR%). Post-market is ignored.
- **Half days** (for example the day after Thanksgiving, 24 Dec): last slot 41 (12:55 bar). k_last = 38, session_end at k=41, detected from a holiday calendar.
- **Corporate actions.** If the daily bars show a split (close/PC ratio near 2, 3, 4, 1/2, 1/3, 1/10, or yfinance `splits`), the symbol is ineligible for 20 sessions, or baselines are rescaled by the split ratio.

---

## 3. Feature definitions (exact)

**Notation.** For symbol x on the current session: O_k, H_k, L_k, C_k, V_k are regular 5m bars and k is the slot. PC is the previous official close (daily). ATR = ATR14 (simple mean of true range over the 14 prior sessions). d = direction, +1 for up and -1 for down.

**Baselines** (computed pre-open from the prior 20 sessions only):
- Bar log return: rho_k = ln(C_k / C_{k-1}) for k >= 1, and rho_0 = ln(C_0 / O_0). The gap is excluded.
- **U[s]** (volatility by time of day, universe level):
  1. For each symbol, a_s = mean over 20 sessions of \|rho_s\|.
  2. Divide a_s by its mean over the 78 slots.
  3. U[s] = median across symbols.
- **beta** = cov(rho/U, rho_SPY/U) / var(rho_SPY/U) over all 20x78 bars, clipped to [0.3, 2.5]. It is set to 1 if there are fewer than 200 valid bars.
- Residual bar return: e_k = rho_k - beta*rho_SPY,k.
- **sigma_e** = 1.4826 * MAD(e/U) over the baseline bars. **sigma_raw** = 1.4826 * median(\|rho/U\|). Both are floored at 1e-4.
- **vbar[s]** = median over the 20 sessions of the 3-slot centred mean volume (V_{s-1}+V_s+V_{s+1})/3. Slots 0 and 77 are not smoothed. Floor: max(1, 0.02 * median session volume / 78).
- ADDV20 = median over 20 sessions of daily Close*Volume (consolidated). PDH/PDL = previous day high/low.

**Intraday features at tick k.** Windows of n bars cover i = max(0, k-n+1)..k. Bars that are halted or missing are compressed out as described in section 2.

| Feature | Formula |
|---|---|
| zR5, zR15, zR30 (n = 1, 3, 6) | sum(e_i) / (sigma_e * sqrt(sum U[i]^2)), residual vs SPY, adjusted for time of day |
| z15, z30 | Same, with rho_i and sigma_raw (raw, for display and for SPY regime) |
| rr30, rr5 | exp(sum e_i) - 1 (residual simple return) |
| r5, r15, r30 | exp(sum rho_i) - 1 (raw) |
| rDay | C_k/PC - 1 |
| rOpen | C_k/O_0 - 1 |
| gap | O_0/PC - 1 |
| gapATR | (O_0 - PC)/ATR |
| acc (display only) | (e_k - mean(e_{k-3..k-1})) / (sigma_e*U[k]). The mean uses the bars available, and acc is 0 at k=0. |
| RVOL5 | V_k / vbar[k] |
| RVOL15 | sum over the last 3 bars of V / sum over the last 3 bars of vbar |
| RVOLcum | sum_{0..k} V / sum_{0..k} vbar |
| DV15 | sum over the last 3 bars of C_i*V_i (5m-source dollars) |
| VWAP_k | sum(TP_i*V_i)/sum(V_i) with TP = (H+L+C)/3. VWAP_k = TP_k while sum(V) = 0. |
| dVWAP | (C_k - VWAP_k)/ATR |
| VWAPslope | ln(VWAP_k/VWAP_{k-3}) / (sigma_raw*sqrt(3)), with VWAP_{k-3} := VWAP_0 for k < 3 |
| HOD_{k-1}, LOD_{k-1} | max(H_0..H_{k-1}), min(L_0..L_{k-1}). At k=0 they are +inf and -inf. |
| newExt | Up: H_k >= HOD_{k-1}. Down: L_k <= LOD_{k-1}. (A new extreme was printed.) |
| barsSinceExt | k minus the last slot where newExt was true (99 if it never was) |
| ORH, ORL | max(H_0..H_2), min(L_0..L_2). ORbreak (k >= 3): up C_k > ORH, down C_k < ORL. |
| CLV | (C-L)/(H-L), or 0.5 if H = L. CLV_d = CLV for up, 1 - CLV for down. |
| nDir | Consecutive closes in direction d, where C_k vs C_{k-1} (O_0 for k=0) |
| gapFill | For \|gapATR\| >= 0.5: (O_0 - C_k)/(O_0 - PC) |
| PDbreak (tag) | Up: C_k > PDH. Down: C_k < PDL. |

Benchmark regime: z15 of SPY itself (raw) and z15 of each sector ETF.

---

## 4. Universe and liquidity filter

- Common stocks only. ETFs, ETNs and leveraged products are benchmarks only.
- Suggested universe: S&P 500 plus Nasdaq-100, plus tickers from recent report pages and the alerts watchlist, plus any symbol with a pre-market gap >= 4% (price >= $5), up to about 600 symbols.
- Filters (all must hold):
  - Price >= **$5**, both PC and current C_k.
  - **ADDV20 >= $20M** (daily consolidated).
  - Baseline completeness as in section 1.
  - Not ineligible for a split or IPO reason.
  - At entry: **DV15 >= $1.5M** (5m-source dollars in the last 15 minutes).
- No maximum ATR%. Very volatile names are handled by the sigma normalization.

---

## 5. Entry rule

It is evaluated at each tick k in [2, 74] for every eligible non-member, separately for d = +1 and d = -1.

**Common gates (both lanes):**
1. Not a member, fewer than 3 entries today for this symbol, and the cooldown is clear (section 8).
2. DV15 >= $1.5M.
3. On the right side of VWAP: d*(C_k - VWAP_k) > 0.
4. Structure: barsSinceExt <= 2 (a new HOD or LOD was printed in this bar or one of the last two) **or** ORbreak_d.
5. The last bar is not already turning: d*zR5 > -0.5.

**Lane A, volume-confirmed (87% of entries in the replay):**
- d*zR15 >= 2.5 **or** d*zR30 >= 3.0
- d*rr30 >= 1.0% (absolute floor on the residual move, so low-volatility names cannot enter on tiny moves)
- RVOL15 >= 2.0 **and** RVOLcum >= 1.2
- Score_d >= 70 (>= 75 for ticks k = 2..4)

**Lane B, price-led with thin participation (13% of entries):**
- d*zR15 >= 4.0 **or** d*zR30 >= 4.5
- d*rr30 >= 1.5%
- RVOL15 >= 1.2
- Score_d >= 70 (>= 75 for k = 2..4)

**Market-event bump:** if \|z15(SPY)\| >= 3, add +0.5 to every z threshold. Residualization already absorbs most of the market move, so in the replay this changed nothing measurable.

**Tested and dropped:** an "ignition bar" lane (zR5 >= 3.5, RVOL5 >= 4, move >= 0.6%, CLV_d >= 0.6, new extreme). It added about 5% more entries and did not improve recall or detection delay.

A new member is tagged with its lane: **VOL** (A) or **PX** (B).

---

## 6. Composite score (0-100, per direction)

```
M  = clip((max(d*zR15, d*zR30/1.2) - 1.5) / 3.0, 0, 1)                       # momentum
V  = 0.7*clip(log2(RVOL15)/3, 0, 1) + 0.3*clip(log2(RVOLcum)/2, 0, 1)        # participation (8x and 4x saturate)
S  = 0.25*[d*(C-VWAP) > 0] + 0.15*clip(d*dVWAP/0.25, 0, 1)
   + 0.25*[barsSinceExt <= 1] + 0.15*ORbreak_d + 0.20*CLV_d                  # structure
P  = 0.5*clip(nDir/4, 0, 1) + 0.5*[d*VWAPslope > 0.5]                        # persistence
Score_d = 100 * (0.35*M + 0.30*V + 0.25*S + 0.10*P)
```

The score is used for the entry gate, for ranking against the cap, and for the RACING state. Replay scores at entry: median 76. Scores >= 80 had a slightly better (not significant) 30-minute hit rate of 52% against 47% for scores < 70.

**Hold score** (members only):

```
retain = d*(C - anchor) / (d*(peak - anchor))   (0 if the denominator <= 0)
H = 100 * ( 0.35*clip((retain - 0.25)/0.5, 0, 1)
          + 0.30*clip(log2(RVOL15)/2, 0, 1)
          + 0.20*[d*(C-VWAP) > 0]*clip(d*dVWAP/0.25, 0.2, 1)
          + 0.15*clip(1 - barsSinceExt/8, 0, 1) )
```

- anchor is fixed at entry: the lowest low for up (highest high for down) of bars k-6..k. It is where the race started.
- peak is the running maximum high (minimum low) since entry, including the entry bar.

---

## 7. Refresh semantics and states

Every processed slot k does the following:
1. Recompute all section-3 features for **every** universe symbol from the full-day bars. This is vectorised and takes under 1 s for 600 x 78.
2. For each member:
   - update peak, retain, Score_d (member direction), H, the fail counter and the VWAP-wrong counter;
   - evaluate exits (section 8);
   - assign a state;
   - append a member-tick row.
3. Scan non-members for entries (section 5) and rank the candidates (section 9).

| State | Condition |
|---|---|
| **HEATING** (non-member, display only, at most 10) | Passes all common gates and Score_d >= 55, but fails one lane threshold (usually RVOL15 or z). No event is written, only the snapshot. This is the "about to race" row. |
| **RACING** (member) | Score_d >= 55 **and** barsSinceExt <= 2 |
| **COOLING** (member) | Member and not RACING. The page shows `fails n/3` and `bars since new high/low`. It returns to RACING when a new extreme prints with Score_d >= 55 (a second leg). |
| **HALTED** (member) | Halt suspected (section 2). Exit clocks are paused. |
| OUT | Exited, with a reason. The cooldown starts. |

**Tags** (labels only, never gates):
- `GAP-GO`: \|gapATR\| >= 0.5, same direction as d, gapFill < 0.25, ORbreak_d.
- `GAP-FADE`: race against the gap and gapFill >= 0.5.
- `GAP-FILLED`: C crossed PC.
- `OR-BREAK`, `PD-BREAK`.
- `NEWS?`: any bar in k-6..k with RVOL5 >= 5 and d*zR5 >= 4, or RVOLcum >= 3 before 10:30. For new entrants only (at most 5 per tick), optionally attach the newest `yfinance.Ticker(sym).news` headline from the last 24 h (title, publisher and time; never gated on).

**Member-tick row** (for the tables): `ts, sym, dir, state, lane, score, hold, price, rDay, rOpen, rr30, zR15, rvol15, rvolCum, dv15, dVWAP, barsSinceExt, fails, peak, anchor, retain, tags`.

**Event row:** `ts, sym, dir, type (ENTER/EXIT/RESUME), reason, score_at_event, price, dwell_ticks, lane`.

---

## 8. Exit rule (hysteresis) and cooldown

The checks run in order at each processed slot for each member. The first one that fires sets the reason.

1. `session_end`: k = 77 (or the half-day last slot).
2. `data_stale`: lag >= 3 slots.
3. **Hard exits** (dwell >= 1; there is no minimum beyond the entry bar):
   - `giveback`: d*(peak - C)/(d*(peak - anchor)) >= **0.60**.
   - `reversal_bar`: d*zR5 <= **-4.0** and RVOL5 >= **3.0** (a counter bar on high volume).
   - `vwap_lost`: **2 consecutive** closes with d*(C - VWAP) < 0.
4. **Soft exits** (only once dwell >= **3** ticks):
   - `stale`: barsSinceExt >= **8** (40 minutes without a new extreme) and RVOL15 < **2.0**.
   - `faded`: max(H, Score_d) < **45** for **3 consecutive** slots (the counter resets when the condition is false).
5. `evicted`: by the cap logic (section 9).

**Hysteresis summary:** entry needs Score >= 70; RACING display needs >= 55; a soft fail is max(H, Score) < 45 held for 15 minutes. Participation that stays at RVOL15 >= 2 keeps a consolidating racer listed. When volume dries up, the stale exit removes it after 40 minutes without a new extreme.

**Cooldown and re-entry:**
- After an exit in direction d:
  - no re-entry in d for **6 slots** (30 minutes);
  - no entry in -d for **3 slots**.
- The d cooldown is waived if C is beyond that member's last peak (a new session extreme past the prior race) with RVOL15 >= **3.0**.
- At most **3 entries per symbol per day**.

Measured: 14% of entries were re-entries, the median re-entry gap was 12.5 slots, and 92 of 652 symbol-days had more than one entry.

---

## 9. Caps, ranking and flood control

- **Cap: 20 members.** At most **5 new entries per slot**. Candidates are ranked by Score_d descending, with RVOL15 as the tie-break.
- When the Radar is full, a candidate replaces the lowest-scoring member only if its score is >= the weakest member's score + 10 **and** the weakest has dwell >= 3. The evicted member is logged as `evicted`.
- **Market-wide moves:** every gate uses the residual vs SPY with a 20-session beta, and the regime bump applies at \|z15(SPY)\| >= 3.
- **Sector clusters (recommended, not tested in the replay):**
  - (a) If the sector ETF's own z15 >= 2.5 in direction d, require an extra sector-relative gate: d*(zR15 recomputed vs the sector ETF, with beta_sector from the same 20 sessions) >= 1.5.
  - (b) Allow at most 4 members per sector. Further qualifiers are collapsed into a single "SECTOR RACE: XLF down, +N names" row, and no individual events are written for them.
- Why (b) is needed: on 2026-09-16, SPY z15 reached -13.7 at 14:55. The replay then produced 39 entries, 74% of them down, spread across airlines, banks and industrials (sector beta leaking through the SPY-only residual). This was the busiest day of the 40.
- Beta clipping: 26% of names sit at the 0.3 floor (low-beta names; the Epps effect at 5-minute horizons) and 10% at the 2.5 cap (MSTR, IONQ). High-beta names are therefore under-hedged on market or crypto days. Option: estimate beta on 15-minute returns and cap at 3.0.

---

## 10. Default parameters (tested set = `final_params.json`)

| Group | Parameters |
|---|---|
| Liquidity | price_min 5, addv_min 20e6, dv15_min 1.5e6 |
| Timing | k_first 2, k_std 5, k_last 74, open_score 75 |
| Lane A | z15_in 2.5, z30_in 3.0, abs30_in 1.0%, rvol15_in 2.0, rvolC_in 1.2, score_in 70, fresh_in 2 |
| Lane B | b_z15 4.0, b_z30 4.5, b_abs30 1.5%, b_rvol15 1.2, b_score 70 |
| Hold / exit | h_out 45, n_fail 3, min_dwell 3, giveback 0.60, rev_z5 -4.0, rev_rvol5 3.0, vwap_closes 2, stale_bars 8, stale_rvol 2.0 |
| Cooldown | cool_same 6, cool_opp 3, reentry_rvol 3.0, max_entries_day 3 |
| Caps | cap 20, max_new_tick 5, evict_margin 10 |
| Market | mkt_z15 3.0, mkt_bump 0.5 |
| Display | racing_score 55, heating_score 55, heating_max 10 |

---

## 11. Expected behaviour

**Measured on 221 liquid names over 40 sessions (FINAL set):**

| Metric | Value |
|---|---|
| Entries per day | mean 18.6, p90 33, max 39 |
| Unique symbols per day | 16 |
| Walk-forward halves | 15.6 and 22.5 entries per day; median dwell 10.5 and 10 slots |
| Concurrent members | mean 3.2, p95 9. About 2 at 09:45, peak about 5 from 10:00 to 11:00, about 2.5 after 13:00. |
| Entries by hour | 145 in 09:45-09:55 (3 ticks), 189 at 10:xx, then 98, 89, 66, 99, 76 |
| Dwell | median 10 slots (50 min), IQR 6-17 (30-85 min) |
| Flaps (dwell <= 2 slots) | 10% |
| Exit mix | stale 44%, reversal_bar 27%, giveback 11%, session_end 10%, vwap_lost 6%, faded 1.5% |
| Exit quality | 30-minute signed drift after exits ≈ 0 for every reason (hit 48-53%), so exits are not premature |
| Recall | 27% of "fast races" (30-minute residual move >= max(2%, 0.4*ATR%); 36 episodes a day in this universe). Precision 49%. Median detection 4 bars after the race's first bar. About 42% of a big day-move typically remains at entry. |
| Continuation | 30-minute forward hit 48%. Median residual move from entry to exit about -22 bp (members give back part of the move). This is the expected mean reversion of liquid names after bursts. The UI must not imply "buy". |

**Tradeoff sweep** (same exits, only score_in varied):

| score_in | Entries/day | Concurrent mean / p95 | Recall | Precision |
|---|---|---|---|---|
| 65 | 22.5 | 3.8 / 11 | 0.30 | 0.45 |
| **70** | **18.6-19.0** | **3.2 / 9** | **0.27** | **0.48** |
| 75 | 15.8 | 2.7 / 7 | 0.24 | 0.51 |

**Exit-design comparison** (score_in 65):
- The old momentum exit (score < 35-40, or z30 < 0.5-1.0 with z15 fading, or RVOL15 < 1): median dwell 6-7 slots, concurrent mean 2.0-2.6.
- Hold score with stale at 12 bars and RVOL 1.5: dwell 13 slots, concurrent mean 5.0, and 139 session-end exits (too sticky).
- Hold score with stale at 8 bars and RVOL 2.0: dwell 10 slots, concurrent mean 3.9. **Chosen.**

**Production targets (~600 symbols; the extra names are mostly lower-volatility large caps):**
- 25-45 entries per day (estimate about 30-45 at score_in 70).
- 4-12 concurrent members, p95 <= 20 (the cap).
- Median dwell 40-60 minutes.
- Flap share <= 12%, re-entry share <= 15%.
- \|median post-exit drift\| <= 5 bp.
- About 20% of entries in the first 15 minutes of eligibility is normal.

---

## 12. Replay-based calibration method

1. **Data.** `fetch.py`: 5m regular bars for 60 days (the Yahoo limit) and 1 year of daily bars, for the production universe, in chunks of 40. Drop tickers that fail (they are delisted or renamed).
2. **Cube.** `build.py`:
   - U/Vp profiles from sessions 1-20;
   - per symbol-day baselines from the 20 prior sessions;
   - features for every slot using bars 0..k only.

   Runtime was about 110 s for 221 x 40 sessions.
3. **State machine.** `replay.py`: exact section 5-9 logic, walking slots in order, including cap and cooldown.
4. **Metrics.** `sweep.py`:
   - entries per day (mean, p90), unique symbols, concurrency (mean, p95), dwell (median, IQR);
   - flap share, re-entry share, exit-reason mix;
   - post-exit 30-minute drift by reason;
   - recall, precision and detection delay against ex-post fast-race episodes;
   - entry 15/30-minute forward hit, reported only and never optimized.
5. **Knob order** (tune one at a time):
   1. liquidity floors, to fix the eligible universe;
   2. **score_in**, bisected to hit the entries-per-day target;
   3. **stale_bars / stale_rvol**, for the dwell target;
   4. cool_same / reentry_rvol, for flapping;
   5. rev_z5 / giveback, only if a post-exit drift is \|median\| > 5 bp in the *original* direction (which would mean exits are premature).
6. **Validation.** Walk forward: tune on replay sessions 1-20 and check 21-40. Accept a parameter change only if the targets hold in both halves.
7. **Recalibration.** Monthly, for example from the housekeeping job, re-run 3-6 on the latest 60 days. Write `radar_params.json` with a version, and put the params version in every event row.

---

## 13. Known failure modes

1. **Not predictive.** Entries continue about 50% of the time and members give back about 22 bp on median. Users may read the list as buy or sell signals, so the page needs persistent "describes, does not forecast" wording.
2. **Late by construction.** Median detection is 4 bars into a race, when about half of a typical 30-minute move is done. The ignition lane did not help.
3. **Recall gap on moves without volume.** About a third of fast races happen with RVOL15 < 2 (thematic high-beta drift). They are excluded, or only caught by Lane B at z >= 4. Lowering score_in to 65 raises recall only to 30%, at +20% entries.
4. **Sector and market beta leakage.** On FOMC-type afternoons there are dozens of same-direction entries. The mitigation (sector gate and cluster cap) is untested, and betas clip at 0.3 and 2.5.
5. **Opening noise.** About 19% of entries fall in the first 3 eligible ticks. RVOL there is inflated by opening-auction prints and gap stocks. It is controlled by open_score 75.
6. **Midday.** vbar denominators are small, so single block prints create RVOL spikes (weak evidence: 30-minute hit 47% for 10:30-14:00 entries). Option: +5 score between 11:30 and 13:30.
7. **Close.** 15:50/15:55 imbalance volume (10.6% of the day in the last bar) is handled by the per-slot baseline and the entry cut-off at 15:45.
8. **Yahoo data quality.**
   - Extended-hours volume is zero.
   - Intraday volume is not consolidated, so RVOL scales differ from broker screens.
   - The forming bar is partial and recent bars get revised.
   - Missing bars can mean no trades, a halt or data lag.
   - Tickers change (SQ became XYZ, DFS disappeared, X, MRO and CTRA are gone), so universe hygiene is needed.
9. **Rate limits.** One HTTP request per symbol per tick is about 7,200 requests an hour at 600 symbols, from shared GitHub Actions IPs. A 429 or IP block would stall the Radar. The two-tier fallback:
   - scan with a batched quote snapshot;
   - derive 5m volume from differences in cumulative volume, and new extremes from dayHigh/dayLow;
   - fetch full bars only for members plus the top about 60 prescreened symbols.

   This fallback is not tested, and it needs a per-symbol volume-source ratio of about 0.7-0.95.
10. **Baseline contamination.** Names in play for several days (memes, post-earnings) have raised 20-day median volume, so RVOL understates them. New listings have no baseline and are excluded for 15 sessions.
11. **Halts.** The heuristic detection can misfire on illiquid slots. The resumption bar can trigger a hard exit (a reversal bar) or an instant re-entry.
12. **Corporate actions and splits** distort share-volume baselines unless detected.
13. **Scheduling.** Cron delays are absorbed by bar-driven catch-up, but a catch-up of several bars can emit a burst of entries and exits at once. Their event timestamps must be the bar-close time, not the run time.