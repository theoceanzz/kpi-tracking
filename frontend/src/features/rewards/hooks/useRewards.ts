import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { rewardApi } from '../api/rewardApi'
import type {
  CreateRewardGrantRequest,
  GrantDecisionRequest,
  RewardBudgetRequest,
  RewardGrantStatus,
} from '../types'
import { useTranslation } from 'react-i18next'

const errMsg = (error: any, fallback: string) =>
  getApiErrorMessage(error, fallback)

/**
 * Làm mới mọi thứ liên quan đến điểm sau khi phát/thu hồi: ví, sổ cái, danh sách đề
 * nghị và hạn mức đều đổi cùng lúc. Gom vào một chỗ để không bỏ sót cái nào — hạn mức
 * còn lại mà không cập nhật là lỗi người dùng nhìn thấy ngay.
 */
const invalidateRewardData = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['rewardWallet'] })
  qc.invalidateQueries({ queryKey: ['rewardTransactions'] })
  qc.invalidateQueries({ queryKey: ['rewardGrants'] })
  qc.invalidateQueries({ queryKey: ['rewardBudget'] })
  qc.invalidateQueries({ queryKey: ['rewardBudgets'] })
  // Người có REWARD:APPROVE_OWN tự thưởng cho chính mình thì vừa là người trao vừa là người
  // nhận — thiếu khoá này thì tab "Phần thưởng của tôi" của họ vẫn trống sau khi vừa trao.
  qc.invalidateQueries({ queryKey: ['myAwards'] })
}

// ── Ví của tôi ───────────────────────────────────────────────────

export const useMyWallet = () =>
  useQuery({
    queryKey: ['rewardWallet', 'me'],
    queryFn: () => rewardApi.getMyWallet(),
  })

export const useMyTransactions = (page = 0, size = 20) =>
  useQuery({
    queryKey: ['rewardTransactions', 'me', page, size],
    queryFn: () => rewardApi.getMyTransactions(page, size),
  })

export const useWallets = (keyword: string, page = 0, size = 20) =>
  useQuery({
    queryKey: ['rewardWallet', 'list', keyword, page, size],
    queryFn: () => rewardApi.searchWallets({ keyword, page, size }),
  })

// ── Bảng tin ─────────────────────────────────────────────────────

/**
 * Dải tin chạy ngang. Tự làm mới mỗi 60 giây thay vì chỉ khi có thao tác: người xem để
 * màn hình mở cả buổi, mà cái hay của bảng tin là tin mới tự trôi tới.
 *
 * <p>KHÔNG nằm trong `invalidateRewardData` — dải tin đang chạy mà bị thay dữ liệu giữa
 * chừng sẽ nhảy vị trí trước mắt người đọc. Chờ nhịp làm mới kế tiếp là đủ.
 */
export const useRewardActivityFeed = (limit = 30, enabled = true) =>
  useQuery({
    queryKey: ['rewardActivity', limit],
    queryFn: () => rewardApi.getActivityFeed(limit),
    refetchInterval: 60_000,
    staleTime: 30_000,
    // Dải tin giờ nằm ở AppLayout nên chạy trên MỌI trang. Không có cờ này thì mỗi tài
    // khoản thiếu quyền sẽ nện một request 403 mỗi phút, suốt phiên làm việc.
    enabled,
  })

// ── Đề nghị thưởng ───────────────────────────────────────────────

export const useRewardGrants = (params: {
  status?: RewardGrantStatus
  grantorId?: string
  page?: number
  size?: number
}) => {
  const { t } = useTranslation('rewards')
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['rewardGrants', params],
    queryFn: () => rewardApi.getGrants(params),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateRewardGrantRequest) => rewardApi.createGrant(data),
    onSuccess: (grant) => {
      invalidateRewardData(qc)
      // Hai kết cục rất khác nhau: điểm đã vào ví, hay mới chỉ gửi đi chờ duyệt.
      // Báo chung một câu "thành công" sẽ khiến người trao tưởng đã xong.
      if (grant.requiresApproval) {
        toast.info(t('useRewards.proposalSentWaitingForManagerApproval'), {
          description: grant.approvalReason ?? undefined,
          duration: 6000,
        })
      } else {
        toast.success(
          t('useRewards.rewardedPointsToEmployees', { totalPoints: grant.totalPoints, count: grant.recipients.length }),
          {
            // Nói rõ giấy khen đã tới tay nhân viên chưa: người trao vừa tick "kèm giấy
            // khen" và cần biết việc đó có hiệu lực, thay vì phải mở lại đề nghị để kiểm.
            description: grant.certificateEnabled
              ? t('useRewards.theCertificateIsReadyClickThe')
              : undefined,
          }
        )
      }
    },
    onError: (error: any) => toast.error(errMsg(error, t('useRewards.rewardFailed'))),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: GrantDecisionRequest }) =>
      rewardApi.approveGrant(id, data),
    onSuccess: () => {
      invalidateRewardData(qc)
      toast.success(t('useRewards.approvedAndRewardPointsGiven'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useRewards.failedToApproveProposal'))),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: GrantDecisionRequest }) =>
      rewardApi.rejectGrant(id, data),
    onSuccess: () => {
      invalidateRewardData(qc)
      toast.success(t('useRewards.rewardProposalRejected'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useRewards.failedToRejectProposal'))),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => rewardApi.cancelGrant(id),
    onSuccess: () => {
      invalidateRewardData(qc)
      toast.success(t('useRewards.rewardProposalCancelled'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useRewards.failedToCancelProposal'))),
  })

  const revokeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: GrantDecisionRequest }) =>
      rewardApi.revokeGrant(id, data),
    onSuccess: () => {
      invalidateRewardData(qc)
      toast.success(t('useRewards.rewardPointsRevoked'))
    },
    onError: (error: any) =>
      toast.error(errMsg(error, t('useRewards.revokeFailed')), { duration: 8000 }),
  })

  return {
    ...query,
    createGrant: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    approveGrant: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    rejectGrant: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    cancelGrant: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    revokeGrant: revokeMutation.mutateAsync,
    isRevoking: revokeMutation.isPending,
  }
}

// ── Ngân sách ────────────────────────────────────────────────────

/** Hạn mức của chính mình — dùng để hiện "còn lại X/Y điểm" ngay trong modal thưởng. */
export const useMyBudget = (enabled = true) =>
  useQuery({
    queryKey: ['rewardBudget', 'me'],
    queryFn: () => rewardApi.getMyBudget(),
    enabled,
  })

export const useRewardBudgets = () => {
  const { t } = useTranslation('rewards')
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['rewardBudgets'],
    queryFn: () => rewardApi.getBudgets(),
  })

  const createMutation = useMutation({
    mutationFn: (data: RewardBudgetRequest) => rewardApi.createBudget(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rewardBudgets'] })
      qc.invalidateQueries({ queryKey: ['rewardBudget'] })
      toast.success(t('useRewards.rewardPointBudgetGranted'))
    },
    onError: (error: any) =>
      toast.error(errMsg(error, t('useRewards.failedToGrantBudget')), { duration: 8000 }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RewardBudgetRequest }) =>
      rewardApi.updateBudget(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rewardBudgets'] })
      qc.invalidateQueries({ queryKey: ['rewardBudget'] })
      toast.success(t('useRewards.quotaUpdated'))
    },
    onError: (error: any) =>
      toast.error(errMsg(error, t('useRewards.failedToUpdateBudget')), { duration: 8000 }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rewardApi.deleteBudget(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rewardBudgets'] })
      qc.invalidateQueries({ queryKey: ['rewardBudget'] })
      toast.success(t('useRewards.budgetDeleted'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useRewards.failedToDeleteBudget'))),
  })

  return {
    ...query,
    createBudget: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateBudget: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteBudget: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  }
}
