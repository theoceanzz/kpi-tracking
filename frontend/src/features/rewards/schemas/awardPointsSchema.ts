import { z } from 'zod'

/** Người được chọn để trao điểm — giữ tên để hiện chip, id để gửi lên. */
const pickedEmployeeSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string().optional(),
})

export const awardPointsSchema = z.object({
  picked: z.array(pickedEmployeeSchema).min(1, 'Vui lòng chọn ít nhất một người nhận'),
  points: z.number({ message: 'Vui lòng nhập số điểm' }).min(1, 'Số điểm phải lớn hơn 0'),
  reason: z.string().trim().min(1, 'Vui lòng nhập lý do thưởng'),
  withCertificate: z.boolean(),
  certificateTemplateId: z.string(),
})

export type AwardPointsFormData = z.infer<typeof awardPointsSchema>
