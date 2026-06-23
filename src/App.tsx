import { useMemo, useReducer, useState } from 'react'
import { loanReducer, initialState } from '@/reducer/loanReducer'
import { replayEvents } from '@/lib/replay'
import AppHeader from '@/components/AppHeader'
import Sidebar from '@/components/Sidebar'

export default function App() {
  const [state, dispatch] = useReducer(loanReducer, initialState)
  const [sidebarSection, setSidebarSection] = useState<string>('loan-setup')

  const ledgerState = useMemo(
    () => (state.loan ? replayEvents(state.events, state.loan, state.convention) : null),
    [state.events, state.loan, state.convention],
  )

  // dispatch, state, ledgerState will be wired to panels in tasks 6–8
  void dispatch
  void state
  void ledgerState

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-base">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          openSection={sidebarSection}
          onOpenSectionChange={setSidebarSection}
        />
        <main className="flex flex-1 flex-col overflow-hidden p-4">
          {/* Stat cards + ledger table — task 8 */}
        </main>
      </div>
    </div>
  )
}
