// Quy trình duyệt — khớp DTO BE ở dto/*/approvalprocess và service/approvalprocess/ProcessGraph.java.

export type ApprovalObjectType = 'KPI_CRITERIA' | 'KPI_ADJUSTMENT'

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
  objects: { code: ApprovalObjectType; group: string; subObjects: string[] }[]
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
}

export interface ApprovalProcessListParams {
  keyword?: string
  objectType?: ApprovalObjectType
  page?: number
  size?: number
}
