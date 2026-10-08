import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
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

/**
 * Đơn vị `unitId` (của chính mình) → cha → … → gốc. Dùng cho các trang "của tôi" xem cấp trên
 * trực thuộc: `useOrgUnitTree` chỉ trả nhánh người dùng được quyền xem, nhân viên thường không
 * thấy đơn vị cha qua đó.
 */
export function useMyUnitChain(unitId?: string | null) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const query = useQuery({
    queryKey: ['orgUnits', 'chain', organizationId, unitId],
    queryFn: () => orgUnitApi.getChain(organizationId!, unitId!),
    enabled: !!organizationId && !!unitId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const { data: tree } = useOrgUnitTree({ staleTime: 5 * 60 * 1000 })

  // API lỗi (backend cũ chưa có endpoint, mạng…) thì KHÔNG để trang trắng: dựng chuỗi từ cây đơn vị
  // người dùng được xem, tệ nhất vẫn còn đơn vị của chính mình. `parentId` lấy từ dữ liệu thật của
  // đơn vị, nên chuỗi bị cắt ngắn vẫn không đánh dấu nhầm đơn vị mình là gốc.
  const fallback = useMemo(() => {
    if (!unitId) return []
    const byId = new Map<string, OrgUnitTreeResponse>()
    const walk = (nodes: OrgUnitTreeResponse[]) => nodes.forEach(n => { byId.set(n.id, n); walk(n.children ?? []) })
    walk(tree ?? [])
    const membership = user?.memberships?.find(m => m.orgUnitId === unitId)
    const out: { id: string; name: string; parentId: string | null }[] = []
    let cur: string | null = unitId, guard = 0
    while (cur && guard++ < 100) {
      const node = byId.get(cur)
      if (!node) {
        // Ngoài nhánh được xem: chỉ biết chắc đơn vị của chính mình (qua membership).
        if (cur === unitId) out.push({ id: cur, name: membership?.orgUnitName ?? '', parentId: '' })
        break
      }
      out.push({ id: node.id, name: node.name, parentId: node.parentId })
      cur = node.parentId
    }
    return out
  }, [tree, unitId, user])

  const usable = query.data && query.data.length > 0
  return {
    data: usable ? query.data : (query.isLoading ? undefined : fallback),
    isLoading: query.isLoading,
  }
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
