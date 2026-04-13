import { cn } from '@/lib/utils'

interface KpiProgressBarProps {
  label: string
  current: number
  target: number
  unit: string
  className?: string
}

export default function KpiProgressBar({ label, current, target, unit, className }: KpiProgressBarProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const color = percentage >= 80 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex justify-between text-sm">
        <span className="font-medium truncate">{label}</span>
        <span className="text-[var(--color-muted-foreground)] flex-shrink-0">
          {current}/{target} {unit}
        </span>
      </div>
      <div className="h-2.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-[var(--color-muted-foreground)] text-right">{percentage.toFixed(1)}%</p>
    </div>
  )
}
