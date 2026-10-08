import i18n from 'i18next'
import { CheckCircle2, Circle, CircleDot, XCircle } from 'lucide-react'
import { formatDate } from '@/i18n/format'
import type { DueBucket, KpiTask, TaskGroupBy, TaskPriority, TaskStatus } from './types'

/** Ngày làm việc cuối tuần — chưa cấu hình theo tổ chức (thống nhất: đổi ở đúng một chỗ này khi cần). */
export const LAST_WORKDAY = 5 // thứ 6 (Date.getDay: 0 = CN … 6 = thứ 7)

const pad = (n: number) => String(n).padStart(2, '0')

/** Ngày hôm nay theo giờ Việt Nam, dạng yyyy-MM-dd (khớp cách máy chủ phân nhóm hạn). */
export function todayIso(): string {
  return isoInVn(new Date())
}

export function isoInVn(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d)
  return parts // en-CA ⇒ yyyy-MM-dd
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d! + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()
}

/**
 * Hạn khi kéo vào nhóm "Tuần này": thứ 6 của tuần đó; hôm nay đã qua thứ 6 (thứ 7, CN) thì là hôm nay.
 */
export function endOfWorkWeek(today: string = todayIso()): string {
  const wd = weekdayOf(today)
  if (wd === 0 || wd > LAST_WORKDAY) return today
  return addDays(today, LAST_WORKDAY - wd)
}

/** "15/03/2099" hoặc "15/03/2099 16:00". */
export function formatDue(task: Pick<KpiTask, 'dueDate' | 'dueTime'>): string {
  if (!task.dueDate) return ''
  return task.dueTime ? `${formatDate(task.dueDate)} ${task.dueTime.slice(0, 5)}` : formatDate(task.dueDate)
}

/** Nhãn hạn ngắn kiểu Lark: Hôm nay / Ngày mai / Hôm qua / ngày. */
export function shortDue(task: Pick<KpiTask, 'dueDate' | 'dueTime'>): string {
  if (!task.dueDate) return ''
  const today = todayIso()
  const time = task.dueTime ? ` ${task.dueTime.slice(0, 5)}` : ''
  if (task.dueDate === today) return i18n.t('tasks:due.today') + time
  if (task.dueDate === addDays(today, 1)) return i18n.t('tasks:due.tomorrow') + time
  if (task.dueDate === addDays(today, -1)) return i18n.t('tasks:due.yesterday') + time
  return formatDate(task.dueDate) + time
}

/** Quá hạn: chữ đỏ; hạn hôm nay: chữ cam. */
export function dueTone(task: Pick<KpiTask, 'overdue' | 'dueToday' | 'status'>): string {
  if (task.status === 'DONE' || task.status === 'CANCELLED') return 'text-[var(--color-subtle-foreground)]'
  if (task.overdue) return 'text-[var(--color-error)]'
  if (task.dueToday) return 'text-[var(--color-warning)]'
  return 'text-[var(--color-subtle-foreground)]'
}

export const isClosed = (t: Pick<KpiTask, 'status'>) => t.status === 'DONE' || t.status === 'CANCELLED'

export const STATUS_STYLE: Record<TaskStatus, { icon: typeof Circle; className: string }> = {
  TODO: { icon: Circle, className: 'text-[var(--color-subtle-foreground)]' },
  IN_PROGRESS: { icon: CircleDot, className: 'text-[var(--color-info)]' },
  DONE: { icon: CheckCircle2, className: 'text-[var(--color-success)]' },
  CANCELLED: { icon: XCircle, className: 'text-[var(--color-muted-foreground)]' },
}

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  HIGH: 'var(--color-error)',
  MEDIUM: 'var(--color-warning)',
  LOW: 'var(--color-info)',
}

// ── Nhóm ─────────────────────────────────────────────────────────────────────────────────────────

/** Những gì một nhóm "biết" để điền sẵn khi thêm nhanh và để đổi khi kéo một việc vào nhóm. */
export interface GroupPreset {
  dueDate?: string | null // null = xoá hạn
  kpiId?: string
  status?: TaskStatus
  ownerId?: string
  priority?: TaskPriority
}

export interface TaskGroup {
  key: string
  label: string
  tasks: KpiTask[]
  /** Điền sẵn / đổi khi thả vào; undefined = nhóm không nhận thả (Quá hạn, Sau này, Đã hoàn thành). */
  preset?: GroupPreset
  /** Nhóm "Đã hoàn thành" — thu gọn ở cuối. */
  completed?: boolean
  tone?: string
}

const BUCKET_ORDER: DueBucket[] = ['OVERDUE', 'TODAY', 'TOMORROW', 'THIS_WEEK', 'LATER', 'NONE']

/**
 * Chia danh sách thành nhóm theo chế độ "Nhóm theo". Việc đã xong / đã huỷ dồn vào nhóm "Đã hoàn thành" ở cuối (trừ
 * khi nhóm theo trạng thái — khi đó mỗi trạng thái là một nhóm).
 */
export function groupTasks(tasks: KpiTask[], by: TaskGroupBy, t: (k: string) => string): TaskGroup[] {
  const today = todayIso()
  const open = by === 'status' ? tasks : tasks.filter((x) => !isClosed(x))
  const closed = by === 'status' ? [] : tasks.filter(isClosed)
  let groups: TaskGroup[] = []

  if (by === 'none') {
    groups = [{ key: 'all', label: t('group.all'), tasks: open, preset: {} }]
  } else if (by === 'due') {
    const presets: Record<DueBucket, GroupPreset | undefined> = {
      OVERDUE: undefined,
      TODAY: { dueDate: today },
      TOMORROW: { dueDate: addDays(today, 1) },
      THIS_WEEK: { dueDate: endOfWorkWeek(today) },
      LATER: undefined,
      NONE: { dueDate: null },
    }
    groups = BUCKET_ORDER.map((b) => ({
      key: `due:${b}`,
      label: t(`bucket.${b}`),
      tasks: open.filter((x) => x.dueBucket === b),
      preset: presets[b],
      tone: b === 'OVERDUE' ? 'text-[var(--color-error)]' : b === 'TODAY' ? 'text-[var(--color-warning)]' : undefined,
    }))
  } else if (by === 'status') {
    groups = (['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as TaskStatus[]).map((s) => ({
      key: `status:${s}`, label: t(`status.${s}`), tasks: open.filter((x) => x.status === s), preset: { status: s },
    }))
  } else if (by === 'priority') {
    groups = (['HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((p) => ({
      key: `priority:${p}`, label: t(`priority.${p}`), tasks: open.filter((x) => x.priority === p), preset: { priority: p },
    }))
  } else if (by === 'kpi') {
    const map = new Map<string, TaskGroup>()
    for (const x of open) {
      const g = map.get(x.kpiId) ?? {
        key: `kpi:${x.kpiId}`,
        label: x.kpiDeleted ? t('row.kpiDeleted').replace('{{name}}', x.kpiName ?? '') : (x.kpiName ?? '—'),
        tasks: [],
        preset: x.kpiDeleted ? undefined : { kpiId: x.kpiId },
      }
      g.tasks.push(x)
      map.set(x.kpiId, g)
    }
    groups = [...map.values()]
  } else if (by === 'owner') {
    const map = new Map<string, TaskGroup>()
    for (const x of open) {
      const g = map.get(x.ownerId) ?? { key: `owner:${x.ownerId}`, label: x.ownerName ?? '—', tasks: [], preset: { ownerId: x.ownerId } }
      g.tasks.push(x)
      map.set(x.ownerId, g)
    }
    groups = [...map.values()]
  }

  // Nhóm theo hạn: ẩn nhóm trống không nhận thả (Quá hạn / Sau này) cho gọn; nhóm khác giữ để kéo vào / thêm nhanh.
  groups = groups.filter((g) => g.tasks.length > 0 || g.preset !== undefined)
  if (closed.length) {
    groups.push({ key: 'completed', label: t('group.completed'), tasks: closed, completed: true })
  }
  return groups
}

/** Thứ tự thủ công: giá trị nằm giữa hai việc lân cận (sắp xếp kiểu "fractional index"). */
export function sortOrderBetween(before?: KpiTask, after?: KpiTask): number {
  if (before && after) return (before.sortOrder + after.sortOrder) / 2
  if (before) return before.sortOrder + 1
  if (after) return after.sortOrder - 1
  return 0
}
