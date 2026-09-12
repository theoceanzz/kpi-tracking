import { useMemo, useState } from 'react'
import { yAxisLabel } from '@/components/charts/axisLabel'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Gauge, TrendingUp, Layers, Scale, AlertTriangle, Award, ShieldCheck, Medal,
  Building2, History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import Pagination from '@/components/common/Pagination'
import AnalyticsTabSkeleton from '@/components/common/AnalyticsTabSkeleton'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import Lollipop from '@/components/charts/primitives/Lollipop'
import { useChartTableView } from '@/components/common/dashboard/useChartTableView'
import { ViewToggleButtons } from '@/components/common/dashboard/ViewToggleButtons'
import {
  BscVsSystemScatterSection, PerspectiveBubbleSection, BscWaterfallSection, WeightHistorySection,
} from '../components/advanced/BscAdvanced'
import {
  useBscBalance, useBscTrend, useBscUnitComparison, useBscVsSystem, useBscRankings,
} from '../hooks/useAnalytics'
import StackedComposition from '@/components/charts/primitives/StackedComposition'
import { SeriesTooltip } from '@/components/charts/ChartTooltip'
import { TrendModeToggle } from '@/components/common/dashboard/TrendModeToggle'
import { useTrendMode } from '@/components/common/dashboard/useTrendMode'
import AnalyticsTabHeader from '../components/AnalyticsTabHeader'
import { StatCard } from '@/features/dashboard/widgets/shared/StatCard'
import { ChoiceChip } from '@/components/ui/choice-chip'

const ALL_UNITS = '__ALL__'
const RANK_PAGE_SIZE = 10

// Số nhân sự biểu đồ xếp hạng BSC vẽ (không phân trang).
const RANK_CHART_TOP_N = 15
const DEFAULT_COLOR = '#8b5cf6'

const fmt = (v?: number | null) => (v == null ? '—' : (Math.round(v * 10) / 10).toString())

/** Màu theo ngưỡng điểm (đồng bộ BSC Dashboard). */
const scoreColor = (v?: number | null) => {
  if (v == null) return 'text-[var(--color-subtle-foreground)]'
  if (v < 50) return 'text-[var(--color-error)]'
  if (v < 70) return 'text-[var(--color-warning)]'
  if (v < 90) return 'text-[var(--color-success)]'
  return 'text-[var(--color-info)]'
}

function ScoringModeBadge({ mode }: { mode?: string | null }) {
  if (!mode) return null
  const shadow = mode === 'SHADOW'
  return (
    <span className={cn(
      'text-eyebrow inline-flex items-center gap-1 px-2.5 py-1 rounded-full',
      shadow ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]'
             : 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]'
    )}>
      {shadow ? 'Chạy song song (SHADOW)' : 'Chính thức (OFFICIAL)'}
    </span>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-widget border border-[var(--color-border)] bg-[var(--color-card)] p-5', className)}>
      {children}
    </div>
  )
}

function SectionTitle({ icon, children, extra }: { icon: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="flex items-center gap-2 text-section-title">{icon} {children}</h3>
      {extra}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-[180px] items-center justify-center px-4 text-center text-sm text-[var(--color-muted-foreground)]">{children}</div>
}

export default function BscAnalyticsTab() {
  const { periodId, periodIdTo, groupBy, controls } = useAnalyticsDateFilter({ selectClassName: 'h-9' })
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined)
  const [vsLevel, setVsLevel] = useState<'UNIT' | 'MEMBER'>('UNIT')
  const [rankPage, setRankPage] = useState(0)
  const { view: rankView, setView: setRankView } = useChartTableView('bsc-rank')
  const [vsShape, setVsShape] = useState<'BAR' | 'SCATTER'>('BAR')
  const advancedFilter = { orgUnitId: selectedUnitId, periodId, periodIdTo }
  const [rankSort, setRankSort] = useState<'bscScore' | 'systemScore'>('bscScore')

  const scope = { orgUnitId: selectedUnitId, periodId, periodIdTo }

  const { data: tree } = useOrgUnitTree()
  const flatUnits = useMemo(() => {
    const out: { id: string; name: string; depth: number }[] = []
    const walk = (nodes: any[] | undefined, depth: number) =>
      nodes?.forEach(n => { out.push({ id: n.id, name: n.name, depth }); walk(n.children, depth + 1) })
    walk(tree as any, 0)
    return out
  }, [tree])

  const { data: balance, isLoading: loadingBalance } = useBscBalance(scope)
  const { data: trend } = useBscTrend({ ...scope, groupBy })
  const { data: comparison } = useBscUnitComparison(scope)
  const { data: vsSystem } = useBscVsSystem({ ...scope, level: vsLevel })
  // Chế độ biểu đồ lấy một lần Top N, chế độ bảng phân trang như cũ: bảng xếp hạng sinh ra để xem
  // đầu bảng, còn "trang 4/9 của một bảng xếp hạng" thì không trả lời được câu hỏi nào.
  const rankChartMode = rankView === 'chart'
  const { data: ranking } = useBscRankings({
    ...scope, sortBy: rankSort, sortDir: 'desc',
    page: rankChartMode ? 0 : rankPage,
    size: rankChartMode ? RANK_CHART_TOP_N : RANK_PAGE_SIZE,
  })

  const { mode: trendMode, setMode: setTrendMode, isShare: isTrendShare } = useTrendMode('bsc:perspective-trend')

  const trendData = useMemo(
    () => (trend?.points || []).map(pt => ({ label: pt.label, overall: pt.overall ?? null, ...pt.values })),
    [trend]
  )

  // Cơ cấu 100% phải dựng trên điểm ĐÃ NHÂN TRỌNG SỐ: chỉ đại lượng đó mới cộng thành điểm BSC.
  // Dữ liệu cũ chưa có `weighted` sẽ cho tổng 0 — bắt lấy để hiện thông báo thay vì vẽ biểu đồ rỗng.
  const trendShare = useMemo(() => {
    const points = (trend?.points || []).map(pt => ({ label: pt.label, values: pt.weighted ?? {} }))
    const hasData = points.some(p => Object.values(p.values).some(v => (v ?? 0) > 0))
    return { points, hasData }
  }, [trend])

  const comparisonData = useMemo(
    () => (comparison?.units || []).map(u => ({ name: u.orgUnitName, overallBsc: u.overallBsc ?? null, ...u.values })),
    [comparison]
  )

  const vsData = useMemo(
    () => (vsSystem?.rows || []).map(r => ({ name: r.name, bscScore: r.bscScore ?? null, systemScore: r.systemScore ?? null })),
    [vsSystem]
  )

  if (loadingBalance && !balance) return <AnalyticsTabSkeleton variant="default" className="p-6" />

  const noData = balance && balance.evaluationCount === 0 && (balance.perspectives?.length ?? 0) === 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <AnalyticsTabHeader
        title="Hạng mục (BSC)"
        description="Điểm theo từng hạng mục chiến lược, cân bằng trọng số và xếp hạng đơn vị/nhân sự theo điểm BSC."
        actions={<ScoringModeBadge mode={balance?.scoringMode} />}
        filters={
          <>
            <Select value={selectedUnitId ?? ALL_UNITS} onValueChange={v => setSelectedUnitId(v === ALL_UNITS ? undefined : v)}>
              <SelectTrigger className="h-9 w-full sm:w-[250px] shrink-0" aria-label="Đơn vị">
                <Building2 size={14} className="mr-1 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_UNITS}>Tất cả đơn vị (mình quản lý)</SelectItem>
                {flatUnits.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    <span style={{ paddingLeft: u.depth * 12 }}>{u.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {controls}
          </>
        }
      />

      {noData && (
        <Card>
          <EmptyState>
            Chưa có dữ liệu BSC cho phạm vi/kỳ đang chọn.<br />
            Hãy tạo bộ tiêu chí cho kỳ và thực hiện đánh giá để sinh điểm hạng mục.
          </EmptyState>
        </Card>
      )}

      {/* ── Thẻ chỉ số cân bằng ─────────────────────────────────────────── */}
      <div id="tour-analytics-metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Điểm BSC trung bình"
          value={<p className={cn('text-stat truncate', scoreColor(balance?.averageBscScore))}>{fmt(balance?.averageBscScore)}</p>}
          sub={`${balance?.evaluationCount ?? 0} đánh giá`}
          icon={<Gauge />}
          color="indigo"
        />
        <StatCard
          label="Hạng mục mạnh nhất"
          value={<p className="truncate text-base font-semibold text-[var(--color-foreground)]">{balance?.strongestPerspective ?? '—'}</p>}
          sub={<span className="text-[var(--color-success)] tabular-nums">{fmt(balance?.strongestScore)}%</span>}
          icon={<Award />}
          color="emerald"
        />
        <StatCard
          label="Hạng mục yếu nhất"
          value={<p className="truncate text-base font-semibold text-[var(--color-foreground)]">{balance?.weakestPerspective ?? '—'}</p>}
          sub={<span className="text-[var(--color-error)] tabular-nums">{fmt(balance?.weakestScore)}%</span>}
          icon={<AlertTriangle />}
          color="red"
        />
        <StatCard
          label="Độ phủ hạng mục"
          value={`${fmt(balance?.coveragePercent)}%`}
          sub={`${balance?.unmappedKpiCount ?? 0} KPI chưa gán`}
          icon={<ShieldCheck />}
          color="amber"
        />
      </div>

      {/* ── Cân bằng: card từng hạng mục ────────────────────────────────── */}
      {/* Trước đây có thêm một radar 4 trục cạnh khối này. Đã bỏ: bốn thẻ dưới đây đã hiện đủ
          mọi con số radar vẽ (trọng số, số KPI, điểm đạt, đóng góp), mà diện tích radar 4 trục
          lại đổi theo THỨ TỰ trục chứ không theo dữ liệu — nên "hình càng đầy càng cân bằng" là
          một cách đọc sai. Câu hỏi cân bằng nay do biểu đồ bong bóng bên dưới trả lời. */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(balance?.perspectives || []).map(p => {
            const ach = p.averageScore
            const color = p.color || DEFAULT_COLOR
            return (
              <div key={p.perspectiveId} className="relative overflow-hidden bg-[var(--color-card)] rounded-widget border border-[var(--color-border)] p-5 shadow-sm">
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: color }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <h3 className="text-section-title text-[var(--color-foreground)] truncate">{p.name}</h3>
                    </div>
                    <p className="mt-0.5 text-caption">Trọng số {fmt(p.weightPercentage)}% · {p.kpiCount ?? 0} KPI</p>
                  </div>
                  <p className={cn('text-2xl font-semibold tabular-nums shrink-0', scoreColor(ach))}>{ach != null ? Math.round(ach) : '—'}<span className="text-sm">%</span></p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, ach || 0)}%`, backgroundColor: color }} />
                </div>
                <div className="flex items-center justify-between mt-2 text-caption">
                  <span>Đóng góp</span>
                  <span className="text-[var(--color-muted-foreground)]">{fmt(p.weightedScore)} đ</span>
                </div>
              </div>
            )
          })}
          {!(balance?.perspectives?.length) && <div className="sm:col-span-2 lg:col-span-4"><Card><EmptyState>Chưa có hạng mục nào có dữ liệu</EmptyState></Card></div>}
        </div>
      </div>

      {/* ── Xu hướng điểm hạng mục theo kỳ ──────────────────────────────── */}
      <Card>
        <SectionTitle
          icon={<TrendingUp size={14} className="text-[var(--color-primary)]" />}
          extra={<TrendModeToggle mode={trendMode} onChange={setTrendMode} />}
        >
          Xu hướng điểm hạng mục theo kỳ
        </SectionTitle>
        {isTrendShare ? (
          trendShare.hasData ? (
            <>
              <p className="text-caption font-medium mb-2">
                Tỉ trọng đóng góp vào điểm BSC — tính trên điểm đã nhân trọng số, nên bốn hạng mục cộng lại đúng bằng điểm tổng.
              </p>
              <StackedComposition
                yLabel="Tỉ trọng đóng góp (%)"
                series={(trend?.perspectives || []).map(p => ({
                  code: p.id, label: p.name, color: p.color || DEFAULT_COLOR,
                }))}
                points={trendShare.points}
                variant="area"
                normalize
                unit="điểm"
                height={320}
              />
            </>
          ) : (
            <EmptyState>Chưa có điểm đã nhân trọng số để tính tỉ trọng đóng góp</EmptyState>
          )
        ) : trendData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis label={yAxisLabel('\u0110i\u1ec3m')} domain={[0, 'auto']} tick={{ fontSize: 11 }} />
              <Tooltip content={<SeriesTooltip unit="%" />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(trend?.perspectives || []).map(p => (
                <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={p.color || DEFAULT_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              ))}
              <Line type="monotone" dataKey="overall" name="Điểm BSC" stroke="#0f172a" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyState>Chọn từ 2 kỳ trở lên để xem xu hướng</EmptyState>}
      </Card>

      {/* ── So sánh hạng mục giữa các đơn vị ────────────────────────────── */}
      <Card>
        <SectionTitle icon={<Building2 size={14} className="text-[var(--color-success)]" />}>So sánh hạng mục giữa các đơn vị</SectionTitle>
        {comparisonData.length ? (
          <ResponsiveContainer width="100%" height={Math.max(300, comparisonData.length * 46)}>
            <BarChart data={comparisonData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} horizontal={false} />
              <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip content={<SeriesTooltip unit="%" />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(comparison?.perspectives || []).map(p => (
                <Bar key={p.id} dataKey={p.id} name={p.name} fill={p.color || DEFAULT_COLOR} radius={[0, 3, 3, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState>Chưa có đơn vị nào có dữ liệu BSC</EmptyState>}
      </Card>

      {/* ── Kiểm chứng SHADOW: BSC vs hệ thống + coverage guard ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <SectionTitle
            icon={<Scale size={14} className="text-[var(--color-primary)]" />}
            extra={
              <div className="flex items-center gap-1 bg-[var(--color-muted)] rounded-control p-0.5">
                {(['UNIT', 'MEMBER'] as const).map(l => (
                  <ChoiceChip selected={vsLevel === l} variant="segment" size="sm" className="py-1" key={l} onClick={() => setVsLevel(l)}>{l === 'UNIT' ? 'Theo đơn vị' : 'Theo nhân sự'}</ChoiceChip>
                ))}
                <span className="w-px h-4 bg-[var(--color-border)] mx-1" />
                {([['BAR', 'Cột'], ['SCATTER', 'Phân tán']] as const).map(([v, lb]) => (
                  <ChoiceChip selected={vsShape === v} variant="segment" size="sm" className="py-1" key={v} onClick={() => setVsShape(v)}>{lb}</ChoiceChip>
                ))}
              </div>
            }
          >Đối chiếu BSC vs điểm hệ thống</SectionTitle>
          {vsShape === 'SCATTER' ? (
            <BscVsSystemScatterSection filter={advancedFilter} />
          ) : vsData.length ? (
            <ResponsiveContainer width="100%" height={Math.max(280, vsData.length * 44)}>
              <BarChart data={vsData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} horizontal={false} />
                <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip content={<SeriesTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="bscScore" name="Điểm BSC" fill="#6366f1" radius={[0, 3, 3, 0]} />
                <Bar dataKey="systemScore" name="Điểm hệ thống" fill="#94a3b8" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState>Chưa có điểm để đối chiếu</EmptyState>}
        </Card>
        <Card>
          <SectionTitle icon={<ShieldCheck size={14} className="text-[var(--color-warning)]" />}>KPI chưa gán hạng mục</SectionTitle>
          <div className="text-center py-2">
            <p className={cn('text-4xl font-semibold tabular-nums', (balance?.coveragePercent ?? 100) >= 100 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]')}>{fmt(balance?.coveragePercent)}%</p>
            <p className="text-xs text-[var(--color-subtle-foreground)] font-medium mt-1">độ phủ · {balance?.mappedKpiCount ?? 0}/{(balance?.mappedKpiCount ?? 0) + (balance?.unmappedKpiCount ?? 0)} KPI đã gán</p>
          </div>
          {balance?.unmappedKpiNames?.length ? (
            <div className="mt-3 max-h-[220px] overflow-auto custom-scrollbar space-y-1.5">
              {balance.unmappedKpiNames.map((n, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted-foreground)] bg-[var(--color-warning-bg)] rounded-control px-3 py-2">
                  <AlertTriangle size={13} className="text-[var(--color-warning)] shrink-0" /> <span className="truncate">{n}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-center text-[var(--color-success)] font-medium">Tất cả KPI tính điểm đều đã gán hạng mục ✓</p>
          )}
        </Card>
      </div>

      {/* ── Bong bóng hạng mục & cấu thành điểm ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle icon={<Layers size={14} className="text-[var(--color-primary)]" />}>
            Trọng số × Kết quả theo hạng mục
          </SectionTitle>
          <PerspectiveBubbleSection filter={advancedFilter} />
        </Card>
        <Card>
          <SectionTitle icon={<TrendingUp size={14} className="text-[var(--color-success)]" />}>
            Cấu thành điểm BSC
          </SectionTitle>
          <BscWaterfallSection filter={advancedFilter} />
        </Card>
      </div>

      {/* ── Lịch sử thay đổi trọng số (chỉ cấp tổ chức) ──────────────────── */}
      <Card>
        <SectionTitle icon={<History size={14} className="text-[var(--color-warning)]" />}>
          Lịch sử thay đổi trọng số hạng mục
        </SectionTitle>
        <WeightHistorySection filter={advancedFilter} />
      </Card>

      {/* ── Xếp hạng nhân sự theo điểm BSC ───────────────────────────────── */}
      <Card>
        <SectionTitle
          icon={<Medal size={14} className="text-[var(--color-warning)]" />}
          extra={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[var(--color-muted)] rounded-control p-0.5">
                {([['bscScore', 'Điểm BSC'], ['systemScore', 'Điểm hệ thống']] as const).map(([k, lb]) => (
                  <ChoiceChip selected={rankSort === k} variant="segment" size="sm" className="py-1" key={k} onClick={() => { setRankSort(k); setRankPage(0) }}>{lb}</ChoiceChip>
                ))}
              </div>
              <ViewToggleButtons view={rankView} onChange={setRankView} />
            </div>
          }
        >Xếp hạng nhân sự theo điểm BSC</SectionTitle>
        {rankView === 'chart' ? (
          (ranking?.content?.length ?? 0) === 0 ? (
            <div className="py-16 text-center text-[var(--color-subtle-foreground)] text-sm">Không có dữ liệu xếp hạng</div>
          ) : (
            <Lollipop
              data={(ranking?.content || []).map(row => ({
                id: row.userId,
                name: row.fullName,
                subText: row.email ?? undefined,
                value: (rankSort === 'bscScore' ? row.bscScore : row.systemScore) ?? 0,
              }))}
              unit=" điểm"
              domainMax={100}
            />
          )
        ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-[var(--color-muted)]">
              <tr className="text-eyebrow">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Nhân sự</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Điểm BSC</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Điểm HT</th>
                <th className="px-4 py-3">Breakdown hạng mục</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {(ranking?.content || []).map((row, idx) => (
                <tr key={row.userId} className="hover:bg-[var(--color-muted)]">
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--color-subtle-foreground)]">{rankPage * RANK_PAGE_SIZE + idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{row.fullName}</p>
                    <p className="text-caption">{row.email}</p>
                  </td>
                  <td className={cn('px-4 py-3 text-right text-sm font-semibold tabular-nums', scoreColor(row.bscScore))}>{fmt(row.bscScore)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-[var(--color-muted-foreground)]">{fmt(row.systemScore)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(ranking?.perspectives || []).map(p => {
                        const v = row.perspectiveScores?.[p.id]
                        if (v == null) return null
                        return (
                          <span key={p.id} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${p.color || DEFAULT_COLOR}22`, color: p.color || DEFAULT_COLOR }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color || DEFAULT_COLOR }} />
                            {Math.round(v)}%
                          </span>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ))}
              {!(ranking?.content?.length) && (
                <tr><td colSpan={5} className="text-center py-8 text-[var(--color-subtle-foreground)] text-sm">Không có dữ liệu xếp hạng</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
        {rankChartMode && (ranking?.totalElements ?? 0) > RANK_CHART_TOP_N && (
          <p className="text-caption font-medium text-center mt-2">
            {RANK_CHART_TOP_N} người dẫn đầu trong {ranking?.totalElements} nhân sự — xem đủ ở chế độ bảng.
          </p>
        )}
        {!rankChartMode && (ranking?.totalElements ?? 0) > RANK_PAGE_SIZE && (
          <Pagination
            currentPage={rankPage}
            totalPages={ranking?.totalPages ?? 1}
            onPageChange={setRankPage}
            totalElements={ranking?.totalElements ?? 0}
            size={RANK_PAGE_SIZE}
            itemLabel="nhân sự"
          />
        )}
      </Card>

      <p className="text-caption font-medium flex items-center gap-1.5">
        <Layers size={12} /> Số liệu gộp từ điểm đánh giá đã lưu theo hạng mục — nhất quán với chỉ số "hiệu suất theo đánh giá".
      </p>
    </div>
  )
}
