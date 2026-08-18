import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, QrCode, X } from 'lucide-react'
import { toast } from 'sonner'
import NumberInput from '@/components/common/NumberInput'
import { formatCurrency } from '@/lib/utils'
import { useTopupActions, useTopupOrder } from '../hooks/useWallet'
import { TopupOrderStatus, type TopupOrder, type WalletConfig } from '../types'

interface TopupModalProps {
  open: boolean
  onClose: () => void
  config?: WalletConfig
}

/** Nút chép chuỗi. `CopyButton` dùng chung của dự án chép ẢNH, không dùng được ở đây. */
function CopyText({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`Đã chép ${label}`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Trình duyệt không cho phép chép tự động, vui lòng chép tay')
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex-shrink-0 rounded-lg p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      title={`Chép ${label}`}
    >
      {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
    </button>
  )
}

function InfoRow({ label, value, copyLabel }: { label: string; value: string; copyLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-2.5 last:border-b-0">
      <span className="flex-shrink-0 text-sm text-[var(--color-muted-foreground)]">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate font-semibold">{value}</span>
        {copyLabel && <CopyText value={value} label={copyLabel} />}
      </div>
    </div>
  )
}

/** Đồng hồ đếm ngược tới hạn của đơn. */
function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => Date.parse(expiresAt) - Date.now())

  useEffect(() => {
    const t = setInterval(() => setLeft(Date.parse(expiresAt) - Date.now()), 1000)
    return () => clearInterval(t)
  }, [expiresAt])

  if (left <= 0) {
    // Hết hạn KHÔNG có nghĩa là mất tiền — webhook vẫn ghi có cho đơn quá hạn.
    // Nói rõ để người vừa chuyển khoản xong không hoảng.
    return (
      <span className="text-amber-600">
        Đã quá hạn hiển thị. Nếu bạn đã chuyển khoản, tiền vẫn sẽ được ghi có.
      </span>
    )
  }

  const mins = Math.floor(left / 60000)
  const secs = Math.floor((left % 60000) / 1000)
  return (
    <span className="tabular-nums">
      Còn {mins}:{String(secs).padStart(2, '0')} để chuyển khoản
    </span>
  )
}

export default function TopupModal({ open, onClose, config }: TopupModalProps) {
  const [amount, setAmount] = useState(0)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [created, setCreated] = useState<TopupOrder | null>(null)

  const { createTopup, isCreating, cancelTopup, isCancelling } = useTopupActions()
  const { data: polled } = useTopupOrder(orderId ?? undefined)

  const order = polled ?? created
  const paid = order?.status === TopupOrderStatus.PAID

  useEffect(() => {
    if (!open) {
      setAmount(0)
      setOrderId(null)
      setCreated(null)
    }
  }, [open])

  useEffect(() => {
    if (paid) toast.success('Đã nhận được tiền, số dư ví của bạn đã được cộng')
  }, [paid])

  if (!open) return null

  const submit = async () => {
    const result = await createTopup({ amount })
    setCreated(result)
    setOrderId(result.id)
  }

  const cancel = async () => {
    if (orderId) await cancelTopup(orderId)
    onClose()
  }

  const min = config?.topupMinAmount ?? 0
  const max = config?.topupMaxAmount ?? 0
  const invalid = amount < min || amount > max

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{order ? 'Chuyển khoản để nạp tiền' : 'Nạp tiền vào ví'}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
              {order
                ? 'Quét mã hoặc chuyển khoản thủ công theo thông tin bên dưới'
                : 'Nhập số tiền bạn muốn nạp vào ví'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
          >
            <X size={20} />
          </button>
        </div>

        {!order ? (
          <>
            <label className="mb-1.5 block text-sm font-medium">Số tiền</label>
            <NumberInput
              value={amount}
              onChange={setAmount}
              placeholder="0"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-right text-xl font-bold tabular-nums outline-none focus:border-[var(--color-primary)]"
            />
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
              Từ {formatCurrency(min)} đến {formatCurrency(max)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {[50_000, 100_000, 200_000, 500_000]
                .filter((v) => v >= min && v <= max)
                .map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(v)}
                    className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  >
                    {formatCurrency(v)}
                  </button>
                ))}
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={invalid || isCreating}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 font-semibold text-white transition-opacity disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
              Tạo mã chuyển khoản
            </button>
          </>
        ) : paid ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40">
              <Check size={32} />
            </div>
            <h3 className="mt-4 text-xl font-bold">Đã nhận được tiền</h3>
            <p className="mt-1 text-[var(--color-muted-foreground)]">
              Ví của bạn được cộng {formatCurrency(order.paidAmount ?? order.amount)}
            </p>
            {order.paidAmount != null && order.paidAmount !== order.amount && (
              <p className="mt-2 rounded-xl bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                Số tiền thực nhận khác với số bạn đề nghị ({formatCurrency(order.amount)}). Ví đã
                được cộng đúng số thực nhận.
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 font-semibold text-white"
            >
              Xong
            </button>
          </div>
        ) : (
          <>
            {order.qrUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={order.qrUrl}
                  alt={`Mã QR chuyển khoản ${formatCurrency(order.amount)}`}
                  className="h-56 w-56 rounded-2xl border border-[var(--color-border)] bg-white object-contain p-2"
                />
              </div>
            )}

            <div className="rounded-2xl border border-[var(--color-border)] px-4">
              <InfoRow label="Số tiền" value={formatCurrency(order.amount)} />
              <InfoRow
                label="Số tài khoản"
                value={order.bankAccountNumber ?? '—'}
                copyLabel="số tài khoản"
              />
              {order.bankAccountHolder && (
                <InfoRow label="Chủ tài khoản" value={order.bankAccountHolder} />
              )}
              <InfoRow label="Ngân hàng" value={order.bankCode ?? '—'} />
              <InfoRow label="Nội dung" value={order.code} copyLabel="nội dung chuyển khoản" />
            </div>

            {/* Nội dung chuyển khoản là thứ duy nhất nối khoản tiền với đúng người.
                Ghi sai thì tiền vẫn về nhưng phải chờ kế toán xử lý tay. */}
            <p className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              Nội dung chuyển khoản phải giữ nguyên <strong>{order.code}</strong>. Ghi sai sẽ khiến
              tiền không tự vào ví và phải chờ kế toán xử lý tay.
            </p>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[var(--color-muted-foreground)]">
              <span className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" />
                Đang chờ chuyển khoản
              </span>
              <Countdown expiresAt={order.expiresAt} />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={cancel}
                disabled={isCancelling}
                className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-3 font-semibold transition-colors hover:bg-[var(--color-muted)] disabled:opacity-50"
              >
                Huỷ đơn
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-[var(--color-primary)] px-4 py-3 font-semibold text-white"
              >
                Đóng
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
