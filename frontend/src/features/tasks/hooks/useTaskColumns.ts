import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TaskListField } from '../types'

/** Cột của bảng việc (ngoài cột Tên việc luôn có). `field:<id>` = trường tuỳ chỉnh của danh sách đang xem. */
export type TaskColumnKey = 'assignee' | 'start' | 'due' | 'priority' | 'kpi' | 'tags' | 'creator' | 'created' | `field:${string}`

export interface TaskColumn {
  key: TaskColumnKey
  width: number
  visible: boolean
  /** Người dùng đã tự kéo độ rộng: giữ đúng độ rộng này (dài quá thì bảng cuộn ngang). Chưa kéo thì cột co cho vừa khung. */
  custom?: boolean
}

export const MIN_COL_WIDTH = 72
export const MAX_COL_WIDTH = 480
/** Cột Tên việc co giãn nhưng không hẹp hơn mức này (thiếu chỗ thì bảng cuộn ngang như Lark). */
export const TITLE_MIN_WIDTH = 300

/** Cột mặc định theo Lark (Người thực hiện · Thời gian bắt đầu · Hạn), thêm Ưu tiên và KPI của KeyGo. */
const BASE: TaskColumn[] = [
  // Độ rộng sát nội dung thường gặp ("Vũ Việt Dũng", "Ngày mai, 15:00 🔔", "Trung bình") — không để khoảng trống thừa.
  { key: 'assignee', width: 160, visible: true },
  { key: 'start', width: 140, visible: true },
  { key: 'due', width: 150, visible: true },
  { key: 'priority', width: 116, visible: true },
  { key: 'kpi', width: 160, visible: true },
  { key: 'tags', width: 150, visible: false },
  { key: 'creator', width: 150, visible: false },
  { key: 'created', width: 140, visible: false },
]

function read(key: string): TaskColumn[] | null {
  try {
    const raw = localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : null
    return Array.isArray(v) ? v.filter((c) => c && typeof c.key === 'string') : null
  } catch {
    return null
  }
}

/**
 * Cấu hình cột của bảng (bật / tắt, thứ tự, độ rộng) kiểu "Trường hiển thị" của Lark, nhớ theo trình duyệt cho từng ngữ
 * cảnh (mỗi danh sách một bộ, ngoài danh sách dùng chung). Trường tuỳ chỉnh mới của danh sách tự thêm vào cuối; trường đã
 * xoá tự bỏ đi.
 */
export function useTaskColumns(context: string, fields: TaskListField[] | undefined, defaultVisible?: TaskColumnKey[]) {
  const storageKey = `tasks.columns.${context}`
  const [saved, setSaved] = useState<TaskColumn[] | null>(() => read(storageKey))
  const [savedFor, setSavedFor] = useState(storageKey)
  // Đổi ngữ cảnh (sang danh sách khác) ⇒ nạp bộ cột của ngữ cảnh đó (chỉnh state trong render, không effect).
  if (savedFor !== storageKey) {
    setSavedFor(storageKey)
    setSaved(read(storageKey))
  }

  const columns = useMemo<TaskColumn[]>(() => {
    // Trường tuỳ chỉnh: rộng theo độ dài tên trường (tên cột không bị cắt), trong khoảng 110–200px.
    const fieldCols: TaskColumn[] = (fields ?? []).map((f) => ({
      key: `field:${f.id}` as const, width: Math.min(200, Math.max(110, f.name.length * 8 + 56)), visible: true,
    }))
    // Chỗ nhúng có bộ cột bật sẵn riêng (vd. tab KPI: Hạn + Ưu tiên, theo đúng thứ tự đó, các cột khác tắt).
    const base = defaultVisible
      ? [...defaultVisible.flatMap((k) => BASE.filter((c) => c.key === k)).map((c) => ({ ...c, visible: true })),
        ...BASE.filter((c) => !defaultVisible.includes(c.key)).map((c) => ({ ...c, visible: false }))]
      : BASE
    const defaults = [...base, ...fieldCols]
    if (!saved) return defaults
    const allowed = new Set(defaults.map((c) => c.key))
    // Cột chưa kéo tay luôn lấy độ rộng mặc định hiện hành (bản lưu cũ có thể còn độ rộng cũ rộng thừa).
    const kept = saved.filter((c) => allowed.has(c.key)).map((c) => ({
      key: c.key, visible: !!c.visible, custom: !!c.custom,
      width: c.custom ? Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Number(c.width) || 120))
        : defaults.find((d) => d.key === c.key)?.width ?? 120,
    }))
    const missing = defaults.filter((d) => !kept.some((c) => c.key === d.key))
    return [...kept, ...missing]
  }, [saved, fields, defaultVisible])

  const setColumns = useCallback((next: TaskColumn[]) => {
    setSaved(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* trình duyệt chặn bộ nhớ */ }
  }, [storageKey])

  const reset = useCallback(() => {
    setSaved(null)
    try { localStorage.removeItem(storageKey) } catch { /* bỏ qua */ }
  }, [storageKey])

  return { columns, setColumns, reset }
}

/** Tên hiển thị của một cột. */
export function useColumnLabel(fields?: TaskListField[]) {
  const { t } = useTranslation('tasks')
  return (key: TaskColumnKey): string => {
    switch (key) {
      case 'assignee': return t('detail.assignees')
      case 'start': return t('gantt.start')
      case 'due': return t('detail.dueDate')
      case 'priority': return t('detail.priority')
      case 'kpi': return t('detail.kpi')
      case 'tags': return t('detail.tags')
      case 'creator': return t('list.colCreator')
      case 'created': return t('list.colCreated')
      default: return fields?.find((f) => `field:${f.id}` === key)?.name ?? '?'
    }
  }
}

