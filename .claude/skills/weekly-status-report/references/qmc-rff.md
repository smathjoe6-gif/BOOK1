# Quasi-Monte Carlo RFF (QMC-RFF)

Quasi-MC RFF is still Bochner Monte Carlo (`references/rff.md`) — an average of cosines. The frequencies are **low-discrepancy points mapped through `Λ`**, not i.i.d. draws and not a Gauss quadrature grid. That last one is QFF (`references/qff.md`).

## What's actually different

**I.i.d. RFF:** `ωs ~ Λ`, kernel error `O_p(S^(-1/2))`.

**QMC-RFF:** `vs ∈ [0,1]^p` from Sobol', Halton, or a lattice, `ωs = F_Λ⁻¹(vs)`, then the same:

```
φ(x)_s = σf √(2/S) · cos(ωsᵀx + bs)
```

Given the scramble, `φ` is deterministic. Freeze it across all `q` TS draws within one step.

In the best case, for a smooth integrand on the unit cube, error can look like `O(S⁻¹ (log S)^p)`. In practice for BO, expect a *quieter* `φ` at modest `S` — not a guaranteed `1/S` rate.

## Mapping `v → ω`

Default point set: **Sobol' with an Owen scramble** (or a digital shift). Scrambles keep the low discrepancy while giving a crude RMSE estimate if `R` independent scrambles are run. Halton is fine at low index and gets correlated at high index — avoid it once dimension climbs.

Dimension of `v`:

- **Product `Λ`** (SE after ARD coding): one coordinate per axis, the inverse-cdf of each 1-D Gaussian. `p = d`.
- **Isotropic Matérn:** one coordinate for the radius (the radial spectral cdf), the rest for direction on the sphere. `p ~ d`.

**The inverse-cdf *is* the kernel.** Sobol' passed through `Φ⁻¹` under a Matérn claim is just SE features again — the same spectrum-mixing crime as in plain i.i.d. RFF (`references/rff.md`).

Phases `bs`: either extra QMC coordinates, or i.i.d. `Unif[0, 2π]` layered on top. If the phases are QMC'd too, scramble them as well.

Skip Sobol' index 0 when `F_Λ⁻¹` blows up at the origin (Student-like tails). Start at `s0 > 0`, or use a scramble that avoids 0 entirely.

## What error actually gets felt

`cos(ωᵀδ)` in inverse-cdf coordinates is reasonably smooth at small `‖δ‖` and oscillatory at large `‖δ‖`. So QMC usually helps **local** kernel accuracy (interpolation near the data) more than it helps far lags. In high `d`, small `ν`, rough paths — expect a fallback toward the plain `S^(-1/2)` rate.

QMC does **not** restore residual variance outside `span(φ)`. A stand-alone QMC-RFF GP is still SoR-like far from the data (`references/sparse-gps.md`). EI will under-explore if that's the actual surrogate in use. The best use remains `f0` inside a Matheron correction (`references/matheron-rule.md`), with the correction itself hitting real `X` or inducing `Zu`.

## Versus the neighbors

| | I.i.d. RFF | QMC-RFF | QFF |
|---|---|---|---|
| `ω` | Random `~ Λ` | Low-discrepancy `→ Λ` | Quadrature nodes of `Λ` |
| Unbiased `k` in expectation | Yes | No (fixed set) | No |
| Reproducible `φ` | Only if seed frozen | Yes, given the scramble | Yes |
| High `d` | Works, noisy | Works, often quieter | Tensor dies |
| Name if `ω` gets *fit* | — | Not QMC-RFF | Not QFF |

When `ℓ` gets refit, keep the same Sobol' **indices** and remap them through the new `F_Λ⁻¹` — that preserves the QMC structure. Drawing a fresh sequence at every lengthscale step is legal, just noisier week to week than it needs to be.

## Weekly strip

Sequence and scramble in use; `S`, `p`, skip-0 status; which inverse-cdf was used; whether this supplies `f0` or is the stand-alone surrogate; whether it's frozen across the `q` draws in a step.

**Usual fakes:** Sobol' plus a Gaussian inverse-cdf paired with a Matérn poster; Sobol' billed as QFF; optimized frequencies billed as quasi-MC; a fresh scramble drawn on every TS path within the same step; trusting a `1/S` convergence slide in `d=20`, `ν=3/2`.
