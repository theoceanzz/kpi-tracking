import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'

/**
 * Người dùng này có dùng được K.AI không — cùng một phép tính cho bong bóng chat và cho mọi nút
 * "K.AI" đặt trên trang, để hai bên không bao giờ lệch nhau (nút hiện mà bấm vào không có gì mở).
 *
 * <p>Điều kiện: thuộc ít nhất một đơn vị (backend nhận cả nhân viên từ 18/09/2026 — chỉ người chưa
 * được phân công là không có gì để hỏi) và tổ chức chưa tắt AI. Đang tải thông tin tổ chức thì coi
 * như bật, để nút không nhấp nháy khi vào trang.
 */
export function useAiAvailable(): boolean {
  const user = useAuthStore(s => s.user)
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const hasMembership = (user?.memberships?.length ?? 0) > 0
  return hasMembership && org?.enableAi !== false
}
