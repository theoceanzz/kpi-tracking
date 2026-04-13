import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { evaluationSchema, type EvaluationFormData } from '../schemas/evaluationSchema'
import { useCreateEvaluation } from '../hooks/useCreateEvaluation'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useKpiCriteria } from '@/features/kpi/hooks/useKpiCriteria'
import { X, Loader2 } from 'lucide-react'

interface EvaluationFormModalProps {
  open: boolean
  onClose: () => void
}

export default function EvaluationFormModal({ open, onClose }: EvaluationFormModalProps) {
  const { data: usersData } = useUsers({ page: 0, size: 100 })
  const { data: kpiData } = useKpiCriteria({ status: 'APPROVED', size: 100 })
  const createMutation = useCreateEvaluation()

  const { register, handleSubmit, formState: { errors }, reset } = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { score: 0 },
  })

  const onSubmit = (data: EvaluationFormData) => {
    createMutation.mutate(data, {
      onSuccess: () => { reset(); onClose() },
    })
  }

  if (!open) return null

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Tạo đánh giá</h3>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nhân viên <span className="text-red-500">*</span></label>
            <select {...register('userId')} className={inputCls}>
              <option value="">-- Chọn nhân viên --</option>
              {usersData?.content?.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
            {errors.userId && <p className="text-red-500 text-xs mt-1">{errors.userId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Chỉ tiêu KPI <span className="text-red-500">*</span></label>
            <select {...register('kpiCriteriaId')} className={inputCls}>
              <option value="">-- Chọn chỉ tiêu --</option>
              {kpiData?.content?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
            {errors.kpiCriteriaId && <p className="text-red-500 text-xs mt-1">{errors.kpiCriteriaId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Điểm (0-100) <span className="text-red-500">*</span></label>
            <input {...register('score', { valueAsNumber: true })} type="number" min={0} max={100} step="any" className={inputCls} placeholder="85" />
            {errors.score && <p className="text-red-500 text-xs mt-1">{errors.score.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Nhận xét</label>
            <textarea {...register('comment')} rows={3} className={inputCls + ' resize-none'} placeholder="Đánh giá chi tiết..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Từ ngày</label>
              <input {...register('periodStart')} type="date" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Đến ngày</label>
              <input {...register('periodEnd')} type="date" className={inputCls} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-accent)] transition-colors">Hủy</button>
            <button type="submit" disabled={createMutation.isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              Tạo đánh giá
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
