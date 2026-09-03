import { z } from 'zod'
import { formatCurrency } from '@/lib/utils'

/** Hạn mức nạp do cấu hình ví quyết định nên schema dựng theo ngữ cảnh. */
export const createTopupSchema = ({ min, max }: { min: number; max: number }) =>
  z.object({
    amount: z.number({ message: 'Vui lòng nhập số tiền' })
      .min(min, `Số tiền nạp tối thiểu là ${formatCurrency(min)}`)
      .max(max, `Số tiền nạp tối đa là ${formatCurrency(max)}`),
  })

export type TopupFormData = z.infer<ReturnType<typeof createTopupSchema>>
