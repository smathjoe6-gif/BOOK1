# Knowledge Gradient (KG)

Knowledge Gradient is a one-step look-ahead on the **recommendation**, not on the sample about to be taken. After the next `y`, the recommendation will still be the minimizer of the posterior mean. KG picks the place to measure that most improves that minimizer in expectation.

EI (`references/bayesian-optimization.md`) asks: how much do I expect this `y` to beat the incumbent *at this point*? KG asks: how much do I expect `min_x μ` to fall *after* I've seen that `y`? The inner minimum can move to a completely different `x` than the one just measured — that's the method, not an edge case. See `references/kg-variants.md` for the full map of variants (domain, noise/fidelity, batch, constraints) that all share this one utility.

## The definition

Current recommendation:

```
x*n = argmin_{x∈X} μn(x)
```

One measurement at design `z`, outcome `y`, updated mean `μ(n+1)(· | z,y)`. For minimization:

```
KGn(z) = E_y[ min_x μn(x) - min_x μ(n+1)(x | z,y) ]
```

If `y` can't change who wins, KG is ~0 even when EI looks huge sitting next to a lucky noisy observation. KG was built for noise from the start — `σ²` is already inside the GP update, and there's no "best observed `y`" anywhere in the formula.

When noise is enormous, one `y` barely moves `μ`, KG comes out small everywhere, and the method is correctly saying that the budget on offer won't change the decision.

## Discrete versus continuous

On a finite set of arms, the posterior means update as lines in the scalar `y`, and the expected minimum of those lines has a known closed form — exact discrete KG on a few hundred alternatives is practical to run directly.

On a continuous box, `min_x μ(n+1)` has no closed form. Two practical routes:

- **Discretize `X`** (the inner set must include the current `argmin μn`, high-uncertainty sites, and last batch's points) and run discrete KG on that set.
- **Fantasy `y`'s** — draw several, re-minimize `μ(n+1)` for each, average (one-shot / stochastic-gradient KG).

A 20-point inner set that forgot to include the current incumbent understates KG systematically — always name the inner set used, since the number depends on it.

`qKG` is the same expectation after a batch `z(1:q)` — see `references/qkg.md` for the joint form and its approximations. The fantasy `y` there is `q`-dimensional; joint qKG is heavy, so greedy sequential addition of points is the usual approximation people actually ship — see `references/fa-greedy-kg.md` for the fantasy-averaged version of that greedy loop specifically.

## Versus EI and GP-TS

| | KG | EI | GP-TS |
|---|---|---|---|
| Pays for | A better `argmin μ` after `y` | Beating the incumbent at `z` | Being optimal in one drawn path |
| Will measure a point never recommended | Yes, if it splits two basins | Almost never on purpose | Only if a wild path sits there |
| Noise | Native | Needs noisy-EI | Native |
| Cost | Inner mins, or `O(M² log M)` | Closed form | One path + one min |

KG is worth the extra compute when the last few runs are expensive, alternatives are discrete, or noise has already made EI-on-best-observation dishonest (see the incumbent problem in `references/bayesian-optimization.md`). It is not the weekly default on a cheap simulator in dimension 12 — the compute cost isn't earning its keep there.

## What to put on the page

The decision incumbent `= argmin μn` (never `argmin y_i`). The inner-set method and its size. The fantasy count used. The proposed `z` versus that incumbent. The gap between the top two `K̂G` values versus their Monte Carlo error.

**Usual fakes:** calling EI "look-ahead" (it looks ahead at `y`, not at the recommendation itself — that distinction is the whole method); discrete KG run on ten random box points with no stated inner-set rule; a noisy plant paired with EI-on-min-`y` and billed as KG when it's neither noise-aware nor recommendation-aware.
