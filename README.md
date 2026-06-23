# Loan Ledger

An in-memory, single-page web app that models a mortgage loan as an **event-sourced ledger**.
A loan starts with its terms (principal, rate, amortization, frequency), and from there a stream
of **events** — payments, advances, NSF reversals, payoff — drives everything. The current state
of the loan (outstanding balance, the transaction ledger, the payoff quote) is always **derived by
replaying the events**, never stored and mutated directly.

## Quick start

```bash
npm install
npm run dev      # start the dev server
npm test         # run the Vitest suite
npm run build    # type-check + production build
```

All state lives in memory — refreshing the page resets the loan, by design.

## Stack

- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** and **shadcn/Radix** primitives for styling
- **date-fns** for all date math (no native `Date` arithmetic)
- **Vitest** for unit tests

## Architecture

- **Single source of truth.** One `useReducer` in `App.tsx` holds the loan, the append-only
  event list, the active day-count convention, and the selected row. There is no scattered
  domain `useState` — component-level `useState` is reserved for ephemeral form/UI state.
- **Derived state.** `replayEvents()` (`src/lib/replay.ts`) is a pure function that walks the
  sorted event list and produces the full ledger and every summary figure. It's recomputed via
  `useMemo([events, loan, convention])`.
- **Append-only events.** Reversals and payoffs are *new events you append* — the reducer never
  mutates or deletes a prior event. This is what makes loan state a pure function of the log.

```
src/
  reducer/loanReducer.ts   # the only domain state; append-only event log
  lib/replay.ts            # replayEvents() — pure derivation of ledger + summaries
  lib/interest.ts          # day-count interest accrual (integer cents)
  lib/amortization.ts      # Canadian scheduled-payment formula
  lib/daycount.ts          # Actual/365 and 30/360 day counters
  lib/money.ts             # the single dollars <-> cents conversion boundary
  components/              # Loan setup, Add event, and the ledger table
```

## Interest math & day-count

Interest accrued between two events is:

```
interest = round(balanceCents * annualRate * days / denominator)
```

where:

- `balanceCents` — the outstanding **principal** balance in integer cents, at the start of the period (escrow is tracked separately and never accrues interest)
- `annualRate` — the nominal annual rate as a decimal (e.g. `0.0697` for 6.97%)
- `days` — the day count for the period, per the active convention (below)
- `denominator` — the convention's day basis: **365** or **360**

Two conventions are supported via a toggle (the summary footer shows the daily interest for both):

- **Actual/365** (default) — `days` = actual calendar days between the two event dates; denominator fixed at **365**.
- **30/360** — `days` per the 30/360 rule with ISDA end-of-month clamping; denominator **360**.

The scheduled payment uses the **Canadian** semi-annual-compounding convention:
`r = (1 + annualRate/2)^(1/6) − 1` for monthly (`^(1/13)` for bi-weekly).

## Assumptions & decisions

These are deliberate choices, not omissions:

- **Money is integer cents end to end.** Dollars are converted to cents once, at the top of each
  replay handler, and `Math.round()` is applied only at the final calculation step — intermediate
  values keep full float precision so the ledger reconciles to the penny.
- **Actual/365 ignores leap years.** The denominator is a fixed 365 regardless of the year; a Feb-29
  is simply an extra accrual day. This is a common, defensible servicing convention.
- **30/360 does not apply the Feb end-of-month adjustment.** 31-day months are normalized; the
  Jan-31 → Feb-28 ISDA special case is not. Noted in `daycount.ts`.
- **Interest accrues from the last *valid* event.** When two events share a date, array insertion
  order is the tiebreaker.
- **NSF reversal restores the balance exactly and resets the interest clock to *before* the bounced
  payment.** A reversal backs out the exact principal/interest/escrow recorded on the original row
  (no re-computation) and marks that row reversed but keeps it in the ledger. Because the payment
  never cleared, the next payment accrues interest across the full gap — which can legitimately
  produce **negative amortization** (interest exceeding the payment). Such rows are flagged, not
  rejected.
- **Only payments are reversible.** Advances and fundings cannot be NSF'd, and a payment cannot be
  reversed twice — the reducer guards against both.
- **Payoff is modeled two ways.** "Payoff Today" is a non-mutating quote shown in the summary
  (outstanding principal + interest accrued to today). A `payoff` *event* additionally closes the
  loan to a zero balance and is terminal — no events are accepted after it.
- **The scheduled payment is fixed at origination and is never re-amortized.** It's computed once
  from the original principal and term. An additional advance raises the balance but does *not*
  recalculate the payment, so a large advance can push the loan into sustained negative
  amortization (each payment fails to cover interest on the higher balance, and the shortfall
  capitalizes). This is deliberate — re-amortizing after a draw would be a separate loan-modification
  event we chose not to model.
- **Escrow is tracked separately.** When configured, escrow is collected on each payment into its
  own running balance and never reduces the loan principal.
- **Partial / overpayments are allowed.** A payment is split into interest first, principal second;
  the split always reconciles to the cent regardless of amount.

## Stretch goals implemented

Day-count convention toggle · escrow component · bi-weekly frequency · double-reversal guard ·
CSV/JSON export · unit tests proving an NSF reversal restores state exactly.
