import { useState } from 'react'
import { Coins, History, Plus, Receipt } from 'lucide-react'
import { useTabParam } from '@/hooks/useTabParam'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { WorkspaceTabsProvider } from '@/components/common/WorkspaceTabs'
import { Button } from '@/components/ui/button'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import CashBalanceCard from '../components/CashBalanceCard'
import CashLedgerTable from '../components/CashLedgerTable'
import ConvertPointsCard from '../components/ConvertPointsCard'
import TopupHistoryTable from '../components/TopupHistoryTable'
import TopupModal from '../components/TopupModal'
import {
  useMyCashTransactions,
  useMyCashWallet,
  useMyTopups,
  useTopupConfig,
} from '../hooks/useWallet'
import type { TopupOrder } from '../types'
import { useTranslation } from 'react-i18next'

type TabKey = 'convert' | 'topups' | 'history'

export default function MyWalletPage() {
  const { t } = useTranslation('wallet')
  const [page, setPage] = useState(0)
  const [topupOpen, setTopupOpen] = useState(false)
  // Đơn đang mở lại để chuyển khoản tiếp. null = tạo đơn mới.
  const [resumeOrder, setResumeOrder] = useState<TopupOrder | null>(null)
  const size = 20

  const { data: wallet, isLoading: walletLoading } = useMyCashWallet()
  const { data: txPage, isLoading: txLoading } = useMyCashTransactions(page, size)
  const { data: topupPage, isLoading: topupsLoading } = useMyTopups(0, 50)

  // Hạn mức nạp tối thiểu/tối đa cho hộp thoại nạp tiền, suy từ ví khi người dùng
  // không có quyền đọc cấu hình.
  const modalConfig = useTopupConfig(wallet)

  const transactions = txPage?.content ?? []
  const topups = topupPage?.content ?? []

  // Tab lưu ở URL (`?wallet=`) chứ không phải state cục bộ — xem ghi chú cùng loại ở
  // MyRewardsPage. Tên tham số riêng để không đụng các mục khác trong trang "Của tôi".
  const { activeTab, setActiveTab, visibleTabs } = useTabParam<TabKey>(
    [
      { key: 'convert', label: t('MyWalletPage.convertToPoints'), icon: Coins },
      {
        key: 'topups',
        label: t('MyWalletPage.topUpOrders'),
        icon: Receipt,
        badge: topupPage?.totalElements || undefined,
      },
      {
        key: 'history',
        label: t('MyWalletPage.walletHistory'),
        icon: History,
        badge: txPage?.totalElements || undefined,
      },
    ],
    { param: 'wallet' }
  )
  return (
    <WorkspaceTabsProvider tabs={visibleTabs} activeTab={activeTab} setActiveTab={key => setActiveTab(key as TabKey)}>
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-my-wallet-header"
        title={t('MyWalletPage.myWallet')}
        description={t('MyWalletPage.topUpConvertToRewardPoints')}
        actions={
          <Button id="tour-my-wallet-topup" onClick={() => { setResumeOrder(null); setTopupOpen(true) }}>
            <Plus aria-hidden="true" /> {t('MyWalletPage.topUp')}
          </Button>
        }
      />

      <div id="tour-my-wallet-balance">
        <CashBalanceCard wallet={wallet} loading={walletLoading} />
      </div>

      {activeTab === 'convert' && (
        <div id="tour-my-wallet-convert">
          <ConvertPointsCard wallet={wallet} />
        </div>
      )}

      {activeTab === 'topups' && (
        <div id="tour-my-wallet-topups">
          {topupsLoading ? (
            <LoadingSkeleton type="table" rows={3} />
          ) : topups.length === 0 ? (
            <div className="rounded-card border border-dashed border-[var(--color-border)]">
              <EmptyState
                title={t('MyWalletPage.noTopUpOrdersYet')}
                description={t('MyWalletPage.clickTopUpInTheTop')}
              />
            </div>
          ) : (
            <TopupHistoryTable
              data={topups}
              onResume={(order) => {
                setResumeOrder(order)
                setTopupOpen(true)
              }}
            />
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div id="tour-my-wallet-history">
          {txLoading ? (
            <LoadingSkeleton type="table" rows={4} />
          ) : transactions.length === 0 ? (
            <div className="rounded-card border border-dashed border-[var(--color-border)]">
              <EmptyState
                title={t('MyWalletPage.noTransactionsYet')}
                description={t('MyWalletPage.everyTopUpOrPointConversion')}
              />
            </div>
          ) : (
            <>
              <CashLedgerTable data={transactions} />
              {(txPage?.totalPages ?? 0) > 1 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={page}
                    totalPages={txPage?.totalPages ?? 0}
                    totalElements={txPage?.totalElements ?? 0}
                    size={size}
                    onPageChange={setPage}
                    itemLabel={t('MyWalletPage.transactions')}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      <TopupModal
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        config={modalConfig}
        resumeOrder={resumeOrder}
      />
    </div>
    </WorkspaceTabsProvider>
  )
}
