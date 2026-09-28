import { intlDateLocale } from '@/i18n/format'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, BellRing, CalendarClock, Check, FileBarChart, FileSpreadsheet, History, Lock, Megaphone, Pencil,
  Play, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, UserPlus, Users,
} from 'lucide-react'
import HeatmapCard from './HeatmapCard'
import CampaignQuestionsCard from './CampaignQuestionsCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogFooter, Drawer } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChoiceChip } from '@/components/ui/choice-chip'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import UserAvatar from '@/components/common/UserAvatar'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import {
  RELATIONSHIP_LABEL,
  type F360Campaign,
  type F360GenerateResult,
  type F360Relationship,
  type F360SubjectRow,
} from '../api/feedback360Api'
import {
  useF360Assignments, useF360Campaign, useF360CampaignMutations, useF360Events, useF360Subjects,
} from '../hooks/useFeedback360'
import CampaignFormDialog from './CampaignFormDialog'
import { AssignmentStatusBadge, CampaignStatusBadge, OrgUnitSelect, UserSearchPicker } from './F360Common'
import { fmtDate, fmtScore, fromLocalInput, type PickedUser } from '../utils/f360Format'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { useStateDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

type Confirm = 'launch' | 'start' | 'close' | 'release' | 'delete' | null

export default function CampaignDetail({ campaignId, onBack }: { campaignId: string; onBack: () => void }) {
  const { t } = useTranslation('feedback360')
  const { data: campaign, isLoading } = useF360Campaign(campaignId)
  const { data: subjects = [], isLoading: loadingSubjects } = useF360Subjects(campaignId)
  const m = useF360CampaignMutations()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [dueDialog, setDueDialog] = useState<'extend' | 'reopen' | null>(null)
  const [managing, setManaging] = useState<F360SubjectRow | null>(null)
  const [removing, setRemoving] = useState<F360SubjectRow | null>(null)
  const [generated, setGenerated] = useState<F360GenerateResult | null>(null)
  const [showEvents, setShowEvents] = useState(false)
  const [query, setQuery] = useState('')

  if (isLoading || !campaign) return <LoadingSkeleton rows={6} />

  const manage = campaign.canManage
  const status = campaign.status
  const editableList = manage && (status === 'DRAFT' || status === 'NOMINATING' || status === 'OPEN')
  const hasResults = status === 'CLOSED' || status === 'RELEASED'
  const pct = campaign.assignmentCount ? Math.round((campaign.submittedCount / campaign.assignmentCount) * 100) : 0

  const runConfirm = () => {
    const done = { onSuccess: () => setConfirm(null) }
    if (confirm === 'launch') m.launch.mutate(campaign.id, done)
    if (confirm === 'start') m.start.mutate(campaign.id, done)
    if (confirm === 'close') m.close.mutate(campaign.id, done)
    if (confirm === 'release') m.release.mutate(campaign.id, done)
    if (confirm === 'delete') m.remove.mutate(campaign.id, { onSuccess: () => { setConfirm(null); onBack() } })
  }

  // Một chiến dịch chỉ có MỘT việc cần làm tiếp theo ở mỗi thời điểm — đưa nó lên thành nút chính
  // duy nhất, các thao tác phụ đứng cạnh ở dạng viền. Trước đây mọi nút cùng hàng nên người dùng
  // phải tự đoán bước nào trước.
  const next = nextStep(campaign, subjects.length)
  const q = query.trim().toLowerCase()
  const visibleSubjects = q
    ? subjects.filter(s => s.fullName.toLowerCase().includes(q) || (s.orgUnitName ?? '').toLowerCase().includes(q))
    : subjects

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /> {t('CampaignDetail.allCampaigns')}</Button>

      <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex flex-wrap items-start gap-3 p-5 pb-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-section-title">{campaign.name}</h2>
              <CampaignStatusBadge status={status} />
            </div>
            {campaign.description && <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{campaign.description}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <MetaChip icon={<CalendarClock size={12} />}>
                {campaign.startAt ? `${fmtDate(campaign.startAt)} → ` : t('CampaignDetail.due')}{fmtDate(campaign.dueAt)}
              </MetaChip>
              {campaign.kpiCycleName && <MetaChip>{t('CampaignDetail.aCycle')} {campaign.kpiCycleName}</MetaChip>}
              <MetaChip>{campaign.templateName ?? t('CampaignDetail.noQuestionSetChosen')}</MetaChip>
              <MetaChip icon={<ShieldCheck size={12} />}>
                {t('CampaignDetail.anonymousFrom')} {campaign.anonymityThreshold} {t('CampaignDetail.people')}{campaign.strictAnonymity ? t('CampaignDetail.strict') : ''}
              </MetaChip>
              {campaign.scoringMode !== 'DEVELOPMENT_ONLY' && (
                <MetaChip tone="warning">
                  {t('CampaignDetail.countsTowardRating')}{campaign.scoringMode === 'BLEND_CONDUCT'
                    ? t('CampaignDetail.managerScore360', { value: campaign.blendConductPercent ?? 60, value2: 100 - (campaign.blendConductPercent ?? 60) })
                    : t('CampaignDetail.replacesTheConductScoreWhenNot')}
                </MetaChip>
              )}
            </div>
          </div>
          {manage && (
            <div className="flex gap-1">
              {(status === 'DRAFT' || status === 'NOMINATING' || status === 'OPEN') && (
                <Button variant="ghost" size="icon-sm" aria-label={t('CampaignDetail.editCampaign')} title={t('CampaignDetail.editCampaign')} onClick={() => setEditing(true)}><Pencil /></Button>
              )}
              <Button variant="ghost" size="icon-sm" aria-label={t('CampaignDetail.log')} title={t('CampaignDetail.log')} onClick={() => setShowEvents(true)}><History /></Button>
              {status === 'DRAFT' && (
                <Button variant="ghost" size="icon-sm" aria-label={t('CampaignDetail.deleteCampaign')} title={t('CampaignDetail.deleteCampaign')} onClick={() => setConfirm('delete')}><Trash2 /></Button>
              )}
            </div>
          )}
        </div>

        <StepTracker campaign={campaign} />

        {manage && next && (
          <div className="mx-5 mb-4 flex flex-wrap items-center gap-3 rounded-control border border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] px-4 py-3">
            <div className="min-w-[200px] flex-1">
              <p className="text-sm font-semibold text-[var(--color-foreground)]">{next.title}</p>
              <p className="text-caption">{next.hint}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {status === 'OPEN' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => m.remind.mutate(campaign.id)} disabled={m.remind.isPending}><BellRing /> {t('CampaignDetail.remindThoseWhoHaveNotSubmitted')}</Button>
                  <Button variant="outline" size="sm" onClick={() => setDueDialog('extend')}><CalendarClock /> {t('CampaignDetail.extend')}</Button>
                </>
              )}
              {status === 'CLOSED' && (
                <Button variant="outline" size="sm" onClick={() => setDueDialog('reopen')}><RotateCcw /> {t('CampaignDetail.reopen')}</Button>
              )}
              {hasResults && (
                <Button variant="outline" size="sm" onClick={() => m.exportExcel.mutate(campaign.id)} disabled={m.exportExcel.isPending}>
                  <FileSpreadsheet /> {t('CampaignDetail.exportExcel')}
                </Button>
              )}
              {next.action === 'add' && <Button size="sm" onClick={() => setAdding(true)}><UserPlus /> {t('CampaignDetail.addReviewees')}</Button>}
              {next.action === 'generate' && (
                <Button size="sm" disabled={m.generateRaters.isPending}
                  onClick={() => m.generateRaters.mutate({ id: campaign.id, reset: false }, { onSuccess: setGenerated })}>
                  <Sparkles /> {t('CampaignDetail.generateRaters')}
                </Button>
              )}
              {next.action === 'launch' && <Button size="sm" onClick={() => setConfirm('launch')}><Play /> {t('CampaignDetail.start')}</Button>}
              {next.action === 'start' && <Button size="sm" onClick={() => setConfirm('start')}><Play /> {t('CampaignDetail.startScoring')}</Button>}
              {next.action === 'close' && <Button size="sm" onClick={() => setConfirm('close')}><Lock /> {t('CampaignDetail.closeComputeResults')}</Button>}
              {next.action === 'release' && <Button size="sm" onClick={() => setConfirm('release')}><Megaphone /> {t('CampaignDetail.publishReport')}</Button>}
            </div>
          </div>
        )}

        {status !== 'DRAFT' && (
          <div className="grid grid-cols-2 gap-px overflow-hidden border-t border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-4">
            <Stat label={t('CampaignDetail.reviewee')} value={campaign.subjectCount} />
            <Stat label={t('CampaignDetail.forms')} value={campaign.assignmentCount} />
            <Stat label={t('CampaignDetail.submitted')} value={<>{campaign.submittedCount} <span className="text-caption">({pct}%)</span></>} progress={pct} />
            <Stat label={status === 'RELEASED' ? t('CampaignDetail.publish') : t('CampaignDetail.start')} value={fmtDate(status === 'RELEASED' ? campaign.releasedAt : campaign.launchedAt)} />
          </div>
        )}
      </section>

      {generated && (
        <div className="rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">
              {t('CampaignDetail.created')} {generated.assignmentsCreated} {t('CampaignDetail.formsFor')} {generated.subjectsProcessed} {t('CampaignDetail.people')}
              {generated.warnings.length > 0 ? t('CampaignDetail.warningsToReviewBeforeStarting', { count: generated.warnings.length }) : '.'}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setGenerated(null)}>{t('CampaignDetail.hide')}</Button>
          </div>
          {generated.warnings.length > 0 && (
            <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-caption">
              {generated.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      <CampaignQuestionsCard campaign={campaign} onEdit={campaign.canManage ? () => setEditing(true) : undefined} />

      {hasResults && <HeatmapCard campaignId={campaign.id} />}

      <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-sm font-semibold">{t('CampaignDetail.reviewee')} <span className="font-normal text-[var(--color-muted-foreground)]">({subjects.length})</span></h3>
          <div className="min-w-[180px] flex-1">
            {subjects.length > 8 && (
              <Input size="sm" type="search" value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t('CampaignDetail.searchByNameOrUnit')} prefix={<Search size={14} />} className="max-w-xs" />
            )}
          </div>
          {manage && status === 'DRAFT' && campaign.assignmentCount > 0 && (
            <Button variant="ghost" size="sm" disabled={m.generateRaters.isPending} title={t('CampaignDetail.deleteAutoGeneratedRatersAndRegenerate')}
              onClick={() => m.generateRaters.mutate({ id: campaign.id, reset: true }, { onSuccess: setGenerated })}>
              <RotateCcw /> {t('CampaignDetail.regenerateRaters')}
            </Button>
          )}
          {editableList && subjects.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}><UserPlus /> {t('CampaignDetail.addPeople')}</Button>
          )}
        </div>

        {loadingSubjects && <div className="p-4"><LoadingSkeleton rows={4} /></div>}
        {!loadingSubjects && subjects.length === 0 && (
          <EmptyState icon={Users} title={t('CampaignDetail.noRevieweesYet')}
            description={manage ? t('CampaignDetail.addByUnitOrOneBy') : t('CampaignDetail.noOneInYourScope')} />
        )}
        {subjects.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-caption">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-4 py-2 font-medium">{t('CampaignDetail.people2')}</th>
                  <th className="px-4 py-2 font-medium">{t('CampaignDetail.progressByGroup')}</th>
                  <th className="px-4 py-2 font-medium">{t('CampaignDetail.n360Score')}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleSubjects.map(s => (
                  <tr key={s.id} className="border-b border-[var(--color-border)] last:border-b-0 align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar fullName={s.fullName} avatarUrl={s.avatarUrl} className="h-8 w-8 rounded-full text-xs" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{s.fullName}</p>
                          <p className="truncate text-caption">{s.orgUnitName ?? '-'}</p>
                        </div>
                      </div>
                      {s.warnings.length > 0 && (
                        <p className="mt-1.5 flex items-start gap-1 text-xs text-[var(--color-warning)]">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {s.warnings.join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {s.progress.map(p => (
                          <Badge key={p.relationship} variant={p.submitted === p.total ? 'success' : 'secondary'}>
                            {RELATIONSHIP_LABEL()[p.relationship]} {p.submitted}/{p.total}
                          </Badge>
                        ))}
                        {s.progress.length === 0 && <span className="text-caption">{t('CampaignDetail.noRatersYet')}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.overallScore != null ? (
                        <span className="font-semibold">{fmtScore(s.overallScore)}<span className="text-caption">/{campaign.scaleMax}</span></span>
                      ) : s.status === 'INSUFFICIENT' ? (
                        <Badge variant="warning">{t('CampaignDetail.missingResponses')}</Badge>
                      ) : <span className="text-caption">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {(status === 'CLOSED' || status === 'RELEASED') && (
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/feedback360/reports/${s.id}`}><FileBarChart /> {t('CampaignDetail.reports')}</Link>
                          </Button>
                        )}
                        {manage && (
                          <Button size="sm" variant="ghost" onClick={() => setManaging(s)}>{t('CampaignDetail.scorer')}</Button>
                        )}
                        {editableList && (
                          <Button size="icon-sm" variant="ghost" aria-label={t('CampaignDetail.remove', { fullName: s.fullName })} onClick={() => setRemoving(s)}><Trash2 /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <CampaignFormDialog
          campaign={campaign}
          saving={m.update.isPending}
          onClose={() => setEditing(false)}
          onSubmit={body => m.update.mutate({ id: campaign.id, body }, { onSuccess: () => setEditing(false) })}
        />
      )}
      {adding && <AddSubjectsDialog campaign={campaign} onClose={() => setAdding(false)} />}
      {dueDialog && <DueDialog campaign={campaign} mode={dueDialog} onClose={() => setDueDialog(null)} />}
      {managing && <AssignmentsDrawer campaign={campaign} subject={managing} onClose={() => setManaging(null)} />}
      {showEvents && <EventsDrawer campaignId={campaign.id} onClose={() => setShowEvents(false)} />}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && m.removeSubject.mutate({ id: campaign.id, subjectId: removing.id }, { onSuccess: () => setRemoving(null) })}
        title={t('CampaignDetail.removeTheReviewee')}
        description={t('CampaignDetail.willBeRemovedFromTheCampaign', { fullName: removing?.fullName })}
        confirmLabel={t('CampaignDetail.remove2')}
        loading={m.removeSubject.isPending}
      />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        title={CONFIRM_TEXT()[confirm ?? 'launch'].title}
        description={CONFIRM_TEXT()[confirm ?? 'launch'].body}
        confirmLabel={CONFIRM_TEXT()[confirm ?? 'launch'].label}
        loading={m.launch.isPending || m.start.isPending || m.close.isPending || m.release.isPending || m.remove.isPending}
      />
    </div>
  )
}

const CONFIRM_TEXT = perLanguage(() => ({
  launch: { title: i18n.t('feedback360:CampaignDetail.startTheCampaign'), label: i18n.t('feedback360:CampaignDetail.start'), body: i18n.t('feedback360:CampaignDetail.theQuestionSetIsSnapshottedIf') },
  start: { title: i18n.t('feedback360:CampaignDetail.endNominationsAndStartScoring'), label: i18n.t('feedback360:CampaignDetail.startScoring'), body: i18n.t('feedback360:CampaignDetail.anyoneWhoseNominationsAreNotApproved') },
  close: { title: i18n.t('feedback360:CampaignDetail.closeTheCampaign'), label: i18n.t('feedback360:CampaignDetail.closeComputeResults'), body: i18n.t('feedback360:CampaignDetail.unsubmittedFormsWillExpireTheSystem') },
  release: { title: i18n.t('feedback360:CampaignDetail.publishTheReports'), label: i18n.t('feedback360:CampaignDetail.publish'), body: i18n.t('feedback360:CampaignDetail.revieweesWillBeNotifiedAndCan') },
  delete: { title: i18n.t('feedback360:CampaignDetail.deleteTheDraftCampaign'), label: i18n.t('feedback360:CampaignDetail.delete'), body: i18n.t('feedback360:CampaignDetail.theCampaignAndTheGeneratedRater') },
} as const))

function Stat({ label, value, progress }: { label: string; value: React.ReactNode; progress?: number }) {
  const { t } = useTranslation('feedback360')
  return (
    <div className="bg-[var(--color-card)] px-5 py-3">
      <p className="text-caption">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      {progress != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]" role="progressbar"
          aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t('CampaignDetail.formsSubmittedRate')}>
          <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

function MetaChip({ icon, tone, children }: { icon?: React.ReactNode; tone?: 'warning'; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${tone === 'warning'
      ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
      : 'border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}>
      {icon}{children}
    </span>
  )
}

type NextAction = 'add' | 'generate' | 'launch' | 'start' | 'close' | 'release' | null

/** Việc cần làm tiếp theo của một chiến dịch, cho khung "Bước tiếp theo". */
function nextStep(c: F360Campaign, subjectCount: number): { title: string; hint: string; action: NextAction } | null {
  switch (c.status) {
    case 'DRAFT':
      if (subjectCount === 0) return { title: i18n.t('feedback360:CampaignDetail.addReviewees'), hint: i18n.t('feedback360:CampaignDetail.chooseByUnitIncludingChildUnits'), action: 'add' }
      if (c.assignmentCount === 0) return { title: i18n.t('feedback360:CampaignDetail.generateRaters'), hint: i18n.t('feedback360:CampaignDetail.theSystemSuggestsManagersPeersAnd'), action: 'generate' }
      return {
        title: c.startAt && new Date(c.startAt).getTime() > Date.now()
          ? i18n.t('feedback360:CampaignDetail.readyStartsAutomaticallyOn', { startAt: fmtDate(c.startAt) })
          : i18n.t('feedback360:CampaignDetail.readyToStart'),
        hint: (c.allowNomination
          ? i18n.t('feedback360:CampaignDetail.startingOpensTheNominationPhaseEach')
          : i18n.t('feedback360:CampaignDetail.startingSnapshotsTheQuestionSetAnd'))
          + (c.startAt && new Date(c.startAt).getTime() > Date.now() ? i18n.t('feedback360:CampaignDetail.toOpenEarlyClickStartNow') : ''),
        action: 'launch',
      }
    case 'NOMINATING':
      return {
        title: i18n.t('feedback360:CampaignDetail.nominatingRaters'),
        hint: i18n.t('feedback360:CampaignDetail.startScoringOnceNominationsAreComplete', { value: c.nominationDeadline ? i18n.t('feedback360:CampaignDetail.nominationDeadline', { nominationDeadline: fmtDate(c.nominationDeadline) }) : '' }),
        action: 'start',
      }
    case 'OPEN':
      return { title: i18n.t('feedback360:CampaignDetail.collectingForms'), hint: i18n.t('feedback360:CampaignDetail.dueCloseOnceEnoughFormsAre', { dueAt: fmtDate(c.dueAt) }), action: 'close' }
    case 'CLOSED':
      return { title: i18n.t('feedback360:CampaignDetail.resultsComputed'), hint: i18n.t('feedback360:CampaignDetail.reviewEachPersonsReportBelowThen'), action: 'release' }
    case 'RELEASED':
      return { title: i18n.t('feedback360:CampaignDetail.publishedOn', { releasedAt: fmtDate(c.releasedAt) }), hint: i18n.t('feedback360:CampaignDetail.employeesCanNowSeeTheirOwn'), action: null }
    default:
      return null
  }
}

/** Các bước của chiến dịch; bước đề cử chỉ có khi chiến dịch bật đề cử. */
function StepTracker({ campaign }: { campaign: F360Campaign }) {
  const { t } = useTranslation('feedback360')
  const steps: { key: F360Campaign['status']; label: string }[] = [
    { key: 'DRAFT', label: t('CampaignDetail.preparation') },
    ...(campaign.allowNomination ? [{ key: 'NOMINATING' as const, label: t('CampaignDetail.nomination') }] : []),
    { key: 'OPEN', label: t('CampaignDetail.collectingForms2') },
    { key: 'CLOSED', label: t('CampaignDetail.summary') },
    { key: 'RELEASED', label: t('CampaignDetail.publish') },
  ]
  const current = steps.findIndex(s => s.key === campaign.status)
  return (
    <ol className="flex items-center gap-2 overflow-x-auto px-5 pb-4" aria-label={t('CampaignDetail.campaignSteps')}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s.key} className="flex shrink-0 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              done ? 'bg-[var(--color-success)] text-white'
                : active ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}>
              {done ? <Check size={14} /> : i + 1}
            </span>
            <span className={`text-sm ${active ? 'font-semibold text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'}`}>{s.label}</span>
            {i < steps.length - 1 && <span className={`h-px w-8 ${done ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

function AddSubjectsDialog({ campaign, onClose }: { campaign: F360Campaign; onClose: () => void }) {
  const { t } = useTranslation('feedback360')
  const m = useF360CampaignMutations()
  const [mode, setMode] = useState<'unit' | 'people'>('unit')
  const [unitId, setUnitId] = useState('')
  const [includeChildren, setIncludeChildren] = useState(true)
  const [people, setPeople] = useState<PickedUser[]>([])
  const ready = mode === 'unit' ? !!unitId : people.length > 0

  const submit = () => m.addSubjects.mutate(
    { id: campaign.id, body: mode === 'unit' ? { orgUnitId: unitId, includeChildren } : { userIds: people.map(p => p.id) } },
    { onSuccess: onClose },
  )

  return (
    <Dialog
      open onClose={onClose} size="md" title={t('CampaignDetail.addReviewees')}
      description={campaign.status === 'OPEN' ? t('CampaignDetail.theCampaignIsRunningRatersFor') : undefined}
      footer={<DialogFooter
        secondary={<Button variant="outline" onClick={onClose}>{t('CampaignDetail.cancel')}</Button>}
        primary={<Button onClick={submit} disabled={!ready || m.addSubjects.isPending}><Plus /> {t('CampaignDetail.add')}</Button>}
      />}
    >
      <div className="space-y-4">
        <div className="flex gap-0.5 rounded-control bg-[var(--color-muted)] p-0.5">
          <ChoiceChip variant="segment" selected={mode === 'unit'} onClick={() => setMode('unit')} className="flex-1">{t('CampaignDetail.byUnit')}</ChoiceChip>
          <ChoiceChip variant="segment" selected={mode === 'people'} onClick={() => setMode('people')} className="flex-1">{t('CampaignDetail.oneByOne')}</ChoiceChip>
        </div>
        {mode === 'unit' ? (
          <div className="space-y-3">
            <OrgUnitSelect value={unitId} onChange={setUnitId} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{t('CampaignDetail.includeChildUnits')}</span>
              <Switch checked={includeChildren} onCheckedChange={setIncludeChildren} aria-label={t('CampaignDetail.includeChildUnits')} />
            </div>
            <p className="text-caption">{t('CampaignDetail.onlyPeopleWhosePrimaryUnitIs')}</p>
          </div>
        ) : (
          <UserSearchPicker multiple selected={people} onChange={setPeople} />
        )}
      </div>
    </Dialog>
  )
}

function DueDialog({ campaign, mode, onClose }: { campaign: F360Campaign; mode: 'extend' | 'reopen'; onClose: () => void }) {
  const { t } = useTranslation('feedback360')
  const m = useF360CampaignMutations()
  const [due, setDue] = useState('')
  const [reason, setReason] = useState('')
  const draft = useStateDraft({ due, reason }, v => { setDue(v.due); setReason(v.reason) }, { key: `f360-due:${campaign.id}:${mode}`, enabled: true })
  const ready = !!due && (mode === 'extend' || !!reason.trim())
  const pending = m.extend.isPending || m.reopen.isPending

  const submit = () => {
    const dueAt = fromLocalInput(due)!
    if (mode === 'extend') m.extend.mutate({ id: campaign.id, dueAt }, { onSuccess: onClose })
    else m.reopen.mutate({ id: campaign.id, reason: reason.trim(), dueAt }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open onClose={onClose} size="sm"
      title={mode === 'extend' ? t('CampaignDetail.extendTheCampaign') : t('CampaignDetail.reopenTheCampaign')}
      description={mode === 'reopen' ? t('CampaignDetail.unsubmittedFormsCanContinueSubmittedForms') : undefined}
      footer={<DialogFooter
        secondary={<Button variant="outline" onClick={onClose}>{t('CampaignDetail.cancel')}</Button>}
        primary={<Button onClick={submit} disabled={!ready || pending}>{t('CampaignDetail.confirm')}</Button>}
      />}
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium">{t('CampaignDetail.newDeadline')}</span>
          <DateTimePicker value={due} onChange={setDue} />
        </label>
        {mode === 'reopen' && (
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t('CampaignDetail.reasonRequired')}</span>
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} />
          </label>
        )}
      </div>
    </Dialog>
  )
}

const ADDABLE: F360Relationship[] = ['MANAGER', 'PEER', 'DIRECT_REPORT', 'OTHER']

/** Người chấm của một người — chỉ HR. Không gỡ được phiếu đã nộp; mở lại phiếu cần lý do. */
function AssignmentsDrawer({ campaign, subject, onClose }: { campaign: F360Campaign; subject: F360SubjectRow; onClose: () => void }) {
  const { t } = useTranslation('feedback360')
  const { data: rows = [], isLoading, error } = useF360Assignments(campaign.id, subject.id)
  const m = useF360CampaignMutations()
  const [picked, setPicked] = useState<PickedUser[]>([])
  const [relationship, setRelationship] = useState<F360Relationship>('PEER')
  const [reopening, setReopening] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const editable = campaign.status === 'DRAFT' || campaign.status === 'NOMINATING' || campaign.status === 'OPEN'

  const add = () => {
    if (!picked[0]) return
    m.addAssignment.mutate(
      { id: campaign.id, body: { subjectId: subject.id, raterId: picked[0].id, relationship } },
      { onSuccess: () => setPicked([]) },
    )
  }

  return (
    <Drawer open onClose={onClose} size="lg" title={t('CampaignDetail.ratersOf', { fullName: subject.fullName })}
      description={t('CampaignDetail.only360AdministratorsSeeThisList')}>
      {error ? (
        <p className="text-sm text-[var(--color-error)]">{t('CampaignDetail.youCannotViewOrEditYour')}</p>
      ) : isLoading ? <LoadingSkeleton rows={4} /> : (
        <div className="space-y-5">
          <ul className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
            {rows.map(a => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <UserAvatar fullName={a.raterName} avatarUrl={a.raterAvatarUrl} className="h-8 w-8 rounded-full text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.raterName}</p>
                  <p className="text-caption">
                    {RELATIONSHIP_LABEL()[a.relationship]}{a.source === 'ADDED' ? t('CampaignDetail.addedManually') : ''}
                    {a.declineReason ? t('CampaignDetail.declineReason', { declineReason: a.declineReason }) : ''}
                  </p>
                </div>
                <AssignmentStatusBadge status={a.status} />
                {campaign.status === 'OPEN' && a.status === 'SUBMITTED' && reopening !== a.id && (
                  <Button size="sm" variant="ghost" onClick={() => { setReopening(a.id); setReason('') }}>{t('CampaignDetail.reopen')}</Button>
                )}
                {/* Xác nhận ngay trong dòng: đang ở trong drawer, mở thêm hộp thoại chồng lên thì
                    Esc đóng cả hai và vòng Tab bị drawer giành lại. */}
                {reopening === a.id && (
                  <div className="flex w-full flex-wrap items-center gap-2 pt-1">
                    <Input size="sm" className="min-w-[200px] flex-1" value={reason} onChange={e => setReason(e.target.value)}
                      placeholder={t('CampaignDetail.reasonForReopeningRequiredTheRater')} autoFocus />
                    <Button size="sm" variant="ghost" onClick={() => setReopening(null)}>{t('CampaignDetail.cancel')}</Button>
                    <Button size="sm" disabled={!reason.trim() || m.reopenAssignment.isPending}
                      onClick={() => m.reopenAssignment.mutate({ id: campaign.id, assignmentId: a.id, reason: reason.trim() }, { onSuccess: () => setReopening(null) })}>
                      {t('CampaignDetail.reopenForm')}
                    </Button>
                  </div>
                )}
                {editable && a.status !== 'SUBMITTED' && (
                  <Button size="icon-sm" variant="ghost" aria-label={t('CampaignDetail.remove3', { raterName: a.raterName })}
                    onClick={() => m.removeAssignment.mutate({ id: campaign.id, assignmentId: a.id })}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
            {rows.length === 0 && <li className="p-3 text-caption">{t('CampaignDetail.noRatersYet2')}</li>}
          </ul>

          {editable && (
            <div className="space-y-3 rounded-card border border-[var(--color-border)] p-4">
              <h4 className="text-sm font-semibold">{t('CampaignDetail.addRater')}</h4>
              <Select value={relationship} onValueChange={v => setRelationship(v as F360Relationship)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADDABLE.map(r => <SelectItem key={r} value={r}>{RELATIONSHIP_LABEL()[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              <UserSearchPicker selected={picked} onChange={setPicked} excludeIds={[subject.userId, ...rows.map(r => r.raterId)]} />
              <Button onClick={add} disabled={!picked[0] || m.addAssignment.isPending}><Plus /> {t('CampaignDetail.add')} {picked[0]?.fullName ?? ''}</Button>
            </div>
          )}
        </div>
      )}

    </Drawer>
  )
}

const EVENT_LABEL = perLanguage((): Record<string, string> => ({
  NOMINATE: i18n.t('feedback360:CampaignDetail.submitNominations'), APPROVE_NOMINATION: i18n.t('feedback360:CampaignDetail.approveNominations'), AUTO_APPROVE: i18n.t('feedback360:CampaignDetail.selfApproveNominations'), START: i18n.t('feedback360:CampaignDetail.startScoring'),
  CREATE: i18n.t('feedback360:CampaignDetail.createCampaign'), ADD_SUBJECTS: i18n.t('feedback360:CampaignDetail.addReviewees'), REMOVE_SUBJECT: i18n.t('feedback360:CampaignDetail.removeReviewee'),
  GENERATE_RATERS: i18n.t('feedback360:CampaignDetail.generateRaters'), ADD_RATER: i18n.t('feedback360:CampaignDetail.addRater'), REMOVE_RATER: i18n.t('feedback360:CampaignDetail.removeRater'),
  REOPEN_ASSIGNMENT: i18n.t('feedback360:CampaignDetail.reopenForm'), LAUNCH: i18n.t('feedback360:CampaignDetail.start'), EXTEND: i18n.t('feedback360:CampaignDetail.extend'), CLOSE: i18n.t('feedback360:CampaignDetail.closeCampaign'),
  REOPEN: i18n.t('feedback360:CampaignDetail.reopenTheCampaign'), RELEASE: i18n.t('feedback360:CampaignDetail.publishReport'), REMIND: i18n.t('feedback360:CampaignDetail.remindRaters'), HIDE_COMMENT: i18n.t('feedback360:CampaignDetail.hideComment'),
}))

function EventsDrawer({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const { t } = useTranslation('feedback360')
  const { data: events = [], isLoading } = useF360Events(campaignId)
  return (
    <Drawer open onClose={onClose} size="md" title={t('CampaignDetail.campaignLog')}>
      {isLoading ? <LoadingSkeleton rows={5} /> : (
        <ol className="space-y-3">
          {events.map(e => (
            <li key={e.id} className="rounded-control bg-[var(--color-muted)] px-3 py-2">
              <p className="text-sm font-medium">{EVENT_LABEL()[e.action] ?? e.action}{e.subjectName ? ` — ${e.subjectName}` : ''}</p>
              <p className="text-caption">{e.actorName ?? t('CampaignDetail.system')} · {new Date(e.createdAt).toLocaleString(intlDateLocale())}</p>
              {e.detail && <p className="mt-1 break-words text-caption">{formatDetail(e.detail)}</p>}
            </li>
          ))}
          {events.length === 0 && <p className="text-caption">{t('CampaignDetail.noActivityYet')}</p>}
        </ol>
      )}
    </Drawer>
  )
}

function formatDetail(json: string) {
  try {
    const d = JSON.parse(json) as Record<string, unknown>
    if (typeof d.reason === 'string') return i18n.t('feedback360:CampaignDetail.reason', { reason: d.reason })
    return Object.entries(d).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')
  } catch {
    return json
  }
}
