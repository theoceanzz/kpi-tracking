import { INTL_LOCALES } from './dateLocales'
import { formatNumber } from './format'
import { SUPPORTED_LANGUAGES, type Language } from './languages'

/**
 * Đọc số / ngày người dùng GÕ theo ngôn ngữ đang chọn (§5 I18N_DESIGN). Giá trị trả ra luôn trung lập
 * (number, chuỗi `yyyy-MM-dd`) — đó là thứ lưu trong state và gửi lên server, không phải chuỗi đã gõ.
 *
 * Nguyên tắc: parse CHẶT, không đoán. `1.5` ở tiếng Việt có thể là 1,5 hay 15 — báo lỗi kèm ví dụ
 * đúng thay vì chọn bừa một nghĩa.
 */

export type ParseNumberResult =
  | { ok: true; value: number | null }
  /** `wrongDecimalSeparator`: chuỗi hợp lệ theo quy ước của ngôn ngữ KHÁC (vd. gõ `1.5` khi đang ở vi). */
  | { ok: false; reason: 'wrongDecimalSeparator' | 'invalid' }

export function numberSeparators(lang: Language): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(INTL_LOCALES[lang]).formatToParts(12345.6)
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
  }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const patternCache = new Map<Language, RegExp>()

/** Số nguyên có hoặc không có dấu nhóm (nhóm phải đúng 3 chữ số), phần thập phân tuỳ chọn. */
function numberPattern(lang: Language): RegExp {
  let re = patternCache.get(lang)
  if (!re) {
    const { group, decimal } = numberSeparators(lang)
    const g = escapeRegExp(group)
    const d = escapeRegExp(decimal)
    re = new RegExp(`^-?(?:\\d{1,3}(?:${g}\\d{3})+|\\d+)(?:${d}\\d+)?$`)
    patternCache.set(lang, re)
  }
  return re
}

function toNumber(text: string, lang: Language): number {
  const { group, decimal } = numberSeparators(lang)
  return Number(text.split(group).join('').replace(decimal, '.'))
}

/** Chuỗi rỗng → `{ ok: true, value: null }` (ô được để trống). */
export function parseNumber(text: string, lang: Language): ParseNumberResult {
  // Khoảng trắng không mang nghĩa. `\s` của JS đã gồm cả NBSP (thường gặp khi dán từ Excel).
  const compact = text.replace(/\s/g, '')
  if (compact === '') return { ok: true, value: null }

  if (numberPattern(lang).test(compact)) {
    const value = toNumber(compact, lang)
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, reason: 'invalid' }
  }

  const validElsewhere = SUPPORTED_LANGUAGES.some((other) => other !== lang && numberPattern(other).test(compact))
  return { ok: false, reason: validElsewhere ? 'wrongDecimalSeparator' : 'invalid' }
}

/** Ví dụ đúng định dạng cho placeholder / thông báo lỗi: vi `1.000,5`, en `1,000.5`. */
export function numberExample(lang: Language): string {
  return formatNumber(1000.5, { minimumFractionDigits: 1 }, lang)
}

const DATE_INPUT = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/
const DATE_COMPACT = /^(\d{2})(\d{2})(\d{4})$/
const pad2 = (n: number) => String(n).padStart(2, '0')

function toIsoDate(day: number, month: number, year: number): string | null {
  const probe = new Date(year, month - 1, day)
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) return null
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/**
 * `dd/MM/yyyy` (mọi ngôn ngữ; nhận cả `-` `.` và gõ liền `26092026`) → `yyyy-MM-dd`. Ngày không tồn tại
 * (31/02) → null. Không đi qua `Date.toISOString()` vì sẽ lệch một ngày ở múi giờ dương.
 */
export function parseDateInput(text: string): string | null {
  const trimmed = text.trim()
  const match = DATE_INPUT.exec(trimmed) ?? DATE_COMPACT.exec(trimmed)
  return match ? toIsoDate(Number(match[1]), Number(match[2]), Number(match[3])) : null
}

/** `yyyy-MM-dd` → `dd/MM/yyyy` để đổ lại vào ô nhập. */
export function formatDateInput(isoDate: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '')
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

/** `dd/MM/yyyy HH:mm` → `yyyy-MM-ddTHH:mm` (giá trị của `<input type="datetime-local">`). */
export function parseDateTimeInput(text: string): string | null {
  const match = /^(.+?)[\sT,]+(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!match) return null
  const date = parseDateInput(match[1] as string)
  const hour = Number(match[2])
  const minute = Number(match[3])
  if (!date || hour > 23 || minute > 59) return null
  return `${date}T${pad2(hour)}:${pad2(minute)}`
}

/** `yyyy-MM-ddTHH:mm[:ss]` → `dd/MM/yyyy HH:mm`. */
export function formatDateTimeInput(value: string | null | undefined): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value ?? '')
  return match ? `${formatDateInput(match[1])} ${match[2]}:${match[3]}` : ''
}

/** `MM/yyyy` → `yyyy-MM` (giá trị của `<input type="month">`). */
export function parseMonthInput(text: string): string | null {
  const match = /^(\d{1,2})[/.-](\d{4})$/.exec(text.trim())
  if (!match) return null
  const month = Number(match[1])
  return month >= 1 && month <= 12 ? `${match[2]}-${pad2(month)}` : null
}

/** `yyyy-MM` → `MM/yyyy`. */
export function formatMonthInput(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})/.exec(value ?? '')
  return match ? `${match[2]}/${match[1]}` : ''
}
