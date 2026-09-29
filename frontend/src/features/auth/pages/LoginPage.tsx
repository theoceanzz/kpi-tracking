import { useState } from 'react' // 1. Import thêm useState
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '../schemas/authSchema'
import { useLogin } from '../hooks/useLogin'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/authApi'
import LarkLoginButton from '../components/LarkLoginButton'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const [showPassword, setShowPassword] = useState(false) // 3. Tạo state quản lý ẩn hiện

  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema()),
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
      toast.info(t('LoginPage.yourRegistrationDetailsHaveBeenFilled'), {
        id: 'autofill-info'
      })
    }
  }, [registeredData, setValue, t])

  const loginMutation = useLogin()

  // Mutation gửi lại mã xác thực chuyên nghiệp hơn
  const resendMutation = useMutation({
    mutationFn: (variables: { email: string; password?: string }) => 
      authApi.resendVerification(variables.email).then(() => variables),
    onSuccess: (variables) => {
      toast.success(t('LoginPage.aNewCodeHasBeenSent', { email: variables.email }))
      // Chuyển sang trang nhập OTP
      navigate('/verify-email', { 
        state: { email: variables.email, password: variables.password } 
      })
    },
    onError: (err: any) => {
      const msg = getApiErrorMessage(err, t('LoginPage.couldNotResendTheVerificationCode'))
      toast.error(msg)
    }
  })

  const handleResendVerification = () => {
    const email = getValues('email')?.trim()
    const password = getValues('password')
    
    if (!email) {
      toast.error(t('LoginPage.pleaseEnterYourEmailBeforeResending'))
      return
    }
    resendMutation.mutate({ email, password })
  }

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data)
  }

  const inputCls = "h-10 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] pl-10 pr-12 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"

  const apiError = loginMutation.error as any
  const errorMessage = getApiErrorMessage(apiError, t('LoginPage.incorrectEmailOrPasswordPleaseCheck'))
  const isUnverified = errorMessage.toLowerCase().includes('xác thực') || 
                      errorMessage.toLowerCase().includes('unverified') ||
                      errorMessage.toLowerCase().includes('verify')

  return (
    <div className="w-full">
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-page-title mb-1">{t('LoginPage.signIn')}</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('LoginPage.enterYourEmailAndPasswordTo')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Field */}
        <div className="space-y-2">
          <label className="text-label block">{t('LoginPage.emailAddress')}</label>
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
            <label className="text-label block">{t('LoginPage.password')}</label>
            <Link to="/forgot-password" className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 transition-colors">
              {t('LoginPage.forgotPassword')}
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
                {t('LoginPage.resendTheVerificationCodeNow')}
              </Button>
            )}
          </div>
        )}

        <Button className="w-full mt-4" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {t('LoginPage.signIn2')}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--color-border)]" />
        </div>
        <div className="relative flex justify-center text-caption">
          <span className="bg-[var(--color-muted)] px-2 font-semibold tracking-wider text-[var(--color-muted-foreground)]">
            {t('LoginPage.or')}
          </span>
        </div>
      </div>

      <LarkLoginButton />

      <div className="mt-8 text-center bg-[var(--color-muted)]/30 rounded-card p-4 border border-[var(--color-border)]/50">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('LoginPage.dontHaveAnAccountYet')}{' '}
          <Link to="/register" className="text-[var(--color-foreground)] font-medium hover:text-[var(--color-primary)] transition-colors underline decoration-[var(--color-primary)]/30 underline-offset-4">
            {t('LoginPage.registerYourBusiness')}
          </Link>
        </p>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          {t('LoginPage.wantToTryItFirst')}{' '}
          <Link to="/#contact" className="text-[var(--color-foreground)] font-medium hover:text-[var(--color-primary)] transition-colors underline decoration-[var(--color-primary)]/30 underline-offset-4">
            {t('LoginPage.getATrialAccount')}
          </Link>
        </p>
      </div>

    </div>
  )
}
