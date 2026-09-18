---
name: weekly-status-report
description: Generate weekly project status reports with structured sections, RAG status, risks, and action items. Use when the user asks for a weekly status, WSR, project update, standup summary, status deck section, or action-item list for a project week.
metadata:
  type: workflow
  version: "1.0"
  output: docx-or-markdown
---

# Weekly Status Report

## When to apply

Use this skill whenever the user wants a weekly project status report (WSR), status email, stakeholder update, or action-item register for a defined reporting week. Prefer a Word document when they want something sendable; use Markdown when they only want a draft in chat.

## Required inputs

Collect before drafting. Ask only for what is missing.

- Project name and reporting week (dates, not just week number)
- Audience (team, manager, exec, client)
- Accomplishments this week
- Work in progress / carry-over
- Planned next week
- Blockers, risks, decisions needed
- Metrics or milestones if they exist
- Owners for action items

If the user gives raw notes, bullets, meeting dumps, or tickets, normalize them into the sections below. Do not invent metrics, dates, owners, or completed work.

## Output formats

1. Default sendable artifact — Word `.docx` via the `docx` skill. Professional, single-column, print-ready.
2. Chat draft — Markdown using the section order in `references/section-spec.md`.
3. Optional one-page exec variant — same sections, tighter bullets, no process noise.

Copy structure from `assets/wsr-template.md`. Do not skip required sections; write "None" or "No change" rather than omitting them.

## Section order (required)

1. Header — project, week range, author/role, date issued, overall RAG
2. Executive snapshot — 3–5 sentences max
3. Highlights / accomplishments
4. Progress vs plan
5. Work in progress
6. Next week plan
7. Risks and issues
8. Decisions needed
9. Metrics and milestones
10. Action items — table with owner, due date, status
11. Appendix (optional)

## Writing rules

- Lead with outcomes, not activity.
- One idea per bullet. Past tense for done work, present for WIP, future for next week.
- Name owners. Unowned items are incomplete.
- Date everything that can slip.
- Separate risks, issues, and blockers.
- Keep the exec snapshot consistent with the body.
- Flag slip explicitly.
- No filler.
- Match the user's language for the report body.

## RAG status

- Green — on plan; risks contained; no unresolved blocker
- Amber — slip risk or constrained path; mitigation exists
- Red — missed date, open blocker, or unmitigated high-impact risk

State the reason next to the color in one clause.

### Roll-up (this is where most reports lie)

Color the streams and baselined milestones first, then roll up.

- Overall = the worst color on the critical path, not an average across streams. Averaging is how a report ends up calling a project "mostly green" while the one thing the deadline depends on is on fire.
- A Red side-quest does not force overall Red unless it hits the actual commitment — a failing stream that isn't on the critical path is a Red *stream*, not a Red *project*.
- Several Ambers sharing one root cause on the critical path → consider rolling the overall up to Red. Three independent-looking Ambers that all trace back to the same vendor delay are one real problem wearing three colors.

Write the overall line as **Color (trend) — driver**, one clause naming the actual cause, not a restatement of the color:

> Amber (worsening) — vendor API freeze consumes remaining slack to 25 Sep checkout.

### Multi-axis view

When the data exists, score these axes separately before rolling up to whatever the audience is actually buying (usually Schedule + contractual Scope) — a single blended color hides which axis is actually the problem.

| Axis | Green | Amber | Red |
|---|---|---|---|
| Schedule | Forecast ≤ baseline | Inside last slack | Beyond baseline or missed |
| Scope | Stable or approved CR | Pressure, not baselined | Silent cut or gold-plate |
| Cost | Inside plan + contingency | Over, still recoverable | Contingency gone |
| Risk | Residual inside appetite | Mitigation active | High impact, no funded path |
| Quality | Exit criteria intact | Defect/test debt rising | Criteria waived to hold date |
| Dependencies | Confirmed | Soft or one late feeder | Broken feeder on critical path |
| Capacity | Named owners, load fits | Key-person / overtime | No owner or sustained overload |

### Trend and decision latency

- Pair every color with improving / stable / worsening whenever a prior week's report exists — a bare color with no trend tells the reader nothing about direction.
- Do not jump Red → Green in one week. The path is Red → Amber → Green, and only after a closed action *and* a new forecast confirm it — a status color is a claim about the forecast, not a reward for effort.
- A decision that's still being framed, due in more than 2 weeks: no color yet.
- Due this week or next: Amber on that stream.
- Past its needed-by date and work is waiting on it: Red.

### Evidence and anti-patterns

Color from forecast vs. baseline, slack days, blocker age, decision age, and real spend or defect trend — not from how the week felt. Adjectives ("challenging," "productive") are not evidence. If the forecast itself is missing, that's Amber or Grey, never Green by default.

Avoid:
- Rainbow dashboards (every stream a different color for its own sake, signal drowned in noise)
- Hope-Green (Green because it's supposed to turn out fine, not because the forecast says so)
- Permanent Amber with the same sentence week after week (a stream that never resolves either way is being managed by the color, not the plan)
- Red with no ask (a Red status that doesn't come with a specific decision or help requested is just an alarm nobody can act on)
- Green overall sitting over a Red critical milestone (the roll-up rule above exists specifically to prevent this)
- Coloring people instead of the plan (the status describes the work's trajectory, never a judgment on who's behind)

### Earned value (PV / EV / AC)

If the project tracks PV/EV/AC (or the user gives you a week's numbers), read `references/evm.md` before writing the RAG line — it covers variances (SV/CV), indices (SPI/CPI) with weekly bands, the EAC/ETC/VAC forecasts (and which one to default to), the TCPI honesty check, Earned Schedule for late-stage projects, and exactly how each of those should move the RAG color. Healthy cost performance never overrides a missed critical date — check that file rather than eyeballing an index. If PV/EV/AC don't exist for this project, skip it; don't invent an earning rule to force the math.

### Critical path (CPM)

If the project has a real logic-linked schedule network, read `references/cpm.md` too — it covers total/free float, the ordered critical and near-critical ID paths, how weekly progress updates should actually work (and the fake-update patterns to catch), and how to color schedule from the driving path's float rather than a blended SPI. It also explains how CPM, Earned Schedule, and classic SPI/CPI answer three different questions and should never be averaged together when they disagree.

### Critical chain (CCPM)

If the project runs on a resource-leveled Critical Chain plan (buffers, not just float), read `references/critical-chain.md` instead of treating it as CPM with different labels — it covers how the chain is built (resource leveling, stripped durations, project/feeding/resource buffers), how work should actually run week to week (relay-race starts, why "waiting on a busy resource" counts as delay), and the buffer-burn-vs-progress fever chart that drives schedule RAG here instead of task float. Only use this file's vocabulary (chain, buffer, fever chart) when there's an actual leveled chain and real buffers behind it.

### Theory of Constraints (the rule underneath Critical Chain)

Read `references/theory-of-constraints.md` when the conversation is about *why* something is the bottleneck, not just what its float or buffer number is — it covers Goldratt's five focusing steps (identify, exploit, subordinate, elevate, repeat), where a constraint typically lives (resource, policy, market, chain, portfolio), and Drum-Buffer-Rope. Use it to frame action items around exploiting/subordinating the real constraint before jumping to "hire more people" or "add a tool," which are elevation moves and need an explicit decision, not a default reach.

### TOC Thinking Processes (when the constraint is a policy)

When the constraint turns out to be a policy or a standing conflict rather than a scarce resource, read `references/toc-thinking-processes.md` — it covers the full Goldratt logic kit (Current Reality Tree, Evaporating Cloud, Future Reality Tree, Negative Branch Reservation, Prerequisite and Transition Trees) and, critically, what to compress out of all that for the report itself: only the injection, its owner, and one predicted effect checkable by next Friday. Never paste a full tree into the WSR, and never color a policy constraint Green just because tasks moved — it stays Amber until the predicted effect actually shows up.

### TOC applied to supply chain (worked pattern)

If the status touches a multi-echelon supply chain (plant → central warehouse → DCs → customer), read `references/toc-supply-chain.md` — it's a fully worked application of the thinking-process trees to the classic pattern of simultaneous stockouts and excess inventory. Recognize it fast: if a report shows A-items stockout *and* a full warehouse *and* a plant that reschedules daily, this is almost certainly the right lens. It gives the specific CRT spine, the cloud and injection for that pattern, the negative branches to trim, and what to color a weekly report on (buffer trajectory and policy violations — never warehouse utilization).

### Drum-Buffer-Rope (the daily mechanism)

Read `references/dbr.md` for the actual day-to-day release mechanism behind any of the buffer-based lenses above — the drum (constraint pace), the buffer (time, not a pile of stock), and the rope (the release rule that stops WIP from flooding the floor ahead of the constraint). Covers Traditional DBR vs. S-DBR, the Green/Amber/Red buffer-zone steering rules, and the same drum/buffer/rope pattern worked across plant, distribution, and project (Critical Chain) networks side by side. Color from buffer trajectory and rope integrity — never department busy-ness or local utilization.

### Lean manufacturing (when it's a factory floor, not a project)

Read `references/lean-manufacturing.md` for the five Lean principles (value, value stream, flow, pull, perfection), the JIT/Jidoka mechanisms (takt, kanban, heijunka, andon, SMED), and the muda/mura/muri waste framing. It also covers exactly where Lean and TOC rhyme (pull ≈ rope, takt ≈ drum, supermarket ≈ buffer) and where they actively fight (a WIP cap sized wrong can starve the real constraint; OEE pushed on a non-bottleneck is anti-Lean and anti-TOC at once) — report the two as separate modes on a weekly page, never averaged into one color.

### Six Sigma (when the enemy is variation against a spec)

Read `references/six-sigma.md` for DMAIC vs. DFSS/DMADV (improving an existing process versus designing capability before volume), the statistical spine (MSA before Analyze, stability before capability, named tests for before/after claims), and belts as org design rather than a badge — the status line is phase and next gate, never belt color. It also covers how Six Sigma stacks with Lean and TOC (Lean shows the stream, TOC names the drum, Six Sigma attacks the high-variation step that's actually stealing drum time) and how they rot together (a belt project per department for the appearance of activity; a perfect DMAIC on a step nowhere near the constraint). Never color the enterprise Green because a belt project moved while the drum is Red or the rope is cut.

### Statistical Process Control (before quoting any capability number)

Read `references/spc.md` before writing anything cited as "quality" data — it covers common vs. special cause (and why treating common cause as special is tampering, per Deming), what a control chart actually is (limits from the process's own behavior, not the spec), which chart fits which situation, a sane default signal-rule set, and the two capability formulas with the ordering rule that matters most: never compute `Cp`/`Cpk` before the chart is demonstrated stable. Also covers the two bad stories that look like good news — "in control but incapable" (stable junk) and "in spec this week but out of control" (a lucky streak, not a Green).

### DMAIC in detail (gates and their counterfeits)

Read `references/dmaic.md` for the full detail behind the DMAIC table above — each phase's gate criterion (a specific, checkable bar, not a vibe) and, just as important, the named counterfeit version of that phase to watch for (a charter that's really "improve satisfaction," an Analyze that's a voted fishbone, a pilot skipped straight to a site-wide rollout, a Control-phase binder nobody opens). Color the DMAIC *project*, never the company, from whether a gate was actually earned or just calendared past.

### Measurement Systems Analysis (before trusting any of the above)

Read `references/msa.md` before Analyze, before SPC, and before quoting any capability number — it answers one question: is a given number mostly the process, or mostly the gage? Covers the full set of failure modes Gage R&R alone doesn't catch (bias, linearity, stability, discrimination), the correct study order (resolution → stability → bias/linearity → Gage R&R), the two GR&R denominators (versus process vs. versus tolerance — never mixed), `ndc`, attribute-agreement studies with kappa, and Type I/II error framing. A "stop" verdict here means DMAIC stays in Measure — Analyze on that Y is fiction.

### Lean Six Sigma (when Lean and DMAIC run as one path, not two offices)

Read `references/lean-six-sigma-dmaic.md` when a project genuinely needs both — a measurable defect or delay sitting on a visible stream, where it isn't yet clear whether the lever is variation, waste, or both. It maps exactly which questions Lean answers and which DMAIC answers at each of the five gates (Lean proposes candidate Xs from the value stream; Six Sigma decides with evidence which ones actually move Y), and names how the hybrid decays in practice (belt count as the KPI, a VSM drawn once and never measured again, "Improve" quietly meaning tidy the area). Never average a Lean "flow Green" with a Six Sigma "p-value Green" into one blended color.

### Design of Experiments (moving several Xs at once)

Read `references/doe.md` when Analyze or Improve needs to test several plausible Xs together rather than one at a time — one-factor-at-a-time experimentation systematically misses interactions between factors. Covers the design ladder (screening → factorial → response surface → mixture → confirmation), what resolution actually costs (never treat a Resolution III "optimum" as trustworthy), why noise and a marginal gage can baptize chatter as a real effect, and reading the result (residuals, effect Pareto, curved center points, and confirming on fresh runs — never on the data that built the model).

### Response Surface Methodology (mapping curvature, once it's found)

Read `references/rsm.md` once a factorial's center points show real curvature and the goal shifts from "which Xs matter" to mapping a local peak, floor, or ridge — it covers the CCD and Box-Behnken designs, the quadratic model and what each term means (slope, twist, curvature), classifying the stationary point from its eigenvalues (max / min / saddle / ridge), why lack-of-fit beats R² as the real gate, and why a stationary point outside the design's actual box is a rumor, not a result to put in an SOP.

### D-Optimal Design (illegal regions, mixed factors, awkward run counts)

Read `references/d-optimal.md` when the region is constrained, factors mix continuous with categorical, the run budget doesn't match a textbook design's size, or existing data needs augmenting rather than discarding — a computer-generated design built for the declared model, not a shrunk-down factorial. Covers the D-criterion (`det(X'X)`), the other optimality letters (A/I/G/E) and why D isn't automatically the right one for mapping a surface, how the exchange algorithm actually builds the plan, and the checklist to lock (model terms, factor ranges, constraints, `n`, D vs. I) before hitting Generate. Only reach for this over a textbook CCD/Box-Behnken when the textbook design is either illegal or the wrong size — orthogonality is usually gone once it's computer-generated, so analyze with the actual `X` run, never a borrowed `2^k` ANOVA table.

### Bayesian Optimal Design (when the model or its parameters aren't known either)

Read `references/bayesian-optimal-design.md` when a nonlinear model's Fisher information depends on parameters that aren't actually known yet (Arrhenius, dose-response, PK/PD) — a locally D-optimal plan built at a guessed `θ0` can be weak at the true `θ`. Covers the three levels (local / pseudo-Bayesian / fully sequential), picking the right utility for the actual decision (D, A, prediction, discrimination, or a single functional like an ED50), and the fakes to watch for (a spike prior relabeled "Bayesian," prior mass sitting outside operable settings). If nobody can write down `π(θ)`, this isn't a Bayesian design yet.

### Sequential Bayesian Design (the update-then-pick loop)

Read `references/sequential-bayesian-design.md` when the design genuinely runs as a loop — form the posterior, pick the next `x` by expected utility, observe, repeat — rather than a single Bayesian-flavored batch. Covers myopic vs. look-ahead vs. batch-sequential, the posterior engines that make it work (Laplace, MCMC, SMC, variational) and where each breaks, and the predeclared stopping rules that keep it from being "peeking" with better math. Recomputing local D at the latest MLE every round is sequential *local* design, not this.

### Nested Monte Carlo for Expected Utility (what's actually being computed each round)

Read `references/nested-monte-carlo-utility.md` for the mechanics behind `Un(x)` in the sequential Bayesian loop above, whenever the utility depends on the *updated* posterior (entropy drop, posterior odds, `log det` of updated precision) rather than only on `(x,θ)`. Covers the outer/inner draw structure, where bias actually lives (the inner posterior approximation), the variance-decomposition rule for deciding whether to spend more draws on `S` or on `T`, and why common random numbers across candidates are not optional. Never declare a winning `x` when the top two estimates sit inside their standard error.

### Sequential Design — the family map (don't mix rows)

Read `references/sequential-design.md` before calling anything "sequential [X]-optimal" — sequential design is a family of strategies that each hold different things fixed (region, model, criterion, or posterior), not one algorithm with adjectives stacked on it. Covers the classical path (screen → factorial + centers → ascent or quadratic), where D/I augmentation and Bayesian sequential design sit relative to it, and why group-sequential trials and bandits are different problems entirely that shouldn't borrow DOE vocabulary. Use its chooser table to name which row a given week's design actually is before writing it up.

### Bayesian Optimization (tuning an expensive black box, not fitting a believed model)

Read `references/bayesian-optimization.md` when the target is a good `x*` for an expensive black-box `f(x)` — no mean function anyone is willing to write down, so there's no `θ` and no Fisher information at all. Same loop shape as sequential Bayesian design but a different object: a surrogate (usually a GP) replaces the declared model, and an acquisition function (EI, LCB/UCB, Thompson, PES/KG) replaces expected-utility-over-θ. Covers kernel choice as the real scientific claim, batch acquisitions for plate/weekly-calendar runs, multi-objective Pareto handling, and exactly where this stops making sense — vanilla GPs rot once dimension climbs and evaluations should instead go through RSM (an interpretable surface) or parametric sequential Bayes (a precise `θ`) depending on which one the report actually needs.

### Acquisition Functions — the survey (don't erase the differences)

Read `references/acquisition-functions.md` before writing up any BO result — it maps the four families (improvement: PI/EI; bonus: LCB/UCB; sampling: Thompson; look-ahead: KG/PES/MES) against each other and against the individual reference files below. The single most important line in it: KG looks ahead at the recommendation, EI looks ahead at this sample, and calling both "one-step look-ahead" erases exactly the distinction that matters. Also states plainly that kernel misspecification (`references/gp-kernels.md`) beats acquisition choice — swapping EI for MES on a kernel with pinned lengthscales is theater.

### Thompson Sampling (probability matching, finite arms or GP-TS)

Read `references/thompson-sampling.md` for the policy underneath any "Thompson" row above — draw one world from the posterior, act optimally in that world, update. Covers the clean conjugate finite-arm cases (Beta-Bernoulli, Normal-Normal, etc.), the continuous GP-TS extension used in Bayesian optimization (drawing a whole posterior function via pathwise/Matheron updates or random Fourier features — never per-point independent Normals), batching by drawing multiple independent worlds, and the regret guarantees that say it isn't reckless without saying it picked your kernel or prior for you. A never-played arm after many rounds is a prior problem, not bad luck — check the prior predictive before round one.

### Knowledge Gradient Variants — the map (same utility, different information patterns)

Read `references/kg-variants.md` before assuming "KG" means one fixed algorithm — every variant shares the utility "expected drop in `argmin μ`" but differs in what may be measured versus recommended, discrete vs. continuous domain, noise/fidelity handling, how many `y`'s return together, and constraints or multi-objective handling. If the formula in front of you is `E[(f*-f(x))+]`, it's EI, not KG, whatever it's labeled. Use its chooser to pick the right variant instead of defaulting to whichever one shipped last time.

### Knowledge Gradient (look-ahead on the recommendation, not the sample)

Read `references/knowledge-gradient.md` when the last few runs are expensive, alternatives are discrete, or noise has already made EI-on-best-observation dishonest — KG values a measurement by how much it's expected to move `argmin μ` itself, which can land on a completely different `x` than the one just measured. Covers the discrete closed form versus the continuous fantasy-based approximation, why an inner set that forgets the current incumbent understates KG, and why it's not the weekly default on a cheap simulator where the compute cost isn't earning its keep. See `references/qkg.md` for the batch version.

### qKG (batch Knowledge Gradient)

Read `references/qkg.md` when a whole batch of `q` points returns together and the object is next week's recommendation, not just the best observed `y` in the set. Covers why the joint form (not greedy, not one-shot) is the actual definition, how greedy approximations fake the unseen fantasy outcomes (kriging believer, constant liar, fantasy average), and why honest joint Monte Carlo stops being credible much past `q=4` unless the search space is tiny. Never let an inner minimum be taken only over the proposed batch `Z` — it has to range over the whole space or it isn't computing KG at all.

### Fantasy-Average Batch Scheduling (the general greedy-batch pattern)

Read `references/fantasy-average.md` for the batch scheduler underneath most "batch KG" or "batch EI" claims — pick one point on the real posterior, pretend the GP has seen it, pick the next on that fantasy posterior, repeat. Covers the single-lie plug-ins (kriging believer, constant liar, sample liar) versus the true fantasy-average (`T` fantasies, properly averaged), what each does to the rest of the batch's exploration, and which base acquisition it pairs well with. This is not joint batch optimization and should never be reported as if it were — it never un-picks the first point once chosen.

### Kriging Believer (the industrial-default scheduler, in full)

Read `references/kriging-believer.md` for the full state/loop mechanics behind the most common batch scheduler in practice — the working-copy GP, the rank-1 update algebra that freezes the mean and deflates covariance around the fake point, and why it can only stamp "already measured" onto a neighborhood rather than ever discovering a better basin. Publish whether the fantasy noise was 0 (classic KB) or `σ²_obs` (noisy KB) — the two behave differently. Never leave the fake `(z, μ(z))` pair sitting in the real training set once the batch ships.

### Fantasy-Average Greedy KG (the KG-specific slot mechanics)

Read `references/fa-greedy-kg.md` for the full two-expectation structure behind FA-greedy-KG specifically — an outer fantasy average over the still-random prefix outcomes, and an inner real-KG computation on each fantasy GP. Covers the per-slot procedure, why the same outer fantasy draws must be reused across every candidate in a slot, the cost split between outer `T` and inner `T_in`, how it differs from both KB-greedy-KG (`T=1`, a lie instead of a real average) and joint qKG (which never freezes a prefix at all), and a full side-by-side against joint qKG showing exactly where the two methods pick different points (two live basins at small `q`, asymmetric operability costs, and error accumulation as `q` grows).

### qKG Alternatives (what's actually being given up)

Read `references/qkg-alternatives.md` when joint qKG (`references/qkg.md`) is too expensive and a substitute is needed — it maps every option (greedy/fantasy-average KG, qEI, batch MES/PES, qTS, KB+EI, local penalization, hard min-distance/DPP) against what each one keeps versus discards from the full joint object. States plainly that KB+EI is the industrial default and also the thing most often mislabeled qKG, and that giving up the joint form always costs the value of informational sites and the true batch correlation — whatever else is kept.

### qTS (batch Thompson Sampling)

Read `references/qts.md` for the Thompson-flavored batch method — draw `q` independent posterior paths, take each one's minimizer, repair collisions, evaluate. No joint surface, no fantasy `y`, so it's cheaper than qEI/qKG but answers a different question: a Monte Carlo sample of `x*`, not an expected improvement or expected drop in `min μ`. Covers the named repair strategies for when the posterior has fewer distinct stories than `q` (drop-duplicate, nudge, repulsive TS, or just capping `q`), and the collapse index (`unique(Z)/q`) worth logging every batch — a stacked batch is a real result about the posterior, not a bug to quietly patch around.

### Sparse GPs (when `n` is too large for a full GP)

Read `references/sparse-gps.md` when `n` leaves the few-hundreds and factoring `Ky` at `O(n³)` stops being affordable — an inducing system of size `m ≪ n` replaces it, and "sparse GP" is not itself a method name (write VFE, FITC, or SVGP specifically). Covers what each approximation does to the residual variance on the training data (SoR drops it, DTC zeros it only in the likelihood, FITC diagonalizes it and can miscalibrate badly, VFE penalizes it and is usually the best-calibrated regression default), where inducing locations should sit, why train and predict must use the same approximation, and the sparse-Matheron path draw qTS needs on top of it.

### Matheron's Rule (drawing a posterior GP path cheaply)

Read `references/matheron-rule.md` for the actual mechanics behind "pathwise/Matheron update," referenced everywhere GP-TS or qTS needs a posterior sample — a prior path plus a linear correction that hits the data, factored once on the training set instead of refactored on every optimizer grid move. Covers the identity itself, the noiseless-limit interpolation check, the RFF/inducing options for drawing the prior path, and the specific bug of drawing the prior path as independent marginals (which breaks the identity entirely, not just approximately). This draws `f`, never a fantasy `y` — KG/EI/FA sample observations instead, a different object.

### Random Fourier Features (sparsifying the kernel, not the data)

Read `references/rff.md` for the explicit feature map `φ(x)` that approximates a stationary kernel via Bochner's theorem — the usual way `f0` gets drawn inside a Matheron update (`references/matheron-rule.md`). Distinct from inducing-point sparsity (`references/sparse-gps.md`): RFF sparsifies the kernel operator, not the training data. Covers why the spectrum has to match the actual kernel family (SE frequencies under a Matérn claim make paths too smooth), the two different jobs RFF can do (prior path only, versus a stand-alone surrogate that behaves like SoR and gets over-confident far from data), and why frequencies must stay frozen across all `q` draws within one BO step.

### Quadrature Fourier Features (the deterministic alternative to RFF)

Read `references/qff.md` for the quadrature version of `references/rff.md` — nodes and weights from integrating the spectral measure `Λ` instead of sampling it, giving a fully deterministic `φ` for the same `ℓ, ν, S`. Covers building nodes correctly for the actual kernel family (Gauss-Hermite for SE, a Matérn-matched rule rather than borrowed Hermite nodes), why tensor-grid error falls off a cliff past the frequencies the grid was built for rather than decaying smoothly like RFF's, and why changing `ℓ` invalidates every node and requires a full rebuild, not a cache reuse.

### Quasi-Monte Carlo RFF (low-discrepancy frequencies, still Monte Carlo)

Read `references/qmc-rff.md` for the point in between `references/rff.md` and `references/qff.md` — frequencies come from a low-discrepancy sequence (Sobol' with an Owen scramble is the default) mapped through the spectral measure's inverse-cdf, not sampled i.i.d. and not a quadrature grid. Covers why the inverse-cdf choice *is* the kernel claim (Sobol' through a Gaussian inverse-cdf under a Matérn poster is the same spectrum-mixing mistake as elsewhere in this family), why QMC mainly helps local kernel accuracy rather than far lags, and why it still doesn't restore residual variance outside `span(φ)` as a stand-alone surrogate.

### Quadrature Fourier Features (the deterministic alternative to RFF)

Read `references/gp-kernels.md` before trusting any EI, LCB, or Thompson-path result — the kernel is the prior on functions, and no acquisition function can repair a wrong one. Covers what a kernel actually asserts (lengthscale, smoothness via Matérn `ν`, amplitude, stationarity), why pinned ARD lengthscales at high `D`/low `n` are usually a fitting failure rather than a real relevance finding, building structure through sums/products/additive kernels, and MAP-over-Type-II-MLE as the grown-up default when `n ≲ 30`. Never put a Euclidean RBF on one-hot categorical encodings, and never swap kernel families week to week just to chase last night's acquisition result.

## Action items

| ID | Action | Owner | Due | Status | Notes |

Status values — Not started | In progress | Blocked | Done.

- Convert vague wishes into verbs with an owner and a date.
- Missing owner/date → **TBD** and list under Decisions needed.
- Carry forward open items from a prior report.
- Close items only when the user said they are done.

## Docx layout

- Title — Weekly Status Report — {Project}
- Subtitle — Week of {start}–{end} · Issued {date} · Overall {RAG}
- Heading 1 for major sections
- Tables for action items, risks, and metrics
- 1–2 pages unless a deep dive is requested
- Save as `/home/workdir/artifacts/WSR-{project-slug}-{week-end-date}.docx`

## Quality check before delivery

- Week dates explicit and consistent
- Overall RAG matches the worst unmitigated item
- Every action has an owner or is marked TBD
- No invented completions
- Next-week plan is checkable
- File path stated when a document was written
