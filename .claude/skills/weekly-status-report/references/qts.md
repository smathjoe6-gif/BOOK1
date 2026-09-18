# qTS (Batch Thompson Sampling)

qTS builds a batch by sampling the posterior on the minimizer: draw `q` functions from the GP, take each function's argmin, repair collisions, evaluate the real `f`. There's no joint surface here and no fantasy `y` — it's a fundamentally different kind of batch method than qEI, qKG (`references/qkg.md`), or Kriging Believer (`references/fantasy-average.md`).

It's a policy that returns a set. It is not qEI, not qKG, and not Kriging Believer, however similar the acronym looks. qTS is often listed next to qEI and qKG as a "batch acquisition" — it isn't one, strictly speaking. An acquisition is a scalar `a_n(x)` (or `a_n(Z)`) that gets maximized. qTS has no joint score of the set at all; it just draws `q` worlds and takes each one's minimizer.

### Why people still call it an acquisition anyway

It occupies the same slot in the BO loop: posterior → next `X` → evaluate. On a leaderboard, terminal `y` or simple regret can be compared against qEI's. That doesn't make the underlying objects equal — one is an expectation being maximized, the other is a sampling procedure with no scalar objective behind it at all.

## Mechanics

Posterior `p(f | Dn)`.

For `j = 1, ..., q`: draw a path `f̃^(j) ~ p(f | Dn)`, set `zj = argmin f̃^(j)` with multi-start (drawing the constraint on that same sampled world too, if there is one).

The `q` draws are independent given the data. Sites in the batch are correlated *only* because they share `πn` — there is no `q×q` look-ahead Cholesky factorization anywhere in this method, unlike the joint qKG/qEI machinery.

Paths must respect posterior covariance: grid factorization, pathwise/Matheron, or random Fourier features (all covered in `references/thompson-sampling.md`). Independent `f̃(x) ~ N(μn(x), σn²(x))` drawn separately at each `x` is not qTS — same trap as single-point GP-TS.

When the real `y`'s come back, update from those only. Fantasy pairs don't exist in this method at all — don't invent them the way KB or fantasy-average do.

## Repair is the actual design choice

If the posterior carries fewer distinct stories than `q`, path-minimizers land on the same basin repeatedly. Name the repair used:

- **Drop near-duplicates** (distance `δ` as a fraction of a lengthscale) and draw extra paths to replace them.
- **Nudge a clone** to that path's runner-up minimizer instead.
- **Repulsive TS** (later draws avoid balls around already-chosen `z`) — this is a genuinely different algorithm from vanilla qTS, not a repair of it.
- **Cap `q`** at how many distinct minimizers the last 20 paths actually produced.

If 20 paths give 2 unique minimizers, the posterior is finished exploring that much of the space. Shrinking `q` is the honest move. Padding the batch out with repulsion while still calling it qTS is a different algorithm wearing the same name.

**Collapse index = unique(Z) / q.** Log it every batch. Eight points landing in one lengthscale ball is a result worth reporting, not a bug to quietly patch.

## What the batch is (and isn't) maximizing

Each `zj` is optimal in exactly one sampled world. The batch as a whole is a **Monte Carlo sample of `x* | Dn`.**

It does not maximize expected improvement of the set, expected drop in `min μ`, or diversity for its own sake. Scatter appears only while the paths still disagree about where `x*` is. Once they agree, they stack — and that stack is exploitation, which is exactly what Thompson Sampling is supposed to do at that stage.

## Cost and constraints

`q` draws plus `q` cheap global minimizations — usually cheaper than qEI/qKG. The real cost is path quality and multi-start, not a `q`-dimensional integral.

**Constraints:** draw `(f̃, c̃)` together; minimize `f̃` subject to `c̃ ≤ 0`; if that sampled world has no feasible point, take the least-violating point or redraw that slot. **Mixed/discrete `x`:** `q` independent TS plays on the finite set, then de-duplicate.

## Versus the other batch machines

| | qTS | qEI | qKG | Kriging Believer |
|---|---|---|---|---|
| Object | Sample of `x*` | `E[best new y in the set]` | `E[drop in min μ]` | Next `a(·)` after fake `y = μ(z)` |
| Joint look-ahead | No | Yes | Yes | No |
| Informational site | Only if a path's minimum lands there | Rare | Yes | No |
| One basin left | Stacks | Stacks | Stacks | Pushes away by killing `σ` |

Kriging Believer forces separation between batch points on purpose (`references/fantasy-average.md`). qTS instead reports honestly that every sampled world wants the same point — opposite attitudes toward a posterior that's already collapsed onto one basin, and neither is wrong, they're just answering different questions.

## How to discuss it in a report

Write: policy = qTS; draw method; `q` requested / unique after repair; repair rule; collapse index; kernel and nugget.

**Do not write a `qTS(Z)` number next to `q̂KG(Z)` as if they were the same utility** — they aren't. A qTS set may still be *scored* afterward with a post-hoc `q̂KG` or best-raw-`y` number in a bake-off; label that score as the bake-off metric, never as "the qTS acquisition value."

## Weekly strip

Draw method used; `q` requested versus unique after repair; the repair rule and its `δ`; whether constraints were drawn jointly; the collapse index.

**Usual fakes:** independent-marginal "paths" passed off as posterior samples; padding out `q` with repulsion while still calling the result qTS; comparing qTS's best raw `y` to qKG's `min μ` as if the two methods targeted the same object.
