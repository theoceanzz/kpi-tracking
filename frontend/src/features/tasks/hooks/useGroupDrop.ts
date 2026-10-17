import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { taskApi } from '../api/taskApi'
import type { GroupPreset } from '../taskUtils'
import type { KpiTask } from '../types'
import { useTaskMutations } from './useTasks'
import { useFollowerRemovalConfirm } from './useFollowerRemovalConfirm'

/**
 * Kéo một việc vào nhóm / cột / ô ngày ⇒ đổi đúng thuộc tính của nhóm: trạng thái, ưu tiên, hạn, KPI (gắn / đổi / gỡ — qua
 * hộp xác nhận người theo dõi bị gỡ), nhóm trong danh sách, giá trị trường tuỳ chỉnh, nhãn. Nhóm người phụ trách cần chọn
 * lại KPI của người mới nên trả về cho màn cha mở hộp giao. Dùng chung cho Danh sách, Kanban, Lịch, Gantt.
 * Trả {@code dialog} để màn gọi đặt vào JSX (hộp xác nhận gỡ người theo dõi khi đổi KPI).
 */
export function useGroupDrop(onRequestAssign?: (task: KpiTask, ownerId: string) => void) {
  const { t } = useTranslation('tasks')
  const m = useTaskMutations()
  const removal = useFollowerRemovalConfirm()
  const onError = (er: unknown) => toast.error(getApiErrorMessage(er))

  const drop = (task: KpiTask, p: GroupPreset | undefined): boolean => {
    if (!p) {
      toast.error(t('list.cannotDrop'))
      return false
    }
    // Nhóm trong danh sách: chỉ là chỗ đặt việc trong danh sách — không đổi dữ liệu của việc.
    if (p.listId !== undefined && p.sectionId !== undefined) {
      const current = task.lists.find((l) => l.listId === p.listId)?.sectionId ?? null
      if (current === p.sectionId) return false
      m.moveInList.mutate({ listId: p.listId, taskId: task.id, sectionId: p.sectionId, clearSection: p.sectionId === null }, { onError })
      return true
    }
    // Nhóm riêng của tôi: chỉ là cách tôi tự sắp — ai xem được việc cũng xếp được, không cần quyền sửa.
    if (p.mySectionId !== undefined) {
      if ((task.mySectionId ?? null) === p.mySectionId) return false
      m.assignMySection.mutate({ taskId: task.id, sectionId: p.mySectionId }, { onError })
      return true
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
    } else if (p.kpiId !== undefined && p.kpiId !== task.kpiId) {
      if (task.parentTaskId) {
        toast.error(t('list.subtaskKpiFixed'))
        return false
      }
      if (!task.canSetKpi) {
        toast.error(t('kpiLink.notAllowed'))
        return false
      }
      const kpiId = p.kpiId
      void removal.start({
        preview: () => (kpiId ? taskApi.assignImpact(task.id, kpiId) : Promise.resolve([])),
        commit: (confirmed) => m.setKpi.mutateAsync({ id: task.id, kpiId, version: task.version, confirmedFollowerRemovals: confirmed }),
        onSuccess: () => {},
        onError,
      })
    } else if (p.fieldId !== undefined) {
      m.setFieldValue.mutate({ id: task.id, fieldId: p.fieldId, value: p.fieldValue ?? null }, { onError })
    } else if (p.tagId !== undefined) {
      const ids = task.tags.map((x) => x.id)
      const next = p.tagId === null ? [] : ids.includes(p.tagId) ? ids : [...ids, p.tagId]
      m.setTags.mutate({ id: task.id, tagIds: next }, { onError })
    } else if (p.ownerId && p.ownerId !== task.ownerId) {
      onRequestAssign?.(task, p.ownerId)
    } else {
      return false
    }
    return true
  }

  return { drop, dialog: removal.dialog }
}
