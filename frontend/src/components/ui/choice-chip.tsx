import * as React from 'react'
import { cn } from '@/lib/utils'

export type ChoiceChipVariant = 'soft' | 'solid' | 'segment'

export interface ChoiceChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean
  /**
   * `soft`: nền primary-soft khi chọn (mặc định, dùng cho chip lọc/chọn giá trị).
   * `solid`: nền primary đặc — khi lựa chọn là quyết định chính của form (vd loại chỉ tiêu).
   * `segment`: nút trong khay `bg-muted p-0.5`, chọn thì nổi nền card — dạng segmented.
   */
  variant?: ChoiceChipVariant
  size?: 'sm' | 'default'
}

/**
 * Nút "chọn một trong nhiều" (UX_PATTERNS.md §R14): chip lọc, khay chuyển chế độ, ô chọn
 * kiểu chỉ tiêu… Trước đây ~130 chỗ tự viết `cond ? 'bg-primary…' : 'bg-muted…'`, mỗi nơi
 * một cỡ. Ở đây: cao 32px (sm: 28px), chữ 13px medium, `aria-pressed` cho trợ năng, vòng
 * focus chuẩn.
 */
export const ChoiceChip = React.forwardRef<HTMLButtonElement, ChoiceChipProps>(
  ({ selected, variant = 'soft', size = 'default', className, type = 'button', children, ...props }, ref) => {
    const base = cn(
      'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
      size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
    )
    const look = {
      soft: selected
        ? 'border border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
        : 'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]',
      solid: selected
        ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]'
        : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]',
      segment: selected
        ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
        : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
    }[variant]
    return (
      <button ref={ref} type={type} aria-pressed={selected} className={cn(base, look, className)} {...props}>
        {children}
      </button>
    )
  },
)
ChoiceChip.displayName = 'ChoiceChip'
