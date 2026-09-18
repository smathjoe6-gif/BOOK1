# Nested Monte Carlo for Expected Utility

Nested Monte Carlo estimates the double expectation that defines myopic expected utility (`references/sequential-bayesian-design.md`):

```
Un(x) = E[θ~πn] E[y~p(y|x,θ)] [ u(πn+1(·|y), x, y) ]
```

Both layers are needed when `u` is a functional of the *updated* posterior — `log det V(n+1)^-1`, entropy drop, 0-1 decision loss, posterior odds. If `u = log det I(x,θ)` instead, the inner `y` disappears and one-layer Monte Carlo is enough (this is the pseudo-Bayesian case in `references/bayesian-optimal-design.md`).

## The two loops

**Outer** — `θ(s) ~ πn`, for `s = 1, ..., S`. This is parameter uncertainty.

**Inner** — for each `s` and each candidate `x`:

```
y(s,t) ~ p(y | x, θ(s)),   t = 1, ..., T
```

For every pair, form `π(s,t) = π(θ | dn, x, y(s,t))` and evaluate `u(s,t)`.

```
Ûn(x) = (1/S) Σs (1/T) Σt u(s,t)
```

Cost is `O(|X| · S · T)` inner posterior updates — one per candidate, per outer draw, per inner draw. That's why people cheat on this.

## Bias lives in the inner posterior

An exact `πn+1` is rare in practice.

- **Conjugate update** — unbiased given the draws.
- **Laplace at the new mode** — biased when `n` is small or the posterior is skewed. The usual plant-scale compromise anyway.
- **Importance weights** from the same `θ(s) ~ πn` — unbiased in principle, ugly variance if `y` turns out surprising.
- **One-step MCMC** from `πn` — carries leftover bias from not actually mixing.

If `u` is a posterior mean of some `φ(θ)`, reweighting the existing particles is enough. If `u` is entropy or `det V`, a particle *estimate of that functional* is needed — not a weighted mean of `φ`.

Nested MC estimates of a marginal likelihood are biased low for finite `T`. Any information-gain utility that contains `log p(y)` inherits that bias. Keep `T` fixed across every candidate `x` so the *ranking* can still be trusted even while the absolute number is biased, or use a better marginal-likelihood estimator.

## Where to spend draws

```
Var(Û) = (1/S)·Var_s(ū(s)) + (1/ST)·E_s[Var_t(u|θ(s))]
```

Wide `πn` → buy `S`. Noisy inner loss (discrete `y`, 0-1 loss) → buy `T`. Smooth `u` with a conjugate inner update → `T=1` and spend the whole budget on `S`.

**Common random numbers: freeze one set `{θ(s)}` and reuse it for every candidate `x`.** This is not optional — independent `θ` draws per candidate make the ranking noise-dominated before any real signal shows through. Couple the `y` draws too when the likelihood family allows it.

## Do not declare a winner if

```
Û(1) - Û(2) ≲ 2 · SÊ(Û(1) - Û(2))
```

Double the layer that dominates the variance split (per the formula above) and re-estimate only the current shortlist — not the whole candidate set again.

For a fixed budget `B = S·T` per candidate, start around `S=200`, `T=1–4`; for 0-1 loss push `T` to 4–10. Then look at the actual variance split instead of guessing at it.

## A usable procedure

1. Draw and freeze `θ(1:S) ~ πn`.
2. For each `x`, run the inner `T` draws, average `u`, store a jackknife or batch-means standard error.
3. If the top gap is inside that standard error, raise `S` or `T` on the top set only.
4. Return the best *operable* `x` — not the best `x` on paper if it can't actually be run.

Don't spend the budget on a finer `X` candidate grid before that top-gap comparison is actually resolved.

## When not to nest

- Linear-Gaussian with a closed-form posterior: exact inner `u`, outer MC only — no need to nest.
- Utility of the form `u(x,θ)` with no dependence on the updated posterior: one layer, per `references/bayesian-optimal-design.md`.
- Huge candidate set: use an expected-information shortlist first, and spend nested MC only on the last few `x` left standing.

**Usual fakes:** independent `θ` draws per candidate (kills the ranking); `T=1` on a 0-1 loss with a winner declared at the third decimal; harmonic-mean nested marginals sold as "information gain"; comparing `Û` values computed with different engines or different `(S,T)` settings as if they were on the same footing.
