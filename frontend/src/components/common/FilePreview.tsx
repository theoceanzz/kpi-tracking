import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, downloadFile } from '@/lib/utils'
import { previewKind, type PreviewKind } from '@/lib/filePreview'

/** Trần hiển thị bảng tính / văn bản — tệp lớn hơn vẫn tải về được, chỉ phần đầu được vẽ ra. */
const MAX_ROWS = 500
const MAX_COLS = 50
const MAX_TEXT_CHARS = 300_000

interface Props {
  /** Đường dẫn tệp: link backend (cookie xác thực đi kèm), link công khai, hoặc blob: của tệp trên máy. */
  url: string
  fileName: string
  contentType?: string | null
  /** Nền tối (khung xem toàn màn hình) hay nền thẻ (nhúng trong drawer). */
  tone?: 'dark' | 'card'
  className?: string
}

/** Cùng nguồn với trang → gửi cookie; khác nguồn (Cloudinary…) → không gửi, để CORS kiểu `*` vẫn nhận. */
function credentialsFor(url: string): RequestCredentials {
  try {
    return new URL(url, window.location.href).origin === window.location.origin ? 'include' : 'omit'
  } catch {
    return 'omit'
  }
}

/** Kết quả tải gắn với đúng url đã tải — đổi url thì kết quả cũ tự thành "đang tải", không cần đặt lại state. */
type Loaded = { url: string; blob: Blob | null }

/**
 * Xem trước một tệp ngay trong trình duyệt. Word (.docx) vẽ bằng `docx-preview`, bảng tính bằng SheetJS, văn bản
 * và Markdown đọc thẳng — đều nạp động để không làm nặng gói chính. Tệp không xem được thì hiện nút tải về.
 */
export default function FilePreview({ url, fileName, contentType, tone = 'dark', className }: Props) {
  const { t } = useTranslation('shared')
  const kind = previewKind(fileName, contentType)
  const needsBlob = kind === 'pdf' || kind === 'docx' || kind === 'sheet' || kind === 'text' || kind === 'markdown'
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!needsBlob) return
    let cancelled = false
    fetch(url, { credentials: credentialsFor(url) })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob() })
      .then(blob => { if (!cancelled) setLoaded({ url, blob }) })
      .catch(() => { if (!cancelled) setLoaded({ url, blob: null }) })
    return () => { cancelled = true }
  }, [url, needsBlob])
  const current = loaded?.url === url ? loaded : null

  const frame = cn('h-full w-full', className)

  if (kind === 'image') return <img src={url} alt={fileName} className={cn('max-h-full max-w-full object-contain', className)} />
  if (kind === 'video') return <video src={url} controls className={cn('max-h-full max-w-full', className)} />
  if (kind === 'audio') return <audio src={url} controls className={cn('w-full max-w-md', className)} />
  if (kind === null) return <Unsupported url={url} fileName={fileName} tone={tone} reason={t('FilePreview.unsupported')} />

  if (!current) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center gap-2 text-sm', tone === 'dark' ? 'text-white/70' : 'text-[var(--color-muted-foreground)]')}>
        <Loader2 className="animate-spin" size={18} aria-hidden="true" /> {t('FilePreview.loading')}
      </div>
    )
  }
  if (!current.blob) return <Unsupported url={url} fileName={fileName} tone={tone} reason={t('FilePreview.loadFailed')} />

  return (
    <div className={frame}>
      <Rendered kind={kind} blob={current.blob} fileName={fileName} url={url} tone={tone} />
    </div>
  )
}

function Rendered({ kind, blob, fileName, url, tone }: { kind: PreviewKind; blob: Blob; fileName: string; url: string; tone: 'dark' | 'card' }) {
  switch (kind) {
    case 'pdf': return <PdfView blob={blob} fileName={fileName} />
    case 'docx': return <DocxView blob={blob} fileName={fileName} url={url} tone={tone} />
    case 'sheet': return <SheetView blob={blob} fileName={fileName} url={url} tone={tone} />
    case 'markdown': return <TextView blob={blob} markdown />
    default: return <TextView blob={blob} markdown={false} />
  }
}

function PdfView({ blob, fileName }: { blob: Blob; fileName: string }) {
  // Ép đúng kiểu: backend trả octet-stream cho mọi tệp tải về, trình duyệt sẽ không hiện PDF nếu không ép.
  const src = useMemo(() => URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })), [blob])
  useEffect(() => () => URL.revokeObjectURL(src), [src])
  return <iframe src={src} title={fileName} className="h-full w-full rounded-control bg-white" />
}

function DocxView({ blob, fileName, url, tone }: { blob: Blob; fileName: string; url: string; tone: 'dark' | 'card' }) {
  const { t } = useTranslation('shared')
  const body = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    import('docx-preview')
      .then(({ renderAsync }) => {
        if (cancelled || !body.current) return
        body.current.innerHTML = ''
        return renderAsync(blob, body.current, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
          // Không chạy gì từ tệp: docx-preview chỉ dựng HTML tĩnh; ảnh nhúng thành data URL.
          useBase64URL: true,
        })
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [blob])
  if (failed) return <Unsupported url={url} fileName={fileName} tone={tone} reason={t('FilePreview.loadFailed')} />
  return <div ref={body} className="h-full w-full overflow-auto rounded-control bg-[#f3f4f6] text-black" />
}

interface Sheet { name: string; rows: string[][]; truncated: boolean }

function SheetView({ blob, fileName, url, tone }: { blob: Blob; fileName: string; url: string; tone: 'dark' | 'card' }) {
  const { t } = useTranslation('shared')
  const [sheets, setSheets] = useState<Sheet[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(0)
  useEffect(() => {
    let cancelled = false
    Promise.all([import('xlsx'), blob.arrayBuffer()])
      .then(([XLSX, buf]) => {
        const wb = XLSX.read(buf, { type: 'array', cellDates: true })
        const out: Sheet[] = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name]
          if (!ws) return { name, rows: [], truncated: false }
          const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '', raw: false })
          const rows = all.slice(0, MAX_ROWS).map(r => (r as unknown[]).slice(0, MAX_COLS).map(c => String(c ?? '')))
          return { name, rows, truncated: all.length > MAX_ROWS || all.some(r => (r as unknown[]).length > MAX_COLS) }
        })
        if (!cancelled) setSheets(out)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [blob])
  if (failed) return <Unsupported url={url} fileName={fileName} tone={tone} reason={t('FilePreview.loadFailed')} />
  if (!sheets) return null
  const sheet = sheets[active]
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-control bg-[var(--color-card)] text-[var(--color-foreground)]">
      {sheets.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--color-border)] p-1.5" role="tablist">
          {sheets.map((s, i) => (
            <button key={s.name} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}
                    className={cn('whitespace-nowrap rounded-control px-2.5 py-1 text-xs font-medium',
                      i === active ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]')}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {sheet && sheet.rows.length > 0 ? (
          <table className="min-w-max border-collapse text-xs">
            <tbody>
              {sheet.rows.map((r, i) => (
                <tr key={i} className={i === 0 ? 'bg-[var(--color-muted)] font-semibold' : undefined}>
                  {r.map((c, j) => (
                    <td key={j} className="max-w-[320px] truncate border border-[var(--color-border)] px-2 py-1" title={c}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-center text-caption">{t('FilePreview.emptySheet')}</p>
        )}
      </div>
      {sheet?.truncated && (
        <p className="shrink-0 border-t border-[var(--color-border)] px-3 py-1.5 text-caption">
          {t('FilePreview.truncated', { rows: MAX_ROWS, cols: MAX_COLS })}
        </p>
      )}
    </div>
  )
}

function TextView({ blob, markdown }: { blob: Blob; markdown: boolean }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    blob.text().then(s => { if (!cancelled) setText(s.length > MAX_TEXT_CHARS ? s.slice(0, MAX_TEXT_CHARS) + '\n…' : s) })
    return () => { cancelled = true }
  }, [blob])
  if (text === null) return null
  return (
    <div className="h-full w-full overflow-auto rounded-control bg-[var(--color-card)] p-6 text-[var(--color-foreground)]">
      {markdown ? (
        // Không bật HTML thô trong Markdown (mặc định của react-markdown) — tệp người dùng tải lên không chạy được gì.
        <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-slate-900 prose-pre:text-slate-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap break-words font-mono text-sm">{text}</pre>
      )}
    </div>
  )
}

function Unsupported({ url, fileName, tone, reason }: { url: string; fileName: string; tone: 'dark' | 'card'; reason: string }) {
  const { t } = useTranslation('shared')
  return (
    <div className={cn('mx-auto flex max-w-sm flex-col items-center rounded-card p-8 text-center',
      tone === 'dark' ? 'border border-white/10 bg-white/5 text-white' : 'border border-[var(--color-border)] text-[var(--color-foreground)]')}>
      <AlertTriangle size={32} className={tone === 'dark' ? 'mb-4 text-white/70' : 'mb-4 text-[var(--color-muted-foreground)]'} aria-hidden="true" />
      <p className="mb-4 text-sm">{reason}</p>
      <Button type="button" variant={tone === 'dark' ? 'secondary' : 'outline'} onClick={() => downloadFile(url, fileName)}>
        <Download aria-hidden="true" /> {t('FilePreview.download')}
      </Button>
    </div>
  )
}
