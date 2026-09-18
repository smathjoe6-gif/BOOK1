# Drum-Buffer-Rope (DBR)

Drum-Buffer-Rope is how TOC actually runs a system day to day once the constraint has been named. The five focusing steps (`references/theory-of-constraints.md`) tell you *what* to protect; DBR is the daily mechanism that protects it.

## The three objects

**Drum** — the constraint's pace. That resource (or the market itself, if demand is genuinely shorter than available capacity) sets how fast the system is *allowed* to produce goal-units. Scheduling everyone else faster than the drum does not raise throughput — it only raises WIP sitting in front of the drum, waiting.

**Buffer** — time placed in front of whatever cannot be allowed to starve. Classic plant DBR uses three:

- **Constraint buffer** — work is released early enough that it should arrive at the drum one buffer-length *before* the drum actually needs it.
- **Assembly buffer** — protects the drum's parts when other, non-constraint parts must meet up with them before assembly.
- **Shipping buffer** — finished work sits a buffer-length ahead of the promised date, protecting the commitment from downstream noise.

A pile of physical pieces sitting somewhere with no time meaning attached is not this buffer. The buffer's color is about **time**, not inventory count: Red means the time remaining is shorter than the work still standing between here and the protected point.

**Rope** — the release rule. New work enters the floor only as fast as the drum actually consumes it, so the queue in front of the drum stays near its designed buffer size. If a plant carefully schedules the constraint and then still launches every job on Monday morning regardless, that's a drum with the rope cut — the schedule exists on paper but nothing is actually controlling WIP.

## Two flavors

- **Traditional DBR** — used when there's a clear internal capacity constraint that genuinely needs sequencing (few machines, ugly changeovers, high product mix). Build a finite drum schedule, size a constraint buffer around it, and release work from that schedule.
- **Simplified DBR (S-DBR)** — used when demand itself is usually the constraint, or the internal constraint is stable and not setup-dominated. No elaborate drum sequence is needed. Release and priority come straight from shipping-buffer status and due dates — less planning machinery, but there's still a rope controlling release.

If the market is genuinely the short constraint and an internal machine still gets finite-scheduled as if it were the drum, that invents a bottleneck purely so the factory looks busy — exactly the local-utilization trap Theory of Constraints exists to catch.

## How you actually steer it

Every time buffer divides into three zones:

| Zone | Meaning | Move |
|---|---|---|
| Green (back third) | Buffer almost untouched | Do not expedite. Touching Green work is noise, not a save. |
| Amber (middle third) | Normal variation using the buffer as designed | Watch. Do not reshuffle the plant over this. |
| Red (front third) | The drum or the customer is about to be starved | Recover that specific order, and ask *why* it penetrated this far. |

The weekly questions are deliberately small: how many orders currently sit in Red on the constraint buffer and on the shipping buffer; is Red rising while release is still wide open (a sign the rope itself is loose); did anyone expedite something that was still sitting in Green.

**Resize from evidence, not mood.** Chronic Green across most orders means the buffer is fat — cut it and lead time falls for free. Chronic Red with no identifiable special cause means the buffer is thin, the rope is leaking (too much released, too early), or the drum has been named as the wrong resource entirely.

## Rope math (starting point)

- Traditional DBR: `release date ≈ drum date − constraint buffer`
- S-DBR: `release date ≈ ship date − shipping buffer`

Non-constraint resources never get their own clever local schedule — they simply take Red-buffer work first, ahead of anything else. Their utilization is not a DBR KPI at all; "keep that cell at 95%" is precisely how the rope gets cut, since it pushes non-constraint resources to launch work the drum isn't ready to consume yet.

## Same pattern, three networks

| Network | Drum | Buffer | Rope |
|---|---|---|---|
| Plant | Constraint machine / cell | Time before the drum, and before ship | Material / work-order release |
| Distribution | Consumption | Stock-time buffers at plant and central warehouse | Replenish only what was actually sold |
| Project (Critical Chain) | Critical chain | Project + feeding buffers | No new scope / no non-chain work starting on a Red fever chart |

See `references/toc-supply-chain.md` for the distribution row worked in full, and `references/critical-chain.md` for the project row.

## What a weekly color should follow

Name the drum explicitly. Count Red / Amber / Green across the relevant buffers. Check releases against actual drum consumption, not against the calendar. Color from buffer trajectory and rope integrity — never from department busy-ness or local utilization.
