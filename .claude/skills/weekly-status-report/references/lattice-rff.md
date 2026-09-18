# Lattice-RFF

A lattice rule is a QMC point set on the cube:

```
vs = { s·z/N },   s = 0, ..., N-1
```

with generating vector `z`. For RFF, those `vs` get pushed through `F_Λ⁻¹` to produce frequencies. This is still quasi-MC RFF (`references/qmc-rff.md`) — an average of cosines. It is **not** QFF (`references/qff.md`) — there are no quadrature weights on `Λ` here.

## Why anyone reaches for a lattice

Sobol' is a digital net. A rank-1 lattice is instead a subgroup of the torus. For periodic, Fourier-nice integrands, the error is controlled by the dual lattice and can be very small.

After an inverse-cdf maps into a Gaussian or Matérn spectrum, `cos(ω(v)ᵀδ)` is **not** periodic on the cube — `F_Λ⁻¹` explodes at 0 and 1. Textbook spectral accuracy is **not** inherited for free. What's actually gained is a structured, reproducible `ω`-set of exact size `N`, cheap to generate, with a theory that applies only after periodization or after dropping the endpoints.

If a scramble and a painless error estimate are wanted, scrambled Sobol' (`references/qmc-rff.md`) is less fussy. If a fixed `N` is needed in small `p` matched to a product-SE spectrum, a good lattice is competitive.

## The generating vector is the method

- **Korobov:** `z = (1, a, a², ...) mod N`. Fine in small `p`. In `p=12`, an `a` chosen by eye is not a method — it needs to actually be selected against a figure of merit.
- **CBC (component-by-component):** build `z` one coordinate at a time against a figure of merit. Use a tabulated vector matched to the specific `N, p, α` in use — don't improvise one. `scripts/cbc_lattice.py` implements this for the standard even-`α=2` product-weight `P2` criterion, one coordinate at a time, and can map the resulting nodes through an SE spectral inverse-cdf (`se_frequencies()`, dropping `s=0` by default so it never hits `Φ⁻¹` at exactly 0). It does not do weighted CBC with decaying `γj`, `α=4`, FFT CBC, or a Matérn radial map — those need their own figure of merit, not a flag on `P2`. Cost is `O(p·N·|A|)`, fine for `N ≲ 10³`, `p ≲ 16`.
- **Extensible:** `N = 2^L` so `S` can be doubled later without discarding old nodes — useful if the feature count might need to rise mid-BO.
- **Random shift:** `vs = { s·z/N + Δ }`. One shift restores unbiasedness of the kernel estimator. Several independent shifts give a crude RMSE. This should be the default whenever the lattice is going to be treated as randomized QMC.

The node `s=0` gives `v=0`, and `Φ⁻¹(0) = -∞`. Drop `s=0`, start at `s=1`, or use a baker map instead. Report whatever mass gets omitted this way.

## Mapping and periodization

Same inverse-cdf discipline as any QMC-RFF (`references/qmc-rff.md`): SE → `Φ⁻¹`; Matérn → the actual spectral cdf, never `Φ⁻¹`; isotropic Matérn → the lattice built in (radius, direction) coordinates instead of Cartesian ones.

Baker / tent maps make the integrand more lattice-friendly, but they also **change the tails of `Λ`** — that is, the roughness of `k` itself. That's a different kernel approximation, not a numerical convenience. Don't periodize silently while still quoting the original `ν` on the report.

## In the BO stack

Freeze `(z, N, Δ)` across all `q` Matheron draws in one step. When `ℓ` is refit, keep `z, N, Δ` fixed and just remap `ω = F_Λ⁻¹(v)` through the new inverse-cdf. Prefer lattice-RFF as `f0` (`references/matheron-rule.md`), not as a stand-alone `S=N` feature GP — it's still SoR-like far from the data (`references/sparse-gps.md`). For an actual error bar, `R=4–8` independent shifts beat trusting a fake `O(1/N)` convergence slide.

| | Lattice-RFF | Sobol' QMC-RFF | Product QFF |
|---|---|---|---|
| Nodes | `{s·z/N}` | Digital net | Quadrature of `Λ` |
| Comfortable `N` | Prime or `2^L` | `2^L` | `n1^d` |
| Unbiased `k` | With a random shift | With a scramble | No |
| High `d` | Needs CBC weights | Usually easier | Tensor dies |

**Usual fakes:** a Korobov `a=3` copied from a `p=2` blog post straight into `p=16`; `v=0` pushed through `Φ⁻¹`; an unshifted lattice billed as unbiased RFF; a baker map applied while the original Matérn `ν` stays on the poster unchanged; calling a lattice "QFF."
