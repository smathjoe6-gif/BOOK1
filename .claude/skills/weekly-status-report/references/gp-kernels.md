# GP Kernels

A GP kernel `k(x,x')` is the prior on functions. In BO (`references/bayesian-optimization.md`) and GP-TS (`references/thompson-sampling.md`), it **is** the scientific claim. EI's `σn(x)` and TS's sample paths both come straight from it. Switching acquisition functions will not repair a wrong `k`.

Recode `x` into a unit box (or honest physical units) before anyone discusses lengthscale values — a lengthscale of "3" means nothing on its own.

## What `k` is asserting

- **Lengthscale `ℓ`** — how far in `x` before `f` forgets.
- **Smoothness** — how differentiable the sampled paths are.
- **Amplitude `σf²`** — the prior scale of `f`.
- **Stationarity** — whether dependence runs only through `x - x'`, or not.
- **Extra structure** — a period, additivity, a linear trend.

## The stationary defaults

**Squared-exponential / RBF:**

```
k_SE(r) = σf² exp( -r² / (2ℓ²) )
```

Infinitely smooth. Distant points stay more correlated than most plants actually deserve. It's the tutorial default — often the wrong plant default.

**Matérn** with parameter `ν`:

- `ν = 1/2` — exponential; rough, not even mean-square differentiable.
- `ν = 3/2` — once differentiable.
- `ν = 5/2` — twice differentiable; the usual engineering kernel.
- `ν → ∞` — recovers SE.

No smoothness story to tell → default to Matérn 5/2, not SE.

Add a nugget `σn²` on observations. Plant data always need one. A tiny nugget on a noiseless simulator is pure numerics — say so explicitly rather than implying it's real observation noise. With small `n`, `σn` and `σf` trade off against each other; put a prior or a floor on `σn` so the optimizer can't quietly explain away real noise as smoothness.

## ARD

One `ℓd` per input dimension. That's only "automatic relevance detection" once the `ℓd` are actually identified by the data. In high `D` with 25 points, they pin to their bounds instead: some dimensions go infinitely long (effectively ignored), some go nearly zero (pure wiggle). That's usually a **fitting failure**, not a genuine domain discovery — print `ℓd` in both coded and raw units before believing either extreme.

## Structure by composition

Sums and products of kernels are still valid kernels.

- **Sum** — independent components (a linear trend plus a Matérn residual).
- **Product** — an AND of structures (periodic × Matérn = locally periodic).
- **Additive / ANOVA** — per-dimension kernels plus selected interactions. Helps once `D` is large and main effects are believed to dominate.

A product of 1-D SEs is just SE-ARD. A sum of 1-D Matérns is a genuinely different prior — TS paths under it look like main effects plus smaller couplings, not one smooth joint surface.

Other named options: periodic (needs a period, or a tight prior on one), rational quadratic, spectral mixture (overfits at small `n`), deep kernels / input warping (non-stationary; usually hungrier for data than a BO budget can supply).

**Do not put a Euclidean RBF on one-hot categorical encodings** — that is not a discrete kernel, whatever the library lets you do.

## Fitting

Type-II maximum likelihood on `(ℓ, σf, σn)` is the default, and it's greedy: it favors a slightly longer `ℓ` and a slightly larger nugget, which under-explores relative to the truth. With `n ≲ 30`, MAP with weakly informative priors on the log-parameters is the grown-up default instead. Re-fit every few evaluations — not as a religion after every single shot.

If `ℓ` or `σn` slam into the optimizer's bounds, don't trust the next EI or TS point that comes out of that fit. Fix the scaling or the kernel family first.

## What to start with

| Situation | Kernel |
|---|---|
| Unknown plant / simulator | Matérn 5/2 + ARD + nugget |
| Very smooth code | SE + small nugget |
| Rough field | Matérn 3/2 or 1/2 |
| Named trend | Linear + Matérn sum |
| Duty cycle | Locally periodic |
| `D ≳ 15`, little data | Additive Matérn or more structure — vanilla ARD-SE rots here |

## Weekly strip

Kernel family and `ν`, ARD lengths (coded and raw), `σf` and `σn`, whether any bound was hit, sum vs. product structure.

**Usual fakes:** SE chosen because that's what the tutorial used; pinned ARD lengths at `D=40, n=25` read as "those factors don't matter" rather than as a fitting failure; a free period learned from 12 points; swapping the kernel family every week to chase last night's acquisition result instead of fixing what was actually wrong.
