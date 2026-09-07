import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { walletApi } from '../api/walletApi'
import {
  TopupOrderStatus,
  type ConvertToPointsRequest,
  type CreateTopupRequest,
  type ResolveSepayEventRequest,
  type WalletConfigRequest,
} from '../types'

const errMsg = (error: any, fallback: string) => error?.response?.data?.message || fallback

/**
 * Làm mới mọi thứ đổi theo một giao dịch ví.
 *
 * <p>Có cả khoá của ví ĐIỂM, và đó là điểm mấu chốt: quy đổi trừ ví tiền và cộng
 * ví điểm trong cùng một lệnh, nên bỏ sót nhóm khoá kia sẽ khiến trang "Điểm của
 * tôi" hiện số cũ ngay sau khi người dùng vừa đổi xong.
 */
const invalidateWalletData = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['cashWallet'] })
  qc.invalidateQueries({ queryKey: ['cashTransactions'] })
  qc.invalidateQueries({ queryKey: ['topupOrders'] })
  qc.invalidateQueries({ queryKey: ['sepayEvents'] })
  qc.invalidateQueries({ queryKey: ['walletReconcile'] })
  qc.invalidateQueries({ queryKey: ['rewardWallet'] })
  qc.invalidateQueries({ queryKey: ['rewardTransactions'] })
}

// ── Ví của tôi ───────────────────────────────────────────────────

export const useMyCashWallet = () =>
  useQuery({
    queryKey: ['cashWallet', 'me'],
    queryFn: () => walletApi.getMyWallet(),
  })

export const useMyCashTransactions = (page = 0, size = 20) =>
  useQuery({
    queryKey: ['cashTransactions', 'me', page, size],
    queryFn: () => walletApi.getMyTransactions(page, size),
  })

export const useCashWallets = (
  keyword: string,
  orgUnitId?: string,
  onlyInconsistent = false,
  page = 0,
  size = 20,
  /**
   * Chặn lần gọi đầu khi cây đơn vị chưa tải xong. Không có nó thì màn hình loé
   * lên danh sách toàn công ty rồi mới thu về đúng đơn vị gốc đang chọn.
   */
  enabled = true,
) =>
  useQuery({
    queryKey: ['cashWallet', 'list', keyword, orgUnitId, onlyInconsistent, page, size],
    queryFn: () =>
      walletApi.searchWallets({ keyword, orgUnitId, onlyInconsistent, page, size }),
    enabled,
  })

export const useCashWalletSummary = () =>
  useQuery({
    queryKey: ['cashWallet', 'summary'],
    queryFn: () => walletApi.getWalletSummary(),
  })

/** Sổ cái của một nhân sự cụ thể, mở từ bảng ví nhân sự. */
export const useUserCashTransactions = (userId?: string, page = 0, size = 20) =>
  useQuery({
    queryKey: ['cashTransactions', 'user', userId, page, size],
    queryFn: () => walletApi.getUserTransactions(userId!, page, size),
    enabled: !!userId,
  })

// ── Nạp tiền ─────────────────────────────────────────────────────

export const useMyTopups = (page = 0, size = 20) =>
  useQuery({
    queryKey: ['topupOrders', 'me', page, size],
    queryFn: () => walletApi.getMyTopups(page, size),
  })

/**
 * Theo dõi một đơn nạp trong lúc chờ người dùng chuyển khoản.
 *
 * <p>Hỏi lại mỗi 5 giây khi đơn còn chờ, và DỪNG khi đã sang trạng thái khác —
 * để nguyên nhịp hỏi sau khi đơn xong là gọi API vô ích suốt thời gian người dùng
 * còn mở tab.
 */
export const useTopupOrder = (id?: string) =>
  useQuery({
    queryKey: ['topupOrders', 'detail', id],
    queryFn: () => walletApi.getTopup(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === TopupOrderStatus.PENDING ? 5000 : false,
  })

export const useTopupActions = () => {
  const qc = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (data: CreateTopupRequest) => walletApi.createTopup(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topupOrders'] }),
    onError: (error: any) => toast.error(errMsg(error, 'Tạo đơn nạp tiền thất bại')),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => walletApi.cancelTopup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topupOrders'] })
      toast.success('Đã huỷ đơn nạp tiền')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Huỷ đơn nạp thất bại')),
  })

  return {
    createTopup: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    cancelTopup: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  }
}

// ── Quy đổi ──────────────────────────────────────────────────────

export const useConversionQuote = (points: number) =>
  useQuery({
    queryKey: ['cashWallet', 'quote', points],
    queryFn: () => walletApi.quote(points),
    enabled: points > 0,
  })

export const useConversion = () => {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: ConvertToPointsRequest) => walletApi.convert(data),
    onSuccess: (quote) => {
      invalidateWalletData(qc)
      toast.success(`Đã đổi thành công ${quote.points} điểm thưởng`)
    },
    onError: (error: any) => toast.error(errMsg(error, 'Quy đổi thất bại'), { duration: 8000 }),
  })

  return { convert: mutation.mutateAsync, isConverting: mutation.isPending }
}

// ── Cấu hình ─────────────────────────────────────────────────────

export const useWalletConfig = (enabled = true) => {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['walletConfig'],
    queryFn: () => walletApi.getConfig(),
    enabled,
  })

  const updateMutation = useMutation({
    mutationFn: (data: WalletConfigRequest) => walletApi.updateConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['walletConfig'] })
      qc.invalidateQueries({ queryKey: ['cashWallet'] })
      toast.success('Đã lưu cấu hình ví tiền')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Lưu cấu hình thất bại')),
  })

  return {
    ...query,
    updateConfig: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}

// ── Đối soát ─────────────────────────────────────────────────────

export const useSepayEvents = (scope: 'queue' | 'all' = 'queue', page = 0, size = 20) =>
  useQuery({
    queryKey: ['sepayEvents', scope, page, size],
    queryFn: () => walletApi.getSepayEvents({ scope, page, size }),
  })

/** Dùng cho huy hiệu số lượng trên tab đối soát: không ai phải nhớ vào xem. */
export const useWalletReconcile = (enabled = true) =>
  useQuery({
    queryKey: ['walletReconcile'],
    queryFn: () => walletApi.reconcile(),
    enabled,
  })

export const useReconcileActions = () => {
  const qc = useQueryClient()

  const resolveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResolveSepayEventRequest }) =>
      walletApi.resolveSepayEvent(id, data),
    onSuccess: () => {
      invalidateWalletData(qc)
      toast.success('Đã xử lý giao dịch SePay')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Xử lý thất bại'), { duration: 8000 }),
  })

  return {
    resolveEvent: resolveMutation.mutateAsync,
    isResolving: resolveMutation.isPending,
  }
}
