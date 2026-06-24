import type { Action, AppState, Loan, LoanEvent, PostableEvent } from '@/types/loan'
import { calculateMonthlyPaymentCents, calculateBiweeklyPaymentCents } from '@/lib/amortization'
import { isAlreadyReversed } from '@/lib/replay'

export const initialState: AppState = {
  loan: null,
  events: [],
  convention: 'actual365',
  selectedEventId: null,
}

export function loanReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CREATE_LOAN': {
      // 4.2 — compute monthlyPaymentCents here; the form never owns this calculation
      const { principal, annualRate, amortizationYears, frequency, startDate, escrowMonthly } = action.payload
      const principalCents = Math.round(principal * 100)
      const scheduledPaymentCents = frequency === 'biweekly'
        ? calculateBiweeklyPaymentCents(principalCents, annualRate, amortizationYears)
        : calculateMonthlyPaymentCents(principalCents, annualRate, amortizationYears)
      const loan: Loan = { principal, annualRate, amortizationYears, frequency, startDate, scheduledPaymentCents, escrowMonthlyCents: Math.round(escrowMonthly * 100) }
      const fundingEvent: Extract<LoanEvent, { type: 'funding' }> = {
        id: crypto.randomUUID(),
        type: 'funding',
        date: startDate,
        amount: principal,
      }
      // Spread initialState so re-creating always starts from a clean slate
      return { ...initialState, loan, events: [fundingEvent] }
    }

    case 'RESET_LOAN':
      // 4.3 — wipe all state back to initial
      return initialState

    case 'ADD_EVENT': {
      // 4.4 — terminal guard: no events after payoff
      if (state.events.some(e => e.type === 'payoff')) return state
      // 13.2 — reversal guard: only payments are reversible; block double-reversals
      if (action.payload.type === 'payment_reversal') {
        // Destructure while the payload is narrowed to the reversal variant. TypeScript
        // discards narrowing of a property access (action.payload) inside the .find()
        // closure below, so we bind the fields to consts here where the narrowing holds.
        const { reversesEventId, date } = action.payload
        const target = state.events.find(e => e.id === reversesEventId)
        if (!target || target.type !== 'payment') return state
        if (isAlreadyReversed(reversesEventId, state.events)) return state
        // A reversal must not predate its target payment. replayEvents sorts by date,
        // so an earlier-dated reversal would process *before* the payment, fail to find
        // its row, and silently no-op — yet isAlreadyReversed would still mark the payment
        // un-reversible, leaving the ledger and the reversible-events list disagreeing.
        // Dates are zero-padded ISO (YYYY-MM-DD), so string comparison is chronological.
        if (date < target.date) return state
      }
      const newEvent: PostableEvent = { ...action.payload, id: crypto.randomUUID() }
      return { ...state, events: [...state.events, newEvent] }
    }

    case 'SET_CONVENTION':
      // 4.5 — replayEvents is memoised on convention; figures update on next render
      return { ...state, convention: action.payload }

    case 'SELECT_EVENT':
      // 4.6 — toggle: clicking the same row again deselects
      return {
        ...state,
        selectedEventId: state.selectedEventId === action.payload ? null : action.payload,
      }

    default:
      return state
  }
}
