import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export type StatColor = 'indigo' | 'blue' | 'emerald' | 'red' | 'amber' | 'purple' | 'slate'

/**
 * Giữ tên màu cũ ở API nhưng ánh xạ về token ngữ nghĩa: `indigo` = màu chủ đạo,
 * `emerald` = success, `amber` = warning, `red` = error, `blue` = info. `purple` và
 * `slate` là trung tính — tím dành riêng cho K.AI nên không có tông riêng ở đây.
 */
const COLORS: Record<StatColor, { bg: string; icon: string }> = {
  indigo: { bg: 'bg-[var(--color-primary-soft)]', icon: 'text-[var(--color-primary)]' },
  blue: { bg: 'bg-[var(--color-info-bg)]', icon: 'text-[var(--color-info)]' },
  emerald: { bg: 'bg-[var(--color-success-bg)]', icon: 'text-[var(--color-success)]' },
  red: { bg: 'bg-[var(--color-error-bg)]', icon: 'text-[var(--color-error)]' },
  amber: { bg: 'bg-[var(--color-warning-bg)]', icon: 'text-[var(--color-warning)]' },
  purple: { bg: 'bg-[var(--color-muted)]', icon: 'text-[var(--color-muted-foreground)]' },
  slate: { bg: 'bg-[var(--color-muted)]', icon: 'text-[var(--color-muted-foreground)]' },
}

interface Props {
  label: string
  value: ReactNode
  icon: ReactNode
  color?: StatColor
  sub?: ReactNode
  /** Tô cảnh báo khi con số này là vấn đề (vd còn bài quá hạn). */
  highlight?: boolean
  /** Có đường dẫn thì cả thẻ thành liên kết. */
  to?: string
}

/**
 * Thẻ số liệu dùng chung cho cả ba vai trò. Trước đây mỗi dashboard tự khai báo một bản
 * `StatCard` riêng với prop khác nhau, nên cùng một con số lại trông khác nhau giữa các trang.
 *
 * Thứ tự đọc: nhãn (nhỏ, chữ hoa) → con số (to, tabular) → phụ chú. Icon đứng góc phải
 * để cột số bên trái thẳng hàng giữa các thẻ cạnh nhau.
 */
export function StatCard({ label, value, icon, color = 'indigo', sub, highlight, to }: Props) {
  const c = COLORS[color]

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-eyebrow truncate">{label}</p>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-control', c.bg)} aria-hidden="true">
          <span className={cn('[&_svg]:size-4', c.icon)}>{icon}</span>
      </div>
      </div>
      <div className={cn('mt-2 flex min-w-0 items-baseline gap-1.5', highlight ? 'text-[var(--color-error)]' : 'text-[var(--color-foreground)]')}>
        {typeof value === 'string' || typeof value === 'number'
          // Chữ số dạng bảng để con số không nhảy ngang khi dữ liệu đổi
          ? <p className={cn('text-stat truncate', highlight && 'text-[var(--color-error)]')}>{value}</p>
          : value}
      </div>
      {sub && <div className="mt-auto pt-2 text-caption">{sub}</div>}
    </>
  )

  const className = cn(
    'flex h-full flex-col rounded-widget border bg-[var(--color-card)] p-4 transition-colors',
    highlight ? 'border-[var(--color-error-border)]' : 'border-[var(--color-border)]'
  )

  if (to) {
    return (
      <Link
        to={to}
        className={cn(className, 'hover:border-[var(--color-border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2')}
      >
        {body}
      </Link>
    )
  }

  return <div className={className}>{body}</div>
}
