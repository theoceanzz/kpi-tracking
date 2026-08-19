import { useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useSidebarSettings } from './useSidebarSettings'
import { navItemKey, type NavItem } from '@/config/navigation'

/**
 * Nhãn tuỳ chỉnh mà tổ chức đặt cho các mục điều hướng. Dùng chung cho sidebar và
 * cho menu bên trong các trang thiết lập, nhờ đó đổi tên một lần là đổi ở mọi nơi.
 *
 * Tra theo khoá hiện tại trước, rồi tới `legacyKeys` — nhãn đã đặt từ trước khi đổi
 * cấu trúc điều hướng vẫn còn tác dụng, không cần migration dữ liệu.
 */
export function useNavLabels() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: customLabels = {} } = useSidebarSettings(organizationId!)

  const labelOf = useCallback((item: NavItem): string => {
    const labels = customLabels as Record<string, string>
    return labels[navItemKey(item)] || item.legacyKeys?.map(k => labels[k]).find(Boolean) || item.label
  }, [customLabels])

  return { labelOf, customLabels: customLabels as Record<string, string> }
}
