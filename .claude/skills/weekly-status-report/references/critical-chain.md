# Critical Chain (CCPM)

Critical Chain is Theory of Constraints (`references/theory-of-constraints.md`) applied to a project network — the chain is the constraint, the buffers are how it's protected, and "no new scope on a Red fever chart" is subordination in practice. It is not CPM with a different badge. Do not use this file's terminology (chain, buffer, fever chart) to describe an ordinary CPM schedule — if there's no resource-leveled chain and no buffers, it's still CPM; use `references/cpm.md` instead.

## The problem it is solving

Padded task dates fail for three boring, predictable reasons:

- **Student syndrome** — the safety time was hidden inside the estimate, so work simply starts late; the padding gets absorbed by procrastination, not by genuine risk.
- **Parkinson's law** — an early finish is essentially never handed back to the project; the task just expands to fill the window it was given.
- **Bad multi-tasking** — every project looks "active" at once, and none of them actually finish, because attention is sliced across all of them instead of committed to one.

Add a project buffer on top of this and leave the old padding sitting in every task anyway, and the result is double safety and a fake Green — the schedule looks protected twice over while actually being no more honest than before. Keep scoring individual people on task due dates, and student syndrome comes right back; the buffer becomes theater rather than a real management tool.

## The idea

CPM finds the longest logic path and hides safety inside every task's own duration estimate. Critical Chain (CCPM, Goldratt) does three other things instead:

1. Resolves resource contention, then takes the longest *remaining* path — that path is the critical chain.
2. Strips local padding out of task durations (classically toward a 50% estimate — the duration someone would give if they weren't protecting themselves).
3. Puts that stripped-out safety into visible buffers, and manages the project by how fast those buffers burn, not by individual task dates.

Two tasks that look parallel on a PERT chart but need the same person are **sequential on the chain** — that's the resource-leveling step, and it's the part a plain CPM view has no way to represent.

## How the plan is built

1. Start from the same network CPM would use (relationships, lags).
2. Level scarce resources. The resource-constrained longest path — after leveling, not before — is the chain.
3. Cut durations down to unpadded remaining work. Cutting the estimate but leaving the old padding sitting in the task as slack defeats the entire method; the padding has to actually move into a buffer, not just get renamed.
4. Insert buffers:
   - **Project buffer** — after the last chain task, before the promised finish.
   - **Feeding buffers** — wherever a side path joins the chain, protecting the chain from a slip on a non-chain feed.
   - **Resource buffer** — an alert, not extra days on the schedule, so the next resource due on the chain is actually free when the chain needs them.

Promised finish = unpadded chain length + project buffer.

Common sizing starters when the user hasn't specified a method: about half the stripped chain safety, or `0.5 × sqrt(sum of D_i²)` across the chain tasks (the square-root-of-sum-of-squares method). Whichever is used, name the method in the report — never present a buffer size as if it just came from the file with no method behind it.

## How work is supposed to run

A relay race, not a timetable:

- Update **remaining duration**, not a theatrical percent-complete.
- The moment the predecessor is done *and* the resource is free, start — holding a chain task for its "planned" Monday start date is student syndrome (the classic behavior CCPM exists to defeat), not discipline.
- Waiting on a resource that's busy elsewhere is chain delay, even when every logic predecessor has technically finished.
- Multi-tasking across chain work counts as delay, not as coverage — a resource splitting attention between two chain tasks is slower on both than doing them in sequence, even though it looks like more is "in progress."
- Do not raid a feeding buffer so a non-chain team can look busy while the chain itself is hungry — that buffer exists to protect the chain, not to fund unrelated activity on a slow week.

## What you actually manage each week

Not task float — **buffer versus progress**.

```
Chain progress % = chain done / chain total
PB consumed %    = buffer used / buffer original
```

### Fever chart (default zones)

| Zone | Read | Action |
|---|---|---|
| Green | Buffer burn at or below progress (lower third) | Watch |
| Amber | Burn tracking or leading progress (middle third) | Named recovery action on the chain this week |
| Red | Burn in the upper third, or remaining buffer will run out before the chain finishes | Protect the chain — no new scope |

If `remaining buffer / recent slip rate` is shorter than the remaining chain length, the schedule is Red even if this week's calendar still technically "fits" — the fever chart is a leading indicator specifically so this gets caught before the calendar confirms it.

## Pipeline (multi-project) CCPM

Across a portfolio, the constraint is usually a shared scarce skill, not any single project's own chain. Projects are deliberately staggered so that scarce resource becomes the drum for the whole pipeline — see `references/dbr.md` for the drum/buffer/rope mechanics this borrows directly.

The rope here is simple: **do not launch the next project just because non-constraint people look idle while existing fever charts are Red and the drum already has a queue.** That's the exact same rope-cut as releasing every work order on Monday morning in plant DBR — it feels productive and quietly floods the one resource that actually limits the whole portfolio.

Each project still keeps its own project buffer. The portfolio level watches the drum's queue *plus* every project's individual fever zone — not utilization anywhere else. "Start another project so the team stays at 100%" is the pipeline version of the same mistake plant DBR exists to prevent.

## How this sits next to the other lenses

| Lens | Trust it for |
|---|---|
| Critical Chain fever chart | Date risk, when a real CC plan exists |
| CPM total float | Logic-only possibility — before, or without, resource leveling |
| Earned Schedule | Time-earning rate versus the PV curve |
| CPI / SPI | Money efficiency — can look fine while one overloaded person *is* the chain |

A task can carry positive CPM float and still sit on the critical chain once resources are leveled — float alone never rules a task out of being the actual constraint. If a report only has float numbers and no buffers, that's still CPM, however it's labeled; don't call it Critical Chain without the leveling and buffer steps actually done.

See `references/cpm.md` for total/free float mechanics, and `references/evm.md` for Earned Schedule and CPI/SPI.

## Meetings and the weekly strip

The chain meeting is not a WBS tour. In priority order, it covers:

1. Red project buffers and Red feeding buffers
2. Resource-buffer alerts on the chain (the next chain resource about to be needed)
3. Decisions that would idle the chain if left unresolved
4. Everything else waits

Keep the actual status-page strip small:

- Chain task IDs and the resource each depends on
- Chain remaining (unpadded)
- Project buffer: original / remaining / consumed %
- Fever zone versus progress
- Any feeding buffers already sitting in Amber or Red
