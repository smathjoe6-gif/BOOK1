# Sequential Bayesian Design

Sequential Bayesian design is a loop, not a one-shot D-criterion. After the data in hand, update `π(θ|y)`, then pick the next `x` by expected utility under that posterior. Recomputing local D (`references/d-optimal.md`) at the latest MLE is **sequential local design**, not this — the two get confused constantly.

See `references/bayesian-optimal-design.md` for the pseudo-Bayesian (one-shot, average-optimal) version this generalizes, and `references/nested-monte-carlo-utility.md` for how the expected-utility number below actually gets computed.

## The loop

After `n` runs:

1. Form `πn(θ) = π(θ | dn)`
2. For each candidate `x`, estimate `Un(x)` — expected utility of the next posterior
3. Take `x(n+1) = argmax Un(x)` (or a batch)
4. Observe `y(n+1)`
5. Stop on a predeclared rule

Step 2 is the whole subject. Everything else is bookkeeping.

## Myopic, look-ahead, batch

- **Myopic** — value `x` by the expected utility after one more observation. This is what almost everyone ships.
- **`L`-step look-ahead** — value `x` by what can be done with `L` future optimized runs after it. Closer to the real decision problem. Cost explodes unless `L=2` and the candidate set is tiny.
- **Batch-sequential** — choose `b>1` points under `πn` because the reactor, plate, or clinic won't wait between single runs. Weaker than one-at-a-time for the same total `n`; stronger than a single shot.

If the code is myopic, don't call it dynamic programming.

## What `Un(x)` is

Common utilities: expected gain in `log det` of posterior precision (Bayes D); drop in `tr(V)`; drop in integrated prediction variance; expected error of a functional `g(θ)` such as an ED50; expected KL / entropy drop when rival models are still alive.

The expectation is over `πn` *and* the next `y`. A plug-in `I(x, θ̂n)` skips the second layer entirely — that's the MLE shortcut, not a Bayesian utility.

## Posterior engines

The next `x` is only as good as `πn`.

- **Laplace around the posterior mode** — workhorse for smooth nonlinear models, moderate `p`. Dies on multimodal or boundary posteriors.
- **MCMC** — flexible. Unusable if NUTS is cold-started for every candidate and every fantasy `y`. Warm-start, reuse `θ(s) ~ πn` across candidates, and save full MCMC for the posterior that actually gets published.
- **SMC** — particles update with each `y`. A natural fit here. Watch for particle collapse; rejuvenate when it happens.
- **Variational** — fast, often overconfident. Acceptable for picking `x`; check the final reported posterior with MCMC before publishing it.

If `p` is large and `n` is small, shrink the model or design only for `g(θ)` instead of all of `θ`.

## Estimating expected utility

For each candidate `x`: draw `θ(s) ~ πn`; either draw a fantasy `y(s)` and do a cheap update (Laplace or importance weights), or skip the inner-`y` loop and average information `I(x,θ)` under `πn`. The second is the usual engineering compromise; the full nested version (draw fantasy `y`, form the actual updated posterior, evaluate `u` on it) is correct and brutal — see `references/nested-monte-carlo-utility.md` for that cost and how to control it.

Use the same `θ(s)` draws across every candidate `x` (a control variate). If the top two `Un` values sit inside Monte Carlo error, the loop is optimizing noise, not signal — raise `S` before trusting the ranking.

## Exploration then exploitation

A wide `πn` makes an information utility explore, because that's where learning is genuinely large. As the posterior tightens, new points collapse onto the locally optimal flanks — the loop naturally shifts from exploring to exploiting without anyone declaring the switch.

If the prior starts as a spike, the loop exploits on day one in the wrong place. If the utility is only a point prediction, the design may never visit the `x` a rival model actually cares about — pull in a discrimination term (see the utility table in `references/bayesian-optimal-design.md`) if model discrimination still matters.

Practical split: block 1 runs pseudo-Bayesian under the prior; later blocks run sequential under the posterior. Or keep a small discrimination term alive until one model clearly dominates.

## When to stop

Predeclare it: run budget; posterior sd of `g(θ)` under a threshold; expected gain of the best unused `x` below a floor; posterior model probability above a line. Stopping because `θ̂` "looked stable" is peeking, not a stopping rule.

## Hygiene that keeps the loop honest

Code `x` into a compact box. Reparameterize `θ` (log-rates, for kinetics) so Laplace/HMC see something close to Gaussian. Track the effective sample size of the particle or importance set. If the winning `x` turns out to be inoperable, delete it and take the next-best candidate rather than forcing it. Log `πn` summaries each round so next week's report can replay *why* `x(n+1)` beat the runner-up — a sequential design with no logged rationale is unauditable by week 4.

## Weekly strip

Myopic vs. look-ahead vs. batch; the utility in use; posterior engine and its health (ESS, mixing); current `πn` summary; the next chosen `x` and why it beat the runner-up; distance to the predeclared stopping rule.
