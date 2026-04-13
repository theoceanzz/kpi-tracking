import { z } from 'zod'

export const evaluationSchema = z.object({
  userId: z.string().min(1, 'Vui lòng chọn nhân viên'),
  kpiCriteriaId: z.string().min(1, 'Vui lòng chọn chỉ tiêu KPI'),
  score: z.number().min(0, 'Điểm tối thiểu 0').max(100, 'Điểm tối đa 100'),
  comment: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
})

export type EvaluationFormData = z.infer<typeof evaluationSchema>
