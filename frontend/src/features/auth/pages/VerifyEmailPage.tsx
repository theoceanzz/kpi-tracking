import { useSearchParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { CheckCircle, XCircle, Loader2, Key } from 'lucide-react'
import { useState } from 'react'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const tokenFromUrl = params.get('token')
  const [otp, setOtp] = useState('')
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
    }
  })

  // Thêm mutation gửi lại mã tại đây để người dùng có thể gửi lại nếu cần
  const resendMutation = useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: () => {
      setErrorMsg('')
      // Hiển thị thông báo thành công (có thể dùng toast nếu có)
      // Ở đây ta đơn giản là clear lỗi cũ
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể gửi lại mã xác thực.'
      setErrorMsg(msg)
    }
  })

  const handleResend = () => {
    if (contextData?.email) {
      resendMutation.mutate(contextData.email)
    }
  }

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length === 6) {
      verifyMutation.mutate(otp)
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
    <div className="text-center w-full max-w-sm mx-auto">
      <h2 className="text-2xl font-extrabold mb-2 text-[var(--color-foreground)]">Xác thực tài khoản</h2>
      <p className="text-[var(--color-muted-foreground)] text-sm mb-2">Nhập mã OTP 6 ký tự đã được gửi đến email của bạn.</p>
      {contextData?.email && (
        <p className="text-[var(--color-primary)] font-bold text-sm mb-6 animate-in fade-in zoom-in-95">{contextData.email}</p>
      )}
      {!contextData?.email && <div className="mb-8" />}

      <form onSubmit={handleVerify} className="space-y-6">
        <div className="space-y-2 text-left">
          <label className="text-sm font-bold text-[var(--color-foreground)]">Mã OTP <span className="text-red-500">*</span></label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key size={18} className="text-[var(--color-muted-foreground)]" />
             </div>
             <input 
               value={otp}
               onChange={(e) => setOtp(e.target.value.toUpperCase())}
               type="text" 
               maxLength={6}
               required
               className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none uppercase font-bold tracking-widest text-center transition-all shadow-sm" 
               placeholder="Nhập mã OTP..." 
             />
          </div>
          {(errorMsg || isAutoError) && <p className="text-red-500 text-xs mt-1.5 font-medium">{errorMsg || 'Xác thực thất bại'}</p>}
        </div>

        <button 
          type="submit" 
          disabled={verifyMutation.isPending || otp.length !== 6} 
          className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-bold hover:shadow-lg hover:shadow-[var(--color-primary)]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {verifyMutation.isPending && <Loader2 size={18} className="animate-spin" />}
          Xác thực mã OTP
        </button>
      </form>

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
