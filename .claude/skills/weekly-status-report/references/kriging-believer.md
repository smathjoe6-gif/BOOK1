# Kriging Believer (KB)

Kriging Believer is a **policy for filling a batch** — a scheduler, not an acquisition and not a model of `f` (see `references/fantasy-average.md` for the general pattern it belongs to; neighbors: `references/qts.md`). The acquisition `a(·)` stays exactly what was already chosen — EI, KG, LCB, whatever. KB only changes the posterior that slot `i+1` is allowed to see.

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

## What the policy is committing to

By construction the residual is zero, so `μ̃ ← μ̃` (unchanged) while `k` deflates along `z`'s kernel column. **Mean frozen. Uncertainty around `zi` declared spent.**

The policy's implicit beliefs:

- The current `μ` is a good enough *story* to plan the rest of the week inside.
- The thing that must not happen is measuring twice in the same lengthscale ball.
- There's no willingness to pay for a look-ahead over unrealized `y`.

That's rational when (a) `q` separated plant runs are needed this calendar step, (b) joint qKG/qEI (`references/qkg.md`) is too heavy to run, and (c) it's accepted that a wrong `μn` poisons the whole batch if it turns out to be wrong.

It is **not** rational as a stand-in for "expected drop in `min μ` after the set." That object is qKG. KB never computes it, no matter how it gets described in a writeup.

## What it optimizes (and doesn't)

| Policy | One-step object | Batch object |
|---|---|---|
| 1-EI / 1-KG / 1-LCB | Their usual scalar `a(x)` | — |
| KB + that `a` | Same `a` on a `σ`-deflated GP | Greedy separation, not a set utility |
| FA-greedy-KG | Expected 1-KG after a random prefix `y` | Still greedy |
| Joint qKG | — | `E[Δ min μ]` after `Z` |
| qTS | — | Sample of `x*` |

KB is closest to "run my one-point policy `q` times with an exclusion zone induced by the kernel." That exclusion zone isn't an extra Lipschitz penalty bolted on — it's the GP's own `k(·,z)` doing the work.

## Behavior as a policy

**Versus `q` independent maxima of `a`.** Those all stack on the incumbent. KB pushes `z(i+1)` out because EI/LCB/KG all die where `σ̃ ≈ 0`. That's the feature.

**Versus qTS** (`references/qts.md`). qTS *reports* how many stories `πn` still has, via its collapse index. KB *forces* `q` separated sites even when every world wants the same `x*`. Use KB when the week must return `q` distinct runs regardless. Use qTS when the batch should reveal posterior collapse instead of hiding it.

**Versus FA-greedy-KG** (`references/fa-greedy-kg.md`). FA averages 1-KG over prefix worlds, so `μ` is allowed to move in some fantasies. KB never moves `μ` at all. With two basins present: FA can still value the second one; KB plans only inside whichever basin the current mean already favors.

**Versus joint qKG.** Joint can sit `z1` on an informational ridge and revise the whole set afterward. KB cannot buy a ridge that loses on one-point `a`, and can never revise `z1` once picked.

## Failure modes of the policy

- **Wrong-mean lock-in.** If `z1` sits in a bogus basin of `μn`, every later `z` becomes a satellite of that same bad basin.
- **Noiseless KB + large real `σ²`.** Pretending `f(zi)` was learned completely makes the rest of the batch overconfident. Prefer noisy-KB whenever real `σ²` is non-trivial.
- **Soft KB + single-start `a`.** `z(i+1)` just re-proposes `zi`.
- **`q` larger than the number of basins `μn` actually has.** The result is a ring of points around one bump, spaced by `ℓ` — that's exploration of the *kernel*, not exploration of `f`.
- **Labeling.** Shipping KB+EI under the heading "qKG."

## When the policy is the right one

Ship KB+EI (or KB+LCB) when an auditable, cheap, separated batch is needed this afternoon, and there's no pretense that the set maximized `Δ min μ`.

Publish: classic vs. noisy KB; the base `a`; `q`; `σ²_fant`; minimum coded pairwise distance; `unique(Z)/q` (here this is a **spacing** index, not a TS collapse index — the two look similar but mean opposite things).

If the leftover doubt in `μ` still matters, step up to FA-greedy. If the set needs to genuinely be a sample of `x*`, use qTS instead. If informational sites matter and `q ≤ 4`, pay for joint qKG. KB is the policy that remains once those three bills are declined and clones are still refused.

## Order, search, cost

Greedy: `z1` never comes back for revision. Each slot needs its own multi-start. After a soft (noisy) KB update, a single start at `zi` often just re-proposes `zi` itself, since some uncertainty survives there.

Two coded points closer than roughly `ℓ/3` are effectively one plant run. Log the minimum pairwise distance in the shipped batch.

Cost: `q` acquisition searches plus `q-1` rank-1 updates. No integral over `y` anywhere — that's exactly why this method is the one that ships in practice over the joint alternatives.

**Usual fakes:** leaving fake pairs sitting in `Dn`; calling KB "qKG"; running noiseless KB on a plant with large real `σ²`, then being surprised that four shipped points sit clustered in two basins of a mean that was wrong to begin with.
