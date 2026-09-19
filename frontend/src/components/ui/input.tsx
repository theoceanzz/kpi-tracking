import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Ô nhập chuẩn của hệ thống (UX_PATTERNS.md §R17). Code mới dùng component này thay cho
 * `<input className="h-9 w-full rounded-control border …">` viết tay — trước đây có ~20 công
 * thức class gần giống nhau rải trong 366 ô, nên chiều cao / viền / focus ring lệch nhau
 * giữa trang.
 *
 * Chiều cao 32 / 36 / 40 cùng thang với `Button` và `SelectTrigger`. Màu đi qua token nên
 * tự đúng sáng/tối. Bút chì "ô này sửa được" đến từ rule toàn cục trong index.css, không
 * phải từ đây — component chỉ lo tắt nó (`no-edit-hint`) khi có `suffix` chiếm mép phải.
 */
const inputVariants = cva(
  'w-full min-w-0 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] text-[var(--color-foreground)] transition-colors ' +
    'placeholder:text-[var(--color-muted-foreground)] hover:border-[var(--color-border-strong)] ' +
    'focus-visible:outline-none focus-visible:border-[var(--color-ring)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ' +
    'disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-[var(--color-muted)] read-only:text-[var(--color-muted-foreground)] ' +
    'aria-[invalid=true]:border-[var(--color-error-border)] aria-[invalid=true]:focus-visible:ring-[var(--color-error-solid)]',
  {
    variants: {
      size: {
        sm: 'h-8 px-2.5 text-[13px]',
        default: 'h-9 px-3 text-sm',
        lg: 'h-10 px-3.5 text-sm',
      },
    },
    defaultVariants: { size: 'default' },
  },
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>,
    VariantProps<typeof inputVariants> {
  /** Icon/chữ nhỏ đứng trước nội dung (kính lúp, @, ký hiệu tiền). */
  prefix?: React.ReactNode
  /** Đơn vị, nút mắt mật khẩu, nút xoá… đứng sau nội dung. Có suffix thì bút chì tự tắt. */
  suffix?: React.ReactNode
  /** Viền đỏ + `aria-invalid`; truyền `!!errors.field` từ react-hook-form. */
  invalid?: boolean
  /** Class cho thẻ `<input>` bên trong khi có prefix/suffix (lúc đó `className` áp lên khung bọc). */
  inputClassName?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputClassName, size, prefix, suffix, invalid, type = 'text', ...props }, ref) => {
    const ariaInvalid = invalid ? true : props['aria-invalid']

    // Không có phụ kiện: trả về đúng một thẻ <input>, không thêm DOM — codemod thay thế
    // <input> thô sang <Input> không làm đổi bố cục.
    if (prefix == null && suffix == null) {
      return (
        <input
          ref={ref}
          type={type}
          aria-invalid={ariaInvalid}
          className={cn(inputVariants({ size }), className)}
          {...props}
        />
      )
    }

    // Có phụ kiện: khung bọc mang viền / nền / focus ring (qua focus-within), ô bên trong
    // trong suốt. Cách này chịu được suffix rộng bất kỳ ("triệu VND", hai nút) mà không
    // phải đoán `pr-*`.
    return (
      <div
        data-disabled={props.disabled ? '' : undefined}
        aria-invalid={ariaInvalid}
        className={cn(
          inputVariants({ size }),
          'flex items-center gap-2 py-0',
          'focus-within:border-[var(--color-ring)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]',
          'aria-[invalid=true]:focus-within:ring-[var(--color-error-solid)]',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          className,
        )}
      >
        {prefix != null && (
          <span className="flex shrink-0 items-center text-[var(--color-muted-foreground)] [&_svg]:size-4">{prefix}</span>
        )}
        <input
          ref={ref}
          type={type}
          aria-invalid={ariaInvalid}
          className={cn(
            'h-full w-full min-w-0 flex-1 bg-transparent p-0 text-inherit placeholder:text-[var(--color-muted-foreground)] outline-none disabled:cursor-not-allowed',
            suffix != null && 'no-edit-hint',
            inputClassName,
          )}
          {...props}
        />
        {suffix != null && (
          <span className="flex shrink-0 items-center text-[var(--color-muted-foreground)] [&_svg]:size-4">{suffix}</span>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input }
