import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface LoadingSkeletonProps {
  type?: 'table' | 'card' | 'form'
  rows?: number
  className?: string
}

/**
 * Khung chờ có hình dáng giống nội dung thật (đầu bảng + các hàng; nhãn + ô nhập;
 * lưới thẻ) để bố cục không nhảy khi dữ liệu về.
 */
export default function LoadingSkeleton({ type = 'card', rows = 3, className }: LoadingSkeletonProps) {
  if (type === 'table') {
    return (
      <div className={cn('overflow-hidden rounded-card border border-[var(--color-border)]', className)} aria-busy="true">
        <div className="h-10 border-b border-[var(--color-border)] bg-[var(--color-muted)]" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (type === 'form') {
    return (
      <div className={cn('space-y-4', className)} aria-busy="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3', className)} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <Skeleton className="mb-4 h-9 w-9" />
          <Skeleton className="mb-2 h-7 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  )
}
