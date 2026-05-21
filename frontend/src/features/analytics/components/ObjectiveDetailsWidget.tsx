import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import { Table2, BarChart2, Loader2, LayoutList, ChevronUp, ChevronDown } from 'lucide-react'
import ObjectiveDetailedTable from './ObjectiveDetailedTable'
import ObjectiveDetailedChart from './ObjectiveDetailedChart'
import ObjectiveDrawer from './ObjectiveDrawer'
import ScopedDashboardWidget from './ScopedDashboardWidget'
import Pagination from '@/components/common/Pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { OrgUnitFilterDto } from '@/types/stats'

interface Props {
  dateRange: { from: string | undefined; to: string | undefined }
  onlyApproved?: boolean
}

function flattenOrgUnits(units: OrgUnitFilterDto[]): OrgUnitFilterDto[] {
  const result: OrgUnitFilterDto[] = []
  function traverse(list: OrgUnitFilterDto[]) {
    for (const unit of list) {
      result.push(unit)
      if (unit.children && unit.children.length > 0) {
        traverse(unit.children)
      }
    }
  }
  traverse(units)
  return result
}

function depthPrefix(depth: number): string {
  if (depth === 0) return ''
  return '  '.repeat(depth) + '- '
}

export default function ObjectiveDetailsWidget({ dateRange, onlyApproved = false }: Props) {
  const [viewMode, setViewMode] = useState<'TABLE' | 'CHART'>('TABLE')
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    type: 'OBJECTIVE' | 'KR' | 'KPI';
    data: any;
  }>({ isOpen: false, type: 'OBJECTIVE', data: null })

  const [sortBy, setSortBy] = useState<'progress' | 'performance'>('progress')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [orgUnitId, setOrgUnitId] = useState<string>('')
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 10

  const { data, isLoading } = useQuery({
    queryKey: [
      'subordinate-detailed-objectives',
      dateRange.from, dateRange.to, onlyApproved,
      sortBy, sortDir, orgUnitId, page
    ],
    queryFn: () => statsApi.getSubordinateDetailedObjectives({
      from: dateRange.from,
      to: dateRange.to,
      onlyApproved,
      sortBy,
      sortDir,
      orgUnitId: orgUnitId || undefined,
      page,
      size: PAGE_SIZE,
    })
  })

  const { data: filterUnits } = useQuery({
    queryKey: ['detail-filter-units'],
    queryFn: () => statsApi.getDetailFilterUnits(),
    staleTime: 5 * 60 * 1000,
  })

  const flatUnits = filterUnits ? flattenOrgUnits(filterUnits) : []

  const handleSortToggle = (field: 'progress' | 'performance') => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(0)
  }

  const ALL_UNITS = '__all__'

  const handleOrgUnitChange = (value: string) => {
    setOrgUnitId(value === ALL_UNITS ? '' : value)
    setPage(0)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

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

  const SortIcon = ({ field }: { field: 'progress' | 'performance' }) => {
    if (sortBy !== field) return <ChevronDown className="w-3 h-3 opacity-40" />
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3" />
      : <ChevronUp className="w-3 h-3" />
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

      {viewMode === 'TABLE' && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort buttons */}
          <button
            onClick={() => handleSortToggle('progress')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              sortBy === 'progress'
                ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
            }`}
          >
            Tiến độ
            <SortIcon field="progress" />
          </button>
          <button
            onClick={() => handleSortToggle('performance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              sortBy === 'performance'
                ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
            }`}
          >
            Hiệu suất
            <SortIcon field="performance" />
          </button>

          {/* Org unit filter */}
          <div className="min-w-[200px]">
            <Select value={orgUnitId || ALL_UNITS} onValueChange={handleOrgUnitChange}>
              <SelectTrigger className="h-8 text-xs font-medium bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Tất cả đơn vị" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
                {flatUnits.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {depthPrefix(unit.depth)}{unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="min-h-[500px]">
        {isLoading ? (
          <div className="w-full h-[550px] flex items-center justify-center bg-white dark:bg-slate-900/20 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <div className="text-sm font-medium text-slate-500">Đang tải chi tiết mục tiêu...</div>
            </div>
          </div>
        ) : viewMode === 'TABLE' ? (
          <div className="flex flex-col bg-white dark:bg-slate-900/20 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl overflow-hidden">
            <ObjectiveDetailedTable data={data?.content ?? []} onRowClick={handleRowClick} />
            <Pagination
              currentPage={page}
              totalPages={data?.totalPages ?? 0}
              onPageChange={handlePageChange}
              totalElements={data?.totalElements ?? 0}
              size={PAGE_SIZE}
              itemLabel="mục tiêu"
            />
          </div>
        ) : (
          <ObjectiveDetailedChart data={data?.content ?? []} onBarClick={(d) => handleRowClick('OBJECTIVE', d)} />
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
