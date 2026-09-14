import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Search, Building2, CalendarRange } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import Pagination from '@/components/common/Pagination'
import { useAuthStore } from '@/store/authStore'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import ScopeSelectItems from '@/components/common/ScopeSelectItems'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOptionalDashboardUnit } from '@/features/dashboard/context/DashboardFilterContext'
import { useDrillDown, useMatrixOverview, useUnitClassification } from '../../hooks/useAnalytics'
import { useBehaviorCompletion } from '../../hooks/useAdvancedAnalytics'
import { usePerformanceScale } from '../../hooks/usePerformanceScale'
import { useStatsTier } from '../../hooks/useStatsTier'
import { useChartTableView, type ChartTableView } from '@/components/common/dashboard/useChartTableView'
import { ViewToggleButtons } from '@/components/common/dashboard/ViewToggleButtons'
import Lollipop from '@/components/charts/primitives/Lollipop'
import OrgUnitTreeSidebar from '../OrgUnitTreeSidebar'
import BehaviorCompletionScatter from '../BehaviorCompletionScatter'
import { MatrixMetricCards, MatrixDistHeatmap } from '../MatrixOverviewPanel'
import UnitClassificationSection from '../UnitClassificationSection'
import { KpiCascadeSection, UnitBoxplotSection } from '../advanced/DrillDownAdvanced'
import type { EmployeeDrillSummary } from '@/types/stats'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import type { PinnedFilter } from './pinnedWidgetRegistry'
import { xAxisLabel } from '@/components/charts/axisLabel'

/**
 * Widget của tab "So sánh các đơn vị", dùng ở cả tab lẫn trang chủ.
 *
 * <p>Tab đó là một màn master–detail: cây đơn vị bên trái, chi tiết bên phải. Trên trang chủ
 * vai trò "bên trái" thuộc về widget {@link DrillUnitTreeWidget}, còn mọi widget chi tiết đọc
 * đơn vị đang chọn từ context (`useOptionalDashboardUnit`). Nhờ vậy người dùng có thể bỏ cây khỏi
 * lưới mà các widget chi tiết vẫn chạy (rơi về gốc phạm vi quyền, đúng như lúc mới mở tab).
 *
 * <p>Từ khi tab "So sánh các đơn vị" cũng lên lưới, các widget này chạy ở cả hai nơi: trong tab,
 * đơn vị đến từ prop `filter.orgUnitId` (cây đơn vị của trang) và thắng context.
 */

const EMP_PAGE_SIZE = 5

/** Cắt cây tại đơn vị gốc (subtree) — để không lộ đơn vị ngoài quyền drill của user. */
function subtreeOf(nodes: OrgUnitTreeResponse[], rootId?: string): OrgUnitTreeResponse[] {
  if (!rootId) return nodes
  const find = (list: OrgUnitTreeResponse[]): OrgUnitTreeResponse | null => {
    for (const n of list) {
      if (n.id === rootId) return n
      const r = find(n.children || [])
      if (r) return r
    }
    return null
  }
  const node = find(nodes)
  return node ? [node] : nodes
}

interface DrillTooltipProps {
  active?: boolean
  payload?: { value?: number; payload?: { name?: string } }[]
  perf: ReturnType<typeof usePerformanceScale>
}

function DrillBarTooltip({ active, payload, perf }: DrillTooltipProps) {
  if (!active || !payload?.length) return null
  const name = payload[0]?.payload?.name || ''
  const val = payload[0]?.value ?? 0
  const pct = perf.toPct(val)
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-md border border-white/10 max-w-[220px]">
      <p className="font-semibold mb-1.5 break-words leading-tight">{name}</p>
      <p className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
        Hiệu suất: <span className="font-semibold ml-1">{perf.formatShort(val)}</span>
      </p>
    </div>
  )
}

/**
 * Đơn vị đang xem: tab Thống kê truyền qua `filter.orgUnitId` (cây đơn vị của trang); trang chủ
 * để trống và lấy từ context bộ lọc. Cùng một component chạy được ở cả hai nơi.
 */
function useDrillUnit(filter?: PinnedFilter) {
  const ctx = useOptionalDashboardUnit()
  return filter?.orgUnitId ?? ctx.unitId
}

/** Dữ liệu drill của đơn vị đang chọn, theo bộ lọc thời gian đi kèm. */
function useDrillData(filter?: PinnedFilter) {
  const unitId = useDrillUnit(filter)
  const { from, to, periodId, periodIdTo } = filter ?? {}
  const query = useDrillDown(unitId, from, to, periodId, periodIdTo)
  return { ...query, unitId, from, to, periodId, periodIdTo }
}

const NoChildren = () => (
  <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center gap-3 text-slate-400">
    <Building2 size={32} className="text-slate-300" />
    <p className="text-xs font-semibold">Không có đơn vị con trực thuộc</p>
  </div>
)

/** Cây đơn vị — thay cho thanh bên trái của tab Phân cấp. */
export function DrillUnitTreeWidget({ filter }: { filter?: PinnedFilter }) {
  const { unitId, setUnitId } = useOptionalDashboardUnit()
  const { from, to, periodId, periodIdTo } = filter ?? {}
  const { data: tree } = useOrgUnitTree()
  // Gốc drill = phạm vi quyền của user, do backend quyết định (giống tab Phân cấp).
  const { data: rootData } = useDrillDown(undefined, from, to, periodId, periodIdTo)

  const rootUnitId = rootData?.orgUnitId || undefined
  const nodes = useMemo(() => subtreeOf(tree || [], rootUnitId), [tree, rootUnitId])

  return (
    <div className="flex-1 min-h-0">
      <OrgUnitTreeSidebar nodes={nodes} selectedId={unitId ?? rootUnitId} onSelect={id => setUnitId?.(id)} />
    </div>
  )
}

/** Thẻ tóm tắt đơn vị đang chọn: cấp, tên, số nhân sự, tổng KPI. */
export function DrillUnitSummaryWidget({ filter }: { filter?: PinnedFilter }) {
  const { data } = useDrillData(filter)
  if (!data) return <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Chưa có dữ liệu đơn vị</div>
  // Thẻ trung tính thay cho banner gradient: cùng vỏ với thẻ số liệu ở các tab khác.
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{data.levelName || 'Cấp đơn vị'}</p>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-0.5 truncate">{data.orgUnitName || 'Tất cả'}</h3>
      </div>
      <div className="flex items-center gap-8 shrink-0">
        <div>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white leading-none">{data.memberCount}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">Nhân sự</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white leading-none">{data.totalKpi}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">KPI tổng</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Thành viên trực thuộc: lollipop hiệu suất (bấm một người là mở trang hiệu suất của họ) hoặc bảng
 * phân trang. Tìm kiếm và trang là state cục bộ của ô; tab reset chúng khi đổi đơn vị bằng `key`.
 *
 * <p>`viewControl`/`hideControls`/`meta` theo đúng khuôn `EmployeeRankingTableSection`: lưới Thống kê
 * điều khiển kiểu xem qua bảng cấu hình, trang chủ để tự vẽ nút.
 */
export function DrillEmployeeTableWidget({ filter, viewControl, hideControls, meta }: {
  filter?: PinnedFilter
  viewControl?: { value?: ChartTableView; onChange?: (v: ChartTableView) => void }
  hideControls?: boolean
  meta?: React.ReactNode
}) {
  const { data } = useDrillData(filter)
  const perf = usePerformanceScale()
  const navigate = useNavigate()
  const { view, setView } = useChartTableView('drill-employees', 'chart', viewControl)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(searchInput); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const employees = data?.employees
  const filtered = useMemo((): EmployeeDrillSummary[] => {
    if (!employees) return []
    if (!searchTerm) return employees
    const low = searchTerm.toLowerCase()
    return employees.filter(e =>
      e.fullName.toLowerCase().includes(low) ||
      e.email.toLowerCase().includes(low) ||
      e.roleName.toLowerCase().includes(low) ||
      (e.orgUnitName?.toLowerCase().includes(low) ?? false)
    )
  }, [employees, searchTerm])

  const paginated = filtered.slice(page * EMP_PAGE_SIZE, page * EMP_PAGE_SIZE + EMP_PAGE_SIZE)

  if (!employees?.length) {
    return <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Đơn vị này chưa có nhân sự trực thuộc</div>
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {meta && <div className="pb-3">{meta}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
          <Users size={14} className="text-slate-400" /> {filtered.length} thành viên
          {!hideControls && <ViewToggleButtons view={view} onChange={setView} className="ml-2" />}
        </p>
        <div className="relative w-full sm:w-56">
          <input
            type="search"
            placeholder="Tìm tên, email, vai trò..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            aria-label="Tìm thành viên"
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
          />
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {view === 'chart' ? (
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">Không tìm thấy thành viên nào</div>
          ) : (
            <Lollipop
              data={filtered.map(emp => ({
                id: emp.userId,
                name: emp.fullName,
                subText: [emp.roleName, emp.orgUnitName].filter(Boolean).join(' · '),
                value: emp.performanceRate ?? 0,
              }))}
              unit={` ${perf.unit}`}
              valueLabel={`Hiệu suất (${perf.unit})`}
              domainMax={perf.axisMax}
              onSelect={d => { if (d.id) navigate(`/employees/${d.id}/performance`) }}
            />
          )}
        </div>
      ) : (
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
            <tr className="text-xs font-medium text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="px-3 py-3 text-left">Họ tên &amp; Vai trò</th>
              <th className="px-3 py-3 text-left hidden lg:table-cell">Đơn vị</th>
              <th className="px-3 py-3 text-center">KPI</th>
              <th className="px-3 py-3 text-center">Tiến độ</th>
              <th className="px-3 py-3 text-center">Hiệu suất</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {paginated.map(emp => {
              const progressPct = emp.assignedKpi > 0 ? Math.round(emp.approvedSubmissions / emp.assignedKpi * 100) : 0
              const perfPct = emp.performanceRate != null ? perf.toPct(emp.performanceRate) : null
              return (
                <tr key={emp.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        fullName={emp.fullName}
                        avatarUrl={emp.avatarUrl}
                        className="w-8 h-8 rounded-lg shrink-0"
                        fallbackClassName="bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white leading-none truncate">{emp.fullName}</p>
                        <p className="text-xs font-medium text-slate-400 mt-1 truncate">{emp.roleName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell">
                    {emp.orgUnitId && emp.orgUnitId === data?.orgUnitId ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-[var(--color-primary)] dark:bg-indigo-900/30 dark:text-indigo-300">
                        <Building2 size={11} /> Đơn vị hiện tại
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{emp.orgUnitName || '-'}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{emp.assignedKpi}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', progressPct >= 80 ? 'bg-emerald-500' : progressPct >= 50 ? 'bg-amber-500' : 'bg-red-400')}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold w-8 text-right tabular-nums">{progressPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {perfPct === null ? <span className="text-slate-300 text-xs">-</span> : (
                      <span className={cn('text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap',
                        perfPct >= 80 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                        perfPct >= 50 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' :
                        'bg-red-50 text-red-600 dark:bg-red-900/20'
                      )}>
                        {perf.formatShort(emp.performanceRate)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-xs">Không tìm thấy kết quả phù hợp</div>
        )}
      </div>
      )}

      {view === 'table' && filtered.length > EMP_PAGE_SIZE && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(filtered.length / EMP_PAGE_SIZE)}
          onPageChange={setPage}
          totalElements={filtered.length}
          size={EMP_PAGE_SIZE}
          itemLabel="thành viên"
        />
      )}
    </div>
  )
}

/** So sánh hiệu suất giữa các đơn vị con của đơn vị đang chọn. */
export function DrillUnitCompareWidget({ filter }: { filter?: PinnedFilter }) {
  const { data } = useDrillData(filter)
  const perf = usePerformanceScale()

  const rows = (data?.childUnits || []).map(u => ({
    name: u.orgUnitName.length > 20 ? u.orgUnitName.substring(0, 20) + '…' : u.orgUnitName,
    completion: u.performanceRate,
  })).sort((a, b) => b.completion - a.completion)

  if (rows.length === 0) return <NoChildren />

  return (
    <div className="flex-1 min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 55, left: 10, bottom: 30 }}>
          <CartesianGrid stroke="var(--color-border)" horizontal={false} vertical />
          <XAxis type="number" domain={[0, perf.axisMax]} label={xAxisLabel(`Hiệu suất (${perf.unit})`)} tickFormatter={v => perf.formatShort(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip content={<DrillBarTooltip perf={perf} />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
          <Bar
            name="Hiệu suất" dataKey="completion" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}
            label={{ position: 'right', fill: '#64748b', fontSize: 11, fontWeight: 700, formatter: (v: unknown) => perf.formatShort(Number(v) || 0) }}
          >
            {rows.map((entry, index) => (
              <Cell key={index} fill={perf.toPct(entry.completion) >= 80 ? '#10b981' : perf.toPct(entry.completion) >= 50 ? '#f59e0b' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const BY_PERIOD = '__by_period__'

/**
 * Xếp loại đơn vị theo phân bố xếp loại thành viên, theo đợt hoặc theo kỳ.
 *
 * <p>`cycleId` là phạm vi xếp loại (điểm chốt kỳ, bỏ qua bộ lọc đợt), KHÔNG phải khoảng thời gian.
 * Lưới Thống kê truyền nó từ tuỳ chọn của ô (`hideControls`), trang chủ để widget tự vẽ Select.
 * `part='children'` chỉ vẽ xếp loại đơn vị con, dùng cho ô "Đơn vị con".
 */
export function DrillClassificationWidget({ filter, part, cycleId: cycleProp, hideControls, meta }: {
  filter?: PinnedFilter
  part?: 'unit' | 'children'
  cycleId?: string
  hideControls?: boolean
  meta?: React.ReactNode
}) {
  const unitId = useDrillUnit(filter)
  const { periodId, periodIdTo } = filter ?? {}
  const orgId = useAuthStore(s => s.user)?.memberships?.[0]?.organizationId
  const [localCycle, setLocalCycle] = useState('')
  const cycleId = cycleProp ?? localCycle
  const { data: cyclesData } = useKpiCycles({ organizationId: orgId, size: 100, sortBy: 'startDate', direction: 'desc' })
  const cycles = cyclesData?.content ?? []

  const { data: overview } = useUnitClassification(
    cycleId ? { orgUnitId: unitId, cycleId } : { orgUnitId: unitId, periodId, periodIdTo }
  )

  if (part === 'children' && overview && !(overview.children?.length)) {
    return <div className="flex-1 min-h-0 flex flex-col">{meta}<NoChildren /></div>
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {meta}
      {!hideControls && cycles.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          <CalendarRange size={13} className="text-slate-400" />
          <Select value={cycleId || BY_PERIOD} onValueChange={v => setLocalCycle(v === BY_PERIOD ? '' : v)}>
            <SelectTrigger
              aria-label="Phạm vi xếp loại"
              className="h-8 w-auto gap-1.5 px-2 rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-0"
              title="Xếp loại theo kỳ dùng điểm chốt kỳ, bỏ qua bộ lọc đợt"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value={BY_PERIOD} className="text-xs font-semibold">Theo đợt (bộ lọc đơn vị)</SelectItem>
              <ScopeSelectItems
                items={cycles}
                selectedId={cycleId}
                noun="kỳ"
                itemClassName="text-xs font-bold"
                renderLabel={c => `Kỳ: ${c.name}`}
              />
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <UnitClassificationSection overview={overview} part={part} />
      </div>
    </div>
  )
}

/** Ô "Đơn vị con": nửa `children` của xếp loại, để thư viện/registry có id riêng. */
export function DrillChildrenClassificationWidget(p: { filter?: PinnedFilter; hideControls?: boolean; meta?: React.ReactNode }) {
  return <DrillClassificationWidget {...p} part="children" />
}

/** Luồng phân rã & uỷ quyền KPI (Sankey) của đơn vị đang chọn. */
export function DrillCascadeWidget({ filter, meta }: { filter?: PinnedFilter; meta?: React.ReactNode }) {
  const unitId = useDrillUnit(filter)
  const { periodId, periodIdTo } = filter ?? {}
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {meta && <div className="mb-3">{meta}</div>}
      <KpiCascadeSection bare filter={{ orgUnitId: unitId, periodId, periodIdTo }} />
    </div>
  )
}

/** Phân tán điểm giữa các đơn vị con (boxplot). */
export function DrillBoxplotWidget({ filter, meta }: { filter?: PinnedFilter; meta?: React.ReactNode }) {
  const unitId = useDrillUnit(filter)
  const { periodId, periodIdTo } = filter ?? {}
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {meta && <div className="mb-3">{meta}</div>}
      <UnitBoxplotSection bare filter={{ orgUnitId: unitId, periodId, periodIdTo }} />
    </div>
  )
}

/**
 * Bộ chọn cách xem dữ liệu ma trận: ô đếm hay phân tán từng người. Trên lưới Thống kê lựa chọn này
 * nằm trong bảng cấu hình (`variant`); trang chủ để widget tự vẽ.
 */
type MatrixView = 'cells' | 'scatter'
function MatrixViewSelect({ view, onChange }: { view: MatrixView; onChange: (v: MatrixView) => void }) {
  return (
    <Select value={view} onValueChange={v => onChange(v as MatrixView)}>
      <SelectTrigger
        className="h-8 w-auto gap-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 shrink-0"
        title="Cách xem dữ liệu ma trận"
      >
        <span className="text-slate-400 dark:text-slate-500">Xem:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="cells">Ô ma trận</SelectItem>
        <SelectItem value="scatter">Phân tán từng người</SelectItem>
      </SelectContent>
    </Select>
  )
}

/**
 * Ma trận xếp loại của đơn vị đang chọn: thẻ chỉ số + heatmap, hoặc phân tán từng người.
 *
 * <p>Vai không có quyền thống kê bị backend trả 403 ở dữ liệu phân tán, nên chỉ tải và chỉ cho chọn
 * khi `canView`; `variant='scatter'` mà không có quyền thì rơi về ô đếm.
 */
export function DrillMatrixWidget({ filter, variant, hideControls, meta }: {
  filter?: PinnedFilter
  variant?: MatrixView
  hideControls?: boolean
  meta?: React.ReactNode
}) {
  const unitId = useDrillUnit(filter)
  const { periodId, periodIdTo } = filter ?? {}
  const { canView } = useStatsTier()
  const [localView, setLocalView] = useState<MatrixView>('cells')
  const view: MatrixView = canView ? (variant ?? localView) : 'cells'
  const { data: overview } = useMatrixOverview({ orgUnitId: unitId, periodId, periodIdTo })
  const scatter = useBehaviorCompletion({ orgUnitId: unitId, periodId, periodIdTo }, canView && view === 'scatter')

  return (
    <div className="flex-1 min-h-0 overflow-auto custom-scrollbar space-y-4">
      {meta}
      <MatrixMetricCards overview={overview} />
      <MatrixDistHeatmap
        overview={overview}
        viewToggle={!hideControls && canView ? <MatrixViewSelect view={view} onChange={setLocalView} /> : undefined}
        heatmapSlot={view === 'scatter' ? <BehaviorCompletionScatter data={scatter.data} isLoading={scatter.isLoading} /> : undefined}
      />
    </div>
  )
}
