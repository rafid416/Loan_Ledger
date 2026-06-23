import { type Dispatch, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Action, DayCountConvention } from '@/types/loan'

interface AppHeaderProps {
  convention: DayCountConvention
  dispatch: Dispatch<Action>
}

export default function AppHeader({ convention, dispatch }: AppHeaderProps) {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  function setConvention(value: DayCountConvention) {
    dispatch({ type: 'SET_CONVENTION', payload: value })
  }

  const segments: { label: string; value: DayCountConvention }[] = [
    { label: 'Actual/365', value: 'actual365' },
    { label: '30/360', value: 'thirty360' },
  ]

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-4">
      <span className="text-[20px] font-semibold text-text-primary">Loan Ledger</span>

      <div className="flex items-center gap-3">
        {/* Day-count convention segmented control */}
        <div
          className="inline-flex items-center gap-0.5 rounded-lg bg-bg-elevated p-1"
          role="radiogroup"
          aria-label="Day-count convention"
        >
          {segments.map(seg => (
            <button
              key={seg.value}
              role="radio"
              aria-checked={convention === seg.value}
              onClick={() => setConvention(seg.value)}
              className={
                convention === seg.value
                  ? 'rounded-md bg-bg-surface dark:bg-zinc-700 px-3 py-1 text-xs font-medium text-text-primary shadow-sm ring-1 ring-border-subtle transition-all'
                  : 'rounded-md px-3 py-1 text-xs text-text-secondary transition-all hover:text-text-primary'
              }
            >
              {seg.label}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>
    </header>
  )
}
