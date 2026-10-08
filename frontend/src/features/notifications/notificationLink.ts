import type { Notification } from '@/types/notification'

/**
 * Trang mở khi bấm một thông báo (ở chuông, trang Thông báo và popup lúc thông báo mới về). `null` = không có
 * trang riêng (bấm chỉ đánh dấu đã đọc).
 *
 * Mỗi loại trỏ về ĐÚNG màn mà người NHẬN loại đó cần xử lý — nên một loại có hai kiểu người nhận (người duyệt và
 * người gửi) phải là hai type khác nhau ở backend (`ADJUSTMENT_REQUEST`/`ADJUSTMENT_DECIDED`,
 * `REWARD_GIFT_REQUEST`/`REWARD_GIFT`), không đoán ở đây. Thêm loại mới ở đây khi backend gửi type mới.
 *
 * Dùng route cũ dạng `/my-kpi`, `/rewards`… thay vì `/me?section=…`: các route đó là redirect giữ nguyên query,
 * nên khi mục bị dời chỗ chỉ phải sửa ở router. Trang đích vẫn tự kiểm quyền — mất quyền thì báo, không trắng trang.
 */
export function notificationLink(n: Pick<Notification, 'type' | 'referenceId'>): string | null {
  switch (n.type) {
    // Bài nộp: người duyệt nhận bài mới/bị đẩy lên, người nộp nhận kết quả — cả hai mở chi tiết bài nộp.
    case 'SUBMISSION':
    case 'REVIEW':
      return n.referenceId ? `/submissions/${encodeURIComponent(n.referenceId)}` : '/submissions'

    // Chỉ tiêu: người duyệt → hàng chờ duyệt; người tạo → danh sách chỉ tiêu; người được giao → chỉ tiêu của tôi.
    case 'KPI_SUBMITTED':
      return '/kpi-criteria/pending'
    case 'KPI_APPROVED':
    case 'KPI_REJECTED':
    case 'KPI_APPROVAL_REVERTED':
      return '/kpi-criteria'
    case 'KPI_ASSIGNED':
    case 'KPI_REMINDER':
    case 'DEADLINE_REMINDER':
    case 'KPI_CYCLE_LOCKED':
      return '/my-kpi'

    // Điều chỉnh chỉ tiêu: người duyệt → hàng chờ; người xin → yêu cầu của tôi.
    case 'ADJUSTMENT_REQUEST':
      return '/kpi-adjustments/pending'
    case 'ADJUSTMENT_DECIDED':
      return '/my-adjustments'

    // Đánh giá.
    case 'EVALUATION_RESULT':
      return '/evaluations'
    case 'EVALUATION_REMINDER':
    case 'CYCLE_UNIT_FINALIZED':
      return '/kpi-cycles/evaluation'

    // BSC: chủ/duyệt thẻ → quản lý BSC; điểm bị sửa → BSC của tôi.
    case 'BSC_SCORECARD':
    case 'BSC_ASSIGNED':
      return '/bsc'
    case 'BSC_RESULT':
      return '/me?section=my-bsc'

    // Thưởng và ví.
    case 'REWARD_GRANT':
    case 'REWARD_GIFT_REQUEST':
      return '/rewards'
    case 'REWARD_POINT':
    case 'REWARD_GIFT':
      return '/rewards/me'
    case 'WALLET':
      return '/wallet/me'
    case 'WALLET_RECONCILE':
      return '/wallet'

    case 'FEEDBACK360':
      return '/me?section=my-feedback360'
    case 'AI_CRITERIA':
      return '/settings/tools?section=ai-review'

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
