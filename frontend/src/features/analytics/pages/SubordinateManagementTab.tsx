import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import AnalyticsComboChart from '../components/AnalyticsComboChart'
import ObjectiveDetailsWidget from '../components/ObjectiveDetailsWidget'
import UnitComparisonBarChart from '../components/UnitComparisonBarChart'
import MemberRoleChart from '../components/MemberRoleChart'
import { useSummaryStats } from '../hooks/useAnalytics'
import { OkrFlowSection } from '../components/advanced/OkrAdvanced'
import { Target, TrendingUp, Users, Network } from 'lucide-react'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import {
  useAnalyticsGrid, useAnalyticsScopeData, useUnitOptions, usePositionLayout, widgetFilter, widgetVariant, tableViewControl,
  optionOf, PAGE_DEFAULT_INTENT,
} from '../grid/analyticsGrid'
import { usePinToHome } from '../grid/usePinToHome'
import WidgetConfigPanel from '../grid/WidgetConfigPanel'
import WidgetConfigSummary from '../grid/WidgetConfigSummary'
import { SubordinateMetrics } from '../components/pinned/metricWidgets'
import type { ViewerPosition } from '@/features/dashboard/hooks/useViewerPosition'

/** Tên "report ẩn" của kho cũ — chỉ còn dùng để vớt bố cục một lần. */
const LEGACY_REPORT_NAME = '__SUBORDINATE_DASHBOARD_CONFIG__'

const DEFAULT_WIDGETS: DashboardWidget[] = [
  // Hàng thẻ chỉ số từng nằm NGOÀI lưới, bám nút khoảng thời gian trên đầu trang. Nút đó nay nằm
  // trong bảng cấu hình từng ô, nên hàng thẻ cũng là một ô — cùng id với danh mục trang chủ. Thẻ
  // kiểu ObjectiveMetricCard cao hơn thẻ icon-tròn nên ô này cần 5 hàng.
  // Tên ô là nguồn duy nhất (renderWidget lấy `w.title`, trang chủ đặt đúng chuỗi này); chữ đầu
  // mỗi ô khác nhau: Chỉ số / Diễn biến / Cây / Cơ cấu / Đơn vị con / Luồng.
  { i: 'sub-metrics', type: 'STATS', title: 'Chỉ số mục tiêu đơn vị', x: 0, y: 0, w: 12, h: 5, visible: true },
  { i: 'sub-trend', type: 'SUB_TREND', title: 'Diễn biến mục tiêu đơn vị qua các kỳ', x: 0, y: 5, w: 12, h: 15, visible: true },
  { i: 'sub-detail', type: 'SUB_DETAIL', title: 'Cây mục tiêu và KR của đơn vị', x: 0, y: 20, w: 12, h: 20, visible: true },
  { i: 'sub-member', type: 'SUB_MEMBER', title: 'Cơ cấu nhân sự theo vai trò', x: 0, y: 40, w: 12, h: 11, visible: true },
  { i: 'sub-unit-perf', type: 'SUB_UNIT_PERF', title: 'Đơn vị con: hiệu suất, tiến độ, nộp bài', x: 0, y: 51, w: 12, h: 13, visible: true },
  // Mặc định ẩn: luồng OKR chỉ có nghĩa khi Key Result đã được phân bổ trọng số xuống đơn vị.
  { i: 'sub-okr-flow', type: 'SUB_OKR_FLOW', title: 'Luồng phân bổ trọng số KR', x: 0, y: 64, w: 12, h: 13, visible: false },
]

/**
 * Ô nào hiện mặc định cho ai. Ban giám đốc nhìn đơn vị so với nhau và luồng phân bổ; trưởng đơn
 * vị cần chi tiết mục tiêu và người của mình; phó đơn vị gọn nhất.
 */
const POSITION_LAYOUT: Record<ViewerPosition, readonly string[]> = {
  DIRECTOR: ['sub-metrics', 'sub-trend', 'sub-unit-perf', 'sub-okr-flow'],
  HEAD: ['sub-metrics', 'sub-trend', 'sub-detail', 'sub-member'],
  DEPUTY: ['sub-metrics', 'sub-detail'],
  STAFF: ['sub-metrics', 'sub-trend', 'sub-detail', 'sub-member'],
}

const GROUP_OF: Record<string, string> = {
  'sub-metrics': 'Số liệu',
  'sub-trend': 'Biểu đồ xu hướng',
  'sub-detail': 'Từ bộ phận đến tổng thể',
  'sub-member': 'Từ bộ phận đến tổng thể',
  'sub-unit-perf': 'Biểu đồ so sánh',
  'sub-okr-flow': 'Biểu đồ luồng',
}
const PREVIEW_OF: Record<string, 'metricCard' | 'line' | 'treemap' | 'stackedBar' | 'groupedBar' | 'sankey'> = {
  'sub-metrics': 'metricCard',
  'sub-trend': 'line',
  'sub-detail': 'treemap',
  'sub-member': 'stackedBar',
  'sub-unit-perf': 'groupedBar',
  'sub-okr-flow': 'sankey',
}
const DESC_OF: Record<string, string> = {
  'sub-metrics': 'Một hàng số: tiến độ, hiệu suất, số mục tiêu hoàn thành, số rủi ro và tổng nhân sự.',
  'sub-trend': 'Đơn vị đang lên hay xuống: tiến độ và hiệu suất qua từng kỳ, hoặc tỉ trọng mục tiêu mới/cũ.',
  'sub-detail': 'Mục tiêu → kết quả then chốt → KPI của người thuộc quyền bạn, kèm tiến độ từng cấp.',
  'sub-member': 'Mỗi đơn vị có bao nhiêu người ở vai trò nào.',
  'sub-unit-perf': 'Đặt các đơn vị con cạnh nhau về hiệu suất, tiến độ và tỉ lệ nộp; chọn được top tốt nhất / trì trệ nhất.',
  'sub-okr-flow': 'Trọng số của từng Key Result chảy xuống đơn vị nào, bao nhiêu.',
}
const CATALOG = DEFAULT_WIDGETS.map(t => ({
  template: t, icon: null, groupLabel: GROUP_OF[t.i], preview: PREVIEW_OF[t.i], description: DESC_OF[t.i],
}))

export default function SubordinateManagementTab() {
  const onlyApproved = false
  const { periods, cycles } = useAnalyticsScopeData()
  const unitOptions = useUnitOptions()
  // Không còn bộ lọc cấp trang: khoảng thời gian nằm trong cài đặt từng ô; "mặc định" chỉ còn là
  // hằng số cho ô chưa đặt gì.
  const pageIntent = PAGE_DEFAULT_INTENT

  const pin = usePinToHome()
  const grid = usePositionLayout(DEFAULT_WIDGETS, POSITION_LAYOUT, 'HEAD')
  const dash = useAnalyticsGrid({
    scope: 'ANALYTICS_SUBORDINATE',
    defaultWidgets: grid.defaultWidgets,
    legacyReportName: LEGACY_REPORT_NAME,
  })

  /** Khoảng của một ô cụ thể: riêng nếu đã đặt, không thì theo mặc định. */
  const filterOf = (i: string) => widgetFilter(dash.widgets.find(w => w.i === i), pageIntent, periods, cycles)

  // Biểu đồ xu hướng bám khoảng RIÊNG của chính ô đó.
  const trend = filterOf('sub-trend')
  const chartQuery = useQuery({
    queryKey: ['subordinate-combo-chart', trend.from, trend.to, onlyApproved, trend.periodId, trend.periodIdTo, trend.groupBy],
    queryFn: () => statsApi.getSubordinateComboChart(trend.from, trend.to, onlyApproved, trend.periodId, trend.periodIdTo, trend.groupBy)
  })

  // Cấu trúc nhân sự / vai trò (theo đơn vị của user + đơn vị con) — không phụ thuộc thời gian.
  const { data: summary } = useSummaryStats()

  /*
    `useCallback` là bắt buộc chứ không phải tối ưu tuỳ hứng: lưới cache phần tử từng ô theo định
    danh hàm này. Hàm mới mỗi render là mọi biểu đồ vẽ lại mỗi lần tab render.
  */
  const { updateWidgetSettings } = dash
  const renderWidget = useCallback((w: DashboardWidget, ctx: { openConfig: () => void }) => {
    const f = widgetFilter(w, pageIntent, periods, cycles)
    const meta = (
      <WidgetConfigSummary
        widget={w} pageIntent={pageIntent} periods={periods} cycles={cycles}
        unitOptions={unitOptions} onOpen={ctx.openConfig}
      />
    )
    switch (w.type) {
      case 'STATS': return (
        // Chromeless: mỗi thẻ đã là một card. Chip ở trên cho biết hàng số này đang theo khoảng nào.
        // Năm truy vấn của hàng thẻ nằm trong SubordinateMetrics — cùng component trang chủ dùng.
        <div id="tour-analytics-metrics" className="h-full flex flex-col gap-2 min-h-0">
          {meta}
          <SubordinateMetrics filter={{ from: f.from, to: f.to, periodId: f.periodId, periodIdTo: f.periodIdTo, onlyApproved }} />
        </div>
      )
      case 'SUB_TREND': return (
        <ChartWrapper chromeless title={w.title} icon={<TrendingUp size={20} className="text-slate-400" />}>
          <AnalyticsComboChart
            data={chartQuery.data?.points ?? []}
            isLoading={chartQuery.isLoading}
            itemName="mục tiêu đơn vị"
            title={w.title}
            shareTitle="Cơ cấu mục tiêu đơn vị mới và cũ qua các kỳ"
            fillHeight
            mode={widgetVariant(w) === 'area' ? 'share' : 'trend'}
            onModeChange={m => updateWidgetSettings(w.i, { v: m === 'share' ? 'area' : 'line' })}
            hideModeToggle
            meta={meta}
          />
        </ChartWrapper>
      )
      case 'SUB_DETAIL': return (
        <ChartWrapper chromeless title={w.title} icon={<Target size={20} className="text-slate-400" />}>
          <ObjectiveDetailsWidget
            title={w.title}
            dateRange={{ from: f.from, to: f.to }} onlyApproved={onlyApproved} periodId={f.periodId} periodIdTo={f.periodIdTo}
            viewControl={tableViewControl(w, updateWidgetSettings)}
            orgUnitId={w.s?.orgUnitId ?? ''}
            hideControls
            meta={meta}
          />
        </ChartWrapper>
      )
      case 'SUB_MEMBER': return (
        <ChartWrapper title={w.title} icon={<Users size={20} className="text-slate-400" />} meta={meta}>
          <MemberRoleChart data={summary?.roleDistribution} />
        </ChartWrapper>
      )
      case 'SUB_UNIT_PERF': return (
        <ChartWrapper title={w.title} icon={<TrendingUp size={20} className="text-slate-400" />} meta={meta}>
          <UnitComparisonBarChart
            from={f.from} to={f.to} onlyApproved={onlyApproved} periodId={f.periodId} periodIdTo={f.periodIdTo}
            rank={optionOf(w, 'rank') as 'BEST' | 'WORST'}
            topN={optionOf(w, 'topN') as 'ALL' | '5' | '10'}
            hideControls
          />
        </ChartWrapper>
      )
      case 'SUB_OKR_FLOW': return (
        <ChartWrapper title={w.title} icon={<Network size={20} className="text-slate-400" />} meta={meta}>
          <OkrFlowSection filter={{ periodId: f.periodId, periodIdTo: f.periodIdTo }} />
        </ChartWrapper>
      )
      default: return null
    }
  }, [pageIntent, periods, cycles, unitOptions, onlyApproved, chartQuery.data, chartQuery.isLoading, summary, updateWidgetSettings])

  return (
    <div className="space-y-6 pb-20">
      {/* Tiêu đề + khoảng mặc định + thêm biểu đồ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Mục tiêu đơn vị tôi quản lý</h2>
        <div id="tour-analytics-customize" className="flex items-center gap-3 flex-wrap">
          <DashboardEditToolbar api={dash} />
        </div>
      </div>

      {/* Hàng thẻ chỉ số nay là ô đầu lưới (sub-metrics), khoảng thời gian của nó nằm trong bảng
          cấu hình như mọi ô khác. */}

      {/* Lưới widget tuỳ chỉnh: Xu hướng + Chi tiết + Nhân sự/vai trò + Hiệu suất đơn vị */}
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
              unitOptions={unitOptions}
            />
          )}
        />
      </div>
    </div>
  )
}
