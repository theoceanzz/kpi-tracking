export type KpiStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'INACTIVE' | 'EDIT' | 'EDITED' | 'REPLACED'
export type KpiFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'YEARLY' | 'UNLIMITED'
export type KpiParentRelationType = 'DELEGATION' | 'DECOMPOSITION'
export type KpiType = 'QUANTITATIVE' | 'QUALITATIVE'

export interface KpiPeriod {
  id: string
  name: string
  periodType: KpiFrequency
  startDate: string | null
  endDate: string | null
  notificationDate: string | null
  organizationId: string
  cycleId?: string | null
  cycleName?: string | null
}

export type CycleEvaluationMode = 'QUANTITATIVE' | 'QUALITATIVE' | 'BOTH'
/**
 * DRAFT → CALIBRATING (đã chốt dữ liệu kỳ: đầu vào đóng, đang chấm phòng / soi khung / hiệu chỉnh
 * điểm cá nhân) → FINALIZED (đã khoá kết quả).
 */
export type CycleUnitEvalStatus = 'DRAFT' | 'CALIBRATING' | 'FINALIZED'

// Kỳ đánh giá tổng hợp — gom nhiều đợt (KpiPeriod). Matches BE: KpiCycleResponse
export interface KpiCycle {
  id: string
  name: string
  cycleType: KpiFrequency
  startDate: string | null
  endDate: string | null
  description: string | null
  evaluationMode: CycleEvaluationMode
  organizationId: string
  periodCount: number
}

export type KpiCyclePayload = Partial<KpiCycle> & { periodIds?: string[] }

// Đánh giá kỳ của 1 nhân viên (TB các đợt). Matches BE: CycleUserEvaluationResponse
export interface CyclePeriodBreakdown {
  periodId: string
  periodName: string
  selfScore: number | null
  managerScore: number | null
  /** Điểm định lượng thuần (system_score). */
  quantScore: number | null
  /** Mức định tính thuần (behavior_score, thang 0-5). */
  qualScore: number | null
  /** Xếp loại ma trận hiệu suất (1-5), null nếu thiếu 1 trong 2 trục. */
  matrixRating: number | null
  /** % hoàn thành định lượng của đợt. */
  completionPercent: number | null
}
export interface CycleUserEvaluation {
  userId: string
  userName: string
  userAvatarUrl: string | null
  orgUnitId: string | null
  orgUnitName: string | null
  mode: CycleEvaluationMode
  selfScore: number | null
  managerScore: number | null
  /** Điểm chốt kỳ: đã nhập tay nếu có, mặc định = managerScore. */
  finalScore: number | null
  finalScoreOverridden: boolean
  /** Mức định tính chấm ở cấp kỳ (0-5) — trục hàng ma trận. */
  qualScore: number | null
  /** Xếp loại 1-5 suy ra từ ma trận hiệu suất. */
  matrixRating: number | null
  /** TB % hoàn thành định lượng các đợt — trục cột ma trận. */
  avgCompletionPercent: number | null
  /**
   * Trục HÀNH VI thật sự đưa vào ma trận (thang 0–5): mức định tính nếu có, còn không thì
   * điểm hạnh kiểm đã quy đổi. Kỳ chạy chế độ Định lượng không có `qualScore` nhưng vẫn có
   * điểm hành vi khi tổ chức chấm hạnh kiểm — cột trong bảng đọc trường này.
   */
  behaviorScore: number | null
  /** true khi `behaviorScore` đến từ phiếu hạnh kiểm chứ không phải KPI định tính. */
  behaviorFromConduct: boolean
  /** Điểm hạnh kiểm đã tính trọng số, trên thang gốc của phiếu. */
  conductScore: number | null
  conductMaxScore: number | null
  /** `matrixRating` được đặt tay lúc hiệu chỉnh theo khung (không suy từ hai trục). */
  ratingOverridden: boolean
  /** Điểm chốt kỳ tự tính chụp lúc "chốt dữ liệu kỳ" — null khi đơn vị chưa qua bước đó. */
  baselineScore: number | null
  baselineRating: number | null
  comment: string | null
  evaluatedByName: string | null
  evaluatedAt: string | null
  /** Bị khoá do đơn vị (hoặc đơn vị cha) đã chốt ⇒ chỉ xem. */
  locked: boolean
  lockedByUnitName: string | null
  periodBreakdown: CyclePeriodBreakdown[]
}

// Đánh giá tổng hợp phòng ban theo kỳ. Matches BE: CycleUnitEvaluationResponse
/** Một mức trên biểu đồ bell curve của kỳ: số thực tế đặt cạnh hạn mức đã cấu hình. */
export interface CycleCurveBucket {
  level: string
  color: string
  count: number
  /** % trên TỔNG nhân sự — cùng mẫu số với hạn mức. */
  percent: number
  /** Null khi đơn vị không áp khung bell curve nào. */
  targetPercent: number | null
  minPercent: number | null
  maxPercent: number | null
  minCount: number | null
  maxCount: number | null
  over: boolean
  under: boolean
}

/** Phân bố mức của đơn vị trong kỳ + khung bell curve đang áp. */
export interface CycleCurve {
  configured: boolean
  profileName: string | null
  mode: 'warn' | 'block' | null
  tolerance: number
  headcount: number
  evaluated: number
  /** Cao → thấp. */
  buckets: CycleCurveBucket[]
}

export interface CycleUnitEvaluation {
  cycleId: string
  cycleName: string
  orgUnitId: string
  orgUnitName: string
  mode: CycleEvaluationMode
  selfScore: number | null
  /** Điểm CUỐI CÙNG của đơn vị: điểm chấm tay nếu có, không thì TB thành viên. */
  managerScore: number | null
  /** TB điểm chốt kỳ của thành viên — luôn có, để đối chiếu với điểm chấm tay. */
  autoScore?: number | null
  /** Điểm đơn vị do người có quyền chấm tay; null = đang dùng TB tự tính. */
  overrideScore?: number | null
  overrideReason?: string | null
  overriddenByName?: string | null
  overriddenAt?: string | null
  /** Dữ liệu vẽ bell curve của kỳ cho đơn vị này. */
  bellCurve?: CycleCurve | null
  /** TB mức định tính (0-5) và TB xếp loại ma trận (1-5) của thành viên. */
  qualScore: number | null
  matrixRating: number | null
  /** TB trục hành vi (0-5): mức định tính nếu có, còn không thì điểm hạnh kiểm đã quy đổi. */
  behaviorScore: number | null
  memberCount: number
  /** true khi các con số là snapshot lúc chốt, không phải tính lại. */
  fromSnapshot: boolean
  /**
   * Xếp loại ĐƠN VỊ trong kỳ (áp luật xếp loại lên phân bố mức của thành viên).
   * Bản nháp tính live; đã chốt thì lấy bản chụp lúc chốt. Null khi chưa ai có điểm kỳ.
   */
  classification: string | null
  classificationColor: string | null
  /** Hồ sơ luật đã áp (theo đơn vị + hiệu lực theo kỳ); null = dùng preset. */
  classificationProfileName: string | null
  status: CycleUnitEvalStatus
  comment: string | null
  /** Người bấm "chốt dữ liệu kỳ" và thời điểm — null khi còn nháp. */
  calibratedByName?: string | null
  calibratedAt?: string | null
  finalizedByName: string | null
  finalizedAt: string | null
  members: CycleUserEvaluation[]
}

export type CycleUnitEvalAction = 'CALIBRATE' | 'FINALIZE' | 'REOPEN'

/** Một mốc lịch sử chốt/mở khoá. Matches BE: CycleUnitEvalEventResponse */
export interface CycleUnitEvalEvent {
  action: CycleUnitEvalAction
  actorName: string | null
  actorRoleName: string | null
  managerScore: number | null
  comment: string | null
  createdAt: string
}

/**
 * Một bước trong chuỗi duyệt: đơn vị đang xem rồi lần lượt các đơn vị cha lên gốc.
 * Matches BE: CycleApprovalStepResponse
 */
export interface CycleApprovalStep {
  orgUnitId: string
  orgUnitName: string
  /** Nhãn người đứng đầu đơn vị, VD "Trưởng phòng", "Giám đốc". */
  managerRoleLabel: string | null
  levelOrder: number | null
  /** true với đơn vị đang được xem trên trang. */
  current: boolean
  status: CycleUnitEvalStatus
  managerScore: number | null
  qualScore: number | null
  matrixRating: number | null
  memberCount: number | null
  finalizedByName: string | null
  finalizedByRoleName: string | null
  finalizedAt: string | null
  comment: string | null
  /** Tiến độ chốt của các đơn vị con trực tiếp. */
  childTotal: number
  childFinalized: number
  /** Quyền của người dùng hiện tại, đã tính sẵn ở server. */
  canFinalize: boolean
  canReopen: boolean
  /** Lý do bị chặn — hiện lên tooltip của nút. Null khi không bị chặn. */
  blockedReason: string | null
  events: CycleUnitEvalEvent[]
}

/** Kết quả gửi email hàng loạt. Matches BE: SendCycleEvaluationResult */
export interface SendEvaluationResult {
  sent: number
  /** Tên những người gửi hỏng (sai email, SMTP chặn...). */
  failed: string[]
}

// Matches BE: KpiCriteriaResponse
export interface KpiCriteria {
  id: string
  kpiType: KpiType
  name: string
  description: string | null
  weight: number | null
  targetValue: number | null
  unit: string | null
  frequency: KpiFrequency
  status: KpiStatus
  orgUnitId: string | null
  orgUnitIds: string[] | null
  orgUnitName: string | null
  assigneeIds: string[]
  assigneeNames: string[]
  assignees: import('./auth').UserInfo[]
  createdById: string | null
  createdByName: string | null
  approvedById: string | null
  approvedByName: string | null
  rejectReason: string | null
  submittedAt: string | null
  approvedAt: string | null
  minimumValue: number | null
  isReverseKpi: boolean
  isBonusKpi: boolean
  deadline: string | null
  effectiveDeadline: string | null
  kpiPeriodId: string
  kpiPeriod: KpiPeriod
  submissionCount: number
  expectedSubmissions: number
  keyResultId: string | null
  keyResultName: string | null
  keyResultCode: string | null
  objectiveId: string | null
  objectiveName: string | null
  objectiveCode: string | null
  perspectiveId: string | null
  perspectiveName: string | null
  perspectiveColor: string | null
  effectivePerspectiveId: string | null
  effectivePerspectiveName: string | null
  effectivePerspectiveColor: string | null
  parentId: string | null
  parentName: string | null
  parentRelationType: KpiParentRelationType | null
  createdAt: string
  updatedAt: string
  hasChildren?: boolean
  delegatedToNames?: string[]
  delegatedToIds?: string[]
  childrenWeightTotal?: number
  replacedById?: string | null
  replacedByName?: string | null
  replacementReason?: string | null
}

// Matches BE: CreateKpiCriteriaRequest
export interface CreateKpiRequest {
  kpiType?: KpiType
  name: string
  description?: string
  weight?: number
  targetValue?: number
  unit?: string
  frequency: KpiFrequency
  orgUnitId?: string
  orgUnitIds?: string[]
  assignedToId?: string
  assignedToIds?: string[]
  minimumValue?: number
  isReverseKpi?: boolean
  isBonusKpi?: boolean
  deadline?: string | null
  kpiPeriodId: string
  keyResultId?: string | null
  parentId?: string | null
  parentRelationType?: KpiParentRelationType | null
  perspectiveId?: string | null
}

// Matches BE: UpdateKpiCriteriaRequest
export interface UpdateKpiRequest {
  kpiType?: KpiType
  name?: string
  description?: string
  weight?: number
  targetValue?: number
  unit?: string
  frequency?: KpiFrequency
  orgUnitId?: string
  orgUnitIds?: string[]
  assignedToId?: string
  assignedToIds?: string[]
  minimumValue?: number
  isReverseKpi?: boolean
  isBonusKpi?: boolean
  deadline?: string | null
  kpiPeriodId?: string
  keyResultId?: string | null
  parentId?: string | null
  parentRelationType?: KpiParentRelationType | null
  perspectiveId?: string | null
}

// Matches BE: RejectKpiRequest
export interface RejectKpiRequest {
  reason: string
}
// Matches BE: ImportKpiResponse
export interface ImportKpiResult {
  totalRows: number
  successfulImports: number
  errors: string[]
}

// Matches BE: ReplaceKpiRequest
export interface ReplaceKpiRequest {
  replacementReason?: string
  kpiType?: KpiType
  name: string
  description?: string
  weight?: number
  targetValue?: number
  minimumValue?: number
  unit?: string
  frequency: KpiFrequency
  assignedToIds?: string[]
  isReverseKpi?: boolean
  isBonusKpi?: boolean
  deadline?: string | null
  keyResultId?: string | null
  perspectiveId?: string | null
}

// Matches BE: BatchUpdateWeightRequest
export interface WeightUpdateItem {
  kpiId: string
  weight: number
}

export interface BatchUpdateWeightRequest {
  updates: WeightUpdateItem[]
}
