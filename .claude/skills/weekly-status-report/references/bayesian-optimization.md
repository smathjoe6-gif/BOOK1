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

Kernel choice is the scientific claim being made — see `references/gp-kernels.md` for the full family (Matérn `ν` choices, ARD, sums/products/additive structure, and fitting). Matérn 5/2 is the usual engineering default; squared-exponential is smoother than most plant behavior actually is; Matérn 3/2 is rougher. Put a nugget on plant data — it's never noiseless. ARD lengthscales (one per dimension) should be watched: pinned at their bounds means bad input scaling or the wrong kernel family, not a finished fit. Always recode `x` into a unit box before fitting.

When `n` leaves the few-hundreds, move to sparse GPs. When `x` mixes discrete and continuous factors, TPE or a forest-based surrogate often lies less than a kernel forced onto data it doesn't fit. A Bayesian network is a different inductive bias entirely, not a free upgrade over a GP.

## The algorithms people name are acquisitions

Write `f*n` for the incumbent (best observation or best posterior mean — pick one and be consistent).

| Acquisition | What it maximizes | Character |
|---|---|---|
| PI | Chance of beating `f*n - ξ` | Exploits; collapses early |
| EI | Expected improvement over the incumbent | Default; closed form under a GP |
| LCB/UCB | `μ - κσ` (for minimization) | Exploration is entirely the `κ` schedule |
| Thompson | Minimize a posterior draw `f̃` | Exploration via samples; natural batches — see `references/thompson-sampling.md` |
| PES / MES | Information about `x*` or `f*` | Explores the minimizer, not all of `f` |
| Knowledge gradient | Expected drop in `min μ` after one `y` | One-step look-ahead on the actual decision — see `references/knowledge-gradient.md` |

EI and LCB are the workhorses. Reach for PES/KG when each run genuinely hurts and `d` is small — see `references/knowledge-gradient.md` for KG specifically.

### What EI actually computes

Let `μn(x), σn(x)` be the GP posterior, and `f*n` the incumbent (see the noise catch below). For minimization, improvement is `(f*n - f(x))+`. Under a Gaussian posterior:

```
EI(x) = σn(x) · ( z·Φ(z) + φ(z) ),   z = (f*n - μn(x)) / σn(x)
```

(`Φ, φ` = standard Normal cdf/pdf). If `σn = 0`, EI is 0 unless `μn` already beats `f*n`.

So EI is a **closed-form functional of the marginal at `x`** — it doesn't use posterior covariance between two locations except insofar as that covariance already shaped `μn, σn` at that one point. This is the key difference from GP-TS (`references/thompson-sampling.md`), which needs the full correlated path.

### The incumbent problem (where EI gets sloppy)

Two common choices of `f*n`:

- **Best observed `y`** — correct only if noise is negligible.
- **Best posterior mean** on the evaluated set — the honest noisy-EI default.

Classic "noiseless EI" measured against a lucky noisy observation keeps proposing points next to that fluke, because beating a too-good `f*n` looks hard everywhere else. GP-TS doesn't have this knob at all: it minimizes `f̃`, whose scale already knows `σ²`. A small slack `ξ` added to EI/PI is a patch for this, not an actual noise model.

### Side-by-side with the other acquisitions

| | EI | GP-TS | LCB/UCB | PI | Knowledge gradient |
|---|---|---|---|---|---|
| Uses | `μn(x), σn(x)` only | A full sample path `f̃` | `μn - κσn` | `P(f < f*n - ξ)` | Expected drop in `min μ` after one `y` |
| Explores because | Mass in the right tail of the marginal | Different worlds have different minimizers | You chose `κ` | Slack `ξ` | Value of changing the decision |
| Tuning knob | Incumbent + optional `ξ` | Kernel / prior (no extra `κ`) | `κ` | `ξ` | Almost none, but expensive |
| Batch | Needs qEI (joint, costly) | Draw `q` paths | qUCB or fantasize | Awkward | Worse |
| Noisy `y` | Classic EI-on-best-observation breaks | Paths already include the noise model | Still well-defined | Same issue as EI | Designed for it |
| Typical failure | Collapse on the incumbent; ignores where the min actually sits | Bad kernel / fake independent-marginal draws | Wrong `κ` | Pure exploitation | Compute cost |

### Exploration character

EI explores where `σn` is large *and* `μn` is still competitive — it won't visit a region that's uncertain but clearly worse on the marginal. That's usually the right call on a plant.

GP-TS will occasionally visit such a region anyway, because some drawn paths still dip there. That extra movement is useful when the kernel can genuinely imagine a thin well; it's wasted motion when the kernel is simply wrong.

LCB makes the exploration trade-off an explicit `κ`. EI's trade-off is baked into the Gaussian tail instead — people who "don't want to tune anything" by choosing EI are still tuning the kernel and the incumbent definition, just less visibly.

### Batches: qEI versus qTS

True qEI is the expected improvement of the whole batch as a set — a `q`-dimensional Gaussian integral. In practice it's approximated (Monte Carlo, fantasize-and-EI, moment matching).

qTS is simpler: `q` independent paths, `q` minimizers, de-duplicate. When the posterior still has several live stories, qTS is the practical batch method. When it doesn't, both methods end up cloning the incumbent.

### When to prefer which

Prefer EI when a deterministic, cheap, auditable next point from `μ, σ` is wanted; `d` is modest; noise is low or noisy-EI is switched on; the next `x` needs to be explained from a plot without invoking a random path; and it's a single-point proposal, not a plate of `q=8`.

Prefer GP-TS when noise is real, a batch is needed without a joint acquisition, or exploration should come from the posterior itself rather than from `ξ` and `κ`. Prefer LCB when the exploration trade-off needs to sit on a schedule that can be written straight into an SOP. Prefer KG/PES when each run is extreme and `d` stays small.

`a_n(x)` itself is cheap to evaluate but multimodal — multi-start the inner optimization regardless of which acquisition is chosen. One local max of EI sitting right on top of last week's `x*` is exactly how BO stalls out and looks converged when it isn't.

## Constraints, batches, several Ys

A cheap-to-check constraint just masks the acquisition. An expensive constraint gets its own GP and an expected-feasible-improvement acquisition.

**Batch of `q`** — qEI, qUCB, `q` Thompson draws (one minimizer each, reject duplicates), or qKG (`references/qkg.md`) when the object is next week's recommendation rather than just the observed `y`. This is the plate-run or weekly-calendar version of BO, same idea as batch-sequential design generally (`references/sequential-design.md`).

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

If the policy is EI specifically: the incumbent definition (observed vs. posterior-mean), whether noisy-EI is switched on, the next `x`, `EI(x)/σn` as a scale-free sanity check, and whether the acquisition search used multi-start. A single local max of EI sitting at last week's `x*` is the usual silent failure to check for first.

**Usual fakes:** EI computed on raw engineering units instead of a unit box; noiseless EI applied to genuinely noisy Y; a different kernel family adopted every week with no stated reason; only one local max of the acquisition ever checked; calling plain GP+EI "sequential Bayesian experimental design" when there's no `θ` and no declared mean function at all.
