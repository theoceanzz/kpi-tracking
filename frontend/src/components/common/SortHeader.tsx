import type { ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortDir = 'asc' | 'desc'

/**
 * Header cột có thể sort dùng chung cho các bảng chi tiết thống kê.
 * Icon: chưa sort = ChevronsUpDown (mờ), đang sort tăng = ChevronUp, giảm = ChevronDown.
 * Cột đang sort đậm màu hơn để nhìn lướt biết bảng đang xếp theo gì.
 */
export function SortHeader<T extends string>({
  field,
  active,
  dir,
  onToggle,
  children,
  className,
  iconSize = 12,
}: {
  field: T
  active: T | null
  dir: SortDir
  onToggle: (field: T) => void
  children: ReactNode
  className?: string
  iconSize?: number
}) {
  const isActive = active === field
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className={cn(
        'group inline-flex items-center gap-1 rounded-sm transition-colors hover:text-[var(--color-foreground)]',
        isActive ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]',
        className,
      )}
    >
      {children}
      <span className="ml-0.5 shrink-0" aria-hidden="true">
        {isActive
          ? dir === 'asc'
            ? <ChevronUp size={iconSize} />
            : <ChevronDown size={iconSize} />
          : <ChevronsUpDown size={iconSize} className="opacity-40 group-hover:opacity-80" />}
      </span>
    </button>
  )
}
