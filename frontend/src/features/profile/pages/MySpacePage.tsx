import SettingsSectionLayout from '@/components/common/SettingsSectionLayout'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useNotificationDots } from '@/hooks/useNotificationDots'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'
import MyKpiPage from '@/features/kpi/pages/MyKpiPage'
import MyOkrPage from '@/features/okr/pages/MyOkrPage'
import MyBscPage from '@/features/bsc/pages/MyBscPage'
import MyAdjustmentsPage from '@/features/kpi/pages/MyAdjustmentsPage'
import MySubmissionsPage from '@/features/submissions/pages/MySubmissionsPage'
import EvaluationsPage from '@/features/evaluations/pages/EvaluationsPage'
import MyRewardsPage from '@/features/rewards/pages/MyRewardsPage'
import MyWalletPage from '@/features/wallet/pages/MyWalletPage'
import MyConductPage from '@/features/conduct/pages/MyConductPage'
import MyF360Page from '@/features/feedback360/pages/MyF360Page'
import { useTranslation } from 'react-i18next'

/**
 * Không gian cá nhân: công việc của chính mình và ví của chính mình. Trước đây là hai
 * nhóm sidebar tách rời với sáu dòng con.
 *
 * Ví vẫn là một cụm RIÊNG trong trang chứ không trộn vào cụm công việc — số dư điểm và
 * số dư tiền là hai thứ khác nhau, để lẫn với danh sách KPI là người dùng nhìn nhầm.
 */
export default function MySpacePage() {
  const { t } = useTranslation('profile')
  const pageTitle = usePageTitle('my-space', t('MySpacePage.mine'))
  const { counts } = useNotificationDots()
  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)

  return (
    <>
      <SettingsSectionLayout
        navId="my-space"
        title={pageTitle}
        subtitle={t('MySpacePage.yourOwnKpisSubmissionsEvaluationResults')}
        sections={[
          // Chỉ những mục có việc TỒN mới mang badge. "Đánh giá của tôi", "Điều chỉnh của
          // tôi" và "Hạnh kiểm của tôi" là nơi xem kết quả hoặc đang chờ người khác xử lý,
          // gắn số vào chỉ tổ nhiễu.
          {
            id: 'my-kpi',
            badge: counts.myPendingTasks || null,
            render: () => <MyKpiPage />,
          },
          { id: 'my-okr', visible: org?.enableOkr ?? false, render: () => <MyOkrPage /> },
          { id: 'my-bsc', visible: org?.enableBsc ?? false, render: () => <MyBscPage /> },
          {
            id: 'my-submissions',
            badge: counts.myRejectedSubmissions || null,
            render: () => <MySubmissionsPage />,
          },
          { id: 'evaluations', render: () => <EvaluationsPage /> },
          { id: 'my-adjustments', render: () => <MyAdjustmentsPage /> },
          { id: 'my-conduct', visible: org?.enableConduct ?? false, render: () => <MyConductPage /> },
          { id: 'my-feedback360', visible: org?.enableFeedback360 ?? false, render: () => <MyF360Page /> },
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
