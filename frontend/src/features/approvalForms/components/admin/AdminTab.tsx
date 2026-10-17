import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpDown, Ban, CircleCheck, Copy, FolderPlus, Globe, GripVertical, Pencil, Plus, Search, Trash2, FileText } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useFormat } from '@/i18n/useFormat'
import { tourAnchor } from '@/components/common/tours/anchors'
import { cn } from '@/lib/utils'
import {
  useCreateGroup, useDeleteForm, useDeleteGroup, useFormAdmin, useRenameForm, useReorderForms, useSetFormActive,
  useSetGroupActive, useUpdateGroup,
} from '../../hooks/useApprovalForms'
import { pickName } from '../../model/formState'
import type { FormGroup, FormSummary, LocalizedName } from '../../types'
import FormIcon from '../FormIcon'
import LocalizedNameDialog from '../LocalizedNameDialog'
import SortGroupsDialog from './SortGroupsDialog'
import TemplateLibraryDialog from './TemplateLibraryDialog'

export const FORM_EDITOR_PATH = '/requests/admin/forms'

type NameTarget =
  | { kind: 'newGroup' }
  | { kind: 'group'; group: FormGroup }
  | { kind: 'form'; form: FormSummary }

const matches = (name: LocalizedName, keyword: string) =>
  Object.values(name).some((v) => v?.toLowerCase().includes(keyword))

/**
 * "Quản trị đơn từ" (Approval Admin của Lark): nhóm đơn + các đơn trong nhóm. Một ô tìm lọc cả tên nhóm lẫn tên đơn.
 * Người có APPROVAL_FORM:MANAGE quản lý tất cả; người quản lý đơn chỉ thấy đơn của mình và thao tác theo quyền trên đơn.
 */
export default function AdminTab() {
  const { t } = useTranslation('approvalForms')
  const { lang } = useFormat()
  const navigate = useNavigate()
  const { data, isLoading } = useFormAdmin()
  const [keyword, setKeyword] = useState('')
  const [nameTarget, setNameTarget] = useState<NameTarget | null>(null)
  const [sortOpen, setSortOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [deleting, setDeleting] = useState<{ kind: 'group'; group: FormGroup } | { kind: 'form'; form: FormSummary } | null>(null)

  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const renameForm = useRenameForm()
  const deleteGroup = useDeleteGroup()
  const deleteForm = useDeleteForm()

  const canManageAll = !!data?.canManageAll
  const k = keyword.trim().toLowerCase()
  const groups = useMemo(() => (data?.groups ?? []).flatMap((g) => {
    if (!k || matches(g.name, k)) return [g]
    const forms = g.forms.filter((f) => matches(f.name, k) || matches(f.description, k))
    return forms.length ? [{ ...g, forms }] : []
  }), [data, k])

  const saveName = async (value: { name: LocalizedName; description?: LocalizedName }) => {
    if (!nameTarget) return
    if (nameTarget.kind === 'newGroup') await createGroup.mutateAsync(value.name)
    else if (nameTarget.kind === 'group') await updateGroup.mutateAsync({ id: nameTarget.group.id, name: value.name })
    else await renameForm.mutateAsync({ id: nameTarget.form.id, name: value.name, description: value.description })
    setNameTarget(null)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    if (deleting.kind === 'group') await deleteGroup.mutateAsync(deleting.group.id)
    else await deleteForm.mutateAsync(deleting.form.id)
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title={t('admin.title')}
        description={t('admin.description')}
        actions={
          <>
            {canManageAll && (
              <>
                <Button variant="outline" onClick={() => setNameTarget({ kind: 'newGroup' })} {...tourAnchor('forms.createGroup')}>
                  <FolderPlus aria-hidden="true" /> {t('admin.createGroup')}
                </Button>
                <Button variant="outline" onClick={() => setSortOpen(true)} disabled={!data?.groups.length}>
                  <ArrowUpDown aria-hidden="true" /> {t('admin.sort')}
                </Button>
                <Button onClick={() => setLibraryOpen(true)} {...tourAnchor('forms.createForm')}>
                  <Plus aria-hidden="true" /> {t('admin.createForm')}
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="max-w-md" {...tourAnchor('forms.adminSearch')}>
        <Input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('admin.searchPlaceholder')}
          prefix={<Search size={16} aria-hidden="true" />}
          aria-label={t('admin.searchPlaceholder')}
        />
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={6} />
      ) : groups.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState icon={FileText} title={k ? t('admin.noMatch') : t('admin.empty')} description={k ? undefined : t('admin.emptyHint')} />
        </div>
      ) : (
        <div className="space-y-4" {...tourAnchor('forms.groups')}>
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              lang={lang}
              canManageAll={canManageAll}
              sortable={canManageAll && !k}
              onRenameGroup={() => setNameTarget({ kind: 'group', group: g })}
              onDeleteGroup={() => setDeleting({ kind: 'group', group: g })}
              onRenameForm={(form) => setNameTarget({ kind: 'form', form })}
              onDeleteForm={(form) => setDeleting({ kind: 'form', form })}
              onEdit={(form) => navigate(`${FORM_EDITOR_PATH}/${form.id}`)}
              onCopy={(form) => navigate(`${FORM_EDITOR_PATH}/new?copy=${form.id}`)}
            />
          ))}
        </div>
      )}

      <LocalizedNameDialog
        open={!!nameTarget}
        title={nameTarget?.kind === 'newGroup' ? t('admin.createGroup') : nameTarget?.kind === 'group' ? t('admin.renameGroup') : t('admin.renameForm')}
        value={nameTarget?.kind === 'group' ? { name: nameTarget.group.name }
          : nameTarget?.kind === 'form' ? { name: nameTarget.form.name, description: nameTarget.form.description }
            : { name: {} }}
        withDescription={nameTarget?.kind === 'form'}
        saving={createGroup.isPending || updateGroup.isPending || renameForm.isPending}
        draftKey={nameTarget?.kind === 'group' ? `approval-form-group:${nameTarget.group.id}`
          : nameTarget?.kind === 'form' ? `approval-form-name:${nameTarget.form.id}` : 'approval-form-group:new'}
        onClose={() => setNameTarget(null)}
        onSave={saveName}
      />

      {sortOpen && data && <SortGroupsDialog groups={data.groups} lang={lang} onClose={() => setSortOpen(false)} />}

      <TemplateLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onUse={(code) => navigate(`${FORM_EDITOR_PATH}/new?template=${code}`)}
        onCustom={() => navigate(`${FORM_EDITOR_PATH}/new`)}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteGroup.isPending || deleteForm.isPending}
        title={deleting?.kind === 'group' ? t('admin.deleteGroupTitle') : t('admin.deleteFormTitle')}
        description={deleting?.kind === 'group'
          ? t('admin.deleteGroupDescription', { name: pickName(deleting.group.name, lang) })
          : t('admin.deleteFormDescription', { name: deleting ? pickName(deleting.form.name, lang) : '' })}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}

function GroupCard({
  group, lang, canManageAll, sortable, onRenameGroup, onDeleteGroup, onRenameForm, onDeleteForm, onEdit, onCopy,
}: {
  group: FormGroup
  lang: string
  canManageAll: boolean
  sortable: boolean
  onRenameGroup: () => void
  onDeleteGroup: () => void
  onRenameForm: (f: FormSummary) => void
  onDeleteForm: (f: FormSummary) => void
  onEdit: (f: FormSummary) => void
  onCopy: (f: FormSummary) => void
}) {
  const { t } = useTranslation('approvalForms')
  const setGroupActive = useSetGroupActive()
  const reorder = useReorderForms()
  const [order, setOrder] = useState<string[] | null>(null)
  const forms = order ? order.map((id) => group.forms.find((f) => f.id === id)).filter((f): f is FormSummary => !!f) : group.forms
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const ids = forms.map((f) => f.id)
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)))
    setOrder(next)
    reorder.mutate({ groupId: group.id, ids: next }, { onSettled: () => setOrder(null) })
  }

  return (
    <section className={cn('overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]', !group.active && 'opacity-70')}>
      <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-section-title">
          {pickName(group.name, lang)}
          {!group.active && <span className="ml-2 text-caption">({t('admin.groupDisabled')})</span>}
        </h2>
        {canManageAll && (
          <>
            <IconAction label={t('admin.translate')} onClick={onRenameGroup}><Globe aria-hidden="true" /></IconAction>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Switch size="sm" checked={group.active} aria-label={t('admin.groupActive')}
                    onCheckedChange={(active) => setGroupActive.mutate({ id: group.id, active })} />
                </span>
              </TooltipTrigger>
              <TooltipContent>{group.active ? t('admin.disableGroup') : t('admin.enableGroup')}</TooltipContent>
            </Tooltip>
            <IconAction
              label={group.forms.length ? t('admin.groupNotEmpty') : t('admin.deleteGroup')}
              onClick={onDeleteGroup}
              disabled={group.forms.length > 0}
            >
              <Trash2 aria-hidden="true" />
            </IconAction>
          </>
        )}
      </header>
      {forms.length === 0 ? (
        <p className="px-4 py-6 text-center text-caption">{t('admin.groupEmpty')}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={forms.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-[var(--color-border)]">
              {forms.map((f) => (
                <FormRow key={f.id} form={f} lang={lang} sortable={sortable}
                  onEdit={() => onEdit(f)} onCopy={canManageAll ? () => onCopy(f) : undefined}
                  onRename={() => onRenameForm(f)} onDelete={() => onDeleteForm(f)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}

function FormRow({ form, lang, sortable, onEdit, onCopy, onRename, onDelete }: {
  form: FormSummary
  lang: string
  sortable: boolean
  onEdit: () => void
  onCopy?: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('approvalForms')
  const setActive = useSetFormActive()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: form.id, disabled: !sortable })
  const canEdit = form.permissions.includes('EDIT_FORM')
  const visibleTo = form.submitterScope === 'ALL' ? t('admin.visibleAll')
    : form.submitterScope === 'NONE' ? t('admin.visibleNone') : t('admin.visibleSpecified', { count: form.submitterCount })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group/row flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-muted)]',
        isDragging && 'relative z-10 bg-[var(--color-card)] shadow-md')}
    >
      <FormIcon icon={form.icon} color={form.color} className={cn(!form.active && 'grayscale')} />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className={cn('block truncate text-sm font-medium transition-colors group-hover/row:text-[var(--color-primary)]',
          !form.active && 'text-[var(--color-muted-foreground)]')}>
          {pickName(form.name, lang)}
          {!form.active && <span className="ml-2 text-caption">({t('admin.disabled')})</span>}
        </span>
        <span className="block truncate text-caption">{pickName(form.description, lang)}</span>
      </button>
      <span className="hidden w-44 shrink-0 truncate text-sm text-[var(--color-muted-foreground)] md:block">{visibleTo}</span>
      <div className="flex shrink-0 items-center gap-0.5">
        <IconAction label={t('admin.edit')} onClick={onEdit}><Pencil aria-hidden="true" /></IconAction>
        {onCopy && <IconAction label={t('admin.duplicate')} onClick={onCopy}><Copy aria-hidden="true" /></IconAction>}
        {canEdit && <IconAction label={t('admin.translate')} onClick={onRename}><Globe aria-hidden="true" /></IconAction>}
        {canEdit && (
          <IconAction label={form.active ? t('admin.disable') : t('admin.enable')}
            onClick={() => setActive.mutate({ id: form.id, active: !form.active })}>
            {form.active ? <Ban aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
          </IconAction>
        )}
        {canEdit && <IconAction label={t('admin.delete')} onClick={onDelete}><Trash2 aria-hidden="true" /></IconAction>}
        {sortable && (
          <button type="button" {...attributes} {...listeners} aria-label={t('admin.dragToSort')} title={t('admin.dragToSort')}
            className="ml-1 cursor-grab touch-none rounded p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] active:cursor-grabbing">
            <GripVertical size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  )
}

function IconAction({ label, onClick, disabled, children }: {
  label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label}>{children}</Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
