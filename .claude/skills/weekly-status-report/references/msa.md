# Measurement Systems Analysis (MSA)

MSA asks one question before DMAIC's Analyze, before SPC, and before quoting any `Cpk`: **is this number mostly the process, or mostly the gage?** Every other reference file in this skill that says "MSA first" (`references/six-sigma.md`, `references/dmaic.md`, `references/spc.md`) means: do this study, fully, before trusting anything built on top of the measurement.

A measurement system can fail in several distinct ways. Gage R&R, on its own, only covers two of them:

| Component | Question |
|---|---|
| Bias | Does the average miss a known reference value? |
| Linearity | Does that miss change across the measurement range? |
| Stability | Does the gage wander over calendar weeks? |
| Repeatability | Same part, same person, same device — how much scatter? |
| Reproducibility | Different people or devices, same parts — how much scatter? |
| Discrimination | Does the resolution actually slice the process into groups, or just print two blobs? |
| Attribute agreement | For pass/fail calls, do people — and the standard — actually agree? |

A pretty Gage R&R number on a biased, drifting gage is still a bad measurement system. R&R alone never proves the gage is trustworthy.

## Variable studies — do them in this order

1. **Resolution first.** Discrimination should be roughly one-tenth of the variation or tolerance actually being cared about. If every part reads 10.0 or 10.1 and nothing else ever shows up, stop here — that's the whole story already. Software printing three decimal places is not the same thing as real resolution.
2. **Stability.** Put a check standard on an I-MR chart over calendar time (`references/spc.md`). A special cause showing up on *that* chart is the gage itself moving, not the process.
3. **Bias and linearity.** Measure known reference values across the range. `Bias = average − reference`. If the bias changes slope as magnitude changes, a single offset correction will not fix it — the gage needs recalibration or replacement across the range, not a fudge factor.
4. **Gage R&R.** A usual design: roughly 10 parts × 3 appraisers × 2–3 replicates. The parts must actually span the process's real range — not a tray of hand-picked golden units that all look the same. ANOVA is the preferred method; the older range method is a fallback when ANOVA isn't available.

## How to read Gage R&R

Total variation splits into part-to-part, repeatability (equipment), reproducibility (appraiser), and sometimes an appraiser-by-part interaction.

**Two denominators — never mix them:**

- **Versus process** — is this gage good enough to *watch* the process on a control chart?
- **Versus tolerance** — is it good enough to *police* a spec?

AIAG-style bands (a policy convention, not a law of physics): under 10% is adequate, 10–30% is marginal, over 30% means stop and fix the measurement system before anything else.

```
ndc ≈ 1.41 × σ(part) / σ(measurement system)
```

Below `ndc = 5`, the gage cannot sort the process into meaningfully distinct groups. Do not put that Y on a control chart and pretend otherwise — a chart built on a gage that can't discriminate will show noise, not signal, no matter how carefully it's read.

**A common study-design trap:** studying only in-spec "jewel" parts makes part-to-part variation artificially tiny, which makes %GR&R look terrible even when the gage is perfectly fine for its actual job. That's a study-design error, not evidence the gage is bad — the sample has to span the process's real range, including the ugly parts.

## Attribute studies

For pass/fail, a grade, or a "defect or not" call: use many parts, deliberately including borderline ones, several appraisers, several passes each, and a known standard if one exists.

Publish: agreement with the standard, agreement between appraisers, agreement within the same appraiser across repeats, and **kappa** (agreement beyond what chance alone would produce).

A study with almost no real defects in the sample and 98% agreement is flattery, not evidence — a system that never rejects anything isn't repeatable, it's blind, and the study never actually tested its ability to catch a bad part. Poor kappa specifically means the defect definition written back in Define was never truly operational — the actual cause could be lighting, an unclear standard, inconsistent training, or the measuring device itself, and the study alone won't tell you which.

## Type I and Type II errors

For a gage policing a spec: **Type I** calls a good part bad (false reject). **Type II** calls a bad part good (false accept). A gage that's tight and biased in a particular direction can still look fine on an aggregate GR&R number while quietly shipping Type II errors straight to the customer — check the miss pattern, not just the summary statistic.

## What Measure should put on the page

Gage identity, study type, %GR&R versus process *and* versus tolerance, ndc, kappa or percent agreement versus the standard, and a plain verdict: **adequate / marginal / stop.**

**Stop** means DMAIC stays in Measure. Analyze run on that Y anyway is fiction — see `references/dmaic.md`'s Measure gate and counterfeit-Measure pattern.
