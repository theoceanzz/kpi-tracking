import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { evaluationApi } from '@/features/evaluations/api/evaluationApi'
import { 
  X, Loader2, Target, TrendingUp, 
  Award, Star, AlertCircle, Calendar,
  CheckCircle2, Clock, MessageSquare,
  Paperclip, ExternalLink
} from 'lucide-react'

import { formatNumber, cn } from '@/lib/utils'

interface StaffPerformanceDetailModalProps {
  open: boolean
  onClose: () => void
  userId: string
  userName: string
  periodId: string
  periodName: string
}

export default function StaffPerformanceDetailModal({ 
  open, onClose, userId, userName, periodId, periodName
}: StaffPerformanceDetailModalProps) {
  // Fetch all submissions
  const { data: submissions, isLoading: loadingSubs } = useQuery({
    queryKey: ['submissions', 'performance-detail', userId, periodId],
    queryFn: () => submissionApi.getAll({ 
      submittedById: userId, 
      kpiPeriodId: periodId,
      size: 100 
    }),
    enabled: open
  })

  // Fetch official evaluation
  const { data: evaluations, isLoading: loadingEval } = useQuery({
    queryKey: ['evaluations', 'performance-detail', userId, periodId],
    queryFn: () => evaluationApi.getAll({ 
      userId, 
      kpiPeriodId: periodId,
      size: 10 
    }),
    enabled: open
  })

  const isLoading = loadingSubs || loadingEval
  const submissionList = submissions?.content ?? []
  const officialEval = useMemo(() => 
    evaluations?.content?.sort((a, b) => (b.score || 0) - (a.score || 0)).find((e: any) => e.evaluatorRole !== 'SELF'),
  [evaluations])

  const pendingCount = useMemo(() => 
    submissionList.filter(s => s.status === 'PENDING').length,
  [submissionList])

  // Stats calculation
  const totalWeight = useMemo(() => 
    submissionList.reduce((acc, s) => acc + (s.weight ?? 0), 0), 
  [submissionList])

  const totalAutoScore = useMemo(() => 
    submissionList.reduce((acc, s) => acc + (s.autoScore ?? 0), 0), 
  [submissionList])

  const completedCount = useMemo(() => 
    submissionList.filter(s => s.status === 'APPROVED').length,
  [submissionList])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-slate-950 rounded-[48px] shadow-2xl w-full max-w-5xl mx-auto overflow-hidden border border-white/20 dark:border-slate-800 animate-in zoom-in-95 slide-in-from-bottom-12 duration-700 max-h-[90vh] flex flex-col">
        
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative bg-slate-900 dark:bg-black p-10 text-white shrink-0 overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 pointer-events-none">
            <TrendingUp size={180} />
          </div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 border border-white/5">
                <Star size={12} className="fill-current" /> Bảng chi tiết hiệu suất
              </div>
              <h2 className="text-3xl font-black tracking-tight flex items-center gap-4">
                {userName} <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> <span className="text-slate-400 text-xl font-bold">{periodName}</span>
              </h2>
              <div className="flex items-center gap-6 text-slate-400 text-xs font-bold">
                 <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-indigo-400" /> {submissionList.length} Chỉ tiêu KPI
                 </div>
                 <div className="flex items-center gap-2">
                    <Award size={14} className="text-emerald-400" /> Trọng số: {totalWeight}%
                 </div>
              </div>
            </div>
            <button onClick={onClose} className="w-14 h-14 flex items-center justify-center rounded-3xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 active:scale-95 group">
              <X size={28} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar relative z-10">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-6">
              <div className="relative">
                 <Loader2 size={64} className="animate-spin text-indigo-500" />
                 <div className="absolute inset-0 bg-indigo-500/20 blur-xl animate-pulse rounded-full" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Đang tải báo cáo chi tiết...</p>
            </div>
          ) : submissionList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 bg-slate-50 dark:bg-slate-900/50 rounded-[48px] border-2 border-dashed border-slate-200 dark:border-slate-800">
               <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                  <AlertCircle size={40} />
               </div>
               <div className="space-y-2">
                  <p className="text-xl font-black text-slate-900 dark:text-white">Chưa có bài nộp nào</p>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto">Nhân viên này chưa thực hiện nộp kết quả cho các chỉ tiêu trong đợt đánh giá hiện tại.</p>
               </div>
            </div>
          ) : (
            <>
              {/* Performance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="p-8 rounded-[32px] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col justify-between group hover:border-indigo-500/30 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-4">
                       <CheckCircle2 size={24} />
                    </div>
                    <div>
                       <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">{completedCount}/{submissionList.length}</p>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">KPI Hoàn thành</p>
                    </div>
                 </div>
                 
                 <div className="p-8 rounded-[32px] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col justify-between group hover:border-amber-500/30 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
                       <Clock size={24} />
                    </div>
                    <div>
                       <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">{pendingCount}</p>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đang chờ duyệt</p>
                    </div>
                 </div>

                 <div className={cn(
                    "p-8 rounded-[32px] shadow-xl flex flex-col justify-between overflow-hidden relative transition-all duration-500",
                    officialEval 
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/20"
                      : "bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-indigo-500/20"
                 )}>
                    <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                       <TrendingUp size={120} />
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-4 backdrop-blur-md">
                       <Award size={24} />
                    </div>
                    <div className="relative z-10">
                       <div className="flex items-baseline gap-2 mb-1">
                          <p className="text-4xl font-black tracking-tighter">
                             {officialEval ? formatNumber(Math.round(officialEval.score ?? 0)) : formatNumber(Math.round(totalAutoScore))}
                          </p>
                          <span className="text-xs font-bold opacity-60">Điểm số</span>
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                          {officialEval ? 'Kết quả đánh giá chính thức' : 'Ghi nhận từ hệ thống'}
                       </p>
                    </div>
                 </div>
              </div>

              {/* Manager Comment if exists */}
              {officialEval && officialEval.comment && (
                 <div className="p-8 rounded-[32px] bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 -rotate-12 transition-transform group-hover:scale-110 duration-500">
                       <MessageSquare size={80} />
                    </div>
                    <div className="relative z-10">
                       <div className="flex items-center gap-3 mb-4">
                          <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Nhận xét từ {officialEval?.evaluatorRoleName || 'Quản lý'}</h4>
                       </div>
                       <p className="text-lg font-medium text-slate-700 dark:text-slate-300 italic leading-relaxed">
                          "{officialEval.comment}"
                       </p>
                    </div>
                 </div>
              )}

              {/* KPI List */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                   <div className="w-1 h-5 bg-indigo-500 rounded-full" />
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Chi tiết chỉ tiêu đã nộp</h3>
                </div>
                
                <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">Nội dung KPI</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Kết quả nộp</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Trạng thái</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Điểm hệ thống</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {submissionList.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/20 transition-all group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-all group-hover:scale-110">
                                <Target size={18} />
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{s.kpiCriteriaName}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Trọng số: {s.weight}%</p>
                                  {s.attachments && s.attachments.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-300">•</span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {s.attachments.map(att => (
                                          <a 
                                            key={att.id} 
                                            href={att.fileUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            title={att.fileName}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider hover:bg-indigo-500 hover:text-white transition-all"
                                          >
                                            <Paperclip size={10} />
                                            <span className="truncate max-w-[80px]">{att.fileName}</span>
                                            <ExternalLink size={10} />
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {s.note && (
                                  <p className="text-[10px] text-slate-500 font-medium mt-1.5 italic line-clamp-1 group-hover:line-clamp-none transition-all">
                                    " {s.note} "
                                  </p>
                                )}
                              </div>

                            </div>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-inner">
                               <span className="text-sm font-black text-slate-900 dark:text-white">{formatNumber(s.actualValue)}</span>
                               <span className="text-[10px] text-slate-400 font-bold">/ {s.targetValue != null ? formatNumber(s.targetValue) : '—'}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-center">
                             <div className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                s.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                s.status === 'REJECTED' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' :
                                'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                             )}>
                                {s.status === 'APPROVED' ? 'Đã duyệt' : s.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                             </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <span className="text-lg font-black text-slate-400 group-hover:text-indigo-600 transition-colors">{formatNumber(s.autoScore ?? 0)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Footer simple */}
        <div className="px-10 py-8 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-center shrink-0">
           <button 
             onClick={onClose}
             className="px-12 py-4 rounded-[20px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[2px] hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all active:scale-95 shadow-xl"
           >
             Đóng cửa sổ chi tiết
           </button>
        </div>
      </div>
    </div>
  )
}
