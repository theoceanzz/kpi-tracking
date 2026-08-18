import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { giftApi } from '../api/giftApi'
import { RedemptionStatus } from '../types'
import type { CreateRedemptionRequest, GiftItemRequest } from '../types'

const errMsg = (error: any, fallback: string) => error?.response?.data?.message || fallback

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
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['giftsManage'],
    queryFn: () => giftApi.getForManage(),
  })

  const createMutation = useMutation({
    mutationFn: (data: GiftItemRequest) => giftApi.create(data),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success('Đã thêm quà tặng')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Thêm quà thất bại')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GiftItemRequest }) => giftApi.update(id, data),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success('Đã cập nhật quà tặng')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Cập nhật quà thất bại')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => giftApi.delete(id),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success('Đã xoá quà tặng')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Xoá quà thất bại')),
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
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['redemptions', 'me', page, size],
    queryFn: () => giftApi.getMyRedemptions(page, size),
  })

  const redeemMutation = useMutation({
    mutationFn: (data: CreateRedemptionRequest) => giftApi.redeem(data),
    onSuccess: (r) => {
      invalidateGiftData(qc)
      const points = r.pointsSpent.toLocaleString('vi-VN')

      // Quà ngoài không xuất được: điểm đã tự hoàn, và phải nói rõ là hoàn rồi — nếu
      // không người dùng sẽ tưởng vừa mất điểm mà chẳng được gì.
      if (r.status === RedemptionStatus.FAILED) {
        toast.error(`Chưa lấy được ${r.giftNameSnapshot}`, {
          description: `${r.fulfillmentError ?? 'Nhà cung cấp không xuất được quà.'} ${points} điểm đã được hoàn lại vào ví của bạn.`,
          duration: 8000,
        })
        return
      }

      // Đơn treo vì chưa rõ kết quả. KHÔNG nói "thất bại": quà có thể vẫn về.
      if (r.status === RedemptionStatus.PENDING && r.fulfillmentError) {
        toast.warning(`Đang chờ xác nhận quà ${r.giftNameSnapshot}`, {
          description:
            'Nhà cung cấp chưa phản hồi. Yêu cầu đang được giữ lại và sẽ tự hoàn điểm nếu quà không xuất được.',
          duration: 8000,
        })
        return
      }

      if (r.vouchers?.length) {
        toast.success(`Đã đổi ${r.giftNameSnapshot}`, {
          description: `Đã trừ ${points} điểm. Mã quà đang hiện trên màn hình và luôn xem lại được ở mục "Quà đã đổi".`,
          duration: 6000,
        })
        return
      }

      // Quà nhận ngay đã hoàn tất, không có "yêu cầu" nào đang chờ và cũng chẳng ai
      // từ chối được — nói như luồng chờ giao là nói sai với người dùng.
      if (r.status === RedemptionStatus.DELIVERED) {
        toast.success(`Đã đổi ${r.giftNameSnapshot}`, {
          description: `Đã trừ ${points} điểm. Quà đã được ghi nhận cho bạn.`,
          duration: 5000,
        })
        return
      }

      toast.success(`Đã gửi yêu cầu đổi ${r.giftNameSnapshot}`, {
        // Nói rõ điểm đã trừ NGAY — nếu không người dùng sẽ tưởng bị trừ nhầm khi thấy
        // số dư giảm mà quà chưa nhận được.
        description: `Đã trừ ${points} điểm. Bạn nhận quà trực tiếp tại công ty; nếu bị từ chối, điểm sẽ được hoàn lại.`,
        duration: 6000,
      })
    },
    onError: (error: any) => toast.error(errMsg(error, 'Đổi quà thất bại'), { duration: 6000 }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => giftApi.cancelRedemption(id),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success('Đã huỷ yêu cầu và hoàn lại điểm')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Huỷ yêu cầu thất bại')),
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
}) => {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['redemptions', 'manage', params],
    queryFn: () => giftApi.getRedemptions(params),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => giftApi.approveRedemption(id, note),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success('Đã duyệt yêu cầu đổi quà')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Duyệt thất bại')),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => giftApi.rejectRedemption(id, note),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success('Đã từ chối và hoàn lại điểm cho nhân viên')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Từ chối thất bại')),
  })

  const deliverMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => giftApi.deliverRedemption(id, note),
    onSuccess: () => {
      invalidateGiftData(qc)
      toast.success('Đã đánh dấu giao quà')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Cập nhật thất bại')),
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
