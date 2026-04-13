import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { toast } from 'sonner'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors }, watch } = useForm<{ newPassword: string; confirmPassword: string }>()

  const mutation = useMutation({
    mutationFn: (data: { newPassword: string; confirmPassword: string }) =>
      authApi.resetPassword({ token, newPassword: data.newPassword, confirmPassword: data.confirmPassword }),
    onSuccess: () => { toast.success('Mật khẩu đã được đặt lại'); navigate('/login') },
    onError: () => toast.error('Đặt lại mật khẩu thất bại'),
  })

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div>
      <h2 className="text-xl font-bold text-center mb-6">Đặt lại mật khẩu</h2>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Mật khẩu mới</label>
          <input {...register('newPassword', { required: 'Vui lòng nhập mật khẩu', minLength: { value: 8, message: 'Tối thiểu 8 ký tự' } })} type="password" className={inputCls} placeholder="Tối thiểu 8 ký tự" />
          {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Xác nhận mật khẩu</label>
          <input {...register('confirmPassword', { required: 'Vui lòng xác nhận', validate: (v) => v === watch('newPassword') || 'Mật khẩu không khớp' })} type="password" className={inputCls} placeholder="Nhập lại mật khẩu" />
          {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <button type="submit" disabled={mutation.isPending} className="w-full py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
          {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
          Đặt lại mật khẩu
        </button>
      </form>

      <p className="text-center text-sm text-[var(--color-muted-foreground)] mt-6">
        <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline">Về trang đăng nhập</Link>
      </p>
    </div>
  )
}
