# qTS (Batch Thompson Sampling)

qTS builds a batch by sampling the posterior on the minimizer: draw `q` functions from the GP, take each function's argmin, repair collisions, evaluate the real `f`. There's no joint surface here and no fantasy `y` — it's a fundamentally different kind of batch method than qEI, qKG (`references/qkg.md`), or Kriging Believer (`references/fantasy-average.md`).

It's a policy that returns a set. It is not qEI, not qKG, and not Kriging Believer, however similar the acronym looks. qTS is often listed next to qEI and qKG as a "batch acquisition" — it isn't one, strictly speaking. An acquisition is a scalar `a_n(x)` (or `a_n(Z)`) that gets maximized. qTS has no joint score of the set at all; it just draws `q` worlds and takes each one's minimizer.

### Why people still call it an acquisition anyway

It occupies the same slot in the BO loop: posterior → next `X` → evaluate. On a leaderboard, terminal `y` or simple regret can be compared against qEI's. That doesn't make the underlying objects equal — one is an expectation being maximized, the other is a sampling procedure with no scalar objective behind it at all.

## Mechanics

Posterior `p(f | Dn)`.

For `j = 1, ..., q`: draw a path `f̃^(j) ~ p(f | Dn)`, set `zj = argmin f̃^(j)` with multi-start (drawing the constraint on that same sampled world too, if there is one).

The `q` draws are independent given the data. Sites in the batch are correlated *only* because they share `πn` — there is no `q×q` look-ahead Cholesky factorization anywhere in this method, unlike the joint qKG/qEI machinery.

When the real `y`'s come back, update from those only. Fantasy pairs don't exist in this method at all — don't invent them the way KB or fantasy-average do (`references/kriging-believer.md`, `references/fantasy-average.md`).

### The sampling method is the whole algorithm

qTS's draw procedure — how the `q` functions actually get sampled — **is** the algorithm. Everything after it is just "take argmin, repair clones." If the draw is wrong, the resulting batch is not Thompson Sampling, whatever the code calls it.

What has to be sampled: `q` i.i.d. paths from the full GP posterior, `f̃^(j) ~ GP(μn, kn)` for `j = 1, ..., q`, then `zj = argmin_x f̃^(j)(x)`. The object being drawn is a **function**, not a list of independent Normals. Independent `f̃(x) ~ N(μn(x), σn²(x))` at each `x` throws away `kn(x,x')` entirely — those "paths" are jagged phantoms, and that method is not qTS (`references/thompson-sampling.md`).

The `q` paths *are* independent of each other given `Dn`. Correlation among batch members shows up only because they share `πn` — there is no joint look-ahead sample of `y(1:q)` anywhere in this.

### How to draw one path

- **Finite grid (`d=1,2`).** Let `m = μn(Xg)`, `C = kn(Xg,Xg)`. Draw `f̃(Xg) = m + Lε`, `C = LL'`, `ε ~ N(0,I)`. Exact. Cost `O(M³)` per draw unless `L` is cached — the same `C` applies to all `q` draws, so factor it **once**, not once per path.
- **Pathwise / Matheron** (the usual scalable qTS). Draw a prior path `f̃0 ~ GP(m,k)` from features or a spectral expansion, then correct with data:
  ```
  f̃(x) = f̃0(x) + k(x,X)(K_X + σ²I)⁻¹ (y - f̃0(X) - ε̃)
  ```
  This gives an explicit `f̃(x)` ready for L-BFGS. Cache the factorization of `K_X + σ²I` across all `q` draws — only `f̃0` and `ε̃` change per draw. Full derivation, the RFF/inducing options for drawing `f̃0` itself, and the linear-algebra checklist: `references/matheron-rule.md`.
- **Random Fourier features.** Approximate `k` as `φ(x)ᵀφ(x')`, draw prior weights, condition on `y`, get `f̃(x) = wᵀφ(x)`. Cheap to minimize. The bias here is the feature-count truncation — state the feature count used. Full treatment in `references/rff.md`.
- **Discrete candidate set.** Draw from the joint Normal on a finite set `A`, play ordinary TS on `A`. This is exact TS *on that set*, not a continuous path — valid qTS on `A`, but say plainly that it's restricted to `A`.

Cache posterior factorizations. Drawing `q=8` paths should never mean eight separate Choleskys of the same matrix.

### From path to batch

Multi-start minimize each `f̃^(j)` in the unit box. One start at the incumbent makes even genuinely diverse paths look like clones.

**Constraints:** draw `(f̃^(j), c̃^(j))` from the joint posterior when `c` has its own GP. Minimize `f̃^(j)` subject to `c̃^(j) ≤ 0`. An empty feasible world → least-violation, or redraw *that slot only*.

**Batch assembly** is just the list `{z1, ..., zq}`. No fantasy `y`, no KB-style update between draws. Updating the working GP after `z1` would make this a different policy entirely (sequential TS / a liar scheme) — not qTS.

## Repair is the actual design choice

If the posterior carries fewer distinct stories than `q`, path-minimizers land on the same basin repeatedly. Name the repair used:

- **Drop near-duplicates** (distance `δ` as a fraction of a lengthscale) and draw extra paths to replace them.
- **Nudge a clone** to that path's runner-up minimizer instead.
- **Repulsive TS** (later draws avoid balls around already-chosen `z`) — this is a genuinely different algorithm from vanilla qTS, not a repair of it.
- **Cap `q`** at how many distinct minimizers the last 20 paths actually produced.

If 20 paths give 2 unique minimizers, the posterior is finished exploring that much of the space. Shrinking `q` is the honest move. Padding the batch out with repulsion while still calling it qTS is a different algorithm wearing the same name.

Repair happens **after** sampling, not instead of it — independent path-minima collide precisely when `πn` has fewer stories than `q`, not because the draw procedure was wrong.

**Collapse index = unique(Z) / q.** That number *is* the sampling method reporting how many worlds remain — log it every batch. Eight points landing in one lengthscale ball is a result worth reporting, not a bug to quietly patch.

## What qTS does not sample

- It does not sample fantasy *observations* `y(Z)` for a look-ahead — that's KG/EI/FA (`references/knowledge-gradient.md`, `references/fantasy-average.md`).
- It does not sample a joint optimal *set* `Z*` — that's joint qKG/qEI.
- It does not sample `θ` in a parametric mean — that's parametric sequential Bayes (`references/sequential-bayesian-design.md`).

One world = one function = one claimed `x*`. `q` worlds = `q` claimed `x*`'s, nothing more.

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
