import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { GroupPreset } from '../taskUtils'
import type { KpiTask } from '../types'
import { useTaskMutations } from './useTasks'

/**
 * Kéo một việc vào nhóm / cột / ô ngày ⇒ đổi đúng thuộc tính của nhóm: trạng thái, ưu tiên, hạn, KPI. Nhóm người phụ
 * trách cần chọn lại KPI của người mới nên trả về cho màn cha mở hộp giao. Dùng chung cho Danh sách, Kanban, Lịch.
 */
export function useGroupDrop(onRequestAssign?: (task: KpiTask, ownerId: string) => void) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const onError = (er: unknown) => toast.error(getApiErrorMessage(er))

  return (task: KpiTask, p: GroupPreset | undefined): boolean => {
    if (!p) {
      toast.error(t('list.cannotDrop'))
      return false
    }
    if (!task.canEdit) {
      toast.error(t(`readOnly.${task.readOnlyReason ?? 'NOT_OWNER'}`))
      return false
    }
    if (p.status && p.status !== task.status) {
      m.changeStatus.mutate({ id: task.id, status: p.status, version: task.version }, { onError })
    } else if (p.priority && p.priority !== task.priority) {
      m.update.mutate({ id: task.id, input: { version: task.version, priority: p.priority } }, { onError })
    } else if (p.dueDate !== undefined && p.dueDate !== task.dueDate) {
      m.update.mutate({
        id: task.id,
        input: p.dueDate === null ? { version: task.version, clearDueDate: true } : { version: task.version, dueDate: p.dueDate },
      }, { onError })
    } else if (p.kpiId && p.kpiId !== task.kpiId) {
      if (task.parentTaskId) {
        toast.error(t('list.subtaskKpiFixed'))
        return false
      }
      m.move.mutate({ fromKpiId: task.kpiId, toKpiId: p.kpiId, taskIds: [task.id] }, { onError })
    } else if (p.ownerId && p.ownerId !== task.ownerId) {
      onRequestAssign?.(task, p.ownerId)
    } else {
      return false
    }
    return true
  }
}
