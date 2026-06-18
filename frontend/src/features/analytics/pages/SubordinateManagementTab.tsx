import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import ObjectiveMetricCard from '../components/ObjectiveMetricCard'
import AnalyticsComboChart from '../components/AnalyticsComboChart'
import ObjectiveDetailsWidget from '../components/ObjectiveDetailsWidget'
import TopEntitiesDashboardWidget from '../components/TopEntitiesDashboardWidget'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { Target, TrendingUp, CheckCircle2, AlertTriangle, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SubordinateManagementTab() {
  const [filterStuck, setFilterStuck] = useState(false)
  const filterSentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = filterSentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]) setFilterStuck(!entries[0].isIntersecting) },
      { rootMargin: '-65px 0px 0px 0px', threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [onlyApproved, setOnlyApproved] = useState<boolean>(false)
  const { periodId, from, to, controls } = useAnalyticsDateFilter({ selectClassName: 'h-10' })
  const dateRange = useMemo(() => ({ from, to }), [from, to])

  // Independent queries for each metric with onlyApproved
  const completionQuery = useQuery({
    queryKey: ['subordinate-completion', dateRange.from, dateRange.to, onlyApproved, periodId],
    queryFn: () => statsApi.getSubordinateCompletion(dateRange.from, dateRange.to, onlyApproved, periodId)
  })

  const performanceQuery = useQuery({
    queryKey: ['subordinate-performance', dateRange.from, dateRange.to, onlyApproved, periodId],
    queryFn: () => statsApi.getSubordinatePerformance(dateRange.from, dateRange.to, onlyApproved, periodId)
  })

  const completedCountQuery = useQuery({
    queryKey: ['subordinate-completed-count', dateRange.from, dateRange.to, onlyApproved, periodId],
    queryFn: () => statsApi.getSubordinateCompletedCount(dateRange.from, dateRange.to, onlyApproved, periodId)
  })

  const atRiskQuery = useQuery({
    queryKey: ['subordinate-at-risk', dateRange.from, dateRange.to, onlyApproved, periodId],
    queryFn: () => statsApi.getSubordinateAtRisk(dateRange.from, dateRange.to, onlyApproved, periodId)
  })

  const personnelQuery = useQuery({
    queryKey: ['subordinate-personnel'],
    queryFn: () => statsApi.getSubordinatePersonnel()
  })

  const chartQuery = useQuery({
    queryKey: ['subordinate-combo-chart', dateRange.from, dateRange.to, onlyApproved, periodId],
    queryFn: () => statsApi.getSubordinateComboChart(dateRange.from, dateRange.to, onlyApproved, periodId)
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Sentinel for sticky detection */}
      <div ref={filterSentinelRef} className="h-px" aria-hidden />

      {/* Global Filter Toolbar */}
      <div className={cn(
        'sticky top-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center gap-4 justify-between transition-all duration-200',
        filterStuck ? 'p-3 shadow-lg shadow-slate-200/80 dark:shadow-slate-950/60' : 'p-4 shadow-sm'
      )}>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Target size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Tổng quan mục tiêu cấp dưới</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Lọc dữ liệu đồng bộ cho tất cả biểu đồ</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          {/* Approved submissions only toggle */}
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-350 cursor-pointer select-none">
            <input 
              type="checkbox"
              className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800"
              checked={onlyApproved}
              onChange={(e) => setOnlyApproved(e.target.checked)}
            />
            Chỉ tính bài nộp đã duyệt
          </label>

          {controls}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <ObjectiveMetricCard 
          title="Tiến độ tổng quan" 
          value={completionQuery.data?.value !== undefined ? `${completionQuery.data.value.toFixed(1)}%` : '0%'}
          icon={<Target size={20} />}
          isLoading={completionQuery.isLoading}
        />
        <ObjectiveMetricCard 
          title="Hiệu suất tổng quan" 
          value={performanceQuery.data?.value !== undefined ? `${performanceQuery.data.value.toFixed(1)}%` : '0%'}
          icon={<TrendingUp size={20} />}
          isLoading={performanceQuery.isLoading}
        />
        <ObjectiveMetricCard 
          title="Mục tiêu hoàn thành" 
          value={completedCountQuery.data ? `${completedCountQuery.data.completed}/${completedCountQuery.data.total}` : '0/0'}
          subtitle="trên tổng số MT"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
          isLoading={completedCountQuery.isLoading}
        />
        <ObjectiveMetricCard 
          title="Mục tiêu rủi ro" 
          value={atRiskQuery.data?.count ?? 0}
          subtitle="Tiến độ thấp & sắp hết hạn"
          icon={<AlertTriangle size={20} className="text-rose-500" />}
          isLoading={atRiskQuery.isLoading}
        />
        <ObjectiveMetricCard 
          title="Tổng nhân sự" 
          value={personnelQuery.data?.count ?? 0}
          icon={<Users size={20} />}
          isLoading={personnelQuery.isLoading}
        />
      </div>

      {/* Combo Chart */}
      <div className="pt-4">
        <AnalyticsComboChart 
          data={chartQuery.data?.points ?? []} 
          isLoading={chartQuery.isLoading} 
          itemName="Mục tiêu"
        />
      </div>
      
      <ObjectiveDetailsWidget dateRange={dateRange} onlyApproved={onlyApproved} periodId={periodId} />

      {/* Top Objectives & Top Units */}
      <TopEntitiesDashboardWidget dateRange={dateRange} onlyApproved={onlyApproved} periodId={periodId} />

    </div>
  )
}
