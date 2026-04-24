import { useState } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { useMyKpi } from '../hooks/useMyKpi'
import { Link } from 'react-router-dom'
import { formatNumber } from '@/lib/utils'
import {
  Target, Search, PlayCircle,
  Calendar, Activity, Award, CheckCircle2, ChevronRight, XCircle, AlertCircle,
  LayoutGrid, List, ArrowUpDown, ChevronLeft
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import KpiDetailModal from '../components/KpiDetailModal'
import type { KpiCriteria } from '@/types/kpi'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng', QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: 'Bản nháp', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700', icon: AlertCircle },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-900/40', icon: Calendar },
  APPROVED: { label: 'Đang thực hiện', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-900/40', icon: CheckCircle2 },
  REJECTED: { label: 'Từ chối', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-900/40', icon: XCircle },
}

export default function MyKpiPage() {
  const user = useAuthStore(s => s.user)
  const [search, setSearch] = useState('')
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>('TABLE')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(5)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewKpi, setViewKpi] = useState<KpiCriteria | null>(null)

  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  
  const { data, isLoading } = useMyKpi({
    page,
    size: pageSize,
    kpiPeriodId: selectedPeriodId || undefined,
    sortBy,
    sortDir
  })

  const allKpis = (data?.content ?? []).filter(k => k.status === 'APPROVED')
  const filteredKpis = allKpis.filter(k => 
    k.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest">
            <Target size={14} /> Mục tiêu cá nhân
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            KPI của tôi
          </h1>
          <p className="text-slate-500 font-medium max-w-lg">
            Quản lý và theo dõi các chỉ tiêu do quản lý giao phó. Hãy nộp báo cáo đúng tiến độ!
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Tìm kiếm theo tên KPI..." 
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
            />
          </div>

          <div className="relative flex-1 md:w-48">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={selectedPeriodId}
              onChange={e => { setSelectedPeriodId(e.target.value); setPage(0) }}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none transition-all"
            >
              <option value="">Đợt KPI...</option>
              {periodsData?.content.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400'}`}
              title="Xem dạng bảng"
            >
              <List size={20} />
            </button>
            <button 
              onClick={() => setViewMode('CARD')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'CARD' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400'}`}
              title="Xem dạng thẻ"
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={6} />
      ) : filteredKpis.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 p-20 shadow-sm">
          <EmptyState 
            title={search || selectedPeriodId ? "Không tìm thấy KPI" : "Chưa có chỉ tiêu nào"} 
            description={search || selectedPeriodId ? "Không có KPI nào khớp với bộ lọc hiện tại." : "Bạn chưa được quản lý giao bất kỳ chỉ tiêu KPI nào."} 
          />
        </div>
      ) : viewMode === 'TABLE' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => { setSortBy('name'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                      Chỉ tiêu <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">
                    <button onClick={() => { setSortBy('targetValue'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-blue-600 transition-colors justify-end w-full">
                      Mục tiêu <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => { setSortBy('weight'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                      Trọng số <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Tiến độ nộp</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Hạn cuối</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredKpis.map((kpi) => (
                  <MyKpiTableRow key={kpi.id} kpi={kpi} onView={() => setViewKpi(kpi)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredKpis.map((kpi, idx) => (
            <MyKpiCard key={kpi.id} kpi={kpi} delay={idx * 40} onView={() => setViewKpi(kpi)} />
          ))}
        </div>
      )}

      <KpiDetailModal 
        open={!!viewKpi} 
        onClose={() => setViewKpi(null)} 
        kpi={viewKpi} 
      />

      {data && data.totalElements > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-500">
            Hiển thị <span className="text-slate-900 dark:text-white">{page * pageSize + 1}</span> - <span className="text-slate-900 dark:text-white">{Math.min((page + 1) * pageSize, data.totalElements)}</span> của <span className="text-slate-900 dark:text-white">{data.totalElements}</span> chỉ tiêu
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(data.totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-10 h-10 rounded-xl text-sm font-black transition-all ${
                    page === i 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
              disabled={page === data.totalPages - 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function getNextDeadline(kpi: KpiCriteria) {
  if (!kpi.kpiPeriod?.startDate || !kpi.kpiPeriod?.endDate) return null
  const start = new Date(kpi.kpiPeriod.startDate).getTime()
  const end = new Date(kpi.kpiPeriod.endDate).getTime()
  const totalSubmissions = kpi.expectedSubmissions || 1
  const currentSub = kpi.submissionCount || 0

  // Nếu đã nộp đủ thì hiện hạn cuối của kỳ
  if (currentSub >= totalSubmissions) return new Date(end)

  const duration = end - start
  const subDuration = duration / totalSubmissions
  
  // Deadline của lần nộp tiếp theo
  return new Date(start + (currentSub + 1) * subDuration)
}

function MyKpiTableRow({ kpi, onView }: { kpi: KpiCriteria; onView: () => void }) {
  const status = statusConfig[kpi.status] ?? statusConfig['DRAFT']!
  const StatusIcon = status.icon
  
  const nextDeadline = getNextDeadline(kpi)
  const deadlineStr = nextDeadline ? nextDeadline.toLocaleDateString('vi-VN') : '—'
  const isOverdue = nextDeadline && nextDeadline < new Date()
  
  const now = new Date()
  const periodStart = kpi.kpiPeriod?.startDate ? new Date(kpi.kpiPeriod.startDate) : null
  const periodEnd = kpi.kpiPeriod?.endDate ? new Date(kpi.kpiPeriod.endDate) : null
  const isPeriodClosed = (periodStart && now < periodStart) || (periodEnd && now > periodEnd)

  const currentSubNum = Math.min(kpi.submissionCount + 1, kpi.expectedSubmissions)

  return (
    <tr className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-6 py-4">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${status.bgColor} ${status.color}`}>
          <StatusIcon size={10} /> {status.label}
        </div>
      </td>
      <td className="px-6 py-4">
        <button onClick={onView} className="max-w-md text-left focus:outline-none">
          <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">
            {kpi.name}
          </p>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{frequencyMap[kpi.frequency] || kpi.frequency}</p>
        </button>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="text-sm font-black text-slate-900 dark:text-white">
          {formatNumber(kpi.targetValue || 0)} <span className="text-[10px] text-slate-400 font-medium ml-0.5">{kpi.unit}</span>
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg">
          {kpi.weight}%
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400 mb-0.5">Đã nộp</span>
          <span className={`text-sm font-black ${kpi.submissionCount < (kpi.expectedSubmissions || 1) ? 'text-amber-600' : 'text-emerald-600'}`}>
            {kpi.submissionCount || 0} / {kpi.expectedSubmissions || 1} lần
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className={isOverdue ? 'text-red-500' : 'text-slate-400'} />
            <span className={`text-xs font-bold ${isOverdue ? 'text-red-500 underline decoration-2' : 'text-slate-600 dark:text-slate-300'}`}>
              {deadlineStr}
            </span>
          </div>
          {kpi.expectedSubmissions > 1 && kpi.submissionCount < kpi.expectedSubmissions && (
            <span className="text-[9px] font-black uppercase text-blue-500 mt-1">Hạn lần {currentSubNum}</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        {kpi.submissionCount >= (kpi.expectedSubmissions || 1) ? (
          <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed">
            <CheckCircle2 size={14} /> Hoàn thành
          </div>
        ) : isPeriodClosed ? (
          <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-amber-200 dark:border-amber-900/40">
            <Calendar size={14} /> 
            {periodStart && now < periodStart ? 'Chưa mở' : 'Hết hạn'}
          </div>
        ) : (
          <Link 
            to={`/submissions/new?kpiId=${kpi.id}`} 
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white hover:bg-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
          >
            <PlayCircle size={14} /> Nộp báo cáo
          </Link>
        )}
      </td>
    </tr>
  )
}

function MyKpiCard({ kpi, delay, onView }: { kpi: KpiCriteria; delay: number; onView: () => void }) {
  const status = statusConfig[kpi.status] ?? statusConfig['DRAFT']!
  const StatusIcon = status.icon
  
  const nextDeadline = getNextDeadline(kpi)
  const deadlineStr = nextDeadline ? nextDeadline.toLocaleDateString('vi-VN') : '—'
  const isOverdue = nextDeadline && nextDeadline < new Date()

  const now = new Date()
  const periodStart = kpi.kpiPeriod?.startDate ? new Date(kpi.kpiPeriod.startDate) : null
  const periodEnd = kpi.kpiPeriod?.endDate ? new Date(kpi.kpiPeriod.endDate) : null
  const isPeriodClosed = (periodStart && now < periodStart) || (periodEnd && now > periodEnd)

  const currentSubNum = Math.min(kpi.submissionCount + 1, kpi.expectedSubmissions)

  return (
    <div 
      className="group bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 flex flex-col h-full"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="p-6 pb-0 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Target size={24} />
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${status.bgColor} ${status.color}`}>
            <StatusIcon size={12} /> {status.label}
          </div>
        </div>

        <button 
          onClick={onView}
          className="text-left focus:outline-none block w-full"
        >
          <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-2">
            {kpi.name}
          </h3>
        </button>
        
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <Calendar size={12} /> 
            {kpi.expectedSubmissions > 1 && kpi.submissionCount < kpi.expectedSubmissions ? `Hạn lần ${currentSubNum}: ` : 'Hạn cuối: '}
            <span className={isOverdue ? 'text-red-500 underline' : 'text-slate-600 dark:text-slate-300'}>{deadlineStr}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Award size={14} className="text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trọng số</p>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              {kpi.weight != null ? `${kpi.weight}%` : '—'}
            </p>
          </div>
          
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={14} className="text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiến độ nộp</p>
            </div>
            <p className={`text-sm font-black ${kpi.submissionCount < (kpi.expectedSubmissions || 1) ? 'text-amber-600' : 'text-emerald-600'}`}>
              {kpi.submissionCount || 0} / {kpi.expectedSubmissions || 1} <span className="text-[10px]">lần</span>
            </p>
          </div>
        </div>

        {kpi.targetValue != null && (
          <div className="mt-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500/60 mb-1">Mục tiêu {frequencyMap[kpi.frequency] || kpi.frequency}</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{formatNumber(kpi.targetValue)}</span>
              <span className="text-sm font-bold text-indigo-50 mb-1">{kpi.unit ?? ''}</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 mt-4 pt-0">
        {kpi.submissionCount >= (kpi.expectedSubmissions || 1) ? (
          <div className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl font-black text-sm cursor-not-allowed">
            <CheckCircle2 size={18} /> Đã hoàn thành báo cáo
          </div>
        ) : isPeriodClosed ? (
          <div className="w-full flex flex-col items-center justify-center gap-1 px-6 py-3.5 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-500 rounded-2xl font-black text-sm border border-amber-100 dark:border-amber-900/30 cursor-not-allowed">
             <div className="flex items-center gap-2">
                <Calendar size={18} />
                <span>{periodStart && now < periodStart ? 'Chưa đến kỳ nộp' : 'Đã hết hạn nộp'}</span>
             </div>
             <span className="text-[10px] font-bold opacity-70">
                {periodStart && now < periodStart ? `Mở từ: ${new Date(periodStart).toLocaleDateString('vi-VN')}` : `Đã đóng: ${new Date(periodEnd!).toLocaleDateString('vi-VN')}`}
             </span>
          </div>
        ) : (
          <Link 
            to={`/submissions/new?kpiId=${kpi.id}`} 
            className="w-full flex items-center justify-between px-6 py-3.5 bg-slate-900 dark:bg-slate-800 text-white hover:bg-blue-600 rounded-2xl font-black text-sm transition-all group/btn shadow-lg"
          >
            <span className="flex items-center gap-2">
              <PlayCircle size={18} /> Nộp bài cáo báo
            </span>
            <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>
    </div>
  )
}
