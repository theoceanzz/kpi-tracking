import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { format } from 'date-fns'
import { useKpiCycles } from '../hooks/useKpiCycles'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime, FREQUENCY_MAP, cn } from '@/lib/utils'
import type { KpiCycle } from '@/types/kpi'
import {
  CalendarRange, Plus, Pencil, Trash2, Layers,
  ChevronLeft, ChevronRight, Search, Filter, X, Sparkles, Calendar, ArrowRight,
  List, LayoutGrid
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/common/DateTimePicker'
import { useWorkflowNavigator } from '../workflow/hooks/useWorkflowNavigator'
import CycleFormModal from '../components/CycleFormModal'
import { CYCLE_TYPES } from '../utils/standardDuration'
import WizardEntryButton from '../setup/WizardEntryButton'

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
  const { goToNext } = useWorkflowNavigator()

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

                <WizardEntryButton className="sm:shrink-0" />

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
              if (editCycle) {
                await updateCycle({ id: editCycle.id, data: payload })
                return
              }
              // createCycle là mutateAsync nên giá trị trả về đã là kỳ vừa tạo kèm id — trước đây
              // bị vứt đi. Dùng nó để sang thẳng bước tạo đợt, kỳ được chọn sẵn.
              const created = await createCycle(payload)
              goToNext('CYCLE_SETUP', { cycleId: created?.id })
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
