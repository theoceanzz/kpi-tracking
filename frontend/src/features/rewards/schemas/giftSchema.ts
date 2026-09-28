import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/** Ô số bỏ trống ⇒ undefined để `.optional()` cho qua, thay vì NaN chặn ngầm. */
export const numOrUndefined = (v: unknown) => (v === '' || v == null ? undefined : Number(v))

export const giftSchema = perLanguage(() => (z.object({
  name: z.string().min(1, i18n.t('rewards:giftSchema.pleaseEnterTheGiftName')),
  description: z.string(),
  imageUrl: z.string(),
  pointCost: z.number({ message: i18n.t('rewards:giftSchema.pleaseEnterThePointsToRedeem') })
    .min(1, i18n.t('rewards:giftSchema.pointsToRedeemMustBeGreater')),
  unlimitedStock: z.boolean(),
  // Bỏ trống = 0; khi bật "không giới hạn" thì ô bị khoá nên giá trị không được dùng tới.
  stockQuantity: z.number().min(0, i18n.t('rewards:giftSchema.stockCannotBeNegative')).optional(),
  active: z.boolean(),
  requiresDelivery: z.boolean(),
})))

export type GiftFormData = z.infer<ReturnType<typeof giftSchema>>
