import { useMemo } from 'react'
import { useHasPermission } from '@/components/auth/PermissionGate'

/**
 * Cấp xem thống kê của người đang đăng nhập — bản song song với
 * {@code StatsTierResolver.Tier} ở backend.
 *
 * Thứ tự xét bắt buộc là ORG → UNIT → SELF. Giám đốc KHÔNG được cấp `STATS:VIEW_MY`
 * (xem `RolePermissionConstants`), nên xét ngược lại sẽ đẩy Giám đốc xuống cấp thấp nhất.
 *
 * Đây chỉ là lớp quyết định HIỂN THỊ widget nào. Phạm vi dữ liệu thật do backend quyết định —
 * frontend không được coi là chốt chặn.
 */
export type StatsTier = 'ORG' | 'UNIT' | 'SELF'

export interface StatsTierInfo {
  tier: StatsTier | null
  /** Có quyền vào tab "Chuyên sâu" không. */
  canView: boolean
  /** Widget của cấp này có được hiển thị cho người dùng hiện tại không. */
  allows: (widgetTier: StatsTier) => boolean
}

/** Cấp cao hơn thấy được mọi widget của cấp thấp hơn. */
const RANK: Record<StatsTier, number> = { SELF: 0, UNIT: 1, ORG: 2 }

export function useStatsTier(): StatsTierInfo {
  const { hasPermission } = useHasPermission()

  const tier: StatsTier | null =
    hasPermission(['STATS:VIEW_ORG']) ? 'ORG'
    : hasPermission(['STATS:VIEW_EMPLOYEE']) ? 'UNIT'
    : hasPermission(['STATS:VIEW_MY']) ? 'SELF'
    : null

  return useMemo(() => ({
    tier,
    canView: tier !== null,
    allows: (widgetTier: StatsTier) => tier !== null && RANK[tier] >= RANK[widgetTier],
  }), [tier])
}
