import { z } from 'zod'

export const createReportSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên báo cáo'),
  description: z.string(),
})

export type CreateReportFormData = z.infer<typeof createReportSchema>
