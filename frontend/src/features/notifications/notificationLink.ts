import type { Notification } from '@/types/notification'

/**
 * Trang mở khi bấm một thông báo. `null` = không có trang riêng (bấm chỉ đánh dấu đã đọc, như trước).
 *
 * Thêm loại mới ở đây khi backend gửi `referenceId` trỏ được tới một màn cụ thể. Tài liệu mở qua `?doc=` — trang Tài
 * liệu vẫn kiểm quyền, mất quyền thì báo không mở được thay vì lỗi trắng trang.
 */
export function notificationLink(n: Pick<Notification, 'type' | 'referenceId'>): string | null {
  switch (n.type) {
    case 'DOCUMENT_SHARED':
    case 'DOCUMENT_PROMOTION':
    case 'DOCUMENT_REVIEW':
      return n.referenceId ? `/documents?doc=${encodeURIComponent(n.referenceId)}` : '/documents'
    case 'DOCUMENT_PROMOTION_REQUEST':
      return '/documents?tab=requests'
    default:
      return null
  }
}
