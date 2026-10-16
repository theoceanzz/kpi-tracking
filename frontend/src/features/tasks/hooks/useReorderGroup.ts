import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { listApi, mySectionApi } from '../api/listApi'
import { sortOrderForMove } from '../taskUtils'
import type { TaskListDetail, TaskMySection } from '../types'
import { taskKeys, useSetTaskList } from './useTasks'

/** Nhóm kéo được: nhóm của danh sách (biên tập trở lên) hoặc nhóm riêng của tôi. "Chưa phân nhóm" thì không. */
export function isReorderableGroup(key: string, list?: TaskListDetail | null): boolean {
  if (key === 'section:none' || key === 'mysection:none') return false
  if (key.startsWith('section:')) return !!list && !list.archived && list.role !== 'VIEWER'
  return key.startsWith('mysection:')
}

/**
 * Kéo một nhóm (cột Kanban / đầu nhóm trong Danh sách) thả lên nhóm khác ⇒ đổi thứ tự: nhóm của danh sách lưu cho cả danh
 * sách, nhóm riêng chỉ của mình. Trả hàm `(nhóm kéo, nhóm đích)` theo khoá nhóm (`section:<id>` / `mysection:<id>`).
 */
export function useReorderGroup(list?: TaskListDetail | null, mySections?: TaskMySection[]) {
  const qc = useQueryClient()
  const setList = useSetTaskList()
  return (dragKey: string, targetKey: string) => {
    const kind = dragKey.startsWith('mysection:') ? 'mysection' : dragKey.startsWith('section:') ? 'section' : null
    if (!kind || !targetKey.startsWith(`${kind}:`) || !isReorderableGroup(dragKey, list) || !isReorderableGroup(targetKey, list)) return
    const dragId = dragKey.slice(kind.length + 1), targetId = targetKey.slice(kind.length + 1)
    const sorted = [...(kind === 'section' ? list?.sections ?? [] : mySections ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    const order = sortOrderForMove(sorted, dragId, targetId)
    if (order == null) return
    const onError = (e: unknown) => toast.error(getApiErrorMessage(e))
    if (kind === 'section' && list) {
      listApi.updateSection(list.id, dragId, { sortOrder: order }).then(setList).catch(onError)
    } else {
      // Đổi chỗ ngay trong bộ nhớ đệm cho mượt, rồi lưu.
      qc.setQueryData<TaskMySection[]>(taskKeys.mySections, (old) => old?.map((s) => (s.id === dragId ? { ...s, sortOrder: order } : s)))
      mySectionApi.update(dragId, { sortOrder: order }).catch(onError).finally(() => qc.invalidateQueries({ queryKey: taskKeys.mySections }))
    }
  }
}
