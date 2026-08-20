import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Plus } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import PageTour from '@/components/common/PageTour'
import { staffDashboardSteps } from '@/components/common/tourSteps'
import { useAuthStore } from '@/store/authStore'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import { useMySubmissions } from '@/features/submissions/hooks/useMySubmissions'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import { reportApi } from '@/features/reports/api/reportApi'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import { useDashboardLayout } from '@/components/common/dashboard/useDashboardLayout'
import { StaffDashboardProvider } from '../context/StaffDashboardContext'
import { PinnedWidgetsSection } from '../components/PinnedWidgetsSection'
import { UrgentWorkChip } from '../components/UrgentWorkChip'
import { useScopedAlerts } from '../hooks/useScopedAlerts'
import {
  getStaffCatalog, getStaffDefaultLayout, getStaffPresets, getStaffWidgets, renderStaffWidget,
  type OrgFlags,
} from '../widgets/staffCatalog'

export default function StaffDashboard() {
  return (
    <StaffDashboardProvider>
      <StaffDashboardInner />
    </StaffDashboardProvider>
  )
}

function StaffDashboardInner() {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: organization } = useOrganization(organizationId)

  const flags = useMemo<OrgFlags>(() => ({
    enableOkr: organization?.enableOkr ?? false,
    enableBsc: organization?.enableBsc ?? false,
    enableReward: organization?.enableReward ?? false,
    enableQualitative: organization?.enableQualitative ?? false,
    enableCashWallet: organization?.enableCashWallet ?? false,
    enableAi: organization?.enableAi ?? false,
  }), [organization])

  const availableWidgets = useMemo(() => getStaffWidgets(flags), [flags])
  const defaultWidgets = useMemo(() => getStaffDefaultLayout(flags), [flags])
  const catalog = useMemo(() => getStaffCatalog(flags), [flags])
  const presets = useMemo(() => getStaffPresets(flags), [flags])

  const dash = useDashboardLayout({ scope: 'STAFF', defaultWidgets, availableWidgets })

  // Cho phép mở thẳng chế độ tuỳ chỉnh bằng URL (?edit=1)
  useEffect(() => {
    if (searchParams.get('edit') === '1' && !dash.isEditMode) {
      dash.setIsEditMode(true)
      setSearchParams(prev => {
        const p = new URLSearchParams(prev)
        p.delete('edit')
        return p
      }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const { data: pinnedWidgets, refetch: refetchPinned } = useQuery({
    queryKey: ['reports', 'widgets', 'pinned'],
    queryFn: () => reportApi.getPinnedWidgets(),
  })

  const { urgentCount } = useScopedAlerts('STAFF', { daysRemaining: null })

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6">
      <PageTour pageKey="dashboard-staff" steps={staffDashboardSteps} />

      {/* Header nằm NGOÀI lưới — không tuỳ chỉnh được, để luôn còn lối vào và tín hiệu việc khẩn */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <UserAvatar
              fullName={user?.fullName}
              avatarUrl={user?.avatarUrl}
              className="w-14 h-14 rounded-2xl shadow-lg"
              fallbackClassName="bg-gradient-to-tr from-indigo-600 to-violet-500 text-lg font-black text-white"
            />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white dark:border-slate-900" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white truncate">
              Xin chào, <span className="text-indigo-600 dark:text-indigo-400">{user?.fullName?.split(' ').pop()}!</span>
            </h1>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2 mt-1">
              <Calendar size={14} aria-hidden="true" />
              Hôm nay là {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <UrgentWorkChip count={urgentCount} to="/me?section=my-submissions" />
          <DashboardEditToolbar api={dash} />
          <Link
            id="tour-staff-submit"
            to="/submissions/new"
            className="flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-black hover:bg-indigo-600 dark:hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-colors shadow-md"
          >
            <Plus size={18} aria-hidden="true" /> NỘP KPI MỚI
          </Link>
        </div>
      </header>

      <div id="tour-staff-stats" />

      <DashboardCustomizeChrome
        api={dash}
        catalog={catalog}
        presets={presets}
        ready={!dash.isLoading}
        renderWidget={w => renderStaffWidget(w.i)}
      />

      {/* Biểu đồ ghim từ trang Thống kê — giữ nguyên để người đang ghim không mất gì */}
      <PinnedWidgetsSection widgets={pinnedWidgets} onUnpin={refetchPinned} />

      <CompletedPeriodEvaluationPrompt />
    </div>
  )
}

/**
 * Khi một kỳ đã hoàn tất mà chưa có phiếu tự đánh giá, mở sẵn form một lần.
 * Tách khỏi phần lưới vì đây là luồng bắt buộc, không phải nội dung tuỳ chỉnh được.
 */
function CompletedPeriodEvaluationPrompt() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)

  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  const { data: myKpis } = useMyKpi({ size: 100 })
  const { data: allSubmissions } = useMySubmissions({ size: 100 })
  const { data: evaluations } = useEvaluations({ userId: user?.id, size: 50 })

  const completedPeriod = useMemo(() => {
    if (!periodsData?.content || !myKpis?.content || !allSubmissions?.content || !evaluations?.content) return null

    const sorted = [...periodsData.content].sort(
      (a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime()
    )

    for (const period of sorted) {
      if (evaluations.content.some(e => e.kpiPeriodId === period.id)) continue
      const periodKpis = myKpis.content.filter(k => k.kpiPeriodId === period.id)
      if (periodKpis.length === 0) continue

      const isCompleted = periodKpis.every(kpi => {
        const approved = allSubmissions.content.filter(s => s.kpiCriteriaId === kpi.id && s.status === 'APPROVED')
        return kpi.frequency === 'UNLIMITED' || approved.length >= kpi.expectedSubmissions
      })
      if (isCompleted) return period
    }
    return null
  }, [periodsData, myKpis, allSubmissions, evaluations])

  useEffect(() => {
    if (completedPeriod && !shown) { setOpen(true); setShown(true) }
  }, [completedPeriod, shown])

  if (!open || !completedPeriod) return null
  return (
    <EvaluationFormModal
      open={open}
      onClose={() => setOpen(false)}
      initialPeriodId={completedPeriod.id}
      readOnly={false}
    />
  )
}
