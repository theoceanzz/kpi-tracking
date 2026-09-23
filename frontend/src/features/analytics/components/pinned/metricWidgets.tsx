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

/**
 * Hàng thẻ chỉ số nằm trong MỘT ô lưới cao cố định (trang chủ lẫn tab Thống kê), nên không được
 * xuống dòng: xuống dòng là hàng thứ hai bị `overflow-hidden` của ô cắt mất. Hẹp quá thì cuộn ngang
 * trong ô — mọi thẻ vẫn đọc được, thay vì hàng dưới biến mất không dấu vết.
 */
function MetricGrid({ children }: { children: React.ReactNode; cols: 4 | 5 }) {
  return (
    // `@container`: thẻ co đệm/chữ theo bề rộng CỦA Ô (khi bảng cấu hình mở, lưới hẹp lại còn
    // ~1000px mà viewport không đổi — breakpoint theo viewport không biết điều đó).
    <div className="@container grid grid-flow-col auto-cols-[minmax(172px,1fr)] gap-3 sm:gap-4 overflow-x-auto custom-scrollbar pb-1">
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
  // Một màu cho mọi icon; chỉ thẻ Rủi ro giữ đỏ, vì đó là thẻ duy nhất cần bật lên trước.
  const neutral = 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
  const tones = {
    indigo: neutral,
    emerald: neutral,
    amber: neutral,
    red: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
    teal: neutral,
    violet: neutral,
  } as const
  return (
    <div className="bg-[var(--color-card)] rounded-widget p-4 @min-[1100px]:p-5 border border-[var(--color-border)] flex items-center gap-3 @min-[1100px]:gap-4">
      <div className={cn('w-10 h-10 @min-[1100px]:w-11 @min-[1100px]:h-11 rounded-full flex items-center justify-center shrink-0', tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {children}
      </div>
    </div>
  )
}

const Big = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xl @min-[1100px]:text-2xl font-semibold tabular-nums">{children}</p>
)

/**
 * Chỉ số KPI đơn vị — hàng thẻ đầu tab "KPI đơn vị".
 *
 * <p>`orgUnitId` thu phạm vi về một đơn vị (và cây con) — tab Tổng quan truyền từ cài đặt của ô;
 * trang chủ không có phạm vi đơn vị nên bỏ trống.
 */
export function UnitKpiMetrics({ filter, orgUnitId }: { filter?: PinnedFilter; orgUnitId?: string }) {
  const perf = usePerformanceScale()
  const { from, to, periodId, periodIdTo } = filter ?? {}
  const onlyApproved = filter?.onlyApproved ?? false

  const { data: metrics } = useQuery({
    queryKey: ['orgUnitKpi', 'metrics', from, to, onlyApproved, periodId, periodIdTo, orgUnitId],
    queryFn: () => orgUnitKpiApi.getMetrics({ orgUnitId, from, to, onlyApproved, periodId, periodIdTo }),
  })
  const { data: mainData } = useSummaryStats(orgUnitId)

  return (
    <MetricGrid cols={5}>
      <StatTile icon={<TrendingUp size={22} />} tone="indigo" label="Tiến độ trung bình">
        <Big>{metrics?.averageProgress?.toFixed(1) ?? 0}%</Big>
      </StatTile>
      <StatTile icon={<Target size={22} />} tone="emerald" label="Hiệu suất trung bình (đánh giá)">
        <Big>{perf.format(metrics?.averagePerformance ?? 0)}</Big>
      </StatTile>
      <StatTile icon={<CheckCircle size={22} />} tone="amber" label="Trạng thái KPI">
        <p className="text-sm font-semibold tabular-nums">{metrics?.runningKpis ?? 0} Đang chạy</p>
        <p className="text-sm font-semibold text-emerald-600 tabular-nums">{metrics?.completedKpis ?? 0} Hoàn thành</p>
      </StatTile>
      <StatTile icon={<AlertTriangle size={22} />} tone="red" label="KPI Rủi ro / Chậm">
        <Big>{metrics?.riskKpis ?? 0}</Big>
      </StatTile>
      <StatTile icon={<Users size={22} />} tone="teal" label="Tổng nhân sự">
        <Big>{mainData?.totalMembers ?? '-'}</Big>
      </StatTile>
    </MetricGrid>
  )
}

/** Chỉ số KPI của tôi — hàng thẻ đầu tab "Kết quả của tôi". */
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
        <p className="text-base font-semibold tabular-nums">{metrics?.runningKpis ?? 0} / {metrics?.completedKpis ?? 0}</p>
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
        <p className="text-sm font-semibold tabular-nums">{metrics?.runningKpis ?? 0} Đang chạy</p>
        <p className="text-sm font-semibold text-emerald-600 tabular-nums">{metrics?.completedKpis ?? 0} Hoàn thành</p>
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
        icon={<CheckCircle2 size={20} className="text-slate-400" />}
        isLoading={completedCount.isLoading}
      />
      <ObjectiveMetricCard
        title="Mục tiêu rủi ro"
        value={atRisk.data?.count ?? 0}
        subtitle="Tiến độ thấp & sắp hết hạn"
        icon={<AlertTriangle size={20} className="text-red-500" />}
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
