// Đơn từ — khớp BE dto/approvalform/ApprovalFormDtos.java và entity/form/*.

import type { ConditionOperator, PersonRef, ProcessGraph, ApprovalProcessCatalog } from '@/features/approvalProcess/types'
import type { ApprovalSummary, KpiApprovalChain } from '@/types/approvalChain'

/** Chữ song ngữ do người dùng nhập (tên nhóm, tên / mô tả đơn). */
export type LocalizedName = Partial<Record<'vi' | 'en', string>>

export type WidgetType =
  | 'TEXT' | 'TEXTAREA' | 'DESCRIPTION'
  | 'NUMBER' | 'AMOUNT' | 'FORMULA'
  | 'RADIO' | 'CHECKBOX'
  | 'DATE' | 'DATE_RANGE'
  | 'TABLE' | 'IMAGE' | 'ATTACHMENT' | 'CONTACT' | 'DEPARTMENT' | 'PHONE'

export interface FormOption {
  id: string
  label: string
}

export interface VisibilityRule {
  widget: string
  operator: ConditionOperator
  values: string[]
}

/** Một widget — record phẳng, trường không áp cho loại đó thì bỏ trống. */
export interface FormWidget {
  id: string
  type: WidgetType
  title: string
  placeholder?: string | null
  required?: boolean | null
  /** Chữ / số; id phương án (Chọn một); mảng id (Chọn nhiều); 'TODAY'; 'ME'; 'MY_UNIT'. */
  defaultValue?: unknown
  maxLength?: number | null
  /** Mô tả: chữ tĩnh. */
  content?: string | null
  decimals?: number | null
  unit?: string | null
  min?: number | null
  max?: number | null
  currency?: string | null
  /** Công thức: `{id}` widget số phía trên, `SUM({bảng.cột})`. */
  expression?: string | null
  options?: FormOption[] | null
  display?: 'DROPDOWN' | 'LIST' | null
  dateFormat?: 'DATE' | 'DATETIME' | null
  showDuration?: boolean | null
  durationUnit?: 'DAY' | 'HOUR' | null
  durationLabel?: string | null
  children?: FormWidget[] | null
  addLabel?: string | null
  showTotal?: boolean | null
  maxCount?: number | null
  multiple?: boolean | null
  visibility?: VisibilityRule[] | null
}

export interface FormSchema {
  widgets: FormWidget[]
}

export type SubmitterScope = 'ALL' | 'SPECIFIED' | 'NONE'
export type FormAdminPermission = 'EDIT_FORM' | 'MANAGE_ADMINS' | 'MANAGE_PROCESS'
export const ALL_ADMIN_PERMISSIONS: FormAdminPermission[] = ['EDIT_FORM', 'MANAGE_ADMINS', 'MANAGE_PROCESS']

export interface Ref {
  id: string
  name: string
}

export interface FormSummary {
  id: string
  groupId: string
  templateCode: string | null
  icon: string
  color: string
  name: LocalizedName
  description: LocalizedName
  active: boolean
  submitterScope: SubmitterScope
  submitterCount: number
  permissions: FormAdminPermission[]
}

export interface FormGroup {
  id: string
  name: LocalizedName
  active: boolean
  sortOrder: number
  code: string | null
  forms: FormSummary[]
}

export interface AdminView {
  groups: FormGroup[]
  canManageAll: boolean
}

export interface FormDetail {
  id: string
  groupId: string
  templateCode: string | null
  icon: string
  color: string
  name: LocalizedName
  description: LocalizedName
  submitterScope: SubmitterScope
  submitterUsers: PersonRef[]
  submitterUnits: Ref[]
  admins: { user: PersonRef; permissions: FormAdminPermission[] }[]
  schema: FormSchema
  process: ProcessGraph | null
  refUsers: Record<string, PersonRef>
  active: boolean
  version: number
  permissions: FormAdminPermission[]
  updatedAt: string | null
  /** Quy trình đang bật ở màn Quy trình duyệt cho đơn này — khi nộp nó thay sơ đồ riêng bên dưới. */
  managedProcess?: Ref | null
}

export interface FormRequestBody {
  groupId: string
  templateCode?: string | null
  icon: string
  color: string
  name: LocalizedName
  description: LocalizedName
  submitterScope: SubmitterScope
  submitters: { userIds: string[]; orgUnitIds: string[] }
  admins: { userId: string; permissions: FormAdminPermission[] }[]
  schema: FormSchema
  process: ProcessGraph
  version?: number
}

export interface LibraryTemplate {
  code: string
  category: string
  recommended: boolean
  icon: string
  color: string
  name: LocalizedName
  description: LocalizedName
  schema: FormSchema
  process: ProcessGraph
}

export interface Library {
  categories: { code: string; name: LocalizedName }[]
  templates: LibraryTemplate[]
}

export interface ProcessOptionsResponse {
  catalog: ApprovalProcessCatalog
  roles: Ref[]
  levels: Ref[]
  units: { id: string; name: string; depth: number }[]
}

// ── Nhân viên ──

export interface CatalogForm {
  id: string
  icon: string
  color: string
  name: LocalizedName
  description: LocalizedName
}

export interface Catalog {
  groups: { id: string; name: LocalizedName; forms: CatalogForm[] }[]
  canAdmin: boolean
}

export interface SubmitView extends CatalogForm {
  schema: FormSchema
  units: Ref[]
}

export interface UploadedFile {
  url: string
  publicId: string
  name: string
  size: number
  contentType: string
}

export interface FlowPreview {
  steps: { code: string | null; name: string | null; approvers: string[]; skipped: boolean }[]
  adminFallback: boolean
}

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
export type RequestBox = 'TODO' | 'DONE' | 'SUBMITTED' | 'IN_REVIEW'

export interface RequestItem {
  id: string
  code: string
  formId: string
  formName: LocalizedName
  formIcon: string
  formColor: string
  requester: PersonRef
  orgUnitName: string
  status: RequestStatus
  submittedAt: string
  finishedAt: string | null
  summary: { title: string; type: WidgetType; value: unknown }[]
  approval: ApprovalSummary | null
}

export interface RequestDetail {
  item: RequestItem
  schema: FormSchema
  values: Record<string, unknown>
  rejectReason: string | null
  chain: KpiApprovalChain
  canWithdraw: boolean
}

export type FormValues = Record<string, unknown>
