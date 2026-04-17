import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StatusBadge from '@/components/common/StatusBadge'
import ReviewModal from '../components/ReviewModal'
import { useDeptSubmissions } from '../hooks/useDeptSubmissions'
import { formatDateTime, getInitials, formatNumber } from '@/lib/utils'
import type { Submission, SubmissionStatus } from '@/types/submission'
import {
  FileCheck, Clock, CheckCircle2, XCircle, Filter,
  User, Calendar, ChevronRight, Paperclip
} from 'lucide-react'

type TabKey = SubmissionStatus | ''

const TABS: { key: TabKey; label: string; icon: any; color: string }[] = [
  { key: 'PENDING', label: 'Chờ duyệt', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40' },
  { key: 'APPROVED', label: 'Đã duyệt', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40' },
  { key: 'REJECTED', label: 'Từ chối', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40' },
  { key: '', label: 'Tất cả', icon: Filter, color: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' },
]

export default function DeptSubmissionsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('PENDING')
  const { data, isLoading } = useDeptSubmissions(activeTab ? { status: activeTab } : {})
  const [reviewSub, setReviewSub] = useState<Submission | null>(null)

  // Quick stats from all data
  const { data: allData } = useDeptSubmissions({})
  const stats = useMemo(() => {
    const all = allData?.content ?? []
    return {
      total: all.length,
      pending: all.filter(s => s.status === 'PENDING').length,
      approved: all.filter(s => s.status === 'APPROVED').length,
      rejected: all.filter(s => s.status === 'REJECTED').length,
    }
  }, [allData])

  const items = data?.content ?? []

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-widest">
            <FileCheck size={14} /> Duyệt báo cáo
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Duyệt Bài nộp KPI
          </h1>
          <p className="text-slate-500 font-medium max-w-lg">
            Xem xét và phê duyệt các báo cáo KPI do nhân viên trong phòng ban nộp lên.
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
              {tab.key !== '' && (
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
            title={activeTab === 'PENDING' ? 'Tuyệt vời! Đã xử lý hết' : 'Không có bài nộp'}
            description={activeTab === 'PENDING' ? 'Tất cả bài nộp của nhân viên đã được duyệt xong.' : 'Chưa có bài nộp nào trong danh mục này.'}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((sub, idx) => (
            <button
              key={sub.id}
              onClick={() => setReviewSub(sub)}
              className="w-full text-left group bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 p-5 md:px-7 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-[14px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm shrink-0">
                    {getInitials(sub.submittedByName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {sub.kpiCriteriaName}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1"><User size={12} /> {sub.submittedByName}</span>
                      <span className="flex items-center gap-1"><Calendar size={12} /> {formatDateTime(sub.createdAt)}</span>
                      {sub.attachments?.length > 0 && (
                        <span className="flex items-center gap-1"><Paperclip size={12} /> {sub.attachments.length} tệp</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Thực tế</p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatNumber(sub.actualValue)}</p>
                  </div>
                  {sub.targetValue != null && (
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mục tiêu</p>
                      <p className="text-lg font-black text-slate-600 dark:text-slate-300">{formatNumber(sub.targetValue)}</p>
                    </div>
                  )}
                  <StatusBadge status={sub.status} />
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <ReviewModal open={!!reviewSub} onClose={() => setReviewSub(null)} submission={reviewSub} />
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
