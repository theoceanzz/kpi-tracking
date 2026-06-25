import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import TopObjectivesDualChart from './TopObjectivesDualChart'
import TopUnitsDualChart from './TopUnitsDualChart'
import { Trophy, TrendingDown, Target, Building2, Loader2 } from 'lucide-react'

interface Props {
  dateRange: { from?: string; to?: string }
  onlyApproved?: boolean
  periodId?: string
}

type FilterType = 'BEST' | 'WORST'

export default function TopEntitiesDashboardWidget({ dateRange, onlyApproved = false, periodId }: Props) {
  const [objFilter, setObjFilter] = useState<FilterType>('BEST')
  const [unitFilter, setUnitFilter] = useState<FilterType>('BEST')

  const objQuery = useQuery({
    queryKey: ['topEntities', 'objectives', objFilter, dateRange.from, dateRange.to, onlyApproved, periodId],
    queryFn: () => statsApi.getTopEntitiesDashboard(objFilter, dateRange.from, dateRange.to, onlyApproved, periodId),
  })

  const unitQuery = useQuery({
    queryKey: ['topEntities', 'units', unitFilter, dateRange.from, dateRange.to, onlyApproved, periodId],
    queryFn: () => statsApi.getTopEntitiesDashboard(unitFilter, dateRange.from, dateRange.to, onlyApproved, periodId),
  })

  return (
    <div className="space-y-8">
      {/* ═══════════ TOP MỤC TIÊU ═══════════ */}
      <section>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-500/20 shrink-0">
              <Target size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Top Mục tiêu
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {objFilter === 'BEST' ? 'Top 5 mục tiêu tiến độ tốt nhất' : 'Top 5 mục tiêu trì trệ nhất'}
              </p>
            </div>
          </div>

          {/* Filter Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5 w-full sm:w-auto">
            <button
              onClick={() => setObjFilter('BEST')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                objFilter === 'BEST'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Trophy size={13} />
              Tốt nhất
            </button>
            <button
              onClick={() => setObjFilter('WORST')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                objFilter === 'WORST'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <TrendingDown size={13} />
              Trì trệ
            </button>
          </div>
        </div>

        {objQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            Đang tải dữ liệu...
          </div>
        ) : (
          <TopObjectivesDualChart data={objQuery.data?.topObjectives ?? []} />
        )}
      </section>

      {/* ═══════════ TOP ĐƠN VỊ CON ═══════════ */}
      <section>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20 shrink-0">
              <Building2 size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Top Đơn vị con
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {unitFilter === 'BEST' ? 'Top 5 đơn vị tốt nhất' : 'Top 5 đơn vị trì trệ nhất'}
              </p>
            </div>
          </div>

          {/* Filter Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5 w-full sm:w-auto">
            <button
              onClick={() => setUnitFilter('BEST')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                unitFilter === 'BEST'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Trophy size={13} />
              Tốt nhất
            </button>
            <button
              onClick={() => setUnitFilter('WORST')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                unitFilter === 'WORST'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <TrendingDown size={13} />
              Trì trệ
            </button>
          </div>
        </div>

        {unitQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            Đang tải dữ liệu...
          </div>
        ) : (
          <TopUnitsDualChart data={unitQuery.data?.topUnits ?? []} />
        )}
      </section>
    </div>
  )
}
