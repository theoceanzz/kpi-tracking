import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkflowStageCode } from '@/features/kpi/workflow/types'

interface UserWorkflowPrefs {
  /** Các bước người này tự ẩn khỏi sidebar CỦA HỌ. */
  hiddenStages: WorkflowStageCode[]
}

interface WorkflowPrefsState {
  /** userId → thiết lập hiển thị của người đó. */
  byUser: Record<string, UserWorkflowPrefs>
  isHidden: (userId: string | undefined, stage: WorkflowStageCode) => boolean
  toggleStage: (userId: string, stage: WorkflowStageCode) => void
  reset: (userId: string) => void
}

const EMPTY: UserWorkflowPrefs = { hiddenStages: [] }

/**
 * Thiết lập HIỂN THỊ luồng KPI của từng người — tầng cá nhân, tách hẳn khỏi cấu hình tổ chức.
 *
 * Ranh giới quan trọng: cấu hình tổ chức (bật/tắt bước, luật duyệt) là LUẬT NGHIỆP VỤ do backend
 * cưỡng chế và cần quyền `WORKFLOW:MANAGE`. Còn ở đây thuần tuý là "tôi muốn thấy gì trên màn
 * hình của tôi" — ẩn một bước ở đây không làm bước đó biến mất với người khác, và cũng không cho
 * phép làm bất cứ điều gì mà backend đang chặn.
 *
 * Lưu trên máy người dùng, khoá theo userId — cùng cách `tourStore` nhớ ai đã xem hướng dẫn nào,
 * nên hai tài khoản dùng chung một máy không đá nhau.
 */
export const useWorkflowPrefsStore = create<WorkflowPrefsState>()(
  persist(
    (set, get) => ({
      byUser: {},

      isHidden: (userId, stage) => {
        if (!userId) return false
        return (get().byUser[userId] ?? EMPTY).hiddenStages.includes(stage)
      },

      toggleStage: (userId, stage) =>
        set(state => {
          const current = state.byUser[userId] ?? EMPTY
          const hiddenStages = current.hiddenStages.includes(stage)
            ? current.hiddenStages.filter(s => s !== stage)
            : [...current.hiddenStages, stage]
          return { byUser: { ...state.byUser, [userId]: { ...current, hiddenStages } } }
        }),

      reset: userId =>
        set(state => ({ byUser: { ...state.byUser, [userId]: { ...EMPTY } } })),
    }),
    { name: 'workflow-prefs-storage' },
  ),
)
