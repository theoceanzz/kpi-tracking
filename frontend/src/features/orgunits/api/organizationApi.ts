import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

export interface HierarchyLevel {
  id?: string
  levelOrder: number
  unitTypeName: string
  managerRoleLabel: string
  roleLevel: number
}

export interface EvaluationLevel {
  id?: string
  name: string
  threshold: number
  color?: string
}

export interface QualitativeLevel {
  id?: string
  name: string
  value: number
  position: number
  /** Mức này tương đương bao nhiêu % hoàn thành khi tính điểm BSC (0..100) */
  scorePercent?: number | null
  color?: string
}

export interface PerformanceMatrix {
  rowHeader?: string
  colHeader?: string
  rows: string[]
  cols: string[]
  cells: number[][]
}

// ── Xếp loại ĐƠN VỊ theo phân bố % xếp loại thành viên ──────────────────────
export type UnitClassScope = 'this' | 'orAbove' | 'orBelow'
export type UnitClassOp = 'gte' | 'lte' | 'gt' | 'lt' | 'eq'

export interface UnitClassCondition {
  level: string          // tên mức thành viên
  scope: UnitClassScope  // đúng mức / trở lên / trở xuống
  op: UnitClassOp
  percent: number        // 0..100
}
export interface UnitClassRule {
  levelName: string
  color: string
  conditions: UnitClassCondition[]
}
/** Một HỒ SƠ luật xếp loại: gán cho (các) đơn vị. Đơn vị con kế thừa hồ sơ của cha. */
export interface UnitClassProfile {
  name: string
  isDefault?: boolean       // đúng 1 hồ sơ mặc định — áp cho đơn vị không được gán
  orgUnitIds: string[]      // đơn vị áp dụng (rỗng nếu là mặc định)
  rules: UnitClassRule[]    // cao → thấp (ưu tiên)
}
export interface UnitClassificationRules {
  profiles?: UnitClassProfile[]  // hình dạng mới
  rules?: UnitClassRule[]        // hình dạng cũ (tương thích ngược) — 1 bộ luật cho cả org
}

/** Preset khi KHÔNG dùng matrix (thang XUẤT SẮC/TỐT/KHÁ/TRUNG BÌNH/YẾU). Khớp backend EvaluationConstants. */
export const PRESET_UNIT_RULES_SCORE: UnitClassificationRules = {
  rules: [
    { levelName: 'XUẤT SẮC', color: '#10b981', conditions: [
      { level: 'TỐT', scope: 'orAbove', op: 'gte', percent: 60 },
      { level: 'YẾU', scope: 'this', op: 'lte', percent: 5 } ] },
    { levelName: 'TỐT', color: '#3b82f6', conditions: [
      { level: 'KHÁ', scope: 'orAbove', op: 'gte', percent: 70 },
      { level: 'YẾU', scope: 'this', op: 'lte', percent: 10 } ] },
    { levelName: 'KHÁ', color: '#f59e0b', conditions: [
      { level: 'TRUNG BÌNH', scope: 'orAbove', op: 'gte', percent: 70 } ] },
    { levelName: 'TRUNG BÌNH', color: '#6366f1', conditions: [
      { level: 'YẾU', scope: 'this', op: 'lte', percent: 40 } ] },
    { levelName: 'YẾU', color: '#ef4444', conditions: [] },
  ],
}

/** Preset khi CÓ matrix (thang định tính KÉM/YẾU/TRUNG BÌNH/KHÁ/TỐT). */
export const PRESET_UNIT_RULES_MATRIX: UnitClassificationRules = {
  rules: [
    { levelName: 'TỐT', color: '#10b981', conditions: [
      { level: 'KHÁ', scope: 'orAbove', op: 'gte', percent: 60 },
      { level: 'YẾU', scope: 'orBelow', op: 'lte', percent: 5 } ] },
    { levelName: 'KHÁ', color: '#3b82f6', conditions: [
      { level: 'TRUNG BÌNH', scope: 'orAbove', op: 'gte', percent: 70 },
      { level: 'KÉM', scope: 'this', op: 'lte', percent: 10 } ] },
    { levelName: 'TRUNG BÌNH', color: '#6366f1', conditions: [
      { level: 'TRUNG BÌNH', scope: 'orAbove', op: 'gte', percent: 50 } ] },
    { levelName: 'YẾU', color: '#f59e0b', conditions: [
      { level: 'KÉM', scope: 'this', op: 'lte', percent: 40 } ] },
    { levelName: 'KÉM', color: '#ef4444', conditions: [] },
  ],
}

export interface OrganizationResponse {
  id: string
  name: string
  code: string
  status: string
  hierarchyLevels: HierarchyLevel[]
  evaluationMaxScore: number
  evaluationLevels?: EvaluationLevel[]
  qualitativeLevels?: QualitativeLevel[]
  performanceMatrix?: string
  unitClassificationRules?: string
  kpiReminderPercentage: number
  enableOkr: boolean
  enableWaterfall: boolean
  enableAi: boolean
  enableQualitative: boolean
  enableBsc: boolean
  enableReward: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateOrganizationRequest {
  name?: string
  code?: string
  status?: string
  hierarchyLevels?: Omit<HierarchyLevel, 'id' | 'levelOrder'>[]
  evaluationMaxScore?: number
  evaluationLevels?: EvaluationLevel[]
  qualitativeLevels?: QualitativeLevel[]
  performanceMatrix?: string
  unitClassificationRules?: string
  kpiReminderPercentage?: number
  enableOkr?: boolean
  enableWaterfall?: boolean
  enableQualitative?: boolean
  enableBsc?: boolean
  enableReward?: boolean
}

export const organizationApi = {
  getById: (id: string) => 
    axiosInstance.get<ApiResponse<OrganizationResponse>>(`/organizations/${id}`).then(r => r.data.data),
  
  update: (id: string, data: UpdateOrganizationRequest) =>
    axiosInstance.put<ApiResponse<OrganizationResponse>>(`/organizations/${id}`, data).then(r => r.data.data)
}
