---
name: review-tasks
description: Invoke the loan-ledger-task-reviewer agent to review tasks/tasks-loan-ledger.md for coding structure, design completeness, task ordering, and math correctness. Use after any change to the task list.
disable-model-invocation: false
---

Invoke the loan-ledger-task-reviewer subagent to review `tasks/tasks-loan-ledger.md`.

Pass the following context to the agent:
- Stack: Vite + React + TypeScript + Shadcn UI + Tailwind CSS
- Key decisions: integer cents, Canadian amortization (semi-annual compounding), Actual/365 day-count, date-fns for date math, Vitest for testing, single useReducer
- Source documents: tasks/prd-loan-ledger-v2.md (PRD) and tasks/drd-loan-ledger-v1.md (DRD)

Ask the agent to review for:
1. Task ordering and dependencies — does the sequence make sense to follow top to bottom?
2. Task sizing — any tasks too large, too vague, or missing a clear deliverable?
3. Missing tasks — anything implied by the PRD or DRD not covered?
4. Design completeness — all DRD components represented (sidebar collapse, icon rail, accordion, stat cards, badge variants, struck-through reversal rows, theme toggle)?
5. Math and architecture correctness — do the lib/ tasks correctly model event sourcing, integer cents, and NSF reversal?
6. V1 core vs v1 stretch vs v2 separation — are the boundaries clear and appropriate?

Report findings with specific task numbers — what's good, what's missing, what should change.
