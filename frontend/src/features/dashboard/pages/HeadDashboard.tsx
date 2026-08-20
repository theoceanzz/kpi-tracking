import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Star, Target } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import PageTour from '@/components/common/PageTour'
import { headDashboardSteps } from '@/components/common/tourSteps'
import { useAuthStore } from '@/store/authStore'
import { reportApi } from '@/features/reports/api/reportApi'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import { useDashboardLayout } from '@/components/common/dashboard/useDashboardLayout'
import { HeadDashboardProvider, useHeadDashboard } from '../context/HeadDashboardContext'
import { PinnedWidgetsSection } from '../components/PinnedWidgetsSection'
import { UrgentWorkChip } from '../components/UrgentWorkChip'
import { useScopedAlerts } from '../hooks/useScopedAlerts'
import type { OrgFlags } from '../widgets/staffCatalog'
import {
  getHeadCatalog, getHeadDefaultLayout, getHeadPresets, getHeadWidgets, renderHeadWidget,
} from '../widgets/headCatalog'

export default function HeadDashboard() {
  return (
    <HeadDashboardProvider>
      <HeadDashboardInner />
    </HeadDashboardProvider>
  )
}

function HeadDashboardInner() {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const { orgUnitId, unitName, roleLabel, roleRank, organization, stats, daysRemaining } = useHeadDashboard()

  const flags = useMemo<OrgFlags>(() => ({
    enableOkr: organization?.enableOkr ?? false,
    enableBsc: organization?.enableBsc ?? false,
    enableReward: organization?.enableReward ?? false,
    enableQualitative: organization?.enableQualitative ?? false,
    enableCashWallet: organization?.enableCashWallet ?? false,
    enableAi: organization?.enableAi ?? false,
  }), [organization])

  const availableWidgets = useMemo(() => getHeadWidgets(flags), [flags])
  const defaultWidgets = useMemo(() => getHeadDefaultLayout(flags), [flags])
  const catalog = useMemo(() => getHeadCatalog(flags), [flags])
  const presets = useMemo(() => getHeadPresets(), [])

  const dash = useDashboardLayout({ scope: 'HEAD', defaultWidgets, availableWidgets })

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

  const { urgentCount } = useScopedAlerts('HEAD', {
    orgUnitId,
    daysRemaining,
    lowScoreThreshold: (organization?.evaluationMaxScore ?? 100) * 0.6,
  })

  const approvalLink = roleRank === 1 ? '/evaluations' : '/submissions/org-unit'

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] p-4 md:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <PageTour pageKey="dashboard-head" steps={headDashboardSteps} />

        {/* Header ngoài lưới — luôn còn lối vào phê duyệt và tín hiệu việc khẩn */}
        <header className="bg-white dark:bg-slate-900 rounded-[28px] p-6 md:p-7 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-5 min-w-0">
            <div className="relative shrink-0">
              <UserAvatar
                fullName={user?.fullName}
                avatarUrl={user?.avatarUrl}
                className="w-14 h-14 rounded-2xl shadow-lg"
                fallbackClassName="bg-gradient-to-br from-blue-600 to-indigo-700 text-xl font-black text-white"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[9px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">
                  {roleLabel}
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{unitName}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                Chào {user?.fullName?.split(' ').pop()}!
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                Quản lý <span className="text-blue-600 dark:text-blue-400 font-bold tabular-nums">{stats?.totalUsers ?? 0} nhân sự</span> thuộc phòng/team.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <UrgentWorkChip count={urgentCount} to={approvalLink} />
            <DashboardEditToolbar api={dash} />
            <Link
              id="tour-dashboard-approve-btn"
              to={approvalLink}
              className="flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] font-black hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap"
            >
              {roleRank === 1
                ? <><Star size={15} className="text-amber-500" aria-hidden="true" /> KẾT QUẢ ĐÁNH GIÁ</>
                : <><ClipboardCheck size={15} className="text-blue-600" aria-hidden="true" /> DUYỆT BÁO CÁO</>}
            </Link>
            {roleRank === 0 && (
              <Link
                to="/performance?section=kpi-criteria"
                className="flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black hover:bg-indigo-600 dark:hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-colors shadow-md whitespace-nowrap"
              >
                <Target size={15} aria-hidden="true" /> QUẢN LÝ KPI
              </Link>
            )}
          </div>
        </header>

        <div id="tour-dashboard-stats" />

        <DashboardCustomizeChrome
          api={dash}
          catalog={catalog}
          presets={presets}
          ready={!dash.isLoading}
          renderWidget={w => renderHeadWidget(w.i)}
        />

        <PinnedWidgetsSection widgets={pinnedWidgets} onUnpin={refetchPinned} />
      </div>
    </div>
  )
}
