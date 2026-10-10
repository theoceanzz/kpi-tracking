import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StatusBadge from '@/components/common/StatusBadge'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar, { SegmentedControl } from '@/components/common/FilterBar'
import Pagination from '@/components/common/Pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { useMySubmissions } from '../hooks/useMySubmissions'
import { Link } from 'react-router-dom'
import { formatDateTime, formatNumber, cn } from '@/lib/utils'
import type { SubmissionStatus } from '@/types/submission'
import { Plus, Pencil, Send, Loader2, Eye, Inbox, FileText, Clock, CheckCircle2, Star } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { tourAnchor } from '@/components/common/tours/anchors'

type TabKey = SubmissionStatus | ''
const TABS = perLanguage((): { key: TabKey; label: string }[] => ([
  { key: '', label: i18n.t('submissions:MySubmissionsPage.all') },
  { key: 'DRAFT', label: i18n.t('submissions:MySubmissionsPage.draft') },
  { key: 'PENDING', label: i18n.t('submissions:MySubmissionsPage.pendingApproval') },
  { key: 'APPROVED', label: i18n.t('submissions:MySubmissionsPage.approved') },
  { key: 'REJECTED', label: i18n.t('submissions:MySubmissionsPage.returned') },
]))

/** Phần trăm hoàn thành so với mục tiêu — cùng công thức cũ. */
const pctOf = (actual: number, target: number | null) =>
  target ? Math.min(Math.round((actual / target) * 100), 100) : actual <= 100 ? actual : 0

export default function MySubmissionsPage() {
  const { t: tr } = useTranslation('submissions')
  const [activeTab, setActiveTab] = useState<TabKey>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [finishedPeriodId, setFinishedPeriodId] = useState<string | null>(null)
  // Mở form tự đánh giá tại chỗ. Không điều hướng sang mục "Đánh giá của tôi": mục đó
  // gác bằng EVALUATION:VIEW_MY nên trưởng đơn vị đi sang là rơi về lưới thẻ của /me.
  const [selfEvalPeriodId, setSelfEvalPeriodId] = useState<string | null>(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState('ALL')
  
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const pageTitle = usePageTitle('my-submissions', tr('MySubmissionsPage.myReports'))
  const { data: periodsData } = useKpiPeriods({ organizationId: orgId })
  
  const qc = useQueryClient()
  
  const { data: myKpiData } = useMyKpi({ page: 0, size: 500 })

  const { data, isLoading } = useMySubmissions({
    status: activeTab || undefined,
    page,
    size: pageSize,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    sortBy,
    sortDir
  })

  const handleSortSelect = (value: string) => {
    const parts = value.split(':')
    if (parts.length === 2) {
      setSortBy(parts[0]!)
      setSortDir(parts[1]! as 'asc' | 'desc')
      setPage(0)
    }
  }

  const submitMutation = useMutation({
    mutationFn: (id: string) => submissionApi.update(id, { isDraft: false }),
    onSuccess: (_, submissionId) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      
      // Check if this was the last submission for the period
      const sub = allItems.find(s => s.id === submissionId)
      if (sub && myKpiData?.content) {
        const periodId = sub.kpiPeriod?.id
        const periodKpis = myKpiData.content.filter(k => k.kpiPeriodId === periodId) || []
        
        const isAllFinished = periodKpis.every(k => {
          const isCurrentKpi = k.id === sub.kpiCriteriaId
          const currentCount = isCurrentKpi ? k.submissionCount + 1 : k.submissionCount
          return currentCount >= k.expectedSubmissions
        })

        if (isAllFinished) {
          setFinishedPeriodId(periodId || null)
          setShowSuccess(true)
        } else {
          toast.success(tr('MySubmissionsPage.reportSubmittedForApproval'))
        }
      } else {
        toast.success(tr('MySubmissionsPage.reportSubmittedForApproval'))
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error, tr('MySubmissionsPage.failedToSubmitForApproval')))
  })

  const allItems = data?.content ?? []
  const filteredItems = allItems.filter(s => 
    s.kpiCriteriaName.toLowerCase().includes(search.toLowerCase())
  )

  // Quick stats
  const { data: allData } = useMySubmissions({ size: 1000 })
  const stats = useMemo(() => {
    const all = allData?.content ?? []
    return {
      total: all.length,
      approved: all.filter(s => s.status === 'APPROVED').length,
      pending: all.filter(s => s.status === 'PENDING').length,
    }
  }, [allData])

  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>(() => window.matchMedia('(max-width: 767px)').matches ? 'CARD' : 'TABLE')
  const countOf = (key: TabKey) => {
    const all = allData?.content ?? []
    return key === '' ? all.length : all.filter(s => s.status === key).length
  }
  const draftCount = countOf('DRAFT')

  const resultCell = (sub: (typeof allItems)[number]) => {
    if (sub.kpiType === 'QUALITATIVE') return <Badge variant="outline">{sub.qualitativeLevelName ?? tr('MySubmissionsPage.qualitative')}</Badge>
    const pct = pctOf(sub.actualValue, sub.targetValue)
  return (
      <div className="flex items-center justify-end gap-3 tabular-nums">
        <span className="font-medium text-[var(--color-foreground)]">{formatNumber(sub.actualValue)}</span>
        {sub.targetValue != null && (
          <span className="flex items-center gap-1.5 text-caption" title={tr('MySubmissionsPage.target', { targetValue: formatNumber(sub.targetValue) })}>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-muted)]" aria-hidden="true">
              <span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')} style={{ width: `${pct}%` }} />
            </span>
            {pct}%
          </span>
        )}
      </div>
    )
  }
      
  const rowActions = (sub: (typeof allItems)[number]) => (
    <div className="flex items-center justify-end gap-1">
      {sub.status === 'DRAFT' ? (
        <>
          <Button {...tourAnchor('mysub.edit')} asChild variant="ghost" size="icon-sm" aria-label={tr('MySubmissionsPage.editDraft')} title={tr('MySubmissionsPage.editDraft')}>
            <Link to={`/submissions/edit/${sub.id}`}><Pencil aria-hidden="true" /></Link>
          </Button>
          <Button {...tourAnchor('mysub.send')} size="sm" onClick={() => { setPendingId(sub.id); setShowConfirm(true) }} disabled={submitMutation.isPending && submitMutation.variables === sub.id}>
            {submitMutation.isPending && submitMutation.variables === sub.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} {tr('MySubmissionsPage.submitForApproval')}
          </Button>
        </>
      ) : (
        <Button asChild variant="ghost" size="icon-sm" aria-label={tr('MySubmissionsPage.viewDetails')} title={tr('MySubmissionsPage.viewDetails')}>
          <Link to={`/submissions/${sub.id}`}><Eye aria-hidden="true" /></Link>
        </Button>
      )}
          </div>
  )

  const emptyTitle = search ? tr('MySubmissionsPage.noReportFound') : activeTab === 'DRAFT' ? tr('MySubmissionsPage.noDrafts') : activeTab === 'PENDING' ? tr('MySubmissionsPage.noReportsPendingApproval') : activeTab === 'REJECTED' ? tr('MySubmissionsPage.noReturnedReports') : tr('MySubmissionsPage.youHaveNotSubmittedAnyReports')
  const emptyDesc = search ? tr('MySubmissionsPage.tryAnotherKeywordOrClearThe') : tr('MySubmissionsPage.goToMyKpisToSubmit')

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-my-sub-header"
        title={pageTitle}
        description={tr('MySubmissionsPage.resultReportsYouSubmittedForEach')}
        stats={[
          { label: tr('MySubmissionsPage.submitted'), value: stats.total, icon: FileText },
          { label: tr('MySubmissionsPage.pendingApproval'), value: stats.pending, icon: Clock },
          { label: tr('MySubmissionsPage.approved'), value: stats.approved, icon: CheckCircle2 },
        ]}
        actions={
          <Button {...tourAnchor('mysub.add')} asChild>
            <Link to="/submissions/new"><Plus aria-hidden="true" /> {tr('MySubmissionsPage.submitReport')}</Link>
          </Button>
        }
      />

      <FilterBar
        id="tour-my-sub-toolbar"
        search={{ value: search, onChange: v => { setSearch(v); setPage(0) }, placeholder: tr('MySubmissionsPage.searchByKpiName') }}
        trailing={
          <SegmentedControl ariaLabel={tr('MySubmissionsPage.display')} value={viewMode} onChange={setViewMode}
            options={[{ value: 'TABLE', label: tr('MySubmissionsPage.table') }, { value: 'CARD', label: tr('MySubmissionsPage.cards') }]} />
        }
          >
        <Select value={selectedPeriodId} onValueChange={v => { setSelectedPeriodId(v); setPage(0) }}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-52" aria-label={tr('MySubmissionsPage.evaluationPeriods')}><SelectValue placeholder={tr('MySubmissionsPage.evaluationPeriods')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('MySubmissionsPage.allPeriods')}</SelectItem>
            {periodsData?.content.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
        <Select value={`${sortBy}:${sortDir}`} onValueChange={handleSortSelect}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-44" aria-label={tr('MySubmissionsPage.order')}><SelectValue placeholder={tr('MySubmissionsPage.order')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt:desc">{tr('MySubmissionsPage.newestFirst')}</SelectItem>
            <SelectItem value="createdAt:asc">{tr('MySubmissionsPage.oldestFirst')}</SelectItem>
            <SelectItem value="kpiCriteriaName:asc">{tr('MySubmissionsPage.nameAZ')}</SelectItem>
            <SelectItem value="kpiCriteriaName:desc">{tr('MySubmissionsPage.nameZA')}</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <div {...tourAnchor('mysub.tabs')} id="tour-my-sub-tabs" className="flex items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel={tr('MySubmissionsPage.filterByStatus')}
          value={activeTab}
          onChange={(k) => { setActiveTab(k); setPage(0) }}
          options={TABS().map(t => ({ value: t.key, label: <>{t.label}<span className="text-[var(--color-muted-foreground)] tabular-nums">{countOf(t.key)}</span></> }))}
        />
        {draftCount > 0 && activeTab !== 'DRAFT' && (
          <Button {...tourAnchor('mysub.drafts')} variant="ghost" type="button" onClick={() => { setActiveTab('DRAFT'); setPage(0) }}>
            {draftCount} {tr('MySubmissionsPage.unsentDrafts')}
                </Button>
              )}
            </div>

      <div {...tourAnchor('mysub.list')} id="tour-my-sub-list">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={6} />
        ) : filteredItems.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState icon={Inbox} title={emptyTitle} description={emptyDesc} action={activeTab === '' && !search ? <Button asChild variant="outline"><Link to="/me?section=my-kpi">{tr('MySubmissionsPage.viewMyKpis')}</Link></Button> : undefined} />
          </div>
        ) : (
          <>
            {viewMode === 'TABLE' && (
              <div className="hidden overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] md:block">
                <table className="w-full">
              <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                      <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">{tr('MySubmissionsPage.kpis')}</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">{tr('MySubmissionsPage.aPeriod')}</th>
                      <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">{tr('MySubmissionsPage.result')}</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">{tr('MySubmissionsPage.submittedOn')}</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">{tr('MySubmissionsPage.status')}</th>
                      <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">{tr('MySubmissionsPage.actions')}</th>
                </tr>
              </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {filteredItems.map(sub => (
                      <tr key={sub.id} className="transition-colors hover:bg-[var(--color-muted)]">
                        <td className="px-4 py-3">
                          <div className="min-w-0 max-w-[360px]">
                            <Link to={`/submissions/${sub.id}`} className="block max-w-full truncate text-sm font-medium text-[var(--color-foreground)] hover:underline underline-offset-4" title={sub.kpiCriteriaName}>{sub.kpiCriteriaName}</Link>
                            {sub.status === 'REJECTED' && sub.reviewNote
                              ? <p className="mt-0.5 line-clamp-1 text-caption text-[var(--color-error)]" title={sub.reviewNote}>{tr('MySubmissionsPage.reason')} {sub.reviewNote}</p>
                              : sub.note && <p className="mt-0.5 line-clamp-1 text-caption" title={sub.note}>{sub.note}</p>}
                      </div>
                    </td>
                        <td className="px-4 py-3"><p className="max-w-[180px] truncate text-sm text-[var(--color-muted-foreground)]" title={sub.kpiPeriod?.name}>{sub.kpiPeriod?.name || '—'}</p></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{resultCell(sub)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm tabular-nums text-[var(--color-muted-foreground)]">{formatDateTime(sub.createdAt).split(' ')[0]}</td>
                        <td className="px-4 py-3"><StatusBadge status={sub.status} /></td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{rowActions(sub)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            )}

            <div className={cn('grid grid-cols-1 gap-3', viewMode === 'CARD' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:hidden')}>
              {filteredItems.map(sub => (
                <div key={sub.id} className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/submissions/${sub.id}`} className="line-clamp-2 text-sm font-medium text-[var(--color-foreground)]">{sub.kpiCriteriaName}</Link>
                      <p className="mt-0.5 truncate text-caption">{sub.kpiPeriod?.name || '—'} · {formatDateTime(sub.createdAt).split(' ')[0]}</p>
                    </div>
                    <StatusBadge status={sub.status} />
                  </div>
                  {sub.status === 'REJECTED' && sub.reviewNote && <p className="mt-2 line-clamp-2 text-caption text-[var(--color-error)]">{tr('MySubmissionsPage.reason')} {sub.reviewNote}</p>}
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                    {resultCell(sub)}
                    {rowActions(sub)}
                  </div>
                </div>
              ))}
            </div>
          </>
      )}
      </div>

      {data && data.totalElements > pageSize && (
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage} totalElements={data.totalElements} size={pageSize} itemLabel={tr('MySubmissionsPage.reports')} />
        </div>
      )}

      {/* Gửi duyệt là không hoàn tác được → hộp xác nhận chuẩn, nút chính là hành động (không phải phá huỷ) */}
      <Dialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        size="sm"
        title={tr('MySubmissionsPage.submitThisReportForApproval')}
        description={tr('MySubmissionsPage.afterSubmittingYouCannotEditIt')}
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowConfirm(false)}>{tr('MySubmissionsPage.cancel')}</Button>}
            primary={<Button onClick={() => { if (pendingId) { submitMutation.mutate(pendingId); setShowConfirm(false) } }}><Send aria-hidden="true" /> {tr('MySubmissionsPage.submitForApproval')}</Button>}
          />
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">{tr('MySubmissionsPage.yourDirectManagerWillBeNotified')}</p>
      </Dialog>

      {/* Nộp xong báo cáo cuối của đợt → mời tự đánh giá ngay, vì đây là bước kế tiếp trong luồng */}
      <Dialog
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        size="sm"
        title={tr('MySubmissionsPage.allReportsForThePeriodAre')}
        description={tr('MySubmissionsPage.youHaveCompletedAllKpisIn')}
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowSuccess(false)}>{tr('MySubmissionsPage.later')}</Button>}
            primary={<Button onClick={() => { setShowSuccess(false); setSelfEvalPeriodId(finishedPeriodId) }}><Star aria-hidden="true" /> {tr('MySubmissionsPage.selfAssessNow')}</Button>}
          />
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">{tr('MySubmissionsPage.theNextStepIsToSelf')}</p>
      </Dialog>

      <EvaluationFormModal open={!!selfEvalPeriodId} onClose={() => setSelfEvalPeriodId(null)} initialPeriodId={selfEvalPeriodId ?? undefined} />
    </div>
  )
}
