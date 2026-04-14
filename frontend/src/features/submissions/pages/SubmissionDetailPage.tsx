import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import AttachmentList from '../components/AttachmentList'
import { formatDateTime, formatNumber } from '@/lib/utils'

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: submission, isLoading } = useQuery({
    queryKey: ['submissions', id],
    queryFn: () => submissionApi.getById(id!),
    enabled: !!id,
  })

  if (isLoading) return <LoadingSkeleton type="form" rows={5} />
  if (!submission) return null

  return (
    <div>
      <PageHeader title={submission.kpiCriteriaName} />

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6 max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-muted-foreground)]">Trạng thái</span>
          <StatusBadge status={submission.status} />
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-[var(--color-muted-foreground)]">Giá trị thực tế</p><p className="font-medium">{formatNumber(submission.actualValue)}</p></div>
          <div><p className="text-xs text-[var(--color-muted-foreground)]">Mục tiêu</p><p className="font-medium">{submission.targetValue != null ? formatNumber(submission.targetValue) : '—'}</p></div>
          <div><p className="text-xs text-[var(--color-muted-foreground)]">Người nộp</p><p className="font-medium">{submission.submittedByName}</p></div>
          <div><p className="text-xs text-[var(--color-muted-foreground)]">Ngày nộp</p><p className="font-medium">{formatDateTime(submission.createdAt)}</p></div>
          {submission.reviewedByName && (
            <div><p className="text-xs text-[var(--color-muted-foreground)]">Người duyệt</p><p className="font-medium">{submission.reviewedByName}</p></div>
          )}
          {submission.reviewedAt && (
            <div><p className="text-xs text-[var(--color-muted-foreground)]">Ngày duyệt</p><p className="font-medium">{formatDateTime(submission.reviewedAt)}</p></div>
          )}
        </div>
        {submission.note && <div><p className="text-xs text-[var(--color-muted-foreground)] mb-1">Ghi chú</p><p className="text-sm">{submission.note}</p></div>}
        {submission.reviewNote && <div><p className="text-xs text-[var(--color-muted-foreground)] mb-1">Phản hồi</p><p className="text-sm">{submission.reviewNote}</p></div>}

        <div>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-2">Tệp đính kèm</p>
          <AttachmentList attachments={submission.attachments} />
        </div>
      </div>
    </div>
  )
}
