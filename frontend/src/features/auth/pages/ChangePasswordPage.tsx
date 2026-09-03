import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { changePasswordSchema, type ChangePasswordFormData } from '../schemas/authSchema'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader'
import { Loader2 } from 'lucide-react'

export default function ChangePasswordPage() {
  const { register, handleSubmit, formState: { errors }, watch, reset, setError } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: ChangePasswordFormData) => authApi.changePassword(data),
    onSuccess: () => { toast.success('Đổi mật khẩu thành công'); reset() },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Đổi mật khẩu thất bại'
      if (message.includes('Mật khẩu hiện tại')) {
        setError('currentPassword', { type: 'manual', message: message })
      } else {
        toast.error(message)
      }
    },
  })

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div>
      <PageHeader title="Đổi mật khẩu" description="Thay đổi mật khẩu tài khoản" />

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6 max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Mật khẩu hiện tại</label>
          <input {...register('currentPassword')} type="password" className={inputCls} />
          {errors.currentPassword && <p className="text-red-500 text-xs mt-1">{errors.currentPassword.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Mật khẩu mới</label>
          <input {...register('newPassword')} type="password" className={inputCls} />
          {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>}
          {watch('newPassword') && watch('currentPassword') && watch('newPassword') === watch('currentPassword') && (
            <p className="text-red-500 text-xs mt-1">Mật khẩu mới không được trùng với mật khẩu cũ</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Xác nhận mật khẩu mới</label>
          <input {...register('confirmPassword')} type="password" className={inputCls} />
          {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <button 
          type="submit" 
          disabled={mutation.isPending || (!!watch('newPassword') && watch('newPassword') === watch('currentPassword'))} 
          className="w-full py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
          Đổi mật khẩu
        </button>
      </form>
    </div>
  )
}
