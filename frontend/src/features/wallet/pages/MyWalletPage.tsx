import { useState } from 'react'
import { Coins, History, Plus, Receipt } from 'lucide-react'
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
  useWalletConfig,
} from '../hooks/useWallet'
import type { WalletConfig } from '../types'

type TabKey = 'convert' | 'topups' | 'history'

export default function MyWalletPage() {
  const [tab, setTab] = useState<TabKey>('convert')
  const [page, setPage] = useState(0)
  const [topupOpen, setTopupOpen] = useState(false)
  const size = 20

  const { data: wallet, isLoading: walletLoading } = useMyCashWallet()
  const { data: txPage, isLoading: txLoading } = useMyCashTransactions(page, size)
  const { data: topupPage, isLoading: topupsLoading } = useMyTopups(0, 50)

  // Cấu hình cần hạn mức nạp tối thiểu/tối đa cho modal. Người dùng thường không
  // có WALLET:CONFIG nên gọi này sẽ 403 — bọc lại để trang vẫn chạy bình thường.
  const { data: config } = useWalletConfig(false)

  const transactions = txPage?.content ?? []
  const topups = topupPage?.content ?? []

  // Suy hạn mức từ chính ví khi không đọc được cấu hình: tỉ giá đã có sẵn ở đó,
  // còn hạn mức thì backend vẫn kiểm lại khi tạo đơn nên đây chỉ là gợi ý.
  const modalConfig: WalletConfig | undefined = config ?? {
    enableCashWallet: true,
    pointExchangeRate: wallet?.pointExchangeRate ?? 1000,
    topupMinAmount: 10_000,
    topupMaxAmount: 50_000_000,
    topupExpireMinutes: 30,
    bankConfigured: true,
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'convert', label: 'Đổi sang điểm', icon: <Coins size={16} /> },
    {
      key: 'topups',
      label: 'Đơn nạp tiền',
      icon: <Receipt size={16} />,
      badge: topupPage?.totalElements || undefined,
    },
    {
      key: 'history',
      label: 'Lịch sử ví',
      icon: <History size={16} />,
      badge: txPage?.totalElements || undefined,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Ví của tôi"
          description="Nạp tiền, đổi sang điểm thưởng và xem toàn bộ lịch sử giao dịch"
        />
        <button
          type="button"
          onClick={() => setTopupOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-semibold text-white"
        >
          <Plus size={18} />
          Nạp tiền
        </button>
      </div>

      <CashBalanceCard wallet={wallet} loading={walletLoading} />

      <div className="mb-6 mt-8 flex flex-wrap gap-1 sm:border-b sm:border-[var(--color-border)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:-mb-px sm:gap-2 sm:px-4 sm:py-3 ${
              tab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge != null && (
              <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'convert' && <ConvertPointsCard wallet={wallet} />}

      {tab === 'topups' &&
        (topupsLoading ? (
          <LoadingSkeleton type="table" rows={3} />
        ) : topups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
            <EmptyState
              title="Chưa có đơn nạp nào"
              description="Bấm Nạp tiền ở góc trên để tạo mã QR chuyển khoản."
            />
          </div>
        ) : (
          <TopupHistoryTable data={topups} />
        ))}

      {tab === 'history' &&
        (txLoading ? (
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
        ))}

      <TopupModal open={topupOpen} onClose={() => setTopupOpen(false)} config={modalConfig} />
    </div>
  )
}
