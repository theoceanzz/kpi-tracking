import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export const evaluationSchema = perLanguage(() => (z.object({
  userId: z.string().min(1, i18n.t('evaluations:evaluationSchema.pleaseChooseAnEmployee')),
  kpiPeriodId: z.string().min(1, i18n.t('evaluations:evaluationSchema.pleaseChooseAKpiPeriod')),
  score: z.number().min(0, i18n.t('evaluations:evaluationSchema.minimumScoreIs0')),
  comment: z.string().optional(),
})))

export type EvaluationFormData = z.infer<ReturnType<typeof evaluationSchema>>

/**
 * Chấm nhanh ngay trong modal chi tiết.
 *
 * <p>Trần điểm (thang điểm + KPI thưởng) chỉ có sau khi truy vấn score-preview trả về, tức
 * là SAU khi form được dựng. Nhận vào hàm đọc thay vì con số để mỗi lần kiểm tra lấy đúng
 * trần tại thời điểm đó; trả về 0 nghĩa là chưa biết trần và bỏ qua ràng buộc này.
 */
export const createInlineEvaluationSchema = (getScoreCeiling: () => number) =>
  z.object({
    score: z.number({ message: i18n.t('evaluations:evaluationSchema.pleaseEnterAScore') })
      .min(1, i18n.t('evaluations:evaluationSchema.pleaseDragTheScoreBarAbove')),
    comment: z.string(),
  }).superRefine((data, ctx) => {
    const ceiling = getScoreCeiling()
    if (ceiling > 0 && data.score > ceiling) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['score'],
        message: i18n.t('evaluations:evaluationSchema.theScoreCannotExceed', { ceiling }),
      })
    }
  })

export type InlineEvaluationFormData = z.infer<ReturnType<typeof createInlineEvaluationSchema>>
