import type { FormConditionField } from '@/features/approvalProcess/types'
import type { GraphIssue } from '@/features/approvalProcess/model/processGraphModel'
import type { FormSchema, FormWidget, LocalizedName, SubmitterScope } from '../types'
import { parseFormula, FormulaError } from './formula'
import { NUMBER_OPS, OPTION_OPS, isChoice, isInput, isNumeric } from './formState'
import { MAX_FILES, TABLE_CHILD_TYPES } from './widgets'

export const MAX_WIDGETS = 100
export const MAX_COLUMNS = 20
export const MAX_OPTIONS = 100
export const MAX_TITLE = 100
export const MAX_NAME = 100
export const MAX_DESCRIPTION = 500
const ID = /^[A-Za-z0-9_-]{1,40}$/

export type EditorStep = 1 | 2 | 3 | 4

/**
 * Một chỗ chưa xong trước khi Phát hành. `key` dịch ở `approvalForms:issues.*` (bước 1–2, cùng mã với
 * `approvalForm.schema.*` của backend) hoặc `approvalProcess:graph.*` (bước 3).
 */
export interface FormIssue {
  step: EditorStep
  key: string
  args?: Record<string, unknown>
  /** Bước 1: tên ô (`name`, `group`, `submitters`, `admins`). */
  field?: string
  /** Bước 2: widget + thiết lập bị lỗi. */
  widgetId?: string
  setting?: string
  /** Bước 3. */
  graph?: GraphIssue
}

export interface BasicInfo {
  name: LocalizedName
  description: LocalizedName
  groupId: string | null
  submitterScope: SubmitterScope
  submitterCount: number
  adminCount: number
}

export function basicIssues(b: BasicInfo): FormIssue[] {
  const out: FormIssue[] = []
  const names = [b.name.vi, b.name.en].filter((n) => n?.trim())
  if (!names.length) out.push({ step: 1, field: 'name', key: 'nameRequired' })
  else if (names.some((n) => n!.trim().length > MAX_NAME)) out.push({ step: 1, field: 'name', key: 'nameTooLong', args: { max: MAX_NAME } })
  if ([b.description.vi, b.description.en].some((d) => (d?.trim().length ?? 0) > MAX_DESCRIPTION)) {
    out.push({ step: 1, field: 'description', key: 'descriptionTooLong', args: { max: MAX_DESCRIPTION } })
  }
  if (!b.groupId) out.push({ step: 1, field: 'group', key: 'groupRequired' })
  if (b.submitterScope === 'SPECIFIED' && b.submitterCount === 0) out.push({ step: 1, field: 'submitters', key: 'submittersRequired' })
  if (b.adminCount === 0) out.push({ step: 1, field: 'admins', key: 'adminsRequired' })
  return out
}

/** Cùng bộ luật với `FormSchemaValidator.java`. */
export function schemaIssues(schema: FormSchema): FormIssue[] {
  const out: FormIssue[] = []
  const add = (widgetId: string | undefined, setting: string | undefined, key: string, args?: Record<string, unknown>) =>
    out.push({ step: 2, widgetId, setting, key, args })
  const widgets = schema.widgets
  const total = widgets.reduce((n, w) => n + 1 + (w.children?.length ?? 0), 0)
  if (total > MAX_WIDGETS) {
    add(undefined, undefined, 'tooMany', { max: MAX_WIDGETS })
    return out
  }
  if (!widgets.some(isInput)) add(undefined, undefined, 'noInput')

  const ids = new Set<string>()
  const titles = new Set<string>()
  const earlier = new Map<string, FormWidget>()

  const identity = (w: FormWidget) => {
    if (!w.type || !ID.test(w.id) || ids.has(w.id)) {
      add(w.id, undefined, 'badWidget')
      return false
    }
    ids.add(w.id)
    return true
  }

  const common = (w: FormWidget) => {
    if (w.type === 'DESCRIPTION') {
      if (!w.content?.trim()) add(w.id, 'content', 'contentRequired')
      else if (w.content.length > 2000) add(w.id, 'content', 'contentTooLong', { max: 2000 })
    }
    const title = w.title?.trim() ?? ''
    if (!title) add(w.id, 'title', 'titleRequired')
    else if (title.length > MAX_TITLE) add(w.id, 'title', 'titleTooLong', { max: MAX_TITLE })
    else if (titles.has(title.toLowerCase())) add(w.id, 'title', 'titleDuplicate')
    else titles.add(title.toLowerCase())
    if ((w.placeholder?.length ?? 0) > 200) add(w.id, 'placeholder', 'placeholderTooLong', { max: 200 })
    if (w.maxLength != null && (w.maxLength < 1 || w.maxLength > 10_000)) add(w.id, 'maxLength', 'badMaxLength', { max: 10_000 })
    if (w.decimals != null && (w.decimals < 0 || w.decimals > 4)) add(w.id, 'decimals', 'badDecimals', { max: 4 })
    if (w.min != null && w.max != null && w.min > w.max) add(w.id, 'min', 'minAboveMax')
    if (isChoice(w)) options(w)
    if ((w.type === 'IMAGE' || w.type === 'ATTACHMENT') && w.maxCount != null && (w.maxCount < 1 || w.maxCount > MAX_FILES)) {
      add(w.id, 'maxCount', 'badMaxCount', { max: MAX_FILES })
    }
  }

  const options = (w: FormWidget) => {
    const list = w.options ?? []
    if (!list.length) {
      add(w.id, 'options', 'optionsRequired')
      return
    }
    if (list.length > MAX_OPTIONS) add(w.id, 'options', 'tooManyOptions', { max: MAX_OPTIONS })
    const optionIds = new Set<string>()
    const labels = new Set<string>()
    for (const o of list) {
      if (!o.id || optionIds.has(o.id) || !o.label?.trim()) {
        add(w.id, 'options', 'optionEmpty')
        return
      }
      optionIds.add(o.id)
      const label = o.label.trim().toLowerCase()
      if (labels.has(label)) {
        add(w.id, 'options', 'optionDuplicate', { name: o.label.trim() })
        return
      }
      labels.add(label)
    }
    const def = w.defaultValue
    if (def == null) return
    const chosen = Array.isArray(def) ? def : [def]
    if ((w.type === 'RADIO' && chosen.length > 1) || !chosen.every((v) => optionIds.has(String(v)))) {
      add(w.id, 'defaultValue', 'badDefault')
    }
  }

  for (const w of widgets) {
    if (!identity(w)) continue
    common(w)
    if (w.type === 'FORMULA') {
      try {
        const f = parseFormula(w.expression)
        const bad = f.refs.some((ref) => {
          const target = earlier.get(ref.widget)
          if (ref.column !== undefined) {
            return !(target?.type === 'TABLE' && (target.children ?? [])
              .some((c) => c.id === ref.column && (c.type === 'NUMBER' || c.type === 'AMOUNT')))
          }
          return !target || !isNumeric(target)
        })
        if (bad) add(w.id, 'expression', 'formulaBadRef')
      } catch (e) {
        if (e instanceof FormulaError) add(w.id, 'expression', 'formulaInvalid')
        else throw e
      }
    }
    if (w.type === 'TABLE') {
      const columns = w.children ?? []
      if (!columns.length) add(w.id, 'children', 'tableNoColumns')
      else if (columns.length > MAX_COLUMNS) add(w.id, 'children', 'tooManyColumns', { max: MAX_COLUMNS })
      for (const c of columns) {
        if (!identity(c)) continue
        if (!TABLE_CHILD_TYPES.includes(c.type)) {
          add(c.id, undefined, 'tableBadColumn')
          continue
        }
        common(c)
      }
    }
    for (const r of w.visibility ?? []) {
      const source = earlier.get(r.widget)
      const values = r.values.filter((v) => v?.trim())
      const ok = !!source && values.length > 0 && (isChoice(source)
        ? OPTION_OPS.includes(r.operator) && values.every((v) => (source.options ?? []).some((o) => o.id === v))
        : isNumeric(source) && NUMBER_OPS.includes(r.operator) && values.length === 1 && Number.isFinite(Number(values[0])))
      if (!ok) {
        add(w.id, 'visibility', 'visibilityInvalid')
        break
      }
    }
    earlier.set(w.id, w)
  }
  return out
}

/** Widget dùng được trong điều kiện duyệt (bước 3): số / chọn ở cấp ngoài cùng. */
export function formConditionFields(schema: FormSchema, durationSuffix: (w: FormWidget) => string | undefined): FormConditionField[] {
  return schema.widgets.flatMap<FormConditionField>((w) => {
    if (isChoice(w)) {
      return [{ id: w.id, title: w.title, kind: 'OPTION', options: (w.options ?? []).map((o) => ({ value: o.id, label: o.label })) }]
    }
    if (isNumeric(w)) {
      return [{ id: w.id, title: w.title, kind: 'NUMBER', unit: w.type === 'DATE_RANGE' ? durationSuffix(w) : w.unit ?? w.currency ?? undefined }]
    }
    return []
  })
}
