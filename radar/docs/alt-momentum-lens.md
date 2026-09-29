# SUMMARY
Momentum Radar signal model from the volatility-normalized momentum lens. I calibrated it by replaying real Yahoo 5-minute data: 240 liquid US names, 40 sessions (2026-07-31 to 2026-09-25), 218-232 of them eligible.

- **What it measures.** Each tick scores 15- and 30-minute returns in units of the stock's own 5-minute volatility. That volatility is adjusted for time of day (the first bar is about 5.2x as volatile as midday) and raised on news days using the day's own realized volatility. Returns are taken net of beta against SPY, QQQ or IWM so broad market moves do not flood the list. The score adds time-of-day relative volume, the day's move in daily-sigma units, VWAP side, acceleration and absolute size, giving a 0-100 score.
- **Entry.** A stock needs a residual z of at least 3 over 15 or 30 minutes, the raw price moving the same way by at least 0.75% in 30 minutes, at least 2x normal volume, a day move of at least 1 daily sigma in the same direction, the right side of VWAP, and a score of at least 60. It must qualify on two ticks in a row; a score of 75 or more lists it on the first tick.
- **States and exits.** Members move between RACING, HOT (score 85+), COOLING and PAUSED. Exits use hysteresis (maintain at 45, exit below 30 for 3 ticks), a 15-minute minimum dwell, a hard exit on reversal or giveback, VWAP-loss and stall exits, cooldowns, a cap of 3 members per sector cluster, and a market guard.
- **Replay result (standard preset, 232 symbols).** About 4.6 entries a day, roughly 2 per 100 symbols. Median time on the list is 30 minutes (IQR 20-60), 7% leave within 10 minutes, and the list is empty 66% of the time. All state counters are bar-indexed, so live runs and replays give the same result.
- **Forward returns.** Average continuation after listing was +22bp over 30 minutes with a 60% hit rate, but it depends on the market regime: one half of the sample was +53bp and the other -14bp. Only the score-85+ tier was positive in both halves. The radar describes what is moving now; it does not predict and is not advice.
- **Stress test.** A synthetic SPY drop of -2.4% in 30 minutes produced 0-3 entries with the index-relative model, against 5-14 with raw z-scores.
- **Data facts found.** Yahoo extended-hours 5-minute bars carry Volume=0, so the model uses the regular session only. Yahoo omits 5-minute bars with no trades, so the engine fills them flat.

# RISKS
- Continuation after listing is regime-dependent. Over 30 minutes it was +53bp (hit 67%) in Jul-Aug but -14bp (hit 49%) in Aug-Sep. Only the score-85+ tier was positive in both halves, and that is a small sample (about 34-46 episodes). The list must be framed as descriptive, not predictive.
- The replay uses final Yahoo bars. Live bars may have incomplete volume just after the bar closes and may be revised later, so live entries could come in below the replayed 4.6 per day. A 1-2 week shadow run comparing live against replay is needed before tuning.
- Latency stacks up: bar close, 20 s grace, Yahoo delay, GitHub Actions scheduling delay of 5-15 minutes, and 5 more minutes for two-tick confirmation below score 75. Many listings are late-stage (median day move at listing is about 6%).
- Fetch cost and rate limits for 600 symbols every 5 minutes via yfinance (one HTTP call per symbol) are not solved by this model. Yahoo 429 errors would freeze scans. The data layer needs member-first priority, universe slicing, and backoff or batching.
- The calibration sample (40 sessions, 2026-07-31 to 2026-09-25) had no large market selloff; SPY's largest daily move was +1.8%. Market-guard behaviour was checked only with a synthetic shock, so real crash days may still produce clusters of entries in the market's direction from beta error.
- A single-index residual does not remove sector or thematic moves (semis, healthcare, crypto proxies). A cluster cap of 3 is a display fix, and cluster assignment by highest ETF correlation can misclassify names with low R².
- Before 10:35 the news-day volatility blend is inactive, so earnings or gap stocks can still re-trigger early. The cooldown and a 3-episodes-per-day cap limit but do not eliminate this.
- The shock override path (E4'), the optional fast-path single-bar spike guard, and the cluster overflow row were not individually validated in replay.
- The list is empty on 55-76% of ticks depending on the preset (standard 66% on about 232 symbols). The user may see this as broken unless the UI shows scan heartbeat information; the user may prefer the Sensitive preset.
- Half-day, split-day and halt handling are specified but untested: the sample had no early close, and it was not checked whether halts appear as omitted bars in live Yahoo data.

# Momentum Radar signal model (lens: volatility-normalized price momentum and acceleration)

**What this is:** a deterministic, cheap signal model run every 5 minutes over 100-600 symbols. It decides which stocks are "racing" (up or down) right now, keeps them on the list while the move lasts, and removes them when it fades or reverses. It is educational analysis only, never trade advice.

**How it was calibrated:** by replaying real Yahoo 5-minute bars.
- Universe: 240 liquid US names plus benchmark ETFs; 218-232 were eligible per day.
- Replay window: 40 sessions, 2026-07-31 to 2026-09-25, with baselines always computed from earlier sessions only (walk-forward).
- A reference prototype is in `.../scratchpad/radar_design/volmom/`: `radar.py` (features and score), `replay.py` (state machine and metrics), `sigma_blend.py` (news-day volatility blend), `study.py` (event study), `stress.py` (market-shock test), `presets.py`.

---

## 0. Data facts measured (these drive several decisions)

| Fact (measured 2026-09-27 via yfinance 1.2.0) | Consequence |
|---|---|
| Yahoo 5-minute bars for pre-market (04:00-09:25) and post-market (16:00-19:55) exist, but **Volume = 0 on every bar** (checked AAPL, TSLA, NVDA on 2026-09-24/25). | Extended hours cannot give relative volume. **Signals use the regular session only.** Pre-market price is context only (the gap). |
| Yahoo **omits 5-minute bars that had no trades** (for example BIIB is missing 1-5 bars on many days). | Fill a missing bar flat: O=H=L=C = previous close, V = 0, and flag it `missing`. |
| The bar timestamp is the bar **start** (the 09:30 bar covers 09:30:00-09:34:59). There are 78 regular bars per day, `k = 0..77`. | Bar k is complete at `09:35 + 5k`. The in-progress bar must be dropped. |
| Intraday 5-minute return R² against the index is low: AAPL-SPY correlation is 0.36, NVDA-QQQ 0.60, QQQ-SPY 0.89. | One benchmark per stock is enough; hedging SPY and QQQ together is collinear. |
| Compute cost: baselines for 240 symbols take about 0.4 s per day; full-day features and score for all symbols take about 27 ms. | CPU is not a constraint; the data fetch is the only cost. |

---

## 1. Inputs required

### 1.1 Per tick (live), for every universe symbol plus SPY, QQQ, IWM
- **Bars:** today's regular-session 5-minute OHLCV from 09:30 up to the **last completed bar**.
  - Bar k is complete when `now_ET >= 09:35 + 5k + 20 s` (20-second grace so Yahoo finalizes the bar).
  - Drop any bar whose start is at or after `now - 5 min`.
  - Re-fetch the whole day each tick (it is only ~78 rows). Yahoo revisions of the previous bar, such as late volume, are then absorbed automatically.
- **Fetch priority:** current members and benchmarks first. If a fetch budget forces slicing, the rest of the universe can be scanned in two halves on alternate ticks, but members and benchmarks must be fetched every tick.
- **Minimum columns:** the model needs C and V per bar. H and L are used only for VWAP's typical price and for display flags. If a source only provides snapshots (last price and cumulative volume), set `TP = C` and derive `V_k` from the difference in cumulative volume.

### 1.2 Once per day, pre-open (for example at 09:00 ET), stored as a baseline table
- **Intraday history:** 5-minute regular-session bars for the **previous 20 full sessions** (yfinance `period="1mo", interval="5m", prepost=False`). Exclude half-days.
- **Daily history:** daily bars for about 3 months (`period="3mo", interval="1d"`), giving:
  - `prevC`, `prevH`, `prevL` = the last session's regular Close, High and Low.
  - `sigd` = standard deviation of the last 20 daily log close-to-close returns.
  - `ADV$` = 20-day median of Close × Volume.
- **Derived per symbol:** `u_k` (shared by all symbols), `sigma`, `sigmax`, `beta`, `bench`, `Ebar_k` and `cluster` (all defined in section 2). Persist them with a baseline version so a replay can reproduce any day.
- **Cluster ETFs** (used only for grouping, not per tick): XLK, XLF, XLE, XLV, XLY, XLI, XLC, XLP, XLU, XLB, XLRE, SMH, XBI, KRE. Adding IBIT is recommended to catch crypto-linked names.

### 1.3 Session calendar
- NYSE holidays and early closes (13:00 ET) must be hardcoded.
- On a half-day, `K = 42` and every "last bar" rule shifts accordingly.
- Half-days are excluded from baseline windows.

---

## 2. Features (exact formulas)

### 2.1 Notation
- Symbol s, today's bars `k = 0..K-1`, with O, H, L, C, V after the missing-bar fill.
- `ln` is the natural log.
- `clip01(x) = min(1, max(0, x))`.
- `d` is the direction, +1 (up) or -1 (down).
- All features at tick k use bars `0..k` only.

### 2.2 Bar returns and residual returns
- `lr_k = ln(C_k / C_{k-1})`, with `C_{-1} := O_0`.
  - So the first bar's return is open-to-close and **excludes the overnight gap**, which lives in `zday` and `gap = ln(O_0/prevC)`.
- Residual (index-relative) return: `lx_k = lr_k - beta_s * lr_k[bench_s]`.
- Windowed sums over the last n bars, truncated at the open (only bars `j >= 0`):
  - `R_n(k) = sum_{j=max(0,k-n+1)..k} lr_j`
  - `X_n(k)` is the same sum over `lx`.
  - n = 1, 3, 6 correspond to 5, 15 and 30 minutes.

### 2.3 Time-of-day volatility multiplier `u_k` (shared by all symbols, recomputed daily)
Steps:
1. For each symbol, compute `m_s` = winsorized RMS of `lr` over the 20 baseline sessions, bars `k = 12..65` (10:30-14:55).
2. Standardize: `e = lr / m_s`, clipped to ±8.
3. For each bucket k, compute each symbol's RMS of e across sessions. `u_k` is the cross-symbol **median** of those values.
4. Normalize so that `median(u_12..u_65) = 1`.

Measured values:

| Time | 09:30 | 09:35 | 09:40 | 09:45 | 09:50 | 10:00 | 10:30 | 11:00 | 11:30 | 12:00 | 13:00 | 14:00 | 15:00 | 15:30 | 15:50 | 15:55 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `u_k` | 5.18 | 3.71 | 3.24 | 2.91 | 2.53 | 2.43 | 1.71 | 1.53 | 1.28 | 1.18 | 1.00 | 1.05 | 0.98 | 1.16 | 1.53 | 1.77 |

### 2.4 Symbol volatility (per 5-minute bar, de-seasonalized)
- `e_{s,d,k} = lr / u_k` over the **last 10 sessions**.
- `mad = 1.4826 * median|e|`.
- `sigma_s = sqrt(mean(clip(e, ±5*mad)^2))`, with a floor of 0.04%.
  - Measured distribution: 5th/50th/95th percentiles are 0.07%, 0.14% and 0.30%. Examples: KO 0.073%, AAPL 0.090%, TSLA 0.163%, MSTR 0.32%.
- `sigmax_s` is the same calculation on `lx`, with a floor of 0.03%. Typically `sigmax/sigma` is about 0.94.
- **News-day blend (default ON):**
  - `sigma_today(s,k) = sqrt(mean_{j=0..k-6} (lx_j/u_j)^2)`. It excludes the current 30-minute window and requires `k-6 >= 11`, so it applies from the 10:35 bar onward.
  - `sigma_eff(s,k) = max(sigmax_s, 0.7 * sigma_today(s,k))`. Before 10:35, `sigma_eff = sigmax_s`.
  - Replay effect: entries fell from 5.8 to 4.6 per day, and repeated episodes on the same symbol and day fell from 38 to 17. Forward quality was unchanged (30-minute continuation +22.5bp vs +22.8bp).

### 2.5 Beta and benchmark (20 sessions, bars `k >= 1`, returns winsorized at ±5%)
- Compute OLS beta and R² of the symbol's `lr` against each of SPY, QQQ and IWM.
- `bench` = SPY, unless QQQ or IWM has an R² higher by more than 0.02.
  - Measured split: SPY 132 symbols, IWM 67, QQQ 41.
- `beta = clip(0.8*beta_ols + 0.2*1.0, 0, 3)`. The 5th/50th/95th percentiles were 0.28, 0.92 and 2.0.

### 2.6 Multi-horizon z-scores
- `U_n(k) = sum over the same truncated window of u_j^2`.
- Raw z: `z_n = R_n / (sigma_s * sqrt(U_n))`.
- Residual z: `zx_n = X_n / (sigma_eff * sqrt(U_n))`, for n = 1, 3, 6.
- **Tail frequency check** (per symbol-tick): `P(|zx3| > 2.5) = 2.6%`, `P(|zx3| > 3) = 1.3%`, `P(|zx3| > 4) = 0.4%`, standard deviation 1.06. The normalization is well calibrated.

### 2.7 Day move
- `zday = ln(C_k / prevC) / sigd`.
- `ret_day = C_k/prevC - 1`.
- `gap = ln(O_0/prevC)`, display only.

### 2.8 Relative volume by time of day
- `Ebar_{s,k}` = median of `V_{s,k}` over the 20 baseline sessions, floored at 1 share.
- `rv3 = sum V_{k-2..k} / sum Ebar_{k-2..k}` (15 minutes).
- `rv6` is the same over 6 bars.
- `rvday = cumsum V_{0..k} / cumsum Ebar_{0..k}`.
- Measured `rv3` percentiles 50/90/95/99: 1.13, 2.28, 2.96, 5.32.

### 2.9 VWAP distance
- `TP = (H+L+C)/3`.
- `VWAP_k = sum(TP*V)/sum V` over bars 0..k. If cumulative V is 0, `VWAP = C`.
- `dv = ln(C_k/VWAP_k) / (sigma_s * sqrt(sum_{j<=k} u_j^2))`, in session-sigma units.

### 2.10 Acceleration
- `acc = (X3(k) - X3(k-3)) / (sigma_eff * sqrt(U_6(k)))`.
- It measures the change in the 15-minute residual return versus the previous 15 minutes. `X3(k-3) := 0` when `k-3 < 0`.

### 2.11 Persistence (computed and displayed as "trend quality", NOT gated)
- `cnt`: signed count of consecutive bars with the same sign of `lr`.
- `ER6 = |R6| / sum_{last 6} |lr_j|`, the efficiency ratio.
- In the replay, persistence **did not improve continuation**. With `zx6 >= 3` and `rv3 >= 2`, ER6 >= 0.7 gave +1.6bp over 30 minutes versus +9.8bp for ER6 < 0.7. Persistence is therefore used only through the stall exit (section 6).

### 2.12 Structure flags
- `hod`: `C_k > max(H_0..H_{k-1})`. `lod` is the mirror. Display only.
- `pdh`: `C_k > prevH`. `pdl`: `C_k < prevL`.

### 2.13 Market features (per tick)
- `z6` of SPY and QQQ (raw).
- `breadth_up` = share of eligible symbols with raw `z6 >= +2`.
- `breadth_dn` = share with raw `z6 <= -2`.

### 2.14 Edge cases
| Case | Rule |
|---|---|
| First bars after the open | Windows are truncated at the open and `U_n` sums only the included bars, so z stays calibrated. **The first entry decision is after bar k=2 (tick 09:45:20).** No opening penalty: the replay showed the best continuation in 09:45-10:30 (`zx6 >= 3` and `rv3 >= 2`: +25bp over 30 minutes, 54% hit). |
| Missing (zero-trade) bar | Fill flat, V=0, flag `missing`. No new entry if any of the last 3 bars is missing. A member with a missing bar goes to PAUSED (section 5). |
| Halt (LULD or news) | Shows up as consecutive missing bars. 1-2 missing bars: PAUSED, exits frozen except session close. 3 or more: exit with `no_data`. After the halt, the reopen bar is treated normally, and the two-tick confirmation absorbs the reopen gap. |
| Extended hours | Not used for signals because Yahoo reports no volume there. The engine does not run after 16:00. |
| Split or corporate action day | If the daily feed shows a split, or `abs(gap) > 35%` with no matching move in the 5-minute data, exclude the symbol for the day (`prevC` would be inconsistent). |
| Late or skipped ticks (Actions delay) | The engine processes every completed bar **in order** (catch-up loop). All counters are bar-indexed, so output is identical to a replay. Entries created during catch-up more than 10 minutes after the bar closed are marked `late=true`. |
| Half-day | K=42. The last entry bar is 12:35 (decision at 12:40). Session-close exit runs after the 12:55 bar. |

---

## 3. Universe and liquidity filter (evaluated pre-open, fixed for the day)
- Common stocks and ADRs only. ETFs, ETNs and leveraged products are reference-only: SPY, QQQ, IWM and DIA are shown in the market banner, never listed.
- `prevC >= $5`.
- `ADV$` (20-day median dollar volume) `>= $20M`. That is about $256k per 5-minute bar on average.
- At least 15 of the 20 baseline sessions present, and missing (zero-trade) 5-minute bars at most 2% of baseline bars.
- `0.04% <= sigma_s <= 1.5%` per 5 minutes. The upper bound rejects broken or penny-like series.
- No split or corporate action today.

---

## 4. Entry rule and composite score

### 4.1 Composite score, 0-100 (weights informed by the event study; see section 8)
```
zsp     = max(d*zx3, d*zx6)
Speed   (30) = 30 * clip01((zsp - 2.0) / 3.0)                       # z 2 -> 0 pts, z 5 -> 30
InPlay  (20) = 20 * clip01((d*zday - 1.0) / 3.0)                    # 1 daily sigma -> 0, 4 -> 20
Volume  (25) = 15 * clip01(ln(rv3/1.5) / ln 4) + 10 * clip01(ln(rvday) / ln 4)
Size    (10) = 10 * clip01((d*R6 - 0.005) / 0.025)                  # 0.5% in 30 min -> 0, 3% -> 10
Accel   (10) = 10 * clip01(d*acc / 2.5)
Struct   (5) =  3 * clip01(d*dv / 2) + 2 * [pdh if d>0 else pdl]
score = sum (NaN -> 0)
```

### 4.2 Entry gates (all required, direction d; both directions are evaluated each tick)
| # | Gate | Default |
|---|---|---|
| E1 | Speed (index-relative, vol-normalized): `max(d*zx3, d*zx6) >=` | **3.0** |
| E2 | The raw price also moves: `d*z6 >=` 1.5 **and** `d*R6 >=` | **0.75%** |
| E3 | Volume confirmation: `rv3 >=` | **2.0** |
| E4 | In play in this direction: `d*zday >=` | **1.0** |
| E4' | Shock override (replaces E4 only): `d*zx3 >= 5` and `rv3 >= 4` and `d*R3 >= 1.0%`. It can never use the fast path. | on |
| E5 | Right side of VWAP: `d*dv >` | **0** |
| E6 | `score >=` SCORE_IN (+10 while the market guard is on) | **60** |
| E7 | Tick window: bar k in [2, 73], i.e. decisions 09:45-15:40. Eligible symbol, no missing bar in the last 3. | |

### 4.3 Confirmation (anti-flap)
- A symbol that passes E1-E7 at tick k becomes **HEATING**, an on-deck candidate. It is not a list member and can be shown in a small "heating up" strip.
- It is **listed as RACING at tick k+1** if it passes E1-E7 again.
- **Fast path:** if `score >= 75` at tick k (85 while the market guard is on), it is listed immediately at tick k.
- A HEATING symbol that fails at k+1 is dropped with no cooldown.
- Replay evidence:
  - Listing on the first qualification gave a 16% flap rate (out within 10 minutes).
  - Two-tick confirmation gave 5-7%, with better continuation after listing (+15 vs +3bp over 30 minutes).
  - Disabling the fast path cut 15-minute continuation from +13 to +2bp. Speed matters for the strongest movers.

---

## 5. Refresh semantics and member states

Each tick recomputes **every feature for every eligible symbol**; it is vectorized and costs about 30 ms. There is no separate member pipeline. For members, the engine additionally updates:
- `peak`: the best close since listing (max for up, min for down).
- `last_ext_bar`: the bar of the last new peak.
- `mfe`: the best move since listing.
- `move_since_entry`.
- Counters: `low_score_ticks`, `vwap_wrong_ticks`, `missing_ticks`, `ticks_listed`.
- `giveback = d*ln(peak/C_k) / (sigma_eff * sqrt(U_6))`, in sigma units.

States (member score is always computed in the member's direction d):
| State | Condition |
|---|---|
| HEATING | Qualified once and not yet confirmed. On deck, not a member. |
| RACING | Listed, `score >= 45` and `d*zx3 >= 1.0`. |
| HOT | A RACING member with `score >= 85`. Display emphasis only. In replay, entries at 85+ gave +110bp over 30 minutes with an 82% hit rate (n=34). |
| COOLING | Listed, but `score < 45` or `d*zx3 < 1.0`. Shown amber. It returns to RACING when `score >= 60` **and** a new peak close is made. |
| PAUSED | Listed, and the current bar is missing (possible halt). Exits X2-X6 are frozen. |

---

## 6. Exit rule, hysteresis and cooldown (evaluated in this order each tick)

| # | Exit | Rule | Dwell-protected? |
|---|---|---|---|
| X0 | Session close | After bar 77 (the 16:00:20 tick), every member exits with `session_close`. Nothing carries overnight. | no |
| X1 | No data or halted | 3 consecutive missing bars | no |
| X2 | Reversed | `d*zx3 <= -2.0`, a 2-sigma counter-move over 15 minutes | no |
| X3 | Gave back | `giveback >= 3.0` sigma from the peak close since listing | no |
| X4 | Faded | `score < 30` on 3 consecutive ticks | yes |
| X5 | Lost VWAP | `d*dv < 0` on 2 consecutive ticks | yes |
| X6 | Stalled | No new peak close for 6 ticks (30 minutes) **and** `d*zx6 < 1.5` | yes |
| X7 | Displaced | See caps (section 7) | no |

- **Minimum dwell:** 3 ticks (15 minutes) after listing before X4-X6 can fire.
- **Hysteresis:**
  - Entry needs `zx >= 3` and `score >= 60`.
  - The member stays RACING while `score >= 45` and `zx3 >= 1.0`.
  - It exits only below `score 30` for 3 ticks, or on a real reversal.
- **Check that exits are not premature:** the direction-adjusted return in the 30 minutes after an exit was -9.6bp, so stocks tend to keep reversing after they leave.
  - Tightening giveback to 2.0 sigma turned that into +1.4bp (exiting too early), so 3.0 is kept.
  - Replay exit mix: reversed 29%, stalled 28%, gave back 22%, faded 18%, session close 3%, lost VWAP 1%.
- **Re-entry cooldown:**
  - Same direction: blocked for 6 ticks (30 minutes), **unless** `score >= 80` and the price is beyond the previous episode's peak (a breakout continuation).
  - Opposite direction: blocked for 3 ticks unless `score >= 70`.
  - At most 3 episodes per symbol per day.

---

## 7. Caps, ranking and flood control
- **MAX_MEMBERS = 15** and **MAX_NEW_PER_TICK = 5**, taking the top candidates by score.
  - Replay on 232 symbols: the list maximum was 5.
  - Scaling to 600 symbols suggests typically 0-4 members and about 12 at the peak, so the cap rarely binds.
- **Full list:** a candidate displaces the lowest-score COOLING member only if its score is at least 10 higher. Otherwise it stays HEATING.
- **Cluster cap = 3 members per cluster**, where the cluster is the ETF with the highest 5-minute return correlation over the 20 baseline sessions.
  - Extra members of a saturated cluster are not listed and are summarized in one row, for example "SMH cluster racing: +4 more".
  - Example: healthcare (HUM, CI, CVS) raced together on 2026-09-25.
- **Ranking:** HOT first, then RACING by score (descending), then COOLING by score.
- **Market guard:**
  - `MKT = |z6(SPY)| >= 2.5 or |z6(QQQ)| >= 2.5 or max(breadth_up, breadth_dn) >= 0.25`.
  - While it is on: SCORE_IN rises to 70, the fast path needs 85, and a banner row shows the SPY/QQQ 30-minute move.
  - The index-relative gate E1 plus the raw-move gate E2 do the heavy lifting.
- **Synthetic shock test:** SPY -2.4% in 30 minutes at noon, with every stock's true beta perturbed ±40% and volume ×3.
  - Index-relative engine: 0, 1 and 3 entries on three test days.
  - Raw-z engine: 5, 5 and 14 entries; the list hit the 12 cap.
  - The guard was on for 1.5% of ticks in the (calm) sample.

---

## 8. Expected behaviour and calibration

### 8.1 Replay results
Standard preset with the sigma blend, 40 sessions, 218-232 eligible symbols:

| Metric | Value |
|---|---|
| Entries per day | **4.6** (min 0, p90 9, max 11), about 2.0 per 100 symbols. For 600 symbols, expect about 12 per day. |
| Fast-path share | 57% |
| Entries by time of day | 09:45-10:30 36%, 10:30-12:00 19%, 12:00-14:00 24%, 14:00-15:40 21% |
| Dwell | median **30 min**, IQR 20-60 |
| Flap (exit within 10 min) | 7% |
| List size | mean 0.5, p90 2, max 5. **Empty on 66% of ticks.** |
| Typical move at listing | median 30-minute move about 2.3%, median day move about 6% |
| Direction-adjusted forward return from listing | +16bp at 15 min, **+22.5bp at 30 min (hit 60%)**, +30bp at 60 min |
| By entry score | 60-75: +8.7bp, hit 57%. 75-85: -3.9bp, hit 52%. **85+: +110bp, hit 82%.** |
| Stability | **Regime-dependent.** Without the blend, the first half was +53bp (hit 67%) and the second half -14bp (hit 49%). Only the 85+ tier was positive in both halves. |

**Presets** (same replay; SCORE_IN / fast path / MINMOVE / RV3):

| Preset | Settings | Entries/day | Dwell median | List mean / max | Empty ticks | Forward 30 min (hit) |
|---|---|---|---|---|---|---|
| Conservative | 70 / 80 / 1.0% / 2.0 | 2.6 | 40 min | 0.3 / 4 | 76% | +50bp (71%) |
| **Standard** | 60 / 75 / 0.75% / 2.0 | 4.6 | 30 min | 0.5 / 5 | 66% | +22bp (60%) |
| Sensitive | 50 / 70 / 0.5% / 1.5 | 7.7 | 30 min | 0.8 / 9 | 55% | +11bp (52%) |

**Behaviour targets to hold after any retune:**
- 1.5-3 entries per 100 symbols per day.
- Median dwell 25-45 minutes.
- Flap rate at most 10%.
- Post-exit 30-minute continuation at most 0.
- At most 1 multi-episode symbol-day per 100 symbols per week.
- With the synthetic shock, at most 3 entries in the shock window.

### 8.2 Event-study evidence behind the gates
Sample: 29,349 symbol-ticks with `|zx6| >= 2`; direction-adjusted residual return over the next 30 minutes.
- Moves toward the wrong side of VWAP (`dv < 0`, `zx6 >= 3`): **-11.5bp**, i.e. they revert. This supports gate E5.
- Counter-day moves (`zday <= 0.5`): -4bp at 60 minutes. This supports gate E4. The E4' override exists only for true shocks, which showed a flat edge (+9bp, hit 48%).
- `zday >= 3` with `rvday >= 2`: +14bp. `rv3 >= 5`: +9bp. `zx6 >= 5`: +8bp. Midday `zx6 >= 3` alone: -0.9bp. The size and volume gates are what matter at midday.
- Opening window: the strongest continuation (above), so there is no opening penalty.

### 8.3 Replay calibration method (to implement as `radar_replay.py`, sharing code with the live engine)
1. **Data:** Yahoo 5-minute regular-session bars (`period=60d`, the maximum) plus 1 year of daily bars for the configured universe and benchmarks. Build `(symbol, session, bar)` arrays and apply the missing-bar fill.
2. **Walk-forward:** for each session d with at least 20 prior sessions, compute baselines from sessions before d only. Then run the **same** per-bar state machine as live, with the decision at the bar close.
3. **Log every event:** ENTER, STATE change, EXIT with reason, plus features.
4. **Compute:**
   - Entries per day (mean, p10, p90) and per 100 symbols.
   - List-size distribution and share of empty ticks.
   - Dwell distribution, flap rate, share of HEATING that is never confirmed, and exit-reason mix.
   - Time-of-day mix, cluster concentration and market-guard share.
   - Direction-adjusted forward raw and residual return at 15, 30 and 60 minutes from listing, and hit rate by score tier.
   - Post-exit 30-minute continuation, MFE, and the split-half comparison.
5. **Tuning order:**
   1. SCORE_IN sets the rate (monotonic: 50 gives 7.7/day, 60 gives 4.6, 70 gives 2.6 on about 232 symbols).
   2. Exit parameters set dwell and flap.
   3. Check that post-exit continuation is at most 0.
   4. Run the shock test.
   5. Accept only if the section 8.1 targets hold in **both** halves. **Never tune on forward returns alone**: they swing with the regime.
6. **Recalibrate** monthly, or when the universe changes by more than 20%. Freeze parameters in a versioned `radar_params.json` and stamp `params_version` and `baseline_version` on every snapshot.
7. **Before go-live:** run shadow mode for 1-2 weeks, and compare the live list with the replay of the same days to measure the effect of latency and bar revisions.

---

## 9. Known failure modes
1. **It is not predictive.** Short-horizon momentum in liquid US stocks tends to mean-revert. Continuation after listing flips sign between regimes, and the median episode ends slightly below its listing price (median captured -0.1% to -0.2%) even though mean MFE is positive. The UI must present the list as "moving abnormally now", with no buy or sell wording.
2. **Detection lag.** A listing comes at least 5 minutes after the move starts (bar close), plus 20 seconds of grace, Yahoo latency, and Actions delays of 5-15 minutes. Two-tick confirmation adds another 5 minutes for scores under 75. Many listings are late-stage: the median day move at listing is about 6%.
3. **News and earnings days.** A 10-session sigma understates the day's volatility. This is mitigated by the sigma blend from 10:35 and by the cooldown and episode cap, but before 10:35 an earnings stock can re-trigger. Recurring names in replay: DKNG, GME, FSLR, SMCI, MRNA.
4. **Sector and thematic moves are not removed by a single-index residual** (semis, healthcare policy, crypto proxies with beta 2+ but R² about 0.1). The cluster cap keeps the list readable, but the "story" is the cluster.
5. **Beta error** on high-beta or low-R² names leaves part of a market move in the residual. Gate E2 and the market guard limit this, but on a violent tape (VIX spike) expect more entries in the same direction as the market.
6. **Data quality.**
   - Omitted bars look like calm (V=0).
   - The latest bar's volume may be incomplete in real time, so live `rv3` is lower than replay and live entries are fewer.
   - Bad prints can create single-bar spikes. Two-tick confirmation filters most of them; a single-bar spike can still pass the fast path. Optional untested guard: require `|R1| <= 0.8*|R3|` or `V_k >= 3*Ebar_k` for the fast path.
7. **Session edges.** Nothing is listed before 09:45, so 09:30-09:45 gap-and-go moves appear late. Pre-market cannot be used (no volume). No entries after 15:40, so MOC-imbalance moves are ignored, and everything is flushed at 16:00.
8. **Halts.** A halted stock is frozen in PAUSED; LULD pauses of 5 minutes or more are common exactly for racing names. Resumption gaps can trigger X2 or X3 immediately.
9. **Quiet markets.** The list is empty on 55-76% of ticks depending on the preset. The UI should say "No stocks racing: last scan 10:35 ET, N symbols checked" so it does not look broken.
10. **Low-volatility names** need very large z to clear the 0.75% absolute floor (for KO, 0.75% in 30 minutes is about 4.4 sigma at midday). This is by design: they are rarely "racing" for an individual investor.
11. **Stale baselines** after regime shifts: sigma lags about 2 weeks and beta about 4 weeks.
12. **Rate limits.** 600 symbols every 5 minutes through yfinance means many HTTP calls, and Yahoo 429 errors would freeze the scan. This must be handled by the data layer (member-first priority, alternate-tick halves, backoff).

---

## 10. Default parameters (`radar_params.json`)
```json
{
  "params_version": "vm-1.0",
  "bars": {"interval_min": 5, "grace_s": 20, "first_entry_bar": 2, "last_entry_bar": 73, "session_close_bar": 77, "half_day_bars": 42},
  "baseline": {"vol_sessions": 10, "beta_sessions": 20, "volume_sessions": 20, "u_mid_bars": [12, 65],
               "winsor_mad": 5, "sigma_floor": 0.0004, "sigmax_floor": 0.0003, "beta_shrink": 0.2, "beta_clip": [0, 3],
               "bench_candidates": ["SPY", "QQQ", "IWM"], "bench_r2_margin": 0.02,
               "sigma_today_lambda": 0.7, "sigma_today_min_bars": 12, "sigma_today_exclude_last": 6},
  "universe": {"price_min": 5, "adv_usd_min": 20000000, "min_baseline_sessions": 15, "max_missing_bar_frac": 0.02,
               "sigma_max": 0.015, "gap_split_guard": 0.35},
  "entry": {"z_speed": 3.0, "raw_z6": 1.5, "min_move_30m": 0.0075, "rv15_min": 2.0, "zday_min": 1.0,
            "shock_zx3": 5.0, "shock_rv15": 4.0, "shock_r15": 0.01,
            "score_in": 60, "score_fast": 75, "score_hot": 85, "confirm_ticks": 2},
  "maintain": {"cool_score": 45, "cool_zx3": 1.0, "rerace_score": 60},
  "exit": {"exit_score": 30, "exit_ticks": 3, "min_dwell_ticks": 3, "giveback_z": 3.0, "reversal_zx3": -2.0,
           "vwap_ticks": 2, "stale_ticks": 6, "stale_zx6": 1.5, "nodata_ticks": 3},
  "cooldown": {"same_dir_ticks": 6, "opp_dir_ticks": 3, "reentry_score": 80, "opp_score": 70, "max_episodes_per_day": 3},
  "caps": {"max_members": 15, "max_new_per_tick": 5, "cluster_cap": 3, "displace_margin": 10},
  "market": {"mkt_z6": 2.5, "breadth_z": 2.0, "breadth_share": 0.25, "score_bump": 10, "fast_when_mkt": 85},
  "score_weights": {"speed": 30, "inplay": 20, "vol15": 15, "volday": 10, "size": 10, "accel": 10, "vwap": 3, "prior_day_break": 2}
}
```

## 11. Per-tick algorithm (pseudo-code)
```
tick():                                         # woken at hh:m0:20 / hh:m5:20 ET
  bars = fetch_today_5m(members + benchmarks first, then universe)
  k_last = last complete bar index
  for k in state.last_bar+1 .. k_last:          # catch-up keeps everything bar-indexed and deterministic
      F = features(bars[0..k], baseline)        # vectorised over all symbols (section 2)
      mkt = market_guard(F, k)
      for m in members: refresh(m, F, k); apply exits X0..X6 in order; update state (section 5)
      if 2 <= k <= 73:
          Q = {(s,d) : gates E1..E7 pass}       # both directions
          new = [(s,d) in Q if (s,d) in state.heating or score >= fast(mkt)] minus cooldown/episode blocks
          add top-by-score subject to caps, cluster cap, displacement (section 7); state.heating = Q - new
      state.last_bar = k
  if k_last == close_bar: exit all (session_close)
  persist(state, list snapshot, event log)      # members, heating, cooldowns, episode counts, last_bar
```

## 12. Fields per member row (for the storage/UI agents)
- Identity and state: `symbol, dir (UP/DOWN), state (RACING/HOT/COOLING/PAUSED), score`.
- Listing: `listed_at` (ET, bar end), `listed_price`, `last_price`, `move_since_listed_pct`, `peak_price`, `giveback_sigma`, `ticks_listed`, `late`.
- Moves: `day_move_pct`, `r15_pct`, `r30_pct`, `zx15`, `zx30`, `z30_raw`, `rv15`, `rv_day`, `vwap_dist_pct`, `accel`.
- Trend quality: `trend_quality` (`ER6` and consecutive bars).
- Context: `cluster`, `bench`, `beta`, `mkt_guard`, and on exit `exit_reason`.
- Event log rows: `ts, symbol, event (HEATING/ENTER/STATE/EXIT), dir, score, reason, price, params_version`.