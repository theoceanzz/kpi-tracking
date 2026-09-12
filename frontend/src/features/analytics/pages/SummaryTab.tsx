import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSummaryStats, useSummaryRankings } from '../hooks/useAnalytics'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { KpiTreemapLegend } from '../components/KpiTreemapLegend'
import { groupKpisByPeriod } from '../lib/kpiTreeGrouping'
import { WeightBudgetStrip } from '../components/WeightBudgetStrip'
import {
  Target, Star, Users, TrendingUp,
  ChevronRight, AlertTriangle, Medal, ArrowUpRight, ArrowDownRight,
  ChevronDown, Filter, ArrowUpDown, MousePointerClick,
  X, CheckCircle, Building2
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
import AnalyticsTabHeader from '../components/AnalyticsTabHeader'
import { StatCard } from '@/features/dashboard/widgets/shared/StatCard'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'

const CONFIG_REPORT_NAME = '__SUMMARY_DASHBOARD_CONFIG__'


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

  // Ngân sách trọng số theo (đơn vị, đợt). Phải hỏi backend chứ không cộng ở đây: con số này
  // tính theo phân bổ nhân sự cao nhất, bỏ KPI thưởng và KPI cha phân rã — cộng thô cho ra kết
  // luận ngược (đo thật: một chi nhánh ra 200% trong khi luật thật là 70%).
  const { data: weightBudget } = useQuery({
    queryKey: ['orgUnitKpi', 'weightBudget', selectedUnitId, periodId, periodIdTo],
    queryFn: () => orgUnitKpiApi.getWeightBudget({ orgUnitId: selectedUnitId, periodId, periodIdTo }),
  })

  // ── Detail table state ────────────────────────────────────────────────────
  const [filterOrgUnitId, setFilterOrgUnitId] = useState<string | undefined>(undefined)
  const advancedFilter = { orgUnitId: selectedUnitId, periodId, periodIdTo, from, to }

  // ── Biểu đồ theo đợt (chế độ biểu đồ của widget "KPI đơn vị") ────────────
  // Bám ĐÚNG bộ lọc thời gian chung, không có bộ chọn kỳ riêng: bắt người dùng lọc hai lần cho
  // cùng một câu hỏi là thừa. Lấy trọn một lần rồi gom ở client theo đợt → đơn vị, vì thông tin
  // đợt (periodName, periodStart) đã nằm sẵn trong từng dòng KPI.
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())

  // Trước đây widget này có thêm chế độ bảng với truy vấn riêng phân trang 5 dòng. Bỏ bảng thì
  // bỏ luôn truy vấn đó — không còn hai chỗ hỏi cùng một endpoint.
  const { data: allocPage, isLoading: isAllocLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'byPeriod', from, to, onlyApproved, periodId, periodIdTo, selectedUnitId, filterOrgUnitId],
    queryFn: () => orgUnitKpiApi.getDetailedKpis({
      orgUnitId: selectedUnitId,
      from, to, onlyApproved, periodId, periodIdTo,
      filterOrgUnitId,
      page: 0,
      size: ALLOC_FETCH_SIZE,
    }),
  })


  const clearTableFilters = () => setFilterOrgUnitId(undefined)

  const hasTableFilters = !!filterOrgUnitId

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
    <div className="pb-3 mb-3 border-b border-[var(--color-border)] flex flex-wrap items-center gap-3 shrink-0">
      <Select
        value={filterOrgUnitId ?? ALL_UNITS}
        onValueChange={v => setFilterOrgUnitId(v === ALL_UNITS ? undefined : v)}
      >
        <SelectTrigger className="h-9 max-w-[220px] bg-[var(--color-muted)] border-[var(--color-border)] rounded-control text-xs font-semibold text-[var(--color-foreground)]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
          {allocPage?.availableOrgUnits?.map(o => (
            <UnitSelectItem key={o.code} o={o} />
          ))}
        </SelectContent>
      </Select>

      {hasTableFilters && (
        <Button variant="ghost" size="sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={clearTableFilters}>
          <X aria-hidden="true" /> Xóa bộ lọc
        </Button>
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
            <p className="text-caption font-medium flex items-center gap-1.5">
              <MousePointerClick size={13} className="text-[var(--color-primary)] shrink-0" />
              <span>
                Bấm vào một ô để mở chi tiết KPI
                <span className="text-[var(--color-subtle-foreground)] mx-1.5">│</span>
                Diện tích ô = trọng số, màu = tiến độ, ô lồng = KPI được chia xuống
              </span>
            </p>
            <KpiTreemapLegend />
          </div>
        )}
        <div className="flex-1 overflow-auto custom-scrollbar min-h-0 space-y-3 pr-1">
          {isAllocLoading ? (
            <div className="py-16 text-center text-[var(--color-subtle-foreground)] font-semibold">Đang tải...</div>
          ) : periods.length === 0 ? (
            <div className="py-16 text-center text-[var(--color-subtle-foreground)] font-semibold italic">
              Không có KPI nào được đặt trọng số trong khoảng thời gian đang lọc
            </div>
          ) : periods.map(period => {
            // Chỉ để đếm ở tiêu đề; không còn dựng thành khung bọc quanh KPI.
            const units = [...period.units.values()]
            const open = isExpanded(period.key)
            return (
              <section key={period.key} className="border border-[var(--color-border)] rounded-card overflow-hidden">
                <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)]" onClick={() => togglePeriod(period.key)}>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-[var(--color-foreground)] flex items-center gap-2 min-w-0">
                      {open
                        ? <ChevronDown aria-hidden="true" className="text-[var(--color-subtle-foreground)] shrink-0" />
                        : <ChevronRight aria-hidden="true" className="text-[var(--color-subtle-foreground)] shrink-0" />}
                      <span className="truncate">{period.name}</span>
                    </h4>
                    <span className="text-caption shrink-0 tabular-nums">
                      {period.trees.length > 0 && `${period.trees.length} cây phân cấp · `}
                      {units.length} đơn vị · {period.kpiCount} KPI
                    </span>
                  </div>
                </button>

                {open && (
                  <div className="p-4 pt-0 space-y-3">
                    {/* Đặt TRÊN treemap: treemap nói trọng số dồn vào đâu, dải này nói đơn vị nào
                        chưa đủ hoặc đã quá tay — hai câu hỏi khác nhau, câu thứ hai phải trả lời
                        trước vì nó chặn cả bước gửi duyệt. */}
                    <WeightBudgetStrip rows={(weightBudget ?? []).filter(r => r.periodName === period.name)} />
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
          <p className="text-caption font-medium text-center shrink-0">
            {skipped} KPI chưa đặt trọng số nên không có diện tích để vẽ. Xem chúng ở trang Quản lý chỉ tiêu.
          </p>
        )}
        {truncated && (
          <p className="text-xs text-[var(--color-warning)] font-medium text-center shrink-0">
            Khoảng lọc này có {allocPage?.totalElements} KPI, biểu đồ chỉ vẽ {ALLOC_FETCH_SIZE} mục đầu — thu hẹp bộ lọc để xem đủ.
          </p>
        )}
      </div>
    )
  }

  const renderWidgetContent = (widget: SummaryWidget) => {
    switch (widget.type) {
      case 'TREND_CHART': return (
        <ChartWrapper chromeless title="Xu hướng KPI theo thời gian" icon={<TrendingUp size={20} className="text-[var(--color-primary)]" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <AnalyticsComboChart data={chartData?.points || []} isLoading={isChartLoading} itemName="KPI đơn vị" fillHeight />
        </ChartWrapper>
      )
      case 'KPI_DETAIL': return (
        <ChartWrapper
          title="Phân bổ trọng số & tiến độ KPI"
          icon={<Target size={20} className="text-[var(--color-primary)]" />}
          widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}
          extraHeaderContent={
            <span className="text-caption">{allocPage?.totalElements ?? 0} KPI</span>
          }
        >
          {renderKpiByPeriodBody()}
        </ChartWrapper>
      )
      case 'UNIT_PERFORMANCE': return (
        <ChartWrapper title="Hiệu suất, tiến độ & tình hình nộp theo đơn vị" icon={<TrendingUp size={20} className="text-[var(--color-success)]" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <UnitComparisonBarChart orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} />
        </ChartWrapper>
      )
      case 'MEMBER_DIST': return (
        <ChartWrapper title="Nhân sự & vai trò theo đơn vị" icon={<Users size={20} className="text-[var(--color-primary)]" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
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
    <div className="space-y-4 pb-12">
      <AnalyticsTabHeader
        title="KPI đơn vị"
        description="Thống kê tổng hợp theo đơn vị: số liệu, biểu đồ và bảng chi tiết cùng dùng một bộ lọc."
        actions={<DashboardEditToolbar api={dash} />}
        filters={<>
            <Select
              value={selectedUnitId ?? ALL_UNITS}
              onValueChange={v => setSelectedUnitId(v === ALL_UNITS ? undefined : v)}
            >
              <SelectTrigger className="h-9 w-full sm:w-[210px] shrink-0" aria-label="Đơn vị">
                <Building2 size={14} className="mr-1 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                <SelectValue placeholder="Tất cả đơn vị" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
                {unitOptions.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {controls}</>}
      />

      {/* ── Metrics ───────────────────────────────────────────────────────── */}
      {isMetricsLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-[var(--color-muted)] rounded-card" />
          ))}
        </div>
      ) : (
        <div id="tour-analytics-metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Tiến độ trung bình" value={`${metrics?.averageProgress?.toFixed(1) ?? 0}%`} icon={<TrendingUp />} color="indigo" />
          <StatCard label="Hiệu suất TB (đánh giá)" value={perf.format(metrics?.averagePerformance ?? 0)} icon={<Target />} color="emerald" />
          <StatCard
            label="Trạng thái KPI"
            value={<p className="text-stat truncate">{metrics?.runningKpis ?? 0} <span className="text-sm font-normal text-[var(--color-muted-foreground)]">đang chạy</span></p>}
            sub={<span className="text-[var(--color-success)]">{metrics?.completedKpis ?? 0} hoàn thành</span>}
            icon={<CheckCircle />}
            color="amber"
          />
          <StatCard label="KPI rủi ro / chậm" value={metrics?.riskKpis ?? 0} icon={<AlertTriangle />} color="red" highlight={(metrics?.riskKpis ?? 0) > 0} />
          <StatCard label="Tổng nhân sự" value={mainData?.totalMembers ?? '—'} icon={<Users />} color="blue" />
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
        <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <div
                className="h-3.5 bg-[var(--color-muted)] rounded-control animate-pulse"
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
              <tr className="text-eyebrow text-left border-b border-[var(--color-border)]">
                <th className="px-6 py-4">Hạng</th>
                <th className="px-6 py-4">Nhân viên</th>
                <th className="px-6 py-4">Đơn vị</th>
                <th className="px-6 py-4 text-center cursor-pointer hover:text-[var(--color-primary)]" onClick={() => handleSort('avgProgress')}>
                  Tiến độ trung bình {sortIcon('avgProgress')}
                </th>
                <th className="px-6 py-4 text-center cursor-pointer hover:text-[var(--color-primary)]" onClick={() => handleSort('performance')}>
                  Hiệu suất {sortIcon('performance')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {isFetching ? (
                <TableSkeletonRows cols={5} count={5} />
              ) : pagedRankings.map((item, i) => {
                const globalRank = rankPage * RANK_PAGE_SIZE + i
                return (
                  <tr key={i} className="hover:bg-[var(--color-muted)] transition-colors group">
                    <td className="px-6 py-4">
                      <div className={cn("w-8 h-8 rounded-control flex items-center justify-center font-semibold text-xs",
                        globalRank === 0 ? "bg-[var(--color-warning-solid)] text-white": 
                        globalRank === 1 ? "bg-slate-400 text-white" :
                        globalRank === 2 ? "bg-[var(--color-warning-solid)] text-white" :
"bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]"
                      )}>{globalRank + 1}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar fullName={item.name} avatarUrl={item.avatar} className="w-9 h-9 rounded-card" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)] text-xs" />
                        <p className="font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors">{item.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-[var(--color-muted-foreground)] text-xs">{item.subText}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full',
                            item.avgProgress >= 80 ? 'bg-[var(--color-success-solid)]' :
                            item.avgProgress >= 50 ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-error-solid)]'
                          )} style={{ width: `${Math.min(item.avgProgress, 100)}%` }} />
                        </div>
                        <span className={cn('font-semibold text-xs',
                          item.avgProgress >= 80 ? 'text-[var(--color-success)]' :
                          item.avgProgress >= 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'
                        )}>{item.avgProgress.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("px-3 py-1 rounded-full text-xs font-semibold",
                        perf.toPct(item.performance) >= 80 ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" :
                        perf.toPct(item.performance) >= 50 ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]" :
                        "bg-[var(--color-error-bg)] text-[var(--color-error)]"
                      )}>{perf.formatShort(item.performance)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {pagedRankings.length === 0 && !isFetching && (
            <div className="py-16 text-center text-[var(--color-subtle-foreground)] font-semibold italic">Không có dữ liệu xếp hạng</div>
          )}
        </div>

        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {isFetching ? (
            <div className="p-6 text-sm text-[var(--color-subtle-foreground)]">Đang tải...</div>
          ) : pagedRankings.length === 0 ? (
            <div className="py-16 text-center text-[var(--color-subtle-foreground)] font-semibold italic">Không có dữ liệu xếp hạng</div>
          ) : (
            pagedRankings.map((item, i) => {
              const globalRank = rankPage * RANK_PAGE_SIZE + i
              return (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-control flex items-center justify-center font-semibold text-xs shrink-0",
                      globalRank === 0 ? "bg-[var(--color-warning-solid)] text-white": 
                      globalRank === 1 ? "bg-slate-400 text-white" :
                      globalRank === 2 ? "bg-[var(--color-warning-solid)] text-white" :
"bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]"
                    )}>{globalRank + 1}</div>
                    <UserAvatar fullName={item.name} avatarUrl={item.avatar} className="w-9 h-9 rounded-card shrink-0" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)] text-xs" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-foreground)] truncate">{item.name}</p>
                      <p className="text-caption truncate">{item.subText}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full',
                        item.avgProgress >= 80 ? 'bg-[var(--color-success-solid)]' :
                        item.avgProgress >= 50 ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-error-solid)]'
                      )} style={{ width: `${Math.min(item.avgProgress, 100)}%` }} />
                    </div>
                    <span className={cn('font-semibold text-xs shrink-0',
                      item.avgProgress >= 80 ? 'text-[var(--color-success)]' :
                      item.avgProgress >= 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'
                    )}>{item.avgProgress.toFixed(1)}%</span>
                  </div>

                  <div className="flex items-center justify-end pt-1 border-t border-[var(--color-border)] text-xs">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-semibold",
                      perf.toPct(item.performance) >= 80 ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" :
                      perf.toPct(item.performance) >= 50 ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]" :
                      "bg-[var(--color-error-bg)] text-[var(--color-error)]"
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
          <ChoiceChip selected={sf === v} variant="solid" size="sm" className="py-1" key={v} onClick={() => handleSort(v)}>
            {label}
          </ChoiceChip>
        ))}
        <span className="w-px h-4 bg-[var(--color-border)] mx-1" />
        {/* Bảng xếp hạng sinh ra để xem hai đầu, không phải để lật từng trang ở giữa. */}
        {([['DESC', 'Cao nhất'], ['ASC', 'Thấp nhất']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setSd(v)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-all',
              sd === v
                ? 'bg-[var(--color-foreground)] text-[var(--color-background)] shadow-sm'
                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {isChartFetching ? (
        <div className="py-16 text-center text-[var(--color-subtle-foreground)] font-semibold">Đang tải...</div>
      ) : chartRankings.length === 0 ? (
        <div className="py-16 text-center text-[var(--color-subtle-foreground)] font-semibold italic">Không có dữ liệu xếp hạng</div>
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
        <p className="text-caption font-medium text-center">
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
      icon={<Medal size={20} className="text-[var(--color-primary)]" />}
      widget={widget!} onTogglePin={onTogglePin!} isEditMode={!!isEditMode}
      extraHeaderContent={
        <>
        <ViewToggleButtons view={view} onChange={setView} />
        <Select
          value={rankingUnitId ?? ALL_UNITS}
          onValueChange={v => { setRankingUnitId(v === ALL_UNITS ? undefined : v); setRankPage(0) }}
        >
          <SelectTrigger className="h-auto gap-2 py-2 bg-[var(--color-card)] border-[var(--color-border)] rounded-card text-xs font-medium shadow-sm max-w-[200px]">
            <Filter size={13} className="text-[var(--color-subtle-foreground)] shrink-0" />
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

