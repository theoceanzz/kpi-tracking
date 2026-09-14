import { useMemo, useState, type ReactNode } from 'react'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useAuthStore } from '@/store/authStore'
import DateFilterFields from '@/features/analytics/filter/DateFilterFields'
import {
  DEFAULT_DATE_INTENT,
  resolveDateFilter,
  type DateFilterIntent,
  type ResolvedDateFilter,
} from '@/features/analytics/filter/dateFilterModel'
import type { KpiPeriod, KpiCycle } from '@/types/kpi'

/** Giữ nguyên tên cũ: `DashboardFilterContext` và các tab đang import kiểu này. */
export type AnalyticsDateFilterValue = ResolvedDateFilter

interface Options {
  className?: string
  selectClassName?: string
}

/**
 * Bộ lọc thời gian dùng chung cho các trang thống kê.
 *
 * Hook này giờ chỉ còn giữ trạng thái và nối hai mảnh đã tách ra:
 * `DateFilterFields` (các ô chọn, không trạng thái) và `resolveDateFilter` (ý định → khoảng).
 * Tách như vậy để bảng cấu hình của từng widget dùng lại được đúng bộ ô và đúng phép tính, thay vì
 * chép một bản thứ hai rồi hai bản trôi lệch nhau.
 */
export function useAnalyticsDateFilter(opts: Options = {}): AnalyticsDateFilterValue & { controls: ReactNode } {
  const { className, selectClassName } = opts
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data } = useKpiPeriods({ organizationId, size: 1000, sortBy: 'startDate', direction: 'desc' })
  const { data: cyclesData } = useKpiCycles({ organizationId, size: 1000, sortBy: 'startDate', direction: 'desc' })
  // Memo hoá vì `?? []` đẻ một mảng mới mỗi lần render, mà mảng đó là phụ thuộc của phép tính
  // khoảng ngay dưới — không memo thì mọi lần render đều tính lại toàn bộ.
  const periods = useMemo(() => (data?.content ?? []) as KpiPeriod[], [data])
  const cycles = useMemo(() => (cyclesData?.content ?? []) as KpiCycle[], [cyclesData])

  const [intent, setIntent] = useState<DateFilterIntent>(DEFAULT_DATE_INTENT)

  const value = useMemo(() => resolveDateFilter(intent, periods, cycles), [intent, periods, cycles])

  const controls = (
    <DateFilterFields
      value={intent}
      onChange={setIntent}
      periods={periods}
      cycles={cycles}
      className={className}
      selectClassName={selectClassName}
    />
  )

  return { ...value, controls }
}
