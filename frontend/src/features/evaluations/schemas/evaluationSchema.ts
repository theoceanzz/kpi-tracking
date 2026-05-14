import { z } from 'zod'

export const evaluationSchema = z.object({
  userId: z.string().min(1, 'Vui lòng chọn nhân viên'),
  kpiPeriodId: z.string().min(1, 'Vui lòng chọn đợt KPI'),
  score: z.number().min(0, 'Điểm tối thiểu 0'),
  comment: z.string().optional(),
})

export type EvaluationFormData = z.infer<typeof evaluationSchema>
