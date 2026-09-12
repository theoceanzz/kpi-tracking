import { BarChart, Bar, Cell, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { yAxisLabel } from '@/components/charts/axisLabel'
import { BarChart3 } from 'lucide-react'

export interface QualLevelBucket {
  levelName: string
  position?: number | null
  color?: string | null
  count: number
}

/** Biểu đồ PHÂN BỐ MỨC cho KPI định tính: X = mức (thấp→cao), Y = số bài nộp, cột tô màu theo mức. */
export function QualitativeDistributionChart({ distribution }: { distribution?: QualLevelBucket[] | null }) {
  const data = [...(distribution ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const total = data.reduce((s, d) => s + d.count, 0)

  if (total === 0) {
    return (
      <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-[var(--color-subtle-foreground)]">
        <BarChart3 size={28} className="text-[var(--color-subtle-foreground)]" />
        <p className="text-sm font-medium">Chưa có bài nộp định tính</p>
      </div>
    )
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" strokeOpacity={0.8} />
          <XAxis dataKey="levelName" interval={0} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis label={yAxisLabel('S\u1ed1 ng\u01b0\u1eddi')} allowDecimals={false} width={48} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: any) => [`${v} bài nộp`, 'Số bài nộp']}
            labelFormatter={(l: any) => `Mức: ${l}`}
            cursor={{ fill: '#94a3b8', opacity: 0.06 }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={48} isAnimationActive={false}>
            {/* Ít mức, cột rộng 48px — in thẳng số lên đầu cột thì khỏi phải rê chuột. */}
            <LabelList dataKey="count" position="top" fill="#64748b" fontSize={11} fontWeight={700} />
            {data.map((d, i) => <Cell key={i} fill={d.color ?? '#8b5cf6'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default QualitativeDistributionChart
