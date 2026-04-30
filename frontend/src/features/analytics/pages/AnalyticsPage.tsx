import { useState } from 'react'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { cn } from '@/lib/utils'
import { TrendingUp, Building2, Table, LayoutDashboard } from 'lucide-react'
import MyStatsTab from './MyStatsTab'
import DrillDownTab from './DrillDownTab'
import DetailTableTab from './DetailTableTab'
import SummaryTab from './SummaryTab'

type TabKey = 'my' | 'summary' | 'drilldown' | 'detail'

export default function AnalyticsPage() {
  const { hasPermission } = useHasPermission()
  const canDrillDown = hasPermission(['KPI:VIEW']) || hasPermission(['SUBMISSION:REVIEW'])
  const canDetailTable = hasPermission(['ORG:VIEW']) && hasPermission(['USER:VIEW'])
  const canSummary = canDrillDown // Assuming if they can drill down, they can see summary

  const tabs: { key: TabKey; label: string; icon: any; visible: boolean }[] = [
    { key: 'my', label: 'Cá nhân', icon: TrendingUp, visible: true },
    { key: 'summary', label: 'Thống kê tổng', icon: LayoutDashboard, visible: canSummary },
    { key: 'drilldown', label: 'Phân cấp', icon: Building2, visible: canDrillDown },
    { key: 'detail', label: 'Bảng chi tiết', icon: Table, visible: canDetailTable },
  ]

  const visibleTabs = tabs.filter(t => t.visible)
  const [activeTab, setActiveTab] = useState<TabKey>(visibleTabs[0]?.key ?? 'my')

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 text-xs font-black uppercase tracking-widest mb-3">
          <TrendingUp size={14} /> Thống kê & Phân tích
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Thống kê</h1>
        <p className="text-slate-500 font-medium mt-1">Phân tích hiệu suất KPI, bài nộp và đánh giá</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
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
        {activeTab === 'my' && <MyStatsTab />}
        {activeTab === 'summary' && canSummary && <SummaryTab />}
        {activeTab === 'drilldown' && canDrillDown && <DrillDownTab />}
        {activeTab === 'detail' && canDetailTable && <DetailTableTab />}
      </div>
    </div>
  )
}
