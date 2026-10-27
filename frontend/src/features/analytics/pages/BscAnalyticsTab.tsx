/* eslint-disable react-refresh/only-export-components --
   Một CỤM Ô = khai báo ô (danh sách, nhóm, mô tả) + bộ vẽ ra chúng. Tách đôi để chiều quy tắc
   fast-refresh thì mỗi cụm nằm ở hai tệp và sửa một ô phải mở cả hai; cái giá thật ở đây chỉ là
   tải lại cả trang thay vì nóng khi sửa tệp này lúc phát triển. */
import { Building2, Target, TrendingUp, GitBranch, Medal, Map, Fish } from 'lucide-react'
import {
  BscOverviewMetrics, BscUnitAttainmentWidget, BscItemAttainmentWidget, BscAttainmentTrendWidget,
  BscCascadeCoverageWidget, BscRankingWidget,
} from '../components/pinned/bscWidgets'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import {
  widgetFilter, widgetUnit, widgetVariant, tableViewControl, optionOf,
} from '../grid/analyticsGrid'
import type { WidgetPackProps } from '../grid/widgetPack'
import StrategyMapWidget from '../components/bsc/StrategyMapWidget'
import FishboneWidget, { SCORECARD_HEAD } from '../components/bsc/FishboneWidget'
import { PresentableChart } from '../components/bsc/PresentationShell'
import type { ViewerPosition } from '@/features/dashboard/hooks/useViewerPosition'
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
export const BSC_WIDGETS = perLanguage((): DashboardWidget[] => ([
  // Hàng thẻ chỉ số đứng ĐẦU ở mọi tab Thống kê — người dùng liếc mấy con số trước rồi mới đọc
  // hình. Bản đồ chiến lược đứng ngay sau, là hình đầu tiên.
  { i: 'bsc-overview', type: 'STATS', title: i18n.t('analytics:BscAnalyticsTab.bscHealthOfThePeriod'), x: 0, y: 0, w: 12, h: 5, visible: true },
  { i: 'bsc-strategy-map', type: 'BSC_STRATEGY_MAP', title: i18n.t('analytics:BscAnalyticsTab.strategyMapByPerspective'), x: 0, y: 5, w: 12, h: 16, visible: true },
  // Xuong ca ngay sau ban do: cung mot bo so, hai cach doc. Hien san vi day la hinh de chieu
  // trong hop, can thay ngay chu khong phai di bat.
  { i: 'bsc-fishbone', type: 'BSC_FISHBONE', title: i18n.t('analytics:BscAnalyticsTab.objectiveFlowFishbone'), x: 0, y: 21, w: 12, h: 16, visible: true },
  // Tên ô là nguồn duy nhất (renderWidget lấy `w.title`, trang chủ đặt đúng chuỗi này); chữ đầu
  // mỗi ô khác nhau — "Mức đạt BSC của các đơn vị" cạnh "Mức đạt từng chỉ tiêu" từng lẫn nhau.
  { i: 'bsc-units', type: 'BSC_UNITS', title: i18n.t('analytics:BscAnalyticsTab.scorecardAchievementOfEachUnit'), x: 0, y: 37, w: 12, h: 11, visible: true },
  { i: 'bsc-items', type: 'BSC_ITEMS', title: i18n.t('analytics:BscAnalyticsTab.eachKpiAgainstTargetAndFloor'), x: 0, y: 48, w: 12, h: 10, visible: true },
  { i: 'bsc-trend', type: 'BSC_TREND', title: i18n.t('analytics:BscAnalyticsTab.achievementAcrossPeriods'), x: 0, y: 58, w: 7, h: 12, visible: true },
  { i: 'bsc-cascade', type: 'BSC_CASCADE', title: i18n.t('analytics:BscAnalyticsTab.kpiCascadeCoverage'), x: 7, y: 58, w: 5, h: 12, visible: true },
  // Ẩn mặc định: điểm đánh giá cá nhân, có ích khi cần xem ai kéo điểm BSC của đơn vị.
  { i: 'bsc-ranking', type: 'BSC_RANKING', title: i18n.t('analytics:BscAnalyticsTab.peopleRankingByBscScore'), x: 0, y: 70, w: 12, h: 14, visible: false },
]))

/**
 * Tab này gác bằng BSC:MANAGE nên gần như chỉ ban giám đốc mở; ai mở cũng cần trọn thẻ điểm.
 * Khai đủ bốn vị trí để cùng khuôn với các tab khác — bộ y hệt nhau thì thư viện gộp thành một nút.
 */
export const BSC_SET = ['bsc-overview', 'bsc-strategy-map', 'bsc-fishbone', 'bsc-units', 'bsc-items', 'bsc-trend',
  'bsc-cascade'] as const
export const BSC_POSITION_LAYOUT: Record<ViewerPosition, readonly string[]> = {
  DIRECTOR: BSC_SET, HEAD: BSC_SET, DEPUTY: BSC_SET, STAFF: BSC_SET,
}

export const BSC_GROUP_OF = perLanguage((): Record<string, string> => ({
  'bsc-strategy-map': i18n.t('analytics:BscAnalyticsTab.diagrams'),
  'bsc-fishbone': i18n.t('analytics:BscAnalyticsTab.diagrams'),
  'bsc-overview': i18n.t('analytics:BscAnalyticsTab.figures'),
  'bsc-units': i18n.t('analytics:BscAnalyticsTab.rankingCharts'),
  'bsc-items': i18n.t('analytics:BscAnalyticsTab.comparisonCharts'),
  'bsc-trend': i18n.t('analytics:BscAnalyticsTab.trendCharts'),
  'bsc-cascade': i18n.t('analytics:BscAnalyticsTab.comparisonCharts'),
  'bsc-ranking': i18n.t('analytics:BscAnalyticsTab.rankingCharts'),
}))
export const BSC_PREVIEW_OF: Record<string, 'metricCard' | 'table' | 'line' | 'bullet' | 'lollipop' | 'bar' | 'treemap' | 'fishbone'> = {
  'bsc-strategy-map': 'treemap',
  'bsc-fishbone': 'fishbone',
  'bsc-overview': 'metricCard',
  'bsc-units': 'lollipop',
  'bsc-items': 'bullet',
  'bsc-trend': 'line',
  'bsc-cascade': 'bar',
  'bsc-ranking': 'lollipop',
}
export const BSC_DESC_OF = perLanguage((): Record<string, string> => ({
  'bsc-strategy-map': i18n.t('analytics:BscAnalyticsTab.whereEachObjectiveStandsByPerspective'),
  'bsc-fishbone': i18n.t('analytics:BscAnalyticsTab.whichBranchesPushOrDragTheTarget'),
  'bsc-overview': i18n.t('analytics:BscAnalyticsTab.thePeriodsBscAchievementNumberOf'),
  'bsc-units': i18n.t('analytics:BscAnalyticsTab.whichUnitsAchieveAndWhichFall'),
  'bsc-items': i18n.t('analytics:BscAnalyticsTab.whichKpisAreMetAndWhich'),
  'bsc-trend': i18n.t('analytics:BscAnalyticsTab.whetherAchievementIsGoingUpOr'),
  'bsc-cascade': i18n.t('analytics:BscAnalyticsTab.whetherEachKpiCascadedToUnits'),
  'bsc-ranking': i18n.t('analytics:BscAnalyticsTab.peopleRankedByBscScoreOr'),
}))
/**
 * Cụm ô "Thẻ điểm BSC" trên lưới Thống kê.
 *
 * <p>Trước đây là một tab riêng có lưới của mình; nay chỉ vẽ ĐÚNG ô mà lưới chung hỏi tới.
 */
export default function BscPack({ widget: w, meta, pageIntent, periods, cycles, updateWidgetSettings }: WidgetPackProps) {
  const f = widgetFilter(w, pageIntent, periods, cycles)
  const pf = { from: f.from, to: f.to, periodId: f.periodId, periodIdTo: f.periodIdTo, groupBy: f.groupBy, orgUnitId: widgetUnit(w) }

  switch (w.type) {
    case 'STATS': return (
      <div id="tour-analytics-metrics" className="h-full flex flex-col gap-2 min-h-0">
        {meta}
        <BscOverviewMetrics filter={pf} />
      </div>
    )
    // Hai ô sơ đồ bọc `PresentableChart`: nó lo cả thẻ trên lưới lẫn bản phủ toàn màn hình, và
    // tự đặt `relative` để bảng chi tiết phủ bên phải nằm gọn trong khung.
    case 'BSC_STRATEGY_MAP': return (
      <PresentableChart title={w.title} icon={<Map size={20} className="text-slate-400" />}>
        {() => (
          <StrategyMapWidget
            scope={{ orgUnitId: widgetUnit(w), periodId: pf.periodId, periodIdTo: pf.periodIdTo }}
            limit={Number(optionOf(w, 'limit') ?? 20)}
            status={optionOf(w, 'status')}
            meta={meta}
          />
        )}
      </PresentableChart>
    )
    case 'BSC_FISHBONE': return (
      <PresentableChart title={w.title} icon={<Fish size={20} className="text-slate-400" />}>
        {({ presenting }) => (
          <FishboneWidget
            scope={{ orgUnitId: widgetUnit(w), periodId: pf.periodId, periodIdTo: pf.periodIdTo }}
            limit={Number(optionOf(w, 'limit') ?? 20)}
            status={optionOf(w, 'status')}
            presenting={presenting}
            /* Đầu cá là MỘT MỤC TIÊU — dữ liệu động, nên đọc thẳng `s.o.head` chứ không qua
               `optionOf`: hàm đó đối chiếu với danh sách lựa chọn tĩnh và sẽ loại mọi id. */
            head={w.s?.o?.head ?? SCORECARD_HEAD}
            onHeadChange={v => updateWidgetSettings(w.i, { o: { ...w.s?.o, head: v } })}
            meta={meta}
          />
        )}
      </PresentableChart>
    )
    case 'BSC_UNITS': return (
      <div id="tour-bsc-balance" className="h-full">
        <ChartWrapper title={w.title} icon={<Building2 size={20} className="text-slate-400" />}>
          <BscUnitAttainmentWidget filter={pf} gate={optionOf(w, 'gate') as 'ALL' | 'FAILED' | 'NO_GATE'} meta={meta} />
        </ChartWrapper>
      </div>
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
}
