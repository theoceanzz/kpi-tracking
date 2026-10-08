import { LocaleDateInput } from '@/components/ui/date-input'
import { useMemo, useState } from 'react'
import {
  ArrowRightLeft, CalendarClock, Check, ChevronDown, Crown, Info, Loader2, Network, Plus, Search,
  ShieldCheck, Trash2,
} from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { useAuthStore } from '@/store/authStore'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganizationUsers } from '../hooks/useUserRoles'
import { useCreateDelegation, useDelegations, useRevokeDelegation } from '../hooks/useDelegations'
import type { DelegationResponse } from '../api/delegation.api'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import { useStateDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'
import { tourAnchor } from '@/components/common/tours/anchors'
import { blockedByTour } from '@/components/common/tours/guard'
import { useTourModal } from '@/components/common/tours/actions'

/**
 * Uỷ quyền quản lý CHÉO đơn vị.
 *
 * Quyền trong hệ thống chỉ chảy xuống theo cây tổ chức, nên trưởng phòng A không với sang
 * được phòng B cùng cấp. Cách duy nhất trước đây là gán cho họ thêm một vai trò TẠI B —
 * bế tắc khi B đã có trưởng (mỗi đơn vị chỉ được một trưởng, một phó), mà gán vai trò nhân
 * viên để lách thì lại mất quyền chấm hạnh kiểm.
 *
 * Ở đây phạm vi tách khỏi vai trò: người được uỷ quyền giữ nguyên bộ quyền sẵn có, chỉ
 * được dùng nó thêm ở một đơn vị khác cây.
 */
export default function DelegationSettingsTab() {
  const { t } = useTranslation('organization')
  const user = useAuthStore(s => s.user)
  const orgId = user?.memberships?.[0]?.organizationId

  const { data: delegations, isLoading } = useDelegations(orgId)
  const revoke = useRevokeDelegation()
  const [showForm, setShowForm] = useState(false)
  useTourModal('delegations.form', () => setShowForm(true), () => setShowForm(false))

  const rows = delegations ?? []
  const active = rows.filter(d => d.active)
  const inactive = rows.filter(d => !d.active)

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-section-title">{t('DelegationSettingsTab.crossUnitManagementDelegation')}</h3>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                {t('DelegationSettingsTab.letAPersonAlsoManageUnits')}
              </p>
            </div>

          <Button {...tourAnchor('delegations.add')} className="shrink-0" onClick={() => setShowForm(true)}>
            <Plus aria-hidden="true" /> {t('DelegationSettingsTab.newDelegation')}
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div {...tourAnchor('delegations.note')} className="p-4 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)] flex items-start gap-3">
            <Info size={18} className="text-[var(--color-info)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--color-info)] font-medium leading-relaxed">
              {t('DelegationSettingsTab.aDelegationOnly')} <b>{t('DelegationSettingsTab.extendsTheScope')}</b> {t('DelegationSettingsTab.ofExistingPermissionsAndDoesNot')}
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
            </div>
          ) : rows.length === 0 ? (
            <div {...tourAnchor('delegations.list')} className="py-12 text-center space-y-2">
              <Network size={40} className="mx-auto text-[var(--color-subtle-foreground)]" />
              <p className="text-sm font-semibold text-[var(--color-foreground)]">{t('DelegationSettingsTab.noDelegationsYet')}</p>
              <p className="text-xs text-[var(--color-muted-foreground)] max-w-md mx-auto leading-relaxed">
                {t('DelegationSettingsTab.useItWhenAUnitHas')}
              </p>
            </div>
          ) : (
            <div {...tourAnchor('delegations.list')} className="space-y-3">
              {active.map(d => (
                <DelegationRow key={d.id} d={d} onRevoke={() => revoke.mutate(d.id)} isRevoking={revoke.isPending} />
              ))}
              {inactive.length > 0 && (
                <>
                  <p className="text-eyebrow pt-2">
                    {t('DelegationSettingsTab.noLongerInEffect')}
                  </p>
                  {inactive.map(d => (
                    <DelegationRow key={d.id} d={d} onRevoke={() => revoke.mutate(d.id)} isRevoking={revoke.isPending} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showForm && orgId && (
        <DelegationFormModal organizationId={orgId} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

function DelegationRow({
  d, onRevoke, isRevoking,
}: {
  d: DelegationResponse
  onRevoke: () => void
  isRevoking: boolean
}) {
  const { t } = useTranslation('organization')
  const statusLabel = d.active ? t('DelegationSettingsTab.inEffect') : d.scheduled ? t('DelegationSettingsTab.notStartedYet') : t('DelegationSettingsTab.expired')

  return (
    <div className={cn(
      'p-4 rounded-card border flex flex-col lg:flex-row lg:items-center gap-4',
      d.active
        ? 'bg-[var(--color-card)] border-[var(--color-border)]'
        : 'bg-[var(--color-muted)] border-[var(--color-border)] opacity-70',
    )}>
      <UserAvatar
        fullName={d.delegateUserName}
        avatarUrl={d.delegateUserAvatarUrl}
        className="w-10 h-10 rounded-card shrink-0"
        fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-xs text-[var(--color-primary)]"
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{d.delegateUserName}</p>
        {/* Đường đi của quyền là thứ người đọc cần thấy đầu tiên: từ đơn vị nào sang đơn vị nào. */}
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption">
          <span className="text-[var(--color-subtle-foreground)]">{d.fromOrgUnitName || t('DelegationSettingsTab.rootUnit')}</span>
          {d.delegateRoleName && <span className="text-[var(--color-subtle-foreground)]">· {d.delegateRoleName}</span>}
          <ArrowRightLeft size={11} className="text-[var(--color-primary)]" />
          <span className="text-[var(--color-primary)]">{d.orgUnitName}</span>
          {d.includeSubtree && <span className="text-[var(--color-subtle-foreground)]">{t('DelegationSettingsTab.withLowerUnits')}</span>}
        </p>
        {d.reason && (
          <p className="mt-1 text-caption italic line-clamp-2">"{d.reason}"</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {d.canActAsLeader && (
          <span
            title={t('DelegationSettingsTab.mayActAsTheUnitHead')}
            className="text-eyebrow inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
          >
            <Crown size={11} /> {t('DelegationSettingsTab.actsAsHead')}
          </span>
        )}
        <span className={cn(
          'text-eyebrow inline-flex items-center gap-1 px-2.5 py-1 rounded-control border',
          d.active
            ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
            : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]',
        )}>
          <ShieldCheck size={11} /> {statusLabel}
        </span>
        {d.expiresAt && (
          <span className="inline-flex items-center gap-1 text-caption whitespace-nowrap">
            <CalendarClock size={11} /> {t('DelegationSettingsTab.to')} {format(parseISO(d.expiresAt), 'dd/MM/yyyy')}
          </span>
        )}
        <Button {...tourAnchor('delegations.revoke')} variant="outline" size="icon" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label={t('DelegationSettingsTab.revokeDelegation')} onClick={onRevoke} disabled={isRevoking} title={t('DelegationSettingsTab.revokeDelegation')}>
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

/** Đơn vị trong cây, làm phẳng kèm thụt lề để chọn trong danh sách. */
type FlatUnit = { id: string; name: string; label: string; levelOrder: number | null; typeName?: string }

/** Chỉ những trường cần cho danh sách chọn — cây trả về nhiều hơn thế. */
type UnitNode = { id: string; name: string; level?: number; type?: string; children?: UnitNode[] }

function flattenUnits(nodes: UnitNode[], depth = 0): FlatUnit[] {
  const out: FlatUnit[] = []
  for (const node of nodes ?? []) {
    out.push({
      id: node.id,
      name: node.name,
      label: `${'— '.repeat(depth)}${node.name}`,
      // `level` của cây là levelOrder của cấp bậc tổ chức (nhỏ = cao), KHÔNG phải độ sâu
      // trong mảng — hai thứ này lệch nhau khi cây có nhánh bỏ cấp.
      levelOrder: node.level ?? null,
      typeName: node.type,
    })
    if (node.children?.length) out.push(...flattenUnits(node.children, depth + 1))
  }
  return out
}

function DelegationFormModal({
  organizationId, onClose,
}: {
  organizationId: string
  onClose: () => void
}) {
  const { t } = useTranslation('organization')
  const { data: tree } = useOrgUnitTree()
  const { data: usersPage } = useOrganizationUsers()
  const create = useCreateDelegation(organizationId)

  const units = useMemo(() => flattenUnits((tree ?? []) as UnitNode[]), [tree])
  // Bọc useMemo: `?? []` sinh mảng mới mỗi lần render, kéo theo useMemo gom nhóm bên dưới
  // tính lại vô ích sau mỗi phím gõ ở ô tìm đơn vị.
  const users = useMemo(() => usersPage?.content ?? [], [usersPage])

  // Nhóm nhân sự theo ĐƠN VỊ. Danh sách phẳng vài trăm người thì không ai dò ra ai —
  // mà người trao quyền luôn nghĩ theo "phòng nào, ai trong đó" chứ không theo tên.
  //
  // Một người có nhiều membership sẽ xuất hiện ở từng đơn vị họ thuộc về: đó là sự thật
  // của dữ liệu, và tìm họ ở đơn vị nào cũng ra thì đúng hơn là chọn bừa một đơn vị.
  const usersByUnit = useMemo(() => {
    const groups = new Map<string, { unitName: string; members: typeof users }>()
    for (const u of users) {
      const memberships = u.memberships?.length ? u.memberships : []
      if (!memberships.length) {
        const g = groups.get('__none__') ?? { unitName: t('DelegationSettingsTab.notInAnyUnit'), members: [] }
        g.members.push(u)
        groups.set('__none__', g)
        continue
      }
      for (const m of memberships) {
        const g = groups.get(m.orgUnitId) ?? { unitName: m.orgUnitName, members: [] }
        if (!g.members.some(x => x.id === u.id)) g.members.push(u)
        groups.set(m.orgUnitId, g)
      }
    }
    // Xếp theo thứ tự cây đơn vị để danh sách đọc lên giống sơ đồ tổ chức.
    const order = new Map(units.map((u, i) => [u.id, i]))
    return [...groups.entries()]
      .sort((a, b) => (order.get(a[0]) ?? 9999) - (order.get(b[0]) ?? 9999))
      .map(([id, g]) => ({ id, ...g }))
  }, [users, units, t])

  const [delegateUserId, setDelegateUserId] = useState('')
  const [orgUnitIds, setOrgUnitIds] = useState<string[]>([])
  const [unitSearch, setUnitSearch] = useState('')
  const [includeSubtree, setIncludeSubtree] = useState(true)
  const [canActAsLeader, setCanActAsLeader] = useState(true)
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const draft = useStateDraft(
    { delegateUserId, orgUnitIds, includeSubtree, canActAsLeader, reason, expiresAt },
    v => {
      setDelegateUserId(v.delegateUserId); setOrgUnitIds(v.orgUnitIds); setIncludeSubtree(v.includeSubtree)
      setCanActAsLeader(v.canActAsLeader); setReason(v.reason); setExpiresAt(v.expiresAt)
    },
    { key: `delegation:new:${organizationId}`, enabled: true },
  )

  /**
   * Cấp CAO NHẤT mà người được chọn đang đứng đầu (levelOrder nhỏ nhất trong các vai trò
   * trưởng/phó). Đây là trần: chỉ giao được đơn vị ngang cấp hoặc thấp hơn.
   *
   * Chỉ tính vai trò quản lý, đúng như luật ở server: mỗi người còn có một membership nhân
   * viên tự sinh ở đơn vị CHA, lấy cả nó vào thì tổ trưởng nào cũng "thuộc" công ty.
   */
  const delegateLevel = useMemo(() => {
    const u = users.find(x => x.id === delegateUserId)
    const managed = (u?.memberships ?? []).filter(m => (m.roleRank ?? 9) <= 1)
    const orders = managed.map(m => m.levelOrder).filter((v): v is number => v != null)
    return orders.length ? Math.min(...orders) : null
  }, [users, delegateUserId])

  const eligibleUnits = useMemo(() => {
    if (delegateLevel == null) return units
    return units.filter(u => u.levelOrder == null || u.levelOrder >= delegateLevel)
  }, [units, delegateLevel])

  const blockedCount = units.length - eligibleUnits.length

  const visibleUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase()
    return q ? eligibleUnits.filter(u => u.name.toLowerCase().includes(q)) : eligibleUnits
  }, [eligibleUnits, unitSearch])

  // Đổi người được uỷ quyền thì trần cấp bậc đổi theo — bỏ những đơn vị không còn hợp lệ,
  // nếu không người dùng bấm gửi mới biết mình đang chọn thứ server sẽ từ chối.
  const [syncedDelegate, setSyncedDelegate] = useState('')
  if (syncedDelegate !== delegateUserId) {
    setSyncedDelegate(delegateUserId)
    const allowed = new Set(eligibleUnits.map(u => u.id))
    setOrgUnitIds(prev => prev.filter(id => allowed.has(id)))
  }

  const toggleUnit = (id: string) =>
    setOrgUnitIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const canSubmit = !!delegateUserId && orgUnitIds.length > 0 && !create.isPending

  const submit = () => {
    if (!canSubmit || blockedByTour()) return
    create.mutate(
      {
        delegateUserId,
        orgUnitIds,
        includeSubtree,
        canActAsLeader,
        reason: reason.trim() || null,
        // <input type="date"> cho ngày trần; quy về cuối ngày để uỷ quyền còn hiệu lực
        // trọn ngày người dùng chọn thay vì tắt lúc 00:00.
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog {...tourAnchor('delegations.form')}
      open
      onClose={onClose}
      size="md"
      dismissible={!create.isPending}
      title={t('DelegationSettingsTab.unitManagementDelegation')}
      description={t('DelegationSettingsTab.extendsTheScopeOfExistingPermissions')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={create.isPending}>{t('DelegationSettingsTab.cancel')}</Button>}
          primary={
            <Button {...tourAnchor('delegations.form.submit')} onClick={submit} disabled={!canSubmit}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('DelegationSettingsTab.delegation')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        <Field {...tourAnchor('delegations.form.delegate')} label={t('DelegationSettingsTab.delegate')} required>
          <DelegateUserPicker groups={usersByUnit} value={delegateUserId} onChange={setDelegateUserId} />
        </Field>

        {/* Chọn NHIỀU đơn vị. Radix Select chỉ giữ được một giá trị nên ở đây là danh
            sách tự dựng, cùng kiểu với ô chọn đơn vị của form KPI. */}
        <Field {...tourAnchor('delegations.form.units')} label={t('DelegationSettingsTab.unitsToManage')} required>
          <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-muted)]">
              <Search size={14} className="text-[var(--color-subtle-foreground)] shrink-0" />
              <input
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
                placeholder={t('DelegationSettingsTab.searchUnits')}
                className="flex-1 min-w-0 bg-transparent text-xs font-medium outline-none placeholder:text-[var(--color-subtle-foreground)]"
              />
              {orgUnitIds.length > 0 && (
                <Button variant="ghost" className="shrink-0 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" type="button" onClick={() => setOrgUnitIds([])}>
                  {t('DelegationSettingsTab.deselect')}{orgUnitIds.length})
                </Button>
              )}
            </div>

            <div className="max-h-[200px] overflow-y-auto p-1.5 space-y-0.5">
              {!delegateUserId ? (
                <p className="py-6 text-center text-xs font-medium text-[var(--color-subtle-foreground)]">
                  {t('DelegationSettingsTab.chooseTheDelegateFirstTheUnit')}
                </p>
              ) : visibleUnits.length === 0 ? (
                <p className="py-6 text-center text-xs font-medium text-[var(--color-subtle-foreground)]">
                  {t('DelegationSettingsTab.noMatchingUnits')}
                </p>
              ) : visibleUnits.map(u => {
                const picked = orgUnitIds.includes(u.id)
                return (
                  <ChoiceChip selected={picked} variant="solid" size="sm" className="w-full justify-start py-2 text-left" key={u.id} onClick={() => toggleUnit(u.id)}>
                    {/* Khi đang tìm kiếm thì bỏ thụt lề: kết quả lọc không còn liền mạch
                        theo cây nên gạch thụt chỉ gây hiểu nhầm về cấp bậc. */}
                    <span className="truncate">{unitSearch.trim() ? u.name : u.label}</span>
                    {picked && <Check className="ml-auto shrink-0" />}
                  </ChoiceChip>
                )
              })}
            </div>
          </div>
          {blockedCount > 0 && (
            // Nói thẳng vì sao thiếu đơn vị: người trao đi tìm "Phòng Kinh doanh" mà
            // không thấy sẽ tưởng dữ liệu lỗi chứ không nghĩ là luật chặn.
            <p className="mt-1.5 text-caption leading-relaxed">
              {t('DelegationSettingsTab.hidden')} {blockedCount} {t('DelegationSettingsTab.unitsAtAHigherLevelThan')}
            </p>
          )}
          {orgUnitIds.length > 1 && (
            <p className="mt-1.5 text-xs font-medium text-[var(--color-primary)]">
              {t('DelegationSettingsTab.selected')} {orgUnitIds.length} {t('DelegationSettingsTab.unitsCreatedTogetherIfOneFails')}
            </p>
          )}
        </Field>

        <CheckRow {...tourAnchor('delegations.form.subtree')}
          checked={includeSubtree}
          onChange={setIncludeSubtree}
          title={t('DelegationSettingsTab.includeLowerUnits')}
          hint={t('DelegationSettingsTab.turnOffToAssignOnlyThat')}
        />

        <CheckRow {...tourAnchor('delegations.form.leader')}
          checked={canActAsLeader}
          onChange={setCanActAsLeader}
          title={t('DelegationSettingsTab.mayActAsTheUnitHead2')}
          hint={t('DelegationSettingsTab.mustBeOnForConductScoring')}
        />

        <Field {...tourAnchor('delegations.form.expires')} label={t('DelegationSettingsTab.expired')}>
          <LocaleDateInput
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className="w-full h-12 px-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium outline-none focus:ring-4 focus:ring-[var(--color-ring)]"
          />
          <p className="mt-1.5 text-caption">
            {t('DelegationSettingsTab.leaveEmptyNoExpiryTemporaryDelegations')}
          </p>
        </Field>

        <Field {...tourAnchor('delegations.form.reason')} label={t('DelegationSettingsTab.reason')}>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder={t('DelegationSettingsTab.eGTheBackendTeamHas')}
            className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium outline-none focus:ring-4 focus:ring-[var(--color-ring)] resize-y"
          />
        </Field>
      </div>

    </Dialog>
  )
}

function Field({
  label, required, children, ...rest
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  'data-tour'?: string
}) {
  return (
    <label className="block" {...rest}>
      <span className="text-eyebrow">
        {label} {required && <span className="text-[var(--color-error)]">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

type PickerUser = { id: string; fullName: string; email: string }

/**
 * Chọn người được uỷ quyền, có ô tìm. Radix Select không nhét được ô gõ vào trong (nó
 * tự nuốt phím để typeahead), mà công ty vài trăm người thì cuộn tay không xuể.
 * Tìm theo tên, email hoặc tên đơn vị — gõ "Backend" ra cả team.
 */
function DelegateUserPicker({
  groups, value, onChange,
}: {
  groups: { id: string; unitName: string; members: PickerUser[] }[]
  value: string
  onChange: (id: string) => void
}) {
  const { t } = useTranslation('organization')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const selected = useMemo(() => {
    for (const g of groups) {
      const u = g.members.find(m => m.id === value)
      if (u) return u
    }
    return null
  }, [groups, value])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return groups
    return groups
      .map(g => g.unitName.toLowerCase().includes(s)
        ? g
        : { ...g, members: g.members.filter(u =>
            u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)) })
      .filter(g => g.members.length > 0)
  }, [groups, q])

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
    setQ('')
  }

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setQ('') }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-12 w-full items-center justify-between gap-2 rounded-card border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm transition-colors',
            'hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-ring)]',
            selected ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]',
          )}
        >
          <span className="truncate">{selected ? `${selected.fullName} · ${selected.email}` : t('DelegationSettingsTab.chooseAPerson')}</span>
          <ChevronDown size={16} className="shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        // Esc chỉ đóng danh sách, không kéo theo đóng cả hộp thoại uỷ quyền.
        onEscapeKeyDown={e => e.stopPropagation()}
      >
        <div className="border-b border-[var(--color-border)] p-2">
          <Input
            autoFocus
            size="sm"
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('DelegationSettingsTab.searchByNameEmailOrUnit')}
            prefix={<Search />}
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs font-medium text-[var(--color-subtle-foreground)]">
              {t('DelegationSettingsTab.noOneFound')}
            </p>
          ) : filtered.map(g => (
            <div key={g.id}>
              <p className="px-2 py-1.5 text-eyebrow">{g.unitName}</p>
              {g.members.map(u => {
                const active = u.id === value
                return (
                  <button
                    key={`${g.id}-${u.id}`}
                    type="button"
                    onClick={() => pick(u.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm transition-colors',
                      'hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] focus-visible:outline-none',
                      active && 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{u.fullName}</span>
                      <span className="text-[var(--color-muted-foreground)]"> · {u.email}</span>
                    </span>
                    {active && <Check size={14} className="shrink-0" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function CheckRow({
  checked, onChange, title, hint, ...rest
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  hint: string
  'data-tour'?: string
}) {
  return (
    <ChoiceChip
      {...rest}
      selected={checked}
      // ChoiceChip mặc định là chip 1 dòng (h-8, nowrap, căn giữa) — ở đây là dòng 2 tầng chữ
      className="w-full h-auto items-start justify-start gap-3 whitespace-normal px-3 py-2.5 text-left"
      onClick={() => onChange(!checked)}
    >
      <span className={cn(
        'w-5 h-5 rounded-control border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
        checked ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border-strong)]',
      )}>
        {checked && <span className="w-2 h-2 rounded-sm bg-white" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-[var(--color-foreground)]">{title}</span>
        <span className="block mt-0.5 text-caption leading-relaxed">{hint}</span>
      </span>
    </ChoiceChip>
  )
}
