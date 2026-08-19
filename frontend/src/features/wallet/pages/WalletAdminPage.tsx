import { ScrollText, Settings, Wallet } from 'lucide-react'
import { useTabParam } from '@/hooks/useTabParam'
import { WorkspaceTabsProvider } from '@/components/common/WorkspaceTabs'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { useHasPermission } from '@/components/auth/PermissionGate'
import CashWalletsTab from '../components/CashWalletsTab'
import SepayEventsTab from '../components/SepayEventsTab'
import WalletConfigForm from '../components/WalletConfigForm'
import { useWalletReconcile } from '../hooks/useWallet'

type TabKey = 'wallets' | 'config' | 'reconcile'

export default function WalletAdminPage() {
  const { hasPermission } = useHasPermission()
  const canView = hasPermission('WALLET:VIEW')
  const canConfig = hasPermission('WALLET:CONFIG')
  const canReconcile = hasPermission('WALLET:RECONCILE')

  // Huy hiệu số lượng để không ai phải nhớ vào xem hàng đợi mới biết có việc.
  const { data: reconcile } = useWalletReconcile(canReconcile)
  const pending = reconcile
    ? reconcile.unresolvedEventCount + reconcile.amountMismatchCount
    : 0

  const { activeTab, setActiveTab, visibleTabs } = useTabParam<TabKey>([
    { key: 'wallets', label: 'Số dư nhân sự', icon: Wallet, visible: canView },
    { key: 'config', label: 'Cấu hình', icon: Settings, visible: canConfig },
    {
      key: 'reconcile',
      label: 'Đối soát SePay',
      icon: ScrollText,
      badge: pending || undefined,
      visible: canReconcile,
    },
  ])

  return (
    <WorkspaceTabsProvider
      tabs={visibleTabs}
      activeTab={activeTab}
      setActiveTab={key => setActiveTab(key as TabKey)}
    >
      <div className="space-y-5">
        <WorkspaceHeader description="Số dư của nhân sự, tỉ giá quy đổi và đối soát giao dịch chuyển khoản." />

        {activeTab === 'wallets' && <CashWalletsTab />}
        {activeTab === 'config' && <WalletConfigForm />}
        {activeTab === 'reconcile' && <SepayEventsTab />}
      </div>
    </WorkspaceTabsProvider>
  )
}
