import { z } from 'zod'
import { tierError } from '../components/TierEditor'
import { RewardProgramScope, RewardRankingMetric, RewardTiePolicy } from '../types'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const tierSchema = z.object({
  fromRank: z.number(),
  toRank: z.number(),
  points: z.number(),
})

export const programSchema = perLanguage(() => (z.object({
  name: z.string().min(1, i18n.t('rewards:programSchema.pleaseEnterTheProgramName')),
  description: z.string(),
  scope: z.enum(RewardProgramScope),
  orgUnitId: z.string(),
  /** Rỗng = dùng cho mọi kỳ/đợt. */
  fixedTargetId: z.string(),
  metric: z.enum(RewardRankingMetric),
  tiePolicy: z.enum(RewardTiePolicy),
  minMetricValue: z.number().optional(),
  maxPointsPerRun: z.number().min(1, i18n.t('rewards:programSchema.thePointCapPerRunMust')).optional(),
  includeUnitHeads: z.boolean(),
  enabled: z.boolean(),
  autoTrigger: z.boolean(),
  tiers: z.array(tierSchema),
}).superRefine((data, ctx) => {
  // Luật bậc thưởng (chồng hạng, hạng ngược, điểm <= 0) dùng chung với màn hình chạy,
  // nên gọi lại đúng hàm đó thay vì chép luật sang zod và để hai bản lệch nhau.
  const message = tierError(data.tiers)
  if (message) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers'], message })
  }
})))

export type ProgramFormData = z.infer<ReturnType<typeof programSchema>>
