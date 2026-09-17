import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getApiErrorMessage } from '@/lib/apiError'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { aiApi, type RagDocument } from '@/features/analytics/api/aiApi'

const QUERY_KEY = ['ai', 'rag-documents']

/**
 * Tài liệu mà trợ lý AI dùng để trả lời câu hỏi "làm sao / ở đâu / quy chế nói gì".
 *
 * <p>Hai loại nằm chung một danh sách vì người dùng hỏi thì thấy chung một câu trả lời:
 * <ul>
 *   <li>bộ hướng dẫn KeyGo — chung toàn hệ thống, chỉ quản trị hệ thống nạp/xoá;</li>
 *   <li>quy chế của tổ chức — mỗi tổ chức tự nạp; CHỈ người trong tổ chức đó được trợ lý trích dẫn.</li>
 * </ul>
 *
 * <p>Nạp là đồng bộ và mất vài giây (đọc mục, cất ảnh, tính vector tại chỗ); trạng thái READY /
 * FAILED hiện ngay sau khi xong, kèm lý do nếu hỏng.
 */
export default function AiDocumentsSettingsTab() {
  const { hasPermission } = useHasPermission()
  const canManageOrg = hasPermission('COMPANY:UPDATE')
  const isSystemAdmin = hasPermission('SYSTEM:ADMIN')
  const queryClient = useQueryClient()

  const { data: docs = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: aiApi.listRagDocuments })

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [source, setSource] = useState<RagDocument['source']>('REGULATION')
  const fileInput = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: () => aiApi.uploadRagDocument(file as File, source, title.trim() || undefined),
    onSuccess: doc => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      if (doc.status === 'READY') {
        toast.success(`Đã nạp "${doc.title}": ${doc.chunkCount} đoạn, ${doc.imageCount} ảnh`)
      } else {
        toast.error(`Nạp "${doc.title}" không thành công: ${doc.errorMessage ?? 'không rõ lý do'}`)
      }
      setFile(null)
      setTitle('')
      if (fileInput.current) fileInput.current.value = ''
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không nạp được tài liệu.')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => aiApi.deleteRagDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Đã xoá tài liệu khỏi kho tri thức')
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không xoá được tài liệu.')),
  })

  const canDelete = (d: RagDocument) => (d.organizationId === null ? isSystemAdmin : canManageOrg)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-section-title">Tài liệu trợ lý AI</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          Trợ lý dùng những tài liệu này để trả lời câu hỏi kiểu "làm sao để…", "ở đâu", "quy chế nói gì".
          Quy chế của tổ chức bạn chỉ người trong tổ chức mới được trợ lý trích dẫn.
        </p>
      </div>

      {canManageOrg && (
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
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
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
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="vd. Quy chế đánh giá 2026"
                className="rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm"
              />
            </label>
            {isSystemAdmin && (
              <label className="text-label flex flex-col gap-1">
                Loại
                <Select value={source} onValueChange={v => setSource(v as RagDocument['source'])}>
                  <SelectTrigger className="min-w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REGULATION">Quy chế của tổ chức</SelectItem>
                    <SelectItem value="GUIDE">Hướng dẫn KeyGo (toàn hệ thống)</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            )}
          </div>
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
          <p className="p-4 text-sm text-[var(--color-muted-foreground)]">
            Chưa có tài liệu nào. Trợ lý sẽ trả lời "chưa có tài liệu" cho mọi câu hỏi về cách dùng.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {docs.map(d => (
              <li key={d.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-foreground)]">
                    {d.source === 'GUIDE' ? <BookOpen className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{d.title}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--color-muted-foreground)]">
                    <span>{d.source === 'GUIDE' ? 'Hướng dẫn KeyGo · toàn hệ thống' : 'Quy chế của tổ chức'}</span>
                    <span>{d.chunkCount} đoạn</span>
                    <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" />{d.imageCount} ảnh</span>
                    <span>{new Date(d.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  {d.status === 'FAILED' && d.errorMessage && (
                    <p className="mt-1 text-xs text-[var(--color-error)]">{d.errorMessage}</p>
                  )}
                </div>
                {canDelete(d) && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="shrink-0 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Xoá "${d.title}" khỏi kho tri thức? Trợ lý sẽ không trích dẫn tài liệu này nữa.`)) {
                        remove.mutate(d.id)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
