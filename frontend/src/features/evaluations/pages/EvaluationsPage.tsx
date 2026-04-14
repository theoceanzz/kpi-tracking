import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import EvaluationFormModal from '../components/EvaluationFormModal'
import EvaluationDetailModal from '../components/EvaluationDetailModal'
import { useEvaluations } from '../hooks/useEvaluations'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime, getInitials } from '@/lib/utils'
import type { Evaluation } from '@/types/evaluation'
import {
  Star, Plus, ChevronRight, User, Calendar,
  TrendingUp, Award, Filter
} from 'lucide-react'

function getScoreColor(score: number | null) {
  if (score == null) return 'text-slate-400'
  if (score >= 90) return 'text-emerald-600'
  if (score >= 70) return 'text-blue-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function getScoreBg(score: number | null) {
  if (score == null) return 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700'
  if (score >= 90) return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/40'
  if (score >= 70) return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/40'
  if (score >= 50) return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/40'
  return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/40'
}

function getScoreLabel(score: number | null) {
  if (score == null) return 'Chưa chấm'
  if (score >= 90) return 'Xuất sắc'
  if (score >= 70) return 'Tốt'
  if (score >= 50) return 'Đạt'
  return 'Cần cải thiện'
}

export default function EvaluationsPage() {
  const { data, isLoading } = useEvaluations({ size: 200 })
  const { user } = useAuthStore()
  const isStaff = user?.role === 'STAFF'

  const [showForm, setShowForm] = useState(false)
  const [detailEval, setDetailEval] = useState<Evaluation | null>(null)
  const [filterBy, setFilterBy] = useState<'all' | 'mine'>('all')

  const evaluations = useMemo(() => {
    const all = data?.content ?? []
    if (filterBy === 'mine') {
      return all.filter(e => e.userId === user?.id || e.evaluatorId === user?.id)
    }
    return all
  }, [data, filterBy, user?.id])

  // Group evaluations by user + KPI for a richer view
  const stats = useMemo(() => {
    const all = data?.content ?? []
    const avgScore = all.length > 0 
      ? Math.round(all.reduce((acc, e) => acc + (e.score ?? 0), 0) / all.filter(e => e.score != null).length) 
      : 0
    return {
      total: all.length,
      avgScore,
      excellent: all.filter(e => (e.score ?? 0) >= 90).length,
      needsWork: all.filter(e => e.score != null && e.score < 50).length,
    }
  }, [data])

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-widest">
            <Star size={14} /> Hiệu suất nhân sự
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            {isStaff ? 'Tự đánh giá Hiệu suất' : 'Đánh giá Nhân sự'}
          </h1>
          <p className="text-slate-500 font-medium max-w-lg">
            {isStaff 
              ? 'Tự chấm điểm và đánh giá bản thân theo từng chỉ tiêu KPI được giao.'
              : 'Xem xét và phản hồi đánh giá hiệu suất do nhân viên tự nộp.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Quick Stats */}
          <div className="flex gap-3">
            <div className="flex items-center gap-3 px-4 py-3 rounded-[18px] border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/40">
              <span className="text-2xl font-black">{stats.total}</span>
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">Đánh giá</span>
            </div>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-[18px] border ${getScoreBg(stats.avgScore)}`}>
              <span className={`text-2xl font-black ${getScoreColor(stats.avgScore)}`}>{stats.avgScore || '—'}</span>
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">TB điểm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterBy('all')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
              filterBy === 'all' 
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/40 shadow-sm' 
                : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Filter size={16} /> Tất cả
          </button>
          <button
            onClick={() => setFilterBy('mine')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
              filterBy === 'mine' 
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40 shadow-sm' 
                : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <User size={16} /> Của tôi
          </button>
        </div>

        {isStaff && (
          <button 
            onClick={() => setShowForm(true)} 
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Plus size={18} /> Tự đánh giá
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : evaluations.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-300 dark:border-slate-800 p-16">
          <EmptyState 
            title="Chưa có đánh giá nào" 
            description={isStaff 
              ? 'Hãy bắt đầu tự đánh giá hiệu suất của bạn theo từng chỉ tiêu KPI.' 
              : 'Chưa có nhân viên nào nộp bản tự đánh giá.'
            } 
          />
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev, idx) => {
            const isSelfEval = ev.evaluatorId === ev.userId || ev.evaluatorName === ev.userName
            return (
              <button
                key={ev.id}
                onClick={() => setDetailEval(ev)}
                className="w-full text-left group bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 p-5 md:px-7 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm shrink-0">
                      {getInitials(ev.userName)}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {ev.kpiCriteriaName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1"><User size={12} /> {ev.userName}</span>
                        {ev.evaluatorName && (
                          <span className="flex items-center gap-1">
                            <Award size={12} /> 
                            {isSelfEval ? 'Tự đánh giá' : `Đánh giá bởi: ${ev.evaluatorName}`}
                          </span>
                        )}
                        <span className="flex items-center gap-1"><Calendar size={12} /> {formatDateTime(ev.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Score Display */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${getScoreBg(ev.score)}`}>
                      <TrendingUp size={16} className={getScoreColor(ev.score)} />
                      <div className="text-right">
                        <p className={`text-xl font-black ${getScoreColor(ev.score)}`}>{ev.score ?? '—'}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{getScoreLabel(ev.score)}</p>
                      </div>
                    </div>

                    {/* Layer badge */}
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isSelfEval 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {isSelfEval ? 'Nhân viên' : 'Quản lý'}
                    </div>

                    <ChevronRight size={18} className="text-slate-300 group-hover:text-amber-500 transition-colors" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <EvaluationFormModal open={showForm} onClose={() => setShowForm(false)} />
      <EvaluationDetailModal open={!!detailEval} onClose={() => setDetailEval(null)} evaluation={detailEval} />
    </div>
  )
}
