import { Activity, BarChart3, GitCompare, Layers, Network, Scale, TrendingUp } from 'lucide-react'
import { xAxisLabel, yAxisLabel } from '@/components/charts/axisLabel'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import { AXIS_COLORS, METRIC_COLORS, ratingColor } from '@/components/charts/chartPalette'
import DivergingBar from '@/components/charts/primitives/DivergingBar'
import FlowSankey from '@/components/charts/primitives/FlowSankey'
import Histogram from '@/components/charts/primitives/Histogram'
import StackedComposition from '@/components/charts/primitives/StackedComposition'
import {
  useKpiLifecycle, useRankDelta, useScoreDeviation, useScoreHistogram,
  useSelfVsManager, useSubmissionComposition, useSubmissionShare,
} from '../../hooks/useAdvancedAnalytics'
import type { AdvancedFilter } from '../../api/advancedAnalyticsApi'
import { TrendModeToggle } from '@/components/common/dashboard/TrendModeToggle'
import { useTrendMode } from '@/components/common/dashboard/useTrendMode'

/** Props chung cho mọi widget của tab, khớp chữ ký các section sẵn có trong SummaryTab. */
export interface AdvancedWidgetProps {
  filter: AdvancedFilter
  isEditMode?: boolean
  widget?: DashboardWidget
  onTogglePin?: (w: DashboardWidget) => void
  /** Bỏ vỏ ChartWrapper — dùng khi render trong thẻ đã ghim ở trang chủ. */
  bare?: boolean
}

function Shell({ title, icon, children, isEditMode, widget, onTogglePin, bare, extra }: AdvancedWidgetProps & {
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
      widget={widget!}
      onTogglePin={onTogglePin!}
      isEditMode={!!isEditMode}
      extraHeaderContent={extra}
    >
      {children}
    </ChartWrapper>
  )
}

function Empty({ children, height = 220 }: { children: React.ReactNode; height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-[var(--color-subtle-foreground)] font-medium text-center px-4" style={{ height }}>
      {children}
    </div>
  )
}

function Loading({ height = 220 }: { height?: number }) {
  return <div className="flex items-center justify-center text-[var(--color-subtle-foreground)] font-semibold" style={{ height }}>Đang tải...</div>
}

// ============================================================
// T1 — Cơ cấu bài nộp theo thời gian
// ============================================================

export function SubmissionTrendWidget(p: AdvancedWidgetProps) {
  const { data, isLoading } = useSubmissionComposition(p.filter)
  // Hai chế độ trả lời hai câu: số tuyệt đối cho biết khối lượng bài nộp tăng hay giảm, còn cơ cấu
  // 100% cho biết tỉ lệ tồn đọng — một kỳ ít bài mà toàn chờ duyệt vẫn là vấn đề, nhưng ở biểu đồ
  // tuyệt đối nó trông nhỏ xíu.
  const { mode, setMode, isShare } = useTrendMode('submission-composition')
  return (
    <Shell
      {...p}
      title="Cơ cấu bài nộp theo thời gian"
      icon={<Activity size={20} className="text-[var(--color-info)]" />}
      extra={<TrendModeToggle mode={mode} onChange={setMode} />}
    >
      {isLoading ? <Loading /> : !data?.points?.length ? (
        <Empty>Chưa có bài nộp nào trong khoảng thời gian này</Empty>
      ) : (
        <StackedComposition
          series={data.statuses}
          points={data.points}
          variant="area"
          normalize={isShare}
          unit="bài"
          yLabel={isShare ? 'Tỉ trọng (%)' : 'Số bài nộp'}
        />
      )}
    </Shell>
  )
}

// ============================================================
// P4 — Cơ cấu trạng thái theo đơn vị (100%)
// ============================================================

export function SubmissionShareWidget(p: AdvancedWidgetProps) {
  const { data, isLoading } = useSubmissionShare(p.filter)
  const points = (data?.units ?? []).map(u => ({ label: u.name, values: u.percents }))
  return (
    <Shell {...p} title="Cơ cấu trạng thái bài nộp theo đơn vị" icon={<Layers size={20} className="text-[var(--color-primary)]" />}>
      {isLoading ? <Loading /> : points.length === 0 ? (
        <Empty>Chưa có bài nộp nào để so cơ cấu giữa các đơn vị</Empty>
      ) : (
        <StackedComposition
          series={data!.statuses}
          points={points}
          variant="bar"
          normalize
          yLabel="Tỉ trọng (%)"
          rotateLabels={points.length > 5}
        />
      )}
    </Shell>
  )
}

// ============================================================
// D1 — Histogram phân phối điểm
// ============================================================

export function ScoreHistogramWidget(p: AdvancedWidgetProps) {
  const { data, isLoading } = useScoreHistogram(p.filter)
  return (
    <Shell {...p} title="Phân phối điểm đánh giá" icon={<BarChart3 size={20} className="text-[var(--color-primary)]" />}>
      {isLoading ? <Loading /> : !data || data.totalCount === 0 ? (
        <Empty>Chưa có đánh giá nào trong phạm vi này</Empty>
      ) : (
        <>
          <Histogram
            bins={data.bins}
            thresholds={data.levels}
            marker={data.myScore != null ? { value: data.myScore, label: 'Bạn' } : null}
            unit="điểm"
          />
          <p className="text-caption font-medium text-center mt-2">
            {data.totalCount} đánh giá · trung bình {data.averageScore ?? '—'} điểm
            {data.anonymized ? ' · phân phối đã ẩn danh' : ''}
          </p>
        </>
      )}
    </Shell>
  )
}

// ============================================================
// C2 — Chênh lệch điểm so với trung bình
// ============================================================

export function ScoreDeviationWidget(p: AdvancedWidgetProps) {
  const { data, isLoading } = useScoreDeviation(p.filter)
  const rows = data?.rows ?? []
  return (
    <Shell {...p} title="Chênh lệch điểm so với trung bình" icon={<Scale size={20} className="text-[var(--color-warning)]" />}>
      {isLoading ? <Loading /> : rows.length === 0 ? (
        <Empty>Chưa có đủ đánh giá để tính mặt bằng chung</Empty>
      ) : (
        <>
          <DivergingBar
            xLabel="Chênh lệch so với trung bình"
            data={rows.map(r => ({
              id: r.id ?? undefined,
              name: r.name,
              subText: r.subText ?? undefined,
              value: r.deviation,
            }))}
            unit={data?.unit}
            baselineLabel={`${data?.baselineLabel} (${data?.baseline} điểm)`}
            height={Math.max(200, Math.min(rows.length * 28 + 40, 460))}
          />
          {data?.anonymized && (
            <p className="text-caption font-medium text-center mt-2">
              Chỉ vị trí của bạn có tên; các vạch còn lại đã được gỡ danh tính từ máy chủ.
            </p>
          )}
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
    <Shell {...p} title="Tự đánh giá vs Quản lý đánh giá" icon={<GitCompare size={20} className="text-[var(--color-error)]" />}>
      {isLoading ? <Loading /> : rows.length === 0 ? (
        <Empty>
          Chưa có kỳ nào mà cả đơn vị và quản lý đều đã chấm.<br />
          Chênh lệch chỉ tính được khi có đủ cả hai điểm.
        </Empty>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(240, Math.min(rows.length * 44 + 50, 420))}>
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={AXIS_COLORS.grid} />
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
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-card">
      <p className="font-semibold text-[var(--color-foreground)] mb-2">{d.name}</p>
      <div className="space-y-1 text-sm">
        <p><span className="text-[var(--color-muted-foreground)] font-medium">Tự chấm: </span><span className="font-semibold tabular-nums">{d.selfScore}</span></p>
        <p><span className="text-[var(--color-muted-foreground)] font-medium">Quản lý chấm: </span><span className="font-semibold tabular-nums">{d.managerScore}</span></p>
        <p className="pt-1.5 border-t border-[var(--color-border)] mt-1.5">
          <span className="text-[var(--color-muted-foreground)] font-medium">Chênh lệch: </span>
          <span className="font-semibold tabular-nums" style={{ color: d.gap > 0 ? '#f59e0b' : d.gap < 0 ? '#3b82f6' : '#64748b' }}>
            {d.gap > 0 ? '+' : ''}{d.gap}
          </span>
        </p>
        {d.memberCount != null && d.memberCount > 0 && (
          <p className="text-caption">{d.memberCount} thành viên</p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// K2 — Biến động thứ hạng giữa hai kỳ
// ============================================================

export function RankDeltaWidget(p: AdvancedWidgetProps) {
  const { data, isLoading } = useRankDelta(p.filter)
  const rows = data?.rows ?? []
  return (
    <Shell {...p} title="Biến động thứ hạng giữa hai kỳ" icon={<TrendingUp size={20} className="text-[var(--color-success)]" />}>
      {isLoading ? <Loading /> : !data?.comparable ? (
        <Empty>
          Cần ít nhất hai kỳ đã chốt điểm để so thứ hạng.<br />
          Hiện mới có {data?.currentCycleName ? `kỳ "${data.currentCycleName}"` : 'chưa đủ kỳ'}.
        </Empty>
      ) : rows.length === 0 ? (
        <Empty>Chưa đơn vị nào được chốt điểm ở kỳ hiện tại</Empty>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(240, Math.min(rows.length * 46 + 50, 420))}>
            <BarChart data={rows} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AXIS_COLORS.grid} />
              <XAxis
                dataKey="name" axisLine={false} tickLine={false} interval={0}
                tick={{ fill: AXIS_COLORS.tick, fontSize: 10, fontWeight: 500 }}
                angle={rows.length > 5 ? -25 : 0}
                textAnchor={rows.length > 5 ? 'end' : 'middle'}
                height={rows.length > 5 ? 62 : 28}
              />
              <YAxis
                label={yAxisLabel('Điểm')}
                domain={[0, data.axisMax]} axisLine={false} tickLine={false}
                tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
              />
              <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<RankTooltip cur={data.currentCycleName} prev={data.previousCycleName} />} />
              <Bar dataKey="score" radius={[3, 3, 0, 0]} isAnimationActive={false} label={<RankArrow />}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={ratingColor(r.rankDelta == null ? 3 : r.rankDelta > 0 ? 5 : r.rankDelta < 0 ? 1 : 3)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-caption font-medium text-center mt-1">
            So {data.currentCycleName} với {data.previousCycleName} · mũi tên là mức thay đổi thứ hạng
          </p>
        </>
      )}
    </Shell>
  )
}

/** Mũi tên ↑↓ kèm số bậc thay đổi, vẽ ngay trên đỉnh cột. */
function RankArrow(props: { x?: number; y?: number; width?: number; index?: number; value?: number } & Record<string, unknown>) {
  const { x = 0, y = 0, width = 0 } = props
  const row = (props['payload'] ?? {}) as { rankDelta?: number | null }
  const delta = row.rankDelta
  if (delta == null || delta === 0) return null
  const up = delta > 0
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      fontSize={11}
      fontWeight={900}
      fill={up ? '#10b981' : '#ef4444'}
    >
      {up ? '▲' : '▼'} {Math.abs(delta)}
    </text>
  )
}

function RankTooltip({ active, payload, cur, prev }: {
  active?: boolean
  payload?: { payload: { name: string; score: number; currentRank: number; previousRank?: number | null; rankDelta?: number | null; scoreDelta?: number | null } }[]
  cur?: string | null
  prev?: string | null
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-card">
      <p className="font-semibold text-[var(--color-foreground)] mb-2">{d.name}</p>
      <div className="space-y-1 text-sm">
        <p><span className="text-[var(--color-muted-foreground)] font-medium">{cur}: </span><span className="font-semibold tabular-nums">hạng {d.currentRank} · {d.score} điểm</span></p>
        <p><span className="text-[var(--color-muted-foreground)] font-medium">{prev}: </span>
          <span className="font-semibold tabular-nums">{d.previousRank != null ? `hạng ${d.previousRank}` : 'chưa có mặt'}</span>
        </p>
        {d.rankDelta != null && d.rankDelta !== 0 && (
          <p className="pt-1.5 border-t border-[var(--color-border)] mt-1.5 font-semibold" style={{ color: d.rankDelta > 0 ? '#10b981' : '#ef4444' }}>
            {d.rankDelta > 0 ? `Tăng ${d.rankDelta} bậc` : `Giảm ${Math.abs(d.rankDelta)} bậc`}
            {d.scoreDelta != null && ` (${d.scoreDelta > 0 ? '+' : ''}${d.scoreDelta} điểm)`}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// F2 — Luồng vòng đời KPI
// ============================================================

export function KpiLifecycleWidget(p: AdvancedWidgetProps) {
  const { data, isLoading } = useKpiLifecycle(p.filter)
  return (
    <Shell {...p} title="Vòng đời KPI" icon={<Network size={20} className="text-[var(--color-primary)]" />}>
      {isLoading ? <Loading /> : !data || data.empty ? (
        <Empty>Chưa có KPI nào trong phạm vi này</Empty>
      ) : (
        <>
          <FlowSankey nodes={data.nodes} links={data.links} valueLabel={data.valueLabel} />
          <p className="text-caption font-medium text-center mt-1">
            Ảnh chụp hiện trạng: mỗi KPI nằm ở đúng một nhánh cuối theo trạng thái hiện tại của nó.
          </p>
        </>
      )}
    </Shell>
  )
}
