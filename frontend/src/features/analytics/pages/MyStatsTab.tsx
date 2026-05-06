import { useState, useMemo, useEffect, useRef } from 'react'
import { useMyAnalytics } from '../hooks/useAnalytics'
import { useAuthStore } from '@/store/authStore'
import { reportApi } from '@/features/reports/api/reportApi'
import { getInitials, cn } from '@/lib/utils'
import { Target, Award, TrendingUp, Star, Settings, Settings2, GripVertical, X, Eye, EyeOff, Layout, Save, RotateCcw, Hash, Table2, BarChart3 as BarChartIcon, Plus, Trash2, PieChart as PieChartIcon, Bell, Activity, Info, ArrowUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { CopyButton } from '@/components/common/CopyButton'

const ResponsiveGridLayout = WidthProvider(Responsive)
const CONFIG_REPORT_NAME = '__PERSONAL_DASHBOARD_CONFIG__'
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e']

const QUICK_RANGES = [
  { label: 'Tháng này', from: () => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString() }, to: () => new Date().toISOString() },
  { label: 'Quý này', from: () => { const d = new Date(); d.setMonth(Math.floor(d.getMonth()/3)*3, 1); d.setHours(0,0,0,0); return d.toISOString() }, to: () => new Date().toISOString() },
  { label: 'Năm nay', from: () => { const d = new Date(); d.setMonth(0,1); d.setHours(0,0,0,0); return d.toISOString() }, to: () => new Date().toISOString() },
  { label: 'Tất cả', from: () => undefined as any, to: () => undefined as any },
]

const KpiTableWidget = ({ data, title }: { data: any[], title: string }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5
  const sectionRef = useRef<HTMLDivElement>(null)

  const filteredData = useMemo(() => {
    let result = [...data]
    if (filter) {
      result = result.filter(item => 
        item.kpiName.toLowerCase().includes(filter.toLowerCase()) || 
        item.unit?.toLowerCase().includes(filter.toLowerCase())
      )
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? ''
        const bVal = b[sortConfig.key] ?? ''
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return result
  }, [data, filter, sortConfig])

  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  return (
    <section ref={sectionRef} className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <h3 className="font-black text-sm flex items-center gap-2"><Target size={16} className="text-indigo-600" /> {title}</h3>
          <CopyButton targetRef={sectionRef} />
        </div>
        <div className="relative max-w-[200px] w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/50 z-10">
            <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('kpiName')}>
                <div className="flex items-center gap-1">Mục tiêu <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-3 py-3 text-center cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('targetValue')}>
                <div className="flex items-center justify-center gap-1">Chỉ tiêu <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-3 py-3 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('unit')}>
                <div className="flex items-center justify-center gap-1">Đơn vị <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-3 py-3 text-center cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('actualValue')}>
                <div className="flex items-center justify-center gap-1">Thực hiện <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-3 py-3 w-[140px] cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('completionRate')}>
                <div className="flex items-center gap-1">Tiến độ <ArrowUpDown size={10} /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {paginatedData.map(k => {
              const pct = Math.round(k.completionRate || 0)
              return (
                <tr key={k.kpiId} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{k.kpiName}</p>
                    <p className="text-[11px] text-slate-500">{k.orgUnitName}</p>
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-sm">{k.targetValue?.toLocaleString('vi-VN') ?? '—'}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{k.unit || '—'}</span>
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-sm">{k.actualValue?.toLocaleString('vi-VN') ?? '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className={cn("text-[10px] font-black w-8 text-right", pct >= 80 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-600")}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Trang {page} / {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-slate-200"><ChevronLeft size={14} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-slate-200"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </section>
  )
}

const EvaluationTableWidget = ({ data, title }: { data: any[], title: string }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5
  const sectionRef = useRef<HTMLDivElement>(null)

  const filteredData = useMemo(() => {
    let result = [...data]
    if (filter) {
      result = result.filter(item => 
        item.kpiName.toLowerCase().includes(filter.toLowerCase()) || 
        item.evaluatorName.toLowerCase().includes(filter.toLowerCase())
      )
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? ''
        const bVal = b[sortConfig.key] ?? ''
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return result
  }, [data, filter, sortConfig])

  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  return (
    <section ref={sectionRef} className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <h3 className="font-black text-sm flex items-center gap-2"><Star size={16} className="text-amber-500" /> {title}</h3>
          <CopyButton targetRef={sectionRef} />
        </div>
        <div className="relative max-w-[200px] w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/50 z-10">
            <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('score')}>
                <div className="flex items-center gap-1">Điểm <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-3 py-3 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('kpiName')}>
                <div className="flex items-center gap-1">Chỉ tiêu <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-3 py-3 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('evaluatorName')}>
                <div className="flex items-center gap-1">Người đánh giá <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-3 py-3 text-right cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('createdAt')}>
                <div className="flex items-center justify-end gap-1">Ngày đánh giá <ArrowUpDown size={10} /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {paginatedData.map(e => (
              <tr key={e.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm",
                    (e.score ?? 0) >= 8 ? "bg-emerald-100 text-emerald-700" : (e.score ?? 0) >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  )}>{e.score?.toFixed(1) ?? '—'}</div>
                </td>
                <td className="px-3 py-3">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{e.kpiName}</p>
                </td>
                <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-400 font-medium">{e.evaluatorName}</td>
                <td className="px-3 py-3 text-right text-[11px] text-slate-500 font-bold">{new Date(e.createdAt).toLocaleDateString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Trang {page} / {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-slate-200"><ChevronLeft size={14} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-slate-200"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </section>
  )
}

export type WidgetType = 'BAR' | 'PIE' | 'TABLE' | 'NUMBER_CARD' | 'TOP_STATS_GRID' | 'AREA' | 'LINE'
export type MetricType = 
  | 'SUBMISSIONS_STATUS' 
  | 'EVALUATION_HISTORY' 
  | 'KPI_PERFORMANCE' 
  | 'KPI_SUMMARY'
  | 'KPI_STATUS_DIST'
  | 'NOTIFICATION_LATEST'
  | 'NOTIFICATION_STATS'

interface PersonalWidget {
  id?: string // Database UUID
  i: string // Unique Key
  type: WidgetType
  metric: MetricType
  title: string
  x: number
  y: number
  w: number
  h: number
  visible: boolean
}

const DEFAULT_WIDGETS: PersonalWidget[] = [
  // Hàng 1: Tổng quan
  { i: 'top-stats', type: 'TOP_STATS_GRID', metric: 'KPI_SUMMARY', title: 'Chỉ số tổng hợp', x: 0, y: 0, w: 12, h: 4, visible: true },
  
  // Hàng 2: Chi tiết KPI
  { i: 'kpi-table', type: 'TABLE', metric: 'KPI_PERFORMANCE', title: 'Chi tiết mục tiêu KPI', x: 0, y: 4, w: 12, h: 10, visible: true },
  
  // Hàng 3: Trạng thái bài nộp & Phân bổ KPI
  { i: 'submissions-pie', type: 'PIE', metric: 'SUBMISSIONS_STATUS', title: 'Trạng thái bài nộp', x: 0, y: 14, w: 6, h: 8, visible: true },
  { i: 'kpi-dist-bar', type: 'BAR', metric: 'KPI_STATUS_DIST', title: 'Phân bổ trạng thái KPI', x: 6, y: 14, w: 6, h: 8, visible: true },
  
  // Hàng 4: Thông báo & Thống kê thông báo
  { i: 'notif-list', type: 'TABLE', metric: 'NOTIFICATION_LATEST', title: 'Thông báo mới nhất', x: 0, y: 22, w: 8, h: 8, visible: true },
  { i: 'notif-pie', type: 'PIE', metric: 'NOTIFICATION_STATS', title: 'Thống kê thông báo', x: 8, y: 22, w: 4, h: 8, visible: true },
  
  // Hàng 5: Lịch sử đánh giá (Bảng & Biểu đồ)
  { i: 'eval-history-table', type: 'TABLE', metric: 'EVALUATION_HISTORY', title: 'Lịch sử đánh giá (Danh sách)', x: 0, y: 30, w: 6, h: 8, visible: true },
  { i: 'eval-history-chart', type: 'AREA', metric: 'EVALUATION_HISTORY', title: 'Xu hướng điểm số', x: 6, y: 30, w: 6, h: 8, visible: true }
]

export default function MyStatsTab() {
  const { user } = useAuthStore()
  const [range, setRange] = useState(3)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [widgets, setWidgets] = useState<PersonalWidget[]>(DEFAULT_WIDGETS)
  const [editingWidget, setEditingWidget] = useState<PersonalWidget | null>(null)
  const [configReportId, setConfigReportId] = useState<string | null>(null)
  
  const { from, to } = useMemo(() => {
    const selectedRange = QUICK_RANGES[range] || QUICK_RANGES[0]
    return {
      from: selectedRange?.from(),
      to: selectedRange?.to()
    }
  }, [range])
  
  const { data: analyticsData, isLoading: isAnalyticsLoading } = useMyAnalytics(from, to)
  const { data: notificationsData, isLoading: isNotifLoading } = useNotifications(0, 50)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const reports = await reportApi.getAll({ size: 100 })
        const configReport = reports.content.find(r => r.name === CONFIG_REPORT_NAME)
        
        if (configReport) {
          setConfigReportId(configReport.id)
          if (configReport.widgets && configReport.widgets.length > 0) {
            // Dashboard is already customized, use DB as source of truth
            const savedWidgets = configReport.widgets.map(sw => {
              try {
                const pos = JSON.parse(sw.position)
                const cfg = JSON.parse(sw.chartConfig)
                const def = DEFAULT_WIDGETS.find(dw => dw.i === cfg.i)
                
                return { 
                  ...(def || {}), 
                  ...pos, 
                  ...cfg, 
                  id: sw.id,
                  i: cfg.i || sw.id,
                  type: sw.widgetType as WidgetType,
                  title: sw.title,
                  visible: cfg.visible !== false
                } as PersonalWidget
              } catch { return null }
            }).filter(Boolean) as PersonalWidget[]

            setWidgets(savedWidgets)
          } else {
            // New dashboard, show all defaults
            setWidgets(DEFAULT_WIDGETS)
          }
        }
      } catch (e) {
        console.error("Failed to load dashboard config", e)
      }
    }
    loadConfig()
  }, [])

  const saveConfig = async () => {
    try {
      const widgetRequests = widgets.map((w, index) => ({
        id: w.id,
        widgetType: w.type as any,
        title: w.title,
        position: JSON.stringify({ x: w.x, y: w.y, w: w.w, h: w.h }),
        chartConfig: JSON.stringify({ i: w.i, metric: w.metric, visible: w.visible }),
        widgetOrder: index
      }))

      if (configReportId) {
        await reportApi.update(configReportId, { widgets: widgetRequests })
      } else {
        const newReport = await reportApi.create({
          name: CONFIG_REPORT_NAME,
          description: 'Cấu hình giao diện thống kê cá nhân'
        })
        await reportApi.update(newReport.id, { widgets: widgetRequests })
        setConfigReportId(newReport.id)
      }
      setIsEditMode(false)
    } catch (err) {
      console.error(err)
      alert("Không thể lưu cấu hình")
    }
  }

  const toggleVisibility = (id: string) => {
    setWidgets(prev => prev.map(b => b.i === id ? { ...b, visible: !b.visible } : b))
  }

  const resetLayout = () => {
    if (confirm("Bạn có chắc muốn đặt lại giao diện mặc định?")) {
      setWidgets(DEFAULT_WIDGETS)
    }
  }

  const handleLayoutChange = (newLayout: any[]) => {
    setWidgets(prev => prev.map(item => {
      const updated = newLayout.find(l => l.i === item.i)
      return updated ? { ...item, x: updated.x, y: updated.y, w: updated.w, h: updated.h } : item
    }))
  }

  const updateWidget = (id: string, data: PersonalWidget) => {
    setWidgets(prev => {
      const exists = prev.some(w => w.i === id)
      if (exists) {
        return prev.map(w => w.i === id ? data : w)
      }
      return [...prev, data]
    })
    setEditingWidget(null)
  }

  const addWidget = () => {
    const newId = `widget-${Date.now()}`
    
    // Find first available spot (simple scan)
    let nextX = 0
    let nextY = 0
    const currentWidgets = widgets.filter(w => w.visible)
    
    if (currentWidgets.length > 0) {
      // Find maxY to bound our search, or just start from 0 and look for gaps
      const maxY = Math.max(...currentWidgets.map(w => w.y + w.h), 0)
      let found = false
      for (let y = 0; y <= maxY; y++) {
        for (let x = 0; x <= 12 - 3; x++) { // Assuming w=3
          const isOccupied = currentWidgets.some(w => 
            x < w.x + w.w && x + 3 > w.x &&
            y < w.y + w.h && y + 4 > w.y
          )
          if (!isOccupied) {
            nextX = x
            nextY = y
            found = true
            break
          }
        }
        if (found) break
      }
      if (!found) {
        nextX = 0
        nextY = maxY
      }
    }

    const newWidget: PersonalWidget = {
      i: newId,
      type: 'NUMBER_CARD',
      metric: 'KPI_SUMMARY',
      title: 'Mục mới',
      x: nextX, 
      y: nextY,
      w: 3, 
      h: 4,
      visible: true
    }
    setEditingWidget(newWidget)
  }

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.i !== id))
  }

  if (isAnalyticsLoading || isNotifLoading) return <div className="p-8"><LoadingSkeleton rows={8} /></div>
  if (!analyticsData) return null

  const renderWidgetContent = (widget: PersonalWidget) => {
    // We use a functional component inside renderWidgetContent to handle local state/refs
    const WidgetWrapper = ({ children, title, icon }: { children: React.ReactNode, title: string, icon?: React.ReactNode }) => {
      const sectionRef = useRef<HTMLDivElement>(null);
      return (
        <section ref={sectionRef} className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-sm flex items-center gap-2">{icon}{title}</h3>
            {!isEditMode && <CopyButton targetRef={sectionRef} />}
          </div>
          <div className="flex-1 min-h-0">
            {children}
          </div>
        </section>
      );
    };

    switch (widget.type) {
      case 'TOP_STATS_GRID':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-full">
            <MiniCard icon={<Target size={18} />} label="KPI Đang theo dõi" value={analyticsData.totalAssignedKpi} color="indigo" />
            <MiniCard icon={<TrendingUp size={18} />} label="Tỷ lệ hoàn thành" value={`${Math.round(analyticsData.kpiItems.reduce((acc, k) => acc + (k.completionRate || 0), 0) / (analyticsData.kpiItems.length || 1))}%`} color="emerald" />
            <MiniCard icon={<Award size={18} />} label="Điểm trung bình" value={analyticsData.averageScore?.toFixed(1) ?? '—'} color="blue" />
            <MiniCard icon={<Bell size={18} />} label="Thông báo mới" value={notificationsData?.content.filter(n => !n.isRead).length ?? 0} color="amber" />
          </div>
        )
      case 'PIE':
      case 'BAR':
      case 'AREA':
      case 'LINE': {
        let chartData: any[] = []
        if (widget.metric === 'SUBMISSIONS_STATUS') {
          chartData = [
            { name: 'Đã duyệt', value: analyticsData.approvedSubmissions },
            { name: 'Chờ duyệt', value: analyticsData.pendingSubmissions },
            { name: 'Từ chối', value: analyticsData.rejectedSubmissions }
          ].filter(v => v.value > 0)
        } else if (widget.metric === 'KPI_STATUS_DIST') {
          const dist = analyticsData.kpiItems.reduce((acc: any, k) => {
            acc[k.status] = (acc[k.status] || 0) + 1
            return acc
          }, {})
          chartData = Object.entries(dist).map(([name, value]) => ({ name, value }))
        } else if (widget.metric === 'EVALUATION_HISTORY') {
          chartData = analyticsData.evaluationHistory.map(e => ({
            name: new Date(e.createdAt).toLocaleDateString('vi-VN'),
            value: e.score
          })).reverse()
        } else if (widget.metric === 'NOTIFICATION_STATS') {
          const readCount = notificationsData?.content.filter(n => n.isRead).length ?? 0
          const unreadCount = (notificationsData?.totalElements ?? 0) - readCount
          chartData = [
            { name: 'Đã đọc', value: readCount },
            { name: 'Chưa đọc', value: unreadCount }
          ]
        }

        return (
          <WidgetWrapper title={widget.title}>
            {chartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <Info size={24} className="opacity-20" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Chưa có dữ liệu</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {widget.type === 'PIE' ? (
                  <PieChart>
                    <Pie data={chartData} innerRadius="50%" outerRadius="80%" paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                      {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                ) : widget.type === 'BAR' ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                ) : widget.type === 'AREA' ? (
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorVal)" />
                  </AreaChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
          </WidgetWrapper>
        )
      }
      case 'TABLE': {
        if (widget.metric === 'KPI_PERFORMANCE') {
          return <KpiTableWidget data={analyticsData.kpiItems} title={widget.title} />
        }
        if (widget.metric === 'EVALUATION_HISTORY') {
          return <EvaluationTableWidget data={analyticsData.evaluationHistory} title={widget.title} />
        }
        if (widget.metric === 'NOTIFICATION_LATEST') {
          return (
            <WidgetWrapper title={widget.title}>
              <div className="flex-1 overflow-auto custom-scrollbar space-y-2">
                {notificationsData?.content.slice(0, 10).map(n => (
                  <div key={n.id} className={cn("p-3 rounded-xl border transition-all", n.isRead ? "bg-slate-50 dark:bg-slate-800/20 border-transparent opacity-70" : "bg-white dark:bg-slate-800 border-indigo-100 dark:border-indigo-900 shadow-sm")}>
                    <div className="flex items-start gap-3">
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", n.isRead ? "bg-slate-300" : "bg-indigo-600")} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs leading-relaxed", n.isRead ? "text-slate-500" : "text-slate-900 dark:text-white font-bold")}>{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString('vi-VN')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </WidgetWrapper>
          )
        }
        return <div className="p-5 text-center text-slate-400">Không hỗ trợ hiển thị bảng cho chỉ số này</div>
      }
      case 'NUMBER_CARD': {
        let val: any = 0
        switch (widget.metric) {
          case 'SUBMISSIONS_STATUS': val = analyticsData.totalSubmissions; break
          case 'KPI_SUMMARY': val = analyticsData.totalAssignedKpi; break
          case 'NOTIFICATION_STATS': val = notificationsData?.totalElements ?? 0; break
          default: val = 0
        }
        return (
          <WidgetWrapper title={widget.title}>
            <div className="flex flex-col items-center justify-center h-full">
              <span className="text-4xl font-black text-indigo-600">{val}</span>
            </div>
          </WidgetWrapper>
        )
      }
      default: return null
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-black shadow-lg">
            {getInitials(user?.fullName ?? '')}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">{user?.fullName}</h2>
            <p className="text-xs text-slate-500 font-medium">Tổng quan hiệu suất cá nhân</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isEditMode ? (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-1 rounded-xl border border-indigo-100 dark:border-indigo-800">
              <button onClick={resetLayout} className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400" title="Đặt lại mặc định"><RotateCcw size={18} /></button>
              <button onClick={addWidget} className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg flex items-center gap-2">
                <Plus size={14} /> Thêm Block
              </button>
              <button onClick={() => setIsConfigOpen(true)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg flex items-center gap-2">
                <Layout size={14} /> Ẩn/Hiện
              </button>
              <div className="w-px h-4 bg-indigo-200 dark:bg-indigo-800 mx-1" />
              <button onClick={() => setIsEditMode(false)} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700">Huỷ</button>
              <button onClick={saveConfig} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2">
                <Save size={14} /> Lưu
              </button>
            </div>
          ) : (
            <>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {QUICK_RANGES.map((r, i) => (
                  <button key={i} onClick={() => setRange(i)} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", i === range ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}>
                    {r.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setIsEditMode(true)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 shadow-sm transition-all">
                <Settings2 size={16} /> Tuỳ chỉnh
              </button>
            </>
          )}
        </div>
      </div>

      <div className={cn("relative min-h-[600px]", isEditMode && "bg-slate-50/50 dark:bg-slate-800/10 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800")}>
        {isEditMode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="grid grid-cols-12 w-full h-full gap-4 px-2">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="border-x border-slate-300 dark:border-slate-700 h-full" />)}
            </div>
          </div>
        )}
        
        <ResponsiveGridLayout
          className="layout"
          layouts={{ 
            lg: widgets.filter(b => b.visible),
            md: widgets.filter(b => b.visible),
            sm: widgets.filter(b => b.visible),
            xs: widgets.filter(b => b.visible),
            xxs: widgets.filter(b => b.visible)
          }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 12, xs: 6, xxs: 4 }}
          rowHeight={30}
          draggableHandle=".drag-handle"
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={(current, all) => {
            // Only update if we are not currently editing/adding to avoid layout jitter
            if (!editingWidget) {
              if (all.lg) handleLayoutChange(all.lg as any)
              else handleLayoutChange(current as any)
            }
          }}
          margin={[16, 16]}
        >
          {widgets.filter(b => b.visible).map((block) => (
            <div key={block.i} className={cn("relative group h-full", isEditMode && "ring-2 ring-transparent hover:ring-indigo-500 rounded-[24px] transition-all overflow-visible")}>
              {isEditMode && (
                <div className="absolute top-2 right-2 flex items-center gap-1 z-[60] opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingWidget(block)} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 shadow-sm"><Settings size={14} /></button>
                  <button onClick={() => removeWidget(block.i)} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 hover:text-red-600 shadow-sm"><Trash2 size={14} /></button>
                </div>
              )}
              {isEditMode && (
                <div className="drag-handle absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 z-[60] cursor-move bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-full shadow-lg flex items-center gap-1 transition-opacity">
                  <GripVertical size={14} className="text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Kéo</span>
                </div>
              )}
              <div className="h-full w-full">
                {renderWidgetContent(block)}
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>

      {/* Visibility Toggle Drawer */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setIsConfigOpen(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-lg">Ẩn/Hiện nội dung</h3>
              <button onClick={() => setIsConfigOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={20} /></button>
            </div>

            <div className="space-y-3 flex-1 overflow-auto custom-scrollbar">
              {widgets.map((b) => (
                <div key={b.i} className={cn("flex items-center gap-3 p-4 rounded-2xl border transition-all", b.visible ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-900/10" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30 opacity-60")}>
                  <span className="flex-1 text-sm font-bold truncate">{b.title}</span>
                  <button onClick={() => toggleVisibility(b.i)} className={cn("p-2 rounded-xl transition-colors", b.visible ? "text-indigo-600 bg-indigo-100 hover:bg-indigo-200" : "text-slate-400 bg-slate-200 hover:bg-slate-300")}>
                    {b.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-auto">
              <button onClick={() => setIsConfigOpen(false)} className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black hover:opacity-90 transition-all">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Widget Editor Modal */}
      {editingWidget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setEditingWidget(null)}>
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Thiết lập Block</h3>
              <button onClick={() => setEditingWidget(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={20} /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Tiêu đề</label>
                <input type="text" value={editingWidget.title} onChange={e => setEditingWidget({...editingWidget, title: e.target.value})} className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Nội dung dữ liệu</label>
                <select value={editingWidget.metric} onChange={e => setEditingWidget({...editingWidget, metric: e.target.value as MetricType})} className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm appearance-none outline-none focus:ring-2 focus:ring-indigo-500">
                  <optgroup label="TỔNG QUAN">
                    <option value="KPI_SUMMARY">Tóm tắt KPI (Số lượng)</option>
                    <option value="SUBMISSIONS_STATUS">Tóm tắt Bài nộp (Trạng thái)</option>
                  </optgroup>
                  <optgroup label="KPI & ĐÁNH GIÁ">
                    <option value="KPI_PERFORMANCE">Bảng tiến độ chi tiết KPI</option>
                    <option value="KPI_STATUS_DIST">Phân bổ trạng thái KPI</option>
                    <option value="EVALUATION_HISTORY">Lịch sử điểm đánh giá</option>
                  </optgroup>
                  <optgroup label="THÔNG BÁO">
                    <option value="NOTIFICATION_LATEST">Danh sách thông báo mới nhất</option>
                    <option value="NOTIFICATION_STATS">Thống kê thông báo (Đọc/Chưa đọc)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Kiểu hiển thị</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 'PIE', icon: <PieChartIcon size={14}/>, label: 'Tròn', 
                      disabled: ['KPI_PERFORMANCE', 'NOTIFICATION_LATEST', 'KPI_SUMMARY'].includes(editingWidget.metric) 
                    },
                    { val: 'BAR', icon: <BarChartIcon size={14}/>, label: 'Cột',
                      disabled: ['KPI_PERFORMANCE', 'NOTIFICATION_LATEST', 'KPI_SUMMARY'].includes(editingWidget.metric)
                    },
                    { val: 'AREA', icon: <Activity size={14}/>, label: 'Vùng',
                      disabled: ['KPI_PERFORMANCE', 'NOTIFICATION_LATEST', 'KPI_SUMMARY', 'SUBMISSIONS_STATUS', 'KPI_STATUS_DIST', 'NOTIFICATION_STATS'].includes(editingWidget.metric)
                    },
                    { val: 'LINE', icon: <TrendingUp size={14}/>, label: 'Đường',
                      disabled: ['KPI_PERFORMANCE', 'NOTIFICATION_LATEST', 'KPI_SUMMARY', 'SUBMISSIONS_STATUS', 'KPI_STATUS_DIST', 'NOTIFICATION_STATS'].includes(editingWidget.metric)
                    },
                    { val: 'TABLE', icon: <Table2 size={14}/>, label: 'Bảng',
                      disabled: ['KPI_SUMMARY', 'SUBMISSIONS_STATUS', 'KPI_STATUS_DIST', 'NOTIFICATION_STATS'].includes(editingWidget.metric)
                    },
                    { val: 'NUMBER_CARD', icon: <Hash size={14}/>, label: 'Số',
                      disabled: !['KPI_SUMMARY'].includes(editingWidget.metric)
                    },
                    { val: 'TOP_STATS_GRID', icon: <Layout size={14}/>, label: 'Lưới', 
                      disabled: !['KPI_SUMMARY'].includes(editingWidget.metric)
                    },
                  ].map(t => {
                    const isSelected = editingWidget.type === t.val
                    return (
                      <button 
                        key={t.val} 
                        disabled={t.disabled}
                        onClick={() => {
                          const updates: any = { type: t.val as WidgetType }
                          // Auto-adjust dimensions based on type
                          if (t.val === 'TABLE' || t.val === 'TOP_STATS_GRID') { updates.w = 12; updates.h = 10 }
                          else if (t.val === 'PIE' || t.val === 'BAR' || t.val === 'AREA' || t.val === 'LINE') { updates.w = 6; updates.h = 8 }
                          else if (t.val === 'NUMBER_CARD') { updates.w = 3; updates.h = 4 }
                          setEditingWidget({...editingWidget, ...updates})
                        }} 
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all", 
                          isSelected ? "border-indigo-600 bg-indigo-50 text-indigo-600" : "border-slate-100 dark:border-slate-800 hover:border-slate-300",
                          t.disabled && "opacity-20 grayscale cursor-not-allowed border-transparent"
                        )}
                      >
                        {t.icon}
                        <span className="text-[9px] font-bold mt-1 text-center leading-tight">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setEditingWidget(null)} className="flex-1 py-3 font-bold text-sm text-slate-500">Huỷ</button>
              <button onClick={() => updateWidget(editingWidget.i, editingWidget)} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">Lưu thiết lập</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = { indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20', emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20', blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' }
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 p-5 hover:shadow-lg transition-all h-full flex flex-col justify-center">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", colors[color])}>{icon}</div>
      <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
    </div>
  )
}


