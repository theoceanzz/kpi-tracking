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
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-semibold shrink-0">
          {getInitials(assigneeName)}
        </span>
        <span className="text-sm font-semibold text-[var(--color-foreground)] truncate">{assigneeName}</span>
      </div>
    )
  }
  if (orgUnitName) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-[var(--color-muted)] text-caption',
          className,
        )}
        title={`Đơn vị đảm nhiệm: ${orgUnitName}`}
      >
        <Building2 size={12} className="shrink-0 text-[var(--color-subtle-foreground)]" />
        {orgUnitName}
      </span>
    )
  }
  return <span className={cn('text-[var(--color-subtle-foreground)]', className)}>—</span>
}

export default KpiResponsibleCell
