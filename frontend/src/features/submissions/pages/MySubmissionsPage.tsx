import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StatusBadge from '@/components/common/StatusBadge'
import { useMySubmissions } from '../hooks/useMySubmissions'
import { Link } from 'react-router-dom'
import { formatDateTime, formatNumber } from '@/lib/utils'
import type { SubmissionStatus } from '@/types/submission'
import {
  FileText, Plus, Search, ChevronRight, ArrowUpDown, ChevronLeft, Filter, Clock, CheckCircle2, XCircle
} from 'lucide-react'

type TabKey = SubmissionStatus | ''

const TABS: { key: TabKey; label: string; icon: any; color: string }[] = [
  { key: 'PENDING', label: 'Chờ duyệt', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40' },
  { key: 'APPROVED', label: 'Đã duyệt', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40' },
  { key: 'REJECTED', label: 'Từ chối', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40' },
  { key: '', label: 'Tất cả', icon: Filter, color: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' },
]

export default function MySubmissionsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { data, isLoading } = useMySubmissions({
    status: activeTab || undefined,
    page,
    size: pageSize,
    sortBy,
    sortDir
  })

  const allItems = data?.content ?? []
  const filteredItems = allItems.filter(s => 
    s.kpiCriteriaName.toLowerCase().includes(search.toLowerCase())
  )

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(0)
  }

  // Quick stats
  const { data: allData } = useMySubmissions({ size: 1000 })
  const stats = useMemo(() => {
    const all = allData?.content ?? []
    return {
      total: all.length,
      approved: all.filter(s => s.status === 'APPROVED').length,
      pending: all.filter(s => s.status === 'PENDING').length,
    }
  }, [allData])

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest">
            <FileText size={14} /> Quản lý Báo cáo
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Bài nộp của tôi
          </h1>
          <p className="text-slate-500 font-medium max-w-lg">
            Đánh giá tiến độ hoàn thành các chỉ tiêu KPI bằng việc xem lại lịch sử các báo cáo đã nộp.
          </p>
        </div>

        <div className="flex gap-3 shrink-0">
          <StatChip label="Đã duyệt" value={stats.approved} color="emerald" />
          <StatChip label="Chờ duyệt" value={stats.pending} color="amber" />
          <StatChip label="Tổng nộp" value={stats.total} color="indigo" />
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
              placeholder="Tìm theo tên KPI..." 
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>
          
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setPage(0) }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    isActive
                      ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <Link 
          to="/submissions/new" 
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 text-white text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 w-full xl:w-auto justify-center"
        >
          <Plus size={18} /> Nộp bài cáo báo mới
        </Link>
      </div>

      {/* Content Table */}
      {isLoading ? (
        <LoadingSkeleton type="table" rows={pageSize} />
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-300 dark:border-slate-800 p-20">
          <EmptyState
            title="Không tìm thấy bài nộp"
            description="Hãy thử thay đổi bộ lọc hoặc nộp báo cáo mới."
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('kpiCriteriaName')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      KPI / Chỉ tiêu <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">
                    <button onClick={() => handleSort('actualValue')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors justify-end w-full">
                      Kết quả <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Ngày nộp <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((sub) => (
                  <tr 
                    key={sub.id} 
                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs md:max-w-md">
                        <Link 
                          to={`/submissions/${sub.id}`}
                          className="text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors truncate block"
                        >
                          {sub.kpiCriteriaName}
                        </Link>
                        {sub.note && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">"{sub.note}"</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {formatNumber(sub.actualValue)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-500">
                        {formatDateTime(sub.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          to={`/submissions/${sub.id}`}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl transition-all"
                        >
                          <ChevronRight size={20} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm font-medium text-slate-500">
              Trang <span className="text-slate-900 dark:text-white font-bold">{page + 1}</span> / {data?.totalPages || 1} 
              <span className="mx-2 text-slate-300">•</span>
              Tổng <span className="text-slate-900 dark:text-white font-bold">{data?.totalElements || 0}</span> bài nộp
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= (data?.totalPages || 1) - 1}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
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
    <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${colorMap[color]}`}>
      <span className="text-2xl font-black">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
    </div>
  )
}
