import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import { adjustmentApi } from '@/features/kpi/api/adjustmentApi'
import { bscApi } from '@/features/bsc/api/bscApi'
import { rewardApi } from '@/features/rewards/api/rewardApi'
import { giftApi } from '@/features/rewards/api/giftApi'
import { walletApi } from '@/features/wallet/api/walletApi'
import { BscScorecardStatus } from '@/features/bsc/types'
import { RewardGrantStatus, RedemptionStatus } from '@/features/rewards/types'
import { TopupOrderStatus } from '@/features/wallet/types'
import { useAuthStore } from '@/store/authStore'
import { useHasPermission } from '@/components/auth/PermissionGate'

export interface NotificationCounts {
  pendingKpis: number
  pendingSubmissions: number
  pendingAdjustments: number
  myPendingTasks: number
  /** Bài nộp của mình bị trả lại — phải sửa và nộp lại. */
  myRejectedSubmissions: number
  /** Yêu cầu đổi quà của mình còn treo, chưa ai xử lý. */
  myPendingRedemptions: number
  /** Đơn nạp tiền của mình chưa hoàn tất. */
  myPendingTopups: number
  /** Bộ tiêu chí BSC cấp dưới trình lên đang chờ duyệt. */
  pendingScorecards: number
  /** Đề nghị thưởng chờ duyệt + yêu cầu đổi quà chờ xử lý. */
  pendingRewards: number
  /** Giao dịch SePay chưa khớp hoặc lệch số tiền, đang chờ đối soát. */
  pendingWallet: number
}

export function useNotificationDots() {
  const { user } = useAuthStore()
  const { hasPermission } = useHasPermission()

  // Đơn vị phụ trách của người dùng — lấy giống Dashboard (ưu tiên membership có levelOrder > 0).
  const primaryMembership = useMemo(() => {
    const ms = user?.memberships || []
    if (ms.length <= 1) return ms[0]
    return ms.find(m => (m.levelOrder ?? 0) > 0) || ms[0]
  }, [user?.memberships])

  const organizationId = user?.memberships?.[0]?.organizationId
  const orgUnitId = primaryMembership?.orgUnitId

  const { data: overviewAllUnits } = useQuery({
    queryKey: ['stats', 'overview', organizationId, undefined],
    queryFn: () => statsApi.getOverview(organizationId),
    enabled: !!user && !!organizationId && hasPermission('KPI:APPROVE_CRITERIA'),
    refetchInterval: 60000,
  })

  const { data: overviewMyUnit } = useQuery({
    queryKey: ['stats', 'overview', organizationId, orgUnitId],
    queryFn: () => statsApi.getOverview(organizationId, orgUnitId),
    enabled: !!user && !!organizationId && hasPermission('SUBMISSION:REVIEW'),
    refetchInterval: 60000,
  })

  // 2. Fetch Pending Adjustments (for Managers/Directors)
  const { data: adjustments } = useQuery({
    queryKey: ['kpi-adjustments', 'pending-count', user?.id],
    queryFn: () => adjustmentApi.getAll({ status: 'PENDING', size: 1 }),
    enabled: !!user && hasPermission('KPI:APPROVE_ADJUSTMENT'),
    refetchInterval: 60000,
  })

  // 3. Fetch My Progress (for Staff/All)
  const { data: myProgress } = useQuery({
    queryKey: ['stats', 'my-progress', user?.id],
    queryFn: () => statsApi.getMyProgress(0, 1),
    enabled: !!user,
    refetchInterval: 60000,
  })

  // 4. Hàng chờ trong trang "Của tôi" mà `myProgress` không nói được.
  //
  // Khoá trùng khoá của `useMyRedemptions(0, 50)` và `useMyTopups(0, 50)` để badge và
  // trang dùng chung một lượt tải. Phải đếm tại chỗ chứ không hỏi `totalElements`: hai
  // API này không lọc theo trạng thái, mà tổng số đơn thì không phải việc đang treo.
  const { data: myRedemptions } = useQuery({
    queryKey: ['redemptions', 'me', 0, 50],
    queryFn: () => giftApi.getMyRedemptions(0, 50),
    enabled: !!user && hasPermission('GIFT:REDEEM'),
    refetchInterval: 60000,
  })

  const { data: myTopups } = useQuery({
    queryKey: ['topupOrders', 'me', 0, 50],
    queryFn: () => walletApi.getMyTopups(0, 50),
    enabled: !!user && hasPermission('WALLET:VIEW_MY'),
    refetchInterval: 60000,
  })

  // 5. Hàng chờ của ba công cụ trong "Thiết lập công cụ".
  //
  // Khoá truy vấn cố ý TRÙNG với khoá các trang công cụ dùng (`useScorecards`,
  // `useRewardGrants`, `useRedemptions`, `useWalletReconcile`) — nhờ vậy badge và trang
  // dùng chung một lượt tải, mở trang không phải gọi lại.
  const { data: scorecards } = useQuery({
    queryKey: ['bsc-scorecards', organizationId],
    queryFn: () => bscApi.getScorecards(organizationId!),
    enabled: !!organizationId && hasPermission('BSC:APPROVE'),
    refetchInterval: 60000,
  })

  const { data: pendingGrants } = useQuery({
    queryKey: ['rewardGrants', { status: RewardGrantStatus.PENDING_APPROVAL, size: 1 }],
    queryFn: () => rewardApi.getGrants({ status: RewardGrantStatus.PENDING_APPROVAL, size: 1 }),
    enabled: !!user && hasPermission('REWARD:APPROVE'),
    refetchInterval: 60000,
  })

  const { data: pendingRedemptions } = useQuery({
    queryKey: ['redemptions', 'manage', { status: RedemptionStatus.PENDING, size: 1 }],
    queryFn: () => giftApi.getRedemptions({ status: RedemptionStatus.PENDING, size: 1 }),
    enabled: !!user && hasPermission('GIFT:FULFILL'),
    refetchInterval: 60000,
  })

  const { data: reconcile } = useQuery({
    queryKey: ['walletReconcile'],
    queryFn: () => walletApi.reconcile(),
    enabled: !!user && hasPermission('WALLET:RECONCILE'),
    refetchInterval: 60000,
  })

  const counts: NotificationCounts = {
    pendingKpis: overviewAllUnits?.pendingKpiForApproval || 0,
    pendingSubmissions: overviewMyUnit?.pendingSubmissions || 0,
    pendingAdjustments: adjustments?.totalElements || 0,
    myPendingTasks: myProgress?.pendingTaskCount || 0,
    myRejectedSubmissions: myProgress?.rejectedSubmissions || 0,
    myPendingRedemptions: (myRedemptions?.content || [])
      .filter(r => r.status === RedemptionStatus.PENDING).length,
    myPendingTopups: (myTopups?.content || [])
      .filter(t => t.status === TopupOrderStatus.PENDING).length,
    pendingScorecards: (scorecards || []).filter(sc => sc.status === BscScorecardStatus.SUBMITTED).length,
    pendingRewards: (pendingGrants?.totalElements || 0) + (pendingRedemptions?.totalElements || 0),
    pendingWallet: reconcile ? reconcile.unresolvedEventCount + reconcile.amountMismatchCount : 0,
  }

  return { counts }
}
