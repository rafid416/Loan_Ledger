import { differenceInDays, parseISO } from 'date-fns'
import type { DayCountConvention } from '@/types/loan'

// Returns the number of calendar days between two ISO date strings.
// Uses date-fns parseISO to avoid timezone off-by-one errors from native Date().
// Note: replayEvents sorts events by date before walking. When two events share
// the same date, insertion order (array index) is the tiebreaker — not this function.
export function daysBetween(dateA: string, dateB: string): number {
  return differenceInDays(parseISO(dateB), parseISO(dateA))
}

// 30/360 day count per FR-20: (Y2-Y1)×360 + (M2-M1)×30 + (D2-D1)
// Every month is treated as exactly 30 days; Feb 28/29 and 31-day months
// are normalized to 30. Used when convention === 'thirty360'.
export function thirtyThreeSixtyDays(dateA: string, dateB: string): number {
  const a = parseISO(dateA)
  const b = parseISO(dateB)
  return (
    (b.getFullYear() - a.getFullYear()) * 360 +
    (b.getMonth() - a.getMonth()) * 30 +
    (b.getDate() - a.getDate())
  )
}

// Dispatcher — pick the correct day-count function for the active convention.
export function daysFor(dateA: string, dateB: string, convention: DayCountConvention): number {
  return convention === 'thirty360'
    ? thirtyThreeSixtyDays(dateA, dateB)
    : daysBetween(dateA, dateB)
}
