import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterFormData } from '../schemas/authSchema'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuthStore } from '@/store/authStore'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormData) => authApi.register(data),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success('Đăng ký thành công! Vui lòng xác thực email.')
      navigate('/dashboard')
    },
    onError: () => {
      toast.error('Đăng ký thất bại. Vui lòng thử lại.')
    },
  })

  const onSubmit = (data: RegisterFormData) => registerMutation.mutate(data)

  return (
    <div>
      <h2 className="text-xl font-bold text-center mb-6">Đăng ký công ty</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Tên công ty</label>
          <input {...register('companyName')} className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50" placeholder="VD: Công ty ABC" />
          {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Họ và tên</label>
          <input {...register('fullName')} className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50" placeholder="Nguyễn Văn A" />
          {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input {...register('email')} type="email" className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50" placeholder="name@company.com" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Mật khẩu</label>
          <input {...register('password')} type="password" className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50" placeholder="Tối thiểu 8 ký tự" />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Số điện thoại</label>
          <input {...register('phone')} className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50" placeholder="0912 345 678" />
        </div>

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="w-full py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {registerMutation.isPending && <Loader2 size={16} className="animate-spin" />}
          Đăng ký
        </button>
      </form>

      <p className="text-center text-sm text-[var(--color-muted-foreground)] mt-6">
        Đã có tài khoản?{' '}
        <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  )
}
