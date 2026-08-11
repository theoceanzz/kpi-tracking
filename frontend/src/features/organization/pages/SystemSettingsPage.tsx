import { useState, useEffect } from 'react'
import {
  Bell, LayoutPanelLeft, Save,
  Info, Loader2, Search, Link2
} from 'lucide-react'
import LarkSettingsTab from '../components/LarkSettingsTab'
import { LARK_CONNECT_RESULT_KEY } from '@/features/auth/pages/LarkCallbackPage'
import { cn } from '@/lib/utils'
import { useSidebarSettings, useUpdateSidebarSettings } from '../hooks/useSidebarSettings'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import PageTour from '@/components/common/PageTour'
import { settingsSteps } from '@/components/common/tourSteps'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi, type NotificationConfigItem } from '@/features/notifications/api/notificationApi'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState<'sidebar' | 'notifications' | 'lark'>(
    // Quay về từ Lark sau bước liên kết thì mở thẳng tab Lark để thấy thẻ xác nhận
    () => (sessionStorage.getItem(LARK_CONNECT_RESULT_KEY) ? 'lark' : 'sidebar')
  )
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const pageTitle = ((customLabels as Record<string, string>)['/settings'] || 'Cấu hình hệ thống')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <PageTour pageKey="settings" steps={settingsSteps} />
      {/* Header */}
      <div id="tour-settings-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{pageTitle}</h1>
          <p className="text-slate-500 font-medium">Quản lý các thiết lập chung cho toàn bộ tổ chức</p>
        </div>
      </div>

      {/* Tabs */}
      <div id="tour-settings-tabs" className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-full sm:w-fit border border-slate-200 dark:border-slate-800">
        <TabButton 
          active={activeTab === 'sidebar'} 
          onClick={() => setActiveTab('sidebar')}
          icon={LayoutPanelLeft}
          label="Thiết lập Sidebar"
        />
        <TabButton
          active={activeTab === 'notifications'}
          onClick={() => setActiveTab('notifications')}
          icon={Bell}
          label="Thiết lập thông báo"
        />
        <TabButton
          active={activeTab === 'lark'}
          onClick={() => setActiveTab('lark')}
          icon={Link2}
          label="Kết nối Lark"
        />
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        {activeTab === 'sidebar' && <SidebarSettingsTab />}
        {activeTab === 'notifications' && <NotificationSettingsTab />}
        {activeTab === 'lark' && <LarkSettingsTab />}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2.5 px-3 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none",
        active 
          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" 
          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      )}
    >
      <Icon size={18} />
      {label}
    </button>
  )
}

/* ========== SIDEBAR SETTINGS TAB ========== */
function SidebarSettingsTab() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: settings, isLoading, refetch } = useSidebarSettings(organizationId!)
  const updateMutation = useUpdateSidebarSettings()
  const { data: org } = useOrganization(organizationId)
  const enableOkr = org?.enableOkr || false
  const enableBsc = org?.enableBsc || false

  const [localSettings, setLocalSettings] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')

  // Initial local state from API
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings])

  // Handle setting change
  const handleChange = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    if (!organizationId) return
    
    updateMutation.mutate({ 
      organizationId, 
      settings: localSettings 
    }, {
      onSuccess: () => {
        toast.success('Cập nhật nhãn Sidebar thành công. Vui lòng tải lại trang để thấy thay đổi.')
        refetch()
      }
    })
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-600" /></div>

  const menuItems = [
    { key: '/dashboard', defaultLabel: 'Tổng quan', category: 'Dashboard' },
    { key: 'Thiết lập công ty', defaultLabel: 'Thiết lập công ty', category: 'Hệ thống' },
    { key: '/company', defaultLabel: 'Công ty', category: 'Hệ thống' },
    // Nhãn OKR/BSC chỉ sửa được khi tổ chức bật tính năng tương ứng (khớp cờ okrOnly/bscOnly ở Sidebar).
    // Nhóm không có path nên key là chính nhãn gốc — trùng quy ước getLabel() bên Sidebar.
    ...(enableOkr ? [
      { key: '/okr', defaultLabel: 'Quản lý OKR', category: 'OKR' },
    ] : []),
    ...(enableBsc ? [
      { key: 'Quản lý BSC', defaultLabel: 'Quản lý BSC', category: 'BSC' },
      { key: '/bsc', defaultLabel: 'Thẻ điểm BSC', category: 'BSC' },
      { key: '/bsc/dashboard', defaultLabel: 'Dashboard BSC', category: 'BSC' },
      { key: '/bsc/strategy-map', defaultLabel: 'Bản đồ chiến lược', category: 'BSC' },
    ] : []),
    { key: 'Tổ chức', defaultLabel: 'Tổ chức', category: 'Hệ thống' },
    { key: '/roles', defaultLabel: 'Vai trò', category: 'Hệ thống' },
    { key: '/org-structure', defaultLabel: 'Sơ đồ tổ chức', category: 'Hệ thống' },
    { key: '/users', defaultLabel: 'Nhân sự', category: 'Hệ thống' },
    { key: '/settings', defaultLabel: 'Cấu hình hệ thống', category: 'Hệ thống' },
    { key: 'Quản lý KPI', defaultLabel: 'Quản lý KPI', category: 'KPI' },
    { key: '/kpi-cycles', defaultLabel: 'Quản lý kỳ', category: 'KPI' },
    { key: '/kpi-periods', defaultLabel: 'Quản lý đợt', category: 'KPI' },
    { key: '/kpi-criteria', defaultLabel: 'Quản lý chỉ tiêu', category: 'KPI' },
    { key: '/kpi-criteria/pending', defaultLabel: 'Duyệt chỉ tiêu', category: 'KPI' },
    { key: '/kpi-adjustments/pending', defaultLabel: 'Duyệt điều chỉnh', category: 'KPI' },
    { key: '/submissions/org-unit', defaultLabel: 'Phê duyệt & Đánh giá', category: 'KPI' },
    { key: '/evaluations', defaultLabel: 'Kết quả đánh giá', category: 'KPI' },
    { key: '/kpi-cycles/evaluation', defaultLabel: 'Đánh giá kỳ', category: 'KPI' },
    { key: '/my-kpi', defaultLabel: 'KPI của tôi', category: 'Cá nhân' },
    { key: '/my-adjustments', defaultLabel: 'Điều chỉnh của tôi', category: 'Cá nhân' },
    { key: '/submissions', defaultLabel: 'Bài nộp của tôi', category: 'Cá nhân' },
    { key: '/analytics', defaultLabel: 'Thống kê', category: 'Thống kê' },
    { key: '/ai-quota', defaultLabel: 'Hạn mức AI', category: 'Hệ thống' },
  ]

  const filteredItems = menuItems.filter(item => 
    item.defaultLabel.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.key.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
              <LayoutPanelLeft size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Tùy chỉnh nhãn Menu</h3>
              <p className="text-xs font-medium text-slate-500">Thay đổi tên hiển thị của các mục trên Sidebar</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Tìm kiếm menu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none w-full md:w-64"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 w-full md:w-auto"
            >
              {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Lưu thay đổi
            </button>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Phân loại</th>
                <th className="px-6 py-4">Tên gốc (Default)</th>
                <th className="px-6 py-4">Key / Path</th>
                <th className="px-6 py-4">Tên tùy chỉnh (Custom Label)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map((item) => (
                <tr key={item.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {item.defaultLabel}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">
                    {item.key}
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={localSettings[item.key] ?? ''}
                      onChange={(e) => handleChange(item.key, e.target.value)}
                      placeholder={item.defaultLabel}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredItems.map((item) => (
            <div key={item.key} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase shrink-0">
                    {item.category}
                  </span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{item.defaultLabel}</p>
                </div>
                <span className="text-xs font-mono text-slate-400 shrink-0">{item.key}</span>
              </div>
              <input
                type="text"
                value={localSettings[item.key] ?? ''}
                onChange={(e) => handleChange(item.key, e.target.value)}
                placeholder={item.defaultLabel}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ========== NOTIFICATION SETTINGS TAB ========== */
const EVENT_LABELS: Record<string, string> = {
  kpi_submitted: 'Khi chỉ tiêu KPI được gửi chờ phê duyệt (dành cho người duyệt)',
  kpi_assigned: 'Khi được giao chỉ tiêu mới',
  kpi_approved: 'Khi chỉ tiêu được phê duyệt',
  kpi_rejected: 'Khi chỉ tiêu bị từ chối',
  kpi_approval_reverted: 'Khi phê duyệt chỉ tiêu bị hoàn lại',
  submission_submitted: 'Khi nhân viên nộp báo cáo KPI (dành cho quản lý)',
  submission_reviewed: 'Khi bài nộp được chấm điểm',
  reminder_deadline: 'Nhắc nhở sắp đến hạn nộp (24h)',
}

const DEFAULT_SETTINGS: NotificationConfigItem[] = Object.keys(EVENT_LABELS).map(code => ({
  eventCode: code,
  emailEnabled: true,
  systemEnabled: true,
}))

function NotificationSettingsTab() {
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<NotificationConfigItem[]>(DEFAULT_SETTINGS)

  const { data: serverConfig, isLoading } = useQuery({
    queryKey: ['notification-config'],
    queryFn: notificationApi.getNotificationConfig,
  })

  useEffect(() => {
    if (serverConfig) {
      setSettings(serverConfig)
    }
  }, [serverConfig])

  const { mutate: saveConfig, isPending: isSaving } = useMutation({
    mutationFn: () => notificationApi.saveNotificationConfig(settings),
    onSuccess: (data) => {
      queryClient.setQueryData(['notification-config'], data)
      toast.success('Đã lưu cấu hình thông báo')
    },
    onError: () => {
      toast.error('Lưu cấu hình thất bại')
    },
  })

  const toggle = (eventCode: string, type: 'emailEnabled' | 'systemEnabled') => {
    setSettings(prev => prev.map(s => s.eventCode === eventCode ? { ...s, [type]: !s[type] } : s))
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 shrink-0">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Cấu hình thông báo</h3>
              <p className="text-xs font-medium text-slate-500">Thiết lập cách thức nhận thông báo của tổ chức</p>
            </div>
          </div>

          <button
            onClick={() => saveConfig()}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all shrink-0 disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Lưu cấu hình
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
              Các thiết lập này sẽ áp dụng mặc định cho tất cả nhân viên trong tổ chức. Nhân viên có thể tùy chỉnh lại trong trang cá nhân của họ nếu được phép.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {settings.map((item) => (
                <div key={item.eventCode} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {EVENT_LABELS[item.eventCode] ?? item.eventCode}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">Mã sự kiện: {item.eventCode}</p>
                  </div>
                  <div className="flex items-center gap-8">
                    <ToggleItem
                      label="Email"
                      active={item.emailEnabled}
                      onClick={() => toggle(item.eventCode, 'emailEnabled')}
                    />
                    <ToggleItem
                      label="Hệ thống"
                      active={item.systemEnabled}
                      onClick={() => toggle(item.eventCode, 'systemEnabled')}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ToggleItem({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <button 
        onClick={onClick}
        className={cn(
          "w-12 h-6 rounded-full relative transition-all duration-300",
          active ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
        )}
      >
        <div className={cn(
          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
          active ? "left-7" : "left-1"
        )} />
      </button>
    </div>
  )
}
