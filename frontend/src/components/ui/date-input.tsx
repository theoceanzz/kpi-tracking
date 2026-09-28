import * as React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  formatDateInput,
  formatDateTimeInput,
  formatMonthInput,
  parseDateInput,
  parseDateTimeInput,
  parseMonthInput,
} from '@/i18n/parse'
import { cn } from '@/lib/utils'
import { assignRef, getDisplay, installValueOverride, type LocaleInputElement } from './locale-input-core'
import { LocaleInputHint } from './locale-input-hint'

type Kind = 'date' | 'datetime-local' | 'month'

const FORMATS: Record<Kind, { parse: (s: string) => string | null; format: (v: string) => string; pattern: string }> = {
  date: { parse: parseDateInput, format: formatDateInput, pattern: 'dd/mm/yyyy' },
  'datetime-local': { parse: parseDateTimeInput, format: formatDateTimeInput, pattern: 'dd/mm/yyyy hh:mm' },
  month: { parse: parseMonthInput, format: formatMonthInput, pattern: 'mm/yyyy' },
}

// Biểu tượng lịch ở mép phải ô (ảnh nền — không thêm phần tử cạnh ô nên không đổi bố cục).
const CALENDAR_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cpath d='M16 2v4M8 2v4M3 10h18'/%3E%3C/svg%3E\")"
const ICON_ZONE = 30

type NativeProps = React.InputHTMLAttributes<HTMLInputElement>

/**
 * Thay thế thẳng cho `<input type="date|datetime-local|month">` (docs/I18N_DESIGN.md §5.2). Cùng props,
 * cùng `onChange`, `e.target.value` vẫn là giá trị chuẩn (`2026-09-26`, `2026-09-26T14:30`, `2026-09`),
 * dùng được với `register()`.
 *
 * Ô gốc của trình duyệt hiển thị theo ngôn ngữ của HỆ ĐIỀU HÀNH (máy tiếng Anh ra `09/26/2026`), không
 * theo ngôn ngữ đang chọn trong app. Ô này luôn hiển thị và nhận `dd/MM/yyyy` ở mọi ngôn ngữ — quy ước đã
 * chốt để không ai phải đoán ngày trước hay tháng trước. Bấm biểu tượng lịch (hoặc Alt+↓) để chọn trên
 * lịch của trình duyệt; chọn xong ô vẫn hiện `dd/MM/yyyy`.
 */
export const LocaleDateInput = React.forwardRef<HTMLInputElement, NativeProps & { type: Kind }>(function LocaleDateInput(
  { type, value, defaultValue, onBlur, onInput, onFocus, onKeyDown, onMouseDown, placeholder, min, max, className, style, ...rest },
  forwardedRef,
) {
  const { t } = useTranslation('common')
  const kind: Kind = type
  const elRef = React.useRef<LocaleInputElement | null>(null)
  const pickerRef = React.useRef<HTMLInputElement | null>(null)
  const [invalid, setInvalid] = React.useState(false)
  const [focused, setFocused] = React.useState(false)

  const fns = React.useRef({
    toCanonical: (display: string) => FORMATS[kind].parse(display) ?? '',
    toDisplay: (canonical: string) => FORMATS[kind].format(canonical) || canonical,
  })

  const setRef = React.useCallback(
    (el: HTMLInputElement | null) => {
      elRef.current = el
      if (el) installValueOverride(el, fns, false)
      assignRef(forwardedRef, el)
    },
    [forwardedRef],
  )

  React.useLayoutEffect(() => {
    const el = elRef.current
    if (el && value === undefined && defaultValue !== undefined && getDisplay(el) === '') el.value = String(defaultValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useLayoutEffect(() => {
    const el = elRef.current
    if (!el || value === undefined) return
    const next = value === null ? '' : String(value)
    if (el.value !== next && !(next === '' && document.activeElement === el && getDisplay(el) !== '')) el.value = next
  }, [value])

  const check = (el: HTMLInputElement) => {
    const display = getDisplay(el).trim()
    setInvalid(display !== '' && FORMATS[kind].parse(display) === null)
  }

  // Ô chọn ngày gốc của trình duyệt, ẩn, đặt đúng chỗ ô hiển thị để popup lịch mở ngay dưới nó.
  // Gọi đồng bộ trong cú bấm: showPicker() chỉ chạy khi còn "user activation".
  const openPicker = () => {
    const el = elRef.current
    const picker = pickerRef.current
    if (!el || !picker || el.disabled || el.readOnly) return
    const rect = el.getBoundingClientRect()
    Object.assign(picker.style, { top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px` })
    // Ép trình duyệt tính lại bố cục ngay: showPicker() neo popup theo hộp đã layout gần nhất, không
    // đọc lại style vừa gán — thiếu dòng này popup bật ra ở góc trên-trái (vị trí 0,0 ban đầu).
    void picker.getBoundingClientRect()
    picker.value = el.value
    try {
      picker.showPicker?.()
    } catch {
      picker.focus()
    }
  }

  return (
    <>
      <input
        {...rest}
        ref={setRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? FORMATS[kind].pattern}
        aria-invalid={invalid ? true : rest['aria-invalid']}
        className={cn('no-edit-hint', className)}
        style={{
          backgroundImage: CALENDAR_ICON,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          paddingRight: ICON_ZONE,
          ...style,
        }}
        onMouseDown={(e) => {
          const el = e.currentTarget
          if (e.nativeEvent.offsetX >= el.clientWidth - ICON_ZONE) {
            e.preventDefault()
            openPicker()
          }
          onMouseDown?.(e)
        }}
        onKeyDown={(e) => {
          if ((e.altKey && e.key === 'ArrowDown') || e.key === 'F4') {
            e.preventDefault()
            openPicker()
          }
          onKeyDown?.(e)
        }}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onInput={(e) => {
          check(e.currentTarget)
          onInput?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          const el = e.currentTarget
          const canonical = el.value
          if (canonical !== '') el.value = canonical // chuẩn hoá hiển thị: 1/9/2026 → 01/09/2026
          check(el)
          onBlur?.(e)
        }}
      />
      <LocaleInputHint
        anchor={focused && invalid ? elRef.current : null}
        message={invalid ? t('dateInput.invalid', { pattern: FORMATS[kind].pattern }) : null}
      />
      {createPortal(
          <input
            ref={pickerRef}
            type={kind}
            min={typeof min === 'string' ? min : undefined}
            max={typeof max === 'string' ? max : undefined}
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none fixed opacity-0"
            onChange={(e) => {
              const el = elRef.current
              if (!el) return
              el.value = e.currentTarget.value
              setInvalid(false)
              // Bắn sự kiện input thật để onChange / register() của nơi gọi nhận giá trị mới.
              el.dispatchEvent(new Event('input', { bubbles: true }))
            }}
          />,
          document.body,
        )}
    </>
  )
})
