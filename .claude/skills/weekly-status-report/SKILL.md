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
