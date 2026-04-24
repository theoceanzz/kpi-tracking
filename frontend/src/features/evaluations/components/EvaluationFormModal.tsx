import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { evaluationSchema, type EvaluationFormData } from '../schemas/evaluationSchema'
import { useCreateEvaluation } from '../hooks/useCreateEvaluation'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useAuthStore } from '@/store/authStore'
import { X, Loader2, Star, Target, Zap, Info } from 'lucide-react'
import { useState, useMemo } from 'react'

interface EvaluationFormModalProps {
  open: boolean
  onClose: () => void
}

export default function EvaluationFormModal({ open, onClose }: EvaluationFormModalProps) {
  const { user } = useAuthStore()
  
  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  const createMutation = useCreateEvaluation()
  const [hoverScore, setHoverScore] = useState<number | null>(null)

  // Fetch all my KPIs to know which periods I have been assigned to
  const { data: myAllKpis } = useMyKpi({ page: 0, size: 500 })
  const assignedPeriodIds = useMemo(() => {
    if (!myAllKpis?.content) return new Set<string>()
    return new Set(myAllKpis.content.map(k => k.kpiPeriodId))
  }, [myAllKpis])

  const filteredPeriods = useMemo(() => {
    if (!periodsData?.content) return []
    // If it's a staff, only show periods where they have KPIs
    return periodsData.content.filter(p => assignedPeriodIds.has(p.id))
  }, [periodsData, assignedPeriodIds])

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { 
      score: 0,
      userId: user?.id ?? '',
    },
  })

  const currentScore = watch('score')
  const displayScore = hoverScore ?? currentScore
  
  const selectedPeriodId = watch('kpiPeriodId')

  const { data: myKpis, isLoading: isLoadingKpi } = useMyKpi({ page: 0, size: 50, kpiPeriodId: selectedPeriodId })

  const onSubmit = (data: EvaluationFormData) => {
    createMutation.mutate(data, {
      onSuccess: () => { reset(); onClose() },
    })
  }

  if (!open) return null

  const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"

  function getScoreColor(s: number) {
    if (s >= 90) return 'text-emerald-600'
    if (s >= 70) return 'text-blue-600'
    if (s >= 50) return 'text-amber-600'
    if (s > 0) return 'text-red-600'
    return 'text-slate-400'
  }

  function getScoreLabel(s: number) {
    if (s >= 90) return 'Xuất sắc'
    if (s >= 70) return 'Tốt'
    if (s >= 50) return 'Đạt'
    if (s > 0) return 'Cần cải thiện'
    return 'Chưa chấm'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-7 py-5 flex items-center justify-between rounded-t-[28px]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <Star size={22} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Tự đánh giá Hiệu suất
              </h3>
              <p className="text-xs font-medium text-slate-500">
                Đánh giá tổng thể quá trình làm việc trong kỳ (đợt)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-7 py-6 space-y-6">
          {/* userId - handled in defaultValues, just hidden here */}
          <input type="hidden" {...register('userId')} />

          {/* Period Select */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">
              <Target size={14} /> Kỳ (Đợt) KPI <span className="text-red-500">*</span>
            </label>
            <select {...register('kpiPeriodId')} className={inputCls}>
              <option value="">-- Chọn đợt đánh giá --</option>
              {filteredPeriods.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.periodType})</option>)}
            </select>
            {errors.kpiPeriodId && <p className="text-red-500 text-xs font-medium">{errors.kpiPeriodId.message}</p>}
          </div>

          {/* KPI Summary View (Optional Context) */}
          {selectedPeriodId && (
            <div className="space-y-3 p-5 rounded-2xl bg-amber-50/30 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <Zap size={14} /> Tóm tắt kết quả trong đợt
                </h4>
                <span className="text-[10px] font-bold text-amber-600/70">{myKpis?.totalElements ?? 0} chỉ tiêu</span>
              </div>
              
              {isLoadingKpi ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                  <Loader2 size={12} className="animate-spin" /> Đang tải dữ liệu...
                </div>
              ) : myKpis?.content && myKpis.content.length > 0 ? (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                  {myKpis.content.map(kpi => (
                    <div key={kpi.id} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/20 shadow-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{kpi.name}</span>
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{kpi.weight}%</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div 
                            className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, (kpi.targetValue ? (100) : 0))}%` }} 
                          />
                        </div>
                        <span className="text-[10px] font-medium text-slate-500">Mục tiêu: {kpi.targetValue} {kpi.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white/50 dark:bg-slate-800/30 border border-dashed border-amber-200 dark:border-amber-900/40">
                  <Info size={14} className="text-amber-500" />
                  <p className="text-[10px] font-medium text-slate-500 italic">Không tìm thấy chỉ tiêu KPI nào được giao trong đợt này</p>
                </div>
              )}
            </div>
          )}

          {/* Score with visual slider */}
          <div className="space-y-3">
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">
              <Star size={14} /> Điểm tự chấm (0 – 100) <span className="text-red-500">*</span>
            </label>
            
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-50 to-amber-50/50 dark:from-slate-800/50 dark:to-amber-900/10 border border-slate-200 dark:border-slate-700 text-center space-y-3">
              <div className={`text-5xl font-black transition-colors ${getScoreColor(displayScore)}`}>
                {displayScore || '0'}
              </div>
              <p className={`text-sm font-bold uppercase tracking-widest ${getScoreColor(displayScore)}`}>
                {getScoreLabel(displayScore)}
              </p>
              <input 
                type="range" 
                min={0} max={100} step={1}
                value={currentScore}
                onChange={(e) => setValue('score', Number(e.target.value))}
                onMouseMove={(e) => {
                  const rect = (e.target as HTMLInputElement).getBoundingClientRect()
                  const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100)
                  setHoverScore(Math.max(0, Math.min(100, pct)))
                }}
                onMouseLeave={() => setHoverScore(null)}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>0 — Chưa đạt</span>
                <span>50 — Đạt</span>
                <span>100 — Xuất sắc</span>
              </div>
            </div>
            {/* Hidden input for react-hook-form */}
            <input type="hidden" {...register('score', { valueAsNumber: true })} />
            {errors.score && <p className="text-red-500 text-xs font-medium">{errors.score.message}</p>}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Tự nhận xét
            </label>
            <textarea 
              {...register('comment')} 
              rows={3} 
              className={inputCls + ' resize-none'} 
              placeholder="Đánh giá ưu điểm, hạn chế, và hướng phát triển của bản thân..." 
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Huỷ
            </button>
            <button 
              type="submit" 
              disabled={createMutation.isPending || !selectedPeriodId || (myKpis?.totalElements === 0)} 
              className="flex-1 px-4 py-3 rounded-xl text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              <Star size={16} /> Gửi tự đánh giá
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
