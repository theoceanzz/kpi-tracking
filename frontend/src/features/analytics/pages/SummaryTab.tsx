import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSummaryStats, useSummaryRankings } from '../hooks/useAnalytics'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { KpiTreemapLegend } from '../components/KpiTreemapLegend'
import { groupKpisByPeriod } from '../lib/kpiTreeGrouping'
import { WeightBudgetStrip } from '../components/WeightBudgetStrip'
import {
  Target, Users, TrendingUp,
  ChevronRight, Medal, ArrowUpRight, ArrowDownRight,
  ChevronDown, Filter, ArrowUpDown, MousePointerClick,
} from 'lucide-react'
import AnalyticsTabSkeleton from '@/components/common/AnalyticsTabSkeleton'
import type { RankingItem } from '@/types/stats'
import { useNavigate } from 'react-router-dom'
import Lollipop from '@/components/charts/primitives/Lollipop'
import HierarchicalTreemap, { type TreeNode } from '@/components/charts/primitives/HierarchicalTreemap'
import {
  ScoreHistogramWidget, SelfVsManagerWidget,
} from '../components/advanced/SummaryAdvanced'
import { useChartTableView } from '@/components/common/dashboard/useChartTableView'
import { ViewToggleButtons } from '@/components/common/dashboard/ViewToggleButtons'
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
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import {
  useAnalyticsGrid, useAnalyticsScopeData, useUnitOptions, widgetFilter, widgetUnit, widgetVariant, tableViewControl, optionOf,
  PAGE_DEFAULT_INTENT,
} from '../grid/analyticsGrid'
import { UnitKpiMetrics } from '../components/pinned/metricWidgets'
import { usePinToHome } from '../grid/usePinToHome'
import WidgetConfigPanel from '../grid/WidgetConfigPanel'
import WidgetConfigSummary from '../grid/WidgetConfigSummary'

/** Tên "report ẩn" của kho cũ — chỉ còn dùng để vớt bố cục một lần. */
const LEGACY_REPORT_NAME = '__SUMMARY_DASHBOARD_CONFIG__'


// Biểu đồ phân bổ lấy TRỌN một kỳ chứ không phân trang. Trần này chỉ để chặn một tổ chức bất
// thường kéo về hàng nghìn dòng; chạm trần thì biểu đồ báo rõ chứ không cắt cụt im lặng.
const ALLOC_FETCH_SIZE = 500

// Số mục biểu đồ xếp hạng vẽ ở mỗi đầu (cao nhất hoặc thấp nhất).
const CHART_TOP_N = 15

// Sentinel cho mục "Tất cả đơn vị" — shadcn/Radix Select không cho phép value rỗng.
const ALL_UNITS = '__ALL__'

/** Cây đơn vị → danh sách phẳng, thụt lề theo độ sâu để vẫn đọc được thứ bậc trong dropdown. */

type SummaryWidget = DashboardWidget

const DEFAULT_SUMMARY_WIDGETS: SummaryWidget[] = [
  // Hàng thẻ chỉ số từng nằm NGOÀI lưới, bám hai bộ chọn (đơn vị, khoảng thời gian) trên đầu trang.
  // Hai bộ chọn đó nay nằm trong bảng cấu hình của từng ô, nên hàng thẻ cũng phải là một ô — cùng id
  // với danh mục trang chủ để ghim được ngay.
  { i: 'unit-kpi-metrics', type: 'STATS', title: 'Số liệu tổng hợp', x: 0, y: 0, w: 12, h: 4, visible: true },
  // Thứ tự đọc: xu hướng chung → so sánh giữa các đơn vị → chi tiết từng KPI → nhân sự.
  // Chiều cao tính ra pixel là `48h − 16` (rowHeight 32 + margin 16), nên mỗi đơn vị `h` đắt 48px —
  // đây là chỗ dễ vô tình làm trang dài gấp đôi nhất.
  { i: 'trend-chart', type: 'TREND_CHART', title: 'Xu hướng KPI theo thời gian', x: 0, y: 4, w: 12, h: 11, visible: true },
  { i: 'unit-perf', type: 'UNIT_PERFORMANCE', title: 'Hiệu suất & tiến độ đơn vị', x: 0, y: 15, w: 12, h: 11, visible: true },
  { i: 'kpi-detail', type: 'KPI_DETAIL', title: 'Phân bổ trọng số & tiến độ KPI', x: 0, y: 26, w: 12, h: 14, visible: true },
  // Hai khối nhân sự xếp CẠNH nhau: cả hai đều là danh sách dọc nên chịu được nửa chiều ngang,
  // và đọc cùng nhau mới trả lời được "đơn vị nào đông người mà xếp hạng lại thấp".
  { i: 'member-dist', type: 'MEMBER_DIST', title: 'Nhân sự & vai trò theo đơn vị', x: 0, y: 40, w: 6, h: 10, visible: true },
  { i: 'rank-table', type: 'RANKING_TABLE', title: 'Xếp hạng nhân sự', x: 6, y: 40, w: 6, h: 10, visible: true },
  // Biểu đồ chuyên sâu — mặc định ẩn để lưới không phình ra với người chỉ cần vài chỉ số quen thuộc;
  // bật lại bất cứ lúc nào qua "Tuỳ chỉnh → Ẩn/Hiện".
  { i: 'score-histogram', type: 'SCORE_HISTOGRAM', title: 'Phân phối điểm đánh giá', x: 0, y: 50, w: 6, h: 12, visible: false },
  { i: 'self-vs-manager', type: 'SELF_VS_MANAGER', title: 'Tự đánh giá vs Quản lý đánh giá', x: 6, y: 50, w: 6, h: 12, visible: false },
]

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
const GROUP_OF: Record<string, string> = {
  'unit-kpi-metrics': 'Số liệu',
  'trend-chart': 'Biểu đồ xu hướng',
  'unit-perf': 'Biểu đồ so sánh',
  'self-vs-manager': 'Biểu đồ so sánh',
  'kpi-detail': 'Từ bộ phận đến tổng thể',
  'member-dist': 'Từ bộ phận đến tổng thể',
  'score-histogram': 'Biểu đồ phân phối',
  'rank-table': 'Biểu đồ xếp hạng',
}
const PREVIEW_OF: Record<string, 'line' | 'groupedBar' | 'treemap' | 'stackedBar' | 'histogram' | 'lollipop' | 'metricCard'> = {
  'unit-kpi-metrics': 'metricCard',
  'trend-chart': 'line',
  'unit-perf': 'groupedBar',
  'self-vs-manager': 'groupedBar',
  'kpi-detail': 'treemap',
  'member-dist': 'stackedBar',
  'score-histogram': 'histogram',
  'rank-table': 'lollipop',
}
const DESC_OF: Record<string, string> = {
  'unit-kpi-metrics': 'Tiến độ, hiệu suất, trạng thái KPI, số KPI rủi ro và tổng nhân sự.',
  'trend-chart': 'Số KPI và hiệu suất đơn vị qua từng mốc thời gian.',
  'unit-perf': 'So sánh hiệu suất, tiến độ và tình hình nộp giữa các đơn vị.',
  'kpi-detail': 'Trọng số và tiến độ từng KPI, lồng theo quan hệ cha con.',
  'member-dist': 'Cơ cấu nhân sự theo vai trò trong từng đơn vị.',
  'rank-table': 'Xếp hạng nhân sự theo điểm hiệu suất.',
  'score-histogram': 'Hình dạng phân phối điểm đánh giá.',
  'self-vs-manager': 'Điểm tự đánh giá đặt cạnh điểm quản lý chấm.',
}
const SUMMARY_CATALOG = DEFAULT_SUMMARY_WIDGETS.map(t => ({
  template: t,
  icon: null,
  groupLabel: GROUP_OF[t.i],
  preview: PREVIEW_OF[t.i],
  description: DESC_OF[t.i],
}))

export default function SummaryTab() {
  const onlyApproved = false
  const { periods, cycles } = useAnalyticsScopeData()
  // Không còn bộ lọc cấp trang: đơn vị lẫn khoảng thời gian đều nằm trong cài đặt từng ô. "Mặc định"
  // chỉ còn là hằng số cho ô chưa đặt gì.
  const pageIntent = PAGE_DEFAULT_INTENT
  const pin = usePinToHome()
  const dash = useAnalyticsGrid({
    scope: 'ANALYTICS_SUMMARY',
    defaultWidgets: DEFAULT_SUMMARY_WIDGETS,
    legacyReportName: LEGACY_REPORT_NAME,
  })
  /** Khoảng của một ô cụ thể: riêng nếu đã đặt, không thì theo mặc định. */
  const filterOf = (i: string) => widgetFilter(dash.widgets.find(w => w.i === i), pageIntent, periods, cycles)
  /** Đơn vị (phạm vi con) của một ô — `undefined` = toàn bộ phạm vi quyền. */
  const unitOf = (i: string) => widgetUnit(dash.widgets.find(w => w.i === i))
  const trendF = filterOf('trend-chart')
  const allocF = filterOf('kpi-detail')
  const unitOptions = useUnitOptions()

  // ── New KPI data ──────────────────────────────────────────────────────────
  // Đơn vị của ô phải nằm trong CẢ queryKey lẫn params. Thiếu ở queryKey thì React Query coi hai
  // đơn vị khác nhau là cùng một truy vấn và phục vụ lại số của đơn vị trước.
  const trendUnit = unitOf('trend-chart')
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'chart', trendF.from, trendF.to, onlyApproved, trendF.periodId, trendF.periodIdTo, trendF.groupBy, trendUnit],
    queryFn: () => orgUnitKpiApi.getComboChart({ orgUnitId: trendUnit, from: trendF.from, to: trendF.to, onlyApproved, periodId: trendF.periodId, periodIdTo: trendF.periodIdTo, groupBy: trendF.groupBy }),
  })

  // Ngân sách trọng số theo (đơn vị, đợt). Phải hỏi backend chứ không cộng ở đây: con số này
  // tính theo phân bổ nhân sự cao nhất, bỏ KPI thưởng và KPI cha phân rã — cộng thô cho ra kết
  // luận ngược (đo thật: một chi nhánh ra 200% trong khi luật thật là 70%).
  // Dải ngân sách nằm trong ô "Phân bổ trọng số" nên bám đúng đơn vị + đợt của ô đó (trước bám
  // khoảng cấp trang: đổi đợt riêng cho ô thì dải không đổi theo).
  const allocUnit = unitOf('kpi-detail')
  const { data: weightBudget } = useQuery({
    queryKey: ['orgUnitKpi', 'weightBudget', allocUnit, allocF.periodId, allocF.periodIdTo],
    queryFn: () => orgUnitKpiApi.getWeightBudget({ orgUnitId: allocUnit, periodId: allocF.periodId, periodIdTo: allocF.periodIdTo }),
  })

  // ── Biểu đồ theo đợt (chế độ biểu đồ của widget "KPI đơn vị") ────────────
  // Bám ĐÚNG bộ lọc thời gian chung, không có bộ chọn kỳ riêng: bắt người dùng lọc hai lần cho
  // cùng một câu hỏi là thừa. Lấy trọn một lần rồi gom ở client theo đợt → đơn vị, vì thông tin
  // đợt (periodName, periodStart) đã nằm sẵn trong từng dòng KPI.
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())

  // Trước đây widget này có thêm chế độ bảng với truy vấn riêng phân trang 5 dòng. Bỏ bảng thì
  // bỏ luôn truy vấn đó — không còn hai chỗ hỏi cùng một endpoint.
  const { data: allocPage, isLoading: isAllocLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'byPeriod', allocF.from, allocF.to, onlyApproved, allocF.periodId, allocF.periodIdTo, allocUnit],
    queryFn: () => orgUnitKpiApi.getDetailedKpis({
      // Đơn vị trong cài đặt ô là PHẠM VI (đơn vị + cây con) — cùng nghĩa với bộ chọn cấp trang
      // đã bỏ, không phải bộ lọc "KPI thuộc đúng đơn vị này" như dropdown cũ trong thân ô.
      orgUnitId: allocUnit,
      from: allocF.from, to: allocF.to, onlyApproved, periodId: allocF.periodId, periodIdTo: allocF.periodIdTo,
      page: 0,
      size: ALLOC_FETCH_SIZE,
    }),
  })


  // ── Drawer state ──────────────────────────────────────────────────────────
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)

  // ── Existing summary data (unchanged widgets) ─────────────────────────────
  const { data: mainData, isLoading: isMainLoading } = useSummaryStats(unitOf('member-dist'))
  // ── Widget config (dùng hook + chrome dùng chung) ─────────────────────────


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
        {!isAllocLoading && periods.length > 0 && (
          <div className="shrink-0 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <MousePointerClick size={13} className="text-[var(--color-primary)] shrink-0" />
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
            <div className="py-16 text-center text-slate-400 font-medium">Đang tải...</div>
          ) : periods.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-medium italic">
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
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
                      {open
                        ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
                        : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                      <span className="truncate">{period.name}</span>
                    </h4>
                    <span className="text-xs font-medium text-slate-400 shrink-0 tabular-nums">
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
          <p className="text-xs text-slate-400 font-medium text-center shrink-0">
            {skipped} KPI chưa đặt trọng số nên không có diện tích để vẽ. Xem chúng ở trang Quản lý chỉ tiêu.
          </p>
        )}
        {truncated && (
          <p className="text-xs text-amber-600 font-semibold text-center shrink-0">
            Khoảng lọc này có {allocPage?.totalElements} KPI, biểu đồ chỉ vẽ {ALLOC_FETCH_SIZE} mục đầu. Thu hẹp bộ lọc để xem đủ.
          </p>
        )}
      </div>
    )
  }

  const renderWidgetContent = (widget: SummaryWidget, ctx: { openConfig: () => void }) => {
    // Mỗi ô tự mang khoảng thời gian của riêng nó (hoặc mặc định trang nếu chưa đặt).
    const f = filterOf(widget.i)
    const unit = widgetUnit(widget)
    const advancedFilter = { orgUnitId: unit, periodId: f.periodId, periodIdTo: f.periodIdTo, from: f.from, to: f.to }
    // Dòng tóm tắt "ô này đang theo cấu hình gì" — bấm vào là mở đúng bảng cấu hình của ô.
    const meta = (
      <WidgetConfigSummary
        widget={widget} pageIntent={pageIntent} periods={periods} cycles={cycles}
        unitOptions={unitOptions} onOpen={ctx.openConfig}
      />
    )
    const set = (patch: Parameters<typeof dash.updateWidgetSettings>[1]) => dash.updateWidgetSettings(widget.i, patch)
    switch (widget.type) {
      case 'STATS': return (
        // Chromeless: mỗi thẻ đã là một card, bọc thêm card nữa là card lồng card. Chip ở trên
        // cho biết hàng số này đang theo đơn vị nào, khoảng nào.
        <div id="tour-analytics-metrics" className="h-full flex flex-col gap-2 min-h-0">
          {meta}
          <UnitKpiMetrics filter={{ from: f.from, to: f.to, periodId: f.periodId, periodIdTo: f.periodIdTo, onlyApproved }} orgUnitId={unit} />
        </div>
      )
      case 'TREND_CHART': return (
        <ChartWrapper chromeless title="Xu hướng KPI theo thời gian" icon={<TrendingUp size={20} className="text-slate-400" />}>
          <AnalyticsComboChart
            data={chartData?.points || []}
            isLoading={isChartLoading}
            itemName="KPI đơn vị"
            fillHeight
            mode={widgetVariant(widget) === 'area' ? 'share' : 'trend'}
            onModeChange={m => set({ v: m === 'share' ? 'area' : 'line' })}
            hideModeToggle
            meta={meta}
          />
        </ChartWrapper>
      )
      case 'KPI_DETAIL': return (
        <ChartWrapper
          title="Phân bổ trọng số & tiến độ KPI"
          icon={<Target size={20} className="text-slate-400" />}
          meta={meta}
          extraHeaderContent={
            <span className="text-xs font-medium text-slate-400">{allocPage?.totalElements ?? 0} KPI</span>
          }
        >
          {renderKpiByPeriodBody()}
        </ChartWrapper>
      )
      case 'UNIT_PERFORMANCE': return (
        <ChartWrapper title="Hiệu suất & tiến độ đơn vị" icon={<TrendingUp size={20} className="text-slate-400" />} meta={meta}>
          <UnitComparisonBarChart
            orgUnitId={unit}
            from={f.from} to={f.to} onlyApproved={onlyApproved} periodId={f.periodId} periodIdTo={f.periodIdTo}
            rank={optionOf(widget, 'rank') as 'BEST' | 'WORST'}
            topN={optionOf(widget, 'topN') as 'ALL' | '5' | '10'}
            hideControls
          />
        </ChartWrapper>
      )
      case 'MEMBER_DIST': return (
        <ChartWrapper title="Nhân sự & vai trò theo đơn vị" icon={<Users size={20} className="text-slate-400" />} meta={meta}>
          <MemberRoleChart data={mainData?.roleDistribution} />
        </ChartWrapper>
      )
      case 'SCORE_HISTOGRAM': return <ScoreHistogramWidget filter={advancedFilter} meta={meta} />
      case 'SELF_VS_MANAGER': return <SelfVsManagerWidget filter={advancedFilter} meta={meta} />
      case 'RANKING_TABLE': return (
        <EmployeeRankingTableSection
          orgUnitId={unit}
          from={f.from} to={f.to} onlyApproved={onlyApproved} periodId={f.periodId} periodIdTo={f.periodIdTo}
          viewControl={tableViewControl(widget, dash.updateWidgetSettings)}
          metric={optionOf(widget, 'metric') as 'performance' | 'avgProgress'}
          dir={optionOf(widget, 'dir') as 'ASC' | 'DESC'}
          onSortChange={(m, d) => set({ o: { ...widget.s?.o, metric: m, dir: d } })}
          hideControls
          meta={meta}
        />
      )
      default: return null
    }
  }

  if (isMainLoading && !mainData) return <AnalyticsTabSkeleton variant="default" className="p-6" />

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">KPI đơn vị tôi phụ trách</h2>
        <div id="tour-analytics-customize" className="flex items-center gap-3 flex-wrap">
          <DashboardEditToolbar api={dash} />
        </div>
      </div>

      {/* Hàng thẻ chỉ số nay là ô đầu lưới (unit-kpi-metrics) — bộ chọn đơn vị & khoảng thời gian
          của nó nằm trong bảng cấu hình như mọi ô khác. */}

      {/* Biểu đồ xu hướng & bảng chi tiết KPI giờ là widget trong lưới tuỳ chỉnh bên dưới. */}

      {/* ── Lưới widget tuỳ chỉnh ─────────────────────────────────────────── */}
      <div id="tour-analytics-widgets">
        <DashboardCustomizeChrome
          api={dash}
          renderWidget={renderWidgetContent}
          catalog={SUMMARY_CATALOG}
          ready={!!mainData}
          onTogglePin={pin.enabled ? pin.toggle : undefined}
          isPinned={pin.isPinned}
          renderConfig={(w, update) => (
            <WidgetConfigPanel
              widget={w} update={update} pageIntent={pageIntent} periods={periods} cycles={cycles}
              unitOptions={unitOptions}
            />
          )}
        />
      </div>

      {/* AiAssistantWidget đã chuyển sang AppLayout để hiện trên mọi trang */}

      {selectedKpiId && (
        <OrgUnitKpiDrawer
          kpiId={selectedKpiId}
          onClose={() => setSelectedKpiId(null)}
          globalFrom={allocF.from}
          globalTo={allocF.to}
          globalOnlyApproved={onlyApproved}
          globalPeriodId={allocF.periodId}
          globalPeriodIdTo={allocF.periodIdTo}
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

export function EmployeeRankingTableSection({
  orgUnitId, from, to, onlyApproved, periodId, periodIdTo, bare, viewControl,
  unitId, metric, dir, onSortChange, hideControls, meta,
}: {
  orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string; bare?: boolean
  viewControl?: { value?: 'chart' | 'table'; onChange?: (v: 'chart' | 'table') => void }
  /** Ba lựa chọn do bảng cấu hình của ô điều khiển. Bỏ trống thì component tự giữ (thẻ trang chủ). */
  unitId?: string
  metric?: 'performance' | 'avgProgress'
  dir?: 'ASC' | 'DESC'
  /** Bấm sort header của bảng khi đang bị điều khiển → báo ra ngoài để ghi vào cài đặt ô. */
  onSortChange?: (metric: 'performance' | 'avgProgress', dir: 'ASC' | 'DESC') => void
  /** Ẩn cụm nút tại chỗ (biểu đồ/bảng, chọn đơn vị, pills) khi đã nằm trong bảng cấu hình. */
  hideControls?: boolean
  /** Dòng tóm tắt cấu hình do lưới cấp. */
  meta?: React.ReactNode
}) {
  const [localUnitId, setRankingUnitId] = useState<string | undefined>(undefined)
  const [localSf, setSf] = useState<'performance' | 'avgProgress'>('performance')
  const [localSd, setSd] = useState<'ASC' | 'DESC'>('DESC')
  const rankingUnitId = unitId ?? localUnitId
  const sf = metric ?? localSf
  const sd = dir ?? localSd
  const [rankPage, setRankPage] = useState(0)
  const perf = usePerformanceScale()
  const navigate = useNavigate()
  const { view, setView } = useChartTableView('rank-table', 'chart', viewControl)
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
    const nextDir: 'ASC' | 'DESC' = sf === field ? (sd === 'ASC' ? 'DESC' : 'ASC') : 'DESC'
    if (onSortChange) onSortChange(field, nextDir)
    else { setSf(field); setSd(nextDir) }
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
              <tr className="text-left text-xs font-medium text-slate-400 border-b border-slate-100 dark:border-slate-800">
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
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isFetching ? (
                <TableSkeletonRows cols={5} count={5} />
              ) : pagedRankings.map((item, i) => {
                const globalRank = rankPage * RANK_PAGE_SIZE + i
                return (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-medium text-xs",
                        globalRank === 0 ? "bg-amber-500 text-white shadow-sm" :
                        globalRank === 1 ? "bg-slate-400 text-white" :
                        globalRank === 2 ? "bg-orange-400 text-white" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      )}>{globalRank + 1}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar fullName={item.name} avatarUrl={item.avatar} className="w-9 h-9 rounded-lg" fallbackClassName="bg-indigo-50 dark:bg-indigo-900/20 font-semibold text-[var(--color-primary)] text-xs" />
                        <p className="font-semibold text-slate-900 dark:text-white group-hover:text-[var(--color-primary)] transition-colors">{item.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500 text-xs">{item.subText}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full',
                            item.avgProgress >= 80 ? 'bg-emerald-500' :
                            item.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          )} style={{ width: `${Math.min(item.avgProgress, 100)}%` }} />
                        </div>
                        <span className={cn('font-semibold text-xs',
                          item.avgProgress >= 80 ? 'text-emerald-600' :
                          item.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600'
                        )}>{item.avgProgress.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("px-3 py-1 rounded-full text-xs font-semibold",
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
            <div className="py-16 text-center text-slate-400 font-medium italic">Không có dữ liệu xếp hạng</div>
          )}
        </div>

        <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
          {isFetching ? (
            <div className="p-6 text-sm text-slate-400">Đang tải...</div>
          ) : pagedRankings.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-medium italic">Không có dữ liệu xếp hạng</div>
          ) : (
            pagedRankings.map((item, i) => {
              const globalRank = rankPage * RANK_PAGE_SIZE + i
              return (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-medium text-xs shrink-0",
                      globalRank === 0 ? "bg-amber-500 text-white shadow-sm" :
                      globalRank === 1 ? "bg-slate-400 text-white" :
                      globalRank === 2 ? "bg-orange-400 text-white" :
                      "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}>{globalRank + 1}</div>
                    <UserAvatar fullName={item.name} avatarUrl={item.avatar} className="w-9 h-9 rounded-lg shrink-0" fallbackClassName="bg-indigo-50 dark:bg-indigo-900/20 font-semibold text-[var(--color-primary)] text-xs" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-xs font-medium text-slate-400 truncate">{item.subText}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full',
                        item.avgProgress >= 80 ? 'bg-emerald-500' :
                        item.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      )} style={{ width: `${Math.min(item.avgProgress, 100)}%` }} />
                    </div>
                    <span className={cn('font-semibold text-xs shrink-0',
                      item.avgProgress >= 80 ? 'text-emerald-600' :
                      item.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600'
                    )}>{item.avgProgress.toFixed(1)}%</span>
                  </div>

                  <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-semibold",
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
      {!hideControls && (
      <div className="flex items-center gap-1.5 px-1">
        {([['performance', `Hiệu suất (${perf.unit})`], ['avgProgress', 'Tiến độ trung bình (%)']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => handleSort(v)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all',
              sf === v
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
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
              'px-3 py-1 rounded-full text-xs font-medium transition-all',
              sd === v
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      )}
      {isChartFetching ? (
        <div className="py-16 text-center text-slate-400 font-medium">Đang tải...</div>
      ) : chartRankings.length === 0 ? (
        <div className="py-16 text-center text-slate-400 font-medium italic">Không có dữ liệu xếp hạng</div>
      ) : (
        <Lollipop
          data={chartRankings.map(item => ({
            id: item.userId,
            name: item.name,
            subText: item.subText,
            value: sf === 'performance' ? item.performance : item.avgProgress,
          }))}
          unit={sf === 'performance' ? ` ${perf.unit}` : '%'}
          valueLabel={sf === 'performance' ? `Hiệu suất (${perf.unit})` : 'Tiến độ (%)'}
          domainMax={sf === 'performance' ? perf.axisMax : 100}
          onSelect={d => { if (d.id) navigate(`/employees/${d.id}/performance`) }}
        />
      )}
      {chartTotal > CHART_TOP_N && (
        <p className="text-xs text-slate-400 font-medium text-center">
          {sd === 'DESC' ? `${CHART_TOP_N} người cao nhất` : `${CHART_TOP_N} người thấp nhất`} trong {chartTotal} nhân sự. Xem đủ ở chế độ bảng.
        </p>
      )}
    </div>
  )

  const body = view === 'chart' ? chartBody : tableBody

  if (bare) return <div className="h-full flex flex-col overflow-auto custom-scrollbar">{body}</div>
  return (
    <ChartWrapper
      title="Xếp hạng nhân sự"
      icon={<Medal size={20} className="text-slate-400" />}
      meta={meta}
      extraHeaderContent={hideControls ? undefined : (
        <>
        <ViewToggleButtons view={view} onChange={setView} />
        <Select
          value={rankingUnitId ?? ALL_UNITS}
          onValueChange={v => { setRankingUnitId(v === ALL_UNITS ? undefined : v); setRankPage(0) }}
        >
          <SelectTrigger className="h-auto gap-2 py-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-sm max-w-[200px]">
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
      )}
    >
      {body}
    </ChartWrapper>
  );
}

