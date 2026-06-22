import { useMemo, useReducer } from 'react'
import { loanReducer, initialState } from '@/reducer/loanReducer'
import { replayEvents } from '@/lib/replay'

export default function App() {
  const [state, dispatch] = useReducer(loanReducer, initialState)

  // 4.8 — pure derived state; never call replayEvents inside child components
  const ledgerState = useMemo(
    () => (state.loan ? replayEvents(state.events, state.loan, state.convention) : null),
    [state.events, state.loan, state.convention],
  )

  // dispatch and ledgerState will be passed to child components in task 5+
  void dispatch
  void ledgerState

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <p className="p-4">Loan Ledger</p>
    </div>
  )
}
