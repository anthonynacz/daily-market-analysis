"""The scanner's cron triggers against every NYSE session through 2028, and the workflow contract (SPEC 9).

GitHub keeps at most one pending run per concurrency group, so while a loop runs, any trigger queues its
successor, which starts when the loop retires. The simulation below follows that rule session by session.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

from radar import calendar_nyse as cal
from radar import gate, loop
from radar.config import RUNTIME

UTC = timezone.utc
ROOT = Path(__file__).resolve().parents[2]
SCAN_YML = ROOT / ".github/workflows/radar-scan.yml"
CI_YML = ROOT / ".github/workflows/radar-ci.yml"
FIRST, LAST = date(2026, 1, 2), cal.COVERED_THROUGH
JOB_SETUP = timedelta(minutes=3)        # runner start, checkouts, pip install before the loop's first line
MAX_WATCHDOG_GAP = timedelta(minutes=35)


def workflow_crons() -> list[str]:
    return re.findall(r"^\s*-\s*cron:\s*'([^']+)'", SCAN_YML.read_text(encoding="utf-8"), re.M)


def cron_field(spec: str, lo: int, hi: int) -> set[int]:
    out: set[int] = set()
    for part in spec.split(","):
        step = 1
        if "/" in part:
            part, s = part.split("/")
            step = int(s)
        if part == "*":
            a, b = lo, hi
        elif "-" in part:
            a, b = map(int, part.split("-"))
        else:
            a = b = int(part)
        out.update(range(a, b + 1, step))
    return out


def fires_on(expr: str, day: date) -> list[datetime]:
    """UTC fire times of one cron expression on one UTC date (cron weekday 0 = Sunday)."""
    minute, hour, dom, month, dow = expr.split()
    if ((day.weekday() + 1) % 7 not in cron_field(dow, 0, 6) or day.day not in cron_field(dom, 1, 31)
            or day.month not in cron_field(month, 1, 12)):
        return []
    return sorted(datetime(day.year, day.month, day.day, h, m, tzinfo=UTC)
                  for h in cron_field(hour, 0, 23) for m in cron_field(minute, 0, 59))


def triggers(day: date, crons: list[str], delay: timedelta = timedelta(0)) -> list[datetime]:
    return sorted({f + delay for c in crons for f in fires_on(c, day)})


def accepted(t: datetime) -> bool:
    return gate.gate(t)["run"] == "true"


def sessions() -> list[cal.Session]:
    out, d = [], FIRST
    while d <= LAST:
        s = cal.session_for(d)
        if s:
            out.append(s)
        d += timedelta(days=1)
    return out


SESSIONS = sessions()


def simulate(s: cal.Session, fires: list[datetime]) -> tuple[bool, set[int], int]:
    """(warmup ran, tick boundaries that ran, handovers) for one session's chain of loop runs.

    Each run's loop starts JOB_SETUP after its trigger and retires loop_retire_min later; a trigger that
    fired while it ran queues the successor, which starts at the retirement. The final tick runs late
    rather than never."""
    warmup, ticks = loop.plan_session(s)
    starts = [f for f in fires if accepted(f)]
    assert starts, f"{s.day}: no trigger passes the gate"
    start, ran, warmed, handovers = starts[0], set(), False, 0
    while True:
        begin = start + JOB_SETUP
        retire = begin + timedelta(minutes=RUNTIME["loop_retire_min"])
        warmed |= begin.timestamp() <= warmup.run_at
        ran.update(t.tick_epoch for t in ticks if begin.timestamp() <= t.run_at <= retire.timestamp())
        if ticks[-1].run_at <= retire.timestamp():
            ran.add(ticks[-1].tick_epoch)
            return warmed, ran, handovers
        queued = [f for f in fires if start < f <= retire]
        start = retire if queued else next((f for f in fires if f > retire), None)
        assert start is not None and accepted(start), f"{s.day}: no successor after {retire:%H:%M}Z"
        handovers += 1


def test_the_workflow_uses_the_spec_crons():
    assert workflow_crons() == ["33 12 * * 1-5", "7,37 13-21 * * 1-5"]


def test_the_simulation_covers_every_covered_session():
    assert len(SESSIONS) == 3 * 251 and SESSIONS[-1].day == date(2028, 12, 29)


@pytest.mark.parametrize("delay_min", [0, 3, 10, 20])
def test_every_session_is_covered_from_warmup_to_final_tick(delay_min):
    """Also with every scheduled event late, which GitHub does under load. A handover may skip one
    boundary (the engine catches its bar up on the next tick), never two in a row."""
    crons = workflow_crons()
    leads = []
    for s in SESSIONS:
        fires = triggers(s.day, crons, timedelta(minutes=delay_min))
        window_start = gate.scan_window(s)[0]
        first = next(f for f in fires if accepted(f))
        assert first <= window_start - JOB_SETUP, f"{s.day}: first run starts too late for the warmup"
        leads.append((window_start - first).total_seconds() / 60)
        warmed, ran, handovers = simulate(s, fires)
        _, ticks = loop.plan_session(s)
        missed = [i for i, t in enumerate(ticks) if t.tick_epoch not in ran]
        assert warmed and ticks[-1].tick_epoch in ran, s.day
        assert handovers <= 1 and len(missed) <= handovers, (s.day, [loop.iso(ticks[i].tick_epoch) for i in missed])
    assert min(leads) >= 3 and max(leads) <= 120


def test_the_warmup_is_still_covered_when_the_starter_is_dropped():
    watchdogs = workflow_crons()[1:]
    for s in SESSIONS:
        fires = triggers(s.day, watchdogs)
        first = next(f for f in fires if accepted(f))
        assert first <= gate.scan_window(s)[0], s.day


def test_watchdog_gaps_inside_the_window():
    crons = workflow_crons()
    for s in SESSIONS:
        window_start, window_end = gate.scan_window(s)
        inside = [f for f in triggers(s.day, crons) if window_start - MAX_WATCHDOG_GAP <= f < window_end]
        assert inside[0] <= window_start and window_end - inside[-1] <= MAX_WATCHDOG_GAP, s.day
        assert all(b - a <= MAX_WATCHDOG_GAP for a, b in zip(inside, inside[1:])), s.day


def test_weekday_holidays_start_nothing():
    crons, d, holidays = workflow_crons(), FIRST, 0
    while d <= LAST:
        if d.weekday() < 5 and cal.session_for(d) is None:
            holidays += 1
            assert not any(accepted(f) for f in triggers(d, crons)), d
        d += timedelta(days=1)
    assert holidays == sum(FIRST <= h <= LAST for h in cal.HOLIDAYS) == 28


def test_after_the_window_every_trigger_is_a_no_op():
    crons = workflow_crons()
    for s in SESSIONS:
        end = gate.scan_window(s)[1]
        assert not any(accepted(f) for f in triggers(s.day, crons) if f >= end), s.day


# ---------------------------------------------------------------- workflow contract (text checks: no YAML parser in the lock)

SHA_PIN = re.compile(r"^\s*(?:-\s*)?uses:\s*([\w.-]+/[\w.-]+)@([0-9a-f]{40}) # v\d+\.\d+\.\d+\s*$")


@pytest.mark.parametrize("path", [SCAN_YML, CI_YML])
def test_actions_are_pinned_to_full_commit_shas(path):
    uses = [line for line in path.read_text(encoding="utf-8").splitlines() if re.match(r"^\s*(-\s*)?uses:", line)]
    assert uses and all(SHA_PIN.match(line) for line in uses), uses


@pytest.mark.parametrize("path", [SCAN_YML, CI_YML])
def test_dependencies_install_from_the_hash_locked_file(path):
    text = path.read_text(encoding="utf-8")
    assert "pip install --disable-pip-version-check --require-hashes -r radar/requirements.lock" in text
    assert "python-version: '3.12'" in text


def test_scanner_workflow_settings():
    text = SCAN_YML.read_text(encoding="utf-8")
    assert "cancel-in-progress: false" in text and "|| 'radar-scanner' }}" in text
    assert "timeout-minutes: 350" in text
    assert re.search(r"^permissions:\n  contents: write\b.*\n  actions: write\b", text, re.M)
    assert "options: [loop, once, probe]" in text and "type: boolean" in text
    assert "NO_PUSH: ${{ github.event_name == 'workflow_dispatch' && !inputs.push }}" in text
    assert "persist-credentials: false" in text and "sparse-checkout: radar" in text
    assert "path: _data" in text and "fetch-depth: 1" in text
    assert text.index("python3 -m radar.gate") < text.index("actions/setup-python")
    assert "if: always() && steps.gate.outputs.run == 'true'" in text and "python3 -m radar.gitsync" in text
    assert '--pending-dir "$RUNNER_TEMP/radar-pending"' in text                    # outside the worktree
    assert "push:" not in text.split("workflow_dispatch:")[0]                        # never runs on a push


def step_run(text: str, name: str) -> str:
    """The run script of one workflow step (text checks: no YAML parser in the lock)."""
    block = text.split(f"- name: {name}\n", 1)[1].split("\n      - name:", 1)[0]
    return block.split("run: |\n", 1)[1] if "run: |\n" in block else block.split("run: ", 1)[1]


def test_the_scan_loop_is_the_steps_own_process():
    """RT-2: with exec, a cancel's SIGINT/SIGTERM reaches the loop instead of orphaning it behind bash."""
    script = step_run(SCAN_YML.read_text(encoding="utf-8"), "Scan loop")
    lines = [ln.strip() for ln in script.splitlines() if ln.strip() and not ln.strip().startswith("#")]
    assert lines[-1] == 'exec python -m radar.loop "${args[@]}"'
    assert "radar.loop" not in "\n".join(lines[:-1])


def test_the_probe_reads_the_stored_pack_without_credentials():
    text = SCAN_YML.read_text(encoding="utf-8")
    assert step_run(text, "Probe the data sources (writes nothing)").strip() == \
        'python -m radar.tick --probe --data-dir "$DATA_DIR"'
    checkout = text.split("- name: Check out data branch (read only, for the probe)\n", 1)[1].split("\n      - name:")[0]
    assert "env.MODE == 'probe'" in checkout and "persist-credentials: false" in checkout
    assert "continue-on-error: true" in checkout and "path: _data" in checkout


def test_ci_never_runs_on_the_data_branch():
    text = CI_YML.read_text(encoding="utf-8")
    assert "branches-ignore: [data]" in text
    assert text.count("paths: ['radar/**', '.github/workflows/**']") == 2


def test_ci_runs_the_soak_tests_in_their_own_weekly_job():
    """SPEC 12.3: pushes and PRs skip the soak tests; a separate job runs them on dispatch and on Sundays."""
    text = CI_YML.read_text(encoding="utf-8")
    test_job, soak_job = text.split("\n  test:\n", 1)[1].split("\n  soak:\n", 1)
    assert "if: github.event_name == 'push' || github.event_name == 'pull_request'" in test_job
    assert 'run: python -m pytest radar/tests -q -m "not soak"' in test_job
    assert "if: github.event_name == 'workflow_dispatch' || github.event_name == 'schedule'" in soak_job
    assert "run: python -m pytest radar/tests -q -m soak" in soak_job
    triggers = text.split("\npermissions:", 1)[0]
    assert "workflow_dispatch:" in triggers
    (cron,) = re.findall(r"^\s*-\s*cron:\s*'([^']+)'", triggers, re.M)
    assert cron.split()[2:] == ["*", "*", "0"]                   # weekly, on Sunday
    assert "'soak' || 'test'" in text                          # a push never cancels a running soak


def test_the_soak_marker_is_registered(pytestconfig):
    assert any(m.startswith("soak:") for m in pytestconfig.getini("markers"))


def test_the_lock_has_hashes_for_every_pin():
    lock = (ROOT / "radar/requirements.lock").read_text(encoding="utf-8")
    pins = re.findall(r"^([A-Za-z0-9_.-]+)==(\S+) \\$", lock, re.M)
    names = {n.lower().replace("_", "-") for n, _ in pins}
    assert {"yfinance", "curl-cffi", "numpy", "pandas", "pytest"} <= names
    assert dict(pins)["yfinance"] == "1.2.0"
    for block in re.split(r"\n(?=[A-Za-z0-9_.-]+==)", lock.split("\n", 2)[2]):
        assert "--hash=sha256:" in block, block.splitlines()[0]
