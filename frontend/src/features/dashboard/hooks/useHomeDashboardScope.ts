import { useSearchParams } from 'react-router-dom'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useAuthStore } from '@/store/authStore'
import type { DashboardScope } from '../api/dashboardLayoutApi'

/**
 * Bố cục trang chủ nào thuộc về người đang đăng nhập.
 *
 * <p>Tách khỏi `DashboardPage` vì việc "Ghim tổng quan" ở tab Thống kê cũng cần biết chính xác
 * bản ghi bố cục nào sẽ nhận widget được ghim. Chép lại phép suy này ở chỗ thứ hai là mở đường
 * cho hai nơi trả lời khác nhau và widget ghim rơi vào một bố cục người dùng không bao giờ mở.
 *
 * <p>Trả `null` khi tài khoản không có bảng nào — quản trị nền tảng, hoặc thiếu mọi quyền xem.
 */
export function useHomeDashboardScope(): DashboardScope | null {
  const { hasPermission } = useHasPermission()
  const [searchParams] = useSearchParams()
  const user = useAuthStore(s => s.user)

  if (user?.isPlatformAdmin) return null

  const canViewOwn = hasPermission('KPI:VIEW_MY')
  /**
   * Role.rank: 0 = trưởng đơn vị, 1 = phó, 2 = nhân viên. Phó có gần hết quyền của trưởng nên
   * nếu chỉ xét quyền thì họ rơi vào bảng trưởng đơn vị và thấy dữ liệu toàn đơn vị.
   */
  const isDeputy = (user?.memberships ?? []).some(m => m.roleRank === 1)

  // Đang bật công tắc "Dashboard cá nhân" và có quyền xem KPI của mình
  if (searchParams.get('view') === 'staff' && canViewOwn) return 'STAFF'

  if (hasPermission(['ORG:VIEW', 'USER:VIEW', 'ROLE:VIEW'], true)) return 'DIRECTOR'
  // Phó đơn vị xét TRƯỚC trưởng đơn vị vì quyền của hai vai gần như trùng nhau
  if (isDeputy) return 'DEPUTY'
  if (hasPermission(['SUBMISSION:REVIEW', 'USER:VIEW_LIST'])) return 'HEAD'
  if (canViewOwn) return 'STAFF'

  return null
}
