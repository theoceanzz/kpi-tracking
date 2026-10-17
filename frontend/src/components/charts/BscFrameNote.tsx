import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { CycleCurve } from '@/types/kpi'

/**
 * Khung bell curve đang áp theo kết quả BSC của đơn vị — nói rõ VÌ SAO đơn vị được nhiều / ít suất
 * mức cao. Đã chốt BSC ⇒ khung kiểm tra đã đổi; chưa chốt ⇒ chỉ là khung dự kiến, vẫn kiểm theo khung
 * mặc định (luật ở backend `UnitClassificationService.activeCurve`).
 */
export default function BscFrameNote({ curve, className }: { curve: CycleCurve; className?: string }) {
  const { t } = useTranslation('shared')
  if (!curve.configured || curve.bscPercent == null) return null
  const percent = Math.round(curve.bscPercent * 10) / 10
  const bandLabel = (band?: string | null) => (band ? t(`BscFrameNote.band.${band}`) : '')
  const thresholds = curve.bscExceedAt != null && curve.bscMeetAt != null
    ? t('BscFrameNote.thresholds', { exceed: curve.bscExceedAt, meet: curve.bscMeetAt })
    : undefined

  if (curve.bscBand) {
    return (
      <p title={thresholds} className={cn('inline-flex flex-wrap items-center gap-1.5 text-xs', className)}>
        <span className={cn('rounded-control px-2 py-0.5 font-semibold',
          curve.bscBand === 'EXCEED' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
            : curve.bscBand === 'BELOW' ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
              : 'bg-[var(--color-muted)] text-[var(--color-foreground)]')}>
          {t('BscFrameNote.applied', { band: bandLabel(curve.bscBand) })}
        </span>
        <span className="text-[var(--color-muted-foreground)]">{t('BscFrameNote.finalized', { percent })}</span>
      </p>
    )
  }
  if (curve.projectedBand) {
    return (
      <p title={thresholds} className={cn('text-xs text-[var(--color-muted-foreground)]', className)}>
        {t('BscFrameNote.projected', { band: bandLabel(curve.projectedBand), percent })}
      </p>
    )
  }
  return null
}
