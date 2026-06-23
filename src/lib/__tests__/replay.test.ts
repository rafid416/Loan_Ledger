import { describe, it, expect } from 'vitest'
import { replayEvents, getReversibleEvents, calculatePayoffQuote, isAlreadyReversed } from '@/lib/replay'
import { loanReducer, initialState } from '@/reducer/loanReducer'
import type { Loan, LoanEvent } from '@/types/loan'

// Reference loan: $250,000 @ 5.25% / 25yr / monthly / Jan 1 2026
const LOAN: Loan = {
  principal: 250000,
  annualRate: 0.0525,
  amortizationYears: 25,
  frequency: 'monthly',
  startDate: '2026-01-01',
  monthlyPaymentCents: 148980, // $1,489.80 — Canadian semi-annual compounding
}

const CONVENTION = 'actual365' as const

// ---------------------------------------------------------------------------
// NSF reversal scenario — the core evaluator test
//
// Timeline:
//   Jan 01 — Funding  $250,000.00
//   Feb 01 — Payment  $1,489.80   (31 days of interest)
//   Feb 08 — NSF reversal of Feb 01 payment
//   Mar 01 — Payment  $1,489.80   (21 days of interest from Feb 08)
//
// Key assertions:
//   1. Each payment: interest + principal = payment to the exact cent
//   2. NSF restores balance to EXACTLY $250,000.00 (original opening balance)
//   3. Mar 01 interest runs from Feb 08 (21 days), not Feb 01 (28 days)
//   4. Original Feb 01 row is marked isReversed=true
// ---------------------------------------------------------------------------

describe('replayEvents — NSF reversal scenario', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund',    type: 'funding',          date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay1',   type: 'payment',           date: '2026-02-01', amount: 1489.80 },
    { id: 'ev-nsf',    type: 'payment_reversal',  date: '2026-02-08', reversesEventId: 'ev-pay1' },
    { id: 'ev-pay2',   type: 'payment',           date: '2026-03-01', amount: 1489.80 },
  ]

  const state = replayEvents(events, LOAN, CONVENTION)
  const { rows } = state

  it('produces 4 ledger rows in chronological order', () => {
    expect(rows).toHaveLength(4)
    expect(rows[0].type).toBe('funding')
    expect(rows[1].type).toBe('payment')
    expect(rows[2].type).toBe('payment_reversal')
    expect(rows[3].type).toBe('payment')
  })

  describe('Jan 01 — funding row', () => {
    const row = rows[0]
    it('opening balance = 25,000,000 cents', () => {
      expect(row.balanceAfterCents).toBe(25_000_000)
    })
    it('amount = 25,000,000 cents', () => {
      expect(row.amountCents).toBe(25_000_000)
    })
    it('is not reversed', () => {
      expect(row.isReversed).toBe(false)
    })
  })

  describe('Feb 01 — payment row (31 days from Jan 01)', () => {
    const row = rows[1]
    // Actual/365: Math.round(25_000_000 * 0.0525 / 365 * 31) = 111,473
    it('interest = 111,473 cents ($1,114.73)', () => {
      expect(row.interestCents).toBe(111_473)
    })
    // principal = payment - interest = 148,980 - 111,473 = 37,507
    it('principal = 37,507 cents ($375.07)', () => {
      expect(row.principalCents).toBe(37_507)
    })
    it('interest + principal = payment to the exact cent', () => {
      expect(row.interestCents + row.principalCents).toBe(row.amountCents)
    })
    // balance = 25,000,000 - 37,507 = 24,962,493
    it('balance after = 24,962,493 cents ($249,624.93)', () => {
      expect(row.balanceAfterCents).toBe(24_962_493)
    })
    it('is marked isReversed after the NSF event is processed', () => {
      expect(row.isReversed).toBe(true)
    })
    it('reversedByEventId points to the NSF event', () => {
      expect(row.reversedByEventId).toBe('ev-nsf')
    })
  })

  describe('Feb 08 — NSF reversal row', () => {
    const row = rows[2]
    it('balance restored to exactly 25,000,000 cents ($250,000.00)', () => {
      // The reversal adds back the EXACT principalCents from the original row,
      // restoring the balance to the pre-payment amount without re-computing anything.
      expect(row.balanceAfterCents).toBe(25_000_000)
    })
    it('reversal row amount/interest/principal are all 0', () => {
      expect(row.amountCents).toBe(0)
      expect(row.interestCents).toBe(0)
      expect(row.principalCents).toBe(0)
    })
    it('reversesEventId points to the original payment', () => {
      expect(row.reversesEventId).toBe('ev-pay1')
    })
    it('reversal row itself is not reversed', () => {
      expect(row.isReversed).toBe(false)
    })
    it('date is the reversal date (Feb 08)', () => {
      expect(row.date).toBe('2026-02-08')
    })
  })

  describe('Mar 01 — payment row (21 days from Feb 08, not 28 days from Feb 01)', () => {
    const row = rows[3]
    // Actual/365: Math.round(25_000_000 * 0.0525 / 365 * 21) = 75,514
    it('interest = 75,514 cents ($755.14) — 21 days from Feb 08', () => {
      expect(row.interestCents).toBe(75_514)
    })
    // principal = 148,980 - 75,514 = 73,466
    it('principal = 73,466 cents ($734.66)', () => {
      expect(row.principalCents).toBe(73_466)
    })
    it('interest + principal = payment to the exact cent', () => {
      expect(row.interestCents + row.principalCents).toBe(row.amountCents)
    })
    // balance = 25,000,000 - 73,466 = 24,926,534
    it('balance after = 24,926,534 cents ($249,265.34)', () => {
      expect(row.balanceAfterCents).toBe(24_926_534)
    })
    it('is not reversed', () => {
      expect(row.isReversed).toBe(false)
    })
  })

  describe('final ledger state', () => {
    it('currentBalanceCents = 24,926,534', () => {
      expect(state.currentBalanceCents).toBe(24_926_534)
    })
    it('Mar 01 interest would be higher if window ran from Feb 01 (28 days)', () => {
      // 28-day interest would be: Math.round(25_000_000 * 0.0525 / 365 * 28) = 100,685
      // Actual 21-day interest is 75,514 — proves clock reset to reversal date
      const hypothetical28DayInterest = Math.round(25_000_000 * 0.0525 / 365 * 28)
      expect(hypothetical28DayInterest).toBe(100_685)
      expect(rows[3].interestCents).toBeLessThan(hypothetical28DayInterest)
    })
  })
})

// ---------------------------------------------------------------------------
// getReversibleEvents — filters out already-reversed payments
// ---------------------------------------------------------------------------

describe('getReversibleEvents', () => {
  it('excludes payments that have been reversed', () => {
    const events: LoanEvent[] = [
      { id: 'ev-fund',  type: 'funding',         date: '2026-01-01', amount: 250000 },
      { id: 'ev-pay1', type: 'payment',           date: '2026-02-01', amount: 1489.80 },
      { id: 'ev-nsf',  type: 'payment_reversal', date: '2026-02-08', reversesEventId: 'ev-pay1' },
      { id: 'ev-pay2', type: 'payment',           date: '2026-03-01', amount: 1489.80 },
    ]
    const reversible = getReversibleEvents(events)
    expect(reversible).toHaveLength(1)
    expect(reversible[0].id).toBe('ev-pay2')
  })

  it('returns all payments and advances when none are reversed', () => {
    const events: LoanEvent[] = [
      { id: 'ev-fund',  type: 'funding',          date: '2026-01-01', amount: 250000 },
      { id: 'ev-pay1', type: 'payment',            date: '2026-02-01', amount: 1489.80 },
      { id: 'ev-adv',  type: 'additional_advance', date: '2026-02-15', amount: 5000 },
    ]
    const reversible = getReversibleEvents(events)
    expect(reversible).toHaveLength(2)
  })

  it('excludes funding events (not reversible)', () => {
    const events: LoanEvent[] = [
      { id: 'ev-fund', type: 'funding', date: '2026-01-01', amount: 250000 },
    ]
    const reversible = getReversibleEvents(events)
    expect(reversible).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Replay is a pure function — same inputs always produce the same output
// ---------------------------------------------------------------------------

describe('replayEvents — pure function', () => {
  it('produces identical results on repeated calls with the same inputs', () => {
    const events: LoanEvent[] = [
      { id: 'ev-fund',  type: 'funding', date: '2026-01-01', amount: 250000 },
      { id: 'ev-pay1', type: 'payment',  date: '2026-02-01', amount: 1489.80 },
    ]
    const result1 = replayEvents(events, LOAN, CONVENTION)
    const result2 = replayEvents(events, LOAN, CONVENTION)
    expect(result1.currentBalanceCents).toBe(result2.currentBalanceCents)
    expect(result1.rows[1].interestCents).toBe(result2.rows[1].interestCents)
    expect(result1.rows[1].principalCents).toBe(result2.rows[1].principalCents)
  })

  it('sorts events by date regardless of insertion order', () => {
    const eventsOutOfOrder: LoanEvent[] = [
      { id: 'ev-pay1', type: 'payment', date: '2026-02-01', amount: 1489.80 },
      { id: 'ev-fund', type: 'funding', date: '2026-01-01', amount: 250000 },
    ]
    const eventsInOrder: LoanEvent[] = [
      { id: 'ev-fund', type: 'funding', date: '2026-01-01', amount: 250000 },
      { id: 'ev-pay1', type: 'payment', date: '2026-02-01', amount: 1489.80 },
    ]
    const r1 = replayEvents(eventsOutOfOrder, LOAN, CONVENTION)
    const r2 = replayEvents(eventsInOrder, LOAN, CONVENTION)
    expect(r1.currentBalanceCents).toBe(r2.currentBalanceCents)
    expect(r1.rows[0].type).toBe('funding')
    expect(r1.rows[1].type).toBe('payment')
  })
})

// ---------------------------------------------------------------------------
// Additional advance scenario (task 11.3)
//
// fund $200,000 Jan 01 → advance $50,000 Feb 01 → payment Mar 01
// Advance has no interest/principal split; payment interest accrues on the
// new higher balance from the advance date.
// ---------------------------------------------------------------------------

describe('replayEvents — additional advance', () => {
  const LOAN_200K: Loan = {
    principal: 200000,
    annualRate: 0.0525,
    amortizationYears: 25,
    frequency: 'monthly',
    startDate: '2026-01-01',
    monthlyPaymentCents: 148980,
  }

  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding',          date: '2026-01-01', amount: 200000 },
    { id: 'ev-adv',  type: 'additional_advance', date: '2026-02-01', amount: 50000 },
    { id: 'ev-pay',  type: 'payment',           date: '2026-03-01', amount: 1489.80 },
  ]

  const state = replayEvents(events, LOAN_200K, CONVENTION)
  const { rows } = state

  it('advance row: balance increases by advance amount', () => {
    // Before: 20,000,000. After: 20,000,000 + 5,000,000 = 25,000,000
    expect(rows[1].balanceAfterCents).toBe(25_000_000)
  })

  it('advance row: interest and principal are 0', () => {
    expect(rows[1].interestCents).toBe(0)
    expect(rows[1].principalCents).toBe(0)
  })

  it('payment row: interest accrues on the higher post-advance balance', () => {
    // 28 days from Feb 01 to Mar 01, balance = 25,000,000
    // Math.round(25_000_000 × 0.0525 × 28 / 365) = 100,685
    expect(rows[2].interestCents).toBe(100_685)
  })

  it('payment row: interest + principal = payment to the cent', () => {
    expect(rows[2].interestCents + rows[2].principalCents).toBe(rows[2].amountCents)
  })
})

// ---------------------------------------------------------------------------
// Payoff quote (task 11.4)
// ---------------------------------------------------------------------------

describe('calculatePayoffQuote', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay',  type: 'payment', date: '2026-02-01', amount: 1489.80 },
  ]

  it('quote on a later date is higher than an earlier date', () => {
    const q30 = calculatePayoffQuote(events, LOAN, CONVENTION, '2026-03-03')
    const q60 = calculatePayoffQuote(events, LOAN, CONVENTION, '2026-04-02')
    expect(q60).toBeGreaterThan(q30)
  })

  it('quote equals balance when asOfDate = last event date (0 days accrued)', () => {
    const balance = replayEvents(events, LOAN, CONVENTION).currentBalanceCents
    const quote = calculatePayoffQuote(events, LOAN, CONVENTION, '2026-02-01')
    expect(quote).toBe(balance)
  })

  it('quote is 0 when loan is already paid off', () => {
    const paidOffEvents: LoanEvent[] = [
      { id: 'ev-fund',   type: 'funding', date: '2026-01-01', amount: 250000 },
      { id: 'ev-payoff', type: 'payoff',  date: '2026-02-01' },
    ]
    const quote = calculatePayoffQuote(paidOffEvents, LOAN, CONVENTION, '2026-02-01')
    expect(quote).toBe(0)
  })

  it('quote is clamped to 0 when asOfDate is before last event date', () => {
    // asOfDate Jan 15, but last event is Feb 01 — days = negative → clamped to 0
    const balance = replayEvents(events, LOAN, CONVENTION).currentBalanceCents
    const quote = calculatePayoffQuote(events, LOAN, CONVENTION, '2026-01-15')
    expect(quote).toBe(balance)
  })
})

// ---------------------------------------------------------------------------
// Partial payment (task 11.5)
//
// A payment below the scheduled monthly amount still reconciles
// interest + principal = payment to the exact cent.
// ---------------------------------------------------------------------------

describe('replayEvents — partial payment', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay',  type: 'payment', date: '2026-02-01', amount: 500 }, // partial: $500 only
  ]

  const state = replayEvents(events, LOAN, CONVENTION)
  const row = state.rows[1]

  it('interest + principal = payment amount to the exact cent', () => {
    expect(row.interestCents + row.principalCents).toBe(row.amountCents)
  })

  it('principal is negative when payment is less than accrued interest (isNegativePrincipal)', () => {
    // Payment = 50,000 cents. Interest for 31 days = 111,473 cents.
    // Principal = 50,000 - 111,473 = -61,473 → balance INCREASES
    expect(row.principalCents).toBeLessThan(0)
    expect(row.isNegativePrincipal).toBe(true)
  })

  it('balance increases when payment does not cover interest', () => {
    expect(state.currentBalanceCents).toBeGreaterThan(25_000_000)
  })
})

// ---------------------------------------------------------------------------
// isAlreadyReversed + reversal guard (task 13)
// ---------------------------------------------------------------------------

describe('isAlreadyReversed', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding',          date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay1', type: 'payment',           date: '2026-02-01', amount: 1489.80 },
    { id: 'ev-nsf',  type: 'payment_reversal',  date: '2026-02-08', reversesEventId: 'ev-pay1' },
    { id: 'ev-pay2', type: 'payment',           date: '2026-03-01', amount: 1489.80 },
  ]

  it('returns true for a payment that has been reversed', () => {
    expect(isAlreadyReversed('ev-pay1', events)).toBe(true)
  })

  it('returns false for a payment that has not been reversed', () => {
    expect(isAlreadyReversed('ev-pay2', events)).toBe(false)
  })

  it('returns false for an unknown event id', () => {
    expect(isAlreadyReversed('ev-unknown', events)).toBe(false)
  })
})

describe('reversal guard — reducer blocks double-reversal (task 13.2)', () => {
  it('state is unchanged (same reference) when attempting to reverse an already-reversed payment', () => {
    // Step 1: create loan (appends funding event automatically)
    const state1 = loanReducer(initialState, {
      type: 'CREATE_LOAN',
      payload: {
        principal: 250000,
        annualRate: 0.0525,
        amortizationYears: 25,
        frequency: 'monthly',
        startDate: '2026-01-01',
      },
    })

    // Step 2: post a payment
    const state2 = loanReducer(state1, {
      type: 'ADD_EVENT',
      payload: { type: 'payment', date: '2026-02-01', amount: 1489.80 },
    })
    const paymentId = state2.events[1].id

    // Step 3: reverse it — first reversal should succeed (events grows to 3)
    const state3 = loanReducer(state2, {
      type: 'ADD_EVENT',
      payload: { type: 'payment_reversal', date: '2026-02-08', reversesEventId: paymentId },
    })
    expect(state3.events).toHaveLength(3)

    // Step 4: attempt to reverse the same payment again — state must be unchanged
    const state4 = loanReducer(state3, {
      type: 'ADD_EVENT',
      payload: { type: 'payment_reversal', date: '2026-02-10', reversesEventId: paymentId },
    })
    expect(state4.events).toHaveLength(3)
    // Same object reference proves the reducer returned early without creating a new state
    expect(state4).toBe(state3)
  })
})
