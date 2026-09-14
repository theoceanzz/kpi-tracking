import { BarChart3, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChartTableView } from './useChartTableView'

/**
 * Cặp nút chuyển biểu đồ ↔ bảng, đặt vào `extraHeaderContent` của ChartWrapper.
 * State do {@link useChartTableView} giữ để lựa chọn được nhớ lại giữa các lần mở trang.
 */
export function ViewToggleButtons({ view, onChange, className }: {
  view: ChartTableView
  onChange: (v: ChartTableView) => void
  className?: string
}) {
  const options = [
    { value: 'chart' as const, icon: <BarChart3 size={14} />, title: 'Xem dạng biểu đồ' },
    { value: 'table' as const, icon: <Table2 size={14} />, title: 'Xem dạng bảng' },
  ]
  return (
    <div className={cn('flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0', className)}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
          aria-label={o.title}
          aria-pressed={view === o.value}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            view === o.value
              ? 'bg-white dark:bg-slate-900 text-[var(--color-primary)] dark:text-indigo-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}

export default ViewToggleButtons
