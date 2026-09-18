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
