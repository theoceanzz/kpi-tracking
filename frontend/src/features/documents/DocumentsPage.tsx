import { useTourScope } from '@/hooks/useTourScope'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowUpFromLine, Building2, FilePlus2, FileSpreadsheet, FileText, FolderPlus, HardDrive, Home, Info, Layers, Plus, Trash2, Upload, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import { formatNumber } from '@/i18n/format'
import {
  useDeleteDocument, useDeleteFolder, useDocument, useDocumentCapabilities, useDocumentUsage, useLegacyDocuments,
  usePinnedDocuments, usePromotionInbox,
} from './hooks/useDocuments'
import DocumentDrawer from './components/DocumentDrawer'
import UploadDocumentDialog from './components/UploadDocumentDialog'
import FolderDialog from './components/FolderDialog'
import NewOnlineDocumentDialog from './components/NewOnlineDocumentDialog'
import MoveDocumentDialog from './components/MoveDocumentDialog'
import DocumentsNav, { type NavItem } from './components/DocumentsNav'
import { DocumentActionsProvider, type DocumentActions, type DrawerTab } from './components/DocumentActions'
import type { DocLayout } from './components/DocumentList'
import HomeView from './views/HomeView'
import DriveView, { type DriveContext } from './views/DriveView'
import TrashView from './views/TrashView'
import PromotionsView from './views/PromotionsView'
import StorageView from './views/StorageView'
import { documentFileUrl } from './api/documentApi'
import { creatableScopes, editorPath, formatBytes, listableUnits, onlineFormat } from './utils'
import type { DocumentFolder, DocumentScope, KbDocument } from './types'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useTourModal } from '@/components/common/tours/actions'

type TabKey = 'home' | 'mine' | 'unit' | 'company' | 'trash' | 'requests' | 'storage'
const SCOPE_OF: Partial<Record<TabKey, DocumentScope>> = { mine: 'PERSONAL', unit: 'UNIT', company: 'COMPANY' }
const TAB_OF: Record<DocumentScope, TabKey> = { PERSONAL: 'mine', UNIT: 'unit', COMPANY: 'company' }
const LAYOUT_KEY = 'documents.layout'

function readLayout(): DocLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

type FolderDialogState =
  | { kind: 'create'; parent: DocumentFolder | null; scope?: DocumentScope; unitId?: string | null }
  | { kind: 'rename'; folder: DocumentFolder }

/**
 * Thư viện tài liệu kiểu Lark Docs (docs/DOCUMENTS_DESIGN.md §8, §15): trang chủ (gần đây, của tôi, được chia sẻ,
 * yêu thích), Drive theo phạm vi có thư mục, thùng rác, ghim lên thanh bên. Ai làm được gì đều do backend quyết
 * (`/documents/capabilities`, `canEdit` trên từng tài liệu / thư mục).
 *
 * <p>URL: `?tab=home|mine|unit|company|trash`, `&view=` (tab trang chủ), `&unit=`, `&folder=`, `&doc=<id>[&legacy=1]`
 * (mở thẳng tài liệu — chip nguồn K.AI dùng link này).
 */
export default function DocumentsPage() {
  useTourScope('documents')
  const { t } = useTranslation('documents')
  const { data: caps, isLoading: capsLoading } = useDocumentCapabilities()
  const { data: usage } = useDocumentUsage()
  const member = !!caps?.member
  const pinned = usePinnedDocuments(member)
  const inbox = usePromotionInbox(member)

  const [params, setParams] = useSearchParams()
  const navItems = useMemo<NavItem<TabKey>[]>(() => {
    const out: NavItem<TabKey>[] = [{ key: 'home', label: t('nav.home'), icon: Home }]
    if (caps?.canUploadPersonal) out.push({ key: 'mine', label: t('tabs.mine'), icon: User, group: 'drive' })
    if (caps && listableUnits(caps).length > 0) out.push({ key: 'unit', label: t('tabs.unit'), icon: Layers, group: 'drive' })
    out.push({ key: 'company', label: t('tabs.company'), icon: Building2, group: 'drive' })
    out.push({ key: 'requests', label: t('nav.requests'), icon: ArrowUpFromLine, badge: inbox.data?.length })
    if (caps?.canManageCompany) out.push({ key: 'storage', label: t('nav.storage'), icon: HardDrive })
    out.push({ key: 'trash', label: t('nav.trash'), icon: Trash2 })
    return out
  }, [caps, t, inbox.data?.length])
  const rawTab = params.get('tab') as TabKey | null
  const tab: TabKey = rawTab && navItems.some(i => i.key === rawTab) ? rawTab : 'home'

  const go = (next: TabKey, extra: Record<string, string | null> = {}) => setParams(prev => {
    const p = new URLSearchParams(prev)
    p.set('tab', next)
    for (const k of ['folder', 'view', 'unit']) p.delete(k)
    for (const [k, v] of Object.entries(extra)) { if (v) p.set(k, v); else p.delete(k) }
    return p
  }, { replace: true })

  const [layout, setLayout] = useState<DocLayout>(readLayout)
  const changeLayout = (l: DocLayout) => {
    setLayout(l)
    try { localStorage.setItem(LAYOUT_KEY, l) } catch { /* trình duyệt chặn lưu — chỉ mất ghi nhớ */ }
  }

  const [upload, setUpload] = useState<DriveContext | 'pick' | null>(null)
  const [newDoc, setNewDoc] = useState<{ at: DriveContext | 'pick'; kind: 'doc' | 'sheet' } | null>(null)
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(null)
  const [moving, setMoving] = useState<KbDocument | null>(null)
  const [removing, setRemoving] = useState<KbDocument | null>(null)
  const [removingFolder, setRemovingFolder] = useState<DocumentFolder | null>(null)
  const [opened, setOpened] = useState<{ doc: KbDocument; tab?: DrawerTab } | null>(null)
  const [previewDoc, setPreviewDoc] = useState<KbDocument | null>(null)
  const [newMenu, setNewMenu] = useState(false)
  const closeCreateDialogs = () => { setNewMenu(false); setNewDoc(null); setUpload(null); setFolderDialog(null) }
  const pickAt = (): DriveContext | 'pick' => (scope && scope !== 'UNIT' ? { scope, unitId: null, folder: null } : 'pick')
  useTourModal('docs.newMenu', () => { closeCreateDialogs(); if (canUpload) setNewMenu(true) }, () => setNewMenu(false))
  useTourModal('docs.online', () => { closeCreateDialogs(); if (canUpload) setNewDoc({ at: pickAt(), kind: 'doc' }) }, closeCreateDialogs)
  useTourModal('docs.upload', () => { closeCreateDialogs(); if (canUpload) setUpload('pick') }, closeCreateDialogs)
  useTourModal('docs.folder', () => { closeCreateDialogs(); if (canUpload) setFolderDialog({ kind: 'create', parent: null }) }, closeCreateDialogs)
  const removeDoc = useDeleteDocument()
  const removeFolder = useDeleteFolder()

  // Mở thẳng một tài liệu từ chip nguồn của K.AI: ?doc=<id>[&legacy=1]. Vẫn qua kiểm quyền — không đọc được (đã xoá,
  // bị thu quyền) thì báo rõ thay vì im lặng.
  const linkedId = params.get('doc')
  const linkedLegacy = params.get('legacy') === '1'
  const openId = opened?.doc.id ?? linkedId
  const openLegacy = opened ? opened.doc.legacy : linkedLegacy
  const fresh = useDocument(openLegacy ? null : openId, member)
  const legacyList = useLegacyDocuments(member && !!openId && openLegacy)
  const drawerDoc = openLegacy
    ? (legacyList.data?.find(d => d.id === openId) ?? opened?.doc ?? null)
    : (fresh.data ?? opened?.doc ?? null)
  const linkedMissing = !opened && !!linkedId && (linkedLegacy ? legacyList.data !== undefined && !drawerDoc : fresh.isError)

  const clearLink = () => setParams(prev => {
    const p = new URLSearchParams(prev)
    p.delete('doc')
    p.delete('legacy')
    return p
  }, { replace: true })
  const closeDrawer = () => {
    setOpened(null)
    if (linkedId) clearLink()
  }

  const navigate = useNavigate()
  const actions: DocumentActions = {
    // Tài liệu soạn trực tuyến (.md / .txt) mở thẳng trình soạn như Lark; drawer thông tin vẫn mở được khi hỏi rõ tab.
    open: (doc, drawerTab) => {
      if (!drawerTab && onlineFormat(doc)) { navigate(editorPath(doc.id)); return }
      if (linkedId) clearLink()
      setOpened({ doc, tab: drawerTab })
    },
    preview: setPreviewDoc,
    move: setMoving,
    remove: setRemoving,
    openFolder: f => go(TAB_OF[f.scope], { folder: f.id, unit: f.orgUnitId }),
    renameFolder: f => setFolderDialog({ kind: 'rename', folder: f }),
    deleteFolder: setRemovingFolder,
  }

  const creatable = caps ? creatableScopes(caps) : []
  const canUpload = creatable.length > 0

  const stats = usage ? [
    ...(caps?.canUploadPersonal ? [{ label: t('stats.personalUsage'), value: `${formatBytes(usage.personalUsed)} / ${formatBytes(usage.personalQuota)}` }] : []),
    { label: t('stats.companyUsage'), value: `${formatBytes(usage.companyUsed)} / ${formatBytes(usage.companyQuota)}` },
    { label: t('stats.aiChunks'), value: `${formatNumber(usage.orgChunks)} / ${formatNumber(usage.orgChunkQuota)}` },
  ] : undefined

  if (capsLoading) {
    return <div className="mx-auto max-w-[1600px]"><LoadingSkeleton type="table" rows={6} /></div>
  }
  if (!caps?.member) {
    return (
      <div className="mx-auto max-w-[1600px] rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState icon={FileText} title={t('empty.notMemberTitle')} description={t('empty.notMemberDescription')} />
      </div>
    )
  }

  const scope = SCOPE_OF[tab]
  const driveKey = `${tab}:${params.get('unit') ?? ''}:${params.get('folder') ?? ''}`

  return (
    <DocumentActionsProvider value={actions}>
      <div className="mx-auto max-w-[1600px] space-y-4">
        <WorkspaceHeader
          id="tour-documents-header"
          title={t('title')}
          description={t('pageIntro')}
          stats={stats}
          actions={canUpload ? (
            <Popover open={newMenu} onOpenChange={setNewMenu}>
              <PopoverTrigger asChild>
                <Button {...tourAnchor('docs.new')} aria-haspopup="menu"><Plus aria-hidden="true" /> {t('actions.new')}</Button>
              </PopoverTrigger>
              <PopoverContent {...tourAnchor('docs.new.menu')} align="end" className="w-56 p-1.5" role="menu">
                <NewMenuItem icon={<FilePlus2 />} label={t('actions.newDoc')}
                             onClick={() => { setNewMenu(false); setNewDoc({ at: scope && scope !== 'UNIT' ? { scope, unitId: null, folder: null } : 'pick', kind: 'doc' }) }} />
                <NewMenuItem icon={<FileSpreadsheet />} label={t('actions.newSheet')}
                             onClick={() => { setNewMenu(false); setNewDoc({ at: scope && scope !== 'UNIT' ? { scope, unitId: null, folder: null } : 'pick', kind: 'sheet' }) }} />
                <NewMenuItem icon={<Upload />} label={t('actions.upload')} onClick={() => { setNewMenu(false); setUpload('pick') }} />
                <NewMenuItem icon={<FolderPlus />} label={t('actions.newFolder')}
                             onClick={() => { setNewMenu(false); setFolderDialog({ kind: 'create', parent: null }) }} />
              </PopoverContent>
            </Popover>
          ) : undefined}
        />

        {linkedMissing && (
          <div role="alert" className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
            <p className="flex-1 text-[var(--color-foreground)]">{t('sources.notFound')}</p>
            <button type="button" onClick={clearLink} aria-label={t('common.close')}
                    className="shrink-0 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside {...tourAnchor('docs.nav')} className="lg:sticky lg:top-4 lg:self-start">
            <DocumentsNav items={navItems} active={tab} onSelect={k => go(k)} pinned={pinned.data ?? []} />
          </aside>

          <main {...tourAnchor('docs.main')} className="min-w-0 space-y-4">
            {tab === 'home' && (
              <HomeView
                layout={layout}
                onLayoutChange={changeLayout}
                canUpload={canUpload}
                canCreateFolder={canUpload}
                onUpload={() => setUpload('pick')}
                onNewFolder={() => setFolderDialog({ kind: 'create', parent: null })}
                onNewDoc={kind => setNewDoc({ at: 'pick', kind })}
              />
            )}
            {scope && (
              <DriveView
                key={driveKey}
                scope={scope}
                caps={caps}
                layout={layout}
                onLayoutChange={changeLayout}
                onUpload={ctx => setUpload(ctx)}
                onNewDoc={(ctx, kind) => setNewDoc({ at: ctx, kind })}
                onNewFolder={ctx => setFolderDialog(ctx.folder
                  ? { kind: 'create', parent: ctx.folder }
                  : { kind: 'create', parent: null, scope: ctx.scope, unitId: ctx.unitId })}
              />
            )}
            {tab === 'trash' && <TrashView retentionDays={usage?.trashRetentionDays ?? 30} />}
            {tab === 'requests' && (
              <PromotionsView onOpenDocument={id => setParams(prev => {
                const p = new URLSearchParams(prev)
                p.set('doc', id)
                p.delete('legacy')
                return p
              }, { replace: true })} />
            )}
            {tab === 'storage' && <StorageView />}

            <p className="flex items-start gap-1.5 text-caption">
              <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{t('notice.chatHistory')}</span>
            </p>
          </main>
        </div>

        {upload && usage && (
          <UploadDocumentDialog
            open
            onClose={() => setUpload(null)}
            caps={caps}
            maxFileBytes={usage.maxFileBytes}
            defaultScope={upload === 'pick' ? (scope ?? creatable[0] ?? 'PERSONAL') : upload.scope}
            defaultUnitId={upload === 'pick' ? null : upload.unitId}
            folder={upload === 'pick' ? null : upload.folder}
          />
        )}
        {newDoc && (
          <NewOnlineDocumentDialog
            onClose={() => setNewDoc(null)}
            caps={caps}
            folder={newDoc.at === 'pick' ? null : newDoc.at.folder}
            scope={newDoc.at === 'pick' ? undefined : newDoc.at.scope}
            unitId={newDoc.at === 'pick' ? undefined : newDoc.at.unitId}
            kind={newDoc.kind}
          />
        )}
        {folderDialog && (
          <FolderDialog
            onClose={() => setFolderDialog(null)}
            caps={caps}
            editing={folderDialog.kind === 'rename' ? folderDialog.folder : null}
            parent={folderDialog.kind === 'create' ? folderDialog.parent : null}
            scope={folderDialog.kind === 'create' ? folderDialog.scope : undefined}
            unitId={folderDialog.kind === 'create' ? folderDialog.unitId : undefined}
          />
        )}
        {previewDoc && (
          <MediaPreviewModal isOpen onClose={() => setPreviewDoc(null)} url={documentFileUrl(previewDoc.id)}
                             fileName={previewDoc.fileName ?? previewDoc.title} contentType={previewDoc.contentType ?? undefined} />
        )}
        {moving && <MoveDocumentDialog doc={moving} onClose={() => setMoving(null)} />}
        {drawerDoc && (
          <DocumentDrawer key={drawerDoc.id} doc={drawerDoc} caps={caps} onClose={closeDrawer} initialTab={opened?.tab} />
        )}

        <ConfirmDialog
          open={!!removing}
          onClose={() => setRemoving(null)}
          onConfirm={() => removing && removeDoc.mutate(removing, {
            onSuccess: () => {
              if (openId === removing.id) closeDrawer()
              setRemoving(null)
            },
          })}
          title={t('delete.title', { title: removing?.title ?? '' })}
          description={removing?.legacy ? t('delete.legacyDescription') : t('delete.description', { days: usage?.trashRetentionDays ?? 30 })}
          confirmLabel={t('actions.delete')}
          loading={removeDoc.isPending}
        />
        <ConfirmDialog
          open={!!removingFolder}
          onClose={() => setRemovingFolder(null)}
          onConfirm={() => removingFolder && removeFolder.mutate(removingFolder.id, {
            onSuccess: () => {
              // Đang đứng trong thư mục vừa xoá → về thư mục cha.
              if (params.get('folder') === removingFolder.id) {
                setParams(prev => {
                  const p = new URLSearchParams(prev)
                  if (removingFolder.parentId) p.set('folder', removingFolder.parentId); else p.delete('folder')
                  return p
                }, { replace: true })
              }
              setRemovingFolder(null)
            },
          })}
          title={t('folder.deleteTitle', { name: removingFolder?.name ?? '' })}
          description={t('folder.deleteDescription', { days: usage?.trashRetentionDays ?? 30 })}
          confirmLabel={t('actions.delete')}
          loading={removeFolder.isPending}
        />
      </div>
    </DocumentActionsProvider>
  )
}

function NewMenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]"
    >
      {icon}{label}
    </button>
  )
}
