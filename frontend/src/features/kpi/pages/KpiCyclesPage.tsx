import { useState, useMemo, useEffect, useRef } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { format, parseISO, addMonths, addYears, subDays, differenceInCalendarDays } from 'date-fns'
import { useKpiCycles } from '../hooks/useKpiCycles'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime, FREQUENCY_MAP, cn } from '@/lib/utils'
import type { KpiCycle, KpiCyclePayload, KpiPeriod, KpiFrequency, CycleEvaluationMode } from '@/types/kpi'
import {
  CalendarRange, Plus, Pencil, Trash2, Layers,
  ChevronLeft, ChevronRight, Search, Filter, X, Sparkles, Calendar, ArrowRight,
  List, LayoutGrid, Check, AlertTriangle
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker, DatePicker } from '@/components/common/DateTimePicker'
import { toast } from 'sonner'

// Loại kỳ: Tháng / Quý / 6 Tháng / Năm — mẫu gợi ý, thời gian vẫn chỉnh tự do.
const CYCLE_TYPES: KpiFrequency[] = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY']

function computeStandardEndDate(start: Date, type: KpiFrequency): Date {
  let end: Date
  switch (type) {
    case 'QUARTERLY': end = subDays(addMonths(start, 3), 1); break
    case 'SEMI_ANNUALLY': end = subDays(addMonths(start, 6), 1); break
    case 'YEARLY': end = subDays(addYears(start, 1), 1); break
    case 'MONTHLY':
    default: end = subDays(addMonths(start, 1), 1)
  }
  end.setHours(23, 59, 59, 999)
  return end
}

/**
 * Cuối phút chứa {@code date} (giây 59, mili giây 999).
 *
 * <p>Ô chọn thời gian chỉ tới PHÚT, trong khi đợt kết thúc ở 23:59:59.999. Gửi thẳng
 * 23:59:00 lên server thì kỳ ngắn hơn đợt đúng 59 giây và bị chặn với thông báo khó hiểu
 * "thời gian đợt phải nằm trong thời gian của kỳ". Chọn 23:59 nghĩa là "hết phút đó",
 * nên quy đổi ở đây chứ không bắt người dùng gõ được giây.
 */
function endOfMinute(date: Date): Date {
  const d = new Date(date)
  d.setSeconds(59, 999)
  return d
}

/**
 * Loại kỳ khớp nhất với một khoảng thời gian có sẵn — dùng khi thời gian kỳ được suy ra
 * từ các đợt đã chọn, lúc đó không ai gõ loại kỳ vào trước.
 *
 * <p>So theo SỐ NGÀY chứ không theo số tháng: gom 3 đợt tuần thành 21 ngày thì "Tháng"
 * vẫn là nhãn gần đúng nhất, còn đếm tháng sẽ ra 0 và không chọn được gì.
 */
function inferCycleType(start: Date, end: Date): KpiFrequency {
  const days = differenceInCalendarDays(end, start) + 1
  return CYCLE_TYPES.reduce((best, type) => {
    const diffOf = (t: KpiFrequency) =>
      Math.abs(differenceInCalendarDays(computeStandardEndDate(start, t), start) + 1 - days)
    return diffOf(type) < diffOf(best) ? type : best
  }, CYCLE_TYPES[0]!)
}

/**
 * Tên kỳ gợi ý theo mốc bắt đầu và loại kỳ. Chỉ ghi đè khi tên đang trống hoặc vẫn là
 * một tên máy tự đặt trước đó — người dùng đã gõ tên riêng thì không được đụng vào.
 */
function suggestCycleName(currentName: string, start: Date, type: KpiFrequency): string {
  const isAutoName = !currentName || ['Tháng', 'Quý', '6 Tháng', 'Năm'].some(p => currentName.startsWith(p))
  if (!isAutoName) return currentName

  switch (type) {
    case 'MONTHLY': return `Tháng ${format(start, 'MM/yyyy')}`
    case 'QUARTERLY': return `Quý ${Math.floor(start.getMonth() / 3) + 1} / ${format(start, 'yyyy')}`
    case 'SEMI_ANNUALLY': return `6 Tháng ${Math.floor(start.getMonth() / 6) + 1} / ${format(start, 'yyyy')}`
    case 'YEARLY': return `Năm ${format(start, 'yyyy')}`
    default: return currentName
  }
}

export default function KpiCyclesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editCycle, setEditCycle] = useState<KpiCycle | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [cycleType, setCycleType] = useState<string>('ALL')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>(() => window.matchMedia('(max-width: 767px)').matches ? 'CARD' : 'TABLE')

  const debouncedKeyword = useDebounce(keyword, 500)
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId

  const {
    data, isLoading, createCycle, updateCycle, deleteCycle,
    isCreating, isUpdating, isDeleting
  } = useKpiCycles({
    page,
    size: pageSize,
    organizationId,
    keyword: debouncedKeyword,
    cycleType: cycleType === 'ALL' ? undefined : cycleType,
    startDate: startDateFilter ? new Date(startDateFilter).toISOString() : undefined,
    endDate: endDateFilter ? new Date(endDateFilter).toISOString() : undefined,
    sortBy: 'startDate',
    direction: 'desc',
  })

  const stats = useMemo(() => ({
    total: data?.totalElements || 0,
    periods: (data?.content || []).reduce((sum, c) => sum + (c.periodCount || 0), 0),
  }), [data])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteCycle(deleteId)
      setDeleteId(null)
    } catch { /* toast handled in hook */ }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">

        {/* Header */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-[40px] blur opacity-10 group-hover:opacity-20 transition duration-1000" />
          <div className="relative bg-white dark:bg-slate-900 rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                  <Sparkles size={12} className="animate-pulse" /> Đánh giá tổng hợp
                </div>
                <div className="space-y-0.5">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    Quản lý <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">kỳ</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl leading-relaxed">
                    Một kỳ (Tháng/Quý/6 Tháng/Năm) gom nhiều đợt để đánh giá tổng thể.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex justify-center bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md rounded-[20px] border border-slate-200/60 dark:border-slate-700/60 p-1.5 shadow-inner">
                  <div className="px-6 py-2 text-center border-r border-slate-200 dark:border-slate-700">
                    <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.total}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tổng số kỳ</p>
                  </div>
                  <div className="px-6 py-2 text-center">
                    <div className="flex items-center gap-2 justify-center text-emerald-600 dark:text-emerald-400">
                      <Layers size={18} />
                      <p className="text-2xl font-black tracking-tighter">{stats.periods}</p>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Đợt đã gom</p>
                  </div>
                </div>

                <button
                  onClick={() => { setEditCycle(null); setShowForm(true) }}
                  className="cursor-pointer relative z-10 flex items-center justify-center gap-2 px-8 h-12 rounded-[20px] bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 group whitespace-nowrap sm:shrink-0"
                >
                  <Plus size={16} className="group-hover:rotate-90 transition-transform duration-500" />
                  Tạo kỳ mới
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch gap-4 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm tên kỳ..."
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
              className="w-full pl-12 pr-12 py-3.5 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-400"
            />
            {keyword && (
              <button onClick={() => { setKeyword(''); setPage(0) }} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all">
                <X size={14} className="text-slate-500" />
              </button>
            )}
          </div>
          <Select value={cycleType} onValueChange={val => { setCycleType(val); setPage(0) }}>
            <SelectTrigger className="w-full md:w-56 h-[52px] rounded-[20px] border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 font-bold text-sm">
              <Filter size={16} className="text-slate-400 mr-2" />
              <SelectValue placeholder="Tất cả loại kỳ" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
              <SelectItem value="ALL" className="rounded-xl text-xs font-black uppercase">Tất cả loại kỳ</SelectItem>
              {CYCLE_TYPES.map(type => (
                <SelectItem key={type} value={type} className="rounded-xl text-sm font-bold">{FREQUENCY_MAP[type]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Mobile: custom date picker */}
          <div className="flex md:hidden items-center gap-2 w-full">
            <DatePicker value={startDateFilter} onChange={(v) => { setStartDateFilter(v); setPage(0) }} onClear={() => { setStartDateFilter(''); setPage(0) }} placeholder="Từ ngày" className="flex-1" />
            <ArrowRight size={12} className="text-slate-300 shrink-0" />
            <DatePicker value={endDateFilter} onChange={(v) => { setEndDateFilter(v); setPage(0) }} onClear={() => { setEndDateFilter(''); setPage(0) }} placeholder="Đến ngày" className="flex-1" />
          </div>
          {/* Desktop: native date inputs */}
          <div className="hidden md:flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={14} />
              <input type="date" value={startDateFilter} onChange={(e) => { setStartDateFilter(e.target.value); setPage(0) }}
                className="pl-9 pr-3 py-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-transparent w-[140px]" title="Từ ngày" />
              <div className="absolute inset-0 left-9 flex items-center pointer-events-none text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                {startDateFilter ? format(new Date(startDateFilter), 'dd/MM/yyyy') : 'Từ ngày'}
              </div>
            </div>
            <ArrowRight size={12} className="text-slate-300" />
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={14} />
              <input type="date" value={endDateFilter} onChange={(e) => { setEndDateFilter(e.target.value); setPage(0) }}
                className="pl-9 pr-3 py-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-transparent w-[140px]" title="Đến ngày" />
              <div className="absolute inset-0 left-9 flex items-center pointer-events-none text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                {endDateFilter ? format(new Date(endDateFilter), 'dd/MM/yyyy') : 'Đến ngày'}
              </div>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-[18px] shrink-0 md:ml-auto">
            <button onClick={() => setViewMode('TABLE')} className={cn("p-2.5 rounded-xl transition-all duration-300", viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 shadow-md text-emerald-600 scale-105' : 'text-slate-400 hover:text-slate-600')}>
              <List size={20} />
            </button>
            <button onClick={() => setViewMode('CARD')} className={cn("p-2.5 rounded-xl transition-all duration-300", viewMode === 'CARD' ? 'bg-white dark:bg-slate-700 shadow-md text-emerald-600 scale-105' : 'text-slate-400 hover:text-slate-600')}>
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <LoadingSkeleton type="table" rows={pageSize} />
          </div>
        ) : !data?.content.length ? (
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-[40px] border border-dashed border-slate-300 dark:border-slate-700 p-24 shadow-sm text-center">
            <EmptyState
              title="Chưa có kỳ đánh giá nào"
              description={keyword || cycleType !== 'ALL' || startDateFilter || endDateFilter ? 'Không tìm thấy kỳ phù hợp với bộ lọc hiện tại.' : 'Hãy tạo kỳ đầu tiên để gom các đợt lại đánh giá tổng hợp.'}
            />
          </div>
        ) : viewMode === 'TABLE' ? (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Tên kỳ</th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Loại</th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Bắt đầu</th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Kết thúc</th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Số đợt</th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {data.content.map((cycle) => (
                    <tr key={cycle.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm border border-emerald-100/50 dark:border-emerald-800/50 group-hover:scale-110 transition-transform duration-500">
                            <CalendarRange size={20} />
                          </div>
                          <div>
                            <span className="text-sm font-black text-slate-900 dark:text-white block">{cycle.name}</span>
                            {cycle.description && <span className="text-xs text-slate-400 line-clamp-1">{cycle.description}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700">
                          {FREQUENCY_MAP[cycle.cycleType]}
                        </div>
                      </td>
                      <td className="px-4 py-5"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{cycle.startDate ? formatDateTime(cycle.startDate) : '—'}</span></td>
                      <td className="px-4 py-5"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{cycle.endDate ? formatDateTime(cycle.endDate) : '—'}</span></td>
                      <td className="px-4 py-5">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                          <Layers size={12} /> {cycle.periodCount} đợt
                        </span>
                      </td>
                      <td className="px-4 py-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => { setEditCycle(cycle); setShowForm(true) }} className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700" title="Chỉnh sửa">
                            <Pencil size={18} />
                          </button>
                          <button onClick={() => setDeleteId(cycle.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all shadow-sm border border-transparent hover:border-rose-200" title="Xoá">
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
            {data.content.map((cycle) => (
              <div key={cycle.id} className="group relative bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />

                <div className="flex items-start justify-between mb-6 relative">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                    <CalendarRange size={22} />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditCycle(cycle); setShowForm(true) }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"><Pencil size={16} /></button>
                    <button onClick={() => setDeleteId(cycle.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>

                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 line-clamp-1">{cycle.name}</h3>
                {cycle.description && <p className="text-xs text-slate-400 mb-4 line-clamp-2">{cycle.description}</p>}
                <div className="flex flex-wrap items-center gap-1.5 mb-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                    {FREQUENCY_MAP[cycle.cycleType]}
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-[9px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
                    <Layers size={10} /> {cycle.periodCount} đợt
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Bắt đầu</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cycle.startDate ? formatDateTime(cycle.startDate).split(' ')[0] : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Kết thúc</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cycle.endDate ? formatDateTime(cycle.endDate).split(' ')[0] : '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 px-4">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              <ChevronLeft size={18} />
            </button>
            {[...Array(data.totalPages)].map((_, i) => (
              <button key={i} onClick={() => setPage(i)} className={cn("w-10 h-10 rounded-xl text-xs font-black transition-all", page === i ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 scale-110' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-500 dark:text-slate-400')}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))} disabled={page === data.totalPages - 1} className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {showForm && (
          <CycleFormModal
            onClose={() => setShowForm(false)}
            editCycle={editCycle}
            organizationId={organizationId!}
            onSubmit={async (payload) => {
              if (editCycle) await updateCycle({ id: editCycle.id, data: payload })
              else await createCycle(payload)
            }}
            isSubmitting={isCreating || isUpdating}
          />
        )}

        <ConfirmDialog
          open={!!deleteId}
          title="Xoá kỳ đánh giá này?"
          description="Kỳ sẽ bị xoá vĩnh viễn. Các đợt đang thuộc kỳ này sẽ được gỡ khỏi kỳ (đợt không bị xoá). Bạn có chắc chắn?"
          confirmLabel="Xoá vĩnh viễn"
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
          loading={isDeleting}
        />
      </div>
    </div>
  )
}

/**
 * Ô thời gian ở chế độ chọn đợt trước: chỉ đọc, vì giá trị do các đợt đã chọn quyết định.
 * Dùng ô tĩnh thay vì khoá {@link DateTimePicker} — người dùng bấm vào lịch rồi mới biết
 * mình không sửa được thì khó chịu hơn là nhìn thấy ngay đây là số máy tự điền.
 */
function DerivedDateBox({ value, hasPeriods }: { value: string; hasPeriods: boolean }) {
  return (
    <div className="w-full px-6 py-4 rounded-[22px] border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-sm font-bold">
      {hasPeriods && value
        ? <span className="text-slate-900 dark:text-white">{format(new Date(value), 'dd/MM/yyyy HH:mm')}</span>
        : <span className="text-slate-400 font-medium">Tự điền theo đợt</span>}
    </div>
  )
}

interface CycleFormModalProps {
  onClose: () => void
  editCycle: KpiCycle | null
  organizationId: string
  onSubmit: (payload: KpiCyclePayload) => Promise<void>
  isSubmitting: boolean
}

function CycleFormModal({ onClose, editCycle, organizationId, onSubmit, isSubmitting }: CycleFormModalProps) {
  const [formData, setFormData] = useState(() => {
    const start = editCycle?.startDate ? format(parseISO(editCycle.startDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'07:00")
    const type = (editCycle?.cycleType as KpiFrequency) || 'SEMI_ANNUALLY'
    const end = editCycle?.endDate
      ? format(parseISO(editCycle.endDate), "yyyy-MM-dd'T'HH:mm")
      : format(computeStandardEndDate(new Date(start), type), "yyyy-MM-dd'T'HH:mm")
    return { name: editCycle?.name || '', cycleType: type, startDate: start, endDate: end, description: editCycle?.description || '', evaluationMode: (editCycle?.evaluationMode as CycleEvaluationMode) || 'BOTH' }
  })
  const [showMismatchConfirm, setShowMismatchConfirm] = useState(false)

  /**
   * Hai đường dựng kỳ, cùng dẫn tới một payload:
   * - TIME_FIRST: gõ thời gian rồi nhặt đợt nằm trong khoảng đó (đường cũ).
   * - PERIOD_FIRST: nhặt đợt trước, thời gian kỳ tự ôm trọn các đợt đã chọn. Hợp với
   *   thực tế "kỳ này gồm mấy đợt kia" — sếp nhớ tên đợt chứ ít khi nhớ ngày.
   */
  const [mode, setMode] = useState<'TIME_FIRST' | 'PERIOD_FIRST'>('TIME_FIRST')
  const isPeriodFirst = mode === 'PERIOD_FIRST'

  // Gom đợt ngay tại đây, không cần sang tab Đợt để gán từng cái.
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<string[]>([])
  const { data: periodsData, isLoading: isLoadingPeriods } = useKpiPeriods({
    organizationId, size: 200, sortBy: 'startDate', direction: 'asc',
  })
  const periods = useMemo(() => periodsData?.content || [], [periodsData])

  const cycleStartMs = formData.startDate ? new Date(formData.startDate).getTime() : NaN
  // Cùng quy ước với lúc gửi lên server: kết thúc "23:59" là hết phút 23:59.
  const cycleEndMs = formData.endDate ? endOfMinute(new Date(formData.endDate)).getTime() : NaN

  // Đợt hợp lệ khi nằm trọn trong thời gian kỳ (BE cũng chặn tương tự).
  const fitsCycle = (p: KpiPeriod) => {
    if (!p.startDate || !p.endDate || Number.isNaN(cycleStartMs) || Number.isNaN(cycleEndMs)) return false
    return new Date(p.startDate).getTime() >= cycleStartMs && new Date(p.endDate).getTime() <= cycleEndMs
  }

  // Chọn đợt trước thì không có khoảng thời gian nào để lọc — mọi đợt có ngày đều chọn được.
  const canPick = (p: KpiPeriod) => (isPeriodFirst ? !!(p.startDate && p.endDate) : fitsCycle(p))

  // Đợt phù hợp lên trước, phần còn lại vẫn hiển thị (mờ) để biết vì sao không chọn được.
  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => {
      const diff = Number(canPick(b)) - Number(canPick(a))
      if (diff !== 0) return diff
      return (a.startDate || '').localeCompare(b.startDate || '')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, cycleStartMs, cycleEndMs, isPeriodFirst])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eligiblePeriods = useMemo(() => sortedPeriods.filter(canPick), [sortedPeriods, cycleStartMs, cycleEndMs, isPeriodFirst])

  // Sửa kỳ: nạp sẵn các đợt đang thuộc kỳ này (chỉ nạp 1 lần khi có dữ liệu).
  const didInitSelection = useRef(false)
  useEffect(() => {
    if (didInitSelection.current || !periodsData) return
    didInitSelection.current = true
    if (editCycle) setSelectedPeriodIds(periods.filter(p => p.cycleId === editCycle.id).map(p => p.id))
  }, [periodsData, periods, editCycle])

  /**
   * Chọn đợt trước ⇒ thời gian kỳ ôm trọn các đợt đã chọn, loại kỳ và tên tự suy theo.
   * Chạy trước effect cắt tỉa bên dưới, và effect đó tự tắt ở chế độ này, nên không có
   * vòng lặp "ngày đổi → bỏ đợt → ngày đổi".
   */
  useEffect(() => {
    if (!isPeriodFirst) return
    const picked = periods.filter(p => selectedPeriodIds.includes(p.id) && p.startDate && p.endDate)
    if (!picked.length) return

    const start = new Date(Math.min(...picked.map(p => new Date(p.startDate!).getTime())))
    const end = new Date(Math.max(...picked.map(p => new Date(p.endDate!).getTime())))
    const startStr = format(start, "yyyy-MM-dd'T'HH:mm")
    const endStr = format(end, "yyyy-MM-dd'T'HH:mm")

    setFormData(prev => {
      if (prev.startDate === startStr && prev.endDate === endStr) return prev
      const type = inferCycleType(start, end)
      return { ...prev, startDate: startStr, endDate: endStr, cycleType: type, name: suggestCycleName(prev.name, start, type) }
    })
  }, [isPeriodFirst, selectedPeriodIds, periods])

  // Đổi thời gian kỳ ⇒ bỏ chọn các đợt vừa rơi ra ngoài khoảng mới.
  useEffect(() => {
    // Ở chế độ chọn đợt trước, thời gian là HỆ QUẢ của lựa chọn nên không được cắt ngược lại.
    if (!didInitSelection.current || isPeriodFirst) return
    setSelectedPeriodIds(prev => {
      const next = prev.filter(id => {
        const p = periods.find(x => x.id === id)
        return p ? fitsCycle(p) : true
      })
      return next.length === prev.length ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleStartMs, cycleEndMs, periods, isPeriodFirst])

  const togglePeriod = (id: string) => {
    setSelectedPeriodIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const allEligibleSelected = eligiblePeriods.length > 0 && eligiblePeriods.every(p => selectedPeriodIds.includes(p.id))
  const toggleAllEligible = () => {
    setSelectedPeriodIds(allEligibleSelected ? [] : eligiblePeriods.map(p => p.id))
  }

  // Không bật KPI định tính ⇒ chỉ được đánh giá theo Định lượng.
  const { data: org } = useOrganization(organizationId)
  const enableQualitative = org?.enableQualitative ?? false
  useEffect(() => {
    if (!enableQualitative && formData.evaluationMode !== 'QUANTITATIVE') {
      setFormData(p => ({ ...p, evaluationMode: 'QUANTITATIVE' }))
    }
  }, [enableQualitative, formData.evaluationMode])

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'startDate' || field === 'cycleType') {
        const start = field === 'startDate' ? value : prev.startDate
        const type = field === 'cycleType' ? value as KpiFrequency : prev.cycleType
        const startObj = new Date(start)
        // Chọn đợt trước: thời gian do đợt quyết định. Đổi loại kỳ ở đây chỉ là đổi nhãn,
        // kéo ngày kết thúc về độ dài tiêu chuẩn sẽ cắt mất chính những đợt vừa chọn.
        if (!isPeriodFirst) {
          next.endDate = format(computeStandardEndDate(startObj, type), "yyyy-MM-dd'T'HH:mm")
        }
        next.name = suggestCycleName(next.name, startObj, type)
      }
      return next
    })
  }

  const submitForm = async () => {
    await onSubmit({
      name: formData.name,
      cycleType: formData.cycleType,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: endOfMinute(new Date(formData.endDate)).toISOString(),
      description: formData.description || null,
      evaluationMode: formData.evaluationMode,
      organizationId,
      periodIds: selectedPeriodIds,
    })
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isPeriodFirst && !selectedPeriodIds.length) {
      toast.error('Hãy chọn ít nhất một đợt để suy ra thời gian kỳ')
      return
    }
    const start = new Date(formData.startDate).getTime()
    const end = endOfMinute(new Date(formData.endDate)).getTime()
    if (end <= start) {
      toast.error('Thời gian kết thúc phải sau thời gian bắt đầu')
      return
    }
    // Hỏi lại khi độ dài lệch chuẩn — nhưng chỉ ở đường gõ tay. Chọn đợt trước thì lệch
    // chuẩn là chuyện đương nhiên (đợt hiếm khi phủ kín tròn tháng/quý), hỏi mỗi lần lưu
    // sẽ thành hộp thoại bấm cho qua.
    const standardEnd = computeStandardEndDate(new Date(formData.startDate), formData.cycleType).getTime()
    if (!isPeriodFirst && Math.abs(end - standardEnd) > 60 * 1000) {
      setShowMismatchConfirm(true)
      return
    }
    await submitForm()
  }

  const selectedDays = formData.startDate && formData.endDate
    ? differenceInCalendarDays(new Date(formData.endDate), new Date(formData.startDate)) + 1 : 0
  const standardDays = formData.startDate
    ? differenceInCalendarDays(computeStandardEndDate(new Date(formData.startDate), formData.cycleType), new Date(formData.startDate)) + 1 : 0
  const mismatchDescription = `Bạn đã chọn ${selectedDays} ngày, trong khi loại kỳ "${FREQUENCY_MAP[formData.cycleType]}" tiêu chuẩn là ${standardDays} ngày. Bạn tự chịu trách nhiệm với khoảng thời gian đã chọn.`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-lg mx-auto animate-in zoom-in-95 fade-in duration-500 overflow-y-auto overflow-x-hidden max-h-[92vh] scrollbar-thin border border-slate-200 dark:border-slate-800">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="p-10 space-y-8 relative">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[22px] bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner border border-emerald-100/50 dark:border-emerald-800/50">
              {editCycle ? <Pencil size={28} /> : <Plus size={28} />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{editCycle ? 'Chỉnh sửa kỳ' : 'Tạo kỳ mới'}</h3>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Cấu hình kỳ đánh giá tổng hợp</p>
            </div>
          </div>

          {/* Hai đường dựng kỳ. Đổi qua lại không mất dữ liệu đã nhập. */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Cách dựng kỳ</span>
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-[22px] bg-slate-100/70 dark:bg-slate-800/70">
              {([
                { key: 'TIME_FIRST', icon: <Calendar size={14} />, label: 'Chọn thời gian trước' },
                { key: 'PERIOD_FIRST', icon: <Layers size={14} />, label: 'Chọn đợt trước' },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMode(opt.key)}
                  className={cn(
                    'flex items-center justify-center gap-2 px-3 py-2.5 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all',
                    mode === opt.key
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  )}
                >
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 font-medium ml-1 leading-relaxed">
              {isPeriodFirst
                ? 'Chọn các đợt cần gom, thời gian kỳ tự ôm trọn từ đợt sớm nhất tới đợt muộn nhất.'
                : 'Đặt thời gian kỳ trước, sau đó nhặt các đợt nằm trọn trong khoảng đó.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Tên kỳ <span className="text-red-500">*</span></label>
              <input value={formData.name} onChange={e => handleFieldChange('name', e.target.value)} required placeholder="Ví dụ: 6 Tháng đầu năm 2026"
                className="w-full px-5 py-4 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none text-sm font-bold transition-all placeholder:text-slate-400" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Loại kỳ <span className="text-red-500">*</span></label>
              <Select value={formData.cycleType} onValueChange={val => handleFieldChange('cycleType', val)}>
                <SelectTrigger className="w-full px-5 h-[56px] rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold shadow-sm focus:ring-4 focus:ring-emerald-500/10">
                  <SelectValue placeholder="Chọn loại kỳ" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                  {CYCLE_TYPES.map(type => (
                    <SelectItem key={type} value={type} className="rounded-xl text-sm font-bold">{FREQUENCY_MAP[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Chế độ đánh giá cuối kỳ</label>
              <Select
                value={formData.evaluationMode}
                onValueChange={val => setFormData(p => ({ ...p, evaluationMode: val as CycleEvaluationMode }))}
                disabled={!enableQualitative}
              >
                <SelectTrigger className="w-full px-5 h-[56px] rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold shadow-sm focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-70">
                  <SelectValue placeholder="Chọn chế độ đánh giá" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
                  <SelectItem value="QUANTITATIVE" className="rounded-xl text-sm font-bold">Định lượng</SelectItem>
                  {enableQualitative && <SelectItem value="QUALITATIVE" className="rounded-xl text-sm font-bold">Định tính</SelectItem>}
                  {enableQualitative && <SelectItem value="BOTH" className="rounded-xl text-sm font-bold">Cả hai</SelectItem>}
                </SelectContent>
              </Select>
              {!enableQualitative && (
                <p className="text-[11px] text-slate-400 font-medium ml-1">
                  Tổ chức chưa bật KPI định tính nên kỳ chỉ đánh giá theo <span className="font-black text-slate-500">Định lượng</span>.
                </p>
              )}
            </div>

            {/* Chọn đợt trước thì danh sách đợt phải đứng trên thời gian — thời gian là kết quả. */}
            <div className={cn('flex flex-col gap-6', isPeriodFirst && 'flex-col-reverse')}>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Bắt đầu <span className="text-red-500">*</span></label>
                  {isPeriodFirst ? (
                    <DerivedDateBox value={formData.startDate} hasPeriods={selectedPeriodIds.length > 0} />
                  ) : (
                    <DateTimePicker value={formData.startDate} onChange={val => handleFieldChange('startDate', val)} />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Kết thúc <span className="text-red-500">*</span></label>
                  {isPeriodFirst ? (
                    <DerivedDateBox value={formData.endDate} hasPeriods={selectedPeriodIds.length > 0} />
                  ) : (
                    <DateTimePicker value={formData.endDate} onChange={val => handleFieldChange('endDate', val)} />
                  )}
                </div>
              </div>
              {isPeriodFirst && (
                <p className="text-[11px] text-slate-400 font-medium ml-1 leading-relaxed">
                  {selectedPeriodIds.length > 0
                    ? <>Suy ra từ {selectedPeriodIds.length} đợt đã chọn — dài <span className="font-black text-slate-500">{selectedDays} ngày</span>, gần nhất với loại kỳ <span className="font-black text-slate-500">{FREQUENCY_MAP[formData.cycleType]}</span> ({standardDays} ngày). Muốn tự chỉnh giờ/ngày thì đổi sang "Chọn thời gian trước".</>
                    : 'Chọn đợt ở trên để hệ thống điền thời gian kỳ.'}
                </p>
              )}
            </div>

            {/* Gom đợt vào kỳ ngay khi tạo — khỏi phải sang tab Đợt chỉnh từng đợt. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 ml-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Đợt trong kỳ
                  {selectedPeriodIds.length > 0 && (
                    <span className="ml-2 text-emerald-600 dark:text-emerald-400">({selectedPeriodIds.length})</span>
                  )}
                </label>
                {eligiblePeriods.length > 0 && (
                  <button type="button" onClick={toggleAllEligible}
                    className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:underline">
                    {allEligibleSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả (${eligiblePeriods.length})`}
                  </button>
                )}
              </div>

              <div className="rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-2 max-h-56 overflow-y-auto scrollbar-thin">
                {isLoadingPeriods ? (
                  <p className="px-3 py-4 text-xs font-bold text-slate-400 text-center">Đang tải danh sách đợt...</p>
                ) : !sortedPeriods.length ? (
                  <p className="px-3 py-4 text-xs font-bold text-slate-400 text-center">Chưa có đợt nào trong tổ chức.</p>
                ) : !eligiblePeriods.length ? (
                  <p className="px-3 py-4 text-xs font-bold text-slate-400 text-center">
                    {isPeriodFirst
                      ? 'Các đợt hiện có đều thiếu ngày bắt đầu hoặc kết thúc.'
                      : 'Không có đợt nào nằm trọn trong thời gian kỳ đã chọn.'}
                  </p>
                ) : sortedPeriods.map(period => {
                  const eligible = canPick(period)
                  const selected = selectedPeriodIds.includes(period.id)
                  const fromOtherCycle = !!period.cycleId && period.cycleId !== editCycle?.id
                  return (
                    <button
                      key={period.id}
                      type="button"
                      disabled={!eligible}
                      onClick={() => togglePeriod(period.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all',
                        eligible ? 'hover:bg-white dark:hover:bg-slate-800 cursor-pointer' : 'opacity-40 cursor-not-allowed',
                        selected && 'bg-white dark:bg-slate-800 shadow-sm'
                      )}
                    >
                      <span className={cn(
                        'w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all',
                        selected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'
                      )}>
                        {selected && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{period.name}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                            {FREQUENCY_MAP[period.periodType]}
                          </span>
                        </span>
                        <span className="block text-[10px] font-bold text-slate-400 mt-0.5">
                          {period.startDate ? format(parseISO(period.startDate), 'dd/MM/yyyy') : '—'}
                          {' – '}
                          {period.endDate ? format(parseISO(period.endDate), 'dd/MM/yyyy') : '—'}
                        </span>
                        {!eligible ? (
                          <span className="block text-[10px] font-bold text-slate-400 mt-0.5">
                            {isPeriodFirst ? 'Đợt chưa có ngày bắt đầu/kết thúc' : 'Ngoài thời gian kỳ'}
                          </span>
                        ) : fromOtherCycle && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-500 mt-0.5">
                            <AlertTriangle size={10} /> Đang thuộc kỳ "{period.cycleName}"{selected && ' — sẽ chuyển sang kỳ này'}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-slate-400 font-medium ml-1">
                {isPeriodFirst
                  ? 'Chọn đợt nào cũng được, kể cả đợt rời rạc — thời gian kỳ sẽ trải từ đợt sớm nhất tới đợt muộn nhất.'
                  : 'Chỉ chọn được đợt nằm trọn trong thời gian kỳ. Đổi thời gian kỳ sẽ tự bỏ các đợt không còn phù hợp.'}
              </p>
            </div>

            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Mô tả</label>
              <textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Mục tiêu tổng thể của kỳ..."
                className="w-full px-5 py-4 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none text-sm font-medium transition-all placeholder:text-slate-400 resize-none" />
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={onClose} className="flex-1 px-8 py-4 rounded-[20px] border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">Huỷ</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 px-8 py-4 rounded-[20px] bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/25 disabled:opacity-50 active:scale-95">
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
        confirmLabel="Vẫn lưu kỳ này"
        onConfirm={async () => { setShowMismatchConfirm(false); await submitForm() }}
        onClose={() => setShowMismatchConfirm(false)}
        loading={isSubmitting}
      />
    </div>
  )
}
