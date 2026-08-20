import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '@/features/kpi/api/kpiApi'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'
import { useNow } from '../hooks/useNow'
import type { KpiCriteria } from '@/types/kpi'
import type { OrganizationResponse } from '@/features/orgunits/api/organizationApi'

/** Một người trong mảng Phó phụ trách, suy từ danh sách đồng phụ trách của các KPI. */
export interface ScopeMember {
  userId: string
  fullName: string
  avatarUrl: string | null
  /** Số KPI trong mảng mà người này cùng đảm nhiệm. */
  kpiCount: number
}

interface DeputyDashboardValue {
  unitName: string
  roleLabel: string
  organization?: OrganizationResponse

  /** KPI mà Phó được giao đảm nhiệm — đây chính là "mảng phụ trách". */
  scopeKpis: KpiCriteria[]
  isScopeLoading: boolean
  /** Người cùng đảm nhiệm các KPI đó, không tính chính mình. */
  scopeMembers: ScopeMember[]

  /**
   * Phó có thực sự là người duyệt cuối ở đâu đó không. Quyết định widget hiện dạng
   * hành động hay chỉ theo dõi.
   */
  isApprover: boolean
  canApproveReward: boolean

  activePeriod: { id: string; name: string; startDate?: string | null; endDate?: string | null } | null
  daysRemaining: number | null
}

const DeputyDashboardContext = createContext<DeputyDashboardValue | null>(null)

/**
 * Phạm vi của Phó đơn vị.
 *
 * <p>Khác trưởng đơn vị ở chỗ KHÔNG lấy toàn bộ đơn vị: Phó chỉ phụ trách một mảng, và
 * mảng đó được xác định qua các KPI mà Phó được giao đảm nhiệm (`kpi_criteria_assignees`).
 * Danh sách người trong mảng suy ra từ những ai cùng đảm nhiệm các KPI ấy — dùng luôn
 * `assignees` mà API KPI đã trả kèm, không cần thêm truy vấn.
 */
export function DeputyDashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const now = useNow()

  const primaryMembership = useMemo(() => {
    const ms = user?.memberships ?? []
    if (ms.length <= 1) return ms[0]
    return ms.find(m => m.roleRank === 1) ?? ms[0]
  }, [user?.memberships])

  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: organization } = useOrganization(organizationId)
  const { data: periodsData } = useKpiPeriods({ organizationId })

  const { data: kpiPage, isLoading: isScopeLoading } = useQuery({
    queryKey: ['kpi-criteria', 'deputy-scope', user?.id],
    queryFn: () => kpiApi.getAll({ assigneeId: user!.id, page: 0, size: 200 }),
    enabled: !!user?.id,
  })

  const activePeriod = useMemo(() => {
    if (!periodsData?.content) return null
    const nowDate = new Date(now)
    return periodsData.content.find(p => {
      if (!p.startDate || !p.endDate) return false
      return nowDate >= new Date(p.startDate) && nowDate <= new Date(p.endDate)
    }) ?? null
  }, [periodsData, now])

  const value = useMemo<DeputyDashboardValue>(() => {
    const scopeKpis = kpiPage?.content ?? []

    // Gộp người đảm nhiệm của mọi KPI trong mảng; ai xuất hiện ở nhiều KPI thì cộng dồn
    const memberMap = new Map<string, ScopeMember>()
    scopeKpis.forEach(kpi => {
      (kpi.assignees ?? []).forEach(a => {
        if (!a?.id || a.id === user?.id) return
        const cur = memberMap.get(a.id)
        if (cur) { cur.kpiCount += 1; return }
        memberMap.set(a.id, {
          userId: a.id,
          fullName: a.fullName,
          avatarUrl: a.avatarUrl ?? null,
          kpiCount: 1,
        })
      })
    })

    const daysRemaining = activePeriod?.endDate
      ? Math.max(0, Math.ceil((new Date(activePeriod.endDate).getTime() - now) / 86_400_000))
      : null

    return {
      unitName: primaryMembership?.orgUnitName || 'Đơn vị',
      roleLabel: primaryMembership?.roleDisplayName || primaryMembership?.roleName || 'Phó đơn vị',
      organization,
      scopeKpis,
      isScopeLoading,
      scopeMembers: [...memberMap.values()].sort((a, b) => b.kpiCount - a.kpiCount),
      // Là người duyệt cuối ở ít nhất một KPI thì mới coi là có quyền hành động
      isApprover: scopeKpis.some(k => k.approvedById === user?.id),
      canApproveReward: (user?.permissions ?? []).includes('REWARD:APPROVE'),
      activePeriod,
      daysRemaining,
    }
  }, [kpiPage, isScopeLoading, primaryMembership, organization, activePeriod, now, user])

  return <DeputyDashboardContext.Provider value={value}>{children}</DeputyDashboardContext.Provider>
}

export function useDeputyDashboard() {
  const ctx = useContext(DeputyDashboardContext)
  if (!ctx) throw new Error('useDeputyDashboard phải được dùng bên trong DeputyDashboardProvider')
  return ctx
}
