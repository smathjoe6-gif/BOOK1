# TOC Applied to Supply Chain

A worked pattern for a normal multi-echelon chain: plant → central warehouse → DCs → customer. Use this alongside `references/theory-of-constraints.md` and `references/toc-thinking-processes.md` — it's the same five focusing steps and the same tree tools, applied to the specific mess a supply chain reliably produces.

The usual mess: **stockouts and excess inventory at the same time**, plus a plant that reschedules every day. If a status report shows both of those together, this is very likely the right lens.

**Goal of the system:** availability at the constraint's pace (throughput), with less inventory and less expedite spend — not a higher utilization number in every building. A warehouse or plant hitting its own local utilization target is not the goal; it's frequently the cause of the mess.

## Current Reality Tree

Typical UDEs that actually travel together in this pattern:

- A-items stock out while C-items rot
- Write-downs and a full warehouse, simultaneously
- Air freight and "hero" expedites
- Supplier / plant dates nobody actually believes anymore
- The production schedule changes daily
- Sales does not trust the on-hand number
- Quoted lead times stay long even in quiet weeks with plenty of stock somewhere

**The spine of the tree:** each node forecasts and pushes stock to protect its own local fill-rate or utilization target → everyone inflates their min/max and orders earlier than they need to → the resulting batches hide the real demand mix → the warehouse looks full, so an A-item hole only ever shows up as a lost customer order → an expedite to cover that hole steals the plant's capacity from the *next* plan → dates collapse → sales pads its quoted lead time and stops trusting the stock number → which feeds even more forecast-push at every node. It's a loop, not a chain of separate problems.

**Core problem:** replenishment is running on a forecast-push / local-efficiency policy, not on consumption at the next buffer. The constraint is usually that *policy*, not floor space or plant capacity.

## Evaporating Cloud

- **A** — reliable availability, at acceptable inventory and cost
- **B** — protect service now
- **C** — protect cost and inventory now
- **D** — hold more stock everywhere, and expedite when it's still not enough
- **D'** — cut stock and freeze the plant

The hidden assumptions keeping the conflict alive: service is believed to be produced by piles of stock sitting at every node; cost is believed to be produced by starving those piles and running large batches; therefore B and C are assumed to be unable to coexist.

**Injection:** consume-and-replenish to central and plant buffers, sized from real observed variation, with buffer status as the only priority signal. Service comes from correct stock at the aggregation point, not from piles at every node. Cost comes from fewer expedites and less *wrong* stock — not from freezing the chain.

This is not the compromise version ("a bit more stock, a bit less stock everywhere"). It attacks the assumption behind both D and D' at once, which is why it can actually resolve the cloud instead of splitting the difference.

## Future Reality Tree

If most stock sits where variation actually aggregates (plant / central, not scattered across every DC), DCs pull from real consumption instead of forecasting their own orders, the plant runs its Red buffers first, and utilization KPIs no longer launch work early just to look busy — then utilization at the two real constraints (call them U1 and U2) falls together instead of trading off, expedite noise drops, the drum gets interrupted less often, dates become buffer-based instead of guessed, and sales can quote from actual status instead of institutional rumor.

**AND conditions that have to hold, or this is a slogan, not a plan:** a daily consumption signal that people actually trust, one priority rule everyone follows, a frozen pilot policy (nobody quietly reverts), and a *named* plant drum. Without all four of those in place, the FRT doesn't actually connect to anything real.

## Negative branches (trim these, or the old system quietly comes back)

| Feared effect | Trim |
|---|---|
| DCs buy around the system because fill-rate bonuses are still live | Change the pilot KPI to availability + inventory $ + expedite count |
| Plant %busy drops and finance panics | Report constraint hours and throughput, not local utilization |
| Small lots explode changeover counts | Batch only on the drum; non-constraint work follows the signal, not its own batch logic |
| Suppliers reject smaller, more frequent orders | Add a supplier buffer; run a tiny SKU-level pilot first; no network-wide go-live yet |
| IT cannot produce a daily sales-out feed | Run the pilot on a spreadsheet pull — do not wait for "the platform" to be built first |

## Prerequisite → Transition (what next week can actually do)

Obstacles become intermediate objectives: a trusted daily signal, a named drum, buffer sizes derived from recent real variation (not a policy number), 20–50 pilot SKUs on one DC / one line, a scorecard swap, and an explicit Red-buffer escalation path so sales will actually tolerate running the pilot.

**Near-term Transition Tree — these are the action items, almost verbatim:**

1. Name the drum and the pilot SKUs.
2. Publish daily on-hand and consumption for those SKUs (Green / Amber / Red).
3. Freeze forecast-push on the pilot; replenish from consumption only, Red buffers first.
4. Change the pilot team's KPI for one month so they stop buying around the rope.
5. Resize buffers only after two full cycles of real evidence — not on day one, and not from a gut feel that the buffer looks wrong.

## How to color a weekly report on this

Not warehouse utilization — that's exactly the metric this pattern exists to stop trusting. Color from buffer trajectory and policy violations instead:

- How many pilot buffers are Red
- Stockouts on pilot SKUs vs. a control set that isn't on the pilot
- Inventory $ vs. baseline
- Expedite count
- Whether anyone quietly turned forecast-push back on for the pilot SKUs — this alone is grounds to flag Red regardless of what the other numbers say, since it means the injection was never actually tested
