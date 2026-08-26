import { useMemo, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { startOfYear, endOfDay } from 'date-fns'
import { statsApi } from '@/features/dashboard/api/statsApi'
import { personalKpiApi } from '@/features/dashboard/api/personalKpiApi'
import { personalObjectiveApi } from '@/features/dashboard/api/personalObjectiveApi'
import { orgUnitKpiApi } from '@/features/dashboard/api/orgUnitKpiApi'
import { useSummaryStats } from '../../hooks/useAnalytics'
import AnalyticsComboChart from '../AnalyticsComboChart'
import UnitComparisonBarChart from '../UnitComparisonBarChart'
import MemberRoleChart from '../MemberRoleChart'
import ObjectiveDetailsWidget from '../ObjectiveDetailsWidget'
import { UnitRiskSection, WarningListSection, EmployeeRankingTableSection, OrgUnitKpiDetailSection } from '../../pages/SummaryTab'
import { MyKpiDetailSection } from '../../pages/MyStatsTab'
import {
  MyObjectiveDetailSection,
} from '../../pages/MyObjectivesTab'
import {
  MyKpiSubmissionPieSection, MyKpiStatusDistSection,
  MyKpiEvaluationHistorySection, MyKpiScoreTrendSection,
} from '../../pages/MyStatsTab'
import {
  UnitKpiMetrics, MyKpiMetrics, MyObjectiveMetrics, SubordinateMetrics,
} from './metricWidgets'
import {
  DrillUnitTreeWidget, DrillUnitSummaryWidget, DrillEmployeeTableWidget,
  DrillUnitCompareWidget, DrillHeatmapWidget, DrillClassificationWidget, DrillMatrixWidget,
} from './drillWidgets'
import {
  BscBalanceMetrics, BscRadarWidget, BscPerspectiveCards, BscTrendWidget,
  BscUnitComparisonWidget, BscVsSystemWidget, BscCoverageWidget, BscRankingWidget,
} from './bscWidgets'

/**
 * Registry render biểu đồ ĐÃ GHIM ở trang chủ bằng ĐÚNG component + dữ liệu như trong tab thống kê,
 * tra theo `chartConfig.i` (id widget, duy nhất toàn hệ thống). Thanh lọc ở mục ghim
 * (PinnedWidgetsSection) truyền `filter` xuống; thiếu thì fallback bộ lọc mặc định của tab
 * (cả năm nay, groupBy=TIME, không lọc "đã duyệt").
 */

/** Bộ lọc áp cho biểu đồ ghim, do PinnedWidgetsSection cấp. */
export interface PinnedFilter {
  from?: string
  to?: string
  onlyApproved?: boolean
  periodId?: string
  periodIdTo?: string
  groupBy?: 'TIME' | 'PERIOD'
}

/** Bộ lọc mặc định của tab thống kê (useAnalyticsDateFilter: SINGLE + legacyMode THIS_YEAR). */
function useDefaultRange() {
  return useMemo(() => {
    const now = new Date()
    return { from: startOfYear(now).toISOString(), to: endOfDay(now).toISOString() }
  }, [])
}

/** Gộp filter từ mục ghim với mặc định (thiếu ngày → cả năm nay). */
function useResolved(filter?: PinnedFilter) {
  const def = useDefaultRange()
  return {
    from: filter?.from ?? def.from,
    to: filter?.to ?? def.to,
    onlyApproved: filter?.onlyApproved ?? false,
    periodId: filter?.periodId,
    periodIdTo: filter?.periodIdTo,
    groupBy: filter?.groupBy ?? 'TIME',
  }
}

/** Khung lấp đầy ô ghim (flex-column) để biểu đồ con `flex-1`/`h-full` giãn kín chiều cao. */
function Fill({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-full flex flex-col min-h-0">{children}</div>
}

function PinnedSummaryTrend({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo, groupBy } = useResolved(filter)
  const { data, isLoading } = useQuery({
    queryKey: ['pinned', 'summary-combo', from, to, onlyApproved, periodId, periodIdTo, groupBy],
    queryFn: () => orgUnitKpiApi.getComboChart({ from, to, onlyApproved, periodId, periodIdTo, groupBy }),
  })
  return <Fill><AnalyticsComboChart data={data?.points ?? []} isLoading={isLoading} itemName="KPI đơn vị" fillHeight /></Fill>
}

function PinnedSubTrend({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo, groupBy } = useResolved(filter)
  const { data, isLoading } = useQuery({
    queryKey: ['pinned', 'subordinate-combo', from, to, onlyApproved, periodId, periodIdTo, groupBy],
    queryFn: () => statsApi.getSubordinateComboChart(from, to, onlyApproved, periodId, periodIdTo, groupBy),
  })
  return <Fill><AnalyticsComboChart data={data?.points ?? []} isLoading={isLoading} itemName="Mục tiêu" fillHeight /></Fill>
}

function PinnedMyKpiTrend({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo, groupBy } = useResolved(filter)
  const { data, isLoading } = useQuery({
    queryKey: ['pinned', 'personalKpi-combo', from, to, onlyApproved, periodId, periodIdTo, groupBy],
    queryFn: () => personalKpiApi.getComboChart({ from, to, onlyApproved, periodId, periodIdTo, groupBy }),
  })
  return <Fill><AnalyticsComboChart data={data?.points ?? []} isLoading={isLoading} itemName="KPI đảm nhiệm" fillHeight /></Fill>
}

function PinnedMyObjTrend({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo, groupBy } = useResolved(filter)
  const { data, isLoading } = useQuery({
    queryKey: ['pinned', 'personalObjective-combo', from, to, onlyApproved, periodId, periodIdTo, groupBy],
    queryFn: () => personalObjectiveApi.getComboChart({ from, to, onlyApproved, periodId, periodIdTo, groupBy }),
  })
  return <Fill><AnalyticsComboChart data={data?.points ?? []} isLoading={isLoading} itemName="KPI đảm nhiệm" fillHeight /></Fill>
}

function PinnedUnitPerf({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo } = useResolved(filter)
  return <Fill><UnitComparisonBarChart from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}

function PinnedMemberDist() {
  // Cơ cấu nhân sự/vai trò không theo thời gian → không phụ thuộc filter.
  const { data } = useSummaryStats()
  return <Fill><MemberRoleChart data={data?.roleDistribution} /></Fill>
}

function PinnedSubDetail({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo } = useResolved(filter)
  return <Fill><ObjectiveDetailsWidget dateRange={{ from, to }} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}

function PinnedUnitRisk({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo } = useResolved(filter)
  return <Fill><UnitRiskSection bare from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}

function PinnedWarningList({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo } = useResolved(filter)
  return <Fill><WarningListSection bare from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}

function PinnedRankTable({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo } = useResolved(filter)
  return <Fill><EmployeeRankingTableSection bare from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}

/*
  Ba bảng chi tiết dưới đây từng là một placeholder "mở trang Thống kê": chúng sống trong state
  của từng tab nên không dựng lại được ở nơi khác. Nay mỗi bảng là một section tự quản
  bộ lọc/sắp xếp/phân trang/drawer nên ghim ra ngoài là dùng được thật.
*/
function PinnedKpiDetail({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo } = useResolved(filter)
  return <Fill><OrgUnitKpiDetailSection bare from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}

function PinnedMyKpiDetail({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo } = useResolved(filter)
  return <Fill><MyKpiDetailSection bare from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}

function PinnedMyObjDetail({ filter }: { filter?: PinnedFilter }) {
  const { from, to, onlyApproved, periodId, periodIdTo } = useResolved(filter)
  return <Fill><MyObjectiveDetailSection bare from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}


/* ── Bốn khối còn lại của tab "KPI của tôi" ─────────────────────────────── */
function PinnedMyKpiSubmissions({ filter }: { filter?: PinnedFilter }) {
  const { from, to, periodId, periodIdTo } = useResolved(filter)
  return <Fill><MyKpiSubmissionPieSection bare from={from} to={to} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}
function PinnedMyKpiStatusDist({ filter }: { filter?: PinnedFilter }) {
  const { from, to, periodId, periodIdTo } = useResolved(filter)
  return <Fill><MyKpiStatusDistSection bare from={from} to={to} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}
function PinnedMyKpiEvalHistory({ filter }: { filter?: PinnedFilter }) {
  const { from, to, periodId, periodIdTo } = useResolved(filter)
  return <Fill><MyKpiEvaluationHistorySection bare from={from} to={to} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}
function PinnedMyKpiScoreTrend({ filter }: { filter?: PinnedFilter }) {
  const { from, to, periodId, periodIdTo } = useResolved(filter)
  return <Fill><MyKpiScoreTrendSection bare from={from} to={to} periodId={periodId} periodIdTo={periodIdTo} /></Fill>
}

/* ── Hàng thẻ chỉ số của bốn tab ────────────────────────────────────────── */
const wrap = (C: ComponentType<{ filter?: PinnedFilter }>) =>
  function Wrapped({ filter }: { filter?: PinnedFilter }) {
    const resolved = useResolved(filter)
    return <Fill><C filter={resolved} /></Fill>
  }

/**
 * `chartConfig.i` → component ghim (tự fetch). Chỉ chứa các widget của tab analytics; widget của
 * Report-builder (không có `i` khớp) sẽ rơi về nhánh legacy trong PinnedWidgetContent.
 */
export const PINNED_REGISTRY: Record<string, ComponentType<{ filter?: PinnedFilter }>> = {
  // Xu hướng (combo bar+line) — 4 tab
  'trend-chart': PinnedSummaryTrend,   // Tổng quan đơn vị
  'sub-trend': PinnedSubTrend,         // Mục tiêu cấp dưới
  'mykpi-trend': PinnedMyKpiTrend,     // KPI của tôi
  'myobj-trend': PinnedMyObjTrend,     // Mục tiêu của tôi
  // Hiệu suất & tiến độ đơn vị
  'unit-perf': PinnedUnitPerf,
  'sub-unit-perf': PinnedUnitPerf,
  // Nhân sự & vai trò
  'member-dist': PinnedMemberDist,
  'sub-member': PinnedMemberDist,
  // Chi tiết mục tiêu cấp dưới (đã self-contained)
  'sub-detail': PinnedSubDetail,
  // Rủi ro / xếp hạng (Tổng quan đơn vị) — render bản `bare` của section trong tab
  'unit-risk': PinnedUnitRisk,
  'warning-list': PinnedWarningList,
  'rank-table': PinnedRankTable,
  // Bảng chi tiết KPI (Tổng quan / KPI của tôi / Mục tiêu của tôi)
  'kpi-detail': PinnedKpiDetail,
  'mykpi-detail': PinnedMyKpiDetail,
  'myobj-detail': PinnedMyObjDetail,

  // Hàng thẻ chỉ số đứng đầu mỗi tab
  'unit-kpi-metrics': wrap(UnitKpiMetrics),
  'sub-metrics': wrap(SubordinateMetrics),
  'mykpi-metrics': wrap(MyKpiMetrics),
  'myobj-metrics': wrap(MyObjectiveMetrics),

  // Phần còn lại của tab "KPI của tôi"
  'mykpi-submissions': PinnedMyKpiSubmissions,
  'mykpi-status-dist': PinnedMyKpiStatusDist,
  'mykpi-eval-history': PinnedMyKpiEvalHistory,
  'mykpi-eval-trend': PinnedMyKpiScoreTrend,

  // Tab "Phân cấp"
  'drill-tree': wrap(DrillUnitTreeWidget),
  'drill-summary': wrap(DrillUnitSummaryWidget),
  'drill-employees': wrap(DrillEmployeeTableWidget),
  'drill-compare': wrap(DrillUnitCompareWidget),
  'drill-heatmap': wrap(DrillHeatmapWidget),
  'drill-classification': wrap(DrillClassificationWidget),
  'drill-matrix': wrap(DrillMatrixWidget),

  // Tab "Hạng mục (BSC)"
  'bsc-metrics': wrap(BscBalanceMetrics),
  'bsc-radar': wrap(BscRadarWidget),
  'bsc-perspectives': wrap(BscPerspectiveCards),
  'bsc-trend': wrap(BscTrendWidget),
  'bsc-unit-comparison': wrap(BscUnitComparisonWidget),
  'bsc-vs-system': wrap(BscVsSystemWidget),
  'bsc-coverage': wrap(BscCoverageWidget),
  'bsc-ranking': wrap(BscRankingWidget),
}
