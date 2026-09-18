# Bayesian Optimization

Bayesian optimization is sequential design (`references/sequential-design.md`) for an expensive black-box `f(x)` when the goal is a good `x*`, not a parameter `θ` in a mean function that's already believed. A surrogate stands in for `f`; an acquisition function picks the next `x`; `f` gets run; the surrogate updates.

Same loop shape as sequential Bayesian experimental design (`references/sequential-bayesian-design.md`). **Different object.** No Fisher information. No declared quadratic.

## The loop

1. Prior over functions (kernel + mean) and a noise model
2. Posterior `p(f | Dn)`
3. Maximize acquisition `a_n(x)`
4. Evaluate `y(n+1) = f(x(n+1)) + ε` (or a batch of `q`)
5. Stop on budget, a floor on improvement, or a regret bound actually computed

Myopic acquisitions are the default. Look-ahead acquisitions that buy information about the minimizer itself exist and are expensive.

## The surrogate is the prior

A Gaussian process is the default: at each `x`, `μn(x)` and `σn²(x)` come out in closed form.

Kernel choice is the scientific claim being made. Matérn 5/2 is the usual engineering default; squared-exponential is smoother than most plant behavior actually is; Matérn 3/2 is rougher. Put a nugget on plant data — it's never noiseless. ARD lengthscales (one per dimension) should be watched: pinned at their bounds means bad input scaling or the wrong kernel family, not a finished fit. Always recode `x` into a unit box before fitting.

When `n` leaves the few-hundreds, move to sparse GPs. When `x` mixes discrete and continuous factors, TPE or a forest-based surrogate often lies less than a kernel forced onto data it doesn't fit. A Bayesian network is a different inductive bias entirely, not a free upgrade over a GP.

## The algorithms people name are acquisitions

Write `f*n` for the incumbent (best observation or best posterior mean — pick one and be consistent).

| Acquisition | What it maximizes | Character |
|---|---|---|
| PI | Chance of beating `f*n - ξ` | Exploits; collapses early |
| EI | Expected improvement over the incumbent | Default; closed form under a GP |
| LCB/UCB | `μ - κσ` (for minimization) | Exploration is entirely the `κ` schedule |
| Thompson | Minimize a posterior draw `f̃` | Exploration via samples; natural batches |
| PES / MES | Information about `x*` or `f*` | Explores the minimizer, not all of `f` |
| Knowledge gradient | Expected drop in `min μ` after one `y` | One-step look-ahead on the actual decision |

EI and LCB are the workhorses. Reach for PES/KG when each run genuinely hurts and `d` is small.

Noiseless EI evaluated against the best raw observation misfires the moment `ε` is real. Use a noisy-EI variant, or improve against the posterior mean instead of a raw observed point.

`a_n(x)` itself is cheap to evaluate but multimodal — multi-start the inner optimization. One local max of EI sitting right on top of last week's `x*` is exactly how BO stalls out and looks converged when it isn't.

## Constraints, batches, several Ys

A cheap-to-check constraint just masks the acquisition. An expensive constraint gets its own GP and an expected-feasible-improvement acquisition.

**Batch of `q`** — qEI, qUCB, or `q` Thompson draws (one minimizer each, reject duplicates). This is the plate-run or weekly-calendar version of BO, same idea as batch-sequential design generally (`references/sequential-design.md`).

**Several Ys** — expected hypervolume or an explicit scalarizer. The honest answer is a Pareto set. Don't hide a genuine multi-objective tradeoff behind a single EI number.

## Versus RSM and parametric sequential Bayes

| | BO | Sequential RSM | Parametric sequential Bayes |
|---|---|---|---|
| Object | Black-box `f` | Low-order polynomial | `θ` in a named mean |
| Next `x` | Acquisition | Ascent / axials / D-augment | Expected utility of `π(θ|y)` |
| You want | A good `x*` | An interpretable surface | Precise `θ` or `g(θ)` |

Use RSM (`references/rsm.md`) when the result has to explain a quadratic in two or three factors to a non-specialist. Use parametric sequential Bayes (`references/sequential-bayesian-design.md`) when the science itself is the rate constant or the ED50. Use BO when nobody's going to write down a mean function, evaluations are genuinely expensive, and `d` stays modest — vanilla ARD GPs rot once dimension climbs toward 80 with only 30 runs to show for it.

## Weekly strip

Surrogate and kernel, acquisition in use, best `(x,y)` found so far, next `x` (and batch size `q`), lengthscale/noise health, whether constraints carry their own model.

**Usual fakes:** EI computed on raw engineering units instead of a unit box; noiseless EI applied to genuinely noisy Y; a different kernel family adopted every week with no stated reason; only one local max of the acquisition ever checked; calling plain GP+EI "sequential Bayesian experimental design" when there's no `θ` and no declared mean function at all.
