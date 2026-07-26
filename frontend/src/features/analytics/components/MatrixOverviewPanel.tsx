import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Star, Target, Activity, Users, Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatrixOverview } from '../api/matrixAnalyticsApi'

/** Màu theo xếp loại 1..5 (đỏ → xanh). */
const RATING_COLORS: Record<number, string> = { 1: '#ef4444', 2: '#f97316', 3: '#f59e0b', 4: '#84cc16', 5: '#10b981' }
const ratingColor = (r?: number | null) => (r == null ? '#94a3b8' : RATING_COLORS[Math.round(r)] ?? '#8b5cf6')
const fmt1 = (v?: number | null) => (v == null ? '—' : (Math.round(v * 10) / 10).toString())
const fmt2 = (v?: number | null) => (v == null ? '—' : (Math.round(v * 100) / 100).toString())

/** Chuyển hex (#rrggbb) + alpha (0..1) → rgba(). */
function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm', className)}>
      {children}
    </div>
  )
}
function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">{icon} {children}</h3>
  )
}
function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center h-full min-h-[180px] text-sm text-slate-400 font-medium text-center px-4">{children}</div>
}

/** 4 thẻ chỉ số ma trận (luôn hiển thị). */
export function MatrixMetricCards({ overview }: { overview?: MatrixOverview }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${ratingColor(overview?.averageRating)}22`, color: ratingColor(overview?.averageRating) }}><Star size={24} /></div>
        <div>
          <p className="text-xs font-bold text-slate-500">Xếp loại trung bình</p>
          <p className="text-2xl font-black tabular-nums" style={{ color: ratingColor(overview?.averageRating) }}>{fmt2(overview?.averageRating)}<span className="text-sm text-slate-400">/5</span></p>
          <p className="text-[10px] font-bold text-slate-400">{overview?.evaluationCount ?? 0} đánh giá</p>
        </div>
      </div>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4"
        // title="% hoàn thành do người đánh giá ghi trên phiếu đánh giá (dùng để tra ô ma trận xếp loại). Khác với 'Tiến độ trung bình' vốn tính từ bài nộp và bị chặn ở 150%."
      >
        <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"><Target size={24} /></div>
        <div>
          <p className="text-xs font-bold text-slate-500">% Hoàn thành KPI TB</p>
          <p className="text-2xl font-black tabular-nums">{fmt1(overview?.averageCompletion)}%</p>
          <p className="text-[10px] font-bold text-slate-400">ghi trên đánh giá (để xếp loại)</p>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0"><Activity size={24} /></div>
        <div>
          <p className="text-xs font-bold text-slate-500">Điểm hành vi TB</p>
          <p className="text-2xl font-black tabular-nums">{fmt2(overview?.averageBehavior)}<span className="text-sm text-slate-400">/5</span></p>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0"><Users size={24} /></div>
        <div>
          <p className="text-xs font-bold text-slate-500">Số đánh giá xếp loại</p>
          <p className="text-2xl font-black tabular-nums">{overview?.evaluationCount ?? 0}</p>
        </div>
      </div>
    </div>
  )
}

/** Phân bố xếp loại (donut) + Heatmap (điểm hành vi × % hoàn thành) — cho khối thu gọn. */
export function MatrixDistHeatmap({ overview }: { overview?: MatrixOverview }) {
  const distData = useMemo(
    () => (overview?.distribution || []).map(b => ({ name: `Loại ${b.rating}`, rating: b.rating, value: b.count })),
    [overview]
  )
  const totalDist = distData.reduce((s, d) => s + d.value, 0)
  const heatmap = overview?.heatmap
  const maxCell = useMemo(() => {
    if (!heatmap?.counts) return 0
    let m = 0
    heatmap.counts.forEach(row => row.forEach(v => { if (v > m) m = v }))
    return m
  }, [heatmap])

  if (overview && overview.evaluationCount === 0) {
    return (
      <Card><EmptyState>
        Chưa có đánh giá nào có xếp loại ma trận cho phạm vi/kỳ đang chọn.<br />
        Cần đánh giá định tính + chấm điểm hành vi để có dữ liệu.
      </EmptyState></Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <SectionTitle icon={<Star size={14} className="text-amber-500" />}>Phân bố xếp loại</SectionTitle>
        {totalDist > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={distData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {distData.map(d => <Cell key={d.rating} fill={ratingColor(d.rating)} />)}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [`${v} đánh giá`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-5 gap-1 mt-2">
              {distData.map(d => (
                <div key={d.rating} className="text-center">
                  <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: ratingColor(d.rating) }} />
                  <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 mt-1">{d.value}</p>
                  <p className="text-[9px] font-bold text-slate-400">Loại {d.rating}</p>
                </div>
              ))}
            </div>
          </>
        ) : <EmptyState>Chưa có dữ liệu xếp loại</EmptyState>}
      </Card>

      <Card className="lg:col-span-2">
        <SectionTitle icon={<Grid3x3 size={14} className="text-indigo-500" />}>
          {heatmap ? `Heatmap: ${heatmap.rowHeader} × ${heatmap.colHeader}` : 'Heatmap ma trận'}
        </SectionTitle>
        {heatmap ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="border-separate border-spacing-1 mx-auto">
              <thead>
                <tr>
                  <th className="text-[9px] font-black text-slate-400 uppercase p-1 align-bottom">{heatmap.rowHeader} \ {heatmap.colHeader}</th>
                  {heatmap.cols.map((c, ci) => (
                    <th key={ci} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 p-1 min-w-[64px] whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map((rowLabel, ri) => (
                  <tr key={ri}>
                    <td className="text-[10px] font-bold text-slate-500 dark:text-slate-400 p-1 pr-2 text-right whitespace-nowrap">{rowLabel}</td>
                    {heatmap.cols.map((_, ci) => {
                      const rating = heatmap.ratings?.[ri]?.[ci]
                      const count = heatmap.counts?.[ri]?.[ci] ?? 0
                      const color = ratingColor(rating)
                      const alpha = maxCell > 0 && count > 0 ? 0.18 + 0.62 * (count / maxCell) : 0.08
                      return (
                        <td key={ci} className="p-0">
                          <div
                            className="w-full h-[52px] min-w-[64px] rounded-lg flex flex-col items-center justify-center border border-black/5"
                            style={{ backgroundColor: hexA(color, alpha) }}
                            title={`Xếp loại ${rating ?? '—'} · ${count} nhân sự`}
                          >
                            <span className={cn('text-base font-black tabular-nums', count > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600')}>{count}</span>
                            <span className="text-[9px] font-bold" style={{ color }}>loại {rating ?? '—'}</span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400 font-medium mt-2 text-center">Số trong ô = số nhân sự rơi vào (điểm hành vi × % hoàn thành) đó · màu theo xếp loại của ô.</p>
          </div>
        ) : <EmptyState>Tổ chức chưa cấu hình ma trận xếp loại</EmptyState>}
      </Card>
    </div>
  )
}
