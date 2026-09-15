import { z } from 'zod'

/**
 * Hai giá trị canh gác của ô chọn lĩnh vực. Radix không nhận chuỗi rỗng làm value nên
 * "chưa chọn" cũng phải có mã riêng; cả hai đều được quy đổi lại trước khi gửi lên server.
 */
export const INDUSTRY_NONE = '__none__'
export const INDUSTRY_OTHER = '__other__'

export const companyProfileSchema = z.object({
  name: z.string().min(1, 'Tên công ty không được để trống'),
  code: z.string().min(1, 'Mã doanh nghiệp không được để trống'),
  /** Mục đang chọn trong ô chọn: một preset, hoặc một trong hai giá trị canh gác. */
  industryChoice: z.string(),
  /** Chỉ dùng khi chọn "Khác" — ngành nghề người dùng tự gõ. */
  industryCustom: z.string(),
  taxCode: z.string(),
  // Ô trống = "chưa khai", không phải 0 nhân viên — nên vẫn giữ dạng chuỗi.
  employeeCount: z.string().refine(
    v => v.trim() === '' || Number(v) >= 0,
    'Quy mô nhân sự không được âm',
  ),
  description: z.string(),
}).superRefine((data, ctx) => {
  if (data.industryChoice === INDUSTRY_OTHER && data.industryCustom.trim() === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['industryCustom'],
      message: 'Nhập lĩnh vực hoạt động của công ty',
    })
  }
})

export type CompanyProfileFormData = z.infer<typeof companyProfileSchema>

export const hierarchyLevelsSchema = z.object({
  hierarchyLevels: z.array(z.object({
    id: z.string().optional(),
    unitTypeName: z.string().min(1, 'Tên cấp bậc không được để trống'),
    managerRoleLabel: z.string(),
  })).min(2, 'Cơ cấu tổ chức phải có ít nhất 2 cấp'),
})

export type HierarchyLevelsFormData = z.infer<typeof hierarchyLevelsSchema>

/**
 * Thang điểm định lượng. Điểm mức không được vượt thang tối đa, nhưng thang tối đa nằm
 * ở state riêng (không thuộc form) nên ràng buộc đó dựng theo ngữ cảnh.
 */
export const createEvaluationLevelsSchema = (maxScore: number) =>
  z.object({
    evaluationLevels: z.array(z.object({
      id: z.string().optional(),
      name: z.string().min(1, 'Tên mức không được để trống'),
      threshold: z.number({ message: 'Điểm mức phải là số' })
        .min(0, 'Điểm mức không được âm')
        .max(maxScore, `Điểm mức không được vượt quá Thang điểm tối đa (${maxScore})`),
      color: z.string(),
    })).min(1, 'Cần ít nhất 1 mức xếp loại'),
  })

export type EvaluationLevelsFormData = z.infer<ReturnType<typeof createEvaluationLevelsSchema>>

export const qualitativeLevelsSchema = z.object({
  qualitativeLevels: z.array(z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1, 'Tên mức không được để trống'),
    value: z.number({ message: 'Giá trị mức phải là số' }),
    position: z.number({ message: 'Vị trí phải là số' })
      .int('Vị trí phải là số nguyên lớn hơn hoặc bằng 1')
      .min(1, 'Vị trí phải là số nguyên lớn hơn hoặc bằng 1'),
    scorePercent: z.number({ message: '% quy đổi BSC phải là số' })
      .min(0, '% quy đổi BSC phải nằm trong khoảng 0–100')
      .max(100, '% quy đổi BSC phải nằm trong khoảng 0–100'),
    color: z.string(),
  })).min(1, 'Cần ít nhất 1 mức đánh giá'),
}).superRefine((data, ctx) => {
  // Vị trí phải liên tục từ 1: 1, 2, 3, ..., n (không trùng, không nhảy cóc)
  const positions = data.qualitativeLevels.map(l => Number(l.position)).sort((a, b) => a - b)
  if (positions.some((p, i) => p !== i + 1)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['qualitativeLevels'],
      message: 'Vị trí phải liên tục từ 1 (ví dụ: 1, 2, 3, 4, 5)',
    })
  }
})

export type QualitativeLevelsFormData = z.infer<typeof qualitativeLevelsSchema>

const unitClassConditionSchema = z.object({
  level: z.string(),
  scope: z.enum(['this', 'orAbove', 'orBelow']),
  op: z.enum(['gte', 'lte', 'gt', 'lt', 'eq']),
  percent: z.number(),
})

const unitClassRuleSchema = z.object({
  levelName: z.string(),
  color: z.string(),
  conditions: z.array(unitClassConditionSchema),
})

/** Khung bell curve: hạn mức % mỗi mức khi chấm nhân sự (xem BellCurveEditor). */
const unitBellCurveSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['warn', 'block']),
  minMembers: z.number(),
  tolerance: z.number(),
  targets: z.array(z.object({ level: z.string(), percent: z.number() })),
})

const unitClassProfileSchema = z.object({
  _key: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  orgUnitIds: z.array(z.string()),
  /** Kỳ áp dụng — rỗng = áp cho mọi kỳ. */
  kpiCycleIds: z.array(z.string()),
  rules: z.array(unitClassRuleSchema),
  /** Vắng mặt = hồ sơ không khống chế tỷ lệ. */
  bellCurve: unitBellCurveSchema.optional(),
})

/**
 * Luật xếp loại đơn vị. Lỗi cố ý gắn hết vào `profiles` thay vì từng ô: màn hình này gấp
 * mở từng hồ sơ nên ô sai thường đang bị thu gọn, một câu nêu đích danh hồ sơ mới chỉ được
 * đường cho người dùng.
 */
export const unitClassificationSchema = z.object({
  profiles: z.array(unitClassProfileSchema).min(1, 'Cần ít nhất một hồ sơ'),
}).superRefine((data, ctx) => {
  const fail = (message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['profiles'], message })

  // Đúng MỘT hồ sơ mặc định, áp cho mọi kỳ — cùng luật với bộ tiêu chí hạnh kiểm. Giao
  // diện đã giữ bất biến này, kiểm lại ở đây chỉ để dữ liệu cũ không lọt qua.
  const defaults = data.profiles.filter(p => p.isDefault)
  if (defaults.length !== 1) {
    fail(defaults.length ? 'Chỉ được một hồ sơ mặc định' : 'Cần một hồ sơ mặc định')
    return
  }

  const names = data.profiles.map(p => p.name.trim())
  if (names.some(n => !n)) return fail('Tên hồ sơ không được để trống')
  if (new Set(names).size !== names.length) return fail('Tên hồ sơ bị trùng')

  for (const p of data.profiles) {
    if (!p.isDefault && p.orgUnitIds.length === 0) return fail(`Hồ sơ "${p.name}" chưa gán đơn vị nào`)
    if (!p.rules.length) return fail(`Hồ sơ "${p.name}" cần ít nhất một mức xếp loại`)
    if (p.rules.some(r => !r.levelName.trim())) return fail(`Hồ sơ "${p.name}": tên mức không được để trống`)
    if (p.rules.some(r => r.conditions.some(c => !c.level || c.percent < 0 || c.percent > 100))) {
      return fail(`Hồ sơ "${p.name}": điều kiện chưa hợp lệ (% phải 0–100 và chọn mức)`)
    }

    // Khung bell curve chỉ có nghĩa khi các mức phủ đúng 100% nhân sự: tổng 90% thì 10% còn lại
    // không thuộc mức nào, tổng 110% thì hạn mức rộng hơn cả đơn vị.
    const bc = p.bellCurve
    if (bc?.enabled) {
      if (bc.targets.some(t => t.percent < 0 || t.percent > 100)) {
        return fail(`Hồ sơ "${p.name}": tỷ lệ bell curve phải nằm trong 0–100%`)
      }
      const total = Math.round(bc.targets.reduce((a, t) => a + (t.percent || 0), 0) * 10) / 10
      if (Math.abs(total - 100) > 0.5) {
        return fail(`Hồ sơ "${p.name}": tổng tỷ lệ bell curve phải bằng 100% (đang ${total}%)`)
      }
      if (bc.tolerance < 0 || bc.tolerance > 50) {
        return fail(`Hồ sơ "${p.name}": dung sai bell curve phải nằm trong 0–50%`)
      }
      if (bc.minMembers < 0) return fail(`Hồ sơ "${p.name}": quy mô tối thiểu không được âm`)
    }
  }
})

export type UnitClassificationFormData = z.infer<typeof unitClassificationSchema>
export type UnitClassProfileForm = z.infer<typeof unitClassProfileSchema>
