import { useParams, useNavigate, Link } from 'react-router-dom'
import i18n from 'i18next'
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
import { useTranslation } from 'react-i18next'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Chi tiết một bài nộp — trang ĐỌC là chính. Cột trái: kết quả (số liệu lớn) → giải trình →
 * minh chứng → phản hồi của quản lý; cột phải: ai nộp, ai duyệt, lúc nào, thuộc đợt nào.
 * Hành động duy nhất là "Sửa" khi còn là bản nháp — đặt ở header, cùng chỗ với mọi trang.
 */
export default function SubmissionDetailPage() {
  const { t } = useTranslation('submissions')
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
          title={t('SubmissionDetailPage.noSubmissionFound')}
          description={t('SubmissionDetailPage.thisSubmissionMayHaveBeenDeleted')}
          action={<Button variant="outline" onClick={() => navigate('/me?section=my-submissions')}><ArrowLeft aria-hidden="true" /> {t('SubmissionDetailPage.backToMyReports')}</Button>}
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
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label={t('SubmissionDetailPage.back')} className="shrink-0"><ArrowLeft aria-hidden="true" /></Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title truncate" title={submission.kpiCriteriaName}>{submission.kpiCriteriaName}</h1>
              <StatusBadge status={submission.status} />
      </div>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {submission.kpiPeriod?.name ?? t('SubmissionDetailPage.noPeriodLinked')}
              {submission.periodStart && submission.periodEnd && (
                <span className="tabular-nums"> · {formatDateTime(submission.periodStart).split(' ')[0]} – {formatDateTime(submission.periodEnd).split(' ')[0]}</span>
              )}
            </p>
          </div>
        </div>
        {submission.status === 'DRAFT' && (
          <Button asChild className="shrink-0">
            <Link to={`/submissions/edit/${submission.id}`}><Pencil aria-hidden="true" /> {t('SubmissionDetailPage.editDraft')}</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* Cột trái */}
        <div className="space-y-4 lg:col-span-8">
          {/* Kết quả */}
          <section aria-label={t('SubmissionDetailPage.result')} className="grid grid-cols-3 gap-px overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-border)]">
            {isQualitative ? (
              <>
                <Metric label={t('SubmissionDetailPage.evaluationLevel')} value={submission.qualitativeLevelName ?? t('SubmissionDetailPage.notScored')} />
                <Metric label={t('SubmissionDetailPage.weight')} value={`${submission.weight ?? 0}%`} />
                <Metric label={t('SubmissionDetailPage.conductScore')} value={submission.qualitativeLevelValue != null ? `${formatNumber(submission.qualitativeLevelValue)} / 5` : '—'} />
              </>
            ) : (
              <>
                <Metric label={t('SubmissionDetailPage.actual')} value={formatNumber(submission.actualValue)} unit={submission.unit} />
                <Metric label={t('SubmissionDetailPage.target')} value={submission.targetValue != null ? formatNumber(submission.targetValue) : '—'} unit={submission.unit} />
                <Metric label={t('SubmissionDetailPage.achievementRate')} value={achievement != null ? `${achievement}%` : '—'} className={achievementTone} />
              </>
            )}
          </section>

          {!isQualitative && submission.autoScore != null && (
            <section className="flex items-center justify-between gap-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
              <div>
                <h2 className="text-eyebrow">{t('SubmissionDetailPage.systemScore')}</h2>
                <p className="text-caption">{t('SubmissionDetailPage.computedAutomaticallyFromTheAchievementRate')}</p>
              </div>
              <p className="text-stat">{formatNumber(submission.autoScore)}</p>
            </section>
          )}

          {/* Giải trình */}
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="text-section-title">{t('SubmissionDetailPage.explanation')}</h2>
            {submission.note
              ? <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-[var(--color-foreground)]">{submission.note}</p>
              : <p className="mt-2 text-caption">{t('SubmissionDetailPage.noExplanationNotes')}</p>}
          </section>

          {/* Minh chứng */}
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-section-title">{t('SubmissionDetailPage.evidence')}</h2>
              <span className="text-caption tabular-nums">{attachments.length} {t('SubmissionDetailPage.files')}</span>
            </div>
            {attachments.length === 0 ? (
              <p className="mt-2 text-caption">{t('SubmissionDetailPage.noFilesAttached')}</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {attachments.map((file: any) => {
                  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.fileName)
                  return (
                    <li key={file.id} className="group overflow-hidden rounded-card border border-[var(--color-border)]">
                      <button className="block w-full text-left" type="button" onClick={() => setActiveAttachment(file)} aria-label={i18n.t('submissions:SubmissionDetailPage.viewFile', { name: file.fileName })}>
                        <div className="flex aspect-[4/3] items-center justify-center bg-[var(--color-muted)]">
                          {isImage
                            ? <img src={file.fileUrl} alt={file.fileName} className="h-full w-full object-cover" loading="lazy" />
                            : <FileIcon aria-hidden="true" strokeWidth={1.5} className="text-[var(--color-muted-foreground)]" />}
                        </div>
                      </button>
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        <p className="min-w-0 flex-1 truncate text-caption" title={file.fileName}>{file.fileName}</p>
                        <Button variant="ghost" size="icon-sm" onClick={() => setActiveAttachment(file)} aria-label="Xem" title="Xem"><Eye aria-hidden="true" /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => downloadFile(file.fileUrl, file.fileName)} aria-label={t('SubmissionDetailPage.download')} title={t('SubmissionDetailPage.download')}><Download aria-hidden="true" /></Button>
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
              <h2 className="text-section-title">{t('SubmissionDetailPage.managersResponse')}</h2>
              {submission.reviewNote
                ? <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-[var(--color-foreground)]">{submission.reviewNote}</p>
                : <p className="mt-2 text-caption">{submission.status === 'PENDING' ? t('SubmissionDetailPage.waitingForTheManagerToReview') : t('SubmissionDetailPage.noComments')}</p>}
            </section>
          )}
        </div>

        {/* Cột phải */}
        <aside className="space-y-4 lg:col-span-4">
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="text-eyebrow">{t('SubmissionDetailPage.submissionInformation')}</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Row label={t('SubmissionDetailPage.submittedBy')} value={submission.submittedByName} />
              <Row label={t('SubmissionDetailPage.submittedAt')} value={formatDateTime(submission.createdAt)} mono />
              {submission.reviewedByName && (
                <>
                  <Row label={t('SubmissionDetailPage.approver')} value={submission.reviewedByName} />
                  <Row label={t('SubmissionDetailPage.approvedAt')} value={formatDateTime(submission.reviewedAt || '')} mono />
                </>
              )}
              {submission.kpiPeriod && <Row label={t('SubmissionDetailPage.evaluationPeriods')} value={submission.kpiPeriod.name} />}
              {!isQualitative && <Row label={t('SubmissionDetailPage.weight')} value={`${submission.weight ?? 0}%`} mono />}
              <Row label={t('SubmissionDetailPage.type')} value={<Badge variant="outline">{isQualitative ? t('SubmissionDetailPage.qualitative') : t('SubmissionDetailPage.quantitative')}</Badge>} />
            </dl>
          </section>

          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="text-eyebrow">{t('SubmissionDetailPage.next')}</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Button asChild variant="outline"><Link to="/submissions/new"><Plus aria-hidden="true" /> {t('SubmissionDetailPage.submitAnotherReport')}</Link></Button>
              <Button asChild variant="ghost"><Link to="/me?section=my-kpi">{t('SubmissionDetailPage.viewMyKpis')}</Link></Button>
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
