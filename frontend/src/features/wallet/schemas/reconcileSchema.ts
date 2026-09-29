import { z } from 'zod'
import { SepayResolveMode } from '../types'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export const resolveEventSchema = perLanguage(() => (z.object({
  mode: z.enum(SepayResolveMode),
  orderId: z.string(),
  // Người được ghi có do EmployeePicker chọn, không phải ô nhập.
  user: z.object({
    id: z.string(),
    fullName: z.string(),
    email: z.string().optional(),
  }).nullable(),
  note: z.string().trim().min(1, i18n.t('wallet:reconcileSchema.pleaseNoteTheReasonForHandling')),
}).superRefine((data, ctx) => {
  if (data.mode === SepayResolveMode.CREDIT_USER && !data.user) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['user'], message: i18n.t('wallet:reconcileSchema.pleaseChooseThePersonToCredit') })
  }
  if (data.mode === SepayResolveMode.MATCH_ORDER && !data.orderId.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['orderId'], message: i18n.t('wallet:reconcileSchema.pleaseEnterTheTopUpOrder') })
  }
})))

export type ResolveEventFormData = z.infer<ReturnType<typeof resolveEventSchema>>
