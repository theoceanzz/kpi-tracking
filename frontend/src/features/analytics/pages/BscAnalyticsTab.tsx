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
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Tab "Thẻ điểm BSC": tổng quan cho người quản lý theo mô hình THẺ ĐIỂM — cây Công ty → Đơn vị,
 * kết quả đợt, phân rã chỉ tiêu, hạng mục chặn.
 *
 * <p>Mỗi ô tự mang đơn vị và khoảng thời gian trong bảng cấu hình như các tab khác; ô "một đợt"
 * (số liệu, mức đạt, chỉ tiêu, phân rã, cửa chặn) lấy đợt MUỘN NHẤT có kết quả trong khoảng đã
 * chọn, ô xu hướng vẽ cả khoảng. Bảng xếp hạng nhân sự là ô duy nhất còn đọc điểm đánh giá cá nhân,
 * để ẩn mặc định.
 */
const DEFAULT_WIDGETS = perLanguage((): DashboardWidget[] => ([
  { i: 'bsc-overview', type: 'STATS', title: i18n.t('analytics:BscAnalyticsTab.bscHealthOfThePeriod'), x: 0, y: 0, w: 12, h: 5, visible: true },
  // Tên ô là nguồn duy nhất (renderWidget lấy `w.title`, trang chủ đặt đúng chuỗi này); chữ đầu
  // mỗi ô khác nhau — "Mức đạt BSC của các đơn vị" cạnh "Mức đạt từng chỉ tiêu" từng lẫn nhau.
  { i: 'bsc-units', type: 'BSC_UNITS', title: i18n.t('analytics:BscAnalyticsTab.scorecardAchievementOfEachUnit'), x: 0, y: 5, w: 7, h: 11, visible: true },
  { i: 'bsc-gates', type: 'BSC_GATES', title: i18n.t('analytics:BscAnalyticsTab.unitsBlockedByGateItems'), x: 7, y: 5, w: 5, h: 11, visible: true },
  { i: 'bsc-items', type: 'BSC_ITEMS', title: i18n.t('analytics:BscAnalyticsTab.eachKpiAgainstTargetAndFloor'), x: 0, y: 16, w: 12, h: 10, visible: true },
  { i: 'bsc-trend', type: 'BSC_TREND', title: i18n.t('analytics:BscAnalyticsTab.achievementAcrossPeriods'), x: 0, y: 26, w: 7, h: 12, visible: true },
  { i: 'bsc-cascade', type: 'BSC_CASCADE', title: i18n.t('analytics:BscAnalyticsTab.kpiCascadeCoverage'), x: 7, y: 26, w: 5, h: 12, visible: true },
  // Ẩn mặc định: điểm đánh giá cá nhân, có ích khi cần xem ai kéo điểm BSC của đơn vị.
  { i: 'bsc-ranking', type: 'BSC_RANKING', title: i18n.t('analytics:BscAnalyticsTab.peopleRankingByBscScore'), x: 0, y: 38, w: 12, h: 14, visible: false },
]))

/**
 * Tab này gác bằng BSC:MANAGE nên gần như chỉ ban giám đốc mở; ai mở cũng cần trọn thẻ điểm.
 * Khai đủ bốn vị trí để cùng khuôn với các tab khác — bộ y hệt nhau thì thư viện gộp thành một nút.
 */
const BSC_SET = ['bsc-overview', 'bsc-units', 'bsc-gates', 'bsc-items', 'bsc-trend', 'bsc-cascade'] as const
const POSITION_LAYOUT: Record<ViewerPosition, readonly string[]> = {
  DIRECTOR: BSC_SET, HEAD: BSC_SET, DEPUTY: BSC_SET, STAFF: BSC_SET,
}

const GROUP_OF = perLanguage((): Record<string, string> => ({
  'bsc-overview': i18n.t('analytics:BscAnalyticsTab.figures'),
  'bsc-units': i18n.t('analytics:BscAnalyticsTab.rankingCharts'),
  'bsc-gates': i18n.t('analytics:BscAnalyticsTab.figures'),
  'bsc-items': i18n.t('analytics:BscAnalyticsTab.comparisonCharts'),
  'bsc-trend': i18n.t('analytics:BscAnalyticsTab.trendCharts'),
  'bsc-cascade': i18n.t('analytics:BscAnalyticsTab.comparisonCharts'),
  'bsc-ranking': i18n.t('analytics:BscAnalyticsTab.rankingCharts'),
}))
const PREVIEW_OF: Record<string, 'metricCard' | 'table' | 'line' | 'bullet' | 'lollipop' | 'bar'> = {
  'bsc-overview': 'metricCard',
  'bsc-units': 'lollipop',
  'bsc-gates': 'table',
  'bsc-items': 'bullet',
  'bsc-trend': 'line',
  'bsc-cascade': 'bar',
  'bsc-ranking': 'lollipop',
}
const DESC_OF = perLanguage((): Record<string, string> => ({
  'bsc-overview': i18n.t('analytics:BscAnalyticsTab.thePeriodsBscAchievementNumberOf'),
  'bsc-units': i18n.t('analytics:BscAnalyticsTab.whichUnitsAchieveAndWhichFall'),
  'bsc-gates': i18n.t('analytics:BscAnalyticsTab.whichUnitsAreBlockedByGate'),
  'bsc-items': i18n.t('analytics:BscAnalyticsTab.whichKpisAreMetAndWhich'),
  'bsc-trend': i18n.t('analytics:BscAnalyticsTab.whetherAchievementIsGoingUpOr'),
  'bsc-cascade': i18n.t('analytics:BscAnalyticsTab.whetherEachKpiCascadedToUnits'),
  'bsc-ranking': i18n.t('analytics:BscAnalyticsTab.peopleRankedByBscScoreOr'),
}))
const CATALOG = perLanguage(() => (DEFAULT_WIDGETS().map(t => ({
  template: t, icon: null, groupLabel: GROUP_OF()[t.i], preview: PREVIEW_OF[t.i], description: DESC_OF()[t.i],
}))))

export default function BscAnalyticsTab() {
  const { t } = useTranslation('analytics')
  const { periods, cycles } = useAnalyticsScopeData()
  const unitOptions = useUnitOptions()
  // Không còn bộ lọc cấp trang: đơn vị lẫn khoảng thời gian đều nằm trong cài đặt từng ô.
  const pageIntent = PAGE_DEFAULT_INTENT
  const pin = usePinToHome()
  const grid = usePositionLayout(DEFAULT_WIDGETS(), POSITION_LAYOUT, 'DIRECTOR')
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
          <ChartWrapper title={w.title} icon={<Building2 size={20} className="text-slate-400" />}>
            <BscUnitAttainmentWidget filter={pf} variant={widgetVariant(w) === 'tree' ? 'tree' : 'lollipop'} meta={meta} />
          </ChartWrapper>
        </div>
      )
      case 'BSC_GATES': return (
        <ChartWrapper title={w.title} icon={<ShieldAlert size={20} className="text-slate-400" />}>
          <BscGateWidget filter={pf} meta={meta} />
        </ChartWrapper>
      )
      case 'BSC_ITEMS': return (
        <ChartWrapper title={w.title} icon={<Target size={20} className="text-slate-400" />}>
          <BscItemAttainmentWidget filter={pf} meta={meta} />
        </ChartWrapper>
      )
      case 'BSC_TREND': return (
        <ChartWrapper title={w.title} icon={<TrendingUp size={20} className="text-slate-400" />}>
          <BscAttainmentTrendWidget filter={pf} variant={widgetVariant(w) === 'perspectives' ? 'perspectives' : 'overall'} meta={meta} />
        </ChartWrapper>
      )
      case 'BSC_CASCADE': return (
        <ChartWrapper title={w.title} icon={<GitBranch size={20} className="text-slate-400" />}>
          <BscCascadeCoverageWidget filter={pf} viewControl={tableViewControl(w, updateWidgetSettings)} hideControls meta={meta} />
        </ChartWrapper>
      )
      case 'BSC_RANKING': return (
        <ChartWrapper title={w.title} icon={<Medal size={20} className="text-slate-400" />} meta={meta}>
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
          <Gauge size={20} className="text-slate-400" /> {t('BscAnalyticsTab.bscScorecard')}
        </h2>
        <div id="tour-analytics-customize" className="flex items-center gap-3 flex-wrap">
          <DashboardEditToolbar api={dash} />
        </div>
      </div>

      <div id="tour-analytics-widgets">
        <DashboardCustomizeChrome
          api={dash}
          renderWidget={renderWidget}
          catalog={CATALOG()}
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
        <Layers size={12} /> {t('BscAnalyticsTab.figuresAreReadFromTheScorecards')}
      </p>
    </div>
  )
}
