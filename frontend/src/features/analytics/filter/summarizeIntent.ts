import { DEFAULT_DATE_INTENT, type DateFilterIntent } from './dateFilterModel'
import type { KpiCycle, KpiPeriod } from '@/types/kpi'
import i18n from 'i18next'

/**
 * Nhãn ngắn gọn của một ý định lọc — dùng cho nút khoảng mặc định của trang VÀ dòng tóm tắt
 * trên từng ô, để hai chỗ không bao giờ nói hai kiểu về cùng một lựa chọn.
 */
export function summarizeIntent(intent: DateFilterIntent, periods: KpiPeriod[], cycles: KpiCycle[]): string {
  const mode = intent.mode ?? DEFAULT_DATE_INTENT.mode
  if (mode === 'CYCLE') {
    const ids = intent.cycleIds ?? []
    if (ids.length === 0) return i18n.t('analytics:summarizeIntent.chooseCycle')
    if (ids.length === 1) return cycles.find(c => c.id === ids[0])?.name ?? i18n.t('analytics:summarizeIntent.n1Cycle')
    return i18n.t('analytics:summarizeIntent.cycles', { count: ids.length })
  }
  if (mode === 'RANGE') {
    const a = periods.find(p => p.id === intent.rangeFromId)?.name
    const b = periods.find(p => p.id === intent.rangeToId)?.name
    if (!a && !b) return i18n.t('analytics:summarizeIntent.periodRange')
    return a === b ? (a ?? i18n.t('analytics:summarizeIntent.periodRange')) : `${a ?? '…'} → ${b ?? '…'}`
  }
  if (intent.periodId) return periods.find(p => p.id === intent.periodId)?.name ?? i18n.t('analytics:summarizeIntent.onePeriod')
  const legacy = intent.legacyMode ?? DEFAULT_DATE_INTENT.legacyMode
  return {
    THIS_WEEK: i18n.t('analytics:summarizeIntent.thisWeek'), THIS_MONTH: i18n.t('analytics:summarizeIntent.thisMonth'), THIS_QUARTER: i18n.t('analytics:summarizeIntent.thisQuarter'),
    '6_MONTHS': i18n.t('analytics:summarizeIntent.last6Months'), THIS_YEAR: i18n.t('analytics:summarizeIntent.thisYear'), CUSTOM: i18n.t('analytics:summarizeIntent.customRange'),
  }[legacy]
}
