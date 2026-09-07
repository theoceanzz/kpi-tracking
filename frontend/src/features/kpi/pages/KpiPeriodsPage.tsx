import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { format, addDays, parseISO, addMonths, addYears, subDays, differenceInCalendarDays } from 'date-fns'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useKpiCycles } from '../hooks/useKpiCycles'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime, FREQUENCY_MAP } from '@/lib/utils'
import type { KpiPeriod, KpiFrequency } from '@/types/kpi'
import {
  Calendar, CalendarRange, Plus, Pencil, Trash2, Clock,
  ChevronLeft, ChevronRight,
  Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, X, ArrowRight,
  LayoutGrid, List, Target
} from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker, DatePicker } from '@/components/common/DateTimePicker'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function KpiPeriodsPage() {
  const [showForm, setShowForm] = useState(false)
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

  // Tiêu đề trang không còn tự dựng ở đây: nhãn tuỳ chỉnh của tổ chức đã hiện ở
  // breadcrumb và ở tab "Đợt đánh giá" ngay trên card, viết lại lần nữa là thừa.

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
    return direction === 'asc' ? <ArrowUp size={14} className="text-[var(--color-primary)] animate-in slide-in-from-bottom-1" /> : <ArrowDown size={14} className="text-[var(--color-primary)] animate-in slide-in-from-top-1" />
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
    // Không tự bọc `max-w`/padding: khung `SettingsSectionLayout` bên ngoài đã lo phần đó.
    <div className="space-y-5">

        {/* Header */}
        <WorkspaceHeader
          id="tour-periods-header"
          description="Thiết lập chu kỳ đánh giá (Tháng, Quý, Năm) để triển khai mục tiêu."
          stats={[
            { label: 'Tổng số đợt', value: stats.total },
            {
              label: 'Chu kỳ phổ biến',
              value: stats.monthly + stats.quarterly + stats.semiAnnually,
              icon: Target,
            },
          ]}
          actions={
            <button
              onClick={() => { setEditPeriod(null); setShowForm(true) }}
              className="cursor-pointer group flex items-center justify-center gap-2 px-5 h-10 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:opacity-90 transition-all shadow-sm active:scale-95 whitespace-nowrap"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-500" />
              Tạo đợt mới
            </button>
          }
        />

        {/* Toolbar & Filters */}
        <div id="tour-periods-toolbar" className="flex flex-col xl:flex-row items-stretch justify-between gap-3 p-3 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-3 flex-1">
            <div className="flex items-center gap-3 w-full md:max-w-md">
              <div className="relative group flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Tìm kiếm tên đợt KPI..."
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
                  className="w-full pl-12 pr-12 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 text-sm font-medium focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none transition-all placeholder:text-slate-400"
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
              <div className="flex md:hidden bg-[var(--color-muted)] p-1 rounded-xl shrink-0">
                <button onClick={() => setViewMode('TABLE')} className={cn("p-2.5 rounded-xl transition-all duration-300", viewMode === 'TABLE' ? 'bg-[var(--color-card)] shadow-sm text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600')}>
                  <List size={18} />
                </button>
                <button onClick={() => setViewMode('CARD')} className={cn("p-2.5 rounded-xl transition-all duration-300", viewMode === 'CARD' ? 'bg-[var(--color-card)] shadow-sm text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600')}>
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>

            <Select value={periodType} onValueChange={val => { setPeriodType(val); setPage(0) }}>
              <SelectTrigger className="w-full md:w-56 h-[42px] rounded-xl border-[var(--color-border)] bg-[var(--color-muted)]/40 font-bold text-sm">
                <Filter size={16} className="text-slate-400 mr-2" />
                <SelectValue placeholder="Tất cả loại đợt" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                <SelectItem value="ALL" className="rounded-xl focus:bg-[var(--color-primary)]/10 text-xs font-black uppercase">Tất cả loại đợt</SelectItem>
                {['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY'].map(type => (
                  <SelectItem key={type} value={type} className="rounded-xl focus:bg-[var(--color-primary)]/10 text-sm font-bold">
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
                  className="pl-9 pr-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all text-transparent w-[140px]"
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
                  className="pl-9 pr-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all text-transparent w-[140px]"
                  title="Đến ngày"
                />
                <div className="absolute inset-0 left-9 flex items-center pointer-events-none text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                  {endDateFilter ? format(new Date(endDateFilter), 'dd/MM/yyyy') : 'Đến ngày'}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex bg-[var(--color-muted)] p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('TABLE')}
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-300",
                  viewMode === 'TABLE' ? 'bg-[var(--color-card)] shadow-sm text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <List size={20} />
              </button>
              <button 
                onClick={() => setViewMode('CARD')}
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-300",
                  viewMode === 'CARD' ? 'bg-[var(--color-card)] shadow-sm text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'
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
          <div className="bg-[var(--color-card)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
            <LoadingSkeleton type="table" rows={pageSize} />
          </div>
        ) : !data?.content.length ? (
          <div className="bg-[var(--color-card)]/50 rounded-2xl border border-dashed border-[var(--color-border)] p-16 shadow-sm text-center">
            <EmptyState 
              title="Chưa có đợt KPI nào" 
              description={keyword || periodType !== 'ALL' ? 'Không tìm thấy đợt KPI phù hợp với bộ lọc hiện tại.' : 'Hãy bắt đầu bằng cách tạo đợt KPI đầu tiên cho hệ thống.'} 
            />
          </div>
        ) : viewMode === 'TABLE' ? (
          <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
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
                          <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] shrink-0 shadow-sm border border-[var(--color-primary)]/15 group-hover:scale-110 transition-transform duration-500">
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
                            className="p-2.5 text-slate-400 hover:text-[var(--color-primary)] hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700" title="Chỉnh sửa"
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
                <div className="absolute top-0 right-0 w-20 h-20 bg-[var(--color-primary)]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-[var(--color-primary)]/10 transition-colors" />
                
                <div className="flex items-start justify-between mb-6 relative">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] shadow-inner">
                    <Calendar size={22} />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditPeriod(period); setShowForm(true) }} className="p-2 text-slate-400 hover:text-[var(--color-primary)] hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"><Pencil size={16} /></button>
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
                        ? 'bg-[var(--color-primary)] text-white shadow-sm' 
                        : 'hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
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
            onSubmit={async (payload) => {
              if (editPeriod) {
                await updatePeriod({ id: editPeriod.id, data: payload })
              } else {
                await createPeriod(payload)
              }
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
  )
}

// --- Internal Form Modal for Auto-calculation ---
interface PeriodFormModalProps {
  onClose: () => void
  editPeriod: KpiPeriod | null
  organizationId: string
  onSubmit: (payload: any) => Promise<void>
  isSubmitting: boolean
}

function computeStandardEndDate(start: Date, type: KpiFrequency): Date {
  let end: Date
  switch (type) {
    case 'DAILY':
      end = new Date(start)
      break
    case 'WEEKLY':
      end = addDays(start, 6)
      break
    case 'MONTHLY':
      end = subDays(addMonths(start, 1), 1)
      break
    case 'QUARTERLY':
      end = subDays(addMonths(start, 3), 1)
      break
    case 'SEMI_ANNUALLY':
      end = subDays(addMonths(start, 6), 1)
      break
    case 'YEARLY':
      end = subDays(addYears(start, 1), 1)
      break
    default:
      end = new Date(start)
  }
  end.setHours(23, 59, 59, 999)
  return end
}

function PeriodFormModal({ onClose, editPeriod, organizationId, onSubmit, isSubmitting }: PeriodFormModalProps) {
  const [formData, setFormData] = useState({
    name: editPeriod?.name || '',
    periodType: (editPeriod?.periodType as KpiFrequency) || 'MONTHLY',
    startDate: editPeriod?.startDate ? format(parseISO(editPeriod.startDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'07:00"),
    endDate: editPeriod?.endDate ? format(parseISO(editPeriod.endDate), "yyyy-MM-dd'T'HH:mm") : '',
    notificationDate: editPeriod?.notificationDate ? format(parseISO(editPeriod.notificationDate), "yyyy-MM-dd'T'HH:mm") : '',
    cycleId: editPeriod?.cycleId || 'NONE',
  })
  const [showMismatchConfirm, setShowMismatchConfirm] = useState(false)

  // Danh sách kỳ để gán đợt vào (tuỳ chọn).
  const { data: cyclesData } = useKpiCycles({ organizationId, size: 100, sortBy: 'startDate', direction: 'desc' })
  const cycles = cyclesData?.content || []
  const selectedCycle = formData.cycleId !== 'NONE' ? cycles.find(c => c.id === formData.cycleId) : undefined

  // Auto calculate end date on mount if creating new
  useState(() => {
    if (!editPeriod) {
      calculateEndDate(formData.startDate, formData.periodType)
    }
  })

  function calculateEndDate(startStr: string, type: KpiFrequency) {
    if (!startStr) return
    const start = new Date(startStr)
    const end = computeStandardEndDate(start, type)
    const notification = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2)

    setFormData(prev => ({
      ...prev,
      endDate: format(end, "yyyy-MM-dd'T'HH:mm"),
      notificationDate: format(notification, "yyyy-MM-dd'T'HH:mm")
    }))
  }

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'startDate' || field === 'periodType') {
        const start = field === 'startDate' ? value : prev.startDate
        const type = field === 'periodType' ? value as KpiFrequency : prev.periodType

        const startDateObj = new Date(start)
        const endDateObj = computeStandardEndDate(startDateObj, type)

        next.endDate = format(endDateObj, "yyyy-MM-dd'T'HH:mm")

        // Auto calculate notification date (50% of period)
        const notificationDateObj = new Date(startDateObj.getTime() + (endDateObj.getTime() - startDateObj.getTime()) / 2)
        next.notificationDate = format(notificationDateObj, "yyyy-MM-dd'T'HH:mm")

        if (!next.name || next.name.includes('Tháng') || next.name.includes('Quý') || next.name.includes('6 Tháng') || next.name.includes('Năm')) {
          if (type === 'MONTHLY') next.name = `Tháng ${format(startDateObj, 'MM/yyyy')}`
          else if (type === 'QUARTERLY') next.name = `Quý ${Math.floor(startDateObj.getMonth() / 3) + 1} / ${format(startDateObj, 'yyyy')}`
          else if (type === 'SEMI_ANNUALLY') next.name = `6 Tháng ${Math.floor(startDateObj.getMonth() / 6) + 1} / ${format(startDateObj, 'yyyy')}`
          else if (type === 'YEARLY') next.name = `Năm ${format(startDateObj, 'yyyy')}`
        }
      }
      return next
    })
  }

  const submitForm = async () => {
    await onSubmit({
      ...formData,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      notificationDate: formData.notificationDate ? new Date(formData.notificationDate).toISOString() : null,
      cycleId: formData.cycleId === 'NONE' ? null : formData.cycleId,
      organizationId
    })
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const start = new Date(formData.startDate).getTime()
    const end = new Date(formData.endDate).getTime()
    const notification = formData.notificationDate ? new Date(formData.notificationDate).getTime() : null

    if (end <= start) {
      toast.error('Thời gian kết thúc phải sau thời gian bắt đầu')
      return
    }

    if (notification) {
      if (notification <= start || notification >= end) {
        toast.error('Thời gian thông báo phải nằm trong khoảng thời gian bắt đầu và kết thúc')
        return
      }
    }

    // Đợt thuộc một kỳ ⇒ thời gian đợt phải nằm gọn trong thời gian của kỳ.
    if (selectedCycle?.startDate && selectedCycle?.endDate) {
      const cycleStart = new Date(selectedCycle.startDate).getTime()
      const cycleEnd = new Date(selectedCycle.endDate).getTime()
      if (start < cycleStart || end > cycleEnd) {
        toast.error(
          `Thời gian đợt phải nằm trong kỳ "${selectedCycle.name}" ` +
          `(${format(new Date(selectedCycle.startDate), 'dd/MM/yyyy')} – ${format(new Date(selectedCycle.endDate), 'dd/MM/yyyy')})`
        )
        return
      }
    }

    const standardEnd = computeStandardEndDate(new Date(formData.startDate), formData.periodType).getTime()
    if (Math.abs(end - standardEnd) > 60 * 1000) {
      setShowMismatchConfirm(true)
      return
    }

    await submitForm()
  }

  const selectedDays = formData.startDate && formData.endDate
    ? differenceInCalendarDays(new Date(formData.endDate), new Date(formData.startDate)) + 1
    : 0
  const standardDays = formData.startDate
    ? differenceInCalendarDays(computeStandardEndDate(new Date(formData.startDate), formData.periodType), new Date(formData.startDate)) + 1
    : 0
  const mismatchDescription = `Bạn đã chọn ${selectedDays} ngày, trong khi chu kỳ "${FREQUENCY_MAP[formData.periodType]}" tiêu chuẩn là ${standardDays} ngày. Hệ thống sẽ không tự kiểm tra lại — bạn tự chịu trách nhiệm với khoảng thời gian đã chọn.`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-lg mx-auto animate-in zoom-in-95 fade-in duration-500 overflow-y-auto overflow-x-hidden max-h-[92vh] scrollbar-thin border border-slate-200 dark:border-slate-800">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        
        <div className="p-10 space-y-8 relative">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[22px] bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] shadow-inner border border-[var(--color-primary)]/15">
              {editPeriod ? <Pencil size={28} /> : <Plus size={28} />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {editPeriod ? 'Chỉnh sửa đợt' : 'Tạo đợt mới'}
              </h3>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Cấu hình chu kỳ đánh giá & thời gian</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Tên đợt KPI <span className="text-red-500">*</span></label>
              <input 
                value={formData.name}
                onChange={e => handleFieldChange('name', e.target.value)}
                required
                placeholder="Ví dụ: Tháng 05/2026"
                className="w-full px-5 py-4 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none text-sm font-bold transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Loại chu kỳ <span className="text-red-500">*</span></label>
              <Select value={formData.periodType} onValueChange={val => handleFieldChange('periodType', val)}>
                <SelectTrigger className="w-full px-5 h-[56px] rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold shadow-sm focus:ring-4 focus:ring-[var(--color-primary)]/15">
                  <SelectValue placeholder="Chọn loại chu kỳ" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                  {['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY'].map(type => (
                    <SelectItem key={type} value={type} className="rounded-xl focus:bg-[var(--color-primary)]/10 text-sm font-bold">
                      {FREQUENCY_MAP[type as KpiFrequency]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Thuộc kỳ đánh giá (tuỳ chọn)</label>
              <Select value={formData.cycleId} onValueChange={val => setFormData(prev => ({ ...prev, cycleId: val }))}>
                <SelectTrigger className="w-full px-5 h-[56px] rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold shadow-sm focus:ring-4 focus:ring-[var(--color-primary)]/15">
                  <SelectValue placeholder="Không thuộc kỳ nào" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                  <SelectItem value="NONE" className="rounded-xl text-sm font-bold text-slate-500">Không thuộc kỳ nào</SelectItem>
                  {cycles.map(cycle => (
                    <SelectItem key={cycle.id} value={cycle.id} className="rounded-xl text-sm font-bold">{cycle.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCycle?.startDate && selectedCycle?.endDate && (
                <p className="text-[11px] text-slate-400 font-medium ml-1">
                  Đợt phải nằm trong kỳ:{' '}
                  <span className="font-black text-slate-500">
                    {format(new Date(selectedCycle.startDate), 'dd/MM/yyyy')} – {format(new Date(selectedCycle.endDate), 'dd/MM/yyyy')}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Bắt đầu <span className="text-red-500">*</span></label>
                  {/* Mobile */}
                  <div className="sm:hidden">
                    <DateTimePicker value={formData.startDate} onChange={val => handleFieldChange('startDate', val)} />
                  </div>
                  {/* Desktop */}
                  <div className="hidden sm:block relative">
                    <input type="datetime-local" value={formData.startDate} onChange={e => handleFieldChange('startDate', e.target.value)} required className="w-full px-5 py-4 rounded-[22px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none text-sm font-bold transition-all text-transparent" />
                    <div className="absolute inset-0 left-5 flex items-center pointer-events-none text-sm font-bold text-slate-900 dark:text-white">
                      {formData.startDate ? format(new Date(formData.startDate), 'dd/MM/yyyy HH:mm') : ''}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Kết thúc <span className="text-red-500">*</span></label>
                  {/* Mobile */}
                  <div className="sm:hidden">
                    <DateTimePicker value={formData.endDate} onChange={val => handleFieldChange('endDate', val)} />
                  </div>
                  {/* Desktop */}
                  <div className="hidden sm:block relative">
                    <input type="datetime-local" value={formData.endDate} onChange={e => handleFieldChange('endDate', e.target.value)} required className="w-full px-5 py-4 rounded-[22px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none text-sm font-bold transition-all text-transparent" />
                    <div className="absolute inset-0 left-5 flex items-center pointer-events-none text-sm font-bold text-slate-900 dark:text-white">
                      {formData.endDate ? format(new Date(formData.endDate), 'dd/MM/yyyy HH:mm') : ''}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Thông báo nhắc nhở (Mặc định 50% thời gian)</label>
                {/* Mobile */}
                <div className="sm:hidden">
                  <DateTimePicker value={formData.notificationDate} onChange={val => handleFieldChange('notificationDate', val)} />
                </div>
                {/* Desktop */}
                <div className="hidden sm:block relative">
                  <input type="datetime-local" value={formData.notificationDate} onChange={e => handleFieldChange('notificationDate', e.target.value)} required className="w-full px-6 py-4 rounded-[22px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none text-sm font-bold transition-all text-transparent" />
                  <div className="absolute inset-0 left-6 flex items-center pointer-events-none text-sm font-bold text-slate-900 dark:text-white">
                    {formData.notificationDate ? format(new Date(formData.notificationDate), 'dd/MM/yyyy HH:mm') : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 px-8 py-4 rounded-[20px] border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                Huỷ
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-8 py-4 rounded-[20px] bg-[var(--color-primary)] text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? 'Đang lưu...' : 'Xác nhận'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={showMismatchConfirm}
        title="Bạn có chắc chắn?"
        description={mismatchDescription}
        confirmLabel="Vẫn tạo đợt này"
        onConfirm={async () => { setShowMismatchConfirm(false); await submitForm() }}
        onClose={() => setShowMismatchConfirm(false)}
        loading={isSubmitting}
      />
    </div>
  )
}
