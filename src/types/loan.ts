// 2.5
export type DayCountConvention = 'actual365' | 'thirty360'

// 2.1 — scheduledPaymentCents and escrowMonthlyCents stored in cents; other monetary fields in dollars
export interface Loan {
  principal: number          // dollars
  annualRate: number         // decimal (e.g. 0.05 for 5%)
  amortizationYears: number
  frequency: 'monthly' | 'biweekly'
  startDate: string          // ISO date string YYYY-MM-DD
  scheduledPaymentCents: number
  escrowMonthlyCents: number // 0 when no escrow configured
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
  date: string | null        // ISO date string; null for reversal rows (display layer leaves cell blank)
  type: LoanEvent['type']
  amountCents: number
  interestCents: number
  principalCents: number
  escrowCents: number        // 0 for non-payment rows or when no escrow configured
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
  escrowBalanceCents: number // running total of escrow collected across all payments
}

// 2.6
export interface AppState {
  loan: Loan | null
  events: LoanEvent[]
  convention: DayCountConvention
  selectedEventId: string | null
}

// Events the user can post after loan creation — funding is excluded (only created via CREATE_LOAN)
export type PostableEvent = Extract<LoanEvent, { type: 'payment' | 'additional_advance' | 'payment_reversal' | 'payoff' }>

// 2.7 — Action discriminated union for useReducer.
// CREATE_LOAN omits scheduledPaymentCents — the reducer computes it. escrowMonthlyCents comes from the form.
// ADD_EVENT omits id — the reducer generates it with crypto.randomUUID().
export type Action =
  | { type: 'CREATE_LOAN';    payload: Omit<Loan, 'scheduledPaymentCents'> }
  | { type: 'RESET_LOAN' }
  | { type: 'ADD_EVENT';      payload: Omit<PostableEvent, 'id'> }
  | { type: 'SET_CONVENTION'; payload: DayCountConvention }
  | { type: 'SELECT_EVENT';   payload: string | null }
