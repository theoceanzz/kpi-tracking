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

  // ── Hồ sơ pháp nhân & biên nhận thu tiền ──
  receiptEnabled: boolean
  legalName?: string | null
  taxCode?: string | null
  businessAddress?: string | null
  contactPhone?: string | null
  receiptSeriesPrefix: string
  receiptVatRate: number
  receiptIssuerName?: string | null
  receiptIssuerTitle?: string | null
  /**
   * Đã khai đủ mã số thuế và địa chỉ để biên nhận có giá trị đối chiếu hay chưa.
   * Thiếu thì biên nhận vẫn được lập và gửi — giữ tiền người dùng lại vì tổ chức chưa điền
   * hồ sơ là sai — nhưng tờ chứng từ khi đó thiếu nội dung bắt buộc.
   */
  legalProfileComplete: boolean
}

/**
 * Biên nhận thu tiền của một lần nạp ví.
 *
 * `html` là bản in đầy đủ do máy chủ dựng; giao diện chỉ hiển thị, KHÔNG dựng lại từ các trường
 * rời — các nội dung bắt buộc theo Điều 10 Nghị định 123/2020/NĐ-CP phải giống hệt nhau trên
 * email và trên màn hình, và hai nơi cùng dựng là hai nơi có thể lệch.
 */
export interface TopupReceipt {
  id: string
  topupOrderId: string
  /** VD `PT2026/00000042`. */
  number: string
  issuedDate: string
  sellerName: string
  buyerName: string
  description: string
  amountBeforeTax: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  totalInWords: string
  paymentMethod: string
  paymentReference?: string | null
  html: string
}

export interface WalletReconcile {
  inconsistentWalletIds: string[]
  unresolvedEventCount: number
  amountMismatchCount: number
  /**
   * Tổ chức đã khai số tài khoản nhận tiền chưa. Chưa khai thì hàng đợi luôn
   * trống kể cả khi tiền đã về, nên `clean` một mình không đủ để nói sổ đã sạch.
   */
  bankConfigured: boolean
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

  // ── Hồ sơ pháp nhân & biên nhận thu tiền ──
  legalName?: string | null
  taxCode?: string | null
  businessAddress?: string | null
  contactPhone?: string | null
  receiptEnabled?: boolean
  receiptSeriesPrefix?: string | null
  receiptVatRate?: number
  receiptIssuerName?: string | null
  receiptIssuerTitle?: string | null
}
