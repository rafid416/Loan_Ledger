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
  scheduledPaymentCents: 148980, // $1,489.80 — Canadian semi-annual compounding
  escrowMonthlyCents: 0,
}

const CONVENTION = 'actual365' as const

// ---------------------------------------------------------------------------
// NSF reversal scenario — the core evaluator test
//
// Timeline:
//   Jan 01 — Funding  $250,000.00
//   Feb 01 — Payment  $1,489.80   (31 days of interest)
//   Feb 08 — NSF reversal of Feb 01 payment
//   Mar 01 — Payment  $1,489.80   (59 days of interest from Jan 01)
//
// Key assertions:
//   1. Each payment: interest + principal = payment to the exact cent
//   2. NSF restores balance to EXACTLY $250,000.00 (original opening balance)
//   3. Mar 01 interest runs from Jan 01 (59 days) — payment never cleared, clock resets to last valid event
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

  describe('Mar 01 — payment row (59 days from Jan 01 — NSF means payment never cleared)', () => {
    const row = rows[3]
    // Actual/365: Math.round(25_000_000 * 0.0525 / 365 * 59) = 212,158
    it('interest = 212,158 cents ($2,121.58) — 59 days from Jan 01', () => {
      expect(row.interestCents).toBe(212_158)
    })
    // principal = 148,980 - 212,158 = -63,178 (negative amortization)
    it('principal = -63,178 cents (negative amortization — interest exceeds payment)', () => {
      expect(row.principalCents).toBe(-63_178)
    })
    it('interest + principal = payment to the exact cent', () => {
      expect(row.interestCents + row.principalCents).toBe(row.amountCents)
    })
    // balance = 25,000,000 - (-63,178) = 25,063,178 (increases due to negative amortization)
    it('balance after = 25,063,178 cents ($250,631.78) — balance grows due to negative amortization', () => {
      expect(row.balanceAfterCents).toBe(25_063_178)
    })
    it('isNegativePrincipal = true — interest exceeds the payment amount', () => {
      expect(row.isNegativePrincipal).toBe(true)
    })
    it('is not reversed', () => {
      expect(row.isReversed).toBe(false)
    })
  })

  describe('final ledger state', () => {
    it('currentBalanceCents = 25,063,178 — balance grew due to negative amortization after NSF', () => {
      expect(state.currentBalanceCents).toBe(25_063_178)
    })
    it('Mar 01 interest runs from last valid event (Jan 01, 59 days) — not original payment or reversal date', () => {
      const days59Interest = Math.round(25_000_000 * 0.0525 / 365 * 59) // from Jan 01 (correct)
      const days28Interest = Math.round(25_000_000 * 0.0525 / 365 * 28) // from Feb 01 (wrong)
      const days21Interest = Math.round(25_000_000 * 0.0525 / 365 * 21) // from Feb 08 (wrong)
      expect(days59Interest).toBe(212_158)
      expect(rows[3].interestCents).toBe(days59Interest)
      expect(rows[3].interestCents).toBeGreaterThan(days28Interest)
      expect(rows[3].interestCents).toBeGreaterThan(days21Interest)
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

  it('returns only payments — advances are not reversible', () => {
    const events: LoanEvent[] = [
      { id: 'ev-fund',  type: 'funding',          date: '2026-01-01', amount: 250000 },
      { id: 'ev-pay1', type: 'payment',            date: '2026-02-01', amount: 1489.80 },
      { id: 'ev-adv',  type: 'additional_advance', date: '2026-02-15', amount: 5000 },
    ]
    const reversible = getReversibleEvents(events)
    expect(reversible).toHaveLength(1)
    expect(reversible[0].id).toBe('ev-pay1')
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
    scheduledPaymentCents: 148980,
    escrowMonthlyCents: 0,
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

  it('payment row: interest spans both sub-periods (Jan 01→Feb 01 on 20M, Feb 01→Mar 01 on 25M)', () => {
    // Sub-period 1: Jan 01 → Feb 01, 31 days, balance = 20,000,000 (pre-advance)
    // Math.round(20_000_000 × 0.0525 × 31 / 365) = 89,178
    // Sub-period 2: Feb 01 → Mar 01, 28 days, balance = 25,000,000 (post-advance)
    // Math.round(25_000_000 × 0.0525 × 28 / 365) = 100,685
    // Total = 189,863
    expect(rows[2].interestCents).toBe(189_863)
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

  it('quote equals current balance when asOfDate is before last event date (accrued days clamped to 0)', () => {
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

// ---------------------------------------------------------------------------
// Bi-weekly frequency (task 14.5)
//
// $250,000 @ 5.25% / 25yr / bi-weekly / Jan 01 2026
// Jan 01 → funding
// Jan 15 → payment $686.80  (14 days of interest)
// Jan 29 → payment $686.80  (14 days of interest on lower balance)
// ---------------------------------------------------------------------------

describe('replayEvents — bi-weekly payments', () => {
  const BIWEEKLY_LOAN: Loan = {
    principal: 250000,
    annualRate: 0.0525,
    amortizationYears: 25,
    frequency: 'biweekly',
    startDate: '2026-01-01',
    scheduledPaymentCents: 68_680,
    escrowMonthlyCents: 0,
  }

  const events: LoanEvent[] = [
    { id: 'ev-fund',  type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay1', type: 'payment',  date: '2026-01-15', amount: 686.80 },
    { id: 'ev-pay2', type: 'payment',  date: '2026-01-29', amount: 686.80 },
  ]

  const state = replayEvents(events, BIWEEKLY_LOAN, CONVENTION)
  const { rows } = state

  it('produces 3 ledger rows', () => {
    expect(rows).toHaveLength(3)
  })

  describe('Jan 15 payment — 14 days of interest', () => {
    const row = rows[1]
    it('interest = 50,342 cents (Actual/365, 14 days)', () => {
      expect(row.interestCents).toBe(50_342)
    })
    it('principal = 18,338 cents', () => {
      expect(row.principalCents).toBe(18_338)
    })
    it('interest + principal = payment to the exact cent', () => {
      expect(row.interestCents + row.principalCents).toBe(row.amountCents)
    })
    it('balance after = 24,981,662 cents', () => {
      expect(row.balanceAfterCents).toBe(24_981_662)
    })
  })

  describe('Jan 29 payment — 14 days of interest on reduced balance', () => {
    const row = rows[2]
    it('interest = 50,306 cents (lower balance → lower interest than first payment)', () => {
      expect(row.interestCents).toBe(50_306)
    })
    it('principal = 18,374 cents', () => {
      expect(row.principalCents).toBe(18_374)
    })
    it('interest + principal = payment to the exact cent', () => {
      expect(row.interestCents + row.principalCents).toBe(row.amountCents)
    })
    it('balance is declining', () => {
      expect(state.currentBalanceCents).toBeLessThan(24_981_662)
    })
  })
})

// ---------------------------------------------------------------------------
// Escrow scenario (task 15)
//
// $250,000 @ 5.25% / 25yr / monthly / Jan 1 2026 — $300/month escrow
// Payment = $1,489.80 (P+I) + $300.00 (escrow) = $1,789.80
// Escrow is collected separately from the balance reduction.
// ---------------------------------------------------------------------------

describe('replayEvents — escrow component', () => {
  const LOAN_ESCROW: Loan = {
    ...LOAN,
    escrowMonthlyCents: 30_000, // $300/month
  }

  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay',  type: 'payment', date: '2026-02-01', amount: 1789.80 }, // P+I+escrow
  ]

  const state = replayEvents(events, LOAN_ESCROW, CONVENTION)
  const row = state.rows[1]

  it('escrowCents = 30,000 on the payment row', () => {
    expect(row.escrowCents).toBe(30_000)
  })

  it('interest + principal + escrow = payment to the exact cent', () => {
    expect(row.interestCents + row.principalCents + row.escrowCents).toBe(row.amountCents)
  })

  it('principal is the same as without escrow — escrow does not reduce loan balance', () => {
    // Same interest (111,473) and principal (37,507) as the no-escrow case
    expect(row.principalCents).toBe(37_507)
  })

  it('balance after = 24,962,493 — unchanged from no-escrow case', () => {
    expect(row.balanceAfterCents).toBe(24_962_493)
  })

  it('escrowBalanceCents accumulates across payments', () => {
    expect(state.escrowBalanceCents).toBe(30_000)
  })

  it('NSF reversal backs out escrow from escrowBalanceCents', () => {
    const reversalEvents: LoanEvent[] = [
      ...events,
      { id: 'ev-nsf', type: 'payment_reversal', date: '2026-02-08', reversesEventId: 'ev-pay' },
    ]
    const reversedState = replayEvents(reversalEvents, LOAN_ESCROW, CONVENTION)
    expect(reversedState.escrowBalanceCents).toBe(0)
  })
})

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

// ---------------------------------------------------------------------------
// Bi-weekly NSF reversal — regression scenario
//
// $500k @ 6.97% / 25yr / biweekly / $100 escrow / Jun 01 2026
// Jun 15 → payment (14 days)
// Jun 29 → payment (14 days)
// Jul 13 → payment (14 days)
// Jul 15 → NSF reversal of Jul 13 payment
//
// Verifies that the reversal is processed in the biweekly path
// (escrow scaling via × 12/26 must not break the originalRow lookup).
// ---------------------------------------------------------------------------

describe('replayEvents — biweekly NSF reversal', () => {
  const LOAN_500K_BIWEEKLY: Loan = {
    principal: 500000,
    annualRate: 0.0697,
    amortizationYears: 25,
    frequency: 'biweekly',
    startDate: '2026-06-01',
    scheduledPaymentCents: 160_959, // approximate; not used by reversal path
    escrowMonthlyCents: 10_000,     // $100/month → $46.15 per biweekly payment
  }

  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding',          date: '2026-06-01', amount: 500000 },
    { id: 'ev-pay1', type: 'payment',           date: '2026-06-15', amount: 1655.74 },
    { id: 'ev-pay2', type: 'payment',           date: '2026-06-29', amount: 1655.74 },
    { id: 'ev-pay3', type: 'payment',           date: '2026-07-13', amount: 1655.74 },
    { id: 'ev-nsf',  type: 'payment_reversal',  date: '2026-07-15', reversesEventId: 'ev-pay3' },
  ]

  const state = replayEvents(events, LOAN_500K_BIWEEKLY, CONVENTION)
  const { rows } = state

  it('produces 5 ledger rows (reversal is NOT silently dropped)', () => {
    expect(rows).toHaveLength(5)
  })

  it('row 4 type is payment_reversal', () => {
    expect(rows[4].type).toBe('payment_reversal')
  })

  it('Jul 13 payment row is marked isReversed = true', () => {
    expect(rows[3].isReversed).toBe(true)
    expect(rows[3].reversedByEventId).toBe('ev-nsf')
  })

  it('balance restores to pre-Jul-13 level after reversal', () => {
    // After reversal: balance = Jun 29 balance (before Jul 13 was applied)
    expect(rows[4].balanceAfterCents).toBe(rows[2].balanceAfterCents)
  })

  it('escrowBalanceCents drops back to 2 payments worth after reversal', () => {
    const perPaymentEscrow = Math.round(10_000 * 12 / 26) // 4,615
    expect(state.escrowBalanceCents).toBe(perPaymentEscrow * 2)
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
        escrowMonthly: 0,
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

// ---------------------------------------------------------------------------
// Bi-weekly full-lifecycle scenario — the bi-weekly counterpart to the monthly
// NSF walkthrough. Exercises every event type in one timeline:
//
//   $500,000 @ 6.97% / 25yr / BI-WEEKLY / $200/mo escrow / Jun 01 2026
//   Scheduled P+I = $1,609.59; escrow per period = round($200 × 12/26) = $92.31
//   so a full scheduled payment = $1,701.90.
//
//   Jun 01 — Funding   $500,000.00
//   Jun 15 — Payment   $1,701.90   (14 days, normal amortization)
//   Jun 29 — Payment   $1,701.90   (14 days)
//   Jul 06 — Advance   $200,000.00 (mid-period draw → splits the next accrual)
//   Jul 13 — Payment   $1,701.90   (interest spans Jun 29→Jul 06 on 499k + Jul 06→Jul 13 on 699k)
//   Jul 27 — Payment   $20,000.00  (large extra payment knocks the balance down)
//   Aug 10 — Payment   $1,701.90   (NEGATIVE principal — interest on 681k exceeds the payment)
//   Aug 12 — NSF reversal of the Aug 10 payment
//   Aug 25 — Payoff
//
// Expected figures were derived independently (integer-cent re-implementation of
// the accrual formula), not read back from the code under test.
// ---------------------------------------------------------------------------

describe('replayEvents — bi-weekly full lifecycle (advance, neg-am, NSF, payoff)', () => {
  const BIWEEKLY_LOAN: Loan = {
    principal: 500000,
    annualRate: 0.0697,
    amortizationYears: 25,
    frequency: 'biweekly',
    startDate: '2026-06-01',
    scheduledPaymentCents: 160_959, // $1,609.59 P+I
    escrowMonthlyCents: 20_000,     // $200/mo → $92.31 per bi-weekly period
  }

  const events: LoanEvent[] = [
    { id: 'ev-fund',   type: 'funding',           date: '2026-06-01', amount: 500000 },
    { id: 'ev-p1',     type: 'payment',           date: '2026-06-15', amount: 1701.90 },
    { id: 'ev-p2',     type: 'payment',           date: '2026-06-29', amount: 1701.90 },
    { id: 'ev-adv',    type: 'additional_advance', date: '2026-07-06', amount: 200000 },
    { id: 'ev-p3',     type: 'payment',           date: '2026-07-13', amount: 1701.90 },
    { id: 'ev-p4',     type: 'payment',           date: '2026-07-27', amount: 20000 },
    { id: 'ev-p5',     type: 'payment',           date: '2026-08-10', amount: 1701.90 },
    { id: 'ev-nsf',    type: 'payment_reversal',  date: '2026-08-12', reversesEventId: 'ev-p5' },
    { id: 'ev-payoff', type: 'payoff',            date: '2026-08-25' },
  ]

  const state = replayEvents(events, BIWEEKLY_LOAN, CONVENTION)
  const { rows } = state
  const ESCROW = Math.round(20_000 * 12 / 26) // 9,231

  it('produces 9 ledger rows in chronological order', () => {
    expect(rows).toHaveLength(9)
    expect(rows.map(r => r.type)).toEqual([
      'funding', 'payment', 'payment', 'additional_advance',
      'payment', 'payment', 'payment', 'payment_reversal', 'payoff',
    ])
  })

  it('escrow per period = $92.31 (monthly × 12/26)', () => {
    expect(ESCROW).toBe(9_231)
  })

  describe('Jun 15 + Jun 29 — normal bi-weekly amortization (14 days each)', () => {
    it('Jun 15: interest 133,671 / principal 27,288 / escrow 9,231 / balance 49,972,712', () => {
      expect(rows[1].interestCents).toBe(133_671)
      expect(rows[1].principalCents).toBe(27_288)
      expect(rows[1].escrowCents).toBe(ESCROW)
      expect(rows[1].balanceAfterCents).toBe(49_972_712)
    })
    it('Jun 29: interest 133,598 / principal 27,361 / balance 49,945,351', () => {
      expect(rows[2].interestCents).toBe(133_598)
      expect(rows[2].principalCents).toBe(27_361)
      expect(rows[2].balanceAfterCents).toBe(49_945_351)
    })
  })

  describe('Jul 06 — advance raises the balance, no split', () => {
    it('balance = 49,945,351 + 20,000,000 = 69,945,351', () => {
      expect(rows[3].balanceAfterCents).toBe(69_945_351)
      expect(rows[3].interestCents).toBe(0)
      expect(rows[3].principalCents).toBe(0)
    })
  })

  describe('Jul 13 — payment interest spans both sub-periods around the advance', () => {
    const row = rows[4]
    // Jun 29→Jul 06 (7d) on 49,945,351 = 66,763  (pending)
    // Jul 06→Jul 13 (7d) on 69,945,351 = 93,497  (current period)
    // total = 160,260
    it('interest = 160,260 (pending 66,763 + current 93,497)', () => {
      expect(row.interestCents).toBe(160_260)
    })
    it('principal = 699, balance = 69,944,652', () => {
      expect(row.principalCents).toBe(699)
      expect(row.balanceAfterCents).toBe(69_944_652)
    })
  })

  describe('Jul 27 — large extra payment pays down principal', () => {
    const row = rows[5]
    it('interest 186,992 / principal 1,803,777 / balance 68,140,875', () => {
      expect(row.interestCents).toBe(186_992)
      expect(row.principalCents).toBe(1_803_777)
      expect(row.balanceAfterCents).toBe(68_140_875)
    })
  })

  describe('Aug 10 — scheduled payment goes into negative amortization', () => {
    const row = rows[6]
    it('interest 182,169 exceeds the $1,609.59 P+I → principal is negative', () => {
      expect(row.interestCents).toBe(182_169)
      expect(row.principalCents).toBe(-21_210)
      expect(row.isNegativePrincipal).toBe(true)
    })
    it('balance grows to 68,162,085', () => {
      expect(row.balanceAfterCents).toBe(68_162_085)
    })
    it('is marked isReversed once the NSF is processed', () => {
      expect(row.isReversed).toBe(true)
      expect(row.reversedByEventId).toBe('ev-nsf')
    })
  })

  describe('Aug 12 — NSF reversal restores the exact pre-payment balance', () => {
    it('reversal backs out the negative principal, restoring balance to the Jul 27 level', () => {
      // Even though the reversed payment had NEGATIVE principal, the reversal
      // restores the balance to exactly what it was before that payment.
      expect(rows[7].balanceAfterCents).toBe(68_140_875)
      expect(rows[7].balanceAfterCents).toBe(rows[5].balanceAfterCents)
    })
    it('reversal row itself carries no money', () => {
      expect(rows[7].amountCents).toBe(0)
      expect(rows[7].interestCents).toBe(0)
      expect(rows[7].principalCents).toBe(0)
    })
  })

  describe('Aug 25 — payoff accrues from the last VALID event (Jul 27, not the reversed Aug 10)', () => {
    const row = rows[8]
    // Jul 27 → Aug 25 = 29 days on 68,140,875 → 377,351
    it('interest = 377,351 (29 days from Jul 27)', () => {
      expect(row.interestCents).toBe(377_351)
    })
    it('payoff amount = balance + interest = 68,518,226 and balance zeroes out', () => {
      expect(row.amountCents).toBe(68_518_226)
      expect(row.balanceAfterCents).toBe(0)
    })
  })

  describe('final state', () => {
    it('balance is fully paid off', () => {
      expect(state.currentBalanceCents).toBe(0)
    })
    it('escrow balance = 4 effective payments × 9,231 = 36,924 (5 collected − 1 reversed)', () => {
      expect(state.escrowBalanceCents).toBe(ESCROW * 4)
      expect(state.escrowBalanceCents).toBe(36_924)
    })
  })

  it('every non-reversal money row reconciles: interest + principal + escrow = amount', () => {
    for (const row of rows) {
      if (row.type === 'payment' || row.type === 'payoff') {
        expect(row.interestCents + row.principalCents + row.escrowCents).toBe(row.amountCents)
      }
    }
  })
})
