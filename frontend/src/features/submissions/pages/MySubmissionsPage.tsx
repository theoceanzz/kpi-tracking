import { useState } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StatusBadge from '@/components/common/StatusBadge'
import { useMySubmissions } from '../hooks/useMySubmissions'
import { Link } from 'react-router-dom'
import { formatDateTime, formatNumber } from '@/lib/utils'
import type { Submission } from '@/types/submission'
import {
  FileText, Plus, Search, Calendar, ChevronRight
} from 'lucide-react'

export default function MySubmissionsPage() {
  const { data, isLoading } = useMySubmissions()
  const [search, setSearch] = useState('')

  const allSubmissions = data?.content ?? []
  const filteredSubmissions = allSubmissions.filter(s => 
    s.kpiCriteriaName.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: allSubmissions.length,
    approved: allSubmissions.filter(s => s.status === 'APPROVED').length,
    pending: allSubmissions.filter(s => s.status === 'SUBMITTED').length,
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-black uppercase tracking-widest">
            <FileText size={14} /> Quản lý Báo cáo
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Bài nộp của tôi
          </h1>
          <p className="text-slate-500 font-medium max-w-lg">
            Đánh giá tiến độ hoàn thành các chỉ tiêu KPI bằng việc xem lại lịch sử các báo cáo đã nộp.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex bg-slate-50 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm">
            <div className="px-5 py-2 text-center border-r border-slate-200 dark:border-slate-800">
              <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đã nộp</p>
            </div>
            <div className="px-5 py-2 text-center border-r border-slate-200 dark:border-slate-800">
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.approved}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đã duyệt</p>
            </div>
            <div className="px-5 py-2 text-center">
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.pending}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chờ duyệt</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo tên KPI..." 
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all shadow-sm"
          />
        </div>

        <Link 
          to="/submissions/new" 
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 w-full sm:w-auto justify-center"
        >
          <Plus size={18} /> Nộp bài cáo báo mới
        </Link>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <LoadingSkeleton type="table" rows={6} />
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-300 dark:border-slate-800 p-16">
          <EmptyState 
            title={search ? "Không tìm thấy bài nộp" : "Chưa nộp bài nào"} 
            description={search ? "Không khớp với từ khóa của bạn." : "Bạn chưa nộp bất kỳ báo cáo KPI nào lên hệ thống."} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubmissions.map((submission, idx) => (
            <MySubmissionCard key={submission.id} submission={submission} delay={idx * 50} />
          ))}
        </div>
      )}
    </div>
  )
}

function MySubmissionCard({ submission, delay }: { submission: Submission; delay: number }) {
  // Config matching
  const isApproved = submission.status === 'APPROVED'
  const isRejected = submission.status === 'REJECTED'

  const gradientCls = isApproved 
    ? 'from-emerald-500 to-teal-500' 
    : isRejected 
    ? 'from-red-500 to-rose-600' 
    : 'from-amber-400 to-orange-500'

  const IconBgCls = isApproved 
    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' 
    : isRejected 
    ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-100 dark:border-red-800' 
    : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-amber-100 dark:border-amber-800'

  return (
    <Link
      to={`/submissions/${submission.id}`}
      className="group bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-800 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 flex flex-col relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top Decor Line */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${gradientCls}`} />

      {/* Header Info */}
      <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${IconBgCls}`}>
            <FileText size={22} />
          </div>
          <StatusBadge status={submission.status} />
        </div>
        
        <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors line-clamp-2">
          {submission.kpiCriteriaName}
        </h3>
        
        <div className="flex items-center gap-2 mt-3 text-xs font-bold text-slate-400">
          <Calendar size={14} />
          {formatDateTime(submission.createdAt)}
        </div>
      </div>

      {/* Actual Data Info */}
      <div className="p-6 bg-slate-50 dark:bg-slate-800/20 flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Thống kê giá trị</p>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="text-xs font-bold text-slate-500">Trị số thực tế</span>
            </div>
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {formatNumber(submission.actualValue)}
            </span>
          </div>
          
          <div className="h-px bg-slate-100 dark:bg-slate-700 w-full" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
              <span className="text-xs font-bold text-slate-500">Mục tiêu yêu cầu</span>
            </div>
            <span className="text-sm font-black text-slate-700 dark:text-slate-300">
              {submission.targetValue != null ? formatNumber(submission.targetValue) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Go To */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
        <span className="text-xs font-bold text-indigo-600 group-hover:text-indigo-700 transition-colors">
          Xem chi tiết báo cáo
        </span>
        <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:translate-x-1">
          <ChevronRight size={16} />
        </div>
      </div>
    </Link>
  )
}
