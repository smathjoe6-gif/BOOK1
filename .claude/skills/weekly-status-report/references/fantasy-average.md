# Fantasy-Average Batch Scheduling

Fantasy-average variants are not an acquisition function — they're a **batch scheduler**. There's already a one-point rule (EI, KG, LCB); `q` points are needed that return together; joint qKG/qEI (`references/qkg.md`) can't be afforded. So: pick `z1`, pretend the GP has already seen it, pick `z2`, and so on. The variants below only disagree about what the pretend `y` is.

## The skeleton

`z1 = argmax a_n(z)` on the real posterior. For each later slot, build a fantasy posterior from `(z(1:i), ỹ(1:i))`, maximize a (possibly averaged) acquisition on that fantasy posterior, freeze `z(i+1)`.

Joint qKG/qEI still optimize the whole set at once. This loop never un-picks `z1` once it's chosen — **that's the approximation** being made, and it should be named as one.

## Single-lie plug-ins

- **Kriging believer (KB).** `ỹi = μn(zi)`. Deterministic. The posterior mean is pretended to be the true outcome, and that it was learned. Variance near `zi` collapses as if `f(zi)` were actually known. Later points get pushed toward other basins of `μ`. Cheap. If `μn(z1)` is a lie (and it always somewhat is), the rest of the batch gets planned in the wrong world. See below for the full mechanics.
- **Constant liar (CL).** `ỹi = L` for a published constant. Minimization examples: the incumbent `f*n`; a pessimistic quantile; `μn + c·σn`. This doesn't pretend the truth was learned — it pretends the outcome was boring or bad, so later points keep hunting elsewhere. The whole method reduces to the choice of `L`. Using min-observed-`y` as `L` on a noisy plant is the noiseless-EI trap again (`references/bayesian-optimization.md`).
- **Sample liar.** One Thompson path, `ỹi = f̃(zi)` (plus a noise draw, if being honest about it). One world. High week-to-week jitter. This is not an average of anything.

## Kriging Believer in detail

KB is the cheapest sequential-batch trick of the three: after `zi` is picked, the GP updates as if the outcome were already the current posterior mean `μn(zi)`. No fantasy integral, no constant to publish. Then the same acquisition is maximized again on that fake posterior. **It's a scheduler, not an acquisition** — EI, KG, or LCB stay exactly as they are; only the dataset the next pick sees is fake.

### What "believer" writes into the GP

Real data `Dn = {(xj,yj)}`. `z` has been chosen and `y(z)` isn't known yet. KB appends the pair `(z, μn(z))` and treats it as a noiseless (or very-low-noise) observation of `f(z)`.

After that rank-1 update:

```
μ_KB(z) = μn(z)          exactly
σ_KB(z) ≈ 0               if the fantasy nugget ≈ 0
```

Nearby points shrink by the usual GP formula — correlation with `z` determines how much uncertainty gets pretended away. `f(z)` was never observed; `μn(z)` was. **The believer believes the mean.**

If `μn(z)` is instead inserted with the same observation noise `σ²` as real data, `σ_KB(z)` doesn't hit zero — that's a milder variant and should be named explicitly ("noisy KB"). Classic KB is the noiseless insert.

### Mechanics of one batch

Want `q` points from acquisition `a`:

1. Fit the GP on real `Dn`.
2. `z1 = argmax_z a(z | Dn)`.
3. For `i = 1, ..., q-1`:
   - set `ỹi = μ^(i)(zi)` on the current fantasy GP
   - append `(zi, ỹi)` (usually `σ²_fant = 0`)
   - recompute `μ, σ` (a rank-1 / rank-i update — don't refactor from scratch if it can be avoided)
   - `z(i+1) = argmax_z a(z | Dn ∪ {fantasies})`
4. Ship `{z1, ..., zq}`. **Do not keep the fake pairs in `Dn`.** When the real batch `y(1:q)` returns, update once from the true observations.

Step 4 is where a week's batch gets silently corrupted: KB pairs left sitting in the training set, then double-counted once real lab data arrive on top of them.

### What the fake update does to the next acquisition

Because `σ_KB(zi) ≈ 0`:

- EI at `zi` and in its lengthscale neighborhood drops to 0 — no improvement left to expect there.
- LCB loses the `κσ` bonus near `zi`, so it gets pushed out.
- KG sees almost no further change in `min μ` from measuring the same spot again.

So later points are driven away from `zi` — that's the feature, versus `q` independent one-point EI maxima which would otherwise all stack on the incumbent.

Because `ỹi = μn(zi)`:

- `μ` itself barely moves. KB doesn't invent a better or worse basin — it only deletes uncertainty.
- The shape of `μ` — including a wrong basin — is treated as settled. Later picks just exploit other bumps of that same `μ`.

**That's the failure mode.** If `z1` was chosen on a misleading mean, KB plans the rest of the week inside that same wrong story. Constant liar and fantasy average keep some residual doubt alive; joint qKG can even buy a purely informational site. KB will not do either.

### Algebra of the rank-1 pretend update

Let `kz = k(·,z)`, `s² = k(z,z) + σ²_fant`, residual `r = ỹ - μn(z) = 0` under KB:

```
μ_KB(x)   = μn(x) + kn(x,z) · s⁻² · r  =  μn(x)
k_KB(x,x') = kn(x,x') - kn(x,z) · s⁻² · kn(z,x')
```

Mean frozen exactly, covariance deflated along the kernel column of `z`. That identity is why KB is cheap, and exactly why it can't repair a wrong `μn`.

### Details that change the batch

- **Fantasy noise.** `σ²_fant = 0` → a hard exclusion zone. `σ²_fant = σ²_obs` → softer, allows near-duplicates.
- **Order.** Strictly greedy — `z1` is never revised once picked.
- **Acquisition search.** Multi-start on each of the `q` passes. One start at `zi` just re-proposes `zi` if `σ` hasn't fully died there yet.
- **Duplicates.** If two accepted `z`'s sit closer than a lengthscale apart, the plant effectively only sees `q-1` distinct points — measure the minimum pairwise distance in `X` after the batch is chosen.

### Versus the other liars

| | Fake `y` | `μ` after insertion | Later points |
|---|---|---|---|
| KB | `μn(z)` | Unchanged | Other basins of the same `μ` |
| Constant liar | Published `L` | Shifts toward `L` | More exploration / can re-attack the same basin |
| Fantasy average | Many draws, average `a` | Average over worlds | Middle ground |
| qTS | No plug-in at all | — | Minimizers of `q` independent paths |

## Fantasy average (FA)

Draw `T` joint fantasies of the prefix:

```
ỹ(1:i)^(t) ~ p(y(1:i) | z(1:i), Dn)
```

update, compute `a^(t)(z)` on each fantasy posterior, and set:

```
ā(z) = (1/T) Σt a^(t)(z)
```

Then `z(i+1) = argmax ā`.

This estimates the *expected* next acquisition after the prefix. It is **not** joint batch value. As `T → ∞`, FA-greedy-KG converges to a well-defined myopic-after-prefix object — it still does not jointly optimize `{z1, ..., zq}` the way true qKG does.

`T=1` is just sample liar — don't call it fantasy average. Serious settings use `T=8–16`. `T=64` with `q=8` is a sign to switch to qTS (`references/thompson-sampling.md`) instead of paying this much for a greedy approximation.

## What leftover `σ` does to the rest of the batch

| Plug-in | Near `zi` | Later points |
|---|---|---|
| KB | `σ` collapses "happily" | Pushed to other basins of `μ`; few clones |
| Pessimistic CL | Less happy collapse | More exploration; can re-attack the same basin |
| FA | Average of many collapses | Middle ground: avoids clones, keeps second stories alive |
| Joint qKG | Not a plug-in at all | Can buy a purely informational site |

## Pairing with a base acquisition

- **FA + KG** ≈ the practical qKG people actually ship (`references/qkg.md`).
- **FA + EI** ≈ the practical qEI people actually ship.
- **FA + LCB** works cleanly — the fantasy `σ` just feeds `κσ` directly.
- **FA + TS** is usually pointless — draw `q` independent posterior paths instead (`references/thompson-sampling.md`).

Cost is `Σ(i=1 to q-1) T × (rank-i update + acquisition search)`. KB and CL are the `T=1` special case.

## Weekly strip

Scheduler in use (KB / CL / FA / joint), base acquisition, the lie `L` or fantasy count `T`, `q`, minimum distance enforced inside `Z`.

For KB specifically: KB vs. noisy-KB, the base acquisition, `q`, whether the fantasy nugget was 0 or `σ²`, the minimum pairwise distance realized in the batch, and confirmation that the fake pairs were dropped before the real update ran.

**Usual fakes:** a "fantasized qKG" that's actually kriging believer with `T=1`; constant liar run with an unpublished `L`; two prefixes ranked using independent Normal draws instead of shared fantasies; comparing FA-greedy-EI's final best result to joint qKG's as if the two methods optimized the same object; leaving `(z, μ(z))` sitting in the training set after shipping the batch; calling KB "qKG" outright; running noiseless KB on a plant with large real `σ²` and then being surprised the batch comes back as four clones split across two basins of a mean that was wrong to begin with.
