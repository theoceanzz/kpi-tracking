import { z } from 'zod'

export const kpiSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên chỉ tiêu'),
  description: z.string().optional(),
  unit: z.string().optional(),
  weight: z.number().min(0).max(100, 'Trọng số tối đa 100').optional(),
  targetValue: z.number().min(0, 'Mục tiêu không được âm').optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'UNLIMITED'], { message: 'Vui lòng chọn tần suất' }),
  orgUnitId: z.string().optional(),
  orgUnitIds: z.array(z.string()).optional(),
  assignedToId: z.string().optional(),
  assignedToIds: z.array(z.string()).optional(),
  minimumValue: z.number().min(0, 'Giá trị tối thiểu không được âm').optional(),
  isReverseKpi: z.boolean().optional(),
  isBonusKpi: z.boolean().optional(),
  deadline: z.string().optional().nullable(),
  kpiPeriodId: z.string().min(1, 'Vui lòng chọn đợt KPI'),
  keyResultId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  parentRelationType: z.enum(['DELEGATION', 'DECOMPOSITION']).optional().nullable(),
})

export type KpiFormData = z.infer<typeof kpiSchema>
