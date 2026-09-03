import { z } from 'zod'

/** Thông tin ứng dụng Lark tự dựng. App Secret để trống = giữ nguyên cái đã lưu. */
export const larkCredentialsSchema = z.object({
  appId: z.string().trim().min(1, 'Vui lòng nhập App ID'),
  appSecret: z.string(),
})

export type LarkCredentialsFormData = z.infer<typeof larkCredentialsSchema>

/**
 * Mỗi loại email có danh sách biến BẮT BUỘC riêng (do server trả về), nên schema dựng
 * theo template đang mở thay vì khai báo tĩnh.
 */
export const createEmailTemplateSchema = (requiredVariables: string[] = []) =>
  z.object({
    subject: z.string().trim().min(1, 'Vui lòng nhập tiêu đề email'),
    body: z.string().trim().min(1, 'Vui lòng nhập nội dung email'),
    fullHtml: z.boolean(),
    enabled: z.boolean(),
  }).superRefine((data, ctx) => {
    const missing = requiredVariables.filter(v => !`${data.subject} ${data.body}`.includes(`{{${v}}}`))
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: `Thiếu biến bắt buộc: ${missing.map(v => `{{${v}}}`).join(', ')}`,
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
    value: z.number({ message: 'Hạn mức phải là số' }).min(0, 'Hạn mức không được âm'),
  }).superRefine((data, ctx) => {
    const charge = takeover ? data.value : data.value - currentLimit
    if (charge > remainingToAllocate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Vượt quá phần hạn mức bạn còn có thể cấp',
      })
    }
  })

export type AiQuotaFormData = z.infer<ReturnType<typeof createAiQuotaSchema>>
