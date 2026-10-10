import { useState, useEffect, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StatusBadge from '@/components/common/StatusBadge'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import DataTable from '@/components/common/DataTable'
import Pagination from '@/components/common/Pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMyAdjustments } from '../hooks/useMyAdjustments'
import { cn, formatDateTime, formatNumber } from '@/lib/utils'
import { Clock, History, Settings2, Send, ListChecks, CheckCircle2 } from 'lucide-react'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import AdjustmentKpiPickerModal from '../components/AdjustmentKpiPickerModal'
import KpiAdjustmentModal from '../components/KpiAdjustmentModal'
import KpiAdjustmentReviewModal from '../components/KpiAdjustmentReviewModal'
import { stepPositionLabel } from '../utils/approvalChainLabels'
import type { KpiAdjustmentRequest } from '@/types/adjustment'
import type { KpiCriteria } from '@/types/kpi'
import { useTranslation } from 'react-i18next'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useTourAction, useTourModal } from '@/components/common/tours/actions'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Đếm ngược 24h kể từ lúc gửi — quản lý phải trả lời trong khung này.
 * Chỉ chạy khi còn chờ duyệt; đã xử lý thì hiện dấu gạch để cột không trống.
 */
function useTimeLeft(createdAt: string, active: boolean) {
  const { t } = useTranslation('kpi')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [active])
  if (!active) return null
  const diff = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000 - now
  if (diff <= 0) return { text: t('MyAdjustmentsPage.responseOverdue'), expired: true }
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return { text: h > 0 ? t('MyAdjustmentsPage.hMinLeft', { h, m }) : t('MyAdjustmentsPage.minLeft', { m }), expired: false }
}

function TimeLeft({ createdAt, status }: { createdAt: string; status: string }) {
  const label = useTimeLeft(createdAt, status === 'PENDING')
  if (!label) return <span className="text-caption">—</span>
  return (
    <span className={cn('text-xs tabular-nums', label.expired ? 'text-[var(--color-error)]' : 'text-[var(--color-warning)]')}>
      {label.text}
    </span>
  )
}

/** Tóm tắt "hiện tại → đề xuất" cho những trường thực sự đổi. */
function ChangeSummary({ adj }: { adj: any }) {
  const { t } = useTranslation('kpi')
  if (adj.deactivationRequest) return <Badge variant="destructive">{t('MyAdjustmentsPage.requestToStopTheKpi')}</Badge>
  const items: { label: string; from: string; to: string }[] = []
  if (adj.requestedTargetValue != null && adj.requestedTargetValue !== adj.currentTargetValue)
    items.push({ label: t('MyAdjustmentsPage.target'), from: formatNumber(adj.currentTargetValue ?? 0), to: formatNumber(adj.requestedTargetValue) })
  if (adj.requestedWeight != null && adj.requestedWeight !== adj.currentWeight)
    items.push({ label: t('MyAdjustmentsPage.weight'), from: `${adj.currentWeight ?? 0}%`, to: `${adj.requestedWeight}%` })
  if (adj.requestedMinimumValue != null && adj.requestedMinimumValue !== adj.currentMinimumValue)
    items.push({ label: t('MyAdjustmentsPage.minimum'), from: formatNumber(adj.currentMinimumValue ?? 0), to: formatNumber(adj.requestedMinimumValue) })
  if (items.length === 0) return <span className="text-caption">{t('MyAdjustmentsPage.noChangeInFigures')}</span>
  return (
    <ul className="space-y-0.5">
      {items.map(it => (
        <li key={it.label} className="flex items-center gap-1.5 text-xs tabular-nums">
          <span className="text-[var(--color-muted-foreground)]">{it.label}</span>
          <span className="text-[var(--color-subtle-foreground)] line-through">{it.from}</span>
          <span aria-hidden="true" className="text-[var(--color-subtle-foreground)]">→</span>
          <span className="font-medium text-[var(--color-foreground)]">{it.to}</span>
        </li>
      ))}
    </ul>
  )
}

/** Còn chờ: đang ở bước nào của chuỗi duyệt, ai đang giữ — để người gửi biết mình đợi ai. */
function WaitingFor({ adj }: { adj: any }) {
  const { t } = useTranslation('kpi')
  if (adj.status !== 'PENDING') return null
  const label = adj.approval ? stepPositionLabel(adj.approval) : t('MyAdjustmentsPage.waitingForManager')
  return <p className="max-w-[220px] truncate text-xs text-[var(--color-warning)]" title={label}>{label}</p>
}

export default function MyAdjustmentsPage() {
  const { t } = useTranslation('kpi')
  const [page, setPage] = useState(0)
  const pageSize = 10
  const [pickerOpen, setPickerOpen] = useState(false)
  const [adjustKpi, setAdjustKpi] = useState<KpiCriteria | null>(null)
  const [viewRequest, setViewRequest] = useState<KpiAdjustmentRequest | null>(null)
  useTourModal('myadj.picker', () => { setAdjustKpi(null); setPickerOpen(true) }, () => setPickerOpen(false))
  useTourAction('myadj.modals.close', () => { setPickerOpen(false); setAdjustKpi(null) })

  const { data, isLoading } = useMyAdjustments({ page, size: pageSize })
  const adjustments = data?.content ?? []
  const pageTitle = usePageTitle('my-adjustments', t('MyAdjustmentsPage.myAdjustments'))

  const stats = useMemo(() => ({
    total: data?.totalElements ?? 0,
    pending: adjustments.filter((a: any) => a.status === 'PENDING').length,
    approved: adjustments.filter((a: any) => a.status === 'APPROVED').length,
  }), [data?.totalElements, adjustments])

  const columns = [
    { key: 'status', header: t('MyAdjustmentsPage.status'), render: (adj: any) => <StatusBadge status={adj.status} />, className: 'w-32' },
    {
      key: 'kpi', header: t('MyAdjustmentsPage.kpis'),
      render: (adj: any) => <p className="max-w-[260px] truncate font-medium text-[var(--color-foreground)]" title={adj.kpiCriteriaName}>{adj.kpiCriteriaName}</p>,
    },
    { key: 'change', header: t('MyAdjustmentsPage.change'), render: (adj: any) => <ChangeSummary adj={adj} /> },
    {
      key: 'reason', header: t('MyAdjustmentsPage.reason'),
      render: (adj: any) => <p className="max-w-[220px] truncate text-[var(--color-muted-foreground)]" title={adj.reason}>{adj.reason}</p>,
    },
    {
      key: 'sent', header: t('MyAdjustmentsPage.sentOn'),
      render: (adj: any) => (
        <div className="whitespace-nowrap">
          <p className="tabular-nums">{formatDateTime(adj.createdAt).split(' ')[0]}</p>
          <TimeLeft createdAt={adj.createdAt} status={adj.status} />
        </div>
      ),
    },
    {
      key: 'reply', header: t('MyAdjustmentsPage.response'),
      render: (adj: any) => (
        <>
          {adj.reviewerNote
            ? <p className="max-w-[220px] truncate" title={adj.reviewerNote}>{adj.reviewerNote}</p>
            : adj.status !== 'PENDING' && <span className="text-caption">{t('MyAdjustmentsPage.noComments')}</span>}
          <WaitingFor adj={adj} />
        </>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-myadj-header"
        title={pageTitle}
        description={t('MyAdjustmentsPage.requestsYouSentToChangeThe')}
        stats={[
          { label: t('MyAdjustmentsPage.request'), value: stats.total, icon: ListChecks },
          { label: t('MyAdjustmentsPage.pending'), value: stats.pending, icon: Clock },
          { label: t('MyAdjustmentsPage.approved'), value: stats.approved, icon: CheckCircle2 },
        ]}
        actions={
          <Button {...tourAnchor('myadj.add')} onClick={() => setPickerOpen(true)}>
            <Send aria-hidden="true" /> {t('MyAdjustmentsPage.createAdjustmentRequest')}
          </Button>
        }
      />

      <div {...tourAnchor('myadj.list')} id="tour-myadj-table">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={6} />
        ) : adjustments.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState
              icon={History}
              title={t('MyAdjustmentsPage.noRequestsYet')}
              description={t('MyAdjustmentsPage.whenATargetNoLongerFits')}
              action={
                <Button onClick={() => setPickerOpen(true)}>
                  <Settings2 aria-hidden="true" /> {t('MyAdjustmentsPage.chooseAKpiToAdjust')}
                </Button>
              }
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={adjustments}
            keyExtractor={(adj: any) => adj.id}
            onRowClick={(adj: any) => setViewRequest(adj)}
            renderMobileCard={(adj: any) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-medium text-[var(--color-foreground)]">{adj.kpiCriteriaName}</p>
                  <StatusBadge status={adj.status} />
                </div>
                <ChangeSummary adj={adj} />
                <p className="text-caption">{adj.reason}</p>
                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-xs">
                  <span className="tabular-nums text-[var(--color-muted-foreground)]">{t('MyAdjustmentsPage.send')} {formatDateTime(adj.createdAt).split(' ')[0]}</span>
                  <TimeLeft createdAt={adj.createdAt} status={adj.status} />
                </div>
                {adj.reviewerNote && <p className="text-xs text-[var(--color-foreground)]">{t('MyAdjustmentsPage.response2')} {adj.reviewerNote}</p>}
                <WaitingFor adj={adj} />
              </div>
            )}
          />
        )}
      </div>

      {data && data.totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={data.totalPages}
          totalElements={data.totalElements}
          size={pageSize}
          onPageChange={setPage}
          itemLabel={t('MyAdjustmentsPage.requests')}
        />
      )}

      {pickerOpen && (
        <AdjustmentKpiPickerModal
          onClose={() => setPickerOpen(false)}
          onSelect={(kpi) => { setPickerOpen(false); setAdjustKpi(kpi) }}
        />
      )}
      <KpiAdjustmentModal open={!!adjustKpi} onClose={() => setAdjustKpi(null)} kpi={adjustKpi} />
      {/* Chỉ xem: người gửi không giữ bước duyệt nên hộp không có nút duyệt — chỉ có chuỗi duyệt để biết đang chờ ai. */}
      <KpiAdjustmentReviewModal open={!!viewRequest} onClose={() => setViewRequest(null)} request={viewRequest} />
    </div>
  )
}
