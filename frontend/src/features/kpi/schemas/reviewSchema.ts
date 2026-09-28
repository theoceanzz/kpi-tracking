import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/** Lý do từ chối là bắt buộc — nhân viên phải biết vì sao KPI bị trả lại. */
export const rejectKpiSchema = perLanguage(() => (z.object({
  rejectReason: z.string().trim().min(1, i18n.t('kpi:reviewSchema.pleaseEnterTheRejectionReason')),
})))

export type RejectKpiFormData = z.infer<ReturnType<typeof rejectKpiSchema>>

/**
 * Duyệt/từ chối yêu cầu điều chỉnh KPI. Cùng một biểu mẫu phục vụ hai nút, và ô % bù trừ
 * chỉ xuất hiện khi PHÊ DUYỆT một yêu cầu ngưng KPI, nên ràng buộc phụ thuộc ngữ cảnh.
 */
export const createAdjustmentReviewSchema = ({ needsCompensation }: { needsCompensation: boolean }) =>
  z.object({
    reviewMode: z.enum(['view', 'reject', 'approve']),
    note: z.string(),
    compensationPercentage: z.string(),
  }).superRefine((data, ctx) => {
    if (data.reviewMode === 'reject' && !data.note.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: i18n.t('kpi:reviewSchema.pleaseEnterANoteWithThe') })
    }
    if (needsCompensation && data.reviewMode === 'approve') {
      const value = Number(data.compensationPercentage)
      if (data.compensationPercentage.trim() === '' || Number.isNaN(value) || value < 0 || value > 150) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['compensationPercentage'],
          message: i18n.t('kpi:reviewSchema.theCompensationMustBeBetween0'),
        })
      }
    }
  })

export type AdjustmentReviewFormData = z.infer<ReturnType<typeof createAdjustmentReviewSchema>>
