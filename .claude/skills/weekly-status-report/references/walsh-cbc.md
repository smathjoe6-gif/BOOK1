# Walsh CBC

Walsh CBC is a **family of constructions, not one loop**. They all freeze generators one coordinate at a time to shrink a **Walsh** figure of merit. They differ in the figure, the search space, and the fast transform used. None of them is integer `P2` CBC (`scripts/cbc_fft.py`, `references/lattice-rff.md`), and none of them is Joe-Kuo's 2-D `t` search on Sobol' seeds (`references/joe-kuo.md`).

## Shared skeleton

After `q1, ..., q(j-1)` are fixed:

```
qj = argmin_{q ∈ Q}  P^Wal(q1, ..., q(j-1), q)
```

`Q` is the candidate set — a field, a ring, or a list of matrices, depending on the method. `P^Wal` has a product-form identity over the `N` points, so a running product `prod[n]` updates in `O(N)` once the minimum is chosen. Fast methods replace the `|Q| × N` inner score with a single group FFT.

Always set `q1 = 1` (or `C1 = I`) unless there's a specific reason not to — the first coordinate ties completely across every candidate by symmetry anyway (same phenomenon noted for integer CBC in `scripts/cbc_fft.py`).

## Method 1 — Product-weight Walsh `P_α` on a polynomial lattice

This is the closest Walsh analogue of integer `P2` CBC, and the version worked out in detail here since it's the one most directly comparable to `scripts/cbc_lattice.py` / `scripts/cbc_fft.py`.

**Figure:**

```
P_α = -1 + (1/N) Σn Πj ( 1 + γj·ωα(x(n,j)) )
```

`ωα` is the 1-D Walsh kernel (`references/walsh-digital-nets.md`). `Q = 𝔽b[x]/(P)` (`references/polynomial-lattices.md`), `N = b^m`. Output: a modulus `P` and polynomials `q1, ..., qp`.

Use this when explicit `γj` weighting matters (some spectral axes should be allowed to be worse) and `N = 2^m` is the natural size.

### The greedy loop

```
prod[n] ← 1 for n = 0..N-1
q1 ← 1
update prod[n] *= 1 + γ1·ωα(x(n,1))
for j = 2..p:
    for each candidate q in F_b[x]/(P):
        score(q) = mean_n  prod[n] * (1 + γj·ωα(x(n,j)(q)))  - 1
    qj ← argmin score
    prod[n] *= 1 + γj·ωα(x(n,j)(qj))
```

Candidates: all polynomials of degree `< m`, or just the units if restricting to invertible `qj`. Tie-break: a fixed monomial order, smallest first. After coordinate `j`, `prod[n]` is the product of the first `j` kernel factors at point `n` — identical in shape to the integer CBC running product in `scripts/cbc_lattice.py`.

### Where the FFT comes in

A naive score of one `q` is `O(N)`; `|𝔽b[x]/(P)| = N`, so one coordinate costs `O(N²)`. Fast Walsh CBC (Dick-Kuo-Sloan / Nuyens-style) rewrites the slice `S(q) = Σn prod[n]·ωα(νm(n·q/P))` as a convolution on the **additive group of the field** `𝔽(b^m)` (when `P` is primitive / irreducible). Identify `n` and `q` with field elements; `n·q` is field multiplication, and `S` becomes a multiplicative convolution. One character-FFT of `ωα ∘ νm` on that group, one FFT of the reindexed `prod`, pointwise multiply, inverse FFT: every `S(q)` at once, in `O(N log N)`.

A composite `P` is not a field. Some implementations still run against one anyway — the convolution identity relied on may simply be false in that case. Say so explicitly if `P` isn't confirmed irreducible.

## Method 2 — POD (product-and-order-dependent) weights

Same loop; the kernel at coordinate `j` now depends on **how many** earlier coordinates are already "on" in a multi-index, not just which one. Higher-order interactions get penalized differently from main effects. Needed when the Walsh-Fourier ANOVA of the integrand (`references/walsh-functions.md`) isn't a pure product. Bookkeeping is heavier; fast transforms still exist in the literature (Dick-Kuo-Sloan and later). Overkill for mapping a handful of Matérn frequencies — relevant only when integrating a GP sample path in high `p` with a known interaction order.

## Method 3 — CBC of generating matrices (not polynomials)

Search invertible (or unrestricted) matrices `Cj ∈ 𝔽b^(m×m)` directly, instead of Hankel `qj/P`. A much larger `Q` (`b^(m²)` versus `b^m`). This can reach better `t`-values, at the cost of losing polynomial-lattice structure and cheap extensibility. In practice, people restrict to upper-triangular matrices or to linear scrambles of a fixed net. This is how a digital net gets **designed from scratch**, rather than specializing a polynomial lattice.

## Method 4 — Reduced / successive-coordinate CBC

Don't search the full field at late `j`. Restrict `qj` to a subset — low degree, sparse coefficients, or a short list. Used when `p` is huge and the `γj` decay fast enough that later axes barely move `P_α` anyway. Same underlying idea as small `γj` in integer CBC (`references/lattice-rff.md`). For RFF with `p = d ≲ 8`, a full search is cheap; reduced CBC exists for `p` in the hundreds.

## Method 5 — Higher-order digital CBC (Dick)

Replace `ωα` with a kernel that kills Walsh modes with several low digits **per coordinate** (interlacing / higher-order nets). Targets integrands with mixed smoothness, not just a plain product-weight `α`. Output nets can achieve higher-order convergence rates. Irrelevant to RFF unless there's an actual theorem that Bochner's integrand, after `F_Λ⁻¹`, lives in that mixed-smoothness space — it generally does not.

## Method 6 — Projection-aware CBC

Score not only the full-`p` `P_α`, but a weighted sum of `P_α` on subsets (all pairs, all triples). This is the CBC cousin of Joe-Kuo's 2-D `t` criterion (`references/joe-kuo.md`), run on a group, with a Walsh figure standing in for `t`. More expensive — the running product has to carry subset products, not just the full-`p` one. Use this specifically when QMC-RFF is known to be judged on 2-D spectral slices rather than the whole spectrum at once.

## Fast transform variants

| Group | When | Output |
|---|---|---|
| `𝔽(b^m)ˣ` or additive `𝔽(b^m)` | Primitive / irreducible `P` | Polynomial `qj` |
| XOR on `{0,1}^m` (Hadamard / FWT) | Explicit digital points already in hand | Scoring a *given* net, or CBC of bits |
| `ℤ/Nℤ` FFT | **Not Walsh at all** | Integer `zj` (`scripts/cbc_fft.py`) |

Composite `P` means no field exists to convolve over. Some codes still run an FFT anyway — the underlying identity may simply be false in that case. Say so.

## What Joe-Kuo is, relative to all of this

Joe-Kuo (`references/joe-kuo.md`) is **not** Walsh CBC. It's a search over Sobol' seeds `m(k,j)` for Property A plus small 2-D `t`. No running Walsh `P_α`, no field FFT, no `qj` at all. Use the published table when a standard sequence is all that's needed. Use Method 1 or Method 6 when weights or projection-aware Walsh figures on a polynomial lattice are actually wanted.

## After the generators exist

Emit the net, apply a **digital shift** (`references/digital-shift.md` — not `{x+Δ}`), drop the origin if needed, apply `F_Λ⁻¹` for RFF (`references/qmc-rff.md`). Freeze `(P, q, σ)` or `(Cj, σ)` across all `q` Matheron draws in one BO step. Remap `ω` when `ℓ` changes; don't rerun CBC every BO step unless `γ, p, m` actually changed.

## Chooser

| Need | Method |
|---|---|
| Weighted axes, `N=2^m`, clean algebra | 1 — product-weight poly-lattice CBC |
| Known interaction order | 2 — POD |
| Best `t`, no need to extend `m` | 3 — matrix CBC |
| Huge `p`, decaying `γj` | 4 — reduced CBC |
| Mixed-smoothness theorem in hand | 5 — higher-order |
| Care about pairs of spectral axes | 6 — projection-aware |
| Standard RFF, no CBC code wanted | Joe-Kuo + digital shift |
| Already think in `B2`, `N` prime | Integer FFT CBC (`scripts/cbc_fft.py`) |

## Cost, roughly

Direct Walsh CBC (any method above): `O(p·N²)`. FFT Walsh CBC (Methods 1 and 3, where the group structure supports it): `O(p·N log N)` plus the cost of building `ωα` on the field. For RFF feature counts `N ≲ 2^10` and `p ≲ 16`, either is cheaper than a week of plant runs. For a 6-D GP, a published Joe-Kuo prefix is usually enough on its own; Walsh CBC earns its keep specifically when weighted or projection-aware coordinates are wanted, or a net size that isn't a Sobol' prefix already on hand.

The algorithm, in every method above, ends at producing a good cube set. Bochner error (`references/rff.md`) only starts after `F_Λ⁻¹` is applied.

**Usual fakes:** running `scripts/cbc_fft.py` and calling the output "Walsh CBC" (it's the Fourier cousin, wrong algebra entirely); feeding `qj` into `{sz/N}` as if it were an integer generating vector; scoring a Method-1 net with Fourier `P2` as the construction criterion; rerunning CBC every time a GP lengthscale moves instead of just remapping `ω`.
