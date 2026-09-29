import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { LocaleNumberInput } from './number-input'
import { LocaleDateInput } from './date-input'

/**
 * Ô nhập chuẩn của hệ thống (UX_PATTERNS.md §R17). Code mới dùng component này thay cho
 * `<input className="h-9 w-full rounded-control border …">` viết tay — trước đây có ~20 công
 * thức class gần giống nhau rải trong 366 ô, nên chiều cao / viền / focus ring lệch nhau
 * giữa trang.
 *
 * Chiều cao 32 / 36 / 40 cùng thang với `Button` và `SelectTrigger`. Màu đi qua token nên
 * tự đúng sáng/tối. Bút chì "ô này sửa được" đến từ rule toàn cục trong index.css, không
 * phải từ đây — component chỉ lo tắt nó (`no-edit-hint`) khi có `suffix` chiếm mép phải.
 *
 * Focus MỘT lớp — viền đổi màu + quầng mờ, cùng kiểu ô soạn K.AI. Đặt bằng class (không phải CSS toàn cục)
 * để chỗ dùng vẫn đè được qua `className`. Outline toàn cục của index.css bị tắt riêng cho `.field` /
 * `.field-shell` — nếu không, ô có đơn vị hiện thêm một khung vuông bên trong vòng focus.
 */
const SIZE_CLASS = { sm: 'h-8 px-2.5 text-[13px]', default: 'h-9 px-3 text-sm', lg: 'h-10 px-3.5 text-sm' } as const

// Hover chỉ đổi viền khi ô KHÔNG focus và KHÔNG sai: ở Tailwind v4 `hover:` đứng sau `focus-*` nên sẽ
// thắng — bấm vào ô (chuột còn nằm trên) thì viền tím bị thay bằng xám đậm.
const FIELD_FOCUS =
  '[&:hover:not(:focus-visible,[aria-invalid=true])]:border-[var(--color-border-strong)] ' +
  'focus-visible:border-[var(--color-ring)] focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-ring)_22%,transparent)] ' +
  'aria-[invalid=true]:focus-visible:border-[var(--color-error-solid)] ' +
  'aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-error-solid)_22%,transparent)]'

const SHELL_FOCUS =
  '[&:hover:not(:focus-within,[aria-invalid=true])]:border-[var(--color-border-strong)] ' +
  'focus-within:border-[var(--color-ring)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-ring)_22%,transparent)] ' +
  'aria-[invalid=true]:focus-within:border-[var(--color-error-solid)] ' +
  'aria-[invalid=true]:focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-error-solid)_22%,transparent)]'

/** Viền / nền / chữ chung của ô và khung bọc — KHÔNG có trạng thái `read-only:` (div nào cũng khớp :read-only). */
const fieldBase =
  'w-full min-w-0 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] text-[var(--color-foreground)] ' +
  'transition-[border-color,box-shadow] placeholder:text-[var(--color-muted-foreground)] ' +
  'aria-[invalid=true]:border-[var(--color-error-border)]'

const inputVariants = cva(
  fieldBase + ' field ' + FIELD_FOCUS + ' ' +
    'disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-[var(--color-muted)] read-only:text-[var(--color-muted-foreground)]',
  { variants: { size: SIZE_CLASS }, defaultVariants: { size: 'default' } },
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>,
    VariantProps<typeof inputVariants> {
  /** Icon/chữ nhỏ đứng trước nội dung (kính lúp, @, ký hiệu tiền). */
  prefix?: React.ReactNode
  /**
   * Đơn vị, nút mắt mật khẩu, nút xoá… đứng sau nội dung. Có suffix thì bút chì tự tắt.
   *
   * ⚠️ Đừng bật/tắt prefix/suffix (node ↔ undefined) trên ô đang `register` của react-hook-form:
   * có/không phụ kiện là hai cây DOM khác nhau nên React tạo lại thẻ `<input>`, và giá trị vừa
   * `setValue` rơi khỏi form dù ô vẫn hiện số. Suffix phụ thuộc dữ liệu (đơn vị tính) thì luôn
   * truyền một node, có thể rỗng: `suffix={<span>{unit}</span>}`.
   */
  suffix?: React.ReactNode
  /** Viền đỏ + `aria-invalid`; truyền `!!errors.field` từ react-hook-form. */
  invalid?: boolean
  /** Class cho thẻ `<input>` bên trong khi có prefix/suffix (lúc đó `className` áp lên khung bọc). */
  inputClassName?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputClassName, size, prefix, suffix, invalid, type = 'text', ...props }, ref) => {
    const ariaInvalid = invalid ? true : props['aria-invalid']
    // Số và ngày nhập theo ngôn ngữ đang chọn (docs/I18N_DESIGN.md §5): cùng props / onChange /
    // register() như thẻ gốc, e.target.value vẫn là giá trị chuẩn (1000.5, 2026-09-26).
    const Field = (
      type === 'number'
        ? LocaleNumberInput
        : type === 'date' || type === 'datetime-local' || type === 'month'
          ? LocaleDateInput
          : 'input'
    ) as 'input'

    // Không có phụ kiện: trả về đúng một thẻ <input>, không thêm DOM — codemod thay thế
    // <input> thô sang <Input> không làm đổi bố cục.
    if (prefix == null && suffix == null) {
      return (
        <Field
          ref={ref}
          type={type}
          aria-invalid={ariaInvalid}
          className={cn(inputVariants({ size }), className)}
          {...props}
        />
      )
    }

    // Có phụ kiện: khung bọc mang viền / nền / focus (qua focus-within), ô bên trong trong
    // suốt. Cách này chịu được suffix rộng bất kỳ ("triệu VND", hai nút) mà không phải đoán
    // `pr-*`. Nền xám "chỉ đọc" đi theo prop `readOnly` của ô, không theo `:read-only` của div.
    return (
      <div
        data-disabled={props.disabled ? '' : undefined}
        data-readonly={props.readOnly ? '' : undefined}
        aria-invalid={ariaInvalid}
        className={cn(
          fieldBase,
          SIZE_CLASS[size ?? 'default'],
          'field-shell flex items-center gap-2 py-0',
          SHELL_FOCUS,
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          'data-[readonly]:bg-[var(--color-muted)] data-[readonly]:text-[var(--color-muted-foreground)]',
          className,
        )}
      >
        {prefix != null && (
          <span className="flex shrink-0 items-center text-[var(--color-muted-foreground)] [&_svg]:size-4">{prefix}</span>
        )}
        <Field
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
