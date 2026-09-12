import { z } from 'zod'

/**
 * Chia mục tiêu của một hạng mục BSC ra các đợt của kỳ ("KPI = BSC").
 *
 * Mỗi đợt là một dòng; chỉ những dòng được TÍCH mới tạo KPI, nên các ràng buộc số liệu đều
 * chỉ áp cho dòng đã tích — bắt lỗi cả dòng bỏ trống sẽ chặn người dùng chỉ muốn chia 1 trong 2 đợt.
 */
const rowSchema = z.object({
  kpiPeriodId: z.string(),
  periodName: z.string(),
  selected: z.boolean(),
  name: z.string().optional(),
  targetValue: z.number().optional(),
  minimumValue: z.number().optional(),
  weight: z.number().optional(),
})

export const bscKpiSplitSchema = z.object({
  scorecardId: z.string().min(1, 'Vui lòng chọn bộ tiêu chí'),
  scorecardPerspectiveId: z.string().min(1, 'Vui lòng chọn hạng mục'),
  unit: z.string().optional(),
  description: z.string().optional(),
  isReverseKpi: z.boolean(),
  orgUnitIds: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất một đơn vị thực hiện'),
  /**
   * Giao cho cả đơn vị hay cho người cụ thể.
   *
   * Hai chế độ loại trừ nhau: chọn UNIT thì KPI đứng tên đơn vị và nằm ở nhóm "Chưa giao" cho tới
   * khi giao tay sau; chọn USERS thì phải nêu đích danh người, không có chuyện chọn xong vẫn rỗng.
   */
  assignMode: z.enum(['UNIT', 'USERS']),
  assignedToIds: z.array(z.string()),
  rows: z.array(rowSchema),
}).superRefine((data, ctx) => {
  if (data.assignMode === 'USERS' && data.assignedToIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['assignedToIds'],
      message: 'Vui lòng chọn ít nhất một người thực hiện',
    })
  }

  // Một KPI được tạo cho MỖI đơn vị với cùng danh sách người thực hiện, nên giao đích danh mà
  // trải trên nhiều đơn vị sẽ gán người của đơn vị này vào KPI của đơn vị kia.
  if (data.assignMode === 'USERS' && data.orgUnitIds.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['orgUnitIds'],
      message: 'Giao đích danh thì mỗi lần chỉ chia cho một đơn vị',
    })
  }

  const chosen = data.rows.filter(r => r.selected)
  if (chosen.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rows'], message: 'Vui lòng chọn ít nhất một đợt để chia' })
    return
  }

  data.rows.forEach((row, idx) => {
    if (!row.selected) return

    if (row.targetValue == null || Number.isNaN(row.targetValue)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rows', idx, 'targetValue'], message: 'Nhập mục tiêu' })
    } else if (row.targetValue < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rows', idx, 'targetValue'], message: 'Không được âm' })
    }

    if (row.weight == null || Number.isNaN(row.weight) || row.weight <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rows', idx, 'weight'], message: 'Nhập trọng số > 0' })
    } else if (row.weight > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rows', idx, 'weight'], message: 'Tối đa 100' })
    }

    // KPI ngược đảo vai trò hai ngưỡng: tối thiểu là mức TỆ NHẤT còn chấp nhận nên phải lớn hơn
    // mục tiêu — cùng luật với backend (validateReverseKpiThreshold).
    if (row.minimumValue != null && !Number.isNaN(row.minimumValue) && row.targetValue != null) {
      if (data.isReverseKpi && row.minimumValue <= row.targetValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom, path: ['rows', idx, 'minimumValue'],
          message: 'KPI ngược: tối thiểu phải lớn hơn mục tiêu',
        })
      }
      if (!data.isReverseKpi && row.minimumValue > row.targetValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom, path: ['rows', idx, 'minimumValue'],
          message: 'Không được lớn hơn mục tiêu',
        })
      }
    }
  })
})

export type BscKpiSplitFormData = z.infer<typeof bscKpiSplitSchema>
