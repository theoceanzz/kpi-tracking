import { useState, useMemo, useCallback } from 'react'
import { personalObjectiveApi } from '@/features/dashboard/api/personalObjectiveApi'
import { useQuery } from '@tanstack/react-query'
import DumbbellDotPlot from '@/components/charts/primitives/DumbbellDotPlot'
import { useChartTableView } from '@/components/common/dashboard/useChartTableView'
import {
  Target, TrendingUp,
  ChevronDown, ChevronRight,
  User, Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KpiTypeTags } from '../components/KpiTypeTags'
import { QualitativeResultChip } from '../components/QualitativeResultChip'
import { toChildNodes } from '../components/KpiChildList'
import { KpiChildTableRows } from '../components/KpiChildTableRows'
import { KpiPeriodCell } from '../components/KpiPeriodCell'
import { KpiWeightPill } from '../components/KpiWeightPill'

import MyObjectiveDrawer from '../components/MyObjectiveDrawer'
import AnalyticsComboChart from '../components/AnalyticsComboChart'
import { SparseTableFiller } from '../components/SparseTableFiller'
import AnalyticsTabSkeleton, { TableLoadingRows } from '@/components/common/AnalyticsTabSkeleton'
import Pagination from '@/components/common/Pagination'
import { SortHeader } from '@/components/common/SortHeader'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import {
  useAnalyticsGrid, useAnalyticsScopeData, usePositionLayout, widgetFilter, widgetVariant, tableViewControl, optionOf,
  PAGE_DEFAULT_INTENT,
  type OptionField,
} from '../grid/analyticsGrid'
import { usePinToHome } from '../grid/usePinToHome'
import WidgetConfigPanel from '../grid/WidgetConfigPanel'
import WidgetConfigSummary from '../grid/WidgetConfigSummary'
import { MyObjectiveMetrics } from '../components/pinned/metricWidgets'
import type { ViewerPosition } from '@/features/dashboard/hooks/useViewerPosition'

import { format } from 'date-fns'

type SortField = 'progress' | 'period'
type SortDir = 'asc' | 'desc'
type SharedFilter = 'ALL' | 'SHARED' | 'PERSONAL'
/** Sentinel "tất cả" cho Select trong bảng cấu hình (Radix không nhận value rỗng). */
const ALL = 'ALL'
/** Mã đã chọn trong cài đặt ô → tham số API; `ALL`/thiếu → không lọc. */
const pick = (v: string | undefined) => (v && v !== ALL ? v : '')

const PAGE_SIZE = 10

// Chế độ biểu đồ lấy trọn danh sách thay vì phân trang. Trần này chỉ để chặn trường hợp bất
// thường; chạm trần thì biểu đồ báo rõ chứ không cắt cụt im lặng.
const CHART_FETCH_SIZE = 200

/** Tên "report ẩn" của kho cũ — chỉ còn dùng để vớt bố cục một lần. */
const LEGACY_REPORT_NAME = '__MY_OBJECTIVES_DASHBOARD_CONFIG__'
const DEFAULT_WIDGETS: DashboardWidget[] = [
  // Hàng thẻ chỉ số từng nằm NGOÀI lưới, bám nút khoảng thời gian trên đầu trang. Nút đó nay nằm
  // trong bảng cấu hình từng ô, nên hàng thẻ cũng là một ô — cùng id với danh mục trang chủ.
  { i: 'myobj-metrics', type: 'STATS', title: 'Số liệu tổng hợp', x: 0, y: 0, w: 12, h: 4, visible: true },
  { i: 'myobj-trend', type: 'MYOBJ_TREND', title: 'Xu hướng KPI theo thời gian', x: 0, y: 4, w: 12, h: 15, visible: true },
  { i: 'myobj-detail', type: 'MYOBJ_DETAIL', title: 'KPI đang đảm nhiệm', x: 0, y: 19, w: 12, h: 18, visible: true },
]

/** Ô nào hiện mặc định cho ai: quản lý chỉ cần số liệu và danh sách, nhân viên có thêm xu hướng. */
const POSITION_LAYOUT: Record<ViewerPosition, readonly string[]> = {
  DIRECTOR: ['myobj-metrics', 'myobj-detail'],
  HEAD: ['myobj-metrics', 'myobj-detail'],
  DEPUTY: ['myobj-metrics', 'myobj-detail'],
  STAFF: ['myobj-metrics', 'myobj-detail', 'myobj-trend'],
}
const CATALOG = DEFAULT_WIDGETS.map(t => ({
  template: t,
  icon: null,
  groupLabel: t.type === 'STATS' ? 'Số liệu' : t.type === 'MYOBJ_TREND' ? 'Biểu đồ xu hướng' : 'Biểu đồ so sánh',
  preview: t.type === 'STATS' ? ('metricCard' as const) : t.type === 'MYOBJ_TREND' ? ('line' as const) : ('dumbbell' as const),
  description: t.type === 'STATS'
    ? 'Tiến độ, hiệu suất, trạng thái KPI và số KPI rủi ro của bạn.'
    : t.type === 'MYOBJ_TREND'
      ? 'Số mục tiêu bạn đảm nhiệm và hiệu suất của bạn qua từng mốc thời gian.'
      : 'Mục tiêu và kết quả then chốt bạn đảm nhiệm, kèm tiến độ từng KPI.',
}))

export default function MyObjectivesTab() {
  const onlyApproved = false
  const { periods, cycles } = useAnalyticsScopeData()
  // Không còn bộ lọc cấp trang: khoảng thời gian nằm trong cài đặt từng ô; "mặc định" chỉ còn là
  // hằng số cho ô chưa đặt gì.
  const pageIntent = PAGE_DEFAULT_INTENT
  const pin = usePinToHome()
  const grid = usePositionLayout(DEFAULT_WIDGETS, POSITION_LAYOUT, 'STAFF')
  const dash = useAnalyticsGrid({
    scope: 'ANALYTICS_MY_OBJECTIVES',
    defaultWidgets: grid.defaultWidgets,
    legacyReportName: LEGACY_REPORT_NAME,
  })
  /** Khoảng của một ô cụ thể: riêng nếu đã đặt, không thì theo mặc định. */
  const filterOf = (i: string) => widgetFilter(dash.widgets.find(w => w.i === i), pageIntent, periods, cycles)
  const trendF = filterOf('myobj-trend')
  const detailF = filterOf('myobj-detail')
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)
  const detailWidget = dash.widgets.find(w => w.i === 'myobj-detail')
  const { view: detailView } = useChartTableView('myobj-detail', 'chart', tableViewControl(detailWidget, dash.updateWidgetSettings))

  // Lọc Objective / KR / chung-riêng nằm trong cài đặt ô (chọn ở bảng cấu hình), không còn là dải
  // dropdown trong thân bảng. Objective/KR là tuỳ chọn ĐỘNG (danh sách từ phản hồi API) nên tab tự
  // dựng `OptionField` đưa vào bảng cấu hình; sentinel `ALL` vì Select không nhận chuỗi rỗng.
  const filterObjective = pick(detailWidget?.s?.o?.objective)
  const filterKr = pick(detailWidget?.s?.o?.kr)
  const filterShared = (optionOf(detailWidget, 'shared') ?? 'ALL') as SharedFilter
  const [sortField, setSortField] = useState<SortField | null>('period') // ưu tiên đợt/ngày gần nhất
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  // Đổi bộ lọc thì về trang đầu. Trước đây dropdown tự gọi setPage(0); nay lọc đến từ cài đặt ô nên
  // trang được nhớ KÈM khoá lọc lúc đặt — khoá khác là coi như trang 0, không cần effect.
  const filterKey = `${filterObjective}|${filterKr}|${filterShared}`
  const [pageAt, setPageAt] = useState({ key: filterKey, page: 0 })
  const page = pageAt.key === filterKey ? pageAt.page : 0
  const setPage = useCallback((p: number) => setPageAt({ key: filterKey, page: p }), [filterKey])

  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['personalObjective', 'chart', trendF.from, trendF.to, onlyApproved, trendF.periodId, trendF.periodIdTo, trendF.groupBy],
    queryFn: () => personalObjectiveApi.getComboChart({ from: trendF.from, to: trendF.to, onlyApproved, periodId: trendF.periodId, periodIdTo: trendF.periodIdTo, groupBy: trendF.groupBy }),
  })
  // Chế độ biểu đồ lấy TRỌN danh sách, chế độ bảng phân trang như cũ — phân trang là affordance của
  // bảng, đưa vào biểu đồ thì mỗi trang chỉ còn là một mảnh vụn không so được với nhau.
  const chartMode = detailView === 'chart'
  const effectivePage = chartMode ? 0 : page
  const effectiveSize = chartMode ? CHART_FETCH_SIZE : PAGE_SIZE

  const { data: kpiPage, isLoading: isKpisLoading } = useQuery({
    queryKey: ['personalObjective', 'details', detailF.from, detailF.to, onlyApproved, detailF.periodId, detailF.periodIdTo, sortField, sortDir, filterObjective, filterKr, filterShared, effectivePage, effectiveSize],
    queryFn: () => personalObjectiveApi.getDetailedKpis({
      from: detailF.from, to: detailF.to, onlyApproved, periodId: detailF.periodId, periodIdTo: detailF.periodIdTo,
      sortBy: sortField ?? undefined,
      sortDir,
      objectiveCode: filterObjective || undefined,
      keyResultCode: filterKr || undefined,
      sharedType: filterShared === 'ALL' ? undefined : filterShared,
      page: effectivePage,
      size: effectiveSize,
    }),
  })

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setPage(0)
  }, [sortField, setPage])

  // Hai trường động cho bảng cấu hình của ô chi tiết. Đổi Objective thì KR đã chọn hết nghĩa → `clears`.
  // Backend trả TRỌN danh sách KR (không thu theo Objective) — giữ nguyên hành vi cũ.
  const detailExtraFields = useMemo<OptionField[]>(() => [
    {
      key: 'objective', label: 'Mục tiêu (Objective)', kind: 'select', default: ALL, clears: ['kr'],
      choices: [{ value: ALL, label: 'Tất cả mục tiêu' }, ...(kpiPage?.availableObjectives ?? []).map(o => ({ value: o.code, label: o.name }))],
    },
    {
      key: 'kr', label: 'Key Result', kind: 'select', default: ALL,
      choices: [{ value: ALL, label: 'Tất cả Key Result' }, ...(kpiPage?.availableKeyResults ?? []).map(o => ({ value: o.code, label: o.name }))],
    },
  ], [kpiPage?.availableObjectives, kpiPage?.availableKeyResults])

  // Nội dung bảng chi tiết (không bọc card/tiêu đề — ChartWrapper lo phần đó).
  const renderDetailBody = useCallback(() => (
    <div className="flex-1 flex flex-col min-h-0 -mx-6 -mb-6">
      <div className="flex-1 overflow-auto custom-scrollbar min-h-0 flex flex-col">
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-[var(--color-muted)]">
              <tr className="text-xs font-medium text-slate-500">
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Mục tiêu hướng tới</th>
                <th className="px-6 py-4">Kết quả chính (KR)</th>
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
                ? <TableLoadingRows cols={6} count={2} />
                : kpiPage?.content?.map(kpi => (
                    <ExpandableKpiRow key={kpi.kpiId} kpi={kpi} onExpand={() => setSelectedKpiId(kpi.kpiId)} onSelectKpi={setSelectedKpiId} />
                  ))}
              {!isKpisLoading && (kpiPage?.totalElements ?? 0) === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {isKpisLoading ? (
            <div className="p-6 text-sm text-slate-400">Đang tải...</div>
          ) : kpiPage?.content?.length ? (
            kpiPage.content.map(kpi => (
              <MobileKpiCard key={kpi.kpiId} kpi={kpi} onExpand={() => setSelectedKpiId(kpi.kpiId)} />
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
  ), [isKpisLoading, kpiPage, page, setPage, sortDir, sortField, toggleSort])

  // Mỗi KPI một đoạn nối thực tế → mục tiêu: chiều dài đoạn CHÍNH LÀ phần còn phải làm.
  // Thanh tiến độ trong bảng nói cùng nội dung nhưng phải đọc từng dòng mới xếp hạng được mức độ gấp.
  const renderGapBody = useCallback(() => {
    const rows = (kpiPage?.content ?? []).filter(k => k.kpiType !== 'QUALITATIVE' && k.targetValue > 0)
    const qualitativeCount = (kpiPage?.content ?? []).length - rows.length
    return (
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {isKpisLoading ? (
          <div className="py-16 text-center text-slate-400 font-medium">Đang tải...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-medium italic">Không có KPI định lượng nào trong kỳ này</div>
        ) : (
          <DumbbellDotPlot
            xLabel="Tiến độ (%)"
            data={rows.map(k => ({
              id: k.kpiId,
              name: k.kpiName,
              subText: [k.keyResultName, k.periodName].filter(Boolean).join(' · '),
              from: k.actualValue,
              to: k.targetValue,
              unit: k.unit,
            }))}
            fromLabel="Thực tế" toLabel="Mục tiêu"
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
    danh hàm này. Hàm mới mỗi render là mọi biểu đồ vẽ lại mỗi lần tab render.
  */
  const { updateWidgetSettings } = dash
  const renderWidget = useCallback((w: DashboardWidget, ctx: { openConfig: () => void }) => {
    // Dòng tóm tắt "ô này đang theo cấu hình gì" — bấm vào là mở đúng bảng cấu hình của ô.
    const meta = (
      <WidgetConfigSummary
        widget={w} pageIntent={pageIntent} periods={periods} cycles={cycles}
        extraFields={w.i === 'myobj-detail' ? detailExtraFields : undefined}
        onOpen={ctx.openConfig}
      />
    )
    const f = widgetFilter(w, pageIntent, periods, cycles)
    switch (w.type) {
      case 'STATS': return (
        // Chromeless: mỗi thẻ đã là một card. Chip ở trên cho biết hàng số này đang theo khoảng nào.
        <div id="tour-analytics-metrics" className="h-full flex flex-col gap-2 min-h-0">
          {meta}
          <MyObjectiveMetrics filter={{ from: f.from, to: f.to, periodId: f.periodId, periodIdTo: f.periodIdTo, onlyApproved }} />
        </div>
      )
      case 'MYOBJ_TREND': return (
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
      case 'MYOBJ_DETAIL': return (
        <ChartWrapper title="KPI đang đảm nhiệm" icon={<Target size={20} className="text-slate-400" />}
          meta={meta}
          extraHeaderContent={<span className="text-xs font-medium text-slate-400">{kpiPage?.totalElements ?? 0} KPI</span>}>
          {detailView === 'chart' ? renderGapBody() : renderDetailBody()}
        </ChartWrapper>
      )
      default: return null
    }
  }, [pageIntent, periods, cycles, detailExtraFields, onlyApproved, chartData, isChartLoading, updateWidgetSettings, kpiPage, detailView, renderGapBody, renderDetailBody])

  if (isChartLoading)
    return <AnalyticsTabSkeleton variant="objectives" className="p-6" />

  return (
    <div className="space-y-6">
      {/* Tiêu đề + nút Tuỳ chỉnh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Mục tiêu của tôi</h2>
        <div id="tour-analytics-customize" className="flex items-center gap-3 flex-wrap">
          <DashboardEditToolbar api={dash} />
        </div>
      </div>

      {/* Hàng thẻ chỉ số nay là ô đầu lưới (myobj-metrics), khoảng thời gian của nó nằm trong bảng
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
            <WidgetConfigPanel
              widget={w} update={update} pageIntent={pageIntent} periods={periods} cycles={cycles}
              extraFields={w.i === 'myobj-detail' ? detailExtraFields : undefined}
            />
          )}
        />
      </div>

      {selectedKpiId && (
        <MyObjectiveDrawer
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



function MobileKpiCard({ kpi, onExpand }: { kpi: any; onExpand: () => void }) {
  const pct = Math.round(kpi.progress || 0)
  const fmt = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '-'

  return (
    <div className="p-4 space-y-3 active:bg-slate-50 dark:active:bg-slate-800/30" onClick={onExpand}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[var(--color-foreground)] truncate">{kpi.kpiName}</p>
          <p className="text-xs text-slate-500 mt-0.5">{kpi.objectiveName} ({kpi.objectiveCode})</p>
          <p className="text-xs text-slate-500">{kpi.keyResultName} • {kpi.keyResultCode}</p>
        </div>
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

function ExpandableKpiRow({ kpi, onExpand, onSelectKpi }: { kpi: any; onExpand: () => void; onSelectKpi?: (id: string) => void }) {
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
        <td className="px-6 py-4 cursor-pointer" onClick={onExpand}>
          <div className="font-semibold text-sm text-slate-900 hover:text-[var(--color-primary)] dark:hover:text-indigo-400 transition-colors dark:text-white truncate max-w-[200px]">{kpi.kpiName}</div>
          <div className="text-xs text-slate-500 mt-1">{kpi.objectiveName} ({kpi.objectiveCode})</div>
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
          <div className="text-sm font-medium">{kpi.keyResultName}</div>
          <div className="text-xs text-slate-500 mt-1">{kpi.keyResultCode}</div>
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
                Đã hoàn thành {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
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
                Đã hoàn thành {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </>
          )}
        </td>
        <td className="px-6 py-4">
          {kpi.shared ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-[var(--color-primary)] dark:text-indigo-400 text-xs font-semibold">
              <Users size={12} /> Mục tiêu chung ({kpi.participantCount})
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold">
              <User size={12} /> Mục tiêu riêng
            </div>
          )}
        </td>
      </tr>
      {expanded && hasChildren && (
        <KpiChildTableRows
          nodes={toChildNodes(kpi.children)}
          onSelect={onSelectKpi}
          headingColSpan={6}
          variant={{ leadingChevronCol: true, showPersonColumn: false, extraColsAfterName: 1, trailingEmptyCols: 1, accent: 'indigo', baseIndent: 28 }}
        />
      )}
      {expanded && (!hasChildren || (kpi.mySubmissions?.length ?? 0) > 0 || kpi.shared) && (
        <tr>
          <td colSpan={6} className="p-0 border-b border-[var(--color-border)]">
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

              {kpi.shared && kpi.childRelationType !== 'DECOMPOSITION' && (
                <div className="w-full space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-medium text-slate-500">Đồng đội cùng thực hiện</h4>
                  <div className="space-y-3">
                    {kpi.teammates?.map((tm: any) => (
                      <div key={tm.userId} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-[250px]">
                          {tm.avatarUrl ? (
                            <img src={tm.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold">
                              {tm.fullName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{tm.fullName}</p>
                            <p className="text-xs text-slate-500">{tm.employeeCode}</p>
                          </div>
                        </div>
                        <div className="w-[150px]">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{tm.role}</p>
                          <p className="text-xs text-slate-500">{tm.department}</p>
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
                              <p className="text-xs font-semibold text-[var(--color-primary)] dark:text-indigo-400 mt-1">{tm.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                            </div>
                            <div className="text-center sm:text-right w-[100px]">
                              <p className="text-xs text-slate-500">Hiệu suất (đánh giá)</p>
                              <p className="text-sm font-semibold text-[var(--color-primary)]">{tm.performance != null ? `${tm.performance.toFixed(1)}%` : '-'}</p>
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
