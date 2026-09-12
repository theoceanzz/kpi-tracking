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
import type { KpiCriteria } from '@/types/kpi'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Đếm ngược 24h kể từ lúc gửi — quản lý phải trả lời trong khung này.
 * Chỉ chạy khi còn chờ duyệt; đã xử lý thì hiện dấu gạch để cột không trống.
 */
function useTimeLeft(createdAt: string, active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [active])
  if (!active) return null
  const diff = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000 - now
  if (diff <= 0) return { text: 'Quá hạn phản hồi', expired: true }
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return { text: h > 0 ? `Còn ${h} giờ ${m} phút` : `Còn ${m} phút`, expired: false }
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
  if (adj.deactivationRequest) return <Badge variant="destructive">Xin dừng chỉ tiêu</Badge>
  const items: { label: string; from: string; to: string }[] = []
  if (adj.requestedTargetValue != null && adj.requestedTargetValue !== adj.currentTargetValue)
    items.push({ label: 'Mục tiêu', from: formatNumber(adj.currentTargetValue ?? 0), to: formatNumber(adj.requestedTargetValue) })
  if (adj.requestedWeight != null && adj.requestedWeight !== adj.currentWeight)
    items.push({ label: 'Trọng số', from: `${adj.currentWeight ?? 0}%`, to: `${adj.requestedWeight}%` })
  if (adj.requestedMinimumValue != null && adj.requestedMinimumValue !== adj.currentMinimumValue)
    items.push({ label: 'Tối thiểu', from: formatNumber(adj.currentMinimumValue ?? 0), to: formatNumber(adj.requestedMinimumValue) })
  if (items.length === 0) return <span className="text-caption">Không đổi số liệu</span>
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

export default function MyAdjustmentsPage() {
  const [page, setPage] = useState(0)
  const pageSize = 10
  const [pickerOpen, setPickerOpen] = useState(false)
  const [adjustKpi, setAdjustKpi] = useState<KpiCriteria | null>(null)

  const { data, isLoading } = useMyAdjustments({ page, size: pageSize })
  const adjustments = data?.content ?? []
  const pageTitle = usePageTitle('my-adjustments', 'Điều chỉnh của tôi')

  const stats = useMemo(() => ({
    total: data?.totalElements ?? 0,
    pending: adjustments.filter((a: any) => a.status === 'PENDING').length,
    approved: adjustments.filter((a: any) => a.status === 'APPROVED').length,
  }), [data?.totalElements, adjustments])

  const columns = [
    { key: 'status', header: 'Trạng thái', render: (adj: any) => <StatusBadge status={adj.status} />, className: 'w-32' },
    {
      key: 'kpi', header: 'Chỉ tiêu',
      render: (adj: any) => <p className="max-w-[260px] truncate font-medium text-[var(--color-foreground)]" title={adj.kpiCriteriaName}>{adj.kpiCriteriaName}</p>,
    },
    { key: 'change', header: 'Thay đổi', render: (adj: any) => <ChangeSummary adj={adj} /> },
    {
      key: 'reason', header: 'Lý do',
      render: (adj: any) => <p className="max-w-[220px] truncate text-[var(--color-muted-foreground)]" title={adj.reason}>{adj.reason}</p>,
    },
    {
      key: 'sent', header: 'Ngày gửi',
      render: (adj: any) => (
        <div className="whitespace-nowrap">
          <p className="tabular-nums">{formatDateTime(adj.createdAt).split(' ')[0]}</p>
          <TimeLeft createdAt={adj.createdAt} status={adj.status} />
        </div>
      ),
    },
    {
      key: 'reply', header: 'Phản hồi',
      render: (adj: any) => adj.reviewerNote
        ? <p className="max-w-[220px] truncate" title={adj.reviewerNote}>{adj.reviewerNote}</p>
        : <span className="text-caption">{adj.status === 'PENDING' ? 'Đang chờ quản lý' : 'Không có nhận xét'}</span>,
    },
  ]

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-myadj-header"
        title={pageTitle}
        description="Yêu cầu đổi mục tiêu, trọng số hoặc xin dừng chỉ tiêu bạn đã gửi. Quản lý trực tiếp có 24 giờ để phản hồi."
        stats={[
          { label: 'Yêu cầu', value: stats.total, icon: ListChecks },
          { label: 'Đang chờ', value: stats.pending, icon: Clock },
          { label: 'Đã duyệt', value: stats.approved, icon: CheckCircle2 },
        ]}
        actions={
          <Button onClick={() => setPickerOpen(true)}>
            <Send aria-hidden="true" /> Tạo yêu cầu điều chỉnh
          </Button>
        }
      />

      <div id="tour-myadj-table">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={6} />
        ) : adjustments.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState
              icon={History}
              title="Chưa có yêu cầu nào"
              description="Khi mục tiêu không còn phù hợp, hãy chọn chỉ tiêu và gửi đề nghị điều chỉnh cho quản lý."
              action={
                <Button onClick={() => setPickerOpen(true)}>
                  <Settings2 aria-hidden="true" /> Chọn chỉ tiêu để điều chỉnh
                </Button>
              }
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={adjustments}
            keyExtractor={(adj: any) => adj.id}
            renderMobileCard={(adj: any) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-medium text-[var(--color-foreground)]">{adj.kpiCriteriaName}</p>
                  <StatusBadge status={adj.status} />
                </div>
                <ChangeSummary adj={adj} />
                <p className="text-caption">{adj.reason}</p>
                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-xs">
                  <span className="tabular-nums text-[var(--color-muted-foreground)]">Gửi {formatDateTime(adj.createdAt).split(' ')[0]}</span>
                  <TimeLeft createdAt={adj.createdAt} status={adj.status} />
                </div>
                {adj.reviewerNote && <p className="text-xs text-[var(--color-foreground)]">Phản hồi: {adj.reviewerNote}</p>}
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
          itemLabel="yêu cầu"
        />
      )}

      {pickerOpen && (
        <AdjustmentKpiPickerModal
          onClose={() => setPickerOpen(false)}
          onSelect={(kpi) => { setPickerOpen(false); setAdjustKpi(kpi) }}
        />
      )}
      <KpiAdjustmentModal open={!!adjustKpi} onClose={() => setAdjustKpi(null)} kpi={adjustKpi} />
    </div>
  )
}
