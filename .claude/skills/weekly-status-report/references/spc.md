# Statistical Process Control (SPC)

SPC is Shewhart's rule for a running process: decide whether the last point is just the process talking, or something extra happened. Deming's warning sits directly on top of that rule: treat common-cause variation as a special event and you tamper — and tampering makes the process *worse*, not better.

## Two kinds of variation

- **Common cause** — the variation this process produces every single day, inherent to how it's built. To shrink it, you have to change the system itself.
- **Special cause** — an extra, identifiable event (wrong lot, a broken tool, a new operator running without the standard, a one-off expedite). You hunt down *that specific event*. You do not rewrite the whole standard over one special-cause point.

Spec limits answer "would the customer accept this unit." Control limits answer "is this still the same process." Plotting USL/LSL on a chart and calling them UCL/LCL is not SPC — it's a spec check wearing a control chart's costume, and it will systematically miss both false alarms and real signals.

## What a chart actually is

Plot a statistic — an individual value, a subgroup mean, a range, a proportion, a count. The center line is the process's own location, taken from a **stable baseline** — it is not the target, and it is not the middle of the spec. Limits are:

```
CL ± 3σ̂
```

where `σ̂` comes from within-subgroup variation (or the moving range, on an I-MR chart) — from the process as it actually behaves, not from the spec.

Recalculate limits only after a genuine change *and* a new stable stretch of data has accumulated. Recalculating every Friday so the chart conveniently looks "in control" is one of the most common ways people lie with SPC, deliberately or not. Until there's a decent baseline (commonly ~20–25 subgroups, or ~20+ individual points), call the limits **trial limits**, not final ones.

## Which chart

| Situation | Chart |
|---|---|
| One measurement at a time | I-MR |
| Rational subgroups of 4–5 | Xbar-R (or Xbar-S) |
| Fraction defective, large n | p (np if n is fixed) |
| Defect counts | c or u |
| Rare events | t or g — not a p-chart full of zeros |
| Short-run mixed jobs | Difference-from-nominal or Z charts |

A **rational subgroup** puts common-cause variation *inside* the group, so that special causes show up *between* groups instead. A grab bag pulled from the warehouse is not a rational subgroup. Mix several shifts or several tools into one subgroup and the limits go artificially fat — nothing ever signals, even real problems. Filter and sort too aggressively instead, and within-group variation shrinks artificially, the Xbar limits go too tight, and everything starts looking like a special cause that isn't one.

Look at the **range chart**, not just the Xbar chart. Many special causes show up there first — a widening range often precedes a shift in the mean. An Xbar chart alone is only half the sentence.

## When to call a signal

The original Shewhart rule: **one point outside 3σ.**

Western Electric / Nelson add extra rules on top of that. Use a short, written list, decided in advance — turning on every possible rule at once turns the false-alarm rate itself into a second process you now have to manage.

A sane default set:

- One point beyond 3σ
- 2 of 3 consecutive points beyond 2σ, on the same side
- 4 of 5 consecutive points beyond 1σ, on the same side
- 8 or 9 points in a row on one side of the center line
- 6 or more points in a row rising, or falling
- 15 points in a row hugging the center line (variation has collapsed — this is also a real signal, not a good-news story by default)

Name the exact rule set being used. Do not keep adding rules retroactively until last Tuesday's point looks guilty of something.

## Capability is a later verdict

Only compute this **after** the chart is demonstrated stable:

```
Cp  = (USL - LSL) / 6σ̂
Cpk = min( (USL - μ̂)/3σ̂ ,  (μ̂ - LSL)/3σ̂ )
```

`Cp`/`Cpk` use *within*-subgroup variation. `Pp`/`Ppk` use *overall* variation. Do not mix the two — they answer different questions and aren't interchangeable inputs to the same formula. And never compute either one while the process is still out of control; a capability number computed on an unstable process describes nothing repeatable.

Two distinct bad stories that look superficially similar but need very different responses:

- **In control, and incapable** — stable junk. The process is doing exactly what it always does, and what it always does doesn't meet spec. Quality goes Amber/Red from *spec risk*, not from chaos — more inspection and firefighting won't fix this, the system itself needs to change.
- **Inside spec this week, but out of control** — a lucky streak, not a result to trust. Do not color this Green; an out-of-control process will eventually produce a bad unit, it just hasn't yet.

## Three cases textbooks skip

- **Short run.** Real short-run work will never give you 25 identical subgroups of the same part. Chart difference-from-nominal across similar jobs instead, or run I-MR on the thing that actually repeats (cycle time, first-pass yield) rather than the part dimension itself. Do not pool unlike products together just to artificially fill a subgroup to n=5 — that manufactures a rational subgroup that isn't actually rational.
- **Autocorrelation.** A daily backlog figure that includes yesterday's number, or a continuous sensor feed, will make a plain Shewhart chart fire on nearly every point — the data isn't independent, so the usual control-limit math no longer applies cleanly. Sample less often, chart residuals from a simple time-series model instead of the raw series, or add EWMA/CUSUM specifically to catch small sustained drifts — and say explicitly which of these was done. Do not just swap in a smoother and quietly lose the common-cause/special-cause language that makes the chart useful to talk about.
- **Transactional work.** Cycle-time clocks and wrap/disposition codes follow exactly the same rules as a physical measurement, once MSA has actually been run on them (`references/msa.md`) — a wrap code is still a measurement, and can still have bias, drift, or poor inter-rater agreement. A weekly KPI number with a flat 95% target line drawn across it is not a control chart; it has no baseline-derived limits and no common/special-cause distinction behind it.

## Next to Six Sigma, Lean, and TOC

SPC is the statistical backbone underneath DMAIC's Measure and Control phases (`references/six-sigma.md`). Lean needs it so andon is triggered by a real signal, not just noise dressed up as urgency. TOC needs it so nobody "exploits the drum" by twiddling its settings after every single point that comes off it — tampering with the constraint is still tampering.

SPC itself does not name the constraint, and it does not design pull. A beautifully in-control chart on a non-constraint step can coexist perfectly well with a starved, badly-managed drum elsewhere in the system — being in control says nothing about being on the constraint.

## Weekly color

- Special cause showing up on a CTQ characteristic or on the drum itself → at least Amber, until it has a named owner.
- Chronic out-of-control with no owner → Red on quality, regardless of what this week's units happened to measure.
- In control but incapable → color from the spec risk, not from the chart's stability.
- Lots landing inside spec this week while the chart itself is screaming is **not** Green — see "inside spec but out of control" above.
