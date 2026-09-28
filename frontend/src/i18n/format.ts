import { format as formatWithPattern, isValid, parseISO } from 'date-fns'
import i18n from 'i18next'
import { DATE_FNS_LOCALES, DATE_PATTERNS, INTL_DATE_LOCALES, INTL_LOCALES } from './dateLocales'
import { DEFAULT_LANGUAGE, isSupportedLanguage, type Language } from './languages'

/**
 * Định dạng HIỂN THỊ số, tiền, phần trăm, ngày theo ngôn ngữ đang chọn. Mọi chỗ hiển thị đi qua đây,
 * không gọi `toLocaleString('vi-VN')` hay import locale `vi` của date-fns trực tiếp (§4.4 I18N_DESIGN).
 *
 * Trong component nên dùng `useFormat()` để tự vẽ lại khi đổi ngôn ngữ. Các hàm ở đây nhận `lang`
 * tuỳ chọn; bỏ trống thì lấy ngôn ngữ hiện tại của i18next.
 */

export function currentLanguage(): Language {
  const lang = i18n.resolvedLanguage ?? i18n.language
  return isSupportedLanguage(lang) ? lang : DEFAULT_LANGUAGE
}

/** Locale cho `Intl.NumberFormat` / `number.toLocaleString(...)` theo ngôn ngữ hiện tại. */
export function intlLocale(): string {
  return INTL_LOCALES[currentLanguage()]
}

/** Locale cho `Date.toLocaleDateString(...)` / `Intl.DateTimeFormat` theo ngôn ngữ hiện tại (en → en-GB). */
export function intlDateLocale(): string {
  return INTL_DATE_LOCALES[currentLanguage()]
}

/** Locale của date-fns / react-day-picker theo ngôn ngữ hiện tại. */
export function dateFnsLocale() {
  return DATE_FNS_LOCALES[currentLanguage()]
}

const numberFormatCache = new Map<string, Intl.NumberFormat>()

function numberFormatter(lang: Language, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${lang}|${JSON.stringify(options)}`
  let formatter = numberFormatCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALES[lang], options)
    numberFormatCache.set(key, formatter)
  }
  return formatter
}

type Nullable<T> = T | null | undefined

/** `1000.5` → vi `1.000,5`, en `1,000.5`. Mặc định tối đa 2 chữ số thập phân. Null/NaN → chuỗi rỗng. */
export function formatNumber(
  value: Nullable<number>,
  options: Intl.NumberFormatOptions = {},
  lang: Language = currentLanguage()
): string {
  if (value == null || !Number.isFinite(value)) return ''
  return numberFormatter(lang, { maximumFractionDigits: 2, ...options }).format(value)
}

/**
 * Tiền VND: không có phần thập phân (làm tròn), ký hiệu `₫` luôn đứng SAU số ở mọi ngôn ngữ —
 * vi `1.000.000 ₫`, en `1,000,000 ₫`. Không dùng `style: 'currency'` vì en-US sẽ đặt `₫` lên trước.
 */
export function formatCurrency(value: Nullable<number>, lang: Language = currentLanguage()): string {
  if (value == null || !Number.isFinite(value)) return ''
  return `${formatNumber(Math.round(value), { maximumFractionDigits: 0 }, lang)} ₫`
}

/** Nhận giá trị 0–100 như API hiện tại: `12.5` → vi `12,5%`, en `12.5%`. */
export function formatPercent(
  value: Nullable<number>,
  options: Intl.NumberFormatOptions = {},
  lang: Language = currentLanguage()
): string {
  if (value == null || !Number.isFinite(value)) return ''
  return `${formatNumber(value, { maximumFractionDigits: 1, ...options }, lang)}%`
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Chuỗi `yyyy-MM-dd` (ngày không có giờ) được hiểu là ngày ĐỊA PHƯƠNG. `new Date('2026-09-26')` hiểu là
 * nửa đêm UTC, sang UTC−x sẽ lùi một ngày — nên phải qua `parseISO`.
 */
export function toDate(value: Nullable<string | number | Date>): Date | null {
  if (value == null || value === '') return null
  const date =
    value instanceof Date ? value : typeof value === 'string' && DATE_ONLY.test(value) ? parseISO(value) : new Date(value)
  return isValid(date) ? date : null
}

/** vi `26/09/2026`, en `26 Sep 2026`. */
export function formatDate(value: Nullable<string | number | Date>, lang: Language = currentLanguage()): string {
  const date = toDate(value)
  return date ? formatWithPattern(date, DATE_PATTERNS[lang].date, { locale: DATE_FNS_LOCALES[lang] }) : ''
}

/** vi `26/09/2026 14:30`, en `26 Sep 2026, 14:30`. */
export function formatDateTime(value: Nullable<string | number | Date>, lang: Language = currentLanguage()): string {
  const date = toDate(value)
  return date ? formatWithPattern(date, DATE_PATTERNS[lang].dateTime, { locale: DATE_FNS_LOCALES[lang] }) : ''
}
