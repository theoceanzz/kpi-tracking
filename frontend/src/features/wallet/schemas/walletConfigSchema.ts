import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export const walletConfigSchema = perLanguage(() => (z.object({
  pointExchangeRate: z.number({ message: i18n.t('wallet:walletConfigSchema.pleaseEnterTheExchangeRate') })
    .min(1, i18n.t('wallet:walletConfigSchema.theExchangeRateMustBeGreater')),
  topupMinAmount: z.number({ message: i18n.t('wallet:walletConfigSchema.pleaseEnterTheMinimumTopUp') })
    .min(0, i18n.t('wallet:walletConfigSchema.theMinimumTopUpCannotBe')),
  topupMaxAmount: z.number({ message: i18n.t('wallet:walletConfigSchema.pleaseEnterTheMaximumTopUp') })
    .min(0, i18n.t('wallet:walletConfigSchema.theMaximumTopUpCannotBe')),
  topupExpireMinutes: z.number({ message: i18n.t('wallet:walletConfigSchema.pleaseEnterTheTopUpOrder') })
    .min(1, i18n.t('wallet:walletConfigSchema.theTopUpOrderValidityMust')),
  sepayAccountNumber: z.string().nullable().optional(),
  sepayBankCode: z.string().nullable().optional(),
  sepayAccountHolder: z.string().nullable().optional(),

  // Hồ sơ pháp nhân in lên biên nhận thu tiền.
  legalName: z.string().nullable().optional(),
  taxCode: z.string().nullable().optional(),
  businessAddress: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  receiptEnabled: z.boolean(),
  receiptSeriesPrefix: z.string()
    .min(1, i18n.t('wallet:walletConfigSchema.theNumberPrefixCannotBeEmpty'))
    .max(10, i18n.t('wallet:walletConfigSchema.theNumberPrefixCanBeAt')),
  receiptVatRate: z.number({ message: i18n.t('wallet:walletConfigSchema.pleaseEnterTheTaxRate') })
    .min(0, i18n.t('wallet:walletConfigSchema.theTaxRateCannotBeNegative'))
    .max(100, i18n.t('wallet:walletConfigSchema.theTaxRateCannotExceed100')),
  receiptIssuerName: z.string().nullable().optional(),
  receiptIssuerTitle: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.topupMaxAmount < data.topupMinAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['topupMaxAmount'],
      message: i18n.t('wallet:walletConfigSchema.theMaximumAmountIsLessThan'),
    })
  }

  // Bật gửi biên nhận mà chưa khai mã số thuế thì mỗi tờ chứng từ gửi đi đều thiếu một
  // nội dung bắt buộc — chặn ngay ở form thay vì để phát hiện qua tờ giấy đã gửi cho nhân viên.
  if (data.receiptEnabled && !data.taxCode?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['taxCode'],
      message: i18n.t('wallet:walletConfigSchema.theTaxCodeIsRequiredOn'),
    })
  }
  if (data.receiptEnabled && !data.businessAddress?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['businessAddress'],
      message: i18n.t('wallet:walletConfigSchema.theOrganizationAddressIsRequiredOn'),
    })
  }
})))

export type WalletConfigFormData = z.infer<ReturnType<typeof walletConfigSchema>>
