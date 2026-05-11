import { z } from 'zod'

const phoneRegex = /^0\d{9}$/
const phoneMessage = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0 (VD: 0912345678)'

export const orgUnitSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên đơn vị'),
  code: z.string().min(1, 'Vui lòng nhập mã đơn vị'),
  orgHierarchyId: z.string().min(1, 'Vui lòng chọn cấp bậc'),
  parentId: z.string().nullable().optional(),
  email: z.string().email('Email không hợp lệ').or(z.literal('')).optional(),
  phone: z.string().regex(phoneRegex, phoneMessage).optional().or(z.literal('')),
  address: z.string().optional(),
  provinceId: z.number().nullable().optional(),
  districtId: z.number().nullable().optional(),
  roleIds: z.array(z.string()).optional(),
})

export type OrgUnitFormData = z.infer<typeof orgUnitSchema>
