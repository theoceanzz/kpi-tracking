import { z } from 'zod'
import {
  BscEmptyPerspectivePolicy,
  BscFixedPerspective,
  BscGateEffect,
  BscGateScope,
  BscItemOrigin,
  BscMeasurementSource,
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
  // Cascade: dòng ASSIGNED do cấp trên giao xuống và bị khoá mục tiêu/trọng số.
  origin: z.enum(BscItemOrigin).optional(),
  locked: z.boolean().optional(),
  parentItemName: z.string().nullable().optional(),
  parentScorecardName: z.string().nullable().optional(),
  measurementSource: z.enum(BscMeasurementSource).optional(),
  // Hạng mục chặn: áp trần xếp loại, KHÔNG trừ điểm.
  isGate: z.boolean().optional(),
  gateMinPercent: z.number().nullable().optional(),
  gateEffect: z.enum(BscGateEffect).nullable().optional(),
  gateCapRating: z.number().nullable().optional(),
  gateAppliesTo: z.enum(BscGateScope).optional(),
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

  // Bỏ lựa chọn "toàn tổ chức" mơ hồ: công ty giờ là NODE GỐC trong cây đơn vị, chọn tường minh
  // như mọi đơn vị khác. Để trống không còn nghĩa gì nên chặn luôn.
  if (data.scopes.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scopes'],
      message: 'Vui lòng chọn đơn vị áp dụng (chọn đơn vị gốc nếu đây là BSC của cả công ty)',
    })
  }

  const enabled = data.rows.filter(r => r.enabled)
  if (enabled.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rows'], message: 'Bộ tiêu chí cần ít nhất một hạng mục đang bật' })
    return
  }
  // Mục tiêu riêng của từng dòng: sàn không được cao hơn mức cần đạt, nếu không hạng mục
  // vĩnh viễn 0 điểm mà không ai hiểu vì sao. Backend cũng chặn, kiểm ở đây để báo sớm.
  for (const r of enabled) {
    if (r.targetValue != null && r.minimumValue != null && r.minimumValue > r.targetValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rows'],
        message: `Hạng mục "${r.name}": kết quả tối thiểu (${r.minimumValue}) không được lớn hơn mục tiêu (${r.targetValue})`,
      })
    }
  }

  for (const r of enabled) {
    if (!r.isGate) continue
    if (r.gateEffect === BscGateEffect.CAP_AT_RATING && r.gateCapRating == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rows'],
        message: `Hạng mục chặn "${r.name}": chọn kiểu giới hạn xếp loại thì phải chỉ rõ mức trần`,
      })
    }
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
