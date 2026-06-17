import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import { Loader2, LayoutList } from 'lucide-react'
import ObjectiveDetailedTable from './ObjectiveDetailedTable'
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
  periodId?: string
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
  return '  '.repeat(depth) + '- '
}

export default function ObjectiveDetailsWidget({ dateRange, onlyApproved = false, periodId }: Props) {
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
      dateRange.from, dateRange.to, onlyApproved, periodId,
      sortBy, sortDir, orgUnitId, page
    ],
    queryFn: () => statsApi.getSubordinateDetailedObjectives({
      from: dateRange.from,
      to: dateRange.to,
      onlyApproved,
      periodId,
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
        periodId={periodId}
      />
    );
  }

  return (
    <div className="w-full mt-10 flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
            <LayoutList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Chi tiết Mục tiêu</h2>
        </div>
        <p className="text-sm text-slate-500 ml-9">Theo dõi bảng dữ liệu phân cấp mục tiêu</p>
      </div>

      {/* Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Card header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Bảng dữ liệu phân cấp</h3>
          <span className="text-xs font-bold text-slate-400">{data?.totalElements ?? 0} mục tiêu</span>
        </div>

        {/* Filter toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <div className="min-w-[220px]">
            <Select value={orgUnitId || ALL_UNITS} onValueChange={handleOrgUnitChange}>
              <SelectTrigger className="h-9 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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

        {/* Table */}
        {isLoading ? (
          <div className="w-full h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <div className="text-sm font-medium text-slate-500">Đang tải chi tiết mục tiêu...</div>
            </div>
          </div>
        ) : (
          <ObjectiveDetailedTable
            data={data?.content ?? []}
            onRowClick={handleRowClick}
            sortBy={sortBy}
            sortDir={sortDir}
            onToggleSort={handleSortToggle}
          />
        )}

        {/* Pagination */}
        {(data?.totalElements ?? 0) > 0 && (
          <Pagination
            currentPage={page}
            totalPages={data?.totalPages ?? 0}
            onPageChange={handlePageChange}
            totalElements={data?.totalElements ?? 0}
            size={PAGE_SIZE}
            itemLabel="mục tiêu"
          />
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
