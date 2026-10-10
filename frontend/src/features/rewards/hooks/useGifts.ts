import { intlLocale } from '@/i18n/format'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { giftApi } from '../api/giftApi'
import { RedemptionStatus } from '../types'
import type { CreateRedemptionRequest, GiftItemRequest } from '../types'
import { useTranslation } from 'react-i18next'

const errMsg = (error: any, fallback: string) => getApiErrorMessage(error, fallback)

/**
 * Đổi quà đụng vào cả ví, sổ cái, tồn kho lẫn danh sách yêu cầu — làm mới hết một lượt
 * để không có màn hình nào hiện số cũ. Số dư sai sau khi đổi quà là lỗi người dùng
 * thấy ngay và mất niềm tin vào cả hệ thống điểm.
 */
const invalidateGiftData = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['rewardWallet'] })
  qc.invalidateQueries({ queryKey: ['rewardTransactions'] })
  qc.invalidateQueries({ queryKey: ['giftShop'] })
  qc.invalidateQueries({ queryKey: ['giftsManage'] })
  qc.invalidateQueries({ queryKey: ['redemptions'] })
}

// ── Cửa hàng quà (nhân viên) ─────────────────────────────────────

export const useGiftShop = (enabled = true) =>
  useQuery({
    queryKey: ['giftShop'],
    queryFn: () => giftApi.getShop(),
    enabled,
  })

// ── Quản lý danh mục quà ─────────────────────────────────────────

export const useGiftsManage = () => {
  const { t } = useTranslation('rewards')
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['giftsManage'],
    queryFn: () => giftApi.getForManage(),
  })

  const createMutation = useMutation({
    mutationFn: (data: GiftItemRequest) => giftApi.create(data),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success(t('useGifts.giftAdded'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useGifts.failedToAddGift'))),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GiftItemRequest }) => giftApi.update(id, data),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success(t('useGifts.giftUpdated'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useGifts.failedToUpdateGift'))),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => giftApi.delete(id),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success(t('useGifts.giftDeleted'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useGifts.failedToDeleteGift'))),
  })

  return {
    ...query,
    createGift: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateGift: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteGift: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  }
}

// ── Yêu cầu đổi quà của tôi ──────────────────────────────────────

export const useMyRedemptions = (page = 0, size = 20) => {
  const { t } = useTranslation('rewards')
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['redemptions', 'me', page, size],
    queryFn: () => giftApi.getMyRedemptions(page, size),
  })

  const redeemMutation = useMutation({
    mutationFn: (data: CreateRedemptionRequest) => giftApi.redeem(data),
    onSuccess: (r) => {
      invalidateGiftData(qc)
      const points = r.pointsSpent.toLocaleString(intlLocale())

      // Quà ngoài không xuất được: điểm đã tự hoàn, và phải nói rõ là hoàn rồi — nếu
      // không người dùng sẽ tưởng vừa mất điểm mà chẳng được gì.
      if (r.status === RedemptionStatus.FAILED) {
        toast.error(t('useGifts.couldNotGetYet', { giftNameSnapshot: r.giftNameSnapshot }), {
          description: t('useGifts.pointsHaveBeenRefundedToYour', { value: r.fulfillmentError ?? t('useGifts.theProviderCouldNotIssueThe'), points }),
          duration: 8000,
        })
        return
      }

      // Đơn treo vì chưa rõ kết quả. KHÔNG nói "thất bại": quà có thể vẫn về.
      if (r.status === RedemptionStatus.PENDING && r.fulfillmentError) {
        toast.warning(t('useGifts.waitingForConfirmationOfGift', { giftNameSnapshot: r.giftNameSnapshot }), {
          description:
            t('useGifts.theProviderHasNotRespondedYet'),
          duration: 8000,
        })
        return
      }

      if (r.vouchers?.length) {
        toast.success(t('useGifts.redeemed', { giftNameSnapshot: r.giftNameSnapshot }), {
          description: t('useGifts.pointsDeductedTheGiftCodeIs', { points }),
          duration: 6000,
        })
        return
      }

      // Quà nhận ngay đã hoàn tất, không có "yêu cầu" nào đang chờ và cũng chẳng ai
      // từ chối được — nói như luồng chờ giao là nói sai với người dùng.
      if (r.status === RedemptionStatus.DELIVERED) {
        toast.success(t('useGifts.redeemed', { giftNameSnapshot: r.giftNameSnapshot }), {
          description: t('useGifts.pointsDeductedTheGiftHasBeen', { points }),
          duration: 5000,
        })
        return
      }

      toast.success(t('useGifts.sentARequestToRedeem', { giftNameSnapshot: r.giftNameSnapshot }), {
        // Nói rõ điểm đã trừ NGAY — nếu không người dùng sẽ tưởng bị trừ nhầm khi thấy
        // số dư giảm mà quà chưa nhận được.
        description: t('useGifts.pointsDeductedYouWillReceiveThe', { points }),
        duration: 6000,
      })
    },
    onError: (error: any) => toast.error(errMsg(error, t('useGifts.giftRedemptionFailed')), { duration: 6000 }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => giftApi.cancelRedemption(id),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success(t('useGifts.requestCancelledAndPointsRefunded'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useGifts.failedToCancelTheRequest'))),
  })

  return {
    ...query,
    redeem: redeemMutation.mutateAsync,
    isRedeeming: redeemMutation.isPending,
    cancelRedemption: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  }
}

// ── Duyệt / giao quà ─────────────────────────────────────────────

export const useRedemptions = (params: {
  status?: RedemptionStatus
  page?: number
  size?: number
}, options: { enabled?: boolean } = {}) => {
  const { t } = useTranslation('rewards')
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['redemptions', 'manage', params],
    queryFn: () => giftApi.getRedemptions(params),
    enabled: options.enabled ?? true,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => giftApi.approveRedemption(id, note),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success(t('useGifts.giftRedemptionRequestApproved'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useGifts.approvalFailed'))),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => giftApi.rejectRedemption(id, note),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success(t('useGifts.rejectedAndPointsRefundedToThe'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useGifts.rejectionFailed'))),
  })

  const deliverMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => giftApi.deliverRedemption(id, note),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success(t('useGifts.markedTheGiftAsDelivered'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('useGifts.updateFailed'))),
  })

  return {
    ...query,
    approveRedemption: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    rejectRedemption: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    deliverRedemption: deliverMutation.mutateAsync,
    isDelivering: deliverMutation.isPending,
  }
}
