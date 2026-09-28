import { intlLocale } from '@/i18n/format'
import { useState, useMemo, useEffect, memo } from 'react'
import { debounce } from 'lodash-es'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Database, Trash2, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, AreaChart as AreaChartIcon, Hash, Table2, MoreVertical, Copy, Settings, ChevronDown, X } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import EmptyState from '@/components/common/EmptyState'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'

/** Radix không nhận value rỗng nên "mặc định" dùng giá trị canh gác rồi đổi về '' khi lưu. */
const NONE = '__none__'
const MENU_ITEM = 'flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { xAxisLabel, yAxisLabel } from '@/components/charts/axisLabel'
import { SeriesTooltip } from '@/components/charts/ChartTooltip'
import { useReport } from '../hooks/useReports'
import { useAddReportDatasource, useRemoveReportDatasource, useAddWidget, useUpdateWidget, useDeleteWidget } from '../hooks/useReportMutations'
import { useDatasources, useDatasourceDataQueries } from '@/features/datasources/hooks/useDatasources'
import { useUsers } from '@/features/users/hooks/useUsers'
import type { WidgetType, ReportWidget as ReportWidgetType, DsColumn } from '@/types/datasource'
import type { User } from '@/types/user'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4']
const EMPTY_ARRAY: any[] = []
const DS_PARAMS = { page: 0, size: 100 }
const USER_PARAMS = { page: 0, size: 1000 }

const ResponsiveGridLayout = WidthProvider(Responsive)

const WIDGET_TYPES = perLanguage((): { value: WidgetType; label: string; icon: React.ReactNode }[] => ([
  { value: 'BAR', label: i18n.t('reports:ReportDetailPage.barChart'), icon: <BarChart3 size={16} /> },
  { value: 'LINE', label: i18n.t('reports:ReportDetailPage.lineChart'), icon: <LineChartIcon size={16} /> },
  { value: 'PIE', label: i18n.t('reports:ReportDetailPage.pieChart'), icon: <PieChartIcon size={16} /> },
  { value: 'DONUT', label: i18n.t('reports:ReportDetailPage.donutChart'), icon: <PieChartIcon size={16} /> },
  { value: 'AREA', label: i18n.t('reports:ReportDetailPage.areaChart'), icon: <AreaChartIcon size={16} /> },
  { value: 'NUMBER_CARD', label: i18n.t('reports:ReportDetailPage.numberCard'), icon: <Hash size={16} /> },
  { value: 'TABLE', label: i18n.t('reports:ReportDetailPage.dataTable'), icon: <Table2 size={16} /> },
]))

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
    if (val === null || val === undefined || val === '') return i18n.t('reports:ReportDetailPage.undefined')
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
  const result: any[] = Object.entries(grouped).map(([x, py]) => ({ [xKey]: x, [yKey]: py }))

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
  const { t } = useTranslation('reports')
  let config: ChartConfig = {}
  try { config = JSON.parse(widget.chartConfig) } catch { /* ignore */ }

  const data = useMemo(() => processData(rawData, config, widget.widgetType, allColumns, users), [rawData, config, widget.widgetType, allColumns, users])

  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--color-muted-foreground)]">{t('ReportDetailPage.notEnoughDataToDraw')}</div>
  }

  const keys = Object.keys(rawData[0] || {})
  const xKey = config.x_axis?.label || keys[0] || 'x'
  const yKey = config.y_axis?.label || keys[1] || 'y'
  // Trục ở đây do NGƯỜI DÙNG chọn lúc chạy, nên nhãn trục chính là tên cột/phép gộp họ đã chọn —
  // không có nhãn cố định nào đúng hơn thế.
  const seriesName = config.agg_type === 'SUM' ? t('ReportDetailPage.total', { yKey }) : t('ReportDetailPage.quantity')

  switch (widget.widgetType) {
    case 'BAR':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 30, left: 14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={xKey} label={xAxisLabel(xKey)} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis label={yAxisLabel(seriesName)} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <Tooltip content={<SeriesTooltip />} />
            <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingBottom: 8 }} />
            <Bar dataKey={yKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} name={seriesName} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )
    case 'LINE':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 30, left: 14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={xKey} label={xAxisLabel(xKey)} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis label={yAxisLabel(seriesName)} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <Tooltip content={<SeriesTooltip />} />
            <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingBottom: 8 }} />
            <Line type="monotone" dataKey={yKey} stroke={COLORS[0]} strokeWidth={3} dot={{ r: 4 }} name={seriesName} isAnimationActive={false} />
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
                     {`${name}: ${value.toLocaleString(intlLocale())} (${percent}%)`}
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
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-control p-3 text-xs">
                      <p className="font-semibold mb-1">{payload[0].name}</p>
                      <p className="text-[var(--color-primary)] font-semibold">{t('ReportDetailPage.value')} {val.toLocaleString(intlLocale())}</p>
                      <p className="text-[var(--color-muted-foreground)]">{t('ReportDetailPage.share')} {percent}%</p>
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
          <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 30, left: 14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={xKey} label={xAxisLabel(xKey)} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis label={yAxisLabel(seriesName)} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <Tooltip content={<SeriesTooltip />} />
            <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingBottom: 8 }} />
            <Area type="monotone" dataKey={yKey} stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.2} name={seriesName} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      )
    case 'NUMBER_CARD': {
      const cardData = data[0] || { value: 0, key: '' }
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <span className="text-5xl font-semibold text-[var(--color-primary)]">{(Number(cardData.value) || 0).toLocaleString(intlLocale())}</span>
          <span className="text-sm font-medium text-[var(--color-muted-foreground)] mt-2">{String(cardData.key || '')} ({config.agg_type === 'SUM' ? t('ReportDetailPage.total2') : t('ReportDetailPage.quantity')})</span>
        </div>
      )
    }
    case 'TABLE':
      return (
        <div className="overflow-auto h-full">
          <table className="w-full text-xs">
            <thead>
              <tr>{keys.map(k => <th key={k} className="px-3 py-2 text-left font-medium border-b border-[var(--color-border)] bg-[var(--color-accent)]/50">{k}</th>)}</tr>
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
  const { t } = useTranslation('reports')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: report, isLoading } = useReport(id!)
  const { data: datasourcesPage } = useDatasources(DS_PARAMS)
  const { data: usersPage } = useUsers(USER_PARAMS)
  const allUsers = useMemo(() => usersPage?.content || EMPTY_ARRAY, [usersPage?.content])
  const isDesktop = useMediaQuery('(min-width: 1024px)')

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
  const [deleteWidgetId, setDeleteWidgetId] = useState<string | null>(null)
  const [removeDsId, setRemoveDsId] = useState<string | null>(null)

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
      alert(t('ReportDetailPage.pleaseConnectADataSourceIn'))
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
        title: t('ReportDetailPage.chart'),
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

  // Mobile/tablet view-only order: top-to-bottom, left-to-right per the saved desktop layout
  const stackedWidgets = useMemo(() => {
    if (!report?.widgets) return []
    const posById = new Map(memoizedLayout.map(p => [p.i, p]))
    return [...report.widgets].sort((a, b) => {
      const pa = posById.get(a.id) ?? { y: 0, x: 0 }
      const pb = posById.get(b.id) ?? { y: 0, x: 0 }
      return pa.y - pb.y || pa.x - pb.x
    })
  }, [report?.widgets, memoizedLayout])

  if (isLoading) {
    return <div className="space-y-4">
      <div className="h-8 w-64 bg-[var(--color-accent)] rounded animate-pulse" />
      <div className="h-96 bg-[var(--color-accent)] rounded-card animate-pulse" />
    </div>
  }

  /** Menu "…" của một khối: Cài đặt · Nhân bản · Xoá (xoá qua hộp xác nhận). */
  const WidgetMenu = ({ widget }: { widget: ReportWidgetType }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('ReportDetailPage.actions')} title={t('ReportDetailPage.actions')}><MoreVertical aria-hidden="true" /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <button type="button" onClick={() => openSettings(widget)} className={MENU_ITEM}><Settings aria-hidden="true" /> {t('ReportDetailPage.settings')}</button>
        <button type="button" onClick={() => handleDuplicateWidget(widget)} className={MENU_ITEM}><Copy aria-hidden="true" /> {t('ReportDetailPage.duplicate')}</button>
        <div className="my-1 h-px bg-[var(--color-border)]" role="separator" />
        <button type="button" onClick={() => setDeleteWidgetId(widget.id)} className={`${MENU_ITEM} text-[var(--color-error)] hover:bg-[var(--color-error-bg)] [&_svg]:text-[var(--color-error)]`}><Trash2 aria-hidden="true" /> {t('ReportDetailPage.deleteChart')}</button>
      </PopoverContent>
    </Popover>
  )

  if (!report) {
    return (
      <div className="mx-auto max-w-[1600px] rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState
          icon={BarChart3}
          title={t('ReportDetailPage.noReportFound')}
          description={t('ReportDetailPage.thisReportMayHaveBeenDeleted')}
          action={<Button variant="outline" onClick={() => navigate('/reports')}><ArrowLeft aria-hidden="true" /> {t('ReportDetailPage.backToList')}</Button>}
        />
      </div>
    )
  }


  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-background)]">
      {/* Header: quay lại + tên + hai nút; thư viện khối là popover thay cho dropdown tự vẽ */}
      <div className="z-10 border-b border-[var(--color-border)] bg-[var(--color-card)] px-6 py-3">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/reports')} aria-label={t('ReportDetailPage.back')} className="shrink-0"><ArrowLeft aria-hidden="true" /></Button>
            <div className="min-w-0">
              <h1 className="text-page-title truncate">{report.name}</h1>
              <p className="truncate text-sm text-[var(--color-muted-foreground)]">
                {report.description || t('ReportDetailPage.noDescription')} · <span className="tabular-nums">{report.widgets?.length ?? 0} {t('ReportDetailPage.charts')}</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => setShowAddDs(true)}><Database aria-hidden="true" /> {t('ReportDetailPage.dataSources')}</Button>
            <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <PopoverTrigger asChild>
                <Button><Plus aria-hidden="true" /> {t('ReportDetailPage.addChart')} <ChevronDown aria-hidden="true" className="opacity-70" /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1">
                <p className="px-2.5 pb-1 pt-1.5 text-eyebrow">{t('ReportDetailPage.blockLibrary')}</p>
                {WIDGET_TYPES().map(wt => (
                  <button key={wt.value} type="button" onClick={() => { handleAutoCreateWidget(wt.value); setDropdownOpen(false) }} className={MENU_ITEM}>
                    {wt.icon}
                    <span>{wt.label}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Main Body (Split Content + Drawer) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto space-y-6">
            {report.datasources && report.datasources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-caption">{t('ReportDetailPage.connectedSources')}</span>
                {report.datasources.map(rd => (
                  <Badge key={rd.id} variant="outline" className="gap-1.5 pr-1">
                    <Database size={12} aria-hidden="true" />
                    {rd.alias || rd.datasourceName}
                    <button type="button" onClick={() => setRemoveDsId(rd.id)} aria-label={t('ReportDetailPage.remove', { value: rd.alias || rd.datasourceName })} className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[var(--color-muted-foreground)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]">
                      <X size={11} aria-hidden="true" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {report.widgets && report.widgets.length > 0 ? (
              isDesktop ? (
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
                    <div key={widget.id} className={`group relative overflow-visible rounded-widget border bg-[var(--color-card)] transition-colors ${activeWidgetId === widget.id ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-ring)]' : 'border-[var(--color-border)]'}`}>
                      <div className="drag-handle flex cursor-move items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2 text-[var(--color-muted-foreground)] [&_svg]:size-4">
                          {WIDGET_TYPES().find(w => w.value === widget.widgetType)?.icon}
                          <h3 className="truncate text-section-title">{widget.title}</h3>
                        </div>
                        <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                          <WidgetMenu widget={widget} />
                        </div>
                      </div>
                      <div className="h-[calc(100%-80px)] p-4 overflow-hidden">
                        <ChartRenderer widget={widget} rawData={dataMap[widget.reportDatasourceId] || EMPTY_ARRAY} allColumns={columnMap[widget.reportDatasourceId] || EMPTY_ARRAY} users={allUsers} />
                      </div>
                      <div className="flex h-10 items-center justify-between border-t border-[var(--color-border)] px-4 text-caption">
                        <span className="mr-2 truncate">{t('ReportDetailPage.data')} {widget.datasourceName}</span>
                        <span className="shrink-0">{WIDGET_TYPES().find(w => w.value === widget.widgetType)?.label ?? widget.widgetType}</span>
                      </div>
                    </div>
                  ))}
                </ResponsiveGridLayout>
              ) : (
                <div className="flex flex-col gap-4">
                  {stackedWidgets.map(widget => (
                    <div key={widget.id} className="overflow-hidden rounded-widget border border-[var(--color-border)] bg-[var(--color-card)]">
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2 text-[var(--color-muted-foreground)] [&_svg]:size-4">
                          {WIDGET_TYPES().find(w => w.value === widget.widgetType)?.icon}
                          <h3 className="truncate text-section-title">{widget.title}</h3>
                        </div>
                        <WidgetMenu widget={widget} />
                      </div>
                      <div className="h-[320px] p-4 overflow-hidden">
                        <ChartRenderer widget={widget} rawData={dataMap[widget.reportDatasourceId] || EMPTY_ARRAY} allColumns={columnMap[widget.reportDatasourceId] || EMPTY_ARRAY} users={allUsers} />
                      </div>
                      <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-2 text-caption">
                        <span className="mr-2 truncate">{t('ReportDetailPage.data')} {widget.datasourceName}</span>
                        <span className="shrink-0">{WIDGET_TYPES().find(w => w.value === widget.widgetType)?.label ?? widget.widgetType}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
                <EmptyState
                  icon={BarChart3}
                  title={t('ReportDetailPage.noChartsYet')}
                  description={report.datasources?.length ? t('ReportDetailPage.clickAddChartToChooseA') : t('ReportDetailPage.connectADataSourceFirstThen')}
                  action={report.datasources?.length
                    ? <Button onClick={() => setDropdownOpen(true)}><Plus aria-hidden="true" /> {t('ReportDetailPage.addTheFirstChart')}</Button>
                    : <Button onClick={() => setShowAddDs(true)}><Database aria-hidden="true" /> {t('ReportDetailPage.connectADataSource')}</Button>}
                />
              </div>
            )}
          </div>
        </div>

        {/* Persistent Drawer (Push layout) */}
        <div className={`shrink-0 overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-card)] h-full ${activeWidgetId ? 'w-96' : 'hidden'}`}>
          <div className="w-96 flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-section-title">{t('ReportDetailPage.chartSettings')}</h2>
                <p className="truncate text-caption">{activeWidgetObject?.title}</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setActiveWidgetId(null)} aria-label={t('ReportDetailPage.close')}><X aria-hidden="true" /></Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Basic config */}
              <div className="space-y-4">
                <h3 className="text-eyebrow">{t('ReportDetailPage.basic')}</h3>
                <div>
                  <label className="text-label block mb-1.5">{t('ReportDetailPage.title')}</label>
                  <input value={drawerConfig.title} onChange={e => setDrawerConfig({...drawerConfig, title: e.target.value})} className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]" placeholder={t('ReportDetailPage.eGRevenueByMonth')} />
                </div>
                <div>
                  <label className="text-label block mb-1.5">{t('ReportDetailPage.referencedDataSource')}</label>
                  <Select value={drawerConfig.reportDatasourceId} onValueChange={v => setDrawerConfig({...drawerConfig, reportDatasourceId: v})}>
                    <SelectTrigger className="w-full" aria-label={t('ReportDetailPage.dataSources')}><SelectValue placeholder={t('ReportDetailPage.chooseSource')} /></SelectTrigger>
                    <SelectContent>
                      {report.datasources?.map(rd => <SelectItem key={rd.id} value={rd.id}>{rd.alias || rd.datasourceName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Data Config */}
              <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
                 <h3 className="text-eyebrow">{t('ReportDetailPage.chartParameters')}</h3>

                 {drawerColumns.length > 0 && activeWidgetObject?.widgetType !== 'NUMBER_CARD' && activeWidgetObject?.widgetType !== 'TABLE' && (
                    <div className="space-y-4">
                      <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
                        <label className="text-label block mb-2">
                          {activeWidgetObject?.widgetType === 'PIE' || activeWidgetObject?.widgetType === 'DONUT' ? t('ReportDetailPage.whatIsEachSlice') : t('ReportDetailPage.xAxisGroupingCategory')}
                        </label>
                        <Select
                          value={drawerConfig.chartConfig.x_axis?.column_id || NONE}
                          onValueChange={v => {
                            const cId = v === NONE ? '' : v;
                            const cName = drawerColumns.find(c => c.id === cId)?.name || '';
                            setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, x_axis: { column_id: cId, label: cName }}}))
                          }}
                        >
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t('ReportDetailPage.default')}</SelectItem>
                            {drawerColumns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
                        <label className="text-label block mb-2">
                          {activeWidgetObject?.widgetType === 'PIE' || activeWidgetObject?.widgetType === 'DONUT' ? t('ReportDetailPage.whatIsEachSlicesSizeBased') : t('ReportDetailPage.yAxisMeasure')}
                        </label>
                        <Select
                          value={drawerConfig.chartConfig.y_axis?.column_id || NONE}
                          onValueChange={v => {
                            const cId = v === NONE ? '' : v;
                            const cName = drawerColumns.find(c => c.id === cId)?.name || '';
                            setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, y_axis: { column_id: cId, label: cName }}}))
                          }}
                        >
                          <SelectTrigger className="w-full mb-3"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t('ReportDetailPage.default')}</SelectItem>
                            {drawerColumns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <label className="text-label block mb-2 text-[var(--color-muted-foreground)]">{t('ReportDetailPage.calculationMethod')}</label>
                        <Select value={drawerConfig.chartConfig.agg_type || 'COUNT'} onValueChange={v => setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, agg_type: v as 'SUM' | 'COUNT' }}))}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COUNT">{t('ReportDetailPage.recordCount')}</SelectItem>
                            {drawerColumns.find(c => c.id === drawerConfig.chartConfig.y_axis?.column_id)?.dataType === 'NUMBER' && (
                              <SelectItem value="SUM">{t('ReportDetailPage.totalValue')}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                 )}

                 {drawerColumns.length > 0 && activeWidgetObject?.widgetType === 'NUMBER_CARD' && (
                    <div className="space-y-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
                      <div>
                        <label className="text-label block mb-2">{t('ReportDetailPage.metricField')}</label>
                        <Select
                          value={drawerConfig.chartConfig.y_axis?.column_id || NONE}
                          onValueChange={v => {
                            const cId = v === NONE ? '' : v;
                            const cName = drawerColumns.find(c => c.id === cId)?.name || '';
                            setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, y_axis: { column_id: cId, label: cName }}}))
                          }}
                        >
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t('ReportDetailPage.default')}</SelectItem>
                            {drawerColumns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-label block mb-2 text-[var(--color-muted-foreground)]">{t('ReportDetailPage.method')}</label>
                        <Select value={drawerConfig.chartConfig.agg_type || 'COUNT'} onValueChange={v => setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, agg_type: v as 'SUM' | 'COUNT' }}))}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COUNT">{t('ReportDetailPage.countTotalRecords')}</SelectItem>
                            <SelectItem value="SUM">{t('ReportDetailPage.sumOfTheMetricField')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                 )}
              </div>

              {/* Sorting */}
              {activeWidgetObject?.widgetType !== 'TABLE' && activeWidgetObject?.widgetType !== 'NUMBER_CARD' && (
                 <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
                   <h3 className="text-eyebrow">{t('ReportDetailPage.order')}</h3>
                   <div className="flex gap-2">
                     <Select value={drawerConfig.chartConfig.sort_by || 'NONE'} onValueChange={v => setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, sort_by: v as any }}))}>
                        <SelectTrigger className="flex-1" aria-label={t('ReportDetailPage.sortBy')}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">{t('ReportDetailPage.default')}</SelectItem>
                          <SelectItem value="X">{t('ReportDetailPage.byXAxis')}</SelectItem>
                          <SelectItem value="Y">{t('ReportDetailPage.byYAxis')}</SelectItem>
                        </SelectContent>
                      </Select>
                      {drawerConfig.chartConfig.sort_by && drawerConfig.chartConfig.sort_by !== 'NONE' && (
                        <Select value={drawerConfig.chartConfig.sort_dir || 'ASC'} onValueChange={v => setDrawerConfig(prev => ({...prev, chartConfig: {...prev.chartConfig, sort_dir: v as any }}))}>
                          <SelectTrigger className="w-28" aria-label={t('ReportDetailPage.sortDirection')}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ASC">{t('ReportDetailPage.ascending')}</SelectItem>
                            <SelectItem value="DESC">{t('ReportDetailPage.descending')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                   </div>
                 </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
               <Button variant="outline" onClick={() => setActiveWidgetId(null)}>{t('ReportDetailPage.cancel')}</Button>
               <Button onClick={handleSaveSettings} disabled={updateWidgetMut.isPending}>{updateWidgetMut.isPending ? t('ReportDetailPage.saving') : t('ReportDetailPage.save')}</Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteWidgetId}
        onClose={() => setDeleteWidgetId(null)}
        onConfirm={() => { if (deleteWidgetId) deleteWidgetMut.mutate(deleteWidgetId, { onSettled: () => setDeleteWidgetId(null) }) }}
        title={t('ReportDetailPage.deleteThisChart')}
        description={t('ReportDetailPage.theBlockWillBeRemovedFrom')}
        confirmLabel={t('ReportDetailPage.deleteChart')}
        loading={deleteWidgetMut.isPending}
      />
      <ConfirmDialog
        open={!!removeDsId}
        onClose={() => setRemoveDsId(null)}
        onConfirm={() => { if (removeDsId) removeDsMut.mutate(removeDsId, { onSettled: () => setRemoveDsId(null) }) }}
        title={t('ReportDetailPage.removeTheDataSourceFromThe')}
        description={t('ReportDetailPage.chartsUsingThisSourceWillNo')}
        confirmLabel={t('ReportDetailPage.removeSource')}
        loading={removeDsMut.isPending}
      />

      {/* Kết nối nguồn dữ liệu */}
      <Dialog
        open={showAddDs}
        onClose={() => setShowAddDs(false)}
        size="md"
        dismissible={!addDsMut.isPending}
        title={t('ReportDetailPage.connectDataSource')}
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowAddDs(false)} disabled={addDsMut.isPending}>{t('ReportDetailPage.cancel')}</Button>}
            primary={<Button onClick={handleAddDatasource} disabled={!selectedDsId || addDsMut.isPending}>{t('ReportDetailPage.connectSource')}</Button>}
          />
        }
      >
        {unlinkedDatasources.length === 0 ? (
          <p className="py-4 text-sm text-[var(--color-muted-foreground)]">{t('ReportDetailPage.allDataSourcesAreAlreadyConnected')}</p>
        ) : (
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {unlinkedDatasources.map(ds => (
              <button
                key={ds.id}
                type="button"
                onClick={() => setSelectedDsId(ds.id)}
                aria-pressed={selectedDsId === ds.id}
                className={`flex w-full items-center gap-3 rounded-card border p-3 text-left text-sm transition-colors ${
                  selectedDsId === ds.id
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
                }`}
              >
                <Database size={18} className="shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{ds.name}</div>
                  <div className="mt-0.5 text-caption tabular-nums">{ds.columns?.length || 0} {t('ReportDetailPage.columns')} {ds.rowCount} {t('ReportDetailPage.dataRows')}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  )
}
