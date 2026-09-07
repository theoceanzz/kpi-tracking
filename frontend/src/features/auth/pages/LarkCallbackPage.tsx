import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Loader2, XCircle } from 'lucide-react'
import { useLarkLogin, LARK_STATE_KEY, LARK_PURPOSE_KEY } from '../hooks/useLarkLogin'
import { larkSettingApi } from '@/features/organization/api/lark-setting.api'
import { useAuthStore } from '@/store/authStore'

/** Nơi tab cấu hình đọc kết quả kết nối sau khi Lark chuyển hướng về. */
export const LARK_CONNECT_RESULT_KEY = 'lark_connect_result'

export default function LarkCallbackPage() {
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const larkLogin = useLarkLogin()
  const user = useAuthStore((s) => s.user)

  // Luồng quản trị viên liên kết tổ chức: kết quả cất vào sessionStorage rồi quay về trang cài đặt
  const connectMutation = useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) => {
      const orgId = user?.memberships?.[0]?.organizationId
      if (!orgId) throw new Error('Không xác định được tổ chức hiện tại')
      return larkSettingApi.connect(orgId, code, state)
    },
    onSuccess: (result) => {
      sessionStorage.setItem(LARK_CONNECT_RESULT_KEY, JSON.stringify(result))
      navigate('/company?section=api')
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || err.message || 'Không kết nối được với Lark.')
    },
  })

  // Authorization code chỉ dùng được 1 lần, mà StrictMode chạy effect 2 lần
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    const code = params.get('code')
    const state = params.get('state')
    const expectedState = sessionStorage.getItem(LARK_STATE_KEY)
    const purpose = sessionStorage.getItem(LARK_PURPOSE_KEY) ?? 'login'

    if (params.get('error')) {
      setError(params.get('error_description') || 'Bạn đã huỷ đăng nhập bằng Lark.')
      return
    }
    if (!code || !state) {
      setError('Thiếu tham số trả về từ Lark. Vui lòng thử lại.')
      return
    }
    if (!expectedState || state !== expectedState) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng thử lại.')
      return
    }

    sessionStorage.removeItem(LARK_STATE_KEY)
    sessionStorage.removeItem(LARK_PURPOSE_KEY)

    if (purpose === 'connect') {
      connectMutation.mutate({ code, state })
    } else {
      larkLogin.mutate({ code, state })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apiError = (larkLogin.error || connectMutation.error) as any
  const message = error || apiError?.response?.data?.message

  // Trang này KHÔNG nằm trong AuthLayout: luồng kết nối chạy khi quản trị viên đang đăng nhập,
  // mà AuthLayout lại đẩy người đã đăng nhập về /dashboard. Vì vậy tự dựng khung riêng.
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        {message ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
              <XCircle size={28} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-black text-[var(--color-foreground)]">Không thành công</h1>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{message}</p>
            <Link
              to={user ? '/company?section=api' : '/login'}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-primary)] py-3.5 font-bold text-white transition-all hover:shadow-lg hover:shadow-[var(--color-primary)]/20"
            >
              {user ? 'Quay lại cài đặt' : 'Quay lại đăng nhập'}
            </Link>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <Loader2 size={36} className="mx-auto animate-spin text-[var(--color-primary)]" />
            <h1 className="mt-5 text-2xl font-black text-[var(--color-foreground)]">
              Đang xác thực với Lark
            </h1>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Vui lòng đợi trong giây lát, đừng đóng trang này.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
