import { Coins, TrendingUp, ShoppingBag, AlertTriangle, Sparkles } from 'lucide-react'
import type { RewardWallet } from '../types'

interface RewardBalanceCardProps {
  wallet?: RewardWallet
  loading?: boolean
}

const fmt = (n?: number) => (n ?? 0).toLocaleString('vi-VN')

/** Ô chỉ số phụ. Tách ra để ba ô chắc chắn cùng kích thước và cùng khoảng đệm. */
function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'emerald' | 'sky'
}) {
  const toneCls =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
      : 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400'

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${toneCls}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-muted-foreground)]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-xl font-bold">{value}</div>
      </div>
    </div>
  )
}

export default function RewardBalanceCard({ wallet, loading }: RewardBalanceCardProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-3xl bg-[var(--color-muted)]" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-[74px] animate-pulse rounded-2xl bg-[var(--color-muted)]" />
          <div className="h-[74px] animate-pulse rounded-2xl bg-[var(--color-muted)]" />
        </div>
      </div>
    )
  }

  const balance = wallet?.balance ?? 0
  const isEmpty = balance === 0 && (wallet?.lifetimeEarned ?? 0) === 0

  return (
    <div className="space-y-4">
      {/* Số dư là thứ người dùng vào đây để xem, nên nó chiếm trọn một khối riêng
          thay vì chen ngang với các chỉ số phụ. */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary)]/10 via-[var(--color-card)] to-[var(--color-card)] px-6 py-7 sm:px-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[var(--color-primary)]/10 blur-2xl" />

        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-muted-foreground)]">
            <Coins size={14} />
            Số dư điểm thưởng
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            {/* Số dư có thể lên tới hàng trăm nghìn điểm; text-5xl cố định sẽ tràn
                khung trên màn hình hẹp, nên thu nhỏ lại ở mobile. */}
            <span
              className={`text-4xl font-black tracking-tight tabular-nums sm:text-5xl ${balance < 0 ? 'text-rose-600' : ''}`}
            >
              {fmt(balance)}
            </span>
            <span className="text-lg font-medium text-[var(--color-muted-foreground)]">điểm</span>
          </div>

          {isEmpty && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
              <Sparkles size={14} />
              Bạn sẽ nhận điểm khi được quản lý ghi nhận hoặc lọt top xếp hạng của đợt/kỳ.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          icon={<TrendingUp size={18} />}
          label="Tổng đã nhận"
          value={fmt(wallet?.lifetimeEarned)}
          tone="emerald"
        />
        <StatTile
          icon={<ShoppingBag size={18} />}
          label="Tổng đã dùng"
          value={fmt(wallet?.lifetimeSpent)}
          tone="sky"
        />
      </div>

      {/* Số dư âm là dữ liệu thật (thưởng bị thu hồi sau khi đã tiêu), không phải lỗi —
          nói thẳng lý do thay vì để nhân viên hoang mang vì thấy số âm. */}
      {wallet?.negative && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <span>
            Số dư đang âm do một khoản thưởng đã được thu hồi sau khi bạn dùng điểm. Điểm thưởng
            nhận thêm sẽ bù vào phần âm này trước.
          </span>
        </div>
      )}
    </div>
  )
}
