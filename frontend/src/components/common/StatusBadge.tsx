import { cn } from '@/lib/utils'

type Variant = 'success' | 'warning' | 'error' | 'info' | 'default'

const variantStyles: Record<Variant, string> = {
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  default: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
}

const statusMap: Record<string, { variant: Variant; label: string }> = {
  ACTIVE: { variant: 'success', label: 'Hoạt động' },
  INACTIVE: { variant: 'default', label: 'Ngưng hoạt động' },
  SUSPENDED: { variant: 'error', label: 'Tạm khóa' },
  DRAFT: { variant: 'default', label: 'Nháp' },
  PENDING: { variant: 'warning', label: 'Chờ duyệt' },
  PENDING_APPROVAL: { variant: 'warning', label: 'Chờ duyệt' },
  APPROVED: { variant: 'success', label: 'Đã duyệt' },
  REJECTED: { variant: 'error', label: 'Từ chối' },
  TRIAL: { variant: 'info', label: 'Dùng thử' },
  EXPIRED: { variant: 'error', label: 'Hết hạn' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const mapped = statusMap[status] ?? { variant: 'default' as Variant, label: status }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyles[mapped.variant],
        className
      )}
    >
      {mapped.label}
    </span>
  )
}
