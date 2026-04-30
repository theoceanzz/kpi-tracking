import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useSummaryStats, useSummaryTrend, useSummaryComparison, useSummaryRisks, useSummaryRankings } from '../hooks/useAnalytics'
import { cn, getInitials } from '@/lib/utils'
import { 
  Target, Star, AlertCircle, Users, TrendingUp, BarChart3, PieChart as PieChartIcon, 
  ChevronRight, AlertTriangle, Trophy, Medal, ArrowUpRight, ArrowDownRight, Layers,
  ChevronDown, Filter, SortDesc, SortAsc, ArrowUpDown, Loader2, Calendar,
  Settings2, Save, RotateCcw, Plus, Layout, X, Eye, EyeOff, GripVertical, Trash2
} from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { CopyButton } from '@/components/common/CopyButton'
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import { reportApi } from '@/features/reports/api/reportApi'
import type { RankingItem } from '@/types/stats'

const ResponsiveGridLayout = WidthProvider(Responsive)
const CONFIG_REPORT_NAME = '__SUMMARY_DASHBOARD_CONFIG__'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const TREND_PERIODS = [
  { label: 'Tất cả', value: 'ALL' },
  { label: '5 ngày gần đây', value: '5_DAYS' },
  { label: '5 tuần gần đây', value: '5_WEEKS' },
  { label: '5 tháng gần đây', value: '5_MONTHS' },
];

const STANDARD_PERIODS = [
  { label: 'Tất cả', value: 'ALL' },
  { label: 'Hôm nay', value: 'TODAY' },
  { label: 'Tuần này', value: 'WEEK' },
  { label: 'Tháng này', value: 'MONTH' },
  { label: 'Quý này', value: 'QUARTER' },
  { label: '6 tháng', value: 'HALF_YEAR' },
  { label: 'Năm nay', value: 'YEAR' },
];

export type SummaryWidgetType = 
  | 'OVERVIEW_CARDS'
  | 'TREND_CHART'
  | 'TOP_UNITS'
  | 'UNIT_PERFORMANCE'
  | 'UNIT_KPI'
  | 'MEMBER_DIST'
  | 'ROLE_DIST'
  | 'UNIT_RISK'
  | 'WARNING_LIST'
  | 'KPI_PODIUM'
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
}

const DEFAULT_SUMMARY_WIDGETS: SummaryWidget[] = [
  { i: 'overview', type: 'OVERVIEW_CARDS', title: 'Chỉ số tổng quan', x: 0, y: 0, w: 12, h: 6, visible: true },
  { i: 'trend', type: 'TREND_CHART', title: 'Xu hướng hiệu suất', x: 0, y: 6, w: 8, h: 12, visible: true },
  { i: 'top-units', type: 'TOP_UNITS', title: 'Đơn vị tiêu biểu', x: 8, y: 6, w: 4, h: 12, visible: true },
  { i: 'unit-perf', type: 'UNIT_PERFORMANCE', title: 'Hiệu suất đơn vị', x: 0, y: 18, w: 6, h: 10, visible: true },
  { i: 'unit-kpi', type: 'UNIT_KPI', title: 'KPI đơn vị', x: 6, y: 18, w: 6, h: 10, visible: true },
  { i: 'member-dist', type: 'MEMBER_DIST', title: 'Phân bổ nhân sự', x: 0, y: 28, w: 6, h: 10, visible: true },
  { i: 'role-dist', type: 'ROLE_DIST', title: 'Phân bổ vai trò', x: 6, y: 28, w: 6, h: 10, visible: true },
  { i: 'unit-risk', type: 'UNIT_RISK', title: 'Rủi ro đơn vị', x: 0, y: 38, w: 6, h: 14, visible: true },
  { i: 'warning-list', type: 'WARNING_LIST', title: 'Warning List', x: 6, y: 38, w: 6, h: 14, visible: true },
  { i: 'podium', type: 'KPI_PODIUM', title: 'Bục vinh danh', x: 0, y: 52, w: 12, h: 12, visible: true },
  { i: 'rank-table', type: 'RANKING_TABLE', title: 'Bảng xếp hạng', x: 0, y: 64, w: 12, h: 18, visible: true },
]

export default function SummaryTab() {
  const [selectedUnitId] = useState<string | undefined>(undefined)
  const { data: mainData, isLoading: isMainLoading } = useSummaryStats(selectedUnitId)
  
  const [isEditMode, setIsEditMode] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [widgets, setWidgets] = useState<SummaryWidget[]>(DEFAULT_SUMMARY_WIDGETS)
  const [configReportId, setConfigReportId] = useState<string | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const reports = await reportApi.getAll({ size: 100 })
        const configReport = reports.content.find(r => r.name === CONFIG_REPORT_NAME)
        
        if (configReport) {
          setConfigReportId(configReport.id)
          if (configReport.widgets && configReport.widgets.length > 0) {
            const savedWidgets = configReport.widgets.map(sw => {
              try {
                const pos = JSON.parse(sw.position)
                const cfg = JSON.parse(sw.chartConfig)
                const def = DEFAULT_SUMMARY_WIDGETS.find(dw => dw.i === cfg.i)
                
                return { 
                  ...(def || {}), 
                  ...pos, 
                  ...cfg, 
                  id: sw.id,
                  i: cfg.i || sw.id,
                  type: sw.widgetType as SummaryWidgetType,
                  title: sw.title,
                  visible: cfg.visible !== false
                } as SummaryWidget
              } catch { return null }
            }).filter(Boolean) as SummaryWidget[]

            setWidgets(savedWidgets)
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
        widgetType: w.type,
        title: w.title,
        position: JSON.stringify({ x: w.x, y: w.y, w: w.w, h: w.h }),
        chartConfig: JSON.stringify({ i: w.i, visible: w.visible }),
        widgetOrder: index
      }))

      if (configReportId) {
        await reportApi.update(configReportId, { widgets: widgetRequests })
      } else {
        const newReport = await reportApi.create({
          name: CONFIG_REPORT_NAME,
          description: 'Cấu hình giao diện thống kê tổng hợp'
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
      setWidgets(DEFAULT_SUMMARY_WIDGETS)
    }
  }

  const handleLayoutChange = (newLayout: any[]) => {
    setWidgets(prev => prev.map(item => {
      const updated = newLayout.find(l => l.i === item.i)
      return updated ? { ...item, x: updated.x, y: updated.y, w: updated.w, h: updated.h } : item
    }))
  }

  const deleteWidget = (i: string) => {
    setWidgets(prev => prev.filter(w => w.i !== i))
  }

  const addWidget = (template: SummaryWidget) => {
    const exists = widgets.some(w => w.type === template.type)
    if (exists) {
      alert("Biểu đồ này đã có trên trang")
      return
    }

    // Find a good spot at the bottom
    const maxY = widgets.length > 0 ? Math.max(...widgets.map(w => w.y + w.h)) : 0
    
    setWidgets(prev => [...prev, { 
      ...template, 
      y: maxY, 
      visible: true 
    }])
    setIsAddModalOpen(false)
  }

  const renderWidgetContent = (widget: SummaryWidget) => {
    const DistributionWrapper = ({ children, title, icon }: { children: React.ReactNode, title: string, icon: React.ReactNode }) => {
      const sectionRef = useRef<HTMLDivElement>(null)
      return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col" ref={sectionRef}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">{icon} {title}</h3>
            {!isEditMode && <CopyButton targetRef={sectionRef} />}
          </div>
          {children}
        </div>
      )
    }

    switch (widget.type) {
      case 'OVERVIEW_CARDS':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full">
            <StatCard title="Tỷ lệ hoàn thành KPI" value={`${mainData?.kpiCompletionRate.toFixed(1)}%`} icon={<Target className="text-indigo-600" />} trend="+2.5%" trendType="up" color="indigo" />
            <StatCard title="Điểm hiệu suất TB" value={mainData?.avgPerformanceScore.toFixed(1)} icon={<Star className="text-emerald-600" />} trend="+0.3" trendType="up" color="emerald" />
            <StatCard title="Tỷ lệ KPI quá hạn" value={`${mainData?.overdueKpiRate.toFixed(1)}%`} icon={<AlertCircle className="text-red-600" />} trend="-1.2%" trendType="down" color="red" />
            <StatCard title="Tổng nhân sự" value={mainData?.totalMembers.toString()} icon={<Users className="text-amber-600" />} trend="Toàn hệ thống" trendType="neutral" color="amber" />
          </div>
        )
      case 'TREND_CHART': return <TrendSection orgUnitId={selectedUnitId} isEditMode={isEditMode} />
      case 'TOP_UNITS': return <TopUnitsSection orgUnitId={selectedUnitId} isEditMode={isEditMode} />
      case 'UNIT_PERFORMANCE': return <UnitPerformanceSection orgUnitId={selectedUnitId} isEditMode={isEditMode} />
      case 'UNIT_KPI': return <UnitKpiSection orgUnitId={selectedUnitId} isEditMode={isEditMode} />
      case 'MEMBER_DIST': {
        return (
          <DistributionWrapper title="Số lượng nhân sự" icon={<PieChartIcon size={20} className="text-purple-600" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center flex-1">
              <div className="h-full min-h-[200px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={mainData?.memberDistribution || []} innerRadius="50%" outerRadius="80%" paddingAngle={5} dataKey="value">{(mainData?.memberDistribution || []).map((entry: any, index: number) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <div className="space-y-3">{(mainData?.memberDistribution || []).map((entry: any, index: number) => (<div key={entry.name} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="text-xs font-bold text-slate-500">{entry.name}</span></div><span className="text-xs font-black text-slate-900 dark:text-white">{entry.value} người</span></div>))}</div>
            </div>
          </DistributionWrapper>
        )
      }
      case 'ROLE_DIST': {
        return (
          <DistributionWrapper title="Phân bổ vai trò" icon={<Layers size={20} className="text-orange-500" />}>
            <div className="flex-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={mainData?.roleDistribution || []} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} /><YAxis dataKey="unitName" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} width={80} /><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, paddingTop: '10px' }} /><Bar dataKey="directorCount" stackId="a" fill="#6366f1" name="Giám đốc" barSize={15} /><Bar dataKey="headCount" stackId="a" fill="#f59e0b" name="Trưởng phòng" /><Bar dataKey="staffCount" stackId="a" fill="#94a3b8" name="Nhân viên" /></BarChart></ResponsiveContainer></div>
          </DistributionWrapper>
        )
      }
      case 'UNIT_RISK': return <UnitRiskSection orgUnitId={selectedUnitId} isEditMode={isEditMode} />
      case 'WARNING_LIST': return <WarningListSection orgUnitId={selectedUnitId} isEditMode={isEditMode} />
      case 'KPI_PODIUM': return <KpiPodiumSection orgUnitId={selectedUnitId} isEditMode={isEditMode} />
      case 'RANKING_TABLE': return <EmployeeRankingTableSection orgUnitId={selectedUnitId} isEditMode={isEditMode} />
      default: return null
    }
  }

  if (isMainLoading && !mainData) return <div className="p-8"><LoadingSkeleton rows={10} /></div>
  if (!mainData) return <div className="text-center py-16 text-slate-400 font-bold">Không tìm thấy dữ liệu thống kê</div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Thống kê tổng hợp</h2>
        <div className="flex items-center gap-3">
          {isEditMode ? (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-1 rounded-xl border border-indigo-100 dark:border-indigo-800">
              <button onClick={resetLayout} className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400" title="Đặt lại mặc định"><RotateCcw size={18} /></button>
              <button onClick={() => setIsConfigOpen(true)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg flex items-center gap-2">
                <Layout size={14} /> Ẩn/Hiện
              </button>
              <button onClick={() => setIsAddModalOpen(true)} className="px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg flex items-center gap-2">
                <Plus size={14} /> Thêm biểu đồ
              </button>
              <div className="w-px h-4 bg-indigo-200 dark:bg-indigo-800 mx-1" />
              <button onClick={() => setIsEditMode(false)} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700">Huỷ</button>
              <button onClick={saveConfig} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2">
                <Save size={14} /> Lưu
              </button>
            </div>
          ) : (
            <button onClick={() => setIsEditMode(true)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 shadow-sm transition-all">
              <Settings2 size={16} /> Tuỳ chỉnh
            </button>
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
          rowHeight={32}
          compactType="vertical"
          draggableHandle=".drag-handle"
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={(current, all) => {
            if (isEditMode) {
              if (all.lg) handleLayoutChange(all.lg as any)
              else handleLayoutChange(current as any)
            }
          }}
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
                  <button 
                    onClick={() => deleteWidget(block.i)}
                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 z-[60] bg-red-500 text-white p-1.5 rounded-xl shadow-lg hover:bg-red-600 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
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

      {/* Add Widget Modal */}
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
                  <button
                    key={template.i}
                    disabled={isAlreadyAdded}
                    onClick={() => addWidget(template)}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-2xl border text-left transition-all group",
                      isAlreadyAdded 
                        ? "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed" 
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-xl hover:-translate-y-1"
                    )}
                  >
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", isAlreadyAdded ? "bg-slate-200 text-slate-400" : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 group-hover:scale-110 transition-transform")}>
                      {template.type === 'TREND_CHART' && <TrendingUp size={24} />}
                      {template.type === 'TOP_UNITS' && <Trophy size={24} />}
                      {template.type === 'MEMBER_DIST' && <Users size={24} />}
                      {template.type === 'ROLE_DIST' && <Layers size={24} />}
                      {template.type === 'UNIT_RISK' && <AlertTriangle size={24} />}
                      {template.type === 'WARNING_LIST' && <AlertCircle size={24} />}
                      {template.type === 'KPI_PODIUM' && <Medal size={24} />}
                      {template.type === 'RANKING_TABLE' && <Star size={24} />}
                      {['OVERVIEW_CARDS', 'UNIT_PERFORMANCE', 'UNIT_KPI'].includes(template.type) && <Layout size={24} />}
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
              <button onClick={() => setIsAddModalOpen(false)} className="px-8 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-black text-sm hover:bg-slate-200 transition-all">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- SUB-COMPONENTS ---

function TrendSection({ orgUnitId, isEditMode }: { orgUnitId?: string, isEditMode?: boolean }) {
  const [period, setPeriod] = useState('ALL');
  const { data, isFetching } = useSummaryTrend(orgUnitId, period);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sectionRef} className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden h-full">
      <SectionLoader isFetching={isFetching} message="Đang cập nhật xu hướng..." />
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><TrendingUp size={20} className="text-indigo-600" /> Xu hướng hiệu suất</h3>
        <div className="flex items-center gap-3">
          {!isEditMode && <CopyButton targetRef={sectionRef} />}
          <PeriodSelect value={period} onChange={setPeriod} options={TREND_PERIODS} />
        </div>
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data || []}>
            <defs><linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 700 }} />
            <Area type="monotone" dataKey="performance" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorPerf)" name="Hiệu suất (%)" />
            <Area type="monotone" dataKey="kpiCompletion" stroke="#10b981" strokeWidth={4} fillOpacity={0} name="Hoàn thành KPI (%)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TopUnitsSection({ orgUnitId, isEditMode }: { orgUnitId?: string, isEditMode?: boolean }) {
  const [period, setPeriod] = useState('ALL');
  const { data, isFetching } = useSummaryComparison(orgUnitId, period);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sectionRef} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col h-full">
      <SectionLoader isFetching={isFetching} message="Cập nhật đơn vị..." />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><Trophy size={20} className="text-amber-500" /> Đơn vị tiêu biểu</h3>
        <div className="flex items-center gap-3">
          {!isEditMode && <CopyButton targetRef={sectionRef} />}
          <PeriodSelect value={period} onChange={setPeriod} options={STANDARD_PERIODS} />
        </div>
      </div>
      <div className="space-y-5 flex-1">
        {(data?.topPerformingUnits || []).map((unit: any, i: number) => (
          <div key={unit.unitName} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-indigo-200 transition-all">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm", i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-slate-200 text-slate-600" : "bg-orange-100 text-orange-600")}>#{i + 1}</div>
            <div className="flex-1">
              <p className="font-black text-sm text-slate-800 dark:text-white">{unit.unitName}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${unit.performance}%` }} /></div>
                <span className="text-[10px] font-black text-indigo-600">{unit.performance.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        ))}
        {(data?.topPerformingUnits || []).length === 0 && <div className="h-full flex items-center justify-center text-xs font-bold text-slate-300 italic">Không có dữ liệu</div>}
      </div>
    </div>
  );
}

function UnitPerformanceSection({ orgUnitId, isEditMode }: { orgUnitId?: string, isEditMode?: boolean }) {
  const [period, setPeriod] = useState('ALL');
  const { data, isFetching } = useSummaryComparison(orgUnitId, period);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sectionRef} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden h-full">
      <SectionLoader isFetching={isFetching} message="Đang cập nhật..." />
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><TrendingUp size={20} className="text-emerald-500" /> Hiệu suất giữa các đơn vị</h3>
        <div className="flex items-center gap-3">
          {!isEditMode && <CopyButton targetRef={sectionRef} />}
          <PeriodSelect value={period} onChange={setPeriod} options={STANDARD_PERIODS} />
        </div>
      </div>
      <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data?.topPerformingUnits || []}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="unitName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} /><YAxis dataKey="performance" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} /><Tooltip /><Area type="monotone" dataKey="performance" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={3} name="Hiệu suất:" /></AreaChart></ResponsiveContainer></div>
    </div>
  );
}

function UnitKpiSection({ orgUnitId, isEditMode }: { orgUnitId?: string, isEditMode?: boolean }) {
  const [period, setPeriod] = useState('ALL');
  const { data, isFetching } = useSummaryComparison(orgUnitId, period);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sectionRef} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden h-full">
      <SectionLoader isFetching={isFetching} message="Đang cập nhật..." />
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><BarChart3 size={20} className="text-indigo-600" /> KPI giữa các đơn vị</h3>
        <div className="flex items-center gap-3">
          {!isEditMode && <CopyButton targetRef={sectionRef} />}
          <PeriodSelect value={period} onChange={setPeriod} options={STANDARD_PERIODS} />
        </div>
      </div>
      <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.unitKpiData || []}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="unitName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} /><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, paddingTop: '20px' }} /><Bar dataKey="totalKpi" fill="#6366f1" radius={[4, 4, 0, 0]} name="Tổng KPI" barSize={20} /><Bar dataKey="approvedKpi" fill="#10b981" radius={[4, 4, 0, 0]} name="Đã duyệt" barSize={20} /></BarChart></ResponsiveContainer></div>
    </div>
  );
}

function UnitRiskSection({ orgUnitId, isEditMode }: { orgUnitId?: string, isEditMode?: boolean }) {
  const [period, setPeriod] = useState('ALL');
  const { data, isFetching } = useSummaryRisks(orgUnitId, period);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sectionRef} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden h-full">
      <SectionLoader isFetching={isFetching} message="Đang cập nhật rủi ro..." />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><AlertTriangle size={20} className="text-red-500" /> Rủi ro đơn vị</h3>
        <div className="flex items-center gap-3">
          {!isEditMode && <CopyButton targetRef={sectionRef} />}
          <PeriodSelect value={period} onChange={setPeriod} options={STANDARD_PERIODS} />
        </div>
      </div>
      <div className="h-[250px] mb-6"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.unitRisks || []} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#fef2f2" /><XAxis type="number" hide domain={[0, 100]} /><YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#ef4444' }} /><Tooltip /><Bar dataKey="performance" fill="#ef4444" radius={[0, 4, 4, 0]} name="Hiệu suất (%)" barSize={12} /></BarChart></ResponsiveContainer></div>
      <div className="space-y-3">{(data?.unitRisks || []).map((risk: any, i: number) => (<div key={i} className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20"><span className="text-xs font-black text-slate-800 dark:text-white">{risk.name}</span><span className="text-xs font-black text-red-600">{risk.performance.toFixed(1)}%</span></div>))}</div>
    </div>
  );
}

function WarningListSection({ orgUnitId, isEditMode }: { orgUnitId?: string, isEditMode?: boolean }) {
  const [period, setPeriod] = useState('ALL');
  const { data, isFetching } = useSummaryRisks(orgUnitId, period);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sectionRef} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden h-full">
      <SectionLoader isFetching={isFetching} message="Đang cập nhật Warning..." />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><AlertCircle size={20} className="text-orange-500" /> Warning List</h3>
        <div className="flex items-center gap-3">
          {!isEditMode && <CopyButton targetRef={sectionRef} />}
          <PeriodSelect value={period} onChange={setPeriod} options={STANDARD_PERIODS} />
        </div>
      </div>
      <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-2xl">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr className="text-[9px] font-black uppercase text-slate-400">
              <th className="px-4 py-3 text-left">Nhân viên</th>
              <th className="px-4 py-3 text-center">Trễ hạn</th>
              <th className="px-4 py-3 text-center">Hiệu suất</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(data?.userRisks || []).map((risk: any, i: number) => (
              <tr key={i} className="hover:bg-red-50/30 transition-colors">
                <td className="px-4 py-3 font-bold">{risk.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md font-black">{risk.overdueCount}</span>
                </td>
                <td className="px-4 py-3 text-center font-black text-slate-500">
                  <span>{risk.performance.toFixed(1)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiPodiumSection({ orgUnitId, isEditMode }: { orgUnitId?: string, isEditMode?: boolean }) {
  const [period, setPeriod] = useState('ALL');
  const { data, isFetching } = useSummaryRankings(orgUnitId, undefined, period);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sectionRef} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative h-full">
      <SectionLoader isFetching={isFetching} message="Đang cập nhật bục vinh danh..." />
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><Medal size={20} className="text-amber-500" /> Xếp hạng số KPI hoàn thành</h3>
        <div className="flex items-center gap-3">
          {!isEditMode && <CopyButton targetRef={sectionRef} />}
          <PeriodSelect value={period} onChange={setPeriod} options={STANDARD_PERIODS} />
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-0 pb-6">
        {(data?.kpiRankings || [])[1] && <PodiumStep item={data.kpiRankings[1]} rank={2} height="h-40" color="bg-slate-300" textColor="text-slate-600" />}
        {(data?.kpiRankings || [])[0] && <PodiumStep item={data.kpiRankings[0]} rank={1} height="h-56" color="bg-amber-400" textColor="text-amber-800" />}
        {(data?.kpiRankings || [])[2] && <PodiumStep item={data.kpiRankings[2]} rank={3} height="h-32" color="bg-orange-400" textColor="text-orange-900" />}
        {(data?.kpiRankings || []).length === 0 && <div className="text-slate-400 font-bold py-10 w-full text-center">Chưa có dữ liệu xếp hạng</div>}
      </div>
    </div>
  );
}

function EmployeeRankingTableSection({ orgUnitId, isEditMode }: { orgUnitId?: string, isEditMode?: boolean }) {
  const [period, setPeriod] = useState('ALL');
  const [rankingUnitId, setRankingUnitId] = useState<string | undefined>(undefined)
  const [displayOrder, setDisplayOrder] = useState<'BEST' | 'WORST'>('BEST')
  const [sortField, setSortField] = useState<keyof RankingItem>('score')
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC')
  const sectionRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useSummaryRankings(orgUnitId, rankingUnitId, period);

  const processedRankings = useMemo(() => {
    if (!data?.rankings) return []
    let result = [...data.rankings]
    result.sort((a, b) => {
      const aVal = a[sortField] || 0
      const bVal = b[sortField] || 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'ASC' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDirection === 'ASC' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    if (displayOrder === 'WORST' && sortField === 'score' && sortDirection === 'DESC') {
        result.sort((a, b) => a.score - b.score)
    }
    return result.slice(0, 10)
  }, [data?.rankings, sortField, sortDirection, displayOrder])

  const handleSort = (field: keyof RankingItem) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortField(field)
      setSortDirection('DESC')
    }
  }

  return (
    <section ref={sectionRef} className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative h-full">
      <SectionLoader isFetching={isFetching} message="Đang lọc bảng xếp hạng..." />
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-50/50 dark:bg-slate-800/30">
        <div><h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><Medal size={20} className="text-indigo-600" /> Bảng xếp hạng hiệu suất nhân sự</h3><p className="text-xs font-bold text-slate-400 mt-1">Sắp xếp theo các cột dữ liệu quan trọng</p></div>
        <div className="flex flex-wrap items-center gap-3">
          {!isEditMode && <CopyButton targetRef={sectionRef} />}
          <PeriodSelect value={period} onChange={setPeriod} options={STANDARD_PERIODS} />
          <div className="relative"><select value={rankingUnitId || ''} onChange={(e) => setRankingUnitId(e.target.value || undefined)} className="appearance-none pl-10 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">{(data?.rankingOptions || []).map((opt: any) => (<option key={opt.id} value={opt.id}>{opt.name}</option>))}</select><Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" /></div>
          <button onClick={() => setDisplayOrder(prev => prev === 'BEST' ? 'WORST' : 'BEST')} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all shadow-sm border", displayOrder === 'BEST' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100")}>{displayOrder === 'BEST' ? <SortDesc size={14} /> : <SortAsc size={14} />} {displayOrder === 'BEST' ? 'Hạng tốt nhất' : 'Hạng yếu nhất'}</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800"><th className="px-8 py-5 text-left">Hạng</th><th className="px-8 py-5 text-left cursor-pointer hover:text-indigo-600" onClick={() => handleSort('name')}>Nhân viên {sortField === 'name' && <ArrowUpDown size={10} className="inline ml-1" />}</th><th className="px-8 py-5 text-left cursor-pointer hover:text-indigo-600" onClick={() => handleSort('subText')}>Đơn vị {sortField === 'subText' && <ArrowUpDown size={10} className="inline ml-1" />}</th><th className="px-8 py-5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('performance')}>Hiệu suất {sortField === 'performance' && <ArrowUpDown size={10} className="inline ml-1" />}</th><th className="px-8 py-5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('score')}>Điểm TB {sortField === 'score' && <ArrowUpDown size={10} className="inline ml-1" />}</th><th className="px-8 py-5"></th></tr></thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">{processedRankings.map((item, i) => (<tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"><td className="px-8 py-5"><div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs", displayOrder === 'BEST' ? (i === 0 ? "bg-amber-500 text-white shadow-lg shadow-amber-200" : i === 1 ? "bg-slate-400 text-white shadow-lg shadow-slate-200" : i === 2 ? "bg-orange-400 text-white shadow-lg shadow-orange-200" : "bg-slate-100 dark:bg-slate-800 text-slate-400") : (i === 0 ? "bg-red-500 text-white shadow-lg shadow-red-200" : "bg-slate-100 dark:bg-slate-800 text-slate-400"))}>{i + 1}</div></td><td className="px-8 py-5"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center font-black text-indigo-600">{getInitials(item.name)}</div><div><p className="font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{item.name}</p></div></div></td><td className="px-8 py-5 font-bold text-slate-500">{item.subText}</td><td className="px-8 py-5 text-center"><span className={cn("px-3 py-1 rounded-full text-xs font-black", item.performance >= 80 ? "bg-emerald-50 text-emerald-600" : item.performance >= 50 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600")}>{item.performance.toFixed(1)}%</span></td><td className="px-8 py-5 text-center"><p className="text-sm font-black text-slate-900 dark:text-white">{item.score.toFixed(1)}</p></td><td className="px-8 py-5 text-right"><button className="p-2 rounded-xl text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"><ChevronRight size={18} /></button></td></tr>))}</tbody>
        </table>
        {processedRankings.length === 0 && <div className="py-20 text-center text-slate-400 font-bold italic">Không có dữ liệu xếp hạng cho đơn vị này</div>}
      </div>
    </section>
  );
}

// --- HELPER COMPONENTS ---

function SectionLoader({ isFetching, message }: { isFetching: boolean, message: string }) {
  if (!isFetching) return null;
  return (
    <div className="absolute inset-0 z-20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-300">
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-xl border border-slate-100 dark:border-slate-700">
        <Loader2 className="animate-spin text-indigo-600" size={16} />
        <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-wider">{message}</span>
      </div>
    </div>
  );
}

function PeriodSelect({ value, onChange, options }: { value: string, onChange: (v: string) => void, options: any[] }) {
  return (
    <div className="relative inline-block">
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-9 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-tight focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

function PodiumStep({ item, rank, height, color, textColor }: { item: RankingItem, rank: number, height: string, color: string, textColor: string }) {
  return (
    <div className={cn("flex flex-col items-center group transition-all hover:-translate-y-2", rank === 1 ? "z-10" : "z-0")}>
      <div className="mb-4 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden mb-2 mx-auto bg-slate-200 flex items-center justify-center font-black text-slate-400">{getInitials(item.name)}</div>
        <p className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[100px]">{item.name}</p>
        <p className="text-[10px] font-bold text-slate-400">{item.kpiCount} KPI</p>
      </div>
      <div className={cn("w-24 md:w-32 rounded-t-[20px] shadow-lg flex flex-col items-center justify-start pt-4 relative", height, color)}>
        <span className={cn("text-3xl font-black opacity-40", textColor)}>#{rank}</span>
        {rank === 1 && <Trophy size={20} className="text-white/80 absolute -top-10 animate-bounce" />}
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, trend, trendType, color }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-7 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
      <div className="flex items-center justify-between mb-5">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500", color === 'indigo' ? "bg-indigo-50 dark:bg-indigo-900/20" : color === 'emerald' ? "bg-emerald-50 dark:bg-emerald-900/20" : color === 'red' ? "bg-red-50 dark:bg-red-900/20" : "bg-amber-50 dark:bg-amber-900/20")}>{icon}</div>
        <div className={cn("flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg", trendType === 'up' ? "bg-emerald-100 text-emerald-600" : trendType === 'down' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500")}>{trendType === 'up' && <ArrowUpRight size={12} />}{trendType === 'down' && <ArrowDownRight size={12} />}{trend}</div>
      </div>
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <h4 className="text-3xl font-black text-slate-900 dark:text-white">{value}</h4>
    </div>
  )
}

