import { useQuery } from '@tanstack/react-query'
import {
  Target, TrendingUp, CheckCircle, CheckCircle2, AlertTriangle, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { statsApi } from '@/features/dashboard/api/statsApi'
import { personalKpiApi } from '@/features/dashboard/api/personalKpiApi'
import { personalObjectiveApi } from '@/features/dashboard/api/personalObjectiveApi'
import { orgUnitKpiApi } from '@/features/dashboard/api/orgUnitKpiApi'
import ObjectiveMetricCard from '../ObjectiveMetricCard'
import { useSummaryStats } from '../../hooks/useAnalytics'
import { usePerformanceScale } from '../../hooks/usePerformanceScale'
import type { PinnedFilter } from './pinnedWidgetRegistry'

/**
 * Bốn hàng thẻ chỉ số của trang Phân tích, tách ra để đặt lên lưới trang chủ.
 *
 * <p>Mỗi hàng gọi ĐÚNG những truy vấn mà tab tương ứng gọi, nên số liệu hai nơi luôn khớp.
 * Khác biệt duy nhất: bộ lọc thời gian đến từ tham số thay vì từ thanh lọc của tab —
 * xem `DashboardFilterContext`.
 */

/** Lưới thẻ tự xuống dòng: ô trên trang chủ hẹp hơn cả một tab thống kê. */
function MetricGrid({ children, cols }: { children: React.ReactNode; cols: 4 | 5 }) {
  return (
    <div className={cn(
      'grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2',
      cols === 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4',
    )}>
      {children}
    </div>
  )
}

/** Thẻ chỉ số kiểu "icon tròn bên trái" — đúng khuôn của SummaryTab/MyStatsTab. */
function StatTile({ icon, tone, label, children }: {
  icon: React.ReactNode
  tone: 'indigo' | 'emerald' | 'amber' | 'red' | 'teal' | 'violet'
  label: string
  children: React.ReactNode
}) {
  const tones = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
    red: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
    teal: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400',
    violet: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
  } as const
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
      <div className={cn('w-11 h-11 rounded-full flex items-center justify-center shrink-0', tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-500">{label}</p>
        {children}
      </div>
    </div>
  )
}

const Big = ({ children }: { children: React.ReactNode }) => (
  <p className="text-2xl font-black tabular-nums">{children}</p>
)

/** Chỉ số KPI đơn vị — hàng thẻ đầu tab "KPI đơn vị". */
export function UnitKpiMetrics({ filter }: { filter?: PinnedFilter }) {
  const perf = usePerformanceScale()
  const { from, to, periodId, periodIdTo } = filter ?? {}
  const onlyApproved = filter?.onlyApproved ?? false

  const { data: metrics } = useQuery({
    queryKey: ['orgUnitKpi', 'metrics', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => orgUnitKpiApi.getMetrics({ from, to, onlyApproved, periodId, periodIdTo }),
  })
  const { data: mainData } = useSummaryStats()

  return (
    <MetricGrid cols={5}>
      <StatTile icon={<TrendingUp size={22} />} tone="indigo" label="Tiến độ trung bình">
        <Big>{metrics?.averageProgress?.toFixed(1) ?? 0}%</Big>
      </StatTile>
      <StatTile icon={<Target size={22} />} tone="emerald" label="Hiệu suất trung bình (đánh giá)">
        <Big>{perf.format(metrics?.averagePerformance ?? 0)}</Big>
      </StatTile>
      <StatTile icon={<CheckCircle size={22} />} tone="amber" label="Trạng thái KPI">
        <p className="text-sm font-black tabular-nums">{metrics?.runningKpis ?? 0} Đang chạy</p>
        <p className="text-sm font-black text-emerald-600 tabular-nums">{metrics?.completedKpis ?? 0} Hoàn thành</p>
      </StatTile>
      <StatTile icon={<AlertTriangle size={22} />} tone="red" label="KPI Rủi ro / Chậm">
        <Big>{metrics?.riskKpis ?? 0}</Big>
      </StatTile>
      <StatTile icon={<Users size={22} />} tone="teal" label="Tổng nhân sự">
        <Big>{mainData?.totalMembers ?? '—'}</Big>
      </StatTile>
    </MetricGrid>
  )
}

/** Chỉ số KPI của tôi — hàng thẻ đầu tab "KPI của tôi". */
export function MyKpiMetrics({ filter }: { filter?: PinnedFilter }) {
  const perf = usePerformanceScale()
  const { from, to, periodId, periodIdTo } = filter ?? {}
  const onlyApproved = filter?.onlyApproved ?? false

  const { data: metrics } = useQuery({
    queryKey: ['personalKpi', 'metrics', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => personalKpiApi.getMetrics({ from, to, onlyApproved, periodId, periodIdTo }),
  })

  return (
    <MetricGrid cols={5}>
      <StatTile icon={<Target size={20} />} tone="violet" label="Tổng KPI">
        <Big>{(metrics?.runningKpis ?? 0) + (metrics?.completedKpis ?? 0)}</Big>
      </StatTile>
      <StatTile icon={<TrendingUp size={20} />} tone="indigo" label="Tiến độ TB">
        <Big>{metrics?.averageProgress?.toFixed(1) ?? 0}%</Big>
      </StatTile>
      <StatTile icon={<Target size={20} />} tone="emerald" label="Hiệu suất TB (đánh giá)">
        <Big>{perf.format(metrics?.averagePerformance ?? 0)}</Big>
      </StatTile>
      <StatTile icon={<CheckCircle size={20} />} tone="amber" label="Đang chạy / HT">
        <p className="text-base font-black tabular-nums">{metrics?.runningKpis ?? 0} / {metrics?.completedKpis ?? 0}</p>
      </StatTile>
      <StatTile icon={<AlertTriangle size={20} />} tone="red" label="Rủi ro / Chậm">
        <Big>{metrics?.riskKpis ?? 0}</Big>
      </StatTile>
    </MetricGrid>
  )
}

/** Chỉ số mục tiêu của tôi — hàng thẻ đầu tab "Mục tiêu của tôi". */
export function MyObjectiveMetrics({ filter }: { filter?: PinnedFilter }) {
  const perf = usePerformanceScale()
  const { from, to, periodId, periodIdTo } = filter ?? {}
  const onlyApproved = filter?.onlyApproved ?? false

  const { data: metrics } = useQuery({
    queryKey: ['personalObjective', 'metrics', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => personalObjectiveApi.getMetrics({ from, to, onlyApproved, periodId, periodIdTo }),
  })

  return (
    <MetricGrid cols={4}>
      <StatTile icon={<TrendingUp size={22} />} tone="indigo" label="Tiến độ trung bình">
        <Big>{metrics?.averageProgress?.toFixed(1) ?? 0}%</Big>
      </StatTile>
      <StatTile icon={<Target size={22} />} tone="emerald" label="Hiệu suất trung bình (đánh giá)">
        <Big>{perf.format(metrics?.averagePerformance ?? 0)}</Big>
      </StatTile>
      <StatTile icon={<CheckCircle size={22} />} tone="amber" label="Trạng thái KPI">
        <p className="text-sm font-black tabular-nums">{metrics?.runningKpis ?? 0} Đang chạy</p>
        <p className="text-sm font-black text-emerald-600 tabular-nums">{metrics?.completedKpis ?? 0} Hoàn thành</p>
      </StatTile>
      <StatTile icon={<AlertTriangle size={22} />} tone="red" label="KPI Rủi ro / Chậm">
        <Big>{metrics?.riskKpis ?? 0}</Big>
      </StatTile>
    </MetricGrid>
  )
}

/** Chỉ số mục tiêu đơn vị — hàng thẻ đầu tab "Mục tiêu đơn vị" (5 API độc lập, giữ nguyên). */
export function SubordinateMetrics({ filter }: { filter?: PinnedFilter }) {
  const perf = usePerformanceScale()
  const { from, to, periodId, periodIdTo } = filter ?? {}
  const onlyApproved = filter?.onlyApproved ?? false

  const completion = useQuery({
    queryKey: ['subordinate-completion', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => statsApi.getSubordinateCompletion(from, to, onlyApproved, periodId, periodIdTo),
  })
  const performance = useQuery({
    queryKey: ['subordinate-performance', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => statsApi.getSubordinatePerformance(from, to, onlyApproved, periodId, periodIdTo),
  })
  const completedCount = useQuery({
    queryKey: ['subordinate-completed-count', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => statsApi.getSubordinateCompletedCount(from, to, onlyApproved, periodId, periodIdTo),
  })
  const atRisk = useQuery({
    queryKey: ['subordinate-at-risk', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => statsApi.getSubordinateAtRisk(from, to, onlyApproved, periodId, periodIdTo),
  })
  const personnel = useQuery({
    queryKey: ['subordinate-personnel'],
    queryFn: () => statsApi.getSubordinatePersonnel(),
  })

  return (
    <MetricGrid cols={5}>
      <ObjectiveMetricCard
        title="Tiến độ tổng quan"
        value={completion.data?.value !== undefined ? `${completion.data.value.toFixed(1)}%` : '0%'}
        icon={<Target size={20} />}
        isLoading={completion.isLoading}
      />
      <ObjectiveMetricCard
        title="Hiệu suất tổng quan"
        value={performance.data?.value !== undefined ? perf.format(performance.data.value) : perf.format(0)}
        icon={<TrendingUp size={20} />}
        isLoading={performance.isLoading}
      />
      <ObjectiveMetricCard
        title="Mục tiêu hoàn thành"
        value={completedCount.data ? `${completedCount.data.completed}/${completedCount.data.total}` : '0/0'}
        subtitle="trên tổng số MT"
        icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        isLoading={completedCount.isLoading}
      />
      <ObjectiveMetricCard
        title="Mục tiêu rủi ro"
        value={atRisk.data?.count ?? 0}
        subtitle="Tiến độ thấp & sắp hết hạn"
        icon={<AlertTriangle size={20} className="text-rose-500" />}
        isLoading={atRisk.isLoading}
      />
      <ObjectiveMetricCard
        title="Tổng nhân sự"
        value={personnel.data?.count ?? 0}
        icon={<Users size={20} />}
        isLoading={personnel.isLoading}
      />
    </MetricGrid>
  )
}
