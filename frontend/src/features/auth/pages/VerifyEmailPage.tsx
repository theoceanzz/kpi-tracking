import { useSearchParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { getApiErrorMessage } from '@/lib/apiError'
import { Button } from '@/components/ui/button'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const tokenFromUrl = params.get('token')
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', ''])
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  // Lấy email/password từ state nếu có (từ trang login nhảy sang)
  const contextData = location.state as { email?: string; password?: string } | null

  // Automatic verification if token is present in URL
  const { isLoading: isAutoLoading, isError: isAutoError } = useQuery({
    queryKey: ['verify-email', tokenFromUrl],
    queryFn: () => authApi.verifyEmail(tokenFromUrl!).then(() => {
      setIsRedirecting(true)
      setTimeout(() => navigate('/login', { state: contextData }), 2000)
    }),
    enabled: !!tokenFromUrl && !isRedirecting,
    retry: false,
  })

  // Manual verification
  const verifyMutation = useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
    onSuccess: () => {
      setIsRedirecting(true)
      setErrorMsg('')
      setTimeout(() => navigate('/login', { state: contextData }), 2000)
    },
    onError: (error) => {
      setErrorMsg(getApiErrorMessage(error, 'Xác thực thất bại. Mã OTP không hợp lệ hoặc đã hết hạn.'))
      setOtpValues(['', '', '', '', '', ''])
      document.getElementById('otp-0')?.focus()
    }
  })

  // Thêm mutation gửi lại mã tại đây để người dùng có thể gửi lại nếu cần
  const resendMutation = useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: () => {
      setErrorMsg('')
    },
    onError: (err: any) => {
      const msg = getApiErrorMessage(err, 'Không thể gửi lại mã xác thực.')
      setErrorMsg(msg)
    }
  })

  const handleChange = (index: number, value: string) => {
    if (!/^[a-zA-Z0-9]*$/.test(value)) return
    
    const newOtpValues = [...otpValues]
    // Only take the last character if multiple are entered
    newOtpValues[index] = value.slice(-1).toUpperCase()
    setOtpValues(newOtpValues)

    // Auto-focus next
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }

    // Auto-submit if complete
    const currentOtp = newOtpValues.join('')
    if (currentOtp.length === 6) {
      verifyMutation.mutate(currentOtp)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').toUpperCase().slice(0, 6)
    if (!/^[a-zA-Z0-9]+$/.test(pastedData)) return

    const newOtpValues = [...otpValues]
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtpValues[i] = char
    })
    setOtpValues(newOtpValues)
    
    if (pastedData.length === 6) {
      verifyMutation.mutate(pastedData)
    } else {
      const nextIndex = Math.min(pastedData.length, 5)
      document.getElementById(`otp-${nextIndex}`)?.focus()
    }
  }

  const handleResend = () => {
    if (contextData?.email) {
      resendMutation.mutate(contextData.email)
    }
  }

  if (isRedirecting) {
    return (
      <div className="w-full max-w-sm mx-auto text-center space-y-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-[var(--color-success-border)] border-t-[var(--color-success)] animate-spin mx-auto" />
          <div className="absolute inset-0 flex items-center justify-center">
             <CheckCircle className="text-[var(--color-success)] w-10 h-10 animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-page-title">Xác thực thành công</h2>
          <p className="text-[var(--color-muted-foreground)] text-sm">
            Tài khoản của bạn đã được kích hoạt. <br/>
            Đang chuyển hướng bạn đến trang đăng nhập...
          </p>
        </div>
        <div className="flex justify-center gap-1.5">
           <div className="w-2 h-2 rounded-full bg-[var(--color-success-solid)] animate-bounce [animation-delay:-0.3s]" />
           <div className="w-2 h-2 rounded-full bg-[var(--color-success-solid)] animate-bounce [animation-delay:-0.15s]" />
           <div className="w-2 h-2 rounded-full bg-[var(--color-success-solid)] animate-bounce" />
        </div>
      </div>
    )
  }

  if (tokenFromUrl && (isAutoLoading || isAutoError)) {
    return (
      <div className="text-center w-full max-w-sm mx-auto">
        <h2 className="text-page-title mb-4">Xác thực email</h2>
        {isAutoLoading ? (
          <div className="flex flex-col items-center gap-3 text-[var(--color-muted-foreground)]">
            <Loader2 size={40} className="animate-spin text-[var(--color-primary)]" />
            <p className="font-medium">Đang xử lý xác thực...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[var(--color-error-bg)] flex items-center justify-center">
              <XCircle className="text-[var(--color-error)]" size={40} />
            </div>
            <p className="font-semibold text-[var(--color-error)]">Xác thực thất bại.</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">Mã xác thực không hợp lệ hoặc đã hết hạn.</p>
            <Link to="/verify-email" className="text-[var(--color-primary)] font-medium hover:underline mt-2">
              Thử nhập lại mã OTP
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="text-center w-full max-w-md mx-auto">
      <h2 className="text-page-title mb-1">Xác thực tài khoản</h2>
      <p className="text-[var(--color-muted-foreground)] text-sm mb-2">
        Nhập mã OTP 6 ký tự đã được gửi đến email của bạn.
      </p>
      {contextData?.email && (
        <p className="text-[var(--color-primary)] font-semibold text-base mb-8 animate-in fade-in slide-in-from-top-2">{contextData.email}</p>
      )}
      {!contextData?.email && <div className="mb-8" />}

      <div className="space-y-6">
        <div className="flex justify-between gap-2 sm:gap-3" onPaste={handlePaste}>
          {otpValues.map((value, index) => (
            <input
              key={index}
              id={`otp-${index}`}
              type="text"
              maxLength={1}
              value={value}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 sm:w-14 sm:h-16 text-center text-xl font-semibold border-2 rounded-card border-[var(--color-border)] bg-[var(--color-background)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none transition-all shadow-sm uppercase"
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {verifyMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-[var(--color-primary)] font-medium animate-pulse">
            <Loader2 size={18} className="animate-spin" />
            <span>Đang kiểm tra...</span>
          </div>
        )}

        {(errorMsg || isAutoError) && (
          <div className="p-3 rounded-control bg-[var(--color-error-bg)] border border-[var(--color-error-border)]">
            <p className="text-[var(--color-error)] text-sm font-semibold">{errorMsg || 'Xác thực thất bại. Vui lòng thử lại.'}</p>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {contextData?.email && (
          <Button variant="ghost" size="sm" type="button" onClick={handleResend} disabled={resendMutation.isPending}>
            {resendMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
            {resendMutation.isSuccess ? 'Đã gửi lại mã!' : 'Bạn không nhận được mã? Gửi lại ngay'}
          </Button>
        )}
        <Link to="/login" className="text-sm text-[var(--color-muted-foreground)] font-medium hover:text-[var(--color-foreground)] transition-colors">
          Trở lại Đăng nhập
        </Link>
      </div>
    </div>
  )
}
