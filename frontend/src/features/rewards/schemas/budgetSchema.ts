import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/** Ba cách khoanh thời gian, chọn đúng một. Backend từ chối nếu gửi cả kỳ lẫn đợt. */
export const scopeModeSchema = z.enum(['CYCLE', 'PERIOD', 'DATES'])
export type ScopeMode = z.infer<typeof scopeModeSchema>

export const budgetSchema = perLanguage(() => (z.object({
  grantorUserId: z.string().min(1, i18n.t('rewards:budgetSchema.pleaseChooseTheBudgetRecipient')),
  grantorLabel: z.string(),
  scopeMode: scopeModeSchema,
  kpiCycleId: z.string(),
  kpiPeriodId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  allocatedPoints: z.number({ message: i18n.t('rewards:budgetSchema.pleaseEnterTheTotalPointsGranted') })
    .min(0, i18n.t('rewards:budgetSchema.theTotalPointsCannotBeNegative')),
  maxPerAward: z.number().min(1, i18n.t('rewards:budgetSchema.maxPerPersonTimeMustBe')).optional(),
  note: z.string(),
}).superRefine((data, ctx) => {
  // Mỗi cách khoanh thời gian đòi đúng phần dữ liệu của nó; phần còn lại bị bỏ khi gửi.
  if (data.scopeMode === 'CYCLE' && !data.kpiCycleId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['kpiCycleId'], message: i18n.t('rewards:budgetSchema.pleaseChooseAnEvaluationCycle') })
  }
  if (data.scopeMode === 'PERIOD' && !data.kpiPeriodId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['kpiPeriodId'], message: i18n.t('rewards:budgetSchema.pleaseChooseAnEvaluationPeriod') })
  }
  if (data.scopeMode === 'DATES') {
    if (!data.periodStart) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodStart'], message: i18n.t('rewards:budgetSchema.pleaseChooseAStartDate') })
    }
    if (!data.periodEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodEnd'], message: i18n.t('rewards:budgetSchema.pleaseChooseAnEndDate') })
    }
    if (data.periodStart && data.periodEnd && new Date(data.periodEnd) < new Date(data.periodStart)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodEnd'], message: i18n.t('rewards:budgetSchema.theEndDateCannotBeBefore') })
    }
  }
})))

export type BudgetFormData = z.infer<ReturnType<typeof budgetSchema>>
