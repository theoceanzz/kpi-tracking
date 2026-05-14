import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'
import { adjustmentApi } from '@/features/kpi/api/adjustmentApi'
import { useAuthStore } from '@/store/authStore'
import { useHasPermission } from '@/components/auth/PermissionGate'

export interface NotificationCounts {
  pendingKpis: number
  pendingSubmissions: number
  pendingAdjustments: number
  myPendingTasks: number
}

export function useNotificationDots() {
  const { user } = useAuthStore()
  const { hasPermission } = useHasPermission()

  // 1. Fetch Overview Stats (for Managers/Directors)
  const { data: overview } = useQuery({
    queryKey: ['stats', 'overview', user?.id],
    queryFn: () => statsApi.getOverview(),
    enabled: !!user && hasPermission(['KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT', 'SUBMISSION:REVIEW']),
    refetchInterval: 60000, // Refresh every minute
  })

  // 2. Fetch Pending Adjustments (for Managers/Directors)
  const { data: adjustments } = useQuery({
    queryKey: ['kpi-adjustments', 'pending-count', user?.id],
    queryFn: () => adjustmentApi.getAll({ status: 'PENDING', size: 1 }),
    enabled: !!user && hasPermission('KPI:APPROVE_ADJUSTMENT'),
    refetchInterval: 60000,
  })

  // 3. Fetch My Progress (for Staff/All)
  const { data: myProgress } = useQuery({
    queryKey: ['stats', 'my-progress', user?.id],
    queryFn: () => statsApi.getMyProgress(0, 1),
    enabled: !!user,
    refetchInterval: 60000,
  })

  const counts: NotificationCounts = {
    pendingKpis: overview?.pendingKpi || 0,
    pendingSubmissions: overview?.pendingSubmissions || 0,
    pendingAdjustments: adjustments?.totalElements || 0,
    myPendingTasks: myProgress?.pendingTaskCount || 0,
  }

  return { counts }
}
