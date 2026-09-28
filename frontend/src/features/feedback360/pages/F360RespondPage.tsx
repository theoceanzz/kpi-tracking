import { intlDateLocale } from '@/i18n/format'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, EyeOff, Info, Send, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import UserAvatar from '@/components/common/UserAvatar'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/apiError'
import { RELATIONSHIP_LABEL, type F360AnswerInput, type F360Form } from '../api/feedback360Api'
import { useF360Form, useF360FormMutations } from '../hooks/useFeedback360'
import { AssignmentStatusBadge } from '../components/F360Common'
import { fmtDate } from '../utils/f360Format'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'

type Answer = { score: number | null; na: boolean; comment: string }

/** Nhãn neo cho thang điểm — chỉ gắn ở hai đầu và điểm giữa để không rối. */
function anchorLabel(n: number, max: number) {
  if (n === 1) return i18n.t('feedback360:F360RespondPage.veryPoor')
  if (n === max) return i18n.t('feedback360:F360RespondPage.excellent')
  if (n === Math.ceil((max + 1) / 2)) return i18n.t('feedback360:F360RespondPage.meets')
  return ''
}

/** Heuristic đơn giản: nhận xét có số điện thoại/email thì nhắc người chấm tự sửa (§6.4). */
function looksIdentifying(text: string) {
  return /\b\d{9,11}\b/.test(text) || /\S+@\S+\.\S+/.test(text)
}

function anonymityNote(form: F360Form) {
  if (form.relationship === 'SELF') return i18n.t('feedback360:F360RespondPage.thisIsYourSelfAssessmentUsed')
  if (!form.anonymous) return i18n.t('feedback360:F360RespondPage.managersFormsShowTheirNameOn')
  const others = Math.max(1, form.anonymityThreshold - 1)
  let note = i18n.t('feedback360:F360RespondPage.youAreAssessingAs', { toLowerCase: RELATIONSHIP_LABEL()[form.relationship].toLowerCase() })
    + i18n.t('feedback360:F360RespondPage.yourScoreIsCombinedWithAt', { others })
    + i18n.t('feedback360:F360RespondPage.commentsAreShownWithoutNamesAnd')
  if (form.strictAnonymity) note += i18n.t('feedback360:F360RespondPage.afterTheCampaignClosesTheSystem')
  return note
}

export default function F360RespondPage() {
  const { t: tr } = useTranslation('feedback360')
  const { assignmentId = '' } = useParams()
  const navigate = useNavigate()
  const { data: form, isLoading, error } = useF360Form(assignmentId)
  const { saveDraft, submit, decline } = useF360FormMutations(assignmentId)

  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const dirty = useRef<Set<string>>(new Set())
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  // Nạp câu trả lời từ server MỘT lần cho mỗi phiếu — sau đó bản nháp trên máy là nguồn đúng.
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!form || loadedFor.current === form.assignmentId) return
    loadedFor.current = form.assignmentId
    const init: Record<string, Answer> = {}
    form.sections.forEach(s => s.questions.forEach(q => {
      init[q.id] = { score: q.score ?? null, na: !!q.na, comment: q.comment ?? '' }
    }))
    setAnswers(init)
  }, [form])

  const allQuestions = useMemo(() => form?.sections.flatMap(s => s.questions) ?? [], [form])
  const answeredCount = allQuestions.filter(q => {
    const a = answers[q.id]
    return q.questionType === 'RATING' ? a && (a.score != null || a.na) : !!a?.comment.trim()
  }).length
  const missingRequired = allQuestions.filter(q => {
    if (!q.required) return false
    const a = answers[q.id]
    return q.questionType === 'RATING' ? !a || (a.score == null && !a.na) : !a?.comment.trim()
  })

  const toInputs = (ids: Iterable<string>): F360AnswerInput[] =>
    [...ids].map(id => ({ questionId: id, score: answers[id]?.score ?? null, na: answers[id]?.na ?? false, comment: answers[id]?.comment ?? '' }))

  // Tự lưu nháp 1.5 giây sau lần sửa cuối.
  const editable = !!form?.editable
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!editable || dirty.current.size === 0) return
    const t = setTimeout(() => {
      const ids = [...dirty.current]
      dirty.current.clear()
      saveDraft.mutate(toInputs(ids), {
        onSuccess: () => setSavedAt(new Date()),
        onError: () => ids.forEach(id => dirty.current.add(id)),
      })
    }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, editable])

  const update = (id: string, patch: Partial<Answer>) => {
    setAnswers(prev => ({ ...prev, [id]: { ...(prev[id] ?? { score: null, na: false, comment: '' }), ...patch } }))
    dirty.current.add(id)
    setTick(t => t + 1)
  }

  if (isLoading) return <div className="mx-auto max-w-3xl p-4"><LoadingSkeleton rows={6} /></div>
  if (error || !form) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <EmptyState icon={UserX} title={tr('F360RespondPage.cannotOpenTheForm')} description={getApiErrorMessage(error, tr('F360RespondPage.theFormDoesNotExistOr'))}
          action={<Button asChild variant="outline"><Link to="/me?section=my-feedback360">{tr('F360RespondPage.backToFormList')}</Link></Button>} />
      </div>
    )
  }

  const pct = allQuestions.length ? Math.round((answeredCount / allQuestions.length) * 100) : 0
  const scale = Array.from({ length: form.scaleMax }, (_, i) => i + 1)

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-28">
      <Button asChild variant="ghost" size="sm"><Link to="/me?section=my-feedback360"><ArrowLeft /> {tr('F360RespondPage.myForms')}</Link></Button>

      <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <UserAvatar fullName={form.subjectName} avatarUrl={form.subjectAvatarUrl} className="h-12 w-12 rounded-full text-base" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-section-title">{form.relationship === 'SELF' ? tr('F360RespondPage.selfAssessment') : form.subjectName}</h1>
            <p className="truncate text-caption">{form.campaignName} · {form.subjectOrgUnitName ?? ''} {tr('F360RespondPage.due')} {fmtDate(form.dueAt)}</p>
          </div>
          <AssignmentStatusBadge status={form.status} />
        </div>
        <p className={cn('mt-3 flex items-start gap-2 rounded-control p-3 text-sm',
          form.anonymous ? 'bg-[var(--color-info-bg)] text-[var(--color-info)]' : 'bg-[var(--color-muted)]')}>
          {form.anonymous ? <EyeOff size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
          <span>{anonymityNote(form)}</span>
        </p>
      </div>

      {form.sections.map(section => (
        <section key={section.competencyKey ?? section.title} className="space-y-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:p-5">
          <h2 className="text-sm font-semibold">{section.title}</h2>
          {section.questions.map(q => {
            const a = answers[q.id] ?? { score: null, na: false, comment: '' }
            return (
              <div key={q.id} className="space-y-2 border-t border-[var(--color-border)] pt-3 first-of-type:border-t-0 first-of-type:pt-0">
                <p className="text-sm">
                  {q.text}{q.required && <span className="text-[var(--color-error)]"> *</span>}
                </p>
                {q.questionType === 'RATING' ? (
                  <div className="flex flex-wrap items-start gap-1.5" role="radiogroup" aria-label={q.text}>
                    {scale.map(n => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={a.score === n}
                        disabled={!editable}
                        onClick={() => update(q.id, { score: n, na: false })}
                        className={cn(
                          'flex min-h-11 min-w-11 flex-col items-center justify-center rounded-control border px-2 py-1 text-sm font-semibold transition-colors',
                          a.score === n
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                            : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]',
                          !editable && 'cursor-default',
                        )}
                      >
                        {n}
                        {anchorLabel(n, form.scaleMax) && <span className="text-[10px] font-normal leading-tight opacity-80">{anchorLabel(n, form.scaleMax)}</span>}
                      </button>
                    ))}
                    {q.allowNa && (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={a.na}
                        disabled={!editable}
                        onClick={() => update(q.id, { na: true, score: null })}
                        className={cn(
                          'min-h-11 rounded-control border px-3 text-xs transition-colors',
                          a.na ? 'border-[var(--color-foreground)] bg-[var(--color-muted)] font-semibold' : 'border-dashed border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]',
                        )}
                      >
                        {tr('F360RespondPage.cannotAssess')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Textarea
                      rows={3}
                      maxLength={2000}
                      disabled={!editable}
                      value={a.comment}
                      onChange={e => update(q.id, { comment: e.target.value })}
                      placeholder={tr('F360RespondPage.beSpecificAndBasedOnObserved')}
                    />
                    <div className="flex justify-between text-caption">
                      <span className="text-[var(--color-warning)]">
                        {looksIdentifying(a.comment) ? tr('F360RespondPage.theCommentSeemsToContainA') : ''}
                      </span>
                      <span>{a.comment.length}/2000</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}

      {/* Thanh dưới cố định: tiến độ + trạng thái lưu + nộp. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-card)]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <div className="min-w-[140px] flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
              <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-caption">
              {answeredCount}/{allQuestions.length} {tr('F360RespondPage.questions')}
              {editable && (saveDraft.isPending ? tr('F360RespondPage.saving') : savedAt ? tr('F360RespondPage.savedAt', { toLocaleTimeString: savedAt.toLocaleTimeString(intlDateLocale(), { hour: '2-digit', minute: '2-digit' }) }) : '')}
            </p>
          </div>
          {editable ? (
            <>
              {form.relationship !== 'SELF' && (
                <Button variant="ghost" size="sm" onClick={() => setDeclining(true)}>{tr('F360RespondPage.rejected')}</Button>
              )}
              <Button onClick={() => setConfirmSubmit(true)} disabled={missingRequired.length > 0 || submit.isPending}>
                <Send /> {tr('F360RespondPage.submitForm')}
              </Button>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-[var(--color-success)]">
              <CheckCircle2 size={16} /> {form.status === 'SUBMITTED' ? tr('F360RespondPage.submittedCannotBeEdited') : tr('F360RespondPage.theFormIsNoLongerOpen')}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={() => submit.mutate(toInputs(allQuestions.map(q => q.id)), {
          onSuccess: () => { setConfirmSubmit(false); navigate('/me?section=my-feedback360') },
        })}
        title={tr('F360RespondPage.submitTheEvaluationForm')}
        description={tr('F360RespondPage.youCannotEditItAfterSubmitting')}
        confirmLabel={tr('F360RespondPage.submitForm')}
        loading={submit.isPending}
      />

      {declining && (
        <Dialog open onClose={() => setDeclining(false)} size="sm" title={tr('F360RespondPage.declineToAssess')}
          description={tr('F360RespondPage.forExampleYouHaveNotWorked')}
          footer={<DialogFooter
            secondary={<Button variant="outline" onClick={() => setDeclining(false)}>{tr('F360RespondPage.cancel')}</Button>}
            primary={<Button disabled={!declineReason.trim() || decline.isPending}
              onClick={() => decline.mutate(declineReason.trim(), { onSuccess: () => navigate('/me?section=my-feedback360') })}>
              {tr('F360RespondPage.rejected')}
            </Button>}
          />}>
          <Textarea rows={3} value={declineReason} onChange={e => setDeclineReason(e.target.value)} />
        </Dialog>
      )}
    </div>
  )
}
