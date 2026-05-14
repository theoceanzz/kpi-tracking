import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  organizationName: z.string().min(1, 'Vui lòng nhập tên tổ chức'),
  organizationCode: z.string().min(1, 'Vui lòng nhập mã tổ chức'),
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  phone: z.string().optional(),
  hierarchyLevels: z.array(z.object({
    unitTypeName: z.string().min(1, 'Vui lòng nhập tên cấp bậc'),
    managerRoleLabel: z.string().optional(),
  })).min(2, 'Cơ cấu tổ chức phải có ít nhất 2 cấp'),
})

export type RegisterFormData = z.infer<typeof registerSchema>
