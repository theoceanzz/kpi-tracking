import { QueryClient } from '@tanstack/react-query'

/**
 * Thử lại MỘT lần với lỗi mạng / 5xx; KHÔNG thử lại lỗi 4xx (401/403/404/422…) — gọi lại vẫn ra đúng lỗi
 * đó, chỉ nhân đôi request (log prod từng có ~30 lần 403 cây đơn vị trong 36 giây vì vậy).
 * 401 đã có interceptor axios lo làm mới phiên.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  if (status != null && status >= 400 && status < 500) return false
  return failureCount < 1
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: shouldRetryQuery,
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
