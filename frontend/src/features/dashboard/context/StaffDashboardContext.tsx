import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMyKpiProgress } from '../hooks/useMyKpiProgress'
import { useMyAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { checkinApi } from '@/features/rewards/api/checkinApi'
import { rewardApi } from '@/features/rewards/api/rewardApi'
import { notificationApi } from '@/features/notifications/api/notificationApi'
import { useMySubmissions } from '@/features/submissions/hooks/useMySubmissions'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useAuthStore } from '@/store/authStore'
import { useNow } from '../hooks/useNow'
import type { EvaluationItem, KpiProgressItem, KpiTask, MyKpiProgress } from '@/types/stats'
import type { Submission } from '@/types/submission'

interface StaffDashboardValue {
  progress?: MyKpiProgress
  isProgressLoading: boolean
  tasks: KpiTask[]
  submissions: Submission[]
  allSubmissions: Submission[]
  isSubmissionsLoading: boolean
  activePeriod: { id: string; name: string; startDate?: string | null; endDate?: string | null } | null
  /** Số ngày còn lại của kỳ đang mở; null khi không xác định. */
  daysRemaining: number | null
  /** Tỷ lệ phần trăm thời gian đã trôi qua của kỳ — để đối chiếu với tiến độ công việc. */
  periodElapsedPercent: number | null
  /** Điểm trung bình quy đổi phần trăm trên toàn bộ KPI đang đảm nhiệm. */
  overallAvgScore: string
  approvalRate: number
  completedCount: number
  inProgressCount: number

  /** Tiến độ THỰC của từng KPI (chỉ tiêu vs thực đạt) — thứ nhân viên thật sự cần biết. */
  kpiItems: KpiProgressItem[]
  /** Lịch sử điểm được chấm qua các kỳ. */
  evaluationHistory: EvaluationItem[]
  isAnalyticsLoading: boolean

  /** Điểm thưởng & điểm danh; chỉ có dữ liệu khi tổ chức bật tính năng thưởng. */
  rewardEnabled: boolean
  checkin?: {
    enabled: boolean; exempt: boolean; checkedInToday: boolean; canCheckin: boolean
    streakLength: number; nextPoints?: number | null; nextBonusPoints?: number | null
    blockedReason?: string | null
  }
  walletBalance?: number
  lifetimeEarned?: number
  unreadNotifications: number
}

const StaffDashboardContext = createContext<StaffDashboardValue | null>(null)

/**
 * Gom mọi truy vấn của dashboard nhân viên vào một chỗ, để widget chỉ đọc dữ liệu.
 * Nếu để mỗi widget tự fetch thì mỗi lần kéo-thả (widget unmount/mount) sẽ kéo theo
 * một loạt request lặp lại.
 */
export function StaffDashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const now = useNow()

  const { data: progress, isLoading: isProgressLoading } = useMyKpiProgress(0, 50)
  const { data: submissions, isLoading: isSubmissionsLoading } = useMySubmissions({ page: 0, size: 10 })
  const { data: allSubmissions } = useMySubmissions({ size: 100 })
  const { data: myKpis } = useMyKpi({ size: 100 })
  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })

  // Chỉ tiêu vs thực đạt của từng KPI — bảng KPI/bài nộp không có con số này
  const { data: analytics, isLoading: isAnalyticsLoading } = useMyAnalytics()

  // Điểm danh trả về enabled=false khi tổ chức tắt tính năng, nên gọi được vô điều kiện
  const { data: checkin } = useQuery({
    queryKey: ['reward-checkins', 'me'],
    queryFn: () => checkinApi.getMyStatus(),
  })
  const { data: wallet } = useQuery({
    queryKey: ['rewards', 'me'],
    queryFn: () => rewardApi.getMyWallet(),
    enabled: checkin?.enabled === true,
  })
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
  })

  const activePeriod = useMemo(() => {
    if (!periodsData?.content) return null
    const now = new Date()
    return periodsData.content.find(p => {
      if (!p.startDate || !p.endDate) return false
      return now >= new Date(p.startDate) && now <= new Date(p.endDate)
    }) ?? null
  }, [periodsData])

  const { daysRemaining, periodElapsedPercent } = useMemo(() => {
    if (!activePeriod?.endDate) return { daysRemaining: null, periodElapsedPercent: null }
    const end = new Date(activePeriod.endDate).getTime()
    const days = Math.max(0, Math.ceil((end - now) / 86_400_000))

    if (!activePeriod.startDate) return { daysRemaining: days, periodElapsedPercent: null }
    const start = new Date(activePeriod.startDate).getTime()
    const span = end - start
    const elapsed = span > 0 ? Math.round(((now - start) / span) * 100) : null
    return {
      daysRemaining: days,
      periodElapsedPercent: elapsed === null ? null : Math.min(100, Math.max(0, elapsed)),
    }
  }, [activePeriod, now])

  const overallAvgScore = useMemo(() => {
    const kpis = myKpis?.content ?? []
    const subs = allSubmissions?.content ?? []
    if (kpis.length === 0) return '0'

    const total = kpis.reduce((acc, kpi) => {
      const latest = subs.find(s => s.kpiCriteriaId === kpi.id)
      if (!latest) return acc
      const percentage = latest.targetValue
        ? Math.min((latest.actualValue / latest.targetValue) * 100, 100)
        : (latest.actualValue <= 100 ? latest.actualValue : 0)
      return acc + percentage
    }, 0)

    return (total / kpis.length).toFixed(1)
  }, [myKpis, allSubmissions])

  const value = useMemo<StaffDashboardValue>(() => {
    const totalSub = progress?.totalSubmissions ?? 0
    const approvedSub = progress?.approvedSubmissions ?? 0
    const completedCount =
      (progress?.pendingSubmissions ?? 0) + approvedSub + (progress?.rejectedSubmissions ?? 0)

    return {
      progress,
      isProgressLoading,
      tasks: progress?.tasks?.content ?? [],
      submissions: submissions?.content ?? [],
      allSubmissions: allSubmissions?.content ?? [],
      isSubmissionsLoading,
      activePeriod,
      daysRemaining,
      periodElapsedPercent,
      overallAvgScore,
      approvalRate: totalSub > 0 ? Math.round((approvedSub / totalSub) * 100) : 0,
      completedCount,
      inProgressCount: Math.max(0, (progress?.totalAssignedKpi ?? 0) - completedCount),

      kpiItems: analytics?.kpiItems ?? [],
      evaluationHistory: analytics?.evaluationHistory ?? [],
      isAnalyticsLoading,

      rewardEnabled: checkin?.enabled === true,
      checkin: checkin ?? undefined,
      walletBalance: wallet?.balance,
      lifetimeEarned: wallet?.lifetimeEarned,
      unreadNotifications: typeof unread === 'number' ? unread : 0,
    }
  }, [progress, isProgressLoading, submissions, allSubmissions, isSubmissionsLoading, activePeriod, daysRemaining, periodElapsedPercent, overallAvgScore, analytics, isAnalyticsLoading, checkin, wallet, unread])

  return <StaffDashboardContext.Provider value={value}>{children}</StaffDashboardContext.Provider>
}

export function useStaffDashboard() {
  const ctx = useContext(StaffDashboardContext)
  if (!ctx) throw new Error('useStaffDashboard phải được dùng bên trong StaffDashboardProvider')
  return ctx
}
