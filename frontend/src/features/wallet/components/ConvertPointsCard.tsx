import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Coins, Loader2 } from 'lucide-react'
import NumberInput from '@/components/common/NumberInput'
import { formatCurrency } from '@/lib/utils'
import { useConversion } from '../hooks/useWallet'
import type { CashWallet } from '../types'

interface ConvertPointsCardProps {
  wallet?: CashWallet
}

export default function ConvertPointsCard({ wallet }: ConvertPointsCardProps) {
  const [points, setPoints] = useState(0)
  const { convert, isConverting } = useConversion()

  const rate = wallet?.pointExchangeRate ?? 0
  const balance = wallet?.balance ?? 0
  const maxPoints = wallet?.convertiblePoints ?? 0

  // Tính tại chỗ thay vì gọi /convert/quote: công thức là points × rate, chia chẵn
  // và không phụ thuộc gì khác, nên gọi API chỉ thêm độ trễ mà cho ra đúng con số này.
  const cost = useMemo(() => points * rate, [points, rate])
  const affordable = points > 0 && cost <= balance

  /**
   * Sinh mã yêu cầu MỚI mỗi khi số điểm đổi.
   *
   * <p>Sinh lại ở mỗi lần bấm thì lớp chống ghi trùng vô nghĩa — bấm hai lần sẽ
   * trừ tiền hai lần. Giữ cố định suốt vòng đời form thì ngược lại: đổi số điểm
   * rồi bấm sẽ nhận về kết quả của lần đổi trước. Buộc vào giá trị đang nhập là
   * cách duy nhất đúng cả hai chiều.
   */
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  useEffect(() => {
    setRequestId(crypto.randomUUID())
  }, [points])

  const submit = async () => {
    await convert({ points, requestId })
    setPoints(0)
  }

  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-muted-foreground)]">
        <Coins size={14} />
        Đổi tiền lấy điểm thưởng
      </div>

      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        Tỉ giá hiện tại: <strong>{formatCurrency(rate)}</strong> đổi được 1 điểm. Điểm sẽ vào thẳng
        ví điểm thưởng của bạn và dùng được ngay trong cửa hàng quà.
      </p>

      <div className="mt-5 grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Số điểm muốn đổi</label>
          <NumberInput
            value={points}
            onChange={setPoints}
            placeholder="0"
            maxDigits={9}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-right text-xl font-bold tabular-nums outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <ArrowRight className="mx-auto hidden text-[var(--color-muted-foreground)] sm:block" size={20} />

        <div>
          <div className="mb-1.5 text-sm font-medium">Số tiền bị trừ</div>
          <div
            className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-right text-xl font-bold tabular-nums ${
              points > 0 && !affordable ? 'text-rose-600' : ''
            }`}
          >
            {formatCurrency(cost)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-[var(--color-muted-foreground)]">
          Số dư sau khi đổi:{' '}
          <strong className="text-[var(--color-foreground)]">
            {formatCurrency(Math.max(balance - cost, 0))}
          </strong>
        </span>
        <button
          type="button"
          onClick={() => setPoints(maxPoints)}
          disabled={maxPoints <= 0}
          className="font-semibold text-[var(--color-primary)] disabled:opacity-40"
        >
          Đổi tối đa ({maxPoints.toLocaleString('vi-VN')} điểm)
        </button>
      </div>

      {points > 0 && !affordable && (
        <p className="mt-3 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-400">
          Số dư không đủ. Bạn còn thiếu {formatCurrency(cost - balance)}.
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!affordable || isConverting}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 font-semibold text-white transition-opacity disabled:opacity-50"
      >
        {isConverting ? <Loader2 size={18} className="animate-spin" /> : <Coins size={18} />}
        Đổi {points > 0 ? points.toLocaleString('vi-VN') : ''} điểm
      </button>
    </div>
  )
}
