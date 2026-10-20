import { intlDateLocale } from '@/i18n/format'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, BellRing, CalendarClock, Check, FileBarChart, FileSpreadsheet, History, ListChecks, Lock, Megaphone,
  Pencil, Play, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, UserPlus, Users, X,
} from 'lucide-react'
import HeatmapCard from './HeatmapCard'
import CampaignQuestionsCard from './CampaignQuestionsCard'
import { Button } from '@/components/ui/button'
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
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import RowMenu, { type RowMenuItem } from '@/components/common/RowMenu'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { cn } from '@/lib/utils'
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
import CampaignFormDialog, { type Step as FormStep } from './CampaignFormDialog'
import { AssignmentStatusBadge, CampaignStatusBadge, OrgUnitSelect, UserSearchPicker } from './F360Common'
import { fmtDate, fmtScore, fromLocalInput, type PickedUser } from '../utils/f360Format'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { useStateDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

type Confirm = 'launch' | 'start' | 'close' | 'release' | 'delete' | null
type Tab = 'people' | 'questions' | 'results'
type SubjectFilter = 'all' | 'incomplete' | 'warnings'

const isIncomplete = (s: F360SubjectRow) => s.assignmentCount === 0 || s.submittedCount < s.assignmentCount

/**
 * Chi tiết một chiến dịch 360.
 *
 * <p>Bố cục theo đúng câu hỏi người quản trị có trong đầu: "chiến dịch đang ở bước nào, tôi phải bấm
 * gì tiếp" — thanh bước + MỘT nút chính ngay dưới nó; mọi thao tác phụ (sửa, gia hạn, xuất Excel,
 * nhật ký, xoá…) gom vào menu "⋯" thay vì một hàng nút ngang hàng nhau. Phần thân chia tab (người
 * được đánh giá / câu hỏi / kết quả đơn vị) để danh sách người không bị đẩy xuống dưới cùng.
 *
 * <p>Ở bản nháp, thêm người xong là hệ thống tự chọn người chấm cho họ (`generateRaters`, không
 * reset — chỉ sinh cho người chưa có phiếu), nên không còn bước "Sinh người chấm" riêng.
 *
 * <p>Vẽ trong `WorkspaceHeader` để hàng tab của trang "Quản lý hiệu suất" không biến mất khi mở chi tiết.
 */
export default function CampaignDetail({ campaignId, onBack }: { campaignId: string; onBack: () => void }) {
  const { t } = useTranslation('feedback360')
  const { data: campaign, isLoading } = useF360Campaign(campaignId)
  const { data: subjects = [], isLoading: loadingSubjects } = useF360Subjects(campaignId)
  const m = useF360CampaignMutations()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [editing, setEditing] = useState<FormStep | null>(null)
  const [adding, setAdding] = useState(false)
  const [dueDialog, setDueDialog] = useState<'extend' | 'reopen' | null>(null)
  const [managing, setManaging] = useState<F360SubjectRow | null>(null)
  const [removing, setRemoving] = useState<F360SubjectRow | null>(null)
  const [generated, setGenerated] = useState<F360GenerateResult | null>(null)
  const [showEvents, setShowEvents] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('people')
  const [filter, setFilter] = useState<SubjectFilter>('all')

  if (isLoading || !campaign) return <LoadingSkeleton rows={6} />

  const manage = campaign.canManage
  const status = campaign.status
  const editableList = manage && (status === 'DRAFT' || status === 'NOMINATING' || status === 'OPEN')
  const hasResults = status === 'CLOSED' || status === 'RELEASED'
  const activeTab: Tab = tab === 'results' && !hasResults ? 'people' : tab

  const runConfirm = () => {
    const done = { onSuccess: () => setConfirm(null) }
    if (confirm === 'launch') m.launch.mutate(campaign.id, done)
    if (confirm === 'start') m.start.mutate(campaign.id, done)
    if (confirm === 'close') m.close.mutate(campaign.id, done)
    if (confirm === 'release') m.release.mutate(campaign.id, done)
    if (confirm === 'delete') m.remove.mutate(campaign.id, { onSuccess: () => { setConfirm(null); onBack() } })
  }
  const generate = (reset: boolean) => m.generateRaters.mutate({ id: campaign.id, reset }, { onSuccess: setGenerated })

  const next = nextStep(campaign, subjects.length)
  const primary: Record<NonNullable<NextAction>, ReactNode> = {
    add: <Button size="sm" onClick={() => setAdding(true)}><UserPlus /> {t('CampaignDetail.addReviewees')}</Button>,
    generate: <Button size="sm" disabled={m.generateRaters.isPending} onClick={() => generate(false)}><Sparkles /> {t('CampaignDetail.generateRaters')}</Button>,
    launch: <Button size="sm" onClick={() => setConfirm('launch')}><Play /> {t('CampaignDetail.start')}</Button>,
    start: <Button size="sm" onClick={() => setConfirm('start')}><Play /> {t('CampaignDetail.startScoring')}</Button>,
    close: <Button size="sm" onClick={() => setConfirm('close')}><Lock /> {t('CampaignDetail.closeComputeResults')}</Button>,
    release: <Button size="sm" onClick={() => setConfirm('release')}><Megaphone /> {t('CampaignDetail.publishReport')}</Button>,
  }

  // Thao tác phụ: ít dùng hoặc chỉ dùng một lần — vào menu "⋯", không tranh chỗ với nút chính.
  const menuItems: RowMenuItem[] = []
  if (manage) {
    if (editableList) menuItems.push({ key: 'edit', icon: <Pencil />, label: t('CampaignDetail.editCampaign'), onSelect: () => setEditing('basics') })
    if (status === 'OPEN') menuItems.push({ key: 'extend', icon: <CalendarClock />, label: t('CampaignDetail.extend'), onSelect: () => setDueDialog('extend') })
    if (status === 'CLOSED') menuItems.push({ key: 'reopen', icon: <RotateCcw />, label: t('CampaignDetail.reopenTheCampaign'), onSelect: () => setDueDialog('reopen') })
    if (hasResults) menuItems.push({ key: 'excel', icon: <FileSpreadsheet />, label: t('CampaignDetail.exportExcel'), onSelect: () => m.exportExcel.mutate(campaign.id) })
    if (status === 'DRAFT' && campaign.assignmentCount > 0) {
      menuItems.push({ key: 'regen', icon: <Sparkles />, label: t('CampaignDetail.regenerateRaters'), onSelect: () => generate(true) })
    }
    menuItems.push({ key: 'log', icon: <History />, label: t('CampaignDetail.log'), onSelect: () => setShowEvents(true), separated: menuItems.length > 0 })
    if (status === 'DRAFT') menuItems.push({ key: 'delete', icon: <Trash2 />, label: t('CampaignDetail.deleteCampaign'), danger: true, onSelect: () => setConfirm('delete') })
  }

  const incompleteCount = subjects.filter(isIncomplete).length
  const warningCount = subjects.filter(s => s.warnings.length > 0).length
  // Lọc "chưa đủ phiếu" chỉ có nghĩa khi đang thu phiếu; ở nháp mọi người đều "chưa đủ".
  const collecting = status === 'NOMINATING' || status === 'OPEN'
  const filters: { key: SubjectFilter; label: string; count: number }[] = [
    { key: 'all', label: t('CampaignDetail.filterAll'), count: subjects.length },
    ...(collecting && incompleteCount > 0 ? [{ key: 'incomplete' as const, label: t('CampaignDetail.filterIncomplete'), count: incompleteCount }] : []),
    ...(warningCount > 0 ? [{ key: 'warnings' as const, label: t('CampaignDetail.filterWarnings'), count: warningCount }] : []),
  ]
  const activeFilter = filters.some(f => f.key === filter) ? filter : 'all'
  const q = query.trim().toLowerCase()
  const visibleSubjects = subjects
    .filter(s => activeFilter === 'all' || (activeFilter === 'incomplete' ? isIncomplete(s) : s.warnings.length > 0))
    .filter(s => !q || s.fullName.toLowerCase().includes(q) || (s.orgUnitName ?? '').toLowerCase().includes(q))

  const pct = campaign.assignmentCount ? Math.round((campaign.submittedCount / campaign.assignmentCount) * 100) : 0
  const questionTotal = campaign.questionCount ?? 0

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /> {t('CampaignDetail.allCampaigns')}</Button>

      <WorkspaceHeader
        title={campaign.name}
        description={campaign.description ?? undefined}
        actions={(
          <div className="flex items-center gap-2">
            <CampaignStatusBadge status={status} />
            {menuItems.length > 0 && <RowMenu items={menuItems} label={t('CampaignDetail.moreActions')} />}
          </div>
        )}
      >
        <div className="-mt-1 flex flex-wrap gap-1.5">
          <MetaChip icon={<CalendarClock size={12} />}>
            {campaign.startAt ? `${fmtDate(campaign.startAt)} → ` : t('CampaignDetail.due')}{fmtDate(campaign.dueAt)}
          </MetaChip>
          {campaign.kpiCycleName && <MetaChip>{t('CampaignDetail.aCycle')} {campaign.kpiCycleName}</MetaChip>}
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

        {/* Thanh bước + việc cần làm tiếp: một chỗ duy nhất trả lời "giờ bấm gì". */}
        <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
          <StepTracker campaign={campaign} />
          {manage && next && (
            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-primary-soft)] px-4 py-3">
              <div className="min-w-[200px] flex-1">
                <p className="text-sm font-semibold text-[var(--color-foreground)]">{next.title}</p>
                <p className="text-caption">{next.hint}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {status === 'OPEN' && (
                  <Button variant="outline" size="sm" onClick={() => m.remind.mutate(campaign.id)} disabled={m.remind.isPending}>
                    <BellRing /> {t('CampaignDetail.remindThoseWhoHaveNotSubmitted')}
                  </Button>
                )}
                {next.action && primary[next.action]}
              </div>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label={t('CampaignDetail.reviewee')} value={campaign.subjectCount} />
          {status === 'DRAFT'
            ? <StatTile label={t('CampaignDetail.raterForms')} value={campaign.assignmentCount} />
            : <StatTile label={t('CampaignDetail.submitted')} value={<>{campaign.submittedCount}<span className="text-caption font-normal">/{campaign.assignmentCount} · {pct}%</span></>} progress={pct} />}
          <StatTile label={t('CampaignDetail.evaluationDeadline')} value={fmtDate(campaign.dueAt)} />
          <StatTile
            label={status === 'RELEASED' ? t('CampaignDetail.publish') : status === 'DRAFT' ? t('CampaignDetail.opensOn') : t('CampaignDetail.start')}
            value={fmtDate(status === 'RELEASED' ? campaign.releasedAt : status === 'DRAFT' ? campaign.startAt : campaign.launchedAt)}
          />
        </dl>
      </WorkspaceHeader>

      <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
          <div className="flex w-fit flex-wrap gap-0.5 rounded-control bg-[var(--color-muted)] p-0.5" role="tablist" aria-label={t('CampaignDetail.campaignSections')}>
            <TabChip active={activeTab === 'people'} onClick={() => setTab('people')} icon={<Users />} label={t('CampaignDetail.reviewee')} count={subjects.length} />
            <TabChip active={activeTab === 'questions'} onClick={() => setTab('questions')} icon={<ListChecks />} label={t('CampaignDetail.questions')} count={questionTotal} />
            {hasResults && <TabChip active={activeTab === 'results'} onClick={() => setTab('results')} icon={<FileBarChart />} label={t('CampaignDetail.unitResults')} />}
          </div>
          {activeTab === 'people' && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {subjects.length > 8 && (
                <Input size="sm" type="search" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={t('CampaignDetail.searchByNameOrUnit')} prefix={<Search size={14} />} className="w-[220px]" />
              )}
              {editableList && subjects.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setAdding(true)}><UserPlus /> {t('CampaignDetail.addPeople')}</Button>
              )}
            </div>
          )}
        </div>

        {activeTab === 'questions' && (
          <CampaignQuestionsCard campaign={campaign} onEdit={manage && status === 'DRAFT' ? () => setEditing('questions') : undefined} />
        )}

        {activeTab === 'results' && <HeatmapCard campaignId={campaign.id} bare />}

        {activeTab === 'people' && (
          <>
            {generated && (
              <div className="m-4 mb-0 rounded-control border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 text-sm">
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 font-medium">
                    {t('CampaignDetail.created')} {generated.assignmentsCreated} {t('CampaignDetail.formsFor')} {generated.subjectsProcessed} {t('CampaignDetail.people')}
                    {generated.warnings.length > 0 ? t('CampaignDetail.warningsToReviewBeforeStarting', { count: generated.warnings.length }) : '.'}
                  </p>
                  <Button variant="ghost" size="icon-sm" aria-label={t('CampaignDetail.hide')} onClick={() => setGenerated(null)}><X /></Button>
                </div>
                {generated.warnings.length > 0 && (
                  <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-caption">
                    {generated.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
              </div>
            )}

            {filters.length > 1 && (
              <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                {filters.map(f => (
                  <ChoiceChip key={f.key} size="sm" selected={activeFilter === f.key} onClick={() => setFilter(f.key)}>
                    {f.label} <span className="ml-1 tabular-nums opacity-70">{f.count}</span>
                  </ChoiceChip>
                ))}
              </div>
            )}

            {loadingSubjects && <div className="p-4"><LoadingSkeleton rows={4} /></div>}
            {!loadingSubjects && subjects.length === 0 && (
              <EmptyState icon={Users} title={t('CampaignDetail.noRevieweesYet')}
                description={manage ? t('CampaignDetail.addByUnitOrOneBy') : t('CampaignDetail.noOneInYourScope')}
                action={editableList ? <Button size="sm" onClick={() => setAdding(true)}><UserPlus /> {t('CampaignDetail.addReviewees')}</Button> : undefined} />
            )}
            {subjects.length > 0 && visibleSubjects.length === 0 && (
              <p className="p-6 text-center text-sm text-[var(--color-muted-foreground)]">{t('CampaignDetail.noOneMatches')}</p>
            )}
            {visibleSubjects.length > 0 && (
              <SubjectList
                campaign={campaign}
                subjects={visibleSubjects}
                hasResults={hasResults}
                onManage={manage ? setManaging : undefined}
                onRemove={editableList ? setRemoving : undefined}
              />
            )}
          </>
        )}
      </section>

      {editing && (
        <CampaignFormDialog
          campaign={campaign}
          initialStep={editing}
          saving={m.update.isPending}
          onClose={() => setEditing(null)}
          onSubmit={body => m.update.mutate({ id: campaign.id, body }, { onSuccess: () => setEditing(null) })}
        />
      )}
      {adding && (
        <AddSubjectsDialog campaign={campaign} onClose={() => setAdding(false)}
          // Nháp: thêm xong tự chọn người chấm cho người mới (chỉ ai chưa có phiếu), khỏi một bước bấm.
          onAdded={status === 'DRAFT' ? () => generate(false) : undefined} />
      )}
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

function TabChip({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; count?: number }) {
  return (
    <ChoiceChip variant="segment" size="sm" role="tab" aria-selected={active} selected={active} onClick={onClick}>
      {icon}{label}{count != null && <span className="ml-0.5 tabular-nums text-[var(--color-muted-foreground)]">{count}</span>}
    </ChoiceChip>
  )
}

function StatTile({ label, value, progress }: { label: string; value: ReactNode; progress?: number }) {
  const { t } = useTranslation('feedback360')
  return (
    <div className="rounded-control bg-[var(--color-muted)] px-3 py-2">
      <dt className="text-caption">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
      {progress != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-card)]" role="progressbar"
          aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t('CampaignDetail.formsSubmittedRate')}>
          <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

function MetaChip({ icon, tone, children }: { icon?: ReactNode; tone?: 'warning'; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${tone === 'warning'
      ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
      : 'border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}>
      {icon}{children}
    </span>
  )
}

/**
 * Danh sách người được đánh giá: một dòng một người, tiến độ là MỘT thanh + chữ nhỏ theo nhóm (thay
 * cho một hàng huy hiệu màu). Nháp chưa ai nộp nên chỉ đếm người chấm từng nhóm. Dòng co lại thành
 * thẻ trên màn hẹp, không cuộn ngang.
 */
function SubjectList({ campaign, subjects, hasResults, onManage, onRemove }: {
  campaign: F360Campaign
  subjects: F360SubjectRow[]
  hasResults: boolean
  onManage?: (s: F360SubjectRow) => void
  onRemove?: (s: F360SubjectRow) => void
}) {
  const { t } = useTranslation('feedback360')
  const draft = campaign.status === 'DRAFT'
  const cols = hasResults
    ? 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_96px_auto]'
    : 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_auto]'
  return (
    <div>
      <div className={cn('hidden gap-4 border-b border-[var(--color-border)] px-4 py-2 text-caption md:grid', cols)}>
        <span>{t('CampaignDetail.people2')}</span>
        <span>{draft ? t('CampaignDetail.ratersByGroup') : t('CampaignDetail.progressByGroup')}</span>
        {hasResults && <span>{t('CampaignDetail.n360Score')}</span>}
        <span />
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {subjects.map(s => {
          const sPct = s.assignmentCount ? Math.round((s.submittedCount / s.assignmentCount) * 100) : 0
          const done = s.assignmentCount > 0 && s.submittedCount >= s.assignmentCount
          return (
            <li key={s.id} className={cn('grid items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-[var(--color-muted)]/40', cols)}>
              <div className="min-w-0">
                <button type="button" disabled={!onManage} onClick={() => onManage?.(s)}
                  className="flex w-full min-w-0 items-center gap-3 text-left disabled:cursor-default">
                  <UserAvatar fullName={s.fullName} avatarUrl={s.avatarUrl} className="size-8 shrink-0 rounded-full text-xs" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{s.fullName}</span>
                    <span className="block truncate text-caption">{s.orgUnitName ?? '-'}</span>
                  </span>
                </button>
                {s.warnings.length > 0 && (
                  <p className="mt-1.5 flex items-start gap-1 text-xs text-[var(--color-warning)]">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {s.warnings.join(' · ')}
                  </p>
                )}
              </div>

              <div className="min-w-0">
                {s.progress.length === 0 ? (
                  <span className="text-caption">{t('CampaignDetail.noRatersYet')}</span>
                ) : (
                  <>
                    {!draft && (
                      <div className="mb-1 flex items-center gap-2">
                        <div className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-[var(--color-muted)]">
                          <div className={cn('h-full rounded-full', done ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')} style={{ width: `${sPct}%` }} />
                        </div>
                        <span className="text-xs font-medium tabular-nums">{s.submittedCount}/{s.assignmentCount}</span>
                      </div>
                    )}
                    <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-caption">
                      {s.progress.map(p => (
                        <span key={p.relationship} className={cn('inline-flex items-center gap-0.5 whitespace-nowrap', !draft && p.submitted >= p.total && 'text-[var(--color-success)]')}>
                          {!draft && p.submitted >= p.total && <Check size={11} />}
                          {RELATIONSHIP_LABEL()[p.relationship]} <span className="tabular-nums">{draft ? p.total : `${p.submitted}/${p.total}`}</span>
                        </span>
                      ))}
                    </p>
                  </>
                )}
              </div>

              {hasResults && (
                <div>
                  {s.overallScore != null ? (
                    <span className="font-semibold tabular-nums">{fmtScore(s.overallScore)}<span className="text-caption font-normal">/{campaign.scaleMax}</span></span>
                  ) : s.status === 'INSUFFICIENT' ? (
                    <span className="text-xs font-medium text-[var(--color-warning)]">{t('CampaignDetail.missingResponses')}</span>
                  ) : <span className="text-caption">—</span>}
                </div>
              )}

              <div className="flex justify-end gap-1">
                {hasResults && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/feedback360/reports/${s.id}`}><FileBarChart /> {t('CampaignDetail.reports')}</Link>
                  </Button>
                )}
                {onManage && (
                  <Button size="sm" variant="ghost" onClick={() => onManage(s)}><Users /> {t('CampaignDetail.scorer')}</Button>
                )}
                {onRemove && (
                  <Button size="icon-sm" variant="ghost" aria-label={t('CampaignDetail.remove', { fullName: s.fullName })} onClick={() => onRemove(s)}><Trash2 /></Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type NextAction = 'add' | 'generate' | 'launch' | 'start' | 'close' | 'release' | null

/** Việc cần làm tiếp theo của một chiến dịch, cho khung "Bước tiếp theo". */
function nextStep(c: F360Campaign, subjectCount: number): { title: string; hint: string; action: NextAction } | null {
  switch (c.status) {
    case 'DRAFT':
      if (subjectCount === 0) return { title: i18n.t('feedback360:CampaignDetail.addReviewees'), hint: i18n.t('feedback360:CampaignDetail.chooseByUnitIncludingChildUnits'), action: 'add' }
      // Thêm người đã tự chọn người chấm; nhánh này chỉ còn cho dữ liệu cũ hoặc khi lần tự chọn bị lỗi.
      if (c.assignmentCount === 0) return { title: i18n.t('feedback360:CampaignDetail.generateRaters'), hint: i18n.t('feedback360:CampaignDetail.theSystemSuggestsManagersPeersAnd'), action: 'generate' }
      return {
        title: c.startAt && new Date(c.startAt).getTime() > Date.now()
          ? i18n.t('feedback360:CampaignDetail.readyStartsAutomaticallyOn', { startAt: fmtDate(c.startAt) })
          : i18n.t('feedback360:CampaignDetail.readyToStart'),
        hint: i18n.t('feedback360:CampaignDetail.reviewRatersThen')
          + (c.allowNomination
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

/** Các bước của chiến dịch; bước đề cử chỉ có khi chiến dịch bật đề cử. Giãn đều theo bề ngang. */
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
    <ol className="flex items-center gap-2 overflow-x-auto px-4 py-3" aria-label={t('CampaignDetail.campaignSteps')}>
      {steps.map((s, i) => {
        // Đã công bố là bước cuối và cũng là "xong": tô xanh luôn thay vì để một vòng xanh dương đang chạy.
        const done = i < current || (campaign.status === 'RELEASED' && i === current)
        const active = i === current && !done
        return (
          <li key={s.key} className={cn('flex min-w-fit items-center gap-2', i < steps.length - 1 && 'flex-1')} aria-current={i === current ? 'step' : undefined}>
            <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              done ? 'bg-[var(--color-success-solid)] text-white'
                : active ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] ring-4 ring-[var(--color-primary-soft)]'
                  : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]')}>
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('whitespace-nowrap text-sm', i === current ? 'font-semibold text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]')}>{s.label}</span>
            {i < steps.length - 1 && <span className={cn('h-px min-w-6 flex-1', i < current ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-border)]')} />}
          </li>
        )
      })}
    </ol>
  )
}

function AddSubjectsDialog({ campaign, onClose, onAdded }: { campaign: F360Campaign; onClose: () => void; onAdded?: () => void }) {
  const { t } = useTranslation('feedback360')
  const m = useF360CampaignMutations()
  const [mode, setMode] = useState<'unit' | 'people'>('unit')
  const [unitId, setUnitId] = useState('')
  const [includeChildren, setIncludeChildren] = useState(true)
  const [people, setPeople] = useState<PickedUser[]>([])
  const ready = mode === 'unit' ? !!unitId : people.length > 0

  const submit = () => m.addSubjects.mutate(
    { id: campaign.id, body: mode === 'unit' ? { orgUnitId: unitId, includeChildren } : { userIds: people.map(p => p.id) } },
    { onSuccess: () => { onClose(); onAdded?.() } },
  )

  return (
    <Dialog
      open onClose={onClose} size="md" title={t('CampaignDetail.addReviewees')}
      description={campaign.status === 'DRAFT' ? t('CampaignDetail.ratersArePickedAutomatically') : t('CampaignDetail.theCampaignIsRunningRatersFor')}
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
