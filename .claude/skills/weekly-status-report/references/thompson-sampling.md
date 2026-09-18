# Thompson Sampling

Thompson Sampling plays an action with probability equal to the posterior probability that the action is optimal. Mechanically: draw one world from the posterior, act optimally in that world. It's a policy. It's only as honest as the posterior behind it.

## Finite arms

Arms `a = 1, ..., K`, posterior `πn` on the means (or on a parameter that maps to means).

Each round: draw `μ̃ ~ πn`, play `argmax_a μ̃a`, update.

That's **probability matching**. Exploration here isn't an `ε` or a `κ` schedule — it's leftover posterior mass that still lets a laggard win a draw.

Conjugate cases are the clean ones: Beta-Bernoulli, Normal-Normal, Normal-Inverse-Gamma, Gamma-Poisson. No conjugate form means sampling `θ` some other way (MCMC, Laplace, variational). **A point MLE plus jitter is not Thompson Sampling.**

If the prior can't imagine a new arm as best, TS will never play it. Check that prior predictive before round one, not after several rounds of one arm never firing.

## Continuous `x`: GP-TS

In Bayesian optimization (`references/bayesian-optimization.md`) the arm is `x` and the posterior is a GP on `f`.

Each round: draw a function `f̃ ~ p(f | Dn)`, set `x(n+1) = argmin f̃`, evaluate, update the GP.

There's no EI formula here — **the acquisition is the random function itself.**

## How `f̃` actually gets drawn

On a small grid, one multivariate Normal draw from the posterior covariance. That factors an `M×M` matrix — fine in 1-2 dimensions, not beyond.

In higher `d`:

- **Random Fourier features** — an explicit `f̃(x)`, then L-BFGS to minimize it.
- **Pathwise / Matheron updates** — a prior sample plus a data correction; the usual scalable GP-TS approach.
- **Discrete TS on a candidate set** — cheaper, but not a full function draw.

Drawing independent `f̃(x) ~ N(μn(x), σn²(x))` at each `x` separately, ignoring the covariance between them, is **not** GP-TS — it produces jagged phantoms and fake exploration that has nothing to do with the actual posterior over functions.

Minimize `f̃` with a multi-start search. One start at the incumbent stalls the same way one local max of EI stalls in plain Bayesian optimization.

## Batches

Need `q` points this week: draw `q` independent posterior functions, take each one's minimizer, reject or jitter duplicates. Diversity comes from different sampled worlds, not from a joint qEI surface.

If `q` is larger than the number of genuinely distinct stories the posterior still entertains, clones show up. That's a diagnostic that the posterior has narrowed, not a rounding error to patch around.

## Constraints and mixed spaces

Draw `(f̃, c̃)` from the objective GP and the constraint GP together; minimize `f̃` subject to `c̃ ≤ 0`. If that particular sampled world has no feasible point, take the least-violating point or redraw.

Discrete or mixed `x`: treat it as a bandit on the finite set, or use a kernel that actually respects the type. Gradient-walking a one-hot encoding is not GP-TS.

## What the theory is buying

Finite-arm conjugate TS has Bayesian and frequentist regret on the order of `√(KT log T)` (up to the usual logs and constants). GP-TS regret tracks the same information-gain terms as GP-UCB, and therefore the kernel. This says TS is not reckless — it does not say TS picks your kernel, your prior, or your `q` for you.

## Details that change the next point

- **Incumbent definition** — best noisy observation versus best posterior mean. TS minimizing `f̃` cares about the latter; noiseless EI on the former does not (same trap noted in `references/bayesian-optimization.md`).
- Misspecified likelihood or a too-tight prior → premature exploitation.
- An arm never played after many rounds → a prior-mass problem, not bad luck.
- Lengthscales pinned at their bounds → the GP is not a world worth sampling from yet.

**Usual fakes:** independent per-point Normals billed as GP-TS; an MLE plus jitter billed as TS; `q` set larger than the posterior can actually support; comparing TS's regret-along-the-way to EI's final best as if the two numbers measure the same thing.
