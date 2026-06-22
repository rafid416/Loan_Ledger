---
name: recurring-issues
description: Gaps and antipatterns observed in tasks-loan-ledger.md across reviews
metadata:
  type: project
---

Issues found in initial review (2026-06-22) — track whether resolved on re-review:

OPEN:
1. dollars-vs-cents conversion boundary under-specified. Task 2.2 says LoanEvent amounts are dollars (numbers), but no single explicit task owns the dollars→cents conversion at the reducer boundary. Risk of double-conversion or float drift. (Task 7.8 converts in the form; reducer 4.2/4.4 unclear on whether it receives dollars or cents.)
2. No explicit code-review quality-gate task (generate-tasks TASKS-4 requires review tasks). Task 9 is integration verification only.
3. Negative-principal edge case (PRD OQ-4 / DRD OQ-2) not represented as a task — no handling/display task for interest > payment.
4. prefers-reduced-motion (DRD 7.4) not a task despite all animations needing to respect it.
5. Reversed-row aria-label="Reversed payment" (DRD 8) missing; task 8.10 styles strikethrough but omits the aria-label.
6. Out-of-order / chronological-sort handling unspecified. PRD A-3 assumes user enters in order, but replay (3.5) "walks events in chronological order" — is there a sort? Ambiguous whether replay sorts or trusts insertion order.
7. Tasks 3.2 and 11.2 are redundant (both implement thirtyThreeSixtyDays). 11.2 even says "if not already done in 3.2".
8. Payoff event handler (3.10) and payoff QUOTE (3.11) both exist, but Add Event panel (7.x) treats payoff as an event while DRD 6.3 labels it "Payoff Quote" — quote-vs-event conflation between PRD (FR-18 payoff event) and DRD (quote). Stat card "Payoff Today" (8.2) needs calculatePayoffQuote wired but no explicit subtask wires it.
9. Task 8.1 calls replayEvents on every render in App.tsx but passes to LoanLedger — no useMemo mentioned; fine for scale but worth a perf note.

RESOLVED: (none yet — initial review)

**Why:** Lets re-reviews confirm fixes instead of re-deriving from scratch.
**How to apply:** On next review, check each OPEN item against the file; move resolved ones to RESOLVED with date.
