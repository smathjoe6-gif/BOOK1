# Halton Generation

A Halton sequence is one **radical-inverse** sequence per coordinate, run in pairwise coprime bases (the first `p` primes by default). It is not a Sobol' net (`references/sobol-generation.md`) and not a rank-1 lattice (`references/lattice-rff.md`) — a third, simpler construction entirely.

## Generation

Write `n = Σk nk·b^k` in base `b`. The radical inverse mirrors those digits across the point:

```
φb(n) = Σk nk·b^(-(k+1))
```

`φ2` is exactly van der Corput (the same as Sobol' dimension 1, `references/sobol-generation.md`). The Halton point is:

```
xn = ( φ(b1)(n), ..., φ(bp)(n) )
```

Index 0 is the origin. Skip it or jitter it before `Φ⁻¹`.

Direct evaluation (peel digits, accumulate) is fine up to `S ~ 10^5`. For streaming many points, keep the current inverse and ripple the carry when `n → n+1` rather than recomputing from scratch. Compute in rationals, or with enough bits that `φb(n)` stays exact at the `S` actually in use.

## Scramble (the group is mixed)

Halton is **not** a single-base digital net once `p > 1` — each axis lives in its own base. A base-2 digital shift (`references/digital-shift.md`) applied to every coordinate is the wrong group except on axis 1.

Use a **per-base** digit permutation (Faure-Tezuka / Owen in base `bj`) or a per-base digit shift instead. `{x + Δ} mod 1` is only jitter here — it does not preserve any `t`-value, because the sequence doesn't have one to preserve in the first place.

Freeze the bases and permutations across all `q` Matheron draws in one BO step. Remap `ω = F_Λ⁻¹(x)` when `ℓ` changes (`references/qmc-rff.md`).

## Versus Sobol' and lattices

| | Halton | Joe-Kuo Sobol' | Rank-1 lattice |
|---|---|---|---|
| Map | `φ(bj)(n)` | XOR direction vectors | `{nz/N}` |
| High `p` | Large-prime axes **correlate** | 2008 tables run to 21k | Needs `γj` weights |
| Comfortable RFF `p` | `≲ 8–10` | Moderate | Moderate |
| Code | A few lines | Table + recurrence | CBC + `{sz/N}` |

Unscrambled Halton in dimension 20 is the textbook cautionary plot — visible stripes on primes 47 and 53. That's exactly why Joe-Kuo (`references/joe-kuo.md`) became the default high-`d` QMC net instead. For a 6-D Matérn spectrum, though, scrambled Halton is still perfectly fine and needs much less machinery than a Sobol' table or a CBC lattice.

**Usual fakes:** consecutive integer bases used instead of coprime ones (the sequence collapses — points repeat far sooner than expected); a base-2 digital shift applied to every Halton axis regardless of its actual base; index 0 sent through `Φ⁻¹`; calling Halton a Sobol' net.
