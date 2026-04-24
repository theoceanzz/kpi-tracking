import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import KpiReviewModal from '../components/KpiReviewModal'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { formatNumber, formatAssigneeNames } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import { 
  ClipboardCheck, Clock, CheckCircle2, XCircle, Filter, 
  Target, Users, Building2, ChevronRight, ArrowUpDown,
  Calendar, ChevronLeft, Search
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '../hooks/useKpiPeriods'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-900/40', icon: Clock },
  APPROVED: { label: 'Đã duyệt', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-900/40', icon: CheckCircle2 },
  REJECTED: { label: 'Từ chối', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-900/40', icon: XCircle },
}

export default function KpiApprovalPage() {
  const [activeTab, setActiveTab] = useState<'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING_APPROVAL')
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  
  const user = useAuthStore(s => s.user)
  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })

  const { data, isLoading } = useKpiCriteria(
    { 
      status: activeTab === 'ALL' ? undefined : activeTab,
      kpiPeriodId: selectedPeriodId || undefined,
      page,
      size: pageSize,
      sortBy,
      sortDir
    }
  )

  const [reviewKpi, setReviewKpi] = useState<KpiCriteria | null>(null)

  const items = data?.content ?? []
  const filteredItems = items.filter(k => 
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    (k.orgUnitName && k.orgUnitName.toLowerCase().includes(search.toLowerCase())) ||
    (k.assigneeNames && k.assigneeNames.some(n => n.toLowerCase().includes(search.toLowerCase())))
  )

  // Quick stats from ALL status
  const { data: statsData } = useKpiCriteria({ size: 1000 })
  const stats = useMemo(() => {
    const all = statsData?.content ?? []
    return {
      total: all.length,
      pending: all.filter(k => k.status === 'PENDING_APPROVAL').length,
      approved: all.filter(k => k.status === 'APPROVED').length,
      rejected: all.filter(k => k.status === 'REJECTED').length,
    }
  }, [statsData])

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest">
            <ClipboardCheck size={14} /> Quản trị chỉ tiêu
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Xét duyệt Chỉ tiêu KPI
          </h1>
          <p className="text-slate-500 font-medium max-w-lg">
            Hệ thống hóa quy trình phê duyệt chỉ tiêu cho toàn bộ tổ chức.
          </p>
        </div>

        <div className="flex gap-3 shrink-0">
          <StatChip label="Chờ duyệt" value={stats.pending} color="amber" />
          <StatChip label="Đã duyệt" value={stats.approved} color="emerald" />
          <StatChip label="Tổng cộng" value={stats.total} color="indigo" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Tìm theo tên, phòng ban, nhân viên..." 
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>

          <div className="relative flex-1 md:w-56">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={selectedPeriodId}
              onChange={e => { setSelectedPeriodId(e.target.value); setPage(0) }}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none transition-all"
            >
              <option value="">Tất cả đợt KPI...</option>
              {periodsData?.content.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => {
            const labels: Record<string, string> = { PENDING_APPROVAL: 'Đợi duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', ALL: 'Tất cả' }
            const active = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(0) }}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  active 
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={8} />
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 p-20 shadow-sm">
          <EmptyState 
            title={activeTab === 'PENDING_APPROVAL' ? 'Không có chỉ tiêu nào đang chờ' : 'Không có dữ liệu'} 
            description="Hãy thay đổi bộ lọc hoặc đợi báo cáo từ các phòng ban." 
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => { setSortBy('name'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Chỉ tiêu <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Phòng ban / Nhân sự</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">
                    <button onClick={() => { setSortBy('targetValue'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-indigo-600 transition-colors justify-end w-full">
                      Mục tiêu <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => { setSortBy('weight'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Trọng số <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((kpi) => (
                  <tr key={kpi.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => setReviewKpi(kpi)}>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${statusConfig[kpi.status]?.bgColor} ${statusConfig[kpi.status]?.color}`}>
                        {kpi.status === 'PENDING_APPROVAL' ? <Clock size={10} /> : kpi.status === 'APPROVED' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {statusConfig[kpi.status]?.label}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs md:max-w-md">
                        <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
                          {kpi.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{frequencyMap[kpi.frequency] || kpi.frequency}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <Building2 size={10} className="text-slate-400" /> {kpi.orgUnitName || 'N/A'}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                          <Users size={10} className="text-slate-400" /> {formatAssigneeNames(kpi.assigneeNames)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {formatNumber(kpi.targetValue || 0)} <span className="text-[10px] text-slate-400 font-medium ml-0.5">{kpi.unit}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg">
                        {kpi.weight}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 rounded-xl transition-all">
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <p className="text-sm font-medium text-slate-500">
          Trang <span className="text-slate-900 dark:text-white">{page + 1}</span> / <span className="text-slate-900 dark:text-white">{data?.totalPages || 1}</span> 
          <span className="mx-2 text-slate-300">•</span> 
          Tổng <span className="text-slate-900 dark:text-white">{data?.totalElements || 0}</span> chỉ tiêu
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, data?.totalPages || 1) }).map((_, i) => {
               // Simple logic for showing 5 pages around current
               const pageNum = i // need more complex logic if totalPages > 5
               return (
                <button
                  key={i}
                  onClick={() => setPage(pageNum)}
                  className={`w-10 h-10 rounded-xl text-sm font-black transition-all ${
                    page === pageNum 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {pageNum + 1}
                </button>
               )
            })}
          </div>
          <button
            onClick={() => setPage(p => Math.min((data?.totalPages || 1) - 1, p + 1))}
            disabled={page >= (data?.totalPages || 1) - 1}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <KpiReviewModal open={!!reviewKpi} onClose={() => setReviewKpi(null)} kpi={reviewKpi} />
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: 'amber' | 'emerald' | 'red' | 'indigo' }) {
  const colorMap = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
    red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/40',
  }
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-[18px] border ${colorMap[color]}`}>
      <span className="text-2xl font-black">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
    </div>
  )
}
