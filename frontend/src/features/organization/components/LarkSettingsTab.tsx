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
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Không sao chép được. Vui lòng chọn và copy thủ công.')
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
      <Button variant="secondary" className="shrink-0" type="button" onClick={handleCopy} title="Sao chép">
        {copied ? <Check aria-hidden="true" className="text-[var(--color-success)]" /> : <Copy aria-hidden="true" />}
      </Button>
    </div>
  )
}

/** Logo doanh nghiệp Lark, rơi về icon toà nhà khi thiếu URL hoặc ảnh tải lỗi. */
function TenantLogo({ url, size = 44 }: { url?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false)

  if (url && !failed) {
    return (
      <img
        src={url}
        alt="Logo công ty"
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
    resolver: zodResolver(larkCredentialsSchema),
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
      toast.error(getApiErrorMessage(err, 'Không mở được trang đăng nhập Lark.'))
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
            {settings.larkEnabled ? 'Đang bật đăng nhập bằng Lark' : 'Chưa bật đăng nhập bằng Lark'}
          </p>
          {isVerified && (
            <p className="truncate text-xs text-[var(--color-muted-foreground)]">
              Đã liên kết{settings.tenantName ? ` với ${settings.tenantName}` : ' với tổ chức Lark'}
            </p>
          )}
        </div>
        {isVerified && (
          <Button variant="outline" size="sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" type="button" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
            {disconnect.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Unlink aria-hidden="true" />}
            Huỷ liên kết
          </Button>
        )}
      </div>

      {/* Thẻ xác nhận sau khi quản trị viên đăng nhập Lark */}
      {pendingConnect && (
        <div className="animate-in fade-in slide-in-from-top-1 rounded-card border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5 p-5">
          <h3 className="text-section-title">
            Đây có đúng là công ty của bạn?
          </h3>
          <div className="mt-4 flex items-center gap-3 rounded-card bg-[var(--color-background)] p-3.5">
            <TenantLogo url={pendingConnect.tenantAvatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]">
                {pendingConnect.tenantName || 'Tổ chức Lark của bạn'}
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
                Lần này không lấy được tên và logo từ Lark nên hệ thống sẽ{' '}
                <span className="font-semibold text-[var(--color-foreground)]">giữ nguyên</span> giá
                trị đang có. Muốn cập nhật lại, hãy bật quyền{' '}
                <span className="font-mono">tenant:tenant:readonly</span> rồi phát hành phiên bản mới.
              </span>
            </p>
          )}

          {pendingConnect.alreadyLinked && (
            <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-[var(--color-error)]">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              Tổ chức Lark này đã được liên kết với công ty{' '}
              {pendingConnect.alreadyLinkedOrganizationName}. Không thể liên kết thêm.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Button type="button" disabled={pendingConnect.alreadyLinked || confirmConnection.isPending} onClick={() =>
                confirmConnection.mutate(pendingConnect.pendingToken, {
                  onSuccess: () => setPendingConnect(null),
                })
              }>
              {confirmConnection.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
              Xác nhận liên kết
            </Button>
            <Button variant="outline" type="button" onClick={() => setPendingConnect(null)}>
              Huỷ
            </Button>
          </div>
        </div>
      )}

      {isCustomApp && (
        <>
          <StepCard
            step={1}
            title="Tạo ứng dụng trên Lark"
            description="Cần tài khoản quản trị Lark. Vào Lark Developer Console, tạo một Custom App, đặt tên tuỳ ý (ví dụ: KeyGo)."
          >
            <div className="mb-3 flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 dark:border-[var(--color-warning-border)] dark:bg-[var(--color-warning-bg)]">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
              <p className="text-xs leading-relaxed text-[var(--color-warning)]">
                Ứng dụng phải được tạo <span className="font-semibold">bên trong tổ chức Lark của chính
                công ty này</span>. Nếu dùng ứng dụng của một tổ chức Lark khác, nhân viên sẽ bị Lark
                chặn ngay khi đăng nhập — Custom App chỉ phục vụ đúng tổ chức đã tạo ra nó.
              </p>
            </div>
            <a
              href={LARK_CONSOLE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-card border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]/50"
            >
              Mở Lark Developer Console
              <ExternalLink size={14} />
            </a>
          </StepCard>

          <StepCard
            step={2}
            title="Khai báo trong ứng dụng Lark"
            description="Sao chép các giá trị dưới đây và dán vào đúng mục trong Lark Console. Sau khi khai báo xong, vào mục Version Management để tạo phiên bản và publish ứng dụng."
          >
            <div className="space-y-2">
              <CopyRow label="Redirect URL (mục Security Settings)" value={settings.redirectUri} />
              {settings.requiredScopes.map((scope) => (
                <CopyRow key={scope} label="Quyền cần bật (mục Permissions & Scopes)" value={scope} />
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
              Quyền <span className="font-mono">tenant:tenant:readonly</span> là tuỳ chọn, chỉ dùng để
              hiển thị tên và logo công ty khi xác nhận.
            </p>

            <div className="mt-4 space-y-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/25 p-3.5">
              <div className="flex items-start gap-2">
                <Users size={15} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <div>
                  <p className="text-xs font-medium text-[var(--color-foreground)]">
                    Phạm vi sử dụng (Availability)
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                    Mở mục <span className="font-semibold">Availability</span> và chọn{' '}
                    <span className="font-semibold">toàn bộ nhân viên</span> (hoặc các phòng ban cần
                    dùng KeyGo). Ai nằm ngoài phạm vi này sẽ bị Lark chặn ngay khi bấm đăng nhập, kèm
                    thông báo <span className="font-mono">"You don't have the access"</span>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 border-t border-[var(--color-border)] pt-3">
                <Rocket size={15} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <div>
                  <p className="text-xs font-medium text-[var(--color-foreground)]">
                    Phát hành phiên bản
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                    Vào <span className="font-semibold">Version Management &amp; Release</span>, tạo
                    phiên bản rồi xin phát hành và chờ quản trị viên doanh nghiệp duyệt. Quyền vừa
                    thêm <span className="font-semibold">chưa có hiệu lực</span> cho tới khi phiên bản
                    được duyệt — chỉ hiện trạng thái "Added" là chưa đủ.
                  </p>
                </div>
              </div>
            </div>
          </StepCard>

          <StepCard
            id="tour-lark-credentials"
            step={3}
            title="Nhập App ID và App Secret"
            description="Lấy ở trang Credentials & Basic Info của ứng dụng vừa tạo."
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
                  placeholder={settings.hasAppSecret ? '•••••• (đã lưu, để trống nếu giữ nguyên)' : ''}
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
                Lưu
              </Button>

              <Button variant="outline" type="button" onClick={() => testConnection.mutate()} disabled={testConnection.isPending || !hasCredentials}>
                {testConnection.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
                Kiểm tra kết nối
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
        title="Liên kết công ty của bạn trên Lark"
        description="Bạn sẽ đăng nhập Lark một lần. KeyGo tự nhận diện công ty của bạn và ghi nhớ, không cần nhập thủ công."
        done={isVerified}
        disabled={isCustomApp && !hasCredentials}
      >
        <Button type="button" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
          {connectMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {isVerified ? 'Liên kết lại' : 'Kết nối với Lark'}
        </Button>

        {/* Đã liên kết nhưng Lark không trả tên -> ứng dụng thiếu quyền đọc thông tin doanh nghiệp */}
        {isVerified && !settings.tenantName && (
          <div className="mt-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
            <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              Chưa lấy được tên và logo công ty từ Lark. Bật thêm quyền dưới đây trong ứng dụng Lark
              rồi bấm <span className="font-semibold">Liên kết lại</span> để hiển thị đúng tên và
              logo ở màn hình đăng nhập.
            </p>
            <div className="mt-2">
              <CopyRow label="Quyền cần bật thêm" value="tenant:tenant:readonly" />
            </div>
          </div>
        )}
      </StepCard>

      <StepCard
        id="tour-lark-defaults"
        step={isCustomApp ? 5 : 2}
        title="Đơn vị và vai trò cho người mới"
        description="Nhân viên đăng nhập lần đầu bằng Lark sẽ được tạo tài khoản tự động và xếp vào đây. Bạn có thể điều chỉnh lại từng người sau."
        done={hasDefaults}
        disabled={!isVerified}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-label mb-1.5 block text-[var(--color-foreground)]">
              Đơn vị mặc định
            </label>
            <Select
              value={settings.defaultOrgUnitId ?? undefined}
              onValueChange={(v) => updateSettings.mutate({ defaultOrgUnitId: v })}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder="Chọn đơn vị" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] z-[300]">
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
              Vai trò mặc định
            </label>
            <Select
              value={settings.defaultRoleId ?? undefined}
              onValueChange={(v) => updateSettings.mutate({ defaultRoleId: v })}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] z-[300]">
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
        title="Bật đăng nhập bằng Lark"
        description="Khi bật, công ty bạn sẽ xuất hiện ở màn hình chọn công ty và nhân viên có thể đăng nhập bằng Lark."
        done={settings.larkEnabled}
        disabled={!canEnable && !settings.larkEnabled}
      >
        {!canEnable && !settings.larkEnabled ? (
          <p className="flex items-start gap-2 text-xs font-semibold text-[var(--color-warning)]">
            <Lock size={14} className="mt-0.5 shrink-0" />
            Còn thiếu: {settings.missingRequirements.join('; ')}
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
            {settings.larkEnabled ? 'Tắt đăng nhập bằng Lark' : 'Bật đăng nhập bằng Lark'}
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
  const [open, setOpen] = useState(false)

  const items = [
    {
      symptom: '"You don\'t have the access to ..."',
      cause: 'Nhân viên nằm ngoài phạm vi sử dụng của ứng dụng Lark.',
      fix: 'Mở mục Availability trong Lark Console, thêm nhân viên hoặc phòng ban của họ, rồi phát hành lại phiên bản.',
    },
    {
      symptom: 'Lark báo lỗi địa chỉ chuyển hướng (redirect)',
      cause: 'Redirect URL khai trong Lark không khớp với URL của KeyGo.',
      fix: 'Copy lại chính xác URL callback ở bước 2 và dán vào mục Security Settings.',
    },
    {
      symptom: '"Tài khoản Lark của bạn không thuộc ..."',
      cause: 'Đây là thông báo của KeyGo. Nhân viên đăng nhập bằng một tổ chức Lark khác với tổ chức đã liên kết.',
      fix: 'Trên màn hình đăng nhập Lark, chuyển sang đúng tổ chức của công ty. Nếu công ty đã đổi tổ chức Lark thì bấm "Liên kết lại" ở bước trên.',
    },
  ]

  return (
    <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <button className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]" type="button" onClick={() => setOpen((v) => !v)}>
        <HelpCircle aria-hidden="true" className="shrink-0 text-[var(--color-muted-foreground)]" />
        <span className="flex-1 text-sm font-medium text-[var(--color-foreground)]">
          Nhân viên không đăng nhập được?
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
                Nhân viên thấy: <span className="font-mono font-normal">{item.symptom}</span>
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
