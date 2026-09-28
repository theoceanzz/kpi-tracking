import { format, parse, parseISO } from 'date-fns'
import type { CycleRef } from '../types/cycleLock'

/** dd/MM/yyyy, '—' khi trống. */
export const fmtDay = (iso: string | null | undefined) => (iso ? format(parseISO(iso), 'dd/MM/yyyy') : '—')
/** ISO → yyyy-MM-dd cho ô chọn ngày. */
export const toDay = (iso: string | null | undefined) => (iso ? format(parseISO(iso), 'yyyy-MM-dd') : '')
export const startOfDayIso = (day: string) => parse(day, 'yyyy-MM-dd', new Date()).toISOString()
export const endOfDayIso = (day: string) => {
  const d = parse(day, 'yyyy-MM-dd', new Date())
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

/** Đợt có nằm trọn trong kỳ đích không (so theo mốc thời gian thật). */
export function fitsIn(start: string | null, end: string | null, target: CycleRef | undefined) {
  if (!target?.startDate || !target.endDate || !start || !end) return true
  return new Date(start) >= new Date(target.startDate) && new Date(end) <= new Date(target.endDate)
}
