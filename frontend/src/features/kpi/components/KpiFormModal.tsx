import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { kpiSchema, type KpiFormData } from '../schemas/kpiSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { useDepartments } from '@/features/departments/hooks/useDepartments'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { toast } from 'sonner'
import { Loader2, X, Check } from 'lucide-react'
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
  const { isDirector, isHead, isDeputy } = usePermission()
  const { data: deptsData } = useDepartments(0, 100)

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<KpiFormData>({
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
      assignedToIds: editKpi.assignedToId ? [editKpi.assignedToId] : [],
      startDate: editKpi.startDate ? editKpi.startDate.split('T')[0] : '',
      endDate: editKpi.endDate ? editKpi.endDate.split('T')[0] : '',
    } : { name: '', frequency: 'MONTHLY', assignedToIds: [] },
  })

  const formDeptId = watch('departmentId')
  const selectedAssignees = watch('assignedToIds') || []

  // For HEAD/DEPUTY, automatically use their department if not chosen
  const fetchDeptId = useMemo(() => {
    if (isDirector) return formDeptId || undefined
    // For others, use their own department (assuming they only belong to one for KPI purposes here)
    // In a more complex system we might need to let them choose which of their depts.
    return formDeptId || user?.memberships?.[0]?.orgUnitId
  }, [isDirector, user, formDeptId])

  const { data: usersData, isLoading: isLoadingUsers } = useUsers({ 
    page: 0, 
    size: 200, 
    departmentId: fetchDeptId 
  })

  const availableUsers = useMemo(() => {
    if (!usersData?.content) return []
    return usersData.content.filter(u => {
      if (isDirector) return true // Director can assign to anyone including self
      if (isHead) return true // Head can assign to anyone in dept including self
      if (isDeputy) return u.roles?.includes('STAFF') || u.id === user?.id
      return false
    })
  }, [usersData, isDirector, isHead, isDeputy, user])

  const createMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.create(data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Tạo chỉ tiêu thành công')
      reset()
      onClose() 
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Tạo chỉ tiêu thất bại'
      toast.error(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.update(editKpi!.id, data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Cập nhật thành công')
      onClose() 
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Cập nhật thất bại'
      toast.error(msg)
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (data: KpiFormData) => {
    const payload = { ...data }
    
    // Clean up empty strings and unselected values
    if (!payload.departmentId) delete payload.departmentId
    if (!payload.assignedToId) delete payload.assignedToId
    if (!payload.startDate || payload.startDate === "") delete payload.startDate
    if (!payload.endDate || payload.endDate === "") delete payload.endDate
    
    if (isEdit) {
      updateMutation.mutate(payload)
    } else {
      // For creation, ensure assignedToIds is an array
      if (!payload.assignedToIds || payload.assignedToIds.length === 0) {
        if (payload.assignedToId) {
          payload.assignedToIds = [payload.assignedToId]
        } else {
          payload.assignedToIds = []
        }
      }
      createMutation.mutate(payload)
    }
  }

  const toggleAssignee = (userId: string) => {
    const current = [...selectedAssignees]
    const index = current.indexOf(userId)
    if (index > -1) {
      current.splice(index, 1)
    } else {
      current.push(userId)
    }
    setValue('assignedToIds', current)
  }

  if (!open) return null

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{isEdit ? 'Chỉnh sửa chỉ tiêu' : 'Tạo chỉ tiêu mới'}</h3>
            <p className="text-xs text-[var(--color-muted-foreground)]">Thiết lập mục tiêu và phân bổ người thực hiện</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors p-1 hover:bg-[var(--color-accent)] rounded-full">
            <X size={20} />
          </button>
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

          {isDirector && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Phòng ban</label>
              <select {...register('departmentId')} className={inputCls}>
                <option value="">— Toàn công ty —</option>
                {deptsData?.content?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Giao cho 
              {!isEdit && <span className="text-[10px] text-[var(--color-muted-foreground)] ml-2 pulse">(Có thể chọn nhiều)</span>}
            </label>
            
            {isEdit ? (
              <select {...register('assignedToId')} className={inputCls}>
                <option value="">— Không chọn —</option>
                {availableUsers?.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName} ({u.roles?.join(', ')})</option>
                ))}
              </select>
            ) : (
              <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-background)]">
                <div className="max-h-40 overflow-y-auto p-1.5 space-y-1">
                  {isLoadingUsers ? (
                    <div className="p-3 text-center text-xs text-[var(--color-muted-foreground)]">Đang tải danh sách...</div>
                  ) : availableUsers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[var(--color-muted-foreground)]">Không có nhân viên phù hợp</div>
                  ) : (
                    availableUsers.map((u) => {
                      const isSelected = selectedAssignees.includes(u.id)
                      return (
                        <div 
                          key={u.id}
                          onClick={() => toggleAssignee(u.id)}
                          className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                            isSelected ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'hover:bg-[var(--color-accent)]'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{u.fullName}</span>
                            <span className="text-[10px] opacity-70">{u.email} • {u.roles?.join(', ')}</span>
                          </div>
                          {isSelected && <Check size={16} />}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
            {selectedAssignees.length > 0 && !isEdit && (
              <p className="text-[10px] font-medium text-[var(--color-primary)] mt-1.5">
                Đã chọn {selectedAssignees.length} nhân viên
              </p>
            )}
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

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[var(--color-accent)] transition-all">Hủy</button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20">
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
