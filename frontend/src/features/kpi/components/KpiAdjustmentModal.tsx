import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adjustmentApi } from '../api/adjustmentApi'
import { toast } from 'sonner'
import { 
  X, AlertCircle, Target, MessageSquare, 
  Send, Loader2, Info, BarChart3
} from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'

const adjustmentSchema = z.object({
  requestedTargetValue: z.any().optional(),
  requestedMinimumValue: z.any().optional(),
  deactivationRequest: z.boolean(),
  reason: z.string().min(10, 'Lý do phải ít nhất 10 ký tự'),
})

type AdjustmentFormData = z.infer<typeof adjustmentSchema>

interface KpiAdjustmentModalProps {
  open: boolean
  onClose: () => void
  kpi: KpiCriteria | null
}

export default function KpiAdjustmentModal({ open, onClose, kpi }: KpiAdjustmentModalProps) {
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      deactivationRequest: false,
      reason: '',
    }
  })

  const deactivationRequest = watch('deactivationRequest')

  const mutation = useMutation({
    mutationFn: (data: AdjustmentFormData) => adjustmentApi.create({
      kpiCriteriaId: kpi!.id,
      ...data
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpi-adjustments'] })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      qc.invalidateQueries({ queryKey: ['my-kpi-adjustments'] })
      toast.success('Gửi yêu cầu điều chỉnh thành công!')
      onClose()
      reset()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Gửi yêu cầu thất bại')
    }
  })

  if (!open || !kpi) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Xin điều chỉnh KPI</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{kpi.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form 
          onSubmit={handleSubmit(data => {
            const formattedData = {
              ...data,
              requestedTargetValue: (isNaN(data.requestedTargetValue as any) || data.requestedTargetValue === kpi.targetValue) ? undefined : data.requestedTargetValue,
              requestedMinimumValue: (isNaN(data.requestedMinimumValue as any) || data.requestedMinimumValue === kpi.minimumValue) ? undefined : data.requestedMinimumValue,
            }
            mutation.mutate(formattedData)
          })} 
          className="p-8 space-y-6"
        >
          
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 flex gap-3 items-start">
            <Info size={18} className="text-amber-600 mt-0.5" />
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
              Bạn có thể yêu cầu thay đổi mục tiêu, giá trị tối thiểu hoặc xin tạm dừng chỉ tiêu này. 
              Yêu cầu sẽ được gửi tới quản lý trực tiếp phê duyệt.
            </p>
          </div>

          {/* Type Toggle */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => reset({ ...watch(), deactivationRequest: false })}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${!deactivationRequest ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              Thay đổi thông số
            </button>
            <button
              type="button"
              onClick={() => reset({ ...watch(), deactivationRequest: true })}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${deactivationRequest ? 'bg-white dark:bg-slate-700 shadow-sm text-red-600' : 'text-slate-400'}`}
            >
              Xin dừng chỉ tiêu
            </button>
          </div>

          <input type="hidden" {...register('deactivationRequest')} />

          {!deactivationRequest ? (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
              <div className="space-y-2 col-span-2">
                <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                  <Target size={14} /> Mục tiêu mới
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    {...register('requestedTargetValue', { valueAsNumber: true })}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder={kpi.targetValue?.toString()}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{kpi.unit}</div>
                </div>
              </div>

              <div className="space-y-2 col-span-2">
                <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                  <BarChart3 size={14} /> Tối thiểu mới
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    {...register('requestedMinimumValue', { valueAsNumber: true })}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder={kpi.minimumValue?.toString() || "0"}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{kpi.unit}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
              <X className="text-red-500" size={20} />
              <p className="text-sm font-bold text-red-700 dark:text-red-400">
                Bạn đang yêu cầu <span className="underline italic text-red-800 dark:text-red-300">DỪNG</span> thực hiện chỉ tiêu này.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
              <MessageSquare size={14} /> Lý do điều chỉnh <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register('reason')}
              rows={4}
              placeholder="Giải trình cụ thể tại sao bạn cần điều chỉnh chỉ tiêu này..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none transition-all"
            />
            {errors.reason && <p className="text-red-500 text-[10px] font-bold">{errors.reason.message}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl text-sm font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-all"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-[2] py-3.5 rounded-2xl text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Gửi yêu cầu điều chỉnh
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
