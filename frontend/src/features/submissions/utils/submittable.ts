import type { KpiCriteria } from '@/types/kpi'

/**
 * Chỉ tiêu này người dùng còn nộp báo cáo được không.
 *
 * Bốn điều kiện phải đúng CÙNG LÚC, và cả bốn đều là luật của backend chứ không phải quy ước giao
 * diện — chép lại thiếu một cái là bày ra ô nhập rồi để server từ chối:
 *
 * 1. Trạng thái đã có hiệu lực (`APPROVED` / `EDIT` / `EDITED`) — bản nháp chưa duyệt thì chưa nộp được.
 * 2. Chưa nộp đủ số lượt mà tần suất đòi (`submissionCount < expectedSubmissions`).
 * 3. Đúng người được giao.
 * 4. Đang trong khoảng thời gian của đợt.
 *
 * Trước đây hàm này nằm riêng trong `NewSubmissionPage`; tách ra đây để trình thiết lập dùng chung
 * đúng một định nghĩa, không phải hai bản dễ trôi lệch nhau.
 */
export function isSubmittableByUser(k: KpiCriteria, userId?: string): boolean {
  return notSubmittableReason(k, userId) === undefined
}

/**
 * Vì sao chỉ tiêu này CHƯA nộp được — `undefined` nghĩa là nộp được.
 *
 * Cùng một bộ điều kiện với {@link isSubmittableByUser}, chỉ khác là nói ra được lý do. Màn hình
 * gom nhiều chỉ tiêu cần điều này: lọc thẳng những cái không nộp được ra khỏi danh sách khiến
 * người vừa tạo bốn chỉ tiêu nhìn thấy một trang trống mà không hiểu chúng đi đâu.
 */
export function notSubmittableReason(k: KpiCriteria, userId?: string): string | undefined {
  if (!(k.status === 'APPROVED' || k.status === 'EDITED' || k.status === 'EDIT')) {
    return 'Chưa được duyệt'
  }
  if (k.submissionCount >= k.expectedSubmissions) return 'Đã nộp đủ số lượt'
  if (!userId || !k.assigneeIds?.includes(userId)) return 'Không giao cho bạn'

  const now = new Date()
  if (k.kpiPeriod?.startDate && new Date(k.kpiPeriod.startDate) > now) return 'Đợt chưa bắt đầu'
  if (k.kpiPeriod?.endDate && new Date(k.kpiPeriod.endDate) < now) return 'Đợt đã kết thúc'

  return undefined
}
