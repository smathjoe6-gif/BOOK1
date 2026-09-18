# Lean Six Sigma (LSS) as One DMAIC Path

DMAIC is one project path: DMAIC supplies the Y and the gates (`references/dmaic.md`); Lean supplies the stream and many of the candidate Xs (`references/lean-manufacturing.md`). Two separate offices running kaizen events and belt projects in parallel is not a framework — it's two initiatives sharing a building.

## Division of labor

| Question | Who answers it inside LSS |
|---|---|
| Is this Y worth doing at all? | Champion — and TOC (`references/theory-of-constraints.md`), if a drum exists |
| What is the defect / CTQ? | Define |
| Where does time and waste actually sit? | The value-stream map, built in Define/Measure |
| Can we trust the number? | MSA, in Measure (`references/msa.md`) |
| Which X actually moves Y? | Analyze |
| How do we change X? | Improve — often SMED, pull, standard work, poka-yoke — always with a pilot measured against baseline |
| How does it stay changed? | Standard work and SPC, in Control (`references/spc.md`) |

Lean run without a locked Y is a tool safari — activity with no way to know if it mattered. DMAIC run without a stream map risks becoming a local trophy on a step the customer never actually meets.

## The five gates, with Lean inside them

**Define** still has to lock the problem, CTQ, Y, defect definition, scope, goal, Champion, and process owner exactly as in plain DMAIC. Lean adds: VOC (voice of customer), so "waste" stays tied to something a customer actually cares about rather than an internal preference; a SIPOC, then a current-state VSM; takt, if the stream is repetitive; and a hard out-of-scope boundary so a kaizen event can't wander across the whole site. A VSM with no defect definition attached to it is a poster, not a Define artifact.

**Measure** still has to lock the operational Y, run MSA, and establish baseline and stability exactly as in plain DMAIC. Lean adds timed process time / wait time / lead time, WIP counts, and data boxes on the VSM — captured from the *same window* as the Y baseline, not a separate walk done at a different time. A beautiful map does not replace MSA — two different "done" stamps recorded by two different people is itself a sign that lead time is a bad gage, especially for anything measured off the actual shop floor.

**Analyze** still has to name the vital few Xs with real evidence. Lean's job here is to *propose candidates*: batch size, changeover time, rework loops, approval queues, absence of pull, unbalanced work content. Six Sigma's job is to decide, with evidence, which of those candidates actually move Y. A waste walk is a hypothesis generator — it is not a gate on its own. If the real constraint turns out to sit somewhere else entirely, TOC should veto or redirect the Y rather than let Analyze proceed against the wrong target.

**Improve** still has to change a named X and prove Y actually moved. Typical tools: SMED, kanban / a WIP cap, standard work and layout changes, poka-yoke / jidoka, heijunka, or a designed experiment when several Xs are still competing for credit. A kaizen week is a legitimate pilot vehicle, but only when Y is measured before *and* after using the same operational definition — photos of a tidier area are not a gate.

**Control** still has to survive the Belt actually leaving. Lean contributes standard work, visual management, layered audits, and real authority to stop the line. Six Sigma contributes the control plan, the chart, the reaction rule, and a named owner. Standards nobody ever charts drift silently. Charts that nobody has authority to act on get ignored just as silently.

## What the hybrid is actually for

Use LSS when the pain is a measurable defect or delay sitting on a visible stream, and it isn't yet clear whether the real lever is variation, waste, or some mix of both.

**Do not** reach for it when the process doesn't exist yet (that's DFSS — `references/six-sigma.md`), when the core problem is a policy conflict (Thinking Processes — `references/toc-thinking-processes.md`), or when the only real disease is launching work just to keep people busy (a rope/pull problem — `references/dbr.md`). Each of those needs a different first tool; forcing DMAIC onto them wastes the method's actual strengths.

## Weekly strip

Phase and next gate, Y and its defect definition, baseline versus current, one stream metric (lead time, WIP, or %VA — value-added time), the MSA verdict, whether the pilot or new standard is actually in force on the floor right now, and the current blocker.

Color the project from gate honesty and whether Y actually moved — never from the number of kaizen events run. Do not average a Lean "flow Green" with a Six Sigma "p-value Green" into one blended color; report them side by side. And do not declare an LSS project a success while the drum itself is still starved elsewhere in the system (`references/theory-of-constraints.md`) — a perfect local improvement doesn't offset that.

## How LSS decays

- Belt count becomes the KPI, in place of any actual Y moving.
- 5S expands to stand in for all five DMAIC phases at once.
- A separate Lean office and a separate Quality office run two different scorecards against one exhausted process owner caught in the middle.
- A VSM gets drawn in week one, and its data boxes are never actually measured again after that.
- "Improve" quietly comes to mean tidy the area.
- "Control" quietly comes to mean a laminated SOP taped to a wall.
- Analyze gets skipped entirely because the waste walk already "felt obvious" to everyone in the room.
