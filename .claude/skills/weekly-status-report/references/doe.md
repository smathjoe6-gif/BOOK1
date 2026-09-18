# Design of Experiments (DOE)

DOE is a planned way to move several Xs at once so it's possible to see which ones actually change Y — including their interactions. One-factor-at-a-time experimentation will systematically miss those interactions, no matter how carefully each factor is tested individually.

It belongs in DMAIC's Analyze (which Xs actually matter — `references/dmaic.md`) and Improve (what setting to actually pilot). It does not belong before MSA (`references/msa.md`), before Y has been locked down, or on a knob that can't actually be set in practice.

## What you are building

- **Factors** — the Xs that will actually be set.
- **Levels** — the values each factor takes (2 for screening; 3 or more when curvature needs to be captured).
- **Response** — the CTQ that's already known how to measure (which means MSA already happened on it).
- **Run** — one specific combination of factor levels, executed in randomized order.
- **Replicate** — genuine repeats that produce a pure-error estimate.
- **Block** — a nuisance variable that can't actually be held constant (a shift change, a material lot) — blocked so it doesn't steal credit under a real factor's name.
- **Center points** — mid-level runs added to a 2-level design specifically to check whether the response surface is curved.

Convenient run order (running all of level A, then all of level B) is usually a time trend wearing factor labels — randomize the actual run order, or the experiment will confuse "time passed" with "the factor changed." If a factor is genuinely hard to change between runs, that's a split-plot design — say so explicitly rather than pretending every run was independent when it wasn't.

## The design ladder

| Need | Design |
|---|---|
| Many Xs, which few matter? | Screening: fractional factorial, Plackett-Burman |
| Main effects + two-factor interactions | Full `2^k`, or a high-resolution fraction |
| A local optimum / curvature | Response surface (CCD, Box-Behnken) — see `references/rsm.md` |
| Components that must sum to 1 | Mixture design |
| Illegal region, mixed factor types, an awkward fixed run count, or augmenting existing data | Computer-generated optimal design — see `references/d-optimal.md` |
| Prove the claimed setting actually works | Fresh confirmation runs |

**Resolution is the price paid for running a fraction instead of the full design:**

- **Resolution III** — main effects are aliased with two-factor interactions. Screening only; don't trust it for anything beyond "which factors deserve a closer look."
- **Resolution IV** — main effects come out clear; two-factor interactions are aliased with each other.
- **Resolution V** — two-factor interactions are clear enough to actually interpret individually.

Do not pick an "optimum" setting straight out of a Resolution III design. Fold it into a higher-resolution design, or run the missing piece separately, first. A significant contrast on a Res III design proves *the contrast* moved Y — not that the specific factor being credited is the one that actually did it, since it's aliased with others.

## Why OFAT lies

Move X1 while X2 happens to be sitting at whatever value hides their interaction, and the "best" X1 found is only best *at that particular, unexamined value of X2*. Factorial designs exist precisely so the average effect of X1 gets measured across the actual range of the other factors, not at one accidental, unstated setting of them.

## Noise and the gage

The smallest effect that would actually be a shame to miss has to be bigger than measurement-plus-short-term noise combined — otherwise the experiment can't see it no matter how the design is built. More replicates often beat a fancier, more elaborate fraction for this reason. If MSA already flagged the gage as marginal (`references/msa.md`), running DOE anyway will just baptize gage chatter as if it were a real factor effect.

## How to read the experiment

1. Residuals versus run order — is there a hidden time drift the randomization didn't fully wash out?
2. Effect Pareto — which effects are actually large relative to the noise.
3. Drop inert factors, but respect the alias chains (see resolution, above) when deciding what a "significant" effect actually proves.
4. Residual plots — the usual regression diagnostics still apply here.
5. Curved center points mean the work isn't finished — a linear model was fit to a surface that isn't linear.
6. **Confirm on new runs**, never on the same data points that built the model in the first place — a model always fits its own training data better than it will fit reality.

The resulting model is a hypothesis, not a finished process. Control is still a real standard plus a real chart (`references/spc.md`) — freezing fourteen setpoints straight out of a screening design and calling that Control skips the actual Control phase entirely.

## On a weekly page

Purpose (screen / find interactions / optimize / confirm), the design and its resolution, factors and levels, the Y being optimized, runs completed versus planned, and anything that genuinely can't be set in this experiment.
