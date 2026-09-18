# Thompson Sampling

Thompson Sampling plays an action with probability equal to the posterior probability that the action is optimal. Mechanically: draw one world from the posterior, act optimally in that world. It's a policy. It's only as honest as the posterior behind it.

## Finite arms

Arms `a = 1, ..., K`, posterior `πn` on the means (or on a parameter that maps to means).

Each round: draw `μ̃ ~ πn`, play `argmax_a μ̃a`, update.

That's **probability matching**. Exploration here isn't an `ε` or a `κ` schedule — it's leftover posterior mass that still lets a laggard win a draw.

Conjugate cases are the clean ones: Beta-Bernoulli, Normal-Normal, Normal-Inverse-Gamma, Gamma-Poisson. No conjugate form means sampling `θ` some other way (MCMC, Laplace, variational). **A point MLE plus jitter is not Thompson Sampling.**

If the prior can't imagine a new arm as best, TS will never play it. Check that prior predictive before round one, not after several rounds of one arm never firing.

## Continuous `x`: GP-TS

In Bayesian optimization (`references/bayesian-optimization.md`) the arm is a continuous `x` and the posterior is a GP on `f`. One round: draw a function from `p(f | data)`, minimize that function, evaluate the real `f` there, update the GP.

There's no EI formula here — **the acquisition is the random path itself.**

### The posterior being sampled

Prior `f ~ GP(m, k)`. After `y = f(X) + ε`, `ε ~ N(0, σ²I)`:

```
μn(x)  = m(x) + k(x,X) (K_X + σ²I)⁻¹ (y - m(X))
kn(x,x') = k(x,x') - k(x,X) (K_X + σ²I)⁻¹ k(X,x')
```

GP-TS needs a draw from the full `GP(μn, kn)` — the whole correlated function, not its marginals. Independent draws `f̃(x) ~ N(μn(x), σn²(x))` at each `x` separately are **not** that: they throw away the covariance between points, invent jagged phantoms, and explore the wrong holes in the space entirely.

### How to actually draw a path

- **Small grid (`d = 1, 2`).** Stack `μn` on `M` locations, factor the `M×M` posterior covariance, multiply by a standard Normal vector. Exact, and `O(M³)` per draw — fine at this scale, nowhere else.
- **Higher `d`, pathwise (Matheron) update.** Draw a prior path `f̃0 ~ GP(m, k)` from features or a spectral approximation, then correct it with the data:
  ```
  f̃(x) = f̃0(x) + k(x,X) (K_X + σ²I)⁻¹ (y - f̃0(X) - ε̃)
  ```
  This gives an explicit function that can be handed to L-BFGS. This is the usual scalable GP-TS approach.
- **Random Fourier features.** Approximate the prior kernel as `φ(x)ᵀφ(x')`, draw the feature weights from the prior, then condition those weights on `y`. Again produces an explicit `f̃(x)`.
- **Discrete candidate set.** Evaluate the joint posterior on a finite set and run ordinary finite-arm TS there. Cheaper — but say plainly that it's not a full function sample, since it isn't.

Minimize `f̃` with a multi-start search in a unit box. One start at last week's incumbent is how GP-TS stalls, exactly the way one local max of EI stalls in plain Bayesian optimization.

### One algorithm step

1. Fit / update the GP (kernel, noise, lengthscales).
2. Draw `f̃` with a method that respects `kn` — not independent marginals.
3. `x(n+1) = argmin_x f̃(x)` (subject to constraints, if those were drawn too).
4. Run the expensive `f`.
5. Append `(x(n+1), y(n+1))` and repeat.

Exploration here is not a `κ` schedule. Early on, posterior paths still disagree about where the floor is, so minimizers scatter widely. Later, the paths agree and TS sits near the incumbent on its own. If lengthscales collapse or the noise nugget eats the signal, those paths are not worlds worth trusting.

## Batches

Need `q` points this week: draw `q` independent posterior paths, take each one's minimizer, reject or jitter duplicates. Diversity comes from different sampled worlds, not from a joint qEI surface. See `references/qts.md` for the full repair-strategy detail (drop-duplicate vs. nudge vs. repulsive TS vs. capping `q`) and the collapse index worth logging every batch.

If `q` is larger than the number of genuinely distinct stories the posterior still entertains, clones show up — that's a diagnostic that the posterior has narrowed that much, not a rounding error to patch around.

## Constraints and mixed spaces

Draw `(f̃, c̃)` from the objective GP and the constraint GP together; minimize `f̃` subject to `c̃(x) ≤ 0`. If that particular sampled world has no feasible point, take the least-violating point or redraw.

Discrete or mixed `x`: treat it as a bandit on the finite set, or use a kernel that actually respects the type. Gradient-walking a one-hot encoding is not GP-TS.

## What not to confuse GP-TS with

| Method | Next `x` comes from |
|---|---|
| GP-TS | Minimizer of one posterior path |
| EI / LCB | A closed-form functional of `μn, σn` (`references/bayesian-optimization.md`) |
| Parametric sequential Bayes | Expected utility of `π(θ\|y)` for a named mean (`references/sequential-bayesian-design.md`) |
| Independent-marginal "TS" | Fake paths — not GP-TS at all |

GP-TS wants a good `x*` for a black-box `f`. It does not estimate a mechanistic `θ`, and it does not hand back an interpretable quadratic. Kernel and scaling *are* the prior here: Matérn 5/2 in a unit box with a real nugget is the boring, correct starting point. EI computed on raw engineering units and independent-marginal draws are the two standard ways people fake this algorithm.

## What the theory is buying

Finite-arm conjugate TS has Bayesian and frequentist regret on the order of `√(KT log T)` (up to the usual logs and constants). GP-TS regret tracks the same information-gain terms as GP-UCB, and therefore the kernel. This says TS is not reckless — it does not say TS picks your kernel, your prior, or your `q` for you.

## Details that change the next point

- **Incumbent definition** — best noisy observation versus best posterior mean. TS minimizing `f̃` cares about the latter; noiseless EI on the former does not (same trap noted in `references/bayesian-optimization.md`).
- Misspecified likelihood or a too-tight prior → premature exploitation.
- An arm never played after many rounds → a prior-mass problem, not bad luck.
- Lengthscales pinned at their bounds → the GP is not a world worth sampling from yet.

**Usual fakes:** independent per-point Normals billed as GP-TS; an MLE plus jitter billed as TS; `q` set larger than the posterior can actually support; comparing TS's regret-along-the-way to EI's final best as if the two numbers measure the same thing.
