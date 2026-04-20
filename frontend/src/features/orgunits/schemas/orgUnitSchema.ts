import { z } from 'zod'

export const orgUnitSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên đơn vị'),
  orgHierarchyId: z.string().min(1, 'Vui lòng chọn cấp bậc'),
  parentId: z.string().nullable().optional(),
  email: z.string().email('Email không hợp lệ').or(z.literal('')).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  provinceId: z.number().nullable().optional(),
  districtId: z.number().nullable().optional(),
})

export type OrgUnitFormData = z.infer<typeof orgUnitSchema>
