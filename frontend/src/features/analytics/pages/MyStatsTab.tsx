import { useState, useMemo, useCallback } from 'react'
import { yAxisLabel } from '@/components/charts/axisLabel'
import { SeriesTooltip } from '@/components/charts/ChartTooltip'
import { personalKpiApi } from '@/features/dashboard/api/personalKpiApi'
import { useMyAnalytics } from '../hooks/useAnalytics'
import { useQuery } from '@tanstack/react-query'
import {
  Target, TrendingUp,
  ChevronDown, ChevronRight,
  User, Users, Star, Search, ChevronLeft,
  Activity, PieChart as PieChartIcon, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KpiTypeTags } from '../components/KpiTypeTags'
import { QualitativeResultChip } from '../components/QualitativeResultChip'
import { toChildNodes } from '../components/KpiChildList'
import { KpiChildTableRows } from '../components/KpiChildTableRows'
import { KpiPeriodCell } from '../components/KpiPeriodCell'
import { KpiWeightPill } from '../components/KpiWeightPill'
import {
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { seriesColor } from '@/components/charts/chartPalette'
import BulletChart from '@/components/charts/primitives/BulletChart'
import { useChartTableView } from '@/components/common/dashboard/useChartTableView'
import { ScoreHistogramWidget } from '../components/advanced/SummaryAdvanced'

import AnalyticsComboChart from '../components/AnalyticsComboChart'
import { SparseTableFiller } from '../components/SparseTableFiller'
import MyKpiDrawer from '../components/MyKpiDrawer'
import AnalyticsTabSkeleton, { TableLoadingRows } from '@/components/common/AnalyticsTabSkeleton'
import Pagination from '@/components/common/Pagination'
import { SortHeader } from '@/components/common/SortHeader'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import {
  useAnalyticsGrid, useAnalyticsScopeData, usePositionLayout, widgetFilter, widgetVariant, tableViewControl, optionOf,
  PAGE_DEFAULT_INTENT,
} from '../grid/analyticsGrid'
import { usePinToHome } from '../grid/usePinToHome'
import WidgetConfigPanel from '../grid/WidgetConfigPanel'
import WidgetConfigSummary from '../grid/WidgetConfigSummary'
import { MyKpiMetrics } from '../components/pinned/metricWidgets'
import type { ViewerPosition } from '@/features/dashboard/hooks/useViewerPosition'

import { format } from 'date-fns'


type SortField = 'progress' | 'period'
type SortDir = 'asc' | 'desc'
type SharedFilter = 'ALL' | 'SHARED' | 'PERSONAL'

const PAGE_SIZE = 5

// Chế độ biểu đồ lấy trọn danh sách thay vì phân trang. Trần này chỉ để chặn trường hợp bất
// thường; chạm trần thì biểu đồ báo rõ chứ không cắt cụt im lặng.
const CHART_FETCH_SIZE = 200

/** Tên "report ẩn" của kho cũ — chỉ còn dùng để vớt bố cục một lần. */
const LEGACY_REPORT_NAME = '__MY_KPI_DASHBOARD_CONFIG__'
const DEFAULT_WIDGETS: DashboardWidget[] = [
  // Hàng thẻ chỉ số từng nằm NGOÀI lưới, bám nút khoảng thời gian trên đầu trang. Nút đó nay nằm
  // trong bảng cấu hình từng ô, nên hàng thẻ cũng là một ô — cùng id với danh mục trang chủ.
  { i: 'mykpi-metrics', type: 'STATS', title: 'Số liệu tổng hợp', x: 0, y: 0, w: 12, h: 4, visible: true },
  { i: 'mykpi-trend', type: 'MYKPI_TREND', title: 'Xu hướng KPI theo thời gian', x: 0, y: 4, w: 12, h: 15, visible: true },
  { i: 'mykpi-detail', type: 'MYKPI_DETAIL', title: 'KPI đang đảm nhiệm', x: 0, y: 19, w: 12, h: 18, visible: true },
  // Các khối dưới đây trước nằm NGOÀI lưới nên không ẩn/hiện/kéo-thả/ghim được, trong khi hai
  // widget trên thì được: cùng một trang mà hai cách hành xử. Nay đưa hết vào lưới.
  { i: 'mykpi-submission-status', type: 'SUBMISSION_STATUS', title: 'Trạng thái bài nộp', x: 0, y: 37, w: 6, h: 10, visible: true },
  { i: 'mykpi-eval-history', type: 'EVAL_HISTORY', title: 'Lịch sử & xu hướng điểm đánh giá', x: 6, y: 37, w: 6, h: 10, visible: true },
  { i: 'mykpi-histogram', type: 'MY_SCORE_HISTOGRAM', title: 'Phân phối điểm đánh giá', x: 0, y: 47, w: 12, h: 12, visible: false },
]

/**
 * Ô nào hiện mặc định cho ai. Nhân viên là người nộp báo cáo nên cần trạng thái bài nộp; quản lý
 * mà cũng nhận KPI thì chỉ cần danh sách và điểm được chấm. Xu hướng và phân phối để trong thư viện.
 */
const POSITION_LAYOUT: Record<ViewerPosition, readonly string[]> = {
  DIRECTOR: ['mykpi-metrics', 'mykpi-detail', 'mykpi-eval-history'],
  HEAD: ['mykpi-metrics', 'mykpi-detail', 'mykpi-eval-history'],
  DEPUTY: ['mykpi-metrics', 'mykpi-detail', 'mykpi-eval-history'],
  STAFF: ['mykpi-metrics', 'mykpi-detail', 'mykpi-submission-status', 'mykpi-eval-history'],
}
const GROUP_OF: Record<string, string> = {
  'mykpi-metrics': 'Số liệu',
  'mykpi-trend': 'Biểu đồ xu hướng',
  'mykpi-eval-history': 'Biểu đồ xu hướng',
  'mykpi-detail': 'Biểu đồ so sánh',
  'mykpi-histogram': 'Biểu đồ phân phối',
  'mykpi-submission-status': 'Từ bộ phận đến tổng thể',
}
const PREVIEW_OF: Record<string, 'line' | 'area' | 'bullet' | 'bar' | 'histogram' | 'donut' | 'metricCard'> = {
  'mykpi-metrics': 'metricCard',
  'mykpi-trend': 'line',
  'mykpi-eval-history': 'area',
  'mykpi-detail': 'bullet',
  'mykpi-histogram': 'histogram',
  'mykpi-submission-status': 'donut',
}
const DESC_OF: Record<string, string> = {
  'mykpi-metrics': 'Tổng KPI, tiến độ, hiệu suất, số đang chạy/hoàn thành và số rủi ro.',
  'mykpi-trend': 'Số KPI bạn đảm nhiệm và hiệu suất qua từng mốc thời gian.',
  'mykpi-detail': 'Toàn bộ KPI bạn đang đảm nhiệm, tiến độ và phân loại từng chỉ tiêu.',
  'mykpi-submission-status': 'Tỷ trọng bài nộp đã duyệt, chờ duyệt và bị từ chối.',
  'mykpi-eval-history': 'Phiếu đánh giá bạn đã nhận và điểm qua từng đợt.',
  'mykpi-histogram': 'Vị trí của bạn trong phân phối điểm toàn tổ chức.',
}
const CATALOG = DEFAULT_WIDGETS.map(t => ({
  template: t,
  icon: null,
  groupLabel: GROUP_OF[t.i],
  preview: PREVIEW_OF[t.i],
  description: DESC_OF[t.i],
}))

export default function MyStatsTab() {
  const onlyApproved = false
  const { periods, cycles } = useAnalyticsScopeData()
  // Không còn bộ lọc cấp trang: khoảng thời gian nằm trong cài đặt từng ô; "mặc định" chỉ còn là
  // hằng số cho ô chưa đặt gì.
  const pageIntent = PAGE_DEFAULT_INTENT
  const pin = usePinToHome()
  const grid = usePositionLayout(DEFAULT_WIDGETS, POSITION_LAYOUT, 'STAFF')
  const dash = useAnalyticsGrid({
    scope: 'ANALYTICS_MY_KPI',
    defaultWidgets: grid.defaultWidgets,
    legacyReportName: LEGACY_REPORT_NAME,
  })
  /** Khoảng của một ô cụ thể: riêng nếu đã đặt, không thì theo mặc định. */
  const filterOf = (i: string) => widgetFilter(dash.widgets.find(w => w.i === i), pageIntent, periods, cycles)
  const trendF = filterOf('mykpi-trend')
  const detailF = filterOf('mykpi-detail')

  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)
  const { view: detailView } = useChartTableView('mykpi-detail', 'chart',
    tableViewControl(dash.widgets.find(w => w.i === 'mykpi-detail'), dash.updateWidgetSettings))
  const { view: evalView } = useChartTableView('mykpi-eval-history', 'chart',
    tableViewControl(dash.widgets.find(w => w.i === 'mykpi-eval-history'), dash.updateWidgetSettings))

  // Lọc chung/riêng nằm trong cài đặt ô (chọn ở bảng cấu hình), không còn là dải nút trong thân bảng.
  const filterShared = (optionOf(dash.widgets.find(w => w.i === 'mykpi-detail'), 'shared') ?? 'ALL') as SharedFilter
  const [sortField, setSortField] = useState<SortField | null>('period') // ưu tiên đợt/ngày gần nhất
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  // Đổi bộ lọc thì về trang đầu. Trước đây nút lọc tự gọi setPage(0); nay lọc đến từ cài đặt ô nên
  // trang được nhớ KÈM khoá lọc lúc đặt — khoá khác là coi như trang 0, không cần effect.
  const [pageAt, setPageAt] = useState({ key: filterShared, page: 0 })
  const page = pageAt.key === filterShared ? pageAt.page : 0
  const setPage = useCallback((p: number) => setPageAt({ key: filterShared, page: p }), [filterShared])

  // ── New KPI analytics (standalone KPIs without KeyResult) ────────────────
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['personalKpi', 'chart', trendF.from, trendF.to, onlyApproved, trendF.periodId, trendF.periodIdTo, trendF.groupBy],
    queryFn: () => personalKpiApi.getComboChart({ from: trendF.from, to: trendF.to, onlyApproved, periodId: trendF.periodId, periodIdTo: trendF.periodIdTo, groupBy: trendF.groupBy }),
  })
  // Chế độ biểu đồ lấy TRỌN danh sách, chế độ bảng phân trang như cũ. Phân trang là affordance của
  // bảng: một biểu đồ hiện "5 trong 107 KPI, trang 1/22" thì mỗi trang là một mảnh vụn tuỳ tiện,
  // không so được với nhau và cũng không nói lên tổng thể.
  const chartMode = detailView === 'chart'
  const effectivePage = chartMode ? 0 : page
  const effectiveSize = chartMode ? CHART_FETCH_SIZE : PAGE_SIZE

  const { data: kpiPage, isLoading: isKpisLoading } = useQuery({
    queryKey: ['personalKpi', 'details', detailF.from, detailF.to, onlyApproved, detailF.periodId, detailF.periodIdTo, sortField, sortDir, filterShared, effectivePage, effectiveSize],
    queryFn: () => personalKpiApi.getDetailedKpis({
      from: detailF.from, to: detailF.to, onlyApproved, periodId: detailF.periodId, periodIdTo: detailF.periodIdTo,
      sortBy: sortField ?? undefined,
      sortDir,
      sharedType: filterShared === 'ALL' ? undefined : filterShared,
      page: effectivePage,
      size: effectiveSize,
    }),
  })

  // ── Old analytics data ───────────────────────────────────────────────────
  // Hai ô cùng đọc một endpoint nhưng mỗi ô một khoảng riêng. Trước đây cả hai bám khoảng cấp trang
  // nên đặt khoảng riêng cho ô không có tác dụng. Cùng khoá thì React Query gộp, không tốn thêm.
  const subF = filterOf('mykpi-submission-status')
  const evalF = filterOf('mykpi-eval-history')
  const { data: subData } = useMyAnalytics(subF.from, subF.to, subF.periodId, subF.periodIdTo)
  const { data: evalData } = useMyAnalytics(evalF.from, evalF.to, evalF.periodId, evalF.periodIdTo)

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setPage(0)
  }, [sortField, setPage])

  // ── Old chart data preparation ───────────────────────────────────────────
  const submissionsPieData = useMemo(() => [
    { name: 'Đã duyệt', value: subData?.approvedSubmissions ?? 0 },
    { name: 'Chờ duyệt', value: subData?.pendingSubmissions ?? 0 },
    { name: 'Từ chối',   value: subData?.rejectedSubmissions ?? 0 },
  ].filter(v => v.value > 0), [subData])

  // Xu hướng điểm số theo từng đợt (backend đã gom 1 dòng/đợt, sắp tăng dần theo đợt).
  const evalTrendData = useMemo(() => (evalData?.evaluationHistory ?? [])
    .map(e => ({
      name: e.kpiName,
      value: e.score ?? 0,
    })), [evalData])



  const renderDetailBody = useCallback(() => (
    <div className="flex-1 flex flex-col min-h-0 -mx-6 -mb-6">
      <div className="flex-1 overflow-auto custom-scrollbar min-h-0 flex flex-col">
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-[var(--color-muted)]">
              <tr className="text-xs font-medium text-slate-500">
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
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {isKpisLoading ? (
            <div className="p-6 text-sm text-slate-400">Đang tải...</div>
          ) : kpiPage?.content?.length ? (
            kpiPage.content.map(kpi => (
              <MobileKpiCard key={kpi.kpiId} kpi={kpi} onOpenDrawer={() => setSelectedKpiId(kpi.kpiId)} />
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">Không có dữ liệu</div>
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
  ), [isKpisLoading, kpiPage, page, sortDir, sortField, toggleSort, setPage])

  // Trục là % đạt so với mục tiêu chứ không phải giá trị thô: các KPI ở đây đo bằng những đơn vị
  // khác nhau (triệu đồng, số vụ, %), vẽ giá trị thô thì cái đo bằng triệu sẽ nuốt hết phần còn lại.
  // KPI định tính không có mục tiêu số nên tách riêng, không nhét vào thanh.
  const renderBulletBody = useCallback(() => {
    const rows = (kpiPage?.content ?? []).filter(k => k.kpiType !== 'QUALITATIVE' && k.targetValue > 0)
    const qualitativeCount = (kpiPage?.content ?? []).length - rows.length
    return (
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {isKpisLoading ? (
          <div className="py-16 text-center text-slate-400 font-medium">Đang tải...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-medium italic">Không có KPI định lượng nào trong kỳ này</div>
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
          <p className="text-xs text-slate-400 font-medium text-center">
            {qualitativeCount} KPI định tính không hiện ở đây. Xem trong chế độ bảng.
          </p>
        )}
        {(kpiPage?.totalElements ?? 0) > CHART_FETCH_SIZE && (
          <p className="text-xs text-amber-600 font-semibold text-center">
            Có {kpiPage?.totalElements} KPI, biểu đồ chỉ vẽ {CHART_FETCH_SIZE} mục đầu. Xem đủ ở chế độ bảng.
          </p>
        )}
      </div>
    )
  }, [isKpisLoading, kpiPage])

  /*
    `useCallback` là bắt buộc chứ không phải tối ưu tuỳ hứng: lưới cache phần tử từng ô theo định
    danh hàm này. Hàm mới mỗi render là mọi biểu đồ vẽ lại mỗi lần tab render — kể cả khi chỉ
    dòng "Đang lưu…" đổi chữ.
  */
  const { updateWidgetSettings } = dash
  const renderWidget = useCallback((w: DashboardWidget, ctx: { openConfig: () => void }) => {
    // Dòng tóm tắt "ô này đang theo cấu hình gì" — bấm vào là mở đúng bảng cấu hình của ô.
    const meta = (
      <WidgetConfigSummary widget={w} pageIntent={pageIntent} periods={periods} cycles={cycles} onOpen={ctx.openConfig} />
    )
    const f = widgetFilter(w, pageIntent, periods, cycles)
    switch (w.type) {
      case 'STATS': return (
        // Chromeless: mỗi thẻ đã là một card. Chip ở trên cho biết hàng số này đang theo khoảng nào.
        <div id="tour-analytics-metrics" className="h-full flex flex-col gap-2 min-h-0">
          {meta}
          <MyKpiMetrics filter={{ from: f.from, to: f.to, periodId: f.periodId, periodIdTo: f.periodIdTo, onlyApproved }} />
        </div>
      )
      case 'MYKPI_TREND': return (
        <ChartWrapper chromeless title="Xu hướng KPI theo thời gian" icon={<TrendingUp size={20} className="text-slate-400" />}>
          <AnalyticsComboChart
            data={chartData?.points || []}
            isLoading={isChartLoading}
            itemName="KPI đảm nhiệm"
            fillHeight
            mode={widgetVariant(w) === 'area' ? 'share' : 'trend'}
            onModeChange={m => updateWidgetSettings(w.i, { v: m === 'share' ? 'area' : 'line' })}
            hideModeToggle
            meta={meta}
          />
        </ChartWrapper>
      )
      case 'MYKPI_DETAIL': return (
        <ChartWrapper title="KPI đang đảm nhiệm" icon={<Target size={20} className="text-slate-400" />}
          meta={meta}
          extraHeaderContent={<span className="text-xs font-medium text-slate-400">{kpiPage?.totalElements ?? 0} KPI</span>}>
          {detailView === 'chart' ? renderBulletBody() : renderDetailBody()}
        </ChartWrapper>
      )
      case 'SUBMISSION_STATUS': return (
        <ChartWrapper title="Trạng thái bài nộp" icon={<PieChartIcon size={20} className="text-slate-400" />} meta={meta}>
          {submissionsPieData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <PieChart>
                <Pie isAnimationActive={false} data={submissionsPieData} innerRadius="50%" outerRadius="78%" paddingAngle={5} dataKey="value"
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
      case 'EVAL_HISTORY': return (
        <ChartWrapper
          title="Lịch sử & xu hướng điểm đánh giá"
          icon={<Activity size={20} className="text-slate-400" />}
          meta={meta}
        >
          {/* Bảng lịch sử và đường xu hướng trước đây là hai khối cạnh nhau đọc CÙNG một mảng
              evaluationHistory — nay là hai cách xem của một widget. */}
          {evalView === 'table'
            ? <EvaluationTableWidget data={evalData?.evaluationHistory ?? []} title="Lịch sử đánh giá" bare />
            : evalTrendData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                <AreaChart data={evalTrendData}>
                  <defs>
                    <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis label={yAxisLabel('\u0110i\u1ec3m')} fontSize={11} axisLine={false} tickLine={false} domain={[0, 100]} width={48} />
                  <Tooltip content={<SeriesTooltip />} />
                  <Area isAnimationActive={false} type="monotone" dataKey="value" name="Điểm" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#evalGrad)" dot={{ r: 4, fill: '#6366f1' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
        </ChartWrapper>
      )
      case 'MY_SCORE_HISTOGRAM': return (
        <ScoreHistogramWidget
          filter={{ periodId: f.periodId, periodIdTo: f.periodIdTo, from: f.from, to: f.to }}
          meta={meta}
        />
      )
      default: return null
    }
  }, [pageIntent, periods, cycles, onlyApproved, chartData, isChartLoading, updateWidgetSettings, kpiPage, detailView, renderBulletBody, renderDetailBody, submissionsPieData, evalView, evalData, evalTrendData])

  if (isChartLoading)
    return <AnalyticsTabSkeleton variant="default" className="p-6" />

  return (
    <div className="space-y-6">
      {/* Tiêu đề + nút Tuỳ chỉnh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Kết quả của tôi</h2>
        <div id="tour-analytics-customize" className="flex items-center gap-3 flex-wrap">
          <DashboardEditToolbar api={dash} />
        </div>
      </div>

      {/* Hàng thẻ chỉ số nay là ô đầu lưới (mykpi-metrics), khoảng thời gian của nó nằm trong bảng
          cấu hình như mọi ô khác. */}

      {/* Lưới widget tuỳ chỉnh: Xu hướng + Bảng chi tiết */}
      <div id="tour-analytics-widgets">
        <DashboardCustomizeChrome
          api={dash}
          renderWidget={renderWidget}
          catalog={CATALOG}
          presets={grid.presets}
          recommendedIds={grid.recommendedIds}
          recommendedLabel={grid.recommendedLabel}
          onTogglePin={pin.enabled ? pin.toggle : undefined}
          isPinned={pin.isPinned}
          renderConfig={(w, update) => (
            <WidgetConfigPanel widget={w} update={update} pageIntent={pageIntent} periods={periods} cycles={cycles} />
          )}
        />
      </div>

      {selectedKpiId && (
        <MyKpiDrawer
          kpiId={selectedKpiId}
          onClose={() => setSelectedKpiId(null)}
          globalFrom={detailF.from}
          globalTo={detailF.to}
          globalPeriodId={detailF.periodId}
          globalPeriodIdTo={detailF.periodIdTo}
        />
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function MobileKpiCard({ kpi, onOpenDrawer }: { kpi: any; onOpenDrawer: () => void }) {
  const pct = Math.round(kpi.progress || 0)
  const fmt = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '-'

  return (
    <div className="p-4 space-y-3 active:bg-slate-50 dark:active:bg-slate-800/30" onClick={onOpenDrawer}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm text-[var(--color-foreground)] truncate min-w-0">{kpi.kpiName}</p>
        {kpi.shared ? (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-[var(--color-primary)] dark:text-indigo-400 text-xs font-semibold shrink-0">
            <Users size={10} /> Chung
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold shrink-0">
            <User size={10} /> Riêng
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">{fmt(kpi.periodStart)} - {fmt(kpi.periodEnd)}</p>

      <div className="flex items-center gap-4 pt-1 border-t border-[var(--color-border)]">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Tiến độ</span>
            <span className="text-xs font-semibold">{pct}%</span>
          </div>
          <div className="h-2 bg-[var(--color-muted)] rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${Math.min(pct, 100)}%` }} />
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
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        <td className="px-6 py-4">
          <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label={expanded ? 'Thu gọn' : 'Mở rộng'} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        </td>
        <td className="px-6 py-4 cursor-pointer" onClick={onOpenDrawer}>
          <div className="font-semibold text-sm text-slate-900 hover:text-[var(--color-primary)] dark:text-white dark:hover:text-indigo-400 transition-colors truncate max-w-[240px]">{kpi.kpiName}</div>
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
              <span className="text-xs text-slate-500 font-medium">Mức đánh giá</span>
              <QualitativeResultChip level={kpi.qualitativeLevelName} />
            </div>
          ) : isBonus ? (
            <div className="flex flex-col gap-1">
              <span className="inline-flex w-fit items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                Thưởng
              </span>
              <div className="text-xs text-slate-500">
                {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[var(--color-muted)] rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold">{pct}%</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </>
          )}
        </td>
        <td className="px-6 py-4">
          {kpi.shared ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-[var(--color-primary)] dark:text-indigo-400 text-xs font-semibold">
              <Users size={12} /> Chung ({kpi.participantCount})
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold">
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
            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 border-l-4 border-[var(--color-primary)]">
              <div className="w-full space-y-4">
                <h4 className="text-xs font-medium text-slate-500">Lịch sử bài nộp của tôi</h4>
                {kpi.mySubmissions && kpi.mySubmissions.length > 0 ? (
                  <div className="space-y-3">
                    {kpi.mySubmissions.map((sub: any) => (
                      <div key={sub.id} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-4">
                        <div className="w-[120px]">
                          <p className="text-sm font-semibold">{sub.code}</p>
                        </div>
                        <div className="w-[150px]">
                          <p className="text-xs text-slate-500 font-medium mb-1">Thời gian nộp</p>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {new Date(sub.submitDate).toLocaleString('vi-VN', {
                              hour: '2-digit', minute: '2-digit',
                              day: '2-digit', month: '2-digit', year: 'numeric',
                            })}
                          </p>
                        </div>
                        {isQual ? (
                          <div className="flex-1 max-w-[200px]">
                            <p className="text-xs text-slate-500 font-medium mb-1">Mức đánh giá</p>
                            <QualitativeResultChip level={sub.qualitativeLevelName} />
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 max-w-[200px]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-500">Đóng góp</span>
                                <span className="text-xs font-semibold">{sub.contributionProgress?.toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(sub.contributionProgress, 100)}%` }} />
                              </div>
                              <p className="text-xs font-semibold text-[var(--color-primary)] dark:text-indigo-400 mt-1">+{sub.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                            </div>
                            <div className="text-center w-[100px]">
                              <p className="text-xs text-slate-500">Hiệu suất</p>
                              <p className="text-sm font-semibold text-[var(--color-primary)]">{sub.performance?.toFixed(1)}%</p>
                            </div>
                          </>
                        )}
                        <div>
                          <span className={cn(
                            'px-2 py-1 rounded text-xs font-semibold',
                            sub.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                            sub.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          )}>
                            {sub.status === 'APPROVED' ? 'ĐÃ DUYỆT' : sub.status === 'REJECTED' ? 'TỪ CHỐI' : 'CHỜ DUYỆT'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Chưa có bài nộp nào.</div>
                )}
              </div>

              {kpi.shared && kpi.teammates?.length > 0 && kpi.childRelationType !== 'DECOMPOSITION' && (
                <div className="w-full space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-medium text-slate-500">Đồng đội cùng thực hiện</h4>
                  <div className="space-y-3">
                    {kpi.teammates.map((tm: any) => (
                      <div key={tm.userId} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-[250px]">
                          {tm.avatarUrl
                            ? <img src={tm.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                            : <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold">{tm.fullName.charAt(0)}</div>
                          }
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{tm.fullName}</p>
                            <p className="text-xs text-slate-500">{tm.employeeCode}</p>
                          </div>
                        </div>
                        {isQual ? (
                          <div className="flex-1 max-w-[250px]">
                            <p className="text-xs text-slate-500 font-medium mb-1">Mức đánh giá</p>
                            <QualitativeResultChip level={tm.qualitativeLevelName} />
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 max-w-[250px]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-500">Tiến độ cá nhân</span>
                                <span className="text-xs font-semibold">{tm.progress?.toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(tm.progress, 100)}%` }} />
                              </div>
                            </div>
                            <div className="text-center sm:text-right w-[100px]">
                              <p className="text-xs text-slate-500">Hiệu suất</p>
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
    <div className="h-[240px] flex flex-col items-center justify-center text-slate-400 gap-2">
      <Info size={24} className="opacity-20" />
      <span className="text-xs font-semibold">Chưa có dữ liệu</span>
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
        : 'bg-[var(--color-card)] rounded-widget border border-[var(--color-border)] shadow-sm',
    )}>
      <div className={cn(
        'flex items-center justify-between gap-4',
        bare ? 'pb-3' : 'p-5 border-b border-[var(--color-border)]',
      )}>
        {!bare && (
          <h3 className="font-semibold text-sm flex items-center gap-2 shrink-0">
            <Star size={16} className="text-amber-500" /> {title}
          </h3>
        )}
        <div className="relative max-w-[200px] w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--color-muted)] border-none rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[var(--color-muted)] z-10">
            <tr className="text-xs font-medium text-slate-400">
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
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-sm text-slate-400">Không có dữ liệu</td>
              </tr>
            )}
            {paginatedData.map(e => (
              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold shadow-sm',
                    (e.score ?? 0) >= 80 ? 'bg-emerald-100 text-emerald-700' :
                    (e.score ?? 0) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  )}>{e.score?.toFixed(1) ?? '-'}</div>
                </td>
                <td className="px-3 py-3">
                  <p className="text-sm font-semibold text-[var(--color-foreground)] truncate max-w-[180px]">{e.kpiName}</p>
                </td>
                <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-400 font-medium">{e.evaluatorName}</td>
                <td className="px-3 py-3 text-right text-xs text-slate-500 font-medium">
                  {new Date(e.createdAt).toLocaleDateString('vi-VN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <span className="text-xs font-medium text-slate-500">Trang {page} / {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-slate-200">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-slate-200">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
