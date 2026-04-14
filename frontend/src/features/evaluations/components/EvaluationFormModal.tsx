import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { evaluationSchema, type EvaluationFormData } from '../schemas/evaluationSchema'
import { useCreateEvaluation } from '../hooks/useCreateEvaluation'
import { useKpiCriteria } from '@/features/kpi/hooks/useKpiCriteria'
import { useAuthStore } from '@/store/authStore'
import { X, Loader2, Star, Target, Calendar } from 'lucide-react'
import { useState } from 'react'

interface EvaluationFormModalProps {
  open: boolean
  onClose: () => void
}

export default function EvaluationFormModal({ open, onClose }: EvaluationFormModalProps) {
  const { user } = useAuthStore()
  
  const { data: kpiData } = useKpiCriteria({ status: 'APPROVED', size: 100 })
  const createMutation = useCreateEvaluation()
  const [hoverScore, setHoverScore] = useState<number | null>(null)

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { 
      score: 0,
      userId: user?.id ?? '',
    },
  })

  const currentScore = watch('score')
  const displayScore = hoverScore ?? currentScore

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
                Tự đánh giá Bản thân
              </h3>
              <p className="text-xs font-medium text-slate-500">
                Chấm điểm hiệu suất theo chỉ tiêu KPI được giao
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-7 py-6 space-y-6">
          {/* Hidden userId - always current user */}
          <input type="hidden" {...register('userId')} value={user?.id ?? ''} />

          {/* KPI Select */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">
              <Target size={14} /> Chỉ tiêu KPI <span className="text-red-500">*</span>
            </label>
            <select {...register('kpiCriteriaId')} className={inputCls}>
              <option value="">-- Chọn chỉ tiêu --</option>
              {kpiData?.content?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
            {errors.kpiCriteriaId && <p className="text-red-500 text-xs font-medium">{errors.kpiCriteriaId.message}</p>}
          </div>

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

          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                <Calendar size={12} /> Từ ngày
              </label>
              <input {...register('periodStart')} type="date" className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                <Calendar size={12} /> Đến ngày
              </label>
              <input {...register('periodEnd')} type="date" className={inputCls} />
            </div>
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
              disabled={createMutation.isPending} 
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
