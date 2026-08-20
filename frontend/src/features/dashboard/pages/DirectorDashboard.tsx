import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Clock } from 'lucide-react'
import PageTour from '@/components/common/PageTour'
import { directorDashboardSteps } from '@/components/common/tourSteps'
import { reportApi } from '@/features/reports/api/reportApi'
import StaffPerformanceDetailModal from '@/features/submissions/components/StaffPerformanceDetailModal'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import { useDashboardLayout } from '@/components/common/dashboard/useDashboardLayout'
import { DirectorDashboardProvider, useDirectorDashboard } from '../context/DirectorDashboardContext'
import { PinnedWidgetsSection } from '../components/PinnedWidgetsSection'
import { UrgentWorkChip } from '../components/UrgentWorkChip'
import type { OrgFlags } from '../widgets/staffCatalog'
import {
  getDirectorCatalog, getDirectorDefaultLayout, getDirectorPresets, getDirectorWidgets,
  renderDirectorWidget,
} from '../widgets/directorCatalog'

export default function DirectorDashboard() {
  return (
    <DirectorDashboardProvider>
      <DirectorDashboardInner />
    </DirectorDashboardProvider>
  )
}

function DirectorDashboardInner() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    organization, stats, activePeriod, criticalAlerts, evaluatingUser, setEvaluatingUser,
  } = useDirectorDashboard()

  const flags = useMemo<OrgFlags>(() => ({
    enableOkr: organization?.enableOkr ?? false,
    enableBsc: organization?.enableBsc ?? false,
    enableReward: organization?.enableReward ?? false,
    enableQualitative: organization?.enableQualitative ?? false,
    enableCashWallet: organization?.enableCashWallet ?? false,
    enableAi: organization?.enableAi ?? false,
  }), [organization])

  const availableWidgets = useMemo(() => getDirectorWidgets(flags), [flags])
  const defaultWidgets = useMemo(() => getDirectorDefaultLayout(flags), [flags])
  const catalog = useMemo(() => getDirectorCatalog(flags), [flags])
  const presets = useMemo(() => getDirectorPresets(), [])

  const dash = useDashboardLayout({ scope: 'DIRECTOR', defaultWidgets, availableWidgets })

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

  // Cùng nguồn với widget cảnh báo, đã giới hạn đúng phạm vi toàn tổ chức của giám đốc
  const urgentCount = useMemo(
    () => criticalAlerts.filter(a => a.severity === 'URGENT').length,
    [criticalAlerts]
  )

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
      <PageTour pageKey="dashboard-director" steps={directorDashboardSteps} />

      {/* Header ngoài lưới — luôn giữ lối vào duyệt KPI và tín hiệu việc khẩn */}
      <header
        id="tour-dashboard-header"
        className="flex flex-col lg:flex-row justify-between lg:items-center gap-5 bg-white dark:bg-slate-900 p-6 md:p-7 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm"
      >
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Hệ thống <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Quản trị Hiệu suất</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm max-w-2xl">
            Dữ liệu tổng quát về KPI, bài nộp và đánh giá nhân sự
            {activePeriod ? ` · kỳ ${activePeriod.name}` : ''}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <UrgentWorkChip count={urgentCount} to="/performance?section=kpi-criteria-pending" />
          <DashboardEditToolbar api={dash} />
          <Link
            id="tour-dashboard-approve-btn"
            to="/performance?section=kpi-criteria-pending"
            className="flex items-center gap-2 min-h-[44px] px-5 rounded-[20px] bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-colors"
          >
            <Clock size={17} aria-hidden="true" />
            <span className="font-black text-xs uppercase tracking-widest tabular-nums">Duyệt ({stats?.pendingKpi ?? 0})</span>
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div id="tour-dashboard-stats" />
      <div id="tour-dashboard-completion" />
      <div id="tour-dashboard-tabs" />

      <DashboardCustomizeChrome
        api={dash}
        catalog={catalog}
        presets={presets}
        ready={!dash.isLoading}
        renderWidget={w => renderDirectorWidget(w.i)}
      />

      <PinnedWidgetsSection widgets={pinnedWidgets} onUnpin={refetchPinned} />

      {evaluatingUser && activePeriod && (
        <StaffPerformanceDetailModal
          open={!!evaluatingUser}
          onClose={() => setEvaluatingUser(null)}
          userId={evaluatingUser.id}
          userName={evaluatingUser.name}
          periodId={activePeriod.id}
          periodName={activePeriod.name}
        />
      )}
    </div>
  )
}
