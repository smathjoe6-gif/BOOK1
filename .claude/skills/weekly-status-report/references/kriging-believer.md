# Kriging Believer (KB)

Kriging Believer is a **scheduler**, not an acquisition (see `references/fantasy-average.md` for the general pattern it belongs to). The acquisition `a(·)` stays exactly what was already chosen — EI, KG, LCB, whatever. KB only changes the posterior that slot `i+1` is allowed to see.

## State and loop

Start from the real GP `(μn, kn)`. Copy it. **Do not touch `Dn` itself.**

For `i = 1, ..., q`:

1. Multi-start `zi = argmax a(x)` on the *working* posterior.
2. If more points are needed, invent `ỹi = μ̃(zi)` and do a GP update of the working copy with that pair and a fantasy noise `σ²_fant`.
3. Repeat.

When the batch is chosen, **throw the working copy away.** When the lab returns real `y`, update the real GP from `(Z, y_real)` only.

If `(z, μ(z))` stays sitting in `Dn`, the week is corrupted — there will be double-counting once the true `y` arrives on top of it.

Classic KB uses `σ²_fant = 0` (the lie is treated as noiseless). Noisy KB uses `σ²_obs`. **Publish which one was used** — the two behave differently, per the deflation math below.

## What the update actually writes

By construction the residual is zero: `ỹ - μ̃(z) = 0`.

```
μ̃_new(x)   = μ̃(x)
k_new(x,x') = k_ñ(x,x') - k_ñ(x,z) · s⁻² · k_ñ(z,x')
s²          = k_ñ(z,z) + σ²_fant
```

Mean is frozen exactly. Covariance is deflated along the kernel column of `z`.

With `σ²_fant = 0`, `σ̃(z) = 0` after the update. Neighbors lose variance in proportion to `k_ñ(x,z)²` — that is, within roughly a lengthscale of `z`.

**That identity is the whole method.** KB cannot discover a better basin. It can only stamp "already measured" onto a neighborhood of `μn`.

## Why the next pick moves

After that deflation:

- EI in the neighborhood goes to 0.
- LCB loses its `κσ` bonus there.
- KG sees no further change in `min μ` from sitting on `zi` again.

So `z(i+1)` gets pushed out of the lengthscale ball around `zi`. That's the feature, compared to `q` independent one-point maxima, which would otherwise all stack on the incumbent.

It's also the limitation. Joint qKG (`references/qkg.md`) can buy a point that will never itself be recommended, because that point splits two stories apart. Fantasy average (`references/fantasy-average.md`) keeps several possible `y`'s alive at once. KB commits to exactly one story — the current mean — and plans the rest of the week's batch as if that story were already confirmed data.

## Order, search, cost

Greedy: `z1` never comes back for revision. Each slot needs its own multi-start. After a soft (noisy) KB update, a single start at `zi` often just re-proposes `zi` itself, since some uncertainty survives there.

Two coded points closer than roughly `ℓ/3` are effectively one plant run. Log the minimum pairwise distance in the shipped batch.

Cost: `q` acquisition searches plus `q-1` rank-1 updates. No integral over `y` anywhere — that's exactly why this method is the one that ships in practice over the joint alternatives.

**Usual fakes:** leaving fake pairs sitting in `Dn`; calling KB "qKG"; running noiseless KB on a plant with large real `σ²`, then being surprised that four shipped points sit clustered in two basins of a mean that was wrong to begin with.
