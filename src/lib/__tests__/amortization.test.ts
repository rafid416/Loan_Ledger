import { describe, it, expect } from 'vitest'
import { calculateMonthlyPaymentCents, calculateBiweeklyPaymentCents } from '@/lib/amortization'

// Canadian semi-annual compounding formula:
//   r = (1 + annualRate/2)^(1/6) - 1
//   M = P × [r(1+r)^n] / [(1+r)^n - 1]

describe('calculateMonthlyPaymentCents', () => {
  it('$250,000 @ 5.25% / 25yr → 148,980 cents ($1,489.80)', () => {
    expect(calculateMonthlyPaymentCents(25_000_000, 0.0525, 25)).toBe(148_980)
  })

  it('larger loan: $500,000 @ 5.25% / 25yr → approximately double the payment', () => {
    const half = calculateMonthlyPaymentCents(25_000_000, 0.0525, 25)
    const full = calculateMonthlyPaymentCents(50_000_000, 0.0525, 25)
    // Linear in principal; allow ±1 cent for independent Math.round at each call
    expect(Math.abs(full - half * 2)).toBeLessThanOrEqual(1)
  })

  it('longer amortization produces a lower monthly payment', () => {
    const p25 = calculateMonthlyPaymentCents(25_000_000, 0.0525, 25)
    const p30 = calculateMonthlyPaymentCents(25_000_000, 0.0525, 30)
    expect(p30).toBeLessThan(p25)
  })

  it('higher rate produces a higher monthly payment', () => {
    const low  = calculateMonthlyPaymentCents(25_000_000, 0.0400, 25)
    const high = calculateMonthlyPaymentCents(25_000_000, 0.0700, 25)
    expect(high).toBeGreaterThan(low)
  })

  it('result is a whole number (rounded to nearest cent)', () => {
    const result = calculateMonthlyPaymentCents(25_000_000, 0.0525, 25)
    expect(Number.isInteger(result)).toBe(true)
  })
})

describe('calculateBiweeklyPaymentCents', () => {
  it('$250,000 @ 5.25% / 25yr → 68,680 cents ($686.80)', () => {
    expect(calculateBiweeklyPaymentCents(25_000_000, 0.0525, 25)).toBe(68_680)
  })

  it('bi-weekly payment is less than monthly for the same loan', () => {
    const monthly = calculateMonthlyPaymentCents(25_000_000, 0.0525, 25)
    const biweekly = calculateBiweeklyPaymentCents(25_000_000, 0.0525, 25)
    expect(biweekly).toBeLessThan(monthly)
  })

  it('higher rate produces a higher bi-weekly payment', () => {
    const low  = calculateBiweeklyPaymentCents(25_000_000, 0.0400, 25)
    const high = calculateBiweeklyPaymentCents(25_000_000, 0.0700, 25)
    expect(high).toBeGreaterThan(low)
  })

  it('result is a whole number (rounded to nearest cent)', () => {
    const result = calculateBiweeklyPaymentCents(25_000_000, 0.0525, 25)
    expect(Number.isInteger(result)).toBe(true)
  })
})
