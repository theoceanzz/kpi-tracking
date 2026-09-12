import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface BalanceTile {
  label: string
  value: ReactNode
  hint?: string
  icon?: LucideIcon
  tone?: 'success' | 'info' | 'warning' | 'neutral'
}

interface BalanceHeroProps {
  /** Nhãn của con số chính, vd "Số dư điểm thưởng". */
  label: string
  /** Con số chính đã định dạng. */
  value: ReactNode
  /** Đơn vị đứng sau con số, vd "điểm". */
  unit?: string
  /** Dòng phụ dưới con số (gợi ý khi trống, tỉ giá, cảnh báo nhẹ). */
  hint?: ReactNode
  /** Con số chính âm thì tô đỏ. */
  negative?: boolean
  tiles?: BalanceTile[]
  loading?: boolean
  id?: string
}

const TONE: Record<NonNullable<BalanceTile['tone']>, string> = {
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  info: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  neutral: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
}

/**
 * Khối số dư cho các ví (điểm thưởng, ví tiền) — UX_PATTERNS.md §R10.
 *
 * Con số chính đứng trong một card cùng nền với các ô phụ, KHÔNG tô nền primary/success:
 * nền màu + chữ token trung tính không đọc được ở một trong hai theme, và mỗi tổ chức
 * một màu primary nên "ví màu tím" không phải lúc nào cũng có nghĩa. Con số to (28px)
 * và vị trí đầu hàng là đủ để nói "đây là số quan trọng nhất".
 */
export default function BalanceHero({ label, value, unit, hint, negative, tiles = [], loading, id }: BalanceHeroProps) {
  if (loading) {
    return (
      <div id={id} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(auto-fit,minmax(0,1fr))]">
        <div className="h-[104px] animate-pulse rounded-card bg-[var(--color-muted)]" />
        {(tiles.length ? tiles : [1, 2]).map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-card bg-[var(--color-muted)]" />
        ))}
      </div>
    )
  }

  return (
    <div
      id={id}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(var(--tiles),minmax(0,1fr))]"
      style={{ ['--tiles' as string]: String(Math.max(tiles.length, 1)) }}
    >
      <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:col-span-2 lg:col-span-1">
        <p className="text-eyebrow">{label}</p>
        <p className="mt-1.5 flex items-baseline gap-1.5">
          <span className={cn('text-[32px] font-semibold leading-9 tracking-tight tabular-nums', negative ? 'text-[var(--color-error)]' : 'text-[var(--color-foreground)]')}>
            {value}
          </span>
          {unit && <span className="text-sm text-[var(--color-muted-foreground)]">{unit}</span>}
        </p>
        {hint && <div className="mt-2 text-sm text-[var(--color-muted-foreground)]">{hint}</div>}
      </div>

      {tiles.map(t => {
        const Icon = t.icon
        return (
          <div key={t.label} className="flex items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            {Icon && (
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-control', TONE[t.tone ?? 'neutral'])} aria-hidden="true">
                <Icon size={17} />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-eyebrow">{t.label}</p>
              <p className="mt-0.5 truncate text-stat">{t.value}</p>
              {t.hint && <p className="truncate text-caption">{t.hint}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
