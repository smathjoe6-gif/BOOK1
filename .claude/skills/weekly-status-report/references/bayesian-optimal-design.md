# Bayesian Optimal Design

A locally D-optimal design (`references/d-optimal.md`) pretends the model is known and, if the model is nonlinear, that the parameters are known too. Bayesian optimal design puts a prior on what isn't actually known — the parameters, the terms, or both — and chooses runs that are good *on average* under that prior.

**If nobody can write `π(θ)` down, this isn't a Bayesian design — it's local D-optimality with extra vocabulary.**

## Why a prior appears at all

For a linear model, `X'X` doesn't depend on `β`. Ordinary D/I-optimal plans (`references/d-optimal.md`) already don't need a prior on coefficients. Bayes still earns its keep when it's unclear which terms belong, when analysis will use a prior and the design should match it, or when some coefficients are already well known and shouldn't eat the run budget.

For a nonlinear model — Arrhenius, Michaelis–Menten, four-parameter logistic, PK/PD — the Fisher information `I(x,θ)` depends on `θ` itself. A plan that's D-optimal at a guessed `θ0` can be weak at the true `θ`. That's the **local-optimality trap**.

## Three levels of "Bayesian"

- **Local** — maximize `det I(ξ,θ0)` at one guess. Cheap. Fragile.
- **Pseudo-Bayesian (average optimal)** — one batch, no mid-course posterior. Maximize
  ```
  U(ξ) = ∫ log det I(ξ,θ) π(θ) dθ
  ```
  or a maximin efficiency over a set `Θ`. Right when there's one shot and a credible region for `θ`.
- **Fully sequential** — after each run or small block, form `π(θ|y)`, then pick the next `x` to maximize expected utility of the posterior (usually expected gain in `log det` information, or expected drop in posterior variance of a prediction). This is the only version that actually uses Bayes as a learning loop — see `references/sequential-bayesian-design.md` for the mechanics.

A coordinate-exchange on a fixed grid that never updates `π` is not sequential Bayesian design, whatever the deck calls it.

## Pick the utility for the decision

| Utility | What it buys |
|---|---|
| Bayes D | Precision of `θ` as a set |
| Bayes A | Average posterior variance of the components |
| Prediction / I | How well `ŷ(x)` is known across the region |
| Discrimination | Separating rival mean functions (KL / posterior model odds) |
| A functional | Variance of one number that matters — an ED50, a half-life, a go/no-go index |

If the actual decision rides on a dose or a setpoint, design for that number specifically. Generic D-optimality across every nuisance parameter spends runs on things nobody will use.

## Priors that don't wreck the plan

The support of `π` has to live in values the process can actually produce — mass on impossible rate constants parks points at unusable `x`. Weakly informative beats a spike at last year's `θ̂`, and beats a "flat" prior on a scale where flat isn't invariant. For kinetics, put the prior on log-rates.

If two models are still in play, put a prior on the models too — the design will split points between estimation and discrimination.

Rebuild the design with a tighter and a wider `π`. If the support points jump, the prior is doing the work, and that belongs in the report.

## What the computer is doing

Draw `θ(s) ~ π`, average `log det I(ξ,θ(s))`, exchange points (same exchange-algorithm mechanics as `references/d-optimal.md`, just averaged over draws instead of evaluated at one point). Approximate designs put weight on a few support `x` values; rounding those weights onto a fixed-run calendar costs efficiency — check the efficiency loss after rounding, don't just accept the rounded plan. Sequential work needs a posterior inner loop (often MCMC) before the next `x` is chosen.

## Where this shows up in practice

- **Dose-response.** Local D at a guessed ED50 sits on two extremes and two flanks. A wide prior on ED50 spreads the flanks. Sequential Bayes moves the next dose once the posterior shrinks.
- **Arrhenius.** Local D loves brutal temperatures. A prior admitting a narrower activation energy pulls points inward so the sample actually survives running them.

Plant-floor Lean Six Sigma factorials (`references/lean-six-sigma-dmaic.md`) usually don't need any of this. Reach for Bayesian optimal design when Improve is mechanistic and nonlinear, when rival models must be told apart with few runs, or when augmenting a messy existing set and there's already a real belief about which terms are live. Otherwise a declared linear D/I plan or a CCD (`references/rsm.md`) is easier to defend at the gate.

## Weekly strip

Local vs. pseudo-Bayes vs. sequential; utility used; the prior (what, its support, its source); model(s) in play; the next block of `x`; whether support points are sensitive to `π`.

**Usual fakes:** software labeled "Bayesian D" that actually maximized `det(X'X)` with no prior at all; a spike prior at `θ0` (that's local optimality wearing a Bayesian label); prior mass sitting outside operable `x`; designing for all of `θ` when the real decision rides on one functional; skipping the efficiency check after rounding continuous weights onto discrete runs; updating `π` from the same runs later treated as a brand-new optimal batch without saying so out loud.
