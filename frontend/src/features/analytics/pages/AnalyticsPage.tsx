import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { cn } from '@/lib/utils'
import { TrendingUp, Building2, LayoutDashboard, Users, Target } from 'lucide-react'
import MyStatsTab from './MyStatsTab'
import DrillDownTab from './DrillDownTab'
import DetailTableTab from './DetailTableTab'
import SummaryTab from './SummaryTab'
import MyObjectivesTab from './MyObjectivesTab'
import PageTour from '@/components/common/PageTour'
import { analyticsSteps } from '@/components/common/tourSteps'
import SubordinateManagementTab from './SubordinateManagementTab'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import AnalyticsTabSkeleton from '@/components/common/AnalyticsTabSkeleton'

type TabKey = 'my-objectives' | 'my' | 'summary' | 'drilldown' | 'detail' | 'subordinate'

export default function AnalyticsPage() {
  const { user } = useAuthStore()
  const { hasPermission } = useHasPermission()
  const canDrillDown = hasPermission(['KPI:VIEW']) || hasPermission(['SUBMISSION:REVIEW'])
  const canDetailTable = hasPermission(['ORG:VIEW']) && hasPermission(['USER:VIEW'])
  const canSummary = canDrillDown

  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const pageTitle = ((customLabels as Record<string, string>)['/analytics'] || 'Thống kê')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const { data: org, isLoading: loadingOrg } = useOrganization(organizationId)
  const isOkr = org?.enableOkr ?? false

  const tabs: { key: TabKey; label: string; icon: any; visible: boolean }[] = [
    { key: 'my-objectives', label: 'Mục tiêu của tôi', icon: Target, visible: isOkr },
    { key: 'subordinate', label: 'Mục tiêu đơn vị', icon: Users, visible: isOkr && canDrillDown },
    { key: 'my', label: 'KPI của tôi', icon: TrendingUp, visible: !isOkr },
    { key: 'summary', label: 'KPI đơn vị', icon: LayoutDashboard, visible: !isOkr && canSummary },
    { key: 'drilldown', label: 'Phân cấp', icon: Building2, visible: true },
  ]

  const visibleTabs = tabs.filter(t => t.visible)

  // Persist active tab in URL so it survives page reloads
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as TabKey | null
  const [activeTab, setActiveTabState] = useState<TabKey>(tabFromUrl ?? 'my-objectives')

  const setActiveTab = (key: TabKey) => {
    setActiveTabState(key)
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('tab', key)
      return p
    }, { replace: true })
  }

  // Auto-switch to first visible tab if current tab becomes invisible after org loads
  useEffect(() => {
    if (loadingOrg) return
    const isCurrentTabVisible = visibleTabs.some(t => t.key === activeTab)
    if (!isCurrentTabVisible && visibleTabs.length > 0) {
      const firstTab = visibleTabs[0]
      if (firstTab) setActiveTab(firstTab.key)
    }
  }, [isOkr, activeTab, visibleTabs, loadingOrg])

  if (loadingOrg) {
    return (
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-3">
          <div className="h-6 w-44 bg-[var(--color-muted)] rounded-full" />
          <div className="h-9 w-36 bg-[var(--color-muted)] rounded-xl" />
          <div className="h-4 w-80 bg-[var(--color-muted)] rounded-lg" />
        </div>
        {/* Tabs skeleton */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-0">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 w-32 bg-[var(--color-muted)] rounded-t-xl" />
          ))}
        </div>
        {/* Tab content skeleton */}
        <AnalyticsTabSkeleton />
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6">
      <PageTour pageKey="analytics" steps={analyticsSteps} />

      {/* Header */}
      <div id="tour-analytics-header" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 text-xs font-black uppercase tracking-widest mb-3">
            <TrendingUp size={14} /> Thống kê & Phân tích
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{pageTitle}</h1>
          <p className="text-slate-500 font-medium mt-1">Phân tích hiệu suất KPI, bài nộp và đánh giá</p>
        </div>
      </div>

      {/* Tabs */}
      <div id="tour-analytics-tabs" className="flex items-center border-b border-slate-200 dark:border-slate-800">
        {visibleTabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={cn(
              "flex-1 sm:flex-none min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-1.5 sm:px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all -mb-px",
              activeTab === t.key ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-700"
            )}>
              <Icon size={16} className="shrink-0" /> <span className="truncate">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="bg-transparent">
        {activeTab === 'my-objectives' && <MyObjectivesTab />}
        {activeTab === 'my' && <MyStatsTab />}
        {activeTab === 'summary' && canSummary && <SummaryTab />}
        {activeTab === 'drilldown' && <DrillDownTab />}
        {activeTab === 'subordinate' && canDrillDown && <SubordinateManagementTab />}
        {activeTab === 'detail' && canDetailTable && <DetailTableTab />}
      </div>
    </div>
  )
}

