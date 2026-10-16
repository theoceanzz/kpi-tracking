import { z } from 'zod'
import i18n from 'i18next'

/**
 * Hộp tạo công việc. Backend `FormRegistry.TASK_FORM` (trợ lý K.AI điền hộ) phản chiếu đúng các ô dưới —
 * `FormRegistryTest` đối chiếu, thêm / đổi tên ô thì sửa cả hai.
 */
export const taskFormSchema = () => z.object({
  title: z.string().trim().min(1, i18n.t('tasks:validation.titleRequired')).max(255),
  description: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  assigneeIds: z.array(z.string()),
  kpiId: z.string().optional(),
}).refine((v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
  message: i18n.t('tasks:validation.startAfterDue'),
  path: ['startDate'],
})

export type TaskFormValues = z.infer<ReturnType<typeof taskFormSchema>>
