import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSummaryStats, useSummaryRankings } from '../hooks/useAnalytics'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { KpiTreemapLegend } from '../components/KpiTreemapLegend'
import { groupKpisByPeriod } from '../lib/kpiTreeGrouping'
import {
  Target, Star, Users, TrendingUp,
  ChevronRight, AlertTriangle, Medal, ArrowUpRight, ArrowDownRight,
  ChevronDown, Filter, ArrowUpDown, MousePointerClick,
  X, CheckCircle, LayoutDashboard, Building2
} from 'lucide-react'
import AnalyticsTabSkeleton from '@/components/common/AnalyticsTabSkeleton'
import type { RankingItem } from '@/types/stats'
import type { WidgetType } from '@/types/datasource'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import { useNavigate } from 'react-router-dom'
import Lollipop from '@/components/charts/primitives/Lollipop'
import HierarchicalTreemap, { type TreeNode } from '@/components/charts/primitives/HierarchicalTreemap'
import {
  SubmissionTrendWidget, SubmissionShareWidget, ScoreHistogramWidget, ScoreDeviationWidget,
  SelfVsManagerWidget, RankDeltaWidget, KpiLifecycleWidget,
} from '../components/advanced/SummaryAdvanced'
import { useChartTableView } from '@/components/common/dashboard/useChartTableView'
import { ViewToggleButtons } from '@/components/common/dashboard/ViewToggleButtons'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import AnalyticsComboChart from '../components/AnalyticsComboChart'
import UnitComparisonBarChart from '../components/UnitComparisonBarChart'
import MemberRoleChart from '../components/MemberRoleChart'
import Pagination from '@/components/common/Pagination'
import { orgUnitKpiApi } from '@/features/dashboard/api/orgUnitKpiApi'
import OrgUnitKpiDrawer from '../components/OrgUnitKpiDrawer'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import { useDashboardCustomization } from '@/components/common/dashboard/useDashboardCustomization'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'

const CONFIG_REPORT_NAME = '__SUMMARY_DASHBOARD_CONFIG__'

type SharedFilter = 'ALL' | 'SHARED' | 'PERSONAL'

// Biểu đồ phân bổ lấy TRỌN một kỳ chứ không phân trang. Trần này chỉ để chặn một tổ chức bất
// thường kéo về hàng nghìn dòng; chạm trần thì biểu đồ báo rõ chứ không cắt cụt im lặng.
const ALLOC_FETCH_SIZE = 500

// Số mục biểu đồ xếp hạng vẽ ở mỗi đầu (cao nhất hoặc thấp nhất).
const CHART_TOP_N = 15

// Sentinel cho mục "Tất cả đơn vị" — shadcn/Radix Select không cho phép value rỗng.
const ALL_UNITS = '__ALL__'

/** Cây đơn vị → danh sách phẳng, thụt lề theo độ sâu để vẫn đọc được thứ bậc trong dropdown. */
function flattenUnits(nodes: OrgUnitTreeResponse[] | undefined, depth = 0): { id: string; label: string }[] {
  if (!nodes?.length) return []
  return nodes.flatMap(n => [
    { id: n.id, label: `${'— '.repeat(depth)}${n.name}` },
    ...flattenUnits(n.children, depth + 1),
  ])
}

type SummaryWidget = DashboardWidget

const DEFAULT_SUMMARY_WIDGETS: SummaryWidget[] = [
  // Thứ tự đọc: xu hướng chung → so sánh giữa các đơn vị → chi tiết từng KPI → nhân sự.
  // Chiều cao tính ra pixel là `48h − 16` (rowHeight 32 + margin 16), nên mỗi đơn vị `h` đắt 48px —
  // đây là chỗ dễ vô tình làm trang dài gấp đôi nhất.
  { i: 'trend-chart', type: 'TREND_CHART', title: 'Xu hướng KPI theo thời gian', x: 0, y: 0, w: 12, h: 11, visible: true },
  { i: 'unit-perf', type: 'UNIT_PERFORMANCE', title: 'Hiệu suất & Tiến độ đơn vị', x: 0, y: 11, w: 12, h: 11, visible: true },
  { i: 'kpi-detail', type: 'KPI_DETAIL', title: 'Phân bổ trọng số & tiến độ KPI', x: 0, y: 22, w: 12, h: 14, visible: true },
  // Hai khối nhân sự xếp CẠNH nhau: cả hai đều là danh sách dọc nên chịu được nửa chiều ngang,
  // và đọc cùng nhau mới trả lời được "đơn vị nào đông người mà xếp hạng lại thấp".
  { i: 'member-dist', type: 'MEMBER_DIST', title: 'Nhân sự & vai trò theo đơn vị', x: 0, y: 36, w: 6, h: 10, visible: true },
  { i: 'rank-table', type: 'RANKING_TABLE', title: 'Bảng xếp hạng nhân sự', x: 6, y: 36, w: 6, h: 10, visible: true },
  // Biểu đồ chuyên sâu — mặc định ẩn để lưới không phình ra với người chỉ cần vài chỉ số quen thuộc;
  // bật lại bất cứ lúc nào qua "Tuỳ chỉnh → Ẩn/Hiện".
  { i: 'submission-trend', type: 'SUBMISSION_TREND', title: 'Cơ cấu bài nộp theo thời gian', x: 0, y: 46, w: 12, h: 12, visible: false },
  { i: 'submission-share', type: 'SUBMISSION_SHARE', title: 'Cơ cấu trạng thái bài nộp theo đơn vị', x: 0, y: 58, w: 12, h: 12, visible: false },
  { i: 'score-histogram', type: 'SCORE_HISTOGRAM', title: 'Phân phối điểm đánh giá', x: 0, y: 70, w: 6, h: 12, visible: false },
  { i: 'score-deviation', type: 'SCORE_DEVIATION', title: 'Chênh lệch điểm so với trung bình', x: 6, y: 70, w: 6, h: 12, visible: false },
  { i: 'self-vs-manager', type: 'SELF_VS_MANAGER', title: 'Tự đánh giá vs Quản lý đánh giá', x: 0, y: 82, w: 6, h: 12, visible: false },
  { i: 'rank-delta', type: 'RANK_DELTA', title: 'Biến động thứ hạng giữa hai kỳ', x: 6, y: 82, w: 6, h: 12, visible: false },
  { i: 'kpi-lifecycle', type: 'KPI_LIFECYCLE', title: 'Vòng đời KPI', x: 0, y: 94, w: 12, h: 13, visible: false },
]

// Các widget cốt lõi luôn có mặt (bổ sung cho cấu hình cũ chưa có sau khi thêm mới).
const CORE_WIDGET_IDS = ['trend-chart', 'kpi-detail']

// KPI_DETAIL là loại widget riêng của FE — DB check constraint chưa có giá trị này nên lưu xuống dưới
// enum sẵn có 'TABLE'. Khi tải lên, loại thật được suy lại từ id widget (cfg.i) nên giá trị lưu không
// ảnh hưởng hiển thị. Nhờ vậy không cần đổi enum backend / migration DB.
// KPI_DETAIL là loại widget riêng của FE — DB check constraint chưa có giá trị này nên lưu xuống dưới
// enum sẵn có 'TABLE'. Khi tải lên, loại thật được suy lại từ id widget (cfg.i) nên giá trị lưu không
// ảnh hưởng hiển thị. Nhờ vậy không cần đổi enum backend / migration DB.
/**
 * DB có check-constraint trên `widget_type` nên loại riêng của FE phải lưu xuống dưới một giá trị
 * enum sẵn có. Khi tải lên, loại thật suy lại từ `chartConfig.i` nên giá trị lưu không ảnh hưởng
 * hiển thị — nhờ vậy thêm biểu đồ mới không cần migration DB.
 */
const FE_ONLY_WIDGET_TYPES: Record<string, WidgetType> = {
  KPI_DETAIL: 'TABLE',
  SUBMISSION_TREND: 'AREA',
  SUBMISSION_SHARE: 'BAR',
  SCORE_HISTOGRAM: 'BAR',
  SCORE_DEVIATION: 'BAR',
  SELF_VS_MANAGER: 'BAR',
  RANK_DELTA: 'BAR',
  KPI_LIFECYCLE: 'HEATMAP',
}

const toBackendWidgetType = (t: string): WidgetType =>
  FE_ONLY_WIDGET_TYPES[t] ?? (t as WidgetType)

// Loại widget đã bị gỡ khỏi sản phẩm nhưng có thể còn nằm trong cấu hình lưới đã lưu ở DB.
// Phải LỌC chứ không chỉ bỏ nhánh render: DashboardCustomizeChrome vẫn tạo ô lưới cho mọi widget
// hiển thị, nên một widget render ra null sẽ để lại ô trống chiếm chỗ giữa các biểu đồ khác.
const RETIRED_WIDGET_TYPES = ['ROLE_DIST', 'UNIT_KPI', 'UNIT_RISK', 'WARNING_LIST']

// Bố cục v2: trước đây MỌI khối đều rộng 12 cột nên chúng chỉ xếp chồng dọc được — tổng chiều
// cao hơn 4200px, tức mỗi màn hình chỉ thấy đúng một biểu đồ. v2 hạ chiều cao và ghép hai khối
// nhân sự nằm cạnh nhau, còn khoảng 2100px.
const V2_LAYOUT: Record<string, { x: number; y: number; w: number; h: number }> = {
  'trend-chart': { x: 0, y: 0, w: 12, h: 11 },
  'unit-perf': { x: 0, y: 11, w: 12, h: 11 },
  'kpi-detail': { x: 0, y: 22, w: 12, h: 14 },
  'member-dist': { x: 0, y: 36, w: 6, h: 10 },
  'rank-table': { x: 6, y: 36, w: 6, h: 10 },
}
const V2_BOTTOM_Y = 46

// Migration cấu hình cũ: bỏ widget đã gỡ, nâng sàn chiều cao TREND_CHART,
// và luôn có widget cốt lõi (xu hướng + bảng chi tiết).
const summaryPostProcess = (mapped: SummaryWidget[], defaults: SummaryWidget[]): SummaryWidget[] => {
  const hasLegacyRoleDist = mapped.some(w => w.type === 'ROLE_DIST')
  let result = mapped
    .filter(w => !RETIRED_WIDGET_TYPES.includes(w.type))
    .map(w => (hasLegacyRoleDist && w.type === 'MEMBER_DIST')
      ? { ...w, w: 12, x: 0, title: 'Nhân sự & vai trò theo đơn vị' }
      : w)

  // Áp bố cục v2 cho cấu hình còn nguyên dạng v1. Nhận ra v1 nhờ TREND_CHART cao ≥ 15 — giá trị
  // mà bản migration cũ ép cứng, nên không thể là lựa chọn có ý thức của người dùng. Ai đã tự
  // sắp lại lưới thì giữ nguyên ý họ; điều kiện này cũng tự tắt sau lần áp đầu tiên.
  if (result.some(w => w.i === 'trend-chart' && (w.h ?? 0) >= 15)) {
    const relaid: SummaryWidget[] = []
    let extraY = V2_BOTTOM_Y
    for (const w of result) {
      const pos = V2_LAYOUT[w.i]
      if (pos) {
        relaid.push({ ...w, ...pos })
      } else {
        // Widget ngoài bố cục chuẩn (chuyên sâu, hoặc do người dùng thêm) dồn xuống dưới,
        // giữ nguyên thứ tự tương đối.
        relaid.push({ ...w, y: extraY })
        extraY += w.h ?? 12
      }
    }
    result = relaid
  }

  CORE_WIDGET_IDS.forEach(id => {
    if (!result.some(w => w.i === id)) {
      const def = defaults.find(d => d.i === id)
      if (def) {
        const maxY = result.length ? Math.max(...result.map(w => w.y + w.h)) : 0
        result = [...result, { ...def, y: maxY }]
      }
    }
  })
  return result
}

// Danh mục widget cho modal "Thêm biểu đồ".
const SUMMARY_CATALOG: { template: SummaryWidget; icon: React.ReactNode }[] = DEFAULT_SUMMARY_WIDGETS.map(t => ({
  template: t,
  icon: t.type === 'KPI_DETAIL' ? <Target size={24} />
    : t.type === 'MEMBER_DIST' ? <Users size={24} />
    : t.type === 'RANKING_TABLE' ? <Star size={24} />
    : <TrendingUp size={24} />,
}))

export default function SummaryTab() {
  // Đơn vị áp cho TOÀN BỘ tab (metrics, biểu đồ, các section rủi ro/xếp hạng).
  // Trước đây biến này khai báo không có setter nên luôn là undefined — mọi widget âm thầm bỏ qua
  // phạm vi đơn vị và luôn hiển thị toàn bộ phạm vi quyền của người dùng.
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined)

  // ── Global filter state ───────────────────────────────────────────────────
  const onlyApproved = false
  const { periodId, periodIdTo, from, to, groupBy, controls } = useAnalyticsDateFilter({ selectClassName: 'h-9' })
  const { data: unitTree } = useOrgUnitTree()
  const unitOptions = useMemo(() => flattenUnits(unitTree), [unitTree])
  const perf = usePerformanceScale()

  // ── New KPI data ──────────────────────────────────────────────────────────
  // `selectedUnitId` phải nằm trong CẢ queryKey lẫn params. Thiếu ở queryKey thì React Query coi
  // hai đơn vị khác nhau là cùng một truy vấn và phục vụ lại số của đơn vị trước.
  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'metrics', from, to, onlyApproved, periodId, periodIdTo, selectedUnitId],
    queryFn: () => orgUnitKpiApi.getMetrics({ orgUnitId: selectedUnitId, from, to, onlyApproved, periodId, periodIdTo }),
  })

  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'chart', from, to, onlyApproved, periodId, periodIdTo, groupBy, selectedUnitId],
    queryFn: () => orgUnitKpiApi.getComboChart({ orgUnitId: selectedUnitId, from, to, onlyApproved, periodId, periodIdTo, groupBy }),
  })

  // ── Detail table state ────────────────────────────────────────────────────
  const [filterOrgUnitId, setFilterOrgUnitId] = useState<string | undefined>(undefined)
  const [filterShared, setFilterShared] = useState<SharedFilter>('ALL')
  const advancedFilter = { orgUnitId: selectedUnitId, periodId, periodIdTo, from, to }

  // ── Biểu đồ theo đợt (chế độ biểu đồ của widget "KPI đơn vị") ────────────
  // Bám ĐÚNG bộ lọc thời gian chung, không có bộ chọn kỳ riêng: bắt người dùng lọc hai lần cho
  // cùng một câu hỏi là thừa. Lấy trọn một lần rồi gom ở client theo đợt → đơn vị, vì thông tin
  // đợt (periodName, periodStart) đã nằm sẵn trong từng dòng KPI.
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())

  // Trước đây widget này có thêm chế độ bảng với truy vấn riêng phân trang 5 dòng. Bỏ bảng thì
  // bỏ luôn truy vấn đó — không còn hai chỗ hỏi cùng một endpoint.
  const { data: allocPage, isLoading: isAllocLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'byPeriod', from, to, onlyApproved, periodId, periodIdTo, selectedUnitId, filterOrgUnitId, filterShared],
    queryFn: () => orgUnitKpiApi.getDetailedKpis({
      orgUnitId: selectedUnitId,
      from, to, onlyApproved, periodId, periodIdTo,
      filterOrgUnitId,
      sharedType: filterShared === 'ALL' ? undefined : filterShared,
      page: 0,
      size: ALLOC_FETCH_SIZE,
    }),
  })


  const clearTableFilters = () => {
    setFilterOrgUnitId(undefined)
    setFilterShared('ALL')
  }

  const hasTableFilters = !!(filterOrgUnitId || filterShared !== 'ALL')

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)

  // ── Existing summary data (unchanged widgets) ─────────────────────────────
  const { data: mainData, isLoading: isMainLoading } = useSummaryStats(selectedUnitId)
  // ── Widget config (dùng hook + chrome dùng chung) ─────────────────────────
  const dash = useDashboardCustomization({
    configReportName: CONFIG_REPORT_NAME,
    reportDescription: 'Cấu hình giao diện thống kê tổng hợp',
    defaultWidgets: DEFAULT_SUMMARY_WIDGETS,
    toBackendWidgetType,
    postProcess: summaryPostProcess,
  })
  const { isEditMode, handleTogglePin } = dash

  // Thanh lọc dùng CHUNG cho cả hai chế độ của widget. Trước đây nó nằm trong thân bảng nên chế
  // độ biểu đồ không có bộ lọc đơn vị nào của riêng nó.
  const renderKpiFilterBar = () => (
    <div className="pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 shrink-0">
      <Select
        value={filterOrgUnitId ?? ALL_UNITS}
        onValueChange={v => setFilterOrgUnitId(v === ALL_UNITS ? undefined : v)}
      >
        <SelectTrigger className="h-9 max-w-[220px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
          {allocPage?.availableOrgUnits?.map(o => (
            <UnitSelectItem key={o.code} o={o} />
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-0.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
        {([['ALL', 'Tất cả'], ['SHARED', 'KPI chung'], ['PERSONAL', 'KPI riêng']] as [SharedFilter, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFilterShared(v)}
            className={cn(
              'px-3 py-1 rounded-md text-[11px] font-black transition-all',
              filterShared === v
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {hasTableFilters && (
        <button onClick={clearTableFilters} className="flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <X size={13} /> Xóa bộ lọc
        </button>
      )}
    </div>
  )

  /**
   * KPI theo từng đợt. Mỗi đợt gồm hai phần:
   *
   * <p>1. **Các cây phân cấp** — một mục tiêu lớn được chia xuống qua nhiều đơn vị. Trọng số
   * lồng nhau khớp tuyệt đối (60+40=100), nên treemap lồng là cách duy nhất nhìn ra cấu trúc đó.
   * Không gom theo đơn vị ở đây được vì cây BẮC NGANG nhiều đơn vị — cha ở Chi nhánh, con ở
   * Phòng, cháu ở Team.
   *
   * <p>2. **KPI độc lập** — vẫn gom theo đơn vị, vì chỉ trong nội bộ một đơn vị thì trọng số mới
   * so được với nhau (mỗi đơn vị có 100% riêng). Mỗi đơn vị là một KHUNG có nhãn tên đơn vị ở
   * đầu khung, KPI nằm bên trong — cùng một ngôn ngữ hình với cây phân cấp ở trên, thay vì một
   * mảng ô rời phải đọc tiêu đề bên ngoài mới biết thuộc về ai.
   */
  const renderKpiByPeriodBody = () => {
    const all = allocPage?.content ?? []
    const withWeight = all.filter(k => (k.weight ?? 0) > 0)
    const skipped = all.length - withWeight.length
    const truncated = (allocPage?.totalElements ?? 0) > ALLOC_FETCH_SIZE

    // Dựng cây theo từng đợt — xem `lib/kpiTreeGrouping`.
    const periods = groupKpisByPeriod(withWeight)

    // Đợt mới nhất mở sẵn; các đợt còn lại thu gọn nhưng vẫn hiện tên đợt kèm số đơn vị và số KPI,
    // nên vẫn nắm được quy mô từng đợt mà không phải cuộn qua hàng chục biểu đồ.
    const isExpanded = (key: string) =>
      expandedPeriods.size === 0 ? key === periods[0]?.key : expandedPeriods.has(key)

    const togglePeriod = (key: string) => setExpandedPeriods(prev => {
      const next = new Set(prev.size === 0 && periods[0] ? [periods[0].key] : prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

    return (
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {renderKpiFilterBar()}
        {!isAllocLoading && periods.length > 0 && (
          <div className="shrink-0 space-y-2">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <MousePointerClick size={13} className="text-indigo-500 shrink-0" />
              <span>
                Bấm vào một ô để mở chi tiết KPI
                <span className="text-slate-300 dark:text-slate-600 mx-1.5">│</span>
                Diện tích ô = trọng số, màu = tiến độ, ô lồng = KPI được chia xuống
              </span>
            </p>
            <KpiTreemapLegend />
          </div>
        )}
        <div className="flex-1 overflow-auto custom-scrollbar min-h-0 space-y-3 pr-1">
          {isAllocLoading ? (
            <div className="py-16 text-center text-slate-400 font-bold">Đang tải...</div>
          ) : periods.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold italic">
              Không có KPI nào được đặt trọng số trong khoảng thời gian đang lọc
            </div>
          ) : periods.map(period => {
            // Chỉ để đếm ở tiêu đề; không còn dựng thành khung bọc quanh KPI.
            const units = [...period.units.values()]
            const open = isExpanded(period.key)
            return (
              <section key={period.key} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  onClick={() => togglePeriod(period.key)}
                  className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
                      {open
                        ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
                        : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                      <span className="truncate">{period.name}</span>
                    </h4>
                    <span className="text-[11px] font-bold text-slate-400 shrink-0 tabular-nums">
                      {period.trees.length > 0 && `${period.trees.length} cây phân cấp · `}
                      {units.length} đơn vị · {period.kpiCount} KPI
                    </span>
                  </div>
                </button>

                {open && (
                  <div className="p-4 pt-0">
                    {/* MỘT hình cho cả đợt. Cây phân cấp và KPI độc lập nằm ngang hàng nhau, nên
                        thứ duy nhất bọc quanh một KPI là một KPI khác — không còn thẻ theo cây
                        hay khung theo đơn vị xen vào giữa. Đơn vị của từng KPI đọc ngay trong ô. */}
                    <HierarchicalTreemap
                      nodes={nodesOf(period)}
                      height={treemapHeight(nodesOf(period))}
                      onSelect={n => { if (n.id) setSelectedKpiId(n.id) }}
                    />
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {skipped > 0 && (
          <p className="text-[11px] text-slate-400 font-medium text-center shrink-0">
            {skipped} KPI chưa đặt trọng số nên không có diện tích để vẽ. Xem chúng ở trang Quản lý chỉ tiêu.
          </p>
        )}
        {truncated && (
          <p className="text-[11px] text-amber-600 font-bold text-center shrink-0">
            Khoảng lọc này có {allocPage?.totalElements} KPI, biểu đồ chỉ vẽ {ALLOC_FETCH_SIZE} mục đầu — thu hẹp bộ lọc để xem đủ.
          </p>
        )}
      </div>
    )
  }

  const renderWidgetContent = (widget: SummaryWidget) => {
    switch (widget.type) {
      case 'TREND_CHART': return (
        <ChartWrapper chromeless title="Xu hướng KPI theo thời gian" icon={<TrendingUp size={20} className="text-indigo-500" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <AnalyticsComboChart data={chartData?.points || []} isLoading={isChartLoading} itemName="KPI đơn vị" fillHeight />
        </ChartWrapper>
      )
      case 'KPI_DETAIL': return (
        <ChartWrapper
          title="Phân bổ trọng số & tiến độ KPI"
          icon={<Target size={20} className="text-indigo-600" />}
          widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}
          extraHeaderContent={
            <span className="text-xs font-bold text-slate-400">{allocPage?.totalElements ?? 0} KPI</span>
          }
        >
          {renderKpiByPeriodBody()}
        </ChartWrapper>
      )
      case 'UNIT_PERFORMANCE': return (
        <ChartWrapper title="Hiệu suất, tiến độ & tình hình nộp theo đơn vị" icon={<TrendingUp size={20} className="text-emerald-500" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <UnitComparisonBarChart orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} />
        </ChartWrapper>
      )
      case 'MEMBER_DIST': return (
        <ChartWrapper title="Nhân sự & vai trò theo đơn vị" icon={<Users size={20} className="text-purple-600" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <MemberRoleChart data={mainData?.roleDistribution} />
        </ChartWrapper>
      )
      case 'SUBMISSION_TREND': return <SubmissionTrendWidget filter={advancedFilter} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode} />
      case 'SUBMISSION_SHARE': return <SubmissionShareWidget filter={advancedFilter} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode} />
      case 'SCORE_HISTOGRAM': return <ScoreHistogramWidget filter={advancedFilter} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode} />
      case 'SCORE_DEVIATION': return <ScoreDeviationWidget filter={advancedFilter} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode} />
      case 'SELF_VS_MANAGER': return <SelfVsManagerWidget filter={advancedFilter} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode} />
      case 'RANK_DELTA': return <RankDeltaWidget filter={advancedFilter} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode} />
      case 'KPI_LIFECYCLE': return <KpiLifecycleWidget filter={advancedFilter} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode} />
      case 'RANKING_TABLE': return <EmployeeRankingTableSection orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} isEditMode={isEditMode} widget={widget} onTogglePin={handleTogglePin} />
      default: return null
    }
  }

  if (isMainLoading && !mainData) return <AnalyticsTabSkeleton variant="default" className="p-6" />

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Thống kê tổng hợp</h2>
        <div id="tour-analytics-customize">
          <DashboardEditToolbar api={dash} />
        </div>
      </div>

      {/* ── Global Filter (sticky) ────────────────────────────────────────── */}
      <div id="tour-analytics-filter" className="sticky top-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30">
              <LayoutDashboard size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base">
                Bộ lọc KPI
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Lọc dữ liệu đồng bộ cho metrics, biểu đồ và bảng chi tiết</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <Select
              value={selectedUnitId ?? ALL_UNITS}
              onValueChange={v => setSelectedUnitId(v === ALL_UNITS ? undefined : v)}
            >
              <SelectTrigger className="h-9 w-full sm:w-[210px]">
                <Building2 size={14} className="mr-1 text-slate-400 shrink-0" />
                <SelectValue placeholder="Tất cả đơn vị" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
                {unitOptions.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {controls}
          </div>
        </div>
      </div>

      {/* ── Metrics ───────────────────────────────────────────────────────── */}
      {isMetricsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-[var(--color-muted)] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div id="tour-analytics-metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"><TrendingUp size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Tiến độ trung bình</p>
              <p className="text-2xl font-black">{metrics?.averageProgress?.toFixed(1) ?? 0}%</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><Target size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Hiệu suất trung bình (đánh giá)</p>
              <p className="text-2xl font-black">{perf.format(metrics?.averagePerformance ?? 0)}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><CheckCircle size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Trạng thái KPI</p>
              <p className="text-sm font-black">{metrics?.runningKpis ?? 0} Đang chạy</p>
              <p className="text-sm font-black text-emerald-600">{metrics?.completedKpis ?? 0} Hoàn thành</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"><AlertTriangle size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">KPI Rủi ro / Chậm</p>
              <p className="text-2xl font-black">{metrics?.riskKpis ?? 0}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0"><Users size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Tổng nhân sự</p>
              <p className="text-2xl font-black">{mainData?.totalMembers ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Biểu đồ xu hướng & bảng chi tiết KPI giờ là widget trong lưới tuỳ chỉnh bên dưới. */}

      {/* ── Lưới widget tuỳ chỉnh ─────────────────────────────────────────── */}
      <div id="tour-analytics-widgets">
        <DashboardCustomizeChrome api={dash} renderWidget={renderWidgetContent} catalog={SUMMARY_CATALOG} ready={!!mainData} />
      </div>

      {/* AiAssistantWidget đã chuyển sang AppLayout để hiện trên mọi trang */}

      {selectedKpiId && (
        <OrgUnitKpiDrawer
          kpiId={selectedKpiId}
          onClose={() => setSelectedKpiId(null)}
          globalFrom={from}
          globalTo={to}
          globalOnlyApproved={onlyApproved}
          globalPeriodId={periodId}
          globalPeriodIdTo={periodIdTo}
        />
      )}
    </div>
  )
}

// ── Sơ đồ quan hệ KPI: mấy mảnh nhỏ dùng chung ───────────────────────────────

/** Độ sâu của cây, tính cả nút gốc. */
function depthOf(n: TreeNode): number {
  const kids = n.children ?? []
  return kids.length === 0 ? 1 : 1 + Math.max(...kids.map(depthOf))
}

/** Cây phân cấp và KPI độc lập của một đợt, ngang hàng nhau trong cùng một hình. */
function nodesOf(period: { trees: TreeNode[]; leaves: TreeNode[] }): TreeNode[] {
  return [...period.trees, ...period.leaves]
}

/**
 * Càng nhiều nút và càng sâu thì càng cần cao.
 *
 * <p>`HierarchicalTreemap` chỉ vẽ được con vào trong khi ô cha còn ít nhất 64×72 pixel; dưới
 * ngưỡng đó nó lặng lẽ vẽ ô đặc và NUỐT cả nhánh con. Trước đây mỗi cây chiếm trọn một thẻ nên
 * chỉ cần tính theo độ sâu; giờ một hình chứa cả cây lẫn hàng chục KPI lá, nên số nút cũng phải
 * góp vào chiều cao — nếu không cây trọng số nhỏ sẽ rơi xuống dưới ngưỡng và mất hết nhánh con.
 */
function treemapHeight(nodes: TreeNode[]): number {
  const deepest = nodes.reduce((m, n) => Math.max(m, depthOf(n)), 1)
  return Math.min(720, 300 + nodes.length * 10 + Math.max(deepest - 1, 0) * 80)
}

// ── Widget sub-components (unchanged, no date filter) ─────────────────────────

function TableSkeletonRows({ cols, count = 5 }: { cols: number; count?: number }) {
  const widths = ['75%', '55%', '65%', '50%', '70%']
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <div
                className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse"
                style={{ width: j === 0 ? '30%' : widths[j % widths.length] }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function UnitSelectItem({ o }: { o: { code: string; name: string; depth?: number } }) {
  const prefix = '-'.repeat(o.depth ?? 0)
  return <SelectItem value={o.code}>{prefix}{o.name}</SelectItem>
}

export function EmployeeRankingTableSection({ orgUnitId, from, to, onlyApproved, periodId, periodIdTo, isEditMode, widget, onTogglePin, bare }: { orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string; isEditMode?: boolean; widget?: SummaryWidget; onTogglePin?: (w: SummaryWidget) => void; bare?: boolean }) {
  const [rankingUnitId, setRankingUnitId] = useState<string | undefined>(undefined)
  const [sf, setSf] = useState<'performance' | 'avgProgress'>('performance')
  const [sd, setSd] = useState<'ASC' | 'DESC'>('DESC')
  const [rankPage, setRankPage] = useState(0)
  const perf = usePerformanceScale()
  const navigate = useNavigate()
  const { view, setView } = useChartTableView('rank-table')
  const RANK_PAGE_SIZE = 5

  // Sort + phân trang đã chuyển sang backend; render thẳng trang hiện tại trả về.
  const { data, isFetching } = useSummaryRankings(orgUnitId, rankingUnitId, from, to, onlyApproved, periodId, rankPage, RANK_PAGE_SIZE, sf, sd, periodIdTo);

  const pagedRankings = (data?.rankings ?? []) as RankingItem[]
  const totalRankPages = data?.totalPages ?? 0
  const totalRankElements = data?.totalElements ?? 0

  // Chế độ biểu đồ lấy MỘT lần 15 người ở một đầu bảng xếp hạng, không phân trang: xếp hạng sinh ra
  // để xem hai đầu, còn "trang 7/22 của một bảng xếp hạng" thì không trả lời được câu hỏi nào.
  // sortDir do backend xử lý nên đảo chiều là đổi hẳn sang nhóm thấp nhất, không phải lật ngược
  // đúng 15 người vừa xem.
  const { data: chartData, isFetching: isChartFetching } = useSummaryRankings(
    orgUnitId, rankingUnitId, from, to, onlyApproved, periodId, 0, CHART_TOP_N, sf, sd, periodIdTo)

  const chartRankings = (chartData?.rankings ?? []) as RankingItem[]
  const chartTotal = chartData?.totalElements ?? 0

  const handleSort = (field: 'performance' | 'avgProgress') => {
    if (sf === field) setSd(prev => prev === 'ASC' ? 'DESC' : 'ASC')
    else { setSf(field); setSd('DESC') }
    setRankPage(0)
  }

  const sortIcon = (field: 'performance' | 'avgProgress') => sf === field
    ? (sd === 'DESC' ? <ArrowDownRight size={10} className="inline ml-1" /> : <ArrowUpRight size={10} className="inline ml-1" />)
    : <ArrowUpDown size={10} className="inline ml-1 opacity-30" />

  const tableBody = (
      <div className="flex-1 flex flex-col gap-3">
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4">Hạng</th>
                <th className="px-6 py-4">Nhân viên</th>
                <th className="px-6 py-4">Đơn vị</th>
                <th className="px-6 py-4 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('avgProgress')}>
                  Tiến độ trung bình {sortIcon('avgProgress')}
                </th>
                <th className="px-6 py-4 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('performance')}>
                  Hiệu suất {sortIcon('performance')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isFetching ? (
                <TableSkeletonRows cols={5} count={5} />
              ) : pagedRankings.map((item, i) => {
                const globalRank = rankPage * RANK_PAGE_SIZE + i
                return (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs",
                        globalRank === 0 ? "bg-amber-500 text-white shadow-lg shadow-amber-200" :
                        globalRank === 1 ? "bg-slate-400 text-white" :
                        globalRank === 2 ? "bg-orange-400 text-white" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      )}>{globalRank + 1}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar fullName={item.name} avatarUrl={item.avatar} className="w-9 h-9 rounded-xl" fallbackClassName="bg-indigo-50 dark:bg-indigo-900/20 font-black text-indigo-600 text-xs" />
                        <p className="font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{item.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-500 text-xs">{item.subText}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full',
                            item.avgProgress >= 80 ? 'bg-emerald-500' :
                            item.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          )} style={{ width: `${Math.min(item.avgProgress, 100)}%` }} />
                        </div>
                        <span className={cn('font-black text-xs',
                          item.avgProgress >= 80 ? 'text-emerald-600' :
                          item.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600'
                        )}>{item.avgProgress.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("px-3 py-1 rounded-full text-xs font-black",
                        perf.toPct(item.performance) >= 80 ? "bg-emerald-50 text-emerald-600" :
                        perf.toPct(item.performance) >= 50 ? "bg-amber-50 text-amber-600" :
                        "bg-red-50 text-red-600"
                      )}>{perf.formatShort(item.performance)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {pagedRankings.length === 0 && !isFetching && (
            <div className="py-16 text-center text-slate-400 font-bold italic">Không có dữ liệu xếp hạng</div>
          )}
        </div>

        <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
          {isFetching ? (
            <div className="p-6 text-sm text-slate-400">Đang tải...</div>
          ) : pagedRankings.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold italic">Không có dữ liệu xếp hạng</div>
          ) : (
            pagedRankings.map((item, i) => {
              const globalRank = rankPage * RANK_PAGE_SIZE + i
              return (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0",
                      globalRank === 0 ? "bg-amber-500 text-white shadow-lg shadow-amber-200" :
                      globalRank === 1 ? "bg-slate-400 text-white" :
                      globalRank === 2 ? "bg-orange-400 text-white" :
                      "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}>{globalRank + 1}</div>
                    <UserAvatar fullName={item.name} avatarUrl={item.avatar} className="w-9 h-9 rounded-xl shrink-0" fallbackClassName="bg-indigo-50 dark:bg-indigo-900/20 font-black text-indigo-600 text-xs" />
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-[11px] font-bold text-slate-400 truncate">{item.subText}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full',
                        item.avgProgress >= 80 ? 'bg-emerald-500' :
                        item.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      )} style={{ width: `${Math.min(item.avgProgress, 100)}%` }} />
                    </div>
                    <span className={cn('font-black text-xs shrink-0',
                      item.avgProgress >= 80 ? 'text-emerald-600' :
                      item.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600'
                    )}>{item.avgProgress.toFixed(1)}%</span>
                  </div>

                  <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-black",
                      perf.toPct(item.performance) >= 80 ? "bg-emerald-50 text-emerald-600" :
                      perf.toPct(item.performance) >= 50 ? "bg-amber-50 text-amber-600" :
                      "bg-red-50 text-red-600"
                    )}>Hiệu suất {perf.formatShort(item.performance)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
        {totalRankPages > 1 && (
          <Pagination currentPage={rankPage} totalPages={totalRankPages} onPageChange={setRankPage} totalElements={totalRankElements} size={RANK_PAGE_SIZE} itemLabel="nhân viên" />
        )}
      </div>
  )
  // Trục biểu đồ đổi theo tiêu chí đang sắp xếp, để bấm sắp xếp cũng là bấm đổi thứ được so.
  const chartBody = (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      <div className="flex items-center gap-1.5 px-1">
        {([['performance', `Hiệu suất (${perf.unit})`], ['avgProgress', 'Tiến độ trung bình (%)']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => handleSort(v)}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-black transition-all',
              sf === v
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
        {/* Bảng xếp hạng sinh ra để xem hai đầu, không phải để lật từng trang ở giữa. */}
        {([['DESC', 'Cao nhất'], ['ASC', 'Thấp nhất']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setSd(v)}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-black transition-all',
              sd === v
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {isChartFetching ? (
        <div className="py-16 text-center text-slate-400 font-bold">Đang tải...</div>
      ) : chartRankings.length === 0 ? (
        <div className="py-16 text-center text-slate-400 font-bold italic">Không có dữ liệu xếp hạng</div>
      ) : (
        <Lollipop
          data={chartRankings.map(item => ({
            id: item.userId,
            name: item.name,
            subText: item.subText,
            value: sf === 'performance' ? item.performance : item.avgProgress,
          }))}
          unit={sf === 'performance' ? ` ${perf.unit}` : '%'}
          domainMax={sf === 'performance' ? perf.axisMax : 100}
          onSelect={d => { if (d.id) navigate(`/employees/${d.id}/performance`) }}
        />
      )}
      {chartTotal > CHART_TOP_N && (
        <p className="text-[11px] text-slate-400 font-medium text-center">
          {sd === 'DESC' ? `${CHART_TOP_N} người cao nhất` : `${CHART_TOP_N} người thấp nhất`} trong {chartTotal} nhân sự — xem đủ ở chế độ bảng.
        </p>
      )}
    </div>
  )

  const body = view === 'chart' ? chartBody : tableBody

  if (bare) return <div className="h-full flex flex-col overflow-auto custom-scrollbar">{body}</div>
  return (
    <ChartWrapper
      title="Xếp hạng nhân sự"
      icon={<Medal size={20} className="text-indigo-600" />}
      widget={widget!} onTogglePin={onTogglePin!} isEditMode={!!isEditMode}
      extraHeaderContent={
        <>
        <ViewToggleButtons view={view} onChange={setView} />
        <Select
          value={rankingUnitId ?? ALL_UNITS}
          onValueChange={v => { setRankingUnitId(v === ALL_UNITS ? undefined : v); setRankPage(0) }}
        >
          <SelectTrigger className="h-auto gap-2 py-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-sm max-w-[200px]">
            <Filter size={13} className="text-slate-400 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
            {(data?.rankingOptions || []).map((opt: any) => (
              <UnitSelectItem key={opt.id} o={{ code: opt.id, name: opt.name, depth: opt.depth }} />
            ))}
          </SelectContent>
        </Select>
        </>
      }
    >
      {body}
    </ChartWrapper>
  );
}

