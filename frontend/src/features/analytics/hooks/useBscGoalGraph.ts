import { useQuery } from '@tanstack/react-query'
import { bscGoalGraphApi, type GoalGraphParams } from '../api/bscGoalGraphApi'
import type { BscScopeParams } from '../api/bscAnalyticsApi'

/**
 * Đồ thị mục tiêu dùng chung cho bản đồ chiến lược, cây liên kết và xương cá.
 *
 * <p>Khoá truy vấn giống nhau nên ba ô cùng trên một trang chỉ gọi mạng MỘT lần — và quan trọng
 * hơn: ba hình luôn vẽ từ đúng một bộ số.
 */
export function useBscGoalGraph(params: GoalGraphParams) {
  return useQuery({
    queryKey: ['analytics', 'bsc', 'goal-graph', params],
    queryFn: () => bscGoalGraphApi.getGoalGraph(params),
    placeholderData: previous => previous,
  })
}

/**
 * Đơn vị / người / KPI đóng góp vào một mục tiêu. Chỉ gọi khi người dùng thực sự mở một mục tiêu
 * ({@code enabled}), vì mỗi lần bung một nút trên cây là một lời gọi.
 */
export function useBscObjectiveContributors(itemId: string | null, params: BscScopeParams) {
  return useQuery({
    queryKey: ['analytics', 'bsc', 'goal-contributors', itemId, params],
    queryFn: () => bscGoalGraphApi.getContributors(itemId as string, params),
    enabled: !!itemId,
    placeholderData: previous => previous,
  })
}
