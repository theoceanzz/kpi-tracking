import { useState } from 'react'
import { X } from 'lucide-react'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatCurrency } from '@/lib/utils'
import { useUserCashTransactions } from '../hooks/useWallet'
import CashLedgerTable from './CashLedgerTable'
import type { CashWallet } from '../types'

interface UserLedgerModalProps {
  wallet: CashWallet | null
  onClose: () => void
}

/**
 * Sổ cái của một nhân sự, mở từ bảng ví nhân sự.
 *
 * <p>Đây là thứ trả lời câu hỏi "vì sao số dư của người này lại ra con số đó" —
 * màn hình đối soát chỉ thấy luồng tiền vào từ ngân hàng, không thấy các bút toán
 * quy đổi và điều chỉnh làm nên số dư hiện tại.
 */
export default function UserLedgerModal({ wallet, onClose }: UserLedgerModalProps) {
  const [page, setPage] = useState(0)
  const size = 20

  const { data, isLoading } = useUserCashTransactions(wallet?.userId, page, size)
  const transactions = data?.content ?? []

  if (!wallet) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{wallet.fullName}</h2>
            <p className="truncate text-sm text-[var(--color-muted-foreground)]">
              {wallet.employeeCode ? `${wallet.employeeCode} · ` : ''}
              {wallet.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
          >
            <X size={20} />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-px border-b border-[var(--color-border)] bg-[var(--color-border)]">
          {[
            { label: 'Số dư', value: formatCurrency(wallet.balance) },
            { label: 'Đã nạp', value: formatCurrency(wallet.lifetimeTopup) },
            { label: 'Đã đổi ra điểm', value: formatCurrency(wallet.lifetimeConverted) },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--color-card)] px-6 py-4">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-muted-foreground)]">
                {s.label}
              </div>
              <div className="mt-1 truncate text-lg font-bold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <LoadingSkeleton type="table" rows={4} />
          ) : transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
              <EmptyState
                title="Chưa có giao dịch nào"
                description="Ví này được tạo nhưng chưa phát sinh nạp tiền hay quy đổi."
              />
            </div>
          ) : (
            <>
              <CashLedgerTable data={transactions} />
              {(data?.totalPages ?? 0) > 1 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={page}
                    totalPages={data?.totalPages ?? 0}
                    totalElements={data?.totalElements ?? 0}
                    size={size}
                    onPageChange={setPage}
                    itemLabel="giao dịch"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
