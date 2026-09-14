import { cn } from '@/lib/utils'

/** Pill nhỏ hiển thị trọng số KPI, vd "TS 30%". Không render nếu không có trọng số. */
export function KpiWeightPill({ weight, className }: { weight?: number | null; className?: string }) {
  if (weight == null) return null
  const w = Number.isInteger(weight) ? weight : Math.round(weight * 10) / 10
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        'bg-indigo-50 dark:bg-indigo-900/30 text-[var(--color-primary)] dark:text-indigo-400',
        className,
      )}
      title="Trọng số"
    >
      TS {w}%
    </span>
  )
}

export default KpiWeightPill
