import { useMemo, useReducer, useState } from 'react'
import { loanReducer, initialState } from '@/reducer/loanReducer'
import { replayEvents } from '@/lib/replay'
import AppHeader from '@/components/AppHeader'
import Sidebar from '@/components/Sidebar'
import LoanSetup, { type LoanFormState, initialLoanFormState } from '@/components/LoanSetup'
import AddEvent from '@/components/AddEvent'

export default function App() {
  const [state, dispatch] = useReducer(loanReducer, initialState)
  const [sidebarSection, setSidebarSection] = useState<string>('loan-setup')

  // Lifted out of LoanSetup so values survive when Radix unmounts the accordion panel
  const [loanForm, setLoanForm] = useState<LoanFormState>(initialLoanFormState)
  function updateLoanForm(update: Partial<LoanFormState>) {
    setLoanForm((prev) => ({ ...prev, ...update }))
  }

  const ledgerState = useMemo(
    () => (state.loan ? replayEvents(state.events, state.loan, state.convention) : null),
    [state.events, state.loan, state.convention],
  )

  // ledgerState will be passed to LoanLedger in task 8
  void ledgerState

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-base">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          openSection={sidebarSection}
          onOpenSectionChange={setSidebarSection}
          loanSetupSlot={
            <LoanSetup
              loanExists={state.loan !== null}
              dispatch={dispatch}
              onLoanCreated={() => setSidebarSection('add-event')}
              formState={loanForm}
              onFormChange={updateLoanForm}
            />
          }
          addEventSlot={
            <AddEvent
              loan={state.loan}
              events={state.events}
              selectedEventId={state.selectedEventId}
              dispatch={dispatch}
            />
          }
        />
        <main className="flex flex-1 flex-col overflow-hidden p-4">
          {/* Stat cards + ledger table — task 8 */}
        </main>
      </div>
    </div>
  )
}
