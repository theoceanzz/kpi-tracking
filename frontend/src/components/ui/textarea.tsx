import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Viền đỏ + `aria-invalid`; truyền `!!errors.field` từ react-hook-form. */
  invalid?: boolean
}

/**
 * Ô nhập nhiều dòng, cùng viền / nền / focus ring với `Input` (UX_PATTERNS.md §R17).
 * Mặc định 3 dòng, chỉ cho kéo dọc để không phá lưới form. Bút chì "sửa được" đến từ
 * rule toàn cục (góc trên phải); ô soạn chat có nút mic/gửi thì thêm `no-edit-hint`.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid ? true : props['aria-invalid']}
      className={cn(
        'w-full min-w-0 resize-y rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm leading-6 text-[var(--color-foreground)] transition-colors',
        'placeholder:text-[var(--color-muted-foreground)] hover:border-[var(--color-border-strong)]',
        'focus-visible:outline-none focus-visible:border-[var(--color-ring)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-[var(--color-muted)] read-only:text-[var(--color-muted-foreground)]',
        'aria-[invalid=true]:border-[var(--color-error-border)] aria-[invalid=true]:focus-visible:ring-[var(--color-error-solid)]',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export { Textarea }
