import { isAfter, parseISO } from 'date-fns'
import type { KpiCriteria } from '@/types/kpi'

/** Hạn của lần nộp kế tiếp — chia đều cửa sổ đợt cho số lần nộp kỳ vọng. */
export function getNextDeadline(kpi: KpiCriteria): Date | null {
  const cutoff = kpi.effectiveDeadline ?? kpi.kpiPeriod?.endDate
  if (!kpi.kpiPeriod?.startDate || !cutoff) return null
  const start = parseISO(kpi.kpiPeriod.startDate).getTime()
  const end = parseISO(cutoff).getTime()

  if (kpi.frequency === 'UNLIMITED') return new Date(end)
  const totalSubmissions = kpi.expectedSubmissions || 1
  const currentSub = kpi.submissionCount || 0
  if (currentSub >= totalSubmissions) return new Date(end)
  const duration = end - start
  const subDuration = duration / totalSubmissions
  return new Date(start + (currentSub + 1) * subDuration)
}

export interface KpiWorkState {
  /** Đã nộp đủ số lần kỳ vọng. */
  done: boolean
  /** Đợt đã mở (tới ngày bắt đầu). */
  started: boolean
  /** Đợt đã kết thúc. */
  ended: boolean
  /** Còn phải nộp mà hạn lần kế tiếp đã qua. */
  overdue: boolean
  /** Hạn lần nộp kế tiếp. */
  nextDeadline: Date | null
  submitted: number
  expected: number
}

/**
 * Trạng thái làm việc của một KPI dưới góc nhìn NGƯỜI NHẬN: còn phải nộp không, quá hạn chưa.
 * Dùng chung cho KPI của tôi, OKR của tôi và BSC của tôi để ba trang nói cùng một thứ.
 */
export function kpiWorkState(kpi: KpiCriteria, now: Date = new Date()): KpiWorkState {
  const expected = kpi.expectedSubmissions || 1
  const submitted = kpi.submissionCount || 0
  const done = submitted >= expected
  const started = !kpi.kpiPeriod?.startDate || !isAfter(parseISO(kpi.kpiPeriod.startDate), now)
  const ended = !!kpi.kpiPeriod?.endDate && isAfter(now, parseISO(kpi.kpiPeriod.endDate))
  const nextDeadline = getNextDeadline(kpi)
  const overdue = !done && !!nextDeadline && isAfter(now, nextDeadline)
  return { done, started, ended, overdue, nextDeadline, submitted, expected }
}

/** KPI đang thuộc về người dùng và còn hiệu lực (đã duyệt / đã sửa). */
export const isMyActiveKpi = (kpi: KpiCriteria, userId?: string) =>
  (kpi.status === 'APPROVED' || kpi.status === 'EDITED') && !!userId && !!kpi.assigneeIds?.includes(userId)
