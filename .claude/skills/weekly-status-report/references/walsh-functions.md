# Walsh Functions

Walsh functions are the **characters of the dyadic group** on `[0,1)`. Digital nets (Sobol', polynomial lattices — `references/walsh-digital-nets.md`) are built so that many of those characters average to zero on the point set. Fourier characters `e^(2πi hx)` play the same role for integer lattices (`references/lattice-rff.md`). **The two families are not interchangeable.**

## Definition (base `b=2`, Paley order)

Write `x = Σ(i≥1) ξi 2⁻ⁱ`, `ξi ∈ {0,1}`, and `k = Σ(i≥0) κi 2ⁱ`. The Paley-ordered Walsh function is:

```
wal_k(x) = (-1)^( Σ(i≥0) κi ξ(i+1) )
```

In `p` dimensions, `wal_k(x) = Πj wal_{kj}(xj)`. Values are always `±1`. They're constant on dyadic intervals of length `2^(-(1+⌊log2 k⌋))` when `k > 0`.

Other orderings (sequency / Walsh-Kaczmarz, Hadamard) only permute the index `k`. Discrepancy figures must name the ordering being used — **Paley is the one that matches generating-matrix digits**, and mixing up orderings silently changes what a stated `P_α` value even means.

## Group characters

Identify `x ∈ [0,1)` with its bit vector `(ξ1, ξ2, ...)`. XOR of bits is the group law. Then:

```
wal_k(x ⊕ y) = wal_k(x)·wal_k(y)
wal_{k⊕ℓ}(x) = wal_k(x)·wal_ℓ(x)
```

So `{wal_k}` is the dual group. A **digital shift** of a net (XOR a fixed bit vector onto every point — `references/digital-shift.md`) multiplies each Walsh coefficient by a `±1` and **does not change** which modes are killed. An **Owen scramble** is a random automorphism of the digit tree instead; it preserves `t` only in expectation, not exactly.

Integer lattices are characters of `ℝ/ℤ`. That's exactly why baker maps or periodization that help Fourier lattices (`references/lattice-rff.md`) can wreck Walsh figures outright — they're maps built for the wrong group entirely.

## Orthogonality and the Walsh-Fourier series

On `[0,1)` with Lebesgue measure:

```
∫₀¹ wal_k(x)·wal_ℓ(x) dx = δ(k,ℓ)
```

Any `f ∈ L²[0,1)` has Walsh-Fourier coefficients `f̂(k) = ∫ f·wal_k`, and the partial sums over `k < 2^m` are the orthogonal projection onto functions constant on intervals of length `2⁻ᵐ`.

A `(t,m,p)`-net annihilates every `wal_k` whose digit support is "too cheap" relative to `t` — the dual-net statement (`references/walsh-digital-nets.md`). This is the exact analogue of a rank-1 lattice annihilating `e^(2πi h·x)` for `h` in the dual lattice.

## Product, restriction, and projections

Because `wal_k(x) = Πj wal_{kj}(xj)`:

- A 1-D projection of a net only sees factors with `kj = 0` on every other axis.
- A 2-D Walsh mode is a product of two 1-D modes.
- **Property A** = every nontrivial 1-D mode with `k < 2^s` dies on each dyadic block of length `2^s`.

Joe-Kuo's 2-D `t` search (`references/joe-kuo.md`) is exactly this: kill cheap *products* `wal_{ki}(xi)·wal_{kj}(xj)`, not just cheap individual factors.

## Regularity (where Walsh is awkward)

Walsh functions are discontinuous at dyadic rationals. There's no useful *classical* derivative to lean on. Smoothness for Walsh figures instead gets measured by **digit decay** of `f̂(k)` — how fast `f̂(k)` dies as the highest occupied bit of `k` grows. That decay rate is exactly the `α` in Walsh `P_α` (`references/walsh-digital-nets.md`).

A `C^∞` periodic function has rapidly decaying *Fourier* coefficients and need not have rapidly decaying *Walsh* coefficients — and the converse holds too. Bochner's `cos(ωᵀδ)` after `F_Λ⁻¹` (`references/rff.md`) is a smooth function of `ω` on `ℝ^d`, not a low-digit Walsh polynomial on the cube. **Neither `P2` nor Walsh `P_α` is actual RFF error** — both are proxies confirming the cube point set isn't stupid, each in its own language.

## Pointwise convergence is more delicate than it looks

Inversion in `L²` is the usual Plancherel sum. Pointwise recovery is not the trigonometric story, though: Walsh partial sums are **dyadic martingales**, not convolution with a Dirichlet kernel on the circle. At a dyadic rational the functions jump — talk about values on half-open dyadic intervals, not at points, when precision matters.

## Product structure and ANOVA

Because the characters factor, `f̂(k) = ∫ f(x) Πj wal_{kj}(xj) dx`. Terms with only one nonzero `kj` are 1-D effects; terms with two nonzero `kj` are 2-D interactions, and so on — the same decomposition idea as an ANOVA. Property A is "all nontrivial cheap 1-D modes die." Joe-Kuo's 2-D `t` search (`references/joe-kuo.md`) is "cheap 2-D products die too." Product weights `γj` in Walsh CBC (`references/walsh-cbc.md`) are exactly ANOVA weights — later coordinates are allowed larger `f̂(kj)` because they're assumed to matter less.

This is precisely why a Sobol' or polynomial-lattice construction can look perfect in every 1-D projection and still stripe badly in a pair: the product modes were simply never part of the 2003-era criterion.

## Dual nets as spectral support

The Walsh dual of a digital net is the set of `k` with `(1/N) Σi wal_k(xi) = 1` — the modes that *survive* rather than average out. Integration error for a Walsh series is exactly the sum of `f̂(k)` over the dual minus `{0}`. A `(t,m,p)`-net statement is a support constraint on that dual: no surviving `k` whose digit degrees add to less than `m-t`.

A digital shift multiplies each empirical Walsh coefficient by `wal_k(σ) ∈ {±1}` and **does not change the dual at all**. An Owen scramble randomizes phases more thoroughly, preserving `t` only in expectation. A lattice-style shift `{x+Δ}` is a Fourier-group move, and can actually *add back* Walsh modes that construction had already killed.

## Fast Walsh Transform

On `N = 2^m` dyadic bins, the discrete Walsh-Paley transform is the **Hadamard transform in Paley order**: `O(N log N)`, built entirely from `±1` butterflies. This is the engine inside fast Walsh CBC (convolving `prod[n]` with `ωα` on the field, `references/walsh-cbc.md`) and inside computing a given net's `P_α^Wal` directly. It is **not** an FFT of length `N` on `ℤ/Nℤ` — the group law here is XOR, not addition mod `N`.

## What to use this for in practice

- **Design:** Walsh CBC / Joe-Kuo / polynomial lattices — kill cheap `wal_k`.
- **Randomize:** a digital shift — spins the surviving coefficients without growing the dual.
- **Score:** Walsh `P_α` or `t` — never `B2` (`references/lattice-rff.md`'s figure).
- **After `F_Λ⁻¹`:** the dyadic group has already been left behind. Further analysis is Bochner / GP territory, not Walsh.

## Relation to Haar and to Rademacher

Rademacher functions are the generators: `ri(x) = wal_{2^(i-1)}(x) = (-1)^ξi`. Paley Walsh functions are finite products of Rademachers. Haar functions are differences of indicators of dyadic intervals — they span the same dyadic filtration, but are **not** the same orthonormal set. Digital-net proofs sometimes switch to Haar to talk about elementary intervals directly; the `t`-value definition itself *is* a Haar / elementary-interval statement.

## Fast evaluation

`wal_k(x) = (-1)^popcount(k AND bits(x))` in Paley order (with the usual half-bit alignment). Generating-matrix evaluation of a net never forms Walsh functions explicitly at all — it only guarantees that certain `wal_k` sum to zero across the point set, which is a property proven once at construction time, not evaluated per-point.

## Properties that matter for this thread

- Characters of XOR, not of `+` mod 1 → a digital shift is the right scramble; `{x + Δ}` is the wrong one entirely (`references/digital-shift.md`).
- Product structure → 2-D `t` and product-weight Walsh `P_α` are the figures that actually match Sobol' / polynomial lattices.
- Discontinuous → don't expect the spectral accuracy of a Fourier lattice from a Walsh-optimal net; they're solving different problems.
- After `F_Λ⁻¹`, the group the Walsh functions know about has already been left behind.

**Usual confusions:** sequency order used inside a Paley `P_α` calculation; scoring `{sz/N}` with a Walsh `P_α`; assuming a `C^∞` kernel on `ℝ^d` automatically has small Walsh coefficients on the cube (it doesn't follow at all); quoting a Fourier decay rate as if it were Walsh smoothness; treating the Walsh-Fourier series of `cos(Φ⁻¹(v)ᵀδ)` as though `v` were still living in the dyadic group after the inverse-cdf has already been applied.
