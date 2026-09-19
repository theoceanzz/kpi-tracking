import { useState, useMemo } from 'react'
import { yAxisLabel } from '@/components/charts/axisLabel'
import { SeriesTooltip } from '@/components/charts/ChartTooltip'
import { personalKpiApi } from '@/features/dashboard/api/personalKpiApi'
import { useMyAnalytics } from '../hooks/useAnalytics'
import { useQuery } from '@tanstack/react-query'
import {
  Target, TrendingUp, AlertTriangle, CheckCircle,
  ChevronDown, ChevronRight,
  User, Users, X, Star, Search, ChevronLeft,
  Activity, BarChart3 as BarChartIcon, PieChart as PieChartIcon, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KpiTypeTags } from '../components/KpiTypeTags'
import { QualitativeResultChip } from '../components/QualitativeResultChip'
import { toChildNodes } from '../components/KpiChildList'
import { KpiChildTableRows } from '../components/KpiChildTableRows'
import { KpiPeriodCell } from '../components/KpiPeriodCell'
import { KpiWeightPill } from '../components/KpiWeightPill'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { seriesColor } from '@/components/charts/chartPalette'
import BulletChart from '@/components/charts/primitives/BulletChart'
import { useChartTableView } from '@/components/common/dashboard/useChartTableView'
import { ViewToggleButtons } from '@/components/common/dashboard/ViewToggleButtons'
import { ScoreHistogramWidget } from '../components/advanced/SummaryAdvanced'

import AnalyticsComboChart from '../components/AnalyticsComboChart'
import { SparseTableFiller } from '../components/SparseTableFiller'
import MyKpiDrawer from '../components/MyKpiDrawer'
import AnalyticsTabSkeleton, { TableLoadingRows } from '@/components/common/AnalyticsTabSkeleton'
import Pagination from '@/components/common/Pagination'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import { SortHeader } from '@/components/common/SortHeader'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import { useDashboardCustomization } from '@/components/common/dashboard/useDashboardCustomization'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import type { WidgetType } from '@/types/datasource'

import { format } from 'date-fns'
import AnalyticsTabHeader from '../components/AnalyticsTabHeader'
import { StatCard } from '@/features/dashboard/widgets/shared/StatCard'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'


type SortField = 'progress' | 'period'
type SortDir = 'asc' | 'desc'
type SharedFilter = 'ALL' | 'SHARED' | 'PERSONAL'

const PAGE_SIZE = 5

// Chế độ biểu đồ lấy trọn danh sách thay vì phân trang. Trần này chỉ để chặn trường hợp bất
// thường; chạm trần thì biểu đồ báo rõ chứ không cắt cụt im lặng.
const CHART_FETCH_SIZE = 200

const CONFIG_REPORT_NAME = '__MY_KPI_DASHBOARD_CONFIG__'
const DEFAULT_WIDGETS: DashboardWidget[] = [
  { i: 'mykpi-trend', type: 'MYKPI_TREND', title: 'Xu hướng KPI theo thời gian', x: 0, y: 0, w: 12, h: 15, visible: true },
  { i: 'mykpi-detail', type: 'MYKPI_DETAIL', title: 'Bảng chi tiết KPI đang đảm nhiệm', x: 0, y: 15, w: 12, h: 18, visible: true },
  // Bốn khối dưới đây trước nằm NGOÀI lưới nên không ẩn/hiện/kéo-thả/ghim được, trong khi hai
  // widget trên thì được — cùng một trang mà hai cách hành xử. Nay đưa hết vào lưới.
  { i: 'mykpi-submission-status', type: 'SUBMISSION_STATUS', title: 'Trạng thái bài nộp', x: 0, y: 33, w: 6, h: 10, visible: true },
  { i: 'mykpi-status-dist', type: 'KPI_STATUS_DIST', title: 'Phân bổ trạng thái KPI', x: 6, y: 33, w: 6, h: 10, visible: true },
  { i: 'mykpi-eval-history', type: 'EVAL_HISTORY', title: 'Lịch sử & xu hướng điểm đánh giá', x: 0, y: 43, w: 12, h: 12, visible: true },
  { i: 'mykpi-histogram', type: 'MY_SCORE_HISTOGRAM', title: 'Vị trí của bạn trong phân phối điểm', x: 0, y: 55, w: 12, h: 12, visible: false },
]
/**
 * DB có check-constraint trên `widget_type` nên loại riêng của FE lưu xuống dưới enum sẵn có;
 * loại thật suy lại từ `chartConfig.i` khi tải lên nên không cần migration.
 */
const FE_ONLY_WIDGET_TYPES: Record<string, WidgetType> = {
  MYKPI_TREND: 'TREND_CHART',
  MYKPI_DETAIL: 'TABLE',
  SUBMISSION_STATUS: 'PIE',
  KPI_STATUS_DIST: 'BAR',
  EVAL_HISTORY: 'AREA',
  MY_SCORE_HISTOGRAM: 'BAR',
}

const toBackendWidgetType = (t: string): WidgetType => FE_ONLY_WIDGET_TYPES[t] ?? 'TABLE'
const CATALOG: { template: DashboardWidget; icon: React.ReactNode }[] = DEFAULT_WIDGETS.map(t => ({
  template: t,
  icon: t.type === 'MYKPI_TREND' ? <TrendingUp size={24} /> : <Target size={24} />,
}))

export default function MyStatsTab() {
  const onlyApproved = false
  const { periodId, periodIdTo, from, to, groupBy, controls } = useAnalyticsDateFilter({ selectClassName: 'h-9' })
  const perf = usePerformanceScale()

  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)
  const { view: detailView, setView: setDetailView } = useChartTableView('mykpi-detail')
  const { view: evalView, setView: setEvalView } = useChartTableView('mykpi-eval-history')

  const [filterShared, setFilterShared] = useState<SharedFilter>('ALL')
  const [sortField, setSortField] = useState<SortField | null>('period') // ưu tiên đợt/ngày gần nhất
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  // ── New KPI analytics (standalone KPIs without KeyResult) ────────────────
  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['personalKpi', 'metrics', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => personalKpiApi.getMetrics({ from, to, onlyApproved, periodId, periodIdTo }),
  })
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['personalKpi', 'chart', from, to, onlyApproved, periodId, periodIdTo, groupBy],
    queryFn: () => personalKpiApi.getComboChart({ from, to, onlyApproved, periodId, periodIdTo, groupBy }),
  })
  // Chế độ biểu đồ lấy TRỌN danh sách, chế độ bảng phân trang như cũ. Phân trang là affordance của
  // bảng: một biểu đồ hiện "5 trong 107 KPI, trang 1/22" thì mỗi trang là một mảnh vụn tuỳ tiện,
  // không so được với nhau và cũng không nói lên tổng thể.
  const chartMode = detailView === 'chart'
  const effectivePage = chartMode ? 0 : page
  const effectiveSize = chartMode ? CHART_FETCH_SIZE : PAGE_SIZE

  const { data: kpiPage, isLoading: isKpisLoading } = useQuery({
    queryKey: ['personalKpi', 'details', from, to, onlyApproved, periodId, periodIdTo, sortField, sortDir, filterShared, effectivePage, effectiveSize],
    queryFn: () => personalKpiApi.getDetailedKpis({
      from, to, onlyApproved, periodId, periodIdTo,
      sortBy: sortField ?? undefined,
      sortDir,
      sharedType: filterShared === 'ALL' ? undefined : filterShared,
      page: effectivePage,
      size: effectiveSize,
    }),
  })

  // ── Old analytics data ───────────────────────────────────────────────────
  const { data: analyticsData } = useMyAnalytics(from, to, periodId, periodIdTo)

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setPage(0)
  }

  // ── Tuỳ chỉnh giao diện (lưới widget dùng chung) ──────────────────────────
  const dash = useDashboardCustomization({
    configReportName: CONFIG_REPORT_NAME,
    reportDescription: 'Cấu hình giao diện KPI của tôi',
    defaultWidgets: DEFAULT_WIDGETS,
    toBackendWidgetType,
  })
  const { isEditMode, handleTogglePin } = dash

  const renderDetailBody = () => (
    <div className="flex-1 flex flex-col min-h-0 -mx-6 -mb-6">
      <div className="px-6 pb-4 border-b border-[var(--color-border)] flex flex-wrap items-center gap-3">
        <div className="flex gap-0.5 p-1 bg-[var(--color-muted)] rounded-control">
          {([['ALL', 'Tất cả'], ['SHARED', 'Mục tiêu chung'], ['PERSONAL', 'Mục tiêu riêng']] as [SharedFilter, string][]).map(([v, label]) => (
            <ChoiceChip selected={filterShared === v} variant="segment" size="sm" className="py-1" key={v} onClick={() => { setFilterShared(v); setPage(0) }}>
              {label}
            </ChoiceChip>
          ))}
        </div>
        {filterShared !== 'ALL' && (
          <Button variant="ghost" size="sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => { setFilterShared('ALL'); setPage(0) }}>
            <X aria-hidden="true" /> Xóa bộ lọc
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar min-h-0 flex flex-col">
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-[var(--color-muted)]">
              <tr className="text-eyebrow">
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Tên KPI</th>
                <th className="px-6 py-4 whitespace-nowrap">
                  <SortHeader field="period" active={sortField} dir={sortDir} onToggle={toggleSort}>Đợt</SortHeader>
                </th>
                <th className="px-6 py-4 min-w-[250px]">
                  <SortHeader field="progress" active={sortField} dir={sortDir} onToggle={toggleSort}>Tiến độ KPI</SortHeader>
                </th>
                <th className="px-6 py-4">Phân loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {isKpisLoading
                ? <TableLoadingRows cols={5} count={2} />
                : kpiPage?.content?.map(kpi => (
                    <ExpandableKpiRow key={kpi.kpiId} kpi={kpi} onOpenDrawer={() => setSelectedKpiId(kpi.kpiId)} onSelectKpi={setSelectedKpiId} />
                  ))}
              {!isKpisLoading && (kpiPage?.totalElements ?? 0) === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-[var(--color-subtle-foreground)]">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {isKpisLoading ? (
            <div className="p-6 text-sm text-[var(--color-subtle-foreground)]">Đang tải...</div>
          ) : kpiPage?.content?.length ? (
            kpiPage.content.map(kpi => (
              <MobileKpiCard key={kpi.kpiId} kpi={kpi} onOpenDrawer={() => setSelectedKpiId(kpi.kpiId)} />
            ))
          ) : (
            <div className="text-center py-8 text-[var(--color-subtle-foreground)]">Không có dữ liệu</div>
          )}
        </div>

        <SparseTableFiller
          message={!isKpisLoading && (kpiPage?.content?.length ?? 0) > 0 && (kpiPage?.content?.length ?? 0) < PAGE_SIZE
            ? `Đã hiển thị tất cả ${kpiPage?.totalElements ?? 0} KPI`
            : null}
        />
      </div>

      {(kpiPage?.totalElements ?? 0) > 0 && (
        <Pagination currentPage={page} totalPages={kpiPage?.totalPages ?? 1} onPageChange={setPage} totalElements={kpiPage?.totalElements ?? 0} size={PAGE_SIZE} itemLabel="KPI" />
      )}
    </div>
  )

  // Trục là % đạt so với mục tiêu chứ không phải giá trị thô: các KPI ở đây đo bằng những đơn vị
  // khác nhau (triệu đồng, số vụ, %), vẽ giá trị thô thì cái đo bằng triệu sẽ nuốt hết phần còn lại.
  // KPI định tính không có mục tiêu số nên tách riêng, không nhét vào thanh.
  const renderBulletBody = () => {
    const rows = (kpiPage?.content ?? []).filter(k => k.kpiType !== 'QUALITATIVE' && k.targetValue > 0)
    const qualitativeCount = (kpiPage?.content ?? []).length - rows.length
    return (
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {isKpisLoading ? (
          <div className="py-16 text-center text-[var(--color-subtle-foreground)] font-semibold">Đang tải...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-subtle-foreground)] font-semibold italic">Không có KPI định lượng nào trong kỳ này</div>
        ) : (
          <BulletChart
            data={rows.map(k => ({
              id: k.kpiId,
              name: k.kpiName,
              subText: k.periodName ?? undefined,
              actual: k.actualValue,
              target: k.targetValue,
              unit: k.unit,
              isReverse: k.isReverseKpi,
            }))}
            onSelect={d => { if (d.id) setSelectedKpiId(d.id) }}
          />
        )}
        {qualitativeCount > 0 && (
          <p className="text-caption font-medium text-center">
            {qualitativeCount} KPI định tính không hiện ở đây — xem trong chế độ bảng.
          </p>
        )}
        {(kpiPage?.totalElements ?? 0) > CHART_FETCH_SIZE && (
          <p className="text-xs text-[var(--color-warning)] font-medium text-center">
            Có {kpiPage?.totalElements} KPI, biểu đồ chỉ vẽ {CHART_FETCH_SIZE} mục đầu — xem đủ ở chế độ bảng.
          </p>
        )}
      </div>
    )
  }

  const renderWidget = (w: DashboardWidget) => {
    switch (w.type) {
      case 'MYKPI_TREND': return (
        <ChartWrapper chromeless title="Xu hướng KPI theo thời gian" icon={<TrendingUp size={20} className="text-[var(--color-primary)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <AnalyticsComboChart data={chartData?.points || []} isLoading={isChartLoading} itemName="KPI đảm nhiệm" fillHeight />
        </ChartWrapper>
      )
      case 'MYKPI_DETAIL': return (
        <ChartWrapper title="KPI đang đảm nhiệm" icon={<Target size={20} className="text-[var(--color-primary)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}
          extraHeaderContent={
            <>
              <span className="text-caption">{kpiPage?.totalElements ?? 0} KPI</span>
              <ViewToggleButtons view={detailView} onChange={setDetailView} />
            </>
          }>
          {detailView === 'chart' ? renderBulletBody() : renderDetailBody()}
        </ChartWrapper>
      )
      case 'SUBMISSION_STATUS': return (
        <ChartWrapper title="Trạng thái bài nộp" icon={<PieChartIcon size={20} className="text-[var(--color-primary)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          {submissionsPieData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <PieChart>
                <Pie data={submissionsPieData} innerRadius="50%" outerRadius="78%" paddingAngle={5} dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {submissionsPieData.map((_, i) => <Cell key={i} fill={seriesColor(i)} />)}
                </Pie>
                <Tooltip content={<SeriesTooltip unit="bài" />} />
                <Legend verticalAlign="bottom" height={32} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartWrapper>
      )
      case 'KPI_STATUS_DIST': return (
        <ChartWrapper title="Phân bổ trạng thái KPI" icon={<BarChartIcon size={20} className="text-[var(--color-primary)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          {kpiStatusDistData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <BarChart data={kpiStatusDistData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis label={yAxisLabel('S\u1ed1 KPI')} fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} width={48} />
                <Tooltip content={<SeriesTooltip />} />
                <Bar dataKey="value" name="Số KPI" radius={[6, 6, 0, 0]}>
                  {kpiStatusDistData.map((_, i) => <Cell key={i} fill={seriesColor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartWrapper>
      )
      case 'EVAL_HISTORY': return (
        <ChartWrapper
          title="Lịch sử & xu hướng điểm đánh giá"
          icon={<Activity size={20} className="text-[var(--color-primary)]" />}
          widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}
          extraHeaderContent={<ViewToggleButtons view={evalView} onChange={setEvalView} />}
        >
          {/* Bảng lịch sử và đường xu hướng trước đây là hai khối cạnh nhau đọc CÙNG một mảng
              evaluationHistory — nay là hai cách xem của một widget. */}
          {evalView === 'table'
            ? <EvaluationTableWidget data={analyticsData?.evaluationHistory ?? []} title="Lịch sử đánh giá" bare />
            : evalTrendData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                <AreaChart data={evalTrendData}>
                  <defs>
                    <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis label={yAxisLabel('\u0110i\u1ec3m')} fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} width={48} />
                  <Tooltip content={<SeriesTooltip />} />
                  <Area type="monotone" dataKey="value" name="Điểm" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#evalGrad)" dot={{ r: 4, fill: '#6366f1' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
        </ChartWrapper>
      )
      case 'MY_SCORE_HISTOGRAM': return (
        <ScoreHistogramWidget
          filter={{ periodId, periodIdTo, from, to }}
          widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}
        />
      )
      default: return null
    }
  }

  if (isMetricsLoading || isChartLoading)
    return <AnalyticsTabSkeleton variant="default" className="p-6" />

  // ── Old chart data preparation ───────────────────────────────────────────
  const submissionsPieData = [
    { name: 'Đã duyệt', value: analyticsData?.approvedSubmissions ?? 0 },
    { name: 'Chờ duyệt', value: analyticsData?.pendingSubmissions ?? 0 },
    { name: 'Từ chối',   value: analyticsData?.rejectedSubmissions ?? 0 },
  ].filter(v => v.value > 0)

  const kpiStatusDistData = (() => {
    const dist: Record<string, number> = {}
    for (const k of analyticsData?.kpiItems ?? []) {
      dist[k.status] = (dist[k.status] ?? 0) + 1
    }
    return Object.entries(dist).map(([name, value]) => ({ name, value }))
  })()

  // Xu hướng điểm số theo từng đợt (backend đã gom 1 dòng/đợt, sắp tăng dần theo đợt).
  const evalTrendData = (analyticsData?.evaluationHistory ?? [])
    .map(e => ({
      name: e.kpiName,
      value: e.score ?? 0,
    }))

  return (
    <div className="space-y-4">
      <AnalyticsTabHeader
        title="KPI của tôi"
        description="Tiến độ, hiệu suất và danh sách chỉ tiêu của bạn; bộ lọc thời gian áp cho mọi biểu đồ bên dưới."
        actions={<DashboardEditToolbar api={dash} />}
        filters={<>{controls}</>}
      />

      {/* ── New Metric Cards ────────────────────────────────────────────────── */}
      <div id="tour-analytics-metrics" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Tổng KPI" value={(metrics?.runningKpis ?? 0) + (metrics?.completedKpis ?? 0)} icon={<Target />} color="indigo" />
        <StatCard label="Tiến độ TB" value={`${metrics?.averageProgress?.toFixed(1) ?? 0}%`} icon={<TrendingUp />} color="indigo" />
        <StatCard label="Hiệu suất TB (đánh giá)" value={perf.format(metrics?.averagePerformance ?? 0)} icon={<Target />} color="emerald" />
        <StatCard
          label="Trạng thái KPI"
          value={<p className="text-stat truncate">{metrics?.runningKpis ?? 0} <span className="text-sm font-normal text-[var(--color-muted-foreground)]">đang chạy</span></p>}
          sub={<span className="text-[var(--color-success)]">{metrics?.completedKpis ?? 0} hoàn thành</span>}
          icon={<CheckCircle />}
          color="amber"
        />
        <StatCard label="Rủi ro / chậm" value={metrics?.riskKpis ?? 0} icon={<AlertTriangle />} color="red" highlight={(metrics?.riskKpis ?? 0) > 0} />
      </div>

      {/* Lưới widget tuỳ chỉnh: Xu hướng + Bảng chi tiết */}
      <div id="tour-analytics-widgets">
        <DashboardCustomizeChrome api={dash} renderWidget={renderWidget} catalog={CATALOG} />
      </div>

      {selectedKpiId && (
        <MyKpiDrawer
          kpiId={selectedKpiId}
          onClose={() => setSelectedKpiId(null)}
          globalFrom={from}
          globalTo={to}
          globalPeriodId={periodId}
          globalPeriodIdTo={periodIdTo}
        />
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function MobileKpiCard({ kpi, onOpenDrawer }: { kpi: any; onOpenDrawer: () => void }) {
  const pct = Math.round(kpi.progress || 0)
  const fmt = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '—'

  return (
    <div className="p-4 space-y-3 active:bg-[var(--color-muted)]" onClick={onOpenDrawer}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm text-[var(--color-foreground)] truncate min-w-0">{kpi.kpiName}</p>
        {kpi.shared ? (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-medium shrink-0">
            <Users size={10} /> Chung
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)] text-xs font-medium shrink-0">
            <User size={10} /> Riêng
          </div>
        )}
      </div>

      <p className="text-caption">{fmt(kpi.periodStart)} — {fmt(kpi.periodEnd)}</p>

      <div className="flex items-center gap-4 pt-1 border-t border-[var(--color-border)]">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-caption">Tiến độ</span>
            <span className="text-xs font-semibold">{pct}%</span>
          </div>
          <div className="h-2 bg-[var(--color-muted)] rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ExpandableKpiRow({ kpi, onOpenDrawer, onSelectKpi }: { kpi: any; onOpenDrawer: () => void; onSelectKpi?: (id: string) => void }) {
  const hasChildren = !!(kpi.children && kpi.children.length > 0)
  const [expanded, setExpanded] = useState(hasChildren) // KPI cha/thác nước mặc định mở sẵn KPI con
  // KPI thưởng: backend trả tiến độ/hiệu suất = null (không tính), hiển thị gạch ngang.
  const isQual = kpi.kpiType === 'QUALITATIVE'
  const isBonus = !isQual && kpi.progress == null
  const pct  = Math.round(kpi.progress    || 0)

  return (
    <>
      <tr className="hover:bg-[var(--color-muted)] transition-colors">
        <td className="px-6 py-4">
          <Button variant="ghost" size="icon-sm" aria-expanded={expanded} aria-label={expanded ? 'Thu gọn' : 'Mở rộng'} onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
          </Button>
        </td>
        <td className="px-6 py-4 cursor-pointer" onClick={onOpenDrawer}>
          <div className="font-medium text-sm text-[var(--color-foreground)] hover:text-[var(--color-primary)] transition-colors truncate max-w-[240px]">{kpi.kpiName}</div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <KpiTypeTags
              isReverseKpi={kpi.isReverseKpi}
              isBonusKpi={kpi.isBonusKpi}
              isQualitative={isQual}
              parentRelationType={kpi.parentRelationType}
              childRelationType={kpi.childRelationType}
            />
            <KpiWeightPill weight={kpi.weight} />
          </div>
        </td>
        <td className="px-6 py-4">
          <KpiPeriodCell periodName={kpi.periodName} start={kpi.periodStart} end={kpi.periodEnd} />
        </td>
        <td className="px-6 py-4">
          {isQual ? (
            <div className="flex flex-col gap-1">
              <span className="text-eyebrow">Mức đánh giá</span>
              <QualitativeResultChip level={kpi.qualitativeLevelName} />
            </div>
          ) : isBonus ? (
            <div className="flex flex-col gap-1">
              <span className="inline-flex w-fit items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] text-xs font-semibold">
                Thưởng
              </span>
              <div className="text-caption">
                {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[var(--color-muted)] rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold">{pct}%</span>
              </div>
              <div className="text-caption mt-1">
                {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </>
          )}
        </td>
        <td className="px-6 py-4">
          {kpi.shared ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-medium">
              <Users size={12} /> Chung ({kpi.participantCount})
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)] text-xs font-medium">
              <User size={12} /> Riêng
            </div>
          )}
        </td>
      </tr>
      {expanded && hasChildren && (
        <KpiChildTableRows
          nodes={toChildNodes(kpi.children)}
          onSelect={onSelectKpi}
          headingColSpan={5}
          variant={{ leadingChevronCol: true, showPersonColumn: false, trailingEmptyCols: 1, accent: 'violet', baseIndent: 28 }}
        />
      )}
      {expanded && (!hasChildren || (kpi.mySubmissions?.length ?? 0) > 0 || kpi.shared) && (
        <tr>
          <td colSpan={5} className="p-0 border-b border-[var(--color-border)]">
            <div className="bg-[var(--color-muted)] p-6 flex flex-col gap-6 border-l-4 border-[var(--color-primary)]">
              <div className="w-full space-y-4">
                <h4 className="text-eyebrow">Lịch sử bài nộp của tôi</h4>
                {kpi.mySubmissions && kpi.mySubmissions.length > 0 ? (
                  <div className="space-y-3">
                    {kpi.mySubmissions.map((sub: any) => (
                      <div key={sub.id} className="bg-[var(--color-card)] p-4 rounded-card shadow-sm border border-[var(--color-border)] flex items-center justify-between gap-4">
                        <div className="w-[120px]">
                          <p className="text-sm font-medium">{sub.code}</p>
                        </div>
                        <div className="w-[150px]">
                          <p className="text-eyebrow mb-1">Thời gian nộp</p>
                          <p className="text-xs font-medium text-[var(--color-foreground)]">
                            {new Date(sub.submitDate).toLocaleString('vi-VN', {
                              hour: '2-digit', minute: '2-digit',
                              day: '2-digit', month: '2-digit', year: 'numeric',
                            })}
                          </p>
                        </div>
                        {isQual ? (
                          <div className="flex-1 max-w-[200px]">
                            <p className="text-eyebrow mb-1">Mức đánh giá</p>
                            <QualitativeResultChip level={sub.qualitativeLevelName} />
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 max-w-[200px]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-caption">Đóng góp</span>
                                <span className="text-xs font-semibold">{sub.contributionProgress?.toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 bg-[var(--color-muted)] rounded-full">
                                <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: `${Math.min(sub.contributionProgress, 100)}%` }} />
                              </div>
                              <p className="text-xs font-medium text-[var(--color-primary)] mt-1">+{sub.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                            </div>
                            <div className="text-center w-[100px]">
                              <p className="text-caption">Hiệu suất</p>
                              <p className="text-sm font-semibold text-[var(--color-primary)]">{sub.performance?.toFixed(1)}%</p>
                            </div>
                          </>
                        )}
                        <div>
                          <span className={cn(
                            'px-2 py-1 rounded-control text-xs font-medium',
                            sub.status === 'APPROVED' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' :
                            sub.status === 'REJECTED' ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]' : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                          )}>
                            {sub.status === 'APPROVED' ? 'ĐÃ DUYỆT' : sub.status === 'REJECTED' ? 'TỪ CHỐI' : 'CHỜ DUYỆT'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--color-subtle-foreground)]">Chưa có bài nộp nào.</div>
                )}
              </div>

              {kpi.shared && kpi.teammates?.length > 0 && kpi.childRelationType !== 'DECOMPOSITION' && (
                <div className="w-full space-y-4 pt-6 border-t border-[var(--color-border)]">
                  <h4 className="text-eyebrow">Đồng đội cùng thực hiện</h4>
                  <div className="space-y-3">
                    {kpi.teammates.map((tm: any) => (
                      <div key={tm.userId} className="bg-[var(--color-card)] p-4 rounded-card shadow-sm border border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-[250px]">
                          {tm.avatarUrl
                            ? <img src={tm.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                            : <div className="w-10 h-10 rounded-full bg-[var(--color-border)] flex items-center justify-center text-sm font-medium">{tm.fullName.charAt(0)}</div>
                          }
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{tm.fullName}</p>
                            <p className="text-caption">{tm.employeeCode}</p>
                          </div>
                        </div>
                        {isQual ? (
                          <div className="flex-1 max-w-[250px]">
                            <p className="text-eyebrow mb-1">Mức đánh giá</p>
                            <QualitativeResultChip level={tm.qualitativeLevelName} />
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 max-w-[250px]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-caption">Tiến độ cá nhân</span>
                                <span className="text-xs font-semibold">{tm.progress?.toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 bg-[var(--color-muted)] rounded-full">
                                <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: `${Math.min(tm.progress, 100)}%` }} />
                              </div>
                            </div>
                            <div className="text-center sm:text-right w-[100px]">
                              <p className="text-caption">Hiệu suất</p>
                              <p className="text-sm font-semibold text-[var(--color-primary)]">{tm.performance?.toFixed(1)}%</p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function EmptyChart() {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center text-[var(--color-subtle-foreground)] gap-2">
      <Info size={24} className="opacity-20" />
      <span className="text-eyebrow">Chưa có dữ liệu</span>
    </div>
  )
}


/** `bare` = bỏ vỏ card riêng vì đã nằm trong ChartWrapper của lưới widget. */
function EvaluationTableWidget({ data, title, bare }: { data: any[]; title: string; bare?: boolean }) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5

  const filteredData = useMemo(() => {
    let result = [...data]
    if (filter) {
      result = result.filter(item =>
        item.kpiName.toLowerCase().includes(filter.toLowerCase()) ||
        item.evaluatorName.toLowerCase().includes(filter.toLowerCase())
      )
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? ''
        const bVal = b[sortConfig.key] ?? ''
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return result
  }, [data, filter, sortConfig])

  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev?.key === key && prev.direction === 'asc'
        ? { key, direction: 'desc' }
        : { key, direction: 'asc' }
    )
  }

  return (
    <div className={cn(
      'overflow-hidden flex flex-col',
      bare
        ? 'flex-1 min-h-0'
        : 'bg-[var(--color-card)] rounded-card border border-[var(--color-border)] shadow-sm',
    )}>
      <div className={cn(
        'flex items-center justify-between gap-4',
        bare ? 'pb-3' : 'p-5 border-b border-[var(--color-border)]',
      )}>
        {!bare && (
          <h3 className="text-section-title flex items-center gap-2 shrink-0">
            <Star size={16} className="text-[var(--color-warning)]" /> {title}
          </h3>
        )}
        <div className="relative max-w-[200px] w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--color-muted)] border-none rounded-control text-xs outline-none focus:ring-2 focus:ring-[var(--color-ring)] transition-all"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[var(--color-muted)] z-10">
            <tr className="text-eyebrow">
              <th className="px-5 py-3">
                <SortHeader field="score" active={sortConfig?.key ?? null} dir={sortConfig?.direction ?? 'asc'} onToggle={handleSort} iconSize={10}>Điểm</SortHeader>
              </th>
              <th className="px-3 py-3">
                <SortHeader field="kpiName" active={sortConfig?.key ?? null} dir={sortConfig?.direction ?? 'asc'} onToggle={handleSort} iconSize={10}>Đợt</SortHeader>
              </th>
              <th className="px-3 py-3">
                <SortHeader field="evaluatorName" active={sortConfig?.key ?? null} dir={sortConfig?.direction ?? 'asc'} onToggle={handleSort} iconSize={10}>Người đánh giá</SortHeader>
              </th>
              <th className="px-3 py-3 text-right">
                <SortHeader field="createdAt" active={sortConfig?.key ?? null} dir={sortConfig?.direction ?? 'asc'} onToggle={handleSort} iconSize={10} className="justify-end w-full">Ngày đánh giá</SortHeader>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-sm text-[var(--color-subtle-foreground)]">Không có dữ liệu</td>
              </tr>
            )}
            {paginatedData.map(e => (
              <tr key={e.id} className="hover:bg-[var(--color-muted)] transition-colors">
                <td className="px-5 py-3">
                  <div className={cn('w-10 h-10 rounded-card flex items-center justify-center text-sm font-semibold shadow-sm',
                    (e.score ?? 0) >= 80 ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' :
                    (e.score ?? 0) >= 50 ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' : 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
                  )}>{e.score?.toFixed(1) ?? '—'}</div>
                </td>
                <td className="px-3 py-3">
                  <p className="text-sm font-medium text-[var(--color-foreground)] truncate max-w-[180px]">{e.kpiName}</p>
                </td>
                <td className="px-3 py-3 text-sm text-[var(--color-muted-foreground)] font-medium">{e.evaluatorName}</td>
                <td className="px-3 py-3 text-right text-caption font-medium">
                  {new Date(e.createdAt).toLocaleDateString('vi-VN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between bg-[var(--color-muted)]">
          <span className="text-caption tabular-nums">Trang {page} / {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-control hover:bg-[var(--color-card)] disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-[var(--color-border)]">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-control hover:bg-[var(--color-card)] disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-[var(--color-border)]">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
