# Sobol' Generation

Sobol' generation is a **base-2 digital** construction: XOR direction vectors selected by the bits of the index. Joe-Kuo (`references/joe-kuo.md`) only supply the seeds — this file is the actual algebra that turns those seeds into points.

## Inputs

Coordinate `j ≥ 2`: a primitive polynomial over `𝔽2` of degree `s`, encoded as bits `a1, ..., a(s-1)`, and odd seeds `m1, ..., ms` with `mk < 2^k`. Dimension 1 is plain van der Corput: every `mk = 1`.

Later seeds follow Sobol's recurrence (XOR of shifted earlier `m`'s, plus an extra `2^s·m(k-s)` term). As many `mk` are needed as bits of resolution `L` (32 or 64). Direction vectors are those integers with the binary point pushed to the left:

```
Vk = mk << (L - k)
```

## Two ways to emit a point

**Definition.** If `i = (... i2 i1)` in binary:

```
x(i,j) = i1·v(1,j) ⊕ i2·v(2,j) ⊕ ... ⊕ iL·v(L,j)
```

That's `Cj·ī` over `𝔽2` — the same generating-matrix picture as any digital net (`references/walsh-digital-nets.md`).

**Gray code** (what actually gets implemented). Let `g = i ⊕ ⌊i/2⌋`. Each new index flips exactly one bit of `g`. The new point is the old point XOR that bit's `v(κ)`, where `κ = ctz(i)` (count of trailing zeros). Start at `i=0`, `x=0`. Same point set, different traversal order. Bratley-Fox / Algorithm 659 is this loop plus the recurrence — nothing more.

**Micro-example** (from the Joe-Kuo notes): polynomial `x³+x+1`, seeds `(1,3,7)`. Then `v1=1/2`, `v2=3/4`, `v3=7/8`, and the first points on that axis are `0, 0.5, 0.75, 0.25, 0.875`.

## Randomize, then map

XOR an independent digital shift `σj` (`references/digital-shift.md`) onto each coordinate's `L`-bit word **before** converting to a float. Freeze `(σj)` across all `q` Matheron draws in one BO step. Do not use `{x + Δ} mod 1` — that's the wrong group entirely.

Index 0 is the origin until shifted. Skip it, or use a nonzero `σ`, before pushing anything through `Φ⁻¹`.

Any `2^m`-aligned block is a digital net with some `t(m,p)`. A prefix of length `S` that isn't a power of two is still low-discrepancy, but it is **not** exactly a `(t,m,p)`-net — say which case is actually in play. Resolution needs `L ≥ ⌈log2(i_max + 1)⌉`.

## The stack for this thread

Joe-Kuo table → recurrence → Gray-code XOR loop → digital shift → drop remaining 0 → `F_Λ⁻¹` (kernel-correct, `references/qmc-rff.md`) → RFF features / Matheron `f0` (`references/matheron-rule.md`). Remap when `ℓ` changes; don't reload a different table mid-BO.

**Usual fakes:** van der Corput used on every axis instead of just dimension 1; 1988 Bratley-Fox seeds used in high `d` when 2008 tables already exist; calling `m(k,j)` a lattice `z`; scrambling *after* the inverse-cdf has already been applied.
