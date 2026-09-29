"""Momentum Radar parameters. Changing a signal parameter means bumping PARAMS['params_version'].

Signal defaults come from the replay calibration in radar/SPEC.md section 5 (39 sessions, Aug-Sep 2026):
about 5-7 entries per session on ~500 names, 58% of entries still moving the same way (vs SPY)
30 minutes later, median 40 minutes on the radar. The intensity score ranks and displays; it is
not a probability and must never be presented as confidence.
"""
from __future__ import annotations

REPO = "anthonynacz/daily-market-analysis"
DATA_BRANCH = "data"
REFERENCE_SYMBOLS = ("SPY", "QQQ", "IWM")
US_EXCHANGES = ("NMS", "NGM", "NCM", "NYQ", "ASE", "PCX", "BTS")

# Paths on the data branch (radar/SPEC.md section 6).
PATHS = {
    "state": "radar/state.json",              # the only file the page reads
    "engine": "radar/engine.json",            # internal engine + source-health state
    "baselines": "radar/baselines.json.gz",   # daily baseline pack (universe)
    "baselines_extra": "radar/baselines_extra.json.gz",  # same-day dynamic adds
    "member_ticks": "radar/member_ticks.jsonl",
    "events": "radar/events.jsonl",
    "scan_log": "radar/scan_log.jsonl",
}

PARAMS: dict = {
    "params_version": "radar-sm-1",
    "session": {"first_entry_slot": 3, "last_entry_slot": 65, "last_confirm_slot": 66,
                "session_end_slot": 76, "bar_final_grace_s": 45},
    "prefilter": {"zday_abs": 1.5, "rvolc": 1.2},
    "universe": {"price_min": 5.0, "adv20_usd_min": 25_000_000, "median_bar_usd_min": 150_000,
                 "missing_share_max": 0.02, "min_baseline_sessions": 15, "tick_dollar3_min": 750_000},
    "dynamic": {"enabled": True, "max_adds_per_day": 150, "market_cap_min": 2_000_000_000,
                "price_min": 5.0, "abs_change_pct_min": 3.0},
    "baseline": {"sessions": 20, "daily_sessions": 21, "tod_clamp": [0.6, 4.0], "beta_shrink": 0.5,
                 "beta_clamp": [0.3, 2.5], "sigma5_floor": 0.0002},
    "entry": {"z3": 2.5, "z6": 3.0, "abs_r6": 0.0075, "rvol3": 2.0, "rvolc": 1.0, "er6": 0.45,
              "inplay_zday": 2.5, "inplay_rvolc": 1.5},
    "confirm": {"z6": 2.0, "rvol3": 1.3, "fast_path_score": None},
    "hold": {"fade_z6": 1.0, "fade_z3": 0.0, "dry_rvol3": 0.6, "stall_bars": 6, "stall_z6": 1.5,
             "min_dwell": 3, "soft_fails": 2},
    "hard_exit": {"reversal_z3": 2.5, "giveback": 0.7, "vwap_cross": 0.0, "stale_bars": 3,
                  "halt_long_bars": 6},
    "reentry": {"cool_same_bars": 6, "cool_opp_bars": 3, "require_new_peak": True, "max_episodes": 3},
    "caps": {"max_members": 12, "max_new_per_tick": 4, "displace_margin": 15, "max_per_sector_dir": 3},
    "market": {"on_spy_z6": 3.0, "on_breadth": 0.60, "off_spy_z6": 2.0, "off_breadth": 0.45,
               "off_bars": 2, "bump": 0.5, "max_new_mkt_dir": 2},
    "halt": {"reopen_block_bars": 2, "move_sigma": 4.0},
    "score_weights": {"thrust": 0.35, "burst_vol": 0.25, "structure": 0.20, "day": 0.10, "accel": 0.10},
}

# "Busy" preset: more names on the radar, lower continuation (~53% at 30 min in replay).
BUSY_OVERRIDES = {"entry": {"inplay_zday": 2.0}}

RUNTIME: dict = {
    "warmup_et": "09:10",          # loop builds the day's baseline pack from here
    "tick_offset_s": 50,           # scan at each 5-minute boundary + 50 s (bar final at +45 s)
    "last_tick_after_close_s": 50, # final tick at close + 50 s processes the last bars
    "tick_timeout_s": 270,
    "loop_retire_min": 330,        # a job may run 360 min; the queued successor takes over
    "push_budget_s": 60,
    "final_push_budget_s": 150,
    "fetch_workers": 16,
    "fetch_timeout_s": 12,
    "stale_warning_min": 12,       # page shows a stale warning after this many minutes without a scan
    "hk_dispatch_min_interval_h": 6,
}
