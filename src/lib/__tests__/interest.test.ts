import { describe, it, expect } from 'vitest'
import { calculateInterestCents } from '@/lib/interest'

// Actual/365: Math.round(balance × rate × days / 365)
// 30/360:     Math.round(balance × rate × days / 360)

describe('calculateInterestCents — Actual/365', () => {
  it('$250,000 @ 5.25% for 31 days = 111,473 cents ($1,114.73)', () => {
    expect(calculateInterestCents(25_000_000, 0.0525, 31, 'actual365')).toBe(111_473)
  })

  it('$250,000 @ 5.25% for 28 days = 100,685 cents ($1,006.85)', () => {
    expect(calculateInterestCents(25_000_000, 0.0525, 28, 'actual365')).toBe(100_685)
  })

  it('0 days → 0 interest', () => {
    expect(calculateInterestCents(25_000_000, 0.0525, 0, 'actual365')).toBe(0)
  })

  it('result is a whole number (Math.round at final step)', () => {
    const result = calculateInterestCents(25_000_000, 0.0525, 31, 'actual365')
    expect(Number.isInteger(result)).toBe(true)
  })

  it('interest scales linearly with balance', () => {
    const half = calculateInterestCents(12_500_000, 0.0525, 31, 'actual365')
    const full = calculateInterestCents(25_000_000, 0.0525, 31, 'actual365')
    // Allow ±1 cent for independent rounding
    expect(Math.abs(full - half * 2)).toBeLessThanOrEqual(1)
  })
})

describe('calculateInterestCents — 30/360', () => {
  it('$250,000 @ 5.25% for 30 days = 109,375 cents ($1,093.75)', () => {
    expect(calculateInterestCents(25_000_000, 0.0525, 30, 'thirty360')).toBe(109_375)
  })

  it('0 days → 0 interest', () => {
    expect(calculateInterestCents(25_000_000, 0.0525, 0, 'thirty360')).toBe(0)
  })

  it('result is a whole number', () => {
    const result = calculateInterestCents(25_000_000, 0.0525, 30, 'thirty360')
    expect(Number.isInteger(result)).toBe(true)
  })
})

describe('calculateInterestCents — convention comparison', () => {
  it('Actual/365 and 30/360 produce different values for the same inputs', () => {
    const a365 = calculateInterestCents(25_000_000, 0.0525, 30, 'actual365')
    const t360 = calculateInterestCents(25_000_000, 0.0525, 30, 'thirty360')
    expect(a365).not.toBe(t360)
  })
})

describe('calculateInterestCents — leap year edge case', () => {
  // Actual/365 uses a FIXED 365-day denominator regardless of leap year (FR-8).
  // Feb 2028 has 29 days (leap year), but the denominator must still be 365.
  it('29-day Feb (leap year) uses 365 denominator, not 366', () => {
    // $100,000 @ 5.25% for 29 days:
    // Actual/365: Math.round(10_000_000 × 0.0525 × 29 / 365) = 41,712
    // If denominator were 366:  Math.round(10_000_000 × 0.0525 × 29 / 366) = 41,598  ← WRONG
    const result = calculateInterestCents(10_000_000, 0.0525, 29, 'actual365')
    expect(result).toBe(41_712)
    // Confirm it differs from the 366-denominator result
    const wrongResult = Math.round(10_000_000 * 0.0525 * 29 / 366)
    expect(result).not.toBe(wrongResult)
  })
})
