import type { ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortDir = 'asc' | 'desc'

/**
 * Header cột có thể sort dùng chung cho các bảng chi tiết thống kê.
 * Icon: chưa sort = ChevronsUpDown (mờ), đang sort tăng = ChevronUp, giảm = ChevronDown.
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
      className={cn('flex items-center gap-1 group hover:text-indigo-500 transition-colors', className)}
    >
      {children}
      <span className="ml-0.5">
        {isActive
          ? dir === 'asc'
            ? <ChevronUp size={iconSize} />
            : <ChevronDown size={iconSize} />
          : <ChevronsUpDown size={iconSize} className="opacity-30 group-hover:opacity-60" />}
      </span>
    </button>
  )
}
