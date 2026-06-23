import { type Dispatch, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Action } from '@/types/loan'
import { calculateMonthlyPaymentCents } from '@/lib/amortization'
import { toCents, fromCents } from '@/lib/money'

// Exported so App.tsx can own this state, preserving values when the
// accordion section is unmounted (Radix default behaviour without forceMount).
export interface LoanFormState {
  principal: string
  annualRate: string
  amortizationYears: string
  startDate: string
  touched: Set<string>
}

export const initialLoanFormState: LoanFormState = {
  principal: '',
  annualRate: '',
  amortizationYears: '',
  startDate: '',
  touched: new Set(),
}

interface LoanSetupProps {
  loanExists: boolean
  dispatch: Dispatch<Action>
  onLoanCreated: () => void
  formState: LoanFormState
  onFormChange: (update: Partial<LoanFormState>) => void
}

interface FormErrors {
  principal?: string
  annualRate?: string
  amortizationYears?: string
  startDate?: string
}

export default function LoanSetup({
  loanExists,
  dispatch,
  onLoanCreated,
  formState,
  onFormChange,
}: LoanSetupProps) {
  const { principal, annualRate, amortizationYears, startDate, touched } = formState

  const errors = useMemo<FormErrors>(() => {
    const errs: FormErrors = {}
    const p = parseFloat(principal)
    const r = parseFloat(annualRate)
    const y = parseInt(amortizationYears)
    if (principal !== '' && (isNaN(p) || p <= 0)) errs.principal = 'Principal must be greater than 0'
    if (annualRate !== '' && (isNaN(r) || r <= 0 || r > 100)) errs.annualRate = 'Rate must be between 0 and 100'
    if (amortizationYears !== '' && (isNaN(y) || y < 1)) errs.amortizationYears = 'Amortization must be at least 1 year'
    if (startDate === '') errs.startDate = 'Start date is required'
    return errs
  }, [principal, annualRate, amortizationYears, startDate])

  const isFormValid = useMemo(() => {
    const p = parseFloat(principal)
    const r = parseFloat(annualRate)
    const y = parseInt(amortizationYears)
    return (
      !isNaN(p) && p > 0 &&
      !isNaN(r) && r > 0 && r <= 100 &&
      !isNaN(y) && y >= 1 &&
      startDate !== ''
    )
  }, [principal, annualRate, amortizationYears, startDate])

  const previewPaymentCents = useMemo(() => {
    const p = parseFloat(principal)
    const r = parseFloat(annualRate) / 100
    const y = parseInt(amortizationYears)
    if (isNaN(p) || p <= 0 || isNaN(r) || r <= 0 || isNaN(y) || y < 1) return null
    return calculateMonthlyPaymentCents(toCents(p), r, y)
  }, [principal, annualRate, amortizationYears])

  function touch(field: string) {
    onFormChange({ touched: new Set([...touched, field]) })
  }

  function showError(field: keyof FormErrors) {
    return touched.has(field) ? errors[field] : undefined
  }

  function handleSubmit() {
    if (!isFormValid) {
      onFormChange({ touched: new Set(['principal', 'annualRate', 'amortizationYears', 'startDate']) })
      return
    }
    dispatch({
      type: 'CREATE_LOAN',
      payload: {
        principal: parseFloat(principal),
        annualRate: parseFloat(annualRate) / 100,
        amortizationYears: parseInt(amortizationYears),
        frequency: 'monthly',
        startDate,
      },
    })
    onLoanCreated()
  }

  function handleReset() {
    dispatch({ type: 'RESET_LOAN' })
    onFormChange(initialLoanFormState)
  }

  const wrapperCls = (hasError?: string) =>
    cn(
      'flex h-9 items-center rounded-lg border bg-bg-elevated px-3 text-sm transition-colors focus-within:ring-2',
      hasError
        ? 'border-accent-error focus-within:ring-accent-error/50'
        : 'border-border-default focus-within:border-border-focus focus-within:ring-border-focus/30',
    )

  const inputCls = 'flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none min-w-0'

  const standaloneCls = (hasError?: string) =>
    cn(
      'h-9 w-full rounded-lg border bg-bg-elevated px-3 text-sm text-text-primary outline-none transition-colors focus:ring-2 dark:[color-scheme:dark]',
      hasError
        ? 'border-accent-error focus:ring-accent-error/50'
        : 'border-border-default focus:border-border-focus focus:ring-border-focus/30',
    )

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Principal */}
      <div className="flex flex-col gap-1">
        <label htmlFor="principal" className="text-sm font-medium text-text-primary">
          Principal
        </label>
        <div className={wrapperCls(showError('principal'))}>
          <span className="mr-1.5 text-text-secondary">$</span>
          <input
            id="principal"
            type="number"
            min="0.01"
            step="0.01"
            value={principal}
            onChange={(e) => onFormChange({ principal: e.target.value })}
            onBlur={() => touch('principal')}
            placeholder="250000"
            className={inputCls}
          />
        </div>
        {showError('principal') && (
          <p className="text-[12px] text-accent-error">{showError('principal')}</p>
        )}
      </div>

      {/* Annual Rate */}
      <div className="flex flex-col gap-1">
        <label htmlFor="annualRate" className="text-sm font-medium text-text-primary">
          Annual Rate (%)
        </label>
        <div className={wrapperCls(showError('annualRate'))}>
          <input
            id="annualRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={annualRate}
            onChange={(e) => onFormChange({ annualRate: e.target.value })}
            onBlur={() => touch('annualRate')}
            placeholder="5.25"
            className={inputCls}
          />
          <span className="ml-1.5 text-text-secondary">%</span>
        </div>
        {showError('annualRate') && (
          <p className="text-[12px] text-accent-error">{showError('annualRate')}</p>
        )}
      </div>

      {/* Amortization Years */}
      <div className="flex flex-col gap-1">
        <label htmlFor="amortizationYears" className="text-sm font-medium text-text-primary">
          Amortization (years)
        </label>
        <input
          id="amortizationYears"
          type="number"
          min="1"
          step="1"
          value={amortizationYears}
          onChange={(e) => onFormChange({ amortizationYears: e.target.value })}
          onBlur={() => touch('amortizationYears')}
          placeholder="25"
          className={standaloneCls(showError('amortizationYears'))}
        />
        {showError('amortizationYears') && (
          <p className="text-[12px] text-accent-error">{showError('amortizationYears')}</p>
        )}
      </div>

      {/* Payment Frequency — locked in v1 */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-primary">Payment Frequency</span>
        <div className="flex h-9 items-center rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-secondary">
          Monthly
        </div>
      </div>

      {/* Start Date */}
      <div className="flex flex-col gap-1">
        <label htmlFor="startDate" className="text-sm font-medium text-text-primary">
          Start Date
        </label>
        <input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => onFormChange({ startDate: e.target.value })}
          onBlur={() => touch('startDate')}
          className={standaloneCls(showError('startDate'))}
        />
        {showError('startDate') && (
          <p className="text-[12px] text-accent-error">{showError('startDate')}</p>
        )}
      </div>

      {/* Live monthly payment preview */}
      {previewPaymentCents !== null && (
        <p className="text-sm text-text-secondary">
          Monthly Payment:{' '}
          <span className="font-mono font-medium text-text-primary">
            {fromCents(previewPaymentCents)}
          </span>
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!isFormValid}
        className="w-full bg-accent-primary text-white hover:bg-accent-primary/90 disabled:opacity-40"
      >
        Create Loan
      </Button>

      {loanExists && (
        <Button variant="destructive" onClick={handleReset} className="w-full">
          Reset Loan
        </Button>
      )}
    </div>
  )
}
