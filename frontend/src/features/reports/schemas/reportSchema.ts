import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export const createReportSchema = perLanguage(() => (z.object({
  name: z.string().trim().min(1, i18n.t('reports:reportSchema.pleaseEnterTheReportName')),
  description: z.string(),
})))

export type CreateReportFormData = z.infer<ReturnType<typeof createReportSchema>>
