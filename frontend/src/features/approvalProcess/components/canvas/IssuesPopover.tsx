import { AlertTriangle, CheckCircle2, ChevronDown, CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { GraphIssue } from '../../model/processGraphModel'

export interface IssueView {
  issue: GraphIssue
  /** Tên node bị lỗi ("1.1 · Trưởng phòng duyệt"); null với lỗi của cả sơ đồ. */
  node: string | null
  text: string
  /** Bấm vào dòng sẽ làm gì: mở cài đặt, hay chỉ đưa node vào giữa khung nhìn. */
  action: string | null
}

/**
 * Huy hiệu "2 lỗi · 1 cảnh báo" trên thanh công cụ của khung vẽ; bấm vào mở danh sách việc còn
 * thiếu, bấm từng dòng để tới đúng chỗ cần sửa. Nằm sát khung vẽ — người đang vẽ nhìn thấy ngay,
 * không phải cuộn xuống đáy trang tìm.
 */
export default function IssuesPopover({
  items, open, onOpenChange, onPick,
}: {
  items: IssueView[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (issue: GraphIssue) => void
}) {
  const { t } = useTranslation('approvalProcess')
  const errors = items.filter((i) => i.issue.severity === 'error').length
  const warnings = items.length - errors

  if (items.length === 0) {
    return (
      <span className="ml-1 flex items-center gap-1 px-1.5 text-caption text-[var(--color-success)]">
        <CheckCircle2 size={14} aria-hidden="true" /> {t('editor.diagramValid')}
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t('editor.openIssues')}
          className={cn(
            'ml-1 flex h-8 items-center gap-2 rounded-control border px-2 text-caption font-medium transition-colors',
            errors > 0
              ? 'border-[var(--color-error-border)] bg-[var(--color-error-bg)] hover:border-[var(--color-error)]'
              : 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] hover:border-[var(--color-warning)]',
          )}
        >
          {errors > 0 && (
            <span className="flex items-center gap-1 text-[var(--color-error)]">
              <CircleAlert size={14} aria-hidden="true" /> {t('editor.errorCount', { count: errors })}
            </span>
          )}
          {warnings > 0 && (
            <span className="flex items-center gap-1 text-[var(--color-warning)]">
              <AlertTriangle size={14} aria-hidden="true" /> {t('editor.warningCount', { count: warnings })}
            </span>
          )}
          <ChevronDown size={14} aria-hidden="true" className={cn('text-[var(--color-muted-foreground)] transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] p-0">
        <p className="border-b border-[var(--color-border)] px-3 py-2 text-sm font-semibold">
          {t('editor.issuesTitle', { count: items.length })}
        </p>
        <ul className="max-h-80 divide-y divide-[var(--color-border)] overflow-y-auto">
          {items.map((v, idx) => (
            <li key={`${v.issue.key}-${v.issue.nodeId ?? ''}-${idx}`}>
              <button
                type="button"
                onClick={() => onPick(v.issue)}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--color-muted)]"
              >
                {v.issue.severity === 'error'
                  ? <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-error)]" />
                  : <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-warning)]" />}
                <span className="min-w-0 flex-1">
                  {v.node && <span className="block truncate text-sm font-medium">{v.node}</span>}
                  <span className="block text-sm text-[var(--color-muted-foreground)]">{v.text}</span>
                  {v.action && <span className="mt-0.5 block text-caption text-[var(--color-primary)]">{v.action}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
