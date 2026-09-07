// Khớp với backend: com.kpitracking.enums.* và dto/*/wallet/*
// Mọi số tiền tính bằng ĐỒNG (số nguyên), không có đơn vị nhỏ hơn.

export enum CashTransactionType {
  TOPUP = 'TOPUP',
  CONVERT = 'CONVERT',
  ADJUST = 'ADJUST',
}

export enum CashSourceType {
  SEPAY = 'SEPAY',
  CONVERSION = 'CONVERSION',
  MANUAL = 'MANUAL',
  SYSTEM = 'SYSTEM',
}

export enum TopupOrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum SepayEventStatus {
  MATCHED = 'MATCHED',
  UNMATCHED = 'UNMATCHED',
  DUPLICATE = 'DUPLICATE',
  IGNORED = 'IGNORED',
}

export enum SepayResolveMode {
  MATCH_ORDER = 'MATCH_ORDER',
  CREDIT_USER = 'CREDIT_USER',
  IGNORE = 'IGNORE',
}

export interface CashWallet {
  id: string
  userId: string
  fullName: string
  email: string
  employeeCode?: string | null
  avatarUrl?: string | null
  balance: number
  lifetimeTopup: number
  lifetimeConverted: number
  /** Số đồng đổi được 1 điểm. */
  pointExchangeRate: number
  /** floor(balance / pointExchangeRate) */
  convertiblePoints: number
}

export interface CashWalletSummary {
  walletCount: number
  /** Tổng tiền đã nạp nhưng chưa đổi thành điểm — khoản công ty đang giữ. */
  totalBalance: number
  totalTopup: number
  totalConverted: number
  /** Số ví lệch sổ cái. Phải luôn bằng 0. */
  inconsistentCount: number
}

export interface CashTransaction {
  id: string
  amount: number
  type: CashTransactionType
  sourceType: CashSourceType
  balanceAfter: number
  pointsGranted?: number | null
  rateSnapshot?: number | null
  note?: string | null
  actorUserId?: string | null
  actorName?: string | null
  createdAt: string
}

export interface TopupOrder {
  id: string
  userId: string
  fullName: string
  code: string
  /** Số tiền đề nghị nạp. */
  amount: number
  /** Số tiền thực nhận. Có thể lệch so với amount — ví ghi có đúng số thực nhận. */
  paidAmount?: number | null
  status: TopupOrderStatus
  qrUrl?: string | null
  bankCode?: string | null
  bankAccountNumber?: string | null
  bankAccountHolder?: string | null
  expiresAt: string
  paidAt?: string | null
  createdAt: string
}

export interface SepayEvent {
  id: string
  sepayId: number
  gateway?: string | null
  transactionDate?: string | null
  accountNumber?: string | null
  code?: string | null
  content?: string | null
  transferType?: string | null
  transferAmount?: number | null
  referenceCode?: string | null
  status: SepayEventStatus
  amountMismatch: boolean
  errorMessage?: string | null
  matchedOrderId?: string | null
  matchedOrderCode?: string | null
  matchedOrderAmount?: number | null
  matchedOrderUserName?: string | null
  resolvedAt?: string | null
  resolvedByName?: string | null
  resolutionNote?: string | null
  resolutionTransactionId?: string | null
  inQueue: boolean
  /**
   * Chưa quy được về tổ chức nào — tiền về một tài khoản chưa ai khai trong cấu
   * hình ví. Nhóm này hiện trong hàng đợi của mọi tổ chức và KHÔNG ghi có thẳng
   * cho người dùng được.
   */
  unattributed: boolean
  receivedAt: string
}

export interface ConversionQuote {
  points: number
  rate: number
  cost: number
  balanceBefore: number
  balanceAfter: number
  affordable: boolean
  maxPoints: number
}

export interface WalletConfig {
  enableCashWallet: boolean
  pointExchangeRate: number
  topupMinAmount: number
  topupMaxAmount: number
  topupExpireMinutes: number
  sepayAccountNumber?: string | null
  sepayBankCode?: string | null
  sepayAccountHolder?: string | null
  bankConfigured: boolean
  /** Lần cuối nhận webhook SePay về tài khoản này. Null nghĩa là chưa nối xong. */
  lastWebhookAt?: string | null
}

export interface WalletReconcile {
  inconsistentWalletIds: string[]
  unresolvedEventCount: number
  amountMismatchCount: number
  clean: boolean
}

// ── Request ────────────────────────────────────────────────────────

export interface CreateTopupRequest {
  amount: number
}

export interface ConvertToPointsRequest {
  points: number
  /**
   * Chống ghi trùng. Phải sinh MỚI mỗi khi số điểm thay đổi, giữ nguyên khi chỉ
   * bấm gửi lại cùng một giá trị.
   */
  requestId: string
}

export interface ResolveSepayEventRequest {
  mode: SepayResolveMode
  orderId?: string
  userId?: string
  note: string
}

export interface WalletConfigRequest {
  pointExchangeRate: number
  topupMinAmount: number
  topupMaxAmount: number
  topupExpireMinutes: number
  sepayAccountNumber?: string | null
  sepayBankCode?: string | null
  sepayAccountHolder?: string | null
}
