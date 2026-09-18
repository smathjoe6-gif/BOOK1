# D-Optimal Design

A D-optimal design is a set of runs chosen to make the parameter confidence ellipsoid as small as possible, **for a model declared in advance**. It's a strategy for illegal regions, mixed factor types, awkward run budgets, and augmenting data that already exists — it is not a universally better factorial. Change the declared model, and the "best" points move; the design has no meaning independent of the model it was built for.

See `references/doe.md` for the general design ladder this sits alongside, and `references/rsm.md` for the response-surface context this is often used within.

## What is actually being maximized

For `E(y) = Xβ`:

```
D-criterion ∝ det(X'X)
```

which shrinks `det((X'X)⁻¹)` — the volume of the confidence ellipsoid for β.

So the resulting plan is optimal for *that specific X* — those exact terms, that exact coding. A 10-run D-plan built to estimate main effects is a poor plan if interactions get fit later that were never declared up front. Work in coded units throughout; raw polynomial terms with huge raw x values make `X'X` numerically unstable in ways that have nothing to do with the actual experiment.

## D is not the only alphabet

| Criterion | Cares about |
|---|---|
| D | Precision of the coefficients as a set |
| A | Average variance of the individual β̂i |
| I (IV) | Average prediction variance over the whole region |
| G | Worst-case prediction variance anywhere in the region |
| E | The single worst direction for β |

D-optimal designs tend to park points out at the extremes of the region — good for pinning down slopes precisely, weaker if the actual intent is to contour a smooth surface across the middle. For RSM mapping specifically, **I-optimal** (or a standard CCD, when the region really is a box) is often the more honest default. If someone says "optimal design" while actually meaning "map Y across the region," ask which letter they mean — D and I answer genuinely different questions.

Relative D-efficiency needs an explicit reference design to mean anything:

```
D_eff = ( det(X'X)_this / det(X'X)_reference )^(1/p)
```

A bare efficiency percentage with no stated reference design is decoration, not evidence.

## How the plan is built

Fix the model, the region, `n`, and the candidate point set first. The algorithm starts from several random subsets and exchanges points while `det(X'X)` keeps rising. Different random starts can land on different final point sets with similar D-values — that's normal, not a bug. Freeze one resulting design and actually run it; don't keep re-running the algorithm hoping for a nicer-looking layout.

## Strategies that earn their keep

- **Constrained region.** "X2 cannot be high when X1 is also high" — put that constraint directly into the candidate set the algorithm searches over. A CCD that happens to include a physically forbidden corner isn't a conservative fallback, it's simply unrunnable.
- **Mixed factors.** Continuous factors alongside catalyst A/B, supplier, or shift — declare the dummy columns explicitly so the algorithm can use them. A standard `2^k` design has no way to represent this at all.
- **Fixed n.** Twelve reactor-days available, not sixteen — build the D- or I-optimal design specifically for the model those twelve runs can actually support, rather than shrinking a textbook design and hoping it still works.
- **Augment.** Eight factorial runs already exist; add four more, chosen under D or I, for the quadratic term now wanted. Don't throw the original eight away, and don't re-optimize the original point placement after already having seen Y — that reintroduces exactly the kind of bias randomization exists to prevent.
- **Blocks.** Weeks and material lots go into the declared model too, so the algorithm balances what the available n can actually support around them.
- **Sequential.** Drop dead terms, shrink the region, then optimize the *next* batch of runs. Peeking at results and regenerating the entire plan from scratch burns the randomization that made the first batch trustworthy.

## Lock this before hitting "Generate"

Model terms, factor types and their legal ranges, constraints, `n`, whether center points are forced in, D versus I as the criterion, and whether the actual interest is in β itself or in ŷ(x) predictions. Change any of this *after* seeing Y, and the analysis that follows is for a design that was never actually run.

Before the first real run: check whether D-optimality emptied out the interior of the region entirely (add center points, or switch to I-optimal instead), whether one extreme vertex is single-handedly carrying an entire quadratic term, and whether operations can actually hit the specific settings the design calls for. Running "close enough" to the planned settings and then analyzing as if X were exactly as declared is a *different*, worse experiment than the one that was designed.

## Versus a textbook factorial

If the region really is a simple box, the factors are all continuous, and `n` matches a standard `2^k` / CCD / Box-Behnken cleanly, use the textbook design. It comes with orthogonality and a clean alias structure that a supervisor without a statistics background can actually follow and sanity-check.

Only pay for the complexity of D/I-optimal design when the textbook design is either illegal (violates a real constraint) or simply the wrong size for the available budget. Orthogonality is usually gone once a computer-generated design is used — analyze it with the actual X matrix that was run, never with a `2^k` ANOVA table borrowed from a design that wasn't.
