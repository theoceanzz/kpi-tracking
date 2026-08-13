import { useEffect, useMemo, useState } from 'react'
import { Loader2, X, Gift, AlertTriangle, Info, ShieldCheck } from 'lucide-react'
import { useHasPermission } from '@/components/auth/PermissionGate'
import EmployeePicker, { type PickedEmployee } from './EmployeePicker'
import { useMyBudget, useRewardGrants } from '../hooks/useRewards'
import type { RewardGrant } from '../types'

interface AwardPointsModalProps {
  open: boolean
  onClose: () => void
  /** Điền sẵn người nhận — dùng khi mở từ nút "Thưởng" trên bảng xếp hạng. */
  presetUsers?: { id: string; fullName: string; email?: string }[]
  onSuccess?: (grant: RewardGrant) => void
}

export default function AwardPointsModal({
  open,
  onClose,
  presetUsers,
  onSuccess,
}: AwardPointsModalProps) {
  const [picked, setPicked] = useState<PickedEmployee[]>([])
  const [points, setPoints] = useState<number | ''>('')
  const [reason, setReason] = useState('')

  const { data: budget } = useMyBudget(open)
  const { createGrant, isCreating } = useRewardGrants({ size: 1 })

  // Người có quyền này (cấp cao nhất) được duyệt thẳng, bỏ qua hạn mức — phải khớp
  // đúng luật ở RewardGrantService, nếu không giao diện sẽ hứa một đằng backend làm một nẻo.
  const { hasPermission } = useHasPermission()
  const canApproveOwn = hasPermission('REWARD:APPROVE_OWN')

  useEffect(() => {
    if (!open) return
    setPicked(presetUsers ?? [])
    setPoints('')
    setReason('')
  }, [open, presetUsers])

  const total = useMemo(
    () => (typeof points === 'number' ? points * picked.length : 0),
    [points, picked.length],
  )

  const noBudget = !budget

  /**
   * Đề nghị VƯỢT hạn mức đang có hay không. Cố ý KHÔNG gộp trạng thái "chưa được cấp
   * hạn mức" vào đây: đó là tình huống khác, và dải thông tin ở đầu modal đã nói rồi —
   * gộp vào sẽ khiến cùng một chuyện hiện hai lần ở hai chỗ.
   */
  const overBudget = useMemo(() => {
    if (!budget) return null
    if (typeof points !== 'number' || points <= 0) return null
    if (budget.maxPerAward != null && points > budget.maxPerAward) {
      return `Vượt mức tối đa ${budget.maxPerAward} điểm/người.`
    }
    if (total > budget.remainingPoints) {
      return `Hạn mức còn ${budget.remainingPoints} điểm nhưng đề nghị cần ${total} điểm.`
    }
    return null
  }, [budget, points, total])

  // Có quyền tự duyệt thì dù chưa có hạn mức hay vượt hạn mức cũng phát ngay.
  const needsApproval = !canApproveOwn && (noBudget || !!overBudget)

  /**
   * Chỉ hiện khi có điều gì đó CHƯA được nói ở dải đầu modal. Người có quyền tự duyệt
   * và chưa có hạn mức thì dải xanh lá ở trên đã giải thích đủ, không cần lặp lại.
   */
  const notice = useMemo(() => {
    if (needsApproval) {
      // `useMyBudget` chỉ trả về hạn mức ĐANG hiệu lực, nên không có nghĩa là "chưa
      // từng được cấp" — có thể hạn mức đã hết hạn. Backend biết rõ hơn và sẽ trả về
      // lý do chính xác sau khi gửi; ở đây nói mở để không khẳng định sai.
      const reason = overBudget ?? 'Bạn không có hạn mức nào đang hiệu lực.'
      return { tone: 'warn' as const, text: `${reason} Đề nghị này sẽ cần cấp trên duyệt.` }
    }
    if (canApproveOwn && overBudget) {
      return {
        tone: 'info' as const,
        text: `${overBudget} Bạn có quyền tự duyệt nên điểm vẫn được phát ngay.`,
      }
    }
    return null
  }, [needsApproval, canApproveOwn, overBudget])

  if (!open) return null

  const canSubmit =
    picked.length > 0 && typeof points === 'number' && points > 0 && reason.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    const grant = await createGrant({
      recipients: picked.map((p) => ({ userId: p.id, points: points as number })),
      reason: reason.trim(),
      pointsPerRecipient: points as number,
    })
    onSuccess?.(grant)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Gift size={20} className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold">Thưởng điểm cho nhân viên</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {budget ? (
            <div className="rounded-xl bg-[var(--color-muted)] px-4 py-3 text-sm">
              Hạn mức của bạn:{' '}
              <span className="font-semibold">
                còn {budget.remainingPoints}/{budget.allocatedPoints} điểm
              </span>
              {budget.maxPerAward != null && (
                <span className="text-[var(--color-muted-foreground)]">
                  {' '}· tối đa {budget.maxPerAward} điểm/người mỗi lần
                </span>
              )}
            </div>
          ) : canApproveOwn ? (
            // Không có hạn mức mà vẫn thưởng được ngay — nói rõ một lần ở đây, để người
            // dùng không tưởng hệ thống bỏ sót bước kiểm tra. Dải thông báo phía dưới
            // sẽ không lặp lại chuyện này.
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm">
              <ShieldCheck size={16} className="flex-shrink-0 text-emerald-600" />
              <span>Bạn thưởng được ngay, không bị giới hạn hạn mức.</span>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Chọn nhân viên</label>

            {picked.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {picked.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-sm"
                  >
                    {p.fullName}
                    <button
                      type="button"
                      onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
                      className="rounded-full hover:bg-[var(--color-primary)]/20"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <EmployeePicker
              selectedIds={picked.map((p) => p.id)}
              onPick={(u) => setPicked((prev) => [...prev, u])}
              enabled={open}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Số điểm mỗi người</label>
              <input
                type="number"
                min={1}
                value={points}
                onChange={(e) => setPoints(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-sm">
                Tổng cộng: <span className="font-semibold">{total} điểm</span>
                <span className="text-[var(--color-muted-foreground)]">
                  {' '}({picked.length} người)
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Lý do thưởng</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ví dụ: Hoàn thành xuất sắc dự án ra mắt sản phẩm quý này"
              className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Lý do được hiện trong lịch sử điểm của nhân viên, nên viết cụ thể.
            </p>
          </div>

          {notice && (
            <div
              className={
                notice.tone === 'warn'
                  ? 'flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm'
                  : 'flex items-start gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm'
              }
            >
              {notice.tone === 'warn' ? (
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
              ) : (
                <Info size={16} className="mt-0.5 flex-shrink-0 text-sky-600" />
              )}
              <span>{notice.text}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isCreating && <Loader2 size={15} className="animate-spin" />}
            {needsApproval ? 'Gửi đề nghị duyệt' : 'Thưởng ngay'}
          </button>
        </div>
      </div>
    </div>
  )
}
