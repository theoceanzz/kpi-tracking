import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Nhãn trạng thái / phân loại. Luôn là NỀN NHẠT + CHỮ ĐẬM + VIỀN MỜ — không bao giờ
 * nền đặc, để không lẫn với nút hành động ngay cả khi màu chủ đạo trùng tông với
 * một màu ngữ nghĩa (emerald ≈ success, amber ≈ warning, rose ≈ error).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-medium leading-4 whitespace-nowrap',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
        secondary:
          'border-transparent bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
        success:
          'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]',
        warning:
          'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
        destructive:
          'border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]',
        info:
          'border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info)]',
        outline:
          'border-[var(--color-border)] bg-transparent text-[var(--color-foreground)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
