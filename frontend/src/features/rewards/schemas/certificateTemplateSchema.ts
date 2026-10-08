import { z } from 'zod'
import { CertificateOrientation } from '../types'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export const certificateTemplateSchema = perLanguage(() => (z.object({
  name: z.string().trim().min(1, i18n.t('rewards:certificateTemplateSchema.pleaseEnterTheTemplateName')),
  preset: z.string(),
  orientation: z.enum(CertificateOrientation),
  eyebrow: z.string(),
  title: z.string().trim().min(1, i18n.t('rewards:certificateTemplateSchema.pleaseEnterTheTitlePrintedOn')),
  subtitle: z.string(),
  body: z.string(),
  footnote: z.string(),
  signerName: z.string(),
  signerTitle: z.string(),
  signatureUrl: z.string(),
  logoUrl: z.string(),
  backgroundUrl: z.string(),
  accentColor: z.string(),
  inkColor: z.string(),
  surfaceColor: z.string(),
  showLogo: z.boolean(),
  showOrgName: z.boolean(),
  showPoints: z.boolean(),
  showReason: z.boolean(),
  isDefault: z.boolean(),
  active: z.boolean(),
})))

export type CertificateTemplateFormData = z.infer<ReturnType<typeof certificateTemplateSchema>>
