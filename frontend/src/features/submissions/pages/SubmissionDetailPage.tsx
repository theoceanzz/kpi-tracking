import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { submissionApi } from '../api/submissionApi'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import EmptyState from '@/components/common/EmptyState'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatNumber, downloadFile, cn } from '@/lib/utils'
import { ArrowLeft, Download, Eye, File as FileIcon, Pencil, Plus, FileText } from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Chi tiết một bài nộp — trang ĐỌC là chính. Cột trái: kết quả (số liệu lớn) → giải trình →
 * minh chứng → phản hồi của quản lý; cột phải: ai nộp, ai duyệt, lúc nào, thuộc đợt nào.
 * Hành động duy nhất là "Sửa" khi còn là bản nháp — đặt ở header, cùng chỗ với mọi trang.
 */
export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeAttachment, setActiveAttachment] = useState<any | null>(null)

  const { data: submission, isLoading } = useQuery({
    queryKey: ['submissions', id],
    queryFn: () => submissionApi.getById(id!),
    enabled: !!id,
  })

  if (isLoading) return <div className="mx-auto max-w-[1200px]"><LoadingSkeleton type="form" rows={6} /></div>
  
  if (!submission) {
  return (
      <div className="mx-auto max-w-[1200px] rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState
          icon={FileText}
          title="Không tìm thấy bài nộp"
          description="Bài nộp này có thể đã bị xoá hoặc bạn không có quyền xem."
          action={<Button variant="outline" onClick={() => navigate('/me?section=my-submissions')}><ArrowLeft aria-hidden="true" /> Về Báo cáo của tôi</Button>}
      />
    </div>
  )
}

  const isQualitative = submission.kpiType === 'QUALITATIVE'
  const achievement = submission.targetValue ? Math.round((submission.actualValue / submission.targetValue) * 100) : null
  const achievementTone = achievement == null ? 'text-[var(--color-foreground)]'
    : achievement >= 100 ? 'text-[var(--color-success)]' : achievement >= 70 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'
  const attachments: any[] = submission.attachments ?? []

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Quay lại" className="shrink-0"><ArrowLeft aria-hidden="true" /></Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title truncate" title={submission.kpiCriteriaName}>{submission.kpiCriteriaName}</h1>
              <StatusBadge status={submission.status} />
      </div>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {submission.kpiPeriod?.name ?? 'Chưa gắn đợt'}
              {submission.periodStart && submission.periodEnd && (
                <span className="tabular-nums"> · {formatDateTime(submission.periodStart).split(' ')[0]} – {formatDateTime(submission.periodEnd).split(' ')[0]}</span>
              )}
            </p>
          </div>
        </div>
        {submission.status === 'DRAFT' && (
          <Button asChild className="shrink-0">
            <Link to={`/submissions/edit/${submission.id}`}><Pencil aria-hidden="true" /> Sửa bản nháp</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* Cột trái */}
        <div className="space-y-4 lg:col-span-8">
          {/* Kết quả */}
          <section aria-label="Kết quả" className="grid grid-cols-3 gap-px overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-border)]">
            {isQualitative ? (
              <>
                <Metric label="Mức đánh giá" value={submission.qualitativeLevelName ?? 'Chưa chấm'} />
                <Metric label="Trọng số" value={`${submission.weight ?? 0}%`} />
                <Metric label="Điểm hành vi" value={submission.qualitativeLevelValue != null ? `${formatNumber(submission.qualitativeLevelValue)} / 5` : '—'} />
              </>
            ) : (
              <>
                <Metric label="Thực tế" value={formatNumber(submission.actualValue)} unit={submission.unit} />
                <Metric label="Mục tiêu" value={submission.targetValue != null ? formatNumber(submission.targetValue) : '—'} unit={submission.unit} />
                <Metric label="Tỷ lệ đạt" value={achievement != null ? `${achievement}%` : '—'} className={achievementTone} />
              </>
            )}
          </section>

          {!isQualitative && submission.autoScore != null && (
            <section className="flex items-center justify-between gap-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
              <div>
                <h2 className="text-eyebrow">Điểm hệ thống</h2>
                <p className="text-caption">Tính tự động từ tỷ lệ đạt và thang điểm của tổ chức. Quản lý có thể điều chỉnh khi chấm.</p>
              </div>
              <p className="text-stat">{formatNumber(submission.autoScore)}</p>
            </section>
          )}

          {/* Giải trình */}
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="text-section-title">Giải trình</h2>
            {submission.note
              ? <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-[var(--color-foreground)]">{submission.note}</p>
              : <p className="mt-2 text-caption">Không có ghi chú giải trình.</p>}
          </section>

          {/* Minh chứng */}
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-section-title">Minh chứng</h2>
              <span className="text-caption tabular-nums">{attachments.length} tệp</span>
            </div>
            {attachments.length === 0 ? (
              <p className="mt-2 text-caption">Không đính kèm tệp nào.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {attachments.map((file: any) => {
                  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.fileName)
                  return (
                    <li key={file.id} className="group overflow-hidden rounded-card border border-[var(--color-border)]">
                      <button className="block w-full text-left" type="button" onClick={() => setActiveAttachment(file)} aria-label={`Xem ${file.fileName}`}>
                        <div className="flex aspect-[4/3] items-center justify-center bg-[var(--color-muted)]">
                          {isImage
                            ? <img src={file.fileUrl} alt={file.fileName} className="h-full w-full object-cover" loading="lazy" />
                            : <FileIcon aria-hidden="true" strokeWidth={1.5} className="text-[var(--color-muted-foreground)]" />}
                        </div>
                      </button>
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        <p className="min-w-0 flex-1 truncate text-caption" title={file.fileName}>{file.fileName}</p>
                        <Button variant="ghost" size="icon-sm" onClick={() => setActiveAttachment(file)} aria-label="Xem" title="Xem"><Eye aria-hidden="true" /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => downloadFile(file.fileUrl, file.fileName)} aria-label="Tải xuống" title="Tải xuống"><Download aria-hidden="true" /></Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Phản hồi của quản lý */}
          {submission.status !== 'DRAFT' && (
            <section className={cn('rounded-card border p-4', submission.status === 'REJECTED' ? 'border-[var(--color-error-border)] bg-[var(--color-error-bg)]' : 'border-[var(--color-border)] bg-[var(--color-card)]')}>
              <h2 className="text-section-title">Phản hồi của quản lý</h2>
              {submission.reviewNote
                ? <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-[var(--color-foreground)]">{submission.reviewNote}</p>
                : <p className="mt-2 text-caption">{submission.status === 'PENDING' ? 'Đang chờ quản lý xem xét.' : 'Không có nhận xét.'}</p>}
            </section>
          )}
        </div>

        {/* Cột phải */}
        <aside className="space-y-4 lg:col-span-4">
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="text-eyebrow">Thông tin nộp</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Row label="Người nộp" value={submission.submittedByName} />
              <Row label="Thời gian nộp" value={formatDateTime(submission.createdAt)} mono />
              {submission.reviewedByName && (
                <>
                  <Row label="Người duyệt" value={submission.reviewedByName} />
                  <Row label="Thời gian duyệt" value={formatDateTime(submission.reviewedAt || '')} mono />
                </>
              )}
              {submission.kpiPeriod && <Row label="Đợt đánh giá" value={submission.kpiPeriod.name} />}
              {!isQualitative && <Row label="Trọng số" value={`${submission.weight ?? 0}%`} mono />}
              <Row label="Loại" value={<Badge variant="outline">{isQualitative ? 'Định tính' : 'Định lượng'}</Badge>} />
            </dl>
          </section>

          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="text-eyebrow">Tiếp theo</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Button asChild variant="outline"><Link to="/submissions/new"><Plus aria-hidden="true" /> Nộp báo cáo khác</Link></Button>
              <Button asChild variant="ghost"><Link to="/me?section=my-kpi">Xem KPI của tôi</Link></Button>
            </div>
          </section>
        </aside>
      </div>

      {activeAttachment && (
        <MediaPreviewModal
          url={activeAttachment.fileUrl}
          fileName={activeAttachment.fileName}
          contentType={activeAttachment.contentType}
          isOpen={!!activeAttachment}
          onClose={() => setActiveAttachment(null)}
        />
      )}
    </div>
  )
}

function Metric({ label, value, unit, className }: { label: string; value: string; unit?: string | null; className?: string }) {
  return (
    <div className="bg-[var(--color-card)] px-4 py-3">
      <p className="text-eyebrow">{label}</p>
      <p className={cn('mt-1 flex items-baseline gap-1 text-stat', className)}>
        {value}
        {unit && <span className="text-caption">{unit}</span>}
      </p>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={cn('min-w-0 text-right text-[var(--color-foreground)]', mono && 'tabular-nums')}>{value}</dd>
    </div>
  )
}
