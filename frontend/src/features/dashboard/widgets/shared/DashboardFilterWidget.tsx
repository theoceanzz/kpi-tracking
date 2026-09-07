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
      className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-4 shadow-sm flex flex-wrap items-center gap-4 justify-between overflow-auto custom-scrollbar"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-2 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0 bg-indigo-50 dark:bg-indigo-900/30">
          <SlidersHorizontal size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-white leading-tight text-base">{title}</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{hint}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
        {controls}
      </div>
    </section>
  )
}
