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
