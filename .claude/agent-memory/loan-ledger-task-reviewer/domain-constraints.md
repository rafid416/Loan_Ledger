---
name: domain-constraints
description: Key loan-ledger math and architecture decisions the tasks must honor (event sourcing, integer cents, NSF reversal, day-count)
metadata:
  type: project
---

Domain decisions from prd-loan-ledger-v2.md the tasks must reflect correctly:

- Event-sourced: state is a PURE function of the event list via replayEvents(). Never mutate; corrections are appended events (FR-6, FR-11).
- Integer cents everywhere internally; convert to dollars only at display (FR-7). Tests assert cents.
- Canadian amortization: r = (1+annualRate/2)^(1/6)-1, M = P[r(1+r)^n]/[(1+r)^n-1] (FR-2).
- Interest Actual/365: balanceCents × (annualRate/365) × actualDays, Math.round at final step ONLY (FR-8). 30/360 is v1 stretch (FR-20).
- Leap years NOT handled — fixed 365 denominator (FR-9, A-5, NG-9). Must be documented in UI.
- NSF reversal (FR-13/14): back out the original payment's EXACT principal+interest, restore balance, do not recalc. Next interest window starts at reversal date.
- Payoff (FR-16): balance + per-diem to payoff date. No events after payoff (FR-18).
- date-fns (differenceInDays/parseISO) for all date math — native Date has TZ off-by-one risk.
- Single useReducer in App.tsx; replay runs on every render.

Edge cases flagged in PRD open questions: negative principal when interest > payment (OQ-4, allowed in v1); partial payments allowed (A-4, OQ-3).

**Why:** These are the correctness-critical invariants; tasks that violate them are Major/Critical findings.
**How to apply:** Check lib/ and reducer tasks against these on every review. See [[recurring-issues]].
