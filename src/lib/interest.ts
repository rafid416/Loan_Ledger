import type { DayCountConvention } from '@/types/loan'

// Actual/365: fixed 365-day denominator regardless of leap year (per spec FR-8).
// 30/360: 360-day denominator.
// Math.round() applied at the final step only — all intermediate values retain
// full float precision to avoid compounding rounding errors across payments.

export function calculateInterestCents(
  balanceCents: number,
  annualRate: number,
  days: number,
  convention: DayCountConvention,
): number {
  const denominator = convention === 'actual365' ? 365 : 360
  return Math.round(balanceCents * annualRate * days / denominator)
}
