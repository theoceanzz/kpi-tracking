import { z } from 'zod'

export const submissionSchema = z.object({
  kpiCriteriaId: z.string().min(1, 'Vui lòng chọn chỉ tiêu'),
  actualValue: z.number().min(0, 'Giá trị không được âm'),
  note: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
})

export type SubmissionFormData = z.infer<typeof submissionSchema>
