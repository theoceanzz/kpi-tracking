import { TrendingUp } from 'lucide-react'
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartTooltip from '@/components/charts/ChartTooltip'
import { yAxisLabel } from '@/components/charts/axisLabel'
import { AXIS_COLORS, seriesColor } from '@/components/charts/chartPalette'
import type { F360MyReport } from '../api/feedback360Api'
import { fmtScore } from '../utils/f360Format'
import { useTranslation } from 'react-i18next'

/**
 * Điểm 360 của chính mình qua các chiến dịch đã công bố. Chỉ hiện khi có từ 2 chiến dịch — một điểm
 * thì không có "xu hướng" nào. Trục ngang là tên chiến dịch (danh mục hiển nhiên, không gắn nhãn).
 */
export default function TrendCard({ reports }: { reports: F360MyReport[] }) {
  const { t } = useTranslation('feedback360')
  if (reports.length < 2) return null
  const data = [...reports].reverse().map(r => ({ name: r.campaignName, others: r.overallScore ?? null, self: r.selfScore ?? null }))
  const scale = Math.max(...reports.map(r => r.scaleMax ?? 5))
  // Ít mốc thì in số lên điểm; nhiều hơn 8 mốc thì đọc số ở tooltip.
  const showLabels = data.length <= 8
  const series = [
    { key: 'others', label: t('TrendCard.othersAssessment'), color: seriesColor(0) },
    { key: 'self', label: t('TrendCard.selfAssessment'), color: seriesColor(2) },
  ] as const

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><TrendingUp size={16} className="text-slate-400" />{t('TrendCard.acrossCampaignsMy360Score')}</h3>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-[var(--color-muted-foreground)]">
        {series.map(s => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: AXIS_COLORS.tick, fontSize: 12 }} />
          <YAxis domain={[0, scale]} allowDecimals={false} width={48} axisLine={false} tickLine={false}
            tick={{ fill: AXIS_COLORS.tick, fontSize: 12 }} label={yAxisLabel(t('TrendCard.scoreScale1', { scale }))} />
          <Tooltip content={({ active, payload, label }) => active && payload?.length
            ? <ChartTooltip title={String(label)} rows={payload.filter(p => p.value != null).map(p => ({
                color: String(p.color),
                label: series.find(s => s.key === p.dataKey)?.label ?? String(p.dataKey),
                value: `${fmtScore(Number(p.value))} điểm`,
              }))} />
            : null} />
          {series.map(s => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={{ r: 4 }}
              connectNulls isAnimationActive={false}>
              {showLabels && <LabelList dataKey={s.key} position="top" formatter={v => fmtScore(Number(v))} style={{ fill: AXIS_COLORS.tick, fontSize: 12 }} />}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </section>
  )
}
