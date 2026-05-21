import { useState, useEffect } from 'react'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { cn } from '@/lib/utils'
import { TrendingUp, Building2, LayoutDashboard, Users, Target, Loader2 } from 'lucide-react'
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

type TabKey = 'my-objectives' | 'my' | 'summary' | 'drilldown' | 'detail' | 'subordinate'

export default function AnalyticsPage() {
  const { user } = useAuthStore()
  const { hasPermission } = useHasPermission()
  const canDrillDown = hasPermission(['KPI:VIEW']) || hasPermission(['SUBMISSION:REVIEW'])
  const canDetailTable = hasPermission(['ORG:VIEW']) && hasPermission(['USER:VIEW'])
  const canSummary = canDrillDown // Assuming if they can drill down, they can see summary

  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org, isLoading: loadingOrg } = useOrganization(organizationId)
  const isOkr = org?.enableOkr ?? false

  const tabs: { key: TabKey; label: string; icon: any; visible: boolean }[] = [
    // OKR Mode tabs
    { key: 'my-objectives', label: 'Mục tiêu của tôi', icon: Target, visible: isOkr },
    { key: 'subordinate', label: 'Quản lý mục tiêu cấp dưới', icon: Users, visible: isOkr && canDrillDown },
    
    // Non-OKR Mode tabs
    { key: 'my', label: 'Cá nhân', icon: TrendingUp, visible: !isOkr },
    { key: 'summary', label: 'Thống kê tổng', icon: LayoutDashboard, visible: !isOkr && canSummary },
    
    // Always visible
    { key: 'drilldown', label: 'Phân cấp', icon: Building2, visible: true },
  ]

  const visibleTabs = tabs.filter(t => t.visible)
  const [activeTab, setActiveTab] = useState<TabKey>('my-objectives')

  // Auto-switch active tab when configuration loads or changes so we don't stay on an invisible tab
  useEffect(() => {
    if (loadingOrg) return
    const isCurrentTabVisible = visibleTabs.some(t => t.key === activeTab)
    if (!isCurrentTabVisible && visibleTabs.length > 0) {
      const firstTab = visibleTabs[0]
      if (firstTab) {
        setActiveTab(firstTab.key)
      }
    }
  }, [isOkr, activeTab, visibleTabs, loadingOrg])

  if (loadingOrg) {
    return (
      <div className="w-full min-h-[400px] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          Đang tải cấu hình hệ thống...
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      <PageTour pageKey="analytics" steps={analyticsSteps} />
      
      {/* Header */}
      <div id="tour-analytics-header" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 text-xs font-black uppercase tracking-widest mb-3">
            <TrendingUp size={14} /> Thống kê & Phân tích
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Thống kê</h1>
          <p className="text-slate-500 font-medium mt-1">Phân tích hiệu suất KPI, bài nộp và đánh giá</p>
        </div>
      </div>

      {/* Tabs */}
      <div id="tour-analytics-tabs" className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        {visibleTabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all -mb-px",
              activeTab === t.key ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-700"
            )}>
              <Icon size={18} /> {t.label}
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

