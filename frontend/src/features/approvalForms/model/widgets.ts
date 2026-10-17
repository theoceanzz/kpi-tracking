import {
  AlignLeft, Building2, Calculator, CalendarDays, CalendarRange, CircleDollarSign, CircleDot, Hash, Image, Info,
  ListChecks, Paperclip, Phone, Table2, Type, UserRound, type LucideIcon,
} from 'lucide-react'
import type { FormWidget, WidgetType } from '../types'

/** Bảng widget bên trái của bước "Thiết kế form", theo nhóm như Lark. */
export const PALETTE: { group: 'text' | 'number' | 'choice' | 'date' | 'other'; types: WidgetType[] }[] = [
  { group: 'text', types: ['TEXT', 'TEXTAREA', 'DESCRIPTION'] },
  { group: 'number', types: ['NUMBER', 'AMOUNT', 'FORMULA'] },
  { group: 'choice', types: ['RADIO', 'CHECKBOX'] },
  { group: 'date', types: ['DATE', 'DATE_RANGE'] },
  { group: 'other', types: ['TABLE', 'IMAGE', 'ATTACHMENT', 'CONTACT', 'DEPARTMENT', 'PHONE'] },
]

export const WIDGET_ICONS: Record<WidgetType, LucideIcon> = {
  TEXT: Type,
  TEXTAREA: AlignLeft,
  DESCRIPTION: Info,
  NUMBER: Hash,
  AMOUNT: CircleDollarSign,
  FORMULA: Calculator,
  RADIO: CircleDot,
  CHECKBOX: ListChecks,
  DATE: CalendarDays,
  DATE_RANGE: CalendarRange,
  TABLE: Table2,
  IMAGE: Image,
  ATTACHMENT: Paperclip,
  CONTACT: UserRound,
  DEPARTMENT: Building2,
  PHONE: Phone,
}

/** Loại làm được cột của Chi tiết/Bảng (khớp `WidgetType.TABLE_CHILDREN`). */
export const TABLE_CHILD_TYPES: WidgetType[] = ['TEXT', 'TEXTAREA', 'NUMBER', 'AMOUNT', 'RADIO', 'CHECKBOX', 'DATE',
  'DATE_RANGE', 'IMAGE', 'ATTACHMENT', 'CONTACT', 'DEPARTMENT', 'PHONE']

export const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'CNY', 'KRW', 'SGD', 'THB']

export const MAX_FILES = 9

const randomId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`

export const newOptionId = () => randomId('o')

/** Mọi widget kể cả cột bảng. */
export function allWidgets(widgets: FormWidget[]): FormWidget[] {
  return widgets.flatMap((w) => [w, ...(w.children ?? [])])
}

/** Tên mặc định không trùng: "Trả lời ngắn", "Trả lời ngắn 2"… */
export function uniqueTitle(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((s) => s.trim().toLowerCase()))
  if (!used.has(base.toLowerCase())) return base
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
}

/**
 * Widget mới với thiết lập mặc định hợp lệ (để vừa kéo vào là Phát hành được).
 * @param label nhãn mặc định của từng loại (đã dịch)
 */
export function newWidget(type: WidgetType, label: (type: WidgetType) => string, takenTitles: Iterable<string>,
  optionLabel: (n: number) => string): FormWidget {
  const title = uniqueTitle(label(type), takenTitles)
  const base: FormWidget = { id: randomId('w'), type, title, required: false }
  switch (type) {
    case 'DESCRIPTION':
      return { ...base, content: '' }
    case 'NUMBER':
      return { ...base, decimals: 0 }
    case 'AMOUNT':
      return { ...base, currency: 'VND', decimals: 0 }
    case 'FORMULA':
      return { ...base, expression: '', decimals: 0 }
    case 'RADIO':
      return { ...base, display: 'DROPDOWN', options: [1, 2].map((n) => ({ id: newOptionId(), label: optionLabel(n) })) }
    case 'CHECKBOX':
      return { ...base, options: [1, 2].map((n) => ({ id: newOptionId(), label: optionLabel(n) })) }
    case 'DATE':
      return { ...base, dateFormat: 'DATE' }
    case 'DATE_RANGE':
      return { ...base, dateFormat: 'DATE', showDuration: true, durationUnit: 'DAY' }
    case 'TABLE':
      return { ...base, children: [], showTotal: true }
    case 'IMAGE':
    case 'ATTACHMENT':
      return { ...base, maxCount: MAX_FILES }
    case 'CONTACT':
    case 'DEPARTMENT':
      return { ...base, multiple: false }
    default:
      return base
  }
}

/** Bản sao của một widget (id mới, kể cả id cột / phương án; tên không trùng). */
export function cloneWidget(w: FormWidget, takenTitles: Iterable<string>): FormWidget {
  const taken = new Set(takenTitles)
  const title = uniqueTitle(w.title, taken)
  taken.add(title)
  return {
    ...structuredClone(w),
    id: randomId('w'),
    title,
    children: w.children?.map((c) => {
      const t = uniqueTitle(c.title, taken)
      taken.add(t)
      return { ...structuredClone(c), id: randomId('w'), title: t }
    }) ?? w.children,
  }
}
