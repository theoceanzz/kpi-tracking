import { useState } from 'react' // 1. Import thêm useState
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '../schemas/authSchema'
import { useLogin } from '../hooks/useLogin'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Mail, Lock, Eye, EyeOff, Crown, GraduationCap, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { authApi } from '../api/authApi'
import LarkLoginButton from '../components/LarkLoginButton'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'

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
      const msg = getApiErrorMessage(err, 'Không thể gửi lại mã xác thực.')
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

  const inputCls = "h-10 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] pl-10 pr-12 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"

  const apiError = loginMutation.error as any
  const errorMessage = getApiErrorMessage(apiError, 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!')
  const isUnverified = errorMessage.toLowerCase().includes('xác thực') || 
                      errorMessage.toLowerCase().includes('unverified') ||
                      errorMessage.toLowerCase().includes('verify')

  return (
    <div className="w-full">
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-page-title mb-1">Đăng nhập</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">Nhập email và mật khẩu để vào hệ thống.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Quick Demo Access - Top Placement */}
        <div className="bg-[var(--color-primary-soft)] border border-[var(--color-border)] rounded-card p-4 mb-8">
           <div className="flex items-center gap-2 mb-3 text-eyebrow text-[var(--color-primary)]">
              <div className="w-4 h-4 rounded-full bg-[var(--color-primary-soft)] flex items-center justify-center">
                 <PlayCircle size={10} />
              </div>
              Truy cập nhanh Demo
           </div>
           
           <div className="grid grid-cols-2 gap-3">
              {DEMO_ACCOUNTS.map((account, idx) => {
                const Icon = account.icon
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setValue('email', account.email)
                      setValue('password', account.password)
                      toast.success('Đã điền tài khoản demo!', { id: 'demo-fill' })
                    }}
                    className={cn(
                      "group relative flex flex-col items-center justify-center gap-2 p-3 rounded-card border bg-[var(--color-card)] transition-all duration-300",
                      "hover:border-[var(--color-primary)]",
                      "border-[var(--color-border)]"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-500 group-hover:rotate-6",
                      idx === 0 ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                    )}>
                      <Icon size={18} />
                    </div>
                    <div className="text-center">
                       <p className={cn(
                         "text-xs font-medium",
                         idx === 0 ? "text-[var(--color-primary)]" : "text-[var(--color-success)]"
                       )}>
                          {account.role}
                       </p>
                       <p className="text-caption font-medium">
                          {account.org}
                       </p>
                    </div>
                  </button>
                )
              })}
           </div>
        </div>

        {/* Email Field */}
        <div className="space-y-2">
          <label className="text-label block">Địa chỉ Email</label>
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
          {errors.email && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.email.message}</p>}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-label block">Mật khẩu</label>
            <Link to="/forgot-password" className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 transition-colors">
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
              className={inputCls + ' no-edit-hint'}
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
          {errors.password && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.password.message}</p>}
        </div>

        {loginMutation.isError && (
          <div className="p-3 rounded-control bg-[var(--color-error-bg)] border border-[var(--color-error-border)] dark:bg-[var(--color-error-bg)] dark:border-[var(--color-error-border)] text-[var(--color-error)] text-sm font-medium flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-start gap-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-error-solid)] shrink-0 mt-1.5" />
              <p>{errorMessage}</p>
            </div>
            {isUnverified && (
              <Button variant="ghost" size="sm" className="ml-4" type="button" onClick={handleResendVerification} disabled={resendMutation.isPending}>
                {resendMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
                Gửi lại mã xác thực ngay
              </Button>
            )}
          </div>
        )}

        <Button className="w-full mt-4" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
          Đăng nhập hệ thống
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--color-border)]" />
        </div>
        <div className="relative flex justify-center text-caption">
          <span className="bg-[var(--color-muted)] px-2 font-semibold tracking-wider text-[var(--color-muted-foreground)]">
            Hoặc
          </span>
        </div>
      </div>

      <LarkLoginButton />

      <div className="mt-8 text-center bg-[var(--color-muted)]/30 rounded-card p-4 border border-[var(--color-border)]/50">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Cổng thông tin chưa có tài khoản?{' '}
          <Link to="/register" className="text-[var(--color-foreground)] font-medium hover:text-[var(--color-primary)] transition-colors underline decoration-[var(--color-primary)]/30 underline-offset-4">
            Đăng ký doanh nghiệp
          </Link>
        </p>
      </div>

    </div>
  )
}

const DEMO_ACCOUNTS = [
  {
    email: 'director@demo.com',
    password: 'Demo123@',
    role: 'Giám Đốc',
    org: 'Công ty',
    icon: Crown,
  },
  {
    email: 'truong.khoa.cntt@demo.edu.vn',
    password: 'Demo123@',
    role: 'Trưởng Khoa',
    org: 'Đại học',
    icon: GraduationCap,
  },
]