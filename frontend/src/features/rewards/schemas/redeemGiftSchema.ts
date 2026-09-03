import { z } from 'zod'

/**
 * Trần số lượng là giá trị nhỏ hơn giữa "tồn kho còn" và "số điểm mua nổi", đều là dữ
 * liệu chạy mới biết, nên schema dựng theo ngữ cảnh.
 */
export const createRedeemGiftSchema = ({ maxQty, maxAffordable }: { maxQty: number; maxAffordable: number }) =>
  z.object({
    quantity: z.number({ message: 'Vui lòng nhập số lượng' })
      .int('Số lượng phải là số nguyên')
      .min(1, 'Số lượng phải lớn hơn 0')
      .max(maxQty, `Chỉ đổi được tối đa ${maxQty} phần`),
    note: z.string(),
  }).superRefine((data, ctx) => {
    if (data.quantity > maxAffordable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: 'Số điểm hiện có không đủ để đổi số lượng này',
      })
    }
  })

export type RedeemGiftFormData = z.infer<ReturnType<typeof createRedeemGiftSchema>>
