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

  // Hồ sơ pháp nhân in lên biên nhận thu tiền.
  legalName: z.string().nullable().optional(),
  taxCode: z.string().nullable().optional(),
  businessAddress: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  receiptEnabled: z.boolean(),
  receiptSeriesPrefix: z.string()
    .min(1, 'Tiền tố ký hiệu không được để trống')
    .max(10, 'Tiền tố ký hiệu tối đa 10 ký tự'),
  receiptVatRate: z.number({ message: 'Vui lòng nhập thuế suất' })
    .min(0, 'Thuế suất không được âm')
    .max(100, 'Thuế suất không vượt quá 100%'),
  receiptIssuerName: z.string().nullable().optional(),
  receiptIssuerTitle: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.topupMaxAmount < data.topupMinAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['topupMaxAmount'],
      message: 'Số tiền tối đa đang nhỏ hơn tối thiểu.',
    })
  }

  // Bật gửi biên nhận mà chưa khai mã số thuế thì mỗi tờ chứng từ gửi đi đều thiếu một
  // nội dung bắt buộc — chặn ngay ở form thay vì để phát hiện qua tờ giấy đã gửi cho nhân viên.
  if (data.receiptEnabled && !data.taxCode?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['taxCode'],
      message: 'Mã số thuế là nội dung bắt buộc trên chứng từ thu tiền.',
    })
  }
  if (data.receiptEnabled && !data.businessAddress?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['businessAddress'],
      message: 'Địa chỉ đơn vị là nội dung bắt buộc trên chứng từ thu tiền.',
    })
  }
})

export type WalletConfigFormData = z.infer<typeof walletConfigSchema>
