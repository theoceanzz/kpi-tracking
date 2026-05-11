import { z } from 'zod'

const phoneRegex = /^0\d{9}$/
const phoneMessage = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0 (VD: 0912345678)'

export const userSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  employeeCode: z.string().optional(),
  phone: z.string().regex(phoneRegex, phoneMessage).optional().or(z.literal('')),
  role: z.string({ message: 'Vui lòng chọn vai trò' }).min(1, 'Vui lòng chọn vai trò'),
  orgUnitId: z.string({ message: 'Vui lòng chọn đơn vị' }).min(1, 'Vui lòng chọn đơn vị'),
})

export type UserFormData = z.infer<typeof userSchema>

export const updateUserSchema = z.object({
  email: z.string().email('Email không hợp lệ').optional(),
  fullName: z.string().optional(),
  employeeCode: z.string().optional(),
  phone: z.string().regex(phoneRegex, phoneMessage).optional().or(z.literal('')),
  role: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  orgUnitId: z.string().optional(),
})

export type UpdateUserFormData = z.infer<typeof updateUserSchema>
