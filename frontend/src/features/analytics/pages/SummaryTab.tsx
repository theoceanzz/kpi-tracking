import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSummaryStats, useSummaryComparison, useSummaryRankings } from '../hooks/useAnalytics'
import { cn, getInitials } from '@/lib/utils'
import { KpiTypeTags } from '../components/KpiTypeTags'
import { KpiChildList, toChildNodes } from '../components/KpiChildList'
import {
  Target, Star, AlertCircle, Users, TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon,
  ChevronRight, AlertTriangle, Trophy, Medal, ArrowUpRight, ArrowDownRight, Layers,
  ChevronDown, Filter, ArrowUpDown, Loader2,
  Settings2, Save, RotateCcw, Plus, Layout, X, Eye, EyeOff, GripVertical, Trash2,
  Pin, CheckCircle, LayoutDashboard
} from 'lucide-react'
import { toast } from 'sonner'
import AnalyticsTabSkeleton, { TableLoadingRows } from '@/components/common/AnalyticsTabSkeleton'
import { CopyButton } from '@/components/common/CopyButton'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import { reportApi } from '@/features/reports/api/reportApi'
import type { RankingItem, UnitComparison } from '@/types/stats'
import AiAssistantWidget from '../components/AiAssistantWidget'
import AnalyticsComboChart from '../components/AnalyticsComboChart'
import Pagination from '@/components/common/Pagination'
import { orgUnitKpiApi } from '@/features/dashboard/api/orgUnitKpiApi'
import type { OrgUnitAssigneeStat, OrgUnitSubmissionStat, UnitRiskRow, MemberRiskRow, OverdueKpiForUnit, OverdueKpiForMember } from '@/features/dashboard/api/orgUnitKpiApi'
import OrgUnitKpiDrawer from '../components/OrgUnitKpiDrawer'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { format } from 'date-fns'

const ResponsiveGridLayout = WidthProvider(Responsive)
const CONFIG_REPORT_NAME = '__SUMMARY_DASHBOARD_CONFIG__'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type SortField = 'progress' | 'performance' | 'period'
type SortDir = 'asc' | 'desc'
type SharedFilter = 'ALL' | 'SHARED' | 'PERSONAL'

const PAGE_SIZE = 5

export type SummaryWidgetType =
  | 'UNIT_PERFORMANCE'
  | 'UNIT_KPI'
  | 'MEMBER_DIST'
  | 'ROLE_DIST'
  | 'UNIT_RISK'
  | 'WARNING_LIST'
  | 'RANKING_TABLE'

interface SummaryWidget {
  id?: string
  i: string
  type: SummaryWidgetType
  title: string
  x: number
  y: number
  w: number
  h: number
  visible: boolean
  isPinned?: boolean
}

const DEFAULT_SUMMARY_WIDGETS: SummaryWidget[] = [
  { i: 'unit-perf', type: 'UNIT_PERFORMANCE', title: 'Top 5 hiệu suất đơn vị', x: 0, y: 0, w: 6, h: 11, visible: true },
  { i: 'unit-kpi', type: 'UNIT_KPI', title: 'Top 5 tiến độ đơn vị', x: 6, y: 0, w: 6, h: 11, visible: true },
  { i: 'member-dist', type: 'MEMBER_DIST', title: 'Phân bổ nhân sự', x: 0, y: 11, w: 6, h: 10, visible: true },
  { i: 'role-dist', type: 'ROLE_DIST', title: 'Phân bổ vai trò', x: 6, y: 11, w: 6, h: 10, visible: true },
  { i: 'unit-risk', type: 'UNIT_RISK', title: 'Rủi ro đơn vị', x: 0, y: 21, w: 12, h: 11, visible: true },
  { i: 'warning-list', type: 'WARNING_LIST', title: 'Rủi ro thành viên', x: 0, y: 32, w: 12, h: 11, visible: true },
  { i: 'rank-table', type: 'RANKING_TABLE', title: 'Bảng xếp hạng nhân sự', x: 0, y: 43, w: 12, h: 13, visible: true },
]

const ChartWrapper = ({ children, title, icon, widget, onTogglePin, isEditMode, extraHeaderContent }: {
  children: React.ReactNode,
  title: string,
  icon: React.ReactNode,
  widget: SummaryWidget,
  onTogglePin: (w: SummaryWidget) => void,
  isEditMode: boolean,
  extraHeaderContent?: React.ReactNode
}) => {
  const sectionRef = useRef<HTMLDivElement>(null)
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col relative" ref={sectionRef}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">{icon} {title}</h3>
        <div className="flex items-center gap-2">
          {extraHeaderContent}
          {!isEditMode && (
            <>
              <button
                onClick={() => onTogglePin(widget)}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  widget.isPinned
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                title={widget.isPinned ? "Bỏ ghim khỏi trang chủ" : "Ghim vào trang chủ"}
              >
                <Pin size={16} fill={widget.isPinned ? "currentColor" : "none"} className={cn(widget.isPinned && "rotate-45")} />
              </button>
              <CopyButton targetRef={sectionRef} />
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

export default function SummaryTab() {
  const [selectedUnitId] = useState<string | undefined>(undefined)

  // ── Global filter state ───────────────────────────────────────────────────
  const [onlyApproved, setOnlyApproved] = useState(false)
  const { periodId, from, to, controls } = useAnalyticsDateFilter({ selectClassName: 'h-9' })
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

  // ── New KPI data ──────────────────────────────────────────────────────────
  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'metrics', from, to, onlyApproved, periodId],
    queryFn: () => orgUnitKpiApi.getMetrics({ from, to, onlyApproved, periodId }),
  })

  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'chart', from, to, onlyApproved, periodId],
    queryFn: () => orgUnitKpiApi.getComboChart({ from, to, onlyApproved, periodId }),
  })

  // ── Detail table state ────────────────────────────────────────────────────
  const [filterOrgUnitId, setFilterOrgUnitId] = useState<string | undefined>(undefined)
  const [filterShared, setFilterShared] = useState<SharedFilter>('ALL')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [tablePage, setTablePage] = useState(0)

  const { data: kpiPage, isLoading: isKpisLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'details', from, to, onlyApproved, periodId, filterOrgUnitId, sortField, sortDir, filterShared, tablePage],
    queryFn: () => orgUnitKpiApi.getDetailedKpis({
      from, to, onlyApproved, periodId,
      filterOrgUnitId,
      sortBy: sortField ?? undefined,
      sortDir,
      sharedType: filterShared === 'ALL' ? undefined : filterShared,
      page: tablePage,
      size: PAGE_SIZE,
    }),
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setTablePage(0)
  }

  const clearTableFilters = () => {
    setFilterOrgUnitId(undefined)
    setFilterShared('ALL')
    setTablePage(0)
  }

  const hasTableFilters = !!(filterOrgUnitId || filterShared !== 'ALL')

  // ── Shared chart hover state (Top 5 sync) ────────────────────────────────
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null)

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)

  // ── Existing summary data (unchanged widgets) ─────────────────────────────
  const { data: mainData, isLoading: isMainLoading } = useSummaryStats(selectedUnitId)
  // ── Widget config ─────────────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [widgets, setWidgets] = useState<SummaryWidget[]>(DEFAULT_SUMMARY_WIDGETS)
  const [configReportId, setConfigReportId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const mapWidgetsFromReport = (report: any): SummaryWidget[] => {
    if (!report.widgets || report.widgets.length === 0) return DEFAULT_SUMMARY_WIDGETS;
    return report.widgets.map((sw: any) => {
      try {
        const pos = JSON.parse(sw.position || '{}')
        const cfg = JSON.parse(sw.chartConfig || '{}')
        const def = DEFAULT_SUMMARY_WIDGETS.find(dw => dw.i === cfg.i)
        return {
          ...(def || {}), ...pos, ...cfg, id: sw.id,
          i: cfg.i || sw.id, type: sw.widgetType as SummaryWidgetType,
          title: sw.title, visible: cfg.visible !== false, isPinned: sw.isPinned
        } as SummaryWidget
      } catch { return null }
    }).filter(Boolean) as SummaryWidget[]
  }

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const reports = await reportApi.getAll({ size: 100 })
        const configReport = reports.content.find(r => r.name === CONFIG_REPORT_NAME)
        if (configReport) {
          setConfigReportId(configReport.id)
          setWidgets(mapWidgetsFromReport(configReport))
        }
      } catch (e) { console.error("Failed to load dashboard config", e) }
    }
    loadConfig()
  }, [])

  const saveConfig = async () => {
    try {
      const widgetRequests = widgets.map((w, index) => ({
        id: w.id, widgetType: w.type, title: w.title,
        position: JSON.stringify({ x: w.x, y: w.y, w: w.w, h: w.h }),
        chartConfig: JSON.stringify({ i: w.i, visible: w.visible }),
        widgetOrder: index, isPinned: w.isPinned
      }))
      let updatedReport;
      if (configReportId) {
        updatedReport = await reportApi.update(configReportId, { widgets: widgetRequests })
      } else {
        const newReport = await reportApi.create({ name: CONFIG_REPORT_NAME, description: 'Cấu hình giao diện thống kê tổng hợp' })
        updatedReport = await reportApi.update(newReport.id, { widgets: widgetRequests })
        setConfigReportId(newReport.id)
      }
      const newWidgets = mapWidgetsFromReport(updatedReport)
      setWidgets(newWidgets)
      setIsEditMode(false)
      return newWidgets
    } catch (err) {
      console.error(err)
      toast.error("Không thể lưu cấu hình")
      throw err
    }
  }

  const toggleVisibility = (id: string) => setWidgets(prev => prev.map(b => b.i === id ? { ...b, visible: !b.visible } : b))
  const resetLayout = () => { if (confirm("Bạn có chắc muốn đặt lại giao diện mặc định?")) setWidgets(DEFAULT_SUMMARY_WIDGETS) }
  const handleLayoutChange = (newLayout: any[]) => {
    setWidgets(prev => prev.map(item => {
      const updated = newLayout.find(l => l.i === item.i)
      return updated ? { ...item, x: updated.x, y: updated.y, w: updated.w, h: updated.h } : item
    }))
  }
  const deleteWidget = (i: string) => setWidgets(prev => prev.filter(w => w.i !== i))
  const addWidget = (template: SummaryWidget) => {
    if (widgets.some(w => w.type === template.type)) { alert("Biểu đồ này đã có trên trang"); return }
    const maxY = widgets.length > 0 ? Math.max(...widgets.map(w => w.y + w.h)) : 0
    setWidgets(prev => [...prev, { ...template, y: maxY, visible: true }])
    setIsAddModalOpen(false)
  }

  const handleTogglePin = async (widget: SummaryWidget) => {
    let targetWidgetId = widget.id;
    if (!targetWidgetId) {
      try {
        const savedWidgets = await saveConfig();
        const found = savedWidgets.find(w => w.i === widget.i);
        if (found?.id) { targetWidgetId = found.id } else { toast.error("Không thể ghim: Lỗi khởi tạo cấu hình"); return }
      } catch { return }
    }
    try {
      const updated = await reportApi.togglePinWidget(targetWidgetId)
      setWidgets(prev => prev.map(w => w.id === targetWidgetId ? { ...w, isPinned: updated.isPinned } : w))
      queryClient.invalidateQueries({ queryKey: ['reports', 'widgets', 'pinned'] })
      toast.success(updated.isPinned ? "Đã ghim vào trang chủ" : "Đã bỏ ghim khỏi trang chủ")
    } catch (err) {
      console.error(err)
      toast.error("Không thể thay đổi trạng thái ghim")
    }
  }

  const renderWidgetContent = (widget: SummaryWidget) => {
    switch (widget.type) {
      case 'UNIT_PERFORMANCE': return <TopUnitPerfSection orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} isEditMode={isEditMode} widget={widget} onTogglePin={handleTogglePin} hoveredUnit={hoveredUnit} onHoverUnit={setHoveredUnit} />
      case 'UNIT_KPI': return <TopUnitProgressSection orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} isEditMode={isEditMode} widget={widget} onTogglePin={handleTogglePin} hoveredUnit={hoveredUnit} onHoverUnit={setHoveredUnit} />
      case 'MEMBER_DIST': {
        return (
          <ChartWrapper title="Số lượng nhân sự" icon={<PieChartIcon size={20} className="text-purple-600" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center flex-1">
              <div className="h-full min-h-[200px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={mainData?.memberDistribution || []} innerRadius="50%" outerRadius="80%" paddingAngle={5} dataKey="value">{(mainData?.memberDistribution || []).map((_: any, index: number) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <div className="space-y-3">{(mainData?.memberDistribution || []).map((entry: any, index: number) => (<div key={entry.name} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="text-xs font-bold text-slate-500">{entry.name}</span></div><span className="text-xs font-black text-slate-900 dark:text-white">{entry.value} người</span></div>))}</div>
            </div>
          </ChartWrapper>
        )
      }
      case 'ROLE_DIST': {
        const allRoles = new Set<string>();
        mainData?.roleDistribution?.forEach((item: any) => item.roles?.forEach((r: any) => allRoles.add(r.roleName)));
        const uniqueRoleNames = Array.from(allRoles);
        const chartData = mainData?.roleDistribution?.map((item: any) => {
          const dp: any = { unitName: item.unitName };
          item.roles?.forEach((r: any) => { dp[r.roleName] = r.count });
          return dp;
        }) || [];
        return (
          <ChartWrapper title="Phân bổ vai trò" icon={<Layers size={20} className="text-orange-500" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                  <YAxis dataKey="unitName" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} width={80} />
                  <Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, paddingTop: '10px' }} />
                  {uniqueRoleNames.map((roleName, index) => (<Bar key={roleName} dataKey={roleName} stackId="a" fill={COLORS[index % COLORS.length]} name={roleName} barSize={15} />))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartWrapper>
        )
      }
      case 'UNIT_RISK': return <UnitRiskSection orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} isEditMode={isEditMode} widget={widget} onTogglePin={handleTogglePin} />
      case 'WARNING_LIST': return <WarningListSection orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} isEditMode={isEditMode} widget={widget} onTogglePin={handleTogglePin} />
      case 'RANKING_TABLE': return <EmployeeRankingTableSection orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} isEditMode={isEditMode} widget={widget} onTogglePin={handleTogglePin} />
      default: return null
    }
  }

  if (isMainLoading && !mainData) return <AnalyticsTabSkeleton variant="default" className="p-6" />

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Thống kê tổng hợp</h2>
        <div className="flex items-center gap-3">
          {isEditMode ? (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-1 rounded-xl border border-indigo-100 dark:border-indigo-800">
              <button onClick={resetLayout} className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400" title="Đặt lại mặc định"><RotateCcw size={18} /></button>
              <button onClick={() => setIsConfigOpen(true)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg flex items-center gap-2"><Layout size={14} /> Ẩn/Hiện</button>
              <button onClick={() => setIsAddModalOpen(true)} className="px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg flex items-center gap-2"><Plus size={14} /> Thêm biểu đồ</button>
              <div className="w-px h-4 bg-indigo-200 dark:bg-indigo-800 mx-1" />
              <button onClick={() => setIsEditMode(false)} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700">Huỷ</button>
              <button onClick={saveConfig} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2"><Save size={14} /> Lưu</button>
            </div>
          ) : (
            <button onClick={() => setIsEditMode(true)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 shadow-sm transition-all">
              <Settings2 size={16} /> Tuỳ chỉnh
            </button>
          )}
        </div>
      </div>

      {/* ── Sentinel: 1px above filter to detect when filter becomes sticky ── */}
      <div ref={filterSentinelRef} className="h-px" aria-hidden />

      {/* ── Global Filter (sticky) ────────────────────────────────────────── */}
      <div className={cn(
        "sticky top-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl transition-all duration-200",
        filterStuck
          ? "p-3 shadow-lg shadow-slate-200/80 dark:shadow-slate-900/80 border-slate-300 dark:border-slate-700"
          : "p-4 shadow-sm"
      )}>
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg text-indigo-600 dark:text-indigo-400 transition-all duration-200",
              filterStuck ? "bg-indigo-50/60 dark:bg-indigo-900/20" : "bg-indigo-50 dark:bg-indigo-900/30"
            )}>
              <LayoutDashboard size={filterStuck ? 16 : 18} />
            </div>
            <div>
              <h2 className={cn("font-bold text-slate-900 dark:text-white transition-all duration-200", filterStuck ? "text-sm" : "text-base")}>
                Bộ lọc KPI đơn vị
              </h2>
              {!filterStuck && (
                <p className="text-xs text-slate-500 font-medium mt-0.5">Lọc dữ liệu đồng bộ cho metrics, biểu đồ và bảng chi tiết</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800"
                checked={onlyApproved}
                onChange={e => setOnlyApproved(e.target.checked)}
              />
              Chỉ tính bài nộp đã duyệt
            </label>
            {controls}
          </div>
        </div>
      </div>

      {/* ── Metrics ───────────────────────────────────────────────────────── */}
      {isMetricsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-[var(--color-muted)] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"><TrendingUp size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Tiến độ trung bình</p>
              <p className="text-2xl font-black">{metrics?.averageProgress?.toFixed(1) ?? 0}%</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><Target size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Hiệu suất trung bình</p>
              <p className="text-2xl font-black">{metrics?.averagePerformance?.toFixed(1) ?? 0}%</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><CheckCircle size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Trạng thái KPI</p>
              <p className="text-sm font-black">{metrics?.runningKpis ?? 0} Đang chạy</p>
              <p className="text-sm font-black text-emerald-600">{metrics?.completedKpis ?? 0} Hoàn thành</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"><AlertTriangle size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">KPI Rủi ro / Chậm</p>
              <p className="text-2xl font-black">{metrics?.riskKpis ?? 0}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0"><Users size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Tổng nhân sự</p>
              <p className="text-2xl font-black">{mainData?.totalMembers ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Trend Combo Chart ─────────────────────────────────────────── */}
      <div className="pt-2">
        <AnalyticsComboChart
          data={chartData?.points || []}
          isLoading={isChartLoading}
          itemName="KPI đơn vị"
        />
      </div>

      {/* ── KPI Detail Table ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-black">Bảng chi tiết KPI đơn vị</h3>
          <span className="text-xs font-bold text-slate-400">{kpiPage?.totalElements ?? 0} KPI</span>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          {/* Unit filter */}
          <select
            className="h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 max-w-[220px]"
            value={filterOrgUnitId || ''}
            onChange={e => { setFilterOrgUnitId(e.target.value || undefined); setTablePage(0) }}
          >
            <option value="">Tất cả đơn vị</option>
            {kpiPage?.availableOrgUnits?.map(o => (
              <UnitSelectOption key={o.code} o={o} />
            ))}
          </select>

          {hasTableFilters && (
            <button onClick={clearTableFilters} className="flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <X size={13} /> Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-xs font-black uppercase text-slate-500">
                <th className="px-6 py-4">Tên KPI</th>
                <th className="px-6 py-4">Đơn vị</th>
                <th className="px-6 py-4 whitespace-nowrap">
                  <SortHeader field="period" active={sortField} dir={sortDir} onToggle={toggleSort}>Chu kỳ</SortHeader>
                </th>
                <th className="px-6 py-4 min-w-[220px]">
                  <SortHeader field="progress" active={sortField} dir={sortDir} onToggle={toggleSort}>Tiến độ</SortHeader>
                </th>
                <th className="px-6 py-4 text-center">
                  <SortHeader field="performance" active={sortField} dir={sortDir} onToggle={toggleSort}>Hiệu suất</SortHeader>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isKpisLoading
                ? <TableLoadingRows cols={6} count={2} />
                : kpiPage?.content?.map(kpi => (
                    <OrgUnitKpiRow key={kpi.kpiId} kpi={kpi} onClick={() => setSelectedKpiId(kpi.kpiId)} />
                  ))}
              {!isKpisLoading && (kpiPage?.totalElements ?? 0) === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {(kpiPage?.totalElements ?? 0) > 0 && (
          <Pagination
            currentPage={tablePage}
            totalPages={kpiPage?.totalPages ?? 1}
            onPageChange={setTablePage}
            totalElements={kpiPage?.totalElements ?? 0}
            size={PAGE_SIZE}
            itemLabel="KPI"
          />
        )}
      </div>

      {/* ── Configurable widgets (grid) ───────────────────────────────────── */}
      {mainData && (
        <div className={cn("relative min-h-[400px]", isEditMode && "bg-slate-50/50 dark:bg-slate-800/10 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800")}>
          {isEditMode && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="grid grid-cols-12 w-full h-full gap-4 px-2">
                {Array.from({ length: 12 }).map((_, i) => <div key={i} className="border-x border-slate-300 dark:border-slate-700 h-full" />)}
              </div>
            </div>
          )}
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: widgets.filter(b => b.visible), md: widgets.filter(b => b.visible), sm: widgets.filter(b => b.visible), xs: widgets.filter(b => b.visible), xxs: widgets.filter(b => b.visible) }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 12, sm: 12, xs: 6, xxs: 4 }}
            rowHeight={32}
            compactType="vertical"
            draggableHandle=".drag-handle"
            isDraggable={isEditMode}
            isResizable={isEditMode}
            onLayoutChange={(current, all) => { if (isEditMode) { if (all.lg) handleLayoutChange(all.lg as any); else handleLayoutChange(current as any) } }}
            margin={[16, 16]}
          >
            {widgets.filter(b => b.visible).map((block) => (
              <div key={block.i} className={cn("relative group h-full", isEditMode && "ring-2 ring-transparent hover:ring-indigo-500 rounded-[24px] transition-all overflow-visible")}>
                {isEditMode && (
                  <>
                    <div className="drag-handle absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 z-[60] cursor-move bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-full shadow-lg flex items-center gap-1 transition-opacity">
                      <GripVertical size={14} className="text-slate-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Kéo</span>
                    </div>
                    <button onClick={() => deleteWidget(block.i)} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 z-[60] bg-red-500 text-white p-1.5 rounded-xl shadow-lg hover:bg-red-600 transition-all"><Trash2 size={14} /></button>
                  </>
                )}
                <div className="h-full w-full">{renderWidgetContent(block)}</div>
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      )}

      

      {/* ── Visibility Toggle Drawer ─────────────────────────────────────── */}
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
              <button onClick={() => setIsConfigOpen(false)} className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black hover:opacity-90 transition-all">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Widget Modal ─────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-black text-xl">Thêm biểu đồ phân tích</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">Chọn từ các biểu đồ có sẵn trong hệ thống</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><X size={24} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-auto pr-2 custom-scrollbar">
              {DEFAULT_SUMMARY_WIDGETS.map((template) => {
                const isAlreadyAdded = widgets.some(w => w.type === template.type)
                return (
                  <button key={template.i} disabled={isAlreadyAdded} onClick={() => addWidget(template)}
                    className={cn("flex items-center gap-4 p-5 rounded-2xl border text-left transition-all group", isAlreadyAdded ? "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-xl hover:-translate-y-1")}
                  >
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", isAlreadyAdded ? "bg-slate-200 text-slate-400" : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 group-hover:scale-110 transition-transform")}>
                      {template.type === 'UNIT_PERFORMANCE' && <TrendingUp size={24} />}
                      {template.type === 'UNIT_KPI' && <TrendingDown size={24} />}
                      {template.type === 'MEMBER_DIST' && <Users size={24} />}
                      {template.type === 'ROLE_DIST' && <Layers size={24} />}
                      {template.type === 'UNIT_RISK' && <AlertTriangle size={24} />}
                      {template.type === 'WARNING_LIST' && <AlertCircle size={24} />}
                      {template.type === 'RANKING_TABLE' && <Star size={24} />}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-sm text-slate-900 dark:text-white">{template.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isAlreadyAdded ? 'Đã thêm' : 'Sẵn có'}</p>
                    </div>
                    {!isAlreadyAdded && <Plus size={16} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />}
                  </button>
                )
              })}
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setIsAddModalOpen(false)} className="px-8 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-black text-sm hover:bg-slate-200 transition-all">Đóng</button>
            </div>
          </div>
        </div>
      )}

      <AiAssistantWidget />

      {selectedKpiId && (
        <OrgUnitKpiDrawer
          kpiId={selectedKpiId}
          onClose={() => setSelectedKpiId(null)}
          globalFrom={from}
          globalTo={to}
          globalOnlyApproved={onlyApproved}
          globalPeriodId={periodId}
        />
      )}
    </div>
  )
}

// ── KPI Detail Table Row ──────────────────────────────────────────────────────

function KpiDateRange({ start, end }: { start: string | null; end: string | null }) {
  const fmt = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '—'
  return (
    <div className="inline-flex flex-col gap-1 text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-slate-400 uppercase tracking-wider w-[26px] shrink-0">Từ</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{fmt(start)}</span>
      </div>
      <div className="w-full h-px bg-slate-100 dark:bg-slate-800" />
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-indigo-400 uppercase tracking-wider w-[26px] shrink-0">Đến</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{fmt(end)}</span>
      </div>
    </div>
  )
}

function OrgUnitKpiRow({ kpi, onClick }: { kpi: any; onClick?: () => void }) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [expandedParticipant, setExpandedParticipant] = React.useState<Record<string, boolean>>({})

  const { data: drawerData, isLoading: isLoadingParticipants } = useQuery({
    queryKey: ['orgUnitKpi', 'drawer', kpi.kpiId],
    queryFn: () => orgUnitKpiApi.getKpiDrawerData(kpi.kpiId),
    enabled: isExpanded,
    staleTime: 5 * 60 * 1000,
  })

  const submissionsByParticipant = React.useMemo(() => {
    const map: Record<string, OrgUnitSubmissionStat[]> = {}
    drawerData?.topSubmissions?.forEach((sub: OrgUnitSubmissionStat) => {
      ;(map[sub.submitterName] ??= []).push(sub)
    })
    return map
  }, [drawerData])

  // KPI thưởng: backend trả tiến độ/hiệu suất = null (không tính), hiển thị gạch ngang.
  const isBonus = kpi.progress == null
  const pct  = Math.round(kpi.progress    || 0)
  const perf = Math.round(kpi.performance || 0)

  return (
    <React.Fragment>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={onClick}>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setIsExpanded(prev => !prev) }}
              className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0 shadow-sm"
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors dark:text-white truncate max-w-[180px]">{kpi.kpiName}</div>
              <KpiTypeTags
                className="mt-1"
                isReverseKpi={kpi.isReverseKpi}
                isBonusKpi={kpi.isBonusKpi}
                parentRelationType={kpi.parentRelationType}
                childRelationType={kpi.childRelationType}
              />
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Filter size={10} />{kpi.orgUnitName || '—'}
          </span>
        </td>
        <td className="px-6 py-4">
          <KpiDateRange start={kpi.periodStart} end={kpi.periodEnd} />
        </td>
        <td className="px-6 py-4">
          {isBonus ? (
            <div className="flex flex-col gap-1">
              <span className="inline-flex w-fit items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase">
                Thưởng
              </span>
              <div className="text-[10px] text-slate-500">
                {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-black">{pct}%</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </>
          )}
        </td>
        <td className="px-6 py-4 text-center">
          {isBonus ? (
            <span className="text-slate-400 font-black">—</span>
          ) : (
            <div className="inline-flex relative items-center justify-center w-12 h-12">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="20" cx="24" cy="24" />
                <circle
                  className={cn(perf >= 100 ? 'text-emerald-500' : perf >= 80 ? 'text-indigo-500' : perf >= 50 ? 'text-amber-500' : 'text-red-500')}
                  strokeWidth="4" strokeDasharray={125.6}
                  strokeDashoffset={125.6 - (Math.min(perf, 100) / 100) * 125.6}
                  strokeLinecap="round" stroke="currentColor" fill="transparent" r="20" cx="24" cy="24"
                />
              </svg>
              <span className="absolute text-[10px] font-black">{perf}%</span>
            </div>
          )}
        </td>
      </tr>

      {/* ── Expanded participants row ────────────────────────────────────── */}
      {isExpanded && (
        <tr className="bg-slate-50/60 dark:bg-slate-800/10 border-l-[3px] border-l-indigo-400 dark:border-l-indigo-500/50">
          <td colSpan={5} className="px-8 py-5">
            {kpi.children && kpi.children.length > 0 && (
              <div className="mb-5">
                <KpiChildList nodes={toChildNodes(kpi.children)} />
              </div>
            )}
            {isLoadingParticipants ? (
              <div className="py-3 animate-pulse space-y-2">
                <div className="h-10 bg-[var(--color-muted)] rounded-xl" />
                <div className="h-10 bg-[var(--color-muted)] rounded-xl opacity-60" />
              </div>
            ) : (
              <>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500" />
                  Các thành viên đảm nhiệm
                </div>
                {!drawerData?.assigneeStats?.length ? (
                  <p className="text-sm text-slate-400 py-2 pl-3">Không có thành viên nào</p>
                ) : (
                  <div className="space-y-3 pl-3">
                    {drawerData.assigneeStats.map((p: OrgUnitAssigneeStat) => {
                      const subs = submissionsByParticipant[p.fullName] || []
                      const isPartExp = expandedParticipant[p.userId]
                      return (
                        <div key={p.userId} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-all">
                          {/* Participant header */}
                          <div
                            className={cn(
                              'p-4 flex items-center justify-between transition-colors',
                              subs.length ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : '',
                              isPartExp && 'border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-700/30'
                            )}
                            onClick={() => subs.length && setExpandedParticipant(prev => ({ ...prev, [p.userId]: !prev[p.userId] }))}
                          >
                            <div className="flex items-center gap-3 min-w-[280px]">
                              {subs.length > 0 ? (
                                <button className="p-1 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-400 hover:text-indigo-500 transition-colors flex-shrink-0">
                                  {isPartExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              ) : <div className="w-6 h-6 flex-shrink-0" />}
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-600 shadow-sm flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shadow-sm flex-shrink-0">
                                  {p.fullName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight mb-0.5">{p.fullName}</div>
                                {p.roleName && <div className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded inline-block">{p.roleName}</div>}
                              </div>
                            </div>

                            <div className="flex-1 flex items-center justify-between px-6 border-l border-slate-100 dark:border-slate-700/50">
                              {p.orgUnitName && (
                                <div className="min-w-[140px] pr-4">
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Đơn vị</div>
                                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.orgUnitName}</div>
                                </div>
                              )}
                              <div className="flex-1 max-w-[360px]">
                                <div className="flex justify-between items-center mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                                  <span>Tiến độ cá nhân</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round(p.completionRate)}%</span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                                  <div
                                    className={cn('h-full rounded-full transition-all duration-700',
                                      p.completionRate >= 100 ? 'bg-emerald-500' : p.completionRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                    )}
                                    style={{ width: `${Math.min(p.completionRate, 100)}%` }}
                                  />
                                </div>
                                <div className={cn('text-[11px] font-bold mt-1.5',
                                  p.completionRate >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
                                  p.completionRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                )}>
                                  {p.actualValue?.toLocaleString('vi-VN')} {kpi.unit}
                                </div>
                              </div>
                              <div className="flex flex-col items-center ml-8 min-w-[80px]">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Hiệu suất</span>
                                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{Math.round(p.performanceRate)}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Submissions */}
                          {isPartExp && subs.length > 0 && (
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 pt-3 pb-5">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-10">Lịch sử bài nộp</div>
                              <div className="space-y-2.5 pl-10 pr-4">
                                {subs.map((sub, idx) => (
                                  <div key={idx} className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5 shadow-sm hover:shadow-md transition-shadow gap-4">
                                    <div className="min-w-[180px] pr-4">
                                      <div className="font-bold text-[13px] text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
                                        {`Bài nộp #${idx + 1}`}
                                      </div>
                                    </div>
                                    <div className="min-w-[140px] pr-4">
                                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Thời gian nộp</div>
                                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                                      </div>
                                    </div>
                                    <div className="flex-1 px-5 border-x border-slate-100 dark:border-slate-700/50">
                                      <div className="flex justify-between items-center text-[11px] font-medium uppercase tracking-wider mb-1 text-slate-500">
                                        <span>Đóng góp</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{sub.contributionProgress.toFixed(1)}%</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                          className={cn('h-full rounded-full',
                                            sub.contributionProgress >= 100 ? 'bg-emerald-500' : sub.contributionProgress >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                          )}
                                          style={{ width: `${Math.min(sub.contributionProgress, 100)}%` }}
                                        />
                                      </div>
                                      <div className={cn('text-[10.5px] font-bold mt-1',
                                        sub.contributionProgress >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
                                        sub.contributionProgress >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                      )}>
                                        +{sub.actualValue?.toLocaleString('vi-VN')} {kpi.unit}
                                      </div>
                                    </div>
                                    <div className="min-w-[100px] flex flex-col items-center">
                                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Hiệu suất</span>
                                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{sub.performance.toFixed(1)}%</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </React.Fragment>
  )
}

function SortHeader({ field, active, dir, onToggle, children }: {
  field: SortField; active: SortField | null; dir: SortDir; onToggle: (f: SortField) => void; children: React.ReactNode
}) {
  const isActive = active === field
  return (
    <button onClick={() => onToggle(field)} className="flex items-center gap-1 group hover:text-indigo-500 transition-colors">
      {children}
      <span className="ml-0.5">
        {isActive
          ? dir === 'asc' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />
          : <ArrowUpDown size={12} className="opacity-30 group-hover:opacity-60" />}
      </span>
    </button>
  )
}

// ── Widget sub-components (unchanged, no date filter) ─────────────────────────

function TableSkeletonRows({ cols, count = 5 }: { cols: number; count?: number }) {
  const widths = ['75%', '55%', '65%', '50%', '70%']
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <div
                className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse"
                style={{ width: j === 0 ? '30%' : widths[j % widths.length] }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function RankFilterToggle({ filter, onChange }: { filter: 'BEST' | 'WORST'; onChange: (f: 'BEST' | 'WORST') => void }) {
  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => onChange('BEST')}
        className={cn('flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
          filter === 'BEST' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400')}
      >
        <Trophy size={11} /> Tốt nhất
      </button>
      <button
        onClick={() => onChange('WORST')}
        className={cn('flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
          filter === 'WORST' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400')}
      >
        <TrendingDown size={11} /> Trì trệ
      </button>
    </div>
  )
}

function UnitBarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const unit = payload[0]?.payload?.tooltipName || payload[0]?.payload?.unitName || ''
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-xl border border-white/10 max-w-[200px]">
      <p className="font-bold mb-1 break-words">{unit}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-bold">{Math.round(p.value)}%</span>
        </p>
      ))}
    </div>
  )
}

function TopUnitPerfSection({ orgUnitId, from, to, onlyApproved, periodId, isEditMode, widget, onTogglePin, hoveredUnit, onHoverUnit }: {
  orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string
  isEditMode?: boolean; widget: SummaryWidget; onTogglePin: (w: SummaryWidget) => void
  hoveredUnit?: string | null; onHoverUnit?: (u: string | null) => void
}) {
  const [filter, setFilter] = React.useState<'BEST' | 'WORST'>('BEST')
  const { data } = useSummaryComparison(orgUnitId, from, to, onlyApproved, periodId)

  const chartData = React.useMemo(() => {
    const source = (filter === 'BEST' ? data?.topPerformingUnits : data?.worstPerformingUnits) as UnitComparison[] | undefined
    return (source || []).slice(0, 5).map((u: UnitComparison) => ({
      ...u,
      displayName: u.unitName.length > 18 ? u.unitName.substring(0, 18) + '…' : u.unitName,
      tooltipName: u.unitName,
    }))
  }, [data, filter])

  const baseColor = filter === 'BEST' ? '#10b981' : '#f43f5e'

  return (
    <ChartWrapper
      title="Top 5 hiệu suất đơn vị"
      icon={<TrendingUp size={20} className="text-emerald-500" />}
      widget={widget} onTogglePin={onTogglePin} isEditMode={!!isEditMode}
      extraHeaderContent={<RankFilterToggle filter={filter} onChange={setFilter} />}
    >
      <div className="relative flex-1 flex flex-col">
        {chartData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Không có dữ liệu</div>
        ) : (
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 55, left: 10, bottom: 5 }}
                onMouseLeave={() => onHoverUnit?.(null)}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="#f1f5f9" strokeOpacity={0.8} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="displayName" type="category" width={120} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<UnitBarTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                <Bar name="Hiệu suất" dataKey="performance" fill={baseColor} radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}
                  onMouseEnter={(d: any) => onHoverUnit?.(d.payload?.tooltipName ?? null)}
                  label={{ position: 'right', fill: '#64748b', fontSize: 10, fontWeight: 700, formatter: (v: any) => `${Math.round(v)}%` }}>
                  {chartData.map((item, i) => (
                    <Cell key={i} fill={baseColor} opacity={hoveredUnit && hoveredUnit !== item.tooltipName ? 0.3 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ChartWrapper>
  )
}

function TopUnitProgressSection({ orgUnitId, from, to, onlyApproved, periodId, isEditMode, widget, onTogglePin, hoveredUnit, onHoverUnit }: {
  orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string
  isEditMode?: boolean; widget: SummaryWidget; onTogglePin: (w: SummaryWidget) => void
  hoveredUnit?: string | null; onHoverUnit?: (u: string | null) => void
}) {
  const [filter, setFilter] = React.useState<'BEST' | 'WORST'>('BEST')
  const { data } = useSummaryComparison(orgUnitId, from, to, onlyApproved, periodId)

  const chartData = React.useMemo(() => {
    const combined = [...(data?.topPerformingUnits || []), ...(data?.worstPerformingUnits || [])] as UnitComparison[]
    const seen = new Set<string>()
    const unique = combined.filter((u: UnitComparison) => { if (seen.has(u.unitName)) return false; seen.add(u.unitName); return true })
    return unique
      .sort((a: UnitComparison, b: UnitComparison) => filter === 'BEST' ? b.completionRate - a.completionRate : a.completionRate - b.completionRate)
      .slice(0, 5)
      .map((u: UnitComparison) => ({
        ...u,
        displayName: u.unitName.length > 18 ? u.unitName.substring(0, 18) + '…' : u.unitName,
        tooltipName: u.unitName,
      }))
  }, [data, filter])

  const baseColor = filter === 'BEST' ? '#6366f1' : '#f59e0b'

  return (
    <ChartWrapper
      title="Top 5 tiến độ đơn vị"
      icon={<BarChart3 size={20} className="text-indigo-600" />}
      widget={widget} onTogglePin={onTogglePin} isEditMode={!!isEditMode}
      extraHeaderContent={<RankFilterToggle filter={filter} onChange={setFilter} />}
    >
      <div className="relative flex-1 flex flex-col">
        {chartData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Không có dữ liệu</div>
        ) : (
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 55, left: 10, bottom: 5 }}
                onMouseLeave={() => onHoverUnit?.(null)}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="#f1f5f9" strokeOpacity={0.8} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="displayName" type="category" width={120} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<UnitBarTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                <Bar name="Tiến độ" dataKey="completionRate" fill={baseColor} radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}
                  onMouseEnter={(d: any) => onHoverUnit?.(d.payload?.tooltipName ?? null)}
                  label={{ position: 'right', fill: '#64748b', fontSize: 10, fontWeight: 700, formatter: (v: any) => `${Math.round(v)}%` }}>
                  {chartData.map((item, i) => (
                    <Cell key={i} fill={baseColor} opacity={hoveredUnit && hoveredUnit !== item.tooltipName ? 0.3 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ChartWrapper>
  )
}

type RiskSortField = 'progress' | 'overdueCount' | 'overdueRate'

function UnitSelectOption({ o }: { o: { code: string; name: string; depth?: number } }) {
  const prefix = '-'.repeat(o.depth ?? 0)
  return <option value={o.code}>{prefix}{o.name}</option>
}

function RiskSortBtn({ field, active, dir, onToggle, children }: {
  field: RiskSortField; active: RiskSortField; dir: 'asc' | 'desc'
  onToggle: (f: RiskSortField) => void; children: React.ReactNode
}) {
  const isActive = active === field
  return (
    <button onClick={() => onToggle(field)} className="flex items-center gap-1 group hover:text-indigo-500 transition-colors whitespace-nowrap">
      {children}
      <span className="ml-0.5">
        {isActive ? (dir === 'asc' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />) : <ArrowUpDown size={11} className="opacity-30 group-hover:opacity-60" />}
      </span>
    </button>
  )
}

function UnitRiskExpandedRow({ unitId, colSpan }: { unitId: string; colSpan: number }) {
  const { data, isFetching } = useQuery({
    queryKey: ['orgUnitKpi', 'risks', 'unitOverdue', unitId],
    queryFn: () => orgUnitKpiApi.getUnitOverdueKpis(unitId),
  })
  const kpis = (data || []) as OverdueKpiForUnit[]
  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="mx-4 mb-3 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 overflow-hidden">
          {isFetching ? (
            <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Đang tải...</div>
          ) : kpis.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 font-semibold">Không có KPI trễ hạn</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[9px] font-black uppercase text-red-400 border-b border-red-100 dark:border-red-900/40">
                  <th className="px-4 py-2 text-left">Tên KPI</th>
                  <th className="px-4 py-2 text-left">Hạn chót</th>
                  <th className="px-4 py-2 text-left">Giao cho</th>
                  <th className="px-4 py-2 text-right">Mục tiêu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100/60 dark:divide-red-900/20">
                {kpis.map((k) => (
                  <tr key={k.kpiId} className="hover:bg-red-50 dark:hover:bg-red-900/10">
                    <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-300">{k.kpiName}</td>
                    <td className="px-4 py-2 text-red-600 dark:text-red-400 font-semibold whitespace-nowrap">
                      {k.deadline ? format(new Date(k.deadline), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {k.assigneeNames.length > 0 ? k.assigneeNames.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {k.targetValue.toLocaleString()} {k.unit || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  )
}

function UnitRiskSection({ orgUnitId, from, to, onlyApproved, periodId, isEditMode, widget, onTogglePin }: { orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; isEditMode?: boolean; widget: SummaryWidget; onTogglePin: (w: SummaryWidget) => void }) {
  const [page, setPage] = React.useState(0)
  const [sortBy, setSortBy] = React.useState<RiskSortField>('progress')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [expandedUnit, setExpandedUnit] = React.useState<string | null>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['orgUnitKpi', 'risks', 'units', orgUnitId, from, to, onlyApproved, periodId, page, sortBy, sortDir],
    queryFn: () => orgUnitKpiApi.getUnitRisks({ orgUnitId, from, to, onlyApproved, periodId, page, size: 5, sortBy, sortDir }),
    placeholderData: (prev) => prev,
  })

  const toggleSort = (field: RiskSortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
    setPage(0)
  }

  const rows = (data?.content || []) as UnitRiskRow[]

  return (
    <ChartWrapper title="Rủi ro đơn vị" icon={<AlertTriangle size={20} className="text-red-500" />} widget={widget} onTogglePin={onTogglePin} isEditMode={!!isEditMode}>
      <div className="flex-1 flex flex-col gap-3">
        <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-[9px] font-black uppercase text-slate-400">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left">Đơn vị</th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="overdueCount" active={sortBy} dir={sortDir} onToggle={toggleSort}>Trễ hạn</RiskSortBtn>
                </th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="overdueRate" active={sortBy} dir={sortDir} onToggle={toggleSort}>Tỉ lệ trễ</RiskSortBtn>
                </th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="progress" active={sortBy} dir={sortDir} onToggle={toggleSort}>Tiến độ TB</RiskSortBtn>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isFetching ? (
                <TableSkeletonRows cols={5} count={5} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-bold">Không có dữ liệu rủi ro</td></tr>
              ) : rows.map((r) => (
                <React.Fragment key={r.unitId}>
                  <tr className="hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors">
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setExpandedUnit(expandedUnit === r.unitId ? null : r.unitId)}
                        className={cn('p-1 rounded-lg transition-all', expandedUnit === r.unitId ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:text-red-500 hover:bg-red-50')}
                      >
                        <ChevronDown size={13} className={cn('transition-transform', expandedUnit === r.unitId && 'rotate-180')} />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{r.unitName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md font-black">{r.overdueCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('font-black', r.overdueRate > 50 ? 'text-red-600' : r.overdueRate > 20 ? 'text-amber-600' : 'text-slate-500')}>{r.overdueRate.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', r.avgProgress >= 80 ? 'bg-emerald-500' : r.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                            style={{ width: `${Math.min(r.avgProgress, 100)}%` }} />
                        </div>
                        <span className={cn('font-black text-[11px]', r.avgProgress >= 80 ? 'text-emerald-600' : r.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600')}>{r.avgProgress.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                  {expandedUnit === r.unitId && <UnitRiskExpandedRow unitId={r.unitId} colSpan={5} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 0) > 1 && (
          <Pagination currentPage={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} totalElements={data?.totalElements ?? 0} size={5} itemLabel="đơn vị" />
        )}
      </div>
    </ChartWrapper>
  )
}

function MemberOverdueKpiRow({ kpi, colSpan }: { kpi: OverdueKpiForMember; colSpan: number }) {
  const [showSubs, setShowSubs] = React.useState(false)
  return (
    <React.Fragment>
      <tr className="hover:bg-orange-50/40 dark:hover:bg-orange-900/10 transition-colors">
        <td className="px-3 py-2">
          <button
            onClick={() => setShowSubs(v => !v)}
            className={cn('p-1 rounded-md transition-all', showSubs ? 'bg-orange-100 text-orange-600' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50')}
          >
            <ChevronDown size={12} className={cn('transition-transform', showSubs && 'rotate-180')} />
          </button>
        </td>
        <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-300">{kpi.kpiName}</td>
        <td className="px-4 py-2 text-red-600 dark:text-red-400 font-semibold whitespace-nowrap">
          {kpi.deadline ? format(new Date(kpi.deadline), 'dd/MM/yyyy') : '—'}
        </td>
        <td className="px-4 py-2 text-right font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {kpi.targetValue.toLocaleString()} {kpi.unit || ''}
        </td>
      </tr>
      {showSubs && (
        <tr>
          <td colSpan={colSpan} className="px-0 py-0">
            <div className="mx-6 mb-2 rounded-lg border border-orange-100 dark:border-orange-900/30 bg-white dark:bg-slate-900 overflow-hidden">
              {kpi.submissions.length === 0 ? (
                <div className="px-4 py-2 text-[11px] text-slate-400 font-semibold">Chưa có bài nộp</div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-[8px] font-black uppercase text-orange-400 border-b border-orange-100 dark:border-orange-900/30">
                      <th className="px-4 py-1.5 text-right">Giá trị thực tế</th>
                      <th className="px-4 py-1.5 text-left">Thời gian nộp</th>
                      <th className="px-4 py-1.5 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50 dark:divide-orange-900/20">
                    {kpi.submissions.map((s, i) => (
                      <tr key={i}>
                        <td className="px-4 py-1.5 text-right font-bold text-slate-700 dark:text-slate-300">{s.actualValue.toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {s.submittedAt ? format(new Date(s.submittedAt), 'dd/MM/yyyy HH:mm') : '—'}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black',
                            s.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                            s.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            {s.status === 'APPROVED' ? 'Đã duyệt' : s.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  )
}

function MemberRiskExpandedRow({ userId, orgUnitId, colSpan }: { userId: string; orgUnitId?: string; colSpan: number }) {
  const { data, isFetching } = useQuery({
    queryKey: ['orgUnitKpi', 'risks', 'memberOverdue', userId, orgUnitId],
    queryFn: () => orgUnitKpiApi.getMemberOverdueKpis(userId, orgUnitId),
  })
  const kpis = (data || []) as OverdueKpiForMember[]
  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="mx-4 mb-3 rounded-xl border border-orange-100 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-900/10 overflow-hidden">
          {isFetching ? (
            <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Đang tải...</div>
          ) : kpis.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 font-semibold">Không có KPI trễ hạn</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[9px] font-black uppercase text-orange-400 border-b border-orange-100 dark:border-orange-900/40">
                  <th className="px-3 py-2 w-8" />
                  <th className="px-4 py-2 text-left">Tên KPI</th>
                  <th className="px-4 py-2 text-left">Hạn chót</th>
                  <th className="px-4 py-2 text-right">Mục tiêu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100/60 dark:divide-orange-900/20">
                {kpis.map((k) => (
                  <MemberOverdueKpiRow key={k.kpiId} kpi={k} colSpan={4} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  )
}

function WarningListSection({ orgUnitId, from, to, onlyApproved, periodId, isEditMode, widget, onTogglePin }: { orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; isEditMode?: boolean; widget: SummaryWidget; onTogglePin: (w: SummaryWidget) => void }) {
  const [page, setPage] = React.useState(0)
  const [sortBy, setSortBy] = React.useState<RiskSortField>('progress')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [filterOrgUnitId, setFilterOrgUnitId] = React.useState<string | undefined>(undefined)
  const [expandedMember, setExpandedMember] = React.useState<string | null>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['orgUnitKpi', 'risks', 'members', orgUnitId, from, to, onlyApproved, periodId, filterOrgUnitId, page, sortBy, sortDir],
    queryFn: () => orgUnitKpiApi.getMemberRisks({ orgUnitId, from, to, onlyApproved, periodId, filterOrgUnitId, page, size: 5, sortBy, sortDir }),
    placeholderData: (prev) => prev,
  })

  const toggleSort = (field: RiskSortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
    setPage(0)
  }

  const rows = (data?.content || []) as MemberRiskRow[]
  const filterUnits = data?.availableOrgUnits || []

  return (
    <ChartWrapper
      title="Rủi ro thành viên"
      icon={<AlertCircle size={20} className="text-orange-500" />}
      widget={widget} onTogglePin={onTogglePin} isEditMode={!!isEditMode}
      extraHeaderContent={
        filterUnits.length > 0 ? (
          <select
            className="h-8 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 max-w-[160px]"
            value={filterOrgUnitId || ''}
            onChange={e => { setFilterOrgUnitId(e.target.value || undefined); setPage(0) }}
          >
            <option value="">Tất cả đơn vị</option>
            {filterUnits.map(u => <UnitSelectOption key={u.code} o={u} />)}
          </select>
        ) : undefined
      }
    >
      <div className="flex-1 flex flex-col gap-3">
        <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-[9px] font-black uppercase text-slate-400">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left">Thành viên</th>
                <th className="px-4 py-3 text-left">Đơn vị</th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="overdueCount" active={sortBy} dir={sortDir} onToggle={toggleSort}>Trễ hạn</RiskSortBtn>
                </th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="overdueRate" active={sortBy} dir={sortDir} onToggle={toggleSort}>Tỉ lệ trễ</RiskSortBtn>
                </th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="progress" active={sortBy} dir={sortDir} onToggle={toggleSort}>Tiến độ TB</RiskSortBtn>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isFetching ? (
                <TableSkeletonRows cols={6} count={5} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-bold">Không có dữ liệu rủi ro</td></tr>
              ) : rows.map((r) => (
                <React.Fragment key={r.userId}>
                  <tr className="hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors">
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setExpandedMember(expandedMember === r.userId ? null : r.userId)}
                        className={cn('p-1 rounded-lg transition-all', expandedMember === r.userId ? 'bg-orange-100 text-orange-600' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50')}
                      >
                        <ChevronDown size={13} className={cn('transition-transform', expandedMember === r.userId && 'rotate-180')} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.avatarUrl
                          ? <img src={r.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-[10px] font-black text-orange-600 flex-shrink-0">{r.fullName.charAt(0).toUpperCase()}</div>
                        }
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[90px]">{r.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[80px] text-[10px]">{r.orgUnitName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md font-black">{r.overdueCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('font-black', r.overdueRate > 50 ? 'text-red-600' : r.overdueRate > 20 ? 'text-amber-600' : 'text-slate-500')}>{r.overdueRate.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', r.avgProgress >= 80 ? 'bg-emerald-500' : r.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                            style={{ width: `${Math.min(r.avgProgress, 100)}%` }} />
                        </div>
                        <span className={cn('font-black text-[11px]', r.avgProgress >= 80 ? 'text-emerald-600' : r.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600')}>{r.avgProgress.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                  {expandedMember === r.userId && <MemberRiskExpandedRow userId={r.userId} orgUnitId={orgUnitId} colSpan={6} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 0) > 1 && (
          <Pagination currentPage={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} totalElements={data?.totalElements ?? 0} size={5} itemLabel="thành viên" />
        )}
      </div>
    </ChartWrapper>
  )
}

function EmployeeRankingTableSection({ orgUnitId, from, to, onlyApproved, periodId, isEditMode, widget, onTogglePin }: { orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; isEditMode?: boolean; widget: SummaryWidget; onTogglePin: (w: SummaryWidget) => void }) {
  const [rankingUnitId, setRankingUnitId] = useState<string | undefined>(undefined)
  const [sf, setSf] = useState<keyof RankingItem>('performance')
  const [sd, setSd] = useState<'ASC' | 'DESC'>('DESC')
  const [rankPage, setRankPage] = useState(0)
  const RANK_PAGE_SIZE = 5

  const { data, isFetching } = useSummaryRankings(orgUnitId, rankingUnitId, from, to, onlyApproved, periodId);

  const processedRankings = useMemo(() => {
    if (!data?.rankings) return []
    const result = [...data.rankings]
    result.sort((a, b) => {
      const aVal = (a[sf] ?? 0) as number; const bVal = (b[sf] ?? 0) as number
      return sd === 'ASC' ? aVal - bVal : bVal - aVal
    })
    return result
  }, [data?.rankings, sf, sd])

  const pagedRankings = useMemo(() => {
    return processedRankings.slice(rankPage * RANK_PAGE_SIZE, (rankPage + 1) * RANK_PAGE_SIZE)
  }, [processedRankings, rankPage])

  const totalRankPages = Math.ceil(processedRankings.length / RANK_PAGE_SIZE)

  const handleSort = (field: keyof RankingItem) => {
    if (sf === field) setSd(prev => prev === 'ASC' ? 'DESC' : 'ASC')
    else { setSf(field); setSd('DESC') }
    setRankPage(0)
  }

  const sortIcon = (field: keyof RankingItem) => sf === field
    ? (sd === 'DESC' ? <ArrowDownRight size={10} className="inline ml-1" /> : <ArrowUpRight size={10} className="inline ml-1" />)
    : <ArrowUpDown size={10} className="inline ml-1 opacity-30" />

  return (
    <ChartWrapper
      title="Bảng xếp hạng nhân sự"
      icon={<Medal size={20} className="text-indigo-600" />}
      widget={widget} onTogglePin={onTogglePin} isEditMode={!!isEditMode}
      extraHeaderContent={
        <div className="relative">
          <select
            value={rankingUnitId || ''}
            onChange={e => { setRankingUnitId(e.target.value || undefined); setRankPage(0) }}
            className="appearance-none pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm max-w-[200px]"
          >
            <option value="">Tất cả đơn vị</option>
            {(data?.rankingOptions || []).map((opt: any) => (
              <UnitSelectOption key={opt.id} o={{ code: opt.id, name: opt.name, depth: opt.depth }} />
            ))}
          </select>
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-3">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4">Hạng</th>
                <th className="px-6 py-4">Nhân viên</th>
                <th className="px-6 py-4">Đơn vị</th>
                <th className="px-6 py-4 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('performance')}>
                  Hiệu suất {sortIcon('performance')}
                </th>
                <th className="px-6 py-4 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('avgProgress')}>
                  Tiến độ trung bình {sortIcon('avgProgress')}
                </th>
                <th className="px-6 py-4 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('score')}>
                  Điểm đánh giá TB {sortIcon('score')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isFetching ? (
                <TableSkeletonRows cols={6} count={5} />
              ) : pagedRankings.map((item, i) => {
                const globalRank = rankPage * RANK_PAGE_SIZE + i
                return (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs",
                        globalRank === 0 ? "bg-amber-500 text-white shadow-lg shadow-amber-200" :
                        globalRank === 1 ? "bg-slate-400 text-white" :
                        globalRank === 2 ? "bg-orange-400 text-white" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      )}>{globalRank + 1}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center font-black text-indigo-600 text-xs">{getInitials(item.name)}</div>
                        <p className="font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{item.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-500 text-xs">{item.subText}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("px-3 py-1 rounded-full text-xs font-black",
                        item.performance >= 80 ? "bg-emerald-50 text-emerald-600" :
                        item.performance >= 50 ? "bg-amber-50 text-amber-600" :
                        "bg-red-50 text-red-600"
                      )}>{item.performance.toFixed(1)}%</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full',
                            item.avgProgress >= 80 ? 'bg-emerald-500' :
                            item.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          )} style={{ width: `${Math.min(item.avgProgress, 100)}%` }} />
                        </div>
                        <span className={cn('font-black text-xs',
                          item.avgProgress >= 80 ? 'text-emerald-600' :
                          item.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600'
                        )}>{item.avgProgress.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{item.score.toFixed(1)}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {pagedRankings.length === 0 && !isFetching && (
            <div className="py-16 text-center text-slate-400 font-bold italic">Không có dữ liệu xếp hạng</div>
          )}
        </div>
        {totalRankPages > 1 && (
          <Pagination currentPage={rankPage} totalPages={totalRankPages} onPageChange={setRankPage} totalElements={processedRankings.length} size={RANK_PAGE_SIZE} itemLabel="nhân viên" />
        )}
      </div>
    </ChartWrapper>
  );
}

