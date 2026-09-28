import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const kpiBaseSchema = perLanguage(() => (z.object({
  kpiType: z.enum(['QUANTITATIVE', 'QUALITATIVE']),
  name: z.string().min(1, i18n.t('kpi:kpiSchema.pleaseEnterTheKpiName')),
  description: z.string().optional(),
  unit: z.string().optional(),
  weight: z.number().min(0).max(100, i18n.t('kpi:kpiSchema.weightCanBeAtMost100')).optional(),
  targetValue: z.number().min(0, i18n.t('kpi:kpiSchema.theTargetCannotBeNegative')).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'UNLIMITED'], { message: i18n.t('kpi:kpiSchema.pleaseChooseAFrequency') }),
  orgUnitId: z.string().optional(),
  orgUnitIds: z.array(z.string()).optional(),
  assignedToId: z.string().optional(),
  assignedToIds: z.array(z.string()).optional(),
  minimumValue: z.number().min(0, i18n.t('kpi:kpiSchema.theMinimumValueCannotBeNegative')).optional(),
  isReverseKpi: z.boolean().optional(),
  isBonusKpi: z.boolean().optional(),
  deadline: z.string().optional().nullable(),
  kpiPeriodId: z.string().min(1, i18n.t('kpi:kpiSchema.pleaseChooseAKpiPeriod')),
  keyResultId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  parentRelationType: z.enum(['DELEGATION', 'DECOMPOSITION']).optional().nullable(),
  perspectiveId: z.string().optional().nullable(),
})))

// Ràng buộc dùng khi TẠO/SỬA chỉ tiêu trong KpiFormModal — nơi người dùng nhập trực tiếp
// các trường đo lường, nên bắt buộc đầy đủ với KPI định lượng.
export const kpiSchema = perLanguage(() => (kpiBaseSchema().superRefine((data, ctx) => {
  if (data.kpiType === 'QUALITATIVE') {
    // KPI định tính chia sẻ pool 100% trọng số nhưng không có mục tiêu số.
    if (data.weight == null || data.weight <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weight'], message: i18n.t('kpi:kpiSchema.qualitativeKpisNeedAWeightGreater') })
    }
  } else {
    if (data.targetValue == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetValue'], message: i18n.t('kpi:kpiSchema.pleaseEnterTheTargetValue') })
    }
    if (data.minimumValue == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['minimumValue'], message: i18n.t('kpi:kpiSchema.pleaseEnterTheMinimumTarget') })
    }
    if (data.weight == null || data.weight <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weight'], message: i18n.t('kpi:kpiSchema.pleaseEnterAWeightGreaterThan') })
    }
    if (!data.unit || !data.unit.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unit'], message: i18n.t('kpi:kpiSchema.pleaseEnterTheUnitOfMeasure') })
    }
  }
})))

// Ràng buộc nới lỏng dùng cho luồng KHÔNG chỉnh sửa các trường đo lường (VD: Giao việc/Ủy quyền).
// Giữ nguyên hành vi cũ để không chặn nhầm các KPI hợp lệ nhưng thiếu tối thiểu/đơn vị.
export const kpiDelegationSchema = perLanguage(() => (kpiBaseSchema().superRefine((data, ctx) => {
  if (data.kpiType === 'QUALITATIVE') {
    if (data.weight == null || data.weight <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weight'], message: i18n.t('kpi:kpiSchema.qualitativeKpisNeedAWeightGreater') })
    }
  } else {
    if (data.targetValue == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetValue'], message: i18n.t('kpi:kpiSchema.pleaseEnterTheTargetValue') })
    }
  }
})))

export type KpiFormData = z.infer<ReturnType<typeof kpiSchema>>
