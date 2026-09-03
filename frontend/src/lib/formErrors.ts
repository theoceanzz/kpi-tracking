import type { FieldErrors } from 'react-hook-form'
import { toast } from 'sonner'

/**
 * Lấy thông báo lỗi đầu tiên trong cây lỗi của react-hook-form. Lỗi của mảng nằm lồng
 * theo chỉ số (`levels.2.name`) nên phải duyệt đệ quy chứ không chỉ lấy khoá cấp một.
 */
export function firstErrorMessage(errors: unknown): string | undefined {
  if (!errors || typeof errors !== 'object') return undefined
  const node = errors as Record<string, unknown>
  if (typeof node.message === 'string' && node.message) return node.message
  for (const value of Object.values(node)) {
    const found = firstErrorMessage(value)
    if (found) return found
  }
  return undefined
}

/**
 * Nhánh `onInvalid` của `handleSubmit` cho các form chỉ tô viền đỏ (hoặc không hiện gì)
 * thay vì in thông báo dưới từng ô — không có nó thì bấm Lưu trông như không có phản ứng.
 */
export const toastFirstError = (errors: FieldErrors) => {
  toast.error(firstErrorMessage(errors) ?? 'Vui lòng kiểm tra lại thông tin đã nhập')
}
