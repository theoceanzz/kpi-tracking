import { z } from 'zod'
import { formatCurrency } from '@/lib/utils'
import i18n from 'i18next'

/** Hạn mức nạp do cấu hình ví quyết định nên schema dựng theo ngữ cảnh. */
export const createTopupSchema = ({ min, max }: { min: number; max: number }) =>
  z.object({
    amount: z.number({ message: i18n.t('wallet:topupSchema.pleaseEnterAnAmount') })
      .min(min, i18n.t('wallet:topupSchema.theMinimumTopUpIs', { min: formatCurrency(min) }))
      .max(max, i18n.t('wallet:topupSchema.theMaximumTopUpIs', { max: formatCurrency(max) })),
  })

export type TopupFormData = z.infer<ReturnType<typeof createTopupSchema>>
