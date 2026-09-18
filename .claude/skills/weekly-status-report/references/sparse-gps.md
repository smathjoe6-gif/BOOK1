# Sparse GPs

A full GP with `n` points costs `O(n³)` to factor `Ky`. A sparse GP replaces that with an **inducing system** of size `m ≪ n` and an approximation to everything else. Complexity target: `O(nm² + m³)` to train, `O(m²)` per test point. It's an approximate prior/posterior, not a new acquisition — everything in `references/acquisition-functions.md` still applies on top of it.

**Do not turn on 64 inducing points at `n=40`.** That's a full GP with extra knobs, not a sparse approximation of anything.

## The shared idea

Locations `Zu = {u1, ..., um}`, values `fu = f(Zu)`. Every sparse method pretends the world talks to `f` **through** `fu`, then disagrees about the residual variance left on the training data `X`.

True conditional:

```
p(f | fu) = N( Kfu Kuu⁻¹ fu,  Kff - Kfu Kuu⁻¹ Kuf )
```

- **SoR** drops the residual entirely. Paths live in the span of `{k(·,ui)}`. Over-certain — a bad BO surrogate, since it can't admit uncertainty outside that span.
- **DTC** zeros the residual in the *likelihood* but keeps a better variance at test `x`. Likelihood and prediction disagree with each other by construction.
- **FITC** makes the residual on `X` **diagonal**. Cheap, popular. Variances aren't well calibrated, and optimized `Zu` can clump (a known FITC pathology). EI then chases junk holes or refuses genuinely real ones.
- **VFE / SGPR (Titsias)** lower-bounds the marginal likelihood and **penalizes** `tr(Kff - Qff)`. Usually the best-calibrated sparse regression GP available. Default choice when `n` is hundreds to a few thousand and everything fits in one batch.
- **SVGP** keeps an explicit `q(fu)` and trains with minibatches. Built for `n` in the thousands to millions. For BO with `n ≲ 10³`, VFE is already enough — SVGP's extra machinery isn't earning its keep at that scale.

**"Sparse GP" is not a method name.** Write VFE, FITC, or SVGP — whichever was actually used.

## Where `Zu` sits

Options: a random or k-means subset of `X`; `Zu` optimized under the VFE bound (these tend to spread out on their own); a fixed Latin grid in the unit box (stable when `d` is small). FITC-optimized locations are specifically the ones known to misbehave and clump.

Moving `Zu` on every BO evaluation makes `μn, σn` jump discontinuously between steps. EI/TS histories stop being comparable week over week when that happens. Freeze `Zu` for a stretch, or move it slowly. If `m ≈ n` ends up being needed for stability, `O(n³)` has effectively been paid again — the sparse approximation bought nothing.

## What BO actually consumes

EI/LCB/KG all need the sparse predictive `μn(x), σn²(x)`. **Train and predict with the same approximation.** FITC-train paired with VFE-predict is a silent third method that nobody actually chose on purpose.

qTS needs a **path**, not just point predictives. Sparse Matheron:

```
f̃(x) = f0(x) + k(x,Zu) Kuu⁻¹ (f̃u - f0(Zu))
```

with `f̃u` drawn from the `m`-dimensional sparse posterior (cheap, since `m ≪ n`). Factor `Kuu` once per step; draw `q` copies of `f̃u` (and of `f0`) off that one factorization. That's a draw from the *approximate* process, not the true one — say so. A hybrid RFF-prior-path-plus-inducing-correction is acceptable, again provided it's stated plainly (`references/matheron-rule.md` for the full non-sparse identity this generalizes).

Independent `N(μn(x), σn²(x))` at each `x` is still not TS here either — the independent-marginal trap doesn't go away just because the GP got sparse.

**KB on a sparse model must update the inducing posterior**, not a full `Ky` that no longer exists in this setup (`references/kriging-believer.md`).

## Chooser

| `n` | Start with |
|---|---|
| `≲ 200–300` | Full GP — no sparse approximation needed |
| Hundreds–few thousand, one-shot fit | VFE, `m ~ 64–256` |
| Huge `n`, streaming | SVGP |
| BO, small `d`, `σ` genuinely matters | VFE, frozen or slowly-moving `Zu` |
| Speed only, calibration doesn't matter | FITC/DTC — then distrust EI's "holes" |

## Weekly strip

Method (VFE / FITC / SVGP, named explicitly); `n`, `m`; how `Zu` was chosen and whether it's frozen; path-draw method (inducing Matheron / RFF hybrid); any bound hits on `ℓ` or `σn`.

**Usual fakes:** FITC plus aggressive `Zu` optimization presented as "the" sparse GP; `m ≈ n` defeating the whole point of going sparse; re-fitting inducing locations on every single evaluation; a write-up quoting full-GP Matheron cost while the actual code runs 32 inducing points.
