import { z } from 'zod'
import { SepayResolveMode } from '../types'

export const resolveEventSchema = z.object({
  mode: z.enum(SepayResolveMode),
  orderId: z.string(),
  // Người được ghi có do EmployeePicker chọn, không phải ô nhập.
  user: z.object({
    id: z.string(),
    fullName: z.string(),
    email: z.string().optional(),
  }).nullable(),
  note: z.string().trim().min(1, 'Vui lòng ghi chú lý do xử lý'),
}).superRefine((data, ctx) => {
  if (data.mode === SepayResolveMode.CREDIT_USER && !data.user) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['user'], message: 'Vui lòng chọn người được ghi có' })
  }
  if (data.mode === SepayResolveMode.MATCH_ORDER && !data.orderId.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['orderId'], message: 'Vui lòng nhập mã định danh đơn nạp' })
  }
})

export type ResolveEventFormData = z.infer<typeof resolveEventSchema>
