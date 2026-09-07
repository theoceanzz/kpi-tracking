import { z } from 'zod'

export const evaluationSchema = z.object({
  userId: z.string().min(1, 'Vui lòng chọn nhân viên'),
  kpiPeriodId: z.string().min(1, 'Vui lòng chọn đợt KPI'),
  score: z.number().min(0, 'Điểm tối thiểu 0'),
  comment: z.string().optional(),
})

export type EvaluationFormData = z.infer<typeof evaluationSchema>

/**
 * Chấm nhanh ngay trong modal chi tiết.
 *
 * <p>Trần điểm (thang điểm + KPI thưởng) chỉ có sau khi truy vấn score-preview trả về, tức
 * là SAU khi form được dựng. Nhận vào hàm đọc thay vì con số để mỗi lần kiểm tra lấy đúng
 * trần tại thời điểm đó; trả về 0 nghĩa là chưa biết trần và bỏ qua ràng buộc này.
 */
export const createInlineEvaluationSchema = (getScoreCeiling: () => number) =>
  z.object({
    score: z.number({ message: 'Vui lòng chấm điểm' })
      .min(1, 'Vui lòng kéo thanh điểm lên trên 0'),
    comment: z.string(),
  }).superRefine((data, ctx) => {
    const ceiling = getScoreCeiling()
    if (ceiling > 0 && data.score > ceiling) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['score'],
        message: `Điểm không được vượt quá ${ceiling}`,
      })
    }
  })

export type InlineEvaluationFormData = z.infer<ReturnType<typeof createInlineEvaluationSchema>>
