import { type Dispatch, useState, useEffect, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toCents, fromCents } from '@/lib/money'
import { getReversibleEvents } from '@/lib/replay'
import type { Action, Loan, LoanEvent } from '@/types/loan'

type EventType = 'payment' | 'additional_advance' | 'payment_reversal' | 'payoff'

interface AddEventProps {
  loan: Loan | null
  events: LoanEvent[]
  selectedEventId: string | null
  dispatch: Dispatch<Action>
}

const SUBMIT_LABELS: Record<EventType, string> = {
  payment: 'Post Payment',
  additional_advance: 'Post Advance',
  payment_reversal: 'Post Reversal',
  payoff: 'Close Loan (Payoff)',
}

export default function AddEvent({ loan, events, selectedEventId, dispatch }: AddEventProps) {
  const isPaidOff = useMemo(() => events.some(e => e.type === 'payoff'), [events])
  const reversibleEvents = useMemo(() => getReversibleEvents(events), [events])
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const [eventType, setEventType] = useState<EventType>('payment')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState(() =>
    loan ? (loan.monthlyPaymentCents / 100).toFixed(2) : '',
  )
  const [reversesEventId, setReversesEventId] = useState('')
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // When app state selects an event (e.g., user clicks a ledger row), switch to reversal mode
  useEffect(() => {
    if (selectedEventId) {
      setEventType('payment_reversal')
      setReversesEventId(selectedEventId)
      setTouched(new Set())
      setSubmitAttempted(false)
    }
  }, [selectedEventId])

  function handleEventTypeChange(newType: EventType) {
    setEventType(newType)
    setTouched(new Set())
    setSubmitAttempted(false)

    setDate(newType === 'payoff' ? today : '')
    setAmount(newType === 'payment' && loan ? (loan.monthlyPaymentCents / 100).toFixed(2) : '')
    if (newType !== 'payment_reversal') setReversesEventId('')
  }

  const amountVal = parseFloat(amount)
  const amountValid = !isNaN(amountVal) && amountVal > 0

  const isValid = useMemo(() => {
    switch (eventType) {
      case 'payment':
      case 'additional_advance':
        return date !== '' && amountValid
      case 'payment_reversal':
        return date !== '' && reversesEventId !== ''
      case 'payoff':
        return date !== ''
    }
  }, [eventType, date, amountValid, reversesEventId])

  function touch(field: string) {
    setTouched(prev => new Set([...prev, field]))
  }

  function showError(field: string, invalid: boolean): boolean {
    return invalid && (touched.has(field) || submitAttempted)
  }

  function handleSubmit() {
    setSubmitAttempted(true)
    if (!isValid) return

    switch (eventType) {
      case 'payment':
        dispatch({ type: 'ADD_EVENT', payload: { type: 'payment', date, amount: parseFloat(amount) } })
        break
      case 'additional_advance':
        dispatch({
          type: 'ADD_EVENT',
          payload: { type: 'additional_advance', date, amount: parseFloat(amount) },
        })
        break
      case 'payment_reversal':
        dispatch({ type: 'ADD_EVENT', payload: { type: 'payment_reversal', date, reversesEventId } })
        dispatch({ type: 'SELECT_EVENT', payload: null })
        break
      case 'payoff':
        dispatch({ type: 'ADD_EVENT', payload: { type: 'payoff', date } })
        break
    }

    // Reset form to defaults after posting
    setDate(eventType === 'payoff' ? today : '')
    setAmount(eventType === 'payment' && loan ? (loan.monthlyPaymentCents / 100).toFixed(2) : '')
    setReversesEventId('')
    setTouched(new Set())
    setSubmitAttempted(false)
  }

  const standaloneCls = (error?: boolean) =>
    cn(
      'h-9 w-full rounded-lg border bg-bg-elevated px-3 text-sm text-text-primary outline-none transition-colors focus:ring-2 dark:[color-scheme:dark]',
      error
        ? 'border-accent-error focus:ring-accent-error/50'
        : 'border-border-default focus:border-border-focus focus:ring-border-focus/30',
    )

  const wrapperCls = (error?: boolean) =>
    cn(
      'flex h-9 items-center rounded-lg border bg-bg-elevated px-3 text-sm transition-colors focus-within:ring-2',
      error
        ? 'border-accent-error focus-within:ring-accent-error/50'
        : 'border-border-default focus-within:border-border-focus focus-within:ring-border-focus/30',
    )

  const inputCls = 'flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none min-w-0'

  const triggerCls = (error?: boolean) =>
    cn(
      'w-full bg-bg-elevated border text-sm text-text-primary dark:bg-bg-elevated dark:hover:bg-bg-hover',
      error ? 'border-accent-error' : 'border-border-default',
    )

  if (!loan) {
    return (
      <div className="pb-4">
        <p className="text-sm text-text-muted">Create a loan first to add events.</p>
      </div>
    )
  }

  if (isPaidOff) {
    return (
      <div className="pb-4">
        <p className="text-sm text-text-muted">
          This loan has been paid off. No further events can be posted.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Event Type */}
      <div className="flex flex-col gap-1">
        <label id="event-type-label" className="text-sm font-medium text-text-primary">
          Event Type
        </label>
        <Select value={eventType} onValueChange={v => handleEventTypeChange(v as EventType)}>
          <SelectTrigger className={triggerCls()} aria-labelledby="event-type-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="payment">Payment</SelectItem>
            <SelectItem value="additional_advance">Additional Advance</SelectItem>
            <SelectItem value="payment_reversal">Payment Reversal (NSF)</SelectItem>
            <SelectItem value="payoff">Payoff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1">
        <label htmlFor="event-date" className="text-sm font-medium text-text-primary">
          Date
        </label>
        <input
          id="event-date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          onBlur={() => touch('date')}
          className={standaloneCls(showError('date', date === ''))}
        />
        {showError('date', date === '') && (
          <p className="text-[12px] text-accent-error">Date is required</p>
        )}
      </div>

      {/* Amount — Payment and Additional Advance only */}
      {(eventType === 'payment' || eventType === 'additional_advance') && (
        <div className="flex flex-col gap-1">
          <label htmlFor="event-amount" className="text-sm font-medium text-text-primary">
            Amount
          </label>
          <div className={wrapperCls(showError('amount', !amountValid))}>
            <span className="mr-1.5 text-text-secondary">$</span>
            <input
              id="event-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onBlur={() => touch('amount')}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
          {showError('amount', !amountValid) && (
            <p className="text-[12px] text-accent-error">Amount must be greater than 0</p>
          )}
        </div>
      )}

      {/* Reversal Target — Payment Reversal (NSF) only */}
      {eventType === 'payment_reversal' && (
        <div className="flex flex-col gap-1">
          <label id="reversal-label" className="text-sm font-medium text-text-primary">
            Reverse Payment
          </label>
          {reversibleEvents.length === 0 ? (
            <p className="text-sm text-text-muted">No payments available to reverse.</p>
          ) : (
            <>
              <Select value={reversesEventId} onValueChange={setReversesEventId}>
                <SelectTrigger
                  className={triggerCls(showError('reversesEventId', reversesEventId === ''))}
                  aria-labelledby="reversal-label"
                >
                  <SelectValue placeholder="Select a payment…" />
                </SelectTrigger>
                <SelectContent>
                  {reversibleEvents.map(event => {
                    const label =
                      event.type === 'payment' || event.type === 'additional_advance'
                        ? `${format(parseISO(event.date), 'MMM dd, yyyy')} — ${fromCents(toCents(event.amount))}`
                        : event.id
                    return (
                      <SelectItem key={event.id} value={event.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {showError('reversesEventId', reversesEventId === '') && (
                <p className="text-[12px] text-accent-error">Select a payment to reverse</p>
              )}
            </>
          )}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!isValid}
        className="w-full bg-accent-primary text-white hover:bg-accent-primary/90 disabled:opacity-40"
      >
        {SUBMIT_LABELS[eventType]}
      </Button>
    </div>
  )
}
