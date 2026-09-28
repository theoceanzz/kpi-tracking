import { Grid3x3 } from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { ratingSurface } from '@/components/charts/chartPalette'
import { useF360Heatmap } from '../hooks/useFeedback360'
import { fmtScore } from '../utils/f360Format'
import { useTranslation } from 'react-i18next'

/**
 * Năng lực × đơn vị. Bảng màu chứ không phải biểu đồ: người đọc cần tra đúng ô (phòng nào yếu năng
 * lực nào), và mỗi ô đủ rộng để in số — không cần tooltip mới đọc được.
 *
 * Đơn vị dưới ngưỡng ẩn danh đã được backend gộp lên đơn vị cha (đánh dấu "gộp").
 */
export default function HeatmapCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation('feedback360')
  const { data, isLoading } = useF360Heatmap(campaignId)
  if (isLoading) return <LoadingSkeleton rows={4} />
  if (!data || data.rows.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Grid3x3 size={16} className="text-slate-400" />{t('HeatmapCard.unitsScorePerCompetency')}</h3>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          {t('HeatmapCard.noUnitHasEnough')} {data?.anonymityThreshold ?? 3} {t('HeatmapCard.peopleWithResultsToShowWhile')}
        </p>
      </section>
    )
  }
  // Tô màu theo điểm quy về 1..5 để dùng chung dải màu xếp loại của hệ thống.
  const tone = (v?: number | null) => {
    if (v == null) return undefined
    const on5 = data.scaleMax === 5 ? v : 1 + ((v - 1) * 4) / (data.scaleMax - 1)
    return ratingSurface(Math.max(1, Math.min(5, Math.round(on5))))
  }
  // Dải màu nền này được chọn cho chữ tối (tương phản ≥ 6,45:1) — giữ chữ tối cả ở dark mode.
  const cell = (v?: number | null) => (v == null ? undefined : { backgroundColor: tone(v), color: '#0f172a' })

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Grid3x3 size={16} className="text-slate-400" />{t('HeatmapCard.unitsScorePerCompetency')}</h3>
      <p className="mt-1 text-caption">
        {t('HeatmapCard.othersScoresScale1')}{data.scaleMax}{t('HeatmapCard.unitsWithFewerThan')} {data.anonymityThreshold} {t('HeatmapCard.peopleAreMergedIntoTheParent')}
        {data.excludedCount > 0 ? t('HeatmapCard.peopleDoNotHaveEnoughGroup', { excludedCount: data.excludedCount }) : '.'}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
          <thead>
            <tr className="text-left text-caption">
              <th className="px-2 py-1 font-medium">{t('HeatmapCard.unit')}</th>
              <th className="px-2 py-1 text-center font-medium">{t('HeatmapCard.n360Score')}</th>
              {data.competencies.map(c => <th key={c} className="px-2 py-1 text-center font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map(r => (
              <tr key={r.orgUnitId ?? r.orgUnitName}>
                <td className="px-2 py-1.5">
                  <span className="font-medium">{r.orgUnitName}</span>
                  <span className="block text-caption">{r.subjectCount} {t('HeatmapCard.people')}{r.rolledUp ? t('HeatmapCard.mergedChildUnits') : ''}</span>
                </td>
                <td className="rounded-lg px-2 py-1.5 text-center font-semibold tabular-nums" style={cell(r.overall)}>
                  {fmtScore(r.overall)}
                </td>
                {data.competencies.map(c => (
                  <td key={c} className="rounded-lg px-2 py-1.5 text-center tabular-nums" style={cell(r.scores[c])}>
                    {fmtScore(r.scores[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
