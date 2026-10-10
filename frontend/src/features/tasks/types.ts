import type { KpiStatus } from '@/types/kpi'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'
export type TaskVisibility = 'KPI_SCOPE' | 'PRIVATE'
export type TaskDueFilter = 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'WEEK' | 'LATER' | 'NONE'
export type TaskReadOnlyReason = 'NOT_OWNER' | 'CYCLE_LOCKED' | 'KPI_DELETED'
export type DueBucket = 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'LATER' | 'NONE'
/** Chế độ xem ở cột trái. */
export type TaskView = 'ASSIGNED' | 'FOLLOWING' | 'CREATED' | 'DELEGATED' | 'DONE' | 'ALL' | 'TEAM'
export type TaskGroupBy = 'due' | 'kpi' | 'status' | 'owner' | 'priority' | 'none'
export type TaskSort = 'due' | 'priority' | 'created' | 'manual'
export type ReminderKind = 'AT_DUE' | 'BEFORE' | 'CUSTOM'

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']
export const TASK_PRIORITIES: TaskPriority[] = ['HIGH', 'MEDIUM', 'LOW']

export interface TaskChecklistItem {
  id: string
  title: string
  done: boolean
  sortOrder: number
}

export interface TaskAttachment {
  id: string
  fileName: string
  fileUrl: string
  fileSize: number | null
  contentType: string | null
  image: boolean
  createdAt: string
  /** Sao từ thư viện tài liệu — nhãn "Từ thư viện: …". */
  fromLibrary?: boolean
  sourceDocumentTitle?: string | null
  /** Chỉ có khi tài liệu gốc còn và mình xem được — link "Mở bản mới nhất". */
  sourceDocumentId?: string | null
}

export interface TaskPerson {
  id: string
  fullName: string | null
  avatarUrl: string | null
}

export interface TaskReminder {
  id: string
  kind: ReminderKind
  offsetMinutes: number | null
  customAt: string | null
  remindAt: string | null
  sentAt: string | null
}

export interface TaskRecurrence {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval?: number
  byWeekday?: number[] | null
  byMonthDay?: number | null
}

export interface KpiTask {
  id: string
  kpiId: string
  kpiName: string | null
  kpiStatus: KpiStatus | null
  kpiDeleted: boolean
  kpiPeriodId: string | null
  kpiPeriodName: string | null
  title: string
  description: string | null
  descriptionDoc: string | null
  dueDate: string | null
  dueTime: string | null
  dueToday: boolean
  dueBucket: DueBucket
  priority: TaskPriority
  status: TaskStatus
  visibility: TaskVisibility
  ownerId: string
  ownerName: string | null
  ownerAvatarUrl: string | null
  createdById: string | null
  createdByName: string | null
  parentTaskId: string | null
  parentTitle: string | null
  overdue: boolean
  checklistDone: number
  checklistTotal: number
  subtaskDone: number
  subtaskTotal: number
  attachmentCount: number
  commentCount: number
  unreadComments: number
  sortOrder: number
  version: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  recurrence: TaskRecurrence | null
  recurrenceEndDate: string | null
  seriesId: string | null
  followers: TaskPerson[]
  following: boolean
  canEdit: boolean
  canReassign: boolean
  canDelete: boolean
  canManageFollowers: boolean
  readOnlyReason: TaskReadOnlyReason | null
  checklist?: TaskChecklistItem[] | null
  attachments?: TaskAttachment[] | null
  reminders?: TaskReminder[] | null
  subtasks?: KpiTask[] | null
}

export interface TaskEvent {
  id: string
  action: string
  oldValue: string | null
  newValue: string | null
  actorId: string | null
  actorName: string | null
  createdAt: string
}

export interface TaskReplacement {
  oldKpiId: string
  oldKpiName: string
  newKpiId: string
  newKpiName: string
  openTaskCount: number
}

export interface TaskSidebar {
  assigned: number
  following: number
  created: number
  delegated: number
  all: number
  canViewTeam: boolean
  canAssign: boolean
  badge: number
  kpis: { kpiId: string; kpiName: string; open: number }[]
}

/** Lựa chọn trong ô chọn người / KPI. */
export interface TaskOption {
  id: string
  name: string
  secondary: string | null
  avatarUrl: string | null
  detail: string | null
  /** Nhóm trong ô chọn: người ⇒ đơn vị; KPI ⇒ đợt. */
  groupId: string | null
  groupName: string | null
  /** KPI: đợt đang diễn ra. Người: luôn true. */
  groupCurrent: boolean
  groupSort: string | null
}

export interface TaskListParams {
  view?: TaskView | 'KPI'
  kpiId?: string
  kpiPeriodId?: string
  ownerId?: string
  status?: TaskStatus[]
  priority?: TaskPriority
  due?: TaskDueFilter
  dueFrom?: string
  dueTo?: string
  keyword?: string
  sort?: TaskSort
  topLevel?: boolean
  page?: number
  size?: number
}

export interface ReminderInput {
  kind: ReminderKind
  offsetMinutes?: number | null
  customAt?: string | null
}

export interface CreateTaskInput {
  kpiId?: string
  parentTaskId?: string
  ownerId?: string
  title: string
  description?: string | null
  descriptionDoc?: string | null
  dueDate?: string | null
  dueTime?: string | null
  priority?: TaskPriority
  visibility?: TaskVisibility
  checklist?: string[]
  followerIds?: string[]
  reminders?: ReminderInput[]
  recurrence?: TaskRecurrence | null
  recurrenceEndDate?: string | null
}

export interface UpdateTaskInput {
  version: number
  title?: string
  description?: string
  descriptionDoc?: string
  dueDate?: string | null
  clearDueDate?: boolean
  dueTime?: string | null
  clearDueTime?: boolean
  priority?: TaskPriority
  visibility?: TaskVisibility
  recurrence?: TaskRecurrence
  clearRecurrence?: boolean
  recurrenceEndDate?: string | null
  clearRecurrenceEndDate?: boolean
  scope?: 'THIS' | 'FOLLOWING'
}
