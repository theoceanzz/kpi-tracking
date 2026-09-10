import { useState } from 'react'
import { Coins, History, Plus, Receipt } from 'lucide-react'
import { useTabParam } from '@/hooks/useTabParam'
import { useTourTabScope } from '@/hooks/useTourScope'
import PageHeader from '@/components/common/PageHeader'
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
  useTourTabScope(activeTab)

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Ví của tôi"
          description="Nạp tiền, đổi sang điểm thưởng và xem toàn bộ lịch sử giao dịch"
        />
        <button
          id="tour-my-wallet-topup"
          type="button"
          onClick={() => {
            setResumeOrder(null)
            setTopupOpen(true)
          }}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-semibold text-white"
        >
          <Plus size={18} />
          Nạp tiền
        </button>
      </div>

      <div id="tour-my-wallet-balance">
        <CashBalanceCard wallet={wallet} loading={walletLoading} />
      </div>

      {/* Neo cho hướng dẫn: hàng tab này tự vẽ chứ không đi qua WorkspaceHeader. */}
      <div id="tour-local-tabs" className="mb-6 mt-8 flex flex-wrap gap-1 sm:border-b sm:border-[var(--color-border)]">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:-mb-px sm:gap-2 sm:px-4 sm:py-3 ${
              activeTab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            }`}
          >
            <t.icon size={16} />
            {t.label}
            {t.badge != null && (
              <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
                {t.badge}
              </span>
            )}
          </button>
        ))}
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
            <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
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
            <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
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
  )
}
