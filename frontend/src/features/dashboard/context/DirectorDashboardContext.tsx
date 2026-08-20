import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOverviewStats } from '../hooks/useOverviewStats'
import { useOrgUnitStats } from '../hooks/useOrgUnitStats'
import { useEmployeeStats } from '../hooks/useEmployeeStats'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { evaluationApi } from '@/features/evaluations/api/evaluationApi'
import { useSummaryStats } from '@/features/analytics/hooks/useAnalytics'
import { useAuthStore } from '@/store/authStore'
import { useNow } from '../hooks/useNow'
import { buildDashboardAlerts, type DashboardAlert } from '../utils/dashboardAlerts'
import type { AnalyticsSummary, EmployeeKpiStats, OrgUnitStats, OverviewStats } from '@/types/stats'
import type { OrganizationResponse } from '@/features/orgunits/api/organizationApi'

export const EMP_PAGE_SIZE = 10

interface DirectorDashboardValue {
  organization?: OrganizationResponse
  stats?: OverviewStats
  orgUnitStats?: OrgUnitStats[]
  isLoading: boolean

  empPage: number
  setEmpPage: (p: number) => void
  empSearch: string
  setEmpSearch: (s: string) => void
  orgUnitFilter: string
  setOrgUnitFilter: (id: string) => void

  employees: EmployeeKpiStats[]
  allEmployees: EmployeeKpiStats[]
  filteredEmployees: EmployeeKpiStats[]
  filteredOrgUnits: OrgUnitStats[]
  totalEmployeePages: number
  totalEmployees: number
  isEmployeesLoading: boolean

  activePeriod: { id: string; name: string; startDate?: string | null; endDate?: string | null } | null
  daysRemaining: number | null
  periodEvaluationCount: number
  kpiParticipantCount: number
  pendingEvaluationCount: number | null
  cumulativeEvaluations: { label: string; detail: string | null } | null

  companyWeightedAvg: number
  groupRates: Record<string, { userId: string; empName: string; rate: number }[]>
  unitAverageScores: Record<string, number>
  criticalAlerts: DashboardAlert[]

  /** Tổng hợp toàn tổ chức: xu hướng theo kỳ, tỷ lệ quá hạn, xếp hạng. */
  summary?: AnalyticsSummary
  isSummaryLoading: boolean

  /** Người đang được mở modal chi tiết hiệu suất. */
  evaluatingUser: { id: string; name: string } | null
  setEvaluatingUser: (u: { id: string; name: string } | null) => void
}

const DirectorDashboardContext = createContext<DirectorDashboardValue | null>(null)

/** Gom toàn bộ truy vấn + phép tổng hợp của dashboard giám đốc. Phạm vi: toàn tổ chức. */
export function DirectorDashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const now = useNow()
  const [empPage, setEmpPage] = useState(0)
  const [empSearch, setEmpSearch] = useState('')
  const [selectedUnit, setOrgUnitFilter] = useState<string | null>(user?.memberships?.[0]?.orgUnitId ?? null)
  const [evaluatingUser, setEvaluatingUser] = useState<{ id: string; name: string } | null>(null)

  const organizationId = user?.memberships?.[0]?.organizationId

  const { data: organization } = useOrganization(organizationId)
  const { data: stats, isLoading: loadingStats } = useOverviewStats()
  const { data: orgUnitStats, isLoading: loadingOrgUnits } = useOrgUnitStats()
  const { data: periodsData } = useKpiPeriods({ organizationId })
  const { data: summary, isLoading: isSummaryLoading } = useSummaryStats()

  // Chưa chọn gì thì nhìn từ đơn vị gốc. Suy ra thay vì setState trong effect để tránh render thừa
  // và tránh trạng thái trung gian 'ALL' lọt xuống các truy vấn bên dưới.
  const orgUnitFilter = selectedUnit
    ?? orgUnitStats?.find(u => u.parentOrgUnitId === null)?.orgUnitId
    ?? 'ALL'
  const scopedUnit = orgUnitFilter !== 'ALL' ? orgUnitFilter : undefined

  const { data: empStats, isLoading: isEmployeesLoading } = useEmployeeStats(empPage, EMP_PAGE_SIZE, scopedUnit)
  const { data: allEmpStats } = useEmployeeStats(0, 500, scopedUnit)

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

  // Phiếu đánh giá của RIÊNG kỳ đang chạy — stats.totalEvaluations là lũy kế mọi kỳ nên dễ hiểu nhầm
  const { data: periodEvaluations } = useQuery({
    queryKey: ['evaluations', 'count', activePeriod?.id, orgUnitFilter],
    queryFn: () => evaluationApi.getAll({
      page: 0, size: 1,
      kpiPeriodId: activePeriod!.id,
      orgUnitId: scopedUnit,
    }),
    enabled: !!activePeriod?.id,
  })

  const value = useMemo<DirectorDashboardValue>(() => {
    const allEmployees = allEmpStats?.content ?? []
    const employees = empStats?.content ?? []
    const pool = allEmployees.length ? allEmployees : employees

    // Nhân sự thực sự được giao KPI — mẫu số của tiến độ chấm điểm
    const kpiParticipantCount = allEmployees.filter(e => e.assignedKpi > 0).length
    const periodEvaluationCount = periodEvaluations?.totalElements ?? 0

    // Điểm hoàn thành bình quân: trung bình theo đơn vị để đơn vị đông người không lấn át
    const groupRates: Record<string, { userId: string; empName: string; rate: number }[]> = {}
    pool.forEach(e => {
      if (e.assignedKpi <= 0) return
      const unitName = (e.orgUnitName || 'Chưa gán').trim()
      if (!groupRates[unitName]) groupRates[unitName] = []
      groupRates[unitName].push({
        userId: e.userId, empName: e.fullName,
        rate: e.approvedSubmissions / (e.assignedKpi || 1),
      })
    })
    const deptScores = Object.values(groupRates).map(m => m.reduce((a, b) => a + b.rate, 0) / m.length)
    const companyWeightedAvg = deptScores.length === 0
      ? 0
      : Math.round((deptScores.reduce((a, b) => a + b, 0) / deptScores.length) * 100)

    const unitTotals: Record<string, number> = {}
    allEmployees.forEach(emp => {
      const name = (emp.orgUnitName || 'Chưa gán').trim()
      const rate = emp.assignedKpi > 0 ? (emp.approvedSubmissions / emp.assignedKpi) * 100 : 0
      unitTotals[name] = (unitTotals[name] || 0) + rate
    })
    const unitAverageScores: Record<string, number> = {}
    orgUnitStats?.forEach(unit => {
      const name = (unit.orgUnitName || 'Chưa gán').trim()
      unitAverageScores[name] = (unitTotals[name] || 0) / (unit.memberCount || 1)
    })

    const periods = stats?.evaluationPeriods ?? []
    const totalEvaluations = stats?.totalEvaluations ?? 0
    const scopeLabel = periods.length === 1
      ? `ở đợt ${periods[0]?.kpiPeriodName}`
      : periods.length > 1 ? `qua ${periods.length} đợt` : null

    const search = empSearch.toLowerCase()

    return {
      organization, stats, orgUnitStats,
      isLoading: loadingStats || loadingOrgUnits || isEmployeesLoading,
      empPage, setEmpPage, empSearch, setEmpSearch, orgUnitFilter, setOrgUnitFilter,
      employees, allEmployees,
      filteredEmployees: employees.filter(e =>
        (e.fullName || '').toLowerCase().includes(search) || (e.email || '').toLowerCase().includes(search)
      ),
      // Bỏ chính đơn vị đang chọn khỏi lưới đơn vị con
      filteredOrgUnits: (orgUnitStats ?? []).filter(ou =>
        ou.totalAssignments > 0 && (orgUnitFilter === 'ALL' || ou.orgUnitId !== orgUnitFilter)
      ),
      totalEmployeePages: empStats?.totalPages ?? 1,
      totalEmployees: empStats?.totalElements ?? 0,
      isEmployeesLoading,
      activePeriod, daysRemaining,
      periodEvaluationCount, kpiParticipantCount,
      pendingEvaluationCount: activePeriod
        ? Math.max(0, kpiParticipantCount - periodEvaluationCount)
        : null,
      cumulativeEvaluations: totalEvaluations === 0 ? null : {
        label: `Lũy kế: ${totalEvaluations} đánh giá${scopeLabel ? ` ${scopeLabel}` : ''}`,
        detail: periods.length > 1
          ? periods.map(p => `${p.kpiPeriodName}: ${p.count} đánh giá`).join('\n')
          : null,
      },
      summary, isSummaryLoading,
      companyWeightedAvg, groupRates, unitAverageScores,
      criticalAlerts: buildDashboardAlerts({
        stats,
        orgUnits: orgUnitStats,
        employees: pool,
        daysRemaining,
        lowScoreThreshold: (organization?.evaluationMaxScore ?? 100) * 0.6,
      }),
      evaluatingUser, setEvaluatingUser,
    }
  }, [
    organization, stats, orgUnitStats, loadingStats, loadingOrgUnits, isEmployeesLoading,
    empPage, empSearch, orgUnitFilter, empStats, allEmpStats,
    activePeriod, daysRemaining, periodEvaluations, evaluatingUser, summary, isSummaryLoading,
  ])

  return <DirectorDashboardContext.Provider value={value}>{children}</DirectorDashboardContext.Provider>
}

export function useDirectorDashboard() {
  const ctx = useContext(DirectorDashboardContext)
  if (!ctx) throw new Error('useDirectorDashboard phải được dùng bên trong DirectorDashboardProvider')
  return ctx
}
