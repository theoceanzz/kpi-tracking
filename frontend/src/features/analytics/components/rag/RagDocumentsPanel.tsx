import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, FileText, Image as ImageIcon, Search, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getApiErrorMessage } from '@/lib/apiError'
import { RAG_SOURCE_LABELS, type RagChunk, type RagDocument, type RagSearchHit } from '@/features/analytics/api/aiApi'

/** Các lời gọi mà panel cần — tổ chức và nền tảng đưa vào hai bộ endpoint khác nhau. */
export interface RagDocumentsApi {
  list: () => Promise<RagDocument[]>
  upload: (file: File, title?: string, source?: RagDocument['source']) => Promise<RagDocument>
  remove: (id: string) => Promise<unknown>
  chunks: (id: string) => Promise<RagChunk[]>
  search: (q: string) => Promise<RagSearchHit[]>
}

interface Props {
  api: RagDocumentsApi
  /** Phân biệt cache của hai cửa (tổ chức / nền tảng) — cùng React Query client. */
  scope: 'org' | 'platform'
  canManage: boolean
  /** Có = người nạp chọn loại; không = loại cố định phía server (bộ hướng dẫn). */
  sourceOptions?: { value: RagDocument['source']; label: string; hint?: string }[]
  title: string
  description: ReactNode
  emptyText: string
  searchPlaceholder: string
}

/**
 * Kho tri thức của trợ lý — một panel cho hai cửa: tài liệu của tổ chức (Thiết lập công ty) và bộ
 * hướng dẫn KeyGo chung (Quản trị nền tảng). Cùng ba việc: nạp .docx, xem danh sách/xoá, và hai
 * cửa sổ nhìn vào kho vector — "Thử tìm" chạy đúng bộ truy hồi của trợ lý với một câu hỏi, "Xem
 * đoạn" liệt kê các đoạn của một tài liệu đúng như đang nằm trong kho. Không có hai cửa sổ đó thì
 * lỗi "trợ lý trả lời sai" chỉ đoán được, không nhìn được.
 *
 * <p>Nạp là đồng bộ và mất vài giây (đọc mục, cất ảnh, tính vector tại chỗ); trạng thái READY /
 * FAILED hiện ngay sau khi xong, kèm lý do nếu hỏng.
 */
export default function RagDocumentsPanel({ api, scope, canManage, sourceOptions, title, description, emptyText, searchPlaceholder }: Props) {
  const queryClient = useQueryClient()
  const listKey = ['ai', 'rag-documents', scope]
  const { data: docs = [], isLoading } = useQuery({ queryKey: listKey, queryFn: api.list })

  const [file, setFile] = useState<File | null>(null)
  const [docTitle, setDocTitle] = useState('')
  const [source, setSource] = useState<RagDocument['source'] | undefined>(sourceOptions?.[0]?.value)
  const [expanded, setExpanded] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: () => api.upload(file as File, docTitle.trim() || undefined, source),
    onSuccess: doc => {
      queryClient.invalidateQueries({ queryKey: listKey })
      if (doc.status === 'READY') {
        toast.success(`Đã nạp "${doc.title}": ${doc.chunkCount} đoạn, ${doc.imageCount} ảnh`)
      } else {
        toast.error(`Nạp "${doc.title}" không thành công: ${doc.errorMessage ?? 'không rõ lý do'}`)
      }
      setFile(null)
      setDocTitle('')
      if (fileInput.current) fileInput.current.value = ''
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không nạp được tài liệu.')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey })
      toast.success('Đã xoá tài liệu khỏi kho tri thức')
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không xoá được tài liệu.')),
  })

  const selectedHint = sourceOptions?.find(o => o.value === source)?.hint

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-section-title">{title}</h3>
        <div className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">{description}</div>
      </div>

      {canManage && <SearchBox scope={scope} search={api.search} placeholder={searchPlaceholder} />}

      {canManage && (
        <form
          className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          onSubmit={e => {
            e.preventDefault()
            if (!file) {
              toast.error('Bạn chưa chọn tệp .docx')
              return
            }
            upload.mutate()
          }}
        >
          <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <Upload className="h-4 w-4" />
            Nạp tài liệu mới
          </div>
          <div className={`grid gap-3 ${sourceOptions ? 'sm:grid-cols-[1fr_1fr_auto]' : 'sm:grid-cols-2'}`}>
            <label className="text-label flex flex-col gap-1">
              Tệp (.docx)
              <input
                ref={fileInput}
                type="file"
                accept=".docx"
                className="rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm file:mr-2 file:rounded-control file:border-0 file:bg-[var(--color-muted)] file:px-2 file:py-1 file:text-xs"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="text-label flex flex-col gap-1">
              Tên hiển thị (tuỳ chọn)
              <input
                type="text"
                value={docTitle}
                onChange={e => setDocTitle(e.target.value)}
                placeholder={sourceOptions ? 'vd. Quy chế đánh giá 2026' : 'vd. Hướng dẫn sử dụng KeyGo'}
                className="rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm"
              />
            </label>
            {sourceOptions && (
              <label className="text-label flex flex-col gap-1">
                Loại
                <Select value={source} onValueChange={v => setSource(v as RagDocument['source'])}>
                  <SelectTrigger className="min-w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
          </div>
          {selectedHint && <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">{selectedHint}</p>}
          <div className="mt-3 flex items-center gap-3">
            <Button type="submit" disabled={upload.isPending || !file}>
              {upload.isPending ? 'Đang nạp…' : 'Nạp vào kho tri thức'}
            </Button>
            {upload.isPending && (
              <span className="text-xs text-[var(--color-muted-foreground)]">
                Đang đọc mục, cất ảnh và tính vector — mất vài giây với tài liệu có ảnh.
              </span>
            )}
          </div>
        </form>
      )}

      <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        {isLoading ? (
          <p className="p-4 text-sm text-[var(--color-muted-foreground)]">Đang tải…</p>
        ) : docs.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-muted-foreground)]">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {docs.map(d => (
              <li key={d.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-foreground)]">
                      {d.source === 'GUIDE' ? <BookOpen className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                      <span className="truncate">{d.title}</span>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--color-muted-foreground)]">
                      <span>{RAG_SOURCE_LABELS[d.source] ?? d.source}</span>
                      <span>{d.chunkCount} đoạn</span>
                      <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" />{d.imageCount} ảnh</span>
                      <span>{new Date(d.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                    {d.status === 'FAILED' && d.errorMessage && (
                      <p className="mt-1 text-xs text-[var(--color-error)]">{d.errorMessage}</p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-2">
                      {d.status === 'READY' && (
                        <Button variant="outline" size="sm" type="button" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                          {expanded === d.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          Xem đoạn
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`Xoá "${d.title}" khỏi kho tri thức? Trợ lý sẽ không dùng tài liệu này nữa.`)) {
                            remove.mutate(d.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {expanded === d.id && <ChunkList scope={scope} docId={d.id} load={api.chunks} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * Chạy đúng bộ truy hồi của trợ lý (hybrid vector + full-text, cùng số kết quả, cùng bộ lọc tổ
 * chức). Điểm là RRF — chỉ có nghĩa để xếp hạng trong cùng một lần tìm — nên hiện thứ hạng, không
 * hiện phần trăm giả.
 */
function SearchBox({ scope, search, placeholder }: { scope: string; search: (q: string) => Promise<RagSearchHit[]>; placeholder: string }) {
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState('')
  const { data: hits, isFetching, isError } = useQuery({
    queryKey: ['ai', 'rag-search', scope, asked],
    queryFn: () => search(asked),
    enabled: asked.length > 0,
  })

  return (
    <form
      className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4"
      onSubmit={e => {
        e.preventDefault()
        setAsked(q.trim())
      }}
    >
      <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Search className="h-4 w-4" />
        Thử tìm trong kho tri thức
      </div>
      <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
        Gõ một câu hỏi như người dùng sẽ hỏi. Kết quả là những đoạn trợ lý sẽ nhận được cho câu đó — cùng bộ truy hồi,
        cùng giới hạn tổ chức.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm"
        />
        <Button type="submit" variant="outline" disabled={!q.trim() || isFetching}>
          {isFetching ? 'Đang tìm…' : 'Tìm'}
        </Button>
      </div>
      {isError && <p className="mt-2 text-xs text-[var(--color-error)]">Không tìm được — thử lại sau.</p>}
      {hits && asked && (
        <ol className="mt-3 space-y-2">
          {hits.length === 0 && (
            <li className="text-xs text-[var(--color-muted-foreground)]">Không có đoạn nào — trợ lý sẽ trả lời "chưa có tài liệu".</li>
          )}
          {hits.map((h, i) => (
            <HitRow key={`${h.docId}-${h.title}-${i}`} rank={i + 1} hit={h} />
          ))}
        </ol>
      )}
    </form>
  )
}

function HitRow({ rank, hit }: { rank: number; hit: RagSearchHit }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 text-left" onClick={() => setOpen(!open)}>
          <span className="mr-1.5 rounded-control bg-[var(--color-muted)] px-1.5 py-0.5 font-medium">#{rank}</span>
          {hit.parent && <span className="text-[var(--color-muted-foreground)]">{hit.parent} › </span>}
          <span className="font-medium text-[var(--color-foreground)]">{hit.title}</span>
          <span className="ml-1.5 text-[var(--color-muted-foreground)]">· {hit.docTitle}</span>
        </button>
        {hit.route && (
          <Link to={hit.route} className="inline-flex shrink-0 items-center gap-1 text-[var(--color-ai)] hover:underline">
            Mở trang <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <p className={`mt-1 whitespace-pre-wrap text-[var(--color-muted-foreground)] ${open ? '' : 'line-clamp-2'}`}>{hit.text}</p>
    </li>
  )
}

/** Các đoạn của một tài liệu, đúng như đang nằm trong kho vector (có [mục] chèn đầu, có ảnh kèm). */
function ChunkList({ scope, docId, load }: { scope: string; docId: string; load: (id: string) => Promise<RagChunk[]> }) {
  const { data: chunks, isLoading, isError } = useQuery({
    queryKey: ['ai', 'rag-chunks', scope, docId],
    queryFn: () => load(docId),
  })
  if (isLoading) return <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">Đang đọc kho vector…</p>
  if (isError || !chunks) return <p className="mt-3 text-xs text-[var(--color-error)]">Không đọc được các đoạn của tài liệu này.</p>
  return (
    <ol className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto rounded-control border border-[var(--color-border)] bg-[var(--color-background)] p-2">
      {chunks.map((c, i) => (
        <li key={c.id} className="rounded-control border border-[var(--color-border)] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[var(--color-muted-foreground)]">
            <span className="rounded-control bg-[var(--color-muted)] px-1.5 py-0.5 font-medium">Đoạn {i + 1}</span>
            <span>mục {c.order ?? '?'}{c.index != null && c.index > 0 ? ` · phần ${c.index + 1}` : ''}</span>
            {c.route && (
              <Link to={c.route} className="inline-flex items-center gap-1 text-[var(--color-ai)] hover:underline">
                {c.route} <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            {c.roles && <span>vai trò: {c.roles}</span>}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[var(--color-foreground)]">{c.text}</p>
          {c.images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.images.map((src, k) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" title={c.captions[k] ?? ''}>
                  <img src={src} alt={c.captions[k] ?? ''} className="h-20 rounded-control border border-[var(--color-border)] object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

function StatusBadge({ status }: { status: RagDocument['status'] }) {
  const cls =
    status === 'READY'
      ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
      : status === 'FAILED'
        ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
        : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
  const label = status === 'READY' ? 'Sẵn sàng' : status === 'FAILED' ? 'Lỗi' : 'Đang nạp'
  return <span className={`rounded-control px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>
}
