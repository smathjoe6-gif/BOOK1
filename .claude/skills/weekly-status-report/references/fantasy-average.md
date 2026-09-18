# Fantasy-Average Batch Scheduling

Fantasy-average variants are not an acquisition function — they're a **batch scheduler**. There's already a one-point rule (EI, KG, LCB); `q` points are needed that return together; joint qKG/qEI (`references/qkg.md`) can't be afforded. So: pick `z1`, pretend the GP has already seen it, pick `z2`, and so on. The variants below only disagree about what the pretend `y` is.

## The skeleton

`z1 = argmax a_n(z)` on the real posterior. For each later slot, build a fantasy posterior from `(z(1:i), ỹ(1:i))`, maximize a (possibly averaged) acquisition on that fantasy posterior, freeze `z(i+1)`.

Joint qKG/qEI still optimize the whole set at once. This loop never un-picks `z1` once it's chosen — **that's the approximation** being made, and it should be named as one.

## Single-lie plug-ins

- **Kriging believer (KB).** `ỹi = μn(zi)`. Deterministic. The posterior mean is pretended to be the true outcome, and that it was learned. Variance near `zi` collapses as if `f(zi)` were actually known. Later points get pushed toward other basins of `μ`. Cheap. If `μn(z1)` is a lie (and it always somewhat is), the rest of the batch gets planned in the wrong world. See below for the full mechanics.
- **Constant liar (CL).** `ỹi = L` for a published constant. Minimization examples: the incumbent `f*n`; a pessimistic quantile; `μn + c·σn`. This doesn't pretend the truth was learned — it pretends the outcome was boring or bad, so later points keep hunting elsewhere. The whole method reduces to the choice of `L`. Using min-observed-`y` as `L` on a noisy plant is the noiseless-EI trap again (`references/bayesian-optimization.md`).
- **Sample liar.** One Thompson path, `ỹi = f̃(zi)` (plus a noise draw, if being honest about it). One world. High week-to-week jitter. This is not an average of anything.

## Kriging Believer

KB is the cheapest sequential-batch trick of the three: after `zi` is picked, the GP updates as if the outcome were already the current posterior mean `μn(zi)`. No fantasy integral, no constant to publish. Then the same acquisition is maximized again on that fake posterior. **It's a scheduler, not an acquisition** — EI, KG, or LCB stay exactly as they are; only the dataset the next pick sees is fake.

Full mechanics — the state/loop procedure, the rank-1 update algebra, why later points get pushed away, and its inability to discover a better basin — now live in `references/kriging-believer.md`.

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
