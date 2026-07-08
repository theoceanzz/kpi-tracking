import { useMemo, useState } from 'react'
import { Pin } from 'lucide-react'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import type { ReportWidget } from '@/types/datasource'
import type { PinnedFilter } from '@/features/analytics/components/pinned/pinnedWidgetRegistry'
import { PinnedWidgetCard } from './PinnedWidgetCard'

/**
 * Mục "Thống kê đã ghim" ở trang chủ (dùng chung Staff/Head/Director).
 * Thanh lọc (period/ngày/nhóm thời gian + đã duyệt) đặt trong `<section>` với `position: sticky`
 * ⇒ tự bám khi cuộn qua các biểu đồ ghim và trôi/ẩn khi cuộn hết mục (native, bounded bởi section).
 * Filter áp cho mọi biểu đồ ghim qua prop `filter`.
 */
export function PinnedWidgetsSection({ widgets, onUnpin }: { widgets?: ReportWidget[]; onUnpin: () => void }) {
  const [onlyApproved, setOnlyApproved] = useState(false)
  const { periodId, periodIdTo, from, to, groupBy, controls } = useAnalyticsDateFilter({ selectClassName: 'h-10' })

  const filter: PinnedFilter = useMemo(
    () => ({ from, to, onlyApproved, periodId, periodIdTo, groupBy }),
    [from, to, onlyApproved, periodId, periodIdTo, groupBy]
  )

  if (!widgets?.length) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Pin size={18} className="text-indigo-600 rotate-45" /> Thống kê đã ghim
        </h3>
      </div>

      {/* Thanh lọc — sticky trong phạm vi mục ghim, tự ẩn khi cuộn hết mục */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <span className="text-xs font-bold text-slate-400">Bộ lọc áp cho biểu đồ đã ghim</span>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800"
              checked={onlyApproved}
              onChange={e => setOnlyApproved(e.target.checked)}
            />
            Chỉ tính bài nộp đã duyệt
          </label>
          {controls}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {widgets.map(widget => (
          <PinnedWidgetCard key={widget.id} widget={widget} onUnpin={onUnpin} filter={filter} />
        ))}
      </div>
    </section>
  )
}
