import { useTranslation } from 'react-i18next'
import { useFormat } from '@/i18n/useFormat'
import { cn } from '@/lib/utils'
import type { RequestItem, RequestStatus } from '../../types'

const STATUS_CLS: Record<RequestStatus, string> = {
  PENDING: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  APPROVED: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  REJECTED: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  WITHDRAWN: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useTranslation('approvalForms')
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLS[status])}>
      {t(`requestStatus.${status}`)}
    </span>
  )
}

/** "Loại nghỉ: Phép năm · Thời gian nghỉ: 02/11 → 06/11" — vài trường đầu của đơn, định dạng theo loại widget. */
export function SummaryLine({ item }: { item: RequestItem }) {
  const fmt = useFormat()
  const text = (type: RequestItem['summary'][number]['type'], v: unknown): string => {
    if (Array.isArray(v)) return v.map(String).join(', ')
    if (type === 'NUMBER' || type === 'AMOUNT' || type === 'FORMULA') return fmt.number(Number(v))
    if (type === 'DATE' && typeof v === 'string') return v.includes('T') ? fmt.dateTime(v) : fmt.date(v)
    if (type === 'DATE_RANGE' && v && typeof v === 'object') {
      const r = v as { start?: string; end?: string }
      const f = (s?: string) => (s ? (s.includes('T') ? fmt.dateTime(s) : fmt.date(s)) : '—')
      return `${f(r.start)} → ${f(r.end)}`
    }
    return String(v)
  }
  if (!item.summary.length) return null
  return (
    <span className="mt-0.5 block truncate text-sm text-[var(--color-muted-foreground)]">
      {item.summary.map((s) => `${s.title}: ${text(s.type, s.value)}`).join(' · ')}
    </span>
  )
}
