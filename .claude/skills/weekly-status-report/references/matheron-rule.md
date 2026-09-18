# Matheron's Rule

Matheron's rule is how a **posterior GP path** gets drawn without factoring the posterior covariance on the optimizer grid. A posterior sample is a prior sample plus a linear correction that hits the data. That path is exactly what GP-TS / qTS minimizes (`references/thompson-sampling.md`, `references/qts.md`).

It draws `f`, not a fantasy `y`. KG/EI/FA sample observations instead (`references/knowledge-gradient.md`, `references/fantasy-average.md`) — a different object entirely, however similar the word "sample" makes them sound.

## The identity

Prior `f ~ GP(m, k)`. Data `y = f(X) + ε`, `ε ~ N(0, σ²I)`. Draw a prior path `f0 ~ GP(m, k)` and an independent `ε0 ~ N(0, σ²I)`. Then:

```
f̃(x) = f0(x) + k(x,X) Ky⁻¹ (y - f0(X) - ε0),   Ky = k(X,X) + σ²I
```

`f̃ ~ p(f | X, y)`. The only random pieces are `f0` and `ε0`. `Ky⁻¹` is the same matrix already used in the posterior mean.

**Noiseless limit:** `f̃(X) = y` exactly — paths interpolate the data. Dropping `ε0` while `σ² > 0` produces a noiseless draw conditioned on noisy data — slightly wrong, and a common bug in code.

## Why this gets implemented at all

Sampling `N(μn, kn)` on an `M`-point grid costs an `M×M` factorization **every time the grid moves** — every L-BFGS start, in principle. Matheron factors **once**, on the training set (`n×n`). After that, `f̃(x)` is just a prior path plus `n` kernel columns, evaluable at any arbitrary `x` with no refactoring.

For qTS specifically: one Cholesky of `Ky` per BO step, then `q` independent `(f0, ε0)` pairs reusing that same factor. A new posterior Cholesky computed per path means Matheron wasn't actually implemented — just an expensive equivalent of the grid method.

## The remaining piece: drawing `f0`

- **Random Fourier features.** For stationary `k(x,x') ≈ φ(x)ᵀφ(x')`, `f0(x) = m(x) + φ(x)ᵀw`, `w ~ N(0,I)`. Feature count is the bias knob here. Use the spectral density of the *actual* kernel in use — SE frequencies drawn under a Matérn 5/2 prior are simply the wrong prior. Full treatment (Bochner's theorem, QFF, spectrum-matching, and RFF as a stand-alone surrogate versus RFF as just `f0`): `references/rff.md`.
- **Inducing / decoupled pathwise.** Same correction; the prior sample comes from features or a fixed inducing set instead. When `n` runs into the thousands, `Ky` itself needs to be sparse or approximate (`references/sparse-gps.md`) — say so explicitly rather than silently approximating.

**Do not draw `f0(x)` as independent `N(m(x), k(x,x))` at query points.** Then `f0(X)` and `f0(x)` are no longer jointly a valid prior sample, and the whole identity above becomes false — this is the same independent-marginal trap that shows up everywhere else in this family (`references/thompson-sampling.md`).

## Linear algebra

Cache `L` with `LLᵀ = Ky`. Solve `v = Ky⁻¹(y - f0(X) - ε0)` with two triangular solves, never an explicit matrix inverse. Evaluate `f̃(x) = f0(x) + k(x,X)v`. Use unit-box inputs, or `Ky` will condition badly.

## One qTS step, in full

```
factor Ky once
for j in 1..q:
    draw f0, ε0
    v = Ky⁻¹ (y - f0(X) - ε0)
    f̃(x) = f0(x) + k(x,X) v
    zj = argmin f̃     # multi-start
repair Z; evaluate real f; append real y only
```

Do not insert Kriging-Believer pairs `(z, μ(z))` between the `q` draws — that's a different policy entirely (`references/kriging-believer.md`). **Constraints:** a second Matheron draw on `c`, then minimize `f̃` subject to `c̃ ≤ 0`.

## Checks

Noiseless interpolation: `f̃(Xi) = yi` should hold exactly. Distinct `(w, ε0)` draws should disagree off `X` at roughly the scale of `σn(x)`. If all `q` paths share the same two bumps, the bug is the RFF feature count or the kernel (`references/gp-kernels.md`) — not a failure of Thompson Sampling itself.
