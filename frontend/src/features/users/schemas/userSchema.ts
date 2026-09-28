import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const phoneRegex = /^0\d{9}$/
const phoneMessage = perLanguage(() => (i18n.t('users:userSchema.thePhoneNumberMustHave10')))

export const userSchema = perLanguage(() => (z.object({
  email: z.string().min(1, i18n.t('users:userSchema.pleaseEnterAnEmail')).email(i18n.t('users:userSchema.invalidEmail')),
  fullName: z.string().min(1, i18n.t('users:userSchema.pleaseEnterYourFullName')),
  password: z.string().min(8, i18n.t('users:userSchema.passwordMustBeAtLeast8')),
  employeeCode: z.string().optional(),
  phone: z.string().regex(phoneRegex, phoneMessage()).optional().or(z.literal('')),
  role: z.string({ message: i18n.t('users:userSchema.pleaseChooseARole') }).min(1, i18n.t('users:userSchema.pleaseChooseARole')),
  orgUnitId: z.string({ message: i18n.t('users:userSchema.pleaseChooseAUnit') }).min(1, i18n.t('users:userSchema.pleaseChooseAUnit')),
})))

export type UserFormData = z.infer<ReturnType<typeof userSchema>>

export const updateUserSchema = perLanguage(() => (z.object({
  email: z.string().email(i18n.t('users:userSchema.invalidEmail')).optional(),
  fullName: z.string().optional(),
  employeeCode: z.string().optional(),
  phone: z.string().regex(phoneRegex, phoneMessage()).optional().or(z.literal('')),
  role: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  orgUnitId: z.string().optional(),
})))

export type UpdateUserFormData = z.infer<ReturnType<typeof updateUserSchema>>
