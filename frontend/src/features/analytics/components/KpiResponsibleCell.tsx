import { Building2 } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'

/**
 * Ô "Đơn vị / Người đảm nhiệm" — phân biệt rõ:
 * - Có người (`assigneeName`) → avatar chữ cái đầu + tên (kiểu "người").
 * - Chỉ có đơn vị (`orgUnitName`) → badge icon toà nhà + tên (kiểu "đơn vị").
 */
export function KpiResponsibleCell({
  orgUnitName,
  assigneeName,
  className,
}: {
  orgUnitName?: string | null
  assigneeName?: string | null
  className?: string
}) {
  if (assigneeName) {
    return (
      <div
        className={cn('inline-flex items-center gap-2 min-w-0', className)}
        title={`Người đảm nhiệm: ${assigneeName}`}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300 text-[10px] font-black shrink-0">
          {getInitials(assigneeName)}
        </span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{assigneeName}</span>
      </div>
    )
  }
  if (orgUnitName) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300',
          className,
        )}
        title={`Đơn vị đảm nhiệm: ${orgUnitName}`}
      >
        <Building2 size={12} className="shrink-0 text-slate-400" />
        {orgUnitName}
      </span>
    )
  }
  return <span className={cn('text-slate-300 dark:text-slate-600', className)}>—</span>
}

export default KpiResponsibleCell
