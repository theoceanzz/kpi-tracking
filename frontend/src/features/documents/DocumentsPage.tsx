import { useTourScope } from '@/hooks/useTourScope'
import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowUpFromLine, Building2, FileText, HardDrive, Home, Info, Layers, Trash2, User, X } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import {
  useDeleteDocument, useDeleteDocuments, useDeleteFolder, useDocument, useDocumentCapabilities, useDocumentUsage,
  useLegacyDocuments, usePinnedDocuments, usePromotionInbox,
} from './hooks/useDocuments'
import DocumentDrawer from './components/DocumentDrawer'
import UploadDocumentDialog from './components/UploadDocumentDialog'
import FolderDialog from './components/FolderDialog'
import NewOnlineDocumentDialog from './components/NewOnlineDocumentDialog'
import MoveDocumentDialog from './components/MoveDocumentDialog'
import RenameDocumentDialog from './components/RenameDocumentDialog'
import CreateCards from './components/CreateCards'
import SendDocumentEmailDialog from './components/SendDocumentEmailDialog'
import DocumentsNav, { type NavItem } from './components/DocumentsNav'
import { DocumentActionsProvider, type DocumentActions, type DrawerTab } from './components/DocumentActions'
import type { DocLayout } from './components/DocumentList'
import HomeView from './views/HomeView'
import DriveView, { type DriveContext } from './views/DriveView'
import TrashView from './views/TrashView'
import PromotionsView from './views/PromotionsView'
import StorageView, { UsageSummary } from './views/StorageView'
import SearchView from './views/SearchView'
import { documentFileUrl } from './api/documentApi'
import { creatableScopes, editorPath, listableUnits, onlineFormat } from './utils'
import type { DocumentFolder, DocumentScope, KbDocument } from './types'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useTourModal } from '@/components/common/tours/actions'

type TabKey = 'home' | 'mine' | 'unit' | 'company' | 'trash' | 'requests' | 'storage' | 'search'
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
 * Thư viện tài liệu theo bố cục Lark Docs (docs/DOCUMENTS_LARK_REFERENCE.md; nghiệp vụ ở DOCUMENTS_DESIGN.md §8, §15):
 * thanh bên (Tìm kiếm, Trang chủ, Drive theo phạm vi, Đề xuất, Đã ghim, đáy Dung lượng | Thùng rác), tiêu đề to theo mục,
 * thẻ "Mới / Tải lên" ở Trang chủ và Drive. Ai làm được gì đều do backend quyết (`/documents/capabilities`, `canEdit`).
 *
 * <p>URL: `?tab=home|mine|unit|company|trash|requests|storage|search`, `&view=` (tab trang chủ), `&q=` (tìm), `&unit=`,
 * `&folder=`, `&doc=<id>[&legacy=1][&panel=share|versions]` (mở thẳng tài liệu — chip nguồn K.AI, trình soạn dùng link này).
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
    out.push({ key: 'storage', label: t('nav.storage'), icon: HardDrive, group: 'bottom' })
    out.push({ key: 'trash', label: t('nav.trash'), icon: Trash2, group: 'bottom' })
    return out
  }, [caps, t, inbox.data?.length])
  const rawTab = params.get('tab') as TabKey | null
  const searchQ = params.get('q')?.trim() ?? ''
  const tab: TabKey = rawTab === 'search' && searchQ ? 'search'
    : rawTab && navItems.some(i => i.key === rawTab) ? rawTab : 'home'
  const scope = SCOPE_OF[tab]
  const creatable = caps ? creatableScopes(caps) : []
  const canUpload = creatable.length > 0

  const go = (next: TabKey, extra: Record<string, string | null> = {}) => setParams(prev => {
    const p = new URLSearchParams(prev)
    p.set('tab', next)
    for (const k of ['folder', 'view', 'unit', 'q']) p.delete(k)
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
  const [moving, setMoving] = useState<KbDocument[] | null>(null)
  const [renaming, setRenaming] = useState<KbDocument | null>(null)
  const [removingMany, setRemovingMany] = useState<KbDocument[] | null>(null)
  // Chỗ Drive đang đứng — thẻ "Mới / Tải lên" tạo đúng tại đó (Trang chủ thì hỏi phạm vi trong hộp tạo).
  const [driveAt, setDriveAt] = useState<{ ctx: DriveContext; canCreate: boolean } | null>(null)
  const onDriveContext = useCallback((ctx: DriveContext, canCreate: boolean) => setDriveAt({ ctx, canCreate }), [])
  const [emailing, setEmailing] = useState<KbDocument | null>(null)
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
  // Bài "Gửi qua email" mở hộp với tài liệu đầu tiên mình quản lý đang có trên màn hình (không có thì bài tự bỏ bước).
  const qc = useQueryClient()
  useTourModal('docs.email', () => {
    if (emailing) return
    const d = firstManageableDoc(qc.getQueriesData<unknown>({ queryKey: ['documents'] }).map(([, data]) => data))
    if (d) setEmailing(d)
  }, () => setEmailing(null))
  const removeDoc = useDeleteDocument()
  const removeFolder = useDeleteFolder()
  const removeMany = useDeleteDocuments()

  // Mở thẳng một tài liệu từ chip nguồn của K.AI: ?doc=<id>[&legacy=1]. Vẫn qua kiểm quyền — không đọc được (đã xoá,
  // bị thu quyền) thì báo rõ thay vì im lặng.
  const linkedId = params.get('doc')
  const linkedLegacy = params.get('legacy') === '1'
  const linkedPanel = params.get('panel') as DrawerTab | null
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
    p.delete('panel')
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
    move: d => setMoving([d]),
    moveMany: setMoving,
    rename: setRenaming,
    email: setEmailing,
    remove: setRemoving,
    removeMany: setRemovingMany,
    openFolder: f => go(TAB_OF[f.scope], { folder: f.id, unit: f.orgUnitId }),
    renameFolder: f => setFolderDialog({ kind: 'rename', folder: f }),
    deleteFolder: setRemovingFolder,
  }

  const onSearch = useCallback((q: string) => setParams(prev => {
    const p = new URLSearchParams(prev)
    if (q) {
      p.set('tab', 'search')
      p.set('q', q)
    } else if (p.get('tab') === 'search') {
      p.set('tab', 'home')
      p.delete('q')
    }
    for (const k of ['folder', 'view', 'unit']) p.delete(k)
    return p
  }, { replace: true }), [setParams])

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

  const driveKey = `${tab}:${params.get('unit') ?? ''}:${params.get('folder') ?? ''}`

  return (
    <DocumentActionsProvider value={actions}>
      <div className="mx-auto max-w-[1600px] space-y-4">
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

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside {...tourAnchor('docs.nav')} className="lg:sticky lg:top-4 lg:self-start">
            <DocumentsNav items={navItems} active={tab} onSelect={k => go(k)} pinned={pinned.data ?? []}
                          search={tab === 'search' ? searchQ : ''} onSearch={onSearch} />
          </aside>

          <main {...tourAnchor('docs.main')} className="min-w-0 space-y-4">
            {/* Lark: chỉ một tiêu đề to theo mục đang mở — không khối mô tả, không số liệu (số liệu ở "Dung lượng"). */}
            <header id="tour-documents-header" className="pt-1">
              <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">{t(`heading.${tab}`)}</h1>
              {scope && <p className="mt-1 text-caption">{t(`tabIntro.${tab}`)}</p>}
            </header>

            {(tab === 'home' || scope) && (
              <CreateCards
                menuOpen={newMenu}
                onMenuOpenChange={setNewMenu}
                canCreate={tab === 'home' ? canUpload : !!(driveAt?.canCreate && driveAt.ctx.scope === scope)}
                onNewDoc={kind => setNewDoc({ at: tab === 'home' || !driveAt ? 'pick' : driveAt.ctx, kind })}
                onUpload={() => setUpload(tab === 'home' || !driveAt ? 'pick' : driveAt.ctx)}
                onNewFolder={() => {
                  const ctx = tab === 'home' ? null : driveAt?.ctx
                  setFolderDialog(!ctx ? { kind: 'create', parent: null }
                    : ctx.folder ? { kind: 'create', parent: ctx.folder }
                      : { kind: 'create', parent: null, scope: ctx.scope, unitId: ctx.unitId })
                }}
              />
            )}

            {tab === 'home' && <HomeView layout={layout} onLayoutChange={changeLayout} />}
            {tab === 'search' && <SearchView key={searchQ} q={searchQ} layout={layout} onLayoutChange={changeLayout} />}
            {scope && (
              <DriveView
                key={driveKey}
                scope={scope}
                caps={caps}
                layout={layout}
                onLayoutChange={changeLayout}
                onContext={onDriveContext}
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
            {tab === 'storage' && (
              <>
                {/* Quản trị thấy bảng đầy đủ (gồm cả các số này); người khác thấy kho của mình + công ty + K.AI. */}
                {caps.canManageCompany ? <StorageView /> : usage && <UsageSummary usage={usage} personal={!!caps.canUploadPersonal} />}
              </>
            )}

            {tab === 'trash' && (
              <p className="flex items-start gap-1.5 text-caption">
                <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{t('notice.chatHistory')}</span>
              </p>
            )}
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
        {moving && <MoveDocumentDialog docs={moving} onClose={() => setMoving(null)} />}
        {renaming && <RenameDocumentDialog doc={renaming} onClose={() => setRenaming(null)} />}
        {drawerDoc && (
          <DocumentDrawer key={drawerDoc.id} doc={drawerDoc} caps={caps} onClose={closeDrawer}
                          initialTab={opened?.tab ?? (linkedPanel ?? undefined)} />
        )}
        {/* Sau drawer: mở từ tab Chia sẻ thì hộp soạn thư nằm trên drawer. */}
        {emailing && <SendDocumentEmailDialog key={emailing.id} doc={emailing} onClose={() => setEmailing(null)} />}

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
          open={!!removingMany}
          onClose={() => setRemovingMany(null)}
          onConfirm={() => removingMany && removeMany.mutate(removingMany.map(d => d.id), { onSuccess: () => setRemovingMany(null) })}
          title={t('delete.titleMany', { count: removingMany?.length ?? 0 })}
          description={t('delete.description', { days: usage?.trashRetentionDays ?? 30 })}
          confirmLabel={t('actions.delete')}
          loading={removeMany.isPending}
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

/** Tài liệu đầu tiên mình quản lý trong các danh sách đã tải (mảng, hoặc trang `{ content }`). */
function firstManageableDoc(lists: unknown[]): KbDocument | null {
  for (const data of lists) {
    const items = Array.isArray(data) ? data
      : data && typeof data === 'object' && Array.isArray((data as { content?: unknown }).content) ? (data as { content: unknown[] }).content
        : []
    for (const it of items) {
      const d = it as KbDocument
      if (d && typeof d === 'object' && typeof d.id === 'string' && d.canEdit && !d.legacy && 'fileName' in d) return d
    }
  }
  return null
}
