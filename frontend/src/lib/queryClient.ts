import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

/**
 * Invalidate mọi query PHÁI SINH từ cấu hình tổ chức: bản thân org + các nhóm THỐNG KÊ.
 * Dùng sau khi lưu config công ty (thang điểm/ma trận/định tính/xếp loại đơn vị…) để trang Thống kê
 * không giữ state cũ (do staleTime 5 phút, query thống kê dùng prefix riêng nên không tự refetch).
 */
export function invalidateOrgDerived(qc: QueryClient) {
  const prefixes = [
    'organization', 'hierarchyLevels', 'hierarchy-levels', 'orgUnits', 'organization-users', 'roles',
    'stats', 'analytics', 'orgUnitKpi', 'personalKpi', 'personalObjective', 'pinned', 'scoped-combo',
    'detail-filter-units',
  ]
  prefixes.forEach(k => qc.invalidateQueries({ queryKey: [k] }))
}
