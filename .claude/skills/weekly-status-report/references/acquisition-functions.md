# Acquisition Functions — the survey

A BO acquisition is a rule that turns `p(f | Dn)` into the next `x` (or batch). The functions below all share one GP posterior — they do **not** share a goal, and they don't all maximize the same one-step utility. This file is the map across the individual references (`references/bayesian-optimization.md`, `references/thompson-sampling.md`, `references/knowledge-gradient.md`, `references/qkg.md`, `references/qts.md`, `references/fantasy-average.md`).

**Kernel misspecification beats acquisition choice, every time.** If lengthscales are sitting on their bounds (`references/gp-kernels.md`), swapping EI for MES is theater — fix the kernel first.

## Four families

**Improvement** — value a better sample at this `x`.

- **PI:** `P(f(x) < f*n - ξ)`. Collapses unless `ξ` is grown over time.
- **EI:** `E[(f*n - f(x))+]`, closed form from `μn, σn`. Default for low-noise, `q=1`. The incumbent must be named explicitly: best observation if noiseless, best posterior mean on evaluated points if noisy. Noiseless EI measured against a lucky noisy `y` is the standard failure mode (see the incumbent problem in `references/bayesian-optimization.md`).

**Bonus** — value `μ - κσ`.

- **LCB/UCB.** Exploration is entirely the published `κ` schedule. GP-UCB regret theory lives here. A fixed `κ=2` is a policy choice, not a theorem — say which one is in use.

**Sampling** — don't maximize a scalar `a(x)` at all.

- **Thompson:** draw a path `f̃`, take `argmin f̃`. Batch = qTS = `q` paths (`references/qts.md`). Exploration is leftover disagreement about `x*`. Independent per-point Normals are not TS (`references/thompson-sampling.md`).

**Look-ahead / information** — value the *next posterior*, not this `y`.

- **KG:** expected drop in `min μ` after `y`. Can measure a point that will never itself be recommended. Native to noise (`references/knowledge-gradient.md`).
- **PES/ES/MES:** information about `x*` or `f*`. Informational sites on purpose.

Maximizing information about *all* of `f` is active learning, not BO — that maps irrelevant hills nobody asked about.

**KG looks ahead at the recommendation. EI looks ahead at this sample.** Calling both "one-step look-ahead" erases exactly the distinction that matters.

## Batches and constraints

True joint objects: qEI (best new `y` in the set), qKG (drop in `min μ` after the set, `references/qkg.md`). Both are `q`-dimensional expectations.

Cheap schedulers when the joint form is too heavy (`references/fantasy-average.md`): Kriging Believer (`y ← μ(z)`, kills `σ`, pushes later points away), constant liar (a published `L`), fantasy average (average the next `a` over `T` fantasies of the prefix). **None of these are joint qKG**, however close the name sounds.

qTS doesn't look ahead at all — it samples `x*` directly. When one basin remains, qTS stacks its batch there; KB still forces separation by construction. Neither is wrong; they're answering different questions (`references/qts.md`).

**Constraints:** a cheap-to-check constraint just masks `a(x)`. An expensive constraint gets its own GP on `c`, then either PF×EI or constrained TS. **Several Ys:** expected hypervolume, or a scalarizer that's actually willing to be printed and defended.

## A short chooser

| Situation | Start here |
|---|---|
| Low noise, `q=1`, need a plot of "why this `x`" | EI (noisy-EI if `σn > 0`) |
| Explicit, publishable explore schedule | LCB, publish `κ` |
| Noisy plant, simple batch | qTS |
| Last few runs are brutal; care about `argmin μ` | KG or FA-greedy-KG |
| Tiny `d`, locate `x*`, then stop | MES / PES |
| First 15 points, kernel still moving | EI, LCB, or TS — fix `k` first |

Every scalar `a(x)` is multimodal. Multi-start it, regardless of which family is in use. One local max sitting right at last week's incumbent is the silent failure mode shared by EI, LCB, and KG alike.

## Weekly strip

Family and exact variant in use; the incumbent, or `κ`, or `T` (whichever applies); `q` and the batch scheduler; whether `a(x)` was actually multi-started; how constraints were handled.
