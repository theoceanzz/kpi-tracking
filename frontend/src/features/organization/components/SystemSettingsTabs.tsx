import { useState, useEffect, useMemo } from 'react'
import { LayoutPanelLeft, Save, Info, Loader2, Search, Bell, PanelLeft, FileText as FileIcon, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarSettings, useUpdateSidebarSettings } from '../hooks/useSidebarSettings'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi, type NotificationConfigItem } from '@/features/notifications/api/notificationApi'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { collectNavLabelScopes, type NavLabelEntry } from '@/config/navigation'

/**
 * Hai khối cấu hình hệ thống, tách khỏi trang cũ để gắn vào menu trong trang
 * "Thiết lập công ty". Nội dung giữ nguyên.
 */

/* ========== SIDEBAR SETTINGS TAB ========== */

/** Nhãn đang thực sự hiển thị của một mục: khoá hiện tại → khoá cũ → nhãn gốc. */
function savedLabelOf(entry: NavLabelEntry, saved: Record<string, string>): string {
  return saved[entry.key] || entry.legacyKeys?.map(k => saved[k]).find(Boolean) || ''
}

/**
 * Đổi tên các mục điều hướng.
 *
 * Hai NƠI khác nhau, cùng một cơ chế lưu: dòng trên sidebar, và mục bên trong từng
 * trang (chọn bằng `?section=`). Từ khi phần lớn màn hình chuyển vào trang, một bảng
 * phẳng không còn đọc được nữa nên ở đây tách thành từng khối theo nơi xuất hiện.
 */
export function SidebarSettingsTab() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: settings, isLoading } = useSidebarSettings(organizationId!)
  const updateMutation = useUpdateSidebarSettings()
  const { data: org } = useOrganization(organizationId)

  // CHỈ giữ phần người dùng vừa sửa, không sao chép cả bảng nhãn vào state. Nhãn đã lưu
  // là nguồn sự thật; ô nhập đọc `draft ?? nhãn đã lưu`. Cách cũ (đổ nguyên `settings`
  // vào state trong useEffect) vừa thừa vừa dễ đá nhau khi query trả về lại giữa chừng.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')

  // Dẫn xuất thẳng từ cây nav dùng chung. Trước đây đây là một bản sao viết tay của
  // navItems và đã lệch: khoá chết '/kpi-criteria/adjustments', vài nhãn mặc định sai,
  // thiếu hẳn AI/thưởng/ví. Thêm mục nav mới giờ tự hiện ở đây.
  const scopes = useMemo(() => collectNavLabelScopes({
    enableOkr: org?.enableOkr || false,
    enableBsc: org?.enableBsc || false,
    enableReward: org?.enableReward || false,
    enableCashWallet: org?.enableCashWallet || false,
    enableAi: org?.enableAi !== false,
  }), [org])

  const saved = useMemo(() => settings ?? {}, [settings])

  /** Giá trị hiện trong ô nhập: bản nháp chưa lưu, nếu không thì nhãn đang thực sự dùng. */
  const valueOf = (entry: NavLabelEntry) => drafts[entry.key] ?? savedLabelOf(entry, saved)

  const handleChange = (entry: NavLabelEntry, value: string) => {
    setDrafts(prev => ({ ...prev, [entry.key]: value }))
  }

  const handleSave = () => {
    if (!organizationId) return

    // Giữ nguyên mọi khoá đã có trong DB (kể cả khoá cũ của mục khác) rồi mới đắp thay đổi
    // lên trên — gửi thiếu là xoá nhầm nhãn của mục mình không đụng tới.
    const payload: Record<string, string> = { ...saved }
    for (const scope of scopes) {
      for (const entry of scope.entries) {
        const draft = drafts[entry.key]
        if (draft === undefined) {
          // Không sửa gì. Nhưng nếu mục đang hiển thị nhờ tra dự phòng ở khoá CŨ thì
          // chuyển nhãn sang khoá hiện tại, để lần sau không phải tra dự phòng nữa.
          const current = savedLabelOf(entry, saved)
          if (current && !saved[entry.key]) payload[entry.key] = current
          continue
        }
        payload[entry.key] = draft
        // Xoá trắng nghĩa là "về tên mặc định" ⇒ phải xoá cả nhãn lưu ở khoá CŨ, nếu không
        // mục sẽ rơi ngược về nhãn cũ (`legacyKeys`) chứ không về tên gốc.
        if (!draft.trim()) entry.legacyKeys?.forEach(k => { if (saved[k]) payload[k] = '' })
      }
    }

    updateMutation.mutate({ organizationId, settings: payload }, {
      onSuccess: () => {
        setDrafts({})
        toast.success('Đã cập nhật nhãn điều hướng')
      },
    })
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-600" /></div>

  const term = searchTerm.trim().toLowerCase()
  const matches = (entry: NavLabelEntry) =>
    !term ||
    entry.defaultLabel.toLowerCase().includes(term) ||
    entry.key.toLowerCase().includes(term) ||
    valueOf(entry).toLowerCase().includes(term)

  const visibleScopes = scopes
    .map(scope => ({ ...scope, entries: scope.entries.filter(matches) }))
    .filter(scope => scope.entries.length > 0)

  const customCount = scopes.reduce(
    (n, scope) => n + scope.entries.filter(e => {
      const v = valueOf(e).trim()
      return !!v && v !== e.defaultLabel
    }).length,
    0
  )

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shrink-0">
            <LayoutPanelLeft size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 dark:text-white">Tùy chỉnh nhãn điều hướng</h3>
            <p className="text-xs font-medium text-slate-500">
              Đổi tên dòng trên sidebar và mục bên trong từng trang cho hợp thuật ngữ công ty
              {customCount > 0 && <> · <span className="text-indigo-600 font-bold">{customCount} mục đang đổi tên</span></>}
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Tìm mục..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none w-full md:w-56"
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

      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
          Phần lớn màn hình nay là <b>mục bên trong một trang</b> chứ không còn là dòng riêng trên sidebar —
          chúng được xếp theo từng trang bên dưới. Để trống ô nhập là mục đó quay về tên mặc định.
        </p>
      </div>

      {visibleScopes.map(scope => {
        const isSidebar = scope.id === '__sidebar__'
        return (
          <div key={scope.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                isSidebar
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              )}>
                {isSidebar ? <PanelLeft size={18} /> : <FileIcon size={18} />}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {isSidebar ? scope.title : `Trong trang: ${scope.title}`}
                </h4>
                <p className="text-[11px] font-medium text-slate-500">{scope.hint}</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {scope.entries.map(entry => {
                const value = valueOf(entry)
                const renamed = !!value.trim() && value !== entry.defaultLabel
                return (
                  <div key={entry.key} className="px-6 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="lg:w-[38%] min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{entry.defaultLabel}</p>
                        {entry.group && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase">
                            {entry.group}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">{entry.key}</p>
                    </div>

                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => handleChange(entry, e.target.value)}
                        placeholder={entry.defaultLabel}
                        className={cn(
                          'flex-1 min-w-0 px-4 py-2 rounded-xl border bg-white dark:bg-slate-900 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20',
                          renamed
                            ? 'border-indigo-300 dark:border-indigo-700'
                            : 'border-slate-200 dark:border-slate-700'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => handleChange(entry, '')}
                        disabled={!value}
                        title="Về tên mặc định"
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 shrink-0"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {visibleScopes.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 text-center text-sm font-medium text-slate-400">
          Không có mục nào khớp "{searchTerm}"
        </div>
      )}
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
  submission_submitted: 'Khi nhân viên nộp báo cáo KPI (dành cho trưởng đơn vị trực tiếp)',
  submission_reviewed: 'Khi bài nộp được chấm điểm',
  submission_escalated: 'Khi cấp dưới đã duyệt xong báo cáo (báo lên cấp trên kế tiếp)',
  reminder_deadline: 'Nhắc nhở sắp đến hạn nộp (24h)',
}

const DEFAULT_SETTINGS: NotificationConfigItem[] = Object.keys(EVENT_LABELS).map(code => ({
  eventCode: code,
  emailEnabled: true,
  systemEnabled: true,
}))

export function NotificationSettingsTab() {
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
