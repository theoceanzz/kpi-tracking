import { useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import EmployeePicker, { type PickedEmployee } from '@/features/rewards/components/EmployeePicker'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useReconcileActions } from '../hooks/useWallet'
import { SepayResolveMode, type SepayEvent } from '../types'

interface ResolveEventModalProps {
  event: SepayEvent | null
  onClose: () => void
}

const MODES: { key: SepayResolveMode; label: string; hint: string }[] = [
  {
    key: SepayResolveMode.MATCH_ORDER,
    label: 'Gán vào đơn nạp',
    hint: 'Người dùng ghi sai nội dung chuyển khoản nhưng xác định được đơn nào.',
  },
  {
    key: SepayResolveMode.CREDIT_USER,
    label: 'Ghi có cho người dùng',
    hint: 'Không quy được về đơn nào — ví dụ người dùng chuyển khoản lần thứ hai.',
  },
  {
    key: SepayResolveMode.IGNORE,
    label: 'Bỏ qua',
    hint: 'Không phải tiền nạp ví, hoặc webhook về muộn sau khi đơn đã được gán tay.',
  },
]

export default function ResolveEventModal({ event, onClose }: ResolveEventModalProps) {
  const [mode, setMode] = useState<SepayResolveMode>(SepayResolveMode.CREDIT_USER)
  const [orderId, setOrderId] = useState('')
  const [user, setUser] = useState<PickedEmployee | null>(null)
  const [note, setNote] = useState('')

  const { resolveEvent, isResolving } = useReconcileActions()

  if (!event) return null

  const needsUser = mode === SepayResolveMode.CREDIT_USER
  const needsOrder = mode === SepayResolveMode.MATCH_ORDER
  const valid =
    note.trim().length > 0 && (!needsUser || !!user) && (!needsOrder || orderId.trim().length > 0)

  const submit = async () => {
    await resolveEvent({
      id: event.id,
      data: {
        mode,
        note: note.trim(),
        ...(needsOrder ? { orderId: orderId.trim() } : {}),
        ...(needsUser && user ? { userId: user.id } : {}),
      },
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Xử lý giao dịch SePay</h2>
            <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
              Giao dịch #{event.sepayId} · {formatDateTime(event.receivedAt)}
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

        {/* Thông điệp của hệ thống chính là hướng dẫn chọn cách xử lý ở nhiều
            trường hợp, nên đặt lên đầu chứ không giấu dưới bảng. */}
        {event.errorMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
            <span>{event.errorMessage}</span>
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
          <div className="flex justify-between gap-3 py-1">
            <span className="text-[var(--color-muted-foreground)]">Số tiền thực nhận</span>
            <strong className="tabular-nums">{formatCurrency(event.transferAmount ?? 0)}</strong>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <span className="text-[var(--color-muted-foreground)]">Nội dung</span>
            <span className="max-w-[60%] truncate text-right">{event.content || '—'}</span>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <span className="text-[var(--color-muted-foreground)]">Ngân hàng</span>
            <span>{event.gateway || '—'}</span>
          </div>
        </div>

        {/* KHÔNG có ô nhập số tiền: hệ thống luôn ghi có đúng số thực nhận. Một ô
            tự do sẽ phá chính sách đó ở đúng chỗ dễ gõ nhầm nhất. */}
        <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">
          Số tiền ghi có luôn bằng đúng số thực nhận ở trên và không sửa được — hệ thống không có
          đường nào ghi một số tiền tuỳ ý vào ví.
        </p>

        <label className="mb-1.5 block text-sm font-medium">Cách xử lý</label>
        <div className="mb-4 space-y-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                mode === m.key
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]/40'
              }`}
            >
              <div className="text-sm font-semibold">{m.label}</div>
              <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{m.hint}</div>
            </button>
          ))}
        </div>

        {needsOrder && (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium">Mã định danh đơn nạp</label>
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Dán ID đơn nạp cần gán"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        )}

        {needsUser && (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium">Người được ghi có</label>
            {user ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-4 py-2.5">
                <span className="truncate text-sm font-semibold">{user.fullName}</span>
                <button
                  type="button"
                  onClick={() => setUser(null)}
                  className="text-xs font-semibold text-[var(--color-primary)]"
                >
                  Đổi
                </button>
              </div>
            ) : (
              <EmployeePicker selectedIds={[]} onPick={setUser} />
            )}
          </div>
        )}

        <label className="mb-1.5 block text-sm font-medium">
          Ghi chú xử lý <span className="text-rose-600">*</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Vì sao xử lý như vậy — người soát sổ về sau sẽ đọc dòng này"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-3 font-semibold transition-colors hover:bg-[var(--color-muted)]"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || isResolving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {isResolving && <Loader2 size={18} className="animate-spin" />}
            Xác nhận xử lý
          </button>
        </div>
      </div>
    </div>
  )
}
