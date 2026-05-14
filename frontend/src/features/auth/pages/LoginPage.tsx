import { useState } from 'react' // 1. Import thêm useState
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '../schemas/authSchema'
import { useLogin } from '../hooks/useLogin'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/authApi'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false) // 3. Tạo state quản lý ẩn hiện

  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })


  const navigate = useNavigate()
  const location = useLocation()
  const registeredData = location.state as { email?: string; password?: string } | null

  useEffect(() => {
    if (registeredData?.email) {
      setValue('email', registeredData.email)
    }
    if (registeredData?.password) {
      setValue('password', registeredData.password)
      // Sử dụng id để tránh hiển thị trùng lặp (ví dụ do React Strict Mode)
      toast.info('Thông tin đăng ký đã được tự động điền.', {
        id: 'autofill-info'
      })
    }
  }, [registeredData, setValue])

  const loginMutation = useLogin()

  // Mutation gửi lại mã xác thực chuyên nghiệp hơn
  const resendMutation = useMutation({
    mutationFn: (variables: { email: string; password?: string }) => 
      authApi.resendVerification(variables.email).then(() => variables),
    onSuccess: (variables) => {
      toast.success(`Mã mới đã gửi tới: ${variables.email}`)
      // Chuyển sang trang nhập OTP
      navigate('/verify-email', { 
        state: { email: variables.email, password: variables.password } 
      })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể gửi lại mã xác thực.'
      toast.error(msg)
    }
  })

  const handleResendVerification = () => {
    const email = getValues('email')?.trim()
    const password = getValues('password')
    
    if (!email) {
      toast.error('Vui lòng nhập email trước khi gửi lại mã!')
      return
    }
    resendMutation.mutate({ email, password })
  }

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data)
  }

  const inputCls = "w-full pl-10 pr-12 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"

  const apiError = loginMutation.error as any
  const errorMessage = apiError?.response?.data?.message || 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!'
  const isUnverified = errorMessage.toLowerCase().includes('xác thực') || 
                      errorMessage.toLowerCase().includes('unverified') ||
                      errorMessage.toLowerCase().includes('verify')

  return (
    <div className="w-full">
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-3xl font-extrabold tracking-tight text-[var(--color-foreground)] mb-2">Đăng nhập</h2>
        <p className="text-[var(--color-muted-foreground)]">Chào mừng trở lại! Vui lòng nhập thông tin của bạn.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Field */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-[var(--color-foreground)]">Địa chỉ Email</label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Mail size={18} className="text-[var(--color-muted-foreground)]" />
             </div>
            <input
              {...register('email')}
              type="email"
              placeholder="name@company.com"
              className={inputCls}
            />
          </div>
          {errors.email && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.email.message}</p>}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-[var(--color-foreground)]">Mật khẩu</label>
            <Link to="/forgot-password" className="text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 transition-colors">
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-[var(--color-muted-foreground)]" />
             </div>
             
             <input
              {...register('password')}
              // 4. Thay đổi type dựa trên state
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className={inputCls}
            />

            {/* 5. Nút bấm ẩn/hiện */}
            <button
              type="button" // Quan trọng: phải là type="button" để không submit form
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.password.message}</p>}
        </div>

        {loginMutation.isError && (
          <div className="p-3 rounded-lg bg-red-50/80 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-start gap-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />
              <p>{errorMessage}</p>
            </div>
            {isUnverified && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendMutation.isPending}
                className="ml-4 text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {resendMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                Gửi lại mã xác thực ngay
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-bold hover:shadow-lg hover:shadow-[var(--color-primary)]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
        >
          {loginMutation.isPending && <Loader2 size={18} className="animate-spin" />}
          Đăng nhập hệ thống
        </button>
      </form>

      <div className="mt-8 text-center bg-[var(--color-muted)]/30 rounded-xl p-4 border border-[var(--color-border)]/50">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Cổng thông tin chưa có tài khoản?{' '}
          <Link to="/register" className="text-[var(--color-foreground)] font-bold hover:text-[var(--color-primary)] transition-colors underline decoration-[var(--color-primary)]/30 underline-offset-4">
            Đăng ký doanh nghiệp
          </Link>
        </p>
      </div>
    </div>
  )
}