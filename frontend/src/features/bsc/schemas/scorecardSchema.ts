import { z } from 'zod'
import {
  BscEmptyPerspectivePolicy,
  BscFixedPerspective,
  BscScorecardApplyScope,
  BscScorecardStatus,
} from '../types'

/** Một dòng hạng mục trong bảng chia trọng số của bộ tiêu chí. */
const weightRowSchema = z.object({
  perspectiveId: z.string(),
  code: z.string(),
  name: z.string(),
  color: z.string().optional(),
  fixedPerspective: z.enum(BscFixedPerspective).optional(),
  displayOrder: z.number(),
  targetValue: z.number().nullable().optional(),
  minimumValue: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  weight: z.number(),
  enabled: z.boolean(),
})

export type WeightRow = z.infer<typeof weightRowSchema>

export const scorecardSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên bộ tiêu chí'),
  vision: z.string(),
  // Gắn thời gian: theo ĐỢT (tick nhiều đợt) hoặc theo KỲ (1 kỳ ⇒ mọi đợt trong kỳ tự áp dụng).
  applyScope: z.enum(BscScorecardApplyScope),
  periodIds: z.array(z.string()),
  cycleId: z.string(),
  // Mỗi phần tử là 1 id đơn vị (gồm cả node gốc).
  scopes: z.array(z.string()),
  status: z.enum(BscScorecardStatus),
  emptyPolicy: z.enum(BscEmptyPerspectivePolicy),
  rows: z.array(weightRowSchema),
}).superRefine((data, ctx) => {
  // Theo kỳ ⇒ đã chọn 1 kỳ; theo đợt ⇒ đã tick ít nhất 1 đợt.
  if (data.applyScope === BscScorecardApplyScope.CYCLE) {
    if (!data.cycleId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cycleId'], message: 'Vui lòng chọn kỳ áp dụng' })
    }
  } else if (data.periodIds.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodIds'], message: 'Vui lòng chọn ít nhất một đợt áp dụng' })
  }

  const enabled = data.rows.filter(r => r.enabled)
  if (enabled.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rows'], message: 'Bộ tiêu chí cần ít nhất một hạng mục đang bật' })
    return
  }
  const total = enabled.reduce((sum, r) => sum + (Number(r.weight) || 0), 0)
  if (Math.abs(total - 100) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rows'],
      message: `Tổng trọng số các hạng mục đang bật phải đủ 100% (hiện tại ${total.toFixed(1)}%)`,
    })
  }
})

export type ScorecardFormData = z.infer<typeof scorecardSchema>
