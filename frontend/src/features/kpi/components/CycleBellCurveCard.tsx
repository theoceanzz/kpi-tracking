import { useMemo } from 'react'
import i18n from 'i18next'
import { Scale, AlertTriangle, CheckCircle2 } from 'lucide-react'
import CollapsibleCard from '@/components/common/CollapsibleCard'
import BellCurveChart from '@/components/charts/BellCurveChart'
import { cn } from '@/lib/utils'
import type { CycleCurve } from '@/types/kpi'
import { useTranslation } from 'react-i18next'

/**
 * Bell curve của KỲ cho đơn vị đang xem: phân bố THỰC TẾ của thành viên đặt cạnh khung hạn mức
 * đã cấu hình ở "Xếp loại đơn vị". Thẻ chỉ lo phần đầu (kết luận một dòng, hồ sơ, chế độ) và
 * bảng lệch khung; biểu đồ + chú giải dùng chung `BellCurveChart` với khối Xếp loại đơn vị ở
 * Thống kê, để hai nơi không mỗi nơi vẽ một kiểu.
 */
export default function CycleBellCurveCard({ curve, orgUnitName, defaultOpen = false, id, bare = false, compact = false }: {
  curve: CycleCurve
  orgUnitName?: string
  defaultOpen?: boolean
  id?: string
  /** Chỉ vẽ ruột (kết luận + biểu đồ), không khung — dùng khi thẻ bọc ngoài đã có header riêng. */
  bare?: boolean
  /** Biểu đồ thấp hơn, chú giải gọn — cho ô nửa hàng cạnh luồng duyệt. */
  compact?: boolean
}) {
  const { t } = useTranslation('kpi')
  const rows = curve.buckets ?? []
  // Chưa chấm đủ người thì mức nào cũng "thiếu" — kêu lúc đó là kêu một câu vô nghĩa; chỉ
  // vượt trần mới đáng nói giữa chừng. Cùng luật với backend (bellCurveMessage).
  const complete = curve.evaluated >= curve.headcount
  const overs = useMemo(() => rows.filter(r => r.over), [rows])
  const unders = useMemo(() => (complete ? rows.filter(r => r.under) : []), [rows, complete])

  if (!rows.length) return null

  const headline = !curve.configured
    ? t('CycleBellCurveCard.noQuotaAppliedShowingTheActual')
    : curve.evaluated === 0
      ? t('CycleBellCurveCard.noOneHasACycleScore')
      : overs.length
        ? t('CycleBellCurveCard.aboveTheCeiling', { join: overs.map(r => `${r.level} ${r.count}/${r.maxCount}`).join(' · ') })
        : unders.length
          ? t('CycleBellCurveCard.belowTheFloor', { join: unders.map(r => `${r.level} ${r.count}/${r.minCount}`).join(' · ') })
          : complete ? t('CycleBellCurveCard.theDistributionIsWithinTheQuota') : t('CycleBellCurveCard.notAboveTheCeilingPeopleScored', { evaluated: curve.evaluated, headcount: curve.headcount })

  const modeBadge = curve.configured && (
    <span className={cn(
      'text-eyebrow inline-flex items-center gap-1.5 px-2.5 py-1 rounded-card border whitespace-nowrap',
      curve.mode === 'block'
        ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
        : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
    )}>
      {curve.mode === 'block' ? t('CycleBellCurveCard.blockWhenAboveTheCeiling') : t('CycleBellCurveCard.warningOnly')}
    </span>
  )
  const toneCls = overs.length
    ? 'font-semibold text-[var(--color-error)]'
    : unders.length
      ? 'font-semibold text-[var(--color-warning)]'
      : curve.configured && complete && curve.evaluated > 0 ? 'font-semibold text-[var(--color-success)]' : undefined

  if (bare) {
    return (
      <div className={compact ? 'space-y-2' : 'space-y-4'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn('text-sm', toneCls ?? 'text-[var(--color-muted-foreground)]', compact && 'text-xs')}>
            {headline}
            <span className="text-caption font-medium">
              {curve.configured && curve.profileName ? i18n.t('kpi:CycleBellCurveCard.curveSuffix', { name: curve.profileName, tolerance: curve.tolerance }) : ''}
              {t('CycleBellCurveCard.peopleScored', { evaluated: curve.evaluated, headcount: curve.headcount })}
            </span>
          </p>
          {!compact && modeBadge}
        </div>
        <Chart />
      </div>
    )
  }

  return (
    <CollapsibleCard
      id={id}
      defaultOpen={defaultOpen}
      icon={<Scale size={18} aria-hidden="true" />}
      title={t('CycleBellCurveCard.cycleBellCurve', { value: orgUnitName ? ` · ${orgUnitName}` : '' })}
      summary={
        <span className={toneCls}>
          {headline}
          {curve.configured && curve.profileName ? i18n.t('kpi:CycleBellCurveCard.curveSuffix', { name: curve.profileName, tolerance: curve.tolerance }) : ''}
        </span>
      }
      badge={modeBadge}
    >
      <Chart />
    </CollapsibleCard>
  )

  // Biểu đồ + lệch khung — dùng chung cho cả hai kiểu bọc.
  function Chart() {
    return (
      <div className={compact ? 'space-y-2' : 'space-y-4'}>
        <BellCurveChart curve={curve} height={compact ? 170 : 260} compact={compact} showIssues={false} />
        {compact && modeBadge}

        {/* Lệch khung gom thành tối đa hai dòng "thực tế/hạn mức" — năm cái chip cho năm mức
            đọc như năm cái lỗi, trong khi thứ cần biết chỉ là mức nào thừa, mức nào thiếu. */}
        {curve.configured && (
          overs.length || unders.length ? (
            <dl className="space-y-1 text-xs">
              {overs.length > 0 && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <dt className="inline-flex items-center gap-1 font-semibold text-[var(--color-error)]">
                    <AlertTriangle size={12} aria-hidden="true" /> {t('CycleBellCurveCard.aboveTheCeiling2')}
                  </dt>
                  {overs.map(r => (
                    <dd key={r.level} className="tabular-nums text-[var(--color-foreground)]">
                      {r.level} <b>{r.count}</b><span className="text-[var(--color-muted-foreground)]">/{r.maxCount}</span>
                    </dd>
                  ))}
                </div>
              )}
              {unders.length > 0 && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <dt className="inline-flex items-center gap-1 font-semibold text-[var(--color-warning)]">
                    <AlertTriangle size={12} aria-hidden="true" /> {t('CycleBellCurveCard.belowTheFloor2')}
                  </dt>
                  {unders.map(r => (
                    <dd key={r.level} className="tabular-nums text-[var(--color-foreground)]">
                      {r.level} <b>{r.count}</b><span className="text-[var(--color-muted-foreground)]">/{r.minCount}</span>
                    </dd>
                  ))}
                </div>
              )}
            </dl>
          ) : curve.evaluated > 0 && complete ? (
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
              <CheckCircle2 size={12} aria-hidden="true" /> {t('CycleBellCurveCard.theDistributionIsWithinTheQuota')}
            </p>
          ) : (
            <p className="text-caption">
              {curve.evaluated === 0 ? t('CycleBellCurveCard.noOneHasACycleScore2') : t('CycleBellCurveCard.peopleHaveNoScoreYetThe', { value: curve.headcount - curve.evaluated })}
            </p>
          )
        )}
      </div>
    )
  }
}
