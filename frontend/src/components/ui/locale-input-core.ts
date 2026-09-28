/**
 * Lõi dùng chung cho ô nhập số / ngày theo ngôn ngữ (docs/I18N_DESIGN.md §5).
 *
 * Ý tưởng: ô trên màn hình là `<input type="text">` hiển thị theo ngôn ngữ đang chọn (`1.000,5`,
 * `26/09/2026`), nhưng thuộc tính `value` của CHÍNH thẻ đó được ghi đè để đọc ra / nhận vào giá trị
 * chuẩn (`1000.5`, `2026-09-26`) — giống hệt `<input type="number|date">` gốc. Nhờ vậy mọi nơi đang
 * dùng `e.target.value`, `register()` của react-hook-form hay `ref.value` đều chạy nguyên, không phải sửa.
 *
 *   - Đọc `el.value`  → giá trị chuẩn; chữ gõ dở / sai định dạng → '' (như ô number gốc).
 *   - Gán `el.value`  → định dạng lại để hiển thị (react-hook-form `reset`/`setValue` đi đường này).
 *
 * Ô KHÔNG truyền `value` xuống DOM (React coi là uncontrolled) — prop `value` của nơi gọi được đồng bộ
 * bằng effect, để chữ đang gõ dở (`1.000,`) không bị React ghi đè giữa chừng.
 */

const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!

export type LocaleInputElement = HTMLInputElement & { __localeInput?: true }

/** Chữ đang hiển thị (không qua phần ghi đè). */
export function getDisplay(el: HTMLInputElement): string {
  return nativeValue.get!.call(el) as string
}

/** Ghi chữ hiển thị (không qua phần ghi đè, không bắn sự kiện). */
export function setDisplay(el: HTMLInputElement, text: string) {
  nativeValue.set!.call(el, text)
}

/**
 * Ghi đè `value` / `valueAsNumber` của một thẻ input. `toCanonical` đọc chữ hiển thị ra giá trị chuẩn,
 * `toDisplay` làm ngược lại. Hai hàm được đọc qua ref ở mỗi lần gọi nên luôn theo ngôn ngữ hiện tại.
 */
export function installValueOverride(
  el: LocaleInputElement,
  fns: { current: { toCanonical: (display: string) => string; toDisplay: (canonical: string) => string } },
  withValueAsNumber: boolean,
) {
  if (el.__localeInput) return
  Object.defineProperty(el, 'value', {
    configurable: true,
    get() {
      return fns.current.toCanonical(getDisplay(el))
    },
    set(v: unknown) {
      setDisplay(el, v == null || v === '' ? '' : fns.current.toDisplay(String(v)))
    },
  })
  if (withValueAsNumber) {
    Object.defineProperty(el, 'valueAsNumber', {
      configurable: true,
      get() {
        const s = el.value
        return s === '' ? NaN : Number(s)
      },
    })
  }
  el.__localeInput = true
}

/** Gán ref cho cả ref nội bộ lẫn ref nơi gọi truyền vào (callback hoặc object). */
export function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value
}
