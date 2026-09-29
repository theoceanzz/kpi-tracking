import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/** Người được chọn để trao điểm — giữ tên để hiện chip, id để gửi lên. */
const pickedEmployeeSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string().optional(),
})

export const awardPointsSchema = perLanguage(() => (z.object({
  picked: z.array(pickedEmployeeSchema).min(1, i18n.t('rewards:awardPointsSchema.pleaseChooseAtLeastOneRecipient')),
  points: z.number({ message: i18n.t('rewards:awardPointsSchema.pleaseEnterTheNumberOfPoints') }).min(1, i18n.t('rewards:awardPointsSchema.pointsMustBeGreaterThan0')),
  reason: z.string().trim().min(1, i18n.t('rewards:awardPointsSchema.pleaseEnterTheRewardReason')),
  withCertificate: z.boolean(),
  certificateTemplateId: z.string(),
})))

export type AwardPointsFormData = z.infer<ReturnType<typeof awardPointsSchema>>
