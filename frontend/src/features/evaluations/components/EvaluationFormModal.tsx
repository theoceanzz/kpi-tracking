import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { evaluationSchema, type EvaluationFormData } from '../schemas/evaluationSchema'
import { useCreateEvaluation } from '../hooks/useCreateEvaluation'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useMySubmissions } from '@/features/submissions/hooks/useMySubmissions'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { getScoringFunctions } from '@/lib/scoring'
import { X, Loader2, Star, Target, Zap, Trophy, CheckCircle2, MessageSquare, Sparkles } from 'lucide-react'
import { useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface EvaluationFormModalProps {
  open: boolean
  onClose: () => void
  readOnly?: boolean
  initialPeriodId?: string
}

export default function EvaluationFormModal({ open, onClose, readOnly = false, initialPeriodId }: EvaluationFormModalProps) {
  const { user } = useAuthStore()
  
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const { getScoreColor, getScoreLabel, maxScore } = getScoringFunctions(org)

  const { data: periodsData } = useKpiPeriods({ organizationId: orgId })
  const createMutation = useCreateEvaluation()

  const { data: myAllKpis } = useMyKpi({ page: 0, size: 500 })
  const assignedPeriodIds = useMemo(() => {
    if (!myAllKpis?.content) return new Set<string>()
    return new Set(myAllKpis.content.map(k => k.kpiPeriodId))
  }, [myAllKpis])

  const filteredPeriods = useMemo(() => {
    if (!periodsData?.content) return []
    return periodsData.content.filter(p => assignedPeriodIds.has(p.id))
  }, [periodsData, assignedPeriodIds])

  const { register, handleSubmit, reset, watch, setValue } = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { 
      score: 0,
      userId: user?.id ?? '',
      kpiPeriodId: initialPeriodId || '',
    },
  })

  useEffect(() => {
    if (open) {
      if (initialPeriodId) {
        setValue('kpiPeriodId', initialPeriodId)
      } else if (filteredPeriods.length > 0 && !watch('kpiPeriodId')) {
        const firstPeriod = filteredPeriods[0]
        if (firstPeriod) {
          setValue('kpiPeriodId', firstPeriod.id)
        }
      }
    }
  }, [open, initialPeriodId, filteredPeriods, setValue, watch])

  const currentScore = watch('score')
  const displayScore = currentScore
  const selectedPeriodId = watch('kpiPeriodId')

  const { data: myKpis } = useMyKpi({ page: 0, size: 50, kpiPeriodId: selectedPeriodId })
  const { data: mySubmissions } = useMySubmissions({ page: 0, size: 500 })

  const calculatedScore = useMemo(() => {
    if (!selectedPeriodId || !myKpis?.content || !mySubmissions?.content) return 0
    const periodKpiIds = new Set(myKpis.content.map(k => k.id))
    const total = mySubmissions.content
      .filter(s => periodKpiIds.has(s.kpiCriteriaId) && (s.status === 'APPROVED' || s.status === 'PENDING' || s.status === 'REJECTED'))
      .reduce((sum, s) => sum + (s.autoScore || 0), 0)
    return Math.min(maxScore, Math.round(total))
  }, [selectedPeriodId, myKpis, mySubmissions, maxScore])

  const handleApplyCalculatedScore = () => {
    if (readOnly) return
    setValue('score', calculatedScore)
  }

  useEffect(() => {
    if (calculatedScore > 0 && currentScore === 0 && !readOnly) {
      setValue('score', calculatedScore)
    }
  }, [calculatedScore, setValue, currentScore, readOnly])

  const onSubmit = (data: EvaluationFormData) => {
    if (readOnly) return
    createMutation.mutate(data, {
      onSuccess: () => { reset(); onClose() },
    })
  }

  if (!open) return null



  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[48px] shadow-2xl w-full max-w-2xl mx-auto overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 slide-in-from-bottom-10 duration-700">
        
        {/* Header with Background Pattern */}
        <div className="relative bg-slate-900 p-10 text-white overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
              <Trophy size={160} />
           </div>
           <div className="relative z-10 flex items-center justify-between">
              <div className="space-y-2">
                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-indigo-300">
                    <Star size={12} className="fill-current" /> Performance Review
                 </div>
                 <h2 className="text-3xl font-black tracking-tight">
                    {readOnly ? 'Tổng kết Hiệu suất' : 'Tự đánh giá của bạn'}
                 </h2>
                 <p className="text-slate-400 text-sm font-medium max-w-xs">
                    {readOnly ? 'Xem lại kết quả nỗ lực của bạn trong đợt này.' : 'Hãy dành chút thời gian để phản ánh lại kết quả làm việc.'}
                 </p>
              </div>
              <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all">
                 <X size={24} />
              </button>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row max-h-[70vh]">
          {/* Main Form Area */}
          <div className="flex-1 p-8 md:p-10 overflow-y-auto custom-scrollbar space-y-10">
             <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                <input type="hidden" {...register('userId')} />

                {/* Period Selection */}
                <div className="space-y-4">
                   <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                      <Target size={14} /> Chọn đợt đánh giá
                   </label>
                   <select 
                    {...register('kpiPeriodId')} 
                    disabled={readOnly}
                    className="w-full px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none appearance-none transition-all disabled:opacity-70"
                   >
                      <option value="">-- Lựa chọn kỳ đánh giá --</option>
                      {filteredPeriods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                </div>

                {/* Results Summary if period selected */}
                {selectedPeriodId && (
                  <div className="p-6 rounded-[32px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kết quả đo lường</h4>
                       <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{myKpis?.totalElements || 0} KPI</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-y border-slate-200/50 dark:border-slate-700/50">
                       <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-500" />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Điểm hệ thống tự tính</span>
                       </div>
                       <div className="text-2xl font-black text-slate-900 dark:text-white">{calculatedScore}</div>
                    </div>
                    {readOnly && (
                       <p className="text-[10px] text-slate-400 italic">Đây là bản tổng kết tự động sau khi tất cả chỉ tiêu đã được duyệt.</p>
                    )}
                  </div>
                )}

                {/* Visual Score Picker */}
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        <Star size={14} /> Điểm tự đánh giá
                      </label>
                      {!readOnly && calculatedScore > 0 && (
                        <button 
                          type="button" 
                          onClick={handleApplyCalculatedScore}
                          className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <Zap size={10} fill="currentColor" /> Dùng điểm hệ thống
                        </button>
                      )}
                   </div>

                   <div className="text-center space-y-6 py-6 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-[40px] border border-indigo-100 dark:border-indigo-900/30">
                      <div className={cn("text-7xl font-black tracking-tighter transition-all duration-500", getScoreColor(displayScore))}>
                         {displayScore}
                      </div>
                      <div className="space-y-1 relative">
                         <p className={cn("text-sm font-black uppercase tracking-[0.2em]", getScoreColor(displayScore))}>
                            {getScoreLabel(displayScore)}
                         </p>
                         
                         {selectedPeriodId && calculatedScore > 0 && displayScore !== calculatedScore && (
                           <div className={cn(
                             "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                             displayScore > calculatedScore 
                              ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20" 
                              : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20"
                           )}>
                             {displayScore > calculatedScore ? '+' : ''}{displayScore - calculatedScore} điểm so với hệ thống
                           </div>
                         )}
                      </div>

                      {!readOnly && (
                         <div className="px-10">
                           <input 
                             type="range" min={0} max={maxScore} step={1}
                             value={currentScore}
                            onChange={(e) => setValue('score', Number(e.target.value))}
                            className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer"
                          />
                           <div className="flex justify-between mt-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              <span>0</span>
                              <span>{Math.round(maxScore / 2)}</span>
                              <span>{maxScore}</span>
                           </div>
                        </div>
                      )}
                   </div>
                </div>

                {/* Comment area */}
                <div className="space-y-4">
                   <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                      <MessageSquare size={14} /> Ý kiến cá nhân
                   </label>
                   <textarea 
                    {...register('comment')} 
                    rows={4}
                    disabled={readOnly}
                    className="w-full px-6 py-5 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none resize-none transition-all disabled:opacity-70"
                    placeholder="Bạn cảm thấy thế nào về kết quả đợt này? Có khó khăn hay đề xuất gì không?"
                   />
                </div>

                {/* Footer Actions */}
                {!readOnly && (
                   <div className="flex gap-4 pt-4">
                      <button 
                        type="button" 
                        onClick={onClose} 
                        className="flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                      >
                        Hủy bỏ
                      </button>
                      <button 
                        type="submit"
                        disabled={createMutation.isPending || !selectedPeriodId}
                        className="flex-[2] py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-[2px] shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                        GỬI ĐÁNH GIÁ
                      </button>
                   </div>
                )}
                
                {readOnly && (
                  <button 
                    type="button" 
                    onClick={onClose}
                    className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-[2px] shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    ĐÃ HIỂU & ĐÓNG
                  </button>
                )}
             </form>
          </div>

          {/* Side Context Area (Optional) */}
          <div className="hidden lg:block w-72 bg-slate-50 dark:bg-slate-800/50 p-8 border-l border-slate-100 dark:border-slate-800">
             <div className="space-y-8">
                <div>
                   <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Ghi chú quan trọng</h5>
                   <ul className="space-y-4">
                      <SideTip text="Kết quả đánh giá sẽ là cơ sở cho việc xếp loại khen thưởng định kỳ." />
                      <SideTip text="Hệ thống tự động đề xuất điểm dựa trên kết quả nộp bài của bạn." />
                      <SideTip text="Bạn có thể xem lại bản đánh giá này trong mục Lịch sử." />
                   </ul>
                </div>
                
                <div className="p-5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
                   <Sparkles size={20} className="mb-3" />
                   <p className="text-xs font-bold leading-relaxed">Sự trung thực trong tự đánh giá giúp chúng ta cải thiện hiệu suất tốt hơn!</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SideTip({ text }: { text: string }) {
  return (
    <li className="flex gap-3">
       <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
       <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{text}</p>
    </li>
  )
}


