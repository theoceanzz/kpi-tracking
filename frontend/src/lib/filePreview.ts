/**
 * Loại xem trước của một tệp — dùng chung cho thư viện tài liệu, tệp đính kèm bài nộp, minh chứng khi chấm và
 * tệp vừa chọn trên máy. Mọi loại ở đây xem được NGAY trong trình duyệt (không qua trình xem của bên thứ ba, nên
 * xem được cả tệp riêng tư đi qua backend có xác thực và tệp chưa tải lên).
 *
 * `null` = không xem trước được (.doc, .ppt… định dạng nhị phân cũ) — chỉ tải về.
 */
export type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'docx' | 'sheet' | 'text' | 'markdown'

export function previewKind(fileName: string | null | undefined, contentType?: string | null): PreviewKind | null {
  const name = (fileName ?? '').toLowerCase()
  const type = (contentType ?? '').toLowerCase()
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : ''
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return 'image'
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (type.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video'
  if (type.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac'].includes(ext)) return 'audio'
  if (ext === 'docx') return 'docx'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'sheet'
  if (ext === 'md' || type === 'text/markdown') return 'markdown'
  if (ext === 'txt' || type === 'text/plain') return 'text'
  return null
}

export function canPreview(fileName: string | null | undefined, contentType?: string | null): boolean {
  return previewKind(fileName, contentType) !== null
}
