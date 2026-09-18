# Section Spec — Markdown Chat Draft

Use this exact heading order and level for a chat-draft (Markdown) weekly status report. Match wording to the project; do not add or remove sections — write "None" / "No change" rather than omitting one.

```markdown
# Weekly Status Report — {Project}
**Week of** {start}–{end} · **Issued** {date} · **Prepared by** {author/role} · **Overall status:** {RAG} — {one-clause reason}

## Executive Snapshot
{3-5 sentences: the state of the project, the one thing that matters most this week, and where it's headed.}

## Highlights / Accomplishments
- {done item, past tense}
- {done item, past tense}

## Progress vs Plan
{Where the project stands against its plan/milestones — ahead, on track, or behind, and by how much.}

## Work in Progress
- {WIP item, present tense} — {owner}, {expected finish}

## Next Week Plan
- {planned item, future tense} — {owner}

## Risks and Issues
| Type | Description | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Risk/Issue/Blocker | | | | |

## Decisions Needed
- {decision}, needed by {date}, from {who}

## Metrics and Milestones
| Metric/Milestone | Target | Actual | Status |
|---|---|---|---|

## Action Items
| ID | Action | Owner | Due | Status | Notes |
|---|---|---|---|---|---|

## Appendix
{Optional — supporting detail, links, raw data.}
```

## Notes

- **Executive Snapshot** must stay consistent with the body — never claim a status the sections below contradict.
- **Overall status** (top of doc) must match the worst unmitigated item found in Risks and Issues.
- Every row in **Action Items** needs an owner and a due date, or both are `TBD` and the item also appears under **Decisions Needed**.
- Carry forward any open action item from the prior week's report rather than dropping it silently.
