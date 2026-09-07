import { z } from 'zod'

const phoneRegex = /^0\d{9}$/
const phoneMessage = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0 (VD: 0912345678)'

export const profileInfoSchema = z.object({
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
  phone: z.string().regex(phoneRegex, phoneMessage).optional().or(z.literal('')),
})

export type ProfileInfoFormData = z.infer<typeof profileInfoSchema>

/** Đổi mật khẩu trong trang hồ sơ — cùng luật với màn Đổi mật khẩu, khác ở câu chữ. */
export const securityPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(1, 'Vui lòng nhập mật khẩu mới').min(8, 'Tối thiểu 8 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
}).superRefine((data, ctx) => {
  if (data.newPassword && data.newPassword === data.currentPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['newPassword'],
      message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
    })
  }
  if (data.confirmPassword !== data.newPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Mật khẩu không khớp' })
  }
})

export type SecurityPasswordFormData = z.infer<typeof securityPasswordSchema>
