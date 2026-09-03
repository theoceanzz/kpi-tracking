import { z } from 'zod'
import { OkrStatus } from '../types'

export const objectiveSchema = z.object({
  code: z.string().min(1, 'Vui lòng nhập mã'),
  name: z.string().min(1, 'Vui lòng nhập tên mục tiêu'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu'),
  endDate: z.string().min(1, 'Vui lòng chọn ngày kết thúc'),
  status: z.enum(OkrStatus).optional(),
  orgUnitIds: z.array(z.string()).optional(),
  perspectiveId: z.string().nullable().optional(),
}).refine(
  data => !data.startDate || !data.endDate || new Date(data.endDate) >= new Date(data.startDate),
  { path: ['endDate'], message: 'Ngày kết thúc không được trước ngày bắt đầu' },
)

export type ObjectiveFormData = z.infer<typeof objectiveSchema>

export const keyResultSchema = z.object({
  code: z.string().min(1, 'Vui lòng nhập mã KR'),
  name: z.string().min(1, 'Vui lòng nhập tên KR'),
  description: z.string().optional(),
  unit: z.string().optional(),
  currentValue: z.number({ message: 'Giá trị hiện tại phải là số' }).optional(),
  targetValue: z.number({ message: 'Vui lòng nhập giá trị mục tiêu' }),
  objectiveId: z.string().min(1),
})

export type KeyResultFormData = z.infer<typeof keyResultSchema>
