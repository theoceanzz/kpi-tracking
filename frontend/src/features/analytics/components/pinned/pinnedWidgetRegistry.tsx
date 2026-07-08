import { useMemo, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ListChecks } from 'lucide-react'
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
import { UnitRiskSection, WarningListSection, EmployeeRankingTableSection } from '../../pages/SummaryTab'

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

/**
 * Bảng chi tiết KPI đầy đủ (lọc/sắp xếp/phân trang/drawer) gắn chặt state của từng tab, không hợp
 * để nhồi vào thẻ ghim nhỏ. Hiển thị gợi ý mở trang Thống kê thay vì render trống.
 */
function PinnedDetailPlaceholder() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-center px-4 text-slate-400 dark:text-slate-500 select-none">
      <ListChecks className="w-9 h-9 opacity-40" strokeWidth={1.5} />
      <p className="text-xs font-semibold">Mở trang Thống kê để xem bảng chi tiết đầy đủ</p>
    </div>
  )
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
  // Bảng chi tiết KPI (Tổng quan / KPI của tôi / Mục tiêu của tôi) — placeholder gọn thay vì render trống
  'kpi-detail': PinnedDetailPlaceholder,
  'mykpi-detail': PinnedDetailPlaceholder,
  'myobj-detail': PinnedDetailPlaceholder,
}
