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

**Slot 1.** No prefix — ordinary one-point KG on the real GP:

```
KGn(z) = E_{y | z, Dn} [ min μn - min μ(n+1)(· | z,y) ]
```

Estimate by discrete KG on an inner set, or by Monte Carlo `y` plus `argmin μ(n+1)`. Multi-start `z1 = argmax KGn`.

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

### What the average does that KB cannot

Each prefix fantasy deepens a slightly different story — the mean actually moves, and `σ` near `Zi` drops in that fantasy's particular way. `K̄G` is the mix of those one-point KGs, not a single frozen story. If half the fantasies deepen basin A and half deepen basin B, slot `i+1` can still value B fairly. KB freezes `μ` and only kills `σ`, so it plans the rest of the week inside one story — whatever the current mean happens to say.

Neither method revises `z1`, though. If 1-KG in slot 1 refused an informational ridge, FA will not retroactively put `z1` there later — only joint qKG can actually do that.

## Joint qKG versus FA-greedy-KG, in full

**Joint qKG treats the batch as one decision. FA-greedy-KG treats it as `q` stacked one-point decisions.** Both target the same utility family — expected drop in `min μ` (`references/qkg.md`) — and disagree about which variables are free when that drop is computed.

**Joint qKG** is one expectation with the whole set `Z` free at once:

```
qKGn(Z) = E_{y(1:q) | Z,Dn}[ min μn - min μ(n+q)(· | Z,y(1:q)) ]
```

A site can exist purely to split two basins. Correlation among all `q` predictive `y`'s sits inside the definition itself.

**FA-greedy-KG** is `q` separate searches. Slot 1 is ordinary KG; slot `i+1` freezes the prefix `Zi` and maximizes `K̄G(z)` as above, with `z(i+2:q)` invisible to that choice and `z1` never revised. **FA is a Monte Carlo estimate of expected next myopic KG after a frozen prefix — it is not a Monte Carlo estimate of `qKG(Z)`.** That distinction is the whole point of this comparison.

### Side-by-side

| | Joint qKG | FA-greedy-KG |
|---|---|---|
| Decision after the week | `argmin μ(n+q)` | Same intent, not guaranteed |
| Free variables | All of `Z` | Only the current slot |
| Look-ahead depth | `q` outcomes at once | 1 outcome on top of a fantasy prefix |
| Informational site in slot 1 | Yes, if it helps the set | Only if it wins one-point KG right now |
| Prefix `y` | Integrated jointly with future `z`'s | Integrated, but future `z`'s absent |
| Correlation of all `q` `y`'s | Yes | Only among the prefix, plus one more |
| Typical `q` if honest | 2–4 (joint MC) | 2–8 (greedy) |
| Cost shape | Optimize over `X^q` × `T_joint` inner mins | `Σi T_out·T_in` on a shortlist |
| Revises `z1` | Yes, in principle | Never |

### Where they pick different points

- **One basin, small noise.** Both clone or near-clone. Shrink `q` — neither method is at fault here.
- **Two basins, `q=2`.** Joint qKG may put one point in each basin, or one in a basin and one on a ridge that splits them, because the *set's* `Δ min μ` is the score. FA-greedy sends `z1` to the 1-KG winner (usually the leading basin); slot 2 then averages 1-KG on fantasies of that first site — often the second basin, sometimes a near-duplicate if the fantasies collapse `σ` the way KB does. It will not move `z1` onto the ridge if 1-KG alone never wanted the ridge.
- **Asymmetric costs / operability.** Joint can trade "slightly worse `z1`" for a legal pair. Greedy cannot — `z1` is already locked in.
- **Larger `q`.** Greedy error accumulates: early 1-KG greed locks in a story, and later slots only ever condition on that story. Joint, if it could actually be run, would rebalance the whole set instead.

### Cost is not a small factor

Joint: optimize in `X^q`, each trial `Z` paying `T` fantasies × an inner `min μ`. Honest at `q=2–4`.

FA-greedy: `q` ordinary-sized searches. Prefix GPs are built `T` times per slot and reused across every candidate `z` in that slot — that's exactly why this ships at `q=6` when joint does not.

KB-greedy-KG is cheaper still (`T=1`, `ỹ=μ`) and is **not** FA — see the table above for why the two-basin case tells them apart.

### What number is actually allowed on the page

After picking `Z_FA`, `q̂KG(Z_FA)` can be evaluated with a *separate* joint Monte Carlo run — as a score of the set that was obtained, never as proof that qKG was maximized. Compare that score against `q̂KG` of a qTS set or a KB set computed on the same `T` — that's an honest bake-off. **Comparing `K̄G(zq)` to `qKG(Z)` directly is mixing units** and should never appear in the same table as if they were the same number.

### When to prefer which

| Situation | Prefer |
|---|---|
| `q=2–3`, last expensive week, care about `argmin μ` | Joint qKG |
| `q=4–8`, same object, can't search `X^q` | FA-greedy-KG |
| Need an audit trail this afternoon | KB+KG or KB+EI, labeled as exactly that |
| Posterior already one-basin | Shrink `q`; stop comparing methods |

**Usual confusion:** publishing FA-greedy points under the heading "qKG"; using `T=1` and `ỹ=μ` while calling it fantasy average; scoring FA by best raw `y` and joint qKG by `Δ min μ` in the same comparison table.

## Failure modes

Inner set missing `argmin μ^(t)`; `T=1` billed as fantasy average when it's really sample-liar or KB; mixing KB working copies together with FA in the same batch (double fiction stacked on itself); one local max of `K̄G` sitting right at `zi`; fantasy pairs left in `Dn` after the batch ships.

## Weekly strip

`q` and the current slot; outer `T` and inner `T_in` (or discrete KG, if used instead); the inner-set rule; the top `K̄G` gap versus its standard error; minimum distance realized inside `Z`.
