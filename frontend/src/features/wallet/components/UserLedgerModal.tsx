import { useState } from 'react'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Dialog } from '@/components/ui/dialog'
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
    <Dialog
      open
      onClose={onClose}
      size="xl"
      flush
      title={wallet.fullName}
      description={
        <span className="block truncate">
          {wallet.employeeCode ? `${wallet.employeeCode} · ` : ''}
          {wallet.email}
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-px border-b border-[var(--color-border)] bg-[var(--color-border)]">
        {[
          { label: 'Số dư', value: formatCurrency(wallet.balance) },
          { label: 'Đã nạp', value: formatCurrency(wallet.lifetimeTopup) },
          { label: 'Đã đổi ra điểm', value: formatCurrency(wallet.lifetimeConverted) },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-card)] px-5 py-3">
            <p className="text-eyebrow">{s.label}</p>
            <p className="mt-1 truncate text-stat">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="p-5">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={4} />
        ) : transactions.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)]">
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
    </Dialog>
  )
}
