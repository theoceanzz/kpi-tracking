import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, EyeOff, FileBarChart, UserRound, Users,
} from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import UserAvatar from '@/components/common/UserAvatar'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { cn } from '@/lib/utils'
import { ASSIGNMENT_STATUS_LABEL, RELATIONSHIP_LABEL, type F360MyReport, type F360Task } from '../api/feedback360Api'
import { useF360MyReports, useF360Tasks, useOrgId } from '../hooks/useFeedback360'
import { fmtDate, fmtScore } from '../utils/f360Format'
import { ApprovalsSection, MyNominationsSection } from '../components/NominationPanels'
import TrendCard from '../components/TrendCard'
import { useTranslation } from 'react-i18next'
import { tourAnchor } from '@/components/common/tours/anchors'

const isTodo = (t: F360Task) => t.status === 'PENDING' || t.status === 'IN_PROGRESS'

interface CampaignGroup { id: string; name: string; dueAt?: string | null; tasks: F360Task[]; todo: number }

/** Gom phiếu theo chiến dịch; chiến dịch còn việc lên trước, hạn gần trước. Tự đánh giá luôn đứng đầu nhóm. */
function groupByCampaign(tasks: F360Task[]): CampaignGroup[] {
  const map = new Map<string, CampaignGroup>()
  for (const t of tasks) {
    const g = map.get(t.campaignId) ?? { id: t.campaignId, name: t.campaignName, dueAt: t.dueAt, tasks: [], todo: 0 }
    g.tasks.push(t)
    if (isTodo(t)) g.todo++
    map.set(t.campaignId, g)
  }
  const rank = (t: F360Task) => (isTodo(t) ? 0 : 2) + (t.relationship === 'SELF' ? 0 : 1)
  return [...map.values()]
    .map(g => ({ ...g, tasks: [...g.tasks].sort((a, b) => rank(a) - rank(b) || a.subjectName.localeCompare(b.subjectName, 'vi')) }))
    .sort((a, b) => (new Date(a.dueAt ?? 8.64e15).getTime()) - (new Date(b.dueAt ?? 8.64e15).getTime()))
}

/**
 * Không gian 360 của một người. Phiếu được GOM THEO CHIẾN DỊCH (một đợt thường có 4–8 phiếu cùng
 * hạn — lặp tên chiến dịch trên từng dòng chỉ là nhiễu), việc còn phải làm lên đầu với nút hành
 * động rõ ràng, chiến dịch đã xong thu gọn còn một dòng. Không có việc thì chỉ một dòng xác nhận
 * thay vì một khung trống to chiếm nửa màn hình.
 */
export default function MyF360Page() {
  const { t: tr } = useTranslation('feedback360')
  const orgId = useOrgId()
  const { data: org } = useOrganization(orgId)
  const { hasPermission } = useHasPermission()
  const canSeeReports = hasPermission('FEEDBACK360:VIEW_MY')
  const { data: tasks = [], isLoading } = useF360Tasks()
  const { data: reports = [] } = useF360MyReports(canSeeReports)
  // Mốc "bây giờ" lấy một lần khi mở trang — đủ cho nhãn "còn N ngày", giữ render thuần.
  const [now] = useState(() => Date.now())

  if (org && !org.enableFeedback360) {
    return (
      <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState icon={Users} title={tr('MyF360Page.theOrganizationHasNotEnabled360')} />
      </div>
    )
  }

  const visible = tasks.filter(t => t.status !== 'REMOVED')
  const groups = groupByCampaign(visible)
  const active = groups.filter(g => g.todo > 0)
  const finished = groups.filter(g => g.todo === 0)
  const todoCount = visible.filter(isTodo).length
  const submittedCount = visible.filter(t => t.status === 'SUBMITTED').length

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <WorkspaceHeader
        title={tr('MyF360Page.my360Feedback')}
        description={tr('MyF360Page.rateTheCompetenciesOfColleaguesAssigned')}
        stats={[
          { label: tr('MyF360Page.toRate'), value: todoCount, icon: ClipboardList },
          { label: tr('MyF360Page.submitted'), value: submittedCount, icon: CheckCircle2 },
          ...(canSeeReports ? [{ label: tr('MyF360Page.myReports'), value: reports.length, icon: FileBarChart }] : []),
        ]}
      />

      <ApprovalsSection />
      <MyNominationsSection />

      {/* ── Đang chờ bạn ── */}
      <section {...tourAnchor('myf360.waiting')} className="space-y-3">
        <SectionTitle title={tr('MyF360Page.waitingOnYou')} count={todoCount} />
        {isLoading && <LoadingSkeleton rows={3} />}
        {!isLoading && active.length === 0 && (
          <div className="flex items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
              <CheckCircle2 size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{tr('MyF360Page.youHaveNoFormsLeftTo')}</p>
              <p className="text-caption">{tr('MyF360Page.whenANew360CampaignIs')}</p>
            </div>
          </div>
        )}
        {active.map(g => <CampaignCard key={g.id} group={g} now={now} />)}
      </section>

      {/* ── Đã hoàn thành: mỗi chiến dịch một dòng, mở ra khi cần xem lại ── */}
      {finished.length > 0 && (
        <section {...tourAnchor('myf360.done')} className="space-y-3">
          <SectionTitle title={tr('MyF360Page.completed')} count={finished.length} unit={tr('MyF360Page.campaigns')} />
          {finished.map(g => <CampaignCard key={g.id} group={g} now={now} />)}
        </section>
      )}

      {canSeeReports && (
        <section {...tourAnchor('myf360.reports')} className="space-y-3">
          <SectionTitle title={tr('MyF360Page.my360Reports')} count={reports.length} />
          <TrendCard reports={reports} />
          {reports.length === 0 ? (
            <div className="flex items-center gap-3 rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
              <FileBarChart size={16} className="shrink-0 text-[var(--color-muted-foreground)]" />
              <p className="text-sm text-[var(--color-muted-foreground)]">{tr('MyF360Page.noReportHasBeenPublishedFor')}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {reports.map(r => <ReportCard key={r.subjectId} report={r} />)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function SectionTitle({ title, count, unit }: { title: string; count: number; unit?: string }) {
  return (
    <h2 className="flex items-baseline gap-2 text-eyebrow">
      {title}
      {count > 0 && <span className="font-normal normal-case tracking-normal text-[var(--color-muted-foreground)] tabular-nums">{count}{unit ? ` ${unit}` : ''}</span>}
    </h2>
  )
}

/** Hạn còn bao lâu — nói bằng số ngày khi gần, đổi màu khi gấp. */
function DueChip({ dueAt, done, now }: { dueAt?: string | null; done: boolean; now: number }) {
  const { t } = useTranslation('feedback360')
  if (!dueAt) return null
  const days = Math.ceil((new Date(dueAt).getTime() - now) / 86_400_000)
  const overdue = days < 0
  const urgent = !done && !overdue && days <= 2
  const text = done ? t('MyF360Page.due', { dueAt: fmtDate(dueAt) })
    : overdue ? t('MyF360Page.overdue', { dueAt: fmtDate(dueAt) })
      : days === 0 ? t('MyF360Page.dueToday')
        : days <= 7 ? t('MyF360Page.daysLeftDue', { count: days, dueAt: fmtDate(dueAt) })
          : t('MyF360Page.due', { dueAt: fmtDate(dueAt) })
  return (
    <span className={cn(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
      !done && overdue ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
        : urgent ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
          : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
    )}>
      <CalendarClock size={12} /> {text}
    </span>
  )
}

function CampaignCard({ group: g, now }: { group: CampaignGroup; now: number }) {
  const { t: tr } = useTranslation('feedback360')
  const done = g.todo === 0
  // Chiến dịch đã xong thu gọn; chiến dịch còn việc mở sẵn nhưng giấu phần đã nộp sau một nút.
  const [open, setOpen] = useState(!done)
  const [showSubmitted, setShowSubmitted] = useState(false)
  const total = g.tasks.length
  const finishedCount = total - g.todo
  const pct = total ? Math.round((finishedCount / total) * 100) : 0
  const todoRows = g.tasks.filter(isTodo)
  const doneRows = g.tasks.filter(t => !isTodo(t))

  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-muted)]/50">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{g.name}</p>
            <DueChip dueAt={g.dueAt} done={done} now={now} />
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[var(--color-muted)]">
              <div className={cn('h-full rounded-full', done ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-caption tabular-nums">
              {done ? tr('MyF360Page.doneForms', { total, total2: total }) : tr('MyF360Page.formsLeftSubmitted', { todo: g.todo, finishedCount, total })}
            </span>
          </div>
        </div>
        <ChevronDown size={18} className={cn('shrink-0 text-[var(--color-muted-foreground)] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {todoRows.map(t => <TaskRow key={t.assignmentId} task={t} />)}
          {todoRows.length > 0 && doneRows.length > 0 && (
            <li>
              <button type="button" onClick={() => setShowSubmitted(s => !s)} aria-expanded={showSubmitted}
                className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-caption hover:bg-[var(--color-muted)]/50">
                <ChevronRight size={14} className={cn('transition-transform', showSubmitted && 'rotate-90')} />
                {showSubmitted ? tr('MyF360Page.hide') : tr('MyF360Page.show')} {doneRows.length} {tr('MyF360Page.formsSubmitted')}
              </button>
            </li>
          )}
          {(todoRows.length === 0 || showSubmitted) && doneRows.map(t => <TaskRow key={t.assignmentId} task={t} />)}
        </ul>
      )}
    </div>
  )
}

function TaskRow({ task: t }: { task: F360Task }) {
  const { t: tr } = useTranslation('feedback360')
  const self = t.relationship === 'SELF'
  const todo = isTodo(t)
  const action = t.status === 'IN_PROGRESS' ? tr('MyF360Page.continue') : t.status === 'PENDING' ? tr('MyF360Page.start') : tr('MyF360Page.review')
  return (
    <li>
      <Link to={`/feedback360/respond/${t.assignmentId}`}
        className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-muted)]/60">
        {self ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <UserRound size={17} />
          </span>
        ) : (
          <UserAvatar fullName={t.subjectName} avatarUrl={t.subjectAvatarUrl} className="size-9 shrink-0 rounded-full text-xs" />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm', todo ? 'font-medium' : 'text-[var(--color-muted-foreground)]')}>
            {self ? tr('MyF360Page.selfAssessment') : t.subjectName}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-caption">
            <span>{self ? tr('MyF360Page.yourOwnFormForComparisonWith') : tr('MyF360Page.youAreRatingAs', { toLowerCase: RELATIONSHIP_LABEL()[t.relationship].toLowerCase() })}</span>
            {t.anonymous && !self && <span className="inline-flex items-center gap-1"><EyeOff size={11} /> {tr('MyF360Page.anonymity')}</span>}
          </p>
        </div>
        {todo ? (
          <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-control bg-[var(--color-primary)] px-3 text-xs font-semibold text-[var(--color-primary-foreground)] group-hover:opacity-90">
            {action} <ChevronRight size={14} />
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-2 text-xs">
            <span className={cn('inline-flex items-center gap-1', t.status === 'SUBMITTED' ? 'text-[var(--color-success)]' : 'text-[var(--color-muted-foreground)]')}>
              {t.status === 'SUBMITTED' && <CheckCircle2 size={13} />}
              {ASSIGNMENT_STATUS_LABEL()[t.status]}{t.submittedAt ? ` ${fmtDate(t.submittedAt)}` : ''}
            </span>
            <span className="hidden text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)] sm:inline">{action}</span>
          </span>
        )}
      </Link>
    </li>
  )
}

function ReportCard({ report: r }: { report: F360MyReport }) {
  const { t } = useTranslation('feedback360')
  const pct = (v?: number | null) => (v == null ? 0 : Math.max(0, Math.min(100, ((v - 1) / Math.max(1, r.scaleMax - 1)) * 100)))
  return (
    <Link to={`/feedback360/reports/${r.subjectId}`}
      className="group rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:border-[var(--color-border-strong)]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{r.campaignName}</p>
          <p className="text-caption">{t('MyF360Page.publish')} {fmtDate(r.releasedAt)} · {r.responseCount ?? 0} {t('MyF360Page.respondents')}</p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5" />
      </div>
      <dl className="mt-3 space-y-2">
        <ScoreBar label={t('MyF360Page.othersAssessment')} value={r.overallScore} max={r.scaleMax} pct={pct(r.overallScore)} tone="primary" />
        {r.selfScore != null && <ScoreBar label={t('MyF360Page.yourSelfAssessment')} value={r.selfScore} max={r.scaleMax} pct={pct(r.selfScore)} tone="muted" />}
      </dl>
    </Link>
  )
}

function ScoreBar({ label, value, max, pct, tone }: { label: string; value?: number | null; max: number; pct: number; tone: 'primary' | 'muted' }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
        <dd className="font-semibold tabular-nums">{fmtScore(value)}<span className="font-normal text-[var(--color-muted-foreground)]">/{max}</span></dd>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div className={cn('h-full rounded-full', tone === 'primary' ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-muted-foreground)]/50')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
