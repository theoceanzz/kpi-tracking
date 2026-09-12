import { cn } from '@/lib/utils'

type Variant = 'success' | 'warning' | 'error' | 'info' | 'default'

/**
 * Cùng công thức với `Badge` ở ui/: nền nhạt + chữ đậm + viền mờ, đi qua token nên
 * đúng ở cả hai chế độ. Chấm tròn đứng trước chỉ để mắt quét cột trạng thái nhanh
 * hơn — ý nghĩa vẫn nằm ở nhãn chữ, không ở màu.
 */
const variantStyles: Record<Variant, { badge: string; dot: string }> = {
  success: { badge: 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]', dot: 'bg-[var(--color-success)]' },
  warning: { badge: 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]', dot: 'bg-[var(--color-warning)]' },
  error:   { badge: 'border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]', dot: 'bg-[var(--color-error)]' },
  info:    { badge: 'border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info)]', dot: 'bg-[var(--color-info)]' },
  default: { badge: 'border-transparent bg-[var(--color-muted)] text-[var(--color-muted-foreground)]', dot: 'bg-[var(--color-subtle-foreground)]' },
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
  OVERDUE: { variant: 'error', label: 'Quá hạn' },
  NOT_STARTED: { variant: 'default', label: 'Chưa nộp' },
  EDIT: { variant: 'warning', label: 'Đang yêu cầu chỉnh sửa' },
  EDITED: { variant: 'info', label: 'Đã chỉnh sửa' },
  REPLACED: { variant: 'default', label: 'Đã thay thế' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const mapped = statusMap[status] ?? { variant: 'default' as Variant, label: status }
  const style = variantStyles[mapped.variant]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-medium leading-4 whitespace-nowrap',
        style.badge,
        className
      )}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
      {mapped.label}
    </span>
  )
}
