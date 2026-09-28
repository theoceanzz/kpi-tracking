import type { Submission } from '@/types/submission'
import StatusBadge from '@/components/common/StatusBadge'
import { formatDateTime } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface SubmissionCardProps { submission: Submission }

export default function SubmissionCard({ submission }: SubmissionCardProps) {
  const { t } = useTranslation('submissions')
  return (
    <Link
      to={`/submissions/${submission.id}`}
      className="block bg-[var(--color-card)] rounded-card border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)]/30 transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-section-title">{submission.kpiCriteriaName}</h3>
        <StatusBadge status={submission.status} />
      </div>
      <div className="text-xs text-[var(--color-muted-foreground)] space-y-1">
        <p>{t('SubmissionCard.submittedBy')} {submission.submittedByName}</p>
        <p>{t('SubmissionCard.value')} <span className="font-medium text-[var(--color-foreground)]">{submission.actualValue}</span>{submission.targetValue != null ? ` / ${submission.targetValue}` : ''}</p>
        <p>{t('SubmissionCard.submittedOn')} {formatDateTime(submission.createdAt)}</p>
      </div>
    </Link>
  )
}
