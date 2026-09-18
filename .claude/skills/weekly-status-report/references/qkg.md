# qKG (Batch Knowledge Gradient)

See `references/kg-variants.md` for how this fits among every other KG variant (domain, noise/fidelity, constraints) that shares the same underlying utility.

qKG is Knowledge Gradient (`references/knowledge-gradient.md`) when `q` points return together. The look-ahead is one calendar step, not one shot. **Joint qKG is the definition** — greedy and fantasize variants are approximations to it, not alternate definitions.

## The joint object

The recommendation after the batch is still `argmin_x μ`. For a set `Z = {z1, ..., zq}` and predictive outcome `y ∈ ℝ^q`:

```
qKGn(Z) = E_{y|Z,Dn}[ min_x μn(x) - min_x μ(n+q)(x | Z,y) ]
```

The inner min is over **all of `X`**, not over `Z` itself — a member of `Z` can exist purely to split two basins apart, never intending to be the winner itself. If the `q` sites are duplicates, qKG should collapse toward ordinary one-point KG; if it doesn't, something in the implementation is wrong.

`y` is drawn from the **joint** posterior predictive at the `q` sites — including their correlations. That's exactly why packing four neighbors around the incumbent is usually worth less than two points placed in two different stories.

## Why the joint form is expensive

The expectation is `q`-dimensional. Each fantasy `y` needs a rank-`q` GP update and an inner `argmin μ(n+q)`. `Z` lives in `X^q` up to permutation. Exact discrete-KG-style formulas do not scale to a continuous box once `q=8`.

**Monte Carlo estimator:** draw `T` fantasies from `N(μn(Z), Kn(Z,Z) + σ²I)`, update, inner-minimize, average the drop in `min μ`.

Use common random numbers across candidate batches (the same `N(0,I_q)` mapped through each Cholesky factor) — otherwise the ranking is noise-dominated, same discipline as `references/nested-monte-carlo-utility.md`. Don't call a winner if the top-two `q̂KG` gap sits inside that standard error.

The inner min's candidate set must contain `argmin μn`, high-`σ` sites, the proposed `Z`, and last week's recommendation. If it can't represent a second basin, this isn't computing KG at all — it's computing something smaller dressed up as KG.

## Approximations people actually run

See `references/fantasy-average.md` for the general batch-scheduler pattern these approximations belong to — it's the same skeleton whether the base acquisition is KG, EI, or LCB. See `references/fa-greedy-kg.md` for the full side-by-side against FA-greedy-KG specifically — same utility family (expected drop in `min μ`), but disagreeing about which variables are free when that drop gets computed.

**Sequential greedy.** `z1 = argmax KG`. Then pick `z2` as KG on a GP that has already "seen" `z1`, and so on. How the still-unseen `y1` gets faked:

- **Kriging believer** — plug in `μn(z1)`.
- **Constant liar** — plug in a pessimistic constant.
- **Fantasy average** — average the next KG over several drawn `y1` (closer to the true joint value).

Greedy is not joint-optimal. It's the version that actually ships in practice.

**One-shot / stochastic-gradient qKG.** Treat `Z` as a point in the unit box, estimate qKG by Monte Carlo, differentiate through it. Watch for permutation symmetry (`z1 ↔ z2` are the same batch, not two candidates).

**Repulsion + 1-KG is not qKG.** It can still be a fine practical stand-in when the posterior already shows a few obvious, separated basins — but say that's what it is, rather than calling it qKG.

## Versus qEI and qTS

| | qKG | qEI | qTS |
|---|---|---|---|
| Pays for | Drop in `min μ` after the set | Best new `y` in the set | Minimizers of `q` independent paths |
| Informational sites (never meant to win) | Yes | Rare | Only if a path happens to sit there |
| Uses correlation inside the batch | Yes | Yes (`q`-d EI integral) | No — separate worlds entirely |

Use qKG when the week returns a small batch and the object that matters is *next week's recommendation*. Use qTS (`references/qts.md`) when a simple batch is enough and joint value isn't worth the compute — it takes the opposite attitude toward a collapsed posterior, reporting honestly that every sampled world wants the same point rather than forcing separation the way Kriging Believer does. Use qEI when the goal is improvement of the observed `y`, not of `argmin μ`. See `references/qkg-alternatives.md` for the full map of substitutes (including local penalization and hard min-distance rejection, which skip the fantasy GP entirely) and a chooser table — none of them are qKG, whatever they get called.

Honest joint MC is plausible at `q=2–4`. At `q=16` it's theater unless `X` is tiny. When only one basin is left in the posterior, qKG and qEI both degenerate to cloning the incumbent — shrink `q` rather than trusting the batch diversity to appear on its own.

## Weekly strip

Joint vs. greedy vs. one-shot; `q` and fantasy count; the inner-set rule; chosen `Z` versus `argmin μn`; the top-gap versus its standard error; whether the batch collapsed to clones.

**Usual fakes:** labeling greedy EI-with-repulsion as qKG; an inner min taken only over `Z` instead of all of `X`; independent (uncorrelated) fantasies used when ranking batches; a joint definition written in the report text while the actual code runs `T=8` on a 15-point grid.
