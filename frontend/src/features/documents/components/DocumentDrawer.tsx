import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowUpFromLine, Download, Eye, Loader2, Pin, RefreshCw, Star, Trash2, Upload } from 'lucide-react'
import { Drawer, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChoiceChip } from '@/components/ui/choice-chip'
import DraftNotice from '@/components/common/DraftNotice'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import { Badge } from '@/components/ui/badge'
import { canPreview } from '@/lib/filePreview'
import { useStateDraft } from '@/hooks/useFormDraft'
import { formatDate, formatDateTime } from '@/i18n/format'
import { ChunkList } from '@/features/analytics/components/rag/RagDocumentsPanel'
import { documentApi, documentFileUrl } from '../api/documentApi'
import {
  useCancelPromotion, useDocumentPromotions, useMarkOpened, useReindexDocument, useReplaceDocumentFile,
  useReplaceLegacyDocument, useToggleFavorite, useTogglePin, useUpdateDocument,
} from '../hooks/useDocuments'
import { DOCUMENT_CATEGORIES, type DocumentCapabilities, type DocumentCategory, type DocumentScope, type KbDocument } from '../types'
import { AiStatusBadge, FileTypeIcon } from './docUi'
import { DOCUMENT_ACCEPT_ATTR, creatableScopes, formatBytes, promotionTargets } from '../utils'
import { useDocumentActions, type DrawerTab } from './DocumentActions'
import { locationLabel } from './docMenu'
import SharePanel from './SharePanel'
import VersionsPanel from './VersionsPanel'
import DocumentDateFields from './DocumentDateFields'
import PromoteDialog from './PromoteDialog'

interface EditState {
  title: string
  description: string
  category: DocumentCategory
  scope: DocumentScope
  unitId: string
  aiEnabled: boolean
  reviewDate: string
  expiryDate: string
}

function toEdit(doc: KbDocument): EditState {
  return {
    title: doc.title,
    description: doc.description ?? '',
    category: doc.category,
    scope: doc.scope,
    unitId: doc.orgUnitId ?? '',
    aiEnabled: doc.aiEnabled,
    reviewDate: doc.reviewDate ?? '',
    expiryDate: doc.expiryDate ?? '',
  }
}

interface Props {
  doc: KbDocument
  caps: DocumentCapabilities
  onClose: () => void
  /** Mở thẳng một tab (vd "Chia sẻ" từ menu ⋯). */
  initialTab?: DrawerTab
}

/**
 * Chi tiết một tài liệu. Sửa được khi backend trả `canEdit` — frontend không tự suy quyền. Trang cha chỉ mount
 * drawer khi đang mở một tài liệu, nên mỗi lần mở là một form mới (nháp theo từng tài liệu áp lên sau).
 */
export default function DocumentDrawer({ doc, caps, onClose, initialTab = 'info' }: Props) {
  const { t } = useTranslation('documents')
  const update = useUpdateDocument()
  const replaceFile = useReplaceDocumentFile()
  const replaceLegacy = useReplaceLegacyDocument()
  const reindex = useReindexDocument()
  const actions = useDocumentActions()
  const fileInput = useRef<HTMLInputElement>(null)
  const favorite = useToggleFavorite()
  const pin = useTogglePin()
  const markOpened = useMarkOpened()
  const [previewing, setPreviewing] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const targets = useMemo(() => promotionTargets(doc, caps), [doc, caps])
  const pendingPromotions = useDocumentPromotions(doc.id, doc.canEdit && !doc.legacy)
  const cancelPromotion = useCancelPromotion()

  // Tab nào có tuỳ quyền: chia sẻ / phiên bản / đoạn AI chỉ người sửa được mới thấy (backend cũng chặn).
  const tabs = useMemo(() => {
    const out: DrawerTab[] = ['info']
    if (doc.canEdit && !doc.legacy) out.push('share', 'versions')
    if (doc.canEdit && !doc.legacy && doc.aiStatus === 'READY') out.push('ai')
    return out
  }, [doc.canEdit, doc.legacy, doc.aiStatus])
  const [tab, setTab] = useState<DrawerTab>(initialTab)
  const activeTab = tabs.includes(tab) ? tab : 'info'

  // Ghi "mở gần nhất" một lần mỗi lần mở (tab Gần đây). Tài liệu cũ không có bản ghi để ghi.
  const markedRef = useRef(false)
  useEffect(() => {
    if (markedRef.current || doc.legacy) return
    markedRef.current = true
    markOpened.mutate(doc.id)
  }, [doc.id, doc.legacy, markOpened])

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
  const datesChanged = form.reviewDate !== (doc.reviewDate ?? '') || form.expiryDate !== (doc.expiryDate ?? '')
  const dirty = form.title.trim() !== doc.title || form.description.trim() !== (doc.description ?? '')
    || form.category !== doc.category || scopeChanged || form.aiEnabled !== doc.aiEnabled || datesChanged
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
        datesSet: datesChanged || undefined,
        reviewDate: datesChanged ? (form.reviewDate || null) : undefined,
        expiryDate: datesChanged ? (form.expiryDate || null) : undefined,
      },
    }, { onSuccess: onClose })
  }

  const onPickFile = (file: File | undefined) => {
    if (!file) return
    if (doc.legacy) replaceLegacy.mutate({ id: doc.id, file }, { onSuccess: onClose })
    else replaceFile.mutate({ id: doc.id, file })
  }

  const busy = update.isPending || replaceFile.isPending || replaceLegacy.isPending
  const previewable = !doc.legacy && canPreview(doc.fileName, doc.contentType)
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
        description={locationLabel(doc, t)}
        headerExtra={
          <span className="flex items-center gap-1">
            <AiStatusBadge status={doc.aiStatus} error={doc.aiError} />
            {!doc.legacy && (
              <>
                <Button variant="ghost" size="icon-sm" aria-pressed={doc.favorite}
                        aria-label={doc.favorite ? t('actions.unfavorite') : t('actions.favorite')}
                        title={doc.favorite ? t('actions.unfavorite') : t('actions.favorite')}
                        onClick={() => favorite.mutate({ id: doc.id, value: !doc.favorite })} disabled={favorite.isPending}>
                  <Star className={doc.favorite ? 'fill-[var(--color-warning)] text-[var(--color-warning)]' : undefined} aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-pressed={doc.pinned}
                        aria-label={doc.pinned ? t('actions.unpin') : t('actions.pin')}
                        title={doc.pinned ? t('actions.unpin') : t('actions.pin')}
                        onClick={() => pin.mutate({ id: doc.id, value: !doc.pinned })} disabled={pin.isPending}>
                  <Pin className={doc.pinned ? 'fill-[var(--color-primary)] text-[var(--color-primary)]' : undefined} aria-hidden="true" />
                </Button>
              </>
            )}
          </span>
        }
        footer={
          <DialogFooter
            destructive={doc.canEdit ? (
              <Button variant="ghost" className="text-[var(--color-error)]" onClick={() => actions.remove(doc)} disabled={busy}>
                <Trash2 aria-hidden="true" /> {t('actions.delete')}
              </Button>
            ) : undefined}
            secondary={<Button variant="outline" onClick={onClose} disabled={busy}>{t('common.close')}</Button>}
            primary={editable && activeTab === 'info' ? (
              <Button onClick={save} disabled={!dirty || needsUnit || !form.title.trim() || busy}>
                {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t('actions.save')}
              </Button>
            ) : undefined}
          />
        }
      >
        {tabs.length > 1 && (
          <div role="tablist" aria-label={t('drawer.tabs')} className="mb-4 flex gap-0.5 overflow-x-auto rounded-control bg-[var(--color-muted)] p-0.5">
            {tabs.map(k => (
              <ChoiceChip key={k} role="tab" aria-selected={activeTab === k} selected={activeTab === k} variant="segment"
                          className="flex-1" onClick={() => setTab(k)}>
                {t(`drawer.tab.${k}`)}
              </ChoiceChip>
            ))}
          </div>
        )}

        {activeTab === 'share' && <SharePanel doc={doc} />}
        {activeTab === 'versions' && <VersionsPanel doc={doc} />}
        {activeTab === 'ai' && <ChunkList scope="documents" docId={doc.id} load={documentApi.chunks} />}

        {activeTab === 'info' && <>
        {editable && <DraftNotice draft={draft} className="mb-4" />}

        {doc.legacy && (
          <div role="note" className="mb-4 flex gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
            <p className="text-[var(--color-foreground)]">{t('legacy.explain')}</p>
          </div>
        )}

        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-card border border-[var(--color-border)] p-4 text-sm sm:grid-cols-2">
          <Info label={t('fields.scope')} value={scopeText} />
          {doc.folderName && <Info label={t('fields.folder')} value={doc.folderName} />}
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
          {doc.reviewDate && <Info label={t('fields.reviewDate')} value={
            <span className="flex items-center gap-2">{formatDate(doc.reviewDate)}{doc.reviewDue && <Badge variant="warning">{t('badge.reviewDue')}</Badge>}</span>
          } />}
          {doc.expiryDate && <Info label={t('fields.expiryDate')} value={
            <span className="flex items-center gap-2">{formatDate(doc.expiryDate)}{doc.expired && <Badge variant="destructive">{t('badge.expired')}</Badge>}</span>
          } />}
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
          {previewable && (
            <Button variant="outline" size="sm" onClick={() => setPreviewing(true)}>
              <Eye aria-hidden="true" /> {t('actions.preview')}
            </Button>
          )}
          {doc.canEdit && (
            <>
              <input ref={fileInput} type="file" className="hidden" accept={DOCUMENT_ACCEPT_ATTR}
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
          {editable && targets.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setPromoting(true)}>
              <ArrowUpFromLine aria-hidden="true" /> {t('promotion.propose')}
            </Button>
          )}
        </div>

        {(pendingPromotions.data?.length ?? 0) > 0 && (
          <ul className="mt-3 space-y-1.5">
            {pendingPromotions.data!.map(p => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-card border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-3 py-2 text-sm">
                <ArrowUpFromLine size={14} className="shrink-0 text-[var(--color-info)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[var(--color-foreground)]">
                  {t('promotion.pendingTo', { target: p.targetScope === 'COMPANY' ? t('scope.COMPANY') : (p.targetUnitName ?? '—') })}
                </span>
                {p.canCancel && (
                  <Button variant="ghost" size="sm" onClick={() => cancelPromotion.mutate(p.id)} disabled={cancelPromotion.isPending}>
                    {t('promotion.cancel')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

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
            <DocumentDateFields
              idPrefix="doc-edit"
              reviewDate={form.reviewDate}
              expiryDate={form.expiryDate}
              onReviewDate={v => set('reviewDate', v)}
              onExpiryDate={v => set('expiryDate', v)}
            />
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

        {doc.sharedWithMe && (
          <p className="mt-4 text-caption">{t('share.youAreViewer', { name: doc.createdByName ?? '—' })}</p>
        )}
        </>}
      </Drawer>

      {previewing && (
        <MediaPreviewModal isOpen onClose={() => setPreviewing(false)} url={documentFileUrl(doc.id)}
                           fileName={doc.fileName ?? doc.title} contentType={doc.contentType ?? undefined} />
      )}
      {promoting && <PromoteDialog doc={doc} targets={targets} onClose={() => setPromoting(false)} />}
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
