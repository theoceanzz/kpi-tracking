import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import i18n from 'i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { taskApi } from '../api/taskApi'
import type { KpiTask } from '../types'
import { taskKeys } from './useTasks'

/** Thời gian chờ trước khi xoá thật — đủ để bấm "Hoàn tác". */
const UNDO_MS = 5000

type Cached = { content?: KpiTask[] } | { pages: { content: KpiTask[] }[] } | KpiTask[] | undefined

/** Bỏ việc (và việc con của nó) khỏi mọi danh sách đang có trong cache — người dùng thấy biến mất ngay. */
function hideFromCaches(qc: QueryClient, ids: Set<string>) {
  const drop = (arr: KpiTask[]) => arr.filter((x) => !ids.has(x.id) && !(x.parentTaskId && ids.has(x.parentTaskId))
    && !(x.rootTaskId && ids.has(x.rootTaskId)))
  qc.setQueriesData<Cached>({ queryKey: taskKeys.all }, (old) => {
    if (Array.isArray(old)) return drop(old)
    if (old && 'pages' in old) return { ...old, pages: old.pages.map((p) => ({ ...p, content: drop(p.content) })) }
    if (old && Array.isArray(old.content)) return { ...old, content: drop(old.content) }
    return old
  })
}

/**
 * Xoá có "Hoàn tác" kiểu Lark: việc biến khỏi danh sách ngay, toast "Đã xoá … · Hoàn tác" trong 5 giây; hết giờ mới gọi
 * API xoá. Bấm Hoàn tác ⇒ huỷ hẹn giờ và nạp lại danh sách (không có gì bị xoá trên máy chủ).
 */
export function useDeferredDelete() {
  const qc = useQueryClient()
  return (tasks: Pick<KpiTask, 'id' | 'title'>[], onDone?: () => void) => {
    if (!tasks.length) return
    const ids = new Set(tasks.map((x) => x.id))
    hideFromCaches(qc, ids)
    let cancelled = false
    const refresh = () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
    }
    const timer = window.setTimeout(() => {
      if (cancelled) return
      Promise.all(tasks.map((x) => taskApi.remove(x.id)))
        .then(() => onDone?.())
        .catch((e) => toast.error(getApiErrorMessage(e)))
        .finally(refresh)
    }, UNDO_MS)
    const label = tasks.length === 1
      ? i18n.t('tasks:undo.deletedOne', { title: tasks[0]!.title })
      : i18n.t('tasks:undo.deletedMany', { count: tasks.length })
    toast(label, {
      duration: UNDO_MS,
      action: {
        label: i18n.t('tasks:row.undo'),
        onClick: () => {
          cancelled = true
          window.clearTimeout(timer)
          refresh()
        },
      },
    })
  }
}
