import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, ChevronRight, ListChecks, Plus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import type { F360Campaign, F360CampaignStatus } from '../api/feedback360Api'
import { useF360CampaignMutations, useF360Campaigns, useOrgId } from '../hooks/useFeedback360'
import CampaignDetail from '../components/CampaignDetail'
import CampaignFormDialog from '../components/CampaignFormDialog'
import { CampaignStatusBadge } from '../components/F360Common'
import { fmtDate } from '../utils/f360Format'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

type Filter = 'active' | 'draft' | 'done' | 'all'
const FILTERS = perLanguage((): { key: Filter; label: string; match: (s: F360CampaignStatus) => boolean }[] => ([
  { key: 'active', label: i18n.t('feedback360:F360AdminPage.running'), match: s => s === 'NOMINATING' || s === 'OPEN' },
  { key: 'draft', label: i18n.t('feedback360:F360AdminPage.draft'), match: s => s === 'DRAFT' },
  { key: 'done', label: i18n.t('feedback360:F360AdminPage.ended'), match: s => s === 'CLOSED' || s === 'RELEASED' },
  { key: 'all', label: i18n.t('feedback360:F360AdminPage.all'), match: () => true },
]))

/**
 * Đánh giá 360 phía quản trị — MỘT màn: danh sách chiến dịch → chi tiết chiến dịch.
 *
 * <p>Không có màn "Bộ câu hỏi" riêng: năng lực và câu hỏi được soạn thẳng trong form chiến dịch
 * (như hạng mục soạn trong bộ tiêu chí BSC), dùng lại đợt trước bằng "Chép câu hỏi từ".
 *
 * <p>Chiến dịch đang mở nằm trên URL (`?campaign=`) để nút Back và liên kết chia sẻ đưa về đúng chỗ.
 */
export default function F360AdminPage() {
  const { t } = useTranslation('feedback360')
  const orgId = useOrgId()
  const { data: org } = useOrganization(orgId)
  const { hasPermission } = useHasPermission()
  const canManage = hasPermission('FEEDBACK360:MANAGE')
  const [params, setParams] = useSearchParams()
  const campaignId = params.get('campaign')
  const [creating, setCreating] = useState(false)

  const { data: campaigns = [], isLoading } = useF360Campaigns()
  const m = useF360CampaignMutations()

  const running = campaigns.filter(c => c.status === 'NOMINATING' || c.status === 'OPEN').length
  // Mặc định mở bộ lọc có việc: đang chạy nếu có, không thì tất cả.
  const [filter, setFilter] = useState<Filter | null>(null)
  const activeFilter: Filter = filter ?? (running > 0 ? 'active' : 'all')

  const setParam = (key: string, value: string | null) =>
    setParams(prev => {
      const p = new URLSearchParams(prev)
      if (value) p.set(key, value)
      else p.delete(key)
      return p
    })

  if (org && !org.enableFeedback360) {
    return (
      <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState icon={Users} title={t('F360AdminPage.theOrganizationHasNotEnabled360')}
          description={t('F360AdminPage.anAdministratorEnablesThisFeatureIn')} />
      </div>
    )
  }

  if (campaignId) {
    return (
      <div className="mx-auto max-w-[1600px]">
        <CampaignDetail campaignId={campaignId} onBack={() => setParam('campaign', null)} />
      </div>
    )
  }

  const shown = campaigns.filter(c => FILTERS().find(f => f.key === activeFilter)!.match(c.status))

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        title={t('F360AdminPage.n360Feedback')}
        description={t('F360AdminPage.collectManagersPeersAndDirectReports')}
        stats={[
          { label: t('F360AdminPage.running'), value: running, icon: Users },
          { label: t('F360AdminPage.totalCampaigns'), value: campaigns.length },
        ]}
        actions={canManage ? <Button onClick={() => setCreating(true)}><Plus /> {t('F360AdminPage.createCampaign')}</Button> : undefined}
      />

      {isLoading && <LoadingSkeleton rows={4} />}

      {!isLoading && campaigns.length === 0 && (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState icon={Users} title={t('F360AdminPage.no360CampaignsYet')}
            description={canManage
              ? t('F360AdminPage.createACampaignChooseRevieweesAnd')
              : t('F360AdminPage.noCampaignIsRunningInYour')}
            action={canManage ? <Button onClick={() => setCreating(true)}><Plus /> {t('F360AdminPage.createTheFirstCampaign')}</Button> : undefined} />
        </div>
      )}

      {!isLoading && campaigns.length > 0 && (
        <>
          <div className="flex w-fit flex-wrap gap-0.5 rounded-control bg-[var(--color-muted)] p-0.5" role="tablist" aria-label={t('F360AdminPage.filterCampaigns')}>
            {FILTERS().filter(f => canManage || f.key !== 'draft').map(f => {
              const count = campaigns.filter(c => f.match(c.status)).length
              return (
                <ChoiceChip key={f.key} variant="segment" size="sm" role="tab" aria-selected={activeFilter === f.key}
                  selected={activeFilter === f.key} onClick={() => setFilter(f.key)}>
                  {f.label} <span className="ml-1 tabular-nums text-[var(--color-muted-foreground)]">{count}</span>
                </ChoiceChip>
              )
            })}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-card border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
              {t('F360AdminPage.noCampaignsInThisSection')}
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {shown.map(c => <CampaignCard key={c.id} campaign={c} onOpen={() => setParam('campaign', c.id)} />)}
            </div>
          )}
        </>
      )}

      {creating && (
        <CampaignFormDialog
          campaign={null}
          saving={m.create.isPending}
          onClose={() => setCreating(false)}
          onSubmit={body => m.create.mutate(body, {
            onSuccess: c => { setCreating(false); setParam('campaign', c.id) },
          })}
        />
      )}
    </div>
  )
}

function CampaignCard({ campaign: c, onOpen }: { campaign: F360Campaign; onOpen: () => void }) {
  const { t } = useTranslation('feedback360')
  const pct = c.assignmentCount ? Math.round((c.submittedCount / c.assignmentCount) * 100) : 0
  const collecting = c.status === 'OPEN'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition-colors hover:border-[var(--color-border-strong)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
    >
      <div className="flex w-full items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{c.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption">
            <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {c.status === 'DRAFT' && c.startAt ? t('F360AdminPage.opens', { startAt: fmtDate(c.startAt) }) : ''}{t('F360AdminPage.due')} {fmtDate(c.dueAt)}</span>
            {c.kpiCycleName && <span>{t('F360AdminPage.cycle')} {c.kpiCycleName}</span>}
            <span>· {c.subjectCount} {t('F360AdminPage.reviewees')}</span>
          </p>
        </div>
        <CampaignStatusBadge status={c.status} />
        <ChevronRight size={18} className="shrink-0 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5" />
      </div>
      {!!c.competencyNames?.length && (
        <div className="flex w-full flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-caption"><ListChecks size={12} /> {c.questionCount} {t('F360AdminPage.questions')}</span>
          {c.competencyNames.slice(0, 5).map(n => <Badge key={n} variant="secondary">{n}</Badge>)}
          {c.competencyNames.length > 5 && <span className="text-caption">+{c.competencyNames.length - 5}</span>}
        </div>
      )}
      {c.status !== 'DRAFT' && (
        <div className="w-full">
          <div className="flex justify-between text-caption">
            <span>{collecting ? t('F360AdminPage.formsSubmitted') : t('F360AdminPage.responseRate')}</span>
            <span className="tabular-nums">{c.submittedCount}/{c.assignmentCount} · {pct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
            <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </button>
  )
}
