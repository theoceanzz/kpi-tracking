import { z } from 'zod'

export const userSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  phone: z.string().optional(),
  role: z.enum(['DIRECTOR', 'HEAD', 'DEPUTY', 'STAFF'], { message: 'Vui lòng chọn vai trò' }),
})

export type UserFormData = z.infer<typeof userSchema>

export const updateUserSchema = z.object({
  email: z.string().email('Email không hợp lệ').optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['DIRECTOR', 'HEAD', 'DEPUTY', 'STAFF']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
})

export type UpdateUserFormData = z.infer<typeof updateUserSchema>
