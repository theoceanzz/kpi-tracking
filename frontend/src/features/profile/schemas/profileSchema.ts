import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const phoneRegex = /^0\d{9}$/
const phoneMessage = perLanguage(() => (i18n.t('profile:profileSchema.thePhoneNumberMustHave10')))

export const profileInfoSchema = perLanguage(() => (z.object({
  fullName: z.string().min(1, i18n.t('profile:profileSchema.pleaseEnterYourFullName')),
  phone: z.string().regex(phoneRegex, phoneMessage()).optional().or(z.literal('')),
})))

export type ProfileInfoFormData = z.infer<ReturnType<typeof profileInfoSchema>>

/** Đổi mật khẩu trong trang hồ sơ — cùng luật với màn Đổi mật khẩu, khác ở câu chữ. */
export const securityPasswordSchema = perLanguage(() => (z.object({
  currentPassword: z.string().min(1, i18n.t('profile:profileSchema.pleaseEnterYourCurrentPassword')),
  newPassword: z.string().min(1, i18n.t('profile:profileSchema.pleaseEnterANewPassword')).min(8, i18n.t('profile:profileSchema.atLeast8Characters')),
  confirmPassword: z.string().min(1, i18n.t('profile:profileSchema.pleaseConfirmThePassword')),
}).superRefine((data, ctx) => {
  if (data.newPassword && data.newPassword === data.currentPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['newPassword'],
      message: i18n.t('profile:profileSchema.theNewPasswordMustBeDifferent'),
    })
  }
  if (data.confirmPassword !== data.newPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: i18n.t('profile:profileSchema.passwordsDoNotMatch') })
  }
})))

export type SecurityPasswordFormData = z.infer<ReturnType<typeof securityPasswordSchema>>
