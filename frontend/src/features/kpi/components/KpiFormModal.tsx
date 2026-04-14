import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { kpiSchema, type KpiFormData } from '../schemas/kpiSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { useDepartments } from '@/features/departments/hooks/useDepartments'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'

interface KpiFormModalProps {
  open: boolean
  onClose: () => void
  editKpi?: KpiCriteria | null
}

const frequencyOptions = [
  { value: 'DAILY', label: 'Hàng ngày' },
  { value: 'WEEKLY', label: 'Hàng tuần' },
  { value: 'MONTHLY', label: 'Hàng tháng' },
  { value: 'QUARTERLY', label: 'Hàng quý' },
  { value: 'YEARLY', label: 'Hàng năm' },
] as const

export default function KpiFormModal({ open, onClose, editKpi }: KpiFormModalProps) {
  const isEdit = !!editKpi
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const { data: deptsData } = useDepartments(0, 100)
  const { data: usersData } = useUsers({ page: 0, size: 100 })

  const availableUsers = usersData?.content?.filter(u => {
    if (user?.role === 'DIRECTOR') return u.role !== 'DIRECTOR'
    if (user?.role === 'HEAD') return u.role === 'DEPUTY' || u.role === 'STAFF'
    if (user?.role === 'DEPUTY') return u.role === 'STAFF'
    return false
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema),
    values: editKpi ? {
      name: editKpi.name,
      description: editKpi.description ?? '',
      weight: editKpi.weight ?? undefined,
      targetValue: editKpi.targetValue ?? undefined,
      unit: editKpi.unit ?? '',
      frequency: editKpi.frequency,
      departmentId: editKpi.departmentId ?? '',
      assignedToId: editKpi.assignedToId ?? '',
      startDate: editKpi.startDate ? editKpi.startDate.split('T')[0] : '',
      endDate: editKpi.endDate ? editKpi.endDate.split('T')[0] : '',
    } : { name: '', frequency: 'MONTHLY' },
  })

  const createMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Tạo chỉ tiêu thành công'); reset(); onClose() },
    onError: () => toast.error('Tạo chỉ tiêu thất bại'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.update(editKpi!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Cập nhật thành công'); onClose() },
    onError: () => toast.error('Cập nhật thất bại'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (data: KpiFormData) => {
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  if (!open) return null

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{isEdit ? 'Chỉnh sửa chỉ tiêu' : 'Tạo chỉ tiêu mới'}</h3>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Tên chỉ tiêu <span className="text-red-500">*</span></label>
            <input {...register('name')} className={inputCls} placeholder="VD: Doanh thu tháng" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Mô tả</label>
            <textarea {...register('description')} rows={2} className={inputCls + ' resize-none'} placeholder="Chi tiết chỉ tiêu..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Mục tiêu</label>
              <input {...register('targetValue', { valueAsNumber: true })} type="number" step="any" className={inputCls} placeholder="100" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Đơn vị</label>
              <input {...register('unit')} className={inputCls} placeholder="VD: triệu, %, cái" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Trọng số (%)</label>
              <input {...register('weight', { valueAsNumber: true })} type="number" step="any" min={0} max={100} className={inputCls} placeholder="30" />
              {errors.weight && <p className="text-red-500 text-xs mt-1">{errors.weight.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Tần suất <span className="text-red-500">*</span></label>
              <select {...register('frequency')} className={inputCls}>
                {frequencyOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              {errors.frequency && <p className="text-red-500 text-xs mt-1">{errors.frequency.message}</p>}
            </div>
          </div>

          {user?.role === 'DIRECTOR' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Phòng ban</label>
              <select {...register('departmentId')} className={inputCls} disabled={user?.role !== 'DIRECTOR'}>
                <option value="">— Không chọn —</option>
                {deptsData?.content?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Giao cho</label>
            <select {...register('assignedToId')} className={inputCls}>
              <option value="">— Không chọn —</option>
              {availableUsers?.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email} - {u.role})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Ngày bắt đầu</label>
              <input {...register('startDate')} type="date" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Ngày kết thúc</label>
              <input {...register('endDate')} type="date" className={inputCls} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-accent)] transition-colors">Hủy</button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
