import i18n from 'i18next'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, CircleDot, Diamond, XCircle } from 'lucide-react'
import { formatDate, intlLocale } from '@/i18n/format'
import { FOLLOWER_REMOVED_KPI_CHANGED } from './types'
import type { DueBucket, KpiTask, TaskGroupBy, TaskListDetail, TaskMySection, TaskPriority, TaskRecurrence, TaskStatus, TaskTag } from './types'

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

/**
 * Đếm ngược tới hạn kiểu Lark cho việc CÓ GIỜ hạn: trong 24 giờ tới ⇒ "Còn 2 giờ" / "Còn 15 phút"; quá hạn chưa tới 24 giờ
 * ⇒ "Quá 30 phút". Ngoài khoảng đó hoặc việc đã xong / huỷ ⇒ null (dùng nhãn ngày thường). Giờ hạn tính theo giờ Việt Nam.
 */
export function dueCountdown(task: Pick<KpiTask, 'dueDate' | 'dueTime' | 'status'>, now: number): { label: string; overdue: boolean; soon: boolean } | null {
  if (!task.dueDate || !task.dueTime || task.status === 'DONE' || task.status === 'CANCELLED') return null
  const due = Date.parse(`${task.dueDate}T${task.dueTime.slice(0, 5)}:00+07:00`)
  if (Number.isNaN(due)) return null
  const diff = due - now
  const abs = Math.abs(diff)
  if (abs > 24 * 3600_000) return null
  const minutes = Math.max(1, Math.round(abs / 60_000))
  const amount = minutes < 60 ? i18n.t('tasks:due.minutes', { count: minutes }) : i18n.t('tasks:due.hours', { count: Math.round(minutes / 60) })
  return diff >= 0
    ? { label: i18n.t('tasks:due.left', { amount }), overdue: false, soon: diff <= 2 * 3600_000 }
    : { label: i18n.t('tasks:due.ago', { amount }), overdue: true, soon: false }
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
  /** null = nhóm "Không gắn KPI" (kéo vào = gỡ KPI). */
  kpiId?: string | null
  status?: TaskStatus
  ownerId?: string
  priority?: TaskPriority
  /** Nhóm trong danh sách đang xem (null = Chưa phân nhóm). */
  listId?: string
  sectionId?: string | null
  /** Trường tuỳ chỉnh của danh sách: kéo vào = đặt giá trị này (null = xoá). */
  fieldId?: string
  fieldValue?: unknown
  tagId?: string | null
  /** Nhóm riêng của tôi (null = Chưa xếp nhóm) — chỉ là cách tôi tự sắp, không đổi dữ liệu của việc. */
  mySectionId?: string | null
}

/** Ngữ cảnh nhóm: danh sách đang xem (nhóm theo nhóm / trường) và bộ nhãn của tổ chức. */
export interface GroupContext {
  list?: TaskListDetail | null
  tags?: TaskTag[]
  /** Nhóm riêng của tôi (nhóm theo "Nhóm của tôi"). */
  mySections?: TaskMySection[]
  /** Sắp xếp thủ công: trong danh sách đang xem thì theo thứ tự của danh sách. */
  manual?: boolean
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
  /** Màu chấm (lựa chọn của trường / nhãn). */
  color?: string
}

const BUCKET_ORDER: DueBucket[] = ['OVERDUE', 'TODAY', 'TOMORROW', 'THIS_WEEK', 'LATER', 'NONE']

/**
 * Chia danh sách thành nhóm theo chế độ "Nhóm theo". Việc đã xong / đã huỷ dồn vào nhóm "Đã hoàn thành" ở cuối (trừ
 * khi nhóm theo trạng thái — khi đó mỗi trạng thái là một nhóm).
 */
export function groupTasks(tasks: KpiTask[], by: TaskGroupBy, t: (k: string) => string, ctx: GroupContext = {}): TaskGroup[] {
  const today = todayIso()
  const open = by === 'status' ? tasks : tasks.filter((x) => !isClosed(x))
  const closed = by === 'status' ? [] : tasks.filter(isClosed)
  let groups: TaskGroup[] = []
  const list = ctx.list

  if (by === 'section' && list) {
    const sectionOf = (x: KpiTask) => x.lists.find((l) => l.listId === list.id)?.sectionId ?? null
    groups = [
      { key: 'section:none', label: t('group.noSection'), tasks: open.filter((x) => sectionOf(x) == null),
        preset: { listId: list.id, sectionId: null } },
      ...list.sections.map((s) => ({
        key: `section:${s.id}`, label: s.name, tasks: open.filter((x) => sectionOf(x) === s.id),
        preset: { listId: list.id, sectionId: s.id },
      })),
    ]
    // Nhóm "Chưa phân nhóm" trống thì ẩn khi danh sách đã có nhóm riêng.
    if (list.sections.length && groups[0]!.tasks.length === 0) groups = groups.slice(1)
  } else if (by.startsWith('field:') && list) {
    const field = list.fields.find((f) => `field:${f.id}` === by)
    const valueOf = (x: KpiTask) => x.fieldValues.find((v) => v.fieldId === field?.id)?.value
    if (field?.type === 'SINGLE_SELECT') {
      groups = [
        ...field.options.map((o) => ({ key: `field:${o.id}`, label: o.label, tasks: open.filter((x) => valueOf(x) === o.id),
          preset: { fieldId: field.id, fieldValue: o.id }, color: o.color ?? undefined })),
        { key: 'field:none', label: t('group.noValue'), tasks: open.filter((x) => valueOf(x) == null), preset: { fieldId: field.id, fieldValue: null } },
      ]
    } else if (field?.type === 'CHECKBOX') {
      groups = [
        { key: 'field:true', label: t('group.checked'), tasks: open.filter((x) => valueOf(x) === true), preset: { fieldId: field.id, fieldValue: true } },
        { key: 'field:false', label: t('group.unchecked'), tasks: open.filter((x) => valueOf(x) !== true), preset: { fieldId: field.id, fieldValue: false } },
      ]
    } else {
      groups = [{ key: 'all', label: t('group.all'), tasks: open, preset: {} }]
    }
  } else if (by === 'mysection') {
    const mine = [...(ctx.mySections ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    const known = new Set(mine.map((s) => s.id))
    groups = [
      ...mine.map((s) => ({ key: `mysection:${s.id}`, label: s.name, tasks: open.filter((x) => x.mySectionId === s.id),
        preset: { mySectionId: s.id } as GroupPreset })),
      { key: 'mysection:none', label: t('group.noMySection'), tasks: open.filter((x) => !x.mySectionId || !known.has(x.mySectionId)),
        preset: { mySectionId: null } },
    ]
  } else if (by === 'tag') {
    const tags = ctx.tags ?? []
    const used = new Map<string, TaskTag>()
    open.forEach((x) => x.tags.forEach((g) => used.set(g.id, g)))
    groups = [
      ...[...used.values()].sort((a, b) => a.name.localeCompare(b.name)).map((g) => ({
        key: `tag:${g.id}`, label: g.name, tasks: open.filter((x) => x.tags.some((y) => y.id === g.id)),
        preset: { tagId: g.id }, color: g.color ?? undefined,
      })),
      { key: 'tag:none', label: t('group.noTag'), tasks: open.filter((x) => x.tags.length === 0), preset: { tagId: null } },
    ]
    void tags
  } else if (by === 'none') {
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
      const k = x.kpiId ?? 'none'
      const g = map.get(k) ?? {
        key: `kpi:${k}`,
        label: !x.kpiId ? t('group.noKpi')
          : x.kpiDeleted ? t('row.kpiDeleted').replace('{{name}}', x.kpiName ?? '') : (x.kpiName ?? '—'),
        tasks: [],
        preset: x.kpiDeleted ? undefined : { kpiId: x.kpiId },
      }
      g.tasks.push(x)
      map.set(k, g)
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
  // Việc trong danh sách đang xem: thứ tự thủ công theo CẶP (việc, danh sách) chứ không theo việc.
  if (list && ctx.manual) {
    const orderIn = (x: KpiTask) => x.lists.find((l) => l.listId === list.id)?.sortOrder ?? x.sortOrder
    groups.forEach((g) => g.tasks.sort((a, b) => orderIn(a) - orderIn(b)))
  }
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

/** Danh sách người thực hiện để hiện (người chính đứng đầu); dữ liệu cũ chưa có thì dựng từ người phụ trách. */
export function assigneesOf(task: KpiTask) {
  if (task.assignees?.length) return task.assignees
  return [{ id: task.ownerId, fullName: task.ownerName, avatarUrl: task.ownerAvatarUrl, primary: true, completedAt: null }]
}

/** Khoảng ngày [bắt đầu, hạn] của việc (một trong hai có thể thiếu). */
export function spanOf(task: Pick<KpiTask, 'startDate' | 'dueDate'>): { from: string; to: string } | null {
  const from = task.startDate ?? task.dueDate
  const to = task.dueDate ?? task.startDate
  return from && to ? { from, to } : null
}

/** Số ngày giữa hai ngày ISO (b - a). */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2!, m2! - 1, d2!) - Date.UTC(y1!, m1! - 1, d1!)) / 86_400_000)
}

/** Dòng đầu (cắt gọn) làm tên việc. */
export function titleFrom(text: string | null | undefined, max = 120): string {
  const line = (text ?? '').split('\n').map((s) => s.trim()).find(Boolean) ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/** Bảng màu gợi ý cho nhãn / danh sách / lựa chọn mới (xoay vòng). */
export const TAG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

/** Mã lỗi "còn việc con / bị chặn" ⇒ hỏi lại rồi hoàn thành với force. */
export const NEEDS_CONFIRM = ['TASK_PARENT_HAS_OPEN_SUBTASKS', 'TASK_BLOCKED_BY_OPEN']

/**
 * Nút bật/tắt đang chọn (chế độ xem, Ngày/Tuần, Tháng/Tuần, Chọn nhiều, Lọc đang có điều kiện): cùng kiểu với mục đang chọn
 * ở cột trái — nền màu chính nhạt, chữ màu chính, đậm. Kiểu `secondary` (nền xám) quá mờ, người dùng không biết đang ở đâu.
 * Dùng với `variant="ghost"`.
 */
export const TOGGLE_ON = 'bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]'

/**
 * Kéo nhóm `dragId` thả lên nhóm `targetId` (cột Kanban / đầu nhóm trong Danh sách): trả thứ tự mới để nhóm kéo nằm vào
 * CHỖ của nhóm đích (kéo sang phải / xuống ⇒ sau nhóm đích, sang trái / lên ⇒ trước nó). null = không đổi.
 */
export function sortOrderForMove(sorted: { id: string; sortOrder: number }[], dragId: string, targetId: string): number | null {
  const from = sorted.findIndex((x) => x.id === dragId)
  const to = sorted.findIndex((x) => x.id === targetId)
  if (from < 0 || to < 0 || from === to) return null
  const rest = sorted.filter((x) => x.id !== dragId)
  const at = rest.findIndex((x) => x.id === targetId) + (to > from ? 1 : 0)
  const before = rest[at - 1], after = rest[at]
  if (before && after) return (before.sortOrder + after.sortOrder) / 2
  if (before) return before.sortOrder + 1
  if (after) return after.sortOrder - 1
  return null
}

// ── Lưới giờ của Lịch tuần ────────────────────────────────────────────────────────────────────────

/** Chiều cao một giờ trên lưới tuần (px). */
export const WEEK_HOUR_H = 44
/** Bước kéo / bấm trên lưới giờ (phút). */
export const WEEK_SNAP_MIN = 15
/** Việc chỉ có giờ hạn hiện thành khối dài ngần này (phút) bắt đầu từ giờ hạn. */
export const WEEK_POINT_MIN = 30

/** "HH:mm[:ss]" → số phút trong ngày. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Số phút trong ngày → "HH:mm:00" (giới hạn trong ngày). */
export function timeOf(minutes: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`
}

/** Việc hiện thành khối trên lưới giờ: có giờ hạn và gói trong MỘT ngày (việc nhiều ngày nằm ở dải "Cả ngày"). */
export function isTimedTask(task: Pick<KpiTask, 'dueDate' | 'dueTime' | 'startDate'>): boolean {
  return !!task.dueDate && !!task.dueTime && (!task.startDate || task.startDate === task.dueDate)
}

/** Khoảng [bắt đầu, kết thúc] (phút) của khối trên lưới giờ. */
export function timedRange(task: Pick<KpiTask, 'dueDate' | 'dueTime' | 'startDate' | 'startTime'>): { start: number; end: number; ranged: boolean } {
  const due = minutesOf(task.dueTime!)
  if (task.startTime && task.startDate === task.dueDate) {
    const start = minutesOf(task.startTime)
    if (start < due) return { start, end: due, ranged: true }
  }
  return { start: due, end: Math.min(24 * 60, due + WEEK_POINT_MIN), ranged: false }
}

/** Ô giờ dưới toạ độ màn hình (cột ngày mang `data-tday`) — làm tròn theo bước kéo. */
export function weekSlotAt(x: number, y: number): { day: string; minutes: number } | null {
  const col = document.elementsFromPoint(x, y).find((el) => el instanceof HTMLElement && el.dataset.tday) as HTMLElement | undefined
  if (!col) return null
  const top = col.getBoundingClientRect().top
  const raw = ((y - top) / WEEK_HOUR_H) * 60
  const minutes = Math.max(0, Math.min(24 * 60 - WEEK_SNAP_MIN, Math.floor(raw / WEEK_SNAP_MIN) * WEEK_SNAP_MIN))
  return { day: col.dataset.tday!, minutes }
}

// ── Lặp lại ──────────────────────────────────────────────────────────────────────────────────────

/** Chuỗi mô tả quy tắc lặp (dùng ở bảng chi tiết). */
export function recurrenceSummary(r: TaskRecurrence | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!r) return t('repeat.none')
  const n = r.interval ?? 1
  const tail = r.count ? ` · ${t('repeat.countSummary', { count: r.count })}` : ''
  switch (r.freq) {
    case 'DAILY': return t('repeat.summaryDaily', { count: n }) + tail
    case 'WEEKLY': {
      const days = r.byWeekday ?? []
      if (n === 1 && days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return t('repeat.workdays') + tail
      return t('repeat.summaryWeekly', { count: n, days: days.map((d) => t(`weekday.${d}`)).join(', ') }) + tail
    }
    case 'MONTHLY':
      if (r.bySetPos && r.byWeekday?.length) {
        return t('repeat.summaryMonthlyNth', { count: n, pos: t(`repeat.pos.${r.bySetPos}`), day: t(`weekday.${r.byWeekday[0]}`) }) + tail
      }
      return t('repeat.summaryMonthly', { count: n, day: r.byMonthDay ?? '' }) + tail
    case 'YEARLY': return t('repeat.summaryYearly', { count: n, day: r.byMonthDay ?? '', month: r.byMonth ?? '' }) + tail
  }
}

/**
 * Ngày kiểu Lark cho bảng chi tiết / ô hạn: "Hôm nay" / "Ngày mai" / "Hôm qua", còn lại ngày + tháng ngắn ("4 thg 7",
 * "Jul 4"; khác năm thì kèm năm), có giờ thì thêm ", 18:00".
 */
export function larkDay(date: string, time?: string | null): string {
  const today = todayIso()
  let day: string
  if (date === today) day = i18n.t('tasks:due.today')
  else if (date === addDays(today, 1)) day = i18n.t('tasks:due.tomorrow')
  else if (date === addDays(today, -1)) day = i18n.t('tasks:due.yesterday')
  else {
    const d = new Date(`${date}T00:00:00`)
    day = new Intl.DateTimeFormat(intlLocale(), date.slice(0, 4) === today.slice(0, 4)
      ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
  }
  return time ? `${day}, ${time.slice(0, 5)}` : day
}

/** Khoảng thời gian của việc kiểu Lark: "Hôm nay - Ngày mai, 18:00" / "Ngày mai, 18:00" / "4 thg 7 -". */
export function larkRange(task: Pick<KpiTask, 'startDate' | 'startTime' | 'dueDate' | 'dueTime'>): string {
  const start = task.startDate ? larkDay(task.startDate, task.startTime) : null
  const due = task.dueDate ? larkDay(task.dueDate, task.dueTime) : null
  if (start && due) return `${start} - ${due}`
  if (start) return `${start} -`
  return due ?? ''
}

/** Chữ xám mời bấm của ô trống trong bảng chi tiết (Lark: "Add to Task List", "Add Description"…). */
export const placeholderBtn = 'rounded-md px-1.5 py-1 text-left text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:cursor-default disabled:hover:bg-transparent'

/** Câu mô tả một thay đổi trong lịch sử việc ("đổi hạn từ … sang …") — dùng ở bảng chi tiết và trang Hoạt động. */
export function historyText(t: (k: string, o?: Record<string, unknown>) => string, action: string, oldValue: string | null, newValue: string | null): string {
  return t(action === 'FOLLOWER_REMOVED' && newValue === FOLLOWER_REMOVED_KPI_CHANGED
    ? 'history.FOLLOWER_REMOVED_KPI_CHANGED'
    : action === 'DECLINED' && newValue ? 'history.DECLINED_REASON' : `history.${action}`, {
    from: action === 'STATUS_CHANGED' && oldValue ? t(`status.${oldValue}`) : (oldValue ?? '-'),
    to: action === 'STATUS_CHANGED' && newValue ? t(`status.${newValue}`) : (newValue ?? '-'),
    defaultValue: action,
  })
}

/** Mở hộp "Tuỳ chỉnh" (cột) ở đầu bảng Danh sách — nút cùng tên trên thanh công cụ gọi qua sự kiện này. */
export const CUSTOMIZE_EVENT = 'tasks:customize-columns'

/** "Đang làm" của Lark (Ongoing) = chưa làm + đang làm. */
export const OPEN_STATUSES: readonly TaskStatus[] = ['TODO', 'IN_PROGRESS']

/** Bộ lọc trạng thái hiện tại ứng với lựa chọn nào của ô "Đang làm ▾" (Ongoing / Completed / All Tasks của Lark). */
export function statusPreset(status: TaskStatus[]): 'ongoing' | 'completed' | 'all' | 'custom' {
  if (status.length === 0) return 'all'
  if (status.length === 1 && status[0] === 'DONE') return 'completed'
  if (status.length === OPEN_STATUSES.length && OPEN_STATUSES.every((s) => status.includes(s))) return 'ongoing'
  return 'custom'
}

/** Biểu tượng hoàn thành của một việc: việc mốc là hình thoi (đặc khi xong) như Lark, còn lại theo trạng thái. */
export function statusStyleOf(task: Pick<KpiTask, 'status' | 'milestone'>, status: TaskStatus = task.status): { icon: typeof Circle; className: string } {
  const base = STATUS_STYLE[status]
  if (!task.milestone) return base
  return { icon: Diamond, className: cn(base.className, status === 'DONE' && '[&>path]:fill-current') }
}
