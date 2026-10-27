import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { GitBranch, Route } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { formatDateTime } from '@/lib/utils'
import type { ApprovalFlowStatus } from '@/types/approvalChain'
import { approvalInboxApi } from '../api/approvalInboxApi'
import { OBJECT_OF_SUBJECT, type ApprovalInboxItem } from '../types'
import { DecisionDialog } from './ProcessApprovalsPage'

const SIZE = 20

const STATUS_VARIANT: Record<ApprovalFlowStatus, BadgeProps['variant']> = {
  IN_PROGRESS: 'info',
  APPROVED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
  CLOSED_BY_LOCK: 'secondary',
}

/**
 * "Quy trình của tôi": mọi thứ tôi đã gửi đi duyệt (KPI, bài nộp, điều chỉnh, đề xuất thưởng, đổi
 * quà, đơn từ…) — đang ở bước nào, ai đang giữ, và sơ đồ quy trình. Dành cho cả người không phải
 * quản lý: họ là người nằm dưới quy trình, chỉ cần biết việc của mình đã tới đâu.
 */
export default function MyProcessesPage() {
  const { t } = useTranslation('approvalProcess')
  const [active, setActive] = useState(true)
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<ApprovalInboxItem | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['approvals', 'mine', active, page],
    queryFn: () => approvalInboxApi.mine(active, page, SIZE),
    placeholderData: keepPreviousData,
  })
  const items = data?.content ?? []
  const switchTo = (next: boolean) => { setActive(next); setPage(0) }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <WorkspaceHeader
        title={t('mine.title')}
        description={t('mine.description')}
        stats={[{ label: active ? t('mine.running') : t('mine.finished'), value: data?.totalElements ?? 0, icon: Route }]}
        actions={
          <div className="flex gap-1" role="group" aria-label={t('mine.filter')}>
            <ChoiceChip variant="segment" selected={active} onClick={() => switchTo(true)}>{t('mine.running')}</ChoiceChip>
            <ChoiceChip variant="segment" selected={!active} onClick={() => switchTo(false)}>{t('mine.finished')}</ChoiceChip>
          </div>
        }
      />

      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : items.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState icon={Route} title={active ? t('mine.emptyRunning') : t('mine.emptyFinished')} description={t('mine.emptyHint')} />
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.flowId} className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{t(`objects.${OBJECT_OF_SUBJECT[item.subjectType]}`)}</Badge>
                    <h3 className="truncate text-sm font-semibold text-[var(--color-foreground)]">{item.subjectName}</h3>
                    <Badge variant={STATUS_VARIANT[item.status]}>{t(`mine.status.${item.status}`)}</Badge>
                  </div>
                  <p className="text-caption">
                    {item.processTitle && <>{item.processTitle} · </>}
                    {item.orgUnitName && <>{item.orgUnitName} · </>}
                    {t('mine.sent', { time: formatDateTime(item.startedAt) })}
                    {item.finishedAt && <> · {t('mine.ended', { time: formatDateTime(item.finishedAt) })}</>}
                  </p>
                  {item.approval && (
                    <p className="text-sm text-[var(--color-foreground)]">
                      {t('inbox.step', { number: item.approval.stepNumber, total: item.approval.totalSteps, step: item.approval.currentUnitName ?? '' })}
                      {item.approval.holderNames.length > 0 && <> · {t('mine.holders', { names: item.approval.holderNames.join(', ') })}</>}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setOpen(item)}>
                  <GitBranch aria-hidden="true" /> {t('mine.view')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage}
          totalElements={data.totalElements} size={SIZE} itemLabel={t('mine.itemLabel')} />
      )}

      {open && <DecisionDialog key={open.flowId} item={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
