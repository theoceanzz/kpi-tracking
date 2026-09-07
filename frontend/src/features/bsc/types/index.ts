export enum BscPerspectiveStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum BscFixedPerspective {
  FINANCIAL = 'FINANCIAL',
  CUSTOMER = 'CUSTOMER',
  INTERNAL_PROCESS = 'INTERNAL_PROCESS',
  LEARNING_GROWTH = 'LEARNING_GROWTH',
}

export interface FixedPerspectiveResponse {
  code: BscFixedPerspective
  name: string
  color: string
  displayOrder: number
}

export interface FixedPerspectiveUpdateRequest {
  name: string
  color?: string
  displayOrder?: number
}

/** Một "Hạng mục" BSC (tên API/field vẫn là perspective để tránh churn). */
export interface PerspectiveResponse {
  id: string
  code: string
  name: string
  description?: string
  /** Mục tiêu mong muốn — null khi hạng mục chưa đặt con số. */
  targetValue?: number | null
  /** Kết quả tối thiểu — null khi hạng mục chưa đặt con số. */
  minimumValue?: number | null
  /** Đơn vị tính của mục tiêu/tối thiểu (VD: VNĐ, %, buổi). */
  unit?: string | null
  color?: string
  icon?: string
  displayOrder: number
  status: BscPerspectiveStatus
  fixedPerspective?: BscFixedPerspective
  fixedPerspectiveName?: string
  fixedPerspectiveColor?: string
}

export interface PerspectiveRequest {
  /** Bỏ trống khi tổ chức bật sinh mã tự động — backend cấp mã theo mẫu của công ty. */
  code?: string
  name: string
  description?: string
  targetValue?: number | null
  minimumValue?: number | null
  unit?: string | null
  color?: string
  icon?: string
  displayOrder?: number
  status?: BscPerspectiveStatus
  fixedPerspective?: BscFixedPerspective
}

export interface ImportBscResponse {
  totalRows: number
  successfulImports: number
  errors: string[]
}

/**
 * Vòng đời bộ tiêu chí. ARCHIVED là trạng thái CŨ, giữ để dữ liệu đã tạo không vỡ —
 * bản ghi mới dùng CLOSED.
 */
export enum BscScorecardStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  LOCKED = 'LOCKED',
  ARCHIVED = 'ARCHIVED',
}

export enum BscScoringMode {
  SHADOW = 'SHADOW',
  OFFICIAL = 'OFFICIAL',
}

export enum BscEmptyPerspectivePolicy {
  RENORMALIZE = 'RENORMALIZE',
  ZERO_FILL = 'ZERO_FILL',
}

/** Nguồn gốc một dòng chỉ tiêu / một KPI: cấp trên giao hay cấp đó tự thêm. */
export enum BscItemOrigin {
  ASSIGNED = 'ASSIGNED',
  SELF = 'SELF',
}

/** Quan hệ với chỉ tiêu cha. Chỉ SUM tham gia phép cộng khi đo độ phủ. */
export enum BscLinkType {
  SUM = 'SUM',
  SHARED = 'SHARED',
  SUPPORT = 'SUPPORT',
  CUSTOM = 'CUSTOM',
}

export enum BscMeasurementSource {
  ROLLUP = 'ROLLUP',
  MANUAL = 'MANUAL',
  DATASOURCE = 'DATASOURCE',
}

/** Hệ quả khi hạng mục chặn không đạt — cả ba đều tác động lên TRẦN XẾP LOẠI, không trừ điểm. */
export enum BscGateEffect {
  BLOCK_EXCELLENT = 'BLOCK_EXCELLENT',
  CAP_AT_RATING = 'CAP_AT_RATING',
  WARN_ONLY = 'WARN_ONLY',
}

export enum BscGateScope {
  INDIVIDUAL = 'INDIVIDUAL',
  UNIT = 'UNIT',
  BOTH = 'BOTH',
}

export enum BscFactorMode {
  BAND_TABLE = 'BAND_TABLE',
  DIRECT_RATIO = 'DIRECT_RATIO',
  NONE = 'NONE',
}

export enum BscFactorBasis {
  OVERALL = 'OVERALL',
  LINKED_ITEM = 'LINKED_ITEM',
}

export enum BscFactorScope {
  UNIT = 'UNIT',
  COMPANY = 'COMPANY',
}

export enum BscLinkedWeightEnforce {
  WARN = 'WARN',
  BLOCK = 'BLOCK',
}

export enum BscUnitResultStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
  LOCKED = 'LOCKED',
}

export interface ScorecardPerspectiveResponse {
  id: string
  perspectiveId: string
  code: string
  name: string
  targetValue?: number | null
  minimumValue?: number | null
  unit?: string | null
  color?: string
  weightPercentage: number
  displayOrder: number
  fixedPerspective?: BscFixedPerspective
  fixedPerspectiveName?: string
  fixedPerspectiveColor?: string

  /** ASSIGNED = cấp trên giao (khoá mục tiêu/trọng số), SELF = đơn vị tự thêm. */
  origin?: BscItemOrigin
  locked?: boolean
  parentItemId?: string | null
  parentItemName?: string | null
  parentScorecardName?: string | null
  linkType?: BscLinkType | null
  contributionValue?: number | null
  contributionPercent?: number | null

  measurementSource?: BscMeasurementSource
  isGate?: boolean
  gateMinPercent?: number | null
  gateEffect?: BscGateEffect | null
  gateCapRating?: number | null
  gateAppliesTo?: BscGateScope
}

export interface ScorecardOrgUnitResponse {
  id: string
  name: string
}

/** Cách bộ tiêu chí gắn với thời gian: nhiều ĐỢT cụ thể, hay MỘT KỲ (mọi đợt thuộc kỳ). */
/** Cấp của bộ tiêu chí trong cây BSC. Backend suy từ phạm vi phòng ban, client không đặt được. */
export enum BscScorecardLevel {
  COMPANY = 'COMPANY',
  UNIT = 'UNIT',
}

export enum BscScorecardApplyScope {
  PERIOD = 'PERIOD',
  CYCLE = 'CYCLE',
}

export interface ScorecardPeriodResponse {
  id: string
  name: string
}

export interface ScorecardResponse {
  id: string
  name: string
  vision?: string
  applyScope: BscScorecardApplyScope
  /** Các đợt áp dụng — với CYCLE là các đợt đang thuộc kỳ. */
  periods?: ScorecardPeriodResponse[]
  kpiCycleId?: string | null
  kpiCycleName?: string | null
  /** Nhãn gộp để hiển thị: tên kỳ (CYCLE) hoặc danh sách tên đợt (PERIOD). */
  periodLabel?: string
  /** Các phòng ban áp dụng; rỗng = toàn tổ chức. */
  orgUnits?: ScorecardOrgUnitResponse[]
  /** Nhãn gộp tên phòng ban (tiện hiển thị). */
  orgUnitName?: string | null
  /** Cấp trong cây BSC — COMPANY khi không gắn phòng ban nào, UNIT khi có. */
  level?: BscScorecardLevel
  /** Bộ tiêu chí cấp trên (null với BSC công ty hoặc BSC đơn vị chưa gắn cha). */
  parentScorecardId?: string | null
  parentScorecardName?: string | null
  status: BscScorecardStatus
  scoringMode: BscScoringMode
  emptyPerspectivePolicy: BscEmptyPerspectivePolicy
  perspectives: ScorecardPerspectiveResponse[]
  totalWeight: number
  createdAt?: string
  updatedAt?: string
}

export interface ScorecardPerspectiveWeightRequest {
  perspectiveId: string
  weightPercentage: number
  displayOrder?: number
  /**
   * Mục tiêu RIÊNG của hạng mục trong bộ tiêu chí này (công ty 100 tỷ, phòng KD 60 tỷ...).
   * Danh sách gửi lên là authoritative: null = xoá mục tiêu riêng, dòng tạo mới không gửi gì
   * thì kế thừa mặc định của hạng mục.
   */
  targetValue?: number | null
  minimumValue?: number | null
  unit?: string | null
  measurementSource?: BscMeasurementSource | null
  isGate?: boolean | null
  gateMinPercent?: number | null
  gateEffect?: BscGateEffect | null
  gateCapRating?: number | null
  gateAppliesTo?: BscGateScope | null
  reason?: string
}

export interface ScorecardRequest {
  name: string
  vision?: string
  applyScope: BscScorecardApplyScope
  /** Các đợt áp dụng khi applyScope = PERIOD (chọn được nhiều). */
  kpiPeriodIds?: string[]
  /** Kỳ áp dụng khi applyScope = CYCLE (chỉ 1). */
  kpiCycleId?: string
  /** Các phòng ban áp dụng; rỗng/bỏ trống = toàn tổ chức. */
  orgUnitIds?: string[]
  /** Bộ tiêu chí cấp trên trong cây BSC; chỉ hợp lệ với thẻ có gắn phòng ban. */
  parentScorecardId?: string | null
  status?: BscScorecardStatus
  scoringMode?: BscScoringMode
  emptyPerspectivePolicy?: BscEmptyPerspectivePolicy
  perspectives?: ScorecardPerspectiveWeightRequest[]
}

export interface PerspectiveScoreResponse {
  perspectiveId: string
  code: string
  name: string
  color?: string
  fixedPerspective?: BscFixedPerspective
  fixedPerspectiveName?: string
  fixedPerspectiveColor?: string
  weightPercentage: number
  kpiCount: number
  achievementPercent?: number | null
  weightedScore?: number | null
  /** true = hạng mục tự chấm theo mục tiêu của chính nó (kiểu OKR) thay vì trung bình KPI con. */
  scoredByTarget?: boolean | null
  targetValue?: number | null
  minimumValue?: number | null
  unit?: string | null
  /** Tổng thực đạt của các KPI định lượng trong hạng mục — chỉ có khi chấm theo mục tiêu. */
  actualValue?: number | null

  /** Dòng chỉ tiêu cụ thể đã dùng để chấm (cùng hạng mục ở hai bộ tiêu chí có mục tiêu khác nhau). */
  scorecardPerspectiveId?: string | null
  /** Hạng mục chặn: kết quả tính sẵn để màn hình kết quả nói được lý do. */
  isGate?: boolean | null
  gateMinPercent?: number | null
  /** null = không phải hạng mục chặn, hoặc chưa đủ dữ liệu để kết luận. */
  gatePassed?: boolean | null
}

// `PerspectiveScoreResponse` ở trên vẫn dùng: điểm hạng mục đính kèm trong Evaluation
// (xem `@/types/evaluation`). Các kiểu của dashboard bộ tiêu chí và bản đồ chiến lược đã
// gỡ cùng hai màn đó.


// ================================================================
// BSC phân cấp — cascade, kết quả đơn vị, chính sách hệ số, waterfall
// (docs/bsc-cascade-design.md)
// ================================================================

export interface CascadeTargetRequest {
  orgUnitId: string
  contributionValue?: number | null
  contributionPercent?: number | null
  targetValue?: number | null
  minimumValue?: number | null
  unit?: string | null
  weightPercentage?: number | null
}

export interface CascadeRequest {
  scorecardPerspectiveId: string
  linkType?: BscLinkType
  targets: CascadeTargetRequest[]
}

export interface CoverageChildResponse {
  scorecardPerspectiveId: string
  scorecardId: string
  scorecardName: string
  orgUnitId?: string | null
  orgUnitName?: string | null
  linkType?: BscLinkType | null
  contributionValue?: number | null
  contributionPercent?: number | null
  targetValue?: number | null
  weightPercentage?: number | null
}

/** NOT_CASCADED = chưa phân rã dòng nào; UNDER/OVER = tổng đóng góp lệch so với mục tiêu cha. */
export type CoverageStatus = 'NOT_CASCADED' | 'UNDER' | 'OK' | 'OVER'

export interface CoverageItemResponse {
  scorecardPerspectiveId: string
  perspectiveId: string
  name: string
  color?: string
  targetValue?: number | null
  unit?: string | null
  cascadedValue?: number | null
  status: CoverageStatus
  gap?: number | null
  children: CoverageChildResponse[]
}

export interface ScorecardCoverageResponse {
  scorecardId: string
  scorecardName: string
  notCascadedCount: number
  underCount: number
  okCount: number
  overCount: number
  items: CoverageItemResponse[]
}

export interface ScorecardTreeNodeResponse {
  id: string
  name: string
  level: BscScorecardLevel
  status: BscScorecardStatus
  orgUnitName?: string | null
  periodLabel?: string | null
  totalWeight: number
  itemCount: number
  /** Số chỉ tiêu do cấp trên giao — phần còn lại là đơn vị tự thêm. */
  assignedCount: number
  gateCount: number
  achievementPercent?: number | null
  bandLabel?: string | null
  factor?: number | null
  children: ScorecardTreeNodeResponse[]
}

export interface UnitResultItemResponse {
  id: string
  scorecardPerspectiveId: string
  name: string
  color?: string
  actualValue?: number | null
  targetValue?: number | null
  unit?: string | null
  achievementPercent?: number | null
  weightPercentage?: number | null
  weightedScore?: number | null
  kpiCount?: number
  isGate?: boolean
  gatePassed?: boolean | null
  measurementSource?: BscMeasurementSource
}

export interface UnitResultResponse {
  id: string
  scorecardId: string
  scorecardName: string
  orgUnitName?: string | null
  kpiPeriodId?: string | null
  kpiPeriodName?: string | null
  achievementPercent?: number | null
  bandLabel?: string | null
  factor?: number | null
  gatePassed?: boolean | null
  gateFailedItems?: string | null
  status: BscUnitResultStatus
  finalizedByName?: string | null
  finalizedAt?: string | null
  items: UnitResultItemResponse[]
}

export interface FactorBandRequest {
  scope: BscFactorScope
  fromPercent?: number | null
  toPercent?: number | null
  factor: number
  label?: string | null
  color?: string | null
  displayOrder?: number
}

export interface FactorBandResponse extends FactorBandRequest {
  id: string
}

export interface CascadePolicyRequest {
  name: string
  kpiCycleId?: string | null
  unitFactorMode?: BscFactorMode
  companyFactorMode?: BscFactorMode
  factorBasis?: BscFactorBasis
  factorFloor?: number
  factorCap?: number
  recognizedCapPercent?: number
  minBscLinkedWeight?: number
  linkedWeightEnforce?: BscLinkedWeightEnforce
  bands?: FactorBandRequest[]
}

export interface CascadePolicyResponse {
  id: string
  name: string
  kpiCycleId?: string | null
  kpiCycleName?: string | null
  unitFactorMode: BscFactorMode
  companyFactorMode: BscFactorMode
  factorBasis: BscFactorBasis
  factorFloor: number
  factorCap: number
  recognizedCapPercent: number
  minBscLinkedWeight: number
  linkedWeightEnforce: BscLinkedWeightEnforce
  status: string
  version: number
  bands: FactorBandResponse[]
}

/**
 * Diễn giải điểm cá nhân theo đúng thứ tự B1→B3 rồi mới tới chặn.
 * Hạng mục chặn KHÔNG nằm trong chuỗi nhân — nó chỉ hạ trần xếp loại.
 */
export interface BscWaterfallResponse {
  evaluationId: string
  userId?: string | null
  userName?: string | null
  orgUnitName?: string | null
  kpiPeriodId?: string | null
  kpiPeriodName?: string | null

  rawBscScore?: number | null
  recognizedCapPercent?: number | null
  cappedScore?: number | null

  unitAchievementPercent?: number | null
  unitBandLabel?: string | null
  unitFactor?: number | null
  companyAchievementPercent?: number | null
  companyBandLabel?: string | null
  companyFactor?: number | null

  recognizedScore?: number | null

  overrideScore?: number | null
  overrideReasonCode?: string | null
  overrideComment?: string | null
  overriddenByName?: string | null
  overriddenAt?: string | null

  finalScore?: number | null

  gatePassed?: boolean | null
  gateCapRating?: number | null
  gateFailedItems?: string | null
  matrixRating?: number | null

  perspectives: PerspectiveScoreResponse[]
  /** Cách xử lý hạng mục không có KPI nào — quyết định độ lớn của điểm gốc. */
  emptyPerspectivePolicy?: BscEmptyPerspectivePolicy | null

  linkedWeightPercent?: number | null
  linkedWeightRequired?: number | null
  linkedWeightSatisfied?: boolean | null
}

export interface BscOverrideRequest {
  /** null = huỷ ghi đè, trả điểm về con số hệ thống tính. */
  score?: number | null
  reasonCode: string
  comment?: string
}

export interface LinkedWeightCheck {
  linkedPercent: number
  minRequired: number
  satisfied: boolean
  /** true = mức BLOCK (chặn hẳn), false = chỉ cảnh báo. */
  enforced: boolean
}
