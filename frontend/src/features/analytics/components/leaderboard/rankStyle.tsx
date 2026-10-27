import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { SortHeader, type SortDir } from '@/components/common/SortHeader'

/**
 * Phần nhìn dùng chung của hai bảng xếp hạng.
 *
 * <p>Ba hạng đầu là VÀNG / BẠC / ĐỒNG — bảng xếp hạng mà mọi hàng trông như nhau thì phải đọc số
 * mới biết ai nhất, trong khi cả điểm của ô này là liếc một cái thấy ngay. Hạng 4 trở đi là số
 * thường, không trang trí: trang trí hết thì không còn gì nổi bật.
 *
 * <p>Màu huy chương viết thẳng ở đây (không lấy từ bảng màu biểu đồ) vì chúng mang nghĩa THỨ HẠNG
 * chứ không mang nghĩa trạng thái — trộn vào `chartPalette` là mở đường cho "vàng = cảnh báo".
 */

const MEDALS: Record<number, { ring: string; chip: string; labelKey: string }> = {
  1: {
    ring: 'ring-2 ring-amber-400/70',
    chip: 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-sm shadow-amber-500/40',
    labelKey: 'leaderboard.medalGold',
  },
  2: {
    ring: 'ring-1 ring-slate-300/70',
    chip: 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900',
    labelKey: 'leaderboard.medalSilver',
  },
  3: {
    ring: 'ring-1 ring-orange-400/50',
    chip: 'bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950',
    labelKey: 'leaderboard.medalBronze',
  },
}

/** Viên hạng: huy chương cho top 3, số chìm cho phần còn lại. */
export function RankBadge({ rank }: { rank: number }) {
  const { t } = useTranslation('analytics')
  const medal = MEDALS[rank]
  if (!medal) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-semibold tabular-nums text-[var(--color-muted-foreground)]">
        {rank}
      </span>
    )
  }
  return (
    <span
      title={t(medal.labelKey)}
      className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black tabular-nums', medal.chip)}
    >
      {rank === 1 ? <Crown size={14} aria-hidden="true" /> : rank}
    </span>
  )
}

/**
 * Hàng bảng xếp hạng: bấm được, top 1 có viền sáng.
 *
 * <p>Chuyển tiếp ref và mọi prop DOM còn lại xuống `<tr>` để bọc được bằng `TooltipTrigger asChild`
 * (thẻ xem nhanh lúc rê chuột) mà không phải dựng một hàng riêng.
 */
export const RankRow = forwardRef<HTMLTableRowElement, {
  rank: number
  onClick?: () => void
  title?: string
  children: ReactNode
} & Omit<ComponentPropsWithoutRef<'tr'>, 'title' | 'onClick' | 'children'>>(
  ({ rank, onClick, title, children, className, ...rest }, ref) => {
    const medal = MEDALS[rank]
    return (
      <tr
        ref={ref}
        onClick={onClick}
        title={title}
        className={cn(
          'border-t border-[var(--color-border)] transition-colors',
          medal?.ring,
          onClick && 'cursor-pointer hover:bg-[var(--color-muted)]',
          className,
        )}
        {...rest}
      >
        {children}
      </tr>
    )
  },
)
RankRow.displayName = 'RankRow'

/** Ô số căn phải, chữ số đều bề ngang để cột không nhảy. */
export function NumCell({ children, className, strong }: {
  children: ReactNode
  className?: string
  strong?: boolean
}) {
  return (
    <td className={cn('px-3 py-2 text-right text-sm tabular-nums',
      strong ? 'font-semibold text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]',
      className)}
    >
      {children}
    </td>
  )
}

/** Nhãn xếp loại — màu do server cấp (bảng `evaluation_levels` của tổ chức). */
export function RatingPill({ name, color }: { name?: string | null; color?: string | null }) {
  if (!name) return <span className="text-sm text-slate-400">—</span>
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color ?? '#94a3b8'}22`, color: color ?? '#64748b' }}
    >
      {name}
    </span>
  )
}

/** Khung bảng + trạng thái rỗng/đang tải dùng chung. */
export function RankTableShell({ head, isLoading, empty, emptyText, hint, children }: {
  head: ReactNode
  isLoading?: boolean
  empty: boolean
  emptyText: string
  hint?: string
  children: ReactNode
}) {
  if (!isLoading && empty) {
    return (
      <p className="flex-1 flex items-center justify-center px-6 text-center text-sm text-slate-400">
        {emptyText}
      </p>
    )
  }
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[var(--color-card)]">
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{head}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {/*
        Bấm được thì phải nói ra — con trỏ đổi hình thôi là chưa đủ (chuẩn `bieu-do-chuan`).
        `px-3` cho thẳng cột với ô bảng (td cũng `px-3`); thiếu nó thì dòng này thụt ra ngoài mép
        chữ của cả bảng và nhìn lệch hẳn. Nét trên tách nó khỏi hàng cuối.
      */}
      {hint && (
        <p className="mt-2 border-t border-[var(--color-border)] px-3 pt-2 pb-0.5 text-xs text-slate-400">
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * Đầu một cột SỐ của bảng xếp hạng: bấm để xếp theo cột đó, bấm lại để đảo chiều.
 *
 * <p>Đây là chỗ "nói ra bảng đang xếp theo gì" gần dữ liệu nhất — mũi tên nằm ngay trên cột. Hàng
 * chip phía trên bảng nói cùng một thứ bằng chữ; hai chỗ đọc chung một chỗ lưu (`s.o`) nên không
 * bao giờ lệch nhau.
 */
export function SortableHead({ field, sortBy, dir, onSort, children }: {
  field: string
  sortBy: string
  dir: SortDir
  onSort: (field: string, dir: SortDir) => void
  children: ReactNode
}) {
  return (
    <th className="px-3 py-2 text-right">
      <SortHeader
        field={field}
        active={sortBy}
        dir={dir}
        // Bấm đúng cột đang xếp = đảo chiều; bấm cột khác = xếp cột đó, giữ nguyên chiều.
        onToggle={f => onSort(f, f === sortBy ? (dir === 'desc' ? 'asc' : 'desc') : dir)}
        className="ml-auto text-[11px] font-semibold uppercase tracking-wide"
      >
        {children}
      </SortHeader>
    </th>
  )
}
