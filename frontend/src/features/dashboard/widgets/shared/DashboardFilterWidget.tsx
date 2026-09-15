import { SlidersHorizontal } from 'lucide-react'
import { useDashboardFilter, type FilterScope } from '../../context/DashboardFilterContext'

const LABEL: Record<FilterScope, { title: string; hint: string }> = {
  unit: { title: 'Bộ lọc đơn vị', hint: 'Lọc dữ liệu đồng bộ cho widget đơn vị, phân cấp và hạng mục' },
  personal: { title: 'Bộ lọc cá nhân', hint: 'Lọc dữ liệu đồng bộ cho mọi widget "của tôi"' },
}

/**
 * Thanh lọc thời gian trên lưới trang chủ — cùng bộ điều khiển với trang Phân tích.
 *
 * <p>Tự vẽ card thay vì đi qua `WidgetShell`: thanh lọc thấp và rộng, khung tiêu đề của
 * WidgetShell sẽ chiếm mất gần nửa chiều cao ô.
 */
export function DashboardFilterWidget({ scope }: { scope: FilterScope }) {
  const { controls } = useDashboardFilter(scope)
  const { title, hint } = LABEL[scope]

  return (
    <section
      aria-label={title}
      className="h-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-card p-4 shadow-sm flex flex-wrap items-center gap-4 justify-between overflow-auto custom-scrollbar"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-2 rounded-control text-[var(--color-primary)] shrink-0 bg-[var(--color-primary-soft)]">
          <SlidersHorizontal size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-section-title text-[var(--color-foreground)] leading-tight">{title}</h3>
          <p className="text-xs text-[var(--color-muted-foreground)] font-medium mt-0.5">{hint}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
        {controls}
      </div>
    </section>
  )
}
