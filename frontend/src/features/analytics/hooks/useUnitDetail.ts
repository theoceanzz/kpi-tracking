import { useQuery } from '@tanstack/react-query'
import { unitDetailApi, type UnitDetailParams } from '../api/unitDetailApi'

/**
 * Cả trang chi tiết một đơn vị trong một truy vấn.
 *
 * @param enabled false để hoãn hẳn lời gọi — thẻ xem nhanh trên bảng xếp hạng chỉ nạp khi chuột
 *                thật sự dừng lại ở một hàng.
 */
export function useUnitDetail(orgUnitId: string | undefined, params?: UnitDetailParams,
                              enabled = true) {
  return useQuery({
    queryKey: ['unit-detail', orgUnitId, params?.periodId, params?.periodIdTo, params?.cycleId,
      params?.light ?? false],
    queryFn: () => unitDetailApi.get(orgUnitId as string, params),
    enabled: enabled && !!orgUnitId,
  })
}
