import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { PinOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reportApi } from '@/features/reports/api/reportApi'
import type { ReportWidget } from '@/types/datasource'
import { PINNED_REGISTRY, type PinnedFilter } from '@/features/analytics/components/pinned/pinnedWidgetRegistry'

/**
 * Thẻ hiển thị 1 widget ĐÃ GHIM trên trang chủ (dùng chung cho Staff/Head/Director dashboard).
 * Nội dung ưu tiên render bằng đúng component của tab thống kê qua PINNED_REGISTRY (tra theo
 * `chartConfig.i`); nếu không khớp (widget Report-builder cũ) thì rơi về nhánh legacy bên dưới.
 */
export function PinnedWidgetCard({ widget, onUnpin, filter }: { widget: ReportWidget; onUnpin: () => void; filter?: PinnedFilter }) {
  const queryClient = useQueryClient()
  const handleUnpin = async () => {
    try {
      await reportApi.togglePinWidget(widget.id)
      toast.success('Đã bỏ ghim')
      queryClient.invalidateQueries({ queryKey: ['reports', 'widgets', 'pinned'] })
      onUnpin()
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể bỏ ghim'))
    }
  }

  const pos = useMemo(() => {
    try {
      return JSON.parse(widget.position)
    } catch {
      return { w: 4, h: 10 }
    }
  }, [widget.position])

  const config = useMemo(() => {
    try {
      return JSON.parse(widget.chartConfig)
    } catch {
      return {}
    }
  }, [widget.chartConfig])

  const colSpan = pos.w || 4
  const height = (pos.h || 10) * 32 + 60 // Base height + header

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group transition-all hover:shadow-xl',
        colSpan >= 12 ? 'col-span-12' :
        colSpan >= 8 ? 'col-span-12 lg:col-span-8' :
        colSpan >= 6 ? 'col-span-12 lg:col-span-6' :
        'col-span-12 md:col-span-6 lg:col-span-4'
      )}
      style={{ height: `${height}px` }}
    >
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <h4 className="font-black text-sm text-slate-800 dark:text-white truncate">{widget.title}</h4>
        <button onClick={handleUnpin} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100">
          <PinOff size={14} />
        </button>
      </div>
      <div className="flex-1 p-5 overflow-hidden">
        <PinnedWidgetContent config={config} filter={filter} />
      </div>
    </div>
  )
}

/**
 * Chọn nguồn render theo `config.i` — id widget duy nhất toàn hệ thống.
 *
 * <p>Mọi widget ghim đều đi qua `useDashboardCustomization`, mà hàm đó luôn ghi `chartConfig` có
 * `i`, nên registry phủ hết. Trước đây còn một nhánh legacy 289 dòng vẽ lại chính những biểu đồ
 * registry đã có (bằng code khác, nên hai bên dễ lệch) và gọi 6 query vô điều kiện ngay cả khi
 * chỉ để in một dòng chữ. Nhánh đó không còn đường vào nên đã bỏ.
 */
function PinnedWidgetContent({ config, filter }: { config?: any; filter?: PinnedFilter }) {
  const Registered = config?.i ? PINNED_REGISTRY[config.i] : undefined
  if (Registered) return <div className="h-full w-full"><Registered filter={filter} /></div>
  return (
    <div className="h-full flex items-center justify-center text-xs font-bold text-slate-300 italic px-4 text-center">
      Chi tiết biểu đồ xem tại trang Thống kê
    </div>
  )
}

