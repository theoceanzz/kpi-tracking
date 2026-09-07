import { LineChart } from 'lucide-react'
import { PINNED_REGISTRY } from '@/features/analytics/components/pinned/pinnedWidgetRegistry'
import { WidgetShell } from '../../components/WidgetShell'
import { useDashboardPinnedFilter, type FilterScope } from '../../context/DashboardFilterContext'

/**
 * Bọc một biểu đồ/bảng của trang Thống kê để đặt lên lưới trang chủ.
 *
 * <p>Các component trong PINNED_REGISTRY tự fetch, chỉ cần biết lọc theo khoảng nào —
 * `filterScope` chọn thanh lọc nào lái nó (xem `DashboardFilterContext`).
 */
export function AnalyticsWidget({ id, title, icon, filterScope = 'unit' }: {
  id: string
  title: string
  icon?: React.ReactNode
  filterScope?: FilterScope
}) {
  const filter = useDashboardPinnedFilter(filterScope)
  const Comp = PINNED_REGISTRY[id]
  if (!Comp) return null
  return (
    <WidgetShell title={title} icon={icon ?? <LineChart size={17} />}>
      <Comp filter={filter} />
    </WidgetShell>
  )
}
