import { useMemo } from 'react'
import { useOverviewStats } from './useOverviewStats'
import { useOrgUnitStats } from './useOrgUnitStats'
import { useEmployeeStats } from './useEmployeeStats'
import { useMyKpiProgress } from './useMyKpiProgress'
import { buildDashboardAlerts, type DashboardAlert } from '../utils/dashboardAlerts'
import type { DashboardScope } from '../api/dashboardLayoutApi'

interface Options {
  /** Đơn vị của người dùng — bắt buộc với scope HEAD. */
  orgUnitId?: string
  /** Số ngày còn lại của kỳ đang mở. */
  daysRemaining: number | null
  /** Điểm trung bình dưới ngưỡng này bị coi là hiệu suất thấp. */
  lowScoreThreshold?: number
}

export interface ScopedAlerts {
  alerts: DashboardAlert[]
  /** Nguồn DUY NHẤT cho chip "N việc khẩn" ở header. */
  urgentCount: number
  isLoading: boolean
}

/**
 * Cảnh báo đã giới hạn đúng phạm vi của từng vai trò.
 *
 * `buildDashboardAlerts` là hàm thuần — nó tính trên đúng dữ liệu được truyền vào và KHÔNG tự
 * biết phạm vi. Trước đây caller duy nhất là giám đốc nên mọi hook đều gọi không tham số (toàn
 * tổ chức). Dùng lại nguyên si cho trưởng đơn vị / nhân viên sẽ ra số sai và lộ dữ liệu đơn vị
 * khác, nên toàn bộ việc giới hạn phạm vi tập trung tại đây.
 *
 * Khác biệt theo vai trò:
 * - DIRECTOR: toàn tổ chức, đủ ba loại cảnh báo (giữ nguyên hành vi cũ).
 * - HEAD: chỉ đơn vị mình — cảnh báo phê duyệt + nhân sự. KHÔNG có cảnh báo cấp đơn vị con:
 *   `/stats/org-units` đòi quyền ORG:VIEW và luôn trả toàn tổ chức, còn `/stats/drill-down`
 *   tuy đúng phạm vi nhưng thiếu `totalAssignments` — mẫu số mà cảnh báo đơn vị cần. Thà không
 *   hiện còn hơn hiện một tỷ lệ sai nghĩa.
 * - STAFF: chỉ việc của chính mình, không đi qua `buildDashboardAlerts`.
 */
export function useScopedAlerts(scope: DashboardScope, opts: Options): ScopedAlerts {
  const isDirector = scope === 'DIRECTOR'
  const isHead = scope === 'HEAD'
  const isStaff = scope === 'STAFF'

  const scopedUnitId = isHead ? opts.orgUnitId : undefined

  // Nhân viên thường không có DASHBOARD:VIEW / USER:VIEW_LIST → tắt hẳn thay vì bắn request 403.
  const { data: stats, isLoading: loadingStats } = useOverviewStats(scopedUnitId, { enabled: !isStaff })
  const { data: employees, isLoading: loadingEmps } = useEmployeeStats(0, 500, scopedUnitId, { enabled: !isStaff })

  // Chỉ giám đốc gọi endpoint này — nó đòi quyền ORG:VIEW và luôn trả toàn tổ chức.
  const { data: allOrgUnits, isLoading: loadingUnits } = useOrgUnitStats({ enabled: isDirector })

  // Nhân viên chỉ quan tâm việc của chính mình.
  const { data: myProgress, isLoading: loadingMine } = useMyKpiProgress(0, 100, { enabled: isStaff })

  const alerts = useMemo<DashboardAlert[]>(() => {
    if (isStaff) return []
    if (isHead && !scopedUnitId) return []
    return buildDashboardAlerts({
      stats,
      orgUnits: isDirector ? allOrgUnits : undefined,
      employees: employees?.content,
      daysRemaining: opts.daysRemaining,
      lowScoreThreshold: opts.lowScoreThreshold,
    })
  }, [isStaff, isHead, isDirector, scopedUnitId, stats, allOrgUnits, employees, opts.daysRemaining, opts.lowScoreThreshold])

  /**
   * Nhân viên: đếm việc trễ của chính mình. Cảnh báo APPROVAL ("KPI chờ bạn duyệt") và
   * ORG_UNIT vô nghĩa với người không có quyền duyệt nên không xuất hiện ở đây.
   */
  const staffUrgentCount = useMemo(() => {
    if (!isStaff || !myProgress) return 0
    const overdueTasks = (myProgress.tasks?.content ?? []).filter(t => t.status === 'OVERDUE').length
    return (myProgress.lateSubmissions ?? 0) + overdueTasks
  }, [isStaff, myProgress])

  const urgentCount = isStaff
    ? staffUrgentCount
    : alerts.filter(a => a.severity === 'URGENT').length

  const isLoading = isStaff
    ? loadingMine
    : loadingStats || loadingEmps || (isDirector && loadingUnits)

  return { alerts, urgentCount, isLoading }
}
