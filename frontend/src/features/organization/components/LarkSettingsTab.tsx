import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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

const LARK_CONSOLE_URL = 'https://open.larksuite.com/app'

function StepCard({
  step,
  title,
  description,
  done,
  disabled,
  children,
}: {
  step: number
  title: string
  description?: string
  done?: boolean
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-5 transition-all',
        disabled
          ? 'border-[var(--color-border)] bg-[var(--color-muted)]/20 opacity-55'
          : 'border-[var(--color-border)] bg-[var(--color-card)]'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black',
            done
              ? 'bg-emerald-500 text-white'
              : disabled
                ? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                : 'bg-[var(--color-primary)] text-white'
          )}
        >
          {done ? <Check size={14} strokeWidth={4} /> : step}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[var(--color-foreground)]">{title}</h3>
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
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          {label}
        </p>
        <p className="truncate font-mono text-xs text-[var(--color-foreground)]">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        title="Sao chép"
        className="shrink-0 rounded-lg p-2 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
      </button>
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
        className="shrink-0 rounded-xl object-cover"
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-muted)]"
    >
      <Building2 size={size * 0.45} className="text-[var(--color-primary)]" />
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20'

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

  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [pendingConnect, setPendingConnect] = useState<LarkConnectResult | null>(null)

  useEffect(() => {
    if (settings) setAppId(settings.appId ?? '')
  }, [settings])

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
      toast.error(err.response?.data?.message || 'Không mở được trang đăng nhập Lark.')
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
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-2xl border p-4',
          settings.larkEnabled
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
            : 'border-[var(--color-border)] bg-[var(--color-muted)]/30'
        )}
      >
        {isVerified ? (
          <TenantLogo url={settings.tenantAvatarUrl} size={36} />
        ) : (
          <AlertCircle size={20} className="text-[var(--color-muted-foreground)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-foreground)]">
            {settings.larkEnabled && (
              <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
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
          <button
            type="button"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-muted-foreground)] transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            {disconnect.isPending ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
            Huỷ liên kết
          </button>
        )}
      </div>

      {/* Thẻ xác nhận sau khi quản trị viên đăng nhập Lark */}
      {pendingConnect && (
        <div className="animate-in fade-in slide-in-from-top-1 rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5 p-5">
          <h3 className="text-sm font-bold text-[var(--color-foreground)]">
            Đây có đúng là công ty của bạn?
          </h3>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-[var(--color-background)] p-3.5">
            <TenantLogo url={pendingConnect.tenantAvatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--color-foreground)]">
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
            <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              Tổ chức Lark này đã được liên kết với công ty{' '}
              {pendingConnect.alreadyLinkedOrganizationName}. Không thể liên kết thêm.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={pendingConnect.alreadyLinked || confirmConnection.isPending}
              onClick={() =>
                confirmConnection.mutate(pendingConnect.pendingToken, {
                  onSuccess: () => setPendingConnect(null),
                })
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white transition-all hover:shadow-md disabled:opacity-50"
            >
              {confirmConnection.isPending && <Loader2 size={15} className="animate-spin" />}
              Xác nhận liên kết
            </button>
            <button
              type="button"
              onClick={() => setPendingConnect(null)}
              className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]/50"
            >
              Huỷ
            </button>
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
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                Ứng dụng phải được tạo <span className="font-bold">bên trong tổ chức Lark của chính
                công ty này</span>. Nếu dùng ứng dụng của một tổ chức Lark khác, nhân viên sẽ bị Lark
                chặn ngay khi đăng nhập — Custom App chỉ phục vụ đúng tổ chức đã tạo ra nó.
              </p>
            </div>
            <a
              href={LARK_CONSOLE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]/50"
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

            <div className="mt-4 space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/25 p-3.5">
              <div className="flex items-start gap-2">
                <Users size={15} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <div>
                  <p className="text-xs font-bold text-[var(--color-foreground)]">
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
                  <p className="text-xs font-bold text-[var(--color-foreground)]">
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
            step={3}
            title="Nhập App ID và App Secret"
            description="Lấy ở trang Credentials & Basic Info của ứng dụng vừa tạo."
            done={hasCredentials}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[var(--color-foreground)]">
                  App ID
                </label>
                <input
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="cli_xxxxxxxxxxxxxxxx"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[var(--color-foreground)]">
                  App Secret
                </label>
                <input
                  type="password"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder={settings.hasAppSecret ? '•••••• (đã lưu, để trống nếu giữ nguyên)' : ''}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateSettings.mutate({
                    appId: appId.trim(),
                    appSecret: appSecret.trim() || undefined,
                  }, { onSuccess: () => setAppSecret('') })
                }
                disabled={updateSettings.isPending || !appId.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white transition-all hover:shadow-md disabled:opacity-50"
              >
                {updateSettings.isPending && <Loader2 size={15} className="animate-spin" />}
                Lưu
              </button>

              <button
                type="button"
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending || !hasCredentials}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]/50 disabled:opacity-50"
              >
                {testConnection.isPending && <Loader2 size={15} className="animate-spin" />}
                Kiểm tra kết nối
              </button>
            </div>

            {testConnection.data && (
              <p
                className={cn(
                  'mt-3 flex items-start gap-2 text-xs font-semibold',
                  testConnection.data.ok
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
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
        step={isCustomApp ? 4 : 1}
        title="Liên kết công ty của bạn trên Lark"
        description="Bạn sẽ đăng nhập Lark một lần. KeyGo tự nhận diện công ty của bạn và ghi nhớ, không cần nhập thủ công."
        done={isVerified}
        disabled={isCustomApp && !hasCredentials}
      >
        <button
          type="button"
          onClick={() => connectMutation.mutate()}
          disabled={connectMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white transition-all hover:shadow-md disabled:opacity-50"
        >
          {connectMutation.isPending && <Loader2 size={15} className="animate-spin" />}
          {isVerified ? 'Liên kết lại' : 'Kết nối với Lark'}
        </button>

        {/* Đã liên kết nhưng Lark không trả tên -> ứng dụng thiếu quyền đọc thông tin doanh nghiệp */}
        {isVerified && !settings.tenantName && (
          <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
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
        step={isCustomApp ? 5 : 2}
        title="Đơn vị và vai trò cho người mới"
        description="Nhân viên đăng nhập lần đầu bằng Lark sẽ được tạo tài khoản tự động và xếp vào đây. Bạn có thể điều chỉnh lại từng người sau."
        done={hasDefaults}
        disabled={!isVerified}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[var(--color-foreground)]">
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
            <label className="mb-1.5 block text-xs font-bold text-[var(--color-foreground)]">
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
          <p className="flex items-start gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Lock size={14} className="mt-0.5 shrink-0" />
            Còn thiếu: {settings.missingRequirements.join('; ')}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => updateSettings.mutate({ larkEnabled: !settings.larkEnabled })}
            disabled={updateSettings.isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-50',
              settings.larkEnabled
                ? 'border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]/50'
                : 'bg-emerald-600 text-white hover:shadow-md'
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
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-5 text-left"
      >
        <HelpCircle size={18} className="shrink-0 text-[var(--color-muted-foreground)]" />
        <span className="flex-1 text-sm font-bold text-[var(--color-foreground)]">
          Nhân viên không đăng nhập được?
        </span>
        <ChevronDown
          size={18}
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
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/20 p-3.5"
            >
              <p className="text-xs font-bold text-[var(--color-foreground)]">
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
