import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage, formatNumber } from '@/i18n/format'
import { numberExample, parseNumber } from '@/i18n/parse'
import { assignRef, getDisplay, installValueOverride, setDisplay, type LocaleInputElement } from './locale-input-core'
import { LocaleInputHint } from './locale-input-hint'

type NativeProps = React.InputHTMLAttributes<HTMLInputElement> & { 'data-keep-value-on-focus'?: boolean | string }

/**
 * Thay thế thẳng cho `<input type="number">` (docs/I18N_DESIGN.md §5.1). Cùng props, cùng `onChange`,
 * cùng `e.target.value` / `valueAsNumber` (giá trị chuẩn `1000.5`), dùng được với `register()`.
 * Khác biệt duy nhất là cách gõ và hiển thị theo ngôn ngữ: vi `1.000,5`, en `1,000.5`.
 *
 * - Parse CHẶT: vi gõ `1.5` (dấu chấm làm dấu thập phân) không bị đoán thành 1,5 hay 15 — ô báo đỏ
 *   kèm gợi ý đúng định dạng, giá trị trả ra là '' như ô number gốc khi gõ sai.
 * - Rời ô thì định dạng lại (`1000,5` → `1.000,5`) để người dùng thấy máy đã hiểu con số ra sao.
 * - Giữ hành vi cũ của app: bấm vào là ô trống để gõ số mới, rời ô mà chưa gõ gì thì trả lại giá
 *   trị cũ (không bắn sự kiện). Thêm `data-keep-value-on-focus` để tắt, như trước.
 */
export const LocaleNumberInput = React.forwardRef<HTMLInputElement, NativeProps>(function LocaleNumberInput(
  // `type` bị bỏ đi: ô luôn là text (inputMode decimal); nhận vào chỉ để thay thẳng cho <input type="number">.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { value, defaultValue, onFocus, onBlur, onInput, placeholder, type: _type, ...rest },
  forwardedRef,
) {
  const { t } = useTranslation('common')
  const elRef = React.useRef<LocaleInputElement | null>(null)
  const [invalid, setInvalid] = React.useState<'wrongDecimalSeparator' | 'invalid' | null>(null)
  const [focused, setFocused] = React.useState(false)
  const restoreRef = React.useRef<string | null>(null)
  const typedRef = React.useRef(false)
  const lang = currentLanguage()

  const fns = React.useRef({
    toCanonical: (display: string) => {
      const r = parseNumber(display, currentLanguage())
      return r.ok && r.value != null ? String(r.value) : ''
    },
    toDisplay: (canonical: string) => {
      const n = Number(canonical)
      return Number.isFinite(n) ? formatNumber(n, { maximumFractionDigits: 10 }) : canonical
    },
  })

  const setRef = React.useCallback(
    (el: HTMLInputElement | null) => {
      elRef.current = el
      if (el) installValueOverride(el, fns, true)
      assignRef(forwardedRef, el)
    },
    [forwardedRef],
  )

  // defaultValue: gán một lần lúc gắn vào DOM.
  React.useLayoutEffect(() => {
    const el = elRef.current
    if (el && value === undefined && defaultValue !== undefined && getDisplay(el) === '') el.value = String(defaultValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // value (controlled): đồng bộ khi giá trị ngoài khác với con số đang hiển thị.
  React.useLayoutEffect(() => {
    const el = elRef.current
    if (!el || value === undefined) return
    const next = value === null ? '' : String(value)
    if (el.value !== next && !(next === '' && document.activeElement === el)) el.value = next
  }, [value])

  const check = (el: HTMLInputElement) => {
    const r = parseNumber(getDisplay(el), currentLanguage())
    setInvalid(r.ok ? null : r.reason)
  }

  const keepOnFocus = rest['data-keep-value-on-focus'] !== undefined

  return (
    <>
      <input
        {...rest}
        ref={setRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        aria-invalid={invalid ? true : rest['aria-invalid']}
        onFocus={(e) => {
          setFocused(true)
          const el = e.currentTarget
          if (!keepOnFocus && !el.readOnly && !el.disabled && getDisplay(el) !== '') {
            restoreRef.current = getDisplay(el)
            typedRef.current = false
            setDisplay(el, '')
          }
          onFocus?.(e)
        }}
        onInput={(e) => {
          typedRef.current = true
          check(e.currentTarget)
          onInput?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          const el = e.currentTarget
          if (!typedRef.current && restoreRef.current !== null && getDisplay(el) === '') setDisplay(el, restoreRef.current)
          restoreRef.current = null
          // Đúng định dạng thì hiện lại theo chuẩn của ngôn ngữ (1000,5 → 1.000,5).
          const canonical = el.value
          if (canonical !== '') setDisplay(el, fns.current.toDisplay(canonical))
          check(el)
          onBlur?.(e)
        }}
      />
      <LocaleInputHint
        anchor={focused ? elRef.current : null}
        message={invalid ? t(`numberInput.${invalid}`, { example: numberExample(lang) }) : null}
      />
    </>
  )
})
