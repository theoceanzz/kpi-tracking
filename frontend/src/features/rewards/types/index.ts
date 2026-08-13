// Khớp với backend: com.kpitracking.enums.* và dto/*/reward/*

export enum RewardTransactionType {
  EARN = 'EARN',
  SPEND = 'SPEND',
  REFUND = 'REFUND',
  ADJUST = 'ADJUST',
  EXPIRE = 'EXPIRE',
}

export enum RewardSourceType {
  MANUAL_GRANT = 'MANUAL_GRANT',
  AUTO_RANKING = 'AUTO_RANKING',
  REDEMPTION = 'REDEMPTION',
  SYSTEM = 'SYSTEM',
  EXTERNAL = 'EXTERNAL',
}

export enum RewardGrantStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  REVOKED = 'REVOKED',
}

export enum RewardApprovalMode {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

export interface RewardWallet {
  id?: string
  userId: string
  fullName: string
  email: string
  employeeCode?: string | null
  avatarUrl?: string | null
  balance: number
  lifetimeEarned: number
  lifetimeSpent: number
  /** Số dư âm — xảy ra khi thưởng bị thu hồi sau lúc nhân viên đã tiêu điểm. */
  negative: boolean
}

export interface RewardTransaction {
  id: string
  amount: number
  type: RewardTransactionType
  sourceType: RewardSourceType
  balanceAfter: number
  note?: string | null
  actorUserId?: string | null
  actorName?: string | null
  createdAt: string
}

export interface RewardGrantRecipient {
  userId: string
  fullName: string
  email: string
  employeeCode?: string | null
  avatarUrl?: string | null
  points: number
  transactionId?: string | null
}

export interface RewardGrant {
  id: string
  orgUnitId?: string | null
  orgUnitName?: string | null
  grantorUserId: string
  grantorName: string
  totalPoints: number
  pointsPerRecipient?: number | null
  reason: string
  status: RewardGrantStatus
  approvalMode: RewardApprovalMode
  /** Vì sao đề nghị phải qua duyệt. Hiện nguyên văn cho người trao. */
  approvalReason?: string | null
  approverUserId?: string | null
  approverName?: string | null
  approvedAt?: string | null
  decisionNote?: string | null
  recipients: RewardGrantRecipient[]
  createdAt: string
  /** Chỉ có ở phản hồi lúc tạo — cho biết nên báo "đã thưởng" hay "chờ duyệt". */
  requiresApproval?: boolean
}

export interface CreateRewardGrantRequest {
  recipients: { userId: string; points: number }[]
  reason: string
  pointsPerRecipient?: number
}

export interface GrantDecisionRequest {
  note?: string
  /** Chỉ dùng khi thu hồi: chấp nhận để số dư nhân viên xuống âm. */
  force?: boolean
}

export interface RewardBudget {
  id: string
  grantorUserId: string
  grantorName: string
  grantorEmail: string
  kpiCycleId?: string | null
  kpiCycleName?: string | null
  kpiPeriodId?: string | null
  kpiPeriodName?: string | null
  periodStart: string
  periodEnd: string
  allocatedPoints: number
  /** Suy ra từ tổng đề nghị chờ duyệt + đã duyệt, không phải cột đếm. */
  usedPoints: number
  remainingPoints: number
  maxPerAward?: number | null
  note?: string | null
  /** Ngày của hạn mức đã lệch so với kỳ được gắn (ai đó sửa ngày kỳ sau khi cấp). */
  cycleDatesOutOfSync: boolean
}

export interface RewardBudgetRequest {
  grantorUserId: string
  /** Gắn theo kỳ HOẶC theo đợt, không được cả hai. */
  kpiCycleId?: string | null
  kpiPeriodId?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  allocatedPoints: number
  maxPerAward?: number | null
  note?: string
}

// ── Quà tặng & đổi quà ───────────────────────────────────────────

export enum GiftItemType {
  INTERNAL = 'INTERNAL',
  /** Chừa sẵn cho sàn quà tặng ngoài, v1 giao diện chưa cho tạo. */
  EXTERNAL_VOUCHER = 'EXTERNAL_VOUCHER',
}

export enum GiftItemStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum RedemptionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface GiftItem {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  pointCost: number
  /** null khi quà không giới hạn tồn kho. */
  stockQuantity?: number | null
  unlimitedStock: boolean
  /** true = quà vật lý, chờ giao. false = nhận ngay lúc đổi. */
  requiresDelivery: boolean
  type: GiftItemType
  status: GiftItemStatus
  displayOrder: number
  /** Còn hàng và đang bật — backend gộp sẵn để giao diện khỏi tự suy. */
  available: boolean
  /** Người đang xem có đủ điểm không; null ở màn hình quản trị. */
  affordable?: boolean | null
  /**
   * Số yêu cầu đổi đang chờ xử lý; chỉ có ở màn hình quản trị.
   * Lớn hơn 0 ⇒ quà đang bị khoá sửa tồn kho và khoá xoá.
   */
  pendingRedemptionCount?: number | null
}

export interface GiftItemRequest {
  name: string
  description?: string
  imageUrl?: string
  pointCost: number
  stockQuantity?: number | null
  unlimitedStock?: boolean
  requiresDelivery?: boolean
  type?: GiftItemType
  status?: GiftItemStatus
  displayOrder?: number
}

export interface Redemption {
  id: string
  userId: string
  userFullName: string
  userEmail: string
  userEmployeeCode?: string | null
  giftItemId: string
  /** Tên quà chụp lại lúc đổi — quà đổi tên sau không làm sai lịch sử. */
  giftNameSnapshot: string
  giftImageUrl?: string | null
  quantity: number
  pointsSpent: number
  status: RedemptionStatus
  handledByUserId?: string | null
  handledByName?: string | null
  handledAt?: string | null
  deliveredAt?: string | null
  note?: string | null
  createdAt: string
}

export interface CreateRedemptionRequest {
  giftItemId: string
  quantity: number
  note?: string
}

/** Hậu quả của việc thu hồi một đề nghị thưởng, tính trước khi thực hiện. */
export interface RevokePreview {
  grantId: string
  totalPoints: number
  /** Có ai bị âm số dư sau khi thu hồi không. */
  anyGoesNegative: boolean
  items: {
    userId: string
    fullName: string
    email: string
    points: number
    currentBalance: number
    balanceAfter: number
    goesNegative: boolean
  }[]
}

// ── Chương trình thưởng tự động theo xếp hạng ────────────────────

export enum RewardProgramScope {
  PERIOD = 'PERIOD',
  CYCLE = 'CYCLE',
}

export enum RewardRankingMetric {
  /** Điểm chốt kỳ — chỉ dùng với scope CYCLE. */
  FINAL_SCORE = 'FINAL_SCORE',
  MATRIX_RATING = 'MATRIX_RATING',
  /** Điểm hiệu suất đợt — chỉ dùng với scope PERIOD. */
  PERFORMANCE = 'PERFORMANCE',
}

export enum RewardRankWithin {
  SCOPE = 'SCOPE',
  PER_UNIT = 'PER_UNIT',
}

export enum RewardTiePolicy {
  /** Đồng điểm cùng hạng ⇒ "Top 3" có thể trả cho 4 người. */
  SHARE_ALL = 'SHARE_ALL',
  STRICT = 'STRICT',
}

export enum RewardRunStatus {
  PREVIEW = 'PREVIEW',
  ISSUED = 'ISSUED',
  REVERTED = 'REVERTED',
}

export interface RewardTier {
  fromRank: number
  toRank: number
  points: number
}

export interface RewardProgram {
  id: string
  name: string
  description?: string | null
  scope: RewardProgramScope
  orgUnitId?: string | null
  orgUnitName?: string | null
  /** Null = chương trình dùng cho mọi kỳ/đợt; có giá trị = chỉ dành cho kỳ/đợt đó. */
  fixedTargetId?: string | null
  fixedTargetName?: string | null
  rankWithin: RewardRankWithin
  metric: RewardRankingMetric
  tiePolicy: RewardTiePolicy
  minMetricValue?: number | null
  maxPointsPerRun?: number | null
  includeUnitHeads: boolean
  tiers: RewardTier[]
  enabled: boolean
  /** Tự phát khi kỳ/đợt qua ngày kết thúc. */
  autoTrigger: boolean
  createdAt: string
  /** Số lần đã phát — lớn hơn 0 thì chương trình bị khoá xoá và khoá đổi phạm vi. */
  issuedRunCount: number
}

export interface RewardProgramRequest {
  name: string
  description?: string
  scope: RewardProgramScope
  orgUnitId?: string | null
  /** Để trống = dùng cho mọi kỳ/đợt. */
  fixedTargetId?: string | null
  rankWithin?: RewardRankWithin
  metric: RewardRankingMetric
  tiePolicy?: RewardTiePolicy
  minMetricValue?: number | null
  maxPointsPerRun?: number | null
  includeUnitHeads?: boolean
  tiers: RewardTier[]
  enabled?: boolean
  autoTrigger?: boolean
}

export interface RewardRunItem {
  userId: string
  fullName: string
  employeeCode?: string | null
  orgUnitName?: string | null
  rank: number
  orderIndex: number
  metricValue?: number | null
  points: number
}

export interface RewardRunSkipped {
  userId: string
  fullName: string
  reason: string
}

export interface RewardProgramRun {
  id: string
  programId: string
  programName: string
  kpiPeriodId?: string | null
  kpiCycleId?: string | null
  targetName?: string | null
  status: RewardRunStatus
  totalPoints: number
  recipientCount: number
  executedByUserId?: string | null
  executedByName?: string | null
  executedAt?: string | null
  revertedAt?: string | null
  createdAt: string
  /** Bậc thưởng THỰC SỰ dùng cho lần chạy này — có thể khác bậc mặc định của chương trình. */
  tiers: RewardTier[]
  items: RewardRunItem[]
  /** Người bị loại khỏi bảng xếp hạng kèm lý do — để admin không tưởng hệ thống bỏ sót. */
  skipped: RewardRunSkipped[]
}
