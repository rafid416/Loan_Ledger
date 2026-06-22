import { differenceInDays, parseISO } from 'date-fns'

// Returns the number of calendar days between two ISO date strings.
// Uses date-fns parseISO to avoid timezone off-by-one errors from native Date().
// Note: replayEvents sorts events by date before walking. When two events share
// the same date, insertion order (array index) is the tiebreaker — not this function.
export function daysBetween(dateA: string, dateB: string): number {
  return differenceInDays(parseISO(dateB), parseISO(dateA))
}
