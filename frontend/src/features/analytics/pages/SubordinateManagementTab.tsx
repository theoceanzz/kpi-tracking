/* eslint-disable react-refresh/only-export-components --
   Một CỤM Ô = khai báo ô (danh sách, nhóm, mô tả) + bộ vẽ ra chúng. Tách đôi để chiều quy tắc
   fast-refresh thì mỗi cụm nằm ở hai tệp và sửa một ô phải mở cả hai; cái giá thật ở đây chỉ là
   tải lại cả trang thay vì nóng khi sửa tệp này lúc phát triển. */
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
import { widgetFilter, widgetVariant, tableViewControl, optionOf } from '../grid/analyticsGrid'
import type { WidgetPackProps } from '../grid/widgetPack'
import { SubordinateMetrics } from '../components/pinned/metricWidgets'
import type { ViewerPosition } from '@/features/dashboard/hooks/useViewerPosition'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/** Tên "report ẩn" của kho cũ — chỉ còn dùng để vớt bố cục một lần. */
export const SUB_LEGACY_REPORT_NAME = '__SUBORDINATE_DASHBOARD_CONFIG__'

export const SUB_WIDGETS = perLanguage((): DashboardWidget[] => ([
  // Hàng thẻ chỉ số từng nằm NGOÀI lưới, bám nút khoảng thời gian trên đầu trang. Nút đó nay nằm
  // trong bảng cấu hình từng ô, nên hàng thẻ cũng là một ô — cùng id với danh mục trang chủ. Thẻ
  // kiểu ObjectiveMetricCard cao hơn thẻ icon-tròn nên ô này cần 5 hàng.
  // Tên ô là nguồn duy nhất (renderWidget lấy `w.title`, trang chủ đặt đúng chuỗi này); chữ đầu
  // mỗi ô khác nhau: Chỉ số / Diễn biến / Cây / Cơ cấu / Đơn vị con / Luồng.
  { i: 'sub-metrics', type: 'STATS', title: i18n.t('analytics:SubordinateManagementTab.unitObjectiveMetrics'), x: 0, y: 0, w: 12, h: 5, visible: true },
  { i: 'sub-trend', type: 'SUB_TREND', title: i18n.t('analytics:SubordinateManagementTab.unitObjectivesAcrossCycles'), x: 0, y: 5, w: 12, h: 15, visible: true },
  { i: 'sub-detail', type: 'SUB_DETAIL', title: i18n.t('analytics:SubordinateManagementTab.unitObjectiveAndKrTree'), x: 0, y: 20, w: 12, h: 20, visible: true },
  { i: 'sub-member', type: 'SUB_MEMBER', title: i18n.t('analytics:SubordinateManagementTab.peopleByRole'), x: 0, y: 40, w: 12, h: 11, visible: true },
  { i: 'sub-unit-perf', type: 'SUB_UNIT_PERF', title: i18n.t('analytics:SubordinateManagementTab.childUnitsPerformanceProgressSubmissions'), x: 0, y: 51, w: 12, h: 13, visible: true },
  // Mặc định ẩn: luồng OKR chỉ có nghĩa khi Key Result đã được phân bổ trọng số xuống đơn vị.
  { i: 'sub-okr-flow', type: 'SUB_OKR_FLOW', title: i18n.t('analytics:SubordinateManagementTab.krWeightAllocationFlow'), x: 0, y: 64, w: 12, h: 13, visible: false },
]))

/**
 * Ô nào hiện mặc định cho ai. Ban giám đốc nhìn đơn vị so với nhau và luồng phân bổ; trưởng đơn
 * vị cần chi tiết mục tiêu và người của mình; phó đơn vị gọn nhất.
 */
export const SUB_POSITION_LAYOUT: Record<ViewerPosition, readonly string[]> = {
  DIRECTOR: ['sub-metrics', 'sub-trend', 'sub-unit-perf', 'sub-okr-flow'],
  HEAD: ['sub-metrics', 'sub-trend', 'sub-detail', 'sub-member'],
  DEPUTY: ['sub-metrics', 'sub-detail'],
  STAFF: ['sub-metrics', 'sub-trend', 'sub-detail', 'sub-member'],
}

export const SUB_GROUP_OF = perLanguage((): Record<string, string> => ({
  'sub-metrics': i18n.t('analytics:SubordinateManagementTab.figures'),
  'sub-trend': i18n.t('analytics:SubordinateManagementTab.trendCharts'),
  'sub-detail': i18n.t('analytics:SubordinateManagementTab.partToWhole'),
  'sub-member': i18n.t('analytics:SubordinateManagementTab.partToWhole'),
  'sub-unit-perf': i18n.t('analytics:SubordinateManagementTab.comparisonCharts'),
  'sub-okr-flow': i18n.t('analytics:SubordinateManagementTab.flowCharts'),
}))
export const SUB_PREVIEW_OF: Record<string, 'metricCard' | 'line' | 'treemap' | 'stackedBar' | 'groupedBar' | 'sankey'> = {
  'sub-metrics': 'metricCard',
  'sub-trend': 'line',
  'sub-detail': 'treemap',
  'sub-member': 'stackedBar',
  'sub-unit-perf': 'groupedBar',
  'sub-okr-flow': 'sankey',
}
export const SUB_DESC_OF = perLanguage((): Record<string, string> => ({
  'sub-metrics': i18n.t('analytics:SubordinateManagementTab.aRowOfFiguresProgressPerformance'),
  'sub-trend': i18n.t('analytics:SubordinateManagementTab.isTheUnitGoingUpOr'),
  'sub-detail': i18n.t('analytics:SubordinateManagementTab.objectivesKeyResultsKpisOfThe'),
  'sub-member': i18n.t('analytics:SubordinateManagementTab.howManyPeopleEachUnitHas'),
  'sub-unit-perf': i18n.t('analytics:SubordinateManagementTab.childUnitsSideBySideOn'),
  'sub-okr-flow': i18n.t('analytics:SubordinateManagementTab.howMuchOfEachKeyResults'),
}))
/**
 * Cụm ô "Mục tiêu đơn vị tôi quản lý" trên lưới Thống kê.
 */
export default function SubordinatePack({ widget: w, meta, pageIntent, periods, cycles, widgets, updateWidgetSettings }: WidgetPackProps) {
  const { t } = useTranslation('analytics')
  const onlyApproved = false

  /** Khoảng của một ô cụ thể: riêng nếu đã đặt, không thì theo mặc định. */
  const filterOf = (i: string) => widgetFilter(widgets.find(x => x.i === i), pageIntent, periods, cycles)

  // Biểu đồ xu hướng bám khoảng RIÊNG của chính ô đó.
  const trend = filterOf('sub-trend')
  const chartQuery = useQuery({
    queryKey: ['subordinate-combo-chart', trend.from, trend.to, onlyApproved, trend.periodId, trend.periodIdTo, trend.groupBy],
    queryFn: () => statsApi.getSubordinateComboChart(trend.from, trend.to, onlyApproved, trend.periodId, trend.periodIdTo, trend.groupBy)
  })

  // Cấu trúc nhân sự / vai trò (theo đơn vị của user + đơn vị con) — không phụ thuộc thời gian.
  const { data: summary } = useSummaryStats()

  const f = widgetFilter(w, pageIntent, periods, cycles)

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
          itemName={t('SubordinateManagementTab.unitObjectives')}
          title={w.title}
          shareTitle={t('SubordinateManagementTab.oldAndNewCompositionOfUnit')}
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
}
