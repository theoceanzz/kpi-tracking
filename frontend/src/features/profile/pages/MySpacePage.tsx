import SettingsSectionLayout from '@/components/common/SettingsSectionLayout'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useNotificationDots } from '@/hooks/useNotificationDots'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'
import MyKpiPage from '@/features/kpi/pages/MyKpiPage'
import MyAdjustmentsPage from '@/features/kpi/pages/MyAdjustmentsPage'
import MySubmissionsPage from '@/features/submissions/pages/MySubmissionsPage'
import EvaluationsPage from '@/features/evaluations/pages/EvaluationsPage'
import MyRewardsPage from '@/features/rewards/pages/MyRewardsPage'
import MyWalletPage from '@/features/wallet/pages/MyWalletPage'
import MyConductPage from '@/features/conduct/pages/MyConductPage'

/**
 * Không gian cá nhân: công việc của chính mình và ví của chính mình. Trước đây là hai
 * nhóm sidebar tách rời với sáu dòng con.
 *
 * Ví vẫn là một cụm RIÊNG trong trang chứ không trộn vào cụm công việc — số dư điểm và
 * số dư tiền là hai thứ khác nhau, để lẫn với danh sách KPI là người dùng nhìn nhầm.
 */
export default function MySpacePage() {
  const pageTitle = usePageTitle('my-space', 'Của tôi')
  const { counts } = useNotificationDots()
  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)

  return (
    <>
      <SettingsSectionLayout
        navId="my-space"
        title={pageTitle}
        subtitle="Chỉ tiêu, bài nộp, kết quả đánh giá và ví của riêng bạn"
        sections={[
          // Chỉ những mục có việc TỒN mới mang badge. "Đánh giá của tôi", "Điều chỉnh của
          // tôi" và "Hạnh kiểm của tôi" là nơi xem kết quả hoặc đang chờ người khác xử lý,
          // gắn số vào chỉ tổ nhiễu.
          {
            id: 'my-kpi',
            badge: counts.myPendingTasks || null,
            render: () => <MyKpiPage />,
          },
          {
            id: 'my-submissions',
            badge: counts.myRejectedSubmissions || null,
            render: () => <MySubmissionsPage />,
          },
          { id: 'evaluations', render: () => <EvaluationsPage /> },
          { id: 'my-adjustments', render: () => <MyAdjustmentsPage /> },
          { id: 'my-conduct', visible: org?.enableConduct ?? false, render: () => <MyConductPage /> },
          {
            id: 'my-rewards',
            visible: org?.enableReward ?? false,
            badge: counts.myPendingRedemptions || null,
            render: () => <MyRewardsPage />,
          },
          {
            id: 'my-cash-wallet',
            visible: org?.enableCashWallet ?? false,
            badge: counts.myPendingTopups || null,
            render: () => <MyWalletPage />,
          },
        ]}
      />
    </>
  )
}
