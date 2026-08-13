import { useState } from 'react'
import { X as XIcon, PackageCheck, ImageOff } from 'lucide-react'
import DataTable from '@/components/common/DataTable'
import Pagination from '@/components/common/Pagination'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { REDEMPTION_STATUS_STYLE } from './MyRedemptionsTable'
import { useRedemptions } from '../hooks/useGifts'
import { RedemptionStatus, type Redemption } from '../types'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function RedemptionsTab() {
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<RedemptionStatus | ''>('')
  const [rejecting, setRejecting] = useState<Redemption | null>(null)
  const size = 20

  const {
    data,
    isLoading,
    rejectRedemption,
    isRejecting,
    deliverRedemption,
    isDelivering,
  } = useRedemptions({ status: status || undefined, page, size })

  const rows = data?.content ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {([['', 'Tất cả'], ...Object.entries(REDEMPTION_STATUS_STYLE).map(([k, v]) => [k, v.label])] as [
          string,
          string,
        ][]).map(([key, label]) => (
          <button
            key={key || 'all'}
            onClick={() => {
              setStatus(key as RedemptionStatus | '')
              setPage(0)
            }}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors sm:text-sm ${
              status === key
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
          <EmptyState
            title={status ? 'Không có yêu cầu nào ở trạng thái này' : 'Chưa có yêu cầu đổi quà nào'}
            description={
              status
                ? 'Thử chọn trạng thái khác.'
                : 'Khi nhân viên đổi quà cần trao tay, yêu cầu sẽ hiện ở đây để bạn giao. Quà nhận ngay thì tự hoàn tất, không xuất hiện ở đây.'
            }
          />
        </div>
      ) : (
        <>
          <DataTable<Redemption>
            data={rows}
            keyExtractor={(row) => row.id}
            emptyMessage=""
            renderMobileCard={(row) => (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{row.userFullName}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {fmtDate(row.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${REDEMPTION_STATUS_STYLE[row.status].className}`}
                  >
                    {REDEMPTION_STATUS_STYLE[row.status].label}
                  </span>
                </div>
                <div className="text-sm">
                  {row.giftNameSnapshot}
                  {row.quantity > 1 && ` ×${row.quantity}`}
                  <span className="ml-2 font-semibold">
                    {row.pointsSpent.toLocaleString('vi-VN')} điểm
                  </span>
                </div>
                {row.note && (
                  <div className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs">
                    {row.note}
                  </div>
                )}
                <div className="flex gap-2 border-t border-[var(--color-border)] pt-2.5">
                  {(row.status === RedemptionStatus.PENDING ||
                    row.status === RedemptionStatus.APPROVED) && (
                    <>
                      <button
                        onClick={() => deliverRedemption({ id: row.id })}
                        disabled={isDelivering}
                        className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm text-white"
                      >
                        Đã giao quà
                      </button>
                      <button
                        onClick={() => setRejecting(row)}
                        className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-600"
                      >
                        Từ chối
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            columns={[
              {
                key: 'createdAt',
                className: 'align-top',
                header: 'Ngày',
                render: (row) => (
                  <span className="whitespace-nowrap text-[var(--color-muted-foreground)]">
                    {fmtDate(row.createdAt)}
                  </span>
                ),
              },
              {
                key: 'user',
                className: 'align-top',
                header: 'Nhân viên',
                render: (row) => (
                  <div>
                    <div className="font-medium">{row.userFullName}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {row.userEmail}
                    </div>
                  </div>
                ),
              },
              {
                key: 'gift',
                className: 'align-top',
                header: 'Quà',
                render: (row) => (
                  <div className="flex items-center gap-2.5">
                    {row.giftImageUrl ? (
                      <img
                        src={row.giftImageUrl}
                        alt=""
                        className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                        <ImageOff size={14} />
                      </div>
                    )}
                    <div>
                      <div>{row.giftNameSnapshot}</div>
                      {row.quantity > 1 && (
                        <div className="text-xs text-[var(--color-muted-foreground)]">
                          Số lượng: {row.quantity}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: 'note',
                className: 'align-top',
                header: 'Ghi chú',
                render: (row) => (
                  <span className="line-clamp-2 text-[var(--color-muted-foreground)]">
                    {row.note || '—'}
                  </span>
                ),
              },
              {
                key: 'pointsSpent',
                className: 'text-right align-top',
                header: 'Điểm',
                render: (row) => (
                  <span className="font-semibold">{row.pointsSpent.toLocaleString('vi-VN')}</span>
                ),
              },
              {
                key: 'status',
                className: 'align-top',
                header: 'Trạng thái',
                render: (row) => (
                  <div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${REDEMPTION_STATUS_STYLE[row.status].className}`}
                    >
                      {REDEMPTION_STATUS_STYLE[row.status].label}
                    </span>
                    {row.handledByName && (
                      <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                        {row.handledByName}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'actions',
                className: 'text-right align-top',
                header: '',
                render: (row) => (
                  <div className="flex justify-end gap-1">
                    {(row.status === RedemptionStatus.PENDING ||
                      row.status === RedemptionStatus.APPROVED) && (
                      <>
                        <button
                          onClick={() => deliverRedemption({ id: row.id })}
                          disabled={isDelivering}
                          title="Đánh dấu đã trao quà"
                          className="rounded-lg p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-accent)]"
                        >
                          <PackageCheck size={16} />
                        </button>
                        <button
                          onClick={() => setRejecting(row)}
                          title="Từ chối và hoàn điểm"
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-500/10"
                        >
                          <XIcon size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />

          {(data?.totalPages ?? 0) > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={data?.totalPages ?? 0}
                totalElements={data?.totalElements ?? 0}
                size={size}
                onPageChange={setPage}
                itemLabel="yêu cầu"
              />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={async () => {
          if (rejecting) await rejectRedemption({ id: rejecting.id })
          setRejecting(null)
        }}
        title="Từ chối yêu cầu đổi quà?"
        description={
          rejecting
            ? `${rejecting.pointsSpent.toLocaleString('vi-VN')} điểm sẽ được hoàn lại cho ${rejecting.userFullName}, và quà được trả về kho.`
            : ''
        }
        confirmLabel="Từ chối"
        loading={isRejecting}
      />
    </div>
  )
}
