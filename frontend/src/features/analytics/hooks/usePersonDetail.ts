import { useQuery } from '@tanstack/react-query'
import { personDetailApi, type PersonDetailParams } from '../api/personDetailApi'

/**
 * Cả trang chi tiết một người trong một truy vấn.
 *
 * @param enabled false để hoãn hẳn lời gọi — thẻ xem nhanh trên bảng xếp hạng chỉ nạp khi chuột
 *                thật sự dừng lại ở một hàng, không nạp theo mỗi lần chuột lướt qua.
 */
export function usePersonDetail(userId: string | undefined, params?: PersonDetailParams,
                                enabled = true) {
  return useQuery({
    queryKey: ['person-detail', userId, params?.periodId, params?.periodIdTo, params?.cycleId,
      params?.light ?? false],
    queryFn: () => personDetailApi.get(userId as string, params),
    enabled: enabled && !!userId,
  })
}
