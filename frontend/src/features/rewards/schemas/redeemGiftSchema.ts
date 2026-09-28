import { z } from 'zod'
import i18n from 'i18next'

/**
 * Trần số lượng là giá trị nhỏ hơn giữa "tồn kho còn" và "số điểm mua nổi", đều là dữ
 * liệu chạy mới biết, nên schema dựng theo ngữ cảnh.
 */
export const createRedeemGiftSchema = ({ maxQty, maxAffordable }: { maxQty: number; maxAffordable: number }) =>
  z.object({
    quantity: z.number({ message: i18n.t('rewards:redeemGiftSchema.pleaseEnterAQuantity') })
      .int(i18n.t('rewards:redeemGiftSchema.theQuantityMustBeAnInteger'))
      .min(1, i18n.t('rewards:redeemGiftSchema.theQuantityMustBeGreaterThan'))
      .max(maxQty, i18n.t('rewards:redeemGiftSchema.atMostUnitsCanBeRedeemed', { maxQty })),
    note: z.string(),
  }).superRefine((data, ctx) => {
    if (data.quantity > maxAffordable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: i18n.t('rewards:redeemGiftSchema.yourCurrentPointsAreNotEnough'),
      })
    }
  })

export type RedeemGiftFormData = z.infer<ReturnType<typeof createRedeemGiftSchema>>
