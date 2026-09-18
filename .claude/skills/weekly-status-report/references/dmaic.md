# DMAIC

DMAIC is the Six Sigma path for improving a process that already exists (see `references/six-sigma.md` for how it compares to DFSS and where it fits next to Lean and TOC). Each letter is a **gate**, not a chapter title to work through on autopilot — skip Measure because "we already know," and Analyze quietly turns into a voted fishbone diagram instead of evidenced causes.

It's the wrong vehicle when the process doesn't exist yet (that's DFSS), when the real problem is a policy conflict (`references/toc-thinking-processes.md`), or when the problem is batch-push with no rope controlling release (`references/lean-manufacturing.md` / `references/dbr.md`). If Y can't be defined as a defect or a continuous CTQ, stay out of Measure entirely — there's nothing to measure yet.

## Define — lock the problem

Leave this phase with a problem specific enough to photograph: what, where, when, how big, versus what baseline. Plus the customer CTQ, the project's Y, a defect definition and an opportunity definition, explicit scope in/out, a goal with both a size and a date, a named Champion, a named process owner, and a SIPOC.

**Gate:** a stranger reading the charter could tell what will be counted as a defect next month, without asking anyone to clarify.

**Counterfeit Define:** "improve satisfaction" as the whole charter, a boiling-ocean scope with no edges, a goal that's actually "roll out Lean" rather than a measurable Y, no process owner named anywhere.

## Measure — make Y honest

Write an operational definition of Y, then run MSA on it (`references/msa.md` for the full study design). If the gage eats most of the observed variation, stop here — nothing downstream is trustworthy yet. Baseline from a dated sample, never from memory or from "what we generally see." Build a control chart if the data exist for it — stability first, capability later (see `references/spc.md`). Map the as-is process specifically at the step where the defect is actually born, not just the whole process in general. Write down the sampling plan that Analyze will use before Analyze starts.

**Gate:** two competent people, looking at the same unit independently, call it the same way. The baseline has an explicit date range and a stated n.

**Counterfeit Measure:** skipping MSA entirely, quoting a `Cpk` on a process whose mean is still visibly wandering, measuring a proxy that structurally cannot move the actual CTQ even if it improves.

## Analyze — name the vital few Xs

Candidate Xs come from the process map, not from a show of hands or seniority in the room. Connect each candidate to Y with stratification, multi-vari studies, plots, formal tests, regression, or a screening DOE (`references/doe.md`) — not with confident assertion. Write down the hypotheses that got killed along the way, specifically so they don't quietly come back later as folklore ("we tried that already, it didn't work" with no record of why).

**Gate:** you can say "if we change this X, Y should move by about this much," with a stated direction — not just "this X matters."

**Counterfeit Analyze:** a fishbone diagram with sticky-note voting standing in for evidence, "5 Whys" that conveniently terminate at "human error," keeping every candidate X alive "just in case" instead of narrowing to the vital few, testing until the team's favorite explanation wins.

## Improve — change X, prove Y moved

The proposed solution is tied to a specifically named X, not a general improvement effort. Look honestly at the risk the change introduces. Pilot it with a defined place, a defined duration, and an explicit list of what's being held constant during the pilot. Compare the pilot's result to the Measure-phase baseline with a real sample and a named method — then scale, iterate, or drop it based on that comparison.

**Gate:** Y moved by more than measurement noise would explain — or the team can plainly say the idea failed and why.

**Counterfeit Improve:** training delivered as if it were the fix, buying software as if it were the fix, a site-wide rollout launched before the pilot even finished, a good week produced by hero-mode attention and reported as "the result" of the change.

## Control — it still works when the Belt leaves

Establish the new standard, a control plan (what gets charted, who actually looks at it, and what they do the moment a signal rule fires), SPC on Y itself or on the vital X, a named owner after the project formally closes, and a scheduled review date.

**Gate:** a new person, with no Belt in the room, can run the control plan correctly from the documentation alone.

**Counterfeit Control:** a binder nobody ever opens again, control limits quietly rewritten until the signal disappears, success declared right at the end of Improve and the process never actually checked on again.

## How this should look on a weekly page

Keep it to one strip: phase and next gate, the Y definition, baseline versus current, the specific blocker to the next gate, this week's experiment, and the owner.

Color the *project*, not the company:

- **Green** — on the phase plan, data actually flowing, no gate skipped.
- **Amber** — waiting on data, MSA, or access, but the path to get it exists and is moving.
- **Red** — Y is still mushy, a gate was skipped, a pilot ran with no real baseline, or the project was called "done" with no Control phase ever completed.
