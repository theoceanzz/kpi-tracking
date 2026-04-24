import { z } from 'zod'

export const kpiSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên chỉ tiêu'),
  description: z.string().optional(),
  unit: z.string().optional(),
  weight: z.number().min(0).max(100, 'Trọng số tối đa 100').optional(),
  targetValue: z.number().min(0, 'Mục tiêu không được âm').optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'], { message: 'Vui lòng chọn tần suất' }),
  orgUnitId: z.string().optional(),
  assignedToId: z.string().optional(),
  assignedToIds: z.array(z.string()).optional(),
  minimumValue: z.number().min(0, 'Giá trị tối thiểu không được âm').optional(),
  kpiPeriodId: z.string().min(1, 'Vui lòng chọn đợt KPI'),
})

export type KpiFormData = z.infer<typeof kpiSchema>
