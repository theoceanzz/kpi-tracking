import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, ChevronRight, Loader2, Search, UserRound, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDateTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import {
  useDocumentShares, useShareDocument, useShareTargets, useShareUnitMembers, useShareUnits, useUnshareDocument,
  useUpdateSharePermission,
} from '../hooks/useDocuments'
import type { DocumentShare, KbDocument, SharePermission, ShareTarget, ShareUnit } from '../types'
import { onlineFormat } from '../utils'

/** Trạng thái tích của một đơn vị / một người trong cây. */
interface ShareState {
  /** Lượt chia sẻ trực tiếp (bỏ tích = gỡ lượt này). */
  direct: DocumentShare | null
  /** Xem được nhờ đơn vị (chính nó hoặc cấp trên) đã được chia sẻ — tích sẵn, không bỏ được ở đây. */
  viaUnit: string | null
  /** Vừa bấm, đang gửi: giá trị tích sẽ có (hiện ngay, chưa chờ máy chủ). */
  pending?: boolean
}

/**
 * Chia sẻ quyền XEM theo cây đơn vị (docs/DOCUMENTS_DESIGN.md §15.3): tích một đơn vị = mọi người trong đơn vị đó VÀ
 * các đơn vị con xem được; mở đơn vị ra để tích từng người. Gõ tìm thì hiện kết quả phẳng (đơn vị + người). Đơn vị gốc
 * không có trong cây — chia sẻ cho cả công ty là việc của "Đề xuất lên Công ty".
 *
 * Người nhận đọc, tải về và K.AI đọc tài liệu khi trả lời họ. Tài liệu soạn trực tuyến có thêm mức "Chỉnh sửa" như Google
 * Docs: người nhận sửa được NỘI DUNG — vẫn không xoá, không di chuyển, không chia sẻ tiếp.
 */
export default function SharePanel({ doc }: { doc: KbDocument }) {
  const { t } = useTranslation('documents')
  const me = useAuthStore(s => s.user?.id)
  const [q, setQ] = useState('')
  const debounced = useDebounce(q.trim(), 300)
  const shares = useDocumentShares(doc.id, true)
  const units = useShareUnits(true)
  const search = useShareTargets(debounced, !!debounced)
  const share = useShareDocument()
  const unshare = useUnshareDocument()
  const updatePermission = useUpdateSharePermission()
  const busy = share.isPending || unshare.isPending || updatePermission.isPending
  // Chỉ tài liệu soạn trực tuyến mới có quyền "Chỉnh sửa"; tệp khác (PDF, Excel…) chia sẻ là để xem.
  const editable = !!onlineFormat(doc)
  const [permission, setPermission] = useState<SharePermission>('VIEW')

  // Tích / bỏ tích hiện NGAY (lạc quan), yêu cầu chạy ngầm. Trước đây khoá mọi ô trong lúc chờ nên ô nháy sang con trỏ
  // "cấm" rồi mới tích. Giữ trạng thái chờ tới khi danh sách chia sẻ tải lại xong — xoá sớm hơn thì ô nháy về trạng
  // thái cũ một nhịp. Lỗi thì bỏ trạng thái chờ, ô tự về đúng như máy chủ.
  const [pending, setPending] = useState<Map<string, boolean>>(new Map())
  const clearPending = (key: string) => setPending(prev => {
    const next = new Map(prev)
    next.delete(key)
    return next
  })
  const tree = useMemo(() => buildTree(units.data ?? []), [units.data])
  const directByKey = useMemo(() => {
    const m = new Map<string, DocumentShare>()
    for (const s of shares.data ?? []) m.set(`${s.type}:${s.granteeId}`, s)
    return m
  }, [shares.data])
  // Đơn vị được chia sẻ phủ xuống mọi đơn vị con: unitId → tên đơn vị (cấp cao nhất) đã chia sẻ phủ tới nó.
  const coveredBy = useMemo(() => {
    const out = new Map<string, string>()
    const walk = (u: ShareUnit, via: string | null) => {
      // Tính cả ô vừa bấm (đang gửi) để người / đơn vị con bên trong đổi theo ngay.
      const shared = pending.get(`UNIT:${u.id}`) ?? directByKey.has(`UNIT:${u.id}`)
      const self = shared ? (via ?? u.name) : via
      if (self) out.set(u.id, self)
      for (const c of tree.children.get(u.id) ?? []) walk(c, self)
    }
    tree.roots.forEach(u => walk(u, null))
    return out
  }, [tree, directByKey, pending])

  const unitState = (u: ShareUnit): ShareState => {
    const direct = directByKey.get(`UNIT:${u.id}`) ?? null
    // "Qua đơn vị" chỉ tính từ đơn vị CHA: tự nó được chia sẻ là lượt trực tiếp (bỏ tích được), không phải được phủ.
    const via = u.parentId ? (coveredBy.get(u.parentId) ?? null) : null
    return { direct, viaUnit: via, pending: pending.get(`UNIT:${u.id}`) }
  }
  const userState = (userId: string, unitId: string | null): ShareState => ({
    direct: directByKey.get(`USER:${userId}`) ?? null,
    viaUnit: unitId ? (coveredBy.get(unitId) ?? null) : null,
    pending: pending.get(`USER:${userId}`),
  })

  const toggle = (type: 'USER' | 'UNIT', id: string, state: ShareState) => {
    const key = `${type}:${id}`
    if (pending.has(key)) return // đang gửi cho chính ô này — bỏ qua bấm lặp
    const done = { onSuccess: () => { void shares.refetch().finally(() => clearPending(key)) }, onError: () => clearPending(key) }
    setPending(prev => new Map(prev).set(key, !state.direct))
    if (state.direct) unshare.mutate({ id: doc.id, shareId: state.direct.id }, done)
    else share.mutate({ id: doc.id, userIds: type === 'USER' ? [id] : [], unitIds: type === 'UNIT' ? [id] : [], permission }, done)
  }

  const ctx: TreeCtx = { tree, unitState, userState, toggle, ownerId: doc.ownerId, me }

  return (
    <div className="space-y-4">
      <p className="text-caption">{t(`share.intro.${doc.scope}`)}</p>

      <div className="flex gap-2">
        <Input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('share.searchPlaceholder')}
          aria-label={t('share.searchPlaceholder')}
          prefix={<Search aria-hidden="true" />}
          suffix={busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : undefined}
        />
        {editable && (
          <Select value={permission} onValueChange={v => setPermission(v as SharePermission)}>
            <SelectTrigger className="w-44 shrink-0" aria-label={t('share.newPermission')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="VIEW">{t('share.permission.VIEW')}</SelectItem>
              <SelectItem value="EDIT">{t('share.permission.EDIT')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      {editable && <p className="-mt-2 text-caption">{t('share.permissionHint')}</p>}

      <div className="max-h-[420px] overflow-y-auto rounded-card border border-[var(--color-border)]">
        {debounced ? (
          search.isLoading ? <div className="p-3"><LoadingSkeleton type="table" rows={3} /></div>
            : (search.data ?? []).length === 0 ? <p className="p-4 text-center text-caption">{t('share.noTargets')}</p>
              : (
                <ul className="divide-y divide-[var(--color-border)]" aria-label={t('share.results')}>
                  {search.data!.map(o => (
                    <li key={`${o.type}:${o.id}`}>
                      {o.type === 'UNIT'
                        ? <UnitRow ctx={ctx} unit={tree.byId.get(o.id) ?? { id: o.id, name: o.name, parentId: null, memberCount: 0 }}
                                   detail={o.detail} depth={0} expandable={false} />
                        : <UserRow ctx={ctx} user={o} unitId={null} depth={0} />}
                    </li>
                  ))}
                </ul>
              )
        ) : units.isLoading ? (
          <div className="p-3"><LoadingSkeleton type="table" rows={4} /></div>
        ) : tree.roots.length === 0 ? (
          <p className="p-4 text-center text-caption">{t('share.noUnits')}</p>
        ) : (
          <ul aria-label={t('share.unitTree')}>
            {tree.roots.map(u => <UnitNode key={u.id} ctx={ctx} unit={u} depth={0} />)}
          </ul>
        )}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">{t('share.listHeading')}</h3>
        {shares.isLoading ? (
          <LoadingSkeleton type="table" rows={2} />
        ) : (shares.data?.length ?? 0) === 0 ? (
          <p className="rounded-card border border-dashed border-[var(--color-border)] p-4 text-center text-caption">{t('share.none')}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
            {shares.data!.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <TargetIcon type={s.type} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[var(--color-foreground)]">
                    {s.name ?? '—'}
                    {s.type === 'UNIT' && <span className="ml-1.5 font-normal text-[var(--color-muted-foreground)]">{t('share.unitIncludesChildren')}</span>}
                  </span>
                  <span className="block truncate text-caption">
                    {t('share.grantedBy', { name: s.grantedByName ?? '—', time: formatDateTime(s.createdAt) })}
                  </span>
                </span>
                {editable ? (
                  <Select value={s.permission} disabled={busy}
                          onValueChange={v => updatePermission.mutate({ id: doc.id, shareId: s.id, permission: v as SharePermission })}>
                    <SelectTrigger className="h-8 w-36 shrink-0" aria-label={t('share.permissionOf', { name: s.name ?? '' })}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIEW">{t('share.permission.VIEW')}</SelectItem>
                      <SelectItem value="EDIT">{t('share.permission.EDIT')}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : <span className="shrink-0 text-caption">{t('share.canView')}</span>}
                <button type="button" onClick={() => unshare.mutate({ id: doc.id, shareId: s.id })} disabled={busy}
                        aria-label={t('share.remove', { name: s.name ?? '' })} title={t('share.remove', { name: s.name ?? '' })}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-[var(--color-muted-foreground)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]">
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Cây ───────────────────────────────────────────────────────────────────────────────────────────

interface Tree { roots: ShareUnit[]; children: Map<string, ShareUnit[]>; byId: Map<string, ShareUnit> }

function buildTree(units: ShareUnit[]): Tree {
  const byId = new Map(units.map(u => [u.id, u]))
  const children = new Map<string, ShareUnit[]>()
  const roots: ShareUnit[] = []
  for (const u of units) {
    if (u.parentId && byId.has(u.parentId)) {
      const list = children.get(u.parentId) ?? []
      list.push(u)
      children.set(u.parentId, list)
    } else {
      roots.push(u)
    }
  }
  return { roots, children, byId }
}

interface TreeCtx {
  tree: Tree
  unitState: (u: ShareUnit) => ShareState
  userState: (userId: string, unitId: string | null) => ShareState
  toggle: (type: 'USER' | 'UNIT', id: string, state: ShareState) => void
  ownerId: string | null
  me: string | undefined
}

function UnitNode({ ctx, unit, depth }: { ctx: TreeCtx; unit: ShareUnit; depth: number }) {
  const [open, setOpen] = useState(false)
  const kids = ctx.tree.children.get(unit.id) ?? []
  const expandable = kids.length > 0 || unit.memberCount > 0
  return (
    <li>
      <UnitRow ctx={ctx} unit={unit} depth={depth} expandable={expandable} open={open} onToggleOpen={() => setOpen(o => !o)} />
      {open && (
        <ul>
          {kids.map(c => <UnitNode key={c.id} ctx={ctx} unit={c} depth={depth + 1} />)}
          <Members ctx={ctx} unit={unit} depth={depth + 1} />
        </ul>
      )}
    </li>
  )
}

function UnitRow({ ctx, unit, depth, expandable, open, onToggleOpen, detail }: {
  ctx: TreeCtx; unit: ShareUnit; depth: number; expandable: boolean; open?: boolean; onToggleOpen?: () => void; detail?: string | null
}) {
  const { t } = useTranslation('documents')
  const state = ctx.unitState(unit)
  const checked = state.pending ?? (!!state.direct || !!state.viaUnit)
  const kids = ctx.tree.children.get(unit.id)?.length ?? 0
  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] py-2 pr-3" style={{ paddingLeft: 8 + depth * 20 }}>
      {expandable ? (
        <button type="button" onClick={onToggleOpen} aria-expanded={open} aria-label={open ? t('share.collapse', { name: unit.name }) : t('share.expand', { name: unit.name })}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]">
          <ChevronRight size={14} className={cn('transition-transform', open && 'rotate-90')} aria-hidden="true" />
        </button>
      ) : <span className="w-6 shrink-0" />}
      <Checkbox checked={checked} disabled={!!state.viaUnit && !state.direct} onCheckedChange={() => ctx.toggle('UNIT', unit.id, state)}
                aria-label={t('share.shareUnit', { name: unit.name })} />
      <TargetIcon type="UNIT" />
      <button type="button" onClick={expandable ? onToggleOpen : undefined} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">{unit.name}</span>
        <span className="block truncate text-caption">
          {state.viaUnit && !state.direct
            ? t('share.viaUnit', { name: state.viaUnit })
            : detail ?? t('share.unitMeta', { count: unit.memberCount, children: kids })}
        </span>
      </button>
      {(state.pending ?? !!state.direct) && <span className="shrink-0 text-xs font-medium text-[var(--color-primary)]">{t('share.wholeUnit')}</span>}
    </div>
  )
}

function Members({ ctx, unit, depth }: { ctx: TreeCtx; unit: ShareUnit; depth: number }) {
  const { t } = useTranslation('documents')
  const { data, isLoading } = useShareUnitMembers(unit.id, unit.memberCount > 0)
  if (unit.memberCount === 0) return null
  if (isLoading) return <li className="py-2 text-caption" style={{ paddingLeft: 8 + depth * 20 + 28 }}>{t('share.loadingMembers')}</li>
  return <>{(data ?? []).map(u => <li key={u.id}><UserRow ctx={ctx} user={u} unitId={unit.id} depth={depth} /></li>)}</>
}

function UserRow({ ctx, user, unitId, depth }: { ctx: TreeCtx; user: ShareTarget; unitId: string | null; depth: number }) {
  const { t } = useTranslation('documents')
  const state = ctx.userState(user.id, unitId)
  const isOwner = user.id === ctx.ownerId
  const isMe = user.id === ctx.me
  const locked = isOwner || isMe || (!state.direct && !!state.viaUnit)
  const checked = isOwner || (state.pending ?? (!!state.direct || !!state.viaUnit))
  const caption = isOwner ? t('share.owner') : isMe ? t('share.you') : (!state.direct && state.viaUnit) ? t('share.viaUnit', { name: state.viaUnit }) : user.detail
  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] py-2 pr-3" style={{ paddingLeft: 8 + depth * 20 + 28 }}>
      <Checkbox checked={checked} disabled={locked} onCheckedChange={() => ctx.toggle('USER', user.id, state)}
                aria-label={t('share.shareUser', { name: user.name })} />
      <TargetIcon type="USER" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-[var(--color-foreground)]">{user.name}</span>
        {caption && <span className="block truncate text-caption">{caption}</span>}
      </span>
    </div>
  )
}

function TargetIcon({ type }: { type: 'USER' | 'UNIT' }) {
  const Icon = type === 'UNIT' ? Building2 : UserRound
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]" aria-hidden="true">
      <Icon size={14} />
    </span>
  )
}
