import type { Action, AppState, Loan, LoanEvent } from '@/types/loan'
import { toCents } from '@/lib/money'
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
      const { principal, annualRate, amortizationYears, frequency, startDate, escrowMonthlyCents } = action.payload
      const scheduledPaymentCents = frequency === 'biweekly'
        ? calculateBiweeklyPaymentCents(toCents(principal), annualRate, amortizationYears)
        : calculateMonthlyPaymentCents(toCents(principal), annualRate, amortizationYears)
      const loan: Loan = { principal, annualRate, amortizationYears, frequency, startDate, scheduledPaymentCents, escrowMonthlyCents }
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
      // 13.2 — reversal guard: silently block double-reversals
      if (
        action.payload.type === 'payment_reversal' &&
        isAlreadyReversed(action.payload.reversesEventId, state.events)
      ) return state
      const newEvent = { ...action.payload, id: crypto.randomUUID() } as LoanEvent
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
