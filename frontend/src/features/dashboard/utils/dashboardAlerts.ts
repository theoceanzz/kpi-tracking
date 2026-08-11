import type { EmployeeKpiStats, OrgUnitStats, OverviewStats } from '@/types/stats'

export type AlertSeverity = 'URGENT' | 'REVIEW' | 'MONITOR'
export type AlertKind = 'APPROVAL' | 'ORG_UNIT' | 'EMPLOYEE'

export interface AlertMetric {
  label: string
  value: string
}

export interface DashboardAlert {
  id: string
  severity: AlertSeverity
  kind: AlertKind
  /** Dòng chính để đọc lướt: tên nhân sự / đơn vị / nhóm việc */
  title: string
  /** Dòng phụ: đơn vị, ngữ cảnh */
  subtitle: string
  /** Câu mô tả ngắn nói rõ vấn đề */
  description: string
  /** Các lý do cụ thể, hiển thị dạng chip để nắm nhanh */
  reasons: string[]
  /** Số liệu kèm theo, hiển thị bên phải */
  metrics: AlertMetric[]
  /** 0-100, null nếu không áp dụng */
  progress: number | null
  /** Trang chi tiết đầy đủ */
  link?: string
  /** Có thì bấm vào mở modal hiệu suất chi tiết của nhân sự */
  employee?: { userId: string; fullName: string }
  /** Dùng để sắp xếp trong cùng một mức ưu tiên (càng lớn càng lên trên) */
  weight: number
}

export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  URGENT: 0,
  REVIEW: 1,
  MONITOR: 2,
}

export const SEVERITY_META: Record<AlertSeverity, { label: string; hint: string }> = {
  URGENT: { label: 'Cần gấp', hint: 'Xử lý ngay trong hôm nay' },
  REVIEW: { label: 'Cần xem xét', hint: 'Nên xử lý trong tuần' },
  MONITOR: { label: 'Theo dõi', hint: 'Chưa nghiêm trọng, cần quan sát' },
}

const worst = (a: AlertSeverity, b: AlertSeverity): AlertSeverity =>
  SEVERITY_ORDER[a] <= SEVERITY_ORDER[b] ? a : b

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

export interface BuildAlertsInput {
  stats?: OverviewStats
  orgUnits?: OrgUnitStats[]
  employees?: EmployeeKpiStats[]
  /** Số ngày còn lại của kỳ đang mở, null nếu không xác định */
  daysRemaining: number | null
  /** Điểm trung bình dưới ngưỡng này bị coi là hiệu suất thấp */
  lowScoreThreshold?: number
}

/**
 * Tổng hợp toàn bộ tín hiệu tiêu cực của tổ chức thành một danh sách cảnh báo
 * đã được xếp hạng ưu tiên. Mỗi nhân sự chỉ sinh ra một cảnh báo duy nhất,
 * gom tất cả lý do lại để giám đốc đọc lướt không bị trùng lặp.
 */
export function buildDashboardAlerts({
  stats,
  orgUnits,
  employees,
  daysRemaining,
  lowScoreThreshold,
}: BuildAlertsInput): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const deadlineNear = daysRemaining !== null && daysRemaining <= 7
  const deadlineNote = daysRemaining !== null ? `còn ${daysRemaining} ngày là hết kỳ` : 'kỳ chưa xác định hạn'

  // ----- Hàng chờ phê duyệt của chính giám đốc -----
  if (stats?.pendingKpi && stats.pendingKpi > 0) {
    alerts.push({
      id: 'approval-kpi',
      severity: deadlineNear || stats.pendingKpi >= 10 ? 'URGENT' : 'REVIEW',
      kind: 'APPROVAL',
      title: `${stats.pendingKpi} chỉ tiêu KPI đang chờ bạn duyệt`,
      subtitle: 'Hàng chờ phê duyệt',
      description: `Nhân sự chưa thể bắt đầu thực hiện cho tới khi chỉ tiêu được duyệt (${deadlineNote}).`,
      reasons: ['Chặn tiến độ toàn công ty'],
      metrics: [
        { label: 'Chờ duyệt', value: `${stats.pendingKpi}` },
        { label: 'Đã duyệt', value: `${stats.approvedKpi ?? 0}` },
      ],
      progress: pct(stats.approvedKpi ?? 0, stats.totalKpiCriteria ?? 0),
      link: '/kpi-criteria/pending',
      weight: 10_000 + stats.pendingKpi,
    })
  }

  if (stats?.pendingSubmissions && stats.pendingSubmissions > 0) {
    alerts.push({
      id: 'approval-submission',
      severity: deadlineNear ? 'URGENT' : 'REVIEW',
      kind: 'APPROVAL',
      title: `${stats.pendingSubmissions} bài nộp chờ đánh giá`,
      subtitle: 'Hàng chờ đánh giá',
      description: `Bài nộp đã có kết quả nhưng chưa được chấm điểm (${deadlineNote}).`,
      reasons: ['Nhân sự chưa được ghi nhận điểm'],
      metrics: [
        { label: 'Chờ đánh giá', value: `${stats.pendingSubmissions}` },
        { label: 'Từ chối', value: `${stats.rejectedSubmissions ?? 0}` },
      ],
      progress: pct(stats.approvedSubmissions ?? 0, stats.totalSubmissions ?? 0),
      link: '/submissions/org-unit',
      weight: 9_000 + stats.pendingSubmissions,
    })
  }

  // ----- Đơn vị tụt tiến độ -----
  ;(orgUnits ?? []).forEach(unit => {
    if (unit.totalAssignments <= 0) return
    const rate = pct(unit.totalSubmissions, unit.totalAssignments)
    if (rate >= 60) return

    const reasons = [`Mới đạt ${rate}% chỉ tiêu được giao`]
    if (unit.totalSubmissions === 0) reasons.push('Chưa có bài nộp nào trong kỳ')
    if (unit.rejectedSubmissions > 0) reasons.push(`${unit.rejectedSubmissions} bài bị từ chối`)
    if (unit.pendingSubmissions > 0) reasons.push(`${unit.pendingSubmissions} bài đang chờ duyệt`)

    alerts.push({
      id: `unit-${unit.orgUnitId}`,
      severity: rate < 30 ? 'URGENT' : 'REVIEW',
      kind: 'ORG_UNIT',
      title: unit.orgUnitName,
      subtitle: `${unit.memberCount} nhân sự`,
      description: `Đơn vị đang chậm tiến độ nộp KPI, ${deadlineNote}.`,
      reasons,
      metrics: [
        { label: 'Tiến độ', value: `${rate}%` },
        { label: 'Đã nộp', value: `${unit.totalSubmissions}/${unit.totalAssignments}` },
        { label: 'Đã duyệt', value: `${unit.approvedSubmissions}` },
      ],
      progress: rate,
      link: `/org-units/${unit.orgUnitId}`,
      weight: 5_000 + (100 - rate) * 10 + unit.memberCount,
    })
  })

  // ----- Nhân sự có vấn đề (gom mọi lý do vào một dòng) -----
  ;(employees ?? []).forEach(emp => {
    if (emp.assignedKpi <= 0) return

    const completion = pct(emp.approvedSubmissions, emp.assignedKpi)
    const remaining = Math.max(0, emp.assignedKpi - emp.approvedSubmissions)
    const reasons: string[] = []
    let severity: AlertSeverity | null = null

    if (emp.lateSubmissions > 0) {
      reasons.push(`Chậm deadline ${emp.lateSubmissions} bài nộp`)
      severity = 'URGENT'
    }

    if (emp.totalSubmissions === 0) {
      reasons.push('Chưa nộp bài nào trong kỳ')
      severity = worst(severity ?? 'REVIEW', deadlineNear ? 'URGENT' : 'REVIEW')
    } else if (remaining > 0) {
      reasons.push(`Còn ${remaining}/${emp.assignedKpi} KPI chưa hoàn thành`)
      const gapSeverity: AlertSeverity =
        completion < 50 ? (deadlineNear ? 'URGENT' : 'REVIEW') : 'MONITOR'
      severity = worst(severity ?? gapSeverity, gapSeverity)
    }

    if (emp.rejectedSubmissions > 0) {
      reasons.push(`${emp.rejectedSubmissions} bài nộp bị từ chối`)
      severity = worst(severity ?? 'REVIEW', 'REVIEW')
    }

    if (
      lowScoreThreshold != null &&
      emp.averageScore != null &&
      emp.averageScore > 0 &&
      emp.averageScore < lowScoreThreshold
    ) {
      reasons.push(`Điểm TB thấp (${emp.averageScore.toFixed(1)})`)
      severity = worst(severity ?? 'REVIEW', 'REVIEW')
    }

    if (!severity || reasons.length === 0) return

    const metrics: AlertMetric[] = [
      { label: 'Hoàn thành', value: `${completion}%` },
      { label: 'KPI duyệt', value: `${emp.approvedSubmissions}/${emp.assignedKpi}` },
    ]
    if (emp.lateSubmissions > 0) metrics.push({ label: 'Trễ hạn', value: `${emp.lateSubmissions}` })
    else if (emp.averageScore != null) metrics.push({ label: 'Điểm TB', value: emp.averageScore.toFixed(1) })

    alerts.push({
      id: `emp-${emp.userId}`,
      severity,
      kind: 'EMPLOYEE',
      title: emp.fullName,
      subtitle: emp.orgUnitName || 'Chưa gán đơn vị',
      description: `${reasons[0]} — ${deadlineNote}.`,
      reasons,
      metrics,
      progress: completion,
      link: `/employees/${emp.userId}/performance`,
      employee: { userId: emp.userId, fullName: emp.fullName },
      weight: emp.lateSubmissions * 100 + (100 - completion),
    })
  })

  return alerts.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.weight - a.weight
  )
}

export function countBySeverity(alerts: DashboardAlert[]): Record<AlertSeverity, number> {
  return alerts.reduce(
    (acc, a) => {
      acc[a.severity] += 1
      return acc
    },
    { URGENT: 0, REVIEW: 0, MONITOR: 0 } as Record<AlertSeverity, number>
  )
}
