import { LineChart } from 'lucide-react'
import { PINNED_REGISTRY } from '@/features/analytics/components/pinned/pinnedWidgetRegistry'
import { WidgetShell } from '../../components/WidgetShell'

/**
 * Bọc một biểu đồ của trang Thống kê để đặt lên lưới trang chủ.
 * Các component trong PINNED_REGISTRY đã tự fetch dữ liệu nên không cần truyền gì thêm.
 */
export function AnalyticsWidget({ id, title }: { id: string; title: string }) {
  const Comp = PINNED_REGISTRY[id]
  if (!Comp) return null
  return (
    <WidgetShell title={title} icon={<LineChart size={17} />}>
      <Comp />
    </WidgetShell>
  )
}
