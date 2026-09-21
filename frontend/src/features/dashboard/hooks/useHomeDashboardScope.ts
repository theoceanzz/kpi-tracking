import { useSearchParams } from 'react-router-dom'
import { useHasPermission } from '@/components/auth/PermissionGate'
import type { DashboardScope } from '../api/dashboardLayoutApi'
import { useViewerPosition } from './useViewerPosition'

/**
 * Bố cục trang chủ nào thuộc về người đang đăng nhập.
 *
 * <p>Tách khỏi `DashboardPage` vì việc "Ghim tổng quan" ở tab Thống kê cũng cần biết chính xác
 * bản ghi bố cục nào sẽ nhận widget được ghim. Chép lại phép suy này ở chỗ thứ hai là mở đường
 * cho hai nơi trả lời khác nhau và widget ghim rơi vào một bố cục người dùng không bao giờ mở.
 *
 * <p>= vị trí của người xem ({@link useViewerPosition}) cộng thêm công tắc "Dashboard cá nhân"
 * (`?view=staff`) mà chỉ trang chủ có.
 *
 * <p>Trả `null` khi tài khoản không có bảng nào — quản trị nền tảng, hoặc thiếu mọi quyền xem.
 */
export function useHomeDashboardScope(): DashboardScope | null {
  const { hasPermission } = useHasPermission()
  const [searchParams] = useSearchParams()
  const position = useViewerPosition()

  // Đang bật công tắc "Dashboard cá nhân" và có quyền xem KPI của mình
  if (position && searchParams.get('view') === 'staff' && hasPermission('KPI:VIEW_MY')) return 'STAFF'

  return position
}
