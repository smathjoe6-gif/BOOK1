# TOC Thinking Processes

The Thinking Processes are Goldratt's logic kit for when the constraint is a policy or a conflict, not a scarce machine — the five focusing steps (`references/theory-of-constraints.md`) still apply underneath. These trees exist to find the **injection** that actually makes exploit / subordinate / elevate possible against a policy constraint.

Full trees belong in a working session, not in the report. The weekly status report only ever gets: **the injection, its owner, and one predicted effect that can be checked next Friday.** See "What belongs in the weekly report" below before writing anything into the WSR itself.

## Which tree answers which question

| Tool | Question | You should walk out with |
|---|---|---|
| Current Reality Tree | Why do these pains keep arriving together? | One core problem that explains most of the undesirable effects (UDEs) |
| Evaporating Cloud | What conflict is protecting that core problem? | An injection that attacks an assumption — not a compromise |
| Future Reality Tree | If we inject that, do the good effects actually show up? | Cause-effect chain from the injection to the desirable effects |
| Negative Branch Reservation | What new damage does the injection create? | Extra injections that cut off the bad branch |
| Prerequisite Tree | What stands in the way? | Intermediate objectives, in dependency order |
| Transition Tree | What happens next Tuesday? | Actions with expected, observable effects |

Skip whichever tools the actual question doesn't need. A Prerequisite Tree is not a Gantt chart. An Evaporating Cloud is not a negotiation worksheet.

## Categories of Legitimate Reservation

Every arrow in every tree has to survive these checks before another box gets added on top of it:

- **Clarity** — the words mean one thing, unambiguously
- **Entity existence** — this thing actually happens/exists
- **Causality existence** — A really produces B, here, in this system
- **Cause sufficiency** — A alone is enough, or the missing co-causes must be ANDed in explicitly
- **Additional cause** — would B still happen from C even if A vanished?
- **Cause-effect reversal** — check whether the arrow is actually backward
- **Predicted effect** — if A were true, some other visible effect D should also exist somewhere — does it?

If an arrow fails one of these, fix the logic itself. Adding more boxes on top of a broken arrow will not save the tree.

## Current Reality Tree (CRT)

Take 5–10 undesirable effects (UDEs) the user will own as genuinely true — not effects you're guessing at. Work upward from effects to causes until they converge on a small set. Use AND explicitly whenever two conditions must co-exist to produce an effect. The core problem is the smallest set of entities that explains most of the UDEs — not necessarily the single scariest-sounding one.

A useful CRT is slightly offensive: it names a specific policy that someone in the room still actively defends. If removing a so-called UDE wouldn't actually touch the goal, it was noise, not a real UDE — cut it.

## Evaporating Cloud (EC)

Five boxes, not a midpoint — a cloud that resolves to "split the difference" was never actually built:

- **A** — the shared objective both sides actually want
- **B and C** — two needs that both look required in order to reach A
- **D and D'** — two opposing actions, each satisfying one of B or C, that conflict with each other

Write the hidden assumption sitting on each arrow explicitly. The injection works by breaking one of those assumptions, so D and D' stop being mutually exclusive — it isn't a negotiated compromise between them.

**Project cliché:** protect the date vs. protect quality → overtime vs. slip. A real injection might be "stop all non-chain work" — it attacks the hidden assumption that every busy task is helping reach A, which is usually false.

## Future Reality Tree (FRT) and Negative Branches (NBR)

Build downward from the injection to the desirable effects that would cancel out the CRT's original UDEs. Use AND for every condition that must also hold true alongside the injection. If a desirable effect never actually appears anywhere in the tree, the injection is incomplete — it isn't attacking the whole core problem.

Then deliberately let someone competent say "yes, but—". That negative branch *is* the real implementation risk. Trim it with an additional injection rather than hoping it doesn't happen. An untrimmed NBR is exactly how "we ran TOC on this" quietly creates a brand-new set of UDEs a few weeks later.

## Prerequisite Tree (PRT) and Transition Tree (TRT)

**Prerequisite Tree:** obstacles → intermediate objectives that make each obstacle irrelevant, ordered so that no intermediate objective assumes a later one hasn't happened yet.

**Transition Tree:** the only one of these artifacts that belongs almost verbatim in the WSR action table — current reality, action, expected effect, owner, date. Everything upstream of it (CRT, cloud, FRT, NBRs) is working material that produced this tree; it doesn't itself go in the report.

## What belongs in the weekly report

- **Snapshot** — the core problem and the injection, in one or two sentences, nothing more
- **Decisions** — untested assumptions, and any untrimmed negative branches still open
- **Actions** — Transition Tree steps only, in the normal action-item table
- **Risks** — negative branches that are still open and not yet cut by an injection

A policy constraint is not Green just because tasks moved this week. It stays **Amber** until a predicted effect from the Future Reality Tree actually showed up as expected; it's **Red** if the original UDEs are still true and nobody currently owns an injection against them.
