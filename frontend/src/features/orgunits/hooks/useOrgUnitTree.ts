import { useQuery } from '@tanstack/react-query'
import { orgUnitApi } from '../api/orgUnitApi'
import { useAuthStore } from '@/store/authStore'

/**
 * Cây đơn vị của tổ chức. Mặc định `staleTime: 0` (trang quản lý đơn vị muốn thấy ngay sau khi
 * sửa); màn chỉ ĐỌC cây (bộ chọn đơn vị, cây điều hướng ở Thống kê) truyền `staleTime` lớn hơn để
 * mỗi lần mở tab không tốn thêm một request cho thứ hiếm khi đổi.
 */
export function useOrgUnitTree(opts?: { staleTime?: number }) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['orgUnits', 'tree', organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error('No organization ID found')
      return orgUnitApi.getTree(organizationId)
    },
    enabled: !!organizationId,
    staleTime: opts?.staleTime ?? 0,
  })
}

export function useOrgUnitSubtree(unitId: string | null) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['orgUnits', 'subtree', organizationId, unitId],
    queryFn: () => {
      if (!organizationId) throw new Error('No organization ID found')
      return orgUnitApi.getSubtree(organizationId, unitId!)
    },
    enabled: !!organizationId && !!unitId,
    staleTime: 0,
  })
}
