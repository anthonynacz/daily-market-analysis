# Lean rules for upcoming events

An upcoming event has no outcome yet, so its `dir` is a **lean**, not a result.
The template renders upcoming events differently from past ones:

| `future` | `dir` | Shown as |
|---|---|---|
| false | BULLISH / BEARISH / MIXED | Bullish / Bearish / Mixed (the actual reaction) |
| true | BULLISH / BEARISH | "Leans bullish/bearish · LOW/MEDIUM/HIGH confidence" |
| true | MIXED | "Pending · no lean" (glyph `?`) |

Two optional fields carry the lean. Existing fields are unchanged, so older
reports and the alerts routine keep working.

- `conf`: 1, 2 or 3. Only on upcoming events whose `dir` is BULLISH or BEARISH.
- `basis`: one line naming the evidence, with numbers and sources.

## What the lean refers to

The lean is the expected direction of the **first ticker listed** in `tickers`
over the event session (last close before the event to first close after it).
Order the tickers so the first one is the cleanest expression of the event.

## Signals

Each signal must come from a page retrieved in this run. A signal that cannot
be sourced does not count.

1. **Options skew.** Put vs call implied volatility (25-delta, or the nearest
   OTM strikes each side) for the expiry that spans the event, or the put/call
   open-interest ratio against its own recent norm. Counts when clearly one-sided.
2. **Historical reaction.** The first ticker's move on the last 6-8 comparable
   events (same company's earnings, same macro release). Counts when at least
   70% went one way, with at least 6 observations.
3. **Revisions and read-through.** Direction of consensus estimate revisions
   over the last 30 days, pre-announcements, and results from close peers
   already reported this season.
4. **Market-implied odds (macro events).** CME FedWatch, prediction-market
   prices, and nowcasts (Cleveland Fed inflation nowcast, Atlanta Fed GDPNow)
   compared with consensus. State how the expected surprise maps to the first
   ticker (for example, "hot print → TLT down").
5. **Drift into the event.** Price trend and relative strength over the prior
   10 sessions. Weak evidence: use only as a second or third signal, never
   alone, and note when a strong run-up raises the bar instead.

## Setting `dir` and `conf`

- No signal, or signals that disagree: `dir: "MIXED"`, no `conf`, no `basis`.
- One signal: `conf: 1`.
- Two signals agreeing, none opposing: `conf: 2`.
- Three or more agreeing, none opposing: `conf: 3`.
- Single-outcome binaries (FDA decisions, court rulings, votes): `conf` is
  capped at 1.

Do not force a lean. Consensus is already in the price, so many upcoming events
will honestly stay pending, and most leans will be `conf: 1`. A pending label is
better than an unsupported arrow.

`basis` example: `"25d put skew +6 vol pts [Cboe]; stock fell after 6 of last 8 prints [MarketChameleon]"`

The `rec` text still gives both branches ("a miss does X, a beat does Y").

## Scoring leans

Keep a running log at `reports/lean_scorecard.json`:

```json
[{ "reportDate": "2026-11-17", "eventDate": "2026-11-18", "id": "f10",
   "ticker": "SPY", "lean": "BEARISH", "conf": 1, "movePct": -0.8, "result": "HIT" }]
```

On each run, for every lean in earlier reports whose event has now happened and
is not yet in the log:

- fetch the first ticker's close before and after the event and compute the move;
- HIT if the move is in the lean's direction, MISS if against, PUSH if it is
  within ±0.25% (pushes are not counted);
- score each event once, using the lean from the **last** report published
  before the event.

Then set `LEAN_RECORD` in the new report to the totals:
`{ hits, misses, since: "<first reportDate in the log>" }`. The header shows the
hit rate once at least one lean has been scored. If conf-1 leans run below
about 50% over 30 or more scored events, say so in the run summary.

## Changes needed in the daily routine's prompt

- **STEP 2, EVENTS shape:** add the optional `conf` and `basis` fields, and
  replace "never rename, add or remove fields" with "never rename or remove
  fields; `conf` and `basis` on upcoming events are the only optional additions".
- **STEP 3:** add "Score earlier leans as described in template/LEAN_RULES.md
  and update reports/lean_scorecard.json."
- **STEP 5:** add "For every upcoming event, set `dir`, `conf` and `basis` by
  the rules in template/LEAN_RULES.md. Past events keep `dir` as the actual
  reaction."
- **STEP 11:** add "no past event has `conf` or `basis`; every upcoming
  BULLISH/BEARISH event has both; no upcoming MIXED event has either."
- **STEP 12:** add `LEAN_RECORD` to the list of things replaced in the copied
  template.
- **STEP 15:** add the count of leans vs pending events and the lean hit rate.
