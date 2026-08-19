import { Wrench } from 'lucide-react'
import SettingsSectionLayout from '@/components/common/SettingsSectionLayout'
import PageTour from '@/components/common/PageTour'
import { toolConfigSteps } from '@/components/common/tourSteps'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '../hooks/useOrganization'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { ModuleTogglesSection } from '../components/ModuleSections'
import { PerformanceMatrixSection } from '../components/ScoringSections'
import ScoringSettingsPage from './ScoringSettingsPage'
import UnitClassificationConfigSection from '../components/UnitClassificationConfigSection'
import KpiCyclePeriodPage from '@/features/kpi/pages/KpiCyclePeriodPage'
import OkrManagementPage from '@/features/okr/pages/OkrManagementPage'
import BscWorkspace from '@/features/bsc/components/BscWorkspace'
import RewardManagementPage from '@/features/rewards/pages/RewardManagementPage'
import WalletAdminPage from '@/features/wallet/pages/WalletAdminPage'
import AiQuotaPage from '@/features/organization/pages/AiQuotaPage'

/**
 * Thiết lập công cụ: các bảng cấu hình của tổ chức, cộng sáu công cụ quản lý mà trước
 * đây mỗi cái chiếm một dòng sidebar. Cùng khuôn với trang "Thiết lập công ty" —
 * lưới thẻ khi vào, mở một thẻ thì công cụ được trọn chiều cao.
 */
export default function ToolSettingsPage() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org, isLoading } = useOrganization(orgId)
  const pageTitle = usePageTitle('setup-tools', 'Thiết lập công cụ')

  // Thang định tính và ma trận chỉ có nghĩa khi tổ chức bật KPI hành vi.
  const enableQualitative = org?.enableQualitative ?? false

  if (isLoading) return <div className="p-8 max-w-6xl mx-auto"><LoadingSkeleton rows={8} /></div>
  if (!org) return null

  return (
    <>
      <PageTour pageKey="tool-config" steps={toolConfigSteps} />
      <SettingsSectionLayout
        navId="setup-tools"
        title={pageTitle}
        subtitle="Tổ chức dùng những công cụ nào, chấm điểm ra sao, và nơi vận hành từng công cụ"
        eyebrow={
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 text-xs font-black uppercase tracking-widest mb-3">
            <Wrench size={14} /> Thiết lập
          </div>
        }
        sections={[
          {
            id: 'modules',
            render: () => (
              // Ràng bề ngang: đây là danh sách công tắc, mỗi dòng chỉ có tên và một câu
              // mô tả. Kéo hết 1600px thì công tắc nằm cách tên cả nghìn pixel.
              <div id="tour-modules-grid" className="max-w-4xl">
                <ModuleTogglesSection org={org} />
              </div>
            ),
          },
          {
            id: 'scoring',
            render: () => <ScoringSettingsPage org={org} enableQualitative={enableQualitative} />,
          },
          { id: 'matrix', visible: enableQualitative, render: () => <PerformanceMatrixSection org={org} /> },
          { id: 'unit-class', render: () => <UnitClassificationConfigSection org={org} /> },

          // Sáu công cụ quản lý. Cờ tính năng lấy từ chính tổ chức, khớp với cách
          // sidebar vẫn ẩn/hiện chúng trước đây.
          { id: 'kpi-cycles', render: () => <KpiCyclePeriodPage /> },
          { id: 'okr', visible: org.enableOkr ?? false, render: () => <OkrManagementPage /> },
          { id: 'bsc', visible: org.enableBsc ?? false, render: () => <BscWorkspace /> },
          { id: 'rewards', visible: org.enableReward ?? false, render: () => <RewardManagementPage /> },
          { id: 'wallet', visible: org.enableCashWallet ?? false, render: () => <WalletAdminPage /> },
          { id: 'ai-quota', visible: org.enableAi !== false, render: () => <AiQuotaPage /> },
        ]}
      />
    </>
  )
}
