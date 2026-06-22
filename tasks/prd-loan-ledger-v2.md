# PRD: In-Memory Loan Ledger
**Version:** v2  
**Date:** 2026-06-22  
**Previous version:** prd-loan-ledger-v1.md  
**Changes from v1:** Added date-fns and Vitest to Technical Considerations. Added v2 architecture decisions for stretch goals (reversal guard, CSV/JSON export). Updated day-count implementation note to use date-fns instead of native Date arithmetic.

---

## Standards Compliance

| Field | Value |
|-------|-------|
| Standards version | 1.0.0 |
| Standards applied | global/principles.md, global/security-privacy.md, global/terminology.md, domains/code-architecture.md, phases/create-prd.md |
| Deviations | `domains/code-architecture.md` is written for .NET/C#. This project uses TypeScript/React. The principles (immutability, CQRS-lite, folder-by-feature, single responsibility) are applied using TypeScript equivalents. Specific .NET tooling (MediatR, xUnit, EF Core) does not apply. |

---

## 1. Overview

A single-page web application that models a mortgage loan as an **event-sourced ledger**. A loan is created with fixed terms, then a stream of events (payments, advances, reversals, payoff) drives all state. The current loan state — outstanding balance, transaction ledger, payoff quote — is always **derived by replaying the event list**, never stored and mutated directly.

**Problem it solves:** Demonstrates correct event-sourced financial modeling, penny-accurate interest math, and defensible day-count reasoning in a working React application.

**Time budget:** 1–2 days. Correctness over polish.

---

## 2. Goals

- G-1: Implement a fully event-sourced loan ledger where loan state is a pure function of the event list
- G-2: Produce penny-accurate interest and principal calculations that reconcile across all event types
- G-3: Handle NSF payment reversals correctly — appending a reversal event, never mutating history
- G-4: Generate a correct payoff quote as of any given date
- G-5: Demonstrate clean, readable TypeScript with a single `useReducer` managing all state
- G-6: Make all financial math decisions explicit and defensible (day-count convention, rounding, amortization formula)

---

## 3. User Stories

- **US-1:** As a user, I can enter loan terms and fund the loan, so that I see an opening ledger row with the correct starting balance.
- **US-2:** As a user, I can post a regular payment, so that I see the correct interest/principal split and updated balance.
- **US-3:** As a user, I can post multiple payments over time, so that I can observe the balance amortizing down with interest shrinking and principal growing each period.
- **US-4:** As a user, I can post an additional advance, so that the outstanding balance increases and subsequent interest accrues on the higher balance.
- **US-5:** As a user, I can mark a prior payment as NSF (returned), so that the ledger appends a reversal row, backs out that payment's principal and interest, and restores the balance — without deleting or editing the original payment row.
- **US-6:** As a user, I can request a payoff quote as of a chosen date, so that I see the outstanding principal plus per-diem interest accrued to that date.
- **US-7:** As a user, I can toggle between Actual/365 and 30/360 day-count conventions, so that I can see how the per-diem interest changes between conventions.

---

## 4. Functional Requirements

### 4.1 Loan Setup

- **FR-1 [Must Have]:** The system shall accept the following loan terms as inputs: principal (dollars), annual interest rate (percentage), amortization period (years), payment frequency (monthly), and start date (ISO date). *Traces to: US-1*
- **FR-2 [Must Have]:** On loan creation, the system shall calculate and store the fixed monthly payment amount using the **Canadian amortization formula** (semi-annual compounding): effective monthly rate `r = (1 + annualRate/2)^(1/6) - 1`, then `M = P × [r(1+r)^n] / [(1+r)^n - 1]`. *Traces to: US-2, US-3*
- **FR-3 [Must Have]:** On loan creation, the system shall append a `funding` event to the event list with the principal amount and start date, producing an opening ledger row. *Traces to: US-1*
- **FR-4 [Must Have]:** Resetting the loan shall clear all events and return to an empty state. Refreshing the page producing the same result is acceptable. *Traces to: US-1*

### 4.2 Event Types

- **FR-5 [Must Have]:** The system shall support the following event types, each stored as an immutable append to the event list:

```ts
type LoanEvent =
  | { id: string; type: 'funding';            date: string; amount: number }
  | { id: string; type: 'payment';            date: string; amount: number }
  | { id: string; type: 'additional_advance'; date: string; amount: number }
  | { id: string; type: 'payment_reversal';   date: string; reversesEventId: string }
  | { id: string; type: 'payoff';             date: string }
```

- **FR-6 [Must Have]:** Events shall never be deleted or mutated. All corrections (e.g. NSF) are expressed as new appended events. *Traces to: US-5*

### 4.3 Interest Math

- **FR-7 [Must Have]:** All monetary amounts shall be stored and calculated internally as **integer cents** (e.g. $250,000.00 = 25,000,000 cents). Conversion to dollars occurs only at the display layer. *Traces to: G-2*
- **FR-8 [Must Have]:** Interest shall accrue using the **Actual/365** day-count convention: `interest = balanceCents × (annualRate / 365) × actualDays`. The result shall be rounded to the nearest cent using `Math.round()` at the final calculation step only — intermediate calculations retain full floating-point precision. *Traces to: G-2, US-2*
- **FR-9 [Must Have]:** The day count between events shall use actual calendar days between the two event dates. Leap years are not accounted for (denominator is always 365). This limitation shall be documented in the UI. *Traces to: G-6*
- **FR-10 [Must Have]:** For each payment event, the system shall split the payment as follows:
  - `interestCents = Math.round(balanceCents × (annualRate / 365) × daysSinceLastEvent)`
  - `principalCents = paymentCents - interestCents`
  - `newBalanceCents = previousBalanceCents - principalCents`
  *Traces to: US-2, US-3*

### 4.4 Event Replay

- **FR-11 [Must Have]:** Loan state (balance, ledger rows, summary figures) shall be computed by a pure replay function: `replayEvents(events: LoanEvent[], loan: Loan): LedgerState`. Given the same inputs it always returns the same output. *Traces to: G-1*
- **FR-12 [Must Have]:** The replay function shall walk events in chronological order. For each event it shall calculate interest accrued since the previous event date, then apply the event's effect on the balance. *Traces to: G-1, US-3*
- **FR-13 [Must Have]:** A `payment_reversal` event shall back out the original payment's principal and interest, restoring the balance to what it was immediately before that payment. The reversal does not re-calculate interest — it reverses the exact amounts from the original payment row. *Traces to: US-5*
- **FR-14 [Must Have]:** After a reversal, interest continues accruing from the reversal event date on the restored balance. The next payment's interest window starts from the reversal date, not the original payment date. *Traces to: US-5*

**Example — NSF scenario:**
```
Jan 1   funding:   $250,000.00   balance: $250,000.00
Feb 1   payment:   $1,493.56     interest: $1,108.56  principal: $385.00   balance: $249,615.00  [struck through]
Feb 8   reversal:  —             backs out $385.00 principal + $1,108.56 interest               balance: $250,000.00
Mar 1   payment:   $1,493.56     interest: 21 days × $250,000.00 = $752.05  principal: $741.51  balance: $249,258.49
```

### 4.5 Additional Advance

- **FR-15 [Must Have]:** An `additional_advance` event shall increase the outstanding balance by the advance amount. Subsequent interest shall accrue on the new higher balance from the advance date forward. *Traces to: US-4*

### 4.6 Payoff Quote

- **FR-16 [Must Have]:** A payoff quote shall calculate: `payoffCents = currentBalanceCents + Math.round(currentBalanceCents × (annualRate / 365) × daysFromLastEventToPayoffDate)`. *Traces to: US-6*
- **FR-17 [Must Have]:** The payoff quote shall accept any future date. Selecting a later date shall produce a higher quote. *Traces to: US-6*
- **FR-18 [Must Have]:** A `payoff` event posted to the ledger shall record the date the loan was closed. No further events shall be accepted after a payoff event. *Traces to: US-6*

### 4.7 Day-Count Toggle (v1 Stretch Goal)

- **FR-19 [Should Have]:** The system shall provide a toggle to switch between **Actual/365** and **30/360** day-count conventions. *Traces to: US-7*
- **FR-20 [Should Have]:** Under 30/360, day count between events shall use: `days = (Y2-Y1)×360 + (M2-M1)×30 + (D2-D1)`, denominator fixed at 360. *Traces to: US-7*
- **FR-21 [Should Have]:** Switching the convention shall re-replay all events and update all ledger figures immediately. The per-diem difference between conventions shall be visible in the summary. *Traces to: US-7*

### 4.8 Unit Tests (v1 Stretch Goal)

- **FR-22 [Should Have]:** Unit tests shall cover the NSF reversal scenario: post funding → payment → reversal → next payment, and assert that the balance after each step matches the expected value to the cent. *Traces to: G-1, G-2*
- **FR-23 [Should Have]:** Unit tests shall cover the replay function as a pure function with no React dependencies, using the `lib/` layer directly. *Traces to: G-5*

---

## 5. Non-Goals (Out of Scope for v1)

- **NG-1:** No backend, no database, no persistence. Refreshing the page resets the loan.
- **NG-2:** No bi-weekly payment frequency (v2).
- **NG-3:** No escrow component (v2).
- **NG-4:** No reversal of a reversal (v2).
- **NG-5:** No guard against reversing an already-reversed payment (v2).
- **NG-6:** No CSV/JSON export (v2).
- **NG-7:** No mobile responsive design — desktop layout only.
- **NG-8:** No authentication, no user accounts.
- **NG-9:** No Actual/Actual (leap year aware) convention — Actual/365 uses fixed 365 denominator.

---

## 6. Design Considerations

Full design decisions captured in `drd-loan-ledger-v1.md`. Summary:

- **Layout:** Collapsible left sidebar (280px expanded, 64px icon rail collapsed) + main ledger panel
- **Ledger table columns:** `Date | Type | Amount | Interest | Principal | Balance After`
- **Reversed payments:** struck-through row with muted styling. Reversal row shown immediately below.
- **NSF UX:** Clicking a payment row in the ledger populates the reversal dropdown in Add Event form. Dropdown also usable independently.
- **Summary:** Four stat cards above ledger — Outstanding Balance, Accrued Interest, Next Payment, Payoff Today
- **Theme:** Dark mode default, light/dark toggle

---

## 7. Technical Considerations

**Stack:** Vite + React + TypeScript + Shadcn UI + Tailwind CSS

**Architecture:**
```
src/
├── types/loan.ts           # Loan, LoanEvent, LedgerRow, LoanState types
├── lib/
│   ├── interest.ts         # calculateInterest(balanceCents, annualRate, days): number
│   ├── amortization.ts     # calculateMonthlyPayment(principal, annualRate, years): number
│   └── replay.ts           # replayEvents(events, loan): LedgerState  ← core function
├── reducer/loanReducer.ts  # useReducer — all state transitions
└── components/
    ├── LoanSetup.tsx
    ├── AddEvent.tsx
    └── LoanLedger.tsx
```

**State management:** Single `useReducer` in `App.tsx`. The event list is the source of truth. All derived state (balance, ledger rows, payoff quote) computed by `replayEvents()` on every render or dispatch.

**Money:** Integer cents throughout. Display layer divides by 100 and formats with `toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })`.

**Rounding:** `Math.round()` applied once at the end of each interest calculation. Intermediate values retain full floating-point precision.

**Date calculations:** *(Added in v2)* Use **date-fns** (`differenceInDays`) for all day-count calculations between event dates. Native JavaScript `Date` arithmetic has timezone-related off-by-one edge cases that can corrupt interest math. date-fns handles this correctly and is tree-shakeable.

```ts
import { differenceInDays } from 'date-fns'
const days = differenceInDays(parseISO(eventB.date), parseISO(eventA.date))
```

**Day-count (30/360):** Implemented as a pure function in `lib/interest.ts` alongside Actual/365 — same interface, swappable by passing a convention parameter to `replayEvents`.

**Testing:** *(Added in v2)* Use **Vitest** for unit tests. Zero additional config needed for Vite projects. Test files live in `src/lib/__tests__/`. Tests target `lib/` functions directly — no React, no DOM, no component rendering required.

```ts
// Example test structure
import { describe, it, expect } from 'vitest'
import { replayEvents } from '../replay'
```

**No secrets, no external API calls, no PII** — fully in-memory, no security concerns beyond input validation [SEC-3].

---

## 7b. V2 Architecture Decisions *(Added in v2)*

These decisions apply to the v2 stretch goals documented in section 5 Non-Goals. Recorded here so the v2 task list can be generated without another architecture session.

**Reversal guard (NG-5):**
A validation helper `isAlreadyReversed(eventId: string, events: LoanEvent[]): boolean` shall be added to `lib/replay.ts`. Called in the reducer before appending a `payment_reversal` event. If true, the reducer returns state unchanged and the UI shows an inline error message. No structural changes to the reducer or event model required.

**Reversal of a reversal (NG-4):**
Not supported architecturally — a `payment_reversal` event has no `amount` field and cannot be reversed by another `payment_reversal`. The reversal guard above naturally prevents this. Document as intentional in code comments.

**Bi-weekly payment frequency (NG-2):**
Add `frequency: 'monthly' | 'biweekly'` to the `Loan` type. The amortization formula changes: `n = amortizationYears × 26` (bi-weekly periods), `r` uses bi-weekly rate derived from semi-annual compounding. The replay function already handles variable day counts between events so no replay changes needed — only the monthly payment calculation and UI frequency selector require updates.

**Escrow component (NG-3):**
Add optional `escrowMonthly: number` to the `Loan` type. Each payment event splits into three portions: interest, principal, escrow. Add `escrowCents` field to `LedgerRow` type and an `escrowBalance` to `LedgerState`. Escrow does not reduce principal — it is tracked separately. Minimal changes to replay function and ledger table (add Escrow column).

**CSV/JSON export (NG-6):**
No external library needed. Use browser-native `Blob` + `URL.createObjectURL` + programmatic `<a>` click pattern. Export function lives in `lib/export.ts`. Accepts the ledger rows array and returns a downloadable file. Two formats: CSV (human-readable) and JSON (machine-readable, full event list).

---

## 8. Success Metrics

- SM-1: All 7 key deliverables from the spec can be demonstrated by clicking through the UI
- SM-2: A payment posted and then NSF'd restores the balance to the exact cent
- SM-3: Interest + principal on any payment sums exactly to the payment amount (no penny gaps)
- SM-4: A payoff quote on a later date is always higher than one on an earlier date
- SM-5: The ledger is identical whether computed fresh or after toggling the day-count convention back and forth
- SM-6: `npm install && npm run dev` runs without errors

---

## 9. Key Assumptions

- **A-1:** Canadian mortgage market — semi-annual compounding amortization formula applies
- **A-2:** Monthly payment frequency only for v1
- **A-3:** The user enters valid dates in chronological order — no out-of-order event validation required for v1
- **A-4:** Payment amount entered by the user matches the calculated monthly payment — the app does not enforce this (partial payments allowed)
- **A-5:** Actual/365 uses a fixed 365-day denominator regardless of whether the loan spans a leap year

---

## 10. Open Questions

- **OQ-1:** Should the app prevent posting events after a `payoff` event, or just display a warning? *(Assumption: block with a clear UI message)*
- **OQ-2:** Should the monthly payment amount be editable by the user, or always calculated from the amortization formula? *(Assumption: always calculated, not editable)*
- **OQ-3:** Should partial payments (less than the scheduled amount) be allowed? *(Assumption: yes — user enters any amount, math handles it)*
- **OQ-4:** What happens if interest exceeds the payment amount (deeply delinquent loan)? *(Assumption: allow negative principal reduction for v1, flag as edge case)*

---

## 11. User Journey Examples

**Journey 1 — Normal payment cycle:**
1. User enters loan terms: $250,000, 5.25%, 25 years, Jan 1 2026 → clicks Create
2. Ledger shows funding row: balance $250,000.00
3. User selects Payment, enters Feb 1 2026 → submits
4. Ledger shows: interest $1,108.56 | principal $385.00 | balance $249,615.00
5. User repeats for Mar 1, Apr 1 — watches interest shrink, principal grow

**Journey 2 — NSF scenario:**
1. Loan funded Jan 1. Feb 1 payment posted successfully.
2. User clicks Feb 1 payment row in ledger — reversal form populates
3. User sets NSF date to Feb 8 → submits reversal
4. Feb 1 row becomes struck-through. Reversal row appears. Balance restored to $250,000.00
5. User posts Mar 1 payment — interest calculated on 21 days from Feb 8 on $250,000.00
