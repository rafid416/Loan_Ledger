import { parseISO } from 'date-fns'
import type { DayCountConvention, LedgerRow, LedgerState, Loan, LoanEvent } from '@/types/loan'
import { toCents } from '@/lib/money'
import { daysFor } from '@/lib/daycount'
import { calculateInterestCents } from '@/lib/interest'

// Pure function — same inputs always produce the same ledger.
// asOfDate is the reference "today" for accrued-interest / payoff-today figures;
// the production caller (App.tsx) passes it explicitly so this function performs
// no clock reads of its own. The default exists only for convenience in tests
// that don't assert as-of-today figures.
// Called via useMemo([events, loan, convention, today]) in App.tsx.
export function replayEvents(
  events: LoanEvent[],
  loan: Loan,
  convention: DayCountConvention,
  asOfDate: string = new Date().toISOString().slice(0, 10),
): LedgerState {
  // Sort ascending by date. Stable sort preserves insertion order for same-date events.
  const sorted = [...events].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
  )

  // Mutable working state — only mutated inside this function.
  const rows: LedgerRow[] = []
  let balanceCents = 0
  let escrowBalanceCents = 0
  let lastEventDate = loan.startDate
  // Interest accrued on pre-advance balance sub-periods, carried forward to the next
  // payment or payoff. Each advance closes the prior sub-period into this accumulator.
  let pendingInterestCents = 0
  // Records, per payment id, the pending sub-period interest that payment swept when
  // applied (non-zero only when an advance preceded it). On reversal the value is
  // restored to pendingInterestCents so the advance interest is not lost when the
  // collecting payment is backed out. Empty for any loan without advances.
  const pendingConsumedByEventId = new Map<string, number>()

  for (const event of sorted) {
    switch (event.type) {
      case 'funding': {
        // 3.5 — opening balance; no interest or principal split on day 1
        balanceCents = toCents(event.amount)
        lastEventDate = event.date
        rows.push({
          eventId: event.id,
          date: event.date,
          type: 'funding',
          amountCents: balanceCents,
          interestCents: 0,
          principalCents: balanceCents,
          escrowCents: 0,
          balanceAfterCents: balanceCents,
          isReversed: false,
          reversedByEventId: null,
          reversesEventId: null,
          isNegativePrincipal: false,
        })
        break
      }

      case 'payment': {
        // 3.6 — interest = pending sub-periods (from advances) + current period.
        // Pending is non-zero when advances occurred since the last payment or funding.
        const days = daysFor(lastEventDate, event.date, convention)
        const interestCents = pendingInterestCents + calculateInterestCents(balanceCents, loan.annualRate, days, convention)
        // Record the pending the payment consumed so a reversal can restore it.
        if (pendingInterestCents !== 0) pendingConsumedByEventId.set(event.id, pendingInterestCents)
        pendingInterestCents = 0

        const escrowCents = loan.frequency === 'biweekly'
          ? Math.round(loan.escrowMonthlyCents * 12 / 26)
          : loan.escrowMonthlyCents
        const paymentCents = toCents(event.amount)
        const principalCents = paymentCents - interestCents - escrowCents
        balanceCents = balanceCents - principalCents
        escrowBalanceCents = escrowBalanceCents + escrowCents
        lastEventDate = event.date
        rows.push({
          eventId: event.id,
          date: event.date,
          type: 'payment',
          amountCents: paymentCents,
          interestCents,
          principalCents,
          escrowCents,
          balanceAfterCents: balanceCents,
          isReversed: false,
          reversedByEventId: null,
          reversesEventId: null,
          // Flag when interest+escrow exceeds payment — deeply delinquent; do not throw (PRD OQ-4)
          isNegativePrincipal: principalCents < 0,
        })
        break
      }

      case 'additional_advance': {
        // 3.7 — closes the prior sub-period into pendingInterestCents before raising the balance.
        // This ensures the next payment collects interest across every balance step:
        //   sub-period 1: lastEventDate → advance date on pre-advance balance → pending
        //   sub-period 2: advance date → payment date on post-advance balance → collected at payment
        // Multiple sequential advances each append their own sub-period to the accumulator.
        const days = daysFor(lastEventDate, event.date, convention)
        pendingInterestCents += calculateInterestCents(balanceCents, loan.annualRate, days, convention)

        const advanceCents = toCents(event.amount)
        balanceCents = balanceCents + advanceCents
        lastEventDate = event.date
        rows.push({
          eventId: event.id,
          date: event.date,
          type: 'additional_advance',
          amountCents: advanceCents,
          interestCents: 0,
          principalCents: 0,
          escrowCents: 0,
          balanceAfterCents: balanceCents,
          isReversed: false,
          reversedByEventId: null,
          reversesEventId: null,
          isNegativePrincipal: false,
        })
        break
      }

      case 'payment_reversal': {
        // 3.8 — backs out the EXACT cents from the original payment row.
        // Only payments are reversible (advances are not NSF-able).
        // Finds the original row by reversesEventId. Marks original isReversed = true.
        // Interest clock resets to the last VALID event before the reversed payment —
        // the payment never cleared, so interest continues accruing from the last event
        // that actually established the balance.
        // Any pendingInterest from advances that accrued between the payment and this
        // reversal is cleared: the clock resets to before the payment anyway.
        const originalRowIndex = rows.findIndex(r => r.eventId === event.reversesEventId)
        if (originalRowIndex === -1) break // guard: original not found

        const originalRow = rows[originalRowIndex]
        // Mark original row reversed
        originalRow.isReversed = true
        originalRow.reversedByEventId = event.id

        // Restore balance and escrow from the exact principal/escrow recorded on the row
        balanceCents = balanceCents + originalRow.principalCents
        escrowBalanceCents = escrowBalanceCents - originalRow.escrowCents
        // Restore any advance sub-period interest the reversed payment had swept. The
        // clock resets to before the payment (below), so this pending is re-collected
        // by the next payment instead of being silently dropped. 0 for the common
        // (no preceding advance) case, making this a no-op there.
        pendingInterestCents = pendingConsumedByEventId.get(event.reversesEventId) ?? 0

        // Walk back to the last event that actually established the balance, skipping
        // prior reversal rows (administrative markers, no balance impact) and already-
        // reversed payments (voided). Without this, two NSFs in a row would leave a
        // reversal row as the immediate predecessor and wrongly restart the interest
        // clock at the reversal date instead of the last cleared payment.
        let walkIndex = originalRowIndex - 1
        while (
          walkIndex >= 0 &&
          (rows[walkIndex].type === 'payment_reversal' || rows[walkIndex].isReversed)
        ) {
          walkIndex--
        }
        lastEventDate = walkIndex >= 0 ? rows[walkIndex].date ?? loan.startDate : loan.startDate

        rows.push({
          eventId: event.id,
          date: event.date,
          type: 'payment_reversal',
          amountCents: 0,
          interestCents: 0,
          principalCents: 0,
          escrowCents: 0,
          balanceAfterCents: balanceCents,
          isReversed: false,
          reversedByEventId: null,
          reversesEventId: event.reversesEventId,
          isNegativePrincipal: false,
        })
        break
      }

      case 'payoff': {
        // 3.9 — interest = pending sub-periods (from advances) + current period; then balance → 0.
        const days = daysFor(lastEventDate, event.date, convention)
        const interestCents = pendingInterestCents + calculateInterestCents(balanceCents, loan.annualRate, days, convention)
        pendingInterestCents = 0

        const totalPayoffCents = balanceCents + interestCents
        balanceCents = 0
        lastEventDate = event.date
        rows.push({
          eventId: event.id,
          date: event.date,
          type: 'payoff',
          amountCents: totalPayoffCents,
          interestCents,
          principalCents: totalPayoffCents - interestCents,
          escrowCents: 0,
          balanceAfterCents: 0,
          isReversed: false,
          reversedByEventId: null,
          reversesEventId: null,
          isNegativePrincipal: false,
        })
        break
      }
    }
  }

  // Accrued interest = what would be owed if a payment were made right now.
  // Includes any pending sub-period interest from advances since the last payment.
  // Only meaningful if loan is open (no payoff event).
  const isPaidOff = events.some(e => e.type === 'payoff')
  const daysToToday = Math.max(0, daysFor(lastEventDate, asOfDate, convention))
  const accruedInterestCents = isPaidOff
    ? 0
    : pendingInterestCents + calculateInterestCents(balanceCents, loan.annualRate, daysToToday, convention)

  return {
    rows,
    currentBalanceCents: balanceCents,
    accruedInterestCents,
    payoffTodayCents: balanceCents + accruedInterestCents,
    escrowBalanceCents,
    lastEventDate,
    pendingInterestCents,
  }
}

// 3.10 — Non-mutating payoff quote as of any date.
// Used by the "Payoff Today" stat card. Does NOT post an event.
// Includes any pending sub-period interest from advances since the last payment.
export function calculatePayoffQuote(
  events: LoanEvent[],
  loan: Loan,
  convention: DayCountConvention,
  asOfDate: string,
): number {
  // Forward asOfDate so the internal replay performs no clock read either; the
  // quote is computed below from lastEventDate/balance, independent of the as-of figures.
  const state = replayEvents(events, loan, convention, asOfDate)
  if (state.currentBalanceCents === 0) return 0

  const days = Math.max(0, daysFor(state.lastEventDate, asOfDate, convention))
  const interestCents = state.pendingInterestCents + calculateInterestCents(
    state.currentBalanceCents,
    loan.annualRate,
    days,
    convention,
  )
  return state.currentBalanceCents + interestCents
}

// 13.1 — True if the given eventId has already been reversed by a payment_reversal event.
export function isAlreadyReversed(eventId: string, events: LoanEvent[]): boolean {
  return events.some(e => e.type === 'payment_reversal' && e.reversesEventId === eventId)
}

// 3.11 — Returns payment events eligible for reversal (not already reversed).
// Only payments are reversible — advances do not NSF.
export function getReversibleEvents(
  events: LoanEvent[],
): Extract<LoanEvent, { type: 'payment' }>[] {
  const reversedIds = new Set(
    events
      .filter((e): e is Extract<LoanEvent, { type: 'payment_reversal' }> => e.type === 'payment_reversal')
      .map(e => e.reversesEventId),
  )
  return events.filter(
    (e): e is Extract<LoanEvent, { type: 'payment' }> =>
      e.type === 'payment' && !reversedIds.has(e.id),
  )
}
