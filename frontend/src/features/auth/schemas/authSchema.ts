import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export const loginSchema = perLanguage(() => (z.object({
  email: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterAnEmail')).email(i18n.t('auth:authSchema.invalidEmail')),
  password: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterAPassword')),
})))

export type LoginFormData = z.infer<ReturnType<typeof loginSchema>>

export const registerSchema = perLanguage(() => (z.object({
  organizationName: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterTheOrganizationName')),
  organizationCode: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterTheOrganizationCode')),
  fullName: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterYourFullName')),
  email: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterAnEmail')).email(i18n.t('auth:authSchema.invalidEmail')),
  password: z.string().min(8, i18n.t('auth:authSchema.passwordMustBeAtLeast8')),
  phone: z.string().optional(),
  hierarchyLevels: z.array(z.object({
    unitTypeName: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterTheLevelName')),
    managerRoleLabel: z.string().optional(),
  })).min(2, i18n.t('auth:authSchema.theOrganizationStructureMustHaveAt')),
})))

export type RegisterFormData = z.infer<ReturnType<typeof registerSchema>>

export const forgotPasswordSchema = perLanguage(() => (z.object({
  email: z.string().min(1, i18n.t('auth:authSchema.pleaseProvideAnEmailAddress')).email(i18n.t('auth:authSchema.invalidEmail')),
})))

export type ForgotPasswordFormData = z.infer<ReturnType<typeof forgotPasswordSchema>>

export const resetPasswordSchema = perLanguage(() => (z.object({
  token: z.string().min(1, i18n.t('auth:authSchema.pleaseProvideTheOtpCodeFrom')),
  newPassword: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterAPassword')).min(8, i18n.t('auth:authSchema.aMinimumOf8CharactersIs')),
  confirmPassword: z.string().min(1, i18n.t('auth:authSchema.pleaseCompleteTheSecurityVerification')),
}).refine(data => data.confirmPassword === data.newPassword, {
  path: ['confirmPassword'],
  message: i18n.t('auth:authSchema.theTwoPasswordsDoNotMatch'),
})))

export type ResetPasswordFormData = z.infer<ReturnType<typeof resetPasswordSchema>>

export const changePasswordSchema = perLanguage(() => (z.object({
  currentPassword: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterYourCurrentPassword')),
  newPassword: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterANewPassword')).min(8, i18n.t('auth:authSchema.atLeast8Characters')),
  confirmPassword: z.string().min(1, i18n.t('auth:authSchema.pleaseConfirm')),
}).superRefine((data, ctx) => {
  // Đổi sang đúng mật khẩu đang dùng thì backend vẫn nhận nhưng người dùng chẳng đổi được gì.
  if (data.newPassword && data.newPassword === data.currentPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['newPassword'],
      message: i18n.t('auth:authSchema.theNewPasswordMustBeDifferent'),
    })
  }
  if (data.confirmPassword !== data.newPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: i18n.t('auth:authSchema.passwordsDoNotMatch') })
  }
})))

export type ChangePasswordFormData = z.infer<ReturnType<typeof changePasswordSchema>>

/** Màn bắt buộc đổi mật khẩu lần đầu — không hỏi mật khẩu hiện tại. */
export const forceChangePasswordSchema = perLanguage(() => (z.object({
  newPassword: z.string().min(1, i18n.t('auth:authSchema.pleaseEnterANewPassword')).min(8, i18n.t('auth:authSchema.atLeast8Characters')),
  confirmPassword: z.string().min(1, i18n.t('auth:authSchema.pleaseConfirmThePassword')),
}).refine(data => data.confirmPassword === data.newPassword, {
  path: ['confirmPassword'],
  message: i18n.t('auth:authSchema.passwordsDoNotMatch'),
})))

export type ForceChangePasswordFormData = z.infer<ReturnType<typeof forceChangePasswordSchema>>
