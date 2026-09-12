import { cn } from '@/lib/utils'
import { PRIORITY_META, type Priority, type PriorityFilter } from './priority'
import { Button } from '@/components/ui/button'

/**
 * Hàng thẻ lọc theo mức ưu tiên, dùng chung cho hai widget "việc cần xử lý".
 *
 * <p>Bản gốc trên trang chủ cũ là bốn ô cao gần 100px — trên lưới widget chúng ăn mất nửa ô
 * trước khi hiện được dòng dữ liệu nào, nên ở đây là bốn nút dẹt: nhãn + số, đủ để chọn và để
 * thấy phân bố mức độ.
 */
export function PriorityTabs({ counts, total, value, onChange }: {
  counts: Record<Priority, number>
  total: number
  value: PriorityFilter
  onChange: (v: PriorityFilter) => void
}) {
  const tabs: { key: PriorityFilter; label: string; count: number; hint: string; dot: string }[] = [
    { key: 'ALL', label: 'Tất cả', count: total, hint: 'Toàn bộ mục đang mở', dot: 'bg-[var(--color-primary)]' },
    ...(['URGENT', 'REVIEW', 'MONITOR'] as Priority[]).map(p => ({
      key: p, label: PRIORITY_META[p].label, count: counts[p], hint: PRIORITY_META[p].hint, dot: PRIORITY_META[p].dot,
    })),
  ]

  return (
    <div role="tablist" aria-label="Lọc theo mức ưu tiên" className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
      {tabs.map(t => {
        const active = value === t.key
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            title={t.hint}
            onClick={() => onChange(t.key)}
            className={cn(
              'flex items-center justify-between gap-2 px-3 py-2 rounded-card border transition-all cursor-pointer',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
              active
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border-strong)]',
            )}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', t.dot)} aria-hidden="true" />
              <span className={cn(
                'text-eyebrow truncate',
                active ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]',
              )}>
                {t.label}
              </span>
            </span>
            <span className={cn(
              'text-sm font-semibold tabular-nums shrink-0',
              'text-[var(--color-foreground)]',
            )}>
              {t.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Nhãn ngắn cho một mức ưu tiên; `label` cho phép thay chữ nhưng giữ nguyên màu của mức đó. */
export function PriorityChip({ priority, label, srSuffix }: {
  priority: Priority
  label?: string
  /** Câu chỉ dành cho trình đọc màn hình — dùng khi màu là thứ duy nhất nói lên mức ưu tiên. */
  srSuffix?: string
}) {
  const meta = PRIORITY_META[priority]
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-control border text-eyebrow shrink-0',
      meta.chip,
    )}>
      {label ?? meta.label}
      {srSuffix && <span className="sr-only"> {srSuffix}</span>}
    </span>
  )
}

/** Nút "xem thêm / thu gọn" cuối danh sách. */
export function ShowMoreButton({ hidden, expanded, onMore, onLess }: {
  hidden: number
  expanded: boolean
  onMore: () => void
  onLess: () => void
}) {
  if (hidden <= 0 && !expanded) return null
  return (
    <Button variant="outline" className="w-full shrink-0" onClick={hidden > 0 ? onMore : onLess}>
      {hidden > 0 ? `Xem thêm ${hidden} mục` : 'Thu gọn'}
    </Button>
  )
}
