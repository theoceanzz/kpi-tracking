import { useTranslation } from 'react-i18next'
import { useFormat } from '@/i18n/useFormat'
import type { AiReviewItem } from '../api/aiReviewApi'

export interface ReviewWeights {
  target?: number | null
  quality?: number | null
  onTime?: number | null
}

/**
 * Điểm AI gợi ý của MỘT chỉ tiêu, chia ba phần, mỗi phần kèm lý do (người dùng chốt 30/09). Định lượng: thang điểm
 * đánh giá, so với điểm hệ thống. Định tính: thang hành vi riêng, "đạt chỉ tiêu" = mức tự đánh giá, kèm mức gần nhất.
 * Cách chia:
 * điểm tối đa của chỉ tiêu chia theo trọng số đạt chỉ tiêu / chất lượng / đúng hạn — đủ cả ba là đủ điểm. Lý do dựng
 * từ số (không lưu câu dựng sẵn): đạt chỉ tiêu và đúng hạn do hệ thống tính, chất lượng là mức AI chọn + nhận xét đã
 * kiểm trích dẫn.
 */
export default function AiScoreBreakdown({ item, weights }: { item: AiReviewItem; weights: ReviewWeights }) {
  const { t } = useTranslation('submissions')
  const fmt = useFormat()
  const n = (v?: number | null) => (v == null ? '—' : fmt.number(v, { maximumFractionDigits: 1 }))
  const max = item.maxPoints ?? 0
  const partMax = (w?: number | null) => (w == null ? null : max * w / 100)

  const achievement = item.achievementPercent
  // Định tính không có mục tiêu số: phần "đạt chỉ tiêu" là mức người nộp tự đánh giá (thang hành vi).
  const targetReason = item.qualitative
    ? (achievement == null
        ? t('AiScoreBreakdown.selfLevelMissing')
        : item.selfLevel
          ? t('AiScoreBreakdown.selfLevel', { level: item.selfLevel, percent: n(achievement) })
          : t('AiScoreBreakdown.selfLevelPercent', { percent: n(achievement) }))
    : achievement == null
      ? t('AiScoreBreakdown.targetUnmeasured')
      : item.actualValue != null && item.targetValue != null
        ? t('AiScoreBreakdown.targetActual', {
            actual: n(item.actualValue), target: n(item.targetValue), unit: item.unit ?? '', percent: n(achievement),
          })
        : t('AiScoreBreakdown.targetPercent', { percent: n(achievement) })
  const overTarget = !item.qualitative && achievement != null && achievement > 100

  const qMax = partMax(weights.quality)
  const qualityPercent = item.qualityPoints != null && qMax ? item.qualityPoints / qMax * 100 : null
  const qualityReason = item.qualityLevel
    ? [
        qualityPercent != null
          ? t('AiScoreBreakdown.qualityLevel', { level: item.qualityLevel, percent: n(qualityPercent) })
          : t('AiScoreBreakdown.qualityLevelOnly', { level: item.qualityLevel }),
        item.qualityComment,
      ].filter(Boolean).join(' — ')
    : t('AiScoreBreakdown.qualityUnknown')

  const onTimeReason = item.onTimePercent == null
    ? t('AiScoreBreakdown.onTimeNoSubmission')
    : t('AiScoreBreakdown.onTimePercent', { percent: n(item.onTimePercent) })

  const rows = [
    { key: 'target', weight: weights.target, points: item.targetPoints, reason: targetReason,
      note: overTarget ? t('AiScoreBreakdown.overTargetNote') : null },
    { key: 'quality', weight: weights.quality, points: item.qualityPoints, reason: qualityReason, note: null },
    { key: 'onTime', weight: weights.onTime, points: item.onTimePoints, reason: onTimeReason, note: null },
  ] as const
  const missing = rows.some(r => r.points == null)

  return (
    <div className="overflow-hidden rounded-control border border-[var(--color-border)] bg-[var(--color-card)]">
      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map(r => {
          const pm = partMax(r.weight)
          return (
            <li key={r.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-3 py-2">
              <p className="text-sm font-medium text-[var(--color-foreground)]">
                {t(`AiScoreBreakdown.part.${r.key}`)}
                {r.weight != null && pm != null && (
                  <span className="font-normal text-[var(--color-muted-foreground)]">
                    {' '}{t('AiScoreBreakdown.partShare', { weight: r.weight, points: n(pm) })}
                  </span>
                )}
              </p>
              <p className="text-right text-sm font-semibold tabular-nums text-[var(--color-ai)]">{n(r.points)}</p>
              <p className="col-span-2 text-xs text-[var(--color-muted-foreground)]">
                {r.reason}{r.note && ` ${r.note}`}
              </p>
            </li>
          )
        })}
      </ul>
      <p className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm">
        <span className="text-[var(--color-muted-foreground)]">
          {missing ? t('AiScoreBreakdown.totalRedistributed') : t('AiScoreBreakdown.total')}
        </span>
        <span className="tabular-nums">
          <span className="font-semibold text-[var(--color-ai)]">{n(item.suggestedScore)}</span>
          <span className="text-[var(--color-muted-foreground)]"> / {n(item.maxPoints)}</span>
          {item.qualitative ? (
            item.suggestedLevel && (
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {' → '}{t('AiScoreBreakdown.levelOf', { level: item.suggestedLevel })}
              </span>
            )
          ) : item.systemPoints != null && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {' · '}{t('AiScoreBreakdown.system', { points: n(item.systemPoints) })}
            </span>
          )}
        </span>
      </p>
    </div>
  )
}
