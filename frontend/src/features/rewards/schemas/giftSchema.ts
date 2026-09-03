import { z } from 'zod'

/** Ô số bỏ trống ⇒ undefined để `.optional()` cho qua, thay vì NaN chặn ngầm. */
export const numOrUndefined = (v: unknown) => (v === '' || v == null ? undefined : Number(v))

export const giftSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên quà'),
  description: z.string(),
  imageUrl: z.string(),
  pointCost: z.number({ message: 'Vui lòng nhập số điểm để đổi' })
    .min(1, 'Số điểm để đổi phải lớn hơn 0'),
  unlimitedStock: z.boolean(),
  // Bỏ trống = 0; khi bật "không giới hạn" thì ô bị khoá nên giá trị không được dùng tới.
  stockQuantity: z.number().min(0, 'Tồn kho không được âm').optional(),
  active: z.boolean(),
  requiresDelivery: z.boolean(),
})

export type GiftFormData = z.infer<typeof giftSchema>
