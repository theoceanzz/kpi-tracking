import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'indigo' | 'emerald' | 'amber' | 'red' | 'blue' | 'slate' | 'purple'

const BAR: Record<Tone, string> = {
  indigo: 'bg-indigo-600', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
  red: 'bg-red-500', blue: 'bg-blue-500', slate: 'bg-slate-400', purple: 'bg-purple-500',
}
const TEXT: Record<Tone, string> = {
  indigo: 'text-indigo-600 dark:text-indigo-400', emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400', red: 'text-red-600 dark:text-red-400',
  blue: 'text-blue-600 dark:text-blue-400', slate: 'text-slate-600 dark:text-slate-300',
  purple: 'text-purple-600 dark:text-purple-400',
}

/** Ngưỡng màu dùng chung cho mọi chỗ hiển thị tiến độ, để cùng một % luôn ra cùng một màu. */
export function progressTone(percent: number): Tone {
  if (percent >= 90) return 'emerald'
  if (percent >= 70) return 'indigo'
  if (percent >= 40) return 'amber'
  return 'red'
}

/** Thanh tiến độ có nhãn + số phần trăm. */
export function LabeledBar({ label, percent, tone = 'indigo', right }: {
  label: ReactNode
  percent: number
  tone?: Tone
  /** Ghi chú bên phải thay cho số phần trăm mặc định (vd "8.2/10 tỷ"). */
  right?: ReactNode
}) {
  const value = Math.min(100, Math.max(0, percent))
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate min-w-0">{label}</span>
        <span className={cn('text-[11px] font-black tabular-nums shrink-0', TEXT[tone])}>
          {right ?? `${Math.round(percent)}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700 motion-reduce:transition-none', BAR[tone])}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

/** Ô số liệu nhỏ trong lưới 2–4 cột bên trong một widget. */
export function MetricTile({ label, value, tone = 'slate', hint }: {
  label: string
  value: ReactNode
  tone?: Tone
  hint?: string
}) {
  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 min-w-0" title={hint}>
      <p className={cn('text-2xl font-black tabular-nums truncate', TEXT[tone])}>{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1 truncate">{label}</p>
    </div>
  )
}

export interface DistributionBucket {
  label: string
  count: number
  tone: Tone
}

/**
 * Biểu đồ cột phân bố điểm. Một con số trung bình che mất việc đội đang phân hoá:
 * "TB 7.5" có thể là ai cũng 7.5, hoặc nửa đội 9 nửa đội 6 — hai tình huống cần cách xử lý khác nhau.
 */
export function DistributionChart({ buckets, unitLabel = 'người' }: {
  buckets: DistributionBucket[]
  unitLabel?: string
}) {
  const max = Math.max(1, ...buckets.map(b => b.count))
  const total = buckets.reduce((s, b) => s + b.count, 0)

  return (
    <div className="flex-1 flex flex-col justify-end min-h-0">
      <div className="flex items-end justify-between gap-2 flex-1 min-h-[90px]">
        {buckets.map(b => (
          <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0">
            <span className="text-[11px] font-black tabular-nums text-slate-700 dark:text-slate-300">{b.count}</span>
            <div
              className={cn('w-full rounded-t-lg transition-all duration-700 motion-reduce:transition-none', BAR[b.tone])}
              style={{ height: `${Math.max(4, (b.count / max) * 100)}%` }}
              // Cột trống vẫn cần đọc được, không dựa vào chiều cao để truyền thông tin
              role="img"
              aria-label={`${b.label}: ${b.count} ${unitLabel}`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-start justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {buckets.map(b => (
          <span key={b.label} className="flex-1 text-center text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight min-w-0">
            {b.label}
          </span>
        ))}
      </div>
      <p className="text-[10px] font-bold text-slate-400 mt-2 text-center tabular-nums">
        Tổng {total} {unitLabel}
      </p>
    </div>
  )
}

/** So sánh một số với kỳ trước — mũi tên + chênh lệch, kèm chữ để không chỉ dựa vào màu. */
export function DeltaBadge({ current, previous, suffix = '%' }: {
  current: number
  previous: number | null | undefined
  suffix?: string
}) {
  if (previous === null || previous === undefined) return null
  const diff = Math.round((current - previous) * 10) / 10
  if (diff === 0) {
    return <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Không đổi</span>
  }
  const up = diff > 0
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black tabular-nums',
      up ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300'
         : 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300'
    )}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{diff}{suffix} so với kỳ trước
    </span>
  )
}

/** Định dạng số lớn cho gọn (1.2K, 3.4M) nhưng vẫn giữ nguyên số nhỏ. */
export function compactNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return new Intl.NumberFormat('vi-VN').format(n)
}
