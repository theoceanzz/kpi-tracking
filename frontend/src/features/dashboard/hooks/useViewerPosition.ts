import { useHasPermission } from '@/components/auth/PermissionGate'
import { useAuthStore } from '@/store/authStore'
import type { DashboardScope } from '../api/dashboardLayoutApi'

/**
 * Vị trí của người đang đăng nhập theo cách hệ thống nhìn: ban giám đốc, trưởng đơn vị, phó đơn
 * vị hay nhân viên. Cùng bốn giá trị với `DashboardScope` vì trang chủ đã chia bố cục theo đúng
 * bốn vai này.
 */
export type ViewerPosition = DashboardScope

export const POSITION_LABEL: Record<ViewerPosition, string> = {
  DIRECTOR: 'Ban giám đốc',
  HEAD: 'Trưởng đơn vị',
  DEPUTY: 'Phó đơn vị',
  STAFF: 'Nhân viên',
}

/** Thứ tự hiện các bộ gợi ý: từ rộng tới hẹp. */
export const POSITION_ORDER: ViewerPosition[] = ['DIRECTOR', 'HEAD', 'DEPUTY', 'STAFF']

/**
 * Suy vị trí từ quyền và hạng vai trò — MỘT phép suy dùng chung cho trang chủ
 * (`useHomeDashboardScope`) và các tab Thống kê (bộ biểu đồ mặc định, gợi ý trong thư viện).
 * Chép lại ở chỗ thứ hai là mở đường cho hai nơi xếp cùng một người vào hai vị trí khác nhau.
 *
 * <p>Trả `null` khi tài khoản không có bảng nào — quản trị nền tảng, hoặc thiếu mọi quyền xem.
 */
export function useViewerPosition(): ViewerPosition | null {
  const { hasPermission } = useHasPermission()
  const user = useAuthStore(s => s.user)

  if (user?.isPlatformAdmin) return null

  /**
   * Role.rank: 0 = trưởng đơn vị, 1 = phó, 2 = nhân viên. Phó có gần hết quyền của trưởng nên
   * nếu chỉ xét quyền thì họ rơi vào bảng trưởng đơn vị và thấy dữ liệu toàn đơn vị.
   */
  const isDeputy = (user?.memberships ?? []).some(m => m.roleRank === 1)

  if (hasPermission(['ORG:VIEW', 'USER:VIEW', 'ROLE:VIEW'], true)) return 'DIRECTOR'
  // Phó đơn vị xét TRƯỚC trưởng đơn vị vì quyền của hai vai gần như trùng nhau
  if (isDeputy) return 'DEPUTY'
  if (hasPermission(['SUBMISSION:REVIEW', 'USER:VIEW_LIST'])) return 'HEAD'
  if (hasPermission('KPI:VIEW_MY')) return 'STAFF'

  return null
}
