import { Wallet, ArrowDownToLine, Coins, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { CashWallet } from '../types'

interface CashBalanceCardProps {
  wallet?: CashWallet
  loading?: boolean
}

/** Ô chỉ số phụ. Tách ra để các ô chắc chắn cùng kích thước và cùng khoảng đệm. */
function StatTile({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
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
        {hint && (
          <div className="truncate text-xs text-[var(--color-muted-foreground)]">{hint}</div>
        )}
      </div>
    </div>
  )
}

export default function CashBalanceCard({ wallet, loading }: CashBalanceCardProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-3xl bg-[var(--color-muted)]" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-[74px] animate-pulse rounded-2xl bg-[var(--color-muted)]" />
          <div className="h-[74px] animate-pulse rounded-2xl bg-[var(--color-muted)]" />
          <div className="h-[74px] animate-pulse rounded-2xl bg-[var(--color-muted)]" />
        </div>
      </div>
    )
  }

  const balance = wallet?.balance ?? 0
  const rate = wallet?.pointExchangeRate ?? 0
  const isEmpty = balance === 0 && (wallet?.lifetimeTopup ?? 0) === 0

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-emerald-500/10 via-[var(--color-card)] to-[var(--color-card)] px-6 py-7 sm:px-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />

        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-muted-foreground)]">
            <Wallet size={14} />
            Số dư ví tiền
          </div>

          <div className="mt-2 text-4xl font-black tracking-tight tabular-nums sm:text-5xl">
            {formatCurrency(balance)}
          </div>

          {isEmpty ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
              <Sparkles size={14} />
              Nạp tiền vào ví để đổi lấy điểm thưởng dùng trong cửa hàng quà.
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
              Đổi được tối đa{' '}
              <strong className="text-[var(--color-foreground)]">
                {(wallet?.convertiblePoints ?? 0).toLocaleString('vi-VN')} điểm
              </strong>{' '}
              theo tỉ giá hiện tại.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={<ArrowDownToLine size={18} />}
          label="Tổng đã nạp"
          value={formatCurrency(wallet?.lifetimeTopup)}
          tone="emerald"
        />
        <StatTile
          icon={<Coins size={18} />}
          label="Đã đổi ra điểm"
          value={formatCurrency(wallet?.lifetimeConverted)}
          tone="sky"
        />
        <StatTile
          icon={<Sparkles size={18} />}
          label="Tỉ giá"
          value={`${formatCurrency(rate)}/điểm`}
          hint="Tỉ giá do công ty đặt, có thể thay đổi"
          tone="sky"
        />
      </div>
    </div>
  )
}
