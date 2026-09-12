import { ArrowDownToLine, Coins, Sparkles } from 'lucide-react'
import BalanceHero from '@/components/common/BalanceHero'
import { formatCurrency } from '@/lib/utils'
import type { CashWallet } from '../types'

interface CashBalanceCardProps {
  wallet?: CashWallet
  loading?: boolean
}

export default function CashBalanceCard({ wallet, loading }: CashBalanceCardProps) {
  const balance = wallet?.balance ?? 0
  const rate = wallet?.pointExchangeRate ?? 0
  const isEmpty = balance === 0 && (wallet?.lifetimeTopup ?? 0) === 0

  return (
    <BalanceHero
      loading={loading}
      label="Số dư ví tiền"
      value={formatCurrency(balance)}
      hint={isEmpty
        ? 'Nạp tiền vào ví để đổi lấy điểm thưởng dùng trong cửa hàng quà.'
        : <>Đổi được tối đa <strong className="font-medium text-[var(--color-foreground)] tabular-nums">{(wallet?.convertiblePoints ?? 0).toLocaleString('vi-VN')} điểm</strong> theo tỉ giá hiện tại.</>}
      tiles={[
        { label: 'Tổng đã nạp', value: formatCurrency(wallet?.lifetimeTopup), icon: ArrowDownToLine, tone: 'success' },
        { label: 'Đã đổi ra điểm', value: formatCurrency(wallet?.lifetimeConverted), icon: Coins, tone: 'info' },
        { label: 'Tỉ giá', value: `${formatCurrency(rate)}/điểm`, hint: 'Do công ty đặt, có thể thay đổi', icon: Sparkles, tone: 'neutral' },
      ]}
    />
  )
}
