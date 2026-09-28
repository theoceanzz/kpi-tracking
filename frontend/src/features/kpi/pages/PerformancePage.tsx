import SettingsSectionLayout from '@/components/common/SettingsSectionLayout'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useNotificationDots } from '@/hooks/useNotificationDots'
import KpiCriteriaPage from './KpiCriteriaPage'
import KpiApprovalPage from './KpiApprovalPage'
import KpiAdjustmentApprovalPage from './KpiAdjustmentApprovalPage'
import CycleEvaluationPage from './CycleEvaluationPage'
import OrgUnitSubmissionsPage from '@/features/submissions/pages/OrgUnitSubmissionsPage'
import F360AdminPage from '@/features/feedback360/pages/F360AdminPage'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'
import { useTranslation } from 'react-i18next'

/**
 * Vận hành KPI trong một trang: đặt chỉ tiêu, duyệt chỉ tiêu, xử lý điều chỉnh, rồi
 * đánh giá theo đợt và theo kỳ. Trước đây là năm dòng sidebar.
 *
 * Khác hai trang thiết lập ở một điểm: các mục ở đây có hàng chờ việc, nên số việc
 * cần xử lý phải theo lên tận thẻ và tab — bỏ đi là quản lý mất tín hiệu nhắc việc.
 */
export default function PerformancePage() {
  const { t } = useTranslation('kpi')
  const pageTitle = usePageTitle('performance', t('PerformancePage.performanceManagement'))
  const { counts } = useNotificationDots()
  const orgId = useAuthStore(s => s.user?.memberships?.[0]?.organizationId)
  const { data: org } = useOrganization(orgId)

  return (
    <>
      <SettingsSectionLayout
        navId="performance"
        title={pageTitle}
        subtitle={t('PerformancePage.setKpisApproveAndScoreBy')}
        sections={[
          { id: 'kpi-criteria', render: () => <KpiCriteriaPage /> },
          {
            id: 'kpi-criteria-pending',
            badge: counts.pendingKpis > 0 ? counts.pendingKpis : null,
            render: () => <KpiApprovalPage />,
          },
          {
            id: 'kpi-adjustments-pending',
            badge: counts.pendingAdjustments > 0 ? counts.pendingAdjustments : null,
            render: () => <KpiAdjustmentApprovalPage />,
          },
          {
            id: 'submissions-org-unit',
            badge: counts.pendingSubmissions > 0 ? counts.pendingSubmissions : null,
            render: () => <OrgUnitSubmissionsPage />,
          },
          { id: 'cycle-evaluation', render: () => <CycleEvaluationPage /> },
          { id: 'feedback360', visible: org?.enableFeedback360 ?? false, render: () => <F360AdminPage /> },
        ]}
      />
    </>
  )
}
