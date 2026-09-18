# Quadrature Fourier Features (QFF)

Quadrature Fourier Features do the same job as RFF (`references/rff.md`) — a finite map `φ` with `φ(x)ᵀφ(x') ≈ k(x-x')` — but they **integrate** the spectral measure `Λ` instead of sampling it. The approximation is deterministic: the same `ℓ, ν, S` always produces the same `φ`.

## From Monte Carlo to a grid

Bochner's theorem again:

```
k(δ) = σf² ∫ cos(ωᵀδ) Λ(dω)
```

RFF draws `ωs ~ Λ`. QFF instead picks nodes `ωs` and weights `as > 0`, then:

```
φ(x) = σf ⊕s √as · ( cos(ωsᵀx), sin(ωsᵀx) )
```

Feature dimension is `2·S_nodes` (plus a constant term if `Λ` has mass at 0). No random phase required anywhere.

**A Latin hypercube or Sobol sample of `ω ~ Λ` is quasi-MC RFF (`references/qmc-rff.md`), not QFF** — the node placement still comes from sampling, just a lower-discrepancy one. QFF specifically means the nodes and weights come from a quadrature rule for the integral.

## How the nodes are built

After ARD coding, SE's `Λ` is a product of Gaussians. **Gauss-Hermite** quadrature on each axis, tensorized, is the textbook product QFF. Node count is `n1^d` before the sine/cosine doubling — that's the wall: `d=6`, `n1=5` → 15,625 nodes.

Matérn `ν` has Student-like spectral tails. A quadrature rule matched to *that* weight is needed. Hermite nodes used under a Matérn claim commit the same crime as SE frequencies inside RFF (`references/rff.md`): prior paths come out too smooth.

An isotropic alternative: a 1-D radial rule crossed with a spherical design. Gentler than a full tensor, but still harsh as `d` grows.

**Smolyak sparse grids** cut the product growth to roughly `O(n1 (log n1)^(d-1))` at a given level. Kernel error under a sparse grid is not simply "the tensor rule's error at that level" — use Smolyak only if that error is actually going to be checked, not assumed away.

Trimming tiny `as` weights throws away real spectral mass. Report how much was discarded.

## Error is a cliff, not `S^(-1/2)`

RFF's error is random and spread out fairly evenly. Tensor QFF is very accurate on the low-frequency part of `k` the rule was actually built for, then it **falls off a cliff** once `δ` or `d` demands frequencies the grid simply doesn't have.

Far from the data, a stand-alone QFF-GP behaves like SoR (`references/sparse-gps.md`): `σn` becomes over-confident within the span of those cosines. This is fine when QFF only supplies `f0` inside a Matheron correction (`references/matheron-rule.md`) — the correction still hits `X` exactly regardless. It's a poor choice as the *only* EI surrogate unless `d` is tiny and `S_nodes` is large.

Changing `ℓ` changes `Λ`, which changes **every node** in the grid. Caching `φ(X)` across an ARD refit is a bug, not an optimization. Freeze the grid across the `q` TS draws within one step (it's already deterministic, so this costs nothing). Rebuild it whenever `ℓ` or `ν` actually move.

## When QFF beats RFF

| Situation | Prefer |
|---|---|
| `d ≤ 3`, want a reproducible `φ` | Product QFF as Matheron `f0` |
| `d ≤ 3`, features *are* the GP | QFF, if `2·n1^d` fits the budget |
| `d ≥ 5` | Monte Carlo / quasi-MC RFF |
| Need `E[φᵀφ] = k` exactly | RFF |
| Need the identical `φ` every week | QFF, or frozen RFF seeds |

## Weekly strip

Rule in use (Hermite / Matérn-matched / Smolyak); `n1`, `d`, `S_nodes`, discarded spectral mass; whether QFF supplies `f0` or is the stand-alone surrogate; whether the grid was rebuilt since the last `ℓ` fit.

**Usual fakes:** a Hermite product grid used under a Matérn claim; a `d=8`, `n1=4` tensor billed as an exact spectral GP; Sobol-sampled frequencies called QFF; `S_nodes=16` used as the actual EI model in `d=6`.
