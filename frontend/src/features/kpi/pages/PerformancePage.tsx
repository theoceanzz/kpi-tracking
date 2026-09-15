import SettingsSectionLayout from '@/components/common/SettingsSectionLayout'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useNotificationDots } from '@/hooks/useNotificationDots'
import KpiCriteriaPage from './KpiCriteriaPage'
import KpiApprovalPage from './KpiApprovalPage'
import KpiAdjustmentApprovalPage from './KpiAdjustmentApprovalPage'
import CycleEvaluationPage from './CycleEvaluationPage'
import OrgUnitSubmissionsPage from '@/features/submissions/pages/OrgUnitSubmissionsPage'

/**
 * Vận hành KPI trong một trang: đặt chỉ tiêu, duyệt chỉ tiêu, xử lý điều chỉnh, rồi
 * đánh giá theo đợt và theo kỳ. Trước đây là năm dòng sidebar.
 *
 * Khác hai trang thiết lập ở một điểm: các mục ở đây có hàng chờ việc, nên số việc
 * cần xử lý phải theo lên tận thẻ và tab — bỏ đi là quản lý mất tín hiệu nhắc việc.
 */
export default function PerformancePage() {
  const pageTitle = usePageTitle('performance', 'Quản lý hiệu suất')
  const { counts } = useNotificationDots()

  return (
    <>
      <SettingsSectionLayout
        navId="performance"
        title={pageTitle}
        subtitle="Đặt chỉ tiêu, phê duyệt và chấm điểm theo từng đợt, từng kỳ"
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
        ]}
      />
    </>
  )
}
