import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Nút chuẩn của hệ thống. Mọi màu đi qua token nên tự đúng với cả 8 màu chủ đạo và
 * hai chế độ sáng/tối; không có `bg-indigo-*` ở đây.
 *
 * Trạng thái: hover đổi nền, active đậm thêm một nấc, focus-visible có vòng 2px cách
 * 2px (bàn phím), disabled mờ 50% và bỏ sự kiện. Không scale, không bóng — nút hành
 * động chính đã đủ nổi nhờ nền đặc.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors select-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] ' +
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-hover)]',
        destructive:
          'bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:bg-[var(--color-destructive-hover)] active:bg-[var(--color-destructive-hover)]',
        outline:
          'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)] hover:border-[var(--color-border-strong)] active:bg-[var(--color-accent)]',
        secondary:
          'bg-[var(--color-muted)] text-[var(--color-foreground)] hover:bg-[var(--color-accent)] active:bg-[var(--color-border)]',
        ghost:
          'text-[var(--color-foreground)] hover:bg-[var(--color-muted)] active:bg-[var(--color-accent)]',
        link:
          'h-auto px-0 text-[var(--color-primary)] underline-offset-4 hover:underline',
      },
      // Ba chiều cao 32 / 36 / 40 — cùng thang với input và select.
      size: {
        sm: 'h-8 px-3 text-[13px] [&_svg]:size-3.5',
        default: 'h-9 px-3.5 [&_svg]:size-4',
        lg: 'h-10 px-4 [&_svg]:size-4',
        icon: 'h-9 w-9 [&_svg]:size-4',
        'icon-sm' : 'h-8 w-8 [&_svg]:size-3.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        // Mặc định `type="button"` để nút trong form không vô tình submit.
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
