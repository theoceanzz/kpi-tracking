import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

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
export const newKpiFields = perLanguage(() => ({
  kpiType: kpiTypeSchema,
  name: z.string().min(1, i18n.t('kpi:urgentTaskSchema.pleaseEnterTheNewKpiName')),
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
}))

const refineNewKpi = (data: { kpiType: z.infer<typeof kpiTypeSchema>; targetValue: string; minimumValue: string; unit: string }, ctx: z.RefinementCtx) => {
  // KPI định tính không có mục tiêu số nên bỏ qua ba ô đo lường.
  requiredWhenQuantitative(ctx, data.kpiType, data.targetValue, 'targetValue', i18n.t('kpi:urgentTaskSchema.pleaseEnterTheDesiredTarget'))
  requiredWhenQuantitative(ctx, data.kpiType, data.minimumValue, 'minimumValue', i18n.t('kpi:urgentTaskSchema.pleaseEnterTheMinimumTarget'))
  requiredWhenQuantitative(ctx, data.kpiType, data.unit, 'unit', i18n.t('kpi:urgentTaskSchema.pleaseEnterTheUnitOfMeasure'))
}

export type NewKpiFields = z.infer<z.ZodObject<ReturnType<typeof newKpiFields>>>

export const NEW_KPI_DEFAULTS: NewKpiFields = {
  kpiType: 'QUANTITATIVE', name: '', description: '', frequency: 'MONTHLY',
  targetValue: '', minimumValue: '', unit: '', isReverseKpi: false, isBonusKpi: false,
  deadline: '', keyResultId: 'NONE', perspectiveId: 'NONE', assignedToIds: [],
}

/** Tab "Thay thế": khai tử một KPI và dựng KPI mới thế chỗ (kế thừa trọng số). */
export const replaceKpiSchema = perLanguage(() => (z.object({
  replacedKpiId: z.string().min(1, i18n.t('kpi:urgentTaskSchema.pleaseChooseTheKpiToReplace')),
  replacementReason: z.string(),
  ...newKpiFields(),
}).superRefine(refineNewKpi)))

export type ReplaceFormData = z.infer<ReturnType<typeof replaceKpiSchema>>

/** Tab "Điều chỉnh": chia lại trọng số các KPI hiện có rồi chèn thêm một KPI khẩn. */
export const adjustKpiSchema = perLanguage(() => (z.object({
  weights: z.array(z.object({
    kpiId: z.string(),
    name: z.string(),
    currentWeight: z.number(),
    newWeight: z.number({ message: i18n.t('kpi:urgentTaskSchema.weightMustBeANumber') }),
  })),
  // Ô này không dùng valueAsNumber nên giá trị vào schema là chuỗi ('' khi bỏ trống).
  weight: z.union([z.string(), z.number()])
    .refine(v => parseFloat(String(v)) > 0, i18n.t('kpi:urgentTaskSchema.pleaseEnterAWeightGreaterThan')),
  ...newKpiFields(),
}).superRefine(refineNewKpi)))

export type AdjustFormData = z.infer<ReturnType<typeof adjustKpiSchema>>
