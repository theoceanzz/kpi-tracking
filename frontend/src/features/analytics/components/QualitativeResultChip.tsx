import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

/** Chip hiển thị MỨC kết quả của KPI định tính (thay cho thanh tiến độ số). Rỗng → "Chưa chấm". */
export function QualitativeResultChip({ level, className }: { level?: string | null; className?: string }) {
  const { t } = useTranslation('analytics')
  const scored = !!level && level.trim().length > 0
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-control text-xs font-medium',
        scored
          ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
          : 'bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]',
        className,
      )}
    >
      {scored ? level : t('QualitativeResultChip.notScored')}
    </span>
  )
}

export default QualitativeResultChip
