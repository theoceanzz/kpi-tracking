import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, Plus } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import { useAuthStore } from '@/store/authStore'
import { reportApi } from '@/features/reports/api/reportApi'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import { useDashboardLayout } from '@/components/common/dashboard/useDashboardLayout'
import { DeputyDashboardProvider, useDeputyDashboard } from '../context/DeputyDashboardContext'
import { StaffDashboardProvider } from '../context/StaffDashboardContext'
import { PinnedWidgetsSection } from '../components/PinnedWidgetsSection'
import { UrgentWorkChip } from '../components/UrgentWorkChip'
import { useScopedAlerts } from '../hooks/useScopedAlerts'
import type { OrgFlags } from '../widgets/staffCatalog'
import {
  getDeputyCatalog, getDeputyDefaultLayout, getDeputyPresets, getDeputyWidgets, renderDeputyWidget,
} from '../widgets/deputyCatalog'

/**
 * Dashboard PHÓ ĐƠN VỊ.
 *
 * <p>Lồng hai provider vì Phó có hai vai cùng lúc: quản một mảng (DeputyDashboardProvider)
 * và vẫn là người có KPI riêng (StaffDashboardProvider). Widget mảng và widget cá nhân
 * đọc từ hai nguồn khác nhau nên không gộp làm một được.
 */
export default function DeputyDashboard() {
  return (
    <StaffDashboardProvider>
      <DeputyDashboardProvider>
        <DeputyDashboardInner />
      </DeputyDashboardProvider>
    </StaffDashboardProvider>
  )
}

function DeputyDashboardInner() {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const { organization, unitName, roleLabel, scopeKpis, scopeMembers, isApprover } = useDeputyDashboard()

  const flags = useMemo<OrgFlags>(() => ({
    enableOkr: organization?.enableOkr ?? false,
    enableBsc: organization?.enableBsc ?? false,
    enableReward: organization?.enableReward ?? false,
    enableQualitative: organization?.enableQualitative ?? false,
    enableCashWallet: organization?.enableCashWallet ?? false,
    enableAi: organization?.enableAi ?? false,
  }), [organization])

  const availableWidgets = useMemo(() => getDeputyWidgets(flags), [flags])
  const defaultWidgets = useMemo(() => getDeputyDefaultLayout(flags), [flags])
  const catalog = useMemo(() => getDeputyCatalog(flags), [flags])
  const presets = useMemo(() => getDeputyPresets(), [])

  const dash = useDashboardLayout({ scope: 'DEPUTY', defaultWidgets, availableWidgets })

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

  // Phó dùng cảnh báo phạm vi cá nhân: mảng phụ trách không phải đơn vị nên số liệu
  // cấp đơn vị (KPI chờ duyệt toàn phòng) không thuộc trách nhiệm của họ.
  const { urgentCount } = useScopedAlerts('STAFF', { daysRemaining: null })

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6">
      <header className="bg-white dark:bg-slate-900 rounded-[28px] p-6 md:p-7 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-5 min-w-0">
          <div className="relative shrink-0">
            <UserAvatar
              fullName={user?.fullName}
              avatarUrl={user?.avatarUrl}
              className="w-14 h-14 rounded-2xl shadow-lg"
              fallbackClassName="bg-gradient-to-br from-teal-600 to-cyan-700 text-xl font-black text-white"
            />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-[9px] font-black text-teal-700 dark:text-teal-300 uppercase tracking-widest">
                {roleLabel}
              </span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{unitName}</span>
              {/* Nói thẳng vai trò để Phó không kỳ vọng thấy dữ liệu toàn đơn vị */}
              {!isApprover && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider">
                  <Eye size={11} aria-hidden="true" /> Theo dõi
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white truncate">
              Chào {user?.fullName?.split(' ').pop()}!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium tabular-nums">
              Phụ trách <span className="text-teal-600 dark:text-teal-400 font-bold">{scopeKpis.length} chỉ tiêu</span>
              {' '}cùng <span className="text-teal-600 dark:text-teal-400 font-bold">{scopeMembers.length} người</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <UrgentWorkChip count={urgentCount} to="/me?section=my-submissions" />
          <DashboardEditToolbar api={dash} />
          <Link
            to="/submissions/new"
            className="flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-black hover:bg-teal-600 dark:hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-colors shadow-md"
          >
            <Plus size={18} aria-hidden="true" /> NỘP KPI MỚI
          </Link>
        </div>
      </header>

      <DashboardCustomizeChrome
        api={dash}
        catalog={catalog}
        presets={presets}
        ready={!dash.isLoading}
        renderWidget={w => renderDeputyWidget(w.i)}
      />

      <PinnedWidgetsSection widgets={pinnedWidgets} onUnpin={refetchPinned} />
    </div>
  )
}
