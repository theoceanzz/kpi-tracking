import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export type StatColor = 'indigo' | 'blue' | 'emerald' | 'red' | 'amber' | 'purple' | 'slate'

const COLORS: Record<StatColor, { bg: string; icon: string }> = {
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/30', icon: 'text-indigo-600 dark:text-indigo-400' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400' },
  red: { bg: 'bg-red-50 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', icon: 'text-amber-600 dark:text-amber-400' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/30', icon: 'text-purple-600 dark:text-purple-400' },
  slate: { bg: 'bg-slate-100 dark:bg-slate-800', icon: 'text-slate-600 dark:text-slate-300' },
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
 */
export function StatCard({ label, value, icon, color = 'indigo', sub, highlight, to }: Props) {
  const c = COLORS[color]

  const body = (
    <>
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4 shrink-0', c.bg)} aria-hidden="true">
        <span className={c.icon}>{icon}</span>
      </div>
      <div className={cn('flex items-baseline gap-1.5 min-w-0', highlight ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white')}>
        {typeof value === 'string' || typeof value === 'number'
          // Chữ số dạng bảng để con số không nhảy ngang khi dữ liệu đổi
          ? <p className="text-2xl font-black tracking-tight tabular-nums truncate">{value}</p>
          : value}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">{label}</p>
      {sub && <div className="mt-auto pt-3 text-[10px] font-bold text-slate-400">{sub}</div>}
    </>
  )

  const className = cn(
    'bg-white dark:bg-slate-900 rounded-2xl border p-5 h-full flex flex-col transition-all',
    highlight ? 'border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-800'
  )

  if (to) {
    return (
      <Link
        to={to}
        className={cn(className, 'hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950')}
      >
        {body}
      </Link>
    )
  }

  return <div className={className}>{body}</div>
}
