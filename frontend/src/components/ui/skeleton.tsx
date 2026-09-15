import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-control bg-[var(--color-muted)] motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Skeleton }
