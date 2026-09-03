import { z } from 'zod'

export const createDatasourceSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên nguồn dữ liệu'),
  description: z.string(),
})

export type CreateDatasourceFormData = z.infer<typeof createDatasourceSchema>

const selectOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
})

/** Thêm cột vào bảng dữ liệu. Cột kiểu lựa chọn phải có ít nhất một giá trị. */
export const addColumnSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên cột'),
  type: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT_ONE', 'SELECT_MULTI', 'USER', 'URL', 'ATTACHMENT', 'FORMULA']),
  options: z.array(selectOptionSchema),
  isMultiUser: z.boolean(),
}).superRefine((data, ctx) => {
  if ((data.type === 'SELECT_ONE' || data.type === 'SELECT_MULTI') && data.options.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Cột lựa chọn cần ít nhất một giá trị' })
  }
})

export type AddColumnFormData = z.infer<typeof addColumnSchema>
