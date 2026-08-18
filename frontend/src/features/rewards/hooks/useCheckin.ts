import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { checkinApi } from '../api/checkinApi'
import type { CheckinConfigRequest } from '../types'

/** Lấy thông báo nghiệp vụ backend trả về; các lỗi này là câu tiếng Việt viết sẵn cho người dùng. */
const errMsg = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback

/**
 * Trạng thái điểm danh của tôi. Dùng ở thẻ trong "Điểm thưởng của tôi" và ở banner nhắc
 * nhở nằm trong AppLayout.
 *
 * <p>{@code staleTime} 5 phút vì banner sống suốt phiên làm việc: để mặc định thì mỗi
 * lần người dùng quay lại tab trình duyệt là một request, cả ngày không đổi kết quả.
 * Sau khi điểm danh, {@link useCheckin} ghi thẳng kết quả mới vào cache nên banner tắt
 * ngay mà không cần đợi hết hạn.
 *
 * @param enabled đặt false khi người dùng không có quyền REWARD:VIEW_MY — gọi vẫn sẽ 403.
 */
export const useMyCheckinStatus = (enabled = true) =>
  useQuery({
    queryKey: ['checkinStatus', 'me'],
    queryFn: () => checkinApi.getMyStatus(),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

export const useCheckin = () => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: () => checkinApi.checkin(),
    onSuccess: (status) => {
      // Điểm danh vừa đổi trạng thái điểm danh vừa cộng vào ví và ghi một dòng sổ cái —
      // thiếu cái nào thì màn hình hiện số dư cũ ngay cạnh thông báo vừa nhận điểm.
      qc.setQueryData(['checkinStatus', 'me'], status)
      qc.invalidateQueries({ queryKey: ['rewardWallet'] })
      qc.invalidateQueries({ queryKey: ['rewardTransactions'] })

      toast.success(`Điểm danh thành công, +${status.todayPoints} điểm`, {
        description:
          status.streakLength > 1
            ? `Bạn đang có chuỗi ${status.streakLength} ngày liên tiếp.`
            : undefined,
      })
    },
    onError: (error) => toast.error(errMsg(error, 'Điểm danh thất bại')),
  })
}

/** Cấu hình điểm danh của tổ chức — tab "Điểm danh" trong Quản lý thưởng điểm. */
export const useCheckinConfig = () => {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['checkinConfig'],
    queryFn: () => checkinApi.getConfig(),
  })

  const saveMutation = useMutation({
    mutationFn: (data: CheckinConfigRequest) => checkinApi.saveConfig(data),
    onSuccess: (config) => {
      qc.setQueryData(['checkinConfig'], config)
      // Sếp cũng là người điểm danh: đổi cấu hình phải thấy ngay ở thẻ của chính mình.
      qc.invalidateQueries({ queryKey: ['checkinStatus'] })
      toast.success('Đã lưu cấu hình điểm danh')
    },
    onError: (error) =>
      toast.error(errMsg(error, 'Lưu cấu hình điểm danh thất bại'), { duration: 8000 }),
  })

  return {
    ...query,
    saveConfig: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  }
}
