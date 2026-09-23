import { DEFAULT_DATE_INTENT, type DateFilterIntent } from './dateFilterModel'
import type { KpiCycle, KpiPeriod } from '@/types/kpi'

/**
 * Nhãn ngắn gọn của một ý định lọc — dùng cho nút khoảng mặc định của trang VÀ dòng tóm tắt
 * trên từng ô, để hai chỗ không bao giờ nói hai kiểu về cùng một lựa chọn.
 */
export function summarizeIntent(intent: DateFilterIntent, periods: KpiPeriod[], cycles: KpiCycle[]): string {
  const mode = intent.mode ?? DEFAULT_DATE_INTENT.mode
  if (mode === 'CYCLE') {
    const ids = intent.cycleIds ?? []
    if (ids.length === 0) return 'Chọn kỳ'
    if (ids.length === 1) return cycles.find(c => c.id === ids[0])?.name ?? '1 kỳ'
    return `${ids.length} kỳ`
  }
  if (mode === 'RANGE') {
    const a = periods.find(p => p.id === intent.rangeFromId)?.name
    const b = periods.find(p => p.id === intent.rangeToId)?.name
    if (!a && !b) return 'Khoảng đợt'
    return a === b ? (a ?? 'Khoảng đợt') : `${a ?? '…'} → ${b ?? '…'}`
  }
  if (intent.periodId) return periods.find(p => p.id === intent.periodId)?.name ?? 'Một đợt'
  const legacy = intent.legacyMode ?? DEFAULT_DATE_INTENT.legacyMode
  return {
    THIS_WEEK: 'Tuần này', THIS_MONTH: 'Tháng này', THIS_QUARTER: 'Quý này',
    '6_MONTHS': '6 tháng gần đây', THIS_YEAR: 'Năm nay', CUSTOM: 'Khoảng tuỳ chỉnh',
  }[legacy]
}
