import { z } from 'zod'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export const submissionSchema = perLanguage(() => (z.object({
  kpiCriteriaId: z.string().min(1, i18n.t('submissions:submissionSchema.pleaseChooseAKpi')),
  // Optional so qualitative KPIs (no numeric value) can be submitted; the backend
  // still requires a value for quantitative KPIs.
  actualValue: z.number().min(0, i18n.t('submissions:submissionSchema.theValueCannotBeNegative')).optional(),
  qualitativeLevelId: z.string().optional(),
  note: z.string().optional(),
  // periodStart/periodEnd cố ý KHÔNG có ở đây: form chưa bao giờ vẽ ô nhập cho chúng, nên chúng
  // luôn đi lên máy chủ là undefined. Giữ lại thì FormRegistry phía backend soi gương schema này
  // và trợ lý AI đi hỏi người dùng hai cái ngày không có chỗ nào nhập.
  //
  // Cột period_start/period_end vẫn còn trong CSDL và vẫn hiện ở trang chi tiết báo cáo — đây chỉ
  // gỡ phần khai báo chết trong form.
})))

export type SubmissionFormData = z.infer<ReturnType<typeof submissionSchema>>

/**
 * Duyệt / trả lại bài nộp. Một biểu mẫu phục vụ cả hai nút, và ràng buộc đổi theo loại
 * KPI (định tính chọn mức, định lượng chấm điểm) nên schema dựng theo ngữ cảnh.
 */
export const createReviewSubmissionSchema = ({ isQualitative }: { isQualitative: boolean }) =>
  z.object({
    mode: z.enum(['view', 'reject']),
    reviewNote: z.string(),
    managerScore: z.number({ message: i18n.t('submissions:submissionSchema.theFinalScoreMustBeA') }).min(0, i18n.t('submissions:submissionSchema.theScoreCannotBeNegative')).optional(),
    qualitativeLevelId: z.string().optional(),
  }).superRefine((data, ctx) => {
    if (data.mode === 'reject') {
      if (!data.reviewNote.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reviewNote'], message: i18n.t('submissions:submissionSchema.pleaseEnterTheRejectionReason') })
      }
      return
    }
    // Duyệt: KPI định tính phải chọn mức, backend tự quy ra điểm từ mức đó.
    if (isQualitative && !data.qualitativeLevelId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['qualitativeLevelId'],
        message: i18n.t('submissions:submissionSchema.pleaseChooseAQualitativeEvaluationLevel'),
      })
    }
  })

export type ReviewSubmissionFormData = z.infer<ReturnType<typeof createReviewSubmissionSchema>>

/**
 * Bảng chấm tổng hợp cho một nhân viên trong một đợt: điểm/mức từng KPI, nhận xét chung
 * và điểm chốt cuối.
 *
 * <p>Danh sách KPI định tính cần chọn mức và trần điểm chỉ biết lúc chạy, nên schema dựng
 * theo ngữ cảnh. `getScoreCeiling` là hàm vì trần đến sau khi form đã dựng (score-preview);
 * trả về 0 nghĩa là chưa biết trần và bỏ qua ràng buộc đó.
 */
export const createStaffEvaluationSchema = (
  { qualitativeIds, getScoreCeiling }: { qualitativeIds: string[]; getScoreCeiling: () => number },
) =>
  z.object({
    individualScores: z.record(z.string(), z.number()),
    individualLevels: z.record(z.string(), z.string()),
    overallComment: z.string(),
    finalScore: z.number({ message: i18n.t('submissions:submissionSchema.theFinalScoreMustBeA') }).min(0, i18n.t('submissions:submissionSchema.theFinalScoreCannotBeNegative')),
  }).superRefine((data, ctx) => {
    const ceiling = getScoreCeiling()
    if (ceiling > 0 && data.finalScore > ceiling) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['finalScore'],
        message: i18n.t('submissions:submissionSchema.theFinalScoreCannotExceed', { ceiling }),
      })
    }
    const missing = qualitativeIds.filter(id => !data.individualLevels[id])
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['individualLevels'],
        message: i18n.t('submissions:submissionSchema.qualitativeKpisHaveNoEvaluationLevel', { count: missing.length }),
      })
    }
  })

export type StaffEvaluationFormData = z.infer<ReturnType<typeof createStaffEvaluationSchema>>
