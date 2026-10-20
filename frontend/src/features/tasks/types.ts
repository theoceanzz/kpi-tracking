import type { KpiStatus } from '@/types/kpi'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'
export type TaskVisibility = 'KPI_SCOPE' | 'PRIVATE'
export type TaskDueFilter = 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'WEEK' | 'LATER' | 'NONE'
export type TaskReadOnlyReason = 'NOT_OWNER' | 'CYCLE_LOCKED' | 'KPI_DELETED'
export type DueBucket = 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'LATER' | 'NONE'
/** Ba trạng thái KPI của một việc — khớp TaskKpiLinks ở backend. */
export type TaskKpiState = 'NONE' | 'DELETED' | 'ACTIVE'
export type TaskCompletionMode = 'ANY' | 'ALL'
/** Chế độ xem ở cột trái. NOKPI = "Việc không gắn KPI" (ALL + hasKpi=false). */
/** `ACTIVITY` = trang "Hoạt động" (không phải bộ lọc việc — không gửi lên API danh sách). */
export type TaskView = 'ASSIGNED' | 'FOLLOWING' | 'CREATED' | 'DELEGATED' | 'DONE' | 'ALL' | 'TEAM' | 'NOKPI' | 'ACTIVITY'
export type TaskGroupBy = 'due' | 'kpi' | 'status' | 'owner' | 'priority' | 'none' | 'section' | 'tag' | 'mysection' | `field:${string}`
export type TaskSort = 'due' | 'priority' | 'created' | 'manual' | 'start' | 'title' | 'updated' | `field:${string}`
/** Cách xem ở cột giữa. Thống kê chỉ có trong một danh sách. */
/** `stats` (Bảng điều khiển) và `activity` (Hoạt động) chỉ có trong một danh sách, như tab của Lark. */
export type TaskMode = 'list' | 'kanban' | 'calendar' | 'gantt' | 'stats' | 'activity'
export const TASK_MODES: readonly TaskMode[] = ['list', 'kanban', 'calendar', 'gantt', 'stats', 'activity']
export type ReminderKind = 'AT_DUE' | 'BEFORE' | 'CUSTOM'
export type TaskListRole = 'OWNER' | 'EDITOR' | 'VIEWER'
export type TaskFieldType = 'TEXT' | 'NUMBER' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'MEMBER' | 'DATE' | 'CHECKBOX'

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']
export const TASK_PRIORITIES: TaskPriority[] = ['HIGH', 'MEDIUM', 'LOW']
export const TASK_FIELD_TYPES: TaskFieldType[] = ['TEXT', 'NUMBER', 'SINGLE_SELECT', 'MULTI_SELECT', 'MEMBER', 'DATE', 'CHECKBOX']
/** Việc con tối đa 5 cấp (depth 0..4) — khớp KpiTaskService.MAX_DEPTH. */
export const MAX_TASK_DEPTH = 4

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
  /** Tệp đính kèm (người giao đưa) hay kết quả (người thực hiện nộp) — V47. */
  kind: TaskAttachmentKind
  uploadedById: string
  uploadedByName?: string | null
  uploadedByAvatarUrl?: string | null
  /** Mình xoá được tệp này (máy chủ tính theo loại tệp + người tải lên). */
  canDelete: boolean
}

export type TaskAttachmentKind = 'REFERENCE' | 'RESULT'

export interface TaskPerson {
  id: string
  fullName: string | null
  avatarUrl: string | null
}

export interface TaskAssignee extends TaskPerson {
  primary: boolean
  completedAt: string | null
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
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval?: number
  byWeekday?: number[] | null
  byMonthDay?: number | null
  /** MONTHLY: tuần thứ mấy (1..4, -1 = cuối) cùng một ngày trong byWeekday. */
  bySetPos?: number | null
  /** YEARLY: tháng 1..12. */
  byMonth?: number | null
  /** Tổng số lần (kể cả lần đầu). */
  count?: number | null
}

export interface TaskListRef {
  listId: string
  listName: string
  color: string | null
  sectionId: string | null
  sectionName: string | null
  sortOrder: number
}

export interface TaskTag {
  id: string
  name: string
  color: string | null
}

export interface TaskFieldValue {
  fieldId: string
  listId: string
  value: unknown
}

export interface TaskDependencyRef {
  id: string
  direction: 'BLOCKED_BY' | 'BLOCKING'
  taskId: string
  title: string | null
  status: TaskStatus
  dueDate: string | null
  accessible: boolean
}

export interface TaskSourceRef {
  type: 'COMMENT' | 'DOCUMENT' | 'AI'
  id?: string | null
  label?: string | null
}

export interface KpiTask {
  id: string
  kpiId: string | null
  kpiState: TaskKpiState
  kpiName: string | null
  kpiStatus: KpiStatus | null
  kpiDeleted: boolean
  kpiPeriodId: string | null
  kpiPeriodName: string | null
  title: string
  description: string | null
  descriptionDoc: string | null
  startDate: string | null
  startTime: string | null
  dueDate: string | null
  dueTime: string | null
  dueToday: boolean
  dueBucket: DueBucket
  priority: TaskPriority
  status: TaskStatus
  visibility: TaskVisibility
  completionMode: TaskCompletionMode
  ownerId: string
  ownerName: string | null
  ownerAvatarUrl: string | null
  assignees: TaskAssignee[]
  myPartDone: boolean
  createdById: string | null
  createdByName: string | null
  parentTaskId: string | null
  parentTitle: string | null
  rootTaskId: string | null
  depth: number
  /** Việc mốc (Lark "Mark as Milestone") — hình thoi thay cho ô tròn. */
  milestone: boolean
  overdue: boolean
  checklistDone: number
  checklistTotal: number
  subtaskDone: number
  subtaskTotal: number
  attachmentCount: number
  commentCount: number
  unreadComments: number
  openBlockers: number
  /** Id các việc đứng trước (Gantt vẽ mũi tên). */
  blockedByIds: string[]
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
  lists: TaskListRef[]
  tags: TaskTag[]
  /** Nhóm riêng của tôi trong "Việc của tôi" (null = chưa xếp). */
  mySectionId: string | null
  fieldValues: TaskFieldValue[]
  sourceRef: TaskSourceRef | null
  canEdit: boolean
  canReassign: boolean
  canDelete: boolean
  canManageFollowers: boolean
  canDecline: boolean
  canSetKpi: boolean
  readOnlyReason: TaskReadOnlyReason | null
  checklist?: TaskChecklistItem[] | null
  attachments?: TaskAttachment[] | null
  reminders?: TaskReminder[] | null
  subtasks?: KpiTask[] | null
  dependencies?: TaskDependencyRef[] | null
}

/** Một dòng của trang "Hoạt động". */
export interface TaskActivityItem {
  id: string
  taskId: string
  taskTitle: string
  action: TaskEvent['action']
  oldValue: string | null
  newValue: string | null
  actorId: string | null
  actorName: string | null
  actorAvatarUrl: string | null
  createdAt: string
}

/** Người khác đang mở bảng chi tiết của cùng một việc (nhịp hiện diện). */
export interface TaskViewer {
  userId: string
  fullName: string
  avatarUrl: string | null
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

/** {@code newValue} của dòng lịch sử FOLLOWER_REMOVED khi bị gỡ tự động do đổi KPI — khớp KpiTaskService ở backend. */
export const FOLLOWER_REMOVED_KPI_CHANGED = 'KPI_CHANGED'

/** Người theo dõi sẽ bị gỡ khỏi một việc khi đổi KPI — họ không xem được KPI mới (xem trước của assign / move). */
export interface FollowerRemoval {
  taskId: string
  taskTitle: string
  subtask: boolean
  userId: string
  userName: string | null
  avatarUrl: string | null
}

/** Cặp (việc, người) đã được người dùng đồng ý gỡ — gửi kèm assign / move. */
export interface FollowerRemovalRef {
  taskId: string
  userId: string
}

export interface TaskReplacement {
  oldKpiId: string
  oldKpiName: string
  newKpiId: string
  newKpiName: string
  openTaskCount: number
}

export interface TaskSidebarList {
  listId: string
  name: string
  color: string | null
  /** Biểu tượng emoji của danh sách. */
  icon: string | null
  /** Riêng của tôi: ghim lên đầu, thư mục ở cột trái. */
  pinned: boolean
  folder: string | null
  role: TaskListRole
  archived: boolean
  open: number
}

export interface TaskSidebar {
  assigned: number
  following: number
  created: number
  delegated: number
  all: number
  noKpi: number
  canViewTeam: boolean
  canAssign: boolean
  multiAssignee: boolean
  badge: number
  kpis: { kpiId: string; kpiName: string; open: number }[]
  lists: TaskSidebarList[]
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

export interface TaskFieldFilter {
  fieldId: string
  op: 'EQ' | 'IN' | 'CONTAINS' | 'EMPTY' | 'NOT_EMPTY' | 'GT' | 'LT'
  value?: unknown
}

export interface TaskListParams {
  view?: TaskView | 'KPI' | 'LIST' | 'SEARCH' | 'INVOLVED'
  kpiId?: string
  kpiPeriodId?: string
  ownerId?: string
  status?: TaskStatus[]
  priority?: TaskPriority
  due?: TaskDueFilter
  dueFrom?: string
  dueTo?: string
  keyword?: string
  sort?: string
  topLevel?: boolean
  page?: number
  size?: number
  listId?: string
  sectionId?: string
  noSection?: boolean
  hasKpi?: boolean
  tagIds?: string[]
  fieldFilters?: string
  sortFieldId?: string
  rangeFrom?: string
  rangeTo?: string
}

export interface ReminderInput {
  kind: ReminderKind
  offsetMinutes?: number | null
  customAt?: string | null
}

export interface CreateTaskInput {
  kpiId?: string | null
  parentTaskId?: string
  ownerId?: string
  assigneeIds?: string[]
  completionMode?: TaskCompletionMode
  title: string
  description?: string | null
  descriptionDoc?: string | null
  startDate?: string | null
  startTime?: string | null
  dueDate?: string | null
  dueTime?: string | null
  priority?: TaskPriority
  visibility?: TaskVisibility
  checklist?: string[]
  followerIds?: string[]
  reminders?: ReminderInput[]
  recurrence?: TaskRecurrence | null
  recurrenceEndDate?: string | null
  listId?: string
  sectionId?: string | null
  tagIds?: string[]
  fieldValues?: Record<string, unknown>
  sourceRef?: TaskSourceRef | null
}

export interface UpdateTaskInput {
  version: number
  title?: string
  description?: string
  descriptionDoc?: string
  startDate?: string | null
  clearStartDate?: boolean
  startTime?: string | null
  clearStartTime?: boolean
  dueDate?: string | null
  clearDueDate?: boolean
  dueTime?: string | null
  clearDueTime?: boolean
  priority?: TaskPriority
  visibility?: TaskVisibility
  completionMode?: TaskCompletionMode
  recurrence?: TaskRecurrence
  clearRecurrence?: boolean
  recurrenceEndDate?: string | null
  clearRecurrenceEndDate?: boolean
  scope?: 'THIS' | 'FOLLOWING'
}

// ── Danh sách công việc ─────────────────────────────────────────────────────────────────────

export interface TaskFieldOption {
  id: string
  label: string
  color?: string | null
}

export interface TaskListField {
  id: string
  listId: string
  name: string
  type: TaskFieldType
  options: TaskFieldOption[]
  sortOrder: number
}

export interface TaskListSection {
  id: string
  name: string
  sortOrder: number
}

export interface TaskListMember {
  id: string
  userId: string | null
  userName: string | null
  avatarUrl: string | null
  orgUnitId: string | null
  orgUnitName: string | null
  role: TaskListRole
}

export interface TaskListDetail {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  /** Cấu hình bảng điều khiển (null = mặc định). */
  dashboard: TaskDashboardConfig | null
  archived: boolean
  role: TaskListRole
  createdBy: string
  createdAt: string
  version: number
  members: TaskListMember[]
  sections: TaskListSection[]
  fields: TaskListField[]
  openCount: number
  totalCount: number
}

/** Bảng điều khiển của danh sách: các ô biểu đồ theo thứ tự. */
export interface TaskDashboardConfig {
  widgets: string[]
}

/** Nhóm riêng trong "Việc của tôi". */
export interface TaskMySection {
  id: string
  name: string
  sortOrder: number
}

export interface TaskListUpsert {
  name?: string
  description?: string
  color?: string
  icon?: string
  templateId?: string
  builtinTemplate?: string
  includeSampleTasks?: boolean
  members?: { userId?: string; orgUnitId?: string; role: TaskListRole }[]
}

export interface TaskSavedViewConfig {
  mode?: string
  groupBy?: string
  sort?: string
  filters?: Record<string, unknown>
  view?: string
  listId?: string
  kpiId?: string
}

export interface TaskSavedView {
  id: string
  name: string
  listId: string | null
  config: TaskSavedViewConfig | null
  shared: boolean
  mine: boolean
  sortOrder: number
}

export interface TaskListTemplate {
  id: string
  name: string
  description: string | null
  builtin: boolean
  sections: string[]
  fieldCount: number
  taskCount: number
  canDelete: boolean
}

export type AutomationTriggerType = 'TASK_ADDED' | 'SECTION_ENTERED' | 'STATUS_CHANGED' | 'COMPLETED' | 'FIELD_CHANGED'
export type AutomationActionType = 'SET_STATUS' | 'MOVE_SECTION' | 'ADD_ASSIGNEE' | 'ADD_FOLLOWER' | 'SET_PRIORITY' | 'SET_FIELD'
  | 'SET_DUE_IN_DAYS' | 'NOTIFY'

export interface TaskAutomation {
  id: string
  name: string
  trigger: { type: AutomationTriggerType } & Record<string, unknown>
  action: { type: AutomationActionType } & Record<string, unknown>
  enabled: boolean
  runCount: number
  lastRunAt: string | null
}

export interface TaskListStats {
  total: number
  open: number
  done: number
  cancelled: number
  overdue: number
  noDue: number
  byStatus: Record<TaskStatus, number>
  byAssignee: { userId: string; name: string | null; avatarUrl: string | null; open: number; done: number; overdue: number }[]
  bySection: { sectionId: string | null; name: string | null; open: number; done: number }[]
  weekly: { weekStart: string; created: number; completed: number }[]
}

export type TaskBatchAction = 'COMPLETE' | 'REOPEN' | 'SET_STATUS' | 'SET_PRIORITY' | 'SET_DUE' | 'SHIFT_DUE' | 'SET_START'
  | 'ADD_ASSIGNEE' | 'ADD_TO_LIST' | 'REMOVE_FROM_LIST' | 'MOVE_SECTION' | 'ADD_TAG' | 'REMOVE_TAG' | 'ADD_FOLLOWER' | 'DELETE'

export interface TaskBatchInput {
  taskIds: string[]
  action: TaskBatchAction
  status?: TaskStatus
  priority?: TaskPriority
  date?: string | null
  clear?: boolean
  days?: number
  userId?: string
  listId?: string
  sectionId?: string | null
  tagId?: string
  force?: boolean
}

export interface TaskBatchResult {
  total: number
  succeeded: number
  results: { taskId: string; ok: boolean; code: string | null; message: string | null }[]
}

export interface TaskImportRow {
  rowNumber?: number
  title: string | null
  description?: string | null
  assigneeEmails?: string | null
  startDate?: string | null
  dueDate?: string | null
  priority?: TaskPriority | null
  status?: TaskStatus | null
  section?: string | null
  tags?: string | null
  errors?: string[]
}

export interface TaskImportPreview {
  validCount: number
  errorCount: number
  rows: TaskImportRow[]
}

export interface TaskImportResult {
  created: number
  failed: TaskImportRow[]
}
