import axios from 'axios'
import type { AxiosError } from 'axios'
import i18n from 'i18next'

/**
 * Thân lỗi chuẩn của backend: `ApiResponse.error(code, message)`.
 *
 * Một nguồn dịch duy nhất (docs/I18N_DESIGN.md §6): backend đã dịch `message` theo `Accept-Language`,
 * frontend hiển thị NGUYÊN VĂN và không giữ bản dịch nào của lỗi API. `code` chỉ dùng cho logic.
 * Frontend chỉ tự dịch lỗi của chính nó: mất mạng / timeout, và phản hồi không có thân JSON (nginx).
 */
type ApiErrorBody = {
  /** Mã ổn định (`ErrorCode` ở backend): `STALE_STATE`, `VALIDATION_FAILED`, `UNAUTHORIZED`... */
  code?: string
  message?: string
  /** Lỗi @Valid trả thêm map field -> message ở đây. */
  data?: unknown
  /** Mã tra cứu = X-Request-Id = requestId trong log server; backend chỉ gắn vào phản hồi lỗi. */
  requestId?: string
}

/**
 * Chi tiết từng field của lỗi validate (`VALIDATION_FAILED`): tên field DTO → câu đã dịch. Dùng để
 * `setError(field, { message })` tô đỏ đúng ô. Không phải lỗi validate thì trả object rỗng.
 */
export function getApiFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) return {}
  const data = (error as AxiosError<ApiErrorBody>).response?.data?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0
    )
  )
}

/** Mã lỗi backend để rẽ nhánh logic (tải lại khi `STALE_STATE`...). Không phải lỗi API thì null. */
export function getApiErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null
  const code = (error as AxiosError<ApiErrorBody>).response?.data?.code
  return typeof code === 'string' && code ? code : null
}

/**
 * Phản hồi KHÔNG có thân JSON = lỗi do tầng hạ tầng trả về (nginx, proxy), backend không kịp nói gì.
 * Đây là chỗ duy nhất frontend tự đặt câu theo HTTP status.
 */
const infrastructureMessage = (status: number): string | null => {
  if (status === 413) return i18n.t('errors.fileTooLarge')
  if (status === 502 || status === 503 || status === 504) return i18n.t('errors.serverUnavailable')
  return null
}

/**
 * Lấy thông báo lỗi để hiển thị cho người dùng, ưu tiên message backend trả về.
 *
 * Backend dựng sẵn câu cụ thể cho từng luật nghiệp vụ ("Tổng trọng số vượt 100%"...), nên
 * `onError: () => toast.error('Thao tác thất bại')` là vứt đi đúng phần hữu ích nhất.
 * `fallback` chỉ dùng khi server không nói gì (lỗi của client, hoặc thân JSON không có message).
 */
export function getApiErrorMessage(error: unknown, fallback?: string): string {
  const fallbackMessage = fallback ?? i18n.t('errors.generic')

  // Không phải lỗi HTTP thì là bug phía client (undefined, parse hỏng...). Message của
  // những lỗi này là tiếng Anh kỹ thuật, đẩy ra toast chỉ làm người dùng hoang mang.
  if (!axios.isAxiosError(error)) return fallbackMessage

  const axiosError = error as AxiosError<ApiErrorBody>
  const response = axiosError.response

  // Không có response: request chưa tới được server (mất mạng, CORS, timeout).
  if (!response) {
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return i18n.t('errors.timeout')
    }
    return i18n.t('errors.network')
  }

  const body = response.data
  const hasJsonBody = !!body && typeof body === 'object'
  const serverMessage = hasJsonBody && typeof body.message === 'string' ? body.message.trim() : ''
  const details = Object.values(getApiFieldErrors(error))
  // Người dùng báo CSKH kèm 8 ký tự đầu của mã là đủ để tìm đúng dòng log; lỗi 4xx do nhập sai
  // (400/422) không cần mã — chỉ gắn cho lỗi hệ thống / quyền / quá tải.
  const requestId = hasJsonBody && typeof body.requestId === 'string' ? body.requestId : ''
  const needsRef = response.status >= 500 || response.status === 403 || response.status === 429
  const withRef = (message: string) =>
    requestId && needsRef ? i18n.t('errors.withRef', { message, ref: requestId.slice(0, 8) }) : message

  if (details.length > 0) {
    // Chi tiết từng field cụ thể hơn câu tổng quát, nên đứng trước.
    return details.join('; ')
  }
  if (serverMessage) return withRef(serverMessage)
  if (!hasJsonBody) return infrastructureMessage(response.status) ?? fallbackMessage

  return withRef(fallbackMessage)
}
