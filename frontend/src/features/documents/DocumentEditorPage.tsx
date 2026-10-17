import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import './editor/blocknote.css'
import {
  AlertTriangle, ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, CloudOff, Copy, Download, Eye, FilePen, FileText,
  History, Info, Link2, Loader2, Mail, PenLine, Pin, PinOff, Printer, RotateCcw, Share2, Star, StarOff, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import RowMenu, { type RowMenuItem } from '@/components/common/RowMenu'
import UserAvatar from '@/components/common/UserAvatar'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { documentApi, documentFileUrl } from './api/documentApi'
import {
  useCopyDocument, useDeleteDocument, useDocument, useDocumentContent, useMarkOpened, useToggleFavorite, useTogglePin,
} from './hooks/useDocuments'
import { useConvertToOnline } from './hooks/useConvertToOnline'
import { copyAppLink, locationLabel } from './components/docMenu'
import SendDocumentEmailDialog from './components/SendDocumentEmailDialog'
import SharePanel from './components/SharePanel'
import { AiStatusIcon } from './components/docUi'
import DocOutline, { type OutlineItem } from './editor/DocOutline'
import { blockNoteDictionary, extractHeadings, parseBlocks, parseMarkdownToBlocks, saveTextFile, toHtmlDocument } from './editor/blocks'
import { useAutosave, type SaveStatus } from './editor/useAutosave'
import DocToolbar from './editor/DocToolbar'
import DocSideMenu from './editor/DocSideMenu'
import { docSchema } from './editor/schema'
import { uploadEditorImage } from './editor/uploadImage'
import { ZOOM_LEVELS } from '@/components/common/editor-toolbar/formatting'
import type { DocumentContent, KbDocument } from './types'
import type { IWorkbookData } from '@univerjs/presets'
import { documentPath, downloadUrl, editorPath, larkTime, saveBlob } from './utils'

// Trình bảng tính (Univer) rất nặng — chỉ tải khi mở đúng một bảng tính.
const SheetEditor = lazy(() => import('./editor/SheetEditor'))

/**
 * Trang soạn / đọc tài liệu trực tuyến kiểu Lark Docs: `/documents/:id/edit`, trình soạn khối BlockNote (gõ `/` để
 * chèn khối, kéo khối bằng tay nắm bên trái, bôi đen để định dạng, màu chữ/nền, bảng, khối gập…).
 *
 * - `.kgdoc` (tài liệu tạo trên web): lưu nguyên mảng khối JSON — giữ đủ định dạng.
 * - `.md`: mở bằng cùng trình soạn nhưng lưu lại Markdown, nên màu / căn lề không giữ được; có nút chuyển thành `.kgdoc`.
 * - `.txt`: soạn chữ thuần.
 *
 * Người chỉ có quyền xem thấy cùng trang ở chế độ đọc. Tự lưu (`useAutosave`), rời trang thì lưu nốt trước. Tệp khác
 * (.docx, .pdf…) không mở ở đây — quay về drawer của trang Tài liệu.
 */
export default function DocumentEditorPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const doc = useDocument(id, true)
  const content = useDocumentContent(id)
  // Tải lại bản mới nhất (sau xung đột) = gắn lại trình soạn với nội dung mới.
  const [generation, setGeneration] = useState(0)

  const notEditable = getApiErrorCode(content.error) === 'DOCUMENT_NOT_TEXT_EDITABLE'
  useEffect(() => {
    if (notEditable) navigate(`/documents?doc=${id}`, { replace: true })
  }, [notEditable, id, navigate])

  if (doc.isLoading || content.isLoading) {
    return <div className="mx-auto max-w-[1100px]"><LoadingSkeleton type="card" rows={8} /></div>
  }
  if (!doc.data || !content.data) {
    return (
      <div className="mx-auto max-w-[1100px] rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState icon={FileText} title={t('editor.notFoundTitle')} description={t('sources.notFound')}
                    action={<Button variant="outline" onClick={() => navigate('/documents')}>{t('editor.backToLibrary')}</Button>} />
      </div>
    )
  }

  const reload = async () => {
    await content.refetch()
    setGeneration(g => g + 1)
  }

  return <EditorShell key={`${id}:${generation}`} doc={doc.data} initial={content.data} onReload={reload} />
}

function EditorShell({ doc, initial, onReload }: { doc: KbDocument; initial: DocumentContent; onReload: () => Promise<void> }) {
  const { t, i18n } = useTranslation('documents')
  const navigate = useNavigate()
  const isDark = useThemeStore(s => s.isDark)
  // Sửa nội dung: người quản lý hoặc người được chia sẻ quyền chỉnh sửa. Đổi tên / chuyển định dạng vẫn chỉ người quản lý.
  // Ô "Chỉnh sửa ▾" như Lark cho người sửa được chuyển sang chế độ Đọc (ẩn thanh công cụ, khoá nội dung).
  const canWrite = doc.canEditContent
  const [mode, setMode] = useState<'edit' | 'read'>('edit')
  const format = initial.format
  const sheet = format === 'sheet'
  const rich = format === 'blocks' || format === 'markdown'
  // Bảng tính (Univer) chỉ khoá / mở khi gắn — không đổi chế độ tại chỗ được.
  const editable = canWrite && (sheet || mode === 'edit')

  // Bảng tính: Univer giữ dữ liệu, trang này chỉ giữ hàm đọc snapshot. Chưa gắn xong thì giữ nguyên nội dung đã mở.
  const sheetReader = useRef<(() => IWorkbookData | null) | null>(null)
  const initialSheet = useMemo(() => (sheet ? parseWorkbook(initial.content) : null), [sheet, initial.content])
  const readSheet = () => sheetReader.current?.() ?? initialSheet

  // Chữ thuần (.txt) giữ ở state; .kgdoc / .md nằm trong BlockNote.
  const [text, setText] = useState(initial.content)
  const textRef = useRef(text)

  const dictionary = useMemo(() => blockNoteDictionary(i18n.language), [i18n.language])
  const initialBlocks = useMemo(
    () => (format === 'blocks' ? parseBlocks(initial.content) : format === 'markdown' ? parseMarkdownToBlocks(initial.content) : undefined),
    [format, initial.content],
  )
  const editor = useCreateBlockNote({
    schema: docSchema,
    initialContent: initialBlocks,
    // Dán / kéo thả ảnh vào tài liệu là tự tải lên; người chỉ xem thì không có.
    uploadFile: canWrite ? uploadEditorImage : undefined,
    dictionary,
    tables: { splitCells: true, cellBackgroundColor: true, cellTextColor: true, headers: true },
  }, [])

  const autosave = useAutosave({
    docId: doc.id,
    initialHash: initial.contentHash,
    read: () => format === 'blocks' ? JSON.stringify(editor.document)
      : format === 'markdown' ? editor.blocksToMarkdownLossy(editor.document)
        : sheet ? (readSheet() ? JSON.stringify(readSheet()) : initial.content)
          : textRef.current,
  })
  const { flush, markChanged, hasUnsaved } = autosave

  // Ghi "mở gần nhất" (tab Gần đây) một lần.
  const markOpened = useMarkOpened()
  const marked = useRef(false)
  useEffect(() => {
    if (marked.current) return
    marked.current = true
    markOpened.mutate(doc.id)
  }, [doc.id, markOpened])

  // Rời trang trong ứng dụng khi còn chữ chưa lưu: lưu xong mới đi; lưu không được thì ở lại để người soạn quyết.
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    currentLocation.pathname !== nextLocation.pathname && hasUnsaved())
  const leaving = useRef(false)
  useEffect(() => {
    if (blocker.state !== 'blocked' || leaving.current) return
    leaving.current = true
    void flush().then(ok => {
      leaving.current = false
      if (ok) blocker.proceed()
      else {
        blocker.reset()
        toast.error(t('editor.leaveBlocked'))
      }
    })
  }, [blocker, flush, t])

  // Thu phóng (chỉ phần nội dung, như Google Docs), nhớ theo trình duyệt.
  const [zoom, setZoomState] = useState(readZoom)
  const setZoom = (z: number) => {
    setZoomState(z)
    try { localStorage.setItem(ZOOM_KEY, String(z)) } catch { /* trình duyệt chặn lưu — chỉ mất phần nhớ */ }
  }

  // In đúng nội dung tài liệu (không in thanh bên, nút bấm): dựng trang HTML riêng trong iframe ẩn rồi gọi in.
  const print = () => {
    const html = toHtmlDocument(doc.title, `<h1>${escapeHtml(doc.title)}</h1>${editor.blocksToHTMLLossy(editor.document)}`)
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(frame)
    const win = frame.contentWindow
    if (!win) { frame.remove(); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.onafterprint = () => frame.remove()
    setTimeout(() => { win.focus(); win.print(); setTimeout(() => frame.remove(), 60_000) }, 50)
  }
  const printRef = useRef(print)
  useEffect(() => { printRef.current = print })

  // Ctrl/⌘+S: lưu ngay thay vì để trình duyệt mở hộp "Lưu trang". Ctrl/⌘+P: in nội dung tài liệu thay vì cả trang web.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault()
        if (editable) void flush()
      }
      if ((e.ctrlKey || e.metaKey) && key === 'p' && rich) {
        e.preventDefault()
        printRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flush, editable, rich])

  const keepMine = async () => {
    try {
      const latest = await documentApi.content(doc.id)
      autosave.resolveConflict(latest.contentHash, true)
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('toast.saveFailed')))
    }
  }

  // Tệp .md: chuyển tại chỗ thành tài liệu trực tuyến để giữ đủ định dạng — tệp .md vào lịch sử phiên bản. Lưu nốt
  // trước để chuyển đúng bản đang thấy, rồi gắn lại trình soạn với định dạng mới.
  const qc = useQueryClient()
  const convert = useConvertToOnline()
  const upgrade = async () => {
    if (!(await flush())) return
    const latest = qc.getQueryData<KbDocument>(['documents', 'one', doc.id])
    convert.mutate(
      { doc, content: JSON.stringify(editor.document), baseHash: latest?.contentHash ?? doc.contentHash ?? undefined },
      { onSuccess: () => void onReload() },
    )
  }

  const [emailing, setEmailing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const favorite = useToggleFavorite()
  const pin = useTogglePin()
  const copy = useCopyDocument()
  const remove = useDeleteDocument()
  const labels = { today: t('time.today'), yesterday: t('time.yesterday') }

  // Mục lục cột trái (như Lark) dựng từ các khối tiêu đề, cập nhật sau khi ngừng gõ một nhịp.
  const [outline, setOutline] = useState<OutlineItem[]>(() => (rich ? extractHeadings(editor.document) : []))
  const outlineTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const refreshOutline = () => {
    clearTimeout(outlineTimer.current)
    outlineTimer.current = setTimeout(() => setOutline(extractHeadings(editor.document)), 400)
  }
  useEffect(() => () => clearTimeout(outlineTimer.current), [])
  const [outlineOpen, setOutlineOpenState] = useState(readOutlineOpen)
  const setOutlineOpen = (open: boolean) => {
    setOutlineOpenState(open)
    try { localStorage.setItem(OUTLINE_KEY, open ? '1' : '0') } catch { /* trình duyệt chặn lưu — chỉ mất phần nhớ */ }
  }

  // Tải về: tài liệu → Markdown / HTML, bảng tính → Excel / CSV, .md / .txt → tệp gốc.
  const exportKeys: ExportKey[] = format === 'blocks' ? ['md', 'html'] : sheet ? ['xlsx', 'csv'] : ['file']
  const runExport = (k: ExportKey) => {
    if (k === 'md') saveTextFile(`${doc.title}.md`, 'text/markdown', editor.blocksToMarkdownLossy(editor.document))
    else if (k === 'html') saveTextFile(`${doc.title}.html`, 'text/html', toHtmlDocument(doc.title, editor.blocksToHTMLLossy(editor.document)))
    else if (k === 'xlsx' || k === 'csv') void exportSheet(doc.title, readSheet(), k)
    else downloadUrl(documentFileUrl(doc.id))
  }

  // Menu ⋯ góc phải như Lark: ghim, yêu thích, link, bản sao — tải về, in — chi tiết, lịch sử — xoá.
  const moreItems: RowMenuItem[] = [
    { key: 'pin', icon: doc.pinned ? <PinOff /> : <Pin />, label: doc.pinned ? t('actions.unpin') : t('actions.pin'), onSelect: () => pin.mutate({ id: doc.id, value: !doc.pinned }) },
    { key: 'favorite', icon: doc.favorite ? <StarOff /> : <Star />, label: doc.favorite ? t('actions.unfavorite') : t('actions.favorite'), onSelect: () => favorite.mutate({ id: doc.id, value: !doc.favorite }) },
    { key: 'link', separated: true, icon: <Link2 />, label: t('actions.copyLink'), onSelect: () => copyAppLink(documentPath(doc), t('toast.linkCopied')) },
    ...(doc.canEdit ? [{ key: 'email', icon: <Mail />, label: t('actions.email'), onSelect: () => void flush().then(() => setEmailing(true)) }] : []),
    ...(format === 'blocks' || sheet ? [{
      key: 'copy', icon: <Copy />, label: t('actions.makeCopy'),
      onSelect: () => void flush().then(() => copy.mutate(doc, { onSuccess: created => navigate(editorPath(created.id)) })),
    }] : []),
    ...exportKeys.map((k, i) => ({ key: `export-${k}`, separated: i === 0, icon: <Download />, label: t(EXPORT_LABEL[k]), onSelect: () => runExport(k) })),
    ...(rich ? [{ key: 'print', icon: <Printer />, label: t('editor.print'), onSelect: print }] : []),
    { key: 'details', separated: true, icon: <Info />, label: t('editor.details'), onSelect: () => navigate(`/documents?doc=${doc.id}`) },
    ...(doc.canEdit ? [{ key: 'versions', icon: <History />, label: t('editor.versions'), onSelect: () => navigate(`/documents?doc=${doc.id}&panel=versions`) }] : []),
    ...(doc.canEdit ? [{ key: 'delete', separated: true, danger: true, icon: <Trash2 />, label: t('actions.delete'), onSelect: () => setDeleting(true) }] : []),
  ]
  const crumbs = locationLabel(doc, t).split(' › ')

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/documents')
  }

  return (
    <div className={cn('mx-auto space-y-3', sheet ? 'max-w-[1800px]' : rich ? 'max-w-[1360px]' : 'max-w-[1100px]')}>
      {/* Đầu trang như Lark: đường dẫn › tên + ghim, dòng trạng thái lưu; phải: Chia sẻ (xanh), Chỉnh sửa ▾, ⋯. */}
      <header className="flex flex-wrap items-start gap-2">
        <Button variant="ghost" size="icon-sm" onClick={goBack} aria-label={t('editor.back')} title={t('editor.back')}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <nav aria-label={t('drive.breadcrumb')} className="flex min-w-0 items-center gap-1 text-sm">
            {crumbs.map((c, idx) => (
              <Fragment key={idx}>
                <span className="max-w-[180px] shrink-0 truncate text-[var(--color-muted-foreground)]">{c}</span>
                <ChevronRight size={13} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
              </Fragment>
            ))}
            <span className="min-w-0 truncate font-medium text-[var(--color-foreground)]">{doc.title || t('editor.titlePlaceholder')}</span>
            <button type="button" onClick={() => pin.mutate({ id: doc.id, value: !doc.pinned })} aria-pressed={doc.pinned}
                    aria-label={doc.pinned ? t('actions.unpin') : t('actions.pin')} title={doc.pinned ? t('actions.unpin') : t('actions.pin')}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
              <Pin size={14} className={doc.pinned ? 'fill-[var(--color-success)] text-[var(--color-success)]' : undefined} aria-hidden="true" />
            </button>
          </nav>
          <div className="mt-0.5 flex items-center gap-2">
            {canWrite
              ? <SaveIndicator status={autosave.status} savedAt={autosave.savedAt} lastModified={larkTime(doc.updatedAt, labels)} onRetry={() => void flush()} />
              : <span className="flex items-center gap-1 text-caption"><Eye size={13} aria-hidden="true" /> {t('editor.readOnly')}</span>}
            <AiStatusIcon doc={doc} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {doc.canEdit && !doc.legacy && (
            <Button size="sm" onClick={() => setSharing(true)}><Share2 aria-hidden="true" /> {t('actions.share')}</Button>
          )}
          {canWrite && !sheet && <ModeMenu mode={mode} onChange={setMode} />}
          <RowMenu items={moreItems} label={t('actions.more')} />
        </div>
      </header>
      {emailing && <SendDocumentEmailDialog doc={doc} onClose={() => setEmailing(false)} />}
      {sharing && (
        <Drawer open onClose={() => setSharing(false)} size="lg" title={t('share.dialogTitle')} description={doc.title}>
          <SharePanel doc={doc} onEmail={() => { setSharing(false); void flush().then(() => setEmailing(true)) }} />
        </Drawer>
      )}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate(doc, { onSuccess: () => { setDeleting(false); navigate('/documents', { replace: true }) } })}
        title={t('delete.title', { title: doc.title })}
        description={t('delete.description', { days: 30 })}
        confirmLabel={t('actions.delete')}
        loading={remove.isPending}
      />

      {autosave.status === 'conflict' && (
        <div role="alert" className="flex flex-wrap items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[var(--color-foreground)]">{autosave.error || t('editor.conflict')}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void onReload()}>
              <RotateCcw aria-hidden="true" /> {t('editor.reloadLatest')}
            </Button>
            <Button size="sm" onClick={() => void keepMine()}>{t('editor.overwrite')}</Button>
          </div>
        </div>
      )}

      {format === 'markdown' && doc.canEdit && (
        <div role="note" className="flex flex-wrap items-center gap-2 rounded-card border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-2.5 text-sm">
          <Info size={16} className="shrink-0 text-[var(--color-info)]" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[var(--color-foreground)]">{t('editor.markdownNotice')}</p>
          <Button variant="outline" size="sm" onClick={() => void upgrade()} disabled={convert.isPending}>
            {convert.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FilePen aria-hidden="true" />}
            {t('actions.convertOnline')}
          </Button>
        </div>
      )}

      {/* Thanh công cụ cố định kiểu Google Docs — dính trên đầu khi cuộn. Tệp .md không lưu được màu / căn lề nên ẩn. */}
      {rich && editable && (
        <div className="sticky top-0 z-20 -mx-1 bg-[var(--color-background)] px-1 py-1">
          <DocToolbar editor={editor} features={{ rich: format === 'blocks', insert: true }}
                      zoom={zoom} onZoom={setZoom} onPrint={print} />
        </div>
      )}

      {sheet ? (
        <article className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <TitleField doc={doc} editable={doc.canEdit} compact />
          </div>
          <Suspense fallback={<div className="p-4"><LoadingSkeleton type="table" rows={10} /></div>}>
            <SheetEditor initial={initialSheet} editable={editable} dark={isDark} language={i18n.language}
                         onChange={markChanged} readerRef={sheetReader} />
          </Suspense>
        </article>
      ) : (
      // Khung tài liệu rộng bằng thanh công cụ, nội dung 900px luôn ở giữa; mục lục nằm nổi trong lề trái (không đẩy
      // nội dung lệch sang phải), và chỉ có khi tài liệu có tiêu đề — như Lark.
      <article className="@container relative rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        {rich && outline.length > 0 && (
          <aside className="absolute inset-y-0 left-0 w-[calc((100%-900px)/2)] min-w-12 pl-3 pt-10 @min-[1300px]:pl-6">
            <DocOutline title={doc.title} items={outline} open={outlineOpen} onOpenChange={setOutlineOpen} />
          </aside>
        )}
        <div className="mx-auto max-w-[900px] pb-24 pt-10" style={rich && zoom !== 100 ? { zoom: zoom / 100 } : undefined}>
          <div className="px-6 sm:px-[54px]">
            <TitleField doc={doc} editable={doc.canEdit} />
            {/* Như Lark: avatar + tên chủ sở hữu | ngày sửa, ngay dưới tiêu đề. */}
            <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <UserAvatar fullName={doc.createdByName ?? ''} className="h-5 w-5 rounded-full text-[9px]"
                          fallbackClassName="bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)]" />
              <span className="text-[var(--color-foreground)]">{doc.createdByName ?? '—'}</span>
              <span className="h-3.5 w-px bg-[var(--color-border)]" aria-hidden="true" />
              <span>{t('editor.modifiedAt', { time: larkTime(doc.updatedAt, labels) })}</span>
            </div>
          </div>
          {rich
            ? (
              <BlockNoteView
                editor={editor}
                editable={editable}
                theme={isDark ? 'dark' : 'light'}
                onChange={() => { markChanged(); refreshOutline() }}
                // Định dạng nằm trên thanh công cụ cố định; khung nổi khi bôi đen chỉ trùng lặp và che chữ.
                formattingToolbar={false}
                sideMenu={false}
                className="kg-doc-editor mt-4 min-h-[60vh]"
              >
                <SideMenuController sideMenu={DocSideMenu} />
              </BlockNoteView>
            )
            : (
              <div className="px-6 sm:px-[54px]">
                <textarea
                  value={text}
                  readOnly={!editable}
                  onChange={e => { textRef.current = e.target.value; setText(e.target.value); markChanged() }}
                  aria-label={t('editor.contentLabel')}
                  placeholder={editable ? t('editor.placeholder') : undefined}
                  spellCheck={false}
                  className="no-edit-hint mt-4 block min-h-[60vh] w-full resize-y bg-transparent font-mono text-sm leading-6 text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)]"
                />
              </div>
            )}
        </div>
      </article>
      )}
      {editable && <p className="text-caption">{t('editor.aiNote')}</p>}
    </div>
  )
}

const ZOOM_KEY = 'kg-doc-zoom'

function readZoom(): number {
  try {
    const z = Number(localStorage.getItem(ZOOM_KEY))
    return ZOOM_LEVELS.includes(z) ? z : 100
  } catch {
    return 100
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

/** Nội dung `.kgsheet` → snapshot; rỗng / hỏng → null (Univer tạo bảng tính trống). */
function parseWorkbook(json: string): IWorkbookData | null {
  try {
    const parsed: unknown = JSON.parse(json)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'sheets' in parsed ? (parsed as IWorkbookData) : null
  } catch {
    return null
  }
}

/** Xuất bảng tính ra .xlsx (giữ công thức, kiểu dáng) hoặc .csv (trang tính đầu, chỉ giá trị). */
async function exportSheet(title: string, wb: IWorkbookData | null, kind: 'xlsx' | 'csv') {
  if (!wb) return
  const conv = await import('./editor/sheetConvert')
  if (kind === 'xlsx') saveBlob(`${title}.xlsx`, await conv.workbookToXlsx(wb))
  else saveTextFile(`${title}.csv`, 'text/csv', conv.sheetToCsv(wb))
}

/** Ô "Chỉnh sửa ▾" như Lark: chuyển giữa soạn và đọc (đọc = khoá nội dung, ẩn thanh công cụ). */
function ModeMenu({ mode, onChange }: { mode: 'edit' | 'read'; onChange: (m: 'edit' | 'read') => void }) {
  const { t } = useTranslation('documents')
  const [open, setOpen] = useState(false)
  const Icon = mode === 'edit' ? PenLine : BookOpen
  const item = (m: 'edit' | 'read', I: typeof PenLine) => (
    <button type="button" role="menuitemradio" aria-checked={mode === m} onClick={() => { onChange(m); setOpen(false) }}
            className="flex w-full items-start gap-2.5 rounded-control px-2.5 py-2 text-left hover:bg-[var(--color-muted)]">
      <I size={16} className="mt-0.5 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-[var(--color-foreground)]">{t(`editor.mode.${m}`)}</span>
        <span className="block text-caption">{t(`editor.mode.${m}Hint`)}</span>
      </span>
      {mode === m && <Check size={15} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />}
    </button>
  )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-haspopup="menu" className="border-[var(--color-primary)] text-[var(--color-primary)]">
          <Icon aria-hidden="true" /> {t(`editor.mode.${mode}`)} <ChevronDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5" role="menu">
        {item('edit', PenLine)}
        {item('read', BookOpen)}
      </PopoverContent>
    </Popover>
  )
}

type ExportKey = 'md' | 'html' | 'xlsx' | 'csv' | 'file'
const EXPORT_LABEL = {
  md: 'editor.exportMarkdown', html: 'editor.exportHtml', xlsx: 'editor.exportXlsx', csv: 'editor.exportCsv', file: 'actions.download',
} as const

const OUTLINE_KEY = 'kg-doc-outline'

function readOutlineOpen(): boolean {
  try {
    return localStorage.getItem(OUTLINE_KEY) !== '0'
  } catch {
    return true
  }
}

/** Tiêu đề to như Lark: sửa tại chỗ, lưu khi rời ô hoặc Enter. */
function TitleField({ doc, editable, compact }: { doc: KbDocument; editable: boolean; compact?: boolean }) {
  const { t } = useTranslation('documents')
  const qc = useQueryClient()
  const [title, setTitle] = useState(doc.title)
  const rename = useMutation({
    mutationFn: (next: string) => documentApi.update(doc.id, { title: next }),
    onSuccess: saved => {
      qc.setQueryData(['documents', 'one', doc.id], saved)
      qc.invalidateQueries({ queryKey: ['documents'], refetchType: 'none' })
    },
    onError: e => {
      setTitle(doc.title)
      toast.error(getApiErrorMessage(e, t('toast.saveFailed')))
    },
  })
  const commit = () => {
    const next = title.trim()
    if (!next) { setTitle(doc.title); return }
    if (next !== doc.title) rename.mutate(next)
  }

  const size = compact ? 'text-xl' : 'text-4xl'
  if (!editable) return <h1 className={cn('break-words font-semibold leading-tight text-[var(--color-foreground)]', size)}>{doc.title}</h1>
  return (
    <input
      value={title}
      maxLength={255}
      onChange={e => setTitle(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      aria-label={t('fields.title')}
      placeholder={t('editor.titlePlaceholder')}
      className={cn('no-edit-hint w-full bg-transparent font-semibold leading-tight text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)]', size)}
    />
  )
}

function SaveIndicator({ status, savedAt, lastModified, onRetry }: { status: SaveStatus; savedAt: Date | null; lastModified: string; onRetry: () => void }) {
  const { t } = useTranslation('documents')
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-[var(--color-error)]" role="status">
        <CloudOff size={14} aria-hidden="true" /> {t('editor.status.error')}
        <Button variant="ghost" size="sm" onClick={onRetry}>{t('editor.retry')}</Button>
      </span>
    )
  }
  const label = status === 'saving' ? t('editor.status.saving')
    : status === 'dirty' ? t('editor.status.dirty')
      : status === 'conflict' ? t('editor.status.conflict')
        : status === 'saved' && savedAt ? t('editor.status.saved', { time: formatDateTime(savedAt) })
          : t('editor.lastModified', { time: lastModified })
  return (
    <span role="status" aria-live="polite" className={cn('flex items-center gap-1.5 text-caption', status === 'conflict' && 'text-[var(--color-warning)]')}>
      {status === 'saving' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        : status === 'saved' ? <Check size={13} aria-hidden="true" /> : null}
      {label}
    </span>
  )
}
