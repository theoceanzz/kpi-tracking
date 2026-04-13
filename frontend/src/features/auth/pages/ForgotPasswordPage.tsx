import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { Loader2, CheckCircle } from 'lucide-react'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>()

  const mutation = useMutation({
    mutationFn: (data: { email: string }) => authApi.forgotPassword(data),
    onSuccess: () => { toast.success('Email đặt lại mật khẩu đã được gửi'); setSent(true) },
    onError: () => toast.error('Gửi email thất bại'),
  })

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-emerald-500" size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2">Kiểm tra email của bạn</h2>
        <p className="text-sm text-[var(--color-muted-foreground)] mb-4">Chúng tôi đã gửi link đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.</p>
        <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline">Về trang đăng nhập</Link>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-center mb-2">Quên mật khẩu</h2>
      <p className="text-sm text-[var(--color-muted-foreground)] text-center mb-6">Nhập email để nhận link đặt lại mật khẩu</p>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input {...register('email', { required: 'Vui lòng nhập email' })} type="email" placeholder="name@company.com" className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <button type="submit" disabled={mutation.isPending} className="w-full py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
          {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
          Gửi email
        </button>
      </form>

      <p className="text-center text-sm text-[var(--color-muted-foreground)] mt-6">
        <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline">Quay lại đăng nhập</Link>
      </p>
    </div>
  )
}
