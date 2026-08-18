import { useState } from 'react'
import { ScrollText, Settings, Wallet } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
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

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; badge?: number; visible: boolean }[] =
    [
      { key: 'wallets', label: 'Số dư nhân sự', icon: <Wallet size={16} />, visible: canView },
      { key: 'config', label: 'Cấu hình', icon: <Settings size={16} />, visible: canConfig },
      {
        key: 'reconcile',
        label: 'Đối soát SePay',
        icon: <ScrollText size={16} />,
        badge: pending || undefined,
        visible: canReconcile,
      },
    ]

  const visibleTabs = tabs.filter((t) => t.visible)
  const [tab, setTab] = useState<TabKey>(visibleTabs[0]?.key ?? 'wallets')
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : visibleTabs[0]?.key

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="Quản lý ví tiền"
        description="Số dư của nhân sự, tỉ giá quy đổi và đối soát giao dịch chuyển khoản"
      />

      <div className="mb-6 mt-6 flex flex-wrap gap-1 sm:border-b sm:border-[var(--color-border)]">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:-mb-px sm:gap-2 sm:px-4 sm:py-3 ${
              activeTab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge != null && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'wallets' && <CashWalletsTab />}
      {activeTab === 'config' && <WalletConfigForm />}
      {activeTab === 'reconcile' && <SepayEventsTab />}
    </div>
  )
}
