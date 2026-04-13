import type { Submission } from '@/types/submission'
import StatusBadge from '@/components/common/StatusBadge'
import { formatDateTime } from '@/lib/utils'
import { Link } from 'react-router-dom'

interface SubmissionCardProps { submission: Submission }

export default function SubmissionCard({ submission }: SubmissionCardProps) {
  return (
    <Link
      to={`/submissions/${submission.id}`}
      className="block bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-4 hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-sm">{submission.kpiCriteriaName}</h3>
        <StatusBadge status={submission.status} />
      </div>
      <div className="text-xs text-[var(--color-muted-foreground)] space-y-1">
        <p>Người nộp: {submission.submittedByName}</p>
        <p>Giá trị: <span className="font-medium text-[var(--color-foreground)]">{submission.actualValue}</span>{submission.targetValue != null ? ` / ${submission.targetValue}` : ''}</p>
        <p>Ngày nộp: {formatDateTime(submission.createdAt)}</p>
      </div>
    </Link>
  )
}
