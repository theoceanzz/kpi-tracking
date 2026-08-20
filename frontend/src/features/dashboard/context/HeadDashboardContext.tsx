import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orgUnitKpiApi, type OrgUnitKpiDetail, type OverdueKpiForUnit } from '../api/orgUnitKpiApi'
import { useOverviewStats } from '../hooks/useOverviewStats'
import { useEmployeeStats } from '../hooks/useEmployeeStats'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'
import { useNow } from '../hooks/useNow'
import type { EmployeeKpiStats, OverviewStats } from '@/types/stats'
import type { OrganizationResponse } from '@/features/orgunits/api/organizationApi'

interface HeadDashboardValue {
  orgUnitId?: string
  unitName: string
  roleLabel: string
  roleRank?: number
  levelOrder?: number
  organization?: OrganizationResponse
  stats?: OverviewStats
  isStatsLoading: boolean

  /** Trang hiện tại của bảng nhân sự (widget tự điều khiển). */
  page: number
  setPage: (p: number) => void
  employees: EmployeeKpiStats[]
  totalEmployeePages: number
  totalEmployees: number
  isEmployeesLoading: boolean

  /** Toàn bộ nhân sự trong đơn vị — dùng cho các phép tổng hợp phía client. */
  allEmployees: EmployeeKpiStats[]

  activePeriod: { id: string; name: string; startDate?: string | null; endDate?: string | null } | null
  daysRemaining: number | null

  pendingSub: number
  approvedSub: number
  rejectedSub: number
  totalSubCount: number
  approvalRate: number
  lateEmployeesCount: number

  /** Chỉ tiêu vs thực đạt của từng KPI trong đơn vị. */
  unitKpis: OrgUnitKpiDetail[]
  isUnitKpisLoading: boolean
  /** KPI đã quá hạn của đơn vị, kèm tên người chịu trách nhiệm. */
  overdueKpis: OverdueKpiForUnit[]
  isOverdueLoading: boolean
  /** Tiến độ tổng hợp của đơn vị (đang chạy / hoàn thành / rủi ro). */
  unitMetrics?: { averageProgress: number; averagePerformance: number; runningKpis: number; completedKpis: number; riskKpis: number }
}

const HeadDashboardContext = createContext<HeadDashboardValue | null>(null)

const EMPLOYEE_PAGE_SIZE = 5

/** Gom truy vấn của dashboard trưởng đơn vị. Mọi thống kê đều giới hạn trong đơn vị của họ. */
export function HeadDashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const now = useNow()
  const [page, setPage] = useState(0)

  const primaryMembership = useMemo(() => {
    const ms = user?.memberships ?? []
    if (ms.length <= 1) return ms[0]
    return ms.find(m => (m.levelOrder ?? 0) > 0) ?? ms[0]
  }, [user?.memberships])

  const orgUnitId = primaryMembership?.orgUnitId
  const organizationId = user?.memberships?.[0]?.organizationId

  const { data: organization } = useOrganization(organizationId)
  const { data: stats, isLoading: isStatsLoading } = useOverviewStats(orgUnitId)
  const { data: employeesPage, isLoading: isEmployeesLoading } = useEmployeeStats(page, EMPLOYEE_PAGE_SIZE, orgUnitId)
  const { data: allEmployeesPage } = useEmployeeStats(0, 500, orgUnitId)
  const { data: periodsData } = useKpiPeriods({ organizationId })

  const { data: unitMetrics } = useQuery({
    queryKey: ['stats', 'org-unit-kpis', 'metrics', orgUnitId],
    queryFn: () => orgUnitKpiApi.getMetrics({ orgUnitId }),
    enabled: !!orgUnitId,
  })

  // Chỉ tiêu vs thực đạt từng KPI — bảng nhân sự chỉ có số bài nộp, không có con số nghiệp vụ
  const { data: unitKpisPage, isLoading: isUnitKpisLoading } = useQuery({
    queryKey: ['stats', 'org-unit-kpis', 'details', orgUnitId],
    queryFn: () => orgUnitKpiApi.getDetailedKpis({ orgUnitId, page: 0, size: 50 }),
    enabled: !!orgUnitId,
  })

  const { data: overdueKpis, isLoading: isOverdueLoading } = useQuery({
    queryKey: ['stats', 'org-unit-kpis', 'overdue', orgUnitId],
    queryFn: () => orgUnitKpiApi.getUnitOverdueKpis(orgUnitId!),
    enabled: !!orgUnitId,
  })

  const activePeriod = useMemo(() => {
    if (!periodsData?.content) return null
    const now = new Date()
    return periodsData.content.find(p => {
      if (!p.startDate || !p.endDate) return false
      return now >= new Date(p.startDate) && now <= new Date(p.endDate)
    }) ?? null
  }, [periodsData])

  const daysRemaining = useMemo(() => {
    if (!activePeriod?.endDate) return null
    return Math.max(0, Math.ceil((new Date(activePeriod.endDate).getTime() - now) / 86_400_000))
  }, [activePeriod, now])

  const value = useMemo<HeadDashboardValue>(() => {
    const pendingSub = stats?.pendingSubmissions ?? 0
    const approvedSub = stats?.approvedSubmissions ?? 0
    const rejectedSub = stats?.rejectedSubmissions ?? 0
    const totalSubCount = pendingSub + approvedSub + rejectedSub
    const allEmployees = allEmployeesPage?.content ?? []

    return {
      orgUnitId,
      unitName: primaryMembership?.orgUnitName || 'Đơn vị',
      roleLabel: primaryMembership?.roleName || 'Quản lý',
      roleRank: primaryMembership?.roleRank,
      levelOrder: primaryMembership?.levelOrder,
      organization,
      stats,
      isStatsLoading,
      page,
      setPage,
      employees: employeesPage?.content ?? [],
      totalEmployeePages: employeesPage?.totalPages ?? 0,
      totalEmployees: employeesPage?.totalElements ?? 0,
      isEmployeesLoading,
      allEmployees,
      activePeriod,
      daysRemaining,
      pendingSub,
      approvedSub,
      rejectedSub,
      totalSubCount,
      approvalRate: totalSubCount > 0 ? Math.round((approvedSub / totalSubCount) * 100) : 0,
      // Đếm trên toàn đơn vị, không chỉ trang đang xem — bản cũ đếm theo trang nên số nhảy khi lật trang
      lateEmployeesCount: allEmployees.filter(e => e.lateSubmissions > 0).length,

      unitKpis: unitKpisPage?.content ?? [],
      isUnitKpisLoading,
      overdueKpis: overdueKpis ?? [],
      isOverdueLoading,
      unitMetrics,
    }
  }, [orgUnitId, primaryMembership, organization, stats, isStatsLoading, page, employeesPage, isEmployeesLoading, allEmployeesPage, activePeriod, daysRemaining, unitKpisPage, isUnitKpisLoading, overdueKpis, isOverdueLoading, unitMetrics])

  return <HeadDashboardContext.Provider value={value}>{children}</HeadDashboardContext.Provider>
}

export function useHeadDashboard() {
  const ctx = useContext(HeadDashboardContext)
  if (!ctx) throw new Error('useHeadDashboard phải được dùng bên trong HeadDashboardProvider')
  return ctx
}

export { EMPLOYEE_PAGE_SIZE }
