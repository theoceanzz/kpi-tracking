import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { format, parseISO } from 'date-fns'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useAuthStore } from '@/store/authStore'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import { formatDateTime, FREQUENCY_MAP } from '@/lib/utils'
import type { KpiPeriod, KpiFrequency } from '@/types/kpi'
import {
  Calendar, CalendarRange, Plus, Pencil, Trash2, Clock,
  ChevronLeft, ChevronRight,
  Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, X, ArrowRight,
  LayoutGrid, List, Sparkles, Target
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/common/DateTimePicker'
import { cn } from '@/lib/utils'
import PageTour from '@/components/common/PageTour'
import { kpiPeriodsSteps } from '@/components/common/tourSteps'
import { useSearchParams } from 'react-router-dom'
import { useWorkflowNavigator, WORKFLOW_PARAMS } from '../workflow/hooks/useWorkflowNavigator'
import PeriodFormModal from '../components/PeriodFormModal'
import WizardEntryButton from '../setup/WizardEntryButton'

export default function KpiPeriodsPage() {
  const [searchParams] = useSearchParams()
  const { goToNext } = useWorkflowNavigator()

  // Bối cảnh do bước trước bàn giao: kỳ vừa tạo, và yêu cầu mở sẵn form.
  const incomingCycleId = searchParams.get(WORKFLOW_PARAMS.cycle)
  const openCreateOnArrival = searchParams.get(WORKFLOW_PARAMS.openCreate) === '1'

  const [showForm, setShowForm] = useState(openCreateOnArrival)
  const [editPeriod, setEditPeriod] = useState<KpiPeriod | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [periodType, setPeriodType] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState('startDate')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>(() => window.matchMedia('(max-width: 767px)').matches ? 'CARD' : 'TABLE')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')

  const debouncedKeyword = useDebounce(keyword, 500)
  
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId

  const { 
    data, isLoading, createPeriod, updatePeriod, deletePeriod,
    isCreating, isUpdating, isDeleting 
  } = useKpiPeriods({ 
    page, 
    size: pageSize, 
    organizationId,
    keyword: debouncedKeyword,
    periodType: periodType === 'ALL' ? undefined : periodType,
    startDate: startDateFilter ? new Date(startDateFilter).toISOString() : undefined,
    endDate: endDateFilter ? new Date(endDateFilter).toISOString() : undefined,
    sortBy,
    direction
  })

  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const rawTitle = ((customLabels as Record<string, string>)['/kpi-periods'] || 'Quản lý đợt')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  
  // Split title to style the last word or keep it as is
  const titleParts = rawTitle.trim().split(' ')
  const lastWord = titleParts.length > 1 ? titleParts.pop() : ''
  const mainTitle = titleParts.join(' ')

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setDirection(direction === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setDirection('desc')
    }
    setPage(0)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown size={14} className="opacity-20 group-hover:opacity-100 transition-opacity" />
    return direction === 'asc' ? <ArrowUp size={14} className="text-indigo-600 animate-in slide-in-from-bottom-1" /> : <ArrowDown size={14} className="text-indigo-600 animate-in slide-in-from-top-1" />
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deletePeriod(deleteId)
      setDeleteId(null)
    } catch (error) {}
  }

  const stats = useMemo(() => {
    if (!data) return { total: 0, monthly: 0, quarterly: 0, semiAnnually: 0 }
    const items = data.content || []
    return {
      total: data.totalElements || 0,
      monthly: items.filter(p => p.periodType === 'MONTHLY').length,
      quarterly: items.filter(p => p.periodType === 'QUARTERLY').length,
      semiAnnually: items.filter(p => p.periodType === 'SEMI_ANNUALLY').length,
    }
  }, [data])

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
        <PageTour pageKey="kpi-periods" steps={kpiPeriodsSteps} />
        
        {/* Header Section with Glass Card */}
        <div className="relative group" id="tour-periods-header">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-[40px] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                  <Sparkles size={12} className="animate-pulse" /> Cấu hình Hệ thống
                </div>
                <div className="space-y-0.5">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    {mainTitle} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{lastWord}</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl leading-relaxed">
                    Thiết lập chu kỳ đánh giá (Tháng, Quý, Năm) để triển khai mục tiêu.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex justify-center bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md rounded-[20px] border border-slate-200/60 dark:border-slate-700/60 p-1.5 shadow-inner group/stats">
                  <div className="px-6 py-2 text-center border-r border-slate-200 dark:border-slate-700">
                    <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.total}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tổng số đợt</p>
                  </div>
                  <div className="px-6 py-2 text-center">
                    <div className="flex items-center gap-2 justify-center text-indigo-600 dark:text-indigo-400">
                      <Target size={18} />
                      <p className="text-2xl font-black tracking-tighter">{stats.monthly + stats.quarterly + stats.semiAnnually}</p>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chu kỳ phổ biến</p>
                  </div>
                </div>

                <WizardEntryButton className="sm:shrink-0" />

                <button
                  onClick={() => { setEditPeriod(null); setShowForm(true) }}
                  className="cursor-pointer relative z-10 flex items-center justify-center gap-2 px-8 h-12 rounded-[20px] bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:shadow-indigo-500/40 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 group whitespace-nowrap sm:shrink-0"
                >
                  <Plus size={16} className="group-hover:rotate-90 transition-transform duration-500" />
                  Tạo đợt mới
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div id="tour-periods-toolbar" className="flex flex-col xl:flex-row items-stretch justify-between gap-4 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-3 flex-1">
            <div className="flex items-center gap-3 w-full md:max-w-md">
              <div className="relative group flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Tìm kiếm tên đợt KPI..."
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
                  className="w-full pl-12 pr-12 py-3.5 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-400"
                />
                {keyword && (
                  <button
                    onClick={() => { setKeyword(''); setPage(0) }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                  >
                    <X size={14} className="text-slate-500" />
                  </button>
                )}
              </div>
              {/* View toggle - mobile only */}
              <div className="flex md:hidden bg-slate-100 dark:bg-slate-800 p-1 rounded-[18px] shrink-0">
                <button onClick={() => setViewMode('TABLE')} className={cn("p-2.5 rounded-xl transition-all duration-300", viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600')}>
                  <List size={18} />
                </button>
                <button onClick={() => setViewMode('CARD')} className={cn("p-2.5 rounded-xl transition-all duration-300", viewMode === 'CARD' ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600')}>
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>

            <Select value={periodType} onValueChange={val => { setPeriodType(val); setPage(0) }}>
              <SelectTrigger className="w-full md:w-56 h-[52px] rounded-[20px] border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 font-bold text-sm">
                <Filter size={16} className="text-slate-400 mr-2" />
                <SelectValue placeholder="Tất cả loại đợt" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                <SelectItem value="ALL" className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-xs font-black uppercase">Tất cả loại đợt</SelectItem>
                {['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY'].map(type => (
                  <SelectItem key={type} value={type} className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">
                    {FREQUENCY_MAP[type as KpiFrequency]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Mobile: custom picker */}
            <div className="flex md:hidden items-center gap-2 w-full">
              <DatePicker
                value={startDateFilter}
                onChange={(v) => { setStartDateFilter(v); setPage(0) }}
                onClear={() => { setStartDateFilter(''); setPage(0) }}
                placeholder="Từ ngày"
                className="flex-1"
              />
              <ArrowRight size={12} className="text-slate-300 shrink-0" />
              <DatePicker
                value={endDateFilter}
                onChange={(v) => { setEndDateFilter(v); setPage(0) }}
                onClear={() => { setEndDateFilter(''); setPage(0) }}
                placeholder="Đến ngày"
                className="flex-1"
              />
            </div>
            {/* Desktop: original date inputs */}
            <div className="hidden md:flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={14} />
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => { setStartDateFilter(e.target.value); setPage(0) }}
                  className="pl-9 pr-3 py-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-transparent w-[140px]"
                  title="Từ ngày"
                />
                <div className="absolute inset-0 left-9 flex items-center pointer-events-none text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                  {startDateFilter ? format(new Date(startDateFilter), 'dd/MM/yyyy') : 'Từ ngày'}
                </div>
              </div>
              <ArrowRight size={12} className="text-slate-300" />
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={14} />
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => { setEndDateFilter(e.target.value); setPage(0) }}
                  className="pl-9 pr-3 py-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-transparent w-[140px]"
                  title="Đến ngày"
                />
                <div className="absolute inset-0 left-9 flex items-center pointer-events-none text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                  {endDateFilter ? format(new Date(endDateFilter), 'dd/MM/yyyy') : 'Đến ngày'}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-[18px]">
              <button 
                onClick={() => setViewMode('TABLE')}
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-300",
                  viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <List size={20} />
              </button>
              <button 
                onClick={() => setViewMode('CARD')}
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-300",
                  viewMode === 'CARD' ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <LayoutGrid size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div id="tour-periods-content">
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <LoadingSkeleton type="table" rows={pageSize} />
          </div>
        ) : !data?.content.length ? (
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-[40px] border border-dashed border-slate-300 dark:border-slate-700 p-24 shadow-sm text-center">
            <EmptyState 
              title="Chưa có đợt KPI nào" 
              description={keyword || periodType !== 'ALL' ? 'Không tìm thấy đợt KPI phù hợp với bộ lọc hiện tại.' : 'Hãy bắt đầu bằng cách tạo đợt KPI đầu tiên cho hệ thống.'} 
            />
          </div>
        ) : viewMode === 'TABLE' ? (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer group whitespace-nowrap" onClick={() => toggleSort('name')}>
                    <div className="flex items-center gap-2">Tên Đợt <SortIcon field="name" /></div>
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer group whitespace-nowrap" onClick={() => toggleSort('periodType')}>
                    <div className="flex items-center gap-2">Loại đợt <SortIcon field="periodType" /></div>
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Kỳ</th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer group whitespace-nowrap" onClick={() => toggleSort('startDate')}>
                    <div className="flex items-center gap-2">Bắt đầu <SortIcon field="startDate" /></div>
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer group whitespace-nowrap" onClick={() => toggleSort('endDate')}>
                    <div className="flex items-center gap-2">Kết thúc <SortIcon field="endDate" /></div>
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Thông báo</th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {data.content.map((period) => (
                    <tr key={period.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm border border-indigo-100/50 dark:border-indigo-800/50 group-hover:scale-110 transition-transform duration-500">
                            <Calendar size={20} />
                          </div>
                          <span className="text-sm font-black text-slate-900 dark:text-white">{period.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700 shadow-sm">
                          <Clock size={12} /> {FREQUENCY_MAP[period.periodType as KpiFrequency]}
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        {period.cycleName ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-[10px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
                            <CalendarRange size={12} /> {period.cycleName}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-5">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{period.startDate ? formatDateTime(period.startDate) : '—'}</span>
                      </td>
                      <td className="px-4 py-5">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{period.endDate ? formatDateTime(period.endDate) : '—'}</span>
                      </td>
                      <td className="px-4 py-5">
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg border border-amber-100 dark:border-amber-800/50">
                          {period.notificationDate ? format(parseISO(period.notificationDate), 'HH:mm dd/MM') : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => { setEditPeriod(period); setShowForm(true) }}
                            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700" title="Chỉnh sửa"
                          >
                            <Pencil size={18} />
                          </button>
                          <button 
                            onClick={() => setDeleteId(period.id)}
                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all shadow-sm border border-transparent hover:border-rose-200" title="Xoá"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.content.map((period) => (
              <div 
                key={period.id} 
                className="group relative bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
                
                <div className="flex items-start justify-between mb-6 relative">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                    <Calendar size={22} />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditPeriod(period); setShowForm(true) }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"><Pencil size={16} /></button>
                    <button onClick={() => setDeleteId(period.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>

                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 line-clamp-1">{period.name}</h3>
                <div className="flex flex-wrap items-center gap-1.5 mb-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                    <Clock size={10} /> {FREQUENCY_MAP[period.periodType as KpiFrequency]}
                  </div>
                  {period.cycleName && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-[9px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
                      <CalendarRange size={10} /> {period.cycleName}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Bắt đầu</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{period.startDate ? formatDateTime(period.startDate).split(' ')[0] : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Kết thúc</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{period.endDate ? formatDateTime(period.endDate).split(' ')[0] : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">Thông báo</span>
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">{period.notificationDate ? format(parseISO(period.notificationDate), 'HH:mm dd/MM') : '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Premium Pagination */}
        {data && data.totalElements > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-8 py-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Hiển thị <span className="text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">{page * pageSize + 1} - {Math.min((page + 1) * pageSize, data.totalElements)}</span> của <span className="text-slate-900 dark:text-white">{data.totalElements}</span> đợt KPI
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p: number) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1.5">
                {[...Array(data.totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={cn(
                      "w-10 h-10 rounded-xl text-xs font-black transition-all duration-300",
                      page === i 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 scale-110' 
                        : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-500 dark:text-slate-400'
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPage((p: number) => Math.min(data.totalPages - 1, p + 1))}
                disabled={page === data.totalPages - 1}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <PeriodFormModal
            onClose={() => setShowForm(false)}
            editPeriod={editPeriod}
            organizationId={organizationId!}
            initialCycleId={incomingCycleId}
            onSubmit={async (payload) => {
              if (editPeriod) {
                await updatePeriod({ id: editPeriod.id, data: payload })
                return
              }
              // Đợt vừa tạo là bối cảnh của cả bước sau, nên mang thẳng id sang trang chỉ tiêu
              // thay vì để người dùng tự chọn lại đợt trong dropdown.
              const created = await createPeriod(payload)
              goToNext('PERIOD_SETUP', { periodId: created?.id })
            }}
            isSubmitting={isCreating || isUpdating}
          />
        )}

        <ConfirmDialog 
          open={!!deleteId}
          title="Xoá đợt KPI này?"
          description="Dữ liệu về đợt KPI sẽ bị xoá vĩnh viễn. Các chỉ tiêu liên quan có thể bị ảnh hưởng. Bạn có chắc chắn?"
          confirmLabel="Xoá vĩnh viễn"
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
          loading={isDeleting}
        />

      </div>
    </div>
  )
}
