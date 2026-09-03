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

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Vui lòng cung cấp địa chỉ email').email('Email không hợp lệ'),
})

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Vui lòng cung cấp mã OTP từ email'),
  newPassword: z.string().min(1, 'Vui lòng nhập mật khẩu').min(8, 'Yêu cầu mức độ bảo mật tối thiểu 8 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác minh bảo mật'),
}).refine(data => data.confirmPassword === data.newPassword, {
  path: ['confirmPassword'],
  message: 'Hai mật khẩu cung cấp không đồng nhất',
})

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(1, 'Vui lòng nhập mật khẩu mới').min(8, 'Tối thiểu 8 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận'),
}).superRefine((data, ctx) => {
  // Đổi sang đúng mật khẩu đang dùng thì backend vẫn nhận nhưng người dùng chẳng đổi được gì.
  if (data.newPassword && data.newPassword === data.currentPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['newPassword'],
      message: 'Mật khẩu mới không được trùng với mật khẩu cũ',
    })
  }
  if (data.confirmPassword !== data.newPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Mật khẩu không khớp' })
  }
})

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

/** Màn bắt buộc đổi mật khẩu lần đầu — không hỏi mật khẩu hiện tại. */
export const forceChangePasswordSchema = z.object({
  newPassword: z.string().min(1, 'Vui lòng nhập mật khẩu mới').min(8, 'Tối thiểu 8 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
}).refine(data => data.confirmPassword === data.newPassword, {
  path: ['confirmPassword'],
  message: 'Mật khẩu không khớp',
})

export type ForceChangePasswordFormData = z.infer<typeof forceChangePasswordSchema>
