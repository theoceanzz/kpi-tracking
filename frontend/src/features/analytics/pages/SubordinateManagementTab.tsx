import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import ObjectiveMetricCard from '../components/ObjectiveMetricCard'
import AnalyticsComboChart from '../components/AnalyticsComboChart'
import ObjectiveDetailsWidget from '../components/ObjectiveDetailsWidget'
import TopEntitiesDashboardWidget from '../components/TopEntitiesDashboardWidget'
import { Target, TrendingUp, CheckCircle2, AlertTriangle, Users } from 'lucide-react'
import { subDays, subMonths, startOfYear } from 'date-fns'

type DateFilterType = 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER' | '6_MONTHS' | 'THIS_YEAR' | 'CUSTOM'

export default function SubordinateManagementTab() {
  const [filterType, setFilterType] = useState<DateFilterType>('THIS_YEAR')
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [onlyApproved, setOnlyApproved] = useState<boolean>(false)

  const dateRange = useMemo(() => {
    const now = new Date()
    switch (filterType) {
      case 'THIS_WEEK':
        return { from: subDays(now, 7).toISOString(), to: now.toISOString() }
      case 'THIS_MONTH':
        return { from: subDays(now, 30).toISOString(), to: now.toISOString() }
      case 'THIS_QUARTER':
        return { from: subDays(now, 90).toISOString(), to: now.toISOString() }
      case '6_MONTHS':
        return { from: subMonths(now, 6).toISOString(), to: now.toISOString() }
      case 'THIS_YEAR':
        return { from: startOfYear(now).toISOString(), to: now.toISOString() }
      case 'CUSTOM':
        return {
          from: customRange.from ? new Date(customRange.from).toISOString() : undefined,
          to: customRange.to ? new Date(customRange.to).toISOString() : undefined
        }
      default:
        return { from: undefined, to: undefined }
    }
  }, [filterType, customRange])

  // Independent queries for each metric with onlyApproved
  const completionQuery = useQuery({
    queryKey: ['subordinate-completion', dateRange.from, dateRange.to, onlyApproved],
    queryFn: () => statsApi.getSubordinateCompletion(dateRange.from, dateRange.to, onlyApproved)
  })

  const performanceQuery = useQuery({
    queryKey: ['subordinate-performance', dateRange.from, dateRange.to, onlyApproved],
    queryFn: () => statsApi.getSubordinatePerformance(dateRange.from, dateRange.to, onlyApproved)
  })

  const completedCountQuery = useQuery({
    queryKey: ['subordinate-completed-count', dateRange.from, dateRange.to, onlyApproved],
    queryFn: () => statsApi.getSubordinateCompletedCount(dateRange.from, dateRange.to, onlyApproved)
  })

  const atRiskQuery = useQuery({
    queryKey: ['subordinate-at-risk', dateRange.from, dateRange.to, onlyApproved],
    queryFn: () => statsApi.getSubordinateAtRisk(dateRange.from, dateRange.to, onlyApproved)
  })

  const personnelQuery = useQuery({
    queryKey: ['subordinate-personnel'],
    queryFn: () => statsApi.getSubordinatePersonnel()
  })

  const chartQuery = useQuery({
    queryKey: ['subordinate-combo-chart', dateRange.from, dateRange.to, onlyApproved],
    queryFn: () => statsApi.getSubordinateComboChart(dateRange.from, dateRange.to, onlyApproved)
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Global Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-wrap items-center gap-4 justify-between shadow-sm">
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

          <select 
            className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as DateFilterType)}
          >
            <option value="THIS_WEEK">Tuần này</option>
            <option value="THIS_MONTH">Tháng này</option>
            <option value="THIS_QUARTER">Quý này</option>
            <option value="6_MONTHS">6 tháng gần đây</option>
            <option value="THIS_YEAR">Năm nay</option>
            <option value="CUSTOM">Tùy chỉnh...</option>
          </select>

          {filterType === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={customRange.from}
                onChange={(e) => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
              />
              <span className="text-slate-400">-</span>
              <input 
                type="date" 
                className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={customRange.to}
                onChange={(e) => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
          )}
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
      
      <ObjectiveDetailsWidget dateRange={dateRange} onlyApproved={onlyApproved} />

      {/* Top Objectives & Top Units */}
      <TopEntitiesDashboardWidget dateRange={dateRange} onlyApproved={onlyApproved} />

    </div>
  )
}
