import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Viền đỏ + `aria-invalid`; truyền `!!errors.field` từ react-hook-form. */
  invalid?: boolean
}

/**
 * Ô nhập nhiều dòng, cùng viền / nền / focus một lớp (viền đổi màu + quầng mờ) với `Input`
 * (UX_PATTERNS.md §R17). Mặc định 3 dòng, chỉ cho kéo dọc để không phá lưới form. Bút chì
 * "sửa được" đến từ rule toàn cục (góc trên phải); ô soạn chat có nút mic/gửi thì thêm `no-edit-hint`.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid ? true : props['aria-invalid']}
      className={cn(
        'field w-full min-w-0 resize-y rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm leading-6 text-[var(--color-foreground)] transition-[border-color,box-shadow]',
        // Hover không đè viền focus / viền sai (xem ui/input.tsx).
        'placeholder:text-[var(--color-muted-foreground)] [&:hover:not(:focus-visible,[aria-invalid=true])]:border-[var(--color-border-strong)]',
        'focus-visible:border-[var(--color-ring)] focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-ring)_22%,transparent)]',
        'disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-[var(--color-muted)] read-only:text-[var(--color-muted-foreground)]',
        'aria-[invalid=true]:border-[var(--color-error-border)] aria-[invalid=true]:focus-visible:border-[var(--color-error-solid)]',
        'aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-error-solid)_22%,transparent)]',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export { Textarea }
