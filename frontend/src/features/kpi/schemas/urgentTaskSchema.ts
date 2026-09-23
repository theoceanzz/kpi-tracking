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

/**
 * Phần "KPI mới" dùng CHUNG cho cả hai tab của việc khẩn — cùng tên trường để một khối form
 * (`UrgentKpiFields`) vẽ được cho cả hai, thay vì mỗi tab một bản chép với tiền tố `new*`.
 */
export const newKpiFields = {
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
}

const refineNewKpi = (data: { kpiType: z.infer<typeof kpiTypeSchema>; targetValue: string; minimumValue: string; unit: string }, ctx: z.RefinementCtx) => {
  // KPI định tính không có mục tiêu số nên bỏ qua ba ô đo lường.
  requiredWhenQuantitative(ctx, data.kpiType, data.targetValue, 'targetValue', 'Vui lòng nhập mục tiêu mong muốn')
  requiredWhenQuantitative(ctx, data.kpiType, data.minimumValue, 'minimumValue', 'Vui lòng nhập mục tiêu tối thiểu')
  requiredWhenQuantitative(ctx, data.kpiType, data.unit, 'unit', 'Vui lòng nhập đơn vị tính')
}

export type NewKpiFields = z.infer<z.ZodObject<typeof newKpiFields>>

export const NEW_KPI_DEFAULTS: NewKpiFields = {
  kpiType: 'QUANTITATIVE', name: '', description: '', frequency: 'MONTHLY',
  targetValue: '', minimumValue: '', unit: '', isReverseKpi: false, isBonusKpi: false,
  deadline: '', keyResultId: 'NONE', perspectiveId: 'NONE', assignedToIds: [],
}

/** Tab "Thay thế": khai tử một KPI và dựng KPI mới thế chỗ (kế thừa trọng số). */
export const replaceKpiSchema = z.object({
  replacedKpiId: z.string().min(1, 'Vui lòng chọn KPI cần thay thế'),
  replacementReason: z.string(),
  ...newKpiFields,
}).superRefine(refineNewKpi)

export type ReplaceFormData = z.infer<typeof replaceKpiSchema>

/** Tab "Điều chỉnh": chia lại trọng số các KPI hiện có rồi chèn thêm một KPI khẩn. */
export const adjustKpiSchema = z.object({
  weights: z.array(z.object({
    kpiId: z.string(),
    name: z.string(),
    currentWeight: z.number(),
    newWeight: z.number({ message: 'Trọng số phải là số' }),
  })),
  // Ô này không dùng valueAsNumber nên giá trị vào schema là chuỗi ('' khi bỏ trống).
  weight: z.union([z.string(), z.number()])
    .refine(v => parseFloat(String(v)) > 0, 'Vui lòng nhập trọng số lớn hơn 0'),
  ...newKpiFields,
}).superRefine(refineNewKpi)

export type AdjustFormData = z.infer<typeof adjustKpiSchema>
