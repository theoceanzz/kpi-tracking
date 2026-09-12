import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import ObjectiveMetricCard from '../components/ObjectiveMetricCard'
import AnalyticsComboChart from '../components/AnalyticsComboChart'
import ObjectiveDetailsWidget from '../components/ObjectiveDetailsWidget'
import UnitComparisonBarChart from '../components/UnitComparisonBarChart'
import MemberRoleChart from '../components/MemberRoleChart'
import { useSummaryStats } from '../hooks/useAnalytics'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { OkrFlowSection } from '../components/advanced/OkrAdvanced'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import { Target, TrendingUp, CheckCircle2, AlertTriangle, Users, Network } from 'lucide-react'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import { useDashboardCustomization } from '@/components/common/dashboard/useDashboardCustomization'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import type { WidgetType } from '@/types/datasource'
import AnalyticsTabHeader from '../components/AnalyticsTabHeader'

const CONFIG_REPORT_NAME = '__SUBORDINATE_DASHBOARD_CONFIG__'
const DEFAULT_WIDGETS: DashboardWidget[] = [
  { i: 'sub-trend', type: 'SUB_TREND', title: 'Xu hướng mục tiêu theo thời gian', x: 0, y: 0, w: 12, h: 15, visible: true },
  { i: 'sub-detail', type: 'SUB_DETAIL', title: 'Chi tiết mục tiêu', x: 0, y: 15, w: 12, h: 20, visible: true },
  { i: 'sub-member', type: 'SUB_MEMBER', title: 'Nhân sự & vai trò theo đơn vị', x: 0, y: 35, w: 12, h: 11, visible: true },
  { i: 'sub-unit-perf', type: 'SUB_UNIT_PERF', title: 'Hiệu suất & Tiến độ đơn vị', x: 0, y: 46, w: 12, h: 13, visible: true },
  // Mặc định ẩn: luồng OKR chỉ có nghĩa khi Key Result đã được phân bổ trọng số xuống đơn vị.
  { i: 'sub-okr-flow', type: 'SUB_OKR_FLOW', title: 'Luồng phân bổ OKR', x: 0, y: 59, w: 12, h: 13, visible: false },
]
// Loại FE → enum WidgetType hợp lệ ở DB (không cần migration).
const toBackendWidgetType = (t: string): WidgetType =>
  t === 'SUB_TREND' ? 'TREND_CHART'
  : t === 'SUB_DETAIL' ? 'TABLE'
  : t === 'SUB_MEMBER' ? 'MEMBER_DIST'
  : t === 'SUB_OKR_FLOW' ? 'HEATMAP'
  : 'UNIT_PERFORMANCE'
const CATALOG: { template: DashboardWidget; icon: React.ReactNode }[] = DEFAULT_WIDGETS.map(t => ({
  template: t,
  icon: t.type === 'SUB_DETAIL' ? <Target size={24} />
    : t.type === 'SUB_MEMBER' ? <Users size={24} />
    : <TrendingUp size={24} />,
}))

export default function SubordinateManagementTab() {
  const onlyApproved = false
  const { periodId, periodIdTo, from, to, groupBy, controls } = useAnalyticsDateFilter({ selectClassName: 'h-9' })
  const perf = usePerformanceScale()
  const dateRange = useMemo(() => ({ from, to }), [from, to])

  // Independent queries for each metric with onlyApproved
  const completionQuery = useQuery({
    queryKey: ['subordinate-completion', dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo],
    queryFn: () => statsApi.getSubordinateCompletion(dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo)
  })

  const performanceQuery = useQuery({
    queryKey: ['subordinate-performance', dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo],
    queryFn: () => statsApi.getSubordinatePerformance(dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo)
  })

  const completedCountQuery = useQuery({
    queryKey: ['subordinate-completed-count', dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo],
    queryFn: () => statsApi.getSubordinateCompletedCount(dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo)
  })

  const atRiskQuery = useQuery({
    queryKey: ['subordinate-at-risk', dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo],
    queryFn: () => statsApi.getSubordinateAtRisk(dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo)
  })

  const personnelQuery = useQuery({
    queryKey: ['subordinate-personnel'],
    queryFn: () => statsApi.getSubordinatePersonnel()
  })

  const chartQuery = useQuery({
    queryKey: ['subordinate-combo-chart', dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo, groupBy],
    queryFn: () => statsApi.getSubordinateComboChart(dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo, groupBy)
  })

  // Cấu trúc nhân sự / vai trò (theo đơn vị của user + đơn vị con) — không phụ thuộc thời gian.
  const { data: summary } = useSummaryStats()

  // ── Tuỳ chỉnh giao diện (lưới widget dùng chung) ──────────────────────────
  const dash = useDashboardCustomization({
    configReportName: CONFIG_REPORT_NAME,
    reportDescription: 'Cấu hình giao diện Tổng quan mục tiêu cấp dưới',
    defaultWidgets: DEFAULT_WIDGETS,
    toBackendWidgetType,
  })
  const { isEditMode, handleTogglePin } = dash

  const renderWidget = (w: DashboardWidget) => {
    switch (w.type) {
      case 'SUB_TREND': return (
        <ChartWrapper chromeless title="Xu hướng mục tiêu theo thời gian" icon={<TrendingUp size={20} className="text-[var(--color-primary)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <AnalyticsComboChart data={chartQuery.data?.points ?? []} isLoading={chartQuery.isLoading} itemName="Mục tiêu" fillHeight />
        </ChartWrapper>
      )
      case 'SUB_DETAIL': return (
        <ChartWrapper chromeless title="Chi tiết mục tiêu" icon={<Target size={20} className="text-[var(--color-primary)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <ObjectiveDetailsWidget dateRange={dateRange} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} />
        </ChartWrapper>
      )
      case 'SUB_MEMBER': return (
        <ChartWrapper title="Nhân sự & vai trò theo đơn vị" icon={<Users size={20} className="text-[var(--color-primary)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <MemberRoleChart data={summary?.roleDistribution} />
        </ChartWrapper>
      )
      case 'SUB_UNIT_PERF': return (
        <ChartWrapper title="Hiệu suất & Tiến độ đơn vị" icon={<TrendingUp size={20} className="text-[var(--color-success)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <UnitComparisonBarChart from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} />
        </ChartWrapper>
      )
      case 'SUB_OKR_FLOW': return (
        <ChartWrapper title="Luồng phân bổ OKR" icon={<Network size={20} className="text-[var(--color-primary)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <OkrFlowSection filter={{ periodId, periodIdTo }} />
        </ChartWrapper>
      )
      default: return null
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <AnalyticsTabHeader
        title="Mục tiêu đơn vị"
        description="Tổng quan mục tiêu và KPI của các đơn vị, nhân sự thuộc quyền quản lý của bạn."
        actions={<DashboardEditToolbar api={dash} />}
        filters={<>{controls}</>}
      />

      {/* Metrics Grid */}
      <div id="tour-analytics-metrics" className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <ObjectiveMetricCard
          title="Tiến độ tổng quan"
          value={completionQuery.data?.value !== undefined ? `${completionQuery.data.value.toFixed(1)}%` : '0%'}
          icon={<Target size={20} />}
          isLoading={completionQuery.isLoading}
        />
        <ObjectiveMetricCard
          title="Hiệu suất tổng quan"
          value={performanceQuery.data?.value !== undefined ? perf.format(performanceQuery.data.value) : perf.format(0)}
          icon={<TrendingUp size={20} />}
          isLoading={performanceQuery.isLoading}
        />
        <ObjectiveMetricCard
          title="Mục tiêu hoàn thành"
          value={completedCountQuery.data ? `${completedCountQuery.data.completed}/${completedCountQuery.data.total}` : '0/0'}
          subtitle="trên tổng số MT"
          icon={<CheckCircle2 size={20} className="text-[var(--color-success)]" />}
          isLoading={completedCountQuery.isLoading}
        />
        <ObjectiveMetricCard
          title="Mục tiêu rủi ro"
          value={atRiskQuery.data?.count ?? 0}
          subtitle="Tiến độ thấp & sắp hết hạn"
          icon={<AlertTriangle size={20} className="text-[var(--color-error)]" />}
          isLoading={atRiskQuery.isLoading}
        />
        <ObjectiveMetricCard
          title="Tổng nhân sự"
          value={personnelQuery.data?.count ?? 0}
          icon={<Users size={20} />}
          isLoading={personnelQuery.isLoading}
        />
      </div>

      {/* Lưới widget tuỳ chỉnh: Xu hướng + Chi tiết + Nhân sự/vai trò + Hiệu suất đơn vị */}
      <div id="tour-analytics-widgets">
        <DashboardCustomizeChrome api={dash} renderWidget={renderWidget} catalog={CATALOG} />
      </div>
    </div>
  )
}
