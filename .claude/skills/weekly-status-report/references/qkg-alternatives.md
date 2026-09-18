# qKG Alternatives — the map

qKG (`references/qkg.md`) scores a batch by the expected drop in `min μ` after all `q` outcomes land. That's the right object when the week returns a small set and the decision is the next recommendation. It's also a `q`-dimensional expectation plus an inner `argmin μ` per fantasy — genuinely expensive. The substitutes below each drop part of that object on purpose. **Do not call any of them qKG.**

## Stay in the KG family (cheaper)

- **Greedy 1-KG:** pick `z1` by ordinary KG (`references/knowledge-gradient.md`), update a working GP, pick `z2`, and so on.
- **Fantasy-average greedy KG:** same, but the next KG is averaged over `T` predictive `y`'s of the prefix (`references/fantasy-average.md`).
- **One-shot / stochastic-gradient qKG:** optimize the joint set approximately, rather than exactly.

These still aim at (a relaxation of) "better `argmin μ`." They never un-pick `z1` once chosen. Use this family when the KG goal is wanted but joint MC can't be run.

## Change the object (still joint, but not KG)

- **qEI** — expected improvement of the best new sample in the set. Same cost class as qKG, but a different utility entirely. Use it when the week is judged by observed `y`, not by the posterior recommendation.
- **Batch MES/PES** — information about `f*` or `x*`. Will buy purely informational sites. Worth the cost only when each run is brutal and `d` is small.

## Stop looking ahead: sample `x*` instead

**qTS** (`references/qts.md`) — `q` posterior paths, `q` minimizers, repair clones. Targets a Monte Carlo sample of the minimizer, not an expected-value calculation at all. Cheapest serious method on this whole page. When one basin remains, points stack; that collapse is a diagnostic about the posterior, not a bug. Padding the batch out with repulsion to force `q=16` distinct points is a *different* algorithm, not a repaired qTS.

## Greedy improvement plus a liar

Freeze the prefix, insert a fake `y`, maximize 1-EI or 1-LCB again (`references/fantasy-average.md`, `references/kriging-believer.md`):

| Liar | Fake `y` | What happens |
|---|---|---|
| Kriging Believer | `μ(zi)`, often noiseless | Mean frozen, `σ` killed near `zi`; later points leave the ball |
| Constant liar | Published `L` | More exploration; the method *is* the choice of `L` |
| Fantasy average | Average `a` over `T` draws | Middle ground on both cost and honesty |

**KB+EI is the industrial default — and the usual thing mislabeled qKG.** It forces separation between batch points. It cannot value a purely informational site, and it cannot doubt `μn` once committed to it.

**LCB + `κ` + KB** is the same scheduler with an explicit explore knob bolted on.

## Separate points without a fantasy GP at all

- **Local penalization** — multiply `a(x)` by a Lipschitz exclusion bump around each chosen `zi`. No GP update at all. The exclusion radius is a Lipschitz guess.
- **Hard min-distance / DPP** — reject any candidate sitting inside `δ ~ ℓ/3` of an already-chosen point.

These two de-clone the batch. **They do not score decision value** — they're purely geometric, not statistical.

## Chooser

| Situation | Use |
|---|---|
| `q ≤ 4`, care about `argmin μ`, can pay for Monte Carlo | Joint qKG or FA-greedy-KG |
| Care about best raw `y` | qEI or FA-greedy-EI |
| Noisy plant, simple, honest about collapse | qTS |
| Must ship this afternoon | KB+EI — written up as exactly that, KB+EI |
| One basin left, large requested `q` | Shrink `q` |
| No GP-update budget at all | Local penalization + EI, publish `δ` |
| Tiny `d`, locate `x*` | Batch MES/PES |

Leaving joint qKG behind means giving up the value of an informational `z`, the correct joint correlation across the `q` predictive `y`'s, and a number that actually means "batch decision value." What's kept is only "not all the same incumbent" — which is all KB and local penalization ever promised in the first place.

## Weekly strip

Exact name of the alternative in use; `q`; whichever of `L` / `T` / `δ` / `κ` applies; `unique(Z)/q`; which object was actually being targeted (recommendation, observed `y`, or a Monte Carlo sample of `x*`).
