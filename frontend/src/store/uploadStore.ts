import { create } from 'zustand'
import axios from 'axios'
import axiosInstance from '@/lib/axios'
import { getApiErrorMessage } from '@/lib/apiError'
import { isRetryableUploadError, sendMultipart } from '@/lib/upload'
import { queryClient } from '@/lib/queryClient'
import i18n from 'i18next'
import type { Attachment } from '@/types/submission'

/*
 * Treo / timeout / tự gửi lại khi hỏng trước lúc gửi hết thân request: lo ở `sendMultipart`
 * (lib/upload.ts), dùng chung cả app. Ở đây chỉ thêm phần riêng của bài nộp: từng tệp một, thử
 * lại không gửi trùng tệp máy chủ đã lưu, và nút Thử lại / Tải lại trên thẻ tiến trình.
 */

/** Lỗi sau khi đã gửi hết (5xx, máy chủ trả lời chậm) được tự thử lại — có dò trùng — bấy nhiêu lần. */
const AUTO_RETRIES = 1

export type UploadStatus = 'uploading' | 'completed' | 'error'

export interface UploadTask {
  id: string
  submissionId: string
  fileName: string
  progress: number
  status: UploadStatus
  /** Lý do thất bại, lấy nguyên văn từ máy chủ. */
  message?: string
  /** Lỗi có đáng thử lại không: lỗi mạng / 5xx thì có, máy chủ từ chối tệp (4xx) thì không. */
  retryable?: boolean
  /** Đang chờ quá lâu (không có byte nào đi, hoặc máy chủ xử lý lâu) — hiện nút Tải lại. */
  slow?: boolean
  /** Số tệp đã lưu xong — thử lại chỉ gửi phần còn lại, không gửi trùng. */
  doneCount: number
  totalCount: number
}

interface UploadStore {
  tasks: UploadTask[]
  addUpload: (submissionId: string, files: File[]) => Promise<void>
  /** Gửi lại từ tệp đang dở (bỏ lần đang chạy nếu có). */
  retryTask: (id: string) => void
  removeTask: (id: string) => void
}

/** File và AbortController không đưa vào state (không serialize được, không cần render). */
const filesByTask = new Map<string, File[]>()
const controllers = new Map<string, AbortController>()
const runIds = new Map<string, number>()

export const useUploadStore = create<UploadStore>((set, get) => {
  const patch = (id: string, p: Partial<UploadTask>) =>
    set(state => ({ tasks: state.tasks.map(t => (t.id === id ? { ...t, ...p } : t)) }))

  /** Gửi MỘT tệp. Bấm Tải lại / đóng thẻ thì huỷ qua controller của task. */
  const uploadOne = (taskId: string, submissionId: string, file: File, onProgress: (loaded: number) => void) => {
    const controller = new AbortController()
    controllers.set(taskId, controller)
    const formData = new FormData()
    formData.append('files', file)
    return sendMultipart(`/submissions/${submissionId}/attachments`, formData, {
      signal: controller.signal,
      onProgress,
      // Máy chủ xử lý lâu bất thường: hiện nút Tải lại thay vì để thanh tiến trình đứng im.
      onSlow: () => patch(taskId, { slow: true }),
    }).finally(() => {
      if (controllers.get(taskId) === controller) controllers.delete(taskId)
    })
  }

  /**
   * Thử lại sau khi đã huỷ giữa chừng thì máy chủ có thể ĐÃ lưu tệp đó (huỷ lúc đang chờ trả lời).
   * Hỏi danh sách hiện có, tệp nào trùng tên + dung lượng thì bỏ qua thay vì gửi trùng.
   */
  const alreadyStored = async (submissionId: string): Promise<Set<string> | null> => {
    try {
      const res = await axiosInstance.get<{ data: Attachment[] }>(`/submissions/${submissionId}/attachments`)
      return new Set((res.data.data || []).map(a => `${a.fileName}|${a.fileSize}`))
    } catch {
      return null
    }
  }

  const run = async (taskId: string, isRetry = false): Promise<void> => {
    const task = get().tasks.find(t => t.id === taskId)
    const files = filesByTask.get(taskId)
    if (!task || !files) return

    // Mỗi lượt chạy một số hiệu: bấm Tải lại thì lượt cũ (kể cả đang ngủ chờ tự thử lại) tự dừng.
    const runId = (runIds.get(taskId) ?? 0) + 1
    runIds.set(taskId, runId)
    const superseded = () => runIds.get(taskId) !== runId || !get().tasks.some(t => t.id === taskId)

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1
    const bytesBefore = (i: number) => files.slice(0, i).reduce((sum, f) => sum + f.size, 0)
    patch(taskId, { status: 'uploading', message: undefined, retryable: undefined, slow: false })

    let stored = isRetry ? await alreadyStored(task.submissionId) : null
    if (superseded()) return

    // Từng tệp một: một tệp hỏng không kéo cả lô hỏng theo, và thử lại không gửi lại tệp đã lưu.
    for (let i = task.doneCount; i < files.length; i++) {
      const file = files[i]!
      if (stored?.has(`${file.name}|${file.size}`)) {
        patch(taskId, { doneCount: i + 1 })
        continue
      }
      for (let attempt = 0; ; attempt++) {
        try {
          await uploadOne(taskId, task.submissionId, file, loaded =>
            patch(taskId, { progress: Math.min(99, Math.round(((bytesBefore(i) + loaded) * 100) / totalBytes)) })
          )
          if (superseded()) return
          patch(taskId, { doneCount: i + 1, slow: false })
          queryClient.invalidateQueries({ queryKey: ['submissions'] })
          break
        } catch (error) {
          // Bị huỷ chủ động (bấm Tải lại / đóng thẻ) — lượt mới đã tự lo, im lặng.
          if (superseded() || axios.isCancel(error)) return
          const retryable = isRetryableUploadError(error)
          if (retryable && attempt < AUTO_RETRIES) {
            await new Promise(r => setTimeout(r, 1_500))
            if (superseded()) return
            stored = await alreadyStored(task.submissionId)
            if (superseded()) return
            if (stored?.has(`${file.name}|${file.size}`)) {
              patch(taskId, { doneCount: i + 1, slow: false })
              break
            }
            continue
          }
          // Máy chủ nói RÕ vì sao: quá nặng, sai định dạng, hay quá số tệp. Bản trước nuốt sạch, người
          // dùng chỉ thấy "Lỗi tải lên" nên không biết phải sửa gì để thử lại.
          const message = getApiErrorMessage(error, i18n.t('common:uploadStore.uploadFailed'))
          patch(taskId, { status: 'error', message, retryable, slow: false })
          return
        }
      }
    }

    patch(taskId, { status: 'completed', progress: 100, slow: false })
    filesByTask.delete(taskId)
    runIds.delete(taskId)
    // Auto-remove completed task after 10s
    setTimeout(() => get().removeTask(taskId), 10000)
  }

  return {
    tasks: [],
    addUpload: async (submissionId, files) => {
      const taskId = `${submissionId}-${Date.now()}`
      const taskName = files.length > 1 ? i18n.t('common:uploadStore.evidenceFiles', { count: files.length }) : (files[0]?.name || i18n.t('common:uploadStore.attachment'))
      filesByTask.set(taskId, files)
      set(state => ({
        tasks: [...state.tasks, {
          id: taskId,
          submissionId,
          fileName: taskName,
          progress: 0,
          status: 'uploading',
          doneCount: 0,
          totalCount: files.length,
        }],
      }))
      await run(taskId)
    },
    retryTask: id => {
      controllers.get(id)?.abort()
      controllers.delete(id)
      void run(id, true)
    },
    removeTask: id => {
      controllers.get(id)?.abort()
      controllers.delete(id)
      filesByTask.delete(id)
      runIds.delete(id)
      set(state => ({ tasks: state.tasks.filter(t => t.id !== id) }))
    },
  }
})

// Đang tải mà đóng/tải lại trang là mất tệp (File không lưu lại được) — hỏi trước.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', e => {
    if (useUploadStore.getState().tasks.some(t => t.status === 'uploading')) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
}
