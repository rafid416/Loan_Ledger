// Single conversion boundary for dollars ↔ cents.
// toCents: called once per event at the top of each replay handler.
// fromCents: called only at the display layer (LoanLedger.tsx).
// Never call either function in the reducer, form submit, or anywhere else.

export function toCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function fromCents(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}
