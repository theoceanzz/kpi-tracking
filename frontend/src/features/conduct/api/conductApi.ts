import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

/** Phiếu hạnh kiểm chấm theo ĐỢT hay theo KỲ. */
export type ConductScope = 'PERIOD' | 'CYCLE'
export type ConductStatus = 'DRAFT' | 'SELF_SUBMITTED' | 'REVIEWED'

export interface ConductCriteria {
  id: string
  name: string
  /** Các biểu hiện cụ thể, mỗi dòng một gạch đầu dòng. */
  description?: string | null
  /** Trọng số %, tổng cả bộ = 100. */
  weight: number
  position: number
}

/**
 * MỘT bộ tiêu chí, gán cho (các) kỳ. Kỳ không được gán bộ nào thì dùng bộ `isDefault` —
 * cùng khuôn với hồ sơ luật của "xếp loại đơn vị".
 */
export interface ConductSet {
  id: string
  name: string
  isDefault: boolean
  /** Thang điểm mỗi tiêu chí của riêng bộ này (mặc định 4). */
  maxScore: number
  /** Kỳ áp dụng — luôn rỗng ở bộ mặc định, nghĩa là "mọi kỳ còn lại". */
  kpiCycleIds: string[]
  /** Tổng trọng số hiện tại — cảnh báo khi khác 100. */
  totalWeight: number
  criteria: ConductCriteria[]
}

export interface ConductConfig {
  enabled: boolean
  sets: ConductSet[]
}

/** Trường bỏ trống = giữ nguyên, nên chỉ gửi đúng phần vừa sửa. */
export interface ConductSetInput {
  name: string
  maxScore?: number | null
  kpiCycleIds?: string[] | null
  criteria?: Omit<ConductCriteria, 'id' | 'position'>[] | null
  /** Chỉ khi TẠO: chép tiêu chí từ bộ này (bỏ trống = chép bộ mặc định). */
  copyFromSetId?: string | null
}

export interface ConductItem {
  /** null khi tiêu chí gốc đã bị xoá khỏi cấu hình — phiếu vẫn giữ bản chụp. */
  criteriaId?: string | null
  name: string
  description?: string | null
  weight: number
  position: number
  selfScore?: number | null
  selfEvidence?: string | null
  managerScore?: number | null
  managerComment?: string | null
  /** Điểm đã tính đến trọng số (hai cột cuối của phiếu giấy). */
  selfWeighted?: number | null
  managerWeighted?: number | null
}

export interface ConductSheet {
  id?: string | null
  userId: string
  userName: string
  userAvatarUrl?: string | null
  scope: ConductScope
  kpiPeriodId?: string | null
  kpiCycleId?: string | null
  targetName?: string | null
  /** Bộ tiêu chí mà đợt/kỳ này dùng — hai kỳ khác bộ thì phiếu khác nhau. */
  criteriaSetId?: string | null
  criteriaSetName?: string | null
  status: ConductStatus
  maxScore: number
  selfScore?: number | null
  managerScore?: number | null
  comment?: string | null
  evaluatorName?: string | null
  selfSubmittedAt?: string | null
  evaluatedAt?: string | null
  /** Điểm dùng cho ma trận: ưu tiên điểm quản lý, chưa có thì lấy điểm tự chấm. */
  effectiveScore?: number | null
  /** Quy về trục hàng (thang hành vi 0..5) của ma trận xếp loại. */
  behaviorEquivalent?: number | null
  /** Quy về trục cột (%) của ma trận xếp loại. */
  percentEquivalent?: number | null
  items: ConductItem[]
  /** Phiếu bị khoá thì cả hai đều false — xem `locked`. */
  canScoreSelf: boolean
  canScoreManager: boolean
  /** Kỳ chứa đợt/kỳ này đã chốt ⇒ phiếu chỉ còn để xem. */
  locked?: boolean
  lockedByUnitName?: string | null
}

export interface ConductSummaryRow {
  userId: string
  userName: string
  userAvatarUrl?: string | null
  roleName?: string | null
  orgUnitId?: string | null
  orgUnitName?: string | null
  status: ConductStatus
  selfScore?: number | null
  managerScore?: number | null
  maxScore: number
}

/** Một đợt/kỳ cần chấm — dùng chung cho mọi lời gọi phiếu. */
export interface ConductTarget {
  scope: ConductScope
  periodId?: string | null
  cycleId?: string | null
}

export interface ConductScoreInput {
  criteriaId?: string | null
  position: number
  score?: number | null
  /** "Dẫn chứng" (tự đánh giá) hoặc "Nhận xét của Cán bộ quản lý". */
  note?: string | null
}

const targetParams = (t: ConductTarget) => ({
  scope: t.scope,
  ...(t.scope === 'PERIOD' ? { periodId: t.periodId } : { cycleId: t.cycleId }),
})

const targetBody = (t: ConductTarget) => ({
  scope: t.scope,
  kpiPeriodId: t.scope === 'PERIOD' ? t.periodId : null,
  kpiCycleId: t.scope === 'CYCLE' ? t.cycleId : null,
})

export const conductApi = {
  getConfig: (organizationId: string) =>
    axiosInstance
      .get<ApiResponse<ConductConfig>>(`/conduct/config/${organizationId}`)
      .then(r => r.data.data),

  // Mỗi bộ là một tài nguyên riêng: sửa bộ này không được đụng tiêu chí của bộ mà kỳ khác
  // đang chấm dở. Cả bốn lời gọi đều trả về TOÀN BỘ cấu hình để UI vẽ lại một lần.

  createSet: (organizationId: string, data: ConductSetInput) =>
    axiosInstance
      .post<ApiResponse<ConductConfig>>(`/conduct/config/${organizationId}/sets`, data)
      .then(r => r.data.data),

  updateSet: (organizationId: string, setId: string, data: ConductSetInput) =>
    axiosInstance
      .put<ApiResponse<ConductConfig>>(`/conduct/config/${organizationId}/sets/${setId}`, data)
      .then(r => r.data.data),

  deleteSet: (organizationId: string, setId: string) =>
    axiosInstance
      .delete<ApiResponse<ConductConfig>>(`/conduct/config/${organizationId}/sets/${setId}`)
      .then(r => r.data.data),

  markDefaultSet: (organizationId: string, setId: string) =>
    axiosInstance
      .post<ApiResponse<ConductConfig>>(`/conduct/config/${organizationId}/sets/${setId}/default`)
      .then(r => r.data.data),

  resetSet: (organizationId: string, setId?: string) =>
    axiosInstance
      .post<ApiResponse<ConductConfig>>(`/conduct/config/${organizationId}/reset`, null, {
        params: setId ? { setId } : undefined,
      })
      .then(r => r.data.data),

  getSheet: (target: ConductTarget, userId?: string) =>
    axiosInstance
      .get<ApiResponse<ConductSheet>>('/conduct/sheet', {
        params: { ...targetParams(target), ...(userId ? { userId } : {}) },
      })
      .then(r => r.data.data),

  saveSelf: (target: ConductTarget, items: ConductScoreInput[]) =>
    axiosInstance
      .put<ApiResponse<ConductSheet>>('/conduct/sheet/self', { ...targetBody(target), items })
      .then(r => r.data.data),

  saveManager: (target: ConductTarget, userId: string, items: ConductScoreInput[], comment?: string | null) =>
    axiosInstance
      .put<ApiResponse<ConductSheet>>('/conduct/sheet/manager', { ...targetBody(target), userId, items, comment })
      .then(r => r.data.data),

  getSummary: (target: ConductTarget, orgUnitId: string) =>
    axiosInstance
      .get<ApiResponse<ConductSummaryRow[]>>('/conduct/summary', {
        params: { ...targetParams(target), orgUnitId },
      })
      .then(r => r.data.data),
}
