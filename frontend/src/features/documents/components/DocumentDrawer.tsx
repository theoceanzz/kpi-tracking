import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Download, Eye, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Drawer, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DraftNotice from '@/components/common/DraftNotice'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useStateDraft } from '@/hooks/useFormDraft'
import { formatDateTime } from '@/i18n/format'
import { ChunkList } from '@/features/analytics/components/rag/RagDocumentsPanel'
import { documentApi, documentFileUrl } from '../api/documentApi'
import {
  useDeleteDocument, useReindexDocument, useReplaceDocumentFile, useReplaceLegacyDocument, useUpdateDocument,
} from '../hooks/useDocuments'
import { DOCUMENT_CATEGORIES, type DocumentCapabilities, type DocumentCategory, type DocumentScope, type KbDocument } from '../types'
import { AiStatusBadge, FileTypeIcon } from './docUi'
import { creatableScopes, formatBytes } from '../utils'

interface EditState {
  title: string
  description: string
  category: DocumentCategory
  scope: DocumentScope
  unitId: string
  aiEnabled: boolean
}

function toEdit(doc: KbDocument): EditState {
  return {
    title: doc.title,
    description: doc.description ?? '',
    category: doc.category,
    scope: doc.scope,
    unitId: doc.orgUnitId ?? '',
    aiEnabled: doc.aiEnabled,
  }
}

interface Props {
  doc: KbDocument
  caps: DocumentCapabilities
  onClose: () => void
}

/**
 * Chi tiết một tài liệu. Sửa được khi backend trả `canEdit` — frontend không tự suy quyền. Trang cha chỉ mount
 * drawer khi đang mở một tài liệu, nên mỗi lần mở là một form mới (nháp theo từng tài liệu áp lên sau).
 */
export default function DocumentDrawer({ doc, caps, onClose }: Props) {
  const { t } = useTranslation('documents')
  const update = useUpdateDocument()
  const replaceFile = useReplaceDocumentFile()
  const replaceLegacy = useReplaceLegacyDocument()
  const reindex = useReindexDocument()
  const remove = useDeleteDocument()
  const fileInput = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showChunks, setShowChunks] = useState(false)

  const [form, setForm] = useState<EditState>(() => toEdit(doc))
  const editable = doc.canEdit && !doc.legacy
  const draft = useStateDraft(form, setForm, { key: `document:${doc.id}`, enabled: editable })
  const set = <K extends keyof EditState>(k: K, v: EditState[K]) => setForm(prev => ({ ...prev, [k]: v }))

  // Đổi phạm vi: chỉ những phạm vi mình TẠO được (luật §5.3), cộng phạm vi hiện tại.
  const scopeOptions = useMemo(() => {
    const s = new Set<DocumentScope>(creatableScopes(caps))
    s.add(doc.scope)
    return (['PERSONAL', 'UNIT', 'COMPANY'] as DocumentScope[]).filter(x => s.has(x))
  }, [caps, doc.scope])
  const unitOptions = useMemo(() => {
    const list = [...caps.manageableUnits]
    if (doc.orgUnitId && !list.some(u => u.id === doc.orgUnitId)) {
      list.unshift({ id: doc.orgUnitId, name: doc.orgUnitName ?? '—', path: '' })
    }
    return list
  }, [caps.manageableUnits, doc.orgUnitId, doc.orgUnitName])

  const scopeChanged = form.scope !== doc.scope || (form.scope === 'UNIT' && form.unitId !== (doc.orgUnitId ?? ''))
  const dirty = form.title.trim() !== doc.title || form.description.trim() !== (doc.description ?? '')
    || form.category !== doc.category || scopeChanged || form.aiEnabled !== doc.aiEnabled
  const needsUnit = form.scope === 'UNIT' && !form.unitId

  const save = () => {
    update.mutate({
      id: doc.id,
      input: {
        title: form.title.trim() !== doc.title ? form.title.trim() : undefined,
        description: form.description.trim() !== (doc.description ?? '') ? form.description.trim() : undefined,
        category: form.category !== doc.category ? form.category : undefined,
        aiEnabled: form.aiEnabled !== doc.aiEnabled ? form.aiEnabled : undefined,
        scope: scopeChanged ? form.scope : undefined,
        orgUnitId: scopeChanged && form.scope === 'UNIT' ? form.unitId : undefined,
      },
    }, { onSuccess: onClose })
  }

  const onPickFile = (file: File | undefined) => {
    if (!file) return
    if (doc.legacy) replaceLegacy.mutate({ id: doc.id, file }, { onSuccess: onClose })
    else replaceFile.mutate({ id: doc.id, file })
  }

  const busy = update.isPending || replaceFile.isPending || replaceLegacy.isPending || remove.isPending
  const isPdf = doc.contentType === 'application/pdf'
  const scopeText = doc.scope === 'UNIT'
    ? `${t('scope.UNIT')} · ${doc.orgUnitName ?? '—'}`
    : t(`scope.${doc.scope}`)

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        size="lg"
        dismissible={!busy}
        title={doc.title}
        headerExtra={<AiStatusBadge status={doc.aiStatus} error={doc.aiError} />}
        footer={
          <DialogFooter
            destructive={doc.canEdit ? (
              <Button variant="ghost" className="text-[var(--color-error)]" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <Trash2 aria-hidden="true" /> {t('actions.delete')}
              </Button>
            ) : undefined}
            secondary={<Button variant="outline" onClick={onClose} disabled={busy}>{t('common.close')}</Button>}
            primary={editable ? (
              <Button onClick={save} disabled={!dirty || needsUnit || !form.title.trim() || busy}>
                {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t('actions.save')}
              </Button>
            ) : undefined}
          />
        }
      >
        {editable && <DraftNotice draft={draft} className="mb-4" />}

        {doc.legacy && (
          <div role="note" className="mb-4 flex gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
            <p className="text-[var(--color-foreground)]">{t('legacy.explain')}</p>
          </div>
        )}

        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-card border border-[var(--color-border)] p-4 text-sm sm:grid-cols-2">
          <Info label={t('fields.scope')} value={scopeText} />
          <Info label={t('fields.category')} value={t(`category.${doc.category}`)} />
          <Info label={t('fields.file')} value={
            doc.legacy ? t('legacy.noFile') : (
              <span className="flex min-w-0 items-center gap-2">
                <FileTypeIcon doc={doc} size={14} />
                <span className="truncate" title={doc.fileName ?? ''}>{doc.fileName}</span>
                <span className="shrink-0 text-[var(--color-muted-foreground)]">{formatBytes(doc.fileSize)} · v{doc.version}</span>
              </span>
            )
          } />
          <Info label={t('fields.uploadedBy')} value={doc.createdByName ?? '—'} />
          <Info label={t('fields.updatedAt')} value={formatDateTime(doc.updatedAt)} />
          <Info label={t('fields.ai')} value={
            doc.aiStatus === 'READY'
              ? t('ai.readyDetail', { count: doc.aiChunkCount, time: formatDateTime(doc.aiIndexedAt) })
              : (doc.aiError ?? t(`aiStatusHint.${doc.aiStatus}`))
          } />
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          {!doc.legacy && (
            <Button asChild variant="outline" size="sm">
              <a href={documentFileUrl(doc.id)} download><Download aria-hidden="true" /> {t('actions.download')}</a>
            </Button>
          )}
          {!doc.legacy && isPdf && (
            <Button asChild variant="outline" size="sm">
              <a href={documentFileUrl(doc.id, true)} target="_blank" rel="noopener noreferrer"><Eye aria-hidden="true" /> {t('actions.preview')}</a>
            </Button>
          )}
          {doc.canEdit && (
            <>
              <input ref={fileInput} type="file" className="hidden" accept=".pdf,.docx"
                     onChange={e => { onPickFile(e.target.files?.[0]); e.target.value = '' }} />
              <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
                {(replaceFile.isPending || replaceLegacy.isPending) ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                {doc.legacy ? t('actions.uploadOriginal') : t('actions.replaceFile')}
              </Button>
            </>
          )}
          {editable && doc.aiEnabled && (doc.aiStatus === 'FAILED' || doc.aiStatus === 'READY') && (
            <Button variant="outline" size="sm" onClick={() => reindex.mutate(doc.id)} disabled={reindex.isPending}>
              <RefreshCw aria-hidden="true" /> {t('actions.reindex')}
            </Button>
          )}
        </div>

        {editable && (
          <section className="mt-6 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{t('edit.heading')}</h3>
            <div className="space-y-1.5">
              <label className="text-label" htmlFor="doc-edit-title">{t('fields.title')}</label>
              <Input id="doc-edit-title" value={form.title} maxLength={255} invalid={!form.title.trim()}
                     onChange={e => set('title', e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-label">{t('fields.scope')}</label>
                <Select value={form.scope} onValueChange={v => set('scope', v as DocumentScope)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map(s => <SelectItem key={s} value={s}>{t(`scope.${s}`)}</SelectItem>)}
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
                    {unitOptions.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {scopeChanged && (
              <p className="text-caption">
                {form.scope === 'PERSONAL' ? t('edit.movingToPersonal') : t('edit.scopeChangeReindex')}
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-label" htmlFor="doc-edit-desc">{t('fields.description')}</label>
              <Textarea id="doc-edit-desc" rows={3} value={form.description} maxLength={4000}
                        onChange={e => set('description', e.target.value)} />
            </div>
            <div className="flex items-start gap-3 rounded-card border border-[var(--color-border)] p-3">
              <Switch checked={form.aiEnabled} onCheckedChange={v => set('aiEnabled', v)} aria-label={t('fields.aiEnabled')} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-foreground)]">{t('fields.aiEnabled')}</p>
                <p className="text-caption">
                  {form.aiEnabled
                    ? t(`audience.${form.scope}`, { unit: unitOptions.find(u => u.id === form.unitId)?.name ?? '' })
                    : t('audience.off')}
                </p>
              </div>
            </div>
          </section>
        )}

        {doc.canEdit && !doc.legacy && doc.aiStatus === 'READY' && (
          <section className="mt-6">
            <Button variant="ghost" size="sm" onClick={() => setShowChunks(v => !v)} aria-expanded={showChunks}>
              {showChunks ? t('chunks.hide') : t('chunks.show', { count: doc.aiChunkCount })}
            </Button>
            {showChunks && <ChunkList scope="documents" docId={doc.id} load={documentApi.chunks} />}
          </section>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate(doc, { onSuccess: () => { setConfirmDelete(false); onClose() } })}
        title={t('delete.title', { title: doc.title })}
        description={t('delete.description')}
        confirmLabel={t('actions.delete')}
        loading={remove.isPending}
      />
    </>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-[var(--color-foreground)]">{value}</dd>
    </div>
  )
}
