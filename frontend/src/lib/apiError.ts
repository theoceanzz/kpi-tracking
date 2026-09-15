import axios from 'axios'
import type { AxiosError } from 'axios'

/** Thân lỗi chuẩn của backend: `ApiResponse.error(message)`. */
type ApiErrorBody = {
  message?: string
  /** Lỗi @Valid trả thêm map field -> message ở đây. */
  data?: unknown
}

const DEFAULT_FALLBACK = 'Đã có lỗi xảy ra, vui lòng thử lại'

/**
 * MethodArgumentNotValidException chỉ đặt message chung là "Dữ liệu không hợp lệ" rồi
 * nhét chi tiết từng field vào `data`. Không đọc phần này thì người dùng không biết ô nào sai.
 */
const fieldMessages = (data: unknown): string[] => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  return Object.values(data as Record<string, unknown>).filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  )
}

/** Chỉ dùng khi server không nói gì — vẫn cụ thể hơn "thao tác thất bại". */
const messageByStatus = (status: number, fallback: string): string => {
  switch (status) {
    case 400:
      return 'Dữ liệu gửi lên không hợp lệ'
    case 401:
      return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
    case 403:
      return 'Bạn không có quyền thực hiện thao tác này'
    case 404:
      return 'Không tìm thấy dữ liệu, có thể đã bị xoá hoặc thay đổi'
    case 409:
      return 'Dữ liệu đã tồn tại hoặc đang bị trùng'
    case 413:
      return 'Tệp tin vượt quá dung lượng cho phép'
    case 429:
      return 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút'
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Máy chủ đang gặp sự cố, vui lòng thử lại sau'
    default:
      return fallback
  }
}

/**
 * Lấy thông báo lỗi để hiển thị cho người dùng, ưu tiên message backend trả về.
 *
 * Backend đã dựng sẵn câu tiếng Việt cụ thể cho từng luật nghiệp vụ
 * ("Tổng trọng số vượt 100%", "Chỉ tiêu đã được duyệt, không thể sửa"...), nên
 * `onError: () => toast.error('Thao tác thất bại')` là vứt đi đúng phần hữu ích nhất.
 * `fallback` chỉ để dành cho lỗi mạng hoặc lỗi không có thân phản hồi.
 */
export function getApiErrorMessage(error: unknown, fallback: string = DEFAULT_FALLBACK): string {
  // Không phải lỗi HTTP thì là bug phía client (undefined, parse hỏng...). Message của
  // những lỗi này là tiếng Anh kỹ thuật, đẩy ra toast chỉ làm người dùng hoang mang.
  if (!axios.isAxiosError(error)) return fallback

  const axiosError = error as AxiosError<ApiErrorBody>
  const response = axiosError.response

  // Không có response: request chưa tới được server (mất mạng, CORS, timeout).
  if (!response) {
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return 'Yêu cầu xử lý quá lâu và đã bị huỷ, vui lòng thử lại'
    }
    return 'Không kết nối được tới máy chủ, vui lòng kiểm tra đường truyền'
  }

  const body = response.data
  const serverMessage = typeof body?.message === 'string' ? body.message.trim() : ''
  const details = fieldMessages(body?.data)

  if (details.length > 0) {
    // Chi tiết từng field cụ thể hơn câu tổng quát, nên đứng trước.
    return details.join('; ')
  }
  if (serverMessage) return serverMessage

  return messageByStatus(response.status, fallback)
}
