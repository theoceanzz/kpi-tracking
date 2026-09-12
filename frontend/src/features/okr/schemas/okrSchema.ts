import { z } from 'zod'
import { OkrStatus } from '../types'

/**
 * Mã Objective/KR để `optional()`: tổ chức có thể bật sinh mã tự động, lúc đó ô mã bị khoá
 * và backend cấp mã theo mẫu riêng của công ty. Chỉ khi tổ chức TẮT tự sinh thì mã mới là
 * bắt buộc — vế đó truyền qua `requireCode` chứ không khai cứng trong schema.
 */
const objectiveShape = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Vui lòng nhập tên mục tiêu'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu'),
  endDate: z.string().min(1, 'Vui lòng chọn ngày kết thúc'),
  status: z.enum(OkrStatus).optional(),
  orgUnitIds: z.array(z.string()).optional(),
  perspectiveId: z.string().nullable().optional(),
})

export const createObjectiveSchema = ({ requireCode = false }: { requireCode?: boolean } = {}) =>
  objectiveShape.superRefine((data, ctx) => {
    if (requireCode && !data.code?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['code'], message: 'Vui lòng nhập mã' })
    }
    if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'Ngày kết thúc không được trước ngày bắt đầu',
      })
    }
  })

export type ObjectiveFormData = z.infer<typeof objectiveShape>

const keyResultShape = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Vui lòng nhập tên KR'),
  description: z.string().optional(),
  unit: z.string().optional(),
  currentValue: z.number({ message: 'Giá trị hiện tại phải là số' }).optional(),
  targetValue: z.number({ message: 'Vui lòng nhập giá trị mục tiêu' }),
  objectiveId: z.string().min(1),
})

export const createKeyResultSchema = ({ requireCode = false }: { requireCode?: boolean } = {}) =>
  keyResultShape.superRefine((data, ctx) => {
    if (requireCode && !data.code?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['code'], message: 'Vui lòng nhập mã KR' })
    }
  })

export type KeyResultFormData = z.infer<typeof keyResultShape>
