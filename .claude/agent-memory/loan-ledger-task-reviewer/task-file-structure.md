---
name: task-file-structure
description: Current section layout and parent-task breakdown of tasks-loan-ledger.md as of 2026-06-22
metadata:
  type: project
---

Structure of /tasks/tasks-loan-ledger.md (as of 2026-06-22, initial review):

Header: standards version 1.0.0, source docs prd-loan-ledger-v2.md + drd-loan-ledger-v1.md.
Sections: Relevant Files, Notes, Instructions for Completing Tasks, then Tasks split into three tiers.

**V1 Core (required):**
- 0.0 Create feature branch (git init + branch)
- 1.0 Project setup (Vite/React/TS/Tailwind/Shadcn/date-fns) — 12 subtasks
- 2.0 TypeScript types & data model — 7 subtasks
- 3.0 Core math library (daycount, amortization, interest, replay) — 13 subtasks
- 4.0 Loan reducer — 8 subtasks
- 5.0 App shell (header, sidebar, layout, theme toggle) — 9 subtasks
- 6.0 Loan Setup panel — 12 subtasks
- 7.0 Add Event panel — 9 subtasks
- 8.0 Loan Ledger panel (stat cards + table) — 16 subtasks
- 9.0 Integration pass (7 deliverables) — 10 subtasks

**V1 Stretch:**
- 10.0 Vitest unit tests — 8 subtasks
- 11.0 Day-count convention toggle — 6 subtasks

**V2 Stretch (future):**
- 12.0 Reversal guard
- 13.0 Bi-weekly frequency
- 14.0 Escrow
- 15.0 CSV/JSON export

**Why:** Tracks the shape so future reviews can quickly diff against this baseline.
**How to apply:** On re-review, compare new structure to this and note renumbering/added/removed parent tasks.
