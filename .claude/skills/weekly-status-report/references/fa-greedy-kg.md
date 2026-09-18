# Fantasy-Average Greedy KG (FA-greedy-KG)

FA-greedy-KG is a batch scheduler wrapped around one-point KG (`references/knowledge-gradient.md`). Slot `i+1` maximizes the KG expected *after seeing the prefix*, with the prefix outcomes still random. **It does not maximize joint `qKG(Z)`** (`references/qkg.md`) — see `references/qkg-alternatives.md` for where this sits among the other substitutes.

## The object

Prefix `Zi = {z1, ..., zi}` is already frozen.

```
z(i+1) = argmax_z  E_{y(1:i) | Zi, Dn} [ KG(z | Dn, Zi, y(1:i)) ]
```

Two expectations, doing different jobs:

- **Outer (fantasy average)** — over the unrealized prefix `y(1:i)`.
- **Inner (KG)** — over the next `y` at the candidate `z`, evaluated on that fantasy GP.

Joint qKG is one expectation over `y(1:q)` with all of `Z` free at once. FA-greedy never un-picks `z1`, and never looks at `z(i+2:q)` while choosing `z(i+1)` — it's a genuinely smaller object than the joint one.

## Slot mechanics

**Slot 1.** Ordinary `KGn(z)`. No prefix yet.

**Later slots:**

1. Draw `T` prefix outcomes from the joint predictive at `Zi`: `ỹ^(t) ~ N(μn(Zi), Kn(Zi,Zi) + σ²I)`.
2. Rank-`i` update → fantasy GP `G^(t)` with mean `μ^(t)`.
3. On each `G^(t)`, estimate one-point `KG^(t)(z)` (inner fantasies, or discrete KG on an inner set).
4. `K̄G(z) = (1/T) Σt KG^(t)(z)`.
5. Multi-start `z(i+1) = argmax K̄G` among operable points.

**Do not insert a Kriging-Believer pair here.** The prefix stays as design locations only until real `y`'s arrive — update `Dn` once, from the real observations.

## Inner KG still has to be real KG

On each `G^(t)`:

```
KG^(t)(z) = E_{y | z, G^(t)} [ min μ^(t) - min μ^(t,+)(· | z,y) ]
```

The inner min is over all of `X`, not over `{z}` alone. The inner candidate set must contain `argmin μ^(t)`, high-`σ` sites, the prefix, and last week's recommendation. Miss the incumbent in that set and every fantasy will understate KG systematically.

Cost per slot, per candidate: `T × T_in × (rank-1 update + inner min)`, plus `T` rank-`i` prefix updates reused across every candidate in that slot.

**Practical split:** freeze the `T` prefix GPs once; run inner KG only on a shortlist of `z`. Typical `T=8–16`, `T_in=8–16` on that shortlist. Use the same outer `ỹ^(t)` draws for every candidate in the slot — this is mandatory, not optional, same discipline as `references/nested-monte-carlo-utility.md`. Couple the inner `N(0,1)` seeds when ranking candidates against each other.

If `K̄G(1) - K̄G(2)` sits inside the standard error of that difference, raise `T` or `T_in` before trusting the ranking — otherwise `z(i+1)` is just Monte Carlo noise wearing a decision.

## Versus KB-greedy-KG and joint qKG

| | Prefix `y` | Next utility | Full `Z` joint? |
|---|---|---|---|
| Joint qKG | Integrated, all `z` free | Drop in `min μ` after `q` `y`'s | Yes |
| FA-greedy-KG | Monte Carlo average, prefix frozen | 1-KG after the prefix | No |
| KB-greedy-KG | One lie `ỹ = μ(Zi)` | 1-KG after that lie | No |

KB is FA with `T=1` and `ỹ` replaced by the posterior mean (`references/kriging-believer.md`). FA can keep two basins alive in `K̄G` when half the prefix fantasies deepen basin A and half deepen basin B. KB cannot do this — it freezes `μ` outright and only kills `σ`.

qTS (`references/qts.md`) still doesn't belong anywhere in this table: it never computes KG at all.

## Failure modes

Inner set missing `argmin μ^(t)`; `T=1` billed as fantasy average when it's really sample-liar or KB; mixing KB working copies together with FA in the same batch (double fiction stacked on itself); one local max of `K̄G` sitting right at `zi`; fantasy pairs left in `Dn` after the batch ships.

## Weekly strip

`q` and the current slot; outer `T` and inner `T_in` (or discrete KG, if used instead); the inner-set rule; the top `K̄G` gap versus its standard error; minimum distance realized inside `Z`.
