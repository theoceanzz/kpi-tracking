import { z } from 'zod'

/** Lý do từ chối là bắt buộc — nhân viên phải biết vì sao KPI bị trả lại. */
export const rejectKpiSchema = z.object({
  rejectReason: z.string().trim().min(1, 'Vui lòng nhập lý do từ chối'),
})

export type RejectKpiFormData = z.infer<typeof rejectKpiSchema>

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
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Vui lòng nhập ghi chú lý do từ chối' })
    }
    if (needsCompensation && data.reviewMode === 'approve') {
      const value = Number(data.compensationPercentage)
      if (data.compensationPercentage.trim() === '' || Number.isNaN(value) || value < 0 || value > 150) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['compensationPercentage'],
          message: 'Tỷ lệ % bù trừ phải nằm trong khoảng 0 – 150',
        })
      }
    }
  })

export type AdjustmentReviewFormData = z.infer<ReturnType<typeof createAdjustmentReviewSchema>>
