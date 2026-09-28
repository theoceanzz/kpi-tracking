import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/** Thông tin ứng dụng Lark tự dựng. App Secret để trống = giữ nguyên cái đã lưu. */
export const larkCredentialsSchema = perLanguage(() => (z.object({
  appId: z.string().trim().min(1, i18n.t('organization:integrationSchema.pleaseEnterTheAppId')),
  appSecret: z.string(),
})))

export type LarkCredentialsFormData = z.infer<ReturnType<typeof larkCredentialsSchema>>

/**
 * Mỗi loại email có danh sách biến BẮT BUỘC riêng (do server trả về), nên schema dựng
 * theo template đang mở thay vì khai báo tĩnh.
 */
export const createEmailTemplateSchema = (requiredVariables: string[] = []) =>
  z.object({
    subject: z.string().trim().min(1, i18n.t('organization:integrationSchema.pleaseEnterTheEmailSubject')),
    body: z.string().trim().min(1, i18n.t('organization:integrationSchema.pleaseEnterTheEmailContent')),
    fullHtml: z.boolean(),
    enabled: z.boolean(),
  }).superRefine((data, ctx) => {
    const missing = requiredVariables.filter(v => !`${data.subject} ${data.body}`.includes(`{{${v}}}`))
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: i18n.t('organization:integrationSchema.missingRequiredVariables', { join: missing.map(v => `{{${v}}}`).join(', ') }),
      })
    }
  })

export type EmailTemplateFormData = z.infer<ReturnType<typeof createEmailTemplateSchema>>

/**
 * Cấp hạn mức AI cho một người. Trần phụ thuộc phần còn lại trong túi của người cấp —
 * và giành quyền cấp thì TOÀN BỘ hạn mức mới bị trừ chứ không phải phần chênh — nên
 * schema dựng theo ngữ cảnh để khớp đúng cách backend tính.
 */
export const createAiQuotaSchema = (
  { remainingToAllocate, currentLimit, takeover }:
  { remainingToAllocate: number; currentLimit: number; takeover: boolean },
) =>
  z.object({
    value: z.number({ message: i18n.t('organization:integrationSchema.quotaMustBeANumber') }).min(0, i18n.t('organization:integrationSchema.quotaCannotBeNegative')),
  }).superRefine((data, ctx) => {
    const charge = takeover ? data.value : data.value - currentLimit
    if (charge > remainingToAllocate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: i18n.t('organization:integrationSchema.exceedsTheQuotaYouCanStill'),
      })
    }
  })

export type AiQuotaFormData = z.infer<ReturnType<typeof createAiQuotaSchema>>
