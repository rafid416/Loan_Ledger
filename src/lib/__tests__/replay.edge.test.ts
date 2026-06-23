import { describe, it, expect } from 'vitest'
import { replayEvents } from '@/lib/replay'
import type { Loan, LoanEvent } from '@/types/loan'

// ---------------------------------------------------------------------------
// Shared loan configs
// ---------------------------------------------------------------------------

const LOAN_M: Loan = {
  principal: 250000,
  annualRate: 0.0525,
  amortizationYears: 25,
  frequency: 'monthly',
  startDate: '2026-01-01',
  scheduledPaymentCents: 148_980,
  escrowMonthlyCents: 0,
}

const LOAN_BW: Loan = {
  principal: 250000,
  annualRate: 0.0525,
  amortizationYears: 25,
  frequency: 'biweekly',
  startDate: '2026-01-01',
  scheduledPaymentCents: 68_680,
  escrowMonthlyCents: 0,
}

// ---------------------------------------------------------------------------
// MONTHLY EDGE CASES (10 tests)
// ---------------------------------------------------------------------------

// M1: 30/360 vs Actual/365 — same 31-day period (Jan 01 → Feb 01) produces
//     different interest because denominators and day counts both differ.
// ---------------------------------------------------------------------------
describe('M1: monthly 30/360 vs Actual/365 — Jan 01 to Feb 01', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay',  type: 'payment', date: '2026-02-01', amount: 1489.80 },
  ]

  const stateA365 = replayEvents(events, LOAN_M, 'actual365')
  const state360  = replayEvents(events, LOAN_M, 'thirty360')

  // Actual/365: 31 days × 25_000_000 × 0.0525 / 365 = 111,473
  it('Actual/365 interest = 111,473 cents (31 days)', () => {
    expect(stateA365.rows[1].interestCents).toBe(111_473)
  })

  // 30/360: Jan 01 → Feb 01 = 30 days (D1=1, D2=1, M diff=1 → 30 days);
  // 25_000_000 × 0.0525 × 30 / 360 = 109,375
  it('30/360 interest = 109,375 cents (30 days, denominator 360)', () => {
    expect(state360.rows[1].interestCents).toBe(109_375)
  })

  it('30/360 interest < Actual/365 interest for a 31-day month', () => {
    expect(state360.rows[1].interestCents).toBeLessThan(stateA365.rows[1].interestCents)
  })

  it('30/360 principal = 39,605; interest + principal = payment to the cent', () => {
    expect(state360.rows[1].principalCents).toBe(39_605)
    expect(state360.rows[1].interestCents + state360.rows[1].principalCents).toBe(state360.rows[1].amountCents)
  })

  it('30/360 balance after = 24,960,395', () => {
    expect(state360.rows[1].balanceAfterCents).toBe(24_960_395)
  })
})

// ---------------------------------------------------------------------------
// M2: 30/360 end-of-month clamping — Jan 31 → Mar 31.
//     D1=31 is clamped to 30; D2=31 is clamped to 30 (because D1 >= 30).
//     30/360 = 60 days; Actual/365 = 59 days.
// ---------------------------------------------------------------------------
describe('M2: monthly 30/360 end-of-month clamping — Jan 31 to Mar 31', () => {
  const LOAN_JAN31: Loan = { ...LOAN_M, startDate: '2026-01-31' }
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-01-31', amount: 250000 },
    // $3,000 payment so interest doesn't exceed the payment
    { id: 'ev-pay',  type: 'payment', date: '2026-03-31', amount: 3000 },
  ]

  const stateA365 = replayEvents(events, LOAN_JAN31, 'actual365')
  const state360  = replayEvents(events, LOAN_JAN31, 'thirty360')

  // 30/360: Math.round(25_000_000 × 0.0525 × 60 / 360) = 218,750
  it('30/360 interest = 218,750 cents (60 days after D1/D2 clamping)', () => {
    expect(state360.rows[1].interestCents).toBe(218_750)
  })

  // Actual/365: Math.round(25_000_000 × 0.0525 × 59 / 365) = 212,158
  it('Actual/365 interest = 212,158 cents (59 actual days)', () => {
    expect(stateA365.rows[1].interestCents).toBe(212_158)
  })

  it('30/360 > Actual/365 because end-of-month clamping adds a synthetic day', () => {
    expect(state360.rows[1].interestCents).toBeGreaterThan(stateA365.rows[1].interestCents)
  })

  it('interest + principal = payment to the cent for both conventions', () => {
    expect(state360.rows[1].interestCents + state360.rows[1].principalCents).toBe(state360.rows[1].amountCents)
    expect(stateA365.rows[1].interestCents + stateA365.rows[1].principalCents).toBe(stateA365.rows[1].amountCents)
  })
})

// ---------------------------------------------------------------------------
// M3: 30/360 February cross — Feb 01 → Mar 01.
//     Actual/365 = 28 days (2026 is not a leap year).
//     30/360 = 30 days (M diff=1, D1=1, D2=1 → 1×30 = 30 days).
//     30/360 charges more interest across a short February.
// ---------------------------------------------------------------------------
describe('M3: monthly 30/360 February cross — Feb 01 to Mar 01', () => {
  const LOAN_FEB: Loan = { ...LOAN_M, startDate: '2026-02-01' }
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-02-01', amount: 250000 },
    { id: 'ev-pay',  type: 'payment', date: '2026-03-01', amount: 1489.80 },
  ]

  const stateA365 = replayEvents(events, LOAN_FEB, 'actual365')
  const state360  = replayEvents(events, LOAN_FEB, 'thirty360')

  // Actual/365: Math.round(25_000_000 × 0.0525 × 28 / 365) = 100,685
  it('Actual/365 interest = 100,685 cents (28 actual days across Feb)', () => {
    expect(stateA365.rows[1].interestCents).toBe(100_685)
  })

  // 30/360: Math.round(25_000_000 × 0.0525 × 30 / 360) = 109,375
  it('30/360 interest = 109,375 cents (30 days — Feb treated as 30 days)', () => {
    expect(state360.rows[1].interestCents).toBe(109_375)
  })

  it('30/360 charges more than Actual/365 across a short February', () => {
    expect(state360.rows[1].interestCents).toBeGreaterThan(stateA365.rows[1].interestCents)
  })
})

// ---------------------------------------------------------------------------
// M4: Zero-day payment — payment on the same date as funding.
//     0 days → interest = 0; entire payment reduces principal.
// ---------------------------------------------------------------------------
describe('M4: monthly zero-day payment — same date as funding', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay',  type: 'payment', date: '2026-01-01', amount: 1489.80 },
  ]

  const state = replayEvents(events, LOAN_M, 'actual365')
  const row = state.rows[1]

  it('interest = 0 when payment date equals previous event date', () => {
    expect(row.interestCents).toBe(0)
  })

  it('entire payment goes to principal when no interest accrues', () => {
    expect(row.principalCents).toBe(148_980)
  })

  it('interest + principal = payment to the cent', () => {
    expect(row.interestCents + row.principalCents).toBe(row.amountCents)
  })

  // balance = 25,000,000 - 148,980 = 24,851,020
  it('balance = 24,851,020 — more principal paid than in a normal period', () => {
    expect(row.balanceAfterCents).toBe(24_851_020)
  })
})

// ---------------------------------------------------------------------------
// M5: Payoff event (Actual/365) — balance goes to zero, amount = principal + interest.
// ---------------------------------------------------------------------------
describe('M5: monthly payoff event — Actual/365 (31 days Jan 01 to Feb 01)', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund',   type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-payoff', type: 'payoff',  date: '2026-02-01' },
  ]

  const state = replayEvents(events, LOAN_M, 'actual365')
  const row = state.rows[1]

  it('payoff row type is payoff', () => {
    expect(row.type).toBe('payoff')
  })

  // interest = Math.round(25_000_000 × 0.0525 × 31 / 365) = 111,473
  it('interest = 111,473 cents (31 days)', () => {
    expect(row.interestCents).toBe(111_473)
  })

  // amount = 25,000,000 + 111,473 = 25,111,473
  it('amount = principal + interest = 25,111,473 cents', () => {
    expect(row.amountCents).toBe(25_111_473)
  })

  it('balance after payoff = 0', () => {
    expect(row.balanceAfterCents).toBe(0)
    expect(state.currentBalanceCents).toBe(0)
  })

  it('accruedInterestCents = 0 when loan is paid off', () => {
    expect(state.accruedInterestCents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// M6: Payoff event (30/360) — same period, different amount than Actual/365.
// ---------------------------------------------------------------------------
describe('M6: monthly payoff event — 30/360 (30 days Jan 01 to Feb 01)', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund',   type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-payoff', type: 'payoff',  date: '2026-02-01' },
  ]

  const state = replayEvents(events, LOAN_M, 'thirty360')
  const row = state.rows[1]

  // 30/360: Math.round(25_000_000 × 0.0525 × 30 / 360) = 109,375
  it('interest = 109,375 cents (30 days, denominator 360)', () => {
    expect(row.interestCents).toBe(109_375)
  })

  // amount = 25,000,000 + 109,375 = 25,109,375
  it('amount = 25,109,375 cents (less than Actual/365 payoff due to 30-day month)', () => {
    expect(row.amountCents).toBe(25_109_375)
  })

  it('balance after payoff = 0', () => {
    expect(state.currentBalanceCents).toBe(0)
  })

  it('30/360 payoff is cheaper than Actual/365 for a 31-day period', () => {
    const stateA365 = replayEvents(events, LOAN_M, 'actual365')
    expect(row.amountCents).toBeLessThan(stateA365.rows[1].amountCents)
  })
})

// ---------------------------------------------------------------------------
// M7: Two NSF reversals on different payments — both backed out, balance fully restored.
//     Timeline: fund Jan 01 → pay Feb 01 → pay Mar 01 → NSF Feb 01 → NSF Mar 01.
//     After both reversals, balance = 25,000,000 (funding amount).
// ---------------------------------------------------------------------------
describe('M7: monthly — two NSF reversals on different payments', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding',          date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay1', type: 'payment',           date: '2026-02-01', amount: 1489.80 },
    { id: 'ev-pay2', type: 'payment',           date: '2026-03-01', amount: 1489.80 },
    { id: 'ev-nsf1', type: 'payment_reversal',  date: '2026-02-08', reversesEventId: 'ev-pay1' },
    { id: 'ev-nsf2', type: 'payment_reversal',  date: '2026-03-05', reversesEventId: 'ev-pay2' },
  ]

  const state = replayEvents(events, LOAN_M, 'actual365')
  const { rows } = state

  it('produces 5 rows (funding + 2 payments + 2 reversals)', () => {
    expect(rows).toHaveLength(5)
  })

  it('Feb 01 payment row is marked isReversed', () => {
    expect(rows[1].isReversed).toBe(true)
  })

  it('Mar 01 payment row is marked isReversed', () => {
    expect(rows[3].isReversed).toBe(true)
  })

  it('balance is fully restored to funding amount after both reversals', () => {
    expect(state.currentBalanceCents).toBe(25_000_000)
  })

  it('final reversal row balance = 25,000,000', () => {
    expect(rows[4].balanceAfterCents).toBe(25_000_000)
  })
})

// ---------------------------------------------------------------------------
// M8: Payoff after advance — interest spans both sub-periods.
//     Fund Jan 01 (25M) → Advance Feb 01 (+10k = 26M) → Payoff Mar 01.
//     Sub-period 1: Jan 01 → Feb 01, 31 days on 25,000,000 → 111,473
//     Sub-period 2: Feb 01 → Mar 01, 28 days on 26,000,000 → 104,712
//     Total interest = 216,185; payoff amount = 26,216,185
// ---------------------------------------------------------------------------
describe('M8: monthly — payoff after advance spans both sub-periods', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund',   type: 'funding',           date: '2026-01-01', amount: 250000 },
    { id: 'ev-adv',   type: 'additional_advance', date: '2026-02-01', amount: 10000 },
    { id: 'ev-payoff', type: 'payoff',             date: '2026-03-01' },
  ]

  const state = replayEvents(events, LOAN_M, 'actual365')
  const { rows } = state

  it('advance row balance = 26,000,000', () => {
    expect(rows[1].balanceAfterCents).toBe(26_000_000)
  })

  // Sub-period 1: Math.round(25_000_000 × 0.0525 × 31 / 365) = 111,473
  // Sub-period 2: Math.round(26_000_000 × 0.0525 × 28 / 365) = 104,712
  it('payoff interest = 216,185 cents (111,473 + 104,712 across both sub-periods)', () => {
    expect(rows[2].interestCents).toBe(216_185)
  })

  it('payoff amount = 26,216,185 cents (balance + total interest)', () => {
    expect(rows[2].amountCents).toBe(26_216_185)
  })

  it('balance = 0 after payoff', () => {
    expect(state.currentBalanceCents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// M9: Payoff after NSF reversal — payoff interest uses pre-NSF clock (Jan 01).
//     Fund Jan 01 → pay Feb 01 → NSF Feb 01 (Feb 08) → payoff Apr 01.
//     After NSF: lastEventDate resets to Jan 01 (funding row, before Feb 01).
//     Payoff Apr 01: 90 days from Jan 01.
// ---------------------------------------------------------------------------
describe('M9: monthly — payoff after NSF uses pre-NSF interest clock', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund',   type: 'funding',         date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay1',   type: 'payment',          date: '2026-02-01', amount: 1489.80 },
    { id: 'ev-nsf',    type: 'payment_reversal', date: '2026-02-08', reversesEventId: 'ev-pay1' },
    { id: 'ev-payoff', type: 'payoff',           date: '2026-04-01' },
  ]

  const state = replayEvents(events, LOAN_M, 'actual365')
  const payoffRow = state.rows[3]

  // Jan 01 to Apr 01 = 90 days (Jan 31 + Feb 28 + Mar 31 = 90)
  // Math.round(25_000_000 × 0.0525 × 90 / 365) = 323,630
  it('payoff interest = 323,630 cents (90 days from Jan 01, not from Feb 01 or Feb 08)', () => {
    expect(payoffRow.interestCents).toBe(323_630)
  })

  it('payoff amount = 25,323,630 cents (balance + 90-day interest)', () => {
    expect(payoffRow.amountCents).toBe(25_323_630)
  })

  it('balance = 0 after payoff', () => {
    expect(state.currentBalanceCents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// M10: Same-date advance and payment — advance closes Jan 01→Jan 15 sub-period
//      into pendingInterestCents; payment on same day adds a 0-day final sub-period.
//      Total interest = 14 days on 25,000,000 (pre-advance) + 0 days on 26,000,000.
// ---------------------------------------------------------------------------
describe('M10: monthly — same-date advance and payment (advance closes prior sub-period)', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding',           date: '2026-01-01', amount: 250000 },
    { id: 'ev-adv',  type: 'additional_advance', date: '2026-01-15', amount: 10000 },
    { id: 'ev-pay',  type: 'payment',            date: '2026-01-15', amount: 1489.80 },
  ]

  const state = replayEvents(events, LOAN_M, 'actual365')
  const { rows } = state

  it('produces 3 rows: funding, advance, payment', () => {
    expect(rows).toHaveLength(3)
    expect(rows[1].type).toBe('additional_advance')
    expect(rows[2].type).toBe('payment')
  })

  it('advance row balance = 26,000,000 ($250k + $10k)', () => {
    expect(rows[1].balanceAfterCents).toBe(26_000_000)
  })

  // Pending: Math.round(25_000_000 × 0.0525 × 14 / 365) = 50,342
  // Final sub-period: 0 days on 26,000,000 = 0
  // Total interest = 50,342
  it('payment interest = 50,342 cents (14 days on pre-advance 25,000,000; 0 days on 26,000,000)', () => {
    expect(rows[2].interestCents).toBe(50_342)
  })

  it('interest + principal = payment to the cent', () => {
    expect(rows[2].interestCents + rows[2].principalCents).toBe(rows[2].amountCents)
  })

  // principal = 148,980 - 50,342 = 98,638; balance = 26,000,000 - 98,638 = 25,901,362
  it('balance after payment = 25,901,362', () => {
    expect(rows[2].balanceAfterCents).toBe(25_901_362)
  })
})

// ---------------------------------------------------------------------------
// BI-WEEKLY EDGE CASES (10 tests — mirror of monthly tests above)
// ---------------------------------------------------------------------------

// BW1: 30/360 vs Actual/365 — same 14-day period, but denominators differ
//      (365 vs 360), producing different interest even with identical day counts.
// ---------------------------------------------------------------------------
describe('BW1: biweekly 30/360 vs Actual/365 — 14 days, denominator differs', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay',  type: 'payment', date: '2026-01-15', amount: 686.80 },
  ]

  const stateA365 = replayEvents(events, LOAN_BW, 'actual365')
  const state360  = replayEvents(events, LOAN_BW, 'thirty360')

  // Actual/365: Math.round(25_000_000 × 0.0525 × 14 / 365) = 50,342
  it('Actual/365 interest = 50,342 cents (14 days / 365)', () => {
    expect(stateA365.rows[1].interestCents).toBe(50_342)
  })

  // 30/360: Math.round(25_000_000 × 0.0525 × 14 / 360) = 51,042
  it('30/360 interest = 51,042 cents (14 days / 360 — higher denominator effect)', () => {
    expect(state360.rows[1].interestCents).toBe(51_042)
  })

  it('30/360 interest > Actual/365 interest (smaller denominator = more per day)', () => {
    expect(state360.rows[1].interestCents).toBeGreaterThan(stateA365.rows[1].interestCents)
  })

  it('interest + principal = payment to the cent for both conventions', () => {
    expect(stateA365.rows[1].interestCents + stateA365.rows[1].principalCents).toBe(stateA365.rows[1].amountCents)
    expect(state360.rows[1].interestCents + state360.rows[1].principalCents).toBe(state360.rows[1].amountCents)
  })
})

// ---------------------------------------------------------------------------
// BW2: 30/360 end-of-month clamping (biweekly loan) — Jan 31 to Mar 31.
//      Same day-count math as M2 but with biweekly loan config.
// ---------------------------------------------------------------------------
describe('BW2: biweekly 30/360 end-of-month clamping — Jan 31 to Mar 31', () => {
  const LOAN_BW_JAN31: Loan = { ...LOAN_BW, startDate: '2026-01-31' }
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-01-31', amount: 250000 },
    { id: 'ev-pay',  type: 'payment', date: '2026-03-31', amount: 3000 },
  ]

  const stateA365 = replayEvents(events, LOAN_BW_JAN31, 'actual365')
  const state360  = replayEvents(events, LOAN_BW_JAN31, 'thirty360')

  // 30/360: D1=31→30, D2=31→30 (D1>=30), months=2 → 60 days
  // Math.round(25_000_000 × 0.0525 × 60 / 360) = 218,750
  it('30/360 interest = 218,750 cents (60 days after clamping)', () => {
    expect(state360.rows[1].interestCents).toBe(218_750)
  })

  // Actual/365: 59 actual days
  // Math.round(25_000_000 × 0.0525 × 59 / 365) = 212,158
  it('Actual/365 interest = 212,158 cents (59 actual days)', () => {
    expect(stateA365.rows[1].interestCents).toBe(212_158)
  })

  it('end-of-month clamping gives 30/360 one extra synthetic day vs Actual/365', () => {
    expect(state360.rows[1].interestCents).toBeGreaterThan(stateA365.rows[1].interestCents)
  })
})

// ---------------------------------------------------------------------------
// BW3: 30/360 February cross (biweekly loan) — Feb 01 → Mar 01.
//      Actual/365 = 28 days; 30/360 = 30 days (Feb treated as 30-day month).
// ---------------------------------------------------------------------------
describe('BW3: biweekly 30/360 February cross — Feb 01 to Mar 01', () => {
  const LOAN_BW_FEB: Loan = { ...LOAN_BW, startDate: '2026-02-01' }
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-02-01', amount: 250000 },
    { id: 'ev-pay',  type: 'payment', date: '2026-03-01', amount: 686.80 },
  ]

  const stateA365 = replayEvents(events, LOAN_BW_FEB, 'actual365')
  const state360  = replayEvents(events, LOAN_BW_FEB, 'thirty360')

  // Actual/365: Math.round(25_000_000 × 0.0525 × 28 / 365) = 100,685
  it('Actual/365 interest = 100,685 cents (28 actual days)', () => {
    expect(stateA365.rows[1].interestCents).toBe(100_685)
  })

  // 30/360: Math.round(25_000_000 × 0.0525 × 30 / 360) = 109,375
  it('30/360 interest = 109,375 cents (Feb treated as 30 days)', () => {
    expect(state360.rows[1].interestCents).toBe(109_375)
  })

  it('30/360 charges more interest across February than Actual/365', () => {
    expect(state360.rows[1].interestCents).toBeGreaterThan(stateA365.rows[1].interestCents)
  })
})

// ---------------------------------------------------------------------------
// BW4: Biweekly zero-day payment — interest = 0, full payment = principal.
// ---------------------------------------------------------------------------
describe('BW4: biweekly zero-day payment — same date as funding', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay',  type: 'payment', date: '2026-01-01', amount: 686.80 },
  ]

  const state = replayEvents(events, LOAN_BW, 'actual365')
  const row = state.rows[1]

  it('interest = 0 when payment date equals previous event date', () => {
    expect(row.interestCents).toBe(0)
  })

  it('entire payment goes to principal (68,680 cents)', () => {
    expect(row.principalCents).toBe(68_680)
  })

  it('interest + principal = payment to the cent', () => {
    expect(row.interestCents + row.principalCents).toBe(row.amountCents)
  })

  // balance = 25,000,000 - 68,680 = 24,931,320
  it('balance = 24,931,320', () => {
    expect(row.balanceAfterCents).toBe(24_931_320)
  })
})

// ---------------------------------------------------------------------------
// BW5: Biweekly payoff event (Actual/365) — 14 days from funding.
// ---------------------------------------------------------------------------
describe('BW5: biweekly payoff event — Actual/365 (14 days Jan 01 to Jan 15)', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund',   type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-payoff', type: 'payoff',  date: '2026-01-15' },
  ]

  const state = replayEvents(events, LOAN_BW, 'actual365')
  const row = state.rows[1]

  // Math.round(25_000_000 × 0.0525 × 14 / 365) = 50,342
  it('payoff interest = 50,342 cents (14 days)', () => {
    expect(row.interestCents).toBe(50_342)
  })

  // 25,000,000 + 50,342 = 25,050,342
  it('payoff amount = 25,050,342 cents', () => {
    expect(row.amountCents).toBe(25_050_342)
  })

  it('balance = 0 after payoff', () => {
    expect(state.currentBalanceCents).toBe(0)
  })

  it('accruedInterestCents = 0 when loan is paid off', () => {
    expect(state.accruedInterestCents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// BW6: Biweekly payoff event (30/360) — same 14-day period, more expensive
//      because 30/360 denominator is 360, not 365.
// ---------------------------------------------------------------------------
describe('BW6: biweekly payoff event — 30/360 (14 days, denominator 360)', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund',   type: 'funding', date: '2026-01-01', amount: 250000 },
    { id: 'ev-payoff', type: 'payoff',  date: '2026-01-15' },
  ]

  const state360  = replayEvents(events, LOAN_BW, 'thirty360')
  const stateA365 = replayEvents(events, LOAN_BW, 'actual365')

  // Math.round(25_000_000 × 0.0525 × 14 / 360) = 51,042
  it('30/360 interest = 51,042 cents (14 days / 360)', () => {
    expect(state360.rows[1].interestCents).toBe(51_042)
  })

  // 25,000,000 + 51,042 = 25,051,042
  it('30/360 payoff amount = 25,051,042 cents', () => {
    expect(state360.rows[1].amountCents).toBe(25_051_042)
  })

  it('30/360 payoff costs more than Actual/365 (same days, smaller denominator)', () => {
    expect(state360.rows[1].amountCents).toBeGreaterThan(stateA365.rows[1].amountCents)
  })

  it('balance = 0 after payoff', () => {
    expect(state360.currentBalanceCents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// BW7: Biweekly — two NSF reversals on different payments, balance fully restored.
//      Jan 01 fund → Jan 15 pay → Jan 29 pay → NSF Jan 15 → NSF Jan 29.
// ---------------------------------------------------------------------------
describe('BW7: biweekly — two NSF reversals on different payments', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding',          date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay1', type: 'payment',           date: '2026-01-15', amount: 686.80 },
    { id: 'ev-pay2', type: 'payment',           date: '2026-01-29', amount: 686.80 },
    { id: 'ev-nsf1', type: 'payment_reversal',  date: '2026-01-17', reversesEventId: 'ev-pay1' },
    { id: 'ev-nsf2', type: 'payment_reversal',  date: '2026-01-31', reversesEventId: 'ev-pay2' },
  ]

  const state = replayEvents(events, LOAN_BW, 'actual365')
  const { rows } = state

  it('produces 5 rows (funding + 2 payments + 2 reversals)', () => {
    expect(rows).toHaveLength(5)
  })

  it('Jan 15 payment row is marked isReversed', () => {
    expect(rows[1].isReversed).toBe(true)
  })

  it('Jan 29 payment row is marked isReversed', () => {
    expect(rows[3].isReversed).toBe(true)
  })

  it('balance fully restored to 25,000,000 after both reversals', () => {
    expect(state.currentBalanceCents).toBe(25_000_000)
  })
})

// ---------------------------------------------------------------------------
// BW8: Biweekly payoff after advance — interest spans both sub-periods.
//     Fund Jan 01 (25M) → Advance Jan 15 (+10k = 26M) → Payoff Feb 12.
//     Sub-period 1: Jan 01 → Jan 15, 14 days on 25,000,000 → 50,342
//     Sub-period 2: Jan 15 → Feb 12, 28 days on 26,000,000 → 104,712
//     Total interest = 155,054; payoff amount = 26,155,054
// ---------------------------------------------------------------------------
describe('BW8: biweekly — payoff after advance spans both sub-periods', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund',   type: 'funding',           date: '2026-01-01', amount: 250000 },
    { id: 'ev-adv',   type: 'additional_advance', date: '2026-01-15', amount: 10000 },
    { id: 'ev-payoff', type: 'payoff',             date: '2026-02-12' },
  ]

  const state = replayEvents(events, LOAN_BW, 'actual365')
  const { rows } = state

  it('advance row balance = 26,000,000', () => {
    expect(rows[1].balanceAfterCents).toBe(26_000_000)
  })

  // Sub-period 1: Math.round(25_000_000 × 0.0525 × 14 / 365) = 50,342
  // Sub-period 2: Math.round(26_000_000 × 0.0525 × 28 / 365) = 104,712
  it('payoff interest = 155,054 cents (50,342 + 104,712 across both sub-periods)', () => {
    expect(rows[2].interestCents).toBe(155_054)
  })

  it('payoff amount = 26,155,054 cents (balance + total interest)', () => {
    expect(rows[2].amountCents).toBe(26_155_054)
  })

  it('balance = 0 after payoff', () => {
    expect(state.currentBalanceCents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// BW9: Biweekly payoff after NSF reversal — payoff accrues from pre-NSF clock.
//      Fund Jan 01 → pay Jan 15 → NSF Jan 15 (Jan 17) → payoff Feb 12.
//      NSF resets clock to Jan 01 (funding); payoff runs 42 days from Jan 01.
// ---------------------------------------------------------------------------
describe('BW9: biweekly — payoff after NSF uses pre-NSF interest clock', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund',   type: 'funding',         date: '2026-01-01', amount: 250000 },
    { id: 'ev-pay1',   type: 'payment',          date: '2026-01-15', amount: 686.80 },
    { id: 'ev-nsf',    type: 'payment_reversal', date: '2026-01-17', reversesEventId: 'ev-pay1' },
    { id: 'ev-payoff', type: 'payoff',           date: '2026-02-12' },
  ]

  const state = replayEvents(events, LOAN_BW, 'actual365')
  const payoffRow = state.rows[3]

  // Jan 01 to Feb 12 = 42 days
  // Math.round(25_000_000 × 0.0525 × 42 / 365) = Math.round(151,027.4) = 151,027
  it('payoff interest = 151,027 cents (42 days from Jan 01, not Jan 15 or Jan 17)', () => {
    expect(payoffRow.interestCents).toBe(151_027)
  })

  // 25,000,000 + 151,027 = 25,151,027
  it('payoff amount = 25,151,027 cents', () => {
    expect(payoffRow.amountCents).toBe(25_151_027)
  })

  it('balance = 0 after payoff', () => {
    expect(state.currentBalanceCents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// BW10: Biweekly — same-date advance and payment; advance closes Jan 01→Jan 15
//       sub-period into pendingInterestCents; payment on same day adds 0 more days.
//       Total interest = 14 days on 25,000,000 (pre-advance) + 0 days on 26,000,000.
// ---------------------------------------------------------------------------
describe('BW10: biweekly — same-date advance and payment (advance closes prior sub-period)', () => {
  const events: LoanEvent[] = [
    { id: 'ev-fund', type: 'funding',           date: '2026-01-01', amount: 250000 },
    { id: 'ev-adv',  type: 'additional_advance', date: '2026-01-15', amount: 10000 },
    { id: 'ev-pay',  type: 'payment',            date: '2026-01-15', amount: 686.80 },
  ]

  const state = replayEvents(events, LOAN_BW, 'actual365')
  const { rows } = state

  it('produces 3 rows: funding, advance, payment', () => {
    expect(rows).toHaveLength(3)
    expect(rows[1].type).toBe('additional_advance')
    expect(rows[2].type).toBe('payment')
  })

  it('advance row balance = 26,000,000', () => {
    expect(rows[1].balanceAfterCents).toBe(26_000_000)
  })

  // Pending: Math.round(25_000_000 × 0.0525 × 14 / 365) = 50,342
  // Final sub-period: 0 days on 26,000,000 = 0
  // Total interest = 50,342
  it('payment interest = 50,342 cents (14 days on pre-advance 25,000,000; 0 days on 26,000,000)', () => {
    expect(rows[2].interestCents).toBe(50_342)
  })

  it('interest + principal = payment to the cent', () => {
    expect(rows[2].interestCents + rows[2].principalCents).toBe(rows[2].amountCents)
  })

  // principal = 68,680 - 50,342 = 18,338; balance = 26,000,000 - 18,338 = 25,981,662
  it('balance after payment = 25,981,662', () => {
    expect(rows[2].balanceAfterCents).toBe(25_981_662)
  })
})
