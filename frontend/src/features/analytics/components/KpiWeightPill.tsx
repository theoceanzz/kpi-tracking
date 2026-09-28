import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

/** Pill nhỏ hiển thị trọng số KPI, vd "TS 30%". Không render nếu không có trọng số. */
export function KpiWeightPill({ weight, className }: { weight?: number | null; className?: string }) {
  const { t } = useTranslation('analytics')
  if (weight == null) return null
  const w = Number.isInteger(weight) ? weight : Math.round(weight * 10) / 10
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
        className,
      )}
      title={t('KpiWeightPill.weight')}
    >
      TS {w}%
    </span>
  )
}

export default KpiWeightPill
