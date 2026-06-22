---
name: execute-loan-ledger
description: Execute tasks from tasks/tasks-loan-ledger.md one sub-task at a time, following the execute-tasks.md workflow. Stops after each sub-task and waits for user approval before continuing.
disable-model-invocation: false
---

Follow the execute-tasks.md workflow for the loan ledger project:

1. Read `tasks/tasks-loan-ledger.md` and find the next uncompleted sub-task (first `- [ ]` that is a sub-task under an uncompleted parent)
2. Announce which sub-task you are about to implement — state the task number and description clearly
3. Implement that sub-task only — do not move ahead to the next one
4. After implementing, mark the sub-task as complete by changing `- [ ]` to `- [x]` in `tasks/tasks-loan-ledger.md`
5. If all sub-tasks under a parent task are now complete, mark the parent task as complete too
6. Stop and ask: "Sub-task [X.Y] complete. Ready for the next one? (y to continue)"
7. Wait for the user to respond before proceeding

Important rules:
- Never implement more than one sub-task per turn without explicit approval
- Always update the task file checkbox immediately after completing the sub-task
- If a sub-task touches financial math (interest, amortization, replay, NSF reversal), explain your implementation before writing code and confirm the approach
- If you hit a blocker or an assumption that affects the task, stop and explain rather than guessing
- Reference the PRD (tasks/prd-loan-ledger-v2.md) and DRD (tasks/drd-loan-ledger-v1.md) for requirements — do not invent behaviour not specified there
