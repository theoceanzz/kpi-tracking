import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import FileDropzone from '@/components/common/FileDropzone'
import DraftNotice from '@/components/common/DraftNotice'
import { useStateDraft } from '@/hooks/useFormDraft'
import { useUploadDocument } from '../hooks/useDocuments'
import { DOCUMENT_CATEGORIES, type DocumentCapabilities, type DocumentCategory, type DocumentScope } from '../types'
import { creatableScopes, formatBytes } from '../utils'

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
}

interface FormState {
  title: string
  description: string
  category: DocumentCategory
  scope: DocumentScope
  unitId: string
  aiEnabled: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  caps: DocumentCapabilities
  maxFileBytes: number
  /** Phạm vi đặt sẵn theo tab đang đứng. */
  defaultScope: DocumentScope
  defaultUnitId?: string | null
}

export default function UploadDocumentDialog({ open, onClose, caps, maxFileBytes, defaultScope, defaultUnitId }: Props) {
  const { t } = useTranslation('documents')
  const upload = useUploadDocument()
  const scopes = useMemo(() => creatableScopes(caps), [caps])

  const initial = (): FormState => {
    const scope = scopes.includes(defaultScope) ? defaultScope : (scopes[0] ?? 'PERSONAL')
    const manageable = caps.manageableUnits.map(u => u.id)
    return {
      title: '',
      description: '',
      category: 'OTHER',
      scope,
      unitId: defaultUnitId && manageable.includes(defaultUnitId) ? defaultUnitId : (caps.manageableUnits[0]?.id ?? ''),
      aiEnabled: true,
    }
  }
  // Trang cha chỉ mount dialog khi mở, nên mỗi lần mở là một state mới theo tab; nháp (nếu có) áp lên sau.
  const [form, setForm] = useState<FormState>(initial)
  const [file, setFile] = useState<File | null>(null)
  // Tệp không vào nháp (quy ước useFormDraft) — chỉ tên, mô tả, danh mục, phạm vi.
  const draft = useStateDraft(form, setForm, { key: 'document:new', enabled: open })

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(prev => ({ ...prev, [k]: v }))
  const unitName = caps.manageableUnits.find(u => u.id === form.unitId)?.name ?? ''
  const needsUnit = form.scope === 'UNIT' && !form.unitId
  const canSubmit = !!file && !needsUnit && !upload.isPending

  const submit = () => {
    if (!file) return
    upload.mutate({
      file,
      scope: form.scope,
      unitId: form.scope === 'UNIT' ? form.unitId : null,
      title: form.title.trim() || undefined,
      description: form.description.trim() || undefined,
      category: form.category,
      aiEnabled: form.aiEnabled,
    }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      dismissible={!upload.isPending}
      title={t('upload.title')}
      description={t('upload.description', { types: caps.allowedExtensions.map(e => '.' + e).join(', '), max: formatBytes(maxFileBytes) })}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={upload.isPending}>{t('common.cancel')}</Button>}
          primary={
            <Button onClick={submit} disabled={!canSubmit}>
              {upload.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('upload.submit')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        <FileDropzone
          files={file ? [file] : []}
          onFilesSelected={files => {
            const f = files[0] ?? null
            setFile(f)
            if (f && !form.title.trim()) set('title', f.name.replace(/\.[^.]+$/, ''))
          }}
          onRemove={() => setFile(null)}
          accept={ACCEPT}
          maxFiles={1}
          maxSize={maxFileBytes}
          hint={t('upload.dropHint', { max: formatBytes(maxFileBytes) })}
        />

        <div className="space-y-1.5">
          <label className="text-label" htmlFor="doc-title">{t('fields.title')}</label>
          <Input id="doc-title" value={form.title} maxLength={255} onChange={e => set('title', e.target.value)}
                 placeholder={t('fields.titlePlaceholder')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-label">{t('fields.scope')}</label>
            <Select value={form.scope} onValueChange={v => set('scope', v as DocumentScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {scopes.map(s => <SelectItem key={s} value={s}>{t(`scope.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-label">{t('fields.category')}</label>
            <Select value={form.category} onValueChange={v => set('category', v as DocumentCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`category.${c}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.scope === 'UNIT' && (
          <div className="space-y-1.5">
            <label className="text-label">{t('fields.unit')}</label>
            <Select value={form.unitId || undefined} onValueChange={v => set('unitId', v)}>
              <SelectTrigger aria-invalid={needsUnit}><SelectValue placeholder={t('fields.unitPlaceholder')} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {caps.manageableUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-label" htmlFor="doc-desc">{t('fields.description')}</label>
          <Textarea id="doc-desc" rows={2} value={form.description} maxLength={4000}
                    onChange={e => set('description', e.target.value)} placeholder={t('fields.descriptionPlaceholder')} />
        </div>

        <div className="flex items-start gap-3 rounded-card border border-[var(--color-border)] p-3">
          <Switch checked={form.aiEnabled} onCheckedChange={v => set('aiEnabled', v)} aria-label={t('fields.aiEnabled')} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-foreground)]">{t('fields.aiEnabled')}</p>
            <p className="text-caption">
              {form.aiEnabled ? t(`audience.${form.scope}`, { unit: unitName }) : t('audience.off')}
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
