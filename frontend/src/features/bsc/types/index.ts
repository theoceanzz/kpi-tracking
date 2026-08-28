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
  color?: string
  icon?: string
  displayOrder: number
  status: BscPerspectiveStatus
  fixedPerspective?: BscFixedPerspective
  fixedPerspectiveName?: string
  fixedPerspectiveColor?: string
}

export interface PerspectiveRequest {
  code: string
  name: string
  description?: string
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

export enum BscScorecardStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
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

export interface ScorecardPerspectiveResponse {
  id: string
  perspectiveId: string
  code: string
  name: string
  color?: string
  weightPercentage: number
  displayOrder: number
  fixedPerspective?: BscFixedPerspective
  fixedPerspectiveName?: string
  fixedPerspectiveColor?: string
}

export interface ScorecardOrgUnitResponse {
  id: string
  name: string
}

/** Cách bộ tiêu chí gắn với thời gian: nhiều ĐỢT cụ thể, hay MỘT KỲ (mọi đợt thuộc kỳ). */
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
}

// `PerspectiveScoreResponse` ở trên vẫn dùng: điểm hạng mục đính kèm trong Evaluation
// (xem `@/types/evaluation`). Các kiểu của dashboard bộ tiêu chí và bản đồ chiến lược đã
// gỡ cùng hai màn đó.
