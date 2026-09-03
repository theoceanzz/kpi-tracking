import { z } from 'zod'
import { CertificateOrientation } from '../types'

export const certificateTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên mẫu'),
  preset: z.string(),
  orientation: z.enum(CertificateOrientation),
  eyebrow: z.string(),
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề in trên giấy'),
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
  showPoints: z.boolean(),
  showReason: z.boolean(),
  isDefault: z.boolean(),
  active: z.boolean(),
})

export type CertificateTemplateFormData = z.infer<typeof certificateTemplateSchema>
