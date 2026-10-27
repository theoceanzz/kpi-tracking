// Quy trình duyệt — khớp DTO BE ở dto/*/approvalprocess và service/approvalprocess/ProcessGraph.java.

export type ApprovalObjectType =
  | 'KPI_CRITERIA' | 'KPI_SUBMISSION' | 'KPI_EVALUATION' | 'KPI_ADJUSTMENT' | 'CYCLE_FINALIZE'
  | 'BSC_SCORECARD' | 'BSC_RESULT'
  | 'REWARD_GRANT' | 'GIFT_REDEMPTION'
  | 'FORM_REQUEST'

/** Quy trình của hai đối tượng này chỉ có hiệu lực ở chế độ "Chuỗi duyệt"; đối tượng khác thì luôn có. */
export const CHAIN_MODE_OBJECTS: ApprovalObjectType[] = ['KPI_CRITERIA', 'KPI_ADJUSTMENT']

/** Loại đối tượng của chuỗi ↔ mã đối tượng của quy trình (để dùng chung nhãn `objects.*`). */
export const OBJECT_OF_SUBJECT: Record<import('@/types/approvalChain').ApprovalSubjectType, ApprovalObjectType> = {
  CRITERIA: 'KPI_CRITERIA',
  SUBMISSION: 'KPI_SUBMISSION',
  EVALUATION: 'KPI_EVALUATION',
  ADJUSTMENT: 'KPI_ADJUSTMENT',
  CYCLE_FINALIZE: 'CYCLE_FINALIZE',
  BSC_SCORECARD: 'BSC_SCORECARD',
  BSC_RESULT: 'BSC_RESULT',
  REWARD_GRANT: 'REWARD_GRANT',
  GIFT_REDEMPTION: 'GIFT_REDEMPTION',
  FORM_REQUEST: 'FORM_REQUEST',
}

export type ProcessNodeType = 'START' | 'CONDITION' | 'STEP' | 'APPROVED' | 'REJECTED'

/** NEXT: tiếp theo; YES / NO: hai nhánh của điều kiện; REJECT: bước → Không duyệt. */
export type ProcessBranch = 'NEXT' | 'YES' | 'NO' | 'REJECT'

export type ApproverType = 'USER' | 'ROLE' | 'ORG_UNIT_HEAD' | 'REQUESTER_MANAGER'

export type ConditionField =
  | 'ORG_UNIT'
  | 'ORG_LEVEL'
  | 'REQUESTER'
  | 'REQUESTER_ROLE'
  | 'KPI_TYPE'
  | 'FREQUENCY'
  | 'PERIOD'
  | 'WEIGHT'
  | 'IS_BONUS'
  | 'REQUEST_KIND'
  | 'TARGET_CHANGE_PERCENT'
  | 'EVAL_SCORE'
  | 'REWARD_POINTS'
  /** Widget số của đơn từ (`ConditionRule.widget`). */
  | 'FORM_NUMBER'
  /** Widget Chọn một / Chọn nhiều của đơn từ; giá trị là id phương án. */
  | 'FORM_OPTION'

export type ConditionOperator =
  | 'IN' | 'NOT_IN' | 'IN_SUBTREE'
  | 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE'
  | 'IS_TRUE' | 'IS_FALSE'

export type ConditionValueType = 'ORG_UNIT' | 'ORG_LEVEL' | 'USER' | 'ROLE' | 'PERIOD' | 'ENUM' | 'NUMBER' | 'BOOLEAN'

export interface ApproverSpec {
  type: ApproverType
  userId?: string | null
  roleId?: string | null
  orgUnitId?: string | null
  /** REQUESTER_MANAGER: 0 = trưởng trực tiếp, 1..3 = cấp trên n bậc. */
  levelsUp?: number | null
}

export interface ConditionRule {
  field: ConditionField | null
  operator: ConditionOperator | null
  values: string[]
  /** Id widget của đơn từ — chỉ với FORM_NUMBER / FORM_OPTION. */
  widget?: string | null
}

export const FORM_FIELDS: ConditionField[] = ['FORM_NUMBER', 'FORM_OPTION']

/** Widget của đơn từ mà điều kiện duyệt đọc được (bước 3 của trình sửa đơn). */
export interface FormConditionField {
  id: string
  title: string
  kind: 'NUMBER' | 'OPTION'
  options?: { value: string; label: string }[]
  unit?: string
}

/** Các dòng trong một nhóm phải thoả đồng thời; giữa các nhóm là HOẶC. */
export interface ConditionGroup {
  rules: ConditionRule[]
}

export interface ProcessNode {
  id: string
  type: ProcessNodeType
  x: number
  y: number
  name?: string | null
  groups?: ConditionGroup[] | null
  approvers?: ApproverSpec[] | null
}

export interface ProcessEdge {
  id: string
  source: string
  target: string
  branch: ProcessBranch
}

export interface ProcessGraph {
  schemaVersion: number
  nodes: ProcessNode[]
  edges: ProcessEdge[]
}

export interface PersonRef {
  id: string
  name: string
  avatarUrl?: string | null
}

export interface ApprovalProcess {
  id: string
  title: string
  objectType: ApprovalObjectType
  subObjectTypes: string[]
  approvalType: 'PROCESS'
  showInObject: boolean
  active: boolean
  /** Chỉ có ở GET /{id}. */
  definition: ProcessGraph | null
  stepCount: number
  createdBy: PersonRef | null
  followers: PersonRef[]
  refUsers: Record<string, PersonRef> | null
  version: number
  createdAt: string
  updatedAt: string | null
  canManage: boolean
}

export interface ApprovalProcessRequest {
  title: string
  objectType: ApprovalObjectType
  subObjectTypes: string[]
  followerIds: string[]
  showInObject: boolean
  active?: boolean
  definition: ProcessGraph
  version?: number
}

export interface ApprovalProcessCatalog {
  /** {@code available = false}: đối tượng chưa nối vào chuỗi duyệt, chưa tạo quy trình được. */
  objects: { code: ApprovalObjectType; group: string; subObjects: string[]; available: boolean }[]
  fields: {
    code: ConditionField
    valueType: ConditionValueType
    operators: ConditionOperator[]
    objects: ApprovalObjectType[]
    options: string[]
  }[]
  approverTypes: ApproverType[]
  maxLevelsUp: number
  chainMode: boolean
  /** Đơn từ của tổ chức — đối tượng con của FORM_REQUEST, đã xếp theo nhóm đơn. */
  forms?: CatalogForm[]
}

export interface ApprovalProcessListParams {
  keyword?: string
  objectType?: ApprovalObjectType
  page?: number
  size?: number
}

/** Một việc trong hộp "Chờ tôi duyệt" chung (BE: ApprovalInboxItemResponse). */
export interface ApprovalInboxItem {
  flowId: string
  subjectType: import('@/types/approvalChain').ApprovalSubjectType
  subjectId: string | null
  subjectName: string
  orgUnitId: string | null
  orgUnitName: string | null
  requesterId: string | null
  requesterName: string | null
  processTitle: string | null
  startedAt: string
  status: import('@/types/approvalChain').ApprovalFlowStatus
  finishedAt: string | null
  /** Nội dung đề xuất (đánh giá đợt, chốt kỳ). */
  payload: Record<string, unknown> | null
  /** Duyệt / từ chối được ngay trong hộp; false = mở màn riêng của đối tượng. */
  actionable: boolean
  approval: import('@/types/approvalChain').ApprovalSummary | null
}

/** Một đơn từ trong danh mục quy trình (BE: ApprovalProcessCatalogResponse.FormOption). */
export interface CatalogForm {
  id: string
  name: string
  groupName: string | null
  active: boolean
  schema: import('@/features/approvalForms/types').FormSchema
}
