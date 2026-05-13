import { useSearchParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'

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
    onError: () => {
      setErrorMsg('Xác thực thất bại. Mã OTP không hợp lệ hoặc đã hết hạn.')
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
      const msg = err.response?.data?.message || 'Không thể gửi lại mã xác thực.'
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
      <div className="w-full max-w-sm mx-auto text-center space-y-8 animate-in fade-in duration-500">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin mx-auto" />
          <div className="absolute inset-0 flex items-center justify-center">
             <CheckCircle className="text-emerald-500 w-10 h-10 animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-extrabold text-[var(--color-foreground)]">Xác thực thành công!</h2>
          <p className="text-[var(--color-muted-foreground)] text-sm">
            Tài khoản của bạn đã được kích hoạt. <br/>
            Đang chuyển hướng bạn đến trang đăng nhập...
          </p>
        </div>
        <div className="flex justify-center gap-1.5">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
        </div>
      </div>
    )
  }

  if (tokenFromUrl && (isAutoLoading || isAutoError)) {
    return (
      <div className="text-center w-full max-w-sm mx-auto">
        <h2 className="text-2xl font-extrabold mb-6">Xác thực email</h2>
        {isAutoLoading ? (
          <div className="flex flex-col items-center gap-3 text-[var(--color-muted-foreground)]">
            <Loader2 size={40} className="animate-spin text-[var(--color-primary)]" />
            <p className="font-medium">Đang xử lý xác thực...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="text-red-500" size={40} />
            </div>
            <p className="font-bold text-red-500">Xác thực thất bại.</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">Mã xác thực không hợp lệ hoặc đã hết hạn.</p>
            <Link to="/verify-email" className="text-[var(--color-primary)] font-bold hover:underline mt-2">
              Thử nhập lại mã OTP
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="text-center w-full max-w-md mx-auto">
      <h2 className="text-3xl font-extrabold mb-2 text-[var(--color-foreground)] tracking-tight">Xác thực tài khoản</h2>
      <p className="text-[var(--color-muted-foreground)] text-sm mb-2">
        Nhập mã OTP 6 ký tự đã được gửi đến email của bạn.
      </p>
      {contextData?.email && (
        <p className="text-[var(--color-primary)] font-bold text-base mb-8 animate-in fade-in slide-in-from-top-2">{contextData.email}</p>
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
              className="w-12 h-14 sm:w-14 sm:h-16 text-center text-xl font-bold border-2 rounded-xl border-[var(--color-border)] bg-[var(--color-background)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none transition-all shadow-sm uppercase"
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
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
            <p className="text-red-500 text-sm font-semibold">{errorMsg || 'Xác thực thất bại. Vui lòng thử lại.'}</p>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {contextData?.email && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resendMutation.isPending}
            className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {resendMutation.isPending && <Loader2 size={12} className="animate-spin" />}
            {resendMutation.isSuccess ? 'Đã gửi lại mã!' : 'Bạn không nhận được mã? Gửi lại ngay'}
          </button>
        )}
        <Link to="/login" className="text-sm text-[var(--color-muted-foreground)] font-semibold hover:text-[var(--color-foreground)] transition-colors">
          Trở lại Đăng nhập
        </Link>
      </div>
    </div>
  )
}
