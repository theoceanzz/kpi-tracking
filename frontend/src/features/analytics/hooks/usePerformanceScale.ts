import { useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'

/**
 * Thang đo "hiệu suất (đánh giá)" theo cấu hình org:
 * - Org bật performance matrix (`enableQualitative`) → hiệu suất là **điểm** (1..maxScore, maxScore = ô lớn nhất
 *   trong ma trận của org, mặc định 5). Backend đã trả matrix_rating thay cho % ở các API analytics.
 * - Ngược lại → **%** như cũ.
 *
 * Đơn vị là thuộc tính cấp org (không đổi giữa các giá trị) nên chỉ cần đọc org một lần ở đây.
 */
export interface PerformanceScale {
  /** true = org dùng performance matrix ⇒ đơn vị "điểm". */
  isMatrix: boolean
  /** Thang tối đa: maxScore (matrix) hoặc 100 (%). */
  maxScore: number
  /** Nhãn đơn vị: "điểm" | "%". */
  unit: string
  /** Domain tối đa cho trục biểu đồ hiệu suất. */
  axisMax: number
  /** "3.5/5 điểm" (matrix) | "85%" (thường); "—" nếu null. */
  format: (v?: number | null) => string
  /** "3.5 điểm" | "85%" — không kèm mẫu số (dùng khi chật chỗ). */
  formatShort: (v?: number | null) => string
  /** Chuẩn hoá giá trị về thang 0..100 (= v/axisMax*100) — dùng cho ngưỡng tô màu. */
  toPct: (v?: number | null) => number
}

const round1 = (v: number) => Math.round(v * 10) / 10

export function usePerformanceScale(): PerformanceScale {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)

  return useMemo(() => {
    const isMatrix = !!org?.enableQualitative
    let maxScore = 5
    if (isMatrix && org?.performanceMatrix) {
      try {
        const m = JSON.parse(org.performanceMatrix)
        const cells: any[][] = Array.isArray(m?.cells) ? m.cells : []
        let mx = 0
        cells.forEach(row => Array.isArray(row) && row.forEach(v => { if (typeof v === 'number' && v > mx) mx = v }))
        if (mx > 0) maxScore = mx
      } catch { /* giữ mặc định 5 */ }
    }
    const format = (v?: number | null) => {
      if (v == null) return '—'
      return isMatrix ? `${round1(v)}/${maxScore} điểm` : `${round1(v)}%`
    }
    const formatShort = (v?: number | null) => {
      if (v == null) return '—'
      return isMatrix ? `${round1(v)} điểm` : `${round1(v)}%`
    }
    const axisMax = isMatrix ? maxScore : 100
    return {
      isMatrix,
      maxScore,
      unit: isMatrix ? 'điểm' : '%',
      axisMax,
      format,
      formatShort,
      toPct: (v?: number | null) => (v == null || axisMax <= 0 ? 0 : (v / axisMax) * 100),
    }
  }, [org?.enableQualitative, org?.performanceMatrix])
}
