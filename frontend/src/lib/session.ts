import { queryClient } from '@/lib/queryClient'
import { clearAllDrafts } from '@/lib/formDraft'
import { useAiAssistantStore } from '@/store/aiAssistantStore'
import { usePinnedFilesStore } from '@/store/pinnedFilesStore'
import type { UserInfo } from '@/types/auth'

/** Tổ chức đang làm việc của người dùng — mọi API theo tổ chức đọc từ đây (qua store), không lưu riêng. */
export function orgIdOf(user: UserInfo | null | undefined): string | undefined {
  return user?.memberships?.[0]?.organizationId
}

/**
 * Được gọi API cây đơn vị (`/organizations/{orgId}/units/tree|subtree`) không — khớp
 * `@PreAuthorize("hasAnyAuthority('ORG:VIEW', 'ORG:VIEW_TREE')")` của OrgUnitController. Nhân viên thường
 * không có hai quyền này: gọi vẫn 403, chỉ làm bẩn log và bắn lỗi lên màn hình.
 */
export function canViewOrgTree(user: UserInfo | null | undefined): boolean {
  const perms = user?.permissions ?? []
  return perms.includes('ORG:VIEW') || perms.includes('ORG:VIEW_TREE')
}

/** Đăng nhập được nhưng chưa thuộc tổ chức nào: không gọi API theo tổ chức, đưa sang màn hướng dẫn. */
export function needsOrganization(user: UserInfo | null | undefined): boolean {
  if (!user || user.isPlatformAdmin) return false
  return user.needsOrganization ?? !(user.memberships?.length)
}

/**
 * Dọn MỌI trạng thái gắn với người dùng trong bộ nhớ trình duyệt — trừ chính hồ sơ đăng nhập
 * (authStore tự đặt). Gọi khi đăng xuất, khi refresh token hỏng, khi đăng nhập (phiên mới) và khi
 * phát hiện người dùng đã đổi (tab khác đăng nhập tài khoản khác, /auth/me trả người khác).
 *
 * Không làm thì tài khoản B thấy dữ liệu cache của A (tên công ty trên header) và các query còn
 * đang chạy gọi API theo orgId của A bằng cookie của B → 403 hàng loạt.
 */
export function clearUserScopedState({ keepDrafts = false }: { keepDrafts?: boolean } = {}) {
  queryClient.cancelQueries()
  queryClient.clear()
  if (!keepDrafts) clearAllDrafts() // nháp form có thể chứa dữ liệu nhạy cảm — không để lại cho người dùng máy sau
  useAiAssistantStore.setState({ pending: null })
  usePinnedFilesStore.getState().clear()
  // Import động: uploadStore → upload → axios → authStore → (file này) sẽ thành vòng import tĩnh.
  // Huỷ tệp đang tải dở để nó không tiếp tục gửi lên bằng phiên của người dùng mới.
  void import('@/store/uploadStore').then(({ useUploadStore }) => {
    const { tasks, removeTask } = useUploadStore.getState()
    tasks.forEach(t => removeTask(t.id))
  })
}
