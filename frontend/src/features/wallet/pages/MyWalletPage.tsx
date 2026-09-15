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

type TabKey = 'convert' | 'topups' | 'history'

export default function MyWalletPage() {
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
      { key: 'convert', label: 'Đổi sang điểm', icon: Coins },
      {
        key: 'topups',
        label: 'Đơn nạp tiền',
        icon: Receipt,
        badge: topupPage?.totalElements || undefined,
      },
      {
        key: 'history',
        label: 'Lịch sử ví',
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
        title="Ví của tôi"
        description="Nạp tiền, đổi sang điểm thưởng và xem toàn bộ lịch sử giao dịch."
        actions={
          <Button id="tour-my-wallet-topup" onClick={() => { setResumeOrder(null); setTopupOpen(true) }}>
            <Plus aria-hidden="true" /> Nạp tiền
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
                title="Chưa có đơn nạp nào"
                description="Bấm Nạp tiền ở góc trên để tạo mã QR chuyển khoản."
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
                title="Chưa có giao dịch nào"
                description="Mọi lần nạp tiền hoặc đổi điểm đều được ghi lại đầy đủ ở đây."
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
                    itemLabel="giao dịch"
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
