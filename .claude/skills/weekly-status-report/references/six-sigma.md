# Six Sigma

Six Sigma is a project method for shrinking variation that creates defects against a spec. Motorola and GE made the brand well known. It is not a synonym for "quality" in general, not the same thing as Lean, and not a belt count — a project with a Black Belt attached but no defined Y is not a Six Sigma project, just a project with a title on it.

## What the name claims

A "6σ" process, under the usual 1.5σ long-term shift convention, is treated as roughly 3.4 DPMO (defects per million opportunities). That is a **design target**, not something a live process owes every Friday — most real processes running well are nowhere near it, and that's fine.

What you actually need to say anything meaningful about a live process:

- A **defect definition** and an **opportunity definition** — without both of these agreed and written down, a DPMO number is politics, not measurement.
- **DPU, yield, rolled throughput yield** as the actual working metrics.
- **Stability on a control chart** before ever quoting `Cp`/`Cpk` or `Pp`/`Ppk` — capability numbers computed on an unstable process are just noise dressed up as precision.
- A **documented spec**. Capability without a spec is a number looking for a home; it has nothing to be measured against.

If the mean is still wandering, don't publish a `Cpk`. There isn't a process yet to characterize — there's weather.

## Two shapes — do not mix them

**DMAIC** improves a process that already exists — see `references/dmaic.md` for the full detail on each phase's gate criteria and the specific counterfeit version of each phase to watch for:

| Phase | Job | Gate |
|---|---|---|
| Define | Problem, customer CTQ (critical-to-quality), scope | Charter, the Y, defect definition |
| Measure | Baseline the Y, and the measurement system itself | MSA result, current yield or DPMO, as-is map |
| Analyze | Evidenced causes, not a voted-on fishbone diagram | The vital few Xs |
| Improve | Change those Xs | Pilot result versus baseline |
| Control | Hold the gain | Control plan, named owner, chart, reaction rule |

**DMADV / DFSS** (Design for Six Sigma) designs capability *before* volume — concepts and tolerances come first; it is not a retrospective run on a production line that doesn't exist yet.

Run DMAIC on a process that doesn't really exist yet and the "Measure" phase collects anecdotes instead of data. Run DFSS on an already-stable line that just has one noisy X and the result is redesigning an entire factory to avoid tightening one wrench.

## The statistical spine

- **MSA (Measurement Systems Analysis) first.** If the gage itself eats up most of the observed variation, everything in Analyze is fiction built on top of noise. See `references/msa.md` for the full study design and how to read the result.
- **Control charts separate common cause from special cause.** Reacting to common-cause variation as if it were special is tampering — this is Deming's point, one Six Sigma borrowed and then frequently forgets in practice. See `references/spc.md` for the full chart mechanics, signal rules, and the capability-ordering rule.
- **Capability only after stability** is demonstrated on the chart, never before.
- **Tests and confidence intervals** whenever a before/after claim is made — name the actual test used and the sample it was run on, don't just assert "it improved."
- **DOE (Design of Experiments)** when several Xs are plausible causes; one-factor-at-a-time experimentation will flatter whichever factor was already the team's favorite going in.
- **FMEA as a risk list**, not a score-maximization ritual where the goal quietly becomes making the RPN number look good rather than finding real risk.

With no data yet, a weekly report may legitimately hold a charter and a measurement plan. It may not hold a p-value it doesn't have.

## Belts are org design, not a badge

Champions remove organizational barriers. Black/Green Belts actually run the project. Master Black Belts keep the method itself from decaying into slideware. The status line that matters is **phase and next gate** — not belt color. A belt with no defined Y and no named owner is just a title.

## Next to Lean and TOC

Three different enemies:

- **Six Sigma's** enemy is variation against a spec.
- **Lean's** enemy is waste, unevenness, and overburden (see `references/lean-manufacturing.md`).
- **TOC's** enemy is a starved or misused constraint (see `references/theory-of-constraints.md`).

**They stack well** when Lean shows the full stream, TOC names the actual drum, and Six Sigma is pointed at a genuinely high-variation step that's either stealing drum time or creating defects the customer actually sees.

**They rot together** when every department gets handed a belt project so activity *looks* like improvement across the org chart, or when a beautifully executed DMAIC perfects a step that doesn't sit anywhere near the constraint or the real value stream — a perfect improvement to the wrong thing.

Policy problems (forecast-push, blanket utilization KPIs) are Thinking Process work (`references/toc-thinking-processes.md`), not a t-test. Batch-push is a Lean release-rule problem. Reaching for DMAIC as the only hammer available is exactly how Six Sigma became a punchline on some plant floors.

## What belongs on the weekly page

Phase, the Y and its defect definition, baseline versus current, MSA status, the vital few Xs once the project has reached Analyze, and the pilot or control-plan owner.

Color a Six Sigma *project* from whether its gate is honest — did it actually earn the next phase, or did the calendar just move it there. Do not color the *enterprise* Green just because a belt project moved forward this week while the drum is Red or the rope is cut elsewhere — a healthy side project doesn't offset a starved constraint.
