import { useState } from 'react'
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, Clock, Database, FileText, Filter, Loader2, Lock, Plus, SearchX, Trash2, X,
} from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import FilterBar from '@/components/common/FilterBar'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HintOn, InfoHint } from '@/components/common/InfoHint'
import { cn } from '@/lib/utils'
import {
  useAiCriteriaSet, useAiCriteriaSets, useCancelAiCriteriaRequest, useConfirmAiCriteriaSet, useDeleteAiCriteriaSet,
  useRequestAiCriteriaChange, useUpdateAiCriteriaItems,
} from '../hooks/useAiReview'
import UnitLockNotice from './UnitLockNotice'
import { activeAt } from './aiUnitScope'
import type { AiCriteriaKind, AiCriteriaRole, AiCriteriaSetItem } from '../api/aiReviewApi'

/** Bộ vai trò dự phòng khi bản cũ chưa có `roles` từ máy chủ. */
const DEFAULT_ROLES: AiCriteriaRole[] = [
  { code: 'TIEU_CHI', label: 'Căn cứ chấm', scoring: true, inPrompt: true, itemsLabel: 'Các mức, mỗi dòng một mức',
    hint: 'Những gì quản lý dựa vào để chấm kết quả công việc. AI dùng nhóm này để đánh giá chất lượng bài nộp.' },
  { code: 'THANG_MUC', label: 'Thang mức', scoring: true, inPrompt: true, itemsLabel: 'Các mức, mỗi dòng một mức',
    hint: 'Các mức xếp loại kết quả công việc. AI dùng để chọn mức chất lượng.' },
  { code: 'THAM_KHAO', label: 'AI đọc khi chấm', scoring: false, inPrompt: true, itemsLabel: 'Các ý, mỗi dòng một ý',
    hint: 'Quy định ảnh hưởng tới việc đánh giá. AI đọc để lưu ý, không chấm theo.' },
  { code: 'TRA_CUU', label: 'Chỉ tra cứu', scoring: false, inPrompt: false, itemsLabel: 'Các ý, mỗi dòng một ý',
    hint: 'Nội dung khác của tài liệu. Không vào lời nhắc chấm; AI tra khi cần qua kho tri thức.' },
]
/** Quá số nhóm này thì thanh tab ngang chật — chuyển sang cột trái / Select. */
const MAX_TABS = 5
const NO_TOPIC = 'Khác'

type Group = {
  key: string
  label: string
  count: number
  issues: number
  block: 'scoring' | 'topic' | 'extra'
  role?: AiCriteriaRole
  topic?: string
}

const linesOf = (s?: string | null) => (s ?? '').split('\n').map(l => l.trim()).filter(Boolean)
/** Máy không thấy nguyên văn đoạn gốc và người duyệt chưa xác nhận dòng đúng. */
const needsCheck = (it: AiCriteriaSetItem) => !!it.sourceExcerpt && it.excerptVerified === false && !it.reviewerConfirmed
const topicOf = (it: AiCriteriaSetItem) => it.topic?.trim() || NO_TOPIC

function splitSection(s?: string | null) {
  if (!s) return { title: 'Dòng thêm tay', chapter: '' }
  const parts = s.split(' › ')
  return { title: parts[parts.length - 1], chapter: parts.slice(0, -1).join(' › ') }
}

function matches(it: AiCriteriaSetItem, q: string) {
  if (!q) return true
  return [it.name, it.description, it.scaleLevels, it.scope, it.section, it.topic].join(' ').toLowerCase().includes(q.toLowerCase())
}

/**
 * Màn duyệt bộ tiêu chí ("máy bóc, người xác nhận"). Nhóm DỰNG TỪ DỮ LIỆU: khối "Dùng để chấm" (căn cứ chấm,
 * thang mức) + mỗi CHỦ ĐỀ của chính tài liệu một nhóm — tài liệu ít mảng nội dung ra ít nhóm, nhiều ra nhiều.
 * Nhóm rỗng không hiện. Điều hướng tự co giãn: ≤ 5 nhóm là tab ngang; nhiều hơn là cột trái (máy tính) /
 * Select (điện thoại). Dòng thu gọn, bấm mới mở đoạn gốc và ô sửa.
 */
export default function AiCriteriaReconcileDialog({ setId, onClose }: { setId: string | null; onClose: () => void }) {
  const { data: set, isLoading } = useAiCriteriaSet(setId)
  const saveItems = useUpdateAiCriteriaItems()
  const confirm = useConfirmAiCriteriaSet()
  const remove = useDeleteAiCriteriaSet()
  const [edited, setEdited] = useState<AiCriteriaSetItem[] | null>(null)
  const [groupState, setGroup] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [onlyIssues, setOnlyIssues] = useState(false)
  // Dòng vừa xác nhận trong lúc lọc "Cần kiểm lại": vẫn hiện (thành tích xanh) tới khi đổi nhóm / bỏ lọc.
  const [confirmedNow, setConfirmedNow] = useState<Set<string>>(new Set())

  const items = edited ?? set?.items ?? []
  const roles = set?.roles?.length ? set.roles : DEFAULT_ROLES
  const roleOf = (code?: string | null) => roles.find(r => r.code === code) ?? DEFAULT_ROLES.find(r => r.code === code)
  const isScoringRow = (it: AiCriteriaSetItem) => !!roleOf(it.kind)?.scoring
  const fallbackRole = [...roles].reverse().find(r => !r.scoring)?.code ?? 'TRA_CUU'
  // "Sửa được": bản nháp mà người xem quản lý (bản nháp của đơn vị khác / tài liệu đề nghị chỉ xem).
  const isDraft = set?.status === 'DRAFT' && set?.canManage !== false
  const { data: allSets = [] } = useAiCriteriaSets(!!setId)
  const requestChange = useRequestAiCriteriaChange()
  const cancelRequest = useCancelAiCriteriaRequest()
  const [viewId, setViewId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [confirmReplace, setConfirmReplace] = useState(false)
  // Tài liệu đang áp ở đơn vị của bản nháp: của cấp trên → gửi đề nghị; của mình → hỏi trước khi thay.
  const current = set?.status === 'DRAFT' ? activeAt(allSets, set.orgUnitId, set.id) : undefined
  const pending = set?.pendingRequest
  const needsRequest = isDraft && !pending && !!current?.locked
  const dirty = edited !== null
  const busy = saveItems.isPending || confirm.isPending || remove.isPending || requestChange.isPending
  const skipped = set?.skippedSections ?? []
  const failed = set?.failedSections ?? []
  const invalid = items.length === 0 || items.some(i => !i.name?.trim())

  // ── nhóm, theo dữ liệu ─────────────────────────────────────────────────
  const inGroup = (g: Group, it: AiCriteriaSetItem) => g.block === 'scoring'
    ? it.kind === g.role?.code
    : g.block === 'topic' && !isScoringRow(it) && topicOf(it) === g.topic
  const scoringGroups: Group[] = roles.filter(r => r.scoring).map(r => ({
    key: `role:${r.code}`, label: r.label, block: 'scoring' as const, role: r, count: 0, issues: 0,
  }))
  const topicNames: string[] = []
  items.filter(it => !isScoringRow(it)).forEach(it => {
    const t = topicOf(it)
    if (!topicNames.includes(t)) topicNames.push(t)
  })
  const topicGroups: Group[] = topicNames.map(t => ({ key: `topic:${t}`, label: t, block: 'topic' as const, topic: t, count: 0, issues: 0 }))
  const contentGroups = [...scoringGroups, ...topicGroups]
    .map(g => ({ ...g, count: items.filter(it => inGroup(g, it)).length, issues: items.filter(it => inGroup(g, it) && needsCheck(it)).length }))
    .filter(g => g.count > 0)
  const extraGroups: Group[] = [
    ...(skipped.length ? [{ key: 'SKIPPED', label: 'Không bóc', block: 'extra' as const, count: skipped.length, issues: 0 }] : []),
    ...(set?.sourceText ? [{ key: 'SOURCE', label: 'Tài liệu gốc', block: 'extra' as const, count: -1, issues: 0 }] : []),
  ]
  const allGroups = [...contentGroups, ...extraGroups]
  const group = allGroups.find(g => g.key === groupState) ?? contentGroups[0] ?? extraGroups[0]
  const manyGroups = contentGroups.length > MAX_TABS
  const existingTopics = topicNames.filter(t => t !== NO_TOPIC)

  const patch = (idx: number, change: Partial<AiCriteriaSetItem>) =>
    setEdited(items.map((it, i) => (i === idx ? { ...it, ...change } : it)))

  const resetView = (key: string | null) => {
    setGroup(key)
    setOpenKey(null)
    setQuery('')
    setOnlyIssues(false)
    setConfirmedNow(new Set())
  }

  const clearFilters = () => {
    setQuery('')
    setOnlyIssues(false)
    setConfirmedNow(new Set())
  }

  const close = () => {
    setEdited(null)
    setNote('')
    setViewId(null)
    resetView(null)
    onClose()
  }

  const addRow = () => {
    if (!group || group.block === 'extra') return
    const row: AiCriteriaSetItem = group.block === 'scoring'
      ? { kind: group.role!.code, name: '', description: '', scaleLevels: '', scope: '' }
      : { kind: fallbackRole, topic: group.topic === NO_TOPIC ? null : group.topic, name: '', description: '', scaleLevels: '', scope: '' }
    setEdited([...items, row])
    setOpenKey(`new-${items.length}`)
    setQuery('')
    setOnlyIssues(false)
  }

  const onSave = () => {
    if (!set) return
    saveItems.mutate({ id: set.id, items }, { onSuccess: () => setEdited(null) })
  }

  const saveIfDirty = async () => {
    if (!set || !dirty) return
    await saveItems.mutateAsync({ id: set.id, items })
    setEdited(null)
  }

  const doConfirm = async () => {
    if (!set) return
    await saveIfDirty()
    confirm.mutate(set.id, { onSuccess: close })
  }

  // Đơn vị đang áp tài liệu của chính mình / cấp dưới: hỏi trước khi thay.
  const onConfirm = () => (current && !current.locked ? setConfirmReplace(true) : doConfirm())

  const onRequest = async () => {
    if (!set) return
    await saveIfDirty()
    requestChange.mutate({ id: set.id, meta: { orgUnitId: set.orgUnitId ?? null, note: note.trim() || null } }, { onSuccess: close })
  }

  const lockBanner = pending ? (
    <div className="flex flex-wrap items-center gap-2 rounded-control border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-3 py-2 text-sm">
      <Clock size={15} className="shrink-0 text-[var(--color-info)]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        Đã gửi đề nghị áp cho {pending.orgUnitName ?? 'đơn vị'} — đang chờ {pending.approverName ?? 'cấp trên'} duyệt.
      </span>
      {pending.mine && (
        <Button size="sm" variant="outline" disabled={cancelRequest.isPending} onClick={() => cancelRequest.mutate(pending.id)}>
          Rút đề nghị
        </Button>
      )}
    </div>
  ) : needsRequest && current ? (
    <UnitLockNotice current={current} onView={() => setViewId(current.id)}>
      <Input value={note} onChange={e => setNote(e.target.value)} maxLength={1000} aria-label="Ghi chú cho người duyệt"
             placeholder="Ghi chú cho người duyệt (không bắt buộc)" className="min-w-0 flex-1 sm:max-w-md" />
    </UnitLockNotice>
  ) : null

  const visible = !group || group.block === 'extra' ? [] : items
    .map((it, idx) => ({ it, idx, key: it.id ?? `new-${idx}` }))
    .filter(x => inGroup(group, x.it))
    .filter(x => !onlyIssues || needsCheck(x.it) || confirmedNow.has(x.key))
    .filter(x => matches(x.it, query))
  const filtering = onlyIssues || !!query.trim()
  const groupTotal = group && group.block !== 'extra' ? items.filter(it => inGroup(group, it)).length : 0

  /** Người duyệt xác nhận dòng đúng → tích xanh, mở luôn dòng cần kiểm tiếp theo. */
  const confirmRow = (idx: number, key: string) => {
    patch(idx, { reviewerConfirmed: true })
    setConfirmedNow(prev => new Set(prev).add(key))
    const pos = visible.findIndex(v => v.key === key)
    const next = visible.slice(pos + 1).find(v => needsCheck(v.it))
    setOpenKey(next ? next.key : null)
    if (next) {
      requestAnimationFrame(() => document.getElementById(`crit-row-${next.key}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    }
  }
  const sections: { section: string; rows: typeof visible }[] = []
  for (const v of visible) {
    const s = v.it.section ?? ''
    const last = sections[sections.length - 1]
    if (last && last.section === s) last.rows.push(v)
    else sections.push({ section: s, rows: [v] })
  }

  // ── một dòng ───────────────────────────────────────────────────────────
  const rowView = ({ it, idx, key }: { it: AiCriteriaSetItem; idx: number; key: string }) => {
    const role = roleOf(it.kind)
    const lines = linesOf(it.scaleLevels)
    const open = openKey === key
    return (
      <li key={key} id={`crit-row-${key}`} className={cn('scroll-mt-40 rounded-control border bg-[var(--color-card)] transition-colors',
        open ? 'border-[var(--color-primary)]/40 shadow-sm' : 'border-[var(--color-border)]')}>
        <button type="button" onClick={() => setOpenKey(open ? null : key)} aria-expanded={open}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-muted)]/40">
          {needsCheck(it)
            ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-label="Cần kiểm lại" />
            : it.sourceExcerpt
              ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--color-success)]"
                              aria-label={it.excerptVerified ? 'Khớp tài liệu' : 'Đã kiểm tra'} />
              : <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-dashed border-[var(--color-border-strong)]" aria-label="Dòng thêm tay" />}
          <div className="min-w-0 flex-1 space-y-1">
            <p className={cn('text-sm font-medium', !it.name?.trim() && 'italic text-[var(--color-muted-foreground)]')}>
              {it.name?.trim() || 'Chưa đặt tên'}
            </p>
            {!open && it.description && it.description !== it.name && (
              <p className="line-clamp-2 text-xs text-[var(--color-muted-foreground)]">{it.description}</p>
            )}
            {!open && lines.length > 0 && (
              <ul className="space-y-0.5 text-xs text-[var(--color-foreground)]/80">
                {lines.slice(0, 3).map((l, i) => (
                  <li key={i} className="flex gap-1.5"><span className="text-[var(--color-muted-foreground)]">•</span><span className="line-clamp-1">{l}</span></li>
                ))}
                {lines.length > 3 && <li className="text-[var(--color-muted-foreground)]">+{lines.length - 3} ý nữa</li>}
              </ul>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {it.weight != null && <Badge variant="default">{it.weight}%</Badge>}
            {role && !role.scoring && (
              <HintOn hint={role.hint}>
                <Badge variant={role.inPrompt ? 'info' : 'secondary'}>{role.label}</Badge>
              </HintOn>
            )}
            {it.scope && <Badge variant="secondary" className="hidden max-w-40 truncate lg:inline-flex">{it.scope}</Badge>}
            <ChevronDown size={16} className={cn('text-[var(--color-muted-foreground)] transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </div>
        </button>

        {open && (
          <div className="grid gap-4 border-t border-[var(--color-border)] p-3 md:grid-cols-[2fr_3fr]">
            <div className="space-y-2">
              <p className="text-label">Trong tài liệu</p>
              {it.sourceExcerpt ? (
                <>
                  <blockquote className="border-l-2 border-[var(--color-border-strong)] pl-3 text-sm italic text-[var(--color-foreground)]">
                    {it.sourceExcerpt}
                  </blockquote>
                  {it.excerptVerified ? (
                    <p className="flex items-center gap-1 text-xs text-[var(--color-success)]"><CheckCircle2 size={12} aria-hidden="true" /> Khớp tài liệu</p>
                  ) : it.reviewerConfirmed ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="flex items-center gap-1 text-[var(--color-success)]">
                        <CheckCircle2 size={12} aria-hidden="true" /> Đã kiểm tra — bạn xác nhận dòng này đúng
                      </span>
                      {isDraft && (
                        <button type="button" onClick={() => patch(idx, { reviewerConfirmed: false })}
                                className="text-[var(--color-muted-foreground)] underline underline-offset-2 hover:text-[var(--color-foreground)]">
                          Bỏ xác nhận
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-control border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-2.5">
                      <p className="flex items-center gap-1 text-xs font-medium text-[var(--color-warning)]">
                        <AlertTriangle size={12} aria-hidden="true" /> Không thấy nguyên văn trong tài liệu
                        <InfoHint>Hay gặp ở bảng trong PDF (chữ bị xếp khác thứ tự). Đối chiếu ở tab "Tài liệu gốc": đúng thì bấm xác nhận, sai thì sửa hoặc xoá dòng.</InfoHint>
                      </p>
                      {isDraft && (
                        <Button size="sm" variant="outline" onClick={() => confirmRow(idx, key)}
                                className="border-[var(--color-success)]/40 text-[var(--color-success)] hover:bg-[var(--color-success)]/10">
                          <Check aria-hidden="true" /> Đã kiểm, nội dung đúng
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--color-muted-foreground)]">Dòng thêm tay, không có đoạn gốc.</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Input value={it.name} disabled={!isDraft} aria-label="Tên" placeholder="Tên" invalid={!it.name?.trim()}
                       onChange={e => patch(idx, { name: e.target.value })} className="min-w-0 flex-1" />
                <Select value={it.kind ?? fallbackRole} disabled={!isDraft}
                        onValueChange={v => { patch(idx, { kind: v as AiCriteriaKind }); setOpenKey(null) }}>
                  <SelectTrigger className="w-44 shrink-0" aria-label="Vai trò"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!role?.scoring && (
                <div className="space-y-1">
                  <Input value={it.topic ?? ''} disabled={!isDraft} aria-label="Chủ đề" placeholder="Chủ đề (nhóm hiển thị)"
                         onChange={e => patch(idx, { topic: e.target.value })} />
                  {isDraft && existingTopics.length > 1 && (
                    <div className="flex flex-wrap gap-1">
                      {existingTopics.filter(t => t !== it.topic).slice(0, 6).map(t => (
                        <ChoiceChip key={t} size="sm" selected={false} className="max-w-full truncate"
                                    onClick={() => { patch(idx, { topic: t }); setOpenKey(null) }}>
                          {t}
                        </ChoiceChip>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Textarea rows={2} placeholder="Nội dung" aria-label="Nội dung" value={it.description ?? ''} disabled={!isDraft}
                        onChange={e => patch(idx, { description: e.target.value })} />
              <Textarea rows={Math.min(8, Math.max(2, lines.length))} placeholder={role?.itemsLabel} aria-label={role?.itemsLabel}
                        value={it.scaleLevels ?? ''} disabled={!isDraft}
                        onChange={e => patch(idx, { scaleLevels: e.target.value })} />
              <div className={cn('grid gap-2', it.kind === 'TIEU_CHI' && 'sm:grid-cols-[1fr_8rem]')}>
                <Input placeholder="Áp dụng cho (bộ phận / vai trò)" aria-label="Áp dụng cho" value={it.scope ?? ''}
                       disabled={!isDraft} onChange={e => patch(idx, { scope: e.target.value })} />
                {it.kind === 'TIEU_CHI' && (
                  <Input type="number" min={0} max={100} value={it.weight ?? ''} disabled={!isDraft}
                         aria-label="Trọng số" placeholder="Trọng số"
                         suffix={<span className="text-xs text-[var(--color-muted-foreground)]">%</span>}
                         onChange={e => patch(idx, { weight: e.target.value === '' ? null : Number(e.target.value) })} />
                )}
              </div>
              {isDraft && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="text-[var(--color-error)]"
                          onClick={() => { setEdited(items.filter((_, i) => i !== idx)); setOpenKey(null) }}>
                    <Trash2 aria-hidden="true" /> Xoá dòng
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </li>
    )
  }

  // ── điều hướng nhóm ────────────────────────────────────────────────────
  const count = (g: Group) => g.count >= 0 && (
    <span className={cn('rounded-full px-1.5 text-xs tabular-nums', g.key === group?.key ? 'bg-white/20' : 'bg-[var(--color-muted)]')}>{g.count}</span>
  )
  const navButton = (g: Group, vertical: boolean) => {
    const active = g.key === group?.key
    return (
      <button key={g.key} type="button" role="tab" aria-selected={active} onClick={() => resetView(g.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm transition-colors',
                vertical ? 'w-full justify-between text-left' : 'shrink-0',
                active
                  ? 'bg-[var(--color-primary)] font-medium text-[var(--color-primary-foreground)]'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]',
              )}>
        <span className={cn('flex min-w-0 items-center gap-1.5', vertical && 'flex-1')}>
          {g.key === 'SOURCE' && <FileText size={14} aria-hidden="true" />}
          <span className={cn(vertical && 'truncate')}>{g.label}</span>
          {!!g.issues && (
            <span title={`${g.issues} dòng cần kiểm lại`} aria-label={`${g.issues} dòng cần kiểm lại`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--color-warning-bg)] px-1.5 py-px text-[11px] font-medium tabular-nums text-[var(--color-warning)]">
              <AlertTriangle size={11} aria-hidden="true" />{g.issues}
            </span>
          )}
        </span>
        {count(g)}
      </button>
    )
  }
  const scoringVisible = contentGroups.filter(g => g.block === 'scoring')
  const topicsVisible = contentGroups.filter(g => g.block === 'topic')

  // Hàng lọc chuẩn (FilterBar): bộ lọc bên trái, ô tìm bên phải, "Thêm dòng" cuối hàng.
  const toolbar = group && group.block !== 'extra' && (
    <div className="space-y-2">
      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: `Tìm trong ${group.label.toLowerCase()}`, className: 'sm:w-72' }}
        trailing={isDraft && (
          <Button variant="outline" onClick={addRow}>
            <Plus aria-hidden="true" /> Thêm dòng
          </Button>
        )}
      >
        {(group.issues > 0 || onlyIssues) && (
          <Button variant="outline" aria-pressed={onlyIssues}
                  onClick={() => { setOnlyIssues(v => !v); setConfirmedNow(new Set()) }}
                  className={cn(onlyIssues
                    ? 'border-[var(--color-warning)] bg-[var(--color-warning)] text-white hover:bg-[var(--color-warning)]/90 hover:text-white'
                    : 'border-[var(--color-warning-border)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]')}>
            <AlertTriangle aria-hidden="true" /> Cần kiểm lại ({group.issues})
            {onlyIssues && <X aria-label="Bỏ lọc" />}
          </Button>
        )}
        {group.role && (
          <span className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
            Nhóm này dùng để làm gì?<InfoHint>{group.role.hint}</InfoHint>
          </span>
        )}
      </FilterBar>
      {filtering && (
        <div role="status" className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)]/60 px-3 py-1.5 text-xs">
          <Filter size={12} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
          <span>
            Đang lọc: hiện <b className="tabular-nums">{visible.length}</b>/<span className="tabular-nums">{groupTotal}</span> dòng
            {onlyIssues && ' · chỉ dòng cần kiểm lại'}
            {query.trim() && <> · khớp “{query.trim()}”</>}
          </span>
          {onlyIssues && group.issues === 0 && (
            <span className="flex items-center gap-1 font-medium text-[var(--color-success)]">
              <CheckCircle2 size={12} aria-hidden="true" /> Đã kiểm hết nhóm này
            </span>
          )}
          <button type="button" onClick={clearFilters}
                  className="ml-auto font-medium text-[var(--color-primary)] underline-offset-2 hover:underline">
            Bỏ lọc, hiện tất cả
          </button>
        </div>
      )}
    </div>
  )

  const body = !group ? null : group.key === 'SOURCE' ? (
    <pre className="whitespace-pre-wrap rounded-control border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4 text-xs leading-relaxed">
      {set?.sourceText}
    </pre>
  ) : group.key === 'SKIPPED' ? (
    <div className="space-y-2">
      <p className="text-sm text-[var(--color-muted-foreground)]">Các mục dưới đây chỉ có ô trống để điền, chữ ký hoặc trang bìa nên không có dòng nào.</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">{skipped.map(s => <li key={s}>{s}</li>)}</ul>
    </div>
  ) : sections.length === 0 ? (
    filtering ? (
      <EmptyState icon={SearchX} title="Không có dòng nào khớp bộ lọc"
                  description="Thử từ khoá khác, hoặc bỏ lọc để xem cả nhóm."
                  action={<Button variant="outline" onClick={clearFilters}>Bỏ lọc, hiện tất cả</Button>} />
    ) : (
      <EmptyState title="Nhóm này chưa có dòng nào"
                  description={isDraft ? 'Thêm dòng nếu tài liệu có nội dung AI chưa bóc ra.' : undefined}
                  action={isDraft ? <Button variant="outline" onClick={addRow}><Plus aria-hidden="true" /> Thêm dòng</Button> : undefined} />
    )
  ) : (
    <div className="space-y-5">
      {sections.map((g, gi) => {
        const sec = splitSection(g.section)
        return (
          <section key={`${g.section}-${gi}`} className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{sec.title}</h3>
              {sec.chapter && <p className="text-xs text-[var(--color-muted-foreground)]">{sec.chapter}</p>}
            </div>
            <ul className="space-y-1.5">{g.rows.map(rowView)}</ul>
          </section>
        )
      })}
    </div>
  )

  return (
    <>
    <Dialog
      open={!!setId}
      onClose={close}
      size="full"
      flush
      // Chiều cao cố định: đổi nhóm (2 dòng ↔ 55 dòng) không làm hộp thoại co giãn, nhảy vị trí.
      className="sm:h-[calc(100dvh-2rem)]"
      title={set ? set.title : 'Bộ tiêu chí'}
      headerExtra={set && (
        set.status === 'CONFIRMED' && set.locked ? (
          <Badge variant="secondary"><Lock size={11} aria-hidden="true" /> Cấp trên áp</Badge>
        ) : (
          <Badge variant={set.status === 'DRAFT' ? 'warning' : set.status === 'CONFIRMED' ? 'success' : 'secondary'}>
            {set.status === 'DRAFT' ? 'Bản nháp' : set.status === 'CONFIRMED' ? 'Đang áp dụng' : 'Ngừng áp dụng'}
          </Badge>
        )
      )}
      description={set && (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            {set.orgUnitName ?? 'Cả tổ chức'}{set.sourceFileName && ` · ${set.sourceFileName}`}
            {set.status === 'CONFIRMED' && set.appliedByName && ` · áp bởi ${set.appliedByName}${set.appliedByRole ? ` (${set.appliedByRole})` : ''}`}
          </span>
          {set.profileLabel && (
            <HintOn hint="Loại tài liệu hệ thống nhận ra — quyết định cách cắt mục và các vai trò được dùng.">
              <Badge variant="outline">{set.profileLabel}</Badge>
            </HintOn>
          )}
          {set.inKnowledgeBase ? (
            <HintOn hint="Toàn văn tài liệu đã được nạp vào kho tri thức — khi chấm, AI trích đúng đoạn nhiệm vụ / quy định liên quan.">
              <Badge variant="info"><Database size={12} aria-hidden="true" /> Trong kho tri thức</Badge>
            </HintOn>
          ) : isDraft && (
            <HintOn hint="Xác nhận xong, toàn văn tài liệu được nạp vào kho tri thức để AI trích đoạn liên quan khi chấm.">
              <span className="text-xs underline decoration-dotted underline-offset-2">Nạp kho tri thức khi xác nhận</span>
            </HintOn>
          )}
        </span>
      )}
      footer={isDraft ? (
        <DialogFooter
          destructive={(
            <Button variant="ghost" className="text-[var(--color-error)]" disabled={busy}
                    onClick={() => set && remove.mutate(set.id, { onSuccess: close })}>
              <Trash2 aria-hidden="true" /> Xoá bản nháp
            </Button>
          )}
          secondary={<Button variant="outline" disabled={!dirty || busy || invalid} onClick={onSave}>Lưu nháp</Button>}
          primary={pending ? (
            <Button disabled>Đang chờ duyệt đề nghị</Button>
          ) : needsRequest ? (
            <Button disabled={busy || invalid} onClick={onRequest}>
              {requestChange.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Gửi đề nghị áp dụng
            </Button>
          ) : (
            <Button disabled={busy || invalid} onClick={onConfirm}>
              {confirm.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Xác nhận
            </Button>
          )}
        />
      ) : (
        <DialogFooter secondary={<Button variant="outline" onClick={close}>Đóng</Button>} />
      )}
    >
      {isLoading || !set ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--color-muted-foreground)]" /></div>
      ) : manyGroups ? (
        // Nhiều nhóm: cột trái (máy tính), Select (điện thoại).
        <div className="flex min-h-full flex-col md:flex-row">
          <nav role="tablist" aria-label="Nhóm" className="hidden w-64 shrink-0 space-y-4 border-r border-[var(--color-border)] p-3 md:block">
            {scoringVisible.length > 0 && (
              <div className="space-y-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">Dùng để chấm</p>
                {scoringVisible.map(g => navButton(g, true))}
              </div>
            )}
            {topicsVisible.length > 0 && (
              <div className="space-y-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">Theo nội dung tài liệu</p>
                {topicsVisible.map(g => navButton(g, true))}
              </div>
            )}
            {extraGroups.length > 0 && (
              <div className="space-y-1 border-t border-[var(--color-border)] pt-3">{extraGroups.map(g => navButton(g, true))}</div>
            )}
          </nav>
          <div className="min-w-0 flex-1">
            <div className="sticky top-0 z-10 space-y-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-5 pb-3 pt-4">
              {lockBanner}
              {failed.length > 0 && <FailedBanner failed={failed} />}
              <div className="md:hidden">
                <Select value={group?.key} onValueChange={resetView}>
                  <SelectTrigger aria-label="Chọn nhóm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {scoringVisible.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Dùng để chấm</SelectLabel>
                        {scoringVisible.map(g => <SelectItem key={g.key} value={g.key}>{g.label} ({g.count}){g.issues ? ` · ⚠ ${g.issues}` : ''}</SelectItem>)}
                      </SelectGroup>
                    )}
                    {topicsVisible.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Theo nội dung tài liệu</SelectLabel>
                        {topicsVisible.map(g => <SelectItem key={g.key} value={g.key}>{g.label} ({g.count}){g.issues ? ` · ⚠ ${g.issues}` : ''}</SelectItem>)}
                      </SelectGroup>
                    )}
                    {extraGroups.map(g => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <h2 className="hidden text-base font-semibold md:block">{group?.label}</h2>
              {toolbar}
            </div>
            <div className="px-5 py-4">{body}</div>
          </div>
        </div>
      ) : (
        // Ít nhóm: tab ngang.
        <>
          <div className="sticky top-0 z-10 space-y-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-5 pb-3 pt-4">
            {lockBanner}
            {failed.length > 0 && <FailedBanner failed={failed} />}
            {allGroups.length > 1 && (
              <div role="tablist" aria-label="Nhóm" className="custom-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
                {allGroups.map(g => navButton(g, false))}
              </div>
            )}
            {toolbar}
          </div>
          <div className="px-5 py-4">{body}</div>
        </>
      )}
    </Dialog>
    {current && (
      <ConfirmDialog
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        onConfirm={() => { setConfirmReplace(false); void doConfirm() }}
        loading={confirm.isPending}
        title="Thay tài liệu đang áp?"
        description={`${set?.orgUnitName ?? 'Cả tổ chức'} đang áp “${current.title}”. Xác nhận sẽ ngừng áp dụng tài liệu đó và áp “${set?.title ?? ''}”.`}
        confirmLabel="Thay và áp dụng"
      />
    )}
    {/* Xem tài liệu cấp trên đang áp — hộp chồng lên, không mất phần đang sửa. */}
    {viewId && <AiCriteriaReconcileDialog setId={viewId} onClose={() => setViewId(null)} />}
    </>
  )
}

function FailedBanner({ failed }: { failed: string[] }) {
  return (
    <div className="rounded-control border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-sm">
      <p className="flex items-center gap-1 font-medium text-[var(--color-warning)]">
        <AlertTriangle size={14} aria-hidden="true" /> AI chưa đọc được {failed.length} mục — hãy xem tay
      </p>
      <p className="mt-0.5 text-xs text-[var(--color-foreground)]">{failed.join(' · ')}</p>
    </div>
  )
}
