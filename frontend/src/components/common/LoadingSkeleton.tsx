import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  type?: 'table' | 'card' | 'form'
  rows?: number
  className?: string
}

export default function LoadingSkeleton({ type = 'card', rows = 3, className }: LoadingSkeletonProps) {
  if (type === 'table') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="h-10 bg-[var(--color-muted)] rounded-lg animate-pulse" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 bg-[var(--color-muted)] rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (type === 'form') {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-[var(--color-muted)] rounded animate-pulse" />
            <div className="h-10 bg-[var(--color-muted)] rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-32 bg-[var(--color-muted)] rounded-xl animate-pulse" />
      ))}
    </div>
  )
}
