import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hai giá trị canh gác của ô chọn lĩnh vực. Radix không nhận chuỗi rỗng làm value nên
 * "chưa chọn" cũng phải có mã riêng; cả hai đều được quy đổi lại trước khi gửi lên server.
 */
export const INDUSTRY_NONE = '__none__'
export const INDUSTRY_OTHER = '__other__'

export const companyProfileSchema = perLanguage(() => (z.object({
  name: z.string().min(1, i18n.t('orgunits:organizationSchema.theCompanyNameCannotBeEmpty')),
  code: z.string().min(1, i18n.t('orgunits:organizationSchema.theBusinessCodeCannotBeEmpty')),
  /** Mục đang chọn trong ô chọn: một preset, hoặc một trong hai giá trị canh gác. */
  industryChoice: z.string(),
  /** Chỉ dùng khi chọn "Khác" — ngành nghề người dùng tự gõ. */
  industryCustom: z.string(),
  taxCode: z.string(),
  // Ô trống = "chưa khai", không phải 0 nhân viên — nên vẫn giữ dạng chuỗi.
  employeeCount: z.string().refine(
    v => v.trim() === '' || Number(v) >= 0,
    i18n.t('orgunits:organizationSchema.companySizeCannotBeNegative'),
  ),
  description: z.string(),
}).superRefine((data, ctx) => {
  if (data.industryChoice === INDUSTRY_OTHER && data.industryCustom.trim() === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['industryCustom'],
      message: i18n.t('orgunits:organizationSchema.enterTheCompanysIndustry'),
    })
  }
})))

export type CompanyProfileFormData = z.infer<ReturnType<typeof companyProfileSchema>>

export const hierarchyLevelsSchema = perLanguage(() => (z.object({
  hierarchyLevels: z.array(z.object({
    id: z.string().optional(),
    unitTypeName: z.string().min(1, i18n.t('orgunits:organizationSchema.theLevelNameCannotBeEmpty')),
    managerRoleLabel: z.string(),
  })).min(2, i18n.t('orgunits:organizationSchema.theOrganizationStructureMustHaveAt')),
})))

export type HierarchyLevelsFormData = z.infer<ReturnType<typeof hierarchyLevelsSchema>>

/**
 * Thang điểm định lượng. Điểm mức không được vượt thang tối đa, nhưng thang tối đa nằm
 * ở state riêng (không thuộc form) nên ràng buộc đó dựng theo ngữ cảnh.
 */
export const createEvaluationLevelsSchema = (maxScore: number) =>
  z.object({
    evaluationLevels: z.array(z.object({
      id: z.string().optional(),
      name: z.string().min(1, i18n.t('orgunits:organizationSchema.theLevelNameCannotBeEmpty2')),
      threshold: z.number({ message: i18n.t('orgunits:organizationSchema.theLevelScoreMustBeA') })
        .min(0, i18n.t('orgunits:organizationSchema.theLevelScoreCannotBeNegative'))
        .max(maxScore, i18n.t('orgunits:organizationSchema.theLevelScoreCannotExceedThe', { maxScore })),
      color: z.string(),
    })).min(1, i18n.t('orgunits:organizationSchema.atLeast1RatingLevelIs')),
  })

export type EvaluationLevelsFormData = z.infer<ReturnType<typeof createEvaluationLevelsSchema>>

export const qualitativeLevelsSchema = perLanguage(() => (z.object({
  qualitativeLevels: z.array(z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1, i18n.t('orgunits:organizationSchema.theLevelNameCannotBeEmpty2')),
    value: z.number({ message: i18n.t('orgunits:organizationSchema.theLevelValueMustBeA') }),
    position: z.number({ message: i18n.t('orgunits:organizationSchema.positionMustBeANumber') })
      .int(i18n.t('orgunits:organizationSchema.positionMustBeAnIntegerGreater'))
      .min(1, i18n.t('orgunits:organizationSchema.positionMustBeAnIntegerGreater')),
    scorePercent: z.number({ message: i18n.t('orgunits:organizationSchema.theBscConversionMustBeA') })
      .min(0, i18n.t('orgunits:organizationSchema.theBscConversionMustBeBetween'))
      .max(100, i18n.t('orgunits:organizationSchema.theBscConversionMustBeBetween')),
    color: z.string(),
  })).min(1, i18n.t('orgunits:organizationSchema.atLeast1EvaluationLevelIs')),
}).superRefine((data, ctx) => {
  // Vị trí phải liên tục từ 1: 1, 2, 3, ..., n (không trùng, không nhảy cóc)
  const positions = data.qualitativeLevels.map(l => Number(l.position)).sort((a, b) => a - b)
  if (positions.some((p, i) => p !== i + 1)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['qualitativeLevels'],
      message: i18n.t('orgunits:organizationSchema.positionsMustBeConsecutiveFrom1'),
    })
  }
})))

export type QualitativeLevelsFormData = z.infer<ReturnType<typeof qualitativeLevelsSchema>>

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
export const unitClassificationSchema = perLanguage(() => (z.object({
  profiles: z.array(unitClassProfileSchema).min(1, i18n.t('orgunits:organizationSchema.atLeastOneProfileIsRequired')),
}).superRefine((data, ctx) => {
  const fail = (message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['profiles'], message })

  // Đúng MỘT hồ sơ mặc định, áp cho mọi kỳ — cùng luật với bộ tiêu chí hạnh kiểm. Giao
  // diện đã giữ bất biến này, kiểm lại ở đây chỉ để dữ liệu cũ không lọt qua.
  const defaults = data.profiles.filter(p => p.isDefault)
  if (defaults.length !== 1) {
    fail(defaults.length ? i18n.t('orgunits:organizationSchema.onlyOneDefaultProfileIsAllowed') : i18n.t('orgunits:organizationSchema.aDefaultProfileIsRequired'))
    return
  }

  const names = data.profiles.map(p => p.name.trim())
  if (names.some(n => !n)) return fail(i18n.t('orgunits:organizationSchema.theProfileNameCannotBeEmpty'))
  if (new Set(names).size !== names.length) return fail(i18n.t('orgunits:organizationSchema.duplicateProfileName'))

  for (const p of data.profiles) {
    if (!p.isDefault && p.orgUnitIds.length === 0) return fail(i18n.t('orgunits:organizationSchema.profileIsNotAssignedToAny', { name: p.name }))
    if (!p.rules.length) return fail(i18n.t('orgunits:organizationSchema.profileNeedsAtLeastOneRating', { name: p.name }))
    if (p.rules.some(r => !r.levelName.trim())) return fail(i18n.t('orgunits:organizationSchema.profileTheLevelNameCannotBe', { name: p.name }))
    if (p.rules.some(r => r.conditions.some(c => !c.level || c.percent < 0 || c.percent > 100))) {
      return fail(i18n.t('orgunits:organizationSchema.profileInvalidConditionMustBe0', { name: p.name }))
    }

    // Khung bell curve chỉ có nghĩa khi các mức phủ đúng 100% nhân sự: tổng 90% thì 10% còn lại
    // không thuộc mức nào, tổng 110% thì hạn mức rộng hơn cả đơn vị.
    const bc = p.bellCurve
    if (bc?.enabled) {
      if (bc.targets.some(t => t.percent < 0 || t.percent > 100)) {
        return fail(i18n.t('orgunits:organizationSchema.profileBellCurveSharesMustBe', { name: p.name }))
      }
      const total = Math.round(bc.targets.reduce((a, t) => a + (t.percent || 0), 0) * 10) / 10
      if (Math.abs(total - 100) > 0.5) {
        return fail(i18n.t('orgunits:organizationSchema.profileBellCurveSharesMustTotal', { name: p.name, total }))
      }
      if (bc.tolerance < 0 || bc.tolerance > 50) {
        return fail(i18n.t('orgunits:organizationSchema.profileBellCurveToleranceMustBe', { name: p.name }))
      }
      if (bc.minMembers < 0) return fail(i18n.t('orgunits:organizationSchema.profileTheMinimumSizeCannotBe', { name: p.name }))
    }
  }
})))

export type UnitClassificationFormData = z.infer<ReturnType<typeof unitClassificationSchema>>
export type UnitClassProfileForm = z.infer<typeof unitClassProfileSchema>
