import { cn } from '@/lib/utils'

/** Vòng tiến độ nhỏ dùng trong danh sách nhiệm vụ và lịch sử bài nộp. */
export function ProgressCircle({ percentage, size = 32, strokeWidth = 3, color }: {
  percentage: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const value = Math.min(Math.max(percentage, 0), 100)
  const offset = circumference - (value / 100) * circumference

  const defaultColor = () => {
    if (value >= 100) return 'text-emerald-500'
    if (value >= 70) return 'text-indigo-500'
    if (value >= 40) return 'text-blue-500'
    if (value > 0) return 'text-amber-500'
    return 'text-slate-200 dark:text-slate-700'
  }

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Tiến độ ${Math.round(value)} phần trăm`}
    >
      <svg className="transform -rotate-90" width={size} height={size} aria-hidden="true">
        <circle className="text-slate-100 dark:text-slate-800" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <circle
          className={cn(color || defaultColor(), 'transition-all duration-700 ease-out motion-reduce:transition-none')}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span className="absolute text-[8px] md:text-[10px] font-black text-slate-700 dark:text-slate-300 tabular-nums" aria-hidden="true">
        {Math.round(value)}%
      </span>
    </div>
  )
}
