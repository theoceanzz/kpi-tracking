import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuthSuccess } from './useAuthSuccess'

export const LARK_STATE_KEY = 'lark_oauth_state'

/**
 * Một redirect URL duy nhất phục vụ cả đăng nhập lẫn kết nối tổ chức — nhờ đó khách hàng chỉ
 * phải khai báo một URL trong ứng dụng Lark. Trang callback đọc khoá này để biết đang ở luồng nào.
 */
export const LARK_PURPOSE_KEY = 'lark_oauth_purpose'
export type LarkPurpose = 'login' | 'connect'

/** Đổi authorization code của Lark lấy token của KeyGo. */
export function useLarkLogin() {
  const onAuthSuccess = useAuthSuccess()

  return useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) =>
      authApi.larkCallback(code, state),
    onSuccess: onAuthSuccess,
  })
}
