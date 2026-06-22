// Canadian amortization formula — semi-annual compounding converted to monthly rate.
//
// Step 1: effective monthly rate
//   r = (1 + annualRate / 2) ^ (1/6) - 1
//
// Step 2: monthly payment
//   M = P × [r(1+r)^n] / [(1+r)^n - 1]
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
  const paymentCents = principalCents * (r * factor) / (factor - 1)
  return Math.round(paymentCents)
}
