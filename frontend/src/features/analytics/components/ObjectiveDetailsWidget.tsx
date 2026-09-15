import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import { Loader2, LayoutList } from 'lucide-react'
import ObjectiveDetailedTable from './ObjectiveDetailedTable'
import WeightTreemap from '@/components/charts/primitives/WeightTreemap'
import { useChartTableView } from '@/components/common/dashboard/useChartTableView'
import { ViewToggleButtons } from '@/components/common/dashboard/ViewToggleButtons'
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
  /** Chế độ biểu đồ/bảng do lưới điều khiển; bỏ trống thì component tự nhớ bằng localStorage. */
  viewControl?: { value?: 'chart' | 'table'; onChange?: (v: 'chart' | 'table') => void }
  /** Đơn vị do bảng cấu hình của ô chọn. Bỏ trống thì component tự giữ (thẻ trang chủ). */
  orgUnitId?: string
  /** Ẩn nút biểu đồ/bảng và ô chọn đơn vị tại chỗ khi việc chọn đã nằm trong bảng cấu hình. */
  hideControls?: boolean
  /** Dòng tóm tắt cấu hình do lưới cấp. */
  meta?: React.ReactNode
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

export default function ObjectiveDetailsWidget({ dateRange, onlyApproved = false, periodId, periodIdTo, viewControl, orgUnitId: orgUnitProp, hideControls, meta }: Props) {
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    type: 'OBJECTIVE' | 'KR' | 'KPI';
    data: any;
  }>({ isOpen: false, type: 'OBJECTIVE', data: null })

  const [sortBy, setSortBy] = useState<'progress' | 'period'>('period')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [localOrgUnitId, setOrgUnitId] = useState<string>('')
  const orgUnitId = orgUnitProp ?? localOrgUnitId
  const [page, setPage] = useState(0)
  const { view, setView } = useChartTableView('sub-detail', 'chart', viewControl)

  const PAGE_SIZE = 10
  // Chế độ biểu đồ lấy trọn danh sách; chạm trần thì báo rõ chứ không cắt cụt im lặng.
  const CHART_FETCH_SIZE = 200

  // Treemap là biểu đồ phần-trên-tổng-thể: vẽ 10 mục tiêu của "trang 1/5" là trình bày một mảnh
  // vụn tuỳ tiện như thể nó là toàn thể. Chế độ bảng thì phân trang vẫn đúng và giữ nguyên.
  const chartMode = view === 'chart'
  const effectivePage = chartMode ? 0 : page
  const effectiveSize = chartMode ? CHART_FETCH_SIZE : PAGE_SIZE

  const { data, isLoading } = useQuery({
    queryKey: [
      'subordinate-detailed-objectives',
      dateRange.from, dateRange.to, onlyApproved, periodId, periodIdTo,
      sortBy, sortDir, orgUnitId, effectivePage, effectiveSize
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
      page: effectivePage,
      size: effectiveSize,
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

  // Treemap dựng ở tầng Key Result: tầng Mục tiêu thành nhóm, tầng KPI gộp lại thành diện tích.
  // Vẽ cả ba tầng lồng nhau sẽ cho ra hàng trăm ô vụn không đọc được trong một ô widget.
  const treemapLeaves = useMemo(
    () => (data?.content ?? []).flatMap(obj =>
      (obj.keyResults ?? [])
        .filter(kr => (kr.kpis?.length ?? 0) > 0)
        .map(kr => ({
          id: kr.id,
          name: kr.name,
          group: obj.name,
          size: kr.kpis?.length ?? 0,
          achievement: kr.progress,
          subText: `${obj.name} · ${kr.kpis?.length ?? 0} KPI`,
        })),
    ),
    [data],
  )

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
            <LayoutList className="w-5 h-5 text-[var(--color-primary)] dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Chi tiết Mục tiêu</h2>
        </div>
        <p className="text-sm text-slate-500 ml-9">Theo dõi bảng dữ liệu phân cấp mục tiêu</p>
        {meta && <div className="ml-9 mt-2">{meta}</div>}
      </div>

      {/* Card — giãn kín ô widget */}
      <div className="flex-1 min-h-0 flex flex-col bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        {/* Card header */}
        <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
            {view === 'chart' ? 'Bản đồ trọng số mục tiêu' : 'Bảng dữ liệu phân cấp'}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">{totalElements} mục tiêu</span>
            {!hideControls && <ViewToggleButtons view={view} onChange={setView} />}
          </div>
        </div>

        {/* Filter toolbar — ẩn khi việc chọn đơn vị đã nằm trong bảng cấu hình của ô */}
        {!hideControls && (
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex flex-wrap items-center gap-3 shrink-0">
          <div className="min-w-[220px]">
            <Select value={orgUnitId || ALL_UNITS} onValueChange={handleOrgUnitChange}>
              <SelectTrigger className="h-9 text-xs font-semibold bg-[var(--color-muted)] border-slate-200 dark:border-slate-700">
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

        {/* Table — vùng cuộn lấp đầy phần còn lại */}
        {isLoading ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
              <div className="text-sm font-medium text-slate-500">Đang tải chi tiết mục tiêu...</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar flex flex-col">
            {view === 'chart' ? (
              treemapLeaves.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-400 font-medium py-16">
                  Chưa có Key Result nào có tiến độ để vẽ
                </div>
              ) : (
                <div className="p-4">
                  <WeightTreemap
                    data={treemapLeaves}
                    onSelect={d => { if (d.id) handleRowClick('KR', { id: d.id, name: d.name }) }}
                  />
                  <p className="text-xs text-slate-400 font-medium text-center mt-2">
                    Mỗi ô là một Key Result, gom theo Mục tiêu · Diện tích = số KPI · Màu = tiến độ · Bấm để mở chi tiết
                  </p>
                  {totalElements > CHART_FETCH_SIZE && (
                    <p className="text-xs text-amber-600 font-semibold text-center mt-1">
                      Có {totalElements} mục tiêu, biểu đồ chỉ vẽ {CHART_FETCH_SIZE} mục đầu. Xem đủ ở chế độ bảng.
                    </p>
                  )}
                </div>
              )
            ) : (
              <>
                <ObjectiveDetailedTable
                  data={data?.content ?? []}
                  onRowClick={handleRowClick}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onToggleSort={handleSortToggle}
                />
                <SparseTableFiller message={fillerMessage} />
              </>
            )}
          </div>
        )}

        {/* Phân trang chỉ có ở chế độ bảng — xem lý do ở khai báo chartMode phía trên. */}
        {!chartMode && totalElements > 0 && (
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
