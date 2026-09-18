# Polynomial Lattices

A polynomial lattice is a digital net whose generating matrices come from a **ratio of polynomials over a finite field**, not from Sobol' recurrences (`references/joe-kuo.md`) and not from an integer generating vector `z` (`references/lattice-rff.md`). Default: base 2, modulus `P ∈ 𝔽2[x]` of degree `m`, `N = 2^m` points.

The word "lattice" is the same slogan as `{s·z/N}`: take an index, multiply by a generator, reduce modulo a modulus, read the fractional digits. The ring changed — `𝔽b[x]/(P)` instead of `ℤ/Nℤ` — so the characters that vanish on the points changed too: **Walsh, not Fourier** (`references/walsh-digital-nets.md`).

## Definition

Modulus `P ∈ 𝔽b[x]`, `deg P = m`, `N = b^m` points. Generators `q1, ..., qp` with `deg qj < m` (often `q1 = 1`). Index `n` becomes a polynomial `n(x)` from its base-`b` digits. Coordinate `j` is:

```
x(n,j) = νm( n(x)·qj(x) / P(x) )
```

where `νm` reads the first `m` digits after the point in the formal expansion — the digital fractional part.

In matrix form, `Cj` is the **Hankel matrix** of coefficients of `qj/P`, and `x(n,j)` is `Cj·n⃗` over `𝔽b` — the same digital-net picture as Sobol'. Only the recipe for filling `Cj` has changed.

`P` should be irreducible (a field) for CBC on a multiplicative group to make sense. A composite `P` is only a ring — some fast-CBC proofs assume a field and silently break if handed one.

## What actually gets chosen

| Object | Role |
|---|---|
| `b` | 2, for XOR; `b > 2` is rare in BO |
| `P`, `deg = m` | sets `N = b^m` |
| `qj` | the analogue of lattice `z` |
| `γj, α` | Walsh-`P_α` CBC of the `qj` (`references/walsh-digital-nets.md`) |
| Digital shift | a random vector in `𝔽b^m` (`references/digital-shift.md`) |

CBC here searches **polynomials**, not integers coprime to `N`. Fast CBC is an FFT on `𝔽b[x]/(P)` (or on `𝔽(b^m)ˣ` when `P` is primitive) — a genuinely different transform domain from `scripts/cbc_fft.py`, which is the integer-`P2` cousin and will not emit `qj`.

## Why these exist beside Joe-Kuo

Sobol' free seeds `m(k,j)` don't form a group. The `qj` here do. This buys product-weight Walsh CBC with 2-D `t`-values under explicit control, without needing a 21k-row published table. Higher-order projections can still be poor if only 2-D `t` or a light `γj` was actually paid for — the same warning that applies to Joe-Kuo in high `p`.

Extensibility is natural: raise `m`, keep the same `P`-family and `qj` truncated or extended, and get a `2^(m+1)` net that contains the `2^m` net as a prefix (for a suitable `P`) — the digital analogue of an extensible integer lattice (`references/lattice-rff.md`).

Generation: precompute each `Cj` once, then `Cj·n⃗` over `𝔽2`. Gray code is optional bookkeeping for fast traversal, not part of the definition itself.

## Three constructions, three figures

| | Integer rank-1 | Polynomial lattice | Sobol' / Joe-Kuo |
|---|---|---|---|
| Ring | `ℤ/Nℤ` | `𝔽b[x]/(P)` | Bit recurrences |
| Characters | Fourier | Walsh | Walsh |
| CBC of | `zj` | `qj` | Not a group CBC |
| Comfortable `N` | Prime or `2^L` | `b^m` | Any prefix |
| RFF | `{sz/N} → F_Λ⁻¹` | Digital `x → F_Λ⁻¹` | Digital `x → F_Λ⁻¹` |

None of these figures *is* Bochner error (`references/rff.md`). After the cube, they all become RFF the same way.

Prefer a polynomial lattice when Walsh CBC, extensible `N=2^m`, and a published `(P, q, γ, α)` are all wanted. Prefer Joe-Kuo when a standard sequence with no CBC code is enough. Prefer integer CBC (`references/lattice-rff.md`) when already thinking in `B2` and `N` is prime.

## RFF hygiene

Drop the all-zero point before `Φ⁻¹`. Freeze `(P, q, shift)` across all `q` Matheron draws in one step. Remap `ω = F_Λ⁻¹(x)` when `ℓ` changes — the net itself doesn't need rebuilding, only the inverse-cdf mapping. The inverse-cdf has to match the actual kernel (SE ≠ Matérn, same discipline as everywhere else in this family). Do not baker-map the net and keep quoting the old Walsh `P_α` as if the cube integrand were unchanged by that.

**Usual fakes:** feeding `qj` into `{sz/N}` as if it were an integer generating vector; scoring a polynomial lattice with Fourier `P2` as the construction criterion; CBC code that silently assumed a field on a composite `P`; `m=4` (`N=16`) used as a stand-alone RFF-GP surrogate in dimension 6.
