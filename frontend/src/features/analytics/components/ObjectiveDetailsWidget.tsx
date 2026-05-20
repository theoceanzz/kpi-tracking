import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import { Table2, BarChart2, Loader2, LayoutList } from 'lucide-react'
import ObjectiveDetailedTable from './ObjectiveDetailedTable'
import ObjectiveDetailedChart from './ObjectiveDetailedChart'
import ObjectiveDrawer from './ObjectiveDrawer'
import ScopedDashboardWidget from './ScopedDashboardWidget'

interface Props {
  dateRange: { from: string | undefined; to: string | undefined }
  onlyApproved?: boolean
}

export default function ObjectiveDetailsWidget({ dateRange, onlyApproved = false }: Props) {
  const [viewMode, setViewMode] = useState<'TABLE' | 'CHART'>('TABLE')
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    type: 'OBJECTIVE' | 'KR' | 'KPI';
    data: any;
  }>({ isOpen: false, type: 'OBJECTIVE', data: null })

  const { data, isLoading } = useQuery({
    queryKey: ['subordinate-detailed-objectives', dateRange.from, dateRange.to, onlyApproved],
    queryFn: () => statsApi.getSubordinateDetailedObjectives(dateRange.from, dateRange.to, onlyApproved)
  })

  const handleRowClick = (type: 'OBJECTIVE' | 'KR' | 'KPI', itemData: any) => {
    setDrawerState({ isOpen: true, type, data: itemData })
  }

  const closeDrawer = () => setDrawerState(prev => ({ ...prev, isOpen: false }))

  const renderDrawerContent = () => {
    if (!drawerState.data) return null;
    return (
      <ScopedDashboardWidget 
        type={drawerState.type} 
        id={drawerState.data.id} 
        dateRange={dateRange} 
        onlyApproved={onlyApproved}
      />
    );
  }

  return (
    <div className="w-full mt-10 flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
              <LayoutList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Chi tiết Mục tiêu</h2>
          </div>
          <p className="text-sm text-slate-500 ml-9">Theo dõi bảng dữ liệu phân cấp và biểu đồ dạng cột</p>
        </div>
        
        <div className="flex items-center bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-lg">
          <button
            onClick={() => setViewMode('TABLE')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
              viewMode === 'TABLE' ? 'bg-indigo-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/5'
            }`}
          >
            <Table2 className="w-4 h-4" /> Bảng chi tiết
          </button>
          <button
            onClick={() => setViewMode('CHART')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
              viewMode === 'CHART' ? 'bg-indigo-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/5'
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Thống kê cột
          </button>
        </div>
      </div>

      <div className="min-h-[500px]">
        {isLoading ? (
          <div className="w-full h-[550px] flex items-center justify-center bg-white dark:bg-slate-900/20 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <div className="text-sm font-medium text-slate-500">Đang tải chi tiết mục tiêu...</div>
            </div>
          </div>
        ) : viewMode === 'TABLE' ? (
          <ObjectiveDetailedTable data={data || []} onRowClick={handleRowClick} />
        ) : (
          <ObjectiveDetailedChart data={data || []} onBarClick={(d) => handleRowClick('OBJECTIVE', d)} />
        )}
      </div>

      <ObjectiveDrawer
        isOpen={drawerState.isOpen}
        onClose={closeDrawer}
        title={drawerState.data?.name || 'Chi tiết'}
        type={drawerState.type}
      >
        {renderDrawerContent()}
      </ObjectiveDrawer>
    </div>
  )
}
