import { useState } from 'react'
import { Gift, Loader2, X, Check } from 'lucide-react'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'
import { useMyBudget, useRewardGrants } from '../hooks/useRewards'

interface RewardPromptProps {
  userId: string
  fullName: string
  /** Gợi ý lý do, điền sẵn để người dùng chỉ việc sửa. Ví dụ tên kỳ đánh giá. */
  defaultReason?: string
  /** Gọi khi người dùng bỏ qua hoặc thưởng xong — để màn hình cha đóng/điều hướng tiếp. */
  onDone?: () => void
}

/**
 * Lời mời thưởng điểm ngay sau khi đánh giá xong.
 *
 * <p>Đặt ở đây vì đó là lúc người quản lý còn nhớ rõ nhất vì sao nhân viên xứng đáng —
 * bắt họ nhớ để vào màn hình khác thưởng sau là gần như chắc chắn sẽ quên.
 *
 * <p>Tự ẩn hoàn toàn khi tổ chức tắt tính năng thưởng hoặc người dùng không có quyền
 * trao — không làm phiền bằng một lời mời họ không dùng được.
 */
export default function RewardPrompt({
  userId,
  fullName,
  defaultReason,
  onDone,
}: RewardPromptProps) {
  const [expanded, setExpanded] = useState(false)
  const [done, setDone] = useState(false)
  const [points, setPoints] = useState<number | ''>('')
  const [reason, setReason] = useState(defaultReason ?? '')

  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId ?? '')
  const { hasPermission } = useHasPermission()
  const { data: budget } = useMyBudget(expanded)
  const { createGrant, isCreating } = useRewardGrants({ size: 1 })

  const canGrant = hasPermission('REWARD:GRANT')
  const enabled = org?.enableReward === true

  // Không có quyền hoặc tổ chức tắt tính năng ⇒ biến mất hẳn, không chiếm chỗ.
  if (!enabled || !canGrant) return null

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
        <Check size={16} className="flex-shrink-0 text-emerald-600" />
        <span>
          Đã thưởng <b>{typeof points === 'number' ? points.toLocaleString('vi-VN') : ''} điểm</b> cho{' '}
          {fullName}.
        </span>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (typeof points !== 'number' || points <= 0 || !reason.trim()) return
    await createGrant({
      recipients: [{ userId, points }],
      reason: reason.trim(),
      pointsPerRecipient: points,
    })
    setDone(true)
    onDone?.()
  }

  if (!expanded) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3">
        <span className="flex items-center gap-2 text-sm">
          <Gift size={16} className="text-[var(--color-primary)]" />
          Thưởng điểm cho <b>{fullName}</b>?
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-white"
          >
            Có
          </button>
          <button
            type="button"
            onClick={() => onDone?.()}
            className="rounded-lg border border-[var(--color-border)] px-4 py-1.5 text-sm"
          >
            Bỏ qua
          </button>
        </div>
      </div>
    )
  }

  const canSubmit = typeof points === 'number' && points > 0 && reason.trim().length > 0

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Gift size={16} className="text-[var(--color-primary)]" />
          Thưởng điểm cho {fullName}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-lg p-1 hover:bg-[var(--color-accent)]"
        >
          <X size={15} />
        </button>
      </div>

      {budget && (
        <div className="text-xs text-[var(--color-muted-foreground)]">
          Hạn mức còn {budget.remainingPoints.toLocaleString('vi-VN')} điểm
          {budget.maxPerAward != null && ` · tối đa ${budget.maxPerAward} điểm/người`}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Số điểm"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm sm:w-32"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lý do thưởng"
          className="w-full flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isCreating}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isCreating && <Loader2 size={14} className="animate-spin" />}
          Thưởng
        </button>
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)]">
        Lý do hiện trong lịch sử điểm của nhân viên. Vượt hạn mức thì đề nghị sẽ chuyển sang chờ
        cấp trên duyệt.
      </p>
    </div>
  )
}
