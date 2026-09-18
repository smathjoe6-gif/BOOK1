# Critical Path Method (CPM)

Use this when the project has a real logic-linked schedule network (a CPM schedule, not just a task list with dates). It answers a different question than EVM: not "are we earning value efficiently," but "is the committed date still mathematically possible."

## Float

```
TF = Late Start - Early Start = Late Finish - Early Finish
FF = min over successors s of (Early Start[s] - lag) - Early Finish   (FS successors)
```

- **Total float (TF)** — how much this activity can slip before the *project commitment* moves.
- **Free float (FF)** — how much it can slip before a *successor's* early date moves.
- **Critical** — TF ≤ 0. Report it as an ordered ID path (the actual chain of activity IDs), not a vibe or a one-line summary.
- **Near-critical** — TF roughly 1–5 working days. Report these explicitly — they become next week's critical path the moment something on the current path recovers or something on theirs slips.

More than one zero-float path is normal after a slip has already happened — the network doesn't owe you a single clean answer. Don't pick a favorite path to report; list all of them.

## Weekly progress (this is where CPM files rot)

- **Done** — RD (remaining duration) = 0, Actual Finish is set.
- **In flight** — RD = remaining working days as of the data date. This is *not* `OD × (1 - %complete)` unless that's the schedule's explicitly agreed update rule — that formula silently reintroduces the same gut-percent problem EVM's earning rule exists to prevent.
- **Not started** — current RD, which may itself have changed since last week (durations get re-estimated; don't assume last week's RD still holds).

Percent complete with the *original* duration still sitting in the remaining-duration field is not a real update — it means someone touched the %complete field and nothing else. Treat that as a red flag on data quality, not a reported status.

Also list hard constraints (MSO/MFO — Must Start On / Must Finish On) separately: they manufacture criticality by forcing a date regardless of logic, so an activity showing TF ≤ 0 because of a hard constraint means something different than one that's genuinely logic-driven. Soft constraints (SNET/FNET — Start No Earlier Than / Finish No Earlier Than) only raise early dates and don't manufacture false criticality the same way.

## How CPM sits next to EVM and Earned Schedule

Three different lenses, three different questions — don't blend them into one number:

| Lens | Question it answers |
|---|---|
| CPM float vs. commitment | Is the date still mathematically possible? |
| Earned Schedule `SPI(t)` / `IEAC(t)` | How fast are we earning time versus the PV curve? |
| Classic SPI / CPI | Efficiency in currency — can look healthy even while non-critical work absorbs all the effort |

See `references/evm.md` for the Earned Schedule and classic SPI/CPI side of this.

## How this should move RAG

Schedule RAG comes from the **driving path's float**, not from a blended SPI number — a project can show SPI ≈ 1 while its actual critical path is burning float, because SPI averages across all work, critical and not.

- TF comfortably above policy (commonly ≥ 5 working days) → Green on schedule
- TF 1–5 days, or a near-critical path is genuinely threatened → Amber
- TF ≤ 0 against the committed finish → Red

If Earned Schedule's `IEAC(t)` and the CPM network's Early Finish disagree by more than one reporting period, that's a signal the PV curve or the network itself is stale — go find out which one, don't average the two numbers together and report the blend as if it meant something.

## Weekly CPM strip

Keep this small on the weekly page:

- Data date
- Committed finish
- Early finish (from the network)
- Driving-path total float
- Critical path IDs (the ordered chain)
- Near-critical path IDs
- What logic or remaining-duration changed this week, and why
