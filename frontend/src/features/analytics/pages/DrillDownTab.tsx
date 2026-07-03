import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useDrillDown } from '../hooks/useAnalytics'
import { cn, getInitials } from '@/lib/utils'
import {
  ChevronRight, Users, CheckCircle2, Clock, ArrowLeft, X,
  BarChart3, LayoutGrid, Search, Maximize2, Building2, Target
} from 'lucide-react'
import AnalyticsTabSkeleton from '@/components/common/AnalyticsTabSkeleton'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CopyButton } from '@/components/common/CopyButton'
import Pagination from '@/components/common/Pagination'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import type { EmployeeDrillSummary } from '@/types/stats'

const EMP_PAGE_SIZE = 5

function DrillBarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const name = payload[0]?.payload?.name || ''
  const val = payload[0]?.value ?? 0
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-white/10 max-w-[220px]">
      <p className="font-bold mb-1.5 break-words leading-tight">{name}</p>
      <p className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: val >= 80 ? '#10b981' : val >= 50 ? '#f59e0b' : '#ef4444' }} />
        Hiệu suất: <span className="font-black ml-1">{Math.round(val)}%</span>
      </p>
    </div>
  )
}

export default function DrillDownTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentId = searchParams.get('unitId') || undefined

  // ── Date filter ───────────────────────────────────────────────────────────
  const { periodId, periodIdTo, from, to, controls } = useAnalyticsDateFilter({ selectClassName: 'h-9' })
  const [filterStuck, setFilterStuck] = useState(false)
  const filterSentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = filterSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]) setFilterStuck(!entries[0].isIntersecting) },
      { threshold: 0, rootMargin: '-65px 0px 0px 0px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const { data, isLoading } = useDrillDown(currentId, from, to, periodId, periodIdTo)

  // ── Heatmap tooltip ───────────────────────────────────────────────────────
  const [hoveredPoint, setHoveredPoint] = useState<{ x: string; y: string; val: number; rect: DOMRect } | null>(null)

  // ── Employee search (debounced) & pagination ──────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [empPage, setEmpPage] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput)
      setEmpPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // ── Breadcrumb path ───────────────────────────────────────────────────────
  const [path, setPath] = useState<{ id?: string; name: string }[]>([])

  // ── Expanded chart portals ────────────────────────────────────────────────
  const [expandedWidget, setExpandedWidget] = useState<'comparison' | 'heatmap' | null>(null)

  // Section refs for copy
  const comparisonRef = useRef<HTMLDivElement>(null)
  const heatmapRef = useRef<HTMLDivElement>(null)
  const employeeTableRef = useRef<HTMLDivElement>(null)
  const portalComparisonRef = useRef<HTMLDivElement>(null)
  const portalHeatmapRef = useRef<HTMLDivElement>(null)

  // On fresh mount: clear stale unitId from URL left over from previous tab session
  useEffect(() => {
    if (currentId) setSearchParams({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drillInto = (id: string) => setSearchParams({ unitId: id })

  const goBack = () => {
    if (path.length > 1) {
      const parent = path[path.length - 2]
      if (parent?.id) setSearchParams({ unitId: parent.id })
      else setSearchParams({})
    }
  }

  // Sync breadcrumbs
  useEffect(() => {
    if (data) {
      if (!currentId) {
        setPath([{ id: data.orgUnitId || undefined, name: data.orgUnitName || 'Phân cấp' }])
      } else {
        setPath(prev => {
          const idx = prev.findIndex(p => p.id === currentId)
          if (idx !== -1) return prev.slice(0, idx + 1)
          return [...prev, { id: currentId, name: data.orgUnitName || '...' }]
        })
      }
    }
  }, [data, currentId])

  // Filter employees (no client-side sort)
  const filteredEmployees = useMemo((): EmployeeDrillSummary[] => {
    if (!data?.employees) return []
    if (!searchTerm) return data.employees
    const low = searchTerm.toLowerCase()
    return data.employees.filter(e =>
      e.fullName.toLowerCase().includes(low) ||
      e.email.toLowerCase().includes(low) ||
      e.roleName.toLowerCase().includes(low)
    )
  }, [data?.employees, searchTerm])

  const totalEmpPages = Math.ceil(filteredEmployees.length / EMP_PAGE_SIZE)
  const paginatedEmployees = useMemo(() => {
    const start = empPage * EMP_PAGE_SIZE
    return filteredEmployees.slice(start, start + EMP_PAGE_SIZE)
  }, [filteredEmployees, empPage])

  if (isLoading) return <AnalyticsTabSkeleton variant="drilldown" className="p-6" />
  if (!data) return <div className="text-center py-16 text-slate-400">Không có dữ liệu</div>

  const comparisonData = data.childUnits.map(u => ({
    name: u.orgUnitName.length > 20 ? u.orgUnitName.substring(0, 20) + '…' : u.orgUnitName,
    completion: u.performanceRate,
  })).sort((a, b) => b.completion - a.completion)

  const isLeafUnit = data.childUnits.length === 0

  const heatmapX = Array.from(new Set(data.heatmapData?.map(p => p.x) || []))
  const heatmapY = Array.from(new Set(data.heatmapData?.map(p => p.y) || []))

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        {path.length > 1 && (
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={16} />
          </button>
        )}
        {path.map((p, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-slate-400" />}
            <button
              onClick={() => { if (p.id) setSearchParams({ unitId: p.id }); else setSearchParams({}) }}
              className={cn('text-sm font-bold px-2 py-1 rounded-lg transition-colors',
                i === path.length - 1
                  ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'text-slate-500 hover:text-slate-800'
              )}
            >
              {p.name}
            </button>
          </div>
        ))}
      </div>

      {/* Sentinel for sticky filter */}
      <div ref={filterSentinelRef} className="h-px" aria-hidden />

      {/* Date Filter — sticky */}
      <div className={cn(
        'sticky top-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl transition-all duration-200',
        filterStuck
          ? 'p-3 shadow-lg shadow-slate-200/80 dark:shadow-slate-900/80 border-slate-300 dark:border-slate-700'
          : 'p-4 shadow-sm'
      )}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-between transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg text-indigo-600 dark:text-indigo-400 transition-all duration-200",
              filterStuck ? "bg-indigo-50/60 dark:bg-indigo-900/20" : "bg-indigo-50 dark:bg-indigo-900/30"
            )}>
              <Target size={filterStuck ? 16 : 18} />
            </div>
            <div>
              <h2 className={cn("font-bold text-slate-900 dark:text-white transition-all duration-200", filterStuck ? "text-sm" : "text-base")}>
                Lọc theo thời gian
              </h2>
              {!filterStuck && (
                <p className="text-xs text-slate-500 font-medium mt-0.5">Dữ liệu phân tích đồng bộ cho tất cả biểu đồ</p>
              )}
            </div>
          </div>
          {controls}
        </div>
      </div>

      {/* Current unit summary banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[28px] p-5 md:p-6 text-white shadow-xl">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Unit Comparison Chart */}
        <section ref={comparisonRef} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm relative h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-600" /> Hiệu suất của đơn vị con (%)
            </h3>
            <div className="flex items-center gap-1">
              <CopyButton targetRef={comparisonRef} />
              <button onClick={() => setExpandedWidget('comparison')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          {isLeafUnit ? (
            <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-slate-400">
              <Building2 size={32} className="text-slate-300" />
              <p className="text-xs font-bold">Không có đơn vị con trực thuộc</p>
            </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 55, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="#f1f5f9" strokeOpacity={0.8} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${Math.round(v)}%`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DrillBarTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                  <Bar name="Hiệu suất" dataKey="completion" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}
                    label={{ position: 'right', fill: '#64748b', fontSize: 10, fontWeight: 700, formatter: (v: any) => `${Math.round(v)}%` }}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={index} fill={entry.completion >= 80 ? '#10b981' : entry.completion >= 50 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {!isLeafUnit && (
            <div className="flex items-center justify-center gap-5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-slate-500">Tốt (≥80%)</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span className="text-[10px] font-bold text-slate-500">Trung bình (50–79%)</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-[10px] font-bold text-slate-500">Rủi ro (&lt;50%)</span></div>
            </div>
          )}
        </section>

        {/* Heatmap */}
        <section ref={heatmapRef} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm relative h-full">
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
            <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-slate-400">
              <Building2 size={32} className="text-slate-300" />
              <p className="text-xs font-bold">Không có đơn vị con trực thuộc</p>
            </div>
          ) : heatmapY.length > 0 ? (
            <div className="overflow-auto max-h-[300px]">
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
                        const point = data.heatmapData.find(p => p.x === x && p.y === y)
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
            <div className="h-[300px] flex items-center justify-center text-slate-400 text-xs italic">Chưa có dữ liệu heatmap</div>
          )}
        </section>
      </div>

      {/* Child Units Grid */}
      {data.childUnits.length > 0 && (
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">
            Đơn vị con ({data.childUnits.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.childUnits.map(u => {
              const kRate = Math.round(u.performanceRate)
              return (
                <button
                  key={u.orgUnitId}
                  onClick={() => drillInto(u.orgUnitId)}
                  className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 p-5 text-left hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-200 dark:shadow-none">
                      {getInitials(u.orgUnitName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">{u.orgUnitName}</p>
                      <p className="text-[11px] font-bold text-slate-500">{u.levelName} • {u.memberCount} người</p>
                    </div>
                    {u.hasChildren && <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-500" />}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-1000', kRate >= 80 ? 'bg-emerald-500' : kRate >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                        style={{ width: `${kRate}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-600">{kRate}%</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-black">
                    <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 size={11} />{u.approvedSubmissions}</span>
                    <span className="text-amber-600 flex items-center gap-0.5"><Clock size={11} />{u.pendingSubmissions}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Employees Table */}
      {data.employees.length > 0 && (
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
                  <th className="px-3 py-4 text-center">Số KPI được giao</th>
                  <th className="px-3 py-4 text-center">Tiến độ</th>
                  <th className="px-3 py-4 text-center">Hiệu suất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {paginatedEmployees.map(emp => {
                  const progressPct = emp.assignedKpi > 0 ? Math.round(emp.approvedSubmissions / emp.assignedKpi * 100) : 0
                  const perfPct = emp.performanceRate != null ? Math.round(emp.performanceRate) : null
                  return (
                    <tr key={emp.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-black text-slate-600">
                            {getInitials(emp.fullName)}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 dark:text-white leading-none">{emp.fullName}</p>
                            <p className="text-[11px] font-bold text-slate-400 mt-1">{emp.roleName}</p>
                          </div>
                        </div>
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
                            {perfPct}%
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

          <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
            {paginatedEmployees.map(emp => {
              const progressPct = emp.assignedKpi > 0 ? Math.round(emp.approvedSubmissions / emp.assignedKpi * 100) : 0
              const perfPct = emp.performanceRate != null ? Math.round(emp.performanceRate) : null
              return (
                <div key={emp.userId} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0">
                      {getInitials(emp.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 dark:text-white leading-none truncate">{emp.fullName}</p>
                      <p className="text-[11px] font-bold text-slate-400 mt-1">{emp.roleName}</p>
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
                        Hiệu suất {perfPct}%
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
      )}

      {/* Expanded Chart Portal */}
      {expandedWidget && createPortal(
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
                    {expandedWidget === 'heatmap' ? 'Heatmap Tiến độ Chi tiết' : 'So sánh Hiệu suất đơn vị con (%)'}
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
                        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${Math.round(v)}%`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<DrillBarTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                        <Bar name="Hiệu suất" dataKey="completion" radius={[0, 8, 8, 0]} barSize={36} isAnimationActive={false}
                          label={{ position: 'right', fill: '#64748b', fontSize: 11, fontWeight: 700, formatter: (v: any) => `${Math.round(v)}%` }}>
                          {comparisonData.map((entry, index) => (
                            <Cell key={index} fill={entry.completion >= 80 ? '#10b981' : entry.completion >= 50 ? '#f59e0b' : '#ef4444'} />
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

      {/* Heatmap Tooltip Portal */}
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
