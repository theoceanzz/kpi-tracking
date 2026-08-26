import { useEffect, useMemo, useState } from 'react'
import { Users, Search, Building2, Grid3x3, CalendarRange } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import Pagination from '@/components/common/Pagination'
import { useAuthStore } from '@/store/authStore'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useDashboardUnit } from '@/features/dashboard/context/DashboardFilterContext'
import { useDrillDown, useMatrixOverview, useUnitClassification } from '../../hooks/useAnalytics'
import { usePerformanceScale } from '../../hooks/usePerformanceScale'
import OrgUnitTreeSidebar from '../OrgUnitTreeSidebar'
import { MatrixMetricCards, MatrixDistHeatmap } from '../MatrixOverviewPanel'
import UnitClassificationSection from '../UnitClassificationSection'
import type { EmployeeDrillSummary } from '@/types/stats'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import type { PinnedFilter } from './pinnedWidgetRegistry'

/**
 * Widget của tab "Phân cấp".
 *
 * <p>Tab đó là một màn master–detail: cây đơn vị bên trái, chi tiết bên phải. Trên trang chủ
 * vai trò "bên trái" thuộc về widget {@link DrillUnitTreeWidget}, còn mọi widget chi tiết đọc
 * đơn vị đang chọn từ `useDashboardUnit()`. Nhờ vậy người dùng có thể bỏ cây khỏi lưới mà các
 * widget chi tiết vẫn chạy (rơi về gốc phạm vi quyền, đúng như lúc mới mở tab).
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
    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-white/10 max-w-[220px]">
      <p className="font-bold mb-1.5 break-words leading-tight">{name}</p>
      <p className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
        Hiệu suất: <span className="font-black ml-1">{perf.formatShort(val)}</span>
      </p>
    </div>
  )
}

/** Dữ liệu drill của đơn vị đang chọn, theo bộ lọc thời gian của trang chủ. */
function useDrillData(filter?: PinnedFilter) {
  const { unitId } = useDashboardUnit()
  const { from, to, periodId, periodIdTo } = filter ?? {}
  const query = useDrillDown(unitId, from, to, periodId, periodIdTo)
  return { ...query, unitId, from, to, periodId, periodIdTo }
}

const NoChildren = () => (
  <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center gap-3 text-slate-400">
    <Building2 size={32} className="text-slate-300" />
    <p className="text-xs font-bold">Không có đơn vị con trực thuộc</p>
  </div>
)

/** Cây đơn vị — thay cho thanh bên trái của tab Phân cấp. */
export function DrillUnitTreeWidget({ filter }: { filter?: PinnedFilter }) {
  const { unitId, setUnitId } = useDashboardUnit()
  const { from, to, periodId, periodIdTo } = filter ?? {}
  const { data: tree } = useOrgUnitTree()
  // Gốc drill = phạm vi quyền của user, do backend quyết định (giống tab Phân cấp).
  const { data: rootData } = useDrillDown(undefined, from, to, periodId, periodIdTo)

  const rootUnitId = rootData?.orgUnitId || undefined
  const nodes = useMemo(() => subtreeOf(tree || [], rootUnitId), [tree, rootUnitId])

  return (
    <div className="flex-1 min-h-0">
      <OrgUnitTreeSidebar nodes={nodes} selectedId={unitId ?? rootUnitId} onSelect={setUnitId} />
    </div>
  )
}

/** Thẻ tóm tắt đơn vị đang chọn: cấp, tên, số nhân sự, tổng KPI. */
export function DrillUnitSummaryWidget({ filter }: { filter?: PinnedFilter }) {
  const { data } = useDrillData(filter)
  if (!data) return <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Chưa có dữ liệu đơn vị</div>
  return (
    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[24px] p-5 text-white shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">{data.levelName || 'Cấp đơn vị'}</p>
          <h3 className="text-lg md:text-2xl font-black mt-0.5 truncate">{data.orgUnitName || 'Tất cả'}</h3>
        </div>
        <div className="flex items-center gap-4 md:gap-8 shrink-0">
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl md:text-2xl font-black tabular-nums">{data.memberCount}</p>
            <p className="text-[10px] text-white/70 font-bold uppercase whitespace-nowrap">Nhân sự</p>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl md:text-2xl font-black tabular-nums">{data.totalKpi}</p>
            <p className="text-[10px] text-white/70 font-bold uppercase whitespace-nowrap">KPI Tổng</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Bảng thành viên trực thuộc — tìm kiếm + phân trang như trong tab. */
export function DrillEmployeeTableWidget({ filter }: { filter?: PinnedFilter }) {
  const { data } = useDrillData(filter)
  const perf = usePerformanceScale()
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
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <p className="text-xs font-black text-slate-500 flex items-center gap-1.5">
          <Users size={14} className="text-indigo-600" /> {filtered.length} thành viên
        </p>
        <div className="relative w-full sm:w-56">
          <input
            type="search"
            placeholder="Tìm tên, email, vai trò..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            aria-label="Tìm thành viên"
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
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
                        className="w-8 h-8 rounded-xl shrink-0"
                        fallbackClassName="bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-600"
                      />
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 dark:text-white leading-none truncate">{emp.fullName}</p>
                        <p className="text-[11px] font-bold text-slate-400 mt-1 truncate">{emp.roleName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell">
                    {emp.orgUnitId && emp.orgUnitId === data?.orgUnitId ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                        <Building2 size={11} /> Đơn vị hiện tại
                      </span>
                    ) : (
                      <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300">{emp.orgUnitName || '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center font-black text-slate-800 dark:text-slate-200 tabular-nums">{emp.assignedKpi}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', progressPct >= 80 ? 'bg-emerald-500' : progressPct >= 50 ? 'bg-amber-500' : 'bg-red-400')}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-black w-8 text-right tabular-nums">{progressPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {perfPct === null ? <span className="text-slate-300 text-xs">—</span> : (
                      <span className={cn('text-xs font-black px-2 py-1 rounded-lg whitespace-nowrap',
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
          <div className="py-12 text-center text-slate-400 text-xs italic">Không tìm thấy kết quả phù hợp</div>
        )}
      </div>

      {filtered.length > EMP_PAGE_SIZE && (
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
        <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 55, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="#f1f5f9" strokeOpacity={0.8} />
          <XAxis type="number" domain={[0, perf.axisMax]} tickFormatter={v => perf.formatShort(v)} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip content={<DrillBarTooltip perf={perf} />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
          <Bar
            name="Hiệu suất" dataKey="completion" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}
            label={{ position: 'right', fill: '#64748b', fontSize: 10, fontWeight: 700, formatter: (v: unknown) => perf.formatShort(Number(v) || 0) }}
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

/** Heatmap tiến độ của các đơn vị con. */
export function DrillHeatmapWidget({ filter }: { filter?: PinnedFilter }) {
  const { data } = useDrillData(filter)
  const xs = Array.from(new Set(data?.heatmapData?.map(p => p.x) || []))
  const ys = Array.from(new Set(data?.heatmapData?.map(p => p.y) || []))

  if ((data?.childUnits?.length ?? 0) === 0) return <NoChildren />
  if (ys.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic">Chưa có dữ liệu heatmap</div>
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 bg-white dark:bg-slate-900 z-20" />
            {xs.map(x => (
              <th key={x} className="sticky top-0 bg-white dark:bg-slate-900 z-10 text-[9px] font-black uppercase text-slate-400 p-1 min-w-[80px] text-center">{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ys.map(y => (
            <tr key={y}>
              <td className="sticky left-0 bg-white dark:bg-slate-900 z-10 text-[9px] font-bold text-slate-500 pr-2 max-w-[100px] truncate">{y}</td>
              {xs.map(x => {
                const val = data!.heatmapData.find(p => p.x === x && p.y === y)?.value || 0
                return (
                  <td key={`${x}-${y}`} className="p-0">
                    <div
                      className="h-8 rounded-sm flex items-center justify-center text-[8px] font-bold text-white"
                      title={`${y} · ${x}: ${Math.round(val)}%`}
                      style={{
                        backgroundColor: val >= 80 ? '#10b981' : val >= 50 ? '#f59e0b' : val > 0 ? '#ef4444' : '#f1f5f9',
                        opacity: val > 0 ? 0.3 + (val / 100) * 0.7 : 1,
                      }}
                    >
                      {val > 0 && `${Math.round(val)}%`}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Xếp loại đơn vị theo phân bố xếp loại thành viên — theo đợt hoặc theo kỳ. */
export function DrillClassificationWidget({ filter }: { filter?: PinnedFilter }) {
  const { unitId } = useDashboardUnit()
  const { periodId, periodIdTo } = filter ?? {}
  const orgId = useAuthStore(s => s.user)?.memberships?.[0]?.organizationId
  const [cycleId, setCycleId] = useState('')
  const { data: cyclesData } = useKpiCycles({ organizationId: orgId, size: 100, sortBy: 'startDate', direction: 'desc' })
  const cycles = cyclesData?.content ?? []

  const { data: overview } = useUnitClassification(
    cycleId ? { orgUnitId: unitId, cycleId } : { orgUnitId: unitId, periodId, periodIdTo }
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {cycles.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          <CalendarRange size={13} className="text-slate-400" />
          <select
            value={cycleId}
            onChange={e => setCycleId(e.target.value)}
            aria-label="Phạm vi xếp loại"
            className="h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500/30"
            title="Xếp loại theo kỳ dùng điểm chốt kỳ, bỏ qua bộ lọc đợt"
          >
            <option value="">Theo đợt (bộ lọc đơn vị)</option>
            {cycles.map(c => <option key={c.id} value={c.id}>Kỳ: {c.name}</option>)}
          </select>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <UnitClassificationSection overview={overview} />
      </div>
    </div>
  )
}

/** Ma trận xếp loại của đơn vị đang chọn — thẻ chỉ số + phân bố/heatmap. */
export function DrillMatrixWidget({ filter }: { filter?: PinnedFilter }) {
  const { unitId } = useDashboardUnit()
  const { periodId, periodIdTo } = filter ?? {}
  const { data: overview } = useMatrixOverview({ orgUnitId: unitId, periodId, periodIdTo })

  return (
    <div className="flex-1 min-h-0 overflow-auto custom-scrollbar space-y-4">
      <MatrixMetricCards overview={overview} />
      <div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2">
          <Grid3x3 size={12} className="text-indigo-500" /> Phân bố xếp loại &amp; Heatmap
        </h4>
        <MatrixDistHeatmap overview={overview} />
      </div>
    </div>
  )
}
