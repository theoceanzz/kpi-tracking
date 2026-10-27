import { type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/**
 * Phần khung dùng chung của hai sổ đánh giá dạng cây: của một NGƯỜI (kỳ → đợt → KPI) và của một
 * ĐƠN VỊ (kỳ → đợt). Hai cây khác nhau ở từng ô điểm nhưng giống hệt ở hàng gập và ô chỉ số, nên
 * phần đó nằm ở đây thay vì chép đôi.
 */

/** Hàng gập: mũi tên + tên + phần tóm tắt bên phải. Cả hàng là một nút nên bấm đâu cũng mở. */
export function TreeRow({ label, expanded, onToggle, meta, strong }: {
  label: string
  expanded: boolean
  onToggle: () => void
  meta?: ReactNode
  strong?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--color-muted)]"
    >
      <ChevronDown
        size={15}
        aria-hidden="true"
        className={cn('shrink-0 text-[var(--color-muted-foreground)] transition-transform', !expanded && '-rotate-90')}
      />
      <span className={cn('min-w-0 flex-1 truncate text-[var(--color-foreground)]',
        strong ? 'text-sm font-semibold' : 'text-sm font-medium')}>
        {label}
      </span>
      {meta}
    </button>
  )
}

export interface Tile { label: string; value: string | null; accent?: ReactNode }

/** Ô nào không có số thì bỏ hẳn; không còn ô nào thì cả khối nói "Chưa có đánh giá". */
export function ScoreBlock({ title, tiles, footer }: {
  title: string
  tiles: Tile[]
  footer?: ReactNode
}) {
  const { t } = useTranslation('analytics')
  const filled = tiles.filter(x => x.value !== null || x.accent)

  return (
    <section>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {filled.length === 0 ? (
        <p className="rounded-widget border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-sm text-slate-400">
          {t('detail.noEval')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {filled.map(x => (
            <div key={x.label} className="rounded-widget border border-[var(--color-border)] px-3 py-2">
              <p className="truncate text-[11px] text-slate-400" title={x.label}>{x.label}</p>
              {x.accent ?? (
                <p className="text-sm font-semibold tabular-nums text-[var(--color-foreground)]">{x.value}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {footer}
    </section>
  )
}

/**
 * Lớp cho hàng con của cây: nét ngang nối từ nét dọc của danh sách cha vào hàng.
 *
 * <p>Danh sách cha phải có `border-l` + `pl-4` để nét dọc chạy đúng chỗ.
 */
export const TREE_CHILD_ROW =
  'relative overflow-hidden rounded-control border border-[var(--color-border)] '
  + 'before:absolute before:-left-4 before:top-[1.1rem] before:h-px before:w-4 before:bg-[var(--color-border)]'
