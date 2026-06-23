import { parseISO } from 'date-fns'
import type { DayCountConvention, LedgerRow, LedgerState, Loan, LoanEvent } from '@/types/loan'
import { toCents } from '@/lib/money'
import { daysFor } from '@/lib/daycount'
import { calculateInterestCents } from '@/lib/interest'

// Pure function — same inputs always produce the same ledger.
// Called via useMemo([events, loan, convention]) in App.tsx.
export function replayEvents(
  events: LoanEvent[],
  loan: Loan,
  convention: DayCountConvention,
): LedgerState {
  // Sort ascending by date. Stable sort preserves insertion order for same-date events.
  const sorted = [...events].sort(
    (a, b) => parseISO(a.date ?? '').getTime() - parseISO(b.date ?? '').getTime(),
  )

  // Mutable working state — only mutated inside this function.
  const rows: LedgerRow[] = []
  let balanceCents = 0
  let escrowBalanceCents = 0
  let lastEventDate = loan.startDate

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
        // 3.6 — interest accrues from last event date to this payment date
        // Payment splits: interest + escrow + principal. Escrow does not reduce loan balance.
        const days = daysFor(lastEventDate, event.date, convention)
        const interestCents = calculateInterestCents(balanceCents, loan.annualRate, days, convention)
        const escrowCents = loan.escrowMonthlyCents
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
        // 3.7 — increases balance; no interest/principal split on an advance
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
        // Finds the original row by reversesEventId. Marks original isReversed = true.
        // Interest window for subsequent events starts from the reversal date.
        const originalRow = rows.find(r => r.eventId === event.reversesEventId)
        if (!originalRow) break // guard: original already removed or id wrong

        // Mark original row reversed
        originalRow.isReversed = true
        originalRow.reversedByEventId = event.id

        // Restore balance by reversing the exact principal that was applied.
        // Also back out the exact escrow that was collected.
        balanceCents = balanceCents + originalRow.principalCents
        escrowBalanceCents = escrowBalanceCents - originalRow.escrowCents
        lastEventDate = event.date

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
        // 3.9 — interest accrues from last event to payoff date; then balance goes to zero
        const days = daysFor(lastEventDate, event.date, convention)
        const interestCents = calculateInterestCents(balanceCents, loan.annualRate, days, convention)
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

  // Accrued interest = interest that would accrue today if a payment were made right now.
  // Only meaningful if loan is open (no payoff event).
  const isPayedOff = events.some(e => e.type === 'payoff')
  const daysToToday = Math.max(0, daysFor(lastEventDate, new Date().toISOString().slice(0, 10), convention))
  const accruedInterestCents = isPayedOff
    ? 0
    : calculateInterestCents(balanceCents, loan.annualRate, daysToToday, convention)

  return {
    rows,
    currentBalanceCents: balanceCents,
    accruedInterestCents,
    payoffTodayCents: balanceCents + accruedInterestCents,
    escrowBalanceCents,
  }
}

// 3.10 — Non-mutating payoff quote as of any date.
// Used by the "Payoff Today" stat card. Does NOT post an event.
export function calculatePayoffQuote(
  events: LoanEvent[],
  loan: Loan,
  convention: DayCountConvention,
  asOfDate: string,
): number {
  const state = replayEvents(events, loan, convention)
  if (state.currentBalanceCents === 0) return 0

  const lastRow = state.rows[state.rows.length - 1]
  const lastDate = lastRow?.date ?? loan.startDate
  const days = Math.max(0, daysFor(lastDate, asOfDate, convention))
  const interestCents = calculateInterestCents(
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

// 3.11 — Returns events eligible for reversal: payments and advances not yet reversed.
export function getReversibleEvents(events: LoanEvent[]): LoanEvent[] {
  const reversedIds = new Set(
    events
      .filter((e): e is Extract<LoanEvent, { type: 'payment_reversal' }> => e.type === 'payment_reversal')
      .map(e => e.reversesEventId),
  )
  return events.filter(
    e => (e.type === 'payment' || e.type === 'additional_advance') && !reversedIds.has(e.id),
  )
}
