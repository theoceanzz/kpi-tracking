import { z } from 'zod'

export const submissionSchema = z.object({
  kpiCriteriaId: z.string().min(1, 'Vui lòng chọn chỉ tiêu'),
  // Optional so qualitative KPIs (no numeric value) can be submitted; the backend
  // still requires a value for quantitative KPIs.
  actualValue: z.number().min(0, 'Giá trị không được âm').optional(),
  qualitativeLevelId: z.string().optional(),
  note: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
})

export type SubmissionFormData = z.infer<typeof submissionSchema>
