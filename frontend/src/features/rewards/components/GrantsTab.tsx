import { intlDateLocale, intlLocale } from '@/i18n/format'
import { useState } from 'react'
import { Gift, Check, X as XIcon, Undo2, Ban, Award } from 'lucide-react'
import DataTable from '@/components/common/DataTable'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { WorkspaceHeaderActions } from '@/components/common/WorkspaceTabs'
import { useHasPermission } from '@/components/auth/PermissionGate'
import AiShortcutButton from '@/features/analytics/components/AiShortcutButton'
import { aiShortcuts } from '@/features/analytics/aiShortcuts'
import { useAuthStore } from '@/store/authStore'
import AwardPointsModal from './AwardPointsModal'
import RevokeGrantModal from './RevokeGrantModal'
import CertificateModal from './certificate/CertificateModal'
import { useRewardGrants } from '../hooks/useRewards'
import { RewardApprovalMode, RewardGrantStatus, type RewardGrant } from '../types'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useTourModal } from '@/components/common/tours/actions'

const STATUS_STYLE = perLanguage((): Record<RewardGrantStatus, { label: string; className: string }> => ({
  [RewardGrantStatus.PENDING_APPROVAL]: {
    label: i18n.t('rewards:GrantsTab.pendingApproval'),
    className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  },
  [RewardGrantStatus.APPROVED]: {
    label: i18n.t('rewards:GrantsTab.rewarded'),
    className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  },
  [RewardGrantStatus.REJECTED]: { label: i18n.t('rewards:GrantsTab.rejected'), className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]' },
  [RewardGrantStatus.CANCELLED]: {
    label: i18n.t('rewards:GrantsTab.cancelled'),
    className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  },
  [RewardGrantStatus.REVOKED]: { label: i18n.t('rewards:GrantsTab.revoked'), className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]' },
}))

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(intlDateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function GrantsTab() {
  const { t } = useTranslation('rewards')
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<RewardGrantStatus | ''>('')
  const [awardOpen, setAwardOpen] = useState(false)
  useTourModal('rewards.award', () => { if (canGrant) setAwardOpen(true) }, () => setAwardOpen(false))
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
    <div id="tour-grants-root">
      {/* Lọc bằng chip thay vì thẻ select: chỉ có 6 trạng thái, hiện hết ra thì thấy
          ngay đang lọc cái gì mà không phải mở dropdown. */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Xuống dòng chứ KHÔNG cuộn ngang: chip nằm ngoài khung nhìn thì người dùng
            không biết là có, tệ hơn hẳn so với việc vùng lọc cao thêm một dòng. */}
        <div {...tourAnchor('grants.filters')} id="tour-grants-filters" className="flex flex-wrap gap-1.5">
          {([['', t('GrantsTab.all')], ...Object.entries(STATUS_STYLE()).map(([k, v]) => [k, v.label])] as [
            string,
            string,
          ][]).map(([key, label]) => (
            <ChoiceChip selected={status === key} variant="solid" className="py-1.5 sm:text-sm" key={key || 'all'} onClick={() => {
                setStatus(key as RewardGrantStatus | '')
                setPage(0)
              }}>
              {label}
            </ChoiceChip>
          ))}
        </div>

        {(canGrant || canApprove) && (
          <WorkspaceHeaderActions>
            {canApprove && (
              <AiShortcutButton {...tourAnchor('grants.ai')}
                label={t('GrantsTab.approveWithKAi')}
                prompt={aiShortcuts.reviewRewardGrants()}
                title={t('GrantsTab.kAiListsThePendingReward')}
              />
            )}
            {canGrant && (
              <Button {...tourAnchor('grants.award')} onClick={() => setAwardOpen(true)}>
                <Gift aria-hidden="true" />
                {t('GrantsTab.rewardPoints')}
              </Button>
            )}
          </WorkspaceHeaderActions>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : (data?.content ?? []).length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState
            title={status ? t('GrantsTab.noProposalsInThisStatus') : t('GrantsTab.noRewardProposalsYet')}
            description={
              status
                ? t('GrantsTab.tryChoosingAnotherStatusToSee')
                : t('GrantsTab.recognizeEmployeesContributionsWithRewardPoints')
            }
            action={
              !status && canGrant ? (
                <Button onClick={() => setAwardOpen(true)}>
                  <Gift aria-hidden="true" />
                  {t('GrantsTab.rewardPointsNow')}
                </Button>
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
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE()[row.status].className}`}
                  >
                    {STATUS_STYLE()[row.status].label}
                  </span>
                </div>

                <div className="text-sm">
                  <span className="text-[var(--color-muted-foreground)]">{t('GrantsTab.recipients')} </span>
                  {row.recipients.map((r) => r.fullName).join(', ')}
                </div>

                <div className="text-sm text-[var(--color-muted-foreground)]">{row.reason}</div>

                {row.status === RewardGrantStatus.PENDING_APPROVAL && row.approvalReason && (
                  <div className="rounded-control bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
                    {row.approvalReason}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2.5">
                  <span className="text-lg font-semibold">
                    {row.totalPoints.toLocaleString(intlLocale())}
                    <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
                      {t('GrantsTab.points')}
                    </span>
                  </span>
                  <div className="flex gap-1">
                    {row.status === RewardGrantStatus.PENDING_APPROVAL && canApprove && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => approveGrant({ id: row.id })} disabled={isApproving}>
                          {t('GrantsTab.approve')}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => rejectGrant({ id: row.id })} disabled={isRejecting}>
                          {t('GrantsTab.rejected')}
                        </Button>
                      </>
                    )}
                    {row.status === RewardGrantStatus.PENDING_APPROVAL &&
                      row.grantorUserId === user?.id && (
                        <Button variant="outline" size="sm" onClick={() => cancelGrant(row.id)}>
                          {t('GrantsTab.cancel')}
                        </Button>
                      )}
                    {row.status === RewardGrantStatus.APPROVED && row.certificateEnabled && (
                      <Button variant="outline" size="sm" onClick={() => setCertifying(row)}>
                        {t('GrantsTab.certificates')}
                      </Button>
                    )}
                    {row.status === RewardGrantStatus.APPROVED && canApprove && (
                      <Button variant="outline" size="sm" onClick={() => setRevoking(row)}>
                        {t('GrantsTab.revoke')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            columns={[
              {
                key: 'createdAt',
                className: 'align-top',
                header: t('GrantsTab.date'),
                render: (row) => (
                  <span className="whitespace-nowrap text-[var(--color-muted-foreground)]">
                    {fmtDate(row.createdAt)}
                  </span>
                ),
              },
              {
                key: 'grantorName',
                className: 'align-top',
                header: t('GrantsTab.givenBy'),
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
                header: t('GrantsTab.recipient'),
                render: (row) => (
                  <div>
                    <div>{t('GrantsTab.employeeCount', { count: row.recipients.length })}</div>
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
                header: t('GrantsTab.reason'),
                render: (row) => <span className="line-clamp-2">{row.reason}</span>,
              },
              {
                key: 'totalPoints',
                header: t('GrantsTab.totalPoints'),
                className: 'text-right align-top',
                render: (row) => (
                  <span className="font-semibold">
                    {row.totalPoints.toLocaleString(intlLocale())}
                  </span>
                ),
              },
              {
                key: 'status',
                className: 'align-top',
                header: t('GrantsTab.status'),
                render: (row) => (
                  <div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE()[row.status].className}`}
                    >
                      {STATUS_STYLE()[row.status].label}
                    </span>
                    {/* Phân biệt "tự duyệt trong hạn mức" với "được cấp trên duyệt" —
                        hai chuyện rất khác nhau khi rà soát sau này. */}
                    {row.status === RewardGrantStatus.APPROVED &&
                      row.approvalMode === RewardApprovalMode.MANUAL && (
                        <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                          {row.approverName} {t('GrantsTab.approve2')}
                        </div>
                      )}
                    {row.status === RewardGrantStatus.PENDING_APPROVAL && row.approvalReason && (
                      <div className="mt-0.5 max-w-[220px] text-xs text-[var(--color-warning)]">
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
                        <Button variant="ghost" size="icon-sm" aria-label={t('GrantsTab.approve')} onClick={() => approveGrant({ id: row.id })} disabled={isApproving} title={t('GrantsTab.approve')}>
                          <Check aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label={t('GrantsTab.rejected')} onClick={() => rejectGrant({ id: row.id })} disabled={isRejecting} title={t('GrantsTab.rejected')}>
                          <XIcon aria-hidden="true" />
                        </Button>
                      </>
                    )}
                    {row.status === RewardGrantStatus.PENDING_APPROVAL &&
                      row.grantorUserId === user?.id && (
                        <Button variant="ghost" size="icon-sm" aria-label={t('GrantsTab.cancelProposal')} onClick={() => cancelGrant(row.id)} title={t('GrantsTab.cancelProposal')}>
                          <Ban aria-hidden="true" />
                        </Button>
                      )}
                    {/* Hai điều kiện: ĐÃ DUYỆT (giấy khen cho việc chưa được công nhận
                        là vô nghĩa) và người trao đã tick kèm giấy khen lúc thưởng.
                        Không gắn quyền riêng — ai xem được lượt thưởng thì in được. */}
                    {row.status === RewardGrantStatus.APPROVED && row.certificateEnabled && (
                      <Button variant="ghost" size="icon-sm" aria-label={t('GrantsTab.printCertificate')} onClick={() => setCertifying(row)} title={t('GrantsTab.printCertificate')}>
                        <Award aria-hidden="true" />
                      </Button>
                    )}
                    {row.status === RewardGrantStatus.APPROVED && canApprove && (
                      <Button variant="ghost" size="icon-sm" aria-label={t('GrantsTab.revoke')} onClick={() => setRevoking(row)} title={t('GrantsTab.revoke')}>
                        <Undo2 aria-hidden="true" />
                      </Button>
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
                itemLabel={t('GrantsTab.proposals')}
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
