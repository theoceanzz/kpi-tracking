import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')

  const { isLoading, isSuccess } = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => authApi.verifyEmail(token!),
    enabled: !!token,
    retry: false,
  })

  return (
    <div className="text-center">
      <h2 className="text-xl font-bold mb-4">Xác thực email</h2>

      {!token ? (
        <div className="text-red-500 flex flex-col items-center gap-2">
          <XCircle size={40} />
          <p>Token không hợp lệ</p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center gap-2 text-[var(--color-muted-foreground)]">
          <Loader2 size={40} className="animate-spin" />
          <p>Đang xác thực...</p>
        </div>
      ) : isSuccess ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="text-emerald-500" size={32} />
          </div>
          <p className="font-medium text-emerald-600">Email đã được xác thực thành công!</p>
          <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline mt-2">
            Đăng nhập ngay
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <XCircle className="text-red-500" size={32} />
          </div>
          <p className="font-medium text-red-500">Xác thực thất bại. Token không hợp lệ hoặc đã hết hạn.</p>
          <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline mt-2">
            Về trang đăng nhập
          </Link>
        </div>
      )}
    </div>
  )
}
