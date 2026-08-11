import { z } from 'zod'

const kpiBaseSchema = z.object({
  kpiType: z.enum(['QUANTITATIVE', 'QUALITATIVE']),
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
  perspectiveId: z.string().optional().nullable(),
})

// Ràng buộc dùng khi TẠO/SỬA chỉ tiêu trong KpiFormModal — nơi người dùng nhập trực tiếp
// các trường đo lường, nên bắt buộc đầy đủ với KPI định lượng.
export const kpiSchema = kpiBaseSchema.superRefine((data, ctx) => {
  if (data.kpiType === 'QUALITATIVE') {
    // KPI định tính chia sẻ pool 100% trọng số nhưng không có mục tiêu số.
    if (data.weight == null || data.weight <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weight'], message: 'KPI định tính cần trọng số lớn hơn 0' })
    }
  } else {
    if (data.targetValue == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetValue'], message: 'Vui lòng nhập giá trị mục tiêu' })
    }
    if (data.minimumValue == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['minimumValue'], message: 'Vui lòng nhập mục tiêu tối thiểu' })
    }
    if (data.weight == null || data.weight <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weight'], message: 'Vui lòng nhập trọng số lớn hơn 0' })
    }
    if (!data.unit || !data.unit.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unit'], message: 'Vui lòng nhập đơn vị tính' })
    }
  }
})

// Ràng buộc nới lỏng dùng cho luồng KHÔNG chỉnh sửa các trường đo lường (VD: Giao việc/Ủy quyền).
// Giữ nguyên hành vi cũ để không chặn nhầm các KPI hợp lệ nhưng thiếu tối thiểu/đơn vị.
export const kpiDelegationSchema = kpiBaseSchema.superRefine((data, ctx) => {
  if (data.kpiType === 'QUALITATIVE') {
    if (data.weight == null || data.weight <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weight'], message: 'KPI định tính cần trọng số lớn hơn 0' })
    }
  } else {
    if (data.targetValue == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetValue'], message: 'Vui lòng nhập giá trị mục tiêu' })
    }
  }
})

export type KpiFormData = z.infer<typeof kpiSchema>
