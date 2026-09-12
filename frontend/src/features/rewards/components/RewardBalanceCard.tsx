import { TrendingUp, ShoppingBag, AlertTriangle } from 'lucide-react'
import BalanceHero from '@/components/common/BalanceHero'
import type { RewardWallet } from '../types'

interface RewardBalanceCardProps {
  wallet?: RewardWallet
  loading?: boolean
}

const fmt = (n?: number) => (n ?? 0).toLocaleString('vi-VN')

export default function RewardBalanceCard({ wallet, loading }: RewardBalanceCardProps) {
  const balance = wallet?.balance ?? 0
  const isEmpty = balance === 0 && (wallet?.lifetimeEarned ?? 0) === 0

  return (
    <div className="space-y-3">
      <BalanceHero
        loading={loading}
        label="Số dư điểm thưởng"
        value={fmt(balance)}
        unit="điểm"
        negative={balance < 0}
        hint={isEmpty ? 'Bạn sẽ nhận điểm khi được quản lý ghi nhận hoặc lọt top xếp hạng của đợt/kỳ.' : undefined}
        tiles={[
          { label: 'Tổng đã nhận', value: fmt(wallet?.lifetimeEarned), icon: TrendingUp, tone: 'success' },
          { label: 'Tổng đã dùng', value: fmt(wallet?.lifetimeSpent), icon: ShoppingBag, tone: 'info' },
        ]}
      />

      {/* Số dư âm là dữ liệu thật (thưởng bị thu hồi sau khi đã tiêu), không phải lỗi —
          nói thẳng lý do thay vì để nhân viên hoang mang vì thấy số âm. */}
      {!loading && wallet?.negative && (
        <div className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>
            Số dư đang âm do một khoản thưởng đã được thu hồi sau khi bạn dùng điểm. Điểm thưởng
            nhận thêm sẽ bù vào phần âm này trước.
          </span>
        </div>
      )}
    </div>
  )
}
