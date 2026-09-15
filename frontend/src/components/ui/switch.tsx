import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  size?: 'sm' | 'default'
}

/**
 * Công tắc bật/tắt (UX_PATTERNS.md §R15). Không dùng @radix-ui/react-switch vì dự án chưa có
 * dependency đó và 4 công tắc hiện có đều tự vẽ cùng một kiểu. Bật = màu primary (không phải
 * xanh lá: xanh lá là "thành công", còn bật/tắt là một trạng thái cấu hình).
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, size = 'default', className, disabled, ...props }, ref) => {
    const dims = size === 'sm'
      ? { track: 'h-5 w-9', thumb: 'h-4 w-4', on: 'translate-x-4' }
      : { track: 'h-6 w-11', thumb: 'h-5 w-5', on: 'translate-x-5' }
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          dims.track,
          checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-strong)]',
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none block rounded-full bg-white shadow-sm transition-transform',
            dims.thumb,
            checked ? dims.on : 'translate-x-0',
          )}
        />
      </button>
    )
  },
)
Switch.displayName = 'Switch'
