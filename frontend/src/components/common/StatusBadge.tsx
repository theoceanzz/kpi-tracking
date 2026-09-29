import { cn } from '@/lib/utils'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

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

const statusMap = perLanguage((): Record<string, { variant: Variant; label: string }> => ({
  ACTIVE: { variant: 'success', label: i18n.t('shared:StatusBadge.active') },
  INACTIVE: { variant: 'default', label: i18n.t('shared:StatusBadge.inactive') },
  SUSPENDED: { variant: 'error', label: i18n.t('shared:StatusBadge.suspended') },
  DRAFT: { variant: 'default', label: i18n.t('shared:StatusBadge.draft') },
  PENDING: { variant: 'warning', label: i18n.t('shared:StatusBadge.pendingApproval') },
  PENDING_APPROVAL: { variant: 'warning', label: i18n.t('shared:StatusBadge.pendingApproval') },
  APPROVED: { variant: 'success', label: i18n.t('shared:StatusBadge.approved') },
  REJECTED: { variant: 'error', label: i18n.t('shared:StatusBadge.rejected') },
  RETURNED: { variant: 'warning', label: i18n.t('shared:StatusBadge.returnedForRework') },
  TRIAL: { variant: 'info', label: i18n.t('shared:StatusBadge.trial') },
  EXPIRED: { variant: 'error', label: i18n.t('shared:StatusBadge.expired') },
  OVERDUE: { variant: 'error', label: i18n.t('shared:StatusBadge.overdue') },
  NOT_STARTED: { variant: 'default', label: i18n.t('shared:StatusBadge.notSubmitted') },
  EDIT: { variant: 'warning', label: i18n.t('shared:StatusBadge.editRequested') },
  EDITED: { variant: 'info', label: i18n.t('shared:StatusBadge.edited') },
  REPLACED: { variant: 'default', label: i18n.t('shared:StatusBadge.replaced') },
  CLOSED_BY_LOCK: { variant: 'default', label: i18n.t('shared:StatusBadge.closedByCycleLock') },
}))

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const mapped = statusMap()[status] ?? { variant: 'default' as Variant, label: status }
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
