import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '../schemas/authSchema'
import { useLogin } from '../hooks/useLogin'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const loginMutation = useLogin()

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-center mb-6">Đăng nhập</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input
            {...register('email')}
            type="email"
            placeholder="name@company.com"
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium">Mật khẩu</label>
            <Link to="/forgot-password" className="text-xs text-[var(--color-primary)] hover:underline">
              Quên mật khẩu?
            </Link>
          </div>
          <input
            {...register('password')}
            type="password"
            placeholder="••••••••"
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {loginMutation.isPending && <Loader2 size={16} className="animate-spin" />}
          Đăng nhập
        </button>
      </form>

      <p className="text-center text-sm text-[var(--color-muted-foreground)] mt-6">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="text-[var(--color-primary)] font-medium hover:underline">
          Đăng ký ngay
        </Link>
      </p>
    </div>
  )
}
