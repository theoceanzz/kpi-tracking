import { Inbox, Send, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTabParam } from '@/hooks/useTabParam'
import { useTourScope } from '@/hooks/useTourScope'
import { WorkspaceTabsProvider } from '@/components/common/WorkspaceTabs'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useFormCatalog, useRequestCounts } from '../hooks/useApprovalForms'
import SubmitTab from '../components/submit/SubmitTab'
import StatusTab from '../components/status/StatusTab'
import AdminTab from '../components/admin/AdminTab'

type TabKey = 'submit' | 'status' | 'admin'

/**
 * Đơn từ (Lark Approval): Nộp đơn · Trạng thái đơn · Quản trị. Tab Quản trị chỉ hiện với người có
 * APPROVAL_FORM:MANAGE hoặc đang quản lý ít nhất một đơn (`catalog.canAdmin`).
 */
export default function RequestsPage() {
  const { t } = useTranslation('approvalForms')
  useTourScope('requests')
  const { data: catalog, isLoading } = useFormCatalog()
  const { data: counts } = useRequestCounts()

  // Lúc danh mục chưa về vẫn coi tab Quản trị là có — nếu không, link `?tab=admin` bị ghi đè về tab đầu trước khi biết
  // người xem có quyền. Hàng tab thì chỉ vẽ Quản trị khi đã chắc chắn.
  const { activeTab, setActiveTab, visibleTabs } = useTabParam<TabKey>([
    { key: 'submit', label: t('tabs.submit'), icon: Send },
    { key: 'status', label: t('tabs.status'), icon: Inbox, badge: counts?.todo },
    { key: 'admin', label: t('tabs.admin'), icon: Settings2, visible: catalog?.canAdmin ?? true },
  ])
  const shownTabs = visibleTabs.filter((tab) => tab.key !== 'admin' || catalog?.canAdmin)

  return (
    <TooltipProvider delayDuration={200}>
      <WorkspaceTabsProvider tabs={shownTabs} activeTab={activeTab} setActiveTab={(key) => setActiveTab(key as TabKey)}>
        {activeTab === 'submit' && <SubmitTab onSubmitted={() => setActiveTab('status')} />}
        {activeTab === 'status' && <StatusTab />}
        {activeTab === 'admin' && (isLoading ? <LoadingSkeleton type="table" rows={6} /> : <AdminTab />)}
      </WorkspaceTabsProvider>
    </TooltipProvider>
  )
}
