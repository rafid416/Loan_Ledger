// Canadian amortization — semi-annual compounding converted to periodic rate.
//
// Monthly:   r = (1 + annualRate/2)^(1/6)  - 1   (6 months per semi-annual period)
// Bi-weekly: r = (1 + annualRate/2)^(1/13) - 1   (13 bi-weekly periods per semi-annual period)
//
// Payment:   M = P × [r(1+r)^n] / [(1+r)^n - 1]
//
// annualRate is a decimal (e.g. 0.05 for 5%).
// Result is rounded to the nearest cent at the final step only.

export function calculateMonthlyPaymentCents(
  principalCents: number,
  annualRate: number,
  amortizationYears: number,
): number {
  const n = amortizationYears * 12
  const r = Math.pow(1 + annualRate / 2, 1 / 6) - 1
  const factor = Math.pow(1 + r, n)
  return Math.round(principalCents * (r * factor) / (factor - 1))
}

export function calculateBiweeklyPaymentCents(
  principalCents: number,
  annualRate: number,
  amortizationYears: number,
): number {
  const n = amortizationYears * 26
  const r = Math.pow(1 + annualRate / 2, 1 / 13) - 1
  const factor = Math.pow(1 + r, n)
  return Math.round(principalCents * (r * factor) / (factor - 1))
}
