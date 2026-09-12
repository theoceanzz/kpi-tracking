import { useMemo, useState } from 'react'
import {
  ArrowRightLeft, CalendarClock, Check, Crown, Info, Loader2, Network, Plus, Search,
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
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ChoiceChip } from '@/components/ui/choice-chip'

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
  const user = useAuthStore(s => s.user)
  const orgId = user?.memberships?.[0]?.organizationId

  const { data: delegations, isLoading } = useDelegations(orgId)
  const revoke = useRevokeDelegation()
  const [showForm, setShowForm] = useState(false)

  const rows = delegations ?? []
  const active = rows.filter(d => d.active)
  const inactive = rows.filter(d => !d.active)

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-section-title">Uỷ quyền quản lý chéo đơn vị</h3>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                Cho một người quản lý thêm đơn vị không nằm trong cây của họ
              </p>
            </div>

          <Button className="shrink-0" onClick={() => setShowForm(true)}>
            <Plus aria-hidden="true" /> Uỷ quyền mới
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-4 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)] flex items-start gap-3">
            <Info size={18} className="text-[var(--color-info)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--color-info)] font-medium leading-relaxed">
              Uỷ quyền chỉ <b>nới phạm vi</b> của quyền sẵn có, không cấp quyền mới: người không
              có quyền chốt kỳ ở đâu cả thì được uỷ quyền cũng vẫn không chốt được. Vai trò và
              ràng buộc "mỗi đơn vị một trưởng, một phó" giữ nguyên.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Network size={40} className="mx-auto text-[var(--color-subtle-foreground)]" />
              <p className="text-sm font-semibold text-[var(--color-foreground)]">Chưa có uỷ quyền nào</p>
              <p className="text-xs text-[var(--color-muted-foreground)] max-w-md mx-auto leading-relaxed">
                Dùng khi một đơn vị trống trưởng, khi cần người kiêm nhiệm trong lúc trưởng đơn vị
                đi vắng, hoặc khi hai đơn vị tạm gộp về một đầu mối.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map(d => (
                <DelegationRow key={d.id} d={d} onRevoke={() => revoke.mutate(d.id)} isRevoking={revoke.isPending} />
              ))}
              {inactive.length > 0 && (
                <>
                  <p className="text-eyebrow pt-2">
                    Không còn hiệu lực
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
  const statusLabel = d.active ? 'Đang hiệu lực' : d.scheduled ? 'Chưa tới ngày' : 'Hết hiệu lực'

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
          <span className="text-[var(--color-subtle-foreground)]">{d.fromOrgUnitName || 'Đơn vị gốc'}</span>
          {d.delegateRoleName && <span className="text-[var(--color-subtle-foreground)]">· {d.delegateRoleName}</span>}
          <ArrowRightLeft size={11} className="text-[var(--color-primary)]" />
          <span className="text-[var(--color-primary)]">{d.orgUnitName}</span>
          {d.includeSubtree && <span className="text-[var(--color-subtle-foreground)]">(kèm cấp dưới)</span>}
        </p>
        {d.reason && (
          <p className="mt-1 text-caption italic line-clamp-2">"{d.reason}"</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {d.canActAsLeader && (
          <span
            title="Được ký thay vai trò trưởng đơn vị — gồm cả chấm hạnh kiểm"
            className="text-eyebrow inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
          >
            <Crown size={11} /> Ký thay trưởng
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
            <CalendarClock size={11} /> đến {format(parseISO(d.expiresAt), 'dd/MM/yyyy')}
          </span>
        )}
        <Button variant="outline" size="icon" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label="Thu hồi uỷ quyền" onClick={onRevoke} disabled={isRevoking} title="Thu hồi uỷ quyền">
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
        const g = groups.get('__none__') ?? { unitName: 'Chưa thuộc đơn vị nào', members: [] }
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
  }, [users, units])

  const [delegateUserId, setDelegateUserId] = useState('')
  const [orgUnitIds, setOrgUnitIds] = useState<string[]>([])
  const [unitSearch, setUnitSearch] = useState('')
  const [includeSubtree, setIncludeSubtree] = useState(true)
  const [canActAsLeader, setCanActAsLeader] = useState(true)
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

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
    if (!canSubmit) return
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
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!create.isPending}
      title="Uỷ quyền quản lý đơn vị"
      description="Nới phạm vi quyền sẵn có"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={create.isPending}>Huỷ</Button>}
          primary={
            <Button onClick={submit} disabled={!canSubmit}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Uỷ quyền
            </Button>
          }
        />
      }
    >
      <div className="space-y-4">
        <Field label="Người được uỷ quyền" required>
          <Select value={delegateUserId} onValueChange={setDelegateUserId}>
            <SelectTrigger className="w-full h-12 rounded-card">
              <SelectValue placeholder="Chọn nhân sự…" />
            </SelectTrigger>
            <SelectContent className="z-[1100] max-h-[320px]">
              {usersByUnit.map(g => (
                <SelectGroup key={g.id}>
                  <SelectLabel>{g.unitName}</SelectLabel>
                  {g.members.map(u => (
                    <SelectItem key={`${g.id}-${u.id}`} value={u.id}>
                      {u.fullName} · {u.email}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Chọn NHIỀU đơn vị. Radix Select chỉ giữ được một giá trị nên ở đây là danh
            sách tự dựng, cùng kiểu với ô chọn đơn vị của form KPI. */}
        <Field label="Đơn vị được giao quản lý" required>
          <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-muted)]">
              <Search size={14} className="text-[var(--color-subtle-foreground)] shrink-0" />
              <input
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
                placeholder="Tìm đơn vị…"
                className="flex-1 min-w-0 bg-transparent text-xs font-medium outline-none placeholder:text-[var(--color-subtle-foreground)]"
              />
              {orgUnitIds.length > 0 && (
                <Button variant="ghost" className="shrink-0 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" type="button" onClick={() => setOrgUnitIds([])}>
                  Bỏ chọn ({orgUnitIds.length})
                </Button>
              )}
            </div>

            <div className="max-h-[200px] overflow-y-auto p-1.5 space-y-0.5">
              {!delegateUserId ? (
                <p className="py-6 text-center text-xs font-medium text-[var(--color-subtle-foreground)]">
                  Chọn người được uỷ quyền trước — danh sách đơn vị lọc theo cấp của họ.
                </p>
              ) : visibleUnits.length === 0 ? (
                <p className="py-6 text-center text-xs font-medium text-[var(--color-subtle-foreground)]">
                  Không có đơn vị nào khớp
                </p>
              ) : visibleUnits.map(u => {
                const picked = orgUnitIds.includes(u.id)
                return (
                  <ChoiceChip selected={picked} variant="solid" size="sm" className="w-full py-2 text-left" key={u.id} onClick={() => toggleUnit(u.id)}>
                    {/* Khi đang tìm kiếm thì bỏ thụt lề: kết quả lọc không còn liền mạch
                        theo cây nên gạch thụt chỉ gây hiểu nhầm về cấp bậc. */}
                    <span className="truncate">{unitSearch.trim() ? u.name : u.label}</span>
                    {picked && <Check className="shrink-0" />}
                  </ChoiceChip>
                )
              })}
            </div>
          </div>
          {blockedCount > 0 && (
            // Nói thẳng vì sao thiếu đơn vị: người trao đi tìm "Phòng Kinh doanh" mà
            // không thấy sẽ tưởng dữ liệu lỗi chứ không nghĩ là luật chặn.
            <p className="mt-1.5 text-caption leading-relaxed">
              Đã ẩn {blockedCount} đơn vị ở cấp cao hơn cấp mà người này đang phụ trách —
              uỷ quyền chỉ giao được đơn vị ngang cấp hoặc thấp hơn.
            </p>
          )}
          {orgUnitIds.length > 1 && (
            <p className="mt-1.5 text-xs font-medium text-[var(--color-primary)]">
              Đã chọn {orgUnitIds.length} đơn vị — tạo cùng lúc, hỏng một cái thì không cái nào được tạo.
            </p>
          )}
        </Field>

        <CheckRow
          checked={includeSubtree}
          onChange={setIncludeSubtree}
          title="Kèm cả các đơn vị cấp dưới"
          hint="Tắt nếu chỉ giao đúng đơn vị đó, không gồm các tổ/nhóm bên trong."
        />

        <CheckRow
          checked={canActAsLeader}
          onChange={setCanActAsLeader}
          title="Được ký thay vai trò trưởng đơn vị"
          hint="Cần bật để chấm hạnh kiểm — việc này đòi đúng người đứng đầu đơn vị. Tắt thì vẫn chấm KPI và chốt đánh giá được."
        />

        <Field label="Hết hiệu lực">
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className="w-full h-12 px-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium outline-none focus:ring-4 focus:ring-[var(--color-ring)]"
          />
          <p className="mt-1.5 text-caption">
            Bỏ trống = không hết hạn. Uỷ quyền tạm thời nên đặt hạn để khỏi quên thu hồi.
          </p>
        </Field>

        <Field label="Lý do">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder="VD: phòng Backend trống trưởng, giao chị Lan phụ trách tới khi có người mới…"
            className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium outline-none focus:ring-4 focus:ring-[var(--color-ring)] resize-y"
          />
        </Field>
      </div>

    </Dialog>
  )
}

function Field({
  label, required, children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-eyebrow">
        {label} {required && <span className="text-[var(--color-error)]">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function CheckRow({
  checked, onChange, title, hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  hint: string
}) {
  return (
    <ChoiceChip selected={checked} className="w-full text-left" onClick={() => onChange(!checked)}>
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
