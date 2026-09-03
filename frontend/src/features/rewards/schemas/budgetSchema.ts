import { z } from 'zod'

/** Ba cách khoanh thời gian, chọn đúng một. Backend từ chối nếu gửi cả kỳ lẫn đợt. */
export const scopeModeSchema = z.enum(['CYCLE', 'PERIOD', 'DATES'])
export type ScopeMode = z.infer<typeof scopeModeSchema>

export const budgetSchema = z.object({
  grantorUserId: z.string().min(1, 'Vui lòng chọn người được cấp hạn mức'),
  grantorLabel: z.string(),
  scopeMode: scopeModeSchema,
  kpiCycleId: z.string(),
  kpiPeriodId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  allocatedPoints: z.number({ message: 'Vui lòng nhập tổng điểm được cấp' })
    .min(0, 'Tổng điểm không được âm'),
  maxPerAward: z.number().min(1, 'Tối đa mỗi người/lần phải lớn hơn 0').optional(),
  note: z.string(),
}).superRefine((data, ctx) => {
  // Mỗi cách khoanh thời gian đòi đúng phần dữ liệu của nó; phần còn lại bị bỏ khi gửi.
  if (data.scopeMode === 'CYCLE' && !data.kpiCycleId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['kpiCycleId'], message: 'Vui lòng chọn kỳ đánh giá' })
  }
  if (data.scopeMode === 'PERIOD' && !data.kpiPeriodId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['kpiPeriodId'], message: 'Vui lòng chọn đợt đánh giá' })
  }
  if (data.scopeMode === 'DATES') {
    if (!data.periodStart) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodStart'], message: 'Vui lòng chọn ngày bắt đầu' })
    }
    if (!data.periodEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodEnd'], message: 'Vui lòng chọn ngày kết thúc' })
    }
    if (data.periodStart && data.periodEnd && new Date(data.periodEnd) < new Date(data.periodStart)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodEnd'], message: 'Ngày kết thúc không được trước ngày bắt đầu' })
    }
  }
})

export type BudgetFormData = z.infer<typeof budgetSchema>
