import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useDrillDown } from '../hooks/useAnalytics'
import { cn, getInitials } from '@/lib/utils'
import { Building2, ChevronRight, Users, Target, CheckCircle2, Clock, XCircle, Star, ArrowLeft, X, BarChart3, LayoutGrid, Search, ArrowUpDown, Maximize2, Minimize2 } from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import type { EmployeeDrillSummary } from '@/types/stats'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CopyButton } from '@/components/common/CopyButton'

export default function DrillDownTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentId = searchParams.get('unitId') || undefined
  const { data, isLoading } = useDrillDown(currentId)
  const [quickView, setQuickView] = useState<EmployeeDrillSummary | null>(null)
  
  // Tooltip Portal State
  const [hoveredPoint, setHoveredPoint] = useState<{ x: string, y: string, val: number, rect: DOMRect } | null>(null)
  
  // Search & Sort state
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: keyof EmployeeDrillSummary; direction: 'asc' | 'desc' } | null>(null)

  // Local path state for breadcrumbs
  const [path, setPath] = useState<{ id?: string; name: string }[]>([])
  
  // Expanded state for charts
  const [expandedWidget, setExpandedWidget] = useState<'comparison' | 'heatmap' | null>(null)

  // Section Refs for Copy
  const comparisonRef = useRef<HTMLDivElement>(null)
  const heatmapRef = useRef<HTMLDivElement>(null)
  const employeeTableRef = useRef<HTMLDivElement>(null)
  const portalComparisonRef = useRef<HTMLDivElement>(null)
  const portalHeatmapRef = useRef<HTMLDivElement>(null)

  const drillInto = (id: string, name: string) => {
    setSearchParams({ unitId: id })
  }

  const goBack = () => {
    if (path.length > 1) {
      const parent = path[path.length - 2]
      if (parent?.id) setSearchParams({ unitId: parent.id })
      else setSearchParams({})
    }
  }

  // Sync breadcrumbs with current data
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

  // Filter and Sort logic
  const filteredAndSortedEmployees = useMemo(() => {
    if (!data?.employees) return []
    let result = [...data.employees]
    
    if (searchTerm) {
      const lowTerm = searchTerm.toLowerCase()
      result = result.filter(e => 
        e.fullName.toLowerCase().includes(lowTerm) || 
        e.email.toLowerCase().includes(lowTerm) ||
        e.roleName.toLowerCase().includes(lowTerm)
      )
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key]
        const bVal = b[sortConfig.key]
        if (aVal === null) return 1
        if (bVal === null) return -1
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return result
  }, [data?.employees, searchTerm, sortConfig])

  const handleSort = (key: keyof EmployeeDrillSummary) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  if (isLoading) return <div className="p-8"><LoadingSkeleton rows={6} /></div>
  if (!data) return <div className="text-center py-16 text-slate-400">Không có dữ liệu</div>

  // Prepare chart data
  const comparisonData = data.childUnits.map(u => ({
    name: u.orgUnitName,
    completion: u.completionRate,
    avgScore: u.avgScore || 0
  })).sort((a, b) => b.completion - a.completion)

  const heatmapX = Array.from(new Set(data.heatmapData?.map(p => p.x) || []))
  const heatmapY = Array.from(new Set(data.heatmapData?.map(p => p.y) || []))

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        {path.length > 1 && (
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><ArrowLeft size={16} /></button>
        )}
        {path.map((p, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-slate-400" />}
            <button 
              onClick={() => {
                if (p.id) setSearchParams({ unitId: p.id })
                else setSearchParams({})
              }} 
              className={cn("text-sm font-bold px-2 py-1 rounded-lg transition-colors", 
                i === path.length - 1 ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "text-slate-500 hover:text-slate-800"
              )}
            >
              {p.name}
            </button>
          </div>
        ))}
      </div>

      {/* Current unit summary */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[24px] p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">{data.levelName || 'Cấp đơn vị'}</p>
            <h2 className="text-2xl font-black mt-1">{data.orgUnitName || 'Tất cả'}</h2>
          </div>
          <div className="flex gap-6 text-center">
            <div><p className="text-2xl font-black">{data.memberCount}</p><p className="text-[10px] text-white/70 font-bold uppercase">Nhân sự</p></div>
            <div><p className="text-2xl font-black">{data.totalKpi}</p><p className="text-[10px] text-white/70 font-bold uppercase">KPI Tổng</p></div>
            <div><p className="text-2xl font-black">{data.avgScore?.toFixed(1) ?? '—'}</p><p className="text-[10px] text-white/70 font-bold uppercase">Điểm TB</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unit Comparison Chart */}
        <section ref={comparisonRef} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm relative h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black flex items-center gap-2"><BarChart3 size={16} className="text-indigo-600" /> So sánh hoàn thành KPI (%)</h3>
            <div className="flex items-center gap-1">
              <CopyButton targetRef={comparisonRef} />
              <button 
                onClick={() => setExpandedWidget('comparison')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fontWeight: 700 }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: any) => [typeof val === 'number' ? `${val.toFixed(1)}%` : val, 'Hoàn thành']}
                />
                <Bar dataKey="completion" radius={[0, 4, 4, 0]} barSize={20}>
                  {comparisonData.map((entry, index) => (
                    <Cell key={index} fill={entry.completion >= 80 ? '#10b981' : entry.completion >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Heatmap Section */}
        <section ref={heatmapRef} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm relative h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black flex items-center gap-2"><LayoutGrid size={16} className="text-indigo-600" /> Heatmap Hiệu suất</h3>
            <div className="flex items-center gap-1">
              <CopyButton targetRef={heatmapRef} />
              <button 
                onClick={() => setExpandedWidget('heatmap')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
          {heatmapY.length > 0 ? (
            <div className="overflow-auto max-h-[300px]">
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 bg-white dark:bg-slate-900 z-20"></th>
                    {heatmapX.map(x => (
                      <th key={x} className="sticky top-0 bg-white dark:bg-slate-900 z-10 text-[9px] font-black uppercase text-slate-400 p-1 min-w-[80px] text-center">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapY.map((y, yIdx) => (
                    <tr key={y}>
                      <td className="sticky left-0 bg-white dark:bg-slate-900 z-10 text-[9px] font-bold text-slate-500 pr-2 max-w-[100px] truncate">
                        {y}
                      </td>
                      {heatmapX.map(x => {
                        const point = data.heatmapData.find(p => p.x === x && p.y === y)
                        const val = point?.value || 0
                        return (
                          <td key={`${x}-${y}`} className="p-0">
                            <div 
                              className="h-8 rounded-sm flex items-center justify-center text-[8px] font-bold text-white transition-all hover:scale-110 cursor-help"
                              style={{ 
                                backgroundColor: val >= 80 ? '#10b981' : val >= 50 ? '#f59e0b' : val > 0 ? '#ef4444' : '#f1f5f9',
                                opacity: val > 0 ? 0.3 + (val / 100) * 0.7 : 1
                              }}
                              onMouseEnter={(e) => setHoveredPoint({ x, y, val, rect: e.currentTarget.getBoundingClientRect() })}
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
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Đơn vị con ({data.childUnits.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.childUnits.map(u => {
              const kRate = Math.round(u.completionRate)
              return (
                <button key={u.orgUnitId} onClick={() => drillInto(u.orgUnitId, u.orgUnitName)} className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 p-5 text-left hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-200 dark:shadow-none">{getInitials(u.orgUnitName)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">{u.orgUnitName}</p>
                      <p className="text-[11px] font-bold text-slate-500">{u.levelName} • {u.memberCount} người</p>
                    </div>
                    {u.hasChildren && <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-500" />}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-1000", kRate >= 80 ? "bg-emerald-500" : kRate >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${kRate}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-slate-600">{kRate}%</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-black">
                    <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 size={11} />{u.approvedSubmissions}</span>
                    <span className="text-amber-600 flex items-center gap-0.5"><Clock size={11} />{u.pendingSubmissions}</span>
                    {u.avgScore != null && <span className="text-indigo-500 flex items-center gap-0.5 ml-auto bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full"><Star size={11} className="fill-indigo-500" />{u.avgScore.toFixed(1)}</span>}
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
              <h3 className="font-black text-sm flex items-center gap-2"><Users size={16} className="text-indigo-600" /> Thành viên trực thuộc ({filteredAndSortedEmployees.length})</h3>
              <CopyButton targetRef={employeeTableRef} />
            </div>
            <div className="relative w-full md:w-64">
              <input 
                type="text" 
                placeholder="Tìm tên, email, vai trò..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-left cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort('fullName')}>
                    <div className="flex items-center gap-1">Họ tên & Vai trò <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100" /></div>
                  </th>
                  <th className="px-3 py-4 text-center cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort('assignedKpi')}>
                    <div className="flex items-center justify-center gap-1">Assigned <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100" /></div>
                  </th>
                  <th className="px-3 py-4 text-center cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort('approvedSubmissions')}>
                    <div className="flex items-center justify-center gap-1">Approved <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100" /></div>
                  </th>
                  <th className="px-3 py-4 text-center cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort('pendingSubmissions')}>
                    <div className="flex items-center justify-center gap-1">Pending <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100" /></div>
                  </th>
                  <th className="px-3 py-4 text-center cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort('avgScore')}>
                    <div className="flex items-center justify-center gap-1">Score <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100" /></div>
                  </th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredAndSortedEmployees.map(emp => (
                  <tr key={emp.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-black text-slate-600">{getInitials(emp.fullName)}</div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white leading-none">{emp.fullName}</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1">{emp.roleName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center font-black">{emp.assignedKpi}</td>
                    <td className="px-3 py-4 text-center"><span className="text-emerald-600 font-black">{emp.approvedSubmissions}</span></td>
                    <td className="px-3 py-4 text-center"><span className="text-amber-500 font-black">{emp.pendingSubmissions}</span></td>
                    <td className="px-3 py-4 text-center">{emp.avgScore != null ? <span className="font-black text-indigo-600">{emp.avgScore.toFixed(1)}</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-6 py-4 text-right"><button onClick={() => setQuickView(emp)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><ChevronRight size={18} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAndSortedEmployees.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs italic">Không tìm thấy kết quả phù hợp</div>
            )}
          </div>
        </section>
      )}

      {/* Quick View Modal */}
      {quickView && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setQuickView(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-md p-8 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-black shadow-xl shadow-indigo-200 dark:shadow-none">{getInitials(quickView.fullName)}</div>
                <div><h3 className="font-black text-xl text-slate-900 dark:text-white">{quickView.fullName}</h3><p className="text-xs font-bold text-slate-500">{quickView.roleName} • {quickView.email}</p></div>
              </div>
              <button onClick={() => setQuickView(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-5 bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl text-center"><p className="text-3xl font-black text-indigo-600">{quickView.assignedKpi}</p><p className="text-[10px] font-black text-indigo-400 uppercase mt-1 tracking-wider">KPI Giao</p></div>
              <div className="p-5 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl text-center"><p className="text-3xl font-black text-emerald-600">{quickView.avgScore?.toFixed(1) ?? '—'}</p><p className="text-[10px] font-black text-emerald-400 uppercase mt-1 tracking-wider">Điểm TB</p></div>
            </div>
            <div className="space-y-3 px-2">
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Tổng bài nộp</span><span className="text-sm font-black text-slate-900 dark:text-white">{quickView.totalSubmissions}</span></div>
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-emerald-600">Đã phê duyệt</span><span className="text-sm font-black text-emerald-600">{quickView.approvedSubmissions}</span></div>
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-amber-500">Đang chờ duyệt</span><span className="text-sm font-black text-amber-500">{quickView.pendingSubmissions}</span></div>
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-red-500">Đã từ chối</span><span className="text-sm font-black text-red-500">{quickView.rejectedSubmissions}</span></div>
            </div>
            <button onClick={() => setQuickView(null)} className="w-full mt-8 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 dark:shadow-none hover:translate-y-[-2px] transition-transform">Đóng</button>
          </div>
        </div>
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
                    {expandedWidget === 'heatmap' ? 'Heatmap Hiệu suất Chi tiết' : 'So sánh Hoàn thành KPI (%)'}
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
                <div className="w-full flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} layout="vertical" margin={{ left: 60, right: 60, top: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide domain={[0, 100]} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fontWeight: 700 }} />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: any) => [typeof val === 'number' ? `${val.toFixed(1)}%` : val, 'Hoàn thành']}
                      />
                      <Bar dataKey="completion" radius={[0, 8, 8, 0]} barSize={40}>
                        {comparisonData.map((entry, index) => (
                          <Cell key={index} fill={entry.completion >= 80 ? '#10b981' : entry.completion >= 50 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
                      {heatmapY.map((y) => {
                        // Calculate responsive cell height based on row count
                        const cellHeight = heatmapY.length > 15 ? 'h-9' : 'h-14';
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
                                    className={cn(
                                      "rounded-xl flex items-center justify-center font-black text-white transition-all cursor-help border border-white/10 dark:border-white/5 hover:scale-[1.03] hover:shadow-xl",
                                      cellHeight, "text-xs"
                                    )}
                                    style={{ 
                                      backgroundColor: val >= 80 ? '#10b981' : val >= 50 ? '#f59e0b' : val > 0 ? '#ef4444' : '#f1f5f9',
                                      opacity: val > 0 ? 0.45 + (val / 100) * 0.55 : 0.4,
                                      color: val === 0 ? '#94a3b8' : 'white'
                                    }}
                                    onMouseEnter={(e) => setHoveredPoint({ x, y, val, rect: e.currentTarget.getBoundingClientRect() })}
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
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-[10px] font-black uppercase text-slate-500">Hiệu suất Tốt (≥80%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-[10px] font-black uppercase text-slate-500">Trung bình (50-79%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-[10px] font-black uppercase text-slate-500">Rủi ro cao (&lt;50%)</span></div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Tooltip Portal */}
      {hoveredPoint && createPortal(
        <div 
          className="fixed z-[100] pointer-events-none"
          style={{ 
            left: hoveredPoint.rect.left + hoveredPoint.rect.width / 2,
            top: hoveredPoint.rect.top,
            transform: 'translate(-50%, -100%) translateY(-8px)'
          }}
        >
          <div className="bg-slate-900 text-white text-[10px] p-3 rounded-xl shadow-2xl min-w-[140px] animate-in fade-in zoom-in-95 duration-200">
            <p className="text-indigo-400 font-black uppercase tracking-widest text-[8px] mb-1">{hoveredPoint.x}</p>
            <p className="font-bold leading-tight mb-2">{hoveredPoint.y}</p>
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-white/60">Hiệu suất</span>
              <span className={cn("font-black", hoveredPoint.val >= 80 ? "text-emerald-400" : hoveredPoint.val >= 50 ? "text-amber-400" : "text-red-400")}>
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
