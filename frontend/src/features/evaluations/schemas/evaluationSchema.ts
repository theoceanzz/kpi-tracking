import { z } from 'zod'

export const evaluationSchema = z.object({
  userId: z.string().min(1, 'Vui lòng chọn nhân viên'),
  kpiCriteriaId: z.string().min(1, 'Vui lòng chọn chỉ tiêu KPI'),
  score: z.number().min(0, 'Điểm tối thiểu 0').max(100, 'Điểm tối đa 100'),
  comment: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
}).refine((data) => {
  if (data.periodStart && data.periodEnd) {
    return new Date(data.periodEnd) >= new Date(data.periodStart)
  }
  return true
}, {
  message: 'Ngày kết thúc không thể trước ngày bắt đầu',
  path: ['periodEnd'],
})

export type EvaluationFormData = z.infer<typeof evaluationSchema>
