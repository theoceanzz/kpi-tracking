import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import { Loader2, LayoutList } from 'lucide-react'
import ObjectiveDetailedTable from './ObjectiveDetailedTable'
import ObjectiveDrawer from './ObjectiveDrawer'
import ScopedDashboardWidget from './ScopedDashboardWidget'
import { SparseTableFiller } from './SparseTableFiller'
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
  periodIdTo?: string
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

export default function ObjectiveDetailsWidget({ dateRange, onlyApproved = false, periodId, periodIdTo }: Props) {
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    type: 'OBJECTIVE' | 'KR' | 'KPI';
    data: any;
  }>({ isOpen: false, type: 'OBJECTIVE', data: null })

  const [sortBy, setSortBy] = useState<'progress' | 'period'>('period')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [orgUnitId, setOrgUnitId] = useState<string>('')
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 10

  const { data, isLoading } = useQuery({
    queryKey: [
      'subordinate-detailed-objectives',
      dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo,
      sortBy, sortDir, orgUnitId, page
    ],
    queryFn: () => statsApi.getSubordinateDetailedObjectives({
      from: dateRange.from,
      to: dateRange.to,
      onlyApproved,
      periodId,
      periodIdTo,
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

  const handleSortToggle = (field: 'progress' | 'period') => {
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
        periodIdTo={periodIdTo}
      />
    );
  }

  const rowCount = data?.content?.length ?? 0
  const totalElements = data?.totalElements ?? 0
  const fillerMessage = !isLoading && rowCount > 0 && rowCount < PAGE_SIZE
    ? `Đã hiển thị tất cả ${totalElements} mục tiêu`
    : null

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
            <LayoutList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Chi tiết Mục tiêu</h2>
        </div>
        <p className="text-sm text-slate-500 ml-9">Theo dõi bảng dữ liệu phân cấp mục tiêu</p>
      </div>

      {/* Card — giãn kín ô widget */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Card header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Bảng dữ liệu phân cấp</h3>
          <span className="text-xs font-bold text-slate-400">{totalElements} mục tiêu</span>
        </div>

        {/* Filter toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 shrink-0">
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

        {/* Table — vùng cuộn lấp đầy phần còn lại */}
        {isLoading ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <div className="text-sm font-medium text-slate-500">Đang tải chi tiết mục tiêu...</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar flex flex-col">
            <ObjectiveDetailedTable
              data={data?.content ?? []}
              onRowClick={handleRowClick}
              sortBy={sortBy}
              sortDir={sortDir}
              onToggleSort={handleSortToggle}
            />
            <SparseTableFiller message={fillerMessage} />
          </div>
        )}

        {/* Pagination */}
        {totalElements > 0 && (
          <div className="shrink-0">
            <Pagination
              currentPage={page}
              totalPages={data?.totalPages ?? 0}
              onPageChange={handlePageChange}
              totalElements={totalElements}
              size={PAGE_SIZE}
              itemLabel="mục tiêu"
            />
          </div>
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
