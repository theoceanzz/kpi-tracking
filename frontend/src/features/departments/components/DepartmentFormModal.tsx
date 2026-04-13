import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { departmentApi } from '../api/departmentApi'
import { toast } from 'sonner'
import { X, Loader2 } from 'lucide-react'
import type { Department } from '@/types/department'

interface DepartmentFormModalProps {
  open: boolean
  onClose: () => void
  editDept?: Department | null
}

interface FormData {
  name: string
  description: string
}

export default function DepartmentFormModal({ open, onClose, editDept }: DepartmentFormModalProps) {
  const isEdit = !!editDept
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    values: editDept ? { name: editDept.name, description: editDept.description ?? '' } : { name: '', description: '' },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => departmentApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Tạo phòng ban thành công'); reset(); onClose() },
    onError: () => toast.error('Tạo phòng ban thất bại'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => departmentApi.update(editDept!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Cập nhật thành công'); onClose() },
    onError: () => toast.error('Cập nhật thất bại'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (data: FormData) => {
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{isEdit ? 'Chỉnh sửa phòng ban' : 'Tạo phòng ban mới'}</h3>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Tên phòng ban <span className="text-red-500">*</span></label>
            <input {...register('name', { required: 'Vui lòng nhập tên' })} className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50" placeholder="VD: Phòng Kinh doanh" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Mô tả</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 resize-none" placeholder="Mô tả chức năng phòng ban..." />
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
