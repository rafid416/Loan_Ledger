import { format, parseISO } from 'date-fns'
import type { LedgerRow, Loan, LoanEvent } from '@/types/loan'

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Delay revoke so the browser has time to start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

function dec(cents: number): string {
  return (cents / 100).toFixed(2)
}

// 16.1 — CSV export. Monetary columns are plain decimals (no $ symbol) so Excel
// treats them as numbers. Escrow column included only when the loan has escrow.
export function exportCSV(rows: LedgerRow[], hasEscrow: boolean): void {
  const headers = [
    'Date',
    'Type',
    'Amount',
    'Interest',
    'Principal',
    ...(hasEscrow ? ['Escrow'] : []),
    'Balance After',
    'Reversed',
  ]

  const lines = rows.map(row => {
    const date = row.date ? format(parseISO(row.date), 'yyyy-MM-dd') : ''
    const isReversal = row.type === 'payment_reversal'
    const hasInterestSplit = row.type === 'payment' || row.type === 'payoff'

    const cells = [
      date,
      row.type,
      isReversal ? '' : dec(row.amountCents),
      hasInterestSplit ? dec(row.interestCents) : '',
      hasInterestSplit ? dec(row.principalCents) : '',
      ...(hasEscrow ? [row.type === 'payment' ? dec(row.escrowCents) : ''] : []),
      dec(row.balanceAfterCents),
      row.isReversed ? 'true' : '',
    ]

    return cells.map(c => `"${c}"`).join(',')
  })

  downloadBlob([headers.join(','), ...lines].join('\r\n'), 'loan-ledger.csv', 'text/csv')
}

// 16.2 — JSON export. Exports the full event list + loan terms — enough to replay
// the ledger from scratch on any compliant implementation.
// Cents fields are converted to dollars so the output is consistent with the
// other dollar-denominated fields (principal, annualRate) and readable without
// knowing the internal representation.
export function exportJSON(events: LoanEvent[], loan: Loan): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    loan: {
      principal: loan.principal,
      annualRate: loan.annualRate,
      amortizationYears: loan.amortizationYears,
      frequency: loan.frequency,
      startDate: loan.startDate,
      scheduledPayment: loan.scheduledPaymentCents / 100,
      escrowMonthly: loan.escrowMonthlyCents / 100,
    },
    events,
  }
  downloadBlob(JSON.stringify(payload, null, 2), 'loan-ledger.json', 'application/json')
}
