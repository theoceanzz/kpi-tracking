import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export const createDatasourceSchema = perLanguage(() => (z.object({
  name: z.string().trim().min(1, i18n.t('datasources:datasourceSchema.pleaseEnterTheDataSourceName')),
  description: z.string(),
})))

export type CreateDatasourceFormData = z.infer<ReturnType<typeof createDatasourceSchema>>

const selectOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
})

/** Thêm cột vào bảng dữ liệu. Cột kiểu lựa chọn phải có ít nhất một giá trị. */
export const addColumnSchema = perLanguage(() => (z.object({
  name: z.string().trim().min(1, i18n.t('datasources:datasourceSchema.pleaseEnterTheColumnName')),
  type: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT_ONE', 'SELECT_MULTI', 'USER', 'URL', 'ATTACHMENT', 'FORMULA']),
  options: z.array(selectOptionSchema),
  isMultiUser: z.boolean(),
}).superRefine((data, ctx) => {
  if ((data.type === 'SELECT_ONE' || data.type === 'SELECT_MULTI') && data.options.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: i18n.t('datasources:datasourceSchema.aChoiceColumnNeedsAtLeast') })
  }
})))

export type AddColumnFormData = z.infer<ReturnType<typeof addColumnSchema>>
