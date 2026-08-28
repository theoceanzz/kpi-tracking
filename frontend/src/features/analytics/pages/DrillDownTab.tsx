import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useDrillDown, useMatrixOverview, useUnitClassification } from '../hooks/useAnalytics'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import {
  Users, X, BarChart3, LayoutGrid, Search, Maximize2, Building2, Target,
  ChevronDown, ChevronRight, Network, Grid3x3, Award, CalendarRange,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import ScopeSelectItems from '@/components/common/ScopeSelectItems'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AnalyticsTabSkeleton from '@/components/common/AnalyticsTabSkeleton'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CopyButton } from '@/components/common/CopyButton'
import Pagination from '@/components/common/Pagination'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import OrgUnitTreeSidebar from '../components/OrgUnitTreeSidebar'
import { MatrixMetricCards, MatrixDistHeatmap } from '../components/MatrixOverviewPanel'
import UnitClassificationSection from '../components/UnitClassificationSection'
import type { EmployeeDrillSummary } from '@/types/stats'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'

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

function DrillBarTooltip({ active, payload, perf }: any) {
  if (!active || !payload?.length) return null
  const name = payload[0]?.payload?.name || ''
  const val = payload[0]?.value ?? 0
  const pct = perf ? perf.toPct(val) : val
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-white/10 max-w-[220px]">
      <p className="font-bold mb-1.5 break-words leading-tight">{name}</p>
      <p className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
        Hiệu suất: <span className="font-black ml-1">{perf ? perf.formatShort(val) : `${Math.round(val)}%`}</span>
      </p>
    </div>
  )
}

/** Khối "Ma trận xếp loại" cho đơn vị đang chọn (chỉ render khi org đủ hai trục ma trận —
 *  KPI định tính hoặc chấm hạnh kiểm): thẻ chỉ số LUÔN hiển thị; phân bố + heatmap nằm
 *  trong mục thu gọn. */
function DrillMatrixSection({ orgUnitId, periodId, periodIdTo }: { orgUnitId?: string; periodId?: string; periodIdTo?: string }) {
  const [open, setOpen] = useState(false)
  const { data: overview } = useMatrixOverview({ orgUnitId, periodId, periodIdTo })
  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
        <Grid3x3 size={12} className="text-indigo-500" /> Ma trận xếp loại (theo đơn vị)
      </h3>
      <MatrixMetricCards overview={overview} />
      <section className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        >
          <h3 className="text-sm font-black flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Grid3x3 size={16} className="text-indigo-600" /> Phân bố xếp loại &amp; Heatmap ma trận
          </h3>
          {open ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </button>
        {open && <div className="p-5 pt-0"><MatrixDistHeatmap overview={overview} /></div>}
      </section>
    </div>
  )
}

/**
 * Khối "Xếp loại đơn vị" cho đơn vị đang chọn: badge + phân bố + biểu đồ đường + đơn vị con.
 *
 * Hai phạm vi: theo ĐỢT (bám bộ lọc thời gian của trang) hoặc theo KỲ (lấy số chốt kỳ của
 * thành viên — đúng con số mà màn Đánh giá kỳ đang dùng để chốt).
 */
// Radix cấm SelectItem mang value rỗng, nên lựa chọn "theo đợt" (= không lọc theo kỳ)
// đi qua một giá trị canh riêng rồi quy về '' khi lưu vào state.
const BY_PERIOD = '__by_period__'

function DrillClassificationSection({ orgUnitId, periodId, periodIdTo }: { orgUnitId?: string; periodId?: string; periodIdTo?: string }) {
  const orgId = useAuthStore(s => s.user)?.memberships?.[0]?.organizationId
  const [cycleId, setCycleId] = useState<string>('')
  const { data: cyclesData } = useKpiCycles({ organizationId: orgId, size: 100, sortBy: 'startDate', direction: 'desc' })
  const cycles = cyclesData?.content ?? []

  const { data: overview } = useUnitClassification(
    cycleId ? { orgUnitId, cycleId } : { orgUnitId, periodId, periodIdTo }
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 ml-1">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Award size={12} className="text-emerald-500" /> Xếp loại đơn vị (theo phân bố)
        </h3>
        {cycles.length > 0 && (
          <div className="flex items-center gap-1.5">
            <CalendarRange size={13} className="text-slate-400" />
            <Select value={cycleId || BY_PERIOD} onValueChange={v => setCycleId(v === BY_PERIOD ? '' : v)}>
              <SelectTrigger
                className="h-8 w-auto gap-1.5 px-2 rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-0"
                title="Xếp loại theo kỳ dùng điểm chốt kỳ, bỏ qua bộ lọc đợt phía trên"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                <SelectItem value={BY_PERIOD} className="text-[11px] font-bold">Theo đợt (bộ lọc trên)</SelectItem>
                <ScopeSelectItems
                  items={cycles}
                  selectedId={cycleId}
                  noun="kỳ"
                  itemClassName="text-[11px] font-bold"
                  renderLabel={c => `Kỳ: ${c.name}`}
                />
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <UnitClassificationSection overview={overview} />
    </div>
  )
}

export default function DrillDownTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedUnitId = searchParams.get('unitId') || undefined

  // h-10 như các mục còn lại của trang Phân tích — h-9 làm hàng lọc ở đây thấp hơn
  // hẳn một bậc so với hai mục kia.
  const { periodId, periodIdTo, from, to, controls } = useAnalyticsDateFilter({ selectClassName: 'h-10' })
  const perf = usePerformanceScale()

  // Cây điều hướng + gốc drill (scope quyền) + chi tiết đơn vị đang chọn.
  const { data: tree } = useOrgUnitTree()
  const { data: rootData } = useDrillDown(undefined, from, to, periodId, periodIdTo)
  const { data, isLoading } = useDrillDown(selectedUnitId, from, to, periodId, periodIdTo)

  // ── UI state ────────────────────────────────────────────────────────────
  const [hoveredPoint, setHoveredPoint] = useState<{ x: string; y: string; val: number; rect: DOMRect } | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [empPage, setEmpPage] = useState(0)
  const [expandedWidget, setExpandedWidget] = useState<'comparison' | 'heatmap' | null>(null)
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false)
  const [chartsOpen, setChartsOpen] = useState(false)

  const comparisonRef = useRef<HTMLDivElement>(null)
  const heatmapRef = useRef<HTMLDivElement>(null)
  const employeeTableRef = useRef<HTMLDivElement>(null)
  const portalComparisonRef = useRef<HTMLDivElement>(null)
  const portalHeatmapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => { setSearchTerm(searchInput); setEmpPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Đổi đơn vị đang chọn (đồng bộ URL để back/forward + chia sẻ link).
  // Ghi ĐÈ LÊN query hiện có chứ không thay cả cụm: `?section=` của khung trang cũng
  // nằm ở đây, mất nó là khung tưởng chưa chọn mục nào và nhảy về lưới thẻ.
  const select = (id: string) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('unitId', id)
      return p
    })
    setEmpPage(0)
    setSearchInput('')
  }

  const rootUnitId = rootData?.orgUnitId || undefined
  const treeNodes = useMemo(() => subtreeOf(tree || [], rootUnitId), [tree, rootUnitId])
  const treeSelectedId = selectedUnitId ?? rootUnitId

  const filteredEmployees = useMemo((): EmployeeDrillSummary[] => {
    if (!data?.employees) return []
    if (!searchTerm) return data.employees
    const low = searchTerm.toLowerCase()
    return data.employees.filter(e =>
      e.fullName.toLowerCase().includes(low) ||
      e.email.toLowerCase().includes(low) ||
      e.roleName.toLowerCase().includes(low) ||
      (e.orgUnitName?.toLowerCase().includes(low) ?? false)
    )
  }, [data?.employees, searchTerm])

  const totalEmpPages = Math.ceil(filteredEmployees.length / EMP_PAGE_SIZE)
  const paginatedEmployees = useMemo(() => {
    const start = empPage * EMP_PAGE_SIZE
    return filteredEmployees.slice(start, start + EMP_PAGE_SIZE)
  }, [filteredEmployees, empPage])

  const comparisonData = (data?.childUnits || []).map(u => ({
    name: u.orgUnitName.length > 20 ? u.orgUnitName.substring(0, 20) + '…' : u.orgUnitName,
    completion: u.performanceRate,
  })).sort((a, b) => b.completion - a.completion)

  const isLeafUnit = (data?.childUnits?.length ?? 0) === 0
  const heatmapX = Array.from(new Set(data?.heatmapData?.map(p => p.x) || []))
  const heatmapY = Array.from(new Set(data?.heatmapData?.map(p => p.y) || []))

  if (isLoading && !data) return <AnalyticsTabSkeleton variant="drilldown" className="p-6" />

  // ── Biểu đồ (dùng lại cho khối thu gọn + portal phóng to) ────────────────
  const barChartSection = (
    <section ref={comparisonRef} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm relative">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black flex items-center gap-2">
          <BarChart3 size={16} className="text-indigo-600" /> Hiệu suất của đơn vị con ({perf.unit})
        </h3>
        <div className="flex items-center gap-1">
          <CopyButton targetRef={comparisonRef} />
          <button onClick={() => setExpandedWidget('comparison')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      {isLeafUnit ? (
        <div className="h-[280px] flex flex-col items-center justify-center gap-3 text-slate-400">
          <Building2 size={32} className="text-slate-300" />
          <p className="text-xs font-bold">Không có đơn vị con trực thuộc</p>
        </div>
      ) : (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 55, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="#f1f5f9" strokeOpacity={0.8} />
              <XAxis type="number" domain={[0, perf.axisMax]} tickFormatter={v => perf.formatShort(v)} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<DrillBarTooltip perf={perf} />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
              <Bar name="Hiệu suất" dataKey="completion" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}
                label={{ position: 'right', fill: '#64748b', fontSize: 10, fontWeight: 700, formatter: (v: any) => perf.formatShort(v) }}>
                {comparisonData.map((entry, index) => (
                  <Cell key={index} fill={perf.toPct(entry.completion) >= 80 ? '#10b981' : perf.toPct(entry.completion) >= 50 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )

  const heatmapSection = (
    <section ref={heatmapRef} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm relative">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black flex items-center gap-2">
          <LayoutGrid size={16} className="text-indigo-600" /> Heatmap tiến độ của đơn vị con
        </h3>
        <div className="flex items-center gap-1">
          <CopyButton targetRef={heatmapRef} />
          <button onClick={() => setExpandedWidget('heatmap')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      {isLeafUnit ? (
        <div className="h-[280px] flex flex-col items-center justify-center gap-3 text-slate-400">
          <Building2 size={32} className="text-slate-300" />
          <p className="text-xs font-bold">Không có đơn vị con trực thuộc</p>
        </div>
      ) : heatmapY.length > 0 ? (
        <div className="overflow-auto max-h-[280px]">
          <table className="w-full border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 bg-white dark:bg-slate-900 z-20"></th>
                {heatmapX.map(x => (
                  <th key={x} className="sticky top-0 bg-white dark:bg-slate-900 z-10 text-[9px] font-black uppercase text-slate-400 p-1 min-w-[80px] text-center">{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapY.map(y => (
                <tr key={y}>
                  <td className="sticky left-0 bg-white dark:bg-slate-900 z-10 text-[9px] font-bold text-slate-500 pr-2 max-w-[100px] truncate">{y}</td>
                  {heatmapX.map(x => {
                    const point = data!.heatmapData.find(p => p.x === x && p.y === y)
                    const val = point?.value || 0
                    return (
                      <td key={`${x}-${y}`} className="p-0">
                        <div
                          className="h-8 rounded-sm flex items-center justify-center text-[8px] font-bold text-white transition-all hover:scale-110 cursor-help"
                          style={{
                            backgroundColor: val >= 80 ? '#10b981' : val >= 50 ? '#f59e0b' : val > 0 ? '#ef4444' : '#f1f5f9',
                            opacity: val > 0 ? 0.3 + (val / 100) * 0.7 : 1,
                          }}
                          onMouseEnter={e => setHoveredPoint({ x, y, val, rect: e.currentTarget.getBoundingClientRect() })}
                          onMouseLeave={() => setHoveredPoint(null)}
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
      ) : (
        <div className="h-[280px] flex items-center justify-center text-slate-400 text-xs italic">Chưa có dữ liệu heatmap</div>
      )}
    </section>
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Bộ lọc thời gian — sticky. Cùng khuôn với bộ lọc của các mục còn lại trong
          trang Phân tích: `flex-wrap` để hàng điều khiển tự xuống dòng khi hẹp, thay
          vì ép một hàng rồi bóp tiêu đề thành hai dòng. */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center gap-4 justify-between p-4 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0 bg-indigo-50 dark:bg-indigo-900/30">
            <Target size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-white leading-tight text-base">Lọc theo thời gian</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Lọc dữ liệu đồng bộ cho tất cả biểu đồ</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-5 w-full lg:w-auto">
          {controls}
        </div>
      </div>

      {/* Master–detail: cây trái · chi tiết phải */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        {/* Cây đơn vị (desktop) */}
        <aside className="hidden lg:block lg:sticky lg:top-4 h-[calc(100vh-2rem)]">
          <OrgUnitTreeSidebar nodes={treeNodes} selectedId={treeSelectedId} onSelect={select} />
        </aside>

        {/* Panel chi tiết */}
        <div className="space-y-6 min-w-0">
          {/* Nút mở cây trên mobile */}
          <button
            onClick={() => setMobileTreeOpen(true)}
            className="lg:hidden w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold text-indigo-600 shadow-sm"
          >
            <Network size={16} /> Chọn đơn vị
          </button>

          {/* Banner đơn vị đang chọn */}
          {data && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[24px] p-5 text-white shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">{data.levelName || 'Cấp đơn vị'}</p>
                  <h2 className="text-lg md:text-2xl font-black mt-0.5 truncate">{data.orgUnitName || 'Tất cả'}</h2>
                </div>
                <div className="flex items-center gap-4 md:gap-8 shrink-0">
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-xl md:text-2xl font-black">{data.memberCount}</p>
                    <p className="text-[10px] text-white/70 font-bold uppercase whitespace-nowrap">Nhân sự</p>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-xl md:text-2xl font-black">{data.totalKpi}</p>
                    <p className="text-[10px] text-white/70 font-bold uppercase whitespace-nowrap">KPI Tổng</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!data ? (
            <div className="text-center py-20 text-slate-400">Chọn một đơn vị ở cây bên trái để xem chi tiết</div>
          ) : (
            <>
              {/* Bảng thành viên (ưu tiên) */}
              {data.employees.length > 0 ? (
                <section ref={employeeTableRef} className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm flex items-center gap-2">
                        <Users size={16} className="text-indigo-600" /> Thành viên trực thuộc ({filteredEmployees.length})
                      </h3>
                      <CopyButton targetRef={employeeTableRef} />
                    </div>
                    <div className="relative w-full md:w-64">
                      <input
                        type="text"
                        placeholder="Tìm tên, email, vai trò..."
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                  <div className="hidden md:block overflow-x-auto scrollbar-hide custom-scrollbar">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                          <th className="px-6 py-4 text-left">Họ tên &amp; Vai trò</th>
                          <th className="px-3 py-4 text-left">Đơn vị trực thuộc</th>
                          <th className="px-3 py-4 text-center">Số KPI được giao</th>
                          <th className="px-3 py-4 text-center">Tiến độ</th>
                          <th className="px-3 py-4 text-center">Hiệu suất</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {paginatedEmployees.map(emp => {
                          const progressPct = emp.assignedKpi > 0 ? Math.round(emp.approvedSubmissions / emp.assignedKpi * 100) : 0
                          const perfPct = emp.performanceRate != null ? perf.toPct(emp.performanceRate) : null
                          return (
                            <tr key={emp.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <UserAvatar
                                    fullName={emp.fullName}
                                    avatarUrl={emp.avatarUrl}
                                    className="w-9 h-9 rounded-xl"
                                    fallbackClassName="bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-600"
                                  />
                                  <div>
                                    <p className="font-black text-slate-900 dark:text-white leading-none">{emp.fullName}</p>
                                    <p className="text-[11px] font-bold text-slate-400 mt-1">{emp.roleName}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                {emp.orgUnitId && emp.orgUnitId === data.orgUnitId ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                    <Building2 size={11} /> Đơn vị hiện tại
                                  </span>
                                ) : (
                                  <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300">{emp.orgUnitName || '—'}</span>
                                )}
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className="font-black text-slate-800 dark:text-slate-200">{emp.assignedKpi}</span>
                                <span className="text-[10px] text-slate-400 ml-1">KPI</span>
                              </td>
                              <td className="px-3 py-4">
                                <div className="flex items-center gap-2 min-w-[80px]">
                                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className={cn('h-full rounded-full transition-all', progressPct >= 80 ? 'bg-emerald-500' : progressPct >= 50 ? 'bg-amber-500' : 'bg-red-400')}
                                      style={{ width: `${progressPct}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-black w-8 text-right">{progressPct}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-4 text-center">
                                {perfPct === null ? (
                                  <span className="text-slate-300 text-xs">—</span>
                                ) : (
                                  <span className={cn('text-xs font-black px-2 py-1 rounded-lg',
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
                    {filteredEmployees.length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-xs italic">Không tìm thấy kết quả phù hợp</div>
                    )}
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
                    {paginatedEmployees.map(emp => {
                      const progressPct = emp.assignedKpi > 0 ? Math.round(emp.approvedSubmissions / emp.assignedKpi * 100) : 0
                      const perfPct = emp.performanceRate != null ? perf.toPct(emp.performanceRate) : null
                      return (
                        <div key={emp.userId} className="p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              fullName={emp.fullName}
                              avatarUrl={emp.avatarUrl}
                              className="w-9 h-9 rounded-xl"
                              fallbackClassName="bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-600"
                            />
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 dark:text-white leading-none truncate">{emp.fullName}</p>
                              <p className="text-[11px] font-bold text-slate-400 mt-1">{emp.roleName}</p>
                            </div>
                            <div className="ml-auto shrink-0">
                              {emp.orgUnitId && emp.orgUnitId === data.orgUnitId ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  <Building2 size={10} /> Đơn vị hiện tại
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{emp.orgUnitName || '—'}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full transition-all', progressPct >= 80 ? 'bg-emerald-500' : progressPct >= 50 ? 'bg-amber-500' : 'bg-red-400')}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-black w-8 text-right shrink-0">{progressPct}%</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <div>
                              <span className="font-black text-slate-800 dark:text-slate-200">{emp.assignedKpi}</span>
                              <span className="text-[10px] text-slate-400 ml-1">KPI</span>
                            </div>
                            {perfPct !== null && (
                              <span className={cn('text-xs font-black px-2 py-1 rounded-lg',
                                perfPct >= 80 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                                perfPct >= 50 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' :
                                'bg-red-50 text-red-600 dark:bg-red-900/20'
                              )}>
                                Hiệu suất {perf.formatShort(emp.performanceRate)}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {filteredEmployees.length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-xs italic">Không tìm thấy kết quả phù hợp</div>
                    )}
                  </div>
                  {filteredEmployees.length > EMP_PAGE_SIZE && (
                    <Pagination
                      currentPage={empPage}
                      totalPages={totalEmpPages}
                      onPageChange={setEmpPage}
                      totalElements={filteredEmployees.length}
                      size={EMP_PAGE_SIZE}
                      itemLabel="thành viên"
                    />
                  )}
                </section>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm py-12 text-center text-slate-400 text-sm">
                  Đơn vị này chưa có nhân sự trực thuộc
                </div>
              )}

              {/* Biểu đồ phân tích — thu gọn (thứ cấp) */}
              <section className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <button
                  onClick={() => setChartsOpen(o => !o)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <h3 className="text-sm font-black flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <BarChart3 size={16} className="text-indigo-600" /> Biểu đồ phân tích đơn vị con
                  </h3>
                  {chartsOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                </button>
                {chartsOpen && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-5 pt-0">
                    {barChartSection}
                    {heatmapSection}
                  </div>
                )}
              </section>

              {/* Xếp loại đơn vị theo phân bố % xếp loại thành viên (mọi org) */}
              <DrillClassificationSection orgUnitId={selectedUnitId} periodId={periodId} periodIdTo={periodIdTo} />

              {/* Ma trận xếp loại (chỉ khi org đủ hai trục: KPI định tính hoặc chấm hạnh kiểm) */}
              {perf.isMatrix && (
                <DrillMatrixSection orgUnitId={selectedUnitId} periodId={periodId} periodIdTo={periodIdTo} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Drawer cây trên mobile */}
      {mobileTreeOpen && createPortal(
        <div className="fixed inset-0 z-[900] lg:hidden animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileTreeOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-[340px] p-3 animate-in slide-in-from-left duration-200">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-end mb-2">
                <button onClick={() => setMobileTreeOpen(false)} className="p-2 rounded-xl bg-white/90 dark:bg-slate-800 text-red-500 shadow"><X size={18} /></button>
              </div>
              <div className="flex-1 min-h-0">
                <OrgUnitTreeSidebar nodes={treeNodes} selectedId={treeSelectedId} onSelect={select} onAfterSelect={() => setMobileTreeOpen(false)} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Phóng to biểu đồ */}
      {expandedWidget && data && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setExpandedWidget(null)} />
          <div className="bg-white dark:bg-slate-900 w-full h-full rounded-[32px] shadow-2xl flex flex-col overflow-hidden relative z-10 border border-white/10 animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                  {expandedWidget === 'heatmap' ? <LayoutGrid size={24} /> : <BarChart3 size={24} />}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {expandedWidget === 'heatmap' ? 'Heatmap Tiến độ Chi tiết' : `So sánh Hiệu suất đơn vị con (${perf.unit})`}
                  </h3>
                  <p className="text-sm font-medium text-slate-500 mt-1">Dữ liệu phân tích chuyên sâu cho {data.orgUnitName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CopyButton
                  targetRef={expandedWidget === 'comparison' ? portalComparisonRef : portalHeatmapRef}
                  label="Sao chép ảnh"
                  className="bg-white dark:bg-slate-800 px-4 py-2 hover:border-indigo-500 text-slate-600 dark:text-slate-300"
                />
                <button
                  onClick={() => setExpandedWidget(null)}
                  className="p-3 bg-white dark:bg-slate-800 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-8 overflow-hidden flex flex-col" ref={expandedWidget === 'comparison' ? portalComparisonRef : portalHeatmapRef}>
              {expandedWidget === 'comparison' ? (
                isLeafUnit ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
                    <Building2 size={48} className="text-slate-300" />
                    <p className="text-sm font-bold">Không có đơn vị con trực thuộc</p>
                  </div>
                ) : (
                  <div className="w-full flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData} layout="vertical" margin={{ left: 60, right: 70, top: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="#f1f5f9" strokeOpacity={0.8} />
                        <XAxis type="number" domain={[0, perf.axisMax]} tickFormatter={v => perf.formatShort(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<DrillBarTooltip perf={perf} />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                        <Bar name="Hiệu suất" dataKey="completion" radius={[0, 8, 8, 0]} barSize={36} isAnimationActive={false}
                          label={{ position: 'right', fill: '#64748b', fontSize: 11, fontWeight: 700, formatter: (v: any) => perf.formatShort(v) }}>
                          {comparisonData.map((entry, index) => (
                            <Cell key={index} fill={perf.toPct(entry.completion) >= 80 ? '#10b981' : perf.toPct(entry.completion) >= 50 ? '#f59e0b' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : isLeafUnit ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
                  <Building2 size={48} className="text-slate-300" />
                  <p className="text-sm font-bold">Không có đơn vị con trực thuộc</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/30 dark:bg-slate-800/20">
                  <table className="w-full border-separate border-spacing-[3px]">
                    <thead>
                      <tr>
                        <th className="sticky top-0 left-0 bg-white dark:bg-slate-900 z-30 p-6 border-b border-r border-slate-100 dark:border-slate-800 shadow-[2px_2px_15px_rgba(0,0,0,0.03)]"></th>
                        {heatmapX.map(x => (
                          <th key={x} className="sticky top-0 bg-white dark:bg-slate-900 z-20 text-[11px] font-black uppercase tracking-widest text-slate-400 p-4 min-w-[120px] text-center border-b border-slate-100 dark:border-slate-800">
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapY.map(y => {
                        const cellHeight = heatmapY.length > 15 ? 'h-9' : 'h-14'
                        return (
                          <tr key={y} className="group">
                            <td className="sticky left-0 bg-white dark:bg-slate-900 z-20 text-[11px] font-black text-slate-600 dark:text-slate-300 p-4 pr-10 max-w-[220px] truncate border-r border-slate-100 dark:border-slate-800 group-hover:text-indigo-600 transition-colors">
                              {y}
                            </td>
                            {heatmapX.map(x => {
                              const point = data.heatmapData.find(p => p.x === x && p.y === y)
                              const val = point?.value || 0
                              return (
                                <td key={`${x}-${y}`} className="p-0.5">
                                  <div
                                    className={cn('rounded-xl flex items-center justify-center font-black text-white transition-all cursor-help border border-white/10 dark:border-white/5 hover:scale-[1.03] hover:shadow-xl', cellHeight, 'text-xs')}
                                    style={{
                                      backgroundColor: val >= 80 ? '#10b981' : val >= 50 ? '#f59e0b' : val > 0 ? '#ef4444' : '#f1f5f9',
                                      opacity: val > 0 ? 0.45 + (val / 100) * 0.55 : 0.4,
                                      color: val === 0 ? '#94a3b8' : 'white',
                                    }}
                                    onMouseEnter={e => setHoveredPoint({ x, y, val, rect: e.currentTarget.getBoundingClientRect() })}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                  >
                                    {val > 0 ? `${Math.round(val)}%` : '—'}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-8">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-[10px] font-black uppercase text-slate-500">Tiến độ Tốt (≥80%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-[10px] font-black uppercase text-slate-500">Trung bình (50–79%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-[10px] font-black uppercase text-slate-500">Rủi ro cao (&lt;50%)</span></div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Tooltip heatmap */}
      {hoveredPoint && createPortal(
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: hoveredPoint.rect.left + hoveredPoint.rect.width / 2,
            top: hoveredPoint.rect.top,
            transform: 'translate(-50%, -100%) translateY(-8px)',
          }}
        >
          <div className="bg-slate-900 text-white text-[10px] p-3 rounded-xl shadow-2xl min-w-[140px] animate-in fade-in zoom-in-95 duration-200">
            <p className="text-indigo-400 font-black uppercase tracking-widest text-[8px] mb-1">{hoveredPoint.x}</p>
            <p className="font-bold leading-tight mb-2">{hoveredPoint.y}</p>
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-white/60">Tiến độ</span>
              <span className={cn('font-black', hoveredPoint.val >= 80 ? 'text-emerald-400' : hoveredPoint.val >= 50 ? 'text-amber-400' : 'text-red-400')}>
                {hoveredPoint.val.toFixed(1)}%
              </span>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900" />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
