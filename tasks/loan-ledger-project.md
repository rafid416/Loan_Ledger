# Project: In-Memory Loan Ledger

## Overview

Build a small single-page web app that models a mortgage loan as an **event-sourced ledger**.
A loan starts with some terms (principal, rate, amortization, payment frequency). From there,
a stream of **events** (payments, advances, reversals, payoff) drives everything. The current
state of the loan — outstanding balance, the transaction ledger, a payoff quote — is always
**derived by replaying the events**, never stored and mutated directly.

**Time budget:** ~1–2 days. Don't gold-plate. Get the core right, then reach for stretch goals.

## Stack

- **Vite + React + TypeScript.**
- **All data in memory** — no backend, no database, no persistence. Refreshing the page
  resetting the loan is completely fine.
- State should live in a single store (a `useReducer` is the natural fit). The event list is
  the source of truth.
- Use Shadcn UI and Tailwind CSS for styling.

## The domain

A loan is created with:

```ts
type Loan = {
  principal: number;        // e.g. 250000
  annualRate: number;       // e.g. 0.0525 (5.25%)
  amortizationYears: number;// e.g. 25
  frequency: 'monthly';     // monthly is enough; bi-weekly is a stretch goal
  startDate: string;        // ISO date, the funding date
};
```

Events that can happen to a loan:

```ts
type LoanEvent =
  | { id: string; type: 'funding';          date: string; amount: number }
  | { id: string; type: 'payment';          date: string; amount: number }
  | { id: string; type: 'additional_advance'; date: string; amount: number }
  | { id: string; type: 'payment_reversal'; date: string; reversesEventId: string } // NSF
  | { id: string; type: 'payoff';           date: string };
```

- A **payment** is split into **interest** (accrued since the last event) and **principal**
  (the remainder), reducing the outstanding balance.
- An **additional advance** increases the outstanding balance.
- A **payment reversal** (NSF — the borrower's payment bounced) un-applies a specific prior
  payment: its principal and interest are backed out and the balance is restored. **A reversal
  is itself an event you append — you do not delete or edit the original payment.**
- A **payoff** quote is the amount needed to close the loan as of a given date: outstanding
  principal + interest accrued since the last event, to that date.

You own the interest math. State the day-count convention you chose (e.g. Actual/365).

## Screen layout

One page, three regions:

1. **Loan setup** — inputs for the loan terms above; creating/resetting the loan.
2. **Add event** — a small form to append a `payment`, `additional_advance`, `payoff` quote, or
   to mark an existing payment as NSF (`payment_reversal`).
3. **Loan state + transaction ledger** — the derived view:
   - Summary: outstanding principal, accrued interest, next payment amount, **payoff-today**.
   - A ledger table, one row per event: `date | type | amount | principal | interest | balance_after`.
   - Reversed payments should be visibly marked (e.g. struck through) with their reversal row shown.

## Key deliverables

These are the things we will specifically click through and check:

1. **Create a loan and fund it.** Setting terms produces an opening ledger with the funding row
   and the correct starting balance.
2. **Post a regular payment and have it split correctly.** A payment shows the right
   interest/principal split and the new `balance_after`, and the math reconciles.
3. **Post several payments over time** and watch the balance amortize down — interest portion
   shrinks, principal portion grows.
4. **Post an additional advance** and see the outstanding balance increase, with subsequent
   interest calculated on the higher balance.
5. **Process an NSF and update the ledger.** Mark a prior payment as returned; the ledger
   appends a reversal that backs out that payment's principal and interest and restores the
   balance to what it would have been. The original payment row stays in the ledger, visibly
   flagged.
6. **Generate a payoff quote as of a chosen date.** Outstanding principal + per-diem interest
   accrued to that date. Choosing a later date increases the quote.
7. **State is derived, not mutated.** The ledger and all summary figures are computed by
   replaying the event list.

## What we're evaluating

- **Money discipline.** Are you using floats or integer cents / a decimal approach?
  Mortgage money has to reconcile to the penny.
- **Event sourcing done right.** Is loan state a pure function of the event list? The NSF
  reversal is the tell.
- **Day-count reasoning.** Did you make an explicit, defensible choice for accruing interest?
- **Edge cases & correctness** over visual polish.
- **Clean, readable TypeScript** and sensible React state management (one reducer beats ten
  scattered `useState`s).

## Stretch goals

- A day-count convention toggle (Actual/365 vs 30/360) and show it changes the per-diem.
- An escrow component on payments (a fixed monthly amount tracked in its own column/balance).
- Bi-weekly payment frequency.
- Reversal of a reversal, or guarding against reversing an already-reversed payment.
- A few unit tests proving an NSF reversal restores state exactly.
- Export the ledger as CSV/JSON.

## Deliverable

A git repo (or zip) we can `npm install && npm run dev` to open
