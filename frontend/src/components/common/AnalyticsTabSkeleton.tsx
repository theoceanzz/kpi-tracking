import { cn } from '@/lib/utils'

interface AnalyticsTabSkeletonProps {
  variant?: 'default' | 'objectives' | 'drilldown'
  className?: string
}

export default function AnalyticsTabSkeleton({ variant = 'default', className }: AnalyticsTabSkeletonProps) {
  const metricCount = variant === 'objectives' ? 4 : 5

  return (
    <div className={cn('animate-pulse space-y-6', className)}>
      {/* Filter bar */}
      <div className="h-16 bg-[var(--color-muted)] rounded-2xl" />

      {/* Metric cards */}
      <div className={cn(
        'grid gap-4',
        metricCount === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-5'
      )}>
        {Array.from({ length: metricCount }).map((_, i) => (
          <div key={i} className="h-20 bg-[var(--color-muted)] rounded-2xl" />
        ))}
      </div>

      {variant === 'drilldown' ? (
        <>
          <div className="h-8 w-64 bg-[var(--color-muted)] rounded-lg" />
          <div className="h-64 bg-[var(--color-muted)] rounded-2xl" />
        </>
      ) : (
        <>
          {/* Chart area */}
          <div className="h-[320px] bg-[var(--color-muted)] rounded-2xl" />

          {/* Table */}
          <div className="rounded-3xl overflow-hidden">
            <div className="h-14 bg-[var(--color-muted)]" />
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-[var(--color-muted)] rounded-xl opacity-60" />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function TableLoadingRows({ cols, count = 2 }: { cols: number; count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-6 py-4">
              <div className={cn(
                'h-4 bg-[var(--color-muted)] rounded',
                j === 0 ? 'w-3/4' : j % 2 === 0 ? 'w-2/3' : 'w-1/2'
              )} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
