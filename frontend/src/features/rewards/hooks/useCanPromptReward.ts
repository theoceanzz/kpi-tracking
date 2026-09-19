import { useHasPermission } from '@/components/auth/PermissionGate'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'

/**
 * Có nên mời thưởng điểm ngay sau khi chấm xong hay không.
 *
 * <p>`RewardPrompt` tự ẩn khi tổ chức tắt thưởng hoặc người chấm không có quyền trao —
 * nhưng khi ẩn thì nó không bao giờ gọi `onDone`, nên màn hình cha chờ nó để đóng sẽ
 * đứng im mãi. Chỗ gọi hỏi hook này TRƯỚC: mời được thì hiện lời mời, không thì đóng
 * luôn như khi chưa có tính năng thưởng.
 */
export function useCanPromptReward(): boolean {
  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId ?? '')
  const { hasPermission } = useHasPermission()
  return org?.enableReward === true && hasPermission('REWARD:GRANT')
}
