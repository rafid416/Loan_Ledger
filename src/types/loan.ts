// 2.5
export type DayCountConvention = 'actual365' | 'thirty360'

// 2.1 — monthlyPaymentCents stored in cents; all other monetary fields in dollars per spec
export interface Loan {
  principal: number          // dollars
  annualRate: number         // decimal (e.g. 0.05 for 5%)
  amortizationYears: number
  frequency: 'monthly'
  startDate: string          // ISO date string YYYY-MM-DD
  monthlyPaymentCents: number
}

// 2.2 — LoanEvent discriminated union per FR-5.
// amounts are stored in dollars (number) per the spec type definition.
// toCents() is called once per event handler inside replayEvents — never in the reducer or form.
export type LoanEvent =
  | { id: string; type: 'funding';            date: string; amount: number }
  | { id: string; type: 'payment';            date: string; amount: number }
  | { id: string; type: 'additional_advance'; date: string; amount: number }
  | { id: string; type: 'payment_reversal';   date: string; reversesEventId: string }
  | { id: string; type: 'payoff';             date: string }

// 2.3
export interface LedgerRow {
  eventId: string
  date: string               // ISO date string; empty string for reversal rows (display layer leaves cell blank)
  type: LoanEvent['type']
  amountCents: number
  interestCents: number
  principalCents: number
  balanceAfterCents: number
  isReversed: boolean
  reversedByEventId: string | null
  reversesEventId: string | null
  isNegativePrincipal: boolean
}

// 2.4
export interface LedgerState {
  rows: LedgerRow[]
  currentBalanceCents: number
  accruedInterestCents: number
  payoffTodayCents: number
}

// 2.6
export interface AppState {
  loan: Loan | null
  events: LoanEvent[]
  convention: DayCountConvention
  selectedEventId: string | null
}

// 2.7 — Action discriminated union for useReducer
export type Action =
  | { type: 'CREATE_LOAN';    payload: Loan }
  | { type: 'RESET_LOAN' }
  | { type: 'ADD_EVENT';      payload: LoanEvent }
  | { type: 'SET_CONVENTION'; payload: DayCountConvention }
  | { type: 'SELECT_EVENT';   payload: string | null }
