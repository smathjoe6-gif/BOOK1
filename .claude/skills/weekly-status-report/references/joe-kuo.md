# Joe-Kuo Sobol' Direction Numbers

Joe-Kuo direction numbers are the published **free odd integers** `m(k,j)` (plus a primitive polynomial per coordinate) that generate a Sobol' sequence, chosen so that one-dimensional Property A holds far out and — in the 2008 tables — two-dimensional projections aren't striped. They are a digital-net / Walsh construction (`references/walsh-digital-nets.md`) — **not a rank-1 lattice `z`** (`references/lattice-rff.md`) and **not a polynomial lattice** (`references/polynomial-lattices.md`). Tables: https://web.maths.unsw.edu.au/~fkuo/sobol/.

## What's actually tabulated

Sobol' coordinate `j` needs:

- a primitive polynomial over `𝔽2` of degree `sj`
- the first `sj` direction numbers `m(1,j), ..., m(sj,j)`, each **odd** and `< 2^k`

Later `m(k,j)` follow Sobol's XOR recurrence from those seeds. Generation:

```
v(k,j) = m(k,j)·2⁻ᵏ,     x(i,j) = i1·v(1,j) ⊕ i2·v(2,j) ⊕ ...
```

(Gray code is just the fast traversal form of the same algebra.) Dimension 1 is fixed: all `mk = 1` (plain van der Corput in base 2). Joe-Kuo don't change that algebra — they choose the free seeds and which polynomial sits in which dimension.

## What they actually optimized

- **2003 (TOMS).** Property A out to dimension 1111: each dyadic block, projected onto **one** coordinate, fills the `2⁻ˢ` bins correctly. Pairwise projections can still stripe badly. A standard illustration is 4096 points with 2-D `t=6`.
- **2008 (SISC).** Treat the sequence as a `(t,d)`-sequence and search the free `m(k,j)` so that **two-dimensional** `t`-values stay small (`references/walsh-digital-nets.md` for the `t`-value definition). Quality is summarized by criteria `D(𝔱)`: how far dimension can go before a 2-D projection as bad as `𝔱` appears. Files on the page go to dimension **21201**. The recommended set is `new-joe-kuo-6.21201` (`D(6)`). `D(7)` is a *different* search, not simply a higher grade of the same one.

That search is Walsh / `t`-value. **It is not Fourier `P2`.** Scoring Joe-Kuo points with `scripts/cbc_fft.py` answers the wrong question entirely — that script implements Fourier CBC for rank-1 lattices, a different algebra.

## How the sequence behaves in practice

- Any prefix of length `2^m` is itself a digital net, with a `t` that depends on `m` and on which coordinates are kept.
- 1-D projections are excellent by construction, across the whole Property-A range.
- 2-D projections are *better than the 2003 tables*, not perfect at every high-index pair. Dimensions 2-3 are not the same quality as dimensions 800-801.
- Extensible: more points just means more bits read from the same tables, not a new construction.
- Index 0 is the origin — digitally shift it away or drop it before `Φ⁻¹`.

A digital shift (XOR `σj` onto each coordinate, `references/digital-shift.md`) preserves `t` exactly. An Owen scramble preserves it only in expectation and mixes harder. A **lattice-style** shift `{x+Δ} mod 1` leaves Walsh-land entirely and can raise the 2-D `t`.

## Use for QMC-RFF

Load the table → get Sobol' points `vs ∈ [0,1)^p` → drop or jitter `v=0` → `ωs = F_Λ⁻¹(vs)` with the kernel-correct cdf (`references/qmc-rff.md`) → freeze the table and scramble across all `q` Matheron draws in one BO step. When `ℓ` moves, remap the **same** `vs` — don't pick a new table mid-BO.

An Owen scramble or a digital shift on top is allowed and standard. The published `m(k,j)` stay fixed regardless. `R` independent scrambles give a crude RMSE estimate.

**Dimension 21201 is not needed for a 6-D GP spectrum.** Property A holding out to dimension 1111 does not make dimensions 800-801 behave like dimensions 2-3 — use only as many dimensions as the actual problem has, and don't assume headroom in the table implies quality at the dimension actually in use.

## Versus lattice CBC

| | Joe-Kuo Sobol' | Rank-1 CBC lattice |
|---|---|---|
| Algebra | XOR digital net | `{sz/N}` |
| Figure | 2-D `t`, Property A | Fourier `P2` |
| Comfortable `S` | any `2^L` prefix | a chosen `N` |
| High `p` | tables exist | needs `γj` weights |
| RFF step | same `F_Λ⁻¹` | same `F_Λ⁻¹` |

Neither figure is Bochner error. Both beat i.i.d. frequencies at small `S` in small `d`. For a noisy plant, the kernel choice (`references/gp-kernels.md`) usually matters more than which of these two nets gets mapped through the inverse-cdf.

**Usual fakes:** Bratley-Fox 1988 seeds used in high `d` after the 2008 tables already exist; calling `m(k,j)` a generating vector `z`; van der Corput used in every coordinate instead of just dimension 1; Sobol' index 0 sent through `Φ⁻¹`; reporting a lattice `P2` as if it were the Joe-Kuo construction criterion.
