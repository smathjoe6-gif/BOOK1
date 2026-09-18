# Theory of Constraints (TOC)

Theory of Constraints is Goldratt's rule for any system that has a goal: throughput is set by **one constraint at a time**. Everything else is commentary. Critical Chain (`references/critical-chain.md`) is that same rule applied specifically to a project network — the chain is the constraint made visible on a schedule.

## The goal and the three numbers

For a business, the goal is to make more money now and later. TOC tracks three measures, in this order of interest:

| Measure | Meaning |
|---|---|
| **Throughput (T)** | The rate the system produces goal-units — usually cash from sales, not parts off a machine |
| **Inventory (I)** | Money stuck inside the system — materials, WIP, unfinished projects |
| **Operating expense (OE)** | Money spent to turn inventory into throughput |

A local win that raises OE or I without raising T is not a win — it's motion, not progress. In project work, T is **finished work the sponsor can actually use**, not tasks closed to look busy on a burndown chart.

## The five focusing steps

Always applied in this order — skipping ahead to "elevate" without doing 2 and 3 first is the most common failure mode:

1. **Identify the constraint** — the one resource, policy, market, or chain that most limits T.
2. **Exploit it** — stop wasting constraint time. No idle specialist on the chain, no multi-tasking across constraint work, no bad-priority jumping that steals the constraint's attention.
3. **Subordinate everything else** — non-constraint people may sit idle if that's what it takes to keep the constraint fed and unblocked. Utilization targets on the rest of the team are exactly how systems drown: keeping everyone busy floods the constraint with more work than it can process.
4. **Elevate** — add capacity, change the policy, buy a tool — but only *after* steps 2 and 3 are real. Elevating a constraint you haven't exploited or subordinated around yet is spending money to fix a problem you haven't actually diagnosed.
5. **Repeat** — once the constraint moves, last month's rule becomes the new constraint. The usual next constraint is inertia — the old rule (a policy, a habit, a priority) that was built around the constraint that no longer exists.

Weekly report language should name the *current* constraint, what was actually exploited, what was deliberately subordinated, and whether anyone genuinely needs to elevate — not just report activity.

## Where the constraint lives

- **Resource** — one person, crew, tool, or vendor that everything else waits on.
- **Policy** — approval gates, batching rules, "keep everyone at 100%" utilization targets, frozen scope rules.
- **Market** — demand itself is the limit; extra internal capacity does not raise T no matter how much of it exists.
- **Project chain** — in CCPM terms, the critical chain plus its project buffer.
- **Portfolio** — a shared strategic resource spread across many projects at once.

A loud delay is not automatically the constraint. Ask what the goal is actually waiting on before naming one.

## Drum–Buffer–Rope (DBR)

The factory-floor form of the same idea:

- **Drum** — the constraint sets the beat everything else has to move to.
- **Buffer** — time or stock that protects the drum from upstream noise, so a hiccup elsewhere never starves it.
- **Rope** — new work is released only as fast as the drum consumes it, so WIP can't flood the floor ahead of the constraint.

Critical Chain is DBR mapped onto a task network: the chain is the drum, the project and feeding buffers are the buffers, and "no new scope while the fever chart is Red" is the rope.

When the limit turns out to be a *policy* rather than a person or a machine, Goldratt's thinking processes (Current Reality Tree, Evaporating Cloud, Future Reality Tree) are the right tool — but those belong in a dedicated problem-solving session, not in the body of a weekly status report.

## How this should change a status report

| If you have… | Trust… |
|---|---|
| TOC / CCPM | Constraint buffer / fever chart for schedule color |
| CPM only | Total float — logic possibility, with no resource view at all |
| EVM / Earned Schedule | Money and time efficiency — can look healthy while the drum itself sits idle |

Action items should follow the five steps: **exploit and subordinate first**. Hiring, overtime, and extra vendors are elevation moves — they need an explicit decision behind them, not a default reach because a stream is behind.
