# Tasks: In-Memory Loan Ledger
**Standards version:** 1.0.0  
**Standards applied:** global/principles.md, phases/generate-tasks.md  
**Source documents:** prd-loan-ledger-v2.md, drd-loan-ledger-v2.md  
**Date:** 2026-06-22  
**Revision:** v2 — updated per loan-ledger-task-reviewer initial review (2026-06-22)

---

## Relevant Files

- `src/main.tsx` - Vite entry point, renders App
- `src/App.tsx` - Root component, owns useReducer, layout shell
- `src/types/loan.ts` - All TypeScript types: Loan, LoanEvent, LedgerRow, LoanState, DayCountConvention
- `src/lib/money.ts` - `toCents(dollars)` and `fromCents(cents)` conversion helpers — the single source of truth for the dollars↔cents boundary
- `src/lib/amortization.ts` - Canadian amortization formula (semi-annual compounding monthly payment calculation)
- `src/lib/interest.ts` - Interest calculation functions for Actual/365 and 30/360 conventions
- `src/lib/replay.ts` - Core pure function: replayEvents(events, loan, convention) → LedgerState
- `src/lib/daycount.ts` - Day count helpers using date-fns (differenceInDays, 30/360 formula)
- `src/lib/export.ts` - CSV/JSON export via browser Blob API (v2)
- `src/lib/__tests__/replay.test.ts` - Vitest unit tests for replay function and NSF reversal ⚡ CORE
- `src/lib/__tests__/interest.test.ts` - Vitest unit tests for interest calculations (v1 stretch)
- `src/lib/__tests__/amortization.test.ts` - Vitest unit tests for amortization formula (v1 stretch)
- `src/reducer/loanReducer.ts` - useReducer logic, all state transitions, action types
- `src/components/LoanSetup.tsx` - Loan terms form, create/reset loan
- `src/components/AddEvent.tsx` - Event type selector and contextual form fields
- `src/components/LoanLedger.tsx` - Stat cards + ledger table
- `src/components/AppHeader.tsx` - App title, day-count toggle, light/dark toggle
- `src/components/Sidebar.tsx` - Collapsible left panel shell with accordion sections
- `vitest.config.ts` - Vitest configuration
- `tailwind.config.ts` - Tailwind config with dark mode class strategy and color tokens
- `vite.config.ts` - Vite config

### Notes

- Unit tests live in `src/lib/__tests__/` — all lib functions are pure TypeScript with no React dependencies, making them trivial to test without DOM setup
- Run tests with `npx vitest` or `npx vitest run` for single pass
- All monetary values in tests should assert in cents (integers), not dollars
- **Money boundary rule:** `LoanEvent` amounts are stored in dollars (per the spec type definition). `toCents()` from `lib/money.ts` is called once at the start of each replay event handler. No conversion happens in the reducer, form submit, or anywhere else. `fromCents()` is called only at the display layer.

---

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, check it off by changing `- [ ]` to `- [x]`. Update after each sub-task, not just after the parent task.

---

## Tasks

### V1 — Core (Required)

- [x] 0.0 Create feature branch and scaffold project
  - [x] 0.1 Scaffold Vite into the current directory (not a subfolder): `npm create vite@latest . -- --template react-ts` — this ensures the repo root and app root are the same, so evaluators can run `npm install && npm run dev` directly (FR-deliverable)
  - [x] 0.2 Run `git init` in the project root (now the same as the app root)
  - [x] 0.3 Create and checkout feature branch: `git checkout -b feature/loan-ledger`

- [x] 1.0 Install and configure dependencies (Tailwind + Shadcn + date-fns + Inter font)
  - [x] 1.1 Run `npm install` to install Vite-generated dependencies
  - [x] 1.2 Install Tailwind CSS and configure: `npm install -D tailwindcss postcss autoprefixer` then `npx tailwindcss init -p`
  - [x] 1.3 Configure `tailwind.config.ts` — set `darkMode: 'class'`, add `./src/**/*.{ts,tsx}` to content paths
  - [x] 1.4 Add Tailwind directives to `src/index.css`: `@tailwind base; @tailwind components; @tailwind utilities;`
  - [x] 1.5 Add custom color tokens to `tailwind.config.ts` for both dark and light mode (bg-base, bg-surface, bg-elevated, bg-hover, bg-active, text-primary, text-secondary, text-tertiary, text-muted, accent-primary, accent-success, accent-warning, accent-error, border-subtle, border-default, border-focus) per DRD section 5.1
  - [x] 1.6 Install and initialise Shadcn UI: `npx shadcn@4.9.0 init` — Radix + Nova preset, CSS variables
  - [x] 1.7 Add required Shadcn components: button input label select accordion badge table separator switch
  - [x] 1.8 Install date-fns: `npm install date-fns`
  - [x] 1.9 Install Inter font via `@fontsource/inter`: `npm install @fontsource/inter` and import in `main.tsx`
  - [x] 1.10 Install lucide-react (ships with Shadcn, verify available): confirmed present
  - [x] 1.11 Verify dev server runs cleanly: starts in 296ms, no errors

- [x] 2.0 Define all TypeScript types and data model (traces to: FR-1, FR-2, FR-5, FR-7)
  - [x] 2.1 Create `src/types/loan.ts` and define the `Loan` type: `principal`, `annualRate`, `amortizationYears`, `frequency`, `startDate`, `monthlyPaymentCents`
  - [x] 2.2 Define the `LoanEvent` discriminated union type exactly as specified in FR-5 — amounts stored in dollars (`number`) as per the spec's own type definition. Internal math uses cents via `toCents()` at replay time.
  - [x] 2.3 Define `LedgerRow` type: `eventId`, `date`, `type`, `amountCents`, `interestCents`, `principalCents`, `balanceAfterCents`, `isReversed`, `reversedByEventId`
  - [x] 2.4 Define `LedgerState` type: `rows: LedgerRow[]`, `currentBalanceCents: number`, `accruedInterestCents: number`, `payoffTodayCents: number`
  - [x] 2.5 Define `DayCountConvention` type: `'actual365' | 'thirty360'`
  - [x] 2.6 Define `AppState` type: `loan: Loan | null`, `events: LoanEvent[]`, `convention: DayCountConvention`, `selectedEventId: string | null`
  - [x] 2.7 Define `Action` discriminated union for the reducer: `CREATE_LOAN`, `RESET_LOAN`, `ADD_EVENT`, `SET_CONVENTION`, `SELECT_EVENT`
  - [x] 2.8 Create `src/lib/money.ts` — implement `toCents(dollars: number): number` (`Math.round(dollars * 100)`) and `fromCents(cents: number): string` (formats as CAD currency for display). This is the single conversion boundary — called in replay handlers (dollars→cents) and display layer (cents→string) only. Never call elsewhere.

- [x] 3.0 Implement core math library (traces to: FR-2, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16)
  - [x] 3.1 Create `src/lib/daycount.ts` — implement `daysBetween(dateA: string, dateB: string): number` using `differenceInDays` from date-fns and `parseISO`. Add a note in the function: replay sorts events by date before walking; if two events share a date, insertion order is the tiebreaker.
  - [x] 3.2 Create `src/lib/amortization.ts` — implement `calculateMonthlyPaymentCents(principalCents: number, annualRate: number, amortizationYears: number): number` using Canadian semi-annual compounding formula: `r = (1 + annualRate/2)^(1/6) - 1`, `M = P × [r(1+r)^n] / [(1+r)^n - 1]`, result rounded to nearest cent (FR-2)
  - [x] 3.3 Create `src/lib/interest.ts` — implement `calculateInterestCents(balanceCents: number, annualRate: number, days: number, convention: DayCountConvention): number` — uses `annualRate / 365 × days` for actual365, `annualRate / 360 × days` for thirty360, `Math.round()` applied at final step only, intermediate values retain full float precision (FR-8, FR-10)
  - [x] 3.4 Create `src/lib/replay.ts` — implement `replayEvents(events: LoanEvent[], loan: Loan, convention: DayCountConvention): LedgerState` as a pure function. Sort events by date ascending before walking (daysBetween tiebreaker: insertion index). Wrap in `useMemo` at the call site in App.tsx: `useMemo(() => replayEvents(events, loan, convention), [events, loan, convention])` (FR-11)
  - [x] 3.5 In `replay.ts` — implement funding event handler
  - [x] 3.6 In `replay.ts` — implement payment event handler with isNegativePrincipal flag
  - [x] 3.7 In `replay.ts` — implement additional_advance event handler
  - [x] 3.8 In `replay.ts` — implement payment_reversal event handler — backs out exact cents, marks original isReversed, lastEventDate = reversal date
  - [x] 3.9 In `replay.ts` — implement payoff event handler
  - [x] 3.10 In `replay.ts` — implement `calculatePayoffQuote`
  - [x] 3.11 In `replay.ts` — implement `getReversibleEvents`
  - [x] 3.12 NSF math verified: Feb 8 reversal restores balance to exactly $250,000.00; Mar 1 interest runs from Feb 8 (21 days). Math correct to the cent.

- [x] 4.0 Implement loan reducer (traces to: FR-3, FR-4, FR-6, FR-18)
  - [x] 4.1 Create `src/reducer/loanReducer.ts` — define `initialState: AppState` with null loan, empty events array, `actual365` default convention, null selectedEventId
  - [x] 4.2 Implement `CREATE_LOAN` action: compute monthlyPaymentCents in reducer (not form), build Loan, append funding event. Action payload uses Omit<Loan, 'monthlyPaymentCents'>.
  - [x] 4.3 Implement `RESET_LOAN` action: return `initialState`
  - [x] 4.4 Implement `ADD_EVENT` action: payoff guard → append with fresh crypto.randomUUID(). Payload uses Omit<PostableEvent, 'id'> — reducer generates the id.
  - [x] 4.5 Implement `SET_CONVENTION` action
  - [x] 4.6 Implement `SELECT_EVENT` action — toggles: clicking same row again deselects
  - [x] 4.7 Export `loanReducer` and `initialState` from the module
  - [x] 4.8 Wire `useReducer(loanReducer, initialState)` + `useMemo` for ledgerState into `App.tsx`. TypeScript check passes clean.

- [ ] 5.0 Build app shell — header, sidebar, layout, theme toggle (traces to: DRD sections 4, 6.1, 6.9)
  - [ ] 5.1 Create `src/components/AppHeader.tsx` — full-width sticky header, 48px height, bg-surface, 1px bottom border border-subtle
  - [ ] 5.2 Add app title "Loan Ledger" to header left side — 20px font-semibold text-primary
  - [ ] 5.3 Add light/dark mode toggle button to header right — Sun/Moon icon from lucide-react, switches `dark` class on `document.documentElement`. Apply the class before first paint to prevent flash of unstyled content (FOUC): read localStorage in a script tag in `index.html` before React loads, apply `dark` class immediately if saved preference is dark. Default: dark mode.
  - [ ] 5.4 Create `src/components/Sidebar.tsx` — left panel with two states: expanded (280px) and collapsed (64px icon rail). Transition: 200ms ease-out. Wrap transition in `@media (prefers-reduced-motion: reduce)` check — disable animation when user has reduced motion enabled (DRD 4.3, DRD 7.4)
  - [ ] 5.5 Add collapse/expand toggle button at bottom of sidebar — ChevronLeft icon when expanded, ChevronRight when collapsed
  - [ ] 5.6 Implement collapsed icon rail — shows Settings icon (Loan Setup), Plus icon (Add Event), ChevronRight (expand). Clicking an icon expands the sidebar and opens that accordion section
  - [ ] 5.7 Implement accordion behaviour in sidebar — Shadcn `Accordion` component with `type="single"` so only one section is open at a time. Sections: "Loan Setup" and "Add Event"
  - [ ] 5.8 Set up main layout in `App.tsx` — flex row: Sidebar (fixed width) + main content area (flex-1). Main content: flex column with stat cards row on top and ledger below. Full viewport height.
  - [ ] 5.9 Apply bg-base to page background, bg-surface to sidebar — confirm dark/light mode tokens switch correctly when toggle is clicked

- [ ] 6.0 Build Loan Setup panel (traces to: FR-1, FR-2, FR-3, FR-4, DRD 6.2)
  - [ ] 6.1 Create `src/components/LoanSetup.tsx` — accordion section content with form fields
  - [ ] 6.2 Add Principal input — number type, $ prefix, label "Principal", placeholder "250000"
  - [ ] 6.3 Add Annual Rate input — number type, % suffix, label "Annual Rate (%)", 2 decimal places, placeholder "5.25"
  - [ ] 6.4 Add Amortization Years input — number type, integer only, label "Amortization (years)", placeholder "25"
  - [ ] 6.5 Add Payment Frequency display — locked "Monthly" label (not editable in v1), shown as disabled select or static text
  - [ ] 6.6 Add Start Date input — date picker input, label "Start Date", ISO date format
  - [ ] 6.7 Add live monthly payment preview — display calculated `monthlyPaymentCents` below the form as "Monthly Payment: $1,493.56" in text-secondary. Updates as user types using local state before loan is created (FR-2)
  - [ ] 6.8 Add "Create Loan" button — full width, accent-primary variant, disabled when any required field is empty or invalid
  - [ ] 6.9 Add "Reset Loan" button — full width, destructive/ghost variant, label "Reset Loan", visible only after loan is created. Dispatches `RESET_LOAN` on click (FR-4)
  - [ ] 6.10 Add form validation — inline error messages below each field for: non-positive principal, rate out of range (0–100), amortization < 1 year, missing start date. Errors use text-error 12px, inputs show ring-2 ring-accent-error (ACCESS-7)
  - [ ] 6.11 On successful Create Loan — dispatch `CREATE_LOAN`, collapse Loan Setup accordion, expand Add Event accordion
  - [ ] 6.12 All inputs have explicit `<label>` elements with `htmlFor` matching input `id` (ACCESS-4)

- [ ] 7.0 Build Add Event panel (traces to: FR-5, FR-6, FR-13, FR-15, FR-16, FR-17, FR-18, DRD 6.3)
  - [ ] 7.1 Create `src/components/AddEvent.tsx` — accordion section content, disabled/muted until loan is created
  - [ ] 7.2 Add Event Type selector — Shadcn `Select` with four options: Payment, Additional Advance, Payment Reversal (NSF), Payoff
  - [ ] 7.3 Implement conditional field rendering based on selected event type:
    - Payment: date picker + amount input (pre-filled with monthly payment amount in dollars, editable)
    - Additional Advance: date picker + amount input
    - Payment Reversal: date picker + reversal target dropdown
    - Payoff: date picker only (defaults to today). Note: posting Payoff closes the loan — this is a terminal event, not a quote preview. The "Payoff Today" stat card is the live quote.
  - [ ] 7.4 Implement reversal dropdown — populated by `getReversibleEvents()` from replay.ts, displays each event as "Feb 01, 2026 — $1,493.56". Pre-populated when `selectedEventId` is set in app state (DRD 6.3, FR-13)
  - [ ] 7.5 Add Submit button — full width, accent-primary, disabled when required fields are empty. Label changes by event type: "Post Payment", "Post Advance", "Post Reversal", "Close Loan (Payoff)"
  - [ ] 7.6 On submit — dispatch `ADD_EVENT` with event amounts stored in dollars (form values passed directly), reset form fields to defaults
  - [ ] 7.7 Show post-payoff locked state — after a payoff event exists, disable the entire Add Event form and show message: "This loan has been paid off. No further events can be posted." (FR-18, DRD 7.5)
  - [ ] 7.8 Add amount inputs with $ prefix — accept decimal dollar input. Pass dollar value directly to the event (no cents conversion here — that happens in replay)
  - [ ] 7.9 All inputs have explicit `<label>` elements (ACCESS-4). Form errors shown as text below fields, not just colour (ACCESS-7)

- [ ] 8.0 Build Loan Ledger panel — stat cards + transaction table (traces to: FR-10, FR-11, FR-13, DRD 6.4, 6.5, 6.6, 6.7)
  - [ ] 8.1 Create `src/components/LoanLedger.tsx` — receives `ledgerState` and `loan` as props. `ledgerState` is computed in `App.tsx` via `useMemo(() => replayEvents(events, loan, convention), [events, loan, convention])` — never call `replayEvents` inside this component directly
  - [ ] 8.2 Build stat cards row — four equal-width cards in a flex row above the table: Outstanding Balance, Accrued Interest, Next Payment, Payoff Today. "Payoff Today" value comes from `calculatePayoffQuote(events, loan, convention, today)` called in App.tsx and passed as a prop — it is a live non-mutating quote, not the terminal payoff event (DRD 6.4, FR-16)
  - [ ] 8.3 Style stat cards — bg-elevated, border border-subtle, rounded-lg, p-4. Label: 12px text-secondary. Value: 22px font-semibold text-primary font-mono (DRD 6.4)
  - [ ] 8.4 Empty state for stat cards — show `—` in text-muted when no loan exists (DRD 7.5)
  - [ ] 8.5 Build ledger table using Shadcn `Table` component — semantic `<table>`, `<thead>`, `<tbody>`, `<th scope="col">` for column headers (ACCESS-6)
  - [ ] 8.6 Add table columns in order: Date, Type, Amount, Interest, Principal, Balance After — per DRD 6.5 column widths and alignment (right-align all monetary columns, left-align Date and Type)
  - [ ] 8.7 Format all monetary values as CAD currency using `fromCents()` from `lib/money.ts` in font-mono. If a row has `isNegativePrincipal: true`, render the principal cell in accent-error red to make the delinquent case immediately visible
  - [ ] 8.8 Format dates as "MMM DD, YYYY" using date-fns `format(parseISO(date), 'MMM dd, yyyy')`
  - [ ] 8.9 Implement event type badges — Shadcn `Badge` component with colour variants per DRD 6.6: funding (green/success), payment (indigo/primary), additional_advance (amber/warning), payoff (muted). For `payment_reversal` rows, compute the badge label dynamically at render time: look up the original event by `row.reversesEventId` in the events array, read its `date`, and format the badge as `"NSF Reversal · MMM DD, YYYY"` (e.g. "NSF Reversal · Feb 01, 2026") in accent-error red. For reversed original payment rows (`isReversed === true`), badge label is "Payment · NSF" in accent-error red.
  - [ ] 8.10 Implement reversed payment and reversal row display per DRD 6.7 — all rows are strictly in chronological date order (no reordering at display layer; `replayEvents` already returns rows by date). Original payment row when reversed (`isReversed === true`): `line-through opacity-50` on all cells, badge swaps to "Payment · NSF" (accent-error), `aria-label="Reversed payment"` on the `<tr>`. NSF Reversal row (`type === 'payment_reversal'`): 2px left border accent-error, Date cell is EMPTY (render an empty string — the reversal date is encoded in the type badge per DRD 6.7), Amount/Interest/Principal cells show `—`.
  - [ ] 8.11 Implement clickable payment rows — payment and additional_advance rows show pointer cursor on hover. Clicking dispatches `SELECT_EVENT` with the row's eventId, highlights the row with bg-active + 2px left border accent-primary. Clicking the same row again deselects. State lives in the reducer (`selectedEventId`) — not local useState (DRD 6.3, 7.3)
  - [ ] 8.12 Table row hover state — bg-hover on all rows, 44px row height (DRD 6.5)
  - [ ] 8.13 Sticky table header — stays visible when ledger scrolls. Table container is independently scrollable within its panel (DRD 6.5)
  - [ ] 8.14 Empty state for ledger — centered message "No events yet. Create a loan to get started." when events array is empty (DRD 7.5)
  - [ ] 8.15 Add `aria-live="polite"` to stat cards container so screen reader announces value changes after events (ACCESS, DRD 8)
  - [ ] 8.16 Add Actual/365 limitation note below ledger — small text-muted caption: "Interest calculated using Actual/365. Leap years use a fixed 365-day denominator." (FR-9)

- [ ] 9.0 Integration pass — verify all 7 key deliverables from the spec
  - [ ] 9.1 Deliverable 1: Create a loan ($250,000, 5.25%, 25 years, Jan 1 2026) — confirm funding row appears with correct opening balance
  - [ ] 9.2 Deliverable 2: Post Feb 1 payment — confirm interest/principal split is correct and balance_after reconciles. Cross-check: interest + principal = payment amount to the exact cent
  - [ ] 9.3 Deliverable 3: Post Mar 1 and Apr 1 payments — confirm interest portion decreases and principal portion increases each month
  - [ ] 9.4 Deliverable 4: Post an additional advance — confirm balance increases and subsequent payment interest accrues on the new higher balance
  - [ ] 9.5 Deliverable 5: Post a payment, then NSF it — confirm original row is struck through, reversal row appears, balance is restored to the exact cent. Post the next payment and confirm interest starts from the reversal date
  - [ ] 9.6 Deliverable 6: Generate payoff quote for today and a date 30 days later — confirm later date produces a higher quote. Confirm posting the Payoff event locks the form.
  - [ ] 9.7 Deliverable 7: Reset the loan and replay from scratch — confirm derived state matches what was shown before reset (proves state is derived, not mutated)
  - [ ] 9.8 Accessibility check — tab through all interactive elements, confirm focus rings are visible, all form labels are present, all errors are described in text
  - [ ] 9.9 Dark/light mode check — toggle theme, confirm all text meets contrast requirements in both modes, confirm no FOUC on page load
  - [ ] 9.10 Sidebar collapse check — collapse sidebar to icon rail, confirm ledger expands to fill space. Re-expand and confirm forms are accessible
  - [ ] 9.11 Self-review quality gate — re-read `lib/replay.ts` and `lib/interest.ts` against PRD success metrics SM-1 through SM-6. Verify: (a) interest + principal = payment to the cent on every row, (b) toggling convention back and forth produces identical figures, (c) NSF restores balance exactly. Fix any discrepancy before marking done.

- [ ] 10.0 Write NSF replay unit test ⚡ CORE — this proves the headline correctness claim the evaluators will check
  - [ ] 10.1 Install Vitest: `npm install -D vitest` and add `"test": "vitest run"` to `package.json` scripts
  - [ ] 10.2 Create `vitest.config.ts` — extend vite config, set environment to `node`
  - [ ] 10.3 Create `src/lib/__tests__/replay.test.ts` — write the full NSF scenario test: funding Jan 1 → payment Feb 1 → reversal Feb 8 → payment Mar 1. Assert balance after each event matches expected cents value to the exact cent (FR-22)
  - [ ] 10.4 Run `npx vitest run` — confirm NSF test passes with zero failures

---

### V1 — Stretch Goals (Complete if time allows)
> ⚡ Task 10.0 above (NSF replay test) is core, not stretch. Everything below is genuinely optional.

- [ ] 11.0 Add remaining Vitest unit tests
  - [ ] 11.1 Create `src/lib/__tests__/amortization.test.ts` — test `calculateMonthlyPaymentCents` with known inputs: $250,000, 5.25%, 25 years → assert expected cents result
  - [ ] 11.2 Create `src/lib/__tests__/interest.test.ts` — test `calculateInterestCents` for both Actual/365 and 30/360 conventions with known inputs. Test leap year edge case (Feb in a leap year, denominator stays 365)
  - [ ] 11.3 Add test for additional advance: fund → advance → payment. Assert balance increases correctly after advance and interest accrues on new balance
  - [ ] 11.4 Add test for payoff quote: confirm quote on day X is less than quote on day X+30
  - [ ] 11.5 Add test for partial payment (amount ≠ scheduled monthly payment): confirm interest/principal split still reconciles to the exact cent
  - [ ] 11.6 Run `npx vitest run` — confirm all tests pass

- [ ] 12.0 Implement day-count convention toggle (traces to: FR-19, FR-20, FR-21, DRD 6.8)
  - [ ] 12.1 Add `thirtyThreeSixtyDays(dateA: string, dateB: string): number` to `src/lib/daycount.ts` — formula: `(Y2-Y1)×360 + (M2-M1)×30 + (D2-D1)` per FR-20
  - [ ] 12.2 Add day-count toggle to `AppHeader.tsx` — segmented control showing "Actual/365 | 30/360". Active option: bg-active text-primary. Inactive: text-secondary (DRD 6.8)
  - [ ] 12.3 Wire toggle to dispatch `SET_CONVENTION` — confirm all ledger figures update immediately via the existing `useMemo` dependency on `convention` (FR-21)
  - [ ] 12.4 Update `calculatePayoffQuote` call in App.tsx to pass the active convention
  - [ ] 12.5 Add per-diem comparison display — below ledger or in stat cards area, show "Per diem (Actual/365): $35.96 | Per diem (30/360): $36.46" so the difference is visible (FR-21)
  - [ ] 12.6 Verify toggle by checking: same loan, both conventions produce different interest figures. Toggling back to Actual/365 restores original figures exactly.

---

### V2 — Stretch Goals (Future — do not block v1 delivery)

- [ ] 13.0 Add reversal guard — prevent reversing an already-reversed payment (traces to: PRD NG-5, prd-loan-ledger-v2.md section 7b)
  - [ ] 13.1 Implement `isAlreadyReversed(eventId: string, events: LoanEvent[]): boolean` in `src/lib/replay.ts`
  - [ ] 13.2 Call `isAlreadyReversed` in the `ADD_EVENT` reducer action before appending a `payment_reversal` — return state unchanged if already reversed
  - [ ] 13.3 Surface the error in `AddEvent.tsx` — show inline message "This payment has already been reversed"
  - [ ] 13.4 Filter already-reversed events out of the reversal dropdown
  - [ ] 13.5 Add unit test: attempt to reverse an already-reversed payment, assert state is unchanged

- [ ] 14.0 Add bi-weekly payment frequency support (traces to: PRD NG-2, prd-loan-ledger-v2.md section 7b)
  - [ ] 14.1 Add `'biweekly'` to the `frequency` field in the `Loan` type
  - [ ] 14.2 Implement `calculateBiweeklyPaymentCents` — `n = amortizationYears × 26`, bi-weekly rate derived from semi-annual compounding
  - [ ] 14.3 Enable Payment Frequency selector in Loan Setup to offer "Bi-weekly" option
  - [ ] 14.4 Update Add Event payment amount pre-fill to use bi-weekly amount when frequency is bi-weekly
  - [ ] 14.5 Verify replay handles bi-weekly correctly — day counts between events are ~14 days

- [ ] 15.0 Add escrow component to payment splits (traces to: PRD NG-3, prd-loan-ledger-v2.md section 7b)
  - [ ] 15.1 Add optional `escrowMonthlyCents: number` field to the `Loan` type
  - [ ] 15.2 Add Escrow input to Loan Setup form — optional, defaults to 0
  - [ ] 15.3 Add `escrowCents` field to `LedgerRow` type and `escrowBalanceCents` to `LedgerState`
  - [ ] 15.4 Update replay payment handler — split payment into interest + principal + escrow
  - [ ] 15.5 Add Escrow column to ledger table and Escrow Balance to stat cards

- [ ] 16.0 Add CSV/JSON ledger export (traces to: PRD NG-6, prd-loan-ledger-v2.md section 7b)
  - [ ] 16.1 Create `src/lib/export.ts` — implement `exportCSV(rows: LedgerRow[]): void` using browser Blob API
  - [ ] 16.2 Implement `exportJSON(events: LoanEvent[], loan: Loan): void` — exports full event list as JSON
  - [ ] 16.3 Add Export buttons to AppHeader or above ledger — "Export CSV" and "Export JSON", disabled when no events exist
  - [ ] 16.4 Verify downloaded files open correctly in Excel (CSV) and a text editor (JSON)
