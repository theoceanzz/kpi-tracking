import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { toast } from 'sonner'
import i18n from 'i18next'
import axiosInstance from '@/lib/axios'
import { getApiErrorMessage, UPLOAD_STALLED } from '@/lib/apiError'

/**
 * MỘT đường gửi multipart cho cả app — tệp đính kèm, ảnh, tài liệu, import Excel, AI đọc tệp. Mọi
 * `api.ts` gọi `sendMultipart` thay vì tự `axiosInstance.post(url, formData)`, để cùng có:
 *
 * - Không giới hạn tổng thời gian khi đang gửi: tệp 10MB trên mạng chậm có thể quá 100s mặc định
 *   của axios mà vẫn đang chạy tốt — bản cũ huỷ ngang những lượt đó.
 * - Phát hiện treo: {@link STALL_MS} không có byte nào đi thì huỷ (mã `UPLOAD_STALLED`, câu riêng
 *   trong `getApiErrorMessage`).
 * - Tự gửi lại khi hỏng TRƯỚC KHI gửi hết thân request (treo, rớt mạng). Máy chủ chưa nhận đủ
 *   multipart thì chắc chắn chưa xử lý gì, nên gửi lại không thể tạo bản trùng. Hỏng SAU khi đã gửi
 *   hết thì không tự gửi lại — máy chủ có thể đã lưu; để giao diện hiện nút Thử lại.
 * - Chờ phản hồi có hạn ({@link UploadConfig.responseTimeoutMs}) sau khi đã gửi xong.
 */

const STALL_MS = 45_000
const DEFAULT_RESPONSE_TIMEOUT_MS = 5 * 60_000
const DEFAULT_SLOW_AFTER_MS = 30_000
/** Số lần tự gửi lại khi hỏng trước khi gửi hết thân request. */
const SAFE_RETRIES = 2

export interface UploadConfig
  extends Omit<AxiosRequestConfig, 'url' | 'method' | 'data' | 'timeout' | 'onUploadProgress' | 'signal'> {
  method?: 'post' | 'put'
  signal?: AbortSignal
  onProgress?: (loaded: number, total: number) => void
  /** Đã gửi xong mà máy chủ chưa trả lời sau {@link slowAfterMs} — gọi một lần (để hiện nút Tải lại). */
  onSlow?: () => void
  slowAfterMs?: number
  /** Chờ phản hồi tối đa sau khi đã gửi xong. Mặc định 5 phút; lượt AI đọc tệp truyền giá trị riêng. */
  responseTimeoutMs?: number
}

/** Lỗi đáng cho người dùng bấm Thử lại: chưa có phản hồi (mạng, treo, timeout) hoặc máy chủ quá tải / 5xx. */
export function isRetryableUploadError(error: unknown): boolean {
  if (!axios.isAxiosError(error) || axios.isCancel(error)) return false
  const status = error.response?.status
  if (!status) return true
  return status >= 500 || status === 408 || status === 429
}

/**
 * Báo lỗi tải tệp, dùng chung mọi màn hình: lỗi thử lại được (mạng, treo, 5xx) thì toast kèm nút
 * Thử lại gửi lại đúng tệp đó — người dùng khỏi phải chọn lại tệp. Máy chủ từ chối hẳn (sai định
 * dạng, quá nặng, hết quyền) thì chỉ báo lỗi, vì gửi lại cũng bị từ chối y vậy.
 */
export function toastUploadError(error: unknown, retry?: () => void, fallback?: string) {
  const message = getApiErrorMessage(error, fallback)
  if (retry && isRetryableUploadError(error)) {
    toast.error(message, {
      duration: 15_000,
      action: { label: i18n.t('common:upload.retry'), onClick: retry },
    })
  } else {
    toast.error(message)
  }
}

export async function sendMultipart<T>(url: string, form: FormData, config: UploadConfig = {}): Promise<AxiosResponse<T>> {
  const {
    method = 'post',
    signal,
    onProgress,
    onSlow,
    slowAfterMs = DEFAULT_SLOW_AFTER_MS,
    responseTimeoutMs = DEFAULT_RESPONSE_TIMEOUT_MS,
    headers,
    ...rest
  } = config

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController()
    const onOuterAbort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    signal?.addEventListener('abort', onOuterAbort)

    let lastProgressAt = Date.now()
    let sentAt: number | null = null
    let reason: 'stalled' | 'timeout' | null = null
    let slowNotified = false

    const watchdog = window.setInterval(() => {
      const now = Date.now()
      if (sentAt == null) {
        if (now - lastProgressAt > STALL_MS) {
          reason = 'stalled'
          controller.abort()
        }
        return
      }
      if (!slowNotified && now - sentAt > slowAfterMs) {
        slowNotified = true
        onSlow?.()
      }
      if (responseTimeoutMs > 0 && now - sentAt > responseTimeoutMs) {
        reason = 'timeout'
        controller.abort()
      }
    }, 2_000)

    try {
      return await axiosInstance.request<T>({
        ...rest,
        url,
        method,
        data: form,
        // axiosInstance mặc định Content-Type JSON cho mọi request, đè lên header axios tự sinh cho FormData.
        headers: { ...(headers as Record<string, string> | undefined), 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        signal: controller.signal,
        onUploadProgress: e => {
          lastProgressAt = Date.now()
          const total = e.total ?? 0
          onProgress?.(e.loaded, total)
          if (total && e.loaded >= total && sentAt == null) sentAt = Date.now()
        },
      })
    } catch (error) {
      // Người gọi tự huỷ — trả nguyên lỗi huỷ, không thử lại.
      if (signal?.aborted) throw error

      const failedBeforeSent = sentAt == null
      const noResponse = reason != null || (axios.isAxiosError(error) && !error.response)
      if (failedBeforeSent && noResponse && attempt < SAFE_RETRIES) {
        await new Promise(r => setTimeout(r, 1_000 * (attempt + 1)))
        if (signal?.aborted) throw error
        continue
      }

      if (reason === 'stalled') {
        throw new AxiosError('Upload stalled', UPLOAD_STALLED, undefined, undefined, undefined)
      }
      if (reason === 'timeout') {
        throw new AxiosError('Upload response timeout', AxiosError.ECONNABORTED, undefined, undefined, undefined)
      }
      throw error
    } finally {
      window.clearInterval(watchdog)
      signal?.removeEventListener('abort', onOuterAbort)
    }
  }
}
