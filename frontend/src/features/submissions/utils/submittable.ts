import type { KpiCriteria } from '@/types/kpi'
import { kpiLockReason } from '@/features/kpi/utils/cycleLockReason'
import { isResubmitOpen } from '@/features/kpi/utils/myKpiStatus'
import i18n from 'i18next'

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
 * 5. Kỳ chứa đợt chưa khoá (CycleStatusGuard ở backend).
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
  const locked = kpiLockReason(k)
  if (locked) return locked
  if (!(k.status === 'APPROVED' || k.status === 'EDITED' || k.status === 'EDIT')) {
    return i18n.t('submissions:submittable.notApprovedYet')
  }
  if (k.submissionCount >= k.expectedSubmissions) return i18n.t('submissions:submittable.allSubmissionsMade')
  if (!userId || !k.assigneeIds?.includes(userId)) return i18n.t('submissions:submittable.notAssignedToYou')

  const now = new Date()
  // Bài bị trả lại còn hạn nộp lại ⇒ được nộp bài mới dù đợt đã hết hạn.
  if (isResubmitOpen(k, now)) return undefined
  if (k.kpiPeriod?.startDate && new Date(k.kpiPeriod.startDate) > now) return i18n.t('submissions:submittable.thePeriodHasNotStarted')
  if (k.kpiPeriod?.endDate && new Date(k.kpiPeriod.endDate) < now) return i18n.t('submissions:submittable.thePeriodHasEnded')

  return undefined
}
