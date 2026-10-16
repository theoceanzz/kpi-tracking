import { useTranslation } from 'react-i18next'
import { formatDate, formatNumber } from '@/i18n/format'
import type { TaskListField } from '../types'

/** Giá trị trường tuỳ chỉnh dạng chữ ngắn (dòng việc, bảng, thẻ). */
export function useFieldText() {
  const { t } = useTranslation('tasks')
  return (field: TaskListField, value: unknown, people?: Map<string, string>): string | null => {
    if (value == null || value === '') return null
    switch (field.type) {
      case 'NUMBER': return formatNumber(Number(value))
      case 'DATE': return formatDate(String(value))
      case 'CHECKBOX': return value === true ? t('field.yes') : t('field.no')
      case 'SINGLE_SELECT': return field.options.find((o) => o.id === value)?.label ?? null
      case 'MULTI_SELECT': return (value as string[]).map((id) => field.options.find((o) => o.id === id)?.label).filter(Boolean).join(', ') || null
      case 'MEMBER': return (value as string[]).map((id) => people?.get(id) ?? '…').join(', ')
      default: return String(value)
    }
  }
}
