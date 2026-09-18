# Knowledge Gradient Variants — the map

Every Knowledge Gradient variant uses the same utility: after more data, the recommendation will be `argmin μ`, and the goal is the expected drop in that value. Variants change the set that may be measured, the set that may be recommended, noise/fidelity, how many `y`'s return together, and how the inner `min μ` is computed. **They do not change EI's object.** If the formula is `E[(f* - f(x))+]`, it is not KG — it's EI (`references/bayesian-optimization.md`).

## What may be recommended

- **Standard KG** — recommend `argmin_x μ(x)`. Native to noise. The default on a plant (`references/knowledge-gradient.md`).
- **Plug-in "KG" against `min yi`** — cheap, wrong when `σ² > 0`. Same trap as noiseless EI. Not a serious variant, whatever it's labeled.
- **Split sets** — measuring may happen anywhere in `X`, but recommending only from a catalog (or the reverse). The inner min is over the *recommend* set specifically. Write both sets down explicitly — a report that only names one is unauditable.

## Domain

- **Discrete KG** (the original). Finite arms. Posterior means are affine in one fantasy `y`. The exact expected minimum comes from breakpoints. Practical at a few hundred arms.
- **Correlated discrete KG.** Same formula, with a kernel placed among the arms. Still exact. This is discrete KG run with a GP prior, not a new utility.
- **Continuous GP-KG.** No closed-form inner min exists here. The "variants" are really estimators: discretize to an inner set and run discrete KG on it; Monte Carlo the `y` plus multi-start `min μ(n+1)`; or one-shot / stochastic-gradient through a softmin. An inner set that forgot `argmin μn` is not GP-KG — it's an understatement of KG wearing the name.

## Noise and fidelity

- **Noiseless** — `σ(z) = 0` after the shot. Simulators live here.
- **Noisy (default)** — one `y` only shrinks `σ(z)`, never zeroes it. If `σ²` is huge, KG ≈ 0 everywhere, and that's the correct answer, not a bug.
- **Heteroskedastic** — the choice is `(z, n_reps)`. Same `Δ min μ` utility, now with an explicit cost on replicates.
- **Multi-fidelity** — the next action is `(z, fidelity)`. Still KG only if the recommendation itself is high-fidelity `min μ` — a multi-fidelity method that recommends off a low-fidelity surrogate isn't KG anymore.

## Parallel (batch) variants

| Variant | What's free | What's averaged |
|---|---|---|
| Joint qKG | Whole set `Z` | `y(1:q)` together |
| FA-greedy-KG | Current slot only | Prefix `y` + inner one-point `y` |
| Greedy 1-KG | Current slot | One-point `y` on a working GP |
| KB-greedy-KG | Current slot | No `y` integral; a lie `ỹ = μ` |

Same utility family throughout — different information patterns. Joint can buy a purely informational site in slot 1. Greedy can never revise `z1`. KB can't keep two prefix-worlds alive simultaneously. Full detail: `references/qkg.md`, `references/fa-greedy-kg.md`.

## Constraints, many Ys, other functionals

- **Constrained KG** — the inner min runs over the feasible posterior only; a given fantasy world can turn out empty.
- **Multi-objective** — expected hypervolume of the posterior-mean Pareto front, or a scalarizer that's actually willing to be printed and defended.
- **KG on a functional `g(μ)`** (a contour, a GP-ED50, a worst-case over a subset) — the "min" *is* `g` itself. This is the bridge to parametric sequential design (`references/sequential-bayesian-design.md`) without changing the name of the method.

KG is not GP-only. Discrete KG began on independent Normals. A forest or ensemble surrogate works fine if it produces a posterior mean that updates in `y`. If it doesn't produce that, what's actually running is Thompson Sampling (`references/thompson-sampling.md`) mislabeled as KG.

## Hygiene every continuous variant shares

Decision incumbent = `argmin μ`, never `argmin yi`. The inner set must include that incumbent, high-`σ` sites, and the last batch. The top-two KG gap has to beat its Monte Carlo standard error before a winner is declared. Fantasy pairs never land in `Dn`.

## Chooser, in short

- Named arms → exact discrete KG.
- Box and `q=1` → GP-KG with a real inner set.
- Noisy small batch, care about `argmin μ` → joint qKG or FA-greedy-KG.
- No joint budget → KB-greedy, and say so plainly.
- Replicates or fidelities are part of the decision → use those variants explicitly, not a silent extra loop bolted onto standard KG.

**Usual fakes:** EI relabeled as "look-ahead KG"; ten random box points passed off as GP-KG; a min-`y` plug-in run on a genuinely noisy plant; a report titled "joint qKG" whose code is actually KB+EI.
