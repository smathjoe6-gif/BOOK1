# Sequential Design — the family map

Sequential design means later runs are a function of earlier data. That's a **family of strategies, not one algorithm** — they disagree about what's actually allowed to move: the region, the model, the criterion, or the posterior.

A string of OFAT tweaks is not sequential design. Peeking at Y and deleting ugly cells from a fixed factorial is not one either.

## What the rule is allowed to update

| Strategy | Moves | Holds still |
|---|---|---|
| Blocked classical DOE | Which block runs next | Model, region, factor list |
| Steepest ascent | Center of the next box | Usually a 2-level plane |
| Sequential RSM | Region; add axials when centers curve | Live Xs after screening |
| D/I augment | New rows of `X` | Declared model (unless terms are dropped on purpose) |
| Sequential local | Next `x` via `θ̂n` | Model form |
| Pseudo-Bayesian batch | Nothing mid-batch | Prior and model |
| Sequential Bayesian | `πn`, then `x` | Utility and prior family |
| Bandit / Thompson | Allocation probabilities | Arm set — see `references/thompson-sampling.md` |
| Group-sequential trial | Stop / continue / drop arm | Hypothesis and error spend |

If a report says "sequential Bayesian steepest-ascent D-optimal," it has mixed rows from this table into one claim. That sequence cannot be audited — pick the row it actually is.

## Classical path (still the plant default)

Screen → factorial + centers → walk or stop → quadratic. See `references/doe.md` and `references/rsm.md` for the full mechanics behind each step.

- **Centers quiet and the goal is higher Y** → steepest ascent along `∇ŷ` in coded units, step limited by operability, stop when Y turns over or a wall is hit, then run a new factorial there. Do not keep walking after the centers have already said the plane is a lie.
- **Centers curved, two to four continuous Xs** → add axials or run Box-Behnken / I-optimal quadratic (`references/rsm.md`).
- **Centers forgotten, or aliases are hurting** → augment: centers, a fold-over, or promote to a full CCD. That's sequential construction, not a redo.

**Optimal augment** (`references/d-optimal.md`): old rows stay exactly where they are; new rows maximize D or I for the model now believed. Legal for leftover budget and for illegal corners the original design couldn't reach. Re-optimizing the *history* after peeking at results is a different, worse study — not augmentation.

## When `θ` sits inside the information matrix

Nonlinear mean function → `I(x,θ)` depends on `θ` itself (see `references/bayesian-optimal-design.md`).

- **Local sequential** — next `x` maximizes `det I(x, θ̂n)`. Cheap. Can lock onto a bad early MLE and never recover.
- **Pseudo-Bayesian batch** — average the criterion over a prior, then run one block.
- **Fully sequential Bayes** — update `πn`, maximize expected utility, nested Monte Carlo if `u` is a posterior functional (`references/sequential-bayesian-design.md`, `references/nested-monte-carlo-utility.md`).

Block 1 shouldn't be a single extreme the prior barely supports — use a small prior-average or space-filling block instead, so an actual posterior exists to update from block 2 onward.

## When the decision isn't a surface

- **Group-sequential trials** spend Type I error across looks. That's a stop/continue design — D-efficiency doesn't apply to the interim p-value.
- **Bandits** change how often discrete arms get played (cumulative reward, treat-as-you-go) — `references/thompson-sampling.md` covers the probability-matching mechanics (finite arms and the continuous GP-TS extension). They're a poor map of a continuous response surface — don't borrow bandit logic for an RSM problem.
- **Model-discrimination sequential** picks `x` to drive posterior model odds or expected KL divergence. Combine with estimation only through an explicit hybrid utility, never silently.

## Rules that keep a sequence honest

Write the adaptation rule *before* Y arrives: what may change, when, who signs off. Log after every block what was known at the time and which rule fired. Don't change the factor list, the region, and the model all in the same block without calling the result a new study. A stop rule that used the data still wants confirmation runs before it's trusted. MSA (`references/msa.md`) and real operability bound every family in this table — no algorithm can learn an X that can't actually be set.

## A short chooser

- Unknown live factors in a box → screen, then factorial + centers.
- Plane fits, want more Y → ascent, new box.
- Curved, few continuous Xs → quadratic design.
- Illegal corners or leftover `n` → D/I augment.
- Expensive runs, mechanistic `θ` → myopic sequential Bayes.
- Rival mechanisms → hybrid discrimination.
- Discrete arms, treat-as-you-go → bandit.
- Expensive black-box, no mean function anyone will write down → Bayesian optimization (`references/bayesian-optimization.md`).

**Usual fakes:** OFAT billed as steepest ascent with no plane actually fitted; an MLE plug-in billed as Bayesian; dropping terms mid-CCD while still quoting the old design's efficiency; changing the utility function mid-stream because the current one is losing; stopping on a posterior that finally looks pretty and skipping confirmation runs.
