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
  CHECKIN = 'CHECKIN',
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
  /** Voucher nhập từ kho quà ngoài (UrBox) — mã quà về ngay khi đổi. */
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
  /** Nhà cung cấp ngoài không xuất được quà — điểm đã tự hoàn. Khác hẳn REJECTED. */
  FAILED = 'FAILED',
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
  /** 'URBOX' nếu quà nhập từ kho eVoucher UrBox; null với quà nội bộ. */
  externalProvider?: string | null
  /** Mệnh giá VNĐ bên nhà cung cấp. */
  externalValue?: number | null
  externalBrand?: string | null
  /** Điều kiện sử dụng (HTML) — UrBox bắt buộc hiển thị TRƯỚC khi đổi. */
  externalTerms?: string | null
  /** Nguyên văn "Tối thiểu 30 ngày". */
  externalExpireText?: string | null
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
  /** 'URBOX' nếu quà do nhà cung cấp ngoài xuất. */
  externalProvider?: string | null
  /** Mã đơn bên nhà cung cấp — để đối soát, KHÔNG phải mã dùng quà. */
  externalOrderId?: string | null
  /** Mã voucher. Chỉ có ở API "quà của tôi"; danh sách quản trị luôn để trống. */
  vouchers?: RedemptionVoucher[] | null
  /** Vì sao chưa lấy được quà. */
  fulfillmentError?: string | null
  /** Điều kiện sử dụng (HTML) chụp lại lúc nhập quà. */
  giftTerms?: string | null
}

/** Một mã quà đã xuất. UrBox quy định phải hiện đủ các trường có giá trị. */
export interface RedemptionVoucher {
  code: string
  /** Có giá trị thì bắt buộc hiển thị kèm code. */
  pin?: string | null
  /** Có giá trị thì bắt buộc hiển thị kèm code. */
  serial?: string | null
  link?: string | null
  /** Ảnh QR/Barcode do UrBox sinh sẵn — dùng ảnh này thay vì tự vẽ. */
  codeImage?: string | null
  codeDisplay?: string | null
  /** 1 QR, 2 Barcode, 3 vật lý, 4 text, 5 cả QR lẫn Barcode. */
  codeDisplayType?: number | null
  /** Hạn dùng nguyên văn (dd/MM/yyyy). */
  expired?: string | null
}

export interface CreateRedemptionRequest {
  giftItemId: string
  quantity: number
  note?: string
}

// ── Kho quà eVoucher UrBox ───────────────────────────────────────

/** Tình trạng kết nối UrBox của bản triển khai — quyết định có hiện tab kho quà không. */
export interface UrboxStatus {
  enabled: boolean
  /** Thiếu campaign_code thì xem được kho quà nhưng không đặt được đơn. */
  canOrder: boolean
  /** Đang trỏ môi trường thử: mã quà là mã giả, phải nói rõ cho quản trị viên. */
  sandbox: boolean
  signed: boolean
}

export interface UrboxGift {
  /** Mã quà UrBox — chính là priceId khi đặt đơn. */
  urboxGiftId: string
  name: string
  imageUrl?: string | null
  brandName?: string | null
  brandImageUrl?: string | null
  categoryName?: string | null
  /** Mệnh giá VNĐ. */
  value?: number | null
  expireText?: string | null
  codeDisplay?: string | null
  content?: string | null
  /** Điều kiện sử dụng (HTML). */
  terms?: string | null
  inStock: boolean
  /** Đã có trong danh mục của tổ chức — mỗi món chỉ nhập được một lần. */
  imported: boolean
  /** Mệnh giá chia tỉ giá quy đổi của tổ chức, làm tròn lên. */
  suggestedPointCost?: number | null
}

export interface UrboxCatalogPage {
  items: UrboxGift[]
  page: number
  totalPages: number
  /** UrBox trả về dạng chuỗi. */
  totalResult?: string | null
}

/** Danh mục và thương hiệu UrBox có cùng hình dạng nên dùng chung một kiểu. */
export interface UrboxTaxonomy {
  id: string
  name: string
  imageUrl?: string | null
  giftCount?: number | null
}

export interface ImportUrboxGiftRequest {
  urboxGiftId: string
  /** Bỏ trống = lấy giá gợi ý theo tỉ giá quy đổi của tổ chức. */
  pointCost?: number
  /** Bỏ trống = không giới hạn, để tồn kho thật do UrBox quyết. */
  stockQuantity?: number | null
  name?: string
  displayOrder?: number
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

// ── Điểm danh hàng ngày ──────────────────────────────────────────

/** Chạm chuỗi đúng `day` ngày thì được cộng thêm `points` điểm. */
export interface StreakBonus {
  day: number
  points: number
}

export interface CheckinConfig {
  /** Null khi tổ chức chưa từng lưu cấu hình — form vẫn dựng được từ mặc định. */
  id?: string | null
  enabled: boolean
  pointsPerDay: number
  /** Null = chuỗi đếm thẳng, mốc chỉ trúng đúng một lần. */
  streakCycleDays?: number | null
  skipWeekends: boolean
  streakBonuses: StreakBonus[]
  /** Trần điểm một người nhận được trong trọn một chu kỳ. Null khi không đặt chu kỳ. */
  maxPointsPerCycle?: number | null
  checkedInToday: number
  pointsThisMonth: number
}

export interface CheckinConfigRequest {
  enabled: boolean
  pointsPerDay: number
  streakCycleDays?: number | null
  skipWeekends: boolean
  streakBonuses: StreakBonus[]
}

export interface CheckinDay {
  date: string
  checkedIn: boolean
  /** Ngày nghỉ theo cấu hình — vẽ mờ thay vì vẽ như một ngày bị bỏ lỡ. */
  restDay: boolean
  points?: number | null
}

/**
 * Toàn bộ dữ liệu để vẽ thẻ điểm danh. Luật chuỗi (bỏ qua cuối tuần, quay vòng theo
 * chu kỳ) chỉ tồn tại ở backend — không chép sang đây, vì hai bên lệch nhau thì nhân
 * viên thấy số điểm khác nhau trước và sau khi bấm.
 */
export interface CheckinStatus {
  /** False khi tổ chức chưa bật, hoặc khi người xem được miễn — cả hai đều ẩn thẻ. */
  enabled: boolean
  /** Lãnh đạo cao nhất công ty (trưởng/phó đơn vị gốc) được miễn điểm danh. */
  exempt: boolean
  /** Hôm nay theo giờ Việt Nam, không theo máy người dùng. */
  today: string
  checkedInToday: boolean
  todayPoints?: number | null
  canCheckin: boolean
  blockedReason?: string | null
  /** Chuỗi ĐÃ đạt, không phải chuỗi sắp đạt. Đứt chuỗi thì bằng 0. */
  streakLength: number
  /** Chuỗi mà lần bấm sắp tới đạt được. Null khi hôm nay không còn lần bấm nào. */
  nextStreakLength?: number | null
  streakDay: number
  streakCycleDays?: number | null
  nextPoints?: number | null
  nextBonusPoints?: number | null
  pointsPerDay: number
  streakBonuses: StreakBonus[]
  pointsThisMonth: number
  recentDays: CheckinDay[]
}

// ── Bảng tin điểm thưởng ─────────────────────────────────────────

export enum RewardActivityType {
  POINTS_AWARDED = 'POINTS_AWARDED',
  BUDGET_GRANTED = 'BUDGET_GRANTED',
  GIFT_REDEEMED = 'GIFT_REDEEMED',
}

/**
 * Một dòng trên dải tin chạy ngang. Backend đã trộn sẵn ba nguồn về chung hình dạng
 * này và sắp theo thời gian — đừng trộn lại ở đây.
 */
export interface RewardActivity {
  /** Chỉ duy nhất trong một loại, nên khoá React phải là `${type}-${id}`. */
  id: string
  type: RewardActivityType
  /** Nhân vật chính: người nhận điểm / được cấp hạn mức / đổi quà. */
  userId: string
  userName: string
  userAvatarUrl?: string | null
  /** Người trao. Null với thưởng tự động và đổi quà. */
  actorUserId?: string | null
  actorName?: string | null
  points: number
  giftName?: string | null
  giftImageUrl?: string | null
  note?: string | null
  occurredAt: string
}
