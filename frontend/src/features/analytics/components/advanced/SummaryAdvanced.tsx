import { BarChart3, GitCompare } from 'lucide-react'
import { xAxisLabel } from '@/components/charts/axisLabel'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartWrapper } from '@/components/common/dashboard/ChartWrapper'
import { AXIS_COLORS, METRIC_COLORS } from '@/components/charts/chartPalette'
import Histogram from '@/components/charts/primitives/Histogram'
import { useScoreHistogram, useSelfVsManager } from '../../hooks/useAdvancedAnalytics'
import type { AdvancedFilter } from '../../api/advancedAnalyticsApi'

/** Props chung cho mọi widget của tab, khớp chữ ký các section sẵn có trong SummaryTab. */
export interface AdvancedWidgetProps {
  filter: AdvancedFilter
  /** Bỏ vỏ ChartWrapper — dùng khi render trong thẻ đã ghim ở trang chủ. */
  bare?: boolean
  /** Dòng tóm tắt cấu hình đặt dưới tiêu đề (do lưới cấp). */
  meta?: React.ReactNode
}

function Shell({ title, icon, children, bare, extra, meta }: AdvancedWidgetProps & {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  /** Điều khiển phụ đặt bên phải tiêu đề — ở chế độ `bare` không có header nên xếp ngay trên nội dung. */
  extra?: React.ReactNode
}) {
  if (bare) return (
    <div className="h-full flex flex-col overflow-auto custom-scrollbar">
      {extra && <div className="flex justify-end mb-2">{extra}</div>}
      {children}
    </div>
  )
  return (
    <ChartWrapper
      title={title}
      icon={icon}
      extraHeaderContent={extra}
      meta={meta}
    >
      {children}
    </ChartWrapper>
  )
}

function Empty({ children, height = 220 }: { children: React.ReactNode; height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-slate-400 font-medium text-center px-4" style={{ height }}>
      {children}
    </div>
  )
}

function Loading({ height = 220 }: { height?: number }) {
  return <div className="flex items-center justify-center text-slate-400 font-medium" style={{ height }}>Đang tải...</div>
}

// ============================================================
// D1 — Histogram phân phối điểm
// ============================================================

export function ScoreHistogramWidget(p: AdvancedWidgetProps) {
  const { data, isLoading } = useScoreHistogram(p.filter)
  return (
    <Shell {...p} title="Phân phối điểm đánh giá" icon={<BarChart3 size={20} className="text-slate-400" />}>
      {isLoading ? <Loading /> : !data || data.totalCount === 0 ? (
        <Empty>Chưa có đánh giá nào trong phạm vi này</Empty>
      ) : (
        <>
          <Histogram
            bins={data.bins}
            thresholds={data.levels}
            marker={data.myScore != null ? { value: data.myScore, label: 'Bạn' } : null}
            unit="điểm"
            countLabel="Số đánh giá"
          />
          <p className="text-xs text-slate-400 font-medium text-center mt-2">
            {data.totalCount} đánh giá · trung bình {data.averageScore ?? '-'} điểm
            {data.anonymized ? ' · phân phối đã ẩn danh' : ''}
          </p>
        </>
      )}
    </Shell>
  )
}

// ============================================================
// C3 — Tự đánh giá vs quản lý đánh giá
// ============================================================

export function SelfVsManagerWidget(p: AdvancedWidgetProps) {
  const { data, isLoading } = useSelfVsManager(p.filter)
  const rows = data?.rows ?? []
  return (
    <Shell {...p} title="Tự đánh giá vs Quản lý đánh giá" icon={<GitCompare size={20} className="text-slate-400" />}>
      {isLoading ? <Loading /> : rows.length === 0 ? (
        <Empty>
          Chưa có kỳ nào mà cả đơn vị và quản lý đều đã chấm.<br />
          Chênh lệch chỉ tính được khi có đủ cả hai điểm.
        </Empty>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(240, Math.min(rows.length * 44 + 50, 420))}>
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--color-border)" horizontal={false} />
              <XAxis
                label={xAxisLabel('Điểm')}
                type="number" domain={[0, data?.axisMax ?? 100]}
                axisLine={false} tickLine={false}
                tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
              />
              <YAxis
                type="category" dataKey="name" width={140}
                axisLine={false} tickLine={false}
                tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
              />
              <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<GapTooltip />} />
              <Bar dataKey="selfScore" name="Tự chấm" fill={METRIC_COLORS.completion.normal} radius={[0, 3, 3, 0]} isAnimationActive={false} />
              <Bar dataKey="managerScore" name="Quản lý chấm" fill={METRIC_COLORS.performance.normal} radius={[0, 3, 3, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-xs font-medium text-[var(--color-muted-foreground)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: METRIC_COLORS.completion.normal }} /> Tự chấm
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: METRIC_COLORS.performance.normal }} /> Quản lý chấm
            </span>
            {data?.averageGap != null && (
              <span className="text-xs">
                Chênh lệch trung bình {data.averageGap > 0 ? '+' : ''}{data.averageGap} điểm
                {data.averageGap > 0 ? ' (đơn vị tự chấm cao hơn)' : data.averageGap < 0 ? ' (quản lý chấm cao hơn)' : ''}
              </span>
            )}
          </div>
        </>
      )}
    </Shell>
  )
}

function GapTooltip({ active, payload }: {
  active?: boolean
  payload?: { payload: { name: string; selfScore: number; managerScore: number; gap: number; memberCount?: number } }[]
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-lg shadow-lg">
      <p className="font-semibold text-[var(--color-foreground)] mb-2">{d.name}</p>
      <div className="space-y-1 text-sm">
        <p><span className="text-slate-500 font-medium">Tự chấm: </span><span className="font-semibold tabular-nums">{d.selfScore}</span></p>
        <p><span className="text-slate-500 font-medium">Quản lý chấm: </span><span className="font-semibold tabular-nums">{d.managerScore}</span></p>
        <p className="pt-1.5 border-t border-[var(--color-border)] mt-1.5">
          <span className="text-slate-500 font-medium">Chênh lệch: </span>
          <span className="font-semibold tabular-nums" style={{ color: d.gap > 0 ? '#f59e0b' : d.gap < 0 ? '#3b82f6' : '#64748b' }}>
            {d.gap > 0 ? '+' : ''}{d.gap}
          </span>
        </p>
        {d.memberCount != null && d.memberCount > 0 && (
          <p className="text-xs text-slate-400">{d.memberCount} thành viên</p>
        )}
      </div>
    </div>
  )
}
