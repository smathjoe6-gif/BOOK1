# Owen Scramble (Nested Uniform Scramble, NUS)

Owen scrambling (nested uniform scramble, NUS) randomizes a net by putting a **fresh permutation on each digit, keyed by the digits already chosen**. It is stronger mixing than a digital shift (`references/digital-shift.md`) and still has a QMC variance theory. It is not `{x+Δ} mod 1` and not one XOR `σ`.

## Nested permutations

Write `x = Σk ξk b^(-k)`. The scrambled point uses

```
ξ̃k = π_{ξ1,...,ξ(k-1)}(ξk)
```

where each `π` is a uniform random permutation of `{0,...,b-1}`. Depth `k` has `b^(k-1)` permutations. Trees are independent across coordinates. Software truncates at `L` digits (32 or 64 in base 2).

## What the theory actually says

On a `(t,m,p)`-net, Owen's scramble preserves the net **in expectation**: each copy need not be a net; the estimator stays unbiased and the variance can be `O(N^(-3) (log N)^(p-1))` for smooth `f` in base 2. `R` independent trees give a RMSE.

A digital shift preserves `t` **pathwise** and leaves more residual patterns. Owen is the upgrade when those patterns still show in 2-D slices.

## Base 2 (Sobol' / polynomial lattices)

A permutation of `{0,1}` is identity or flip, so bit `k` is XOR'd with a random bit that depends on the previous `k-1` bits. Compact implementation: `hash(seed_j, prefix, k) & 1`. A full `2^L` table is unnecessary.

**Linear matrix scramble** `Lj Cj i⃗ ⊕ σj` is *not* Owen. It is one linear map on bits: cheaper, exact `t` pathwise, weaker mixing. If the code is one `Lj` and the caption says Owen, it is LMS.

## Halton

Each coordinate lives in a different prime base. Owen means a nested permutation tree **in that base**. A single base-2 bit tree on every Halton axis is wrong except on axis 1. Faure-Tezuka is a different digit permutation; do not rename it Owen.

## Where it sits in the RFF stack

Sobol' XOR or `φb(n)` (`references/halton-generation.md`) → Owen (or LMS / digital shift) → drop remaining 0 → `F_Λ⁻¹` → features / Matheron `f0`.

Freeze the Owen seeds across the `q` TS draws. New seeds are a new kernel approximation, not extra Thompson worlds. Scrambling after the inverse-cdf is too late. Index 0 often stays 0 under hash NUS; still skip it before `Φ⁻¹`.

## Chooser

| Need | Scramble |
|---|---|
| Cheap, exact `t`, Sobol' | Digital shift |
| Exact `t`, a bit more mixing | LMS + shift |
| Variance theory + RMSE copies | Owen NUS |
| Halton | Per-base nested perms or per-base digit shift |

**Usual fakes:** one XOR billed as Owen; a global bit-reorder that does not nest; the same tree on every axis; new Owen seeds on every TS path in the same BO step.
