# Random Fourier Features (RFF)

Random Fourier Features approximate a **stationary kernel** by an explicit map `φ(x) ∈ ℝ^S` with:

```
k(x,x') ≈ φ(x)ᵀ φ(x')
```

A GP prior then becomes linear: `f(x) ≈ m(x) + φ(x)ᵀw`, `w ~ N(0,I)`. That's the usual `f0` sitting inside Matheron / qTS (`references/matheron-rule.md`). **It is not an inducing-point method.** Inducing points sparsify the *data* (`references/sparse-gps.md`); RFF sparsifies the *kernel operator* — a genuinely different approximation, even though both end up feeding the same qTS machinery.

## Why a cosine map is legal

Bochner's theorem: a continuous stationary kernel is the Fourier transform of a non-negative spectral measure `Λ`:

```
k(δ) = σf² · E_{ω~Λ}[ cos(ωᵀδ) ]
```

Draw `ωs ~ Λ`, `bs ~ Unif[0, 2π]`:

```
φ(x)_s = σf √(2/S) · cos(ωsᵀx + bs)
```

This is unbiased for the kernel itself; Monte Carlo error is `O(1/√S)` in `k`, but that does **not** automatically translate into the same error bound on the posterior `σn(x)`.

Quadrature grids on `Λ` (QFF, `references/qff.md`) cut variance in small `d` and die in high `d`. Low-discrepancy points mapped through `Λ` instead of i.i.d. sampled — quasi-MC RFF (`references/qmc-rff.md`) — sit between the two: still Monte Carlo in spirit, often quieter in practice. **Optimizing** `{ωs}` by marginal likelihood turns this into a *sparse-spectrum GP*, not RFF — a genuinely different method, easy to overfit at typical BO budgets.

## Do not mix spectra

After ARD coding (`xd ← xd / ℓd`):

- **SE** — `ω` is Gaussian.
- **Matérn `ν`** — Student-like tails, heavier as `ν` drops.

SE frequencies drawn under a Matérn 5/2 kernel claim make the prior paths too smooth. qTS then hunts the wrong holes in the space entirely. Draw `ω` in the same coded space that `ℓ` was fit in (`references/gp-kernels.md`).

## Two different jobs

**A. Prior path only (the qTS default).** `f0 = φᵀw`. The posterior path is the Matheron correction applied on the real `X` or on inducing `Zu`. RFF's bias lives only in `f0`; the correction can still hit the actual data exactly. Factor `Ky` (or `Kuu`) once; draw `q` copies of `w` (and `ε0`) off that one factorization.

**B. Stand-alone surrogate.** The posterior on `w` is an `S`-dimensional Gaussian, `O(nS² + S³)`. Predictions then live entirely in `span(φ)`. Far from the data, this behaves like SoR (`references/sparse-gps.md`): **over-confident** if `S` is small, and EI under-explores as a direct result. Do not treat this as a VFE substitute — they fail in opposite directions.

## How large should `S` be?

For a pathwise `f0`: a few hundred is often enough just for *shape*. For a stand-alone EI surrogate: hundreds to thousands, and watch `A = ΦᵀΦ/σ² + I` for conditioning problems. If all qTS paths share the same two bumps, `S` or the spectrum itself is the bug — not the sampling procedure.

Freeze `{ωs, bs}` across all `q` draws within one BO step. Re-draw frequencies only when `ℓ` gets refit, never per path — otherwise the comparison is between worlds built from *different* kernel approximations, not different posterior samples.

## Versus inducing VFE

| | RFF | VFE |
|---|---|---|
| Approximates | Kernel / prior | Training conditional |
| Size | `S` features | `m` locations |
| Far-from-data `σ` | Collapses to `span(φ)` if used as the whole GP | Can keep `k(x,x) - Qxx` |
| BO default | `f0` inside Matheron | Surrogate when `n` is large |

A hybrid is normal and fine: RFF `f0` plus an inducing Matheron correction on top. Write both names when that's what's running — "RFF" alone undersells what's actually happening.

## Weekly strip

Role (`f0` inside Matheron vs. stand-alone surrogate); spectrum (SE vs. Matérn `ν`); `S` and whether `ω` is frozen; MC vs. QFF vs. optimized `ω`; whether an inducing hybrid is in play.

**Usual fakes:** SE frequencies paired with a Matérn kernel claim; a fresh `ω` drawn for every one of the `q` paths instead of one frozen set; `S=32` used as the actual EI model; optimized frequencies billed as plain RFF; independent-marginal draws billed as "RFF-TS."
