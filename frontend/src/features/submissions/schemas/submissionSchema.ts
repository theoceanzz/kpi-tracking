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
