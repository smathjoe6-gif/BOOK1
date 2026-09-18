# Digital Shift

A digital shift randomizes a digital net **inside the Walsh group**: XOR a random digit vector onto each coordinate. The shifted set is still the same net, with the same `t`. It's the cheap scramble for Sobol' / Joe-Kuo (`references/joe-kuo.md`) / polynomial-lattice (`references/polynomial-lattices.md`) points before `F_Λ⁻¹`.

**It is not `{x + Δ} mod 1`** — that belongs to integer lattices (`references/lattice-rff.md`). **It is not an Owen scramble** either — that randomizes whole digit trees, not just a single XOR.

## Algebra

Coordinate `j` of index `i` is `ξ⃗(i,j) = Cj·ī` over `𝔽2`. A shift `σj ∈ 𝔽2^m` gives:

```
ξ⃗(i,j)^σ = Cj·ī ⊕ σj
```

Same generating matrices, same dual Walsh modes killed (`references/walsh-functions.md`). Each Walsh coefficient of the empirical measure gets multiplied by `wal_k(σ) ∈ {±1}`. If `σ` is uniform on the digit group, integration against a Walsh series comes out unbiased.

In code: emit the usual XOR of direction vectors, then XOR `σj` (same bit width) **before** converting to a float — doing it after conversion is a different, wrong operation.

## What stays true

The `(t,m,p)`-net property, Property A, the 2-D projection `t`-value, Gray-code generation — all unaffected. The all-zero point *moves*, though, which is exactly what's wanted before pushing it through `Φ⁻¹` (`references/qmc-rff.md`).

A **lattice-style** shift applied to Sobol' points leaves this algebra entirely — it can actually raise the 2-D `t`-value, making the net worse, not just differently randomized.

## Versus Owen and lattice shifts

| | Digital shift | Owen | Lattice `{x+Δ}` |
|---|---|---|---|
| Group | XOR | Digit-tree permutations | `+` mod 1 |
| `t` | Exact, same net | In expectation | Not a Walsh object at all |
| Cost | One XOR / coordinate | A tree of permutations | One add / coordinate |
| RMSE copies | Independent `σ^(r)` | Independent permutations | Independent `Δ^(r)` |
| Use on | Sobol', polynomial lattices | Same, richer mixing | `{sz/N}` only |

Owen mixes harder and can break patterns that a plain shift leaves intact. A **linear matrix scramble** `Lj·Cj·ī ⊕ σj` with invertible `Lj` sits in between the two: still digital, still exact `t`, heavier than a bare shift.

## Practice for QMC-RFF

Use independent `σj` per coordinate — a shared `σ` couples axes together and can recreate the very stripe patterns the construction was built to avoid. Bit depth should match or exceed the bits actually emitted (32 or 64). Freeze `(σj)` across all `q` Matheron draws in one step — a fresh shift mid-step is a *new kernel approximation*, not another Thompson-sampling world.

When `ℓ` moves, keep `σ` and the net indices fixed and just remap `ω = F_Λ⁻¹(x^σ)` through the new inverse-cdf.

`R=4–8` independent shifts give a crude RMSE estimate on `k` or on `μn` — enough to tell whether QMC-RFF is noisier than the observation nugget.

**Usual fakes:** shifting in `ω`-space instead of digit-space; scrambling *after* the inverse-cdf has already been applied; calling `{x + Δ} mod 1` applied to Joe-Kuo points a "digital shift" (it isn't — wrong group entirely); claiming Owen-level mixing quality from a single XOR shift.
