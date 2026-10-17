import type { ConditionOperator } from '@/features/approvalProcess/types'
import type { FormSchema, FormValues, FormWidget, LocalizedName, VisibilityRule } from '../types'
import { parseFormula } from './formula'

/** Chữ song ngữ theo ngôn ngữ đang xem; thiếu thì lấy bản còn lại. */
export function pickName(name: LocalizedName | null | undefined, lang: string): string {
  if (!name) return ''
  const own = name[lang as 'vi' | 'en']
  if (own?.trim()) return own
  return name.vi?.trim() || name.en?.trim() || ''
}

export const NUMBER_OPS: ConditionOperator[] = ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE']
export const OPTION_OPS: ConditionOperator[] = ['IN', 'NOT_IN']

export const isNumeric = (w: FormWidget) =>
  w.type === 'NUMBER' || w.type === 'AMOUNT' || w.type === 'FORMULA' || w.type === 'DATE_RANGE'
export const isChoice = (w: FormWidget) => w.type === 'RADIO' || w.type === 'CHECKBOX'
export const isInput = (w: FormWidget) => w.type !== 'DESCRIPTION' && w.type !== 'FORMULA'

export interface DateRangeValue {
  start?: string | null
  end?: string | null
  duration?: number | null
}

/** Thời lượng khoảng ngày — cùng cách tính với backend: ngày (tính cả hai đầu) hoặc giờ / ngày theo phút. */
export function rangeDuration(w: FormWidget, v: DateRangeValue | null | undefined): number | null {
  if (!v?.start || !v.end) return null
  if (w.dateFormat === 'DATETIME') {
    const minutes = (new Date(v.end).getTime() - new Date(v.start).getTime()) / 60_000
    if (!Number.isFinite(minutes) || minutes < 0) return null
    return Math.round((minutes / (w.durationUnit === 'DAY' ? 1440 : 60)) * 100) / 100
  }
  const days = Math.round((Date.parse(v.end + 'T00:00:00Z') - Date.parse(v.start + 'T00:00:00Z')) / 86_400_000)
  return Number.isFinite(days) && days >= 0 ? days + 1 : null
}

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function testRule(r: VisibilityRule, numbers: Map<string, number>, options: Map<string, string[]>): boolean {
  if (r.operator === 'IN' || r.operator === 'NOT_IN') {
    const chosen = options.get(r.widget) ?? []
    const any = chosen.some((c) => r.values.includes(c))
    return r.operator === 'IN' ? any : !any
  }
  const actual = numbers.get(r.widget)
  const expected = toNumber(r.values[0])
  if (actual === undefined || expected === null) return false
  switch (r.operator) {
    case 'EQ': return actual === expected
    case 'NEQ': return actual !== expected
    case 'GT': return actual > expected
    case 'GTE': return actual >= expected
    case 'LT': return actual < expected
    case 'LTE': return actual <= expected
    default: return false
  }
}

export interface FormState {
  /** Widget đang hiện (theo điều kiện hiện). */
  visible: Set<string>
  /** Kết quả công thức theo id widget. */
  formulas: Record<string, number | null>
  /** Thời lượng khoảng ngày theo id widget. */
  durations: Record<string, number | null>
  /** Tổng cột Số / Tiền của bảng: `bảng.cột`. */
  columnSums: Record<string, number>
}

/**
 * Trạng thái suy ra của form khi đang điền — cùng thứ tự và luật với `FormValues.java`: đi từ trên xuống, widget
 * ẩn không góp số / phương án cho điều kiện phía dưới, công thức trống tính 0.
 */
export function computeFormState(schema: FormSchema, values: FormValues): FormState {
  const numbers = new Map<string, number>()
  const options = new Map<string, string[]>()
  const state: FormState = { visible: new Set(), formulas: {}, durations: {}, columnSums: {} }
  for (const w of schema.widgets) {
    if (!(w.visibility ?? []).every((r) => testRule(r, numbers, options))) continue
    state.visible.add(w.id)
    const v = values[w.id]
    switch (w.type) {
      case 'NUMBER':
      case 'AMOUNT': {
        const n = toNumber(v)
        if (n !== null) numbers.set(w.id, n)
        break
      }
      case 'DATE_RANGE': {
        const d = rangeDuration(w, v as DateRangeValue)
        state.durations[w.id] = d
        if (d !== null) numbers.set(w.id, d)
        break
      }
      case 'RADIO':
        if (typeof v === 'string' && v) options.set(w.id, [v])
        break
      case 'CHECKBOX':
        if (Array.isArray(v) && v.length) options.set(w.id, v as string[])
        break
      case 'TABLE': {
        const rows = Array.isArray(v) ? (v as Record<string, unknown>[]) : []
        for (const c of w.children ?? []) {
          if (c.type !== 'NUMBER' && c.type !== 'AMOUNT') continue
          state.columnSums[`${w.id}.${c.id}`] = rows.reduce((sum, row) => sum + (toNumber(row?.[c.id]) ?? 0), 0)
        }
        break
      }
      case 'FORMULA': {
        let result: number | null = null
        try {
          result = parseFormula(w.expression).evaluate((ref) =>
            ref.column !== undefined ? state.columnSums[`${ref.widget}.${ref.column}`] : numbers.get(ref.widget))
        } catch {
          result = null
        }
        if (result !== null) {
          const factor = 10 ** (w.decimals ?? 2)
          result = Math.round(result * factor) / factor
          numbers.set(w.id, result)
        }
        state.formulas[w.id] = result
        break
      }
    }
  }
  return state
}

/** Giá trị điền sẵn khi mở form: mặc định của từng widget (hôm nay, chính tôi, đơn vị của tôi, phương án…). */
export function initialValues(
  schema: FormSchema,
  ctx: { me?: { id: string; name: string } | null; myUnit?: { id: string; name: string } | null; today: string; now: string },
): FormValues {
  const out: FormValues = {}
  for (const w of schema.widgets) {
    const d = w.defaultValue
    if (d == null || d === '') continue
    if (w.type === 'DATE' && d === 'TODAY') out[w.id] = w.dateFormat === 'DATETIME' ? ctx.now : ctx.today
    else if (w.type === 'CONTACT' && d === 'ME') { if (ctx.me) out[w.id] = [ctx.me] }
    else if (w.type === 'DEPARTMENT' && d === 'MY_UNIT') { if (ctx.myUnit) out[w.id] = [ctx.myUnit] }
    else if (w.type === 'CHECKBOX') out[w.id] = Array.isArray(d) ? d : [d]
    else out[w.id] = d
  }
  return out
}

/** Ô trống: null, chuỗi rỗng, mảng rỗng, object mọi trường trống. */
export const isEmptyValue = (v: unknown): boolean =>
  v == null || v === '' || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && !Array.isArray(v) && Object.values(v as object).every((x) => x == null || x === ''))

/** Trường bắt buộc còn trống (widget đang hiện; cột bảng xét trên từng dòng có dữ liệu). */
export function requiredErrors(schema: FormSchema, values: FormValues, message: string): Record<string, string> {
  const state = computeFormState(schema, values)
  const out: Record<string, string> = {}
  for (const w of schema.widgets) {
    if (!state.visible.has(w.id) || w.type === 'FORMULA' || w.type === 'DESCRIPTION') continue
    const v = values[w.id]
    if (w.type === 'DATE_RANGE') {
      const r = v as DateRangeValue | undefined
      if (w.required && (!r?.start || !r?.end)) out[w.id] = message
      continue
    }
    if (w.type === 'TABLE') {
      const rows = (Array.isArray(v) ? v : []).filter((row) => !isEmptyValue(row)) as Record<string, unknown>[]
      if (w.required && rows.length === 0) out[w.id] = message
      rows.forEach((row, i) => (w.children ?? []).forEach((c) => {
        if (c.required && isEmptyValue(row[c.id])) out[`${w.id}.${i}.${c.id}`] = message
      }))
      continue
    }
    if (w.required && isEmptyValue(v)) out[w.id] = message
  }
  return out
}

/** Giá trị gửi lên: bỏ widget đang ẩn và dòng bảng trống (backend cũng bỏ, gửi gọn cho dễ xem). */
export function submittableValues(schema: FormSchema, values: FormValues): FormValues {
  const state = computeFormState(schema, values)
  const out: FormValues = {}
  for (const w of schema.widgets) {
    if (!state.visible.has(w.id) || w.type === 'DESCRIPTION' || w.type === 'FORMULA') continue
    let v = values[w.id]
    if (w.type === 'TABLE' && Array.isArray(v)) v = v.filter((row) => !isEmptyValue(row))
    if (!isEmptyValue(v)) out[w.id] = v
  }
  return out
}
