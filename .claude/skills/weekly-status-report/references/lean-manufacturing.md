# Lean Manufacturing

Lean is Toyota's operating system expressed as a set of principles: define value from the customer, see the whole stream, make it flow, let demand pull, and never stop improving. It is not a cost-cutting campaign and not a 5S contest — a program that stops at posters and a tidy floor has missed the method entirely.

## Five principles (Womack and Jones)

1. **Value** — what the customer will actually pay for, at a given time and price. Internal work they would never fund is waste, even when it looks professional and everyone involved is busy.
2. **Value stream** — every material and information step from request to cash. Classify each step as value-adding, enabling (necessary but not paid for directly), or waste.
3. **Flow** — once waste is visible, connect the remaining steps so work doesn't die sitting in departmental batches and queues between them.
4. **Pull** — downstream consumption starts upstream work. Forecast-push is the default failure mode this principle exists to replace.
5. **Perfection** — the first four never finish. Kaizen, plus real authority for the people doing the job, is how newly-created waste keeps getting seen instead of settling in as "how we work."

A plant that draws one value-stream map and then sets OEE (Overall Equipment Effectiveness) targets on every machine has stopped at principle 2 and never reached flow or pull.

## How Toyota actually built it

Two pillars on a foundation:

**Just-in-time** — the right part, in the right amount, at the right time.
- **Takt** sets the pace when demand is the limiting factor.
- **Small lots** (made possible by fast changeovers — see SMED below), **kanban** as a capped pull signal, and **heijunka** (leveling) so the mix arriving upstream isn't a weekly panic.

**Jidoka** — stop when something is wrong, rather than passing a defect downstream.
- **Andon**, **poka-yoke** (mistake-proofing), and inspection built directly into the step it protects. Quality is not a department stationed at the end of the line.

Underneath both pillars: **standard work**, **5S** used as visual stability (not housekeeping theater performed for a visit), and **respect for people** — specifically, the people who actually run the work are the ones allowed to change it. Pull without real standards just starves the next cell instead of protecting it.

## Waste is three words, not seven posters

- **Muda** — the famous list: overproduction, waiting, transport, overprocessing, inventory, motion, defects, plus unused talent. **Overproduction is the mother waste** — it directly creates most of the other six (it generates the inventory, the waiting, the extra motion and transport to handle it).
- **Mura** — unevenness. A lumpy release schedule will recreate inventory even after an otherwise beautiful waste walk cleaned the floor.
- **Muri** — overburden. Lean that strips out muda and then slams peak demand through the same heads and machines doesn't create capacity — it manufactures breakdowns and hidden queues instead.

Hunting muda alone produces a tidy factory that still can't hit its actual product mix.

## Mechanisms that make the principles real

| Tool | Job |
|---|---|
| Takt | Customer pace, expressed in seconds |
| Standard work | The current best known method; heroics against it are a defect, not a save |
| SMED | Changeover short enough that mix doesn't force giant batches |
| Kanban | Visible pull, with a hard WIP cap |
| Heijunka | Levels volume and mix so the signal arriving upstream stays boring |
| Andon | Contains a defect at its actual source |
| A3 / PDCA | How a problem gets closed — not how a slide gets titled |
| Genchi genbutsu | Go look. Arguments made without seeing the actual parts are just opinions |

## Lean next to TOC

They rhyme, and they also fight.

**Where they rhyme:** Pull is close to the rope. Takt is close to the drum, when the market itself is the constraint. A supermarket (a capped, replenished stock point) is close to a buffer. Buffer-status monitoring and andon are both instances of the same underlying rule — do not hide the problem, surface it immediately.

**Where they fight:** Lean can cut WIP in front of a *real* internal constraint and starve the drum — a WIP cap sized without knowing where the actual bottleneck sits will choke it. Or every cell gets "improved" individually while the one resource that actually sets throughput is still changing over twice a shift, untouched. They also fight in the other direction: TOC can treat waste sitting off the drum as eternally optional, but defects and overburden anywhere in the system still steal cash and, eventually, constraint time too.

On a weekly page, **do not average the two colors** — report both lenses separately:

- **Lean mode:** takt attainment, WIP versus its cap, open andon calls, changeover time versus standard, request-to-ship lead time, overproduction events.
- **TOC mode:** the drum, its buffer zone, whether the rope is still intact (see `references/dbr.md` and `references/theory-of-constraints.md`).

OEE pushed on a non-bottleneck resource is usually a demand to overproduce — which makes it anti-Lean and anti-TOC at exactly the same time, for the same underlying reason.

See `references/six-sigma.md` for the third leg of this stool: Six Sigma attacks variation against a spec, which is a different enemy again from Lean's waste/unevenness/overburden and TOC's starved constraint — they stack well together and rot together in predictable ways.

## How Lean decays

- 5S becomes the entire program instead of a foundation for something else.
- Kanban cards exist but with no real cap — the old min/max system wearing nicer stationery.
- A value-stream map gets drawn once and never actually changes the release rule it's supposed to inform.
- A kaizen week happens, then the floor returns to batch-push the following Monday.
- Posters go up about respect for people, with no matching authority given to actually stop the line when something's wrong.
