# Earned Value Management (EVM)

Use this when the user provides (or the project tracks) PV/EV/AC data — cost- and schedule-performance projects where "percent done" needs to be more than a feeling. Skip it entirely for projects with no earned-value baseline; forcing EVM onto a project with no real PV/EV/AC data produces fake precision, not insight.

## The three numbers that matter

At the status date:

- **PV (planned value)** — budgeted work that should be done by now
- **EV (earned value)** — budgeted value of work that is actually done
- **AC (actual cost)** — what that work really cost (money *or* hours — never mix the two in one calculation)

EV is not "we feel 60% done." It follows an earning rule: 0/100, 50/50, weighted milestones, or evidenced physical %. A gut percentage is not EVM — if there's no real earning rule behind the number, say so rather than inventing one.

## Variances — where you are versus the plan

```
SV = EV - PV        CV = EV - AC
SV% = SV / PV        CV% = CV / EV
```

- SV < 0 → behind schedule in budget terms.
- CV < 0 → over cost.
- A small SV on the critical path beats a large SV on a side package — always check which package is actually driving the number before reacting to it.

## Indices — efficiency, not vibes

```
SPI = EV / PV        CPI = EV / AC
```

Practical weekly bands (override if the contract sets tighter thresholds):

| Index | Read |
|---|---|
| ≥ 1.05 | Ahead / efficient — still check the critical path |
| 0.95–1.04 | On plan |
| 0.85–0.94 | Amber — recovery plan required |
| < 0.85 | Red, unless a rebaseline just landed |

**Watch out:** SPI late in the job lies. As PV approaches BAC, SPI is mathematically dragged toward 1.0 even if the remaining work is genuinely late — the denominator stops growing while the project still has slipping work ahead of it. After roughly 70% complete, prefer Earned Schedule (below) over classic SPI.

## Forecasts — what "done" will actually cost and when

| Metric | Default formula | Use when |
|---|---|---|
| BAC | Current approved budget | After formal CRs, never the original number |
| EAC (typical) | `BAC / CPI` | Current burn rate is expected to persist |
| EAC (atypical) | `AC + (BAC - EV)` | One-off shock; remaining work returns to budgeted rates |
| EAC (composite) | `AC + (BAC - EV) / (CPI × SPI)` | Both cost *and* schedule inefficiency are expected to persist |
| ETC | `EAC - AC` | What is still to fund |
| VAC | `BAC - EAC` | Expected overrun (negative = over budget) |

Always name which EAC method was used — never present an EAC as if it's the only possible number. Default to **composite** on a slipping job with no proven fix in place; only use typical/atypical when there's a specific, justified reason the situation matches that formula's assumption.

## TCPI — the honesty check

```
TCPI(BAC) = (BAC - EV) / (BAC - AC)
```

This is the efficiency the project must run at, starting today, to hit BAC. If CPI is 0.82 and TCPI comes out to 1.25, the recovery plan is fiction unless scope or capacity actually changes — no team recovers by suddenly working 25%+ more efficiently than its own track record. TCPI > 1.10 with no approved change behind it is not Green on cost, no matter what the narrative says.

## Earned Schedule — when the calendar matters more than the money

Classic SV/SPI are expressed in currency, which is exactly what makes them lie near project completion (see above). Earned Schedule (ES) asks the more literal question: how many time periods late is this, really?

- **ES** = the time at which PV first equalled the project's *current* EV
- `SV(t) = ES - AT` (AT = actual time elapsed)
- `SPI(t) = ES / AT`
- `IEAC(t) ≈ PD / SPI(t)` (PD = planned duration)

Use Earned Schedule when the finish date matters more than the money, or when classic SPI has already flattened out toward 1.0 despite known slippage.

## How this should move RAG

Healthy cost performance does not rescue a missed critical date — a project can be CPI 1.1 and still be the reason a launch slips.

- SPI and CPI both ≥ 0.95, slack intact → Green on those axes
- Either in the 0.85–0.94 band, or TCPI ≥ 1.10 → Amber, and name the specific package driving the index down
- Either < 0.85, or VAC is beyond contingency, or IEAC(t) lands past the committed date → Red
- SPI ≈ 1 but Earned Schedule shows real delay → color from ES, not from SPI
- No real earning rule behind the EV number → Grey/Amber, never an invented Green

## Weekly EVM strip

On the weekly status page, keep this to one compact strip plus two sentences:

- PV / EV / AC
- SV / CV
- SPI / CPI
- EAC / VAC / TCPI
- (each versus last week's figure)
- Two sentences: **what earned the value this week**, and **which package is distorting the index**

To run this strip, ask the user for a week's PV, EV, AC, and BAC if they haven't already given them — the whole method is inert without those four numbers.
