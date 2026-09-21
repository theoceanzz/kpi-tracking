import { useCallback } from 'react'
import { Gauge, Building2, Target, TrendingUp, GitBranch, ShieldAlert, Medal, Layers } from 'lucide-react'
import {
  BscOverviewMetrics, BscUnitAttainmentWidget, BscItemAttainmentWidget, BscAttainmentTrendWidget,
  BscCascadeCoverageWidget, BscGateWidget, BscRankingWidget,
} from '../components/pinned/bscWidgets'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import {
  useAnalyticsGrid, useAnalyticsScopeData, useUnitOptions, usePositionLayout, widgetFilter, widgetUnit, widgetVariant,
  tableViewControl, optionOf, PAGE_DEFAULT_INTENT,
} from '../grid/analyticsGrid'
import { usePinToHome } from '../grid/usePinToHome'
import WidgetConfigPanel from '../grid/WidgetConfigPanel'
import WidgetConfigSummary from '../grid/WidgetConfigSummary'
import type { ViewerPosition } from '@/features/dashboard/hooks/useViewerPosition'

/**
 * Tab "Thẻ điểm BSC": tổng quan cho người quản lý theo mô hình THẺ ĐIỂM — cây Công ty → Đơn vị,
 * kết quả đợt, phân rã chỉ tiêu, hạng mục chặn.
 *
 * <p>Mỗi ô tự mang đơn vị và khoảng thời gian trong bảng cấu hình như các tab khác; ô "một đợt"
 * (số liệu, mức đạt, chỉ tiêu, phân rã, cửa chặn) lấy đợt MUỘN NHẤT có kết quả trong khoảng đã
 * chọn, ô xu hướng vẽ cả khoảng. Bảng xếp hạng nhân sự là ô duy nhất còn đọc điểm đánh giá cá nhân,
 * để ẩn mặc định.
 */
const DEFAULT_WIDGETS: DashboardWidget[] = [
  { i: 'bsc-overview', type: 'STATS', title: 'Sức khoẻ BSC của đợt', x: 0, y: 0, w: 12, h: 5, visible: true },
  { i: 'bsc-units', type: 'BSC_UNITS', title: 'Mức đạt BSC của các đơn vị', x: 0, y: 5, w: 7, h: 11, visible: true },
  { i: 'bsc-gates', type: 'BSC_GATES', title: 'Hạng mục chặn', x: 7, y: 5, w: 5, h: 11, visible: true },
  { i: 'bsc-items', type: 'BSC_ITEMS', title: 'Mức đạt từng chỉ tiêu', x: 0, y: 16, w: 12, h: 10, visible: true },
  { i: 'bsc-trend', type: 'BSC_TREND', title: 'Xu hướng mức đạt qua các đợt', x: 0, y: 26, w: 7, h: 12, visible: true },
  { i: 'bsc-cascade', type: 'BSC_CASCADE', title: 'Độ phủ phân rã chỉ tiêu', x: 7, y: 26, w: 5, h: 12, visible: true },
  // Ẩn mặc định: điểm đánh giá cá nhân, có ích khi cần xem ai kéo điểm BSC của đơn vị.
  { i: 'bsc-ranking', type: 'BSC_RANKING', title: 'Xếp hạng nhân sự theo điểm BSC', x: 0, y: 38, w: 12, h: 14, visible: false },
]

/**
 * Tab này gác bằng BSC:MANAGE nên gần như chỉ ban giám đốc mở; ai mở cũng cần trọn thẻ điểm.
 * Khai đủ bốn vị trí để cùng khuôn với các tab khác — bộ y hệt nhau thì thư viện gộp thành một nút.
 */
const BSC_SET = ['bsc-overview', 'bsc-units', 'bsc-gates', 'bsc-items', 'bsc-trend', 'bsc-cascade'] as const
const POSITION_LAYOUT: Record<ViewerPosition, readonly string[]> = {
  DIRECTOR: BSC_SET, HEAD: BSC_SET, DEPUTY: BSC_SET, STAFF: BSC_SET,
}

const GROUP_OF: Record<string, string> = {
  'bsc-overview': 'Số liệu',
  'bsc-units': 'Biểu đồ xếp hạng',
  'bsc-gates': 'Số liệu',
  'bsc-items': 'Biểu đồ so sánh',
  'bsc-trend': 'Biểu đồ xu hướng',
  'bsc-cascade': 'Biểu đồ so sánh',
  'bsc-ranking': 'Biểu đồ xếp hạng',
}
const PREVIEW_OF: Record<string, 'metricCard' | 'table' | 'line' | 'bullet' | 'lollipop' | 'bar'> = {
  'bsc-overview': 'metricCard',
  'bsc-units': 'lollipop',
  'bsc-gates': 'table',
  'bsc-items': 'bullet',
  'bsc-trend': 'line',
  'bsc-cascade': 'bar',
  'bsc-ranking': 'lollipop',
}
const DESC_OF: Record<string, string> = {
  'bsc-overview': 'Mức đạt BSC của đợt, số thẻ điểm đơn vị, đơn vị qua cửa chặn, độ phủ phân rã.',
  'bsc-units': 'Mỗi đơn vị một chấm mức đạt so với mục tiêu 100%; đỏ là không qua cửa chặn.',
  'bsc-gates': 'Đơn vị nào đang vướng chỉ tiêu chặn trong đợt, vướng ở chỉ tiêu nào.',
  'bsc-items': 'Thực tế so với mục tiêu và sàn của từng chỉ tiêu trên thẻ điểm.',
  'bsc-trend': 'Mức đạt BSC qua các đợt, tách được theo 4 lĩnh vực.',
  'bsc-cascade': 'Từng chỉ tiêu đã phân rã xuống đơn vị đủ, thiếu hay vượt mục tiêu.',
  'bsc-ranking': 'Nhân sự xếp theo điểm BSC hoặc điểm hệ thống, kèm điểm từng lĩnh vực.',
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
  const grid = usePositionLayout(DEFAULT_WIDGETS, POSITION_LAYOUT, 'DIRECTOR')
  const dash = useAnalyticsGrid({ scope: 'ANALYTICS_BSC', defaultWidgets: grid.defaultWidgets })

  /*
    `useCallback` là bắt buộc chứ không phải tối ưu tuỳ hứng: lưới cache phần tử từng ô theo định
    danh hàm này. Hàm mới mỗi render là mọi biểu đồ vẽ lại mỗi lần tab render.
  */
  const { updateWidgetSettings } = dash
  const renderWidget = useCallback((w: DashboardWidget, ctx: { openConfig: () => void }) => {
    const f = widgetFilter(w, pageIntent, periods, cycles)
    const pf = { from: f.from, to: f.to, periodId: f.periodId, periodIdTo: f.periodIdTo, groupBy: f.groupBy, orgUnitId: widgetUnit(w) }
    const meta = (
      <WidgetConfigSummary
        widget={w} pageIntent={pageIntent} periods={periods} cycles={cycles}
        unitOptions={unitOptions} onOpen={ctx.openConfig}
      />
    )
    switch (w.type) {
      case 'STATS': return (
        <div id="tour-analytics-metrics" className="h-full flex flex-col gap-2 min-h-0">
          {meta}
          <BscOverviewMetrics filter={pf} />
        </div>
      )
      case 'BSC_UNITS': return (
        <div id="tour-bsc-balance" className="h-full">
          <ChartWrapper title="Mức đạt BSC của các đơn vị" icon={<Building2 size={20} className="text-slate-400" />}>
            <BscUnitAttainmentWidget filter={pf} variant={widgetVariant(w) === 'tree' ? 'tree' : 'lollipop'} meta={meta} />
          </ChartWrapper>
        </div>
      )
      case 'BSC_GATES': return (
        <ChartWrapper title="Hạng mục chặn" icon={<ShieldAlert size={20} className="text-slate-400" />}>
          <BscGateWidget filter={pf} meta={meta} />
        </ChartWrapper>
      )
      case 'BSC_ITEMS': return (
        <ChartWrapper title="Mức đạt từng chỉ tiêu" icon={<Target size={20} className="text-slate-400" />}>
          <BscItemAttainmentWidget filter={pf} meta={meta} />
        </ChartWrapper>
      )
      case 'BSC_TREND': return (
        <ChartWrapper title="Xu hướng mức đạt qua các đợt" icon={<TrendingUp size={20} className="text-slate-400" />}>
          <BscAttainmentTrendWidget filter={pf} variant={widgetVariant(w) === 'perspectives' ? 'perspectives' : 'overall'} meta={meta} />
        </ChartWrapper>
      )
      case 'BSC_CASCADE': return (
        <ChartWrapper title="Độ phủ phân rã chỉ tiêu" icon={<GitBranch size={20} className="text-slate-400" />}>
          <BscCascadeCoverageWidget filter={pf} viewControl={tableViewControl(w, updateWidgetSettings)} hideControls meta={meta} />
        </ChartWrapper>
      )
      case 'BSC_RANKING': return (
        <ChartWrapper title="Xếp hạng nhân sự theo điểm BSC" icon={<Medal size={20} className="text-slate-400" />} meta={meta}>
          <BscRankingWidget
            filter={pf}
            sortBy={optionOf(w, 'sort') as 'bscScore' | 'systemScore'}
            viewControl={tableViewControl(w, updateWidgetSettings)}
            hideControls
          />
        </ChartWrapper>
      )
      default: return null
    }
  }, [pageIntent, periods, cycles, unitOptions, updateWidgetSettings])

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[var(--color-foreground)] flex items-center gap-2">
          <Gauge size={20} className="text-slate-400" /> Thẻ điểm BSC
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

      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <Layers size={12} /> Số liệu đọc từ kết quả đợt đã tính của thẻ điểm (Quản lý BSC → Kết quả đợt); đợt chưa "Tính lại" thì ô báo chưa có kết quả.
      </p>
    </div>
  )
}
