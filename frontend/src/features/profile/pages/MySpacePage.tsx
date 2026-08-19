import { UserCircle } from 'lucide-react'
import SettingsSectionLayout from '@/components/common/SettingsSectionLayout'
import PageTour from '@/components/common/PageTour'
import { mySpaceSteps } from '@/components/common/tourSteps'
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
      <PageTour pageKey="my-space" steps={mySpaceSteps} />
      <SettingsSectionLayout
        navId="my-space"
        title={pageTitle}
        subtitle="Chỉ tiêu, bài nộp, kết quả đánh giá và ví của riêng bạn"
        eyebrow={
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 text-xs font-black uppercase tracking-widest mb-3">
            <UserCircle size={14} /> Cá nhân
          </div>
        }
        sections={[
          {
            id: 'my-kpi',
            badge: counts.myPendingTasks > 0 ? true : null,
            render: () => <MyKpiPage />,
          },
          { id: 'my-submissions', render: () => <MySubmissionsPage /> },
          { id: 'evaluations', render: () => <EvaluationsPage /> },
          { id: 'my-adjustments', render: () => <MyAdjustmentsPage /> },
          { id: 'my-rewards', visible: org?.enableReward ?? false, render: () => <MyRewardsPage /> },
          { id: 'my-cash-wallet', visible: org?.enableCashWallet ?? false, render: () => <MyWalletPage /> },
        ]}
      />
    </>
  )
}
