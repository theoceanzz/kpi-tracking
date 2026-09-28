import { z } from 'zod'
import { OkrStatus } from '../types'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Mã Objective/KR để `optional()`: tổ chức có thể bật sinh mã tự động, lúc đó ô mã bị khoá
 * và backend cấp mã theo mẫu riêng của công ty. Chỉ khi tổ chức TẮT tự sinh thì mã mới là
 * bắt buộc — vế đó truyền qua `requireCode` chứ không khai cứng trong schema.
 */
const objectiveShape = perLanguage(() => (z.object({
  code: z.string().optional(),
  name: z.string().min(1, i18n.t('okr:okrSchema.pleaseEnterTheObjectiveName')),
  description: z.string().optional(),
  startDate: z.string().min(1, i18n.t('okr:okrSchema.pleaseChooseAStartDate')),
  endDate: z.string().min(1, i18n.t('okr:okrSchema.pleaseChooseAnEndDate')),
  status: z.enum(OkrStatus).optional(),
  orgUnitIds: z.array(z.string()).optional(),
  perspectiveId: z.string().nullable().optional(),
})))

export const createObjectiveSchema = ({ requireCode = false }: { requireCode?: boolean } = {}) =>
  objectiveShape().superRefine((data, ctx) => {
    if (requireCode && !data.code?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['code'], message: i18n.t('okr:okrSchema.pleaseEnterACode') })
    }
    if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: i18n.t('okr:okrSchema.theEndDateCannotBeBefore'),
      })
    }
  })

export type ObjectiveFormData = z.infer<ReturnType<typeof objectiveShape>>

const keyResultShape = perLanguage(() => (z.object({
  code: z.string().optional(),
  name: z.string().min(1, i18n.t('okr:okrSchema.pleaseEnterTheKrName')),
  description: z.string().optional(),
  unit: z.string().optional(),
  currentValue: z.number({ message: i18n.t('okr:okrSchema.theCurrentValueMustBeA') }).optional(),
  targetValue: z.number({ message: i18n.t('okr:okrSchema.pleaseEnterTheTargetValue') }),
  objectiveId: z.string().min(1),
})))

export const createKeyResultSchema = ({ requireCode = false }: { requireCode?: boolean } = {}) =>
  keyResultShape().superRefine((data, ctx) => {
    if (requireCode && !data.code?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['code'], message: i18n.t('okr:okrSchema.pleaseEnterTheKrCode') })
    }
  })

export type KeyResultFormData = z.infer<ReturnType<typeof keyResultShape>>
