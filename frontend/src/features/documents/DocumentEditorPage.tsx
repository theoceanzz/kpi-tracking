import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import './editor/blocknote.css'
import {
  AlertTriangle, ArrowLeft, Check, CloudOff, Download, Eye, FilePen, FileText, Info, Loader2, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { documentApi, documentFileUrl } from './api/documentApi'
import { useDocument, useDocumentContent, useMarkOpened } from './hooks/useDocuments'
import { useConvertToOnline } from './hooks/useConvertToOnline'
import { locationLabel } from './components/docMenu'
import { AiStatusBadge } from './components/docUi'
import { blockNoteDictionary, parseBlocks, parseMarkdownToBlocks, saveTextFile, toHtmlDocument } from './editor/blocks'
import { useAutosave, type SaveStatus } from './editor/useAutosave'
import type { DocumentContent, KbDocument } from './types'
import type { IWorkbookData } from '@univerjs/presets'
import { saveBlob } from './utils'

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
  const editable = doc.canEditContent
  const format = initial.format
  const sheet = format === 'sheet'
  const rich = format === 'blocks' || format === 'markdown'

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
    initialContent: initialBlocks,
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

  // Ctrl/⌘+S: lưu ngay thay vì để trình duyệt mở hộp "Lưu trang".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (editable) void flush()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flush, editable])

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

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/documents')
  }

  return (
    <div className={cn('mx-auto space-y-3', sheet ? 'max-w-[1800px]' : 'max-w-[1100px]')}>
      <header className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={goBack} aria-label={t('editor.back')} title={t('editor.back')}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-caption">{locationLabel(doc, t)}</p>
        </div>
        <AiStatusBadge status={doc.aiStatus} error={doc.aiError} />
        {editable
          ? <SaveIndicator status={autosave.status} savedAt={autosave.savedAt} onRetry={() => void flush()} />
          : <Badge variant="secondary"><Eye aria-hidden="true" className="size-3.5" /> {t('editor.readOnly')}</Badge>}
        {format === 'blocks' ? (
          <ExportMenu items={[
            { label: t('editor.exportMarkdown'), run: () => saveTextFile(`${doc.title}.md`, 'text/markdown', editor.blocksToMarkdownLossy(editor.document)) },
            { label: t('editor.exportHtml'), run: () => saveTextFile(`${doc.title}.html`, 'text/html', toHtmlDocument(doc.title, editor.blocksToHTMLLossy(editor.document))) },
          ]} />
        ) : sheet ? (
          <ExportMenu items={[
            { label: t('editor.exportXlsx'), run: () => exportSheet(doc.title, readSheet(), 'xlsx') },
            { label: t('editor.exportCsv'), run: () => exportSheet(doc.title, readSheet(), 'csv') },
          ]} />
        ) : (
            <Button asChild variant="ghost" size="icon-sm" aria-label={t('actions.download')} title={t('actions.download')}>
              <a href={documentFileUrl(doc.id)} download><Download aria-hidden="true" /></a>
            </Button>
          )}
        <Button variant="outline" size="sm" onClick={() => navigate(`/documents?doc=${doc.id}`)}>
          <Info aria-hidden="true" /> {t('editor.details')}
        </Button>
      </header>

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
      <article className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto max-w-[900px] pb-24 pt-10">
          <div className="px-6 sm:px-[54px]">
            <TitleField doc={doc} editable={doc.canEdit} />
          </div>
          {rich
            ? (
              <BlockNoteView
                editor={editor}
                editable={editable}
                theme={isDark ? 'dark' : 'light'}
                onChange={() => markChanged()}
                className="kg-doc-editor mt-4 min-h-[60vh]"
              />
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

/**
 * Tải về tài liệu / bảng tính soạn trực tuyến (tệp gốc là JSON nội bộ): tài liệu → Markdown / HTML (mở bằng Word),
 * bảng tính → Excel / CSV.
 */
function ExportMenu({ items }: { items: { label: string; run: () => void | Promise<void> }[] }) {
  const { t } = useTranslation('documents')
  const [open, setOpen] = useState(false)
  const item = 'flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] focus-visible:outline-none'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('actions.download')} title={t('actions.download')} aria-haspopup="menu">
          <Download aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5" role="menu">
        {items.map(it => (
          <button key={it.label} type="button" role="menuitem" className={item}
                  onClick={() => { setOpen(false); void it.run() }}>
            {it.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
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

  const size = compact ? 'text-xl' : 'text-3xl'
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

function SaveIndicator({ status, savedAt, onRetry }: { status: SaveStatus; savedAt: Date | null; onRetry: () => void }) {
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
          : t('editor.status.idle')
  return (
    <span role="status" aria-live="polite" className={cn('flex items-center gap-1.5 text-caption', status === 'conflict' && 'text-[var(--color-warning)]')}>
      {status === 'saving' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        : status === 'saved' ? <Check size={13} aria-hidden="true" /> : null}
      {label}
    </span>
  )
}
