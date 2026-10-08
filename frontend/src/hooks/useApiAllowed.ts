import { useAuthStore } from '@/store/authStore'
import { ENV } from '@/config/env'
import { missingPermission, requestPath } from '@/lib/apiPermissions'

/**
 * Người dùng hiện tại có được gọi endpoint này không — tra bảng sinh từ @PreAuthorize backend
 * (`src/lib/apiPermissions.ts`). Dùng làm `enabled` của hook đọc dữ liệu thay vì tự đoán quyền:
 *
 *   const allowed = useApiAllowed('GET', '/users')
 *   useQuery({ ..., enabled: allowed })
 *
 * Endpoint không có trong bảng / chưa đăng nhập ⇒ `true` (để backend quyết định).
 */
export function useApiAllowed(method: string, url: string): boolean {
  const user = useAuthStore(s => s.user)
  return missingPermission(method, requestPath(url, ENV.API_BASE_URL), user) == null
}
