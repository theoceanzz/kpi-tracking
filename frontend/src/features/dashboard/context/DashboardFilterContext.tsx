import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAnalyticsDateFilter, type AnalyticsDateFilterValue } from '@/components/common/AnalyticsDateFilter'
import type { PinnedFilter } from '@/features/analytics/components/pinned/pinnedWidgetRegistry'

/**
 * Bộ lọc thời gian của trang chủ — bản sao đúng cơ chế của trang Phân tích.
 *
 * <p>Bên Phân tích mỗi tab có một bộ lọc riêng điều khiển mọi biểu đồ TRONG tab đó. Trang chủ
 * trộn widget của nhiều tab vào một lưới, nên giữ đúng hai phạm vi đó thay vì gộp làm một:
 * `personal` lái các widget "của tôi", `unit` lái các widget cấp đơn vị. Gộp chung một bộ lọc
 * thì đổi kỳ cho biểu đồ đơn vị sẽ kéo theo cả biểu đồ cá nhân — không phải điều người dùng
 * quen ở trang Phân tích.
 *
 * <p>Widget "Bộ lọc" chỉ là mặt hiển thị của state này; state sống ở provider nên gỡ widget
 * lọc khỏi lưới cũng không làm các widget khác mất bộ lọc (chúng rơi về mặc định của tab).
 */
export type FilterScope = 'personal' | 'unit'

interface FilterEntry extends AnalyticsDateFilterValue {
  controls: ReactNode
}

interface DashboardFilterValue extends Record<FilterScope, FilterEntry> {
  /**
   * Đơn vị đang xem, dùng chung cho các widget của tab "Phân cấp" và tab "Hạng mục (BSC)".
   *
   * <p>Bên Phân cấp việc chọn đơn vị do cây bên trái đảm nhiệm; trên trang chủ vai trò đó
   * thuộc về widget "Cây đơn vị". `undefined` = gốc phạm vi quyền của người dùng, đúng như
   * khi mở tab Phân cấp mà chưa bấm vào đơn vị nào.
   */
  unitId?: string
  setUnitId: (id?: string) => void
}

const DashboardFilterContext = createContext<DashboardFilterValue | null>(null)

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const personal = useAnalyticsDateFilter({ selectClassName: 'h-9' })
  const unit = useAnalyticsDateFilter({ selectClassName: 'h-9' })
  const [unitId, setUnitId] = useState<string | undefined>(undefined)

  const value = useMemo(() => ({ personal, unit, unitId, setUnitId }), [personal, unit, unitId])
  return <DashboardFilterContext.Provider value={value}>{children}</DashboardFilterContext.Provider>
}

function useCtx(): DashboardFilterValue {
  const ctx = useContext(DashboardFilterContext)
  if (!ctx) throw new Error('useDashboardFilter phải được dùng bên trong DashboardFilterProvider')
  return ctx
}

export function useDashboardFilter(scope: FilterScope): FilterEntry {
  return useCtx()[scope]
}

/** Đơn vị đang xem + hàm đổi, cho các widget của Phân cấp và BSC. */
export function useDashboardUnit() {
  const ctx = useCtx()
  return { unitId: ctx.unitId, setUnitId: ctx.setUnitId }
}

/** Đổi sang dạng `PinnedFilter` mà các widget trong PINNED_REGISTRY nhận. */
export function useDashboardPinnedFilter(scope: FilterScope): PinnedFilter {
  const f = useDashboardFilter(scope)
  return useMemo(() => ({
    from: f.from,
    to: f.to,
    periodId: f.periodId,
    periodIdTo: f.periodIdTo,
    groupBy: f.groupBy,
    onlyApproved: false,
  }), [f.from, f.to, f.periodId, f.periodIdTo, f.groupBy])
}
