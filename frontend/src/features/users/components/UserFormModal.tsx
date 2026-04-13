import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { userSchema, type UserFormData, updateUserSchema, type UpdateUserFormData } from '../schemas/userSchema'
import { useCreateUser } from '../hooks/useCreateUser'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import type { User } from '@/types/user'

interface UserFormModalProps {
  open: boolean
  onClose: () => void
  editUser?: User | null
}

const roleOptions = [
  { value: 'DIRECTOR', label: 'Giám đốc' },
  { value: 'HEAD', label: 'Trưởng phòng' },
  { value: 'DEPUTY_HEAD', label: 'Phó phòng' },
  { value: 'STAFF', label: 'Nhân viên' },
] as const

const statusOptions = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Ngưng hoạt động' },
  { value: 'SUSPENDED', label: 'Tạm khóa' },
] as const

export default function UserFormModal({ open, onClose, editUser }: UserFormModalProps) {
  const isEdit = !!editUser
  const qc = useQueryClient()

  const createMutation = useCreateUser()

  const updateMutation = useMutation({
    mutationFn: (data: UpdateUserFormData) => userApi.update(editUser!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Cập nhật nhân sự thành công')
      onClose()
    },
    onError: () => toast.error('Cập nhật thất bại'),
  })

  if (!open) return null

  return isEdit ? (
    <EditUserForm editUser={editUser!} onClose={onClose} onSubmit={(data) => updateMutation.mutate(data)} isPending={updateMutation.isPending} />
  ) : (
    <CreateUserForm onClose={onClose} onSubmit={(data) => createMutation.mutate(data, { onSuccess: () => onClose() })} isPending={createMutation.isPending} />
  )
}

function CreateUserForm({ onClose, onSubmit, isPending }: { onClose: () => void; onSubmit: (data: UserFormData) => void; isPending: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { email: '', fullName: '', password: '', phone: '', role: 'STAFF' },
  })

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Thêm nhân sự mới</h3>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
            <input {...register('fullName')} className={inputCls} placeholder="Nguyễn Văn A" />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email <span className="text-red-500">*</span></label>
            <input {...register('email')} type="email" className={inputCls} placeholder="name@company.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mật khẩu <span className="text-red-500">*</span></label>
            <input {...register('password')} type="password" className={inputCls} placeholder="Tối thiểu 8 ký tự" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Số điện thoại</label>
            <input {...register('phone')} className={inputCls} placeholder="0912 345 678" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Vai trò <span className="text-red-500">*</span></label>
            <select {...register('role')} className={inputCls}>
              {roleOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-accent)] transition-colors">Hủy</button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {isPending && <Loader2 size={16} className="animate-spin" />} Tạo mới
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditUserForm({ editUser, onClose, onSubmit, isPending }: { editUser: User; onClose: () => void; onSubmit: (data: UpdateUserFormData) => void; isPending: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { email: editUser.email, fullName: editUser.fullName, phone: editUser.phone ?? '', role: editUser.role, status: editUser.status },
  })

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Chỉnh sửa nhân sự</h3>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Họ và tên</label>
            <input {...register('fullName')} className={inputCls} />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input {...register('email')} type="email" className={inputCls} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Số điện thoại</label>
            <input {...register('phone')} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Vai trò</label>
            <select {...register('role')} className={inputCls}>
              {roleOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Trạng thái</label>
            <select {...register('status')} className={inputCls}>
              {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-accent)] transition-colors">Hủy</button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {isPending && <Loader2 size={16} className="animate-spin" />} Cập nhật
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
