import { Gauge, Award, TrendingUp, Building2, Scale, ShieldCheck, Medal, History, Layers } from 'lucide-react'
import {
  BscBalanceMetrics, BscPerspectiveCards, BscTrendWidget, BscUnitComparisonWidget,
  BscVsSystemWidget, BscCoverageWidget, BscRankingWidget, BscWeightHistoryWidget,
} from '../components/pinned/bscWidgets'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import {
  useAnalyticsGrid, useAnalyticsScopeData, useUnitOptions, widgetFilter, widgetUnit, widgetVariant,
  tableViewControl, optionOf, PAGE_DEFAULT_INTENT,
} from '../grid/analyticsGrid'
import { usePinToHome } from '../grid/usePinToHome'
import WidgetConfigPanel from '../grid/WidgetConfigPanel'
import WidgetConfigSummary from '../grid/WidgetConfigSummary'

/**
 * Tab "Hạng mục BSC": số liệu gộp từ điểm đánh giá đã lưu theo hạng mục, nhất quán với chỉ số
 * "hiệu suất theo đánh giá".
 *
 * <p>Trước đây là một trang tĩnh với bộ lọc đợt + ô chọn đơn vị trên đầu lái toàn bộ khối. Nay là
 * lưới như các tab khác: mỗi ô tự mang đơn vị và khoảng thời gian trong bảng cấu hình; các nút
 * chuyển (đường/tỉ trọng, cột/phân tán, theo đơn vị/nhân sự, sắp theo điểm BSC/hệ thống) cũng nằm
 * ở đó. Các ô dùng chung component với thẻ ghim ở trang chủ nên số liệu hai nơi cùng một nguồn.
 */
const DEFAULT_WIDGETS: DashboardWidget[] = [
  { i: 'bsc-metrics', type: 'STATS', title: 'Số liệu cân bằng BSC', x: 0, y: 0, w: 12, h: 5, visible: true },
  { i: 'bsc-perspectives', type: 'BSC_PERSPECTIVES', title: 'Thẻ từng hạng mục', x: 0, y: 5, w: 12, h: 9, visible: true },
  { i: 'bsc-trend', type: 'BSC_TREND', title: 'Xu hướng điểm hạng mục theo kỳ', x: 0, y: 14, w: 12, h: 12, visible: true },
  { i: 'bsc-unit-comparison', type: 'BSC_UNIT_COMPARISON', title: 'So sánh hạng mục giữa các đơn vị', x: 0, y: 26, w: 12, h: 12, visible: true },
  { i: 'bsc-vs-system', type: 'BSC_VS_SYSTEM', title: 'Đối chiếu điểm BSC và điểm hệ thống', x: 0, y: 38, w: 8, h: 12, visible: true },
  { i: 'bsc-coverage', type: 'BSC_COVERAGE', title: 'KPI chưa gán hạng mục', x: 8, y: 38, w: 4, h: 12, visible: true },
  { i: 'bsc-ranking', type: 'BSC_RANKING', title: 'Xếp hạng nhân sự theo điểm BSC', x: 0, y: 50, w: 12, h: 14, visible: true },
  // Mặc định ẩn: chỉ có nghĩa với người quản trị bộ tiêu chí.
  { i: 'bsc-weight-history', type: 'BSC_WEIGHT_HISTORY', title: 'Lịch sử thay đổi trọng số hạng mục', x: 0, y: 64, w: 12, h: 12, visible: false },
]

const GROUP_OF: Record<string, string> = {
  'bsc-metrics': 'Số liệu',
  'bsc-perspectives': 'Số liệu',
  'bsc-trend': 'Biểu đồ xu hướng',
  'bsc-unit-comparison': 'Biểu đồ so sánh',
  'bsc-vs-system': 'Biểu đồ so sánh',
  'bsc-coverage': 'Số liệu',
  'bsc-ranking': 'Biểu đồ xếp hạng',
  'bsc-weight-history': 'Biểu đồ xu hướng',
}
const PREVIEW_OF: Record<string, 'metricCard' | 'table' | 'line' | 'groupedBar' | 'lollipop' | 'stackedArea'> = {
  'bsc-metrics': 'metricCard',
  'bsc-perspectives': 'table',
  'bsc-trend': 'line',
  'bsc-unit-comparison': 'groupedBar',
  'bsc-vs-system': 'groupedBar',
  'bsc-coverage': 'metricCard',
  'bsc-ranking': 'lollipop',
  'bsc-weight-history': 'stackedArea',
}
const DESC_OF: Record<string, string> = {
  'bsc-metrics': 'Điểm BSC trung bình, hạng mục mạnh nhất, yếu nhất và độ phủ.',
  'bsc-perspectives': 'Mỗi hạng mục một thẻ: trọng số, điểm, số KPI và mức đóng góp.',
  'bsc-trend': 'Điểm từng hạng mục qua các kỳ, hoặc tỉ trọng đóng góp vào điểm tổng.',
  'bsc-unit-comparison': 'Điểm từng hạng mục của các đơn vị đặt cạnh nhau.',
  'bsc-vs-system': 'Điểm BSC so với điểm hệ thống theo đơn vị hoặc từng nhân sự.',
  'bsc-coverage': 'Tỉ lệ KPI đã gán hạng mục và danh sách KPI chưa gán.',
  'bsc-ranking': 'Nhân sự xếp theo điểm BSC hoặc điểm hệ thống, kèm điểm từng hạng mục.',
  'bsc-weight-history': 'Trọng số hạng mục thay đổi thế nào qua các lần cấu hình.',
}
const CATALOG = DEFAULT_WIDGETS.map(t => ({
  template: t, icon: null, groupLabel: GROUP_OF[t.i], preview: PREVIEW_OF[t.i], description: DESC_OF[t.i],
}))

export default function BscAnalyticsTab() {
  const { periods, cycles } = useAnalyticsScopeData()
  const unitOptions = useUnitOptions()
  // Không còn bộ lọc cấp trang: đơn vị lẫn khoảng thời gian đều nằm trong cài đặt từng ô.
  const pageIntent = PAGE_DEFAULT_INTENT
  const pin = usePinToHome()
  const dash = useAnalyticsGrid({ scope: 'ANALYTICS_BSC', defaultWidgets: DEFAULT_WIDGETS })
  const filterOf = (i: string) => widgetFilter(dash.widgets.find(w => w.i === i), pageIntent, periods, cycles)

  const renderWidget = (w: DashboardWidget, ctx: { openConfig: () => void }) => {
    const f = filterOf(w.i)
    const pf = { from: f.from, to: f.to, periodId: f.periodId, periodIdTo: f.periodIdTo, groupBy: f.groupBy, orgUnitId: widgetUnit(w) }
    const meta = (
      <WidgetConfigSummary
        widget={w} pageIntent={pageIntent} periods={periods} cycles={cycles}
        unitOptions={unitOptions} onOpen={ctx.openConfig}
      />
    )
    const set = (patch: Parameters<typeof dash.updateWidgetSettings>[1]) => dash.updateWidgetSettings(w.i, patch)
    switch (w.type) {
      case 'STATS': return (
        <div id="tour-analytics-metrics" className="h-full flex flex-col gap-2 min-h-0">
          {meta}
          <BscBalanceMetrics filter={pf} />
        </div>
      )
      case 'BSC_PERSPECTIVES': return (
        <div id="tour-bsc-balance" className="h-full">
          <ChartWrapper title="Thẻ từng hạng mục" icon={<Award size={20} className="text-slate-400" />} meta={meta}>
            <BscPerspectiveCards filter={pf} />
          </ChartWrapper>
        </div>
      )
      case 'BSC_TREND': return (
        <ChartWrapper title="Xu hướng điểm hạng mục theo kỳ" icon={<TrendingUp size={20} className="text-slate-400" />}>
          <BscTrendWidget
            filter={pf}
            mode={widgetVariant(w) === 'share' ? 'share' : 'trend'}
            onModeChange={m => set({ v: m === 'share' ? 'share' : 'line' })}
            hideModeToggle
            meta={meta}
          />
        </ChartWrapper>
      )
      case 'BSC_UNIT_COMPARISON': return (
        <ChartWrapper title="So sánh hạng mục giữa các đơn vị" icon={<Building2 size={20} className="text-slate-400" />} meta={meta}>
          <BscUnitComparisonWidget filter={pf} />
        </ChartWrapper>
      )
      case 'BSC_VS_SYSTEM': return (
        <ChartWrapper title="Đối chiếu điểm BSC và điểm hệ thống" icon={<Scale size={20} className="text-slate-400" />} meta={meta}>
          <BscVsSystemWidget
            filter={pf}
            level={optionOf(w, 'level') as 'UNIT' | 'MEMBER'}
            shape={widgetVariant(w) === 'scatter' ? 'scatter' : 'bar'}
            hideControls
          />
        </ChartWrapper>
      )
      case 'BSC_COVERAGE': return (
        <ChartWrapper title="KPI chưa gán hạng mục" icon={<ShieldCheck size={20} className="text-slate-400" />} meta={meta}>
          <BscCoverageWidget filter={pf} />
        </ChartWrapper>
      )
      case 'BSC_RANKING': return (
        <ChartWrapper title="Xếp hạng nhân sự theo điểm BSC" icon={<Medal size={20} className="text-slate-400" />} meta={meta}>
          <BscRankingWidget
            filter={pf}
            sortBy={optionOf(w, 'sort') as 'bscScore' | 'systemScore'}
            viewControl={tableViewControl(w, dash.updateWidgetSettings)}
            hideControls
          />
        </ChartWrapper>
      )
      case 'BSC_WEIGHT_HISTORY': return (
        <ChartWrapper title="Lịch sử thay đổi trọng số hạng mục" icon={<History size={20} className="text-slate-400" />} meta={meta}>
          <BscWeightHistoryWidget filter={pf} />
        </ChartWrapper>
      )
      default: return null
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Gauge size={20} className="text-slate-400" /> Hạng mục BSC
        </h2>
        <div id="tour-analytics-customize" className="flex items-center gap-3 flex-wrap">
          <DashboardEditToolbar api={dash} />
        </div>
      </div>

      <div id="tour-analytics-widgets">
        <DashboardCustomizeChrome
          api={dash}
          renderWidget={renderWidget}
          catalog={CATALOG}
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

      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <Layers size={12} /> Số liệu gộp từ điểm đánh giá đã lưu theo hạng mục, nhất quán với chỉ số "hiệu suất theo đánh giá".
      </p>
    </div>
  )
}
