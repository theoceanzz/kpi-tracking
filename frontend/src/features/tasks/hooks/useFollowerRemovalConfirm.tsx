import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError'
import FollowerRemovalDialog from '../components/FollowerRemovalDialog'
import type { FollowerRemoval, FollowerRemovalRef } from '../types'

/** Backend: có cặp (việc, người) sẽ bị gỡ mà chưa được xác nhận ⇒ xem trước lại rồi hỏi lại. */
const UNCONFIRMED = 'TASK_FOLLOWER_REMOVAL_UNCONFIRMED'
/** Xem trước và thực tế dùng chung một luật ở backend — vòng hỏi lại chỉ lặp khi có người theo dõi mới chen vào. */
const MAX_ROUNDS = 3

export interface FollowerRemovalFlow<T> {
  /** Đổi KPI thì ai bị gỡ khỏi việc nào (assignImpact / moveImpact). */
  preview: () => Promise<FollowerRemoval[]>
  /** Thao tác thật, kèm các cặp đã được đồng ý gỡ. */
  commit: (confirmed: FollowerRemovalRef[]) => Promise<T>
  onSuccess: (result: T) => void
  onError: (e: unknown) => void
}

interface Pending {
  removals: FollowerRemoval[]
  /** Trả promise để nơi gọi (và test) chờ được tới lúc gửi xong. */
  confirm: () => Promise<void>
}

/**
 * Đổi KPI của việc (giao lại kèm KPI mới, "Chuyển sang KPI khác", chuyển việc khỏi KPI đã được thay): người theo dõi
 * không xem được KPI mới sẽ bị gỡ. Không ai bị gỡ thì làm luôn; có thì hiện hộp liệt kê ai bị gỡ khỏi việc nào (cả
 * việc con) và chỉ làm khi người dùng đồng ý. Trả về {@code dialog} để đặt vào JSX và {@code busy} để khoá nút gửi.
 */
export function useFollowerRemovalConfirm() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)

  const start = async <T,>(flow: FollowerRemovalFlow<T>, round = 1): Promise<void> => {
    setBusy(true)
    let removals: FollowerRemoval[]
    try {
      removals = await flow.preview()
    } catch (e) {
      setBusy(false)
      setPending(null)
      flow.onError(e)
      return
    }
    if (removals.length === 0) {
      await commit(flow, [], round)
      return
    }
    setBusy(false)
    setPending({ removals, confirm: () => commit(flow, removals, round) })
  }

  const commit = async <T,>(flow: FollowerRemovalFlow<T>, removals: FollowerRemoval[], round: number): Promise<void> => {
    setBusy(true)
    try {
      const result = await flow.commit(removals.map((r) => ({ taskId: r.taskId, userId: r.userId })))
      setPending(null)
      setBusy(false)
      flow.onSuccess(result)
    } catch (e) {
      if (getApiErrorCode(e) === UNCONFIRMED && round < MAX_ROUNDS) {
        toast.info(getApiErrorMessage(e))
        await start(flow, round + 1)
        return
      }
      setPending(null)
      setBusy(false)
      flow.onError(e)
    }
  }

  const dialog: ReactNode = pending && (
    <FollowerRemovalDialog removals={pending.removals} busy={busy} onConfirm={pending.confirm} onClose={() => setPending(null)} />
  )
  return { start, busy, dialog }
}
