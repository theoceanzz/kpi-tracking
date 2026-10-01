import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

export type AiReviewStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'
export type AiReviewConfidence = 'CAO' | 'TRUNG_BINH' | 'THAP'

/**
 * Kết quả AI cho một chỉ tiêu. Ba con số (`achievementPercent`, `onTimePercent`, `suggestedScore`) do
 * MÃ NGUỒN tính, không phải mô hình — mô hình chỉ quyết phần chất lượng nội dung.
 */
export interface AiReviewItem {
  id: string
  kpiCriteriaId: string
  kpiCriteriaName?: string
  weight?: number
  kpiSubmissionId?: string | null
  summary?: string | null
  qualityLevel?: string | null
  qualityComment?: string | null
  evidenceQuotes: string[]
  achievementPercent?: number | null
  onTimePercent?: number | null
  suggestedScore?: number | null
  strengths: string[]
  gaps: string[]
  suggestions: string[]
  errorMessage?: string | null
  /** Căn cứ kèm đoạn văn gốc (rỗng với lượt chấm cũ). */
  basis?: AiReviewBasis[]
  /**
   * Điểm gợi ý chia ba phần theo trọng số: định lượng trên THANG ĐIỂM ĐÁNH GIÁ, định tính trên THANG HÀNH VI riêng
   * (100 chia theo trọng số các chỉ tiêu định tính). `null` với lượt cũ.
   */
  maxPoints?: number | null
  targetPoints?: number | null
  qualityPoints?: number | null
  onTimePoints?: number | null
  /** Điểm hệ thống của chỉ tiêu trên cùng thang — để so. */
  systemPoints?: number | null
  qualitative?: boolean | null
  targetValue?: number | null
  unit?: string | null
  /** Thực đạt khai ở bài nộp mới nhất. */
  actualValue?: number | null
  /** Định tính: mức người nộp tự đánh giá. */
  selfLevel?: string | null
  /** Định tính: mức gần nhất với điểm AI gợi ý trên thang hành vi. */
  suggestedLevel?: string | null
}

/**
 * Một căn cứ của nhận xét AI: dòng bộ tiêu chí (`CRITERIA`) hoặc đoạn quy chế trong kho (`REGULATION`). `excerpt`
 * là đoạn văn GỐC do hệ thống tra — không phải chữ mô hình viết.
 */
export interface AiReviewBasis {
  ref: string
  kind: 'CRITERIA' | 'REGULATION'
  title?: string | null
  source?: string | null
  excerpt?: string | null
  /** Đoạn gốc khớp tài liệu (máy đối chiếu hoặc người duyệt đã xác nhận dòng). */
  verified: boolean
}

/**
 * Nhân viên tự nhờ AI soi bài trước khi nộp. Cố ý không có mức chất lượng hay điểm; chỉ chính chủ đọc được.
 */
export interface AiSelfCheck {
  id: string
  kpiCriteriaId: string
  kpiSubmissionId?: string | null
  status: AiReviewStatus
  /** Trả lại lần soi trước cho đúng bài này — không tốn token. */
  reused: boolean
  summary?: string | null
  evidenceQuotes: string[]
  strengths: string[]
  gaps: string[]
  suggestions: string[]
  basis: AiReviewBasis[]
  unreadableFiles: string[]
  filesRead?: number | null
  filesTotal?: number | null
  /** Phiên bản bộ tiêu chí đã dùng (null = đơn vị chưa có bộ tiêu chí xác nhận). */
  criteriaSetVersion?: number | null
  createdAt: string
  finishedAt?: string | null
}

/** `reason`: AI_OFF / REVIEW_OFF / UNIT_OFF (chưa bật — ẩn hẳn), NO_QUOTA / QUOTA_USED (khoá nút, nêu lý do). */
export interface AiSelfCheckAvailability {
  available: boolean
  reason?: 'AI_OFF' | 'REVIEW_OFF' | 'UNIT_OFF' | 'NO_QUOTA' | 'QUOTA_USED' | null
  remainingTokens: number
}

/** Bài đang soạn trên form nộp bài — gửi kèm tệp chưa tải lên. */
export interface AiSelfCheckDraft {
  kpiCriteriaId: string
  submissionId?: string
  actualValue?: number | null
  qualitativeLevelId?: string | null
  note?: string | null
  files: File[]
}

/** Một lượt AI đọc bài nộp của một nhân viên trong một đợt. Chỉ để THAM KHẢO. */
export interface AiReview {
  id: string
  kpiPeriodId: string
  userId: string
  status: AiReviewStatus
  overallSummary?: string | null
  confidence?: AiReviewConfidence | null
  missingData: string[]
  unreadableFiles: string[]
  items: AiReviewItem[]
  /** Điểm đánh giá AI gợi ý cho cả đợt (thang 100); `null` với lượt cũ. */
  suggestedTotal?: number | null
  /** Điểm đánh giá hệ thống cùng thang (trần 100). */
  systemTotal?: number | null
  /** Điểm hành vi AI gợi ý (thang 100, các chỉ tiêu định tính) và mức gần nhất. */
  behaviorSuggestedTotal?: number | null
  behaviorSuggestedLevel?: string | null
  /** Trọng số (%) đã dùng cho lượt này. */
  weightTarget?: number | null
  weightQuality?: number | null
  weightOnTime?: number | null
  errorMessage?: string | null
  /** Phiên bản bộ tiêu chí đã dùng (null = chưa có bộ tiêu chí xác nhận). */
  criteriaSetVersion?: number | null
  /** Số tệp minh chứng đọc được / tổng số tệp. */
  filesRead?: number | null
  filesTotal?: number | null
  createdAt: string
  finishedAt?: string | null
  /** Nhãn bắt buộc — máy chủ gửi kèm để mọi client đều có chữ mà hiện. */
  disclaimer: string
}

export interface AiReviewSettings {
  enabled: boolean
  weightTarget: number
  weightQuality: number
  weightOnTime: number
}

export interface AiReviewBatchResult {
  queued: number
  reused: number
  skipped: number
}

export interface AiReviewUnitSetting extends AiReviewSettings {
  orgUnitId: string
  orgUnitName?: string | null
}

export interface AiReviewReportRow {
  userId: string
  userName?: string | null
  unitName?: string | null
  reviewId: string
  aiScore?: number | null
  managerScore?: number | null
  /** AI − quản lý. */
  difference?: number | null
  confidence?: AiReviewConfidence | null
}

export interface AiReviewReport {
  compared: number
  meanAbsoluteError?: number | null
  withinFivePercent?: number | null
  meanBias?: number | null
  rows: AiReviewReportRow[]
  units: { unitName: string; compared: number; meanAbsoluteError?: number | null; meanBias?: number | null }[]
}

export type AiCriteriaSetStatus = 'DRAFT' | 'CONFIRMED' | 'ARCHIVED'

/**
 * VAI TRÒ của một dòng (cố định — quyết định AI dùng dòng đó thế nào): TIEU_CHI căn cứ chấm · THANG_MUC thang
 * mức · THAM_KHAO AI đọc khi chấm · TRA_CUU chỉ tra cứu. Nhóm hiển thị còn theo CHỦ ĐỀ ({@link AiCriteriaSetItem.topic}).
 */
export type AiCriteriaKind = 'TIEU_CHI' | 'THANG_MUC' | 'THAM_KHAO' | 'TRA_CUU'

/** Một vai trò trong bộ nhóm của loại tài liệu (do backend khai — loại tài liệu nào dùng vai trò nào). */
export interface AiCriteriaRole {
  code: AiCriteriaKind
  label: string
  hint: string
  /** Dùng trực tiếp để chấm (căn cứ, thang mức) — hiện riêng khối "Dùng để chấm". */
  scoring: boolean
  /** Đưa vào lời nhắc khi AI chấm bài nộp. */
  inPrompt: boolean
  itemsLabel: string
}

export interface AiCriteriaSetItem {
  id?: string
  kind?: AiCriteriaKind
  /** Mục gốc trong tài liệu, vd "CHƯƠNG IV › Điều 10. Đánh giá kết quả công việc". */
  section?: string | null
  /** Chủ đề lấy từ chính tài liệu (tên chương…) — nhóm hiển thị động. */
  topic?: string | null
  name: string
  description?: string | null
  weight?: number | null
  /** Các mức, mỗi dòng một mức. */
  scaleLevels?: string | null
  scope?: string | null
  sourceExcerpt?: string | null
  /** Đoạn gốc có thật trong tài liệu — false thì màn đối chiếu cảnh báo. */
  excerptVerified?: boolean | null
  /** Người duyệt đã đối chiếu và xác nhận dòng đúng dù máy không thấy nguyên văn — hết cảnh báo. */
  reviewerConfirmed?: boolean | null
}

export interface AiCriteriaSet {
  id: string
  title: string
  orgUnitId?: string | null
  orgUnitName?: string | null
  version?: number | null
  status: AiCriteriaSetStatus
  sourceFileName?: string | null
  sourceText?: string | null
  createdAt: string
  confirmedAt?: string | null
  items?: AiCriteriaSetItem[]
  /** Mục không có gì dùng để đánh giá (kèm chủ đề, vd "— thưởng"). */
  skippedSections?: string[]
  /** Mục AI bóc lỗi — nên xem tay. */
  failedSections?: string[]
  /** Đã nạp toàn văn vào kho tri thức để AI trích khi chấm. */
  inKnowledgeBase?: boolean
  /** Loại tài liệu hệ thống nhận ra (REGULATION, KPI_TABLE…) và tên hiển thị. */
  profile?: string
  profileLabel?: string
  /** Vai trò loại tài liệu này dùng — màn duyệt vẽ nhóm theo đây. */
  roles?: AiCriteriaRole[]
  /** Người xem sửa / ngừng / xoá được (trong phạm vi và không bị cấp trên khoá). */
  canManage?: boolean
  /** Đang áp cho đơn vị người xem quản lý nhưng do cấp trên áp — không tự thay được. */
  locked?: boolean
  lockReason?: string | null
  appliedByName?: string | null
  appliedByRole?: string | null
  /** Đề nghị áp tài liệu này đang chờ duyệt. */
  pendingRequest?: {
    id: string
    orgUnitId: string
    orgUnitName?: string | null
    approverName?: string | null
    /** Người xem là người gửi. */
    mine?: boolean
    createdAt: string
  } | null
}

/** Đề nghị đổi quy chế đang áp cho một đơn vị (cấp dưới gửi, người đã áp / cấp trên quyết). */
export interface AiCriteriaChangeRequest {
  id: string
  orgUnitId: string
  orgUnitName?: string | null
  proposedSetId: string
  proposedSetTitle?: string | null
  currentSetId?: string | null
  currentSetTitle?: string | null
  requestedByName?: string | null
  requestedByRole?: string | null
  approverName?: string | null
  note?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  decisionNote?: string | null
  createdAt: string
}

/** Đơn vị người dùng áp được quy chế; `orgWide` = được áp cho cả tổ chức. */
export interface AiCriteriaScope {
  orgWide: boolean
  unitIds: string[]
}

const BASE = '/ai/submission-reviews'
const SETS = '/ai/criteria-sets'

export const aiReviewApi = {
  /** Nhờ AI đọc trước bài nộp (chạy nền). Đã có kết quả mới và bài nộp không đổi thì trả lượt cũ. */
  request: (kpiPeriodId: string, userId: string) =>
    axiosInstance.post<ApiResponse<AiReview>>(BASE, { kpiPeriodId, userId }).then(r => r.data.data),

  /** Lượt mới nhất, hoặc `null` khi chưa từng chạy. */
  latest: (kpiPeriodId: string, userId: string) =>
    axiosInstance.get<ApiResponse<AiReview | null>>(`${BASE}/latest`, { params: { kpiPeriodId, userId } })
      .then(r => r.data.data),

  /** Chạy lại bất kể đã có kết quả — tính vào hạn mức. */
  rerun: (reviewId: string) =>
    axiosInstance.post<ApiResponse<AiReview>>(`${BASE}/${reviewId}/rerun`).then(r => r.data.data),

  getSettings: () =>
    axiosInstance.get<ApiResponse<AiReviewSettings>>(`${BASE}/settings`).then(r => r.data.data),

  updateSettings: (body: AiReviewSettings) =>
    axiosInstance.put<ApiResponse<AiReviewSettings>>(`${BASE}/settings`, body).then(r => r.data.data),

  /** Chạy nền cho mọi người trong nhánh đơn vị mà mình chấm được. */
  batch: (kpiPeriodId: string, orgUnitId: string) =>
    axiosInstance.post<ApiResponse<AiReviewBatchResult>>(`${BASE}/batch`, null, { params: { kpiPeriodId, orgUnitId } })
      .then(r => r.data.data),

  report: (kpiPeriodId: string, orgUnitId?: string) =>
    axiosInstance.get<ApiResponse<AiReviewReport>>(`${BASE}/report`, { params: { kpiPeriodId, orgUnitId } })
      .then(r => r.data.data),

  unitSettings: () =>
    axiosInstance.get<ApiResponse<AiReviewUnitSetting[]>>(`${BASE}/unit-settings`).then(r => r.data.data),

  saveUnitSetting: (orgUnitId: string, body: AiReviewSettings) =>
    axiosInstance.put<ApiResponse<AiReviewUnitSetting>>(`${BASE}/unit-settings/${orgUnitId}`, body).then(r => r.data.data),

  deleteUnitSetting: (orgUnitId: string) => axiosInstance.delete(`${BASE}/unit-settings/${orgUnitId}`),
}

export const aiCriteriaSetApi = {
  list: () => axiosInstance.get<ApiResponse<AiCriteriaSet[]>>(SETS).then(r => r.data.data),

  get: (id: string) => axiosInstance.get<ApiResponse<AiCriteriaSet>>(`${SETS}/${id}`).then(r => r.data.data),

  /** AI bóc tài liệu thành bản nháp — gọi mô hình, có thể mất vài chục giây. */
  upload: (file: File, orgUnitId?: string | null, title?: string) => {
    const form = new FormData()
    form.append('file', file)
    return axiosInstance.post<ApiResponse<AiCriteriaSet>>(SETS, form, {
      params: { orgUnitId: orgUnitId ?? undefined, title: title || undefined },
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180_000,
    }).then(r => r.data.data)
  },

  updateItems: (id: string, items: AiCriteriaSetItem[]) =>
    axiosInstance.put<ApiResponse<AiCriteriaSet>>(`${SETS}/${id}/items`, { items }).then(r => r.data.data),

  confirm: (id: string) =>
    axiosInstance.post<ApiResponse<AiCriteriaSet>>(`${SETS}/${id}/confirm`).then(r => r.data.data),

  /** Đổi tên / đơn vị áp dụng. `orgUnitId` null = cả tổ chức. */
  updateInfo: (id: string, meta: AiCriteriaSetMeta) =>
    axiosInstance.put<ApiResponse<AiCriteriaSet>>(`${SETS}/${id}`, meta).then(r => r.data.data),

  /** Nhân bản sang đơn vị chưa có bộ đang dùng; tên trống thì máy chủ tự đặt. */
  clone: (id: string, meta: AiCriteriaSetMeta) =>
    axiosInstance.post<ApiResponse<AiCriteriaSet>>(`${SETS}/${id}/clone`, meta).then(r => r.data.data),

  remove: (id: string) => axiosInstance.delete(`${SETS}/${id}`),

  scope: () => axiosInstance.get<ApiResponse<AiCriteriaScope>>(`${SETS}/manageable-units`).then(r => r.data.data),

  /** Ngừng áp dụng: đơn vị quay về tài liệu đơn vị cha / thang chung. */
  stop: (id: string) => axiosInstance.post<ApiResponse<AiCriteriaSet>>(`${SETS}/${id}/stop`).then(r => r.data.data),

  /** Áp lại tài liệu đã ngừng cho một đơn vị chưa có tài liệu đang áp. */
  reapply: (id: string, orgUnitId: string | null) =>
    axiosInstance.post<ApiResponse<AiCriteriaSet>>(`${SETS}/${id}/apply`, { orgUnitId }).then(r => r.data.data),

  /** Gửi đề nghị áp tài liệu (bản nháp / đã ngừng) cho đơn vị đang áp tài liệu của cấp trên. */
  requestChange: (id: string, meta: AiCriteriaSetMeta) =>
    axiosInstance.post<ApiResponse<AiCriteriaChangeRequest>>(`${SETS}/${id}/requests`, meta).then(r => r.data.data),

  /** Nhân bản thành bản nháp cho đơn vị bị khoá rồi gửi đề nghị. */
  cloneAndRequest: (id: string, meta: AiCriteriaSetMeta) =>
    axiosInstance.post<ApiResponse<AiCriteriaChangeRequest>>(`${SETS}/${id}/clone-request`, meta).then(r => r.data.data),

  pendingRequests: () =>
    axiosInstance.get<ApiResponse<AiCriteriaChangeRequest[]>>(`${SETS}/requests/pending`).then(r => r.data.data),

  approveRequest: (requestId: string, note?: string) =>
    axiosInstance.post<ApiResponse<AiCriteriaChangeRequest>>(`${SETS}/requests/${requestId}/approve`, { note: note || null, orgUnitId: null })
      .then(r => r.data.data),

  rejectRequest: (requestId: string, note?: string) =>
    axiosInstance.post<ApiResponse<AiCriteriaChangeRequest>>(`${SETS}/requests/${requestId}/reject`, { note: note || null, orgUnitId: null })
      .then(r => r.data.data),

  cancelRequest: (requestId: string) => axiosInstance.delete(`${SETS}/requests/${requestId}`),
}

export interface AiCriteriaSetMeta {
  title?: string | null
  orgUnitId: string | null
  /** Ghi chú cho người duyệt (khi gửi đề nghị). */
  note?: string | null
}

const SELF = '/ai/self-checks'

/** Nhân viên tự nhờ AI soi bài trước khi nộp — tính vào hạn mức token của chính người dùng. */
export const aiSelfCheckApi = {
  /** Gửi bài đang soạn (chạy nền). Bài y hệt lần trước thì trả kết quả cũ, không tốn token. */
  start: (d: AiSelfCheckDraft) => {
    const form = new FormData()
    form.append('kpiCriteriaId', d.kpiCriteriaId)
    if (d.submissionId) form.append('submissionId', d.submissionId)
    if (d.actualValue != null && !Number.isNaN(d.actualValue)) form.append('actualValue', String(d.actualValue))
    if (d.qualitativeLevelId) form.append('qualitativeLevelId', d.qualitativeLevelId)
    if (d.note) form.append('note', d.note)
    d.files.forEach(f => form.append('files', f))
    return axiosInstance.post<ApiResponse<AiSelfCheck>>(SELF, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data)
  },

  get: (id: string) => axiosInstance.get<ApiResponse<AiSelfCheck>>(`${SELF}/${id}`).then(r => r.data.data),

  /** Lần soi mới nhất của mình cho một chỉ tiêu, hoặc `null`. */
  latest: (kpiCriteriaId: string) =>
    axiosInstance.get<ApiResponse<AiSelfCheck | null>>(`${SELF}/latest`, { params: { kpiCriteriaId } })
      .then(r => r.data.data),

  availability: () =>
    axiosInstance.get<ApiResponse<AiSelfCheckAvailability>>(`${SELF}/availability`).then(r => r.data.data),
}
