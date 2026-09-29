import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { larkCredentialsSchema, type LarkCredentialsFormData } from '../schemas/integrationSchema'
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
  Lock,
  Rocket,
  Unlink,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { useOrgUnitTree } from '../hooks/useOrganizationStructure'
import { useRoles } from '../hooks/useRoles'
import { larkSettingApi, type LarkConnectResult } from '../api/lark-setting.api'
import {
  useConfirmLarkConnection,
  useDisconnectLark,
  useLarkSettings,
  useTestLarkConnection,
  useUpdateLarkSettings,
} from '../hooks/useLarkSettings'
import { LARK_CONNECT_RESULT_KEY } from '@/features/auth/pages/LarkCallbackPage'
import { LARK_PURPOSE_KEY, LARK_STATE_KEY } from '@/features/auth/hooks/useLarkLogin'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

const LARK_CONSOLE_URL = 'https://open.larksuite.com/app'

function StepCard({
  id,
  step,
  title,
  description,
  done,
  disabled,
  children,
}: {
  /** Neo cho hướng dẫn — mỗi bước cấu hình là một bước riêng trong bài. */
  id?: string
  step: number
  title: string
  description?: string
  done?: boolean
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-card border p-5 transition-all',
        disabled
          ? 'border-[var(--color-border)] bg-[var(--color-muted)]/20 opacity-55'
          : 'border-[var(--color-border)] bg-[var(--color-card)]'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            done
              ? 'bg-[var(--color-success-solid)] text-white'
              : disabled
                ? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                : 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
          )}
        >
          {done ? <Check size={14} strokeWidth={4} /> : step}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-section-title">{title}</h3>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              {description}
            </p>
          )}
          {children && <div className={cn('mt-4', disabled && 'pointer-events-none')}>{children}</div>}
        </div>
      </div>
    </div>
  )
}

/** Nút copy chữ. CopyButton ở components/common chỉ copy ảnh của một DOM ref nên không dùng được. */
function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation('organization')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('LarkSettingsTab.couldNotCopyPleaseSelectAnd'))
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-eyebrow">
          {label}
        </p>
        <p className="truncate font-mono text-xs text-[var(--color-foreground)]">{value}</p>
      </div>
      <Button variant="secondary" className="shrink-0" type="button" onClick={handleCopy} title={t('LarkSettingsTab.copy')}>
        {copied ? <Check aria-hidden="true" className="text-[var(--color-success)]" /> : <Copy aria-hidden="true" />}
      </Button>
    </div>
  )
}

/** Logo doanh nghiệp Lark, rơi về icon toà nhà khi thiếu URL hoặc ảnh tải lỗi. */
function TenantLogo({ url, size = 44 }: { url?: string | null; size?: number }) {
  const { t } = useTranslation('organization')
  const [failed, setFailed] = useState(false)

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={t('LarkSettingsTab.companyLogo')}
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-card object-cover"
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-card bg-[var(--color-muted)]"
    >
      <Building2 size={size * 0.45} className="text-[var(--color-primary)]" />
    </div>
  )
}

const inputCls =
  'w-full rounded-card border border-[var(--color-border)] bg-[var(--color-background)] px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20'

export default function LarkSettingsTab() {
  const { t } = useTranslation('organization')
  const user = useAuthStore((s) => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId

  const { data: settings, isLoading } = useLarkSettings(organizationId)
  const updateSettings = useUpdateLarkSettings(organizationId)
  const testConnection = useTestLarkConnection(organizationId)
  const confirmConnection = useConfirmLarkConnection(organizationId)
  const disconnect = useDisconnectLark(organizationId)

  const { data: orgTree } = useOrgUnitTree(organizationId)
  const { data: roles } = useRoles()

  const { register, handleSubmit: handleCredentialsSubmit, setValue, formState: { errors } } = useForm<LarkCredentialsFormData>({
    resolver: zodResolver(larkCredentialsSchema()),
    defaultValues: { appId: '', appSecret: '' },
  })
  const [pendingConnect, setPendingConnect] = useState<LarkConnectResult | null>(null)

  useEffect(() => {
    // Chỉ nạp lại App ID: App Secret không bao giờ được trả về, ô để trống = giữ nguyên.
    if (settings) setValue('appId', settings.appId ?? '', { shouldValidate: true })
  }, [settings, setValue])

  // Quản trị viên vừa đăng nhập Lark xong và được chuyển về đây
  useEffect(() => {
    const raw = sessionStorage.getItem(LARK_CONNECT_RESULT_KEY)
    if (!raw) return
    sessionStorage.removeItem(LARK_CONNECT_RESULT_KEY)
    try {
      setPendingConnect(JSON.parse(raw) as LarkConnectResult)
    } catch {
      /* bỏ qua dữ liệu hỏng */
    }
  }, [])

  const flattenedUnits = useMemo(() => {
    const list: { id: string; name: string; level: number }[] = []
    const flatten = (nodes: any[]) => {
      nodes.forEach((node) => {
        list.push({ id: node.id, name: node.name, level: node.level ?? 0 })
        if (node.children?.length) flatten(node.children)
      })
    }
    if (orgTree) flatten(orgTree as any[])
    return list
  }, [orgTree])

  const connectMutation = useMutation({
    mutationFn: () => larkSettingApi.getConnectUrl(organizationId!),
    onSuccess: (res) => {
      sessionStorage.setItem(LARK_STATE_KEY, res.state)
      sessionStorage.setItem(LARK_PURPOSE_KEY, 'connect')
      window.location.href = res.authorizeUrl
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, t('LarkSettingsTab.couldNotOpenTheLarkSign')))
    },
  })

  if (isLoading || !settings) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  const isCustomApp = settings.connectionMode === 'CUSTOM_APP'
  const hasCredentials = !!settings.appId && settings.hasAppSecret
  const isVerified = !!settings.verifiedAt
  const hasDefaults = !!settings.defaultOrgUnitId && !!settings.defaultRoleId
  const canEnable = settings.missingRequirements.length === 0

  return (
    <div className="space-y-4">
      {/* Trạng thái tổng quan */}
      <div
        id="tour-lark-status"
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-card border p-4',
          settings.larkEnabled
            ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] dark:border-[var(--color-success-border)] dark:bg-[var(--color-success-bg)]'
            : 'border-[var(--color-border)] bg-[var(--color-muted)]/30'
        )}
      >
        {isVerified ? (
          <TenantLogo url={settings.tenantAvatarUrl} size={36} />
        ) : (
          <AlertCircle size={20} className="text-[var(--color-muted-foreground)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-foreground)]">
            {settings.larkEnabled && (
              <CheckCircle2 size={15} className="text-[var(--color-success)]" />
            )}
            {settings.larkEnabled ? t('LarkSettingsTab.larkSignInIsOn') : t('LarkSettingsTab.larkSignInIsNotOn')}
          </p>
          {isVerified && (
            <p className="truncate text-xs text-[var(--color-muted-foreground)]">
              {t('LarkSettingsTab.linked')}{settings.tenantName ? t('LarkSettingsTab.to', { tenantName: settings.tenantName }) : t('LarkSettingsTab.toALarkOrganization')}
            </p>
          )}
        </div>
        {isVerified && (
          <Button variant="outline" size="sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" type="button" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
            {disconnect.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Unlink aria-hidden="true" />}
            {t('LarkSettingsTab.unlink')}
          </Button>
        )}
      </div>

      {/* Thẻ xác nhận sau khi quản trị viên đăng nhập Lark */}
      {pendingConnect && (
        <div className="animate-in fade-in slide-in-from-top-1 rounded-card border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5 p-5">
          <h3 className="text-section-title">
            {t('LarkSettingsTab.isThisReallyYourCompany')}
          </h3>
          <div className="mt-4 flex items-center gap-3 rounded-card bg-[var(--color-background)] p-3.5">
            <TenantLogo url={pendingConnect.tenantAvatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]">
                {pendingConnect.tenantName || t('LarkSettingsTab.yourLarkOrganization')}
              </p>
              <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                {pendingConnect.userName}
                {pendingConnect.userEmail ? ` · ${pendingConnect.userEmail}` : ''}
              </p>
            </div>
          </div>

          {pendingConnect.usingSavedProfile && (
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                {t('LarkSettingsTab.thisTimeTheNameAndLogo')}{' '}
                <span className="font-semibold text-[var(--color-foreground)]">{t('LarkSettingsTab.keep')}</span> {t('LarkSettingsTab.theCurrentValuesToRefreshThem')}{' '}
                <span className="font-mono">tenant:tenant:readonly</span> {t('LarkSettingsTab.andThenPublishANewVersion')}
              </span>
            </p>
          )}

          {pendingConnect.alreadyLinked && (
            <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-[var(--color-error)]">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {t('LarkSettingsTab.thisLarkOrganizationIsAlreadyLinked')}{' '}
              {pendingConnect.alreadyLinkedOrganizationName}{t('LarkSettingsTab.itCannotBeLinkedAgain')}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Button type="button" disabled={pendingConnect.alreadyLinked || confirmConnection.isPending} onClick={() =>
                confirmConnection.mutate(pendingConnect.pendingToken, {
                  onSuccess: () => setPendingConnect(null),
                })
              }>
              {confirmConnection.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
              {t('LarkSettingsTab.confirmLink')}
            </Button>
            <Button variant="outline" type="button" onClick={() => setPendingConnect(null)}>
              {t('LarkSettingsTab.cancel')}
            </Button>
          </div>
        </div>
      )}

      {isCustomApp && (
        <>
          <StepCard
            step={1}
            title={t('LarkSettingsTab.createAnAppOnLark')}
            description={t('LarkSettingsTab.aLarkAdminAccountIsRequired')}
          >
            <div className="mb-3 flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 dark:border-[var(--color-warning-border)] dark:bg-[var(--color-warning-bg)]">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
              <p className="text-xs leading-relaxed text-[var(--color-warning)]">
                {t('LarkSettingsTab.theAppMustBeCreated')} <span className="font-semibold">{t('LarkSettingsTab.insideThisCompanysOwnLarkOrganization')}</span>{t('LarkSettingsTab.ifYouUseAnAppFrom')}
              </p>
            </div>
            <a
              href={LARK_CONSOLE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-card border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]/50"
            >
              {t('LarkSettingsTab.openTheLarkDeveloperConsole')}
              <ExternalLink size={14} />
            </a>
          </StepCard>

          <StepCard
            step={2}
            title={t('LarkSettingsTab.configureInTheLarkApp')}
            description={t('LarkSettingsTab.copyTheValuesBelowAndPaste')}
          >
            <div className="space-y-2">
              <CopyRow label={t('LarkSettingsTab.redirectUrlSecuritySettingsSection')} value={settings.redirectUri} />
              {settings.requiredScopes.map((scope) => (
                <CopyRow key={scope} label={t('LarkSettingsTab.permissionsToEnablePermissionsScopesSection')} value={scope} />
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
              {t('LarkSettingsTab.thePermission')} <span className="font-mono">tenant:tenant:readonly</span> {t('LarkSettingsTab.isOptionalAndOnlyUsedTo')}
            </p>

            <div className="mt-4 space-y-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/25 p-3.5">
              <div className="flex items-start gap-2">
                <Users size={15} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <div>
                  <p className="text-xs font-medium text-[var(--color-foreground)]">
                    {t('LarkSettingsTab.availability')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                    {t('LarkSettingsTab.openTheSection')} <span className="font-semibold">Availability</span> {t('LarkSettingsTab.andChoose')}{' '}
                    <span className="font-semibold">{t('LarkSettingsTab.allEmployees')}</span> {t('LarkSettingsTab.orTheDepartmentsThatNeedKeygo')} <span className="font-mono">"You don't have the access"</span>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 border-t border-[var(--color-border)] pt-3">
                <Rocket size={15} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <div>
                  <p className="text-xs font-medium text-[var(--color-foreground)]">
                    {t('LarkSettingsTab.publishAVersion')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                    {t('LarkSettingsTab.goTo')} <span className="font-semibold">Version Management &amp; Release</span>{t('LarkSettingsTab.createAVersionRequestPublishingAnd')} <span className="font-semibold">{t('LarkSettingsTab.doNotTakeEffect')}</span> {t('LarkSettingsTab.untilTheVersionIsApprovedJust')}
                  </p>
                </div>
              </div>
            </div>
          </StepCard>

          <StepCard
            id="tour-lark-credentials"
            step={3}
            title={t('LarkSettingsTab.enterTheAppIdAndApp')}
            description={t('LarkSettingsTab.foundOnTheCredentialsBasicInfo')}
            done={hasCredentials}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-label mb-1.5 block text-[var(--color-foreground)]">
                  App ID
                </label>
                <input
                  {...register('appId')}
                  placeholder="cli_xxxxxxxxxxxxxxxx"
                  className={inputCls}
                />
                {errors.appId && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.appId.message}</p>}
              </div>
              <div>
                <label className="text-label mb-1.5 block text-[var(--color-foreground)]">
                  App Secret
                </label>
                <input
                  type="password"
                  {...register('appSecret')}
                  placeholder={settings.hasAppSecret ? t('LarkSettingsTab.savedLeaveEmptyToKeepIt') : ''}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={handleCredentialsSubmit((data) =>
                  updateSettings.mutate({
                    appId: data.appId.trim(),
                    appSecret: data.appSecret.trim() || undefined,
                  }, { onSuccess: () => setValue('appSecret', '') })
                )} disabled={updateSettings.isPending}>
                {updateSettings.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
                {t('LarkSettingsTab.save')}
              </Button>

              <Button variant="outline" type="button" onClick={() => testConnection.mutate()} disabled={testConnection.isPending || !hasCredentials}>
                {testConnection.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
                {t('LarkSettingsTab.checkConnection')}
              </Button>
            </div>

            {testConnection.data && (
              <p
                className={cn(
                  'mt-3 flex items-start gap-2 text-xs font-semibold',
                  testConnection.data.ok
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-error)]'
                )}
              >
                {testConnection.data.ok ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                )}
                {testConnection.data.message}
              </p>
            )}
          </StepCard>
        </>
      )}

      <StepCard
        id="tour-lark-connect"
        step={isCustomApp ? 4 : 1}
        title={t('LarkSettingsTab.linkYourCompanyOnLark')}
        description={t('LarkSettingsTab.youWillSignInToLark')}
        done={isVerified}
        disabled={isCustomApp && !hasCredentials}
      >
        <Button type="button" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
          {connectMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {isVerified ? t('LarkSettingsTab.relink') : t('LarkSettingsTab.connectToLark')}
        </Button>

        {/* Đã liên kết nhưng Lark không trả tên -> ứng dụng thiếu quyền đọc thông tin doanh nghiệp */}
        {isVerified && !settings.tenantName && (
          <div className="mt-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
            <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              {t('LarkSettingsTab.couldNotGetTheCompanyName')} <span className="font-semibold">{t('LarkSettingsTab.relink')}</span> {t('LarkSettingsTab.toShowTheCorrectNameAnd')}
            </p>
            <div className="mt-2">
              <CopyRow label={t('LarkSettingsTab.additionalPermissionToEnable')} value="tenant:tenant:readonly" />
            </div>
          </div>
        )}
      </StepCard>

      <StepCard
        id="tour-lark-defaults"
        step={isCustomApp ? 5 : 2}
        title={t('LarkSettingsTab.unitAndRoleForNewPeople')}
        description={t('LarkSettingsTab.employeesSigningInWithLarkFor')}
        done={hasDefaults}
        disabled={!isVerified}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-label mb-1.5 block text-[var(--color-foreground)]">
              {t('LarkSettingsTab.defaultUnit')}
            </label>
            <Select
              value={settings.defaultOrgUnitId ?? undefined}
              onValueChange={(v) => updateSettings.mutate({ defaultOrgUnitId: v })}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder={t('LarkSettingsTab.chooseUnit')} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {flattenedUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    <span className="flex items-center">
                      {' '.repeat(Math.max(0, unit.level * 2))}
                      {unit.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-label mb-1.5 block text-[var(--color-foreground)]">
              {t('LarkSettingsTab.defaultRole')}
            </label>
            <Select
              value={settings.defaultRoleId ?? undefined}
              onValueChange={(v) => updateSettings.mutate({ defaultRoleId: v })}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder={t('LarkSettingsTab.chooseRole')} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {(roles ?? []).map((role: any) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </StepCard>

      <StepCard
        step={isCustomApp ? 6 : 3}
        title={t('LarkSettingsTab.turnOnLarkSignIn')}
        description={t('LarkSettingsTab.whenOnYourCompanyAppearsOn')}
        done={settings.larkEnabled}
        disabled={!canEnable && !settings.larkEnabled}
      >
        {!canEnable && !settings.larkEnabled ? (
          <p className="flex items-start gap-2 text-xs font-semibold text-[var(--color-warning)]">
            <Lock size={14} className="mt-0.5 shrink-0" />
            {t('LarkSettingsTab.stillMissing')} {settings.missingRequirements.join('; ')}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => updateSettings.mutate({ larkEnabled: !settings.larkEnabled })}
            disabled={updateSettings.isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-card px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50',
              settings.larkEnabled
                ? 'border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]/50'
                : 'bg-[var(--color-success-solid)] text-white'
            )}
          >
            {updateSettings.isPending && <Loader2 size={15} className="animate-spin" />}
            {settings.larkEnabled ? t('LarkSettingsTab.turnOffLarkSignIn') : t('LarkSettingsTab.turnOnLarkSignIn')}
          </button>
        )}
      </StepCard>

      <TroubleshootingSection />
    </div>
  )
}

/**
 * Ba lỗi hay gặp nhất. Hai lỗi đầu do Lark chặn ngay trên trang của họ nên người dùng
 * không quay về KeyGo — không có cách nào hiện thông báo cho họ, chỉ có thể dặn quản trị viên.
 */
function TroubleshootingSection() {
  const { t } = useTranslation('organization')
  const [open, setOpen] = useState(false)

  const items = [
    {
      symptom: '"You don\'t have the access to ..."',
      cause: t('LarkSettingsTab.theEmployeeIsOutsideTheLark'),
      fix: t('LarkSettingsTab.openAvailabilityInTheLarkConsole'),
    },
    {
      symptom: t('LarkSettingsTab.larkReportsARedirectAddressError'),
      cause: t('LarkSettingsTab.theRedirectUrlDeclaredInLark'),
      fix: t('LarkSettingsTab.copyTheCallbackUrlFromStep'),
    },
    {
      symptom: t('LarkSettingsTab.yourLarkAccountDoesNotBelong'),
      cause: t('LarkSettingsTab.thisIsAKeygoMessageThe'),
      fix: t('LarkSettingsTab.onTheLarkSignInScreen'),
    },
  ]

  return (
    <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <button className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]" type="button" onClick={() => setOpen((v) => !v)}>
        <HelpCircle aria-hidden="true" className="shrink-0 text-[var(--color-muted-foreground)]" />
        <span className="flex-1 text-sm font-medium text-[var(--color-foreground)]">
          {t('LarkSettingsTab.employeesCannotSignIn')}
        </span>
        <ChevronDown aria-hidden="true"
          className={cn(
            'shrink-0 text-[var(--color-muted-foreground)] transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--color-border)] p-5 pt-4">
          {items.map((item) => (
            <div
              key={item.symptom}
              className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/20 p-3.5"
            >
              <p className="text-xs font-medium text-[var(--color-foreground)]">
                {t('LarkSettingsTab.theEmployeeSees')} <span className="font-mono font-normal">{item.symptom}</span>
              </p>
              <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">{item.cause}</p>
              <p className="mt-1.5 text-xs font-semibold text-[var(--color-primary)]">
                → {item.fix}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
