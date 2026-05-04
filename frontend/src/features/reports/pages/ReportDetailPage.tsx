import { useState, useMemo, useEffect, memo } from 'react'
import { debounce } from 'lodash-es'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Database, Trash2, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, AreaChart as AreaChartIcon, Hash, Table2, MoreVertical, Copy, Settings, ChevronDown, X } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import { useReport } from '../hooks/useReports'
import { useAddReportDatasource, useRemoveReportDatasource, useAddWidget, useUpdateWidget, useDeleteWidget } from '../hooks/useReportMutations'
import { useDatasources, useDatasourceDataQueries } from '@/features/datasources/hooks/useDatasources'
import { useUsers } from '@/features/users/hooks/useUsers'
import type { WidgetType, ReportWidget as ReportWidgetType, DsColumn } from '@/types/datasource'
import type { User } from '@/types/user'

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4']
const EMPTY_ARRAY: any[] = []
const DS_PARAMS = { page: 0, size: 100 }
const USER_PARAMS = { page: 0, size: 1000 }

const ResponsiveGridLayout = WidthProvider(Responsive)

const WIDGET_TYPES: { value: WidgetType; label: string; icon: React.ReactNode }[] = [
  { value: 'BAR', label: 'Biểu đồ cột', icon: <BarChart3 size={16} /> },
  { value: 'LINE', label: 'Biểu đồ đường', icon: <LineChartIcon size={16} /> },
  { value: 'PIE', label: 'Biểu đồ tròn', icon: <PieChartIcon size={16} /> },
  { value: 'DONUT', label: 'Biểu đồ bánh mì', icon: <PieChartIcon size={16} /> },
  { value: 'AREA', label: 'Biểu lộ vùng', icon: <AreaChartIcon size={16} /> },
  { value: 'NUMBER_CARD', label: 'Thẻ số', icon: <Hash size={16} /> },
  { value: 'TABLE', label: 'Bảng dữ liệu', icon: <Table2 size={16} /> },
]

type ChartConfig = {
  x_axis?: { column_id?: string; label?: string };
  y_axis?: { column_id?: string; label?: string };
  agg_type?: 'COUNT' | 'SUM';
  sort_by?: 'X' | 'Y' | 'NONE';
  sort_dir?: 'ASC' | 'DESC';
}

function processData(rawData: Record<string, unknown>[], config: ChartConfig, type: WidgetType, allColumns: DsColumn[], users: User[]) {
  if (!rawData || rawData.length === 0) return []

  const firstRow = rawData[0] || {}
  const xColId = config.x_axis?.column_id
  const xCol = allColumns.find(c => c.id === xColId)
  const xKey = config.x_axis?.label || Object.keys(firstRow)[0] || 'x'
  const yKey = config.y_axis?.label || Object.keys(firstRow)[1] || 'y'
  const aggType = config.agg_type || 'COUNT'
  
  if (type === 'TABLE') return rawData

  const resolveVal = (val: any, col?: DsColumn) => {
    if (val === null || val === undefined || val === '') return 'Chưa xác định'
    if (col?.dataType === 'USER') {
      const user = users.find(u => u.id === val)
      return user ? user.fullName : String(val)
    }
    if (col?.dataType === 'SELECT_ONE' || col?.dataType === 'SELECT_MULTI') {
      try {
        const conf = JSON.parse(col.config || '{}')
        const opt = conf.options?.find((o: any) => o.id === val)
        return opt ? opt.label : String(val)
      } catch {
        // ignore
      }
    }
    return String(val)
  }

  if (type === 'NUMBER_CARD') {
    const valKey = config.y_axis?.label || config.x_axis?.label || Object.keys(firstRow).find(k => typeof firstRow[k] === 'number') || Object.keys(firstRow)[0] || ''
    if (aggType === 'COUNT') {
      return [{ key: valKey, value: rawData.length }]
    } else {
      const total = rawData.reduce((sum, row) => sum + (Number(row[valKey]) || 0), 0)
      return [{ key: valKey, value: total }]
    }
  }

  // GROUP BY logic
  const grouped: Record<string, number> = {}
  rawData.forEach(row => {
    const xRawVal = row[xKey]
    
    let splitVals: any[] = []
    if (Array.isArray(xRawVal)) {
      splitVals = xRawVal
    } else if (typeof xRawVal === 'string' && xRawVal.includes(',')) {
      splitVals = xRawVal.split(',').map(s => s.trim()).filter(Boolean)
    } else if (typeof xRawVal === 'string' && xRawVal.startsWith('[') && xRawVal.endsWith(']')) {
      try {
        const parsed = JSON.parse(xRawVal)
        splitVals = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        splitVals = [xRawVal]
      }
    } else {
      splitVals = [xRawVal]
    }

    if (splitVals.length === 0) splitVals = [null]

    splitVals.forEach(v => {
      const xVal = resolveVal(v, xCol)
      
      if (!grouped[xVal]) grouped[xVal] = 0
      
      if (aggType === 'COUNT') {
        grouped[xVal] += 1
      } else {
        grouped[xVal] += Number(row[yKey]) || 0
      }
    })
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any[] = Object.entries(grouped).map(([x, py]) => ({ [xKey]: x, [yKey]: py }))

  // SORTING
  if (config.sort_by && config.sort_by !== 'NONE') {
    result.sort((a, b) => {
      const valA = config.sort_by === 'X' ? a[xKey] : a[yKey]
      const valB = config.sort_by === 'X' ? b[xKey] : b[yKey]
      
      const dir = config.sort_dir === 'DESC' ? -1 : 1
      if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * dir
      return String(valA).localeCompare(String(valB)) * dir
    })
  }

  return result
}

const ChartRenderer = memo(({ widget, rawData, allColumns, users }: { widget: ReportWidgetType; rawData: Record<string, unknown>[]; allColumns: DsColumn[]; users: User[] }) => {
  let config: ChartConfig = {}
  try { config = JSON.parse(widget.chartConfig) } catch { /* ignore */ }

  const data = useMemo(() => processData(rawData, config, widget.widgetType, allColumns, users), [rawData, config, widget.widgetType, allColumns, users])

  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--color-muted-foreground)]">Không có đủ dữ liệu để vẽ</div>
  }

  const keys = Object.keys(rawData[0] || {})
  const xKey = config.x_axis?.label || keys[0] || 'x'
  const yKey = config.y_axis?.label || keys[1] || 'y'

  switch (widget.widgetType) {
    case 'BAR':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey={yKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} name={config.agg_type === 'SUM' ? `Tổng ${yKey}` : `Số lượng`} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )
    case 'LINE':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey={yKey} stroke={COLORS[0]} strokeWidth={3} dot={{ r: 4 }} name={config.agg_type === 'SUM' ? `Tổng ${yKey}` : `Số lượng`} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )
    case 'PIE':
    case 'DONUT': {
      const total = data.reduce((s, d) => s + (Number(d[yKey]) || 0), 0)
      const isDonut = widget.widgetType === 'DONUT'
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={data} 
              dataKey={yKey} 
              nameKey={xKey} 
              cx="50%" 
              cy="50%" 
              outerRadius={70}
              innerRadius={isDonut ? 45 : 0}
              isAnimationActive={false}
              label={(props: any) => {
                 const { cx, cy, midAngle, outerRadius, name, value } = props;
                 const RADIAN = Math.PI / 180;
                 const radius = (outerRadius || 0) + 25;
                 const x = (cx || 0) + radius * Math.cos(-(midAngle || 0) * RADIAN);
                 const y = (cy || 0) + radius * Math.sin(-(midAngle || 0) * RADIAN);
                 const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                 
                 return (
                   <text 
                     x={x} 
                     y={y} 
                     fill="var(--color-muted-foreground)" 
                     textAnchor={x > (cx || 0) ? 'start' : 'end'} 
                     dominantBaseline="central"
                     fontSize={10}
                     fontWeight={500}
                   >
                     {`${name}: ${value.toLocaleString('vi-VN')} (${percent}%)`}
                   </text>
                 );
              }}
              labelLine={{ stroke: 'var(--color-muted-foreground)', strokeWidth: 1, opacity: 0.5 }}
            >
              {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0 && payload[0]) {
                  const val = Number(payload[0].value)
                  const percent = total > 0 ? ((val / total) * 100).toFixed(1) : 0
                  return (
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-3 shadow-xl text-xs">
                      <p className="font-bold mb-1">{payload[0].name}</p>
                      <p className="text-[var(--color-primary)] font-semibold">Giá trị: {val.toLocaleString('vi-VN')}</p>
                      <p className="text-[var(--color-muted-foreground)]">Tỷ lệ: {percent}%</p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', marginTop: '10px' }} />
          </PieChart>
        </ResponsiveContainer>
      )
    }
    case 'AREA':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Area type="monotone" dataKey={yKey} stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.2} name={config.agg_type === 'SUM' ? `Tổng ${yKey}` : `Số lượng`} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      )
    case 'NUMBER_CARD': {
      const cardData = data[0] || { value: 0, key: '' }
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <span className="text-5xl font-black text-[var(--color-primary)]">{(Number(cardData.value) || 0).toLocaleString('vi-VN')}</span>
          <span className="text-sm font-medium text-[var(--color-muted-foreground)] mt-2 uppercase tracking-wider">{String(cardData.key || '')} ({config.agg_type === 'SUM' ? 'Tổng' : 'Số lượng'})</span>
        </div>
      )
    }
    case 'TABLE':
      return (
        <div className="overflow-auto h-full">
          <table className="w-full text-xs">
            <thead>
              <tr>{keys.map(k => <th key={k} className="px-3 py-2 text-left font-semibold border-b border-[var(--color-border)] bg-[var(--color-accent)]/50">{k}</th>)}</tr>
            </thead>
            <tbody>
              {data.slice(0, 50).map((row, i) => (
                <tr key={i} className="hover:bg-[var(--color-accent)]/30">
                  {keys.map(k => <td key={k} className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-card)] max-w-[200px] truncate" title={String(row[k] ?? '')}>{String(row[k] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return <div className="flex items-center justify-center h-full text-sm text-[var(--color-muted-foreground)]">Widget type: {widget.widgetType}</div>
  }
}, (prev, next) => {
  return prev.widget.id === next.widget.id && 
         prev.widget.chartConfig === next.widget.chartConfig && 
         prev.widget.title === next.widget.title &&
         prev.widget.reportDatasourceId === next.widget.reportDatasourceId &&
         prev.rawData === next.rawData &&
         prev.allColumns === next.allColumns &&
         // Check user list length and first/last item as a heuristic if we can't do deep equal
         prev.users.length === next.users.length &&
         prev.users === next.users
})



export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: report, isLoading } = useReport(id!)
  const { data: datasourcesPage } = useDatasources(DS_PARAMS)
  const { data: usersPage } = useUsers(USER_PARAMS)
  const allUsers = useMemo(() => usersPage?.content || EMPTY_ARRAY, [usersPage?.content])

  const addDsMut = useAddReportDatasource()
  const removeDsMut = useRemoveReportDatasource()
  const addWidgetMut = useAddWidget()
  const updateWidgetMut = useUpdateWidget()
  const deleteWidgetMut = useDeleteWidget()

  const [showAddDs, setShowAddDs] = useState(false)
  const [selectedDsId, setSelectedDsId] = useState('')
  
  // Drawer state
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // Drawer form state
  const [drawerConfig, setDrawerConfig] = useState<{
    title: string;
    reportDatasourceId: string;
    chartConfig: ChartConfig;
  }>({
    title: '',
    reportDatasourceId: '',
    chartConfig: {}
  })

  // Load chart data for each linked datasource
  const linkedDatasourceIds = useMemo(() => report?.datasources?.map(d => d.datasourceId) || EMPTY_ARRAY, [report?.datasources])
  const datasourceDataQueries = useDatasourceDataQueries(linkedDatasourceIds)

  const allDatasources = datasourcesPage?.content || []
  const unlinkedDatasources = allDatasources.filter(
    ds => !report?.datasources?.some(rd => rd.datasourceId === ds.id)
  )

  const handleAddDatasource = () => {
    if (!id || !selectedDsId) return
    addDsMut.mutate({ reportId: id, data: { datasourceId: selectedDsId } }, {
      onSuccess: () => { setShowAddDs(false); setSelectedDsId('') }
    })
  }

  const handleAutoCreateWidget = (type: WidgetType) => {
    if (!id) return
    if (!report?.datasources || report.datasources.length === 0) {
      alert("Vui lòng kết nối Nguồn dữ liệu ở mục [Nguồn dữ liệu] trước!")
      return
    }

    const firstRd = report.datasources[0]
    if (!firstRd) return
    const config = JSON.stringify({ agg_type: 'COUNT', sort_by: 'NONE', sort_dir: 'DESC' })
    
    // Auto calculate next position for 3 columns (w=4)
    const widgetCount = report.widgets?.length || 0
    const x = (widgetCount % 3) * 4
    const y = Math.floor(widgetCount / 3) * 4
    const pos = JSON.stringify({ x, y, w: 4, h: 4 })

    addWidgetMut.mutate({
      reportId: id,
      data: { 
        reportDatasourceId: firstRd.id, 
        widgetType: type, 
        title: 'Biểu đồ', 
        chartConfig: config,
        position: pos
      }
    }, {
      onSuccess: (newWidget) => { 
        setDropdownOpen(false)
        if (newWidget) {
          openSettings(newWidget)
        }
      }
    })
  }

  const debouncedUpdateLayout = useMemo(
    () => debounce((currentLayout: any[]) => {
      currentLayout.forEach(item => {
        const widget = report?.widgets?.find(w => w.id === item.i)
        if (widget) {
          let pos = { x: 0, y: 0, w: 4, h: 4 }
          try { pos = JSON.parse(widget.position) } catch { /* ignore */ }
          
          if (pos.x !== item.x || pos.y !== item.y || pos.w !== item.w || pos.h !== item.h) {
            updateWidgetMut.mutate({
              widgetId: widget.id,
              data: {
                reportDatasourceId: widget.reportDatasourceId,
                widgetType: widget.widgetType,
                title: widget.title,
                chartConfig: widget.chartConfig,
                position: JSON.stringify({ x: item.x, y: item.y, w: item.w, h: item.h })
              }
            })
          }
        }
      })
    }, 1000), // Slightly longer debounce to ensure dragging finishes
    [report?.widgets, updateWidgetMut]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateLayout.cancel()
    }
  }, [debouncedUpdateLayout])

  const handleLayoutChange = (currentLayout: any[]) => {
    debouncedUpdateLayout(currentLayout)
  }

  const handleDuplicateWidget = (widget: ReportWidgetType) => {
    addWidgetMut.mutate({
      reportId: id!,
      data: { reportDatasourceId: widget.reportDatasourceId, widgetType: widget.widgetType, title: `${widget.title} (Copy)`, chartConfig: widget.chartConfig }
    })
    setMenuOpenId(null)
  }

  const openSettings = (widget: ReportWidgetType) => {
    let cfg: ChartConfig = {}
    try { cfg = JSON.parse(widget.chartConfig) } catch { /* ignore */ }
    setDrawerConfig({
      title: widget.title,
      reportDatasourceId: widget.reportDatasourceId,
      chartConfig: cfg
    })
    setActiveWidgetId(widget.id)
    setMenuOpenId(null)
  }

  const handleSaveSettings = () => {
    if (!activeWidgetId) return
    const widget = report?.widgets?.find(w => w.id === activeWidgetId)
    if (!widget) return
    
    updateWidgetMut.mutate({
      widgetId: activeWidgetId,
      data: {
        reportDatasourceId: drawerConfig.reportDatasourceId,
        widgetType: widget.widgetType,
        title: drawerConfig.title,
        chartConfig: JSON.stringify(drawerConfig.chartConfig)
      }
    }, {
      onSuccess: () => { setActiveWidgetId(null) }
    })
  }

  // Build data map: reportDatasourceId -> data array
  const dataMap = useMemo(() => {
    const map: Record<string, Record<string, unknown>[]> = {}
    report?.datasources?.forEach((rd, idx) => {
      const query = datasourceDataQueries[idx]
      if (query?.data) {
        map[rd.id] = query.data
      }
    })
    return map
  }, [report?.datasources, datasourceDataQueries])

  // All columns for all widgets mapping (to resolve names)
  const columnMap = useMemo(() => {
    const map: Record<string, DsColumn[]> = {}
    report?.datasources?.forEach(rd => {
      const fullDs = allDatasources.find(ds => ds.id === rd.datasourceId)
      if (fullDs) map[rd.id] = fullDs.columns || []
    })
    return map
  }, [report?.datasources, allDatasources])

  // Selected DS columns for the Drawer
  const activeWidgetObject = useMemo(() => report?.widgets?.find(w => w.id === activeWidgetId), [report?.widgets, activeWidgetId])
  const drawerRds = useMemo(() => report?.datasources?.find(rd => rd.id === drawerConfig.reportDatasourceId), [report?.datasources, drawerConfig.reportDatasourceId])
  const drawerFullDs = useMemo(() => allDatasources.find(ds => ds.id === drawerRds?.datasourceId), [allDatasources, drawerRds])
  const drawerColumns = useMemo(() => drawerFullDs?.columns || [], [drawerFullDs])

  // Memoize grid layout to prevent RGL from re-calculating on every frame
  const memoizedLayout = useMemo(() => {
    if (!report?.widgets) return []
    return report.widgets.map((w, idx) => {
      let p = { x: (idx % 3) * 4, y: Math.floor(idx / 3) * 4, w: 4, h: 4 }
      try { if (w.position) p = JSON.parse(w.position) } catch { /* ignore */ }
      return { i: w.id, ...p }
    })
  }, [report?.widgets])

  const layoutsObj = useMemo(() => ({ lg: memoizedLayout }), [memoizedLayout])

  if (isLoading) {
    return <div className="space-y-4">
      <div className="h-8 w-64 bg-[var(--color-accent)] rounded animate-pulse" />
      <div className="h-96 bg-[var(--color-accent)] rounded-xl animate-pulse" />
    </div>
  }

  if (!report) {
    return <div className="text-center py-16 text-[var(--color-muted-foreground)]">Không tìm thấy báo cáo</div>
  }


  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-background)]">
      {/* Header & Lark Toolbar (Fixed at top) */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-card)] z-10">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-[var(--color-accent)] transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold">{report.name}</h1>
              {report.description && <p className="text-sm text-[var(--color-muted-foreground)]">{report.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddDs(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-accent)] transition-colors font-medium">
              <Database size={16} /> Nguồn dữ liệu
            </button>
            
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-all font-medium"
              >
                <Plus size={16} /> Thêm biểu đồ <ChevronDown size={14} className="ml-1 opacity-70" />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]">Thư viện khối (Blocks)</div>
                    {WIDGET_TYPES.map(wt => (
                      <button
                        key={wt.value}
                        onClick={() => handleAutoCreateWidget(wt.value)}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[var(--color-accent)] text-sm transition-colors text-left"
                      >
                        <div className="p-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-md">
                          {wt.icon}
                        </div>
                        <span className="font-medium">{wt.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Body (Split Content + Drawer) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto space-y-6">
            {report.datasources && report.datasources.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[var(--color-muted-foreground)] mr-2">🔗 Đã liên kết:</span>
                {report.datasources.map(rd => (
                  <span key={rd.id} className="flex items-center gap-1.5 px-3 py-1 bg-[var(--color-accent)] border border-[var(--color-border)] rounded-full text-xs font-medium">
                    <Database size={12} className="text-[var(--color-primary)] opacity-70" />
                    {rd.alias || rd.datasourceName}
                    <button onClick={() => removeDsMut.mutate(rd.id)} className="ml-1 opacity-50 hover:opacity-100 hover:text-red-500 transition-all">×</button>
                  </span>
                ))}
              </div>
            )}

            {report.widgets && report.widgets.length > 0 ? (
              <ResponsiveGridLayout
                className="layout"
                layouts={layoutsObj}
                breakpoints={{ lg: 0 }}
                cols={{ lg: 12 }} 
                rowHeight={100}
                onLayoutChange={(currentLayout: any, allLayouts: any) => {
                  if (allLayouts && allLayouts.lg) {
                    handleLayoutChange(allLayouts.lg)
                  } else {
                    handleLayoutChange(currentLayout)
                  }
                }}
                draggableHandle=".drag-handle"
                margin={[16, 16]}
              >
                {report.widgets.map(widget => (
                  <div key={widget.id} className={`group bg-[var(--color-card)] border rounded-xl overflow-visible hover:shadow-lg transition-shadow duration-200 relative ${activeWidgetId === widget.id ? 'ring-2 ring-[var(--color-primary)] border-transparent shadow-xl' : 'border-[var(--color-border)]'}`}>
                    <div className="drag-handle flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-background)]/50 rounded-t-xl cursor-move">
                      <div className="flex items-center gap-2 min-w-0">
                        {WIDGET_TYPES.find(w => w.value === widget.widgetType)?.icon}
                        <h3 className="font-bold text-sm truncate">{widget.title}</h3>
                      </div>
                      
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === widget.id ? null : widget.id) }} className="p-1.5 rounded-md hover:bg-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical size={16} />
                        </button>
                        {menuOpenId === widget.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)}></div>
                            <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 z-50 overflow-hidden">
                              <button onClick={() => openSettings(widget)} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--color-accent)] text-left"><Settings size={14} /> Cài đặt</button>
                              <button onClick={() => handleDuplicateWidget(widget)} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--color-accent)] text-left"><Copy size={14} /> Nhân bản</button>
                              <hr className="my-1 border-[var(--color-border)]" />
                              <button onClick={() => { deleteWidgetMut.mutate(widget.id); setMenuOpenId(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/10 text-red-500 text-left"><Trash2 size={14} /> Xóa block</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="h-[calc(100%-80px)] p-4 overflow-hidden">
                      <ChartRenderer widget={widget} rawData={dataMap[widget.reportDatasourceId] || EMPTY_ARRAY} allColumns={columnMap[widget.reportDatasourceId] || EMPTY_ARRAY} users={allUsers} />
                    </div>
                    <div className="px-4 py-2 border-t border-[var(--color-border)] text-[9px] uppercase font-bold text-[var(--color-muted-foreground)] tracking-wider flex items-center justify-between bg-[var(--color-background)]/30 rounded-b-xl h-10">
                      <span className="truncate mr-2">Dữ liệu: {widget.datasourceName}</span>
                      <span className="shrink-0">{widget.widgetType}</span>
                    </div>
                  </div>
                ))}
              </ResponsiveGridLayout>
            ) : (
              <div className="text-center py-20 bg-transparent border-2 border-dashed border-[var(--color-border)] rounded-2xl">
                <div className="w-16 h-16 bg-[var(--color-accent)] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[var(--color-muted-foreground)]">
                  <BarChart3 size={32} />
                </div>
                <p className="text-lg font-bold">Chưa có Block dữ liệu nào</p>
                <p className="text-sm text-[var(--color-muted-foreground)] mt-2 mb-6 max-w-sm mx-auto">Sử dụng thanh công cụ bên trên để thêm biểu đồ hoặc bảng thông kê vào báo cáo của bạn ngay lập tức.</p>
                <button onClick={() => setDropdownOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl hover:opacity-90 font-medium shadow-sm">
                  <Plus size={18} /> Thêm Block đầu tiên
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Persistent Drawer (Push layout) */}
        <div className={`shrink-0 overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-card)] h-full ${activeWidgetId ? 'w-96 shadow-2xl' : 'hidden'}`}>
          <div className="w-96 flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h2 className="font-bold text-base flex items-center gap-2"><Settings size={18} className="text-[var(--color-primary)]" /> Cài đặt Block</h2>
              <button onClick={() => setActiveWidgetId(null)} className="p-1.5 rounded-lg hover:bg-[var(--color-accent)] transition-colors"><X size={18} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Basic config */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] flex items-center gap-1.5"><MoreVertical size={14} className="-ml-1"/> Cơ bản</h3>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Tiêu đề Block</label>
                  <input value={drawerConfig.title} onChange={e => setDrawerConfig({...drawerConfig, title: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-background)] focus:ring-2 focus:ring-[var(--color-primary)]/30 outline-none" placeholder="VD: Doanh thu theo tháng" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Nguồn dữ liệu tham chiếu</label>
                  <select value={drawerConfig.reportDatasourceId} onChange={e => setDrawerConfig({...drawerConfig, reportDatasourceId: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-background)] focus:ring-2 focus:ring-[var(--color-primary)]/30 outline-none">
                    {report.datasources?.map(rd => <option key={rd.id} value={rd.id}>{rd.alias || rd.datasourceName}</option>)}
                  </select>
                </div>
              </div>

              {/* Data Config */}
              <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
                 <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] flex items-center gap-1.5"><MoreVertical size={14} className="-ml-1"/> Tham số đồ thị</h3>
                 
                 {drawerColumns.length > 0 && activeWidgetObject?.widgetType !== 'NUMBER_CARD' && activeWidgetObject?.widgetType !== 'TABLE' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-[var(--color-accent)]/30 rounded-xl border border-[var(--color-border)]">
                        <label className="block text-xs font-bold mb-2">
                          {activeWidgetObject?.widgetType === 'PIE' || activeWidgetObject?.widgetType === 'DONUT' ? 'Mỗi phần là gì?' : 'Trục X (Danh mục gom nhóm)'}
                        </label>
                        <select 
                          value={drawerConfig.chartConfig.x_axis?.column_id || ''} 
                          onChange={e => {
                            const cId = e.target.value;
                            const cName = drawerColumns.find(c => c.id === cId)?.name || '';
                            setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, x_axis: { column_id: cId, label: cName }}}))
                          }} 
                          className="w-full px-2 py-1.5 rounded-md border border-[var(--color-border)] text-sm bg-[var(--color-background)] outline-none"
                        >
                          <option value="">-- Mặc định --</option>
                          {drawerColumns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      <div className="p-3 bg-[var(--color-accent)]/30 rounded-xl border border-[var(--color-border)]">
                        <label className="block text-xs font-bold mb-2">
                          {activeWidgetObject?.widgetType === 'PIE' || activeWidgetObject?.widgetType === 'DONUT' ? 'Kích thước mỗi phần dựa trên gì?' : 'Trục Y (Đại lượng đo lường)'}
                        </label>
                        <select 
                          value={drawerConfig.chartConfig.y_axis?.column_id || ''} 
                          onChange={e => {
                            const cId = e.target.value;
                            const cName = drawerColumns.find(c => c.id === cId)?.name || '';
                            setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, y_axis: { column_id: cId, label: cName }}}))
                          }} 
                          className="w-full px-2 py-1.5 mb-3 rounded-md border border-[var(--color-border)] text-sm bg-[var(--color-background)] outline-none"
                        >
                          <option value="">-- Mặc định --</option>
                          {drawerColumns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>

                        <label className="block text-xs font-bold mb-2 text-[var(--color-muted-foreground)]">Phương pháp tính</label>
                        <select 
                          value={drawerConfig.chartConfig.agg_type || 'COUNT'} 
                          onChange={e => setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, agg_type: e.target.value as 'SUM' | 'COUNT' }}))} 
                          className="w-full px-2 py-1.5 rounded-md border border-[var(--color-border)] text-sm bg-[var(--color-background)] outline-none"
                        >
                          <option value="COUNT">Số lượng bản ghi (COUNT)</option>
                          {drawerColumns.find(c => c.id === drawerConfig.chartConfig.y_axis?.column_id)?.dataType === 'NUMBER' && (
                            <option value="SUM">Tổng giá trị (SUM)</option>
                          )}
                        </select>
                      </div>
                    </div>
                 )}

                 {drawerColumns.length > 0 && activeWidgetObject?.widgetType === 'NUMBER_CARD' && (
                    <div className="p-3 bg-[var(--color-accent)]/30 rounded-xl border border-[var(--color-border)] space-y-3">
                      <div>
                        <label className="block text-xs font-bold mb-2">Trường chỉ số</label>
                        <select 
                          value={drawerConfig.chartConfig.y_axis?.column_id || ''} 
                          onChange={e => {
                            const cId = e.target.value;
                            const cName = drawerColumns.find(c => c.id === cId)?.name || '';
                            setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, y_axis: { column_id: cId, label: cName }}}))
                          }} 
                          className="w-full px-2 py-1.5 rounded-md border border-[var(--color-border)] text-sm bg-[var(--color-background)] outline-none"
                        >
                          <option value="">-- Mặc định --</option>
                          {drawerColumns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-2 text-[var(--color-muted-foreground)]">Phương pháp</label>
                        <select 
                          value={drawerConfig.chartConfig.agg_type || 'COUNT'} 
                          onChange={e => setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, agg_type: e.target.value as 'SUM' | 'COUNT' }}))} 
                          className="w-full px-2 py-1.5 rounded-md border border-[var(--color-border)] text-sm bg-[var(--color-background)] outline-none"
                        >
                          <option value="COUNT">Đếm tổng số bản ghi</option>
                          <option value="SUM">Tổng cộng trường chỉ số</option>
                        </select>
                      </div>
                    </div>
                 )}
              </div>

              {/* Sorting */}
              {activeWidgetObject?.widgetType !== 'TABLE' && activeWidgetObject?.widgetType !== 'NUMBER_CARD' && (
                 <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
                   <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] flex items-center gap-1.5"><MoreVertical size={14} className="-ml-1"/> Sắp xếp (Sort)</h3>
                   <div className="flex gap-2">
                     <select 
                        value={drawerConfig.chartConfig.sort_by || 'NONE'} 
                        onChange={e => setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, sort_by: e.target.value as any }}))} 
                        className="flex-1 px-2 py-1.5 rounded-md border border-[var(--color-border)] text-sm bg-[var(--color-background)] outline-none"
                      >
                        <option value="NONE">Mặc định</option>
                        <option value="X">Sắp xếp theo Trục X</option>
                        <option value="Y">Sắp xếp theo Trục Y</option>
                      </select>
                      {drawerConfig.chartConfig.sort_by && drawerConfig.chartConfig.sort_by !== 'NONE' && (
                        <select 
                          value={drawerConfig.chartConfig.sort_dir || 'ASC'} 
                          onChange={e => setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, sort_dir: e.target.value as any }}))} 
                          className="w-24 px-2 py-1.5 rounded-md border border-[var(--color-border)] text-sm bg-[var(--color-background)] outline-none"
                        >
                          <option value="ASC">Tăng</option>
                          <option value="DESC">Giảm</option>
                        </select>
                      )}
                   </div>
                 </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-accent)]/10 flex justify-end gap-3">
               <button onClick={() => setActiveWidgetId(null)} className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-[var(--color-accent)]">Hủy</button>
               <button onClick={handleSaveSettings} disabled={updateWidgetMut.isPending} className="px-6 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 font-semibold shadow-sm">
                 {updateWidgetMut.isPending ? 'Đang lưu...' : 'Lưu lại'}
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Datasource Modal */}
      {showAddDs && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddDs(false)}>
          <div className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 border border-[var(--color-border)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Kết nối Nguồn dữ liệu</h2>
            {unlinkedDatasources.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)] py-4">Tất cả datasource đã được kết nối hoặc chưa có datasource nào.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {unlinkedDatasources.map(ds => (
                  <button
                    key={ds.id}
                    onClick={() => setSelectedDsId(ds.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-sm transition-all ${
                      selectedDsId === ds.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-accent)]/50'
                    }`}
                  >
                    <Database size={18} className="text-[var(--color-primary)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{ds.name}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{ds.columns?.length || 0} cột · {ds.rowCount} hàng dữ liệu</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddDs(false)} className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-[var(--color-accent)]">Hủy</button>
              <button onClick={handleAddDatasource} disabled={!selectedDsId || addDsMut.isPending} className="px-5 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 font-semibold shadow-sm">Kết nối nguồn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
