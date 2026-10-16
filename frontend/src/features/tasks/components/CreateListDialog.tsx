import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, LayoutTemplate, Loader2, Trash2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import DraftNotice from '@/components/common/DraftNotice'
import { useStateDraft } from '@/hooks/useFormDraft'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { listApi } from '../api/listApi'
import { taskKeys, useSetTaskList, useTaskListTemplates } from '../hooks/useTasks'
import { useQueryClient } from '@tanstack/react-query'
import { TAG_COLORS } from '../taskUtils'
import ListIconPicker from './ListIconPicker'
import { blockedByTour } from '@/components/common/tours/guard'
import { tourAnchor } from '@/components/common/tours/anchors'

interface Form {
  name: string
  description: string
  color: string
  icon: string
  /** '' = danh sách trống; 'builtin:project' = mẫu có sẵn; uuid = mẫu của tổ chức. */
  templateId: string
  includeSampleTasks: boolean
}

const empty = (): Form => ({ name: '', description: '', color: TAG_COLORS[0]!, icon: '', templateId: '', includeSampleTasks: true })

/**
 * Tạo danh sách công việc: tên, màu, mô tả, chọn mẫu (trống / mẫu có sẵn / mẫu của tổ chức — mẫu mang theo nhóm, trường
 * tuỳ chỉnh, luật tự động và việc mẫu). Người tạo là chủ danh sách; mời thêm người trong phần Cài đặt.
 */
export default function CreateListDialog({ open, onClose, onCreated }: {
  open: boolean
  onClose: () => void
  onCreated: (listId: string) => void
}) {
  const { t } = useTranslation('tasks')
  const qc = useQueryClient()
  const [form, setForm] = useState<Form>(empty)
  const draft = useStateDraft(form, setForm, { key: 'task-list:new', enabled: open })
  const [saving, setSaving] = useState(false)
  const setList = useSetTaskList()
  const { data: templates = [] } = useTaskListTemplates(open)
  const chosen = templates.find((x) => x.id === form.templateId)

  const submit = () => {
    if (blockedByTour()) return
    if (!form.name.trim() && !chosen) {
      toast.error(t('lists.nameRequired'))
      return
    }
    setSaving(true)
    const builtin = form.templateId.startsWith('builtin:') ? form.templateId.slice(8) : undefined
    listApi.create({
      name: form.name.trim() || undefined,
      description: form.description.trim() || undefined,
      color: form.color,
      icon: form.icon || undefined,
      builtinTemplate: builtin,
      templateId: form.templateId && !builtin ? form.templateId : undefined,
      includeSampleTasks: !!chosen && form.includeSampleTasks,
    }).then((d) => {
      setList(d)
      qc.invalidateQueries({ queryKey: taskKeys.all })
      draft.clear()
      setForm(empty())
      onClose()
      onCreated(d.id)
    }).catch((e) => toast.error(getApiErrorMessage(e))).finally(() => setSaving(false))
  }

  const removeTemplate = (id: string) => {
    listApi.deleteTemplate(id).then(() => {
      qc.invalidateQueries({ queryKey: taskKeys.templates })
      if (form.templateId === id) setForm({ ...form, templateId: '' })
    }).catch((e) => toast.error(getApiErrorMessage(e)))
  }

  return (
    <Dialog {...tourAnchor('task.list.form')} open={open} onClose={onClose} size="lg" title={t('lists.create')}
      footer={<DialogFooter
        secondary={<Button variant="outline" onClick={onClose}>{t('detail.close')}</Button>}
        primary={<Button {...tourAnchor('task.list.form.submit')} disabled={saving || (!form.name.trim() && !chosen)} onClick={submit}>
          {saving && <Loader2 className="animate-spin" />} {t('lists.createSubmit')}
        </Button>}
      />}>
      <div className="space-y-4">
        <DraftNotice draft={draft} />
        <div {...tourAnchor('task.list.form.name')} className="flex items-center gap-2">
          <ListIconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
          <Input autoFocus value={form.name} maxLength={200} placeholder={chosen ? chosen.name : t('lists.namePlaceholder')}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
          <div className="flex shrink-0 gap-1">
            {TAG_COLORS.slice(0, 6).map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => setForm({ ...form, color: c })}
                className={cn('h-5 w-5 rounded-full ring-offset-2 ring-offset-[var(--color-card)]', form.color === c && 'ring-2 ring-[var(--color-ring)]')}
                style={{ background: c }} />
            ))}
          </div>
        </div>
        <Textarea rows={2} value={form.description} placeholder={t('lists.descriptionPlaceholder')}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <div {...tourAnchor('task.list.form.template')} className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('lists.template')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <TemplateCard selected={!form.templateId} title={t('lists.blank')} description={t('lists.blankHint')}
              onClick={() => setForm({ ...form, templateId: '' })} />
            {templates.map((x) => (
              <TemplateCard key={x.id} selected={form.templateId === x.id} title={x.name}
                description={x.description ?? x.sections.join(' · ')}
                meta={t('lists.templateMeta', { sections: x.sections.length, fields: x.fieldCount, tasks: x.taskCount })}
                badge={x.builtin ? t('lists.builtin') : undefined}
                onClick={() => setForm({ ...form, templateId: x.id })}
                onDelete={x.canDelete ? () => removeTemplate(x.id) : undefined} />
            ))}
          </div>
          {chosen && chosen.taskCount > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.includeSampleTasks} onCheckedChange={(v) => setForm({ ...form, includeSampleTasks: !!v })} />
              {t('lists.includeSampleTasks', { count: chosen.taskCount })}
            </label>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function TemplateCard({ selected, title, description, meta, badge, onClick, onDelete }: {
  selected: boolean
  title: string
  description?: string | null
  meta?: string
  badge?: string
  onClick: () => void
  onDelete?: () => void
}) {
  const { t } = useTranslation('tasks')
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className={cn('group relative cursor-pointer rounded-card border p-3 text-left transition-colors',
        selected ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]')}>
      <div className="flex items-center gap-2">
        <LayoutTemplate size={14} className="shrink-0 text-[var(--color-subtle-foreground)]" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        {badge && <span className="rounded-full bg-[var(--color-muted)] px-1.5 text-[11px] text-[var(--color-subtle-foreground)]">{badge}</span>}
        {selected && <Check size={14} className="text-[var(--color-primary)]" />}
      </div>
      {description && <p className="mt-1 line-clamp-2 text-xs text-[var(--color-subtle-foreground)]">{description}</p>}
      {meta && <p className="mt-1 text-[11px] text-[var(--color-subtle-foreground)]">{meta}</p>}
      {onDelete && (
        <button type="button" aria-label={t('lists.deleteTemplate')} title={t('lists.deleteTemplate')}
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute bottom-2 right-2 hidden text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)] group-hover:block">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}
