import { useState } from 'react'
import { Gift, Check, X as XIcon, Undo2, Ban, Award } from 'lucide-react'
import DataTable from '@/components/common/DataTable'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { WorkspaceHeaderActions } from '@/components/common/WorkspaceTabs'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useAuthStore } from '@/store/authStore'
import AwardPointsModal from './AwardPointsModal'
import RevokeGrantModal from './RevokeGrantModal'
import CertificateModal from './certificate/CertificateModal'
import { useRewardGrants } from '../hooks/useRewards'
import { RewardApprovalMode, RewardGrantStatus, type RewardGrant } from '../types'

const STATUS_STYLE: Record<RewardGrantStatus, { label: string; className: string }> = {
  [RewardGrantStatus.PENDING_APPROVAL]: {
    label: 'Chờ duyệt',
    className: 'bg-amber-500/15 text-amber-700',
  },
  [RewardGrantStatus.APPROVED]: {
    label: 'Đã thưởng',
    className: 'bg-emerald-500/15 text-emerald-700',
  },
  [RewardGrantStatus.REJECTED]: { label: 'Từ chối', className: 'bg-rose-500/15 text-rose-700' },
  [RewardGrantStatus.CANCELLED]: {
    label: 'Đã huỷ',
    className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  },
  [RewardGrantStatus.REVOKED]: { label: 'Đã thu hồi', className: 'bg-rose-500/15 text-rose-700' },
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function GrantsTab() {
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<RewardGrantStatus | ''>('')
  const [awardOpen, setAwardOpen] = useState(false)
  const [revoking, setRevoking] = useState<RewardGrant | null>(null)
  const [certifying, setCertifying] = useState<RewardGrant | null>(null)
  const size = 20

  const { user } = useAuthStore()
  const { hasPermission } = useHasPermission()
  const canGrant = hasPermission('REWARD:GRANT')
  const canApprove = hasPermission('REWARD:APPROVE')

  const {
    data,
    isLoading,
    approveGrant,
    isApproving,
    rejectGrant,
    isRejecting,
    cancelGrant,
  } = useRewardGrants({ status: status || undefined, page, size })

  return (
    <div>
      {/* Lọc bằng chip thay vì thẻ select: chỉ có 6 trạng thái, hiện hết ra thì thấy
          ngay đang lọc cái gì mà không phải mở dropdown. */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Xuống dòng chứ KHÔNG cuộn ngang: chip nằm ngoài khung nhìn thì người dùng
            không biết là có, tệ hơn hẳn so với việc vùng lọc cao thêm một dòng. */}
        <div className="flex flex-wrap gap-1.5">
          {([['', 'Tất cả'], ...Object.entries(STATUS_STYLE).map(([k, v]) => [k, v.label])] as [
            string,
            string,
          ][]).map(([key, label]) => (
            <button
              key={key || 'all'}
              onClick={() => {
                setStatus(key as RewardGrantStatus | '')
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

        {canGrant && (
          <WorkspaceHeaderActions>
            <button
              onClick={() => setAwardOpen(true)}
              className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 h-10 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Gift size={16} />
              Thưởng điểm
            </button>
          </WorkspaceHeaderActions>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : (data?.content ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
          <EmptyState
            title={status ? 'Không có đề nghị nào ở trạng thái này' : 'Chưa có đề nghị thưởng nào'}
            description={
              status
                ? 'Thử chọn trạng thái khác để xem các đề nghị đã có.'
                : 'Ghi nhận đóng góp của nhân viên bằng điểm thưởng — họ có thể dùng điểm để đổi quà.'
            }
            action={
              !status && canGrant ? (
                <button
                  onClick={() => setAwardOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
                >
                  <Gift size={16} />
                  Thưởng điểm ngay
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <DataTable<RewardGrant>
            data={data?.content ?? []}
            keyExtractor={(row) => row.id}
            // Trạng thái rỗng đã xử lý ở nhánh trên với EmptyState đầy đủ, nhánh này
            // chỉ chạy khi chắc chắn có dữ liệu.
            emptyMessage=""
            // Thẻ mobile tự viết: bản tự sinh của DataTable nhồi mọi ô vào cột phải của
            // một hàng flex, nên lý do dài và cụm nút thao tác (tiêu đề rỗng) đều vỡ.
            renderMobileCard={(row) => (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{row.grantorName}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {row.orgUnitName} · {fmtDate(row.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[row.status].className}`}
                  >
                    {STATUS_STYLE[row.status].label}
                  </span>
                </div>

                <div className="text-sm">
                  <span className="text-[var(--color-muted-foreground)]">Người nhận: </span>
                  {row.recipients.map((r) => r.fullName).join(', ')}
                </div>

                <div className="text-sm text-[var(--color-muted-foreground)]">{row.reason}</div>

                {row.status === RewardGrantStatus.PENDING_APPROVAL && row.approvalReason && (
                  <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                    {row.approvalReason}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2.5">
                  <span className="text-lg font-bold">
                    {row.totalPoints.toLocaleString('vi-VN')}
                    <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
                      điểm
                    </span>
                  </span>
                  <div className="flex gap-1">
                    {row.status === RewardGrantStatus.PENDING_APPROVAL && canApprove && (
                      <>
                        <button
                          onClick={() => approveGrant({ id: row.id })}
                          disabled={isApproving}
                          className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-sm text-emerald-600"
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => rejectGrant({ id: row.id })}
                          disabled={isRejecting}
                          className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-600"
                        >
                          Từ chối
                        </button>
                      </>
                    )}
                    {row.status === RewardGrantStatus.PENDING_APPROVAL &&
                      row.grantorUserId === user?.id && (
                        <button
                          onClick={() => cancelGrant(row.id)}
                          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                        >
                          Huỷ
                        </button>
                      )}
                    {row.status === RewardGrantStatus.APPROVED && row.certificateEnabled && (
                      <button
                        onClick={() => setCertifying(row)}
                        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                      >
                        Chứng nhận
                      </button>
                    )}
                    {row.status === RewardGrantStatus.APPROVED && canApprove && (
                      <button
                        onClick={() => setRevoking(row)}
                        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                      >
                        Thu hồi
                      </button>
                    )}
                  </div>
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
                key: 'grantorName',
                className: 'align-top',
                header: 'Người thưởng',
                render: (row) => (
                  <div>
                    <div className="font-medium">{row.grantorName}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {row.orgUnitName}
                    </div>
                  </div>
                ),
              },
              {
                key: 'recipients',
                className: 'align-top',
                header: 'Người nhận',
                render: (row) => (
                  <div>
                    <div>{row.recipients.length} nhân viên</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {row.recipients
                        .slice(0, 3)
                        .map((r) => r.fullName)
                        .join(', ')}
                      {row.recipients.length > 3 && ` +${row.recipients.length - 3}`}
                    </div>
                  </div>
                ),
              },
              {
                key: 'reason',
                className: 'align-top',
                header: 'Lý do',
                render: (row) => <span className="line-clamp-2">{row.reason}</span>,
              },
              {
                key: 'totalPoints',
                header: 'Tổng điểm',
                className: 'text-right align-top',
                render: (row) => (
                  <span className="font-semibold">
                    {row.totalPoints.toLocaleString('vi-VN')}
                  </span>
                ),
              },
              {
                key: 'status',
                className: 'align-top',
                header: 'Trạng thái',
                render: (row) => (
                  <div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[row.status].className}`}
                    >
                      {STATUS_STYLE[row.status].label}
                    </span>
                    {/* Phân biệt "tự duyệt trong hạn mức" với "được cấp trên duyệt" —
                        hai chuyện rất khác nhau khi rà soát sau này. */}
                    {row.status === RewardGrantStatus.APPROVED &&
                      row.approvalMode === RewardApprovalMode.MANUAL && (
                        <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                          {row.approverName} duyệt
                        </div>
                      )}
                    {row.status === RewardGrantStatus.PENDING_APPROVAL && row.approvalReason && (
                      <div className="mt-0.5 max-w-[220px] text-xs text-amber-700">
                        {row.approvalReason}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'actions',
                header: '',
                className: 'text-right align-top',
                render: (row) => (
                  <div className="flex justify-end gap-1">
                    {row.status === RewardGrantStatus.PENDING_APPROVAL && canApprove && (
                      <>
                        <button
                          onClick={() => approveGrant({ id: row.id })}
                          disabled={isApproving}
                          title="Duyệt"
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-500/10"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => rejectGrant({ id: row.id })}
                          disabled={isRejecting}
                          title="Từ chối"
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-500/10"
                        >
                          <XIcon size={16} />
                        </button>
                      </>
                    )}
                    {row.status === RewardGrantStatus.PENDING_APPROVAL &&
                      row.grantorUserId === user?.id && (
                        <button
                          onClick={() => cancelGrant(row.id)}
                          title="Huỷ đề nghị"
                          className="rounded-lg p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
                        >
                          <Ban size={16} />
                        </button>
                      )}
                    {/* Hai điều kiện: ĐÃ DUYỆT (giấy khen cho việc chưa được công nhận
                        là vô nghĩa) và người trao đã tick kèm giấy khen lúc thưởng.
                        Không gắn quyền riêng — ai xem được lượt thưởng thì in được. */}
                    {row.status === RewardGrantStatus.APPROVED && row.certificateEnabled && (
                      <button
                        onClick={() => setCertifying(row)}
                        title="In chứng nhận"
                        className="rounded-lg p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
                      >
                        <Award size={16} />
                      </button>
                    )}
                    {row.status === RewardGrantStatus.APPROVED && canApprove && (
                      <button
                        onClick={() => setRevoking(row)}
                        title="Thu hồi"
                        className="rounded-lg p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
                      >
                        <Undo2 size={16} />
                      </button>
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
                itemLabel="đề nghị"
              />
            </div>
          )}
        </>
      )}

      <AwardPointsModal open={awardOpen} onClose={() => setAwardOpen(false)} />

      {/* Modal riêng thay cho ConfirmDialog chung: cần hiện bảng ai bị trừ bao nhiêu
          và số dư sau đó, vì thu hồi không hoàn tác được. */}
      <RevokeGrantModal grant={revoking} onClose={() => setRevoking(null)} />

      {/* Chỉ mở được từ lượt thưởng ĐÃ DUYỆT — xem ghi chú ở nút "In chứng nhận". */}
      <CertificateModal grant={certifying} onClose={() => setCertifying(null)} />
    </div>
  )
}
