import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import KpiReviewModal from '../components/KpiReviewModal'
import StatusBadge from '@/components/common/StatusBadge'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import { formatNumber } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import { 
  ClipboardCheck, Clock, CheckCircle2, XCircle, Filter,
  Target, Users, Building2, BarChart3, ChevronRight
} from 'lucide-react'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

type TabKey = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'

const TABS: { key: TabKey; label: string; icon: any; color: string }[] = [
  { key: 'PENDING', label: 'Chờ duyệt', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40' },
  { key: 'APPROVED', label: 'Đã duyệt', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40' },
  { key: 'REJECTED', label: 'Từ chối', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40' },
  { key: 'ALL', label: 'Tất cả', icon: Filter, color: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' },
]

export default function KpiApprovalPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('PENDING')
  const { data, isLoading } = useKpiCriteria(activeTab === 'ALL' ? {} : { status: activeTab })
  const [reviewKpi, setReviewKpi] = useState<KpiCriteria | null>(null)

  const items = data?.content ?? []

  // Quick stats
  const { data: allData } = useKpiCriteria({})
  const stats = useMemo(() => {
    const all = allData?.content ?? []
    return {
      total: all.length,
      pending: all.filter(k => k.status === 'PENDING').length,
      approved: all.filter(k => k.status === 'APPROVED').length,
      rejected: all.filter(k => k.status === 'REJECTED').length,
    }
  }, [allData])

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
            Phê duyệt hoặc từ chối các chỉ tiêu KPI được đề xuất từ quản lý cấp dưới trước khi đưa vào vận hành.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3 shrink-0">
          <StatChip label="Chờ duyệt" value={stats.pending} color="amber" />
          <StatChip label="Đã duyệt" value={stats.approved} color="emerald" />
          <StatChip label="Từ chối" value={stats.rejected} color="red" />
        </div>
      </div>

      {/* Tab Filters */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                isActive
                  ? tab.color + ' shadow-sm'
                  : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.key !== 'ALL' && (
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-md font-black ${isActive ? 'bg-white/50 dark:bg-black/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {tab.key === 'PENDING' ? stats.pending : tab.key === 'APPROVED' ? stats.approved : stats.rejected}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-300 dark:border-slate-800 p-16">
          <EmptyState 
            title={activeTab === 'PENDING' ? 'Tuyệt vời! Không còn chỉ tiêu nào chờ xử lý' : 'Không có dữ liệu'} 
            description={activeTab === 'PENDING' ? 'Tất cả chỉ tiêu đã được bạn phê duyệt hoặc phản hồi.' : 'Chưa có chỉ tiêu nào trong danh mục này.'} 
          />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((kpi, idx) => (
            <button
              key={kpi.id}
              onClick={() => setReviewKpi(kpi)}
              className="w-full text-left group bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 p-5 md:px-7 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Target size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {kpi.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-medium text-slate-500">
                      {kpi.departmentName && (
                        <span className="flex items-center gap-1"><Building2 size={12} /> {kpi.departmentName}</span>
                      )}
                      {kpi.assignedToName && (
                        <span className="flex items-center gap-1"><Users size={12} /> {kpi.assignedToName}</span>
                      )}
                      <span className="flex items-center gap-1"><BarChart3 size={12} /> {frequencyMap[kpi.frequency] ?? kpi.frequency}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 shrink-0">
                  {kpi.targetValue != null && (
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mục tiêu</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatNumber(kpi.targetValue)} {kpi.unit ?? ''}</p>
                    </div>
                  )}
                  {kpi.weight != null && (
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trọng số</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{kpi.weight}%</p>
                    </div>
                  )}
                  <StatusBadge status={kpi.status} />
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <KpiReviewModal open={!!reviewKpi} onClose={() => setReviewKpi(null)} kpi={reviewKpi} />
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: 'amber' | 'emerald' | 'red' }) {
  const colorMap = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
    red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
  }
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-[18px] border ${colorMap[color]}`}>
      <span className="text-2xl font-black">{value}</span>
      <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
    </div>
  )
}
