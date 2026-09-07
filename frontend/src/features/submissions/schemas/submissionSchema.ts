import { z } from 'zod'

export const submissionSchema = z.object({
  kpiCriteriaId: z.string().min(1, 'Vui lòng chọn chỉ tiêu'),
  // Optional so qualitative KPIs (no numeric value) can be submitted; the backend
  // still requires a value for quantitative KPIs.
  actualValue: z.number().min(0, 'Giá trị không được âm').optional(),
  qualitativeLevelId: z.string().optional(),
  note: z.string().optional(),
  // periodStart/periodEnd cố ý KHÔNG có ở đây: form chưa bao giờ vẽ ô nhập cho chúng, nên chúng
  // luôn đi lên máy chủ là undefined. Giữ lại thì FormRegistry phía backend soi gương schema này
  // và trợ lý AI đi hỏi người dùng hai cái ngày không có chỗ nào nhập.
  //
  // Cột period_start/period_end vẫn còn trong CSDL và vẫn hiện ở trang chi tiết báo cáo — đây chỉ
  // gỡ phần khai báo chết trong form.
})

export type SubmissionFormData = z.infer<typeof submissionSchema>

/**
 * Duyệt / trả lại bài nộp. Một biểu mẫu phục vụ cả hai nút, và ràng buộc đổi theo loại
 * KPI (định tính chọn mức, định lượng chấm điểm) nên schema dựng theo ngữ cảnh.
 */
export const createReviewSubmissionSchema = ({ isQualitative }: { isQualitative: boolean }) =>
  z.object({
    mode: z.enum(['view', 'reject']),
    reviewNote: z.string(),
    managerScore: z.number({ message: 'Điểm chốt cuối phải là số' }).min(0, 'Điểm không được âm').optional(),
    qualitativeLevelId: z.string().optional(),
  }).superRefine((data, ctx) => {
    if (data.mode === 'reject') {
      if (!data.reviewNote.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reviewNote'], message: 'Vui lòng nhập lý do từ chối' })
      }
      return
    }
    // Duyệt: KPI định tính phải chọn mức, backend tự quy ra điểm từ mức đó.
    if (isQualitative && !data.qualitativeLevelId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['qualitativeLevelId'],
        message: 'Vui lòng chọn mức đánh giá định tính',
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
    finalScore: z.number({ message: 'Điểm chốt cuối phải là số' }).min(0, 'Điểm chốt cuối không được âm'),
  }).superRefine((data, ctx) => {
    const ceiling = getScoreCeiling()
    if (ceiling > 0 && data.finalScore > ceiling) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['finalScore'],
        message: `Điểm chốt cuối không được vượt quá ${ceiling}`,
      })
    }
    const missing = qualitativeIds.filter(id => !data.individualLevels[id])
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['individualLevels'],
        message: `Còn ${missing.length} KPI định tính chưa chọn mức đánh giá`,
      })
    }
  })

export type StaffEvaluationFormData = z.infer<ReturnType<typeof createStaffEvaluationSchema>>
