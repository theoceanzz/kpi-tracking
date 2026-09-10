import { useMemo, useState } from 'react'
import {
  ArrowRightLeft, CalendarClock, Crown, Info, Loader2, Network, Plus, ShieldCheck, Trash2, X,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { useAuthStore } from '@/store/authStore'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganizationUsers } from '../hooks/useUserRoles'
import { useCreateDelegation, useDelegations, useRevokeDelegation } from '../hooks/useDelegations'
import type { DelegationResponse } from '../api/delegation.api'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

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
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 shrink-0">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Uỷ quyền quản lý chéo đơn vị</h3>
              <p className="text-xs font-medium text-slate-500">
                Cho một người quản lý thêm đơn vị không nằm trong cây của họ
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 shadow-lg shadow-violet-500/20 transition-all shrink-0"
          >
            <Plus size={16} /> Uỷ quyền mới
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
              Uỷ quyền chỉ <b>nới phạm vi</b> của quyền sẵn có, không cấp quyền mới: người không
              có quyền chốt kỳ ở đâu cả thì được uỷ quyền cũng vẫn không chốt được. Vai trò và
              ràng buộc "mỗi đơn vị một trưởng, một phó" giữ nguyên.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-violet-500" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Network size={40} className="mx-auto text-slate-300" />
              <p className="text-sm font-black text-slate-900 dark:text-white">Chưa có uỷ quyền nào</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
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
                  <p className="pt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
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
      'p-4 rounded-2xl border flex flex-col lg:flex-row lg:items-center gap-4',
      d.active
        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 opacity-70',
    )}>
      <UserAvatar
        fullName={d.delegateUserName}
        avatarUrl={d.delegateUserAvatarUrl}
        className="w-10 h-10 rounded-xl shrink-0"
        fallbackClassName="bg-violet-50 dark:bg-violet-900/30 font-black text-xs text-violet-600"
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{d.delegateUserName}</p>
        {/* Đường đi của quyền là thứ người đọc cần thấy đầu tiên: từ đơn vị nào sang đơn vị nào. */}
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
          <span className="text-slate-400">{d.fromOrgUnitName || 'Đơn vị gốc'}</span>
          {d.delegateRoleName && <span className="text-slate-300">· {d.delegateRoleName}</span>}
          <ArrowRightLeft size={11} className="text-violet-500" />
          <span className="text-violet-600 dark:text-violet-400">{d.orgUnitName}</span>
          {d.includeSubtree && <span className="text-slate-400">(kèm cấp dưới)</span>}
        </p>
        {d.reason && (
          <p className="mt-1 text-[11px] font-medium text-slate-400 italic line-clamp-2">"{d.reason}"</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {d.canActAsLeader && (
          <span
            title="Được ký thay vai trò trưởng đơn vị — gồm cả chấm hạnh kiểm"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-100 dark:border-amber-800/50"
          >
            <Crown size={11} /> Ký thay trưởng
          </span>
        )}
        <span className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border',
          d.active
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700',
        )}>
          <ShieldCheck size={11} /> {statusLabel}
        </span>
        {d.expiresAt && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 whitespace-nowrap">
            <CalendarClock size={11} /> đến {format(parseISO(d.expiresAt), 'dd/MM/yyyy')}
          </span>
        )}
        <button
          onClick={onRevoke}
          disabled={isRevoking}
          title="Thu hồi uỷ quyền"
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

/** Đơn vị trong cây, làm phẳng kèm thụt lề để chọn trong danh sách. */
type FlatUnit = { id: string; name: string; label: string }

/** Chỉ ba trường cần cho danh sách chọn — cây trả về nhiều hơn thế. */
type UnitNode = { id: string; name: string; children?: UnitNode[] }

function flattenUnits(nodes: UnitNode[], level = 0): FlatUnit[] {
  const out: FlatUnit[] = []
  for (const node of nodes ?? []) {
    out.push({
      id: node.id,
      name: node.name,
      label: `${'— '.repeat(level)}${node.name}`,
    })
    if (node.children?.length) out.push(...flattenUnits(node.children, level + 1))
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
  const users = usersPage?.content ?? []

  const [delegateUserId, setDelegateUserId] = useState('')
  const [orgUnitId, setOrgUnitId] = useState('')
  const [includeSubtree, setIncludeSubtree] = useState(true)
  const [canActAsLeader, setCanActAsLeader] = useState(true)
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const canSubmit = !!delegateUserId && !!orgUnitId && !create.isPending

  const submit = () => {
    if (!canSubmit) return
    create.mutate(
      {
        delegateUserId,
        orgUnitId,
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-600">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Uỷ quyền quản lý đơn vị</h3>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                Nới phạm vi quyền sẵn có
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Người được uỷ quyền" required>
            <Select value={delegateUserId} onValueChange={setDelegateUserId}>
              <SelectTrigger className="w-full h-12 rounded-2xl">
                <SelectValue placeholder="Chọn nhân sự…" />
              </SelectTrigger>
              <SelectContent className="z-[1100]">
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName} · {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Đơn vị được giao quản lý" required>
            <Select value={orgUnitId} onValueChange={setOrgUnitId}>
              <SelectTrigger className="w-full h-12 rounded-2xl">
                <SelectValue placeholder="Chọn đơn vị…" />
              </SelectTrigger>
              <SelectContent className="z-[1100]">
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-bold outline-none focus:ring-4 focus:ring-violet-500/10"
            />
            <p className="mt-1.5 text-[11px] font-medium text-slate-400">
              Bỏ trống = không hết hạn. Uỷ quyền tạm thời nên đặt hạn để khỏi quên thu hồi.
            </p>
          </Field>

          <Field label="Lý do">
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="VD: phòng Backend trống trưởng, giao chị Lan phụ trách tới khi có người mới…"
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-medium outline-none focus:ring-4 focus:ring-violet-500/10 resize-y"
            />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Huỷ
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-violet-600 text-white text-xs font-black uppercase tracking-widest hover:bg-violet-700 shadow-lg shadow-violet-500/25 disabled:opacity-50"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Uỷ quyền
          </button>
        </div>
      </div>
    </div>
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
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label} {required && <span className="text-red-500">*</span>}
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
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all',
        checked
          ? 'bg-violet-50/50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800/50'
          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700',
      )}
    >
      <span className={cn(
        'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
        checked ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-slate-600',
      )}>
        {checked && <span className="w-2 h-2 rounded-sm bg-white" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black text-slate-700 dark:text-slate-200">{title}</span>
        <span className="block mt-0.5 text-[11px] font-medium text-slate-400 leading-relaxed">{hint}</span>
      </span>
    </button>
  )
}
