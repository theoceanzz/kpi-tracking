import { LocaleNumberInput } from '@/components/ui/number-input'
import { useState, useEffect, useMemo } from 'react'
import { Save, Info, Loader2, Search, Bell, PanelLeft, FileText as FileIcon, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarSettings, useUpdateSidebarSettings } from '../hooks/useSidebarSettings'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi, type NotificationConfigItem } from '@/features/notifications/api/notificationApi'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { collectNavLabelScopes, type NavLabelEntry } from '@/config/navigation'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

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
  const { t } = useTranslation('organization')
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
    enableConduct: org?.enableConduct || false,
    enableFeedback360: org?.enableFeedback360 || false,
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
        toast.success(t('SystemSettingsTabs.navigationLabelsUpdated'))
      },
    })
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-[var(--color-primary)]" /></div>

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
      <div id="tour-sidebar-header" className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
            <h3 className="text-section-title">{t('SystemSettingsTabs.customizeNavigationLabels')}</h3>
            <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
              {t('SystemSettingsTabs.renameSidebarRowsAndTheItems')}
              {customCount > 0 && <> · <span className="text-[var(--color-primary)] font-semibold">{customCount} {t('SystemSettingsTabs.itemsRenamed')}</span></>}
            </p>
          </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" size={16} />
            <input
              type="text"
              placeholder={t('SystemSettingsTabs.searchItems')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm focus:ring-2 focus:ring-[var(--color-ring)] outline-none w-full md:w-56"
            />
          </div>
          <Button className="w-full md:w-auto" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            {t('SystemSettingsTabs.saveChanges')}
          </Button>
        </div>
      </div>

      <div id="tour-sidebar-note" className="p-4 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)] flex items-start gap-3">
        <Info size={18} className="text-[var(--color-info)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--color-info)] font-medium leading-relaxed">
          {t('SystemSettingsTabs.mostScreensAreNow')} <b>{t('SystemSettingsTabs.itemsInsideAPage')}</b> {t('SystemSettingsTabs.ratherThanSeparateRowsOnThe')}
        </p>
      </div>

      {visibleScopes.map(scope => {
        const isSidebar = scope.id === '__sidebar__'
        return (
          <div
            key={scope.id}
            id={isSidebar ? 'tour-sidebar-scope-sidebar' : undefined}
            className="tour-sidebar-scope overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]"
          >
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
              <div className={cn(
                'w-9 h-9 rounded-card flex items-center justify-center shrink-0',
                isSidebar
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
              )}>
                {isSidebar ? <PanelLeft size={18} /> : <FileIcon size={18} />}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-[var(--color-foreground)] truncate">
                  {isSidebar ? scope.title : `Trong trang: ${scope.title}`}
                </h4>
                <p className="text-caption">{scope.hint}</p>
              </div>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {scope.entries.map(entry => {
                const value = valueOf(entry)
                const renamed = !!value.trim() && value !== entry.defaultLabel
                return (
                  <div key={entry.key} className="px-6 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="lg:w-[38%] min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-[var(--color-foreground)]">{entry.defaultLabel}</p>
                        {entry.group && (
                          <span className="px-2 py-0.5 rounded-control bg-[var(--color-muted)] text-eyebrow">
                            {entry.group}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-[var(--color-subtle-foreground)] mt-0.5 truncate">{entry.key}</p>
                    </div>

                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => handleChange(entry, e.target.value)}
                        placeholder={entry.defaultLabel}
                        className={cn(
                          'flex-1 min-w-0 px-4 py-2 rounded-card border bg-[var(--color-card)] text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--color-ring)]',
                          renamed
                            ? 'border-[var(--color-primary)]'
                            : 'border-[var(--color-border)]'
                        )}
                      />
                      <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={t('SystemSettingsTabs.backToDefaultName')} type="button" onClick={() => handleChange(entry, '')} disabled={!value} title={t('SystemSettingsTabs.backToDefaultName')}>
                        <RotateCcw aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {visibleScopes.length === 0 && (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('SystemSettingsTabs.noItemMatches')}{searchTerm}"
        </div>
      )}
    </div>
  )
}

/* ========== NOTIFICATION SETTINGS TAB ========== */
const EVENT_LABELS = perLanguage((): Record<string, string> => ({
  kpi_submitted: i18n.t('organization:SystemSettingsTabs.whenAKpiIsSubmittedFor'),
  kpi_approval_reminder: i18n.t('organization:SystemSettingsTabs.remindTheCurrentStepHolderWhen'),
  kpi_assigned: i18n.t('organization:SystemSettingsTabs.whenAssignedANewKpi'),
  kpi_approved: i18n.t('organization:SystemSettingsTabs.whenAKpiIsApproved'),
  kpi_rejected: i18n.t('organization:SystemSettingsTabs.whenAKpiIsRejected'),
  kpi_approval_reverted: i18n.t('organization:SystemSettingsTabs.whenAKpiApprovalIsReverted'),
  submission_submitted: i18n.t('organization:SystemSettingsTabs.whenAnEmployeeSubmitsAKpi'),
  submission_reviewed: i18n.t('organization:SystemSettingsTabs.whenASubmissionIsScored'),
  submission_returned: i18n.t('organization:SystemSettingsTabs.whenASubmissionIsReturned'),
  submission_escalated: i18n.t('organization:SystemSettingsTabs.whenASubordinateHasFinishedApproving'),
  reminder_deadline: i18n.t('organization:SystemSettingsTabs.upcomingSubmissionDeadlineReminder24h'),
  evaluation_period_due: i18n.t('organization:SystemSettingsTabs.remindUnitHeadsWhenAPeriod'),
  evaluation_cycle_due: i18n.t('organization:SystemSettingsTabs.remindUnitHeadsWhenACycle'),
  evaluation_finalized: i18n.t('organization:SystemSettingsTabs.whenYourPeriodEvaluationResultsAre'),
  cycle_unit_finalized: i18n.t('organization:SystemSettingsTabs.whenALowerUnitFinalizesThe'),
  bsc_scorecard_submitted: i18n.t('organization:SystemSettingsTabs.whenAUnitSubmitsABsc'),
  bsc_scorecard_approved: i18n.t('organization:SystemSettingsTabs.whenABscScorecardIsApproved'),
  bsc_scorecard_rejected: i18n.t('organization:SystemSettingsTabs.whenABscScorecardIsReturned'),
  bsc_scorecard_activated: i18n.t('organization:SystemSettingsTabs.whenABscScorecardIsApplied'),
  bsc_scorecard_locked: i18n.t('organization:SystemSettingsTabs.whenABscScorecardIsLocked'),
  bsc_cascaded: i18n.t('organization:SystemSettingsTabs.whenTheParentAssignsBscKpis'),
  bsc_unit_result_finalized: i18n.t('organization:SystemSettingsTabs.whenTheUnitsBscResultsFor'),
  bsc_score_overridden: i18n.t('organization:SystemSettingsTabs.whenAnIndividualsBscScoreIs'),
  ai_criteria_change_requested: i18n.t('organization:SystemSettingsTabs.whenASubordinateRequestsChangingAiRules'),
  ai_criteria_change_decided: i18n.t('organization:SystemSettingsTabs.whenYourAiRulesRequestIsDecided'),
  reward_grant_submitted: i18n.t('organization:SystemSettingsTabs.whenARewardProposalExceedingThe'),
  reward_grant_approved: i18n.t('organization:SystemSettingsTabs.whenARewardProposalIsApproved'),
  reward_grant_rejected: i18n.t('organization:SystemSettingsTabs.whenARewardProposalIsRejected'),
  reward_grant_cancelled: i18n.t('organization:SystemSettingsTabs.whenTheGiverWithdrawsAPending'),
  reward_points_received: i18n.t('organization:SystemSettingsTabs.whenRewardPointsAreAddedTo'),
  reward_grant_revoked: i18n.t('organization:SystemSettingsTabs.whenAGrantedRewardIsRevoked'),
  reward_budget_assigned: i18n.t('organization:SystemSettingsTabs.whenARewardBudgetIsGranted'),
  reward_program_issued: i18n.t('organization:SystemSettingsTabs.whenARewardProgramAutomaticallyAwards'),
  reward_program_reverted: i18n.t('organization:SystemSettingsTabs.whenAProgramRewardRunIs'),
  reward_redemption_created: i18n.t('organization:SystemSettingsTabs.whenAnEmployeeOrdersAGift'),
  reward_redemption_approved: i18n.t('organization:SystemSettingsTabs.whenAGiftRedemptionRequestIs'),
  reward_redemption_rejected: i18n.t('organization:SystemSettingsTabs.whenAGiftRedemptionRequestIs2'),
  reward_redemption_delivered: i18n.t('organization:SystemSettingsTabs.whenTheGiftHasBeenHanded'),
  reward_redemption_failed: i18n.t('organization:SystemSettingsTabs.whenTheGiftCouldNotBe'),
  reward_redemption_cancelled: i18n.t('organization:SystemSettingsTabs.whenTheRedeemerCancelsTheirOwn'),
  wallet_topup_paid: i18n.t('organization:SystemSettingsTabs.whenABankTransferArrivesAnd'),
  wallet_topup_expired: i18n.t('organization:SystemSettingsTabs.whenATopUpOrderExpires'),
  wallet_topup_unmatched: i18n.t('organization:SystemSettingsTabs.whenMoneyArrivesThatMatchesNo'),
  wallet_converted: i18n.t('organization:SystemSettingsTabs.whenConvertingWalletCashBalanceInto'),
}))

const DEFAULT_SETTINGS = perLanguage((): NotificationConfigItem[] => (Object.keys(EVENT_LABELS()).map(code => ({
  eventCode: code,
  emailEnabled: true,
  systemEnabled: true,
}))))

export function NotificationSettingsTab() {
  const { t } = useTranslation('organization')
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<NotificationConfigItem[]>(DEFAULT_SETTINGS())

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
      toast.success(t('SystemSettingsTabs.notificationSettingsSaved'))
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t('SystemSettingsTabs.failedToSaveNotificationSettings')))
    },
  })

  const toggle = (eventCode: string, type: 'emailEnabled' | 'systemEnabled') => {
    setSettings(prev => prev.map(s => s.eventCode === eventCode ? { ...s, [type]: !s[type] } : s))
  }

  return (
    <div className="space-y-6">
      <EvaluationReminderCard />

      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div id="tour-notif-header" className="px-5 py-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-section-title">{t('SystemSettingsTabs.notificationSettings')}</h3>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">{t('SystemSettingsTabs.setUpHowTheOrganizationReceives')}</p>
          </div>

          <Button className="shrink-0" onClick={() => saveConfig()} disabled={isSaving}>
            {isSaving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            {t('SystemSettingsTabs.saveSettings')}
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-4 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)] flex items-start gap-3">
            <Info size={18} className="text-[var(--color-info)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--color-info)] font-medium leading-relaxed">
              {t('SystemSettingsTabs.theseSettingsApplyByDefaultTo')}
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
            </div>
          ) : (
            <div id="tour-notif-events" className="divide-y divide-[var(--color-border)]">
              {settings.map((item) => (
                <div key={item.eventCode} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-foreground)]">
                      {EVENT_LABELS()[item.eventCode] ?? item.eventCode}
                    </p>
                    <p className="text-caption font-medium">{t('SystemSettingsTabs.eventCode')} {item.eventCode}</p>
                  </div>
                  <div className="flex items-center gap-8">
                    <ToggleItem
                      label="Email"
                      active={item.emailEnabled}
                      onClick={() => toggle(item.eventCode, 'emailEnabled')}
                    />
                    <ToggleItem
                      label={t('SystemSettingsTabs.system')}
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

/**
 * Ngưỡng nhắc hạn ĐÁNH GIÁ (khác với nhắc hạn NỘP báo cáo, vốn tính theo % thời gian của
 * từng lô nộp và cấu hình ở nơi khác).
 *
 * Đặt ngay trên bảng bật/tắt sự kiện vì hai thứ đi cùng nhau: bật `evaluation_period_due`
 * mà để 0 ngày thì không ai nhận được gì, và ngược lại.
 */
function EvaluationReminderCard() {
  const { t } = useTranslation('organization')
  const user = useAuthStore(s => s.user)
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org, updateOrganization, isUpdating } = useOrganization(orgId)

  const [days, setDays] = useState<string>('')
  // Nạp lại khi tổ chức về, nhưng không đè lên số người dùng đang gõ dở.
  const [syncedOrgId, setSyncedOrgId] = useState<string | undefined>(undefined)
  if (org && syncedOrgId !== org.id) {
    setSyncedOrgId(org.id)
    setDays(String(org.evaluationReminderDays ?? 3))
  }

  const parsed = days.trim() === '' ? null : Number(days)
  const invalid = parsed == null || Number.isNaN(parsed) || parsed < 0 || parsed > 60
  const dirty = org != null && !invalid && parsed !== (org.evaluationReminderDays ?? 3)

  const save = () => {
    if (invalid) {
      toast.error(t('SystemSettingsTabs.theNumberOfReminderDaysMust'))
      return
    }
    updateOrganization({ evaluationReminderDays: parsed })
  }

  return (
    <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-10 h-10 rounded-card bg-[var(--color-info-bg)] flex items-center justify-center text-[var(--color-info)] shrink-0">
          <Bell size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-section-title">{t('SystemSettingsTabs.periodCycleEvaluationDeadlineReminders')}</h3>
          <p className="text-xs font-medium text-[var(--color-muted-foreground)] leading-relaxed">
            {t('SystemSettingsTabs.remindUnitHeadsBeforeAPeriod')}
          </p>
        </div>
        <div className="flex items-end gap-2 shrink-0">
          <label className="flex flex-col gap-1.5">
            <span className="text-eyebrow">{t('SystemSettingsTabs.remindInAdvance')}</span>
            <div className="flex items-center gap-2">
              <LocaleNumberInput
                type="number" min={0} max={60} value={days}
                onChange={e => setDays(e.target.value)}
                className={cn(
                  'w-20 h-9 px-3 rounded-card border bg-[var(--color-muted)] text-sm font-semibold outline-none focus:ring-4 focus:ring-[var(--color-info-solid)]',
                  invalid ? 'border-[var(--color-error-border)]' : 'border-[var(--color-border)]',
                )}
              />
              <span className="text-caption">{t('SystemSettingsTabs.days')}</span>
            </div>
          </label>
          <Button onClick={save} disabled={isUpdating || !dirty}>
            {isUpdating ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            {t('SystemSettingsTabs.save')}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-caption">
        {t('SystemSettingsTabs.setThe')} <b>0</b> {t('SystemSettingsTabs.toTurnOffEvaluationDeadlineReminders')}
      </p>
    </div>
  )
}

function ToggleItem({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-caption">{label}</span>
      <button 
        onClick={onClick}
        className={cn(
          "w-12 h-6 rounded-full relative transition-all duration-300",
          active ? "bg-[var(--color-success-solid)]" : "bg-[var(--color-border)]"
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
