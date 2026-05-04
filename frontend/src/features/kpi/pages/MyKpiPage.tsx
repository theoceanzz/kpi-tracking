import { useState } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { useMyKpi } from '../hooks/useMyKpi'
import { Link } from 'react-router-dom'
import { formatNumber } from '@/lib/utils'
import {
  Target, Search,
  Calendar, CheckCircle2, ChevronRight, XCircle, AlertCircle,
  LayoutGrid, List, ChevronLeft, Settings2, Filter
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import KpiDetailModal from '../components/KpiDetailModal'
import KpiAdjustmentModal from '../components/KpiAdjustmentModal'
import type { KpiCriteria } from '@/types/kpi'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng', QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: 'Bản nháp', color: 'text-slate-600', bgColor: 'bg-slate-100 border-slate-200', icon: AlertCircle },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'text-amber-600', bgColor: 'bg-amber-100 border-amber-200', icon: Calendar },
  APPROVED: { label: 'Đang thực hiện', color: 'text-emerald-600', bgColor: 'bg-emerald-100 border-emerald-200', icon: CheckCircle2 },
  REJECTED: { label: 'Từ chối', color: 'text-red-600', bgColor: 'bg-red-100 border-red-200', icon: XCircle },
  EDIT: { label: 'Đang sửa', color: 'text-purple-600', bgColor: 'bg-purple-100 border-purple-200', icon: AlertCircle },
  EDITED: { label: 'Đã sửa', color: 'text-blue-600', bgColor: 'bg-blue-100 border-blue-200', icon: CheckCircle2 },
}

export default function MyKpiPage() {
  const user = useAuthStore(s => s.user)
  const [search, setSearch] = useState('')
  const [selectedPeriodId, setSelectedPeriodId] = useState('ALL')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>('TABLE')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy] = useState('createdAt')
  const [sortDir] = useState<'asc' | 'desc'>('desc')
  const [viewKpi, setViewKpi] = useState<KpiCriteria | null>(null)
  const [adjustKpi, setAdjustKpi] = useState<KpiCriteria | null>(null)

  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  
  const { data, isLoading } = useMyKpi({
    page,
    size: pageSize,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    sortBy,
    sortDir
  })

  const allKpis = (data?.content ?? []).filter(k => k.status === 'APPROVED' || k.status === 'EDITED')
  const filteredKpis = allKpis.filter(k => 
    k.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500 transition-all duration-500 ease-in-out">
      
      {/* Refined Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Target size={20} />
            <span className="text-xs font-black uppercase tracking-[2px]">Mục tiêu cá nhân</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Danh sách KPI của tôi
          </h1>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Tìm tên KPI..." 
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>

          <div className="relative flex-1 md:w-48">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Select value={selectedPeriodId} onValueChange={val => { setSelectedPeriodId(val); setPage(0) }}>
              <SelectTrigger className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm shadow-sm h-10">
                <SelectValue placeholder="Tất cả kỳ..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[var(--color-border)] shadow-lg max-h-[300px]">
                <SelectItem value="ALL" className="font-medium cursor-pointer rounded-lg text-sm">Tất cả kỳ...</SelectItem>
                {periodsData?.content.map(p => (
                  <SelectItem key={p.id} value={p.id} className="font-medium cursor-pointer rounded-lg text-sm">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('CARD')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'CARD' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={6} />
      ) : filteredKpis.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-20 shadow-sm transition-all">
          <EmptyState 
            title={search || selectedPeriodId ? "Không tìm thấy" : "Trống"} 
            description="Bạn chưa có chỉ tiêu KPI nào trong danh sách hiện tại." 
          />
        </div>
      ) : viewMode === 'TABLE' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Chỉ tiêu</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Mục tiêu</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Trọng số</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tiến độ</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Hạn nộp</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredKpis.map((kpi) => (
                <MyKpiTableRow 
                  key={kpi.id} 
                  kpi={kpi} 
                  onView={() => setViewKpi(kpi)} 
                  onAdjust={() => setAdjustKpi(kpi)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 transition-all duration-500">
          {filteredKpis.map((kpi, idx) => (
            <MyKpiCard 
              key={kpi.id} 
              kpi={kpi} 
              delay={idx * 40} 
              onView={() => setViewKpi(kpi)} 
              onAdjust={() => setAdjustKpi(kpi)}
            />
          ))}
        </div>
      )}

      {/* Pagination & Modals (remains similar but refined) */}
      <KpiDetailModal open={!!viewKpi} onClose={() => setViewKpi(null)} kpi={viewKpi} />
      <KpiAdjustmentModal open={!!adjustKpi} onClose={() => setAdjustKpi(null)} kpi={adjustKpi} />

      {data && data.totalElements > 0 && (
        <div className="flex items-center justify-between pt-4 transition-all">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.totalElements)} / {data.totalElements} KPI
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
              disabled={page === data.totalPages - 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MyKpiTableRow({ kpi, onView, onAdjust }: { kpi: KpiCriteria; onView: () => void; onAdjust: () => void }) {
  const status = statusConfig[kpi.status] ?? statusConfig['DRAFT']!
  const nextDeadline = getNextDeadline(kpi)
  const isOverdue = nextDeadline && nextDeadline < new Date()
  
  return (
    <tr className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-6 py-4">
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${status.bgColor} ${status.color}`}>
          {status.label}
        </div>
      </td>
      <td className="px-6 py-4">
        <button onClick={onView} className="text-left focus:outline-none max-w-xs truncate">
          <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">{kpi.name}</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{frequencyMap[kpi.frequency]}</p>
        </button>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="text-sm font-black text-slate-900 dark:text-white">
          {formatNumber(kpi.targetValue || 0)} <span className="text-[10px] text-slate-400 font-medium">{kpi.unit}</span>
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg">
          {kpi.weight}%
        </span>
      </td>
      <td className="px-6 py-4">
        <span className={`text-xs font-black ${kpi.submissionCount < (kpi.expectedSubmissions || 1) ? 'text-amber-600' : 'text-emerald-600'}`}>
          {kpi.submissionCount || 0}/{kpi.expectedSubmissions || 1} lần
        </span>
      </td>
      <td className="px-6 py-4">
        <span className={`text-[11px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>
          {nextDeadline?.toLocaleDateString('vi-VN') || '—'}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {kpi.submissionCount < (kpi.expectedSubmissions || 1) && (
            <button onClick={onAdjust} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition-all">
              <Settings2 size={16} />
            </button>
          )}
          {kpi.submissionCount < (kpi.expectedSubmissions || 1) ? (
            (!kpi.kpiPeriod?.startDate || new Date(kpi.kpiPeriod.startDate) <= new Date()) ? (
              <Link to={`/submissions/new?kpiId=${kpi.id}`} className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white hover:bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                Nộp bài
              </Link>
            ) : (
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 cursor-not-allowed">
                Chưa mở
              </div>
            )
          ) : (
             <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
               <CheckCircle2 size={12} /> Đã Xong
             </div>
          )}
        </div>
      </td>
    </tr>
  )
}

function MyKpiCard({ kpi, delay, onView, onAdjust }: { kpi: KpiCriteria; delay: number; onView: () => void; onAdjust: () => void }) {
  const status = statusConfig[kpi.status] ?? statusConfig['DRAFT']!

  return (
    <div 
      className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 flex flex-col h-full overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="p-5 flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Target size={20} />
          </div>
          <div className={`px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${status.bgColor} ${status.color}`}>
            {status.label}
          </div>
        </div>

        <button onClick={onView} className="text-left w-full group-hover:text-indigo-600 transition-colors">
          <h3 className="text-lg font-black text-slate-900 dark:text-white line-clamp-2 leading-tight">{kpi.name}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{frequencyMap[kpi.frequency]}</p>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mục tiêu</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{formatNumber(kpi.targetValue ?? 0)} <span className="text-[10px]">{kpi.unit}</span></p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Trọng số</p>
            <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{kpi.weight}%</p>
          </div>
        </div>
      </div>

      <div className="p-5 pt-0 mt-auto flex items-center gap-3">
        {kpi.submissionCount < (kpi.expectedSubmissions || 1) && (
          <button onClick={onAdjust} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all">
            <Settings2 size={18} />
          </button>
        )}
        {kpi.submissionCount < (kpi.expectedSubmissions || 1) ? (
          (!kpi.kpiPeriod?.startDate || new Date(kpi.kpiPeriod.startDate) <= new Date()) ? (
            <Link to={`/submissions/new?kpiId=${kpi.id}`} className="flex-1 px-6 py-3 bg-slate-900 dark:bg-slate-800 text-white hover:bg-indigo-600 rounded-2xl font-black text-xs text-center transition-all uppercase tracking-widest">
              Nộp báo cáo
            </Link>
          ) : (
            <div className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl font-black text-xs text-center uppercase tracking-widest border border-slate-200 dark:border-slate-700 cursor-not-allowed">
              Chưa mở nộp
            </div>
          )
        ) : (
          <div className="flex-1 px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl font-black text-xs text-center flex items-center justify-center gap-2 uppercase tracking-widest">
            <CheckCircle2 size={16} /> Hoàn thành
          </div>
        )}
      </div>
    </div>
  )
}

function getNextDeadline(kpi: KpiCriteria) {
  if (!kpi.kpiPeriod?.startDate || !kpi.kpiPeriod?.endDate) return null
  const start = new Date(kpi.kpiPeriod.startDate).getTime()
  const end = new Date(kpi.kpiPeriod.endDate).getTime()
  const totalSubmissions = kpi.expectedSubmissions || 1
  const currentSub = kpi.submissionCount || 0
  if (currentSub >= totalSubmissions) return new Date(end)
  const duration = end - start
  const subDuration = duration / totalSubmissions
  return new Date(start + (currentSub + 1) * subDuration)
}
