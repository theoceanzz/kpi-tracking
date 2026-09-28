import type { KpiPeriod } from '@/types/kpi'
import { PERIOD_STATUS_LABEL } from '../types/cycleLock'
import i18n from 'i18next'

export type PeriodLike = Pick<KpiPeriod, 'cycleStatus' | 'cycleName' | 'status' | 'name'> | null | undefined

/**
 * Lý do đợt không còn ghi được (kỳ đã khoá, hoặc đợt đã đóng/chuyển/huỷ khi khoá kỳ), null nếu
 * còn ghi được. Chỉ để ẩn/khoá nút — server luôn chặn lại (CycleStatusGuard).
 */
export function periodLockReason(period: PeriodLike): string | null {
  if (!period) return null
  if (period.cycleStatus === 'LOCKED') {
    return i18n.t('kpi:cycleLockReason.cycleIsLockedOnlyViewingAnd', { value: period.cycleName ?? '' })
  }
  if (period.status && period.status !== 'ACTIVE') {
    return i18n.t('kpi:cycleLockReason.periodCanNoLongerBeChanged', { name: period.name, toLowerCase: PERIOD_STATUS_LABEL()[period.status].toLowerCase() })
  }
  return null
}

/** Lý do KPI không còn thao tác được. */
export function kpiLockReason(kpi: { status?: string; kpiPeriod?: PeriodLike } | null | undefined): string | null {
  if (!kpi) return null
  if (kpi.status === 'CLOSED_BY_LOCK') return i18n.t('kpi:cycleLockReason.theKpiWasClosedAsClosed')
  return periodLockReason(kpi.kpiPeriod)
}
