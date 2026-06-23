import { type Dispatch } from 'react'
import { format, parseISO } from 'date-fns'
import { FileDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fromCents } from '@/lib/money'
import { exportCSV, exportJSON } from '@/lib/export'
import type { Action, DayCountConvention, LedgerRow, LedgerState, Loan, LoanEvent } from '@/types/loan'

interface LoanLedgerProps {
  loan: Loan | null
  ledgerState: LedgerState | null
  events: LoanEvent[]
  selectedEventId: string | null
  dispatch: Dispatch<Action>
  payoffTodayCents: number
  convention: DayCountConvention
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border-subtle bg-bg-elevated p-4">
      <span className="text-[12px] text-text-secondary">{label}</span>
      <span
        className={cn(
          'font-mono text-[22px] font-semibold leading-tight',
          value !== null ? 'text-text-primary' : 'text-text-muted',
        )}
      >
        {value ?? '—'}
      </span>
    </div>
  )
}

// ── Type badge ─────────────────────────────────────────────────────────────

function TypeBadge({ row, events }: { row: LedgerRow; events: LoanEvent[] }) {
  // Original payment that was NSF'd — strike badge swaps
  if (row.isReversed) {
    return (
      <Badge
        variant="outline"
        className="border-accent-error/30 bg-accent-error/10 text-accent-error"
      >
        Payment · NSF
      </Badge>
    )
  }

  // Reversal row — badge shows original payment date
  if (row.type === 'payment_reversal') {
    const original = events.find(e => e.id === row.reversesEventId)
    const dateStr =
      original && original.date ? format(parseISO(original.date), 'MMM dd, yyyy') : ''
    return (
      <Badge
        variant="outline"
        className="border-accent-error/30 bg-accent-error/10 text-accent-error"
      >
        {dateStr ? `NSF Reversal · ${dateStr}` : 'NSF Reversal'}
      </Badge>
    )
  }

  const config: Record<string, { label: string; cls: string }> = {
    funding: {
      label: 'Funding',
      cls: 'border-accent-success/30 bg-accent-success/10 text-accent-success',
    },
    payment: {
      label: 'Payment',
      cls: 'border-accent-primary/30 bg-accent-primary/10 text-accent-primary',
    },
    additional_advance: {
      label: 'Advance',
      cls: 'border-accent-warning/30 bg-accent-warning/10 text-accent-warning',
    },
    payoff: {
      label: 'Payoff',
      cls: 'border-border-default bg-bg-hover text-text-secondary',
    },
  }

  const { label, cls } = config[row.type] ?? { label: row.type, cls: '' }

  return (
    <Badge variant="outline" className={cls}>
      {label}
    </Badge>
  )
}

// ── Ledger row ─────────────────────────────────────────────────────────────

function LedgerRow({
  row,
  events,
  isSelected,
  dispatch,
  hasEscrow,
}: {
  row: LedgerRow
  events: LoanEvent[]
  isSelected: boolean
  dispatch: Dispatch<Action>
  hasEscrow: boolean
}) {
  const isClickable = row.type === 'payment' || row.type === 'additional_advance'
  const isReversal = row.type === 'payment_reversal'
  const hasInterestSplit = row.type === 'payment' || row.type === 'payoff'

  const rowStyle: React.CSSProperties = isSelected
    ? { boxShadow: 'inset 2px 0 0 var(--color-accent-primary)' }
    : isReversal
      ? { boxShadow: 'inset 2px 0 0 var(--color-accent-error)' }
      : {}

  return (
    <tr
      className={cn(
        'h-11 border-b border-border-subtle transition-colors hover:bg-bg-hover',
        isClickable && 'cursor-pointer',
        isSelected && 'bg-bg-active',
        row.isReversed && 'opacity-50 [&>td]:line-through',
      )}
      style={rowStyle}
      onClick={
        isClickable
          ? () => dispatch({ type: 'SELECT_EVENT', payload: row.eventId })
          : undefined
      }
      aria-label={row.isReversed ? 'Reversed payment' : undefined}
    >
      {/* Date — empty for NSF reversal rows (date encoded in badge) */}
      <td className="px-3 text-left text-sm text-text-secondary whitespace-nowrap">
        {row.date ? format(parseISO(row.date), 'MMM dd, yyyy') : ''}
      </td>

      {/* Type badge */}
      <td className="px-3 text-left whitespace-nowrap">
        <TypeBadge row={row} events={events} />
      </td>

      {/* Amount */}
      <td className="px-3 text-right font-mono text-sm text-text-primary whitespace-nowrap">
        {isReversal ? '—' : fromCents(row.amountCents)}
      </td>

      {/* Interest — only meaningful for payment and payoff */}
      <td className="px-3 text-right font-mono text-sm text-text-primary whitespace-nowrap">
        {hasInterestSplit ? fromCents(row.interestCents) : '—'}
      </td>

      {/* Principal — only meaningful for payment and payoff; red when negative */}
      <td
        className={cn(
          'px-3 text-right font-mono text-sm whitespace-nowrap',
          row.isNegativePrincipal ? 'text-accent-error' : 'text-text-primary',
        )}
      >
        {hasInterestSplit ? fromCents(row.principalCents) : '—'}
      </td>

      {/* Escrow — only shown when loan has escrow configured */}
      {hasEscrow && (
        <td className="px-3 text-right font-mono text-sm text-text-primary whitespace-nowrap">
          {row.type === 'payment' ? fromCents(row.escrowCents) : '—'}
        </td>
      )}

      {/* Balance After — always shown */}
      <td className="px-3 text-right font-mono text-sm text-text-primary whitespace-nowrap">
        {fromCents(row.balanceAfterCents)}
      </td>
    </tr>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LoanLedger({
  loan,
  ledgerState,
  events,
  selectedEventId,
  dispatch,
  payoffTodayCents,
  convention,
}: LoanLedgerProps) {
  const isPaidOff = events.some(e => e.type === 'payoff')
  const hasData = ledgerState !== null && ledgerState.rows.length > 0
  const hasEscrow = (loan?.escrowMonthlyCents ?? 0) > 0

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      {/* Stat cards */}
      <div
        className="flex gap-3"
        aria-live="polite"
        aria-label="Loan statistics"
      >
        <StatCard
          label="Outstanding Balance"
          value={ledgerState ? fromCents(ledgerState.currentBalanceCents) : null}
        />
        <StatCard
          label="Accrued Interest"
          value={ledgerState && !isPaidOff ? fromCents(ledgerState.accruedInterestCents) : null}
        />
        <StatCard
          label="Next Payment"
          value={loan && !isPaidOff ? fromCents(loan.scheduledPaymentCents + loan.escrowMonthlyCents) : null}
        />
        {hasEscrow && (
          <StatCard
            label="Escrow Balance"
            value={ledgerState ? fromCents(ledgerState.escrowBalanceCents) : null}
          />
        )}
        <StatCard
          label="Payoff Today"
          value={loan ? fromCents(payoffTodayCents) : null}
        />
      </div>

      {/* Ledger table panel */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-surface">
        {/* Scrollable table area */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-border-subtle bg-bg-surface">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-left text-xs font-medium text-text-secondary whitespace-nowrap"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-left text-xs font-medium text-text-secondary whitespace-nowrap"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right text-xs font-medium text-text-secondary whitespace-nowrap"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right text-xs font-medium text-text-secondary whitespace-nowrap"
                >
                  Interest
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right text-xs font-medium text-text-secondary whitespace-nowrap"
                >
                  Principal
                </th>
                {hasEscrow && (
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right text-xs font-medium text-text-secondary whitespace-nowrap"
                  >
                    Escrow
                  </th>
                )}
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right text-xs font-medium text-text-secondary whitespace-nowrap"
                >
                  Balance After
                </th>
              </tr>
            </thead>
            <tbody>
              {!hasData ? (
                <tr>
                  <td
                    colSpan={hasEscrow ? 7 : 6}
                    className="py-16 text-center text-sm text-text-muted"
                  >
                    No events yet. Create a loan to get started.
                  </td>
                </tr>
              ) : (
                ledgerState!.rows.map(row => (
                  <LedgerRow
                    key={row.eventId}
                    row={row}
                    events={events}
                    isSelected={row.eventId === selectedEventId}
                    dispatch={dispatch}
                    hasEscrow={hasEscrow}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Convention note + export buttons */}
        <div className="flex items-center justify-between gap-4 border-t border-border-subtle px-4 py-2">
          {ledgerState && loan ? (() => {
            const bal = ledgerState.currentBalanceCents
            const rate = loan.annualRate
            const pd365 = Math.round(bal * rate / 365)
            const pd360 = Math.round(bal * rate / 360)
            return (
              <p className="text-[11px] text-text-muted">
                {convention === 'actual365'
                  ? 'Actual/365 active — leap years use a fixed 365-day denominator.'
                  : '30/360 active — each month treated as 30 days.'}
                {' '}
                Per diem: Actual/365 {fromCents(pd365)} · 30/360 {fromCents(pd360)}
              </p>
            )
          })() : (
            <p className="text-[11px] text-text-muted">
              {convention === 'actual365'
                ? 'Actual/365 active — leap years use a fixed 365-day denominator.'
                : '30/360 active — each month treated as 30 days.'}
            </p>
          )}

          <div className="flex shrink-0 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasData}
              onClick={() => exportCSV(ledgerState!.rows, hasEscrow)}
              className="h-7 gap-1 border-border-default bg-bg-elevated px-2.5 text-[11px] text-text-primary hover:bg-bg-hover disabled:opacity-40 dark:border-border-default dark:bg-bg-elevated dark:hover:bg-bg-hover"
            >
              <FileDown className="h-3 w-3" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!loan || !hasData}
              onClick={() => exportJSON(events, loan!)}
              className="h-7 gap-1 border-border-default bg-bg-elevated px-2.5 text-[11px] text-text-primary hover:bg-bg-hover disabled:opacity-40 dark:border-border-default dark:bg-bg-elevated dark:hover:bg-bg-hover"
            >
              <FileDown className="h-3 w-3" />
              JSON
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
