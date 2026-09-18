# Response Surface Methodology (RSM)

RSM is the DOE stage (`references/doe.md`) used once a two-level factorial has already done its job and Y turns out to be curved in the Xs. The goal here is a local map — a peak, a floor, or a ridge — not another list of linear effects. It is not a first experiment; it's what comes *after* screening has already narrowed the field.

If the center points on the original factorial are quiet (no curvature signal) and there's still a crowd of live sliders, stay in screening — don't jump to RSM early. Fitting a quadratic surface to a Resolution III design and calling the result an optimum is exactly how pretty-looking saddle points get published without anyone checking whether they're real.

## The model

In coded units:

```
ŷ = β0 + Σ βi·xi + Σ βii·xi² + Σ(i<j) βij·xi·xj
```

Linear terms are slope. Cross terms are twist (interaction). Square terms are curvature. The whole surface is a **local approximation** — outside the box the design actually explored, it is fiction, not extrapolation.

## Designs that can support that model

**Central composite (CCD)** — a two-level factorial (or a fraction of one) plus axial "star" points plus center points.

- **Circumscribed** — axial points sit outside ±1; can be made rotatable; the actual process has to be able to survive running at those extremes.
- **Inscribed** — the whole design shrinks so the axials fit inside a hard operating box; safer, but with less leverage to detect curvature.
- **Face-centered** — axials sit on the faces of the cube, so only three levels are needed; easy to run in practice; not rotatable.

**Box-Behnken** — three levels, with no true cube-corner combinations at all. Fewer brutal (all-extreme) combinations to run. A natural fit at three factors. Do not use it for two — the design doesn't have enough structure at that dimensionality.

Irregular feasible regions, or combinations that are physically forbidden, are a real reason to leave the textbook designs behind and use a computer-generated optimal design instead (`references/d-optimal.md`) — say explicitly why that step was taken.

A CCD can be run **sequentially**: factorial plus centers this week, axial points added later — but only if the blocking was planned for from the start. A new material lot arriving between those two pieces of the design is a block, not a new factor; treat it as one or the model will silently confound it with the real effects.

## How the path is supposed to run

1. **Screen.** Kill the dead Xs first (`references/doe.md`).
2. **Factorial + centers** in the current operating region. If the surface is still flat there and the actual goal is just "higher" or "lower," use steepest ascent to move toward a new region instead of forcing a quadratic fit onto flat data.
3. Once centers in the interesting region show real curvature, add axial points (completing the CCD) or run a Box-Behnken design.
4. Fit the quadratic model. Test lack of fit explicitly. Classify the stationary point (see below).
5. **Confirm on fresh runs.** Only then write the new standard.

Jumping straight to step 4 with eight untested sliders still in the model is software theater, not RSM.

## Reading the stationary point

Take derivatives of the fitted model (or work from its canonical form):

- All eigenvalues negative → a local **maximum**.
- All eigenvalues positive → a local **minimum**.
- Mixed signs → a **saddle**. There is no interior peak here — say so plainly rather than reporting a false optimum.
- Nearly singular → a **ridge** — a whole line of nearly-equal settings, not one unique point. Report the ridge itself, not a fake single "best" point picked arbitrarily off it.

If the stationary point falls outside the box the design actually explored, it's a rumor, not a result. Move the operating region and run there instead — do not write an extrapolated point into an SOP.

`R²` is not the gate for any of this. **Lack of fit versus pure error** (estimated from the center points and replicates) is the real test. Residuals plotted against run order catch drift the model itself won't reveal. No single axial point should be allowed to single-handedly own the entire curvature estimate. Prediction is genuinely better near the center of a rotatable design than out at a corner — don't compare two corner points as though they carry equal confidence, because they don't.

## Several Ys and real constraints

An unconstrained peak that blows through a spec limit or a cost cap is not a usable operating point, however good it looks in coded units. Overlay contour plots across the relevant Ys, or use a desirability-function score to combine them. When multiple Ys genuinely conflict, the livable compromise belongs under **Decisions needed** in the weekly report — not silently baked into one coded-unit cell as if it were the obvious answer.

## Weekly strip

Stage (steepest ascent / quadratic fit / confirmation), design type, which factors are still live in the model, curvature and lack-of-fit status, whether the stationary point is in-region and what type it is (max / min / saddle / ridge), and confirmation-run status.
