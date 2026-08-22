import type { Accept } from 'react-dropzone'

/**
 * Bản soi gương của `com.kpitracking.service.AttachmentPolicy` phía máy chủ.
 *
 * Đây là chốt chặn LỊCH SỰ, không phải chốt chặn AN TOÀN: nó tồn tại để người dùng biết ngay tệp
 * hỏng, thay vì chờ tải xong 10MB rồi mới bị từ chối. Máy chủ vẫn là nơi quyết định — nó còn đối
 * chiếu cả mấy byte đầu của nội dung tệp, thứ mà trình duyệt không kiểm.
 *
 * Sửa ở đây thì phải sửa cả bên kia. Cặp giá trị dễ trôi khỏi nhau nhất là MAX_ATTACHMENT_BYTES và
 * `spring.servlet.multipart.max-file-size`.
 */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENT_FILES = 5

/** Khớp đúng map ALLOWED phía máy chủ. Cả kiểu MIME lẫn đuôi tệp, vì Windows hay gửi kiểu rỗng. */
export const ATTACHMENT_ACCEPT: Accept = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

/** Câu nêu loại tệp nhận được, dùng khi từ chối. Cùng lời với ALLOWED_HINT phía máy chủ. */
export const ATTACHMENT_TYPES_HINT =
  'Chỉ nhận ảnh (JPG, PNG, WebP), PDF, Word (DOC, DOCX) và Excel (XLS, XLSX)'

/** Dòng gợi ý dưới vùng kéo thả. Dựng từ chính các hằng ở trên để câu chữ không trôi khỏi con số. */
export const ATTACHMENT_HINT =
  `Ảnh, PDF, Word, Excel · tối đa ${MAX_ATTACHMENT_FILES} tệp, ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB mỗi tệp`

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx']

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export interface ScreenedEvidence {
  accepted: File[]
  rejected: { file: File; reason: string }[]
}

/**
 * Lọc một lô tệp người dùng vừa chọn.
 *
 * Trả về CẢ phần bị loại kèm lý do chứ không lặng lẽ bỏ đi: kéo thả 5 tệp mà chỉ thấy 3 tệp hiện
 * ra, không nói gì thêm, là kiểu hỏng khó chịu nhất — người dùng không biết mình đã mất tệp nào.
 *
 * @param current các tệp đang có, để đếm đúng trần số lượng
 */
export function screenEvidence(incoming: File[], current: File[] = []): ScreenedEvidence {
  const accepted: File[] = []
  const rejected: { file: File; reason: string }[] = []
  let room = MAX_ATTACHMENT_FILES - current.length

  for (const file of incoming) {
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      rejected.push({ file, reason: `"${file.name}" không đúng định dạng. ${ATTACHMENT_TYPES_HINT}.` })
      continue
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      rejected.push({
        file,
        reason: `"${file.name}" nặng ${formatBytes(file.size)}, vượt quá ${formatBytes(MAX_ATTACHMENT_BYTES)} mỗi tệp.`,
      })
      continue
    }
    if (file.size === 0) {
      rejected.push({ file, reason: `"${file.name}" rỗng. Hãy chọn lại tệp có nội dung.` })
      continue
    }
    if (room <= 0) {
      rejected.push({ file, reason: `"${file.name}" vượt quá ${MAX_ATTACHMENT_FILES} tệp cho phép.` })
      continue
    }

    accepted.push(file)
    room--
  }

  return { accepted, rejected }
}
