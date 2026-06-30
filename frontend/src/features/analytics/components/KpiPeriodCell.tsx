import { format } from 'date-fns'
import { cn } from '@/lib/utils'

/**
 * Ô "Đợt": hiển thị tên đợt (đậm) + ngày bắt đầu/kết thúc (Từ/Đến) của KPI.
 * Thay cho cách hiển thị chỉ ngày trước đây.
 */
export function KpiPeriodCell({
  periodName,
  start,
  end,
  className,
}: {
  periodName?: string | null
  start: string | null
  end: string | null
  className?: string
}) {
  const fmt = (d: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
  return (
    <div className={cn('inline-flex flex-col gap-1 text-[11px]', className)}>
      {periodName && (
        <span className="font-bold text-slate-700 dark:text-slate-200">{periodName}</span>
      )}
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-slate-400 uppercase tracking-wider w-[26px] shrink-0">Từ</span>
        <span className="font-semibold text-slate-600 dark:text-slate-300 tabular-nums">{fmt(start)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-indigo-400 uppercase tracking-wider w-[26px] shrink-0">Đến</span>
        <span className="font-semibold text-slate-600 dark:text-slate-300 tabular-nums">{fmt(end)}</span>
      </div>
    </div>
  )
}

export default KpiPeriodCell
