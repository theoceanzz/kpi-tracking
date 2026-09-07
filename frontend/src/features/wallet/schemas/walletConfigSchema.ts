import { z } from 'zod'

export const walletConfigSchema = z.object({
  pointExchangeRate: z.number({ message: 'Vui lòng nhập tỉ giá quy đổi' })
    .min(1, 'Tỉ giá quy đổi phải lớn hơn 0'),
  topupMinAmount: z.number({ message: 'Vui lòng nhập số tiền nạp tối thiểu' })
    .min(0, 'Số tiền nạp tối thiểu không được âm'),
  topupMaxAmount: z.number({ message: 'Vui lòng nhập số tiền nạp tối đa' })
    .min(0, 'Số tiền nạp tối đa không được âm'),
  topupExpireMinutes: z.number({ message: 'Vui lòng nhập thời hạn đơn nạp' })
    .min(1, 'Thời hạn đơn nạp phải lớn hơn 0 phút'),
  sepayAccountNumber: z.string().nullable().optional(),
  sepayBankCode: z.string().nullable().optional(),
  sepayAccountHolder: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.topupMaxAmount < data.topupMinAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['topupMaxAmount'],
      message: 'Số tiền tối đa đang nhỏ hơn tối thiểu.',
    })
  }
})

export type WalletConfigFormData = z.infer<typeof walletConfigSchema>
