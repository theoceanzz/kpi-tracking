import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Building2, LayoutTemplate, Loader2, Plus, Trash2, X, Zap } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import DraftNotice from '@/components/common/DraftNotice'
import UserAvatar from '@/components/common/UserAvatar'
import { useStateDraft } from '@/hooks/useFormDraft'
import { useAuthStore } from '@/store/authStore'
import { canViewOrgTree } from '@/lib/session'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import { listApi, type AutomationInput } from '../api/listApi'
import { taskApi } from '../api/taskApi'
import { taskKeys, useSetTaskList, useTaskListAutomations } from '../hooks/useTasks'
import GroupedPicker from './GroupedPicker'
import { TAG_COLORS } from '../taskUtils'
import ListIconPicker from './ListIconPicker'
import {
  TASK_FIELD_TYPES, TASK_PRIORITIES, TASK_STATUSES, type AutomationActionType, type AutomationTriggerType, type TaskAutomation,
  type TaskFieldOption, type TaskFieldType, type TaskListDetail, type TaskListField, type TaskListRole, type TaskOption,
} from '../types'
import { blockedByTour } from '@/components/common/tours/guard'
import { tourAnchor } from '@/components/common/tours/anchors'

export type TaskListSettingsTab = 'general' | 'members' | 'sections' | 'fields' | 'automations'
type Tab = TaskListSettingsTab
const TABS: Tab[] = ['general', 'members', 'sections', 'fields', 'automations']
const ROLES: TaskListRole[] = ['OWNER', 'EDITOR', 'VIEWER']

interface Props {
  list: TaskListDetail
  open: boolean
  onClose: () => void
  /** Danh sách bị xoá ⇒ màn cha quay về chế độ xem mặc định. */
  onDeleted: () => void
  /** Tab đang mở — màn cha giữ để bài hướng dẫn chuyển tab được. */
  tab: Tab
  onTab: (t: Tab) => void
}

/**
 * Cài đặt một danh sách (chỉ chủ danh sách sửa; người sửa / người xem chỉ xem): thông tin chung, thành viên (người hoặc
 * cả đơn vị, vai trò Chủ / Sửa / Xem), nhóm (thứ tự), trường tuỳ chỉnh, luật tự động hoá, lưu thành mẫu, lưu trữ / xoá.
 */
export default function TaskListSettingsDialog({ list, open, onClose, onDeleted, tab, onTab: setTab }: Props) {
  const { t } = useTranslation('tasks')
  const owner = list.role === 'OWNER'
  return (
    <Dialog {...tourAnchor('task.list.settings')} open={open} onClose={onClose} size="lg" title={t('lists.settingsTitle', { name: list.name })}
      footer={<DialogFooter secondary={<Button variant="outline" onClick={onClose}>{t('detail.close')}</Button>} />}>
      <div className="space-y-4">
        <div {...tourAnchor('task.list.settings.tabs')} className="flex flex-wrap gap-1 border-b border-[var(--color-border)]">
          {TABS.map((x) => (
            <button key={x} type="button" onClick={() => setTab(x)}
              className={cn('-mb-px border-b-2 px-3 py-1.5 text-sm', tab === x
                ? 'border-[var(--color-primary)] font-medium text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-subtle-foreground)] hover:text-[var(--color-foreground)]')}>
              {t(`lists.tab.${x}`)}
            </button>
          ))}
        </div>
        {!owner && <p className="rounded-md bg-[var(--color-muted)] px-3 py-2 text-xs text-[var(--color-subtle-foreground)]">{t('lists.ownerOnly')}</p>}
        <div {...tourAnchor(`task.list.settings.${tab}`)}>
          {tab === 'general' && <General list={list} owner={owner} open={open} onDeleted={() => { onClose(); onDeleted() }} />}
          {tab === 'members' && <Members list={list} owner={owner} />}
          {tab === 'sections' && <Sections list={list} owner={owner} />}
          {tab === 'fields' && <Fields list={list} owner={owner} />}
          {tab === 'automations' && <Automations list={list} owner={owner} />}
        </div>
      </div>
    </Dialog>
  )
}

function useListCall() {
  const setList = useSetTaskList()
  const qc = useQueryClient()
  return (p: Promise<TaskListDetail | null | undefined | void>, after?: () => void) =>
    p.then((d) => {
      if (d) setList(d)
      qc.invalidateQueries({ queryKey: taskKeys.all })
      after?.()
    }).catch((e) => toast.error(getApiErrorMessage(e)))
}

// ── Chung ────────────────────────────────────────────────────────────────────────────────────────

function General({ list, owner, open, onDeleted }: { list: TaskListDetail; owner: boolean; open: boolean; onDeleted: () => void }) {
  const { t } = useTranslation('tasks')
  const call = useListCall()
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: list.name, description: list.description ?? '', color: list.color ?? TAG_COLORS[0]!, icon: list.icon ?? '' })
  const draft = useStateDraft(form, setForm, { key: `task-list:${list.id}`, enabled: open && owner })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tpl, setTpl] = useState<{ name: string; includeTasks: boolean } | null>(null)
  const dirty = form.name !== list.name || form.description !== (list.description ?? '') || form.color !== (list.color ?? TAG_COLORS[0])
    || form.icon !== (list.icon ?? '')

  const save = () => {
    if (blockedByTour()) return
    void call(listApi.update(list.id, { name: form.name.trim(), description: form.description, color: form.color, icon: form.icon }), () => draft.clear())
  }
  const saveTemplate = () => {
    if (blockedByTour() || !tpl) return
    listApi.saveAsTemplate(list.id, { name: tpl.name.trim() || list.name, includeTasks: tpl.includeTasks }).then(() => {
      qc.invalidateQueries({ queryKey: taskKeys.templates })
      toast.success(t('lists.templateSaved'))
      setTpl(null)
    }).catch((e) => toast.error(getApiErrorMessage(e)))
  }

  return (
    <div className="space-y-4">
      <DraftNotice draft={draft} />
      <label className="block space-y-1">
        <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('lists.name')}</span>
        <span className="flex items-center gap-2">
          <ListIconPicker value={form.icon} disabled={!owner} onChange={(icon) => setForm({ ...form, icon })} />
          <Input value={form.name} maxLength={200} disabled={!owner} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </span>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('lists.description')}</span>
        <Textarea rows={2} value={form.description} disabled={!owner} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </label>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('lists.color')}</span>
        {TAG_COLORS.map((c) => (
          <button key={c} type="button" aria-label={c} disabled={!owner} onClick={() => setForm({ ...form, color: c })}
            className={cn('h-5 w-5 rounded-full ring-offset-2 ring-offset-[var(--color-card)]', form.color === c && 'ring-2 ring-[var(--color-ring)]')}
            style={{ background: c }} />
        ))}
      </div>
      {owner && (
        <div className="flex justify-end">
          <Button size="sm" disabled={!dirty || !form.name.trim()} onClick={save}>{t('lists.save')}</Button>
        </div>
      )}

      <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
        {tpl ? (
          <div className="space-y-2 rounded-card border border-[var(--color-border)] p-3">
            <Input size="sm" autoFocus value={tpl.name} placeholder={list.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={tpl.includeTasks} onCheckedChange={(v) => setTpl({ ...tpl, includeTasks: !!v })} /> {t('lists.templateIncludeTasks')}
            </label>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setTpl(null)}>{t('detail.close')}</Button>
              <Button size="sm" onClick={saveTemplate}>{t('lists.saveAsTemplate')}</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setTpl({ name: '', includeTasks: false })}>
            <LayoutTemplate /> {t('lists.saveAsTemplate')}
          </Button>
        )}
      </div>

      {owner && (
        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
          <Button size="sm" variant="outline" onClick={() => void call(listApi.archive(list.id, !list.archived))}>
            {list.archived ? <><ArchiveRestore /> {t('lists.unarchive')}</> : <><Archive /> {t('lists.archive')}</>}
          </Button>
          <Button size="sm" variant="ghost" className="text-[var(--color-error)]" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> {t('lists.delete')}
          </Button>
        </div>
      )}
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('lists.deleteTitle')}
        description={t('lists.deleteBody', { name: list.name })} confirmLabel={t('lists.delete')}
        onConfirm={() => void call(listApi.remove(list.id), () => { setConfirmDelete(false); onDeleted() })} />
    </div>
  )
}

// ── Thành viên ───────────────────────────────────────────────────────────────────────────────────

function flattenUnits(nodes: OrgUnitTreeResponse[] | undefined, depth = 0, out: TaskOption[] = []): TaskOption[] {
  for (const n of nodes ?? []) {
    out.push({ id: n.id, name: `${'· '.repeat(depth)}${n.name}`, secondary: n.code, avatarUrl: null, detail: null,
      groupId: null, groupName: null, groupCurrent: true, groupSort: String(out.length).padStart(5, '0') })
    flattenUnits(n.children, depth + 1, out)
  }
  return out
}

function Members({ list, owner }: { list: TaskListDetail; owner: boolean }) {
  const { t } = useTranslation('tasks')
  const call = useListCall()
  const user = useAuthStore((s) => s.user)
  const [role, setRole] = useState<TaskListRole>('EDITOR')
  const { data: people = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-users', 'all'],
    queryFn: () => taskApi.assignableUsers('', true),
    enabled: owner,
    staleTime: 60_000,
  })
  const { data: tree } = useOrgUnitTree({ staleTime: 300_000 })
  const units = useMemo(() => (canViewOrgTree(user) ? flattenUnits(tree) : []), [tree, user])
  const candidates = people.filter((p) => !list.members.some((m) => m.userId === p.id))

  return (
    <div className="space-y-3">
      {owner && (
        <div {...tourAnchor('task.list.members.add')} className="flex flex-wrap items-center gap-2">
          <div className="min-w-48 flex-1">
            <GroupedPicker people options={candidates} value={null} placeholder={t('lists.addPerson')} searchPlaceholder={t('picker.searchPerson')}
              onChange={(id) => { if (id) void call(listApi.addMember(list.id, { userId: id, role })) }} />
          </div>
          {units.length > 0 && (
            <div className="min-w-48 flex-1">
              <GroupedPicker options={units.filter((u) => !list.members.some((m) => m.orgUnitId === u.id))} value={null}
                placeholder={t('lists.addUnit')} searchPlaceholder={t('lists.searchUnit')}
                onChange={(id) => { if (id) void call(listApi.addMember(list.id, { orgUnitId: id, role })) }} />
            </div>
          )}
          <Select value={role} onValueChange={(v) => setRole(v as TaskListRole)}>
            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{t(`lists.role.${r}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <p className="text-xs text-[var(--color-subtle-foreground)]">{t('lists.rolesHint')}</p>
      <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
        {list.members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 last:border-b-0">
            {m.userId
              ? <UserAvatar fullName={m.userName ?? ''} avatarUrl={m.avatarUrl} className="h-6 w-6 rounded-full text-[9px]" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
              : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-muted)]"><Building2 size={13} /></span>}
            <span className="min-w-0 flex-1 truncate text-sm">
              {m.userName ?? m.orgUnitName}
              {m.orgUnitId && <span className="ml-1 text-xs text-[var(--color-subtle-foreground)]">{t('lists.wholeUnit')}</span>}
            </span>
            {owner ? (
              <>
                <Select value={m.role} onValueChange={(v) => void call(listApi.updateMember(list.id, m.id, v as TaskListRole))}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{t(`lists.role.${r}`)}</SelectItem>)}</SelectContent>
                </Select>
                <button type="button" aria-label={t('lists.removeMember')} onClick={() => void call(listApi.removeMember(list.id, m.id))}
                  className="text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)]"><X size={14} /></button>
              </>
            ) : <span className="text-xs text-[var(--color-subtle-foreground)]">{t(`lists.role.${m.role}`)}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Nhóm ─────────────────────────────────────────────────────────────────────────────────────────

function Sections({ list, owner }: { list: TaskListDetail; owner: boolean }) {
  const { t } = useTranslation('tasks')
  const call = useListCall()
  const [name, setName] = useState('')
  const sections = [...list.sections].sort((a, b) => a.sortOrder - b.sortOrder)
  const add = () => {
    if (blockedByTour() || !name.trim()) return
    void call(listApi.addSection(list.id, name.trim()), () => setName(''))
  }
  // Đổi chỗ với nhóm kề: lấy thứ tự của nhóm kề ± nửa khoảng để không phải đánh số lại cả danh sách.
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    const a = sections[i], b = sections[j]
    if (!a || !b) return
    const beyond = sections[j + dir]
    const target = beyond ? (b.sortOrder + beyond.sortOrder) / 2 : b.sortOrder + dir * 1024
    void call(listApi.updateSection(list.id, a.id, { sortOrder: target }))
  }
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
        {sections.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-1.5 last:border-b-0">
            {owner ? (
              <InlineName value={s.name} onSave={(v) => void call(listApi.updateSection(list.id, s.id, { name: v }))} />
            ) : <span className="flex-1 text-sm">{s.name}</span>}
            {owner && (
              <>
                <button type="button" aria-label={t('lists.moveUp')} disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30"><ArrowUp size={14} /></button>
                <button type="button" aria-label={t('lists.moveDown')} disabled={i === sections.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30"><ArrowDown size={14} /></button>
                <button type="button" aria-label={t('lists.deleteSection')} onClick={() => void call(listApi.deleteSection(list.id, s.id))}
                  className="text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)]"><Trash2 size={14} /></button>
              </>
            )}
          </div>
        ))}
        {sections.length === 0 && <p className="px-3 py-2 text-xs text-[var(--color-subtle-foreground)]">{t('lists.noSections')}</p>}
      </div>
      {owner && (
        <div className="flex gap-2">
          <Input size="sm" value={name} maxLength={120} placeholder={t('lists.sectionPlaceholder')} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
          <Button size="sm" disabled={!name.trim()} onClick={add}><Plus /> {t('lists.addSection')}</Button>
        </div>
      )}
      <p className="text-xs text-[var(--color-subtle-foreground)]">{t('lists.sectionDeleteHint')}</p>
    </div>
  )
}

function InlineName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  const [prev, setPrev] = useState(value)
  if (prev !== value) { setPrev(value); setV(value) }
  const commit = () => { if (v.trim() && v.trim() !== value) onSave(v.trim()); else setV(value) }
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} maxLength={120}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setV(value) }}
      className="no-edit-hint min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-[var(--color-muted)]" />
  )
}

// ── Trường tuỳ chỉnh ─────────────────────────────────────────────────────────────────────────────

const newOptionId = () => Math.random().toString(36).slice(2, 10)

function Fields({ list, owner }: { list: TaskListDetail; owner: boolean }) {
  const { t } = useTranslation('tasks')
  const call = useListCall()
  const [draft, setDraft] = useState<{ name: string; type: TaskFieldType; options: TaskFieldOption[] } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const fields = [...list.fields].sort((a, b) => a.sortOrder - b.sortOrder)
  const hasOptions = (x: TaskFieldType) => x === 'SINGLE_SELECT' || x === 'MULTI_SELECT'

  const add = () => {
    if (blockedByTour() || !draft || !draft.name.trim()) return
    if (hasOptions(draft.type) && !draft.options.some((o) => o.label.trim())) {
      toast.error(t('field.optionsRequired'))
      return
    }
    void call(listApi.addField(list.id, {
      name: draft.name.trim(), type: draft.type,
      options: hasOptions(draft.type) ? draft.options.filter((o) => o.label.trim()) : undefined,
    }), () => setDraft(null))
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
        {fields.map((f) => (
          <div key={f.id} className="border-b border-[var(--color-border)] px-3 py-2 last:border-b-0">
            <div className="flex items-center gap-2">
              {owner ? <InlineName value={f.name} onSave={(v) => void call(listApi.updateField(list.id, f.id, { name: v }))} />
                : <span className="flex-1 text-sm">{f.name}</span>}
              <span className="rounded-full bg-[var(--color-muted)] px-2 text-[11px] text-[var(--color-subtle-foreground)]">{t(`field.type.${f.type}`)}</span>
              {owner && hasOptions(f.type) && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(editing === f.id ? null : f.id)}>{t('field.editOptions')}</Button>
              )}
              {owner && (
                <button type="button" aria-label={t('field.delete')} onClick={() => void call(listApi.deleteField(list.id, f.id))}
                  className="text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)]"><Trash2 size={14} /></button>
              )}
            </div>
            {editing === f.id && (
              <OptionsEditor initial={f.options}
                onSave={(options) => void call(listApi.updateField(list.id, f.id, { options }), () => setEditing(null))} />
            )}
          </div>
        ))}
        {fields.length === 0 && <p className="px-3 py-2 text-xs text-[var(--color-subtle-foreground)]">{t('field.none')}</p>}
      </div>

      {owner && (draft ? (
        <div {...tourAnchor('task.list.field.form')} className="space-y-2 rounded-card border border-[var(--color-border)] p-3">
          <div className="flex gap-2">
            <Input size="sm" autoFocus value={draft.name} maxLength={120} placeholder={t('field.namePlaceholder')}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as TaskFieldType })}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{TASK_FIELD_TYPES.map((x) => <SelectItem key={x} value={x}>{t(`field.type.${x}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {hasOptions(draft.type) && (
            <OptionsEditor initial={draft.options} inline onChange={(options) => setDraft({ ...draft, options })} />
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>{t('detail.close')}</Button>
            <Button size="sm" disabled={!draft.name.trim()} onClick={add}>{t('field.add')}</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setDraft({ name: '', type: 'SINGLE_SELECT', options: [
          { id: newOptionId(), label: '', color: TAG_COLORS[0] },
        ] })}><Plus /> {t('field.add')}</Button>
      ))}
    </div>
  )
}

/** Sửa lựa chọn của trường chọn: nhãn + màu; giữ nguyên id lựa chọn cũ để giá trị đã chọn không mất. */
function OptionsEditor({ initial, onSave, onChange, inline }: {
  initial: TaskFieldOption[]
  onSave?: (o: TaskFieldOption[]) => void
  onChange?: (o: TaskFieldOption[]) => void
  inline?: boolean
}) {
  const { t } = useTranslation('tasks')
  const [opts, setOpts] = useState<TaskFieldOption[]>(initial.length ? initial : [{ id: newOptionId(), label: '', color: TAG_COLORS[0] }])
  const update = (next: TaskFieldOption[]) => { setOpts(next); onChange?.(next) }
  return (
    <div className="mt-2 space-y-1.5">
      {opts.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <button type="button" aria-label={t('field.color')} className="h-4 w-4 shrink-0 rounded-full" style={{ background: o.color ?? TAG_COLORS[0] }}
            onClick={() => update(opts.map((x, j) => (j === i ? { ...x, color: TAG_COLORS[(TAG_COLORS.indexOf(x.color ?? '') + 1) % TAG_COLORS.length] } : x)))} />
          <Input size="sm" value={o.label} maxLength={80} placeholder={t('field.optionPlaceholder', { n: i + 1 })}
            onChange={(e) => update(opts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <button type="button" aria-label={t('field.removeOption')} onClick={() => update(opts.filter((_, j) => j !== i))}
            className="text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)]"><X size={13} /></button>
        </div>
      ))}
      <div className="flex justify-between">
        <Button size="sm" variant="ghost"
          onClick={() => update([...opts, { id: newOptionId(), label: '', color: TAG_COLORS[opts.length % TAG_COLORS.length] }])}>
          <Plus /> {t('field.addOption')}
        </Button>
        {!inline && <Button size="sm" onClick={() => onSave?.(opts.filter((o) => o.label.trim()))}>{t('lists.save')}</Button>}
      </div>
    </div>
  )
}

// ── Tự động hoá ──────────────────────────────────────────────────────────────────────────────────

const TRIGGERS: AutomationTriggerType[] = ['TASK_ADDED', 'SECTION_ENTERED', 'STATUS_CHANGED', 'COMPLETED', 'FIELD_CHANGED']
const ACTIONS: AutomationActionType[] = ['SET_STATUS', 'MOVE_SECTION', 'ADD_ASSIGNEE', 'ADD_FOLLOWER', 'SET_PRIORITY', 'SET_FIELD',
  'SET_DUE_IN_DAYS', 'NOTIFY']

type Rule = { name: string; trigger: Record<string, unknown> & { type: AutomationTriggerType }; action: Record<string, unknown> & { type: AutomationActionType } }

/** Câu đọc được của một luật: "Khi việc vào nhóm Xong thì đặt trạng thái Hoàn thành". */
function useDescribe(list: TaskListDetail) {
  const { t } = useTranslation('tasks')
  const section = (id: unknown) => list.sections.find((s) => s.id === id)?.name ?? '?'
  const field = (id: unknown) => list.fields.find((f) => f.id === id)
  const option = (f: TaskListField | undefined, id: unknown) => f?.options.find((o) => o.id === id)?.label
  const person = (id: unknown) => list.members.find((m) => m.userId === id)?.userName ?? t('automation.someone')
  return (r: Pick<Rule, 'trigger' | 'action'>) => {
    const tr = r.trigger, ac = r.action
    const when = t(`automation.when.${tr.type}`, {
      section: section(tr.sectionId), status: tr.status ? t(`status.${tr.status}`) : '',
      field: field(tr.fieldId)?.name ?? '?', option: option(field(tr.fieldId), tr.optionId) ?? t('automation.anyValue'),
    })
    const f = field(ac.fieldId)
    const then = t(`automation.then.${ac.type}`, {
      status: ac.status ? t(`status.${ac.status}`) : '', section: section(ac.sectionId), person: person(ac.userId),
      priority: ac.priority ? t(`priority.${ac.priority}`) : '', field: f?.name ?? '?',
      value: option(f, ac.value) ?? (ac.value === true ? t('group.checked') : String(ac.value ?? '')), days: ac.days ?? 0,
      target: ac.target === 'ASSIGNEES' || ac.target === 'CREATOR' ? t(`automation.target.${ac.target}`) : person(ac.target),
    })
    return `${when} ⇒ ${then}`
  }
}

function Automations({ list, owner }: { list: TaskListDetail; owner: boolean }) {
  const { t } = useTranslation('tasks')
  const qc = useQueryClient()
  const { data: rules = [], isLoading } = useTaskListAutomations(list.id)
  const [editing, setEditing] = useState<Rule | null>(null)
  const describe = useDescribe(list)
  const refresh = () => qc.invalidateQueries({ queryKey: taskKeys.automations(list.id) })
  const run = (p: Promise<unknown>, after?: () => void) => p.then(() => { refresh(); after?.() }).catch((e) => toast.error(getApiErrorMessage(e)))

  const save = () => {
    if (blockedByTour() || !editing) return
    const input: AutomationInput = { name: editing.name.trim() || describe(editing), trigger: editing.trigger, action: editing.action, enabled: true }
    void run(listApi.createAutomation(list.id, input), () => setEditing(null))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-subtle-foreground)]">{t('automation.hint')}</p>
      {isLoading ? <Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" /> : (
        <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
          {rules.map((a: TaskAutomation) => (
            <div key={a.id} className="flex items-start gap-2 border-b border-[var(--color-border)] px-3 py-2 last:border-b-0">
              <Zap size={14} className={cn('mt-0.5 shrink-0', a.enabled ? 'text-[var(--color-warning)]' : 'text-[var(--color-subtle-foreground)]')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{a.name}</p>
                <p className="text-xs text-[var(--color-subtle-foreground)]">{describe(a)}</p>
                {a.runCount > 0 && <p className="text-[11px] text-[var(--color-subtle-foreground)]">{t('automation.runs', { count: a.runCount })}</p>}
              </div>
              {owner && (
                <>
                  <Switch size="sm" checked={a.enabled} aria-label={t('automation.enabled')}
                    onCheckedChange={(v) => void run(listApi.updateAutomation(list.id, a.id, { enabled: v }))} />
                  <button type="button" aria-label={t('automation.delete')} onClick={() => void run(listApi.deleteAutomation(list.id, a.id))}
                    className="text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)]"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
          {rules.length === 0 && <p className="px-3 py-2 text-xs text-[var(--color-subtle-foreground)]">{t('automation.none')}</p>}
        </div>
      )}
      {owner && (editing ? (
        <RuleEditor list={list} rule={editing} onChange={setEditing} onCancel={() => setEditing(null)} onSave={save} preview={describe(editing)} />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setEditing({ name: '', trigger: { type: 'TASK_ADDED' }, action: { type: 'SET_STATUS', status: 'IN_PROGRESS' } })}>
          <Plus /> {t('automation.add')}
        </Button>
      ))}
    </div>
  )
}

function RuleEditor({ list, rule, onChange, onCancel, onSave, preview }: {
  list: TaskListDetail
  rule: Rule
  onChange: (r: Rule) => void
  onCancel: () => void
  onSave: () => void
  preview: string
}) {
  const { t } = useTranslation('tasks')
  const { data: people = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-users', 'all'],
    queryFn: () => taskApi.assignableUsers('', true),
    staleTime: 60_000,
  })
  const tr = rule.trigger, ac = rule.action
  const setTrigger = (patch: Record<string, unknown>) => onChange({ ...rule, trigger: { ...tr, ...patch } as Rule['trigger'] })
  const setAction = (patch: Record<string, unknown>) => onChange({ ...rule, action: { ...ac, ...patch } as Rule['action'] })
  const triggers = TRIGGERS.filter((x) => (x !== 'SECTION_ENTERED' || list.sections.length) && (x !== 'FIELD_CHANGED' || list.fields.length))
  const actions = ACTIONS.filter((x) => (x !== 'MOVE_SECTION' || list.sections.length) && (x !== 'SET_FIELD' || list.fields.length))
  const actionField = list.fields.find((f) => f.id === ac.fieldId)
  const triggerField = list.fields.find((f) => f.id === tr.fieldId)
  const ANY = '__any__'
  const valid = (() => {
    if (tr.type === 'SECTION_ENTERED' && !tr.sectionId) return false
    if (tr.type === 'STATUS_CHANGED' && !tr.status) return false
    if (tr.type === 'FIELD_CHANGED' && !tr.fieldId) return false
    if (ac.type === 'SET_STATUS' && !ac.status) return false
    if (ac.type === 'MOVE_SECTION' && (!ac.sectionId || (tr.type === 'SECTION_ENTERED' && tr.sectionId === ac.sectionId))) return false
    if ((ac.type === 'ADD_ASSIGNEE' || ac.type === 'ADD_FOLLOWER') && !ac.userId) return false
    if (ac.type === 'SET_PRIORITY' && !ac.priority) return false
    if (ac.type === 'SET_FIELD' && !ac.fieldId) return false
    if (ac.type === 'NOTIFY' && !ac.target) return false
    return true
  })()

  const sectionSelect = (value: unknown, on: (v: string) => void) => (
    <Select value={(value as string) ?? ''} onValueChange={on}>
      <SelectTrigger className="h-8"><SelectValue placeholder={t('automation.pickSection')} /></SelectTrigger>
      <SelectContent>{list.sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
    </Select>
  )
  const statusSelect = (value: unknown, on: (v: string) => void) => (
    <Select value={(value as string) ?? ''} onValueChange={on}>
      <SelectTrigger className="h-8"><SelectValue placeholder={t('automation.pickStatus')} /></SelectTrigger>
      <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}</SelectContent>
    </Select>
  )
  const fieldSelect = (value: unknown, on: (v: string) => void) => (
    <Select value={(value as string) ?? ''} onValueChange={on}>
      <SelectTrigger className="h-8"><SelectValue placeholder={t('automation.pickField')} /></SelectTrigger>
      <SelectContent>{list.fields.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
    </Select>
  )

  return (
    <div {...tourAnchor('task.list.automation.form')} className="space-y-3 rounded-card border border-[var(--color-border)] p-3">
      <Input size="sm" value={rule.name} maxLength={200} placeholder={t('automation.namePlaceholder')} onChange={(e) => onChange({ ...rule, name: e.target.value })} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('automation.whenLabel')}</p>
          <Select value={tr.type} onValueChange={(v) => onChange({ ...rule, trigger: { type: v as AutomationTriggerType } })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{triggers.map((x) => <SelectItem key={x} value={x}>{t(`automation.trigger.${x}`)}</SelectItem>)}</SelectContent>
          </Select>
          {tr.type === 'SECTION_ENTERED' && sectionSelect(tr.sectionId, (v) => setTrigger({ sectionId: v }))}
          {tr.type === 'STATUS_CHANGED' && statusSelect(tr.status, (v) => setTrigger({ status: v }))}
          {tr.type === 'FIELD_CHANGED' && fieldSelect(tr.fieldId, (v) => setTrigger({ fieldId: v, optionId: undefined }))}
          {tr.type === 'FIELD_CHANGED' && triggerField && triggerField.type === 'SINGLE_SELECT' && (
            <Select value={(tr.optionId as string) ?? ANY} onValueChange={(v) => setTrigger({ optionId: v === ANY ? undefined : v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t('automation.anyValue')}</SelectItem>
                {triggerField.options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('automation.thenLabel')}</p>
          <Select value={ac.type} onValueChange={(v) => onChange({ ...rule, action: { type: v as AutomationActionType } })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{actions.map((x) => <SelectItem key={x} value={x}>{t(`automation.action.${x}`)}</SelectItem>)}</SelectContent>
          </Select>
          {ac.type === 'SET_STATUS' && statusSelect(ac.status, (v) => setAction({ status: v }))}
          {ac.type === 'MOVE_SECTION' && sectionSelect(ac.sectionId, (v) => setAction({ sectionId: v }))}
          {(ac.type === 'ADD_ASSIGNEE' || ac.type === 'ADD_FOLLOWER') && (
            <GroupedPicker people options={people} value={(ac.userId as string) ?? null} onChange={(v) => setAction({ userId: v ?? undefined })}
              placeholder={t('automation.pickPerson')} searchPlaceholder={t('picker.searchPerson')} size="sm" />
          )}
          {ac.type === 'ADD_ASSIGNEE' && <p className="text-[11px] text-[var(--color-subtle-foreground)]">{t('automation.assigneeNoKpi')}</p>}
          {ac.type === 'SET_PRIORITY' && (
            <Select value={(ac.priority as string) ?? ''} onValueChange={(v) => setAction({ priority: v })}>
              <SelectTrigger className="h-8"><SelectValue placeholder={t('automation.pickPriority')} /></SelectTrigger>
              <SelectContent>{TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {ac.type === 'SET_FIELD' && fieldSelect(ac.fieldId, (v) => setAction({ fieldId: v, value: undefined }))}
          {ac.type === 'SET_FIELD' && actionField && <FieldValueInput field={actionField} people={people} value={ac.value} onChange={(v) => setAction({ value: v })} />}
          {ac.type === 'SET_DUE_IN_DAYS' && (
            <Input size="sm" type="number" min={0} max={365} value={String(ac.days ?? 0)} suffix={t('automation.days')} className="no-edit-hint"
              onChange={(e) => setAction({ days: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} />
          )}
          {ac.type === 'NOTIFY' && (
            <Select value={(ac.target as string) ?? ''} onValueChange={(v) => setAction({ target: v })}>
              <SelectTrigger className="h-8"><SelectValue placeholder={t('automation.pickTarget')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ASSIGNEES">{t('automation.target.ASSIGNEES')}</SelectItem>
                <SelectItem value="CREATOR">{t('automation.target.CREATOR')}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      {valid && <p className="rounded-md bg-[var(--color-muted)] px-2 py-1.5 text-xs">{preview}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>{t('detail.close')}</Button>
        <Button size="sm" disabled={!valid} onClick={onSave}>{t('automation.save')}</Button>
      </div>
    </div>
  )
}

/** Ô nhập giá trị cho "đặt trường": chọn lựa chọn / đánh dấu / số / chữ. */
function FieldValueInput({ field, people, value, onChange }: { field: TaskListField; people: TaskOption[]; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useTranslation('tasks')
  if (field.type === 'MEMBER') {
    return <GroupedPicker people size="sm" options={people} value={(value as string) ?? null} onChange={(v) => onChange(v)}
      placeholder={t('automation.pickPerson')} searchPlaceholder={t('picker.searchPerson')} />
  }
  if (field.type === 'SINGLE_SELECT' || field.type === 'MULTI_SELECT') {
    return (
      <Select value={(field.type === 'MULTI_SELECT' ? (value as string[] | undefined)?.[0] : (value as string)) ?? ''}
        onValueChange={(v) => onChange(field.type === 'MULTI_SELECT' ? [v] : v)}>
        <SelectTrigger className="h-8"><SelectValue placeholder={t('automation.pickValue')} /></SelectTrigger>
        <SelectContent>{field.options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    )
  }
  if (field.type === 'CHECKBOX') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={value === true} onCheckedChange={(v) => onChange(!!v)} /> {t('group.checked')}
      </label>
    )
  }
  if (field.type === 'DATE') return <Input size="sm" type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
  if (field.type === 'NUMBER') {
    return <Input size="sm" type="number" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
  }
  return <Input size="sm" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
}
