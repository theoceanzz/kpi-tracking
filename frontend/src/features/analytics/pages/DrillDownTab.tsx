/* eslint-disable react-refresh/only-export-components --
   Một CỤM Ô = khai báo ô (danh sách, nhóm, mô tả) + bộ vẽ ra chúng. Tách đôi để chiều quy tắc
   fast-refresh thì mỗi cụm nằm ở hai tệp và sửa một ô phải mở cả hai; cái giá thật ở đây chỉ là
   tải lại cả trang thay vì nóng khi sửa tệp này lúc phát triển. */
import { useMemo } from 'react'
import { Award, Users, Grid3x3, Building2, BarChart3, BoxSelect, Network } from 'lucide-react'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import { useStatsTier } from '../hooks/useStatsTier'
import {
  DrillUnitSummaryWidget, DrillClassificationWidget, DrillChildrenClassificationWidget, DrillCascadeWidget,
  DrillEmployeeTableWidget, DrillMatrixWidget, DrillUnitCompareWidget, DrillBoxplotWidget,
} from '../components/pinned/drillWidgets'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import { widgetFilter, widgetVariant, tableViewControl, widgetUnit, type OptionField } from '../grid/analyticsGrid'
import type { WidgetPackProps } from '../grid/widgetPack'
import type { ViewerPosition } from '@/features/dashboard/hooks/useViewerPosition'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'


/** Sentinel cho lựa chọn "xếp loại theo đợt" (Select không nhận chuỗi rỗng). */
const BY_PERIOD = '__by_period__'


/**
 * Ô mặc định, theo thứ tự đọc: đơn vị này → người của nó → đơn vị bên dưới. Id trùng danh mục
 * trang chủ để ghim được ngay. Ô nào cần quyền/cờ tổ chức được lọc ở component trước khi đưa vào lưới.
 */
export const DRILL_WIDGETS = perLanguage((): DashboardWidget[] => ([
  { i: 'drill-summary', type: 'DRILL_SUMMARY', title: i18n.t('analytics:DrillDownTab.unitBeingViewed'), x: 0, y: 0, w: 12, h: 3, visible: true },
  // Tên ô là nguồn duy nhất (renderWidget lấy `w.title`, trang chủ đặt đúng chuỗi này); chữ đầu
  // mỗi ô khác nhau: Đơn vị đang xem / Phân bố / Luồng / Từng thành viên / Ma trận / Xếp loại /
  // Hiệu suất / Độ phân tán — "Xếp loại đơn vị" cạnh "Xếp loại đơn vị con" từng không phân biệt được.
  { i: 'drill-classification', type: 'DRILL_CLASSIFICATION', title: i18n.t('analytics:DrillDownTab.peopleRatingDistribution'), x: 0, y: 3, w: 12, h: 12, visible: true },
  { i: 'drill-cascade', type: 'DRILL_CASCADE', title: i18n.t('analytics:DrillDownTab.kpiCascadingDelegationFlow'), x: 0, y: 19, w: 12, h: 12, visible: true },
  { i: 'drill-employees', type: 'DRILL_EMPLOYEES', title: i18n.t('analytics:DrillDownTab.eachMemberPerformanceProgressKpiCount'), x: 0, y: 31, w: 12, h: 16, visible: true },
  { i: 'drill-matrix', type: 'DRILL_MATRIX', title: i18n.t('analytics:DrillDownTab.conductCompletionMatrix'), x: 0, y: 47, w: 12, h: 18, visible: true },
  { i: 'drill-children', type: 'DRILL_CHILDREN', title: i18n.t('analytics:DrillDownTab.ratingOfEachChildUnit'), x: 0, y: 65, w: 6, h: 12, visible: true },
  { i: 'drill-compare', type: 'DRILL_COMPARE', title: i18n.t('analytics:DrillDownTab.performanceOfEachChildUnit'), x: 6, y: 65, w: 6, h: 12, visible: true },
  { i: 'drill-boxplot', type: 'DRILL_BOXPLOT', title: i18n.t('analytics:DrillDownTab.scoreSpreadWithinEachChildUnit'), x: 0, y: 77, w: 12, h: 12, visible: false },
]))

/**
 * Ô nào hiện mặc định cho ai. Ban giám đốc so các đơn vị con với nhau; trưởng/phó đơn vị nhìn
 * người trong đơn vị mình; nhân viên chỉ cần biết đơn vị mình xếp loại ra sao. Ô nào cần quyền
 * hoặc cờ tổ chức vẫn bị lọc ở component trước, nên id vắng mặt ở đây chỉ đơn giản là bỏ qua.
 */
export const DRILL_POSITION_LAYOUT: Record<ViewerPosition, readonly string[]> = {
  DIRECTOR: ['drill-summary', 'drill-classification', 'drill-children', 'drill-compare', 'drill-matrix'],
  HEAD: ['drill-summary', 'drill-classification', 'drill-employees', 'drill-matrix'],
  DEPUTY: ['drill-summary', 'drill-employees', 'drill-matrix'],
  STAFF: ['drill-summary', 'drill-classification'],
}

export const DRILL_GROUP_OF = perLanguage((): Record<string, string> => ({
  'drill-summary': i18n.t('analytics:DrillDownTab.figures'),
  'drill-classification': i18n.t('analytics:DrillDownTab.distributionCharts'),
  'drill-cascade': i18n.t('analytics:DrillDownTab.flowCharts'),
  'drill-employees': i18n.t('analytics:DrillDownTab.rankingCharts'),
  'drill-matrix': i18n.t('analytics:DrillDownTab.correlationCharts'),
  'drill-children': i18n.t('analytics:DrillDownTab.comparisonCharts'),
  'drill-compare': i18n.t('analytics:DrillDownTab.comparisonCharts'),
  'drill-boxplot': i18n.t('analytics:DrillDownTab.distributionCharts'),
}))
export const DRILL_PREVIEW_OF: Record<string, 'metricCard' | 'stackedBar' | 'sankey' | 'lollipop' | 'heatmap' | 'bar' | 'boxplot' | 'table'> = {
  'drill-summary': 'metricCard',
  'drill-classification': 'bar',
  'drill-cascade': 'sankey',
  'drill-employees': 'lollipop',
  'drill-matrix': 'heatmap',
  'drill-children': 'table',
  'drill-compare': 'bar',
  'drill-boxplot': 'boxplot',
}
export const DRILL_DESC_OF = perLanguage((): Record<string, string> => ({
  'drill-summary': i18n.t('analytics:DrillDownTab.levelUnitNameHeadcountAndTotal'),
  'drill-classification': i18n.t('analytics:DrillDownTab.whatThisUnitIsRatedAnd'),
  'drill-cascade': i18n.t('analytics:DrillDownTab.howMuchKpiWeightFlowsFrom'),
  'drill-employees': i18n.t('analytics:DrillDownTab.everyoneInTheUnitSideBy'),
  'drill-matrix': i18n.t('analytics:DrillDownTab.whoDoesWellAndBehavesWell'),
  'drill-children': i18n.t('analytics:DrillDownTab.whatEachUnitDirectlyBelowIs'),
  'drill-compare': i18n.t('analytics:DrillDownTab.performanceOfTheUnitsDirectlyBelow'),
  'drill-boxplot': i18n.t('analytics:DrillDownTab.whetherScoresInEachChildUnit'),
}))

/** Kỳ chọn trong cài đặt ô; sentinel "theo đợt" → không có kỳ. */
const cycleOf = (w: DashboardWidget) => {
  const v = w.s?.o?.cycleId
  return v && v !== BY_PERIOD ? v : undefined
}

/** Danh sách ô của cụm sau khi lọc theo quyền/cấu hình — trang gộp gọi để dựng thư viện. */
export function useDrillAllowedWidgets() {
  const { canView: canViewStats } = useStatsTier()
  const perf = usePerformanceScale()
  return useMemo(() => DRILL_WIDGETS().filter(w =>
    (canViewStats || (w.i !== 'drill-cascade' && w.i !== 'drill-boxplot')) &&
    (perf.isMatrix || w.i !== 'drill-matrix')
  ), [canViewStats, perf.isMatrix])
}

/**
 * "Phạm vi xếp loại" là khái niệm khác khoảng thời gian (điểm chốt kỳ, bỏ qua bộ lọc đợt) nên là
 * một tuỳ chọn riêng của ô; danh sách kỳ lấy từ API nên phải khai động.
 */
export function useDrillExtraFields(cycles: { id: string; name?: string | null }[]) {
  const { t: tr } = useTranslation('analytics')
  const cycleFields = useMemo<OptionField[]>(() => [{
    key: 'cycleId', label: tr('DrillDownTab.ratingScope'), kind: 'select', default: BY_PERIOD,
    choices: [
      { value: BY_PERIOD, label: tr('DrillDownTab.byPeriod') },
      ...cycles.map(c => ({ value: c.id, label: tr('DrillDownTab.cycle', { name: c.name ?? '' }) })),
    ],
  }], [cycles, tr])
  return (i: string) => (i === 'drill-classification' || i === 'drill-children' ? cycleFields : undefined)
}

/**
 * Cụm ô "So sánh giữa các đơn vị" trên lưới Thống kê.
 *
 * <p>Cây đơn vị bên trái đi theo cái tab: trên một lưới dùng chung không còn "phạm vi của trang"
 * nào để nó điều khiển, nên mỗi ô tự chọn đơn vị trong bảng cấu hình như mọi ô khác.
 */
export default function DrillPack({ widget: w, meta, pageIntent, periods, cycles, updateWidgetSettings }: WidgetPackProps) {
  const f = widgetFilter(w, pageIntent, periods, cycles)
  const pf = { from: f.from, to: f.to, periodId: f.periodId, periodIdTo: f.periodIdTo, orgUnitId: widgetUnit(w) }

  switch (w.type) {
    case 'DRILL_SUMMARY': return (
      <div id="tour-drilldown-banner" className="h-full flex flex-col gap-2 min-h-0">
        {meta}
        <DrillUnitSummaryWidget filter={pf} />
      </div>
    )
    case 'DRILL_CLASSIFICATION': return (
      <ChartWrapper title={w.title} icon={<Award size={20} className="text-slate-400" />} meta={meta}>
        <DrillClassificationWidget
          filter={pf} part="unit" cycleId={cycleOf(w)} hideControls
          view={widgetVariant(w) === 'trend' ? 'trend' : 'bell'}
        />
      </ChartWrapper>
    )
    case 'DRILL_CASCADE': return (
      <ChartWrapper title={w.title} icon={<Network size={20} className="text-slate-400" />} meta={meta}>
        <DrillCascadeWidget filter={pf} />
      </ChartWrapper>
    )
    case 'DRILL_EMPLOYEES': return (
      <div id="tour-drilldown-members" className="h-full">
        <ChartWrapper title={w.title} icon={<Users size={20} className="text-slate-400" />} meta={meta}>
          {/* `key` reset tìm kiếm + trang khi đổi đơn vị của ô. */}
          <DrillEmployeeTableWidget
            key={pf.orgUnitId ?? 'root'}
            filter={pf}
            viewControl={tableViewControl(w, updateWidgetSettings)}
            hideControls
          />
        </ChartWrapper>
      </div>
    )
    case 'DRILL_MATRIX': return (
      <ChartWrapper title={w.title} icon={<Grid3x3 size={20} className="text-slate-400" />} meta={meta}>
        <DrillMatrixWidget filter={pf} variant={widgetVariant(w) as 'cells' | 'scatter'} hideControls />
      </ChartWrapper>
    )
    case 'DRILL_CHILDREN': return (
      <ChartWrapper title={w.title} icon={<Building2 size={20} className="text-slate-400" />} meta={meta}>
        <DrillChildrenClassificationWidget filter={pf} hideControls />
      </ChartWrapper>
    )
    case 'DRILL_COMPARE': return (
      <ChartWrapper title={w.title} icon={<BarChart3 size={20} className="text-slate-400" />} meta={meta}>
        <DrillUnitCompareWidget filter={pf} />
      </ChartWrapper>
    )
    case 'DRILL_BOXPLOT': return (
      <ChartWrapper title={w.title} icon={<BoxSelect size={20} className="text-slate-400" />} meta={meta}>
        <DrillBoxplotWidget filter={pf} />
      </ChartWrapper>
    )
    default: return null
  }
}
