import { z } from 'zod'

const kpiTypeSchema = z.enum(['QUANTITATIVE', 'QUALITATIVE'])
const kpiFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'UNLIMITED'])

/** Ô số ở hai tab này giữ nguyên dạng chuỗi rồi mới parseFloat khi gửi, nên schema kiểm trên chuỗi. */
const requiredWhenQuantitative = (
  ctx: z.RefinementCtx,
  kpiType: z.infer<typeof kpiTypeSchema>,
  value: string,
  path: string,
  message: string,
) => {
  if (kpiType !== 'QUALITATIVE' && String(value ?? '').trim() === '') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
  }
}

/** Tab "Thay thế": khai tử một KPI và dựng KPI mới thế chỗ. */
export const replaceKpiSchema = z.object({
  replacedKpiId: z.string().min(1, 'Vui lòng chọn KPI cần thay thế'),
  replacementReason: z.string(),
  kpiType: kpiTypeSchema,
  name: z.string().min(1, 'Vui lòng nhập tên KPI mới'),
  description: z.string(),
  frequency: kpiFrequencySchema,
  targetValue: z.string(),
  minimumValue: z.string(),
  unit: z.string(),
  isReverseKpi: z.boolean(),
  isBonusKpi: z.boolean(),
  deadline: z.string(),
  keyResultId: z.string(),
  perspectiveId: z.string(),
  assignedToIds: z.array(z.string()),
}).superRefine((data, ctx) => {
  // KPI định tính không có mục tiêu số nên bỏ qua ba ô đo lường.
  requiredWhenQuantitative(ctx, data.kpiType, data.targetValue, 'targetValue', 'Vui lòng nhập mục tiêu mong muốn')
  requiredWhenQuantitative(ctx, data.kpiType, data.minimumValue, 'minimumValue', 'Vui lòng nhập mục tiêu tối thiểu')
  requiredWhenQuantitative(ctx, data.kpiType, data.unit, 'unit', 'Vui lòng nhập đơn vị tính')
})

export type ReplaceFormData = z.infer<typeof replaceKpiSchema>

/** Tab "Điều chỉnh": chia lại trọng số các KPI hiện có rồi chèn thêm một KPI khẩn. */
export const adjustKpiSchema = z.object({
  weights: z.array(z.object({
    kpiId: z.string(),
    name: z.string(),
    currentWeight: z.number(),
    newWeight: z.number({ message: 'Trọng số phải là số' }),
  })),
  newKpiType: kpiTypeSchema,
  newName: z.string().min(1, 'Vui lòng nhập tên KPI mới'),
  // Ô này không dùng valueAsNumber nên giá trị vào schema là chuỗi ('' khi bỏ trống).
  newWeight: z.union([z.string(), z.number()])
    .refine(v => parseFloat(String(v)) > 0, 'Vui lòng nhập trọng số lớn hơn 0'),
  newFrequency: kpiFrequencySchema,
  newTargetValue: z.string(),
  newMinimumValue: z.string(),
  newUnit: z.string(),
  newIsReverseKpi: z.boolean(),
  newIsBonusKpi: z.boolean(),
  newDeadline: z.string(),
  newKeyResultId: z.string(),
  newPerspectiveId: z.string(),
  newAssignedToIds: z.array(z.string()),
  newDescription: z.string(),
}).superRefine((data, ctx) => {
  requiredWhenQuantitative(ctx, data.newKpiType, data.newTargetValue, 'newTargetValue', 'Vui lòng nhập mục tiêu mong muốn')
  requiredWhenQuantitative(ctx, data.newKpiType, data.newMinimumValue, 'newMinimumValue', 'Vui lòng nhập mục tiêu tối thiểu')
  requiredWhenQuantitative(ctx, data.newKpiType, data.newUnit, 'newUnit', 'Vui lòng nhập đơn vị tính')
})

export type AdjustFormData = z.infer<typeof adjustKpiSchema>
