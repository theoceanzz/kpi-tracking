import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const phoneRegex = /^0\d{9}$/
const phoneMessage = perLanguage(() => (i18n.t('orgunits:orgUnitSchema.thePhoneNumberMustHave10')))

export const orgUnitSchema = perLanguage(() => (z.object({
  name: z.string().min(1, i18n.t('orgunits:orgUnitSchema.pleaseEnterTheUnitName')),
  code: z.string().min(1, i18n.t('orgunits:orgUnitSchema.pleaseEnterTheUnitCode')),
  orgHierarchyId: z.string().min(1, i18n.t('orgunits:orgUnitSchema.pleaseChooseALevel')),
  parentId: z.string().nullable().optional(),
  email: z.string().email(i18n.t('orgunits:orgUnitSchema.invalidEmail')).or(z.literal('')).optional(),
  phone: z.string().regex(phoneRegex, phoneMessage()).optional().or(z.literal('')),
  address: z.string().optional(),
  provinceId: z.number().nullable().optional(),
  districtId: z.number().nullable().optional(),
  roleIds: z.array(z.string()).optional(),
})))

export type OrgUnitFormData = z.infer<ReturnType<typeof orgUnitSchema>>
