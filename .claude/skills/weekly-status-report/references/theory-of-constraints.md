# Theory of Constraints (TOC)

Theory of Constraints is Goldratt's claim that a system's results are set by **one constraint at a time**, and that most "improvements" are local optimizations that never actually touch that constraint. Everything else in the toolkit — the five focusing steps, Drum-Buffer-Rope, Critical Chain, replenishment, the Thinking Processes — is that one claim turned into an operating method. Critical Chain (`references/critical-chain.md`) is the claim applied specifically to a project network — the chain is the constraint made visible on a schedule.

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

The factory-floor form of the same idea — see `references/dbr.md` for the full daily mechanism (buffer zones, release math, Traditional vs. S-DBR). In brief:

- **Drum** — the constraint sets the beat everything else has to move to.
- **Buffer** — time or stock that protects the drum from upstream noise, so a hiccup elsewhere never starves it.
- **Rope** — new work is released only as fast as the drum consumes it, so WIP can't flood the floor ahead of the constraint.

Critical Chain is DBR mapped onto a task network: the chain is the drum, the project and feeding buffers are the buffers, and "no new scope while the fever chart is Red" is the rope.

When the limit turns out to be a *policy* rather than a person or a machine, Goldratt's thinking processes (Current Reality Tree, Evaporating Cloud, Future Reality Tree, and the rest) are the right tool — see `references/toc-thinking-processes.md`. The full trees are built in a dedicated working session, not in the report itself; the WSR only ever receives the compressed result (the injection, its owner, and one checkable predicted effect).

## What TOC is good at

- Stopping the organization from treating every queue as its own separate crisis.
- Making subordination explicit — idle non-constraint time can be genuinely healthy, not a problem to solve.
- Giving operations, projects, and supply chains the *same* control signal: buffer versus progress, rather than a different local metric for each.
- Forcing the question "did throughput actually move?" instead of "were we busy?"

That's why it sits cleanly next to the other schedule lenses in this skill: CPM says whether the logic still reaches the date; EVM and Earned Schedule say how efficiently money and time are being earned; TOC says whether the thing that actually gates the goal is protected.

## Where it is weak or misused

- **Identifying the wrong constraint.** The loudest delay is not always the constraint. A policy (batching, a utilization target, forecast-push) is easy to miss entirely because it just looks like "how we work" rather than a decision someone made.
- **Religion around 50% estimates and exact buffer formulas.** The sizes are a starting policy, not physics — you're meant to manage by penetration afterward and adjust from evidence. Treating the first cut as a fixed, correct number is cargo-cult TOC.
- **One-project zeal in a pipeline.** Running CCPM on a single project without staggering the shared scarce resource across the portfolio just paints a fever chart on top of an already-overloaded drum — it looks like discipline while changing nothing.
- **Ignoring cash, quality, and regulation.** Throughput defined as "money now" can be abused to justify starving quality or compliance work just because it isn't sitting on today's drum. Elevate is sometimes mandatory on day one — a constraint that's actually a safety or compliance gate doesn't wait for steps 2 and 3.
- **Software theater.** A fever-chart tool bolted onto a schedule that still scores people on task due dates and department utilization KPIs is not TOC — the tool changed, the incentives didn't.
- **People.** "Subordinate" heard as "your work doesn't matter" will be resisted, and the predictable result is the rope getting cut through unofficial, informal queues that never show up on the official buffer chart.

TOC does not replace a cost system, a quality system, or a market strategy — it says those systems should not be the ones setting the pace of the constraint.

## How this should change a status report

| If you have… | Trust… |
|---|---|
| TOC / CCPM | Constraint buffer / fever chart for schedule color |
| CPM only | Total float — logic possibility, with no resource view at all |
| EVM / Earned Schedule | Money and time efficiency — can look healthy while the drum itself sits idle |

Action items should follow the five steps: **exploit and subordinate first**. Hiring, overtime, and extra vendors are elevation moves — they need an explicit decision behind them, not a default reach because a stream is behind.
